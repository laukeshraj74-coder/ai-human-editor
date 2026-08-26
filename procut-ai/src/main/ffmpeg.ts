import ffmpeg from 'fluent-ffmpeg';
import { CutPoint, Caption, ZoomPoint, Transition, FFmpegProgress, VideoInfo } from '../shared/types';

export interface EditingPlan {
  inputPath: string;
  outputPath: string;
  cuts?: CutPoint[];
  effects?: string[];
  captions?: Caption[];
  backgroundMusic?: string;
  zoomPoints?: ZoomPoint[];
  transitions?: Transition[];
}

/**
 * Get video metadata using ffprobe
 */
export async function getVideoInfo(videoPath: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(videoPath, (err: any, metadata: any) => {
      if (err) reject(err);
      const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
      const audioStream = metadata.streams.find((s: any) => s.codec_type === 'audio');
      if (!videoStream) {
        reject(new Error('No video stream found'));
        return;
      }
      const frameRateParts = (videoStream.r_frame_rate || '30/1').split('/');
      const fps = Number(frameRateParts[0]) / Number(frameRateParts[1]) || 30;
      
      resolve({
        duration: metadata.format.duration || 0,
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        fps: fps,
        codec: videoStream.codec_name || 'unknown',
        hasAudio: !!audioStream,
      });
    });
  });
}

/**
 * Cut video segment between start and end times
 */
export async function cutVideo(
  inputPath: string,
  outputPath: string,
  startTime: number,
  endTime: number,
  onProgress?: (progress: FFmpegProgress) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const duration = endTime - startTime;
    ffmpeg(inputPath)
      .setStartTime(startTime)
      .setDuration(duration)
      .outputOptions(['-c:v libx264', '-preset medium', '-crf 23', '-c:a aac', '-b:a 192k'])
      .on('progress', (progress: any) => {
        if (onProgress && progress.timemark) {
          onProgress({
            percent: (progress.percent || 0) * 100,
            currentFps: progress.currentFps || 0,
            currentKbps: progress.currentKbps || 0,
            targetSize: progress.targetSize || 0,
            timemark: progress.timemark,
          });
        }
      })
      .on('end', () => resolve())
      .on('error', (err: any) => reject(err))
      .save(outputPath);
  });
}

/**
 * Plan caption filter parameters based on position
 */
function planCaptionsMap(caption: Caption): {
  yPos: string;
  fontSize: number;
  fontColor: string;
  filter: string;
} {
  const captionPosition = caption.position || 'bottom';
  
  let yPos = 'h*0.9';
  if (captionPosition === 'top') {
    yPos = 'h*0.1';
  } else if (captionPosition === 'center') {
    yPos = 'h/2';
  }
  
  const fontSize = caption.fontSize || 24;
  const fontColor = caption.fontColor || 'white';
  
  // Escape special characters in text for drawtext filter
  const escapedText = caption.text
    .replace(/'/g, "\\\\'")
    .replace(/:/g, '\\\\:');
  
  const filter = `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=${fontColor}:box=1:boxcolor=black@0.7:x=(w-text_w)/2:y=${yPos}:enable='between(t,${caption.startTime},${caption.endTime})'`;
  
  return { yPos, fontSize, fontColor, filter };
}

/**
 * Generate FFmpeg command string from editing plan
 */
export function generateFFmpegCommand(plan: EditingPlan): string {
  let command = `ffmpeg -i "${plan.inputPath}"`;
  const filters: string[] = [];
  
  // Handle cuts using select filter
  if (plan.cuts && plan.cuts.length > 0) {
    const keepCuts = plan.cuts.filter(cut => cut.keep !== false);
    if (keepCuts.length > 0) {
      const selectFilter = keepCuts.map(cut => `between(t,${cut.startTime},${cut.endTime})`).join('+');
      if (selectFilter) {
        filters.push(`select="${selectFilter}"`);
        filters.push(`concat=n=${keepCuts.length}:v=1:a=1`);
      }
    }
  }
  
  // Add zoompan effect for dynamic zooms
  if (plan.effects?.includes('zoompan') || (plan.zoomPoints && plan.zoomPoints.length > 0)) {
    const zoomPoints = plan.zoomPoints || [];
    if (zoomPoints.length > 0) {
      // Create zoompan filter based on zoom points
      const zoomFilters = zoomPoints.map(point => 
        `zoompan=z=${point.zoomLevel}:d=${point.duration * 30}:x=${point.x || 'iw/2'}:y=${point.y || 'ih/2'}`
      );
      filters.push(zoomFilters.join(','));
    } else {
      filters.push('zoompan=z=1.5:d=50:x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2)');
    }
  }
  
  // Apply crossfade transitions
  if (plan.transitions && plan.transitions.some(t => t.type === 'xfade')) {
    const xfadeTransitions = plan.transitions.filter(t => t.type === 'xfade');
    xfadeTransitions.forEach((transition) => {
      filters.push(`xfade=transition=fade:duration=${transition.duration}:offset=${transition.timestamp}`);
    });
  }
  
  // Add captions
  if (plan.captions && plan.captions.length > 0) {
    plan.captions.forEach((caption) => {
      const { filter } = planCaptionsMap(caption);
      filters.push(filter);
    });
  }
  
  // Add background music if specified
  if (plan.backgroundMusic) {
    command += ` -i "${plan.backgroundMusic}"`;
  }
  
  if (filters.length > 0) {
    command += ` -vf "${filters.join(',')}"`;
  }
  
  // Audio mixing for background music
  if (plan.backgroundMusic) {
    command += ' -filter_complex "[1:a]volume=0.3[a1];[0:a][a1]amix=inputs=2:duration=first" ';
  }
  
  command += ` -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 192k "${plan.outputPath}"`;
  return command;
}

/**
 * Execute FFmpeg command with progress tracking
 */
export async function executeFFmpegCommand(
  plan: EditingPlan,
  onProgress?: (progress: FFmpegProgress) => void
): Promise<{ success: boolean; outputPath: string; duration: number }> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(plan.inputPath);
    
    // Apply cuts
    if (plan.cuts && plan.cuts.length > 0) {
      const keepCuts = plan.cuts.filter(cut => cut.keep !== false);
      if (keepCuts.length > 0) {
        // For multiple cuts, we need to use a different approach
        // This is a simplified version - in production, you'd use concat demuxer
        const selectFilter = keepCuts.map(cut => `between(t,${cut.startTime},${cut.endTime})`).join('+');
        command.videoFilters([
          { filter: 'select', options: selectFilter },
          { filter: 'concat', options: { n: keepCuts.length, v: 1, a: 1 } }
        ]);
      }
    }
    
    // Apply effects
    if (plan.effects?.includes('zoompan')) {
      command.videoFilters('zoompan=z=1.5:d=50:x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2)');
    }
    
    // Apply captions
    if (plan.captions && plan.captions.length > 0) {
      plan.captions.forEach((caption) => {
        const { filter } = planCaptionsMap(caption);
        command.videoFilters(filter);
      });
    }
    
    // Add background music
    if (plan.backgroundMusic) {
      command.input(plan.backgroundMusic);
      command.complexFilter([
        '[1:a]volume=0.3[a1]',
        '[0:a][a1]amix=inputs=2:duration=first'
      ]);
    }
    
    command
      .outputOptions(['-c:v libx264', '-preset medium', '-crf 23', '-c:a aac', '-b:a 192k'])
      .on('progress', (progress: any) => {
        if (onProgress && progress.timemark) {
          onProgress({
            percent: (progress.percent || 0) * 100,
            currentFps: progress.currentFps || 0,
            currentKbps: progress.currentKbps || 0,
            targetSize: progress.targetSize || 0,
            timemark: progress.timemark,
          });
        }
      })
      .on('end', () => {
        const totalDuration = plan.cuts 
          ? plan.cuts.reduce((acc, c) => acc + (c.endTime - c.startTime), 0) 
          : 0;
        resolve({ success: true, outputPath: plan.outputPath, duration: totalDuration });
      })
      .on('error', (err: any) => reject(err))
      .save(plan.outputPath);
  });
}

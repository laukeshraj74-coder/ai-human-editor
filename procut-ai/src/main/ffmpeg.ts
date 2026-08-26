import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { 
  CutPoint, 
  Caption, 
  ZoomPoint, 
  Transition, 
  FFmpegProgress, 
  VideoInfo,
  EditingPlan,
  SFXEvent,
} from '../shared/types';

/**
 * Plan caption filter parameters based on position
 * Handles captionPosition, yPos, fontSize, and fontColor with strict TypeScript types
 */
function planCaptionsMap(caption: Caption): {
  yPos: string;
  fontSize: number;
  fontColor: string;
  filter: string;
} {
  const captionPosition: 'bottom' | 'top' | 'center' = caption.position || 'bottom';
  
  let yPos: string = 'h*0.9';
  if (captionPosition === 'top') {
    yPos = 'h*0.1';
  } else if (captionPosition === 'center') {
    yPos = 'h/2';
  }
  
  const fontSize: number = caption.fontSize || 24;
  const fontColor: string = caption.fontColor || 'white';
  
  // Escape special characters in text for drawtext filter
  const escapedText: string = caption.text
    .replace(/'/g, "\\'")
    .replace(/:/g, '\\:');
  
  const filter: string = `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=${fontColor}:box=1:boxcolor=black@0.7:x=(w-text_w)/2:y=${yPos}:enable='between(t,${caption.startTime},${caption.endTime})'`;
  
  return { yPos, fontSize, fontColor, filter };
}

/**
 * Generate FFmpeg complex filter for smart cuts (filler removal)
 * Uses select filter to keep only engaging segments
 */
function generateSmartCutsFilter(cutPoints: CutPoint[]): string[] {
  const keepSegments = cutPoints.filter(cp => cp.keep !== false);
  
  if (keepSegments.length === 0) {
    return [];
  }
  
  if (keepSegments.length === 1) {
    // Single segment - simple trim
    const segment = keepSegments[0];
    return [`trim=start=${segment.startTime}:end=${segment.endTime}`, 'format=yuv420p'];
  }
  
  // Multiple segments - use concat
  const selectExpression = keepSegments
    .map(seg => `between(t,${seg.startTime},${seg.endTime})`)
    .join('+');
  
  return [
    `select=${selectExpression}`,
    `concat=n=${keepSegments.length}:v=1:a=1`,
    'format=yuv420p'
  ];
}

/**
 * Generate zoompan filter for dynamic MrBeast-style zooms
 */
function generateZoompanFilter(zoomPoints: ZoomPoint[], fps: number = 30): string {
  if (zoomPoints.length === 0) {
    return 'zoompan=z=1:d=1';
  }
  
  // Build zoompan filter chain for multiple zoom points
  const zoomFilters = zoomPoints.map(point => {
    const duration = Math.floor(point.duration * fps);
    const x = point.x !== undefined ? point.x : 'iw/2-(iw/zoom/2)';
    const y = point.y !== undefined ? point.y : 'ih/2-(ih/zoom/2)';
    return `zoompan=z=${point.zoomLevel}:d=${duration}:x=${x}:y=${y}`;
  });
  
  return zoomFilters.join(',');
}

/**
 * Generate xfade transition filter
 */
function generateXfadeFilter(transitions: Transition[]): string {
  const xfadeTransitions = transitions.filter(t => t.type === 'xfade');
  
  if (xfadeTransitions.length === 0) {
    return '';
  }
  
  // For multiple transitions, we need to chain them
  // This is a simplified version - production would need more complex chaining
  return xfadeTransitions.map(t => 
    `xfade=transition=fade:duration=${t.duration}:offset=${t.timestamp}`
  ).join(',');
}

/**
 * Generate audio filter for background music mixing
 */
function generateAudioFilter(backgroundMusic?: { enabled: boolean; filePath?: string; volume: number; fadeDuration: number }, sfx?: SFXEvent[]): string {
  const filters: string[] = [];
  
  if (backgroundMusic && backgroundMusic.enabled && backgroundMusic.filePath) {
    // Reduce background music volume and mix with original audio
    filters.push(`[1:a]volume=${backgroundMusic.volume}[a1]`);
    filters.push('[0:a][a1]amix=inputs=2:duration=first');
  }
  
  // Add SFX at specific timestamps (simplified)
  if (sfx && sfx.length > 0) {
    sfx.forEach((effect, _idx) => {
      // In production, you'd load SFX files and mix them at specific timestamps
      console.log(`Adding ${effect.type} SFX at ${effect.startTime}s`);
    });
  }
  
  return filters.length > 0 ? filters.join(';') : '';
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
 * Cut video segment between start and end times (Filler Removal)
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
 * Generate complete FFmpeg command string from editing plan
 */
export function generateFFmpegCommand(plan: EditingPlan): string {
  let command = `ffmpeg -i "${plan.inputPath}"`;
  const filters: string[] = [];
  
  // Handle smart cuts (filler removal)
  if (plan.cuts && plan.cuts.length > 0) {
    const cutFilters = generateSmartCutsFilter(plan.cuts);
    if (cutFilters.length > 0) {
      filters.push(...cutFilters);
    }
  }
  
  // Add dynamic zoompan effect (MrBeast style)
  if (plan.zoomPoints && plan.zoomPoints.length > 0) {
    const zoomFilter = generateZoompanFilter(plan.zoomPoints, 30);
    filters.push(zoomFilter);
  } else if (plan.effects?.includes('zoompan')) {
    // Default zoompan if no specific points provided
    filters.push('zoompan=z=1.5:d=50:x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2)');
  }
  
  // Apply xfade transitions
  if (plan.transitions && plan.transitions.length > 0) {
    const xfadeFilter = generateXfadeFilter(plan.transitions);
    if (xfadeFilter) {
      filters.push(xfadeFilter);
    }
  }
  
  // Add captions with drawtext filter
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
  
  // Build video filter chain
  if (filters.length > 0) {
    command += ` -vf "${filters.join(',')}"`;
  }
  
  // Audio mixing for background music
  if (plan.backgroundMusic) {
    const audioFilter = generateAudioFilter(plan.backgroundMusic, plan.sfx);
    if (audioFilter) {
      command += ` -filter_complex "${audioFilter}"`;
    }
  }
  
  command += ` -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 192k "${plan.outputPath}"`;
  return command;
}

/**
 * Execute FFmpeg command with progress tracking
 * Implements full MrBeast-style editing: smart cuts, dynamic zooms, transitions, captions, audio
 */
export async function executeFFmpegCommand(
  plan: EditingPlan,
  onProgress?: (progress: FFmpegProgress) => void
): Promise<{ success: boolean; outputPath: string; duration: number }> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(plan.inputPath);
    
    // Apply smart cuts (filler removal)
    if (plan.cuts && plan.cuts.length > 0) {
      const keepSegments = plan.cuts.filter(cut => cut.keep !== false);
      
      if (keepSegments.length === 1) {
        // Simple single cut
        const segment = keepSegments[0];
        command.setStartTime(segment.startTime).setDuration(segment.endTime - segment.startTime);
      } else if (keepSegments.length > 1) {
        // Multiple cuts using select filter
        const selectExpression = keepSegments
          .map(seg => `between(t,${seg.startTime},${seg.endTime})`)
          .join('+');
        command.videoFilters([
          { filter: 'select', options: selectExpression },
          { filter: 'concat', options: { n: keepSegments.length, v: 1, a: 1 } }
        ]);
      }
    }
    
    // Apply dynamic zoompan (MrBeast-style pacing)
    if (plan.zoomPoints && plan.zoomPoints.length > 0) {
      const zoomFilters = plan.zoomPoints.map(point => ({
        filter: 'zoompan',
        options: {
          z: point.zoomLevel,
          d: Math.floor(point.duration * 30),
          x: point.x !== undefined ? point.x : 'iw/2-(iw/zoom/2)',
          y: point.y !== undefined ? point.y : 'ih/2-(ih/zoom/2)'
        }
      }));
      command.videoFilters(zoomFilters);
    } else if (plan.effects?.includes('zoompan')) {
      command.videoFilters('zoompan=z=1.5:d=50:x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2)');
    }
    
    // Apply xfade transitions
    if (plan.transitions && plan.transitions.length > 0) {
      const xfadeTransitions = plan.transitions.filter(t => t.type === 'xfade');
      xfadeTransitions.forEach(transition => {
        command.videoFilters([
          {
            filter: 'xfade',
            options: {
              transition: 'fade',
              duration: transition.duration,
              offset: transition.timestamp
            }
          }
        ]);
      });
    }
    
    // Apply captions with proper positioning
    if (plan.captions && plan.captions.length > 0) {
      plan.captions.forEach((caption) => {
        const { filter } = planCaptionsMap(caption);
        command.videoFilters(filter);
      });
    }
    
    // Add background music and SFX
    if (plan.backgroundMusic) {
      command.input(plan.backgroundMusic);
      command.complexFilter([
        '[1:a]volume=0.3[a1]',
        '[0:a][a1]amix=inputs=2:duration=first'
      ]);
    }
    
    // Add SFX (in production, would load actual SFX files)
    if (plan.sfx && plan.sfx.length > 0) {
      plan.sfx.forEach((sfx, idx) => {
        console.log(`SFX: Adding ${sfx.type} at ${sfx.timestamp}s`);
        // Production implementation would add actual SFX files here
      });
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
      .on('error', (err: any) => {
        console.error('FFmpeg error:', err);
        reject(err);
      })
      .save(plan.outputPath);
  });
}

/**
 * Execute smart cuts with segment concatenation
 */
export async function executeSmartCuts(
  inputPath: string,
  cutPoints: CutPoint[],
  outputDir: string,
  onProgress?: (progress: FFmpegProgress) => void
): Promise<string> {
  const keepSegments = cutPoints.filter(cp => cp.keep !== false);
  
  if (keepSegments.length === 0) {
    throw new Error('No segments to keep');
  }
  
  const outputPath = path.join(outputDir, `cut_${path.basename(inputPath)}`);
  
  if (keepSegments.length === 1) {
    // Single segment cut
    const segment = keepSegments[0];
    await cutVideo(inputPath, outputPath, segment.startTime, segment.endTime, onProgress);
    return outputPath;
  }
  
  // Multiple segments - create temp files and concatenate
  const tempDir = path.join(outputDir, 'temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }
  
  const tempFiles: string[] = [];
  
  for (let i = 0; i < keepSegments.length; i++) {
    const segment = keepSegments[i];
    const tempPath = path.join(tempDir, `segment_${i}.mp4`);
    tempFiles.push(tempPath);
    
    await cutVideo(inputPath, tempPath, segment.startTime, segment.endTime, onProgress);
  }
  
  // Create concat list file
  const concatListPath = path.join(tempDir, 'concat_list.txt');
  const concatContent = tempFiles.map(f => `file '${f}'`).join('\n');
  fs.writeFileSync(concatListPath, concatContent);
  
  // Concatenate using FFmpeg concat demuxer
  return new Promise((resolve, reject) => {
    ffmpeg()
      .input(concatListPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c:v libx264', '-c:a aac'])
      .on('end', () => {
        // Cleanup temp files
        tempFiles.forEach(f => {
          try { fs.unlinkSync(f); } catch (e) {}
        });
        fs.unlinkSync(concatListPath);
        resolve(outputPath);
      })
      .on('error', reject)
      .save(outputPath);
  });
}

export { planCaptionsMap };
export default { 
  getVideoInfo, 
  cutVideo, 
  generateFFmpegCommand, 
  executeFFmpegCommand,
  executeSmartCuts,
  planCaptionsMap
};

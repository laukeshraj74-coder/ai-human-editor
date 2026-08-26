import ffmpeg from 'fluent-ffmpeg';

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  hasAudio: boolean;
}

export interface CutPoint {
  startTime: number;
  endTime: number;
  keep?: boolean;
  reason?: string;
}

export interface FFmpegProgress {
  percent: number;
  currentFps: number;
  currentKbps: number;
  targetSize: number;
  timemark: string;
  eta?: number;
}

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
      resolve({
        duration: metadata.format.duration || 0,
        width: videoStream.width || 0,
        height: videoStream.height || 0,
        fps: Number(videoStream.r_frame_rate?.split('/')[0]) / Number(videoStream.r_frame_rate?.split('/')[1]) || 30,
        codec: videoStream.codec_name || 'unknown',
        hasAudio: !!audioStream,
      });
    });
  });
}

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

export interface EditingPlan {
  inputPath: string;
  outputPath: string;
  cuts?: CutPoint[];
  effects?: string[];
  captions?: Caption[];
  backgroundMusic?: string;
}

export interface Caption {
  text: string;
  startTime: number;
  endTime: number;
  fontSize?: number;
  fontColor?: string;
  position?: 'bottom' | 'top' | 'center';
}

export function generateFFmpegCommand(plan: EditingPlan): string {
  let command = `ffmpeg -i "${plan.inputPath}"`;
  const filters: string[] = [];
  if (plan.cuts && plan.cuts.length > 0) {
    const keepCuts = plan.cuts.filter(cut => cut.keep !== false);
    const selectFilter = keepCuts.map(cut => `between(t,${cut.startTime},${cut.endTime})`).join('+');
    if (selectFilter) {
      filters.push(`select="${selectFilter}"`);
      filters.push(`concat=n=${keepCuts.length}:v=1:a=1`);
    }
  }
  if (plan.effects?.includes('zoompan')) {
    filters.push('zoompan=z=1.5:d=50:x=iw/2-(iw/zoom/2):y=ih/2-(ih/zoom/2)');
  }
  if (plan.captions && plan.captions.length > 0) {
    plan.captions.forEach((caption) => {
      filters.push(`drawtext=text='${caption.text.replace(/'/g, "\\'")}':fontsize=${caption.fontSize || 24}:fontcolor=${caption.fontColor || 'white'}:box=1:boxcolor=black@0.7:x=(w-text_w)/2:y=h*0.9:enable='between(t,${caption.startTime},${caption.endTime})'`);
    });
  }
  if (filters.length > 0) {
    command += ` -vf "${filters.join(',')}"`;
  }
  command += ` -c:v libx264 -preset medium -crf 23 -c:a aac -b:a 192k "${plan.outputPath}"`;
  return command;
}

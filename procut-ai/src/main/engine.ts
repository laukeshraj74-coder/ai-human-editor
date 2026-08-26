import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';
import {
  EditingPlan,
  CutPoint,
  ZoomPoint,
  Transition,
  SFXEvent,
  FFmpegProgress,
  VideoInfo,
  Caption,
} from '../shared/types';
import { applyPresetToPlan } from './presets';

// SFX file paths (relative to project root)
const SFX_LIBRARY: Record<string, string> = {
  riser: path.join(__dirname, '../../assets/sfx/riser.mp3'),
  whoosh: path.join(__dirname, '../../assets/sfx/whoosh.mp3'),
  hit: path.join(__dirname, '../../assets/sfx/hit.mp3'),
  boom: path.join(__dirname, '../../assets/sfx/boom.mp3'),
  laugh: path.join(__dirname, '../../assets/sfx/laugh.mp3'),
  transition: path.join(__dirname, '../../assets/sfx/transition.mp3'),
};

interface FFmpegJob {
  id: string;
  command: ffmpeg.FfmpegCommand;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: FFmpegProgress;
  error?: string;
  outputPath?: string;
}

export class FFmpegEngine extends EventEmitter {
  private jobs: Map<string, FFmpegJob> = new Map();
  private outputDir: string;

  constructor(outputDir: string = 'output') {
    super();
    this.outputDir = path.resolve(process.cwd(), outputDir);
    
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async getVideoInfo(inputPath: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) { reject(err); return; }
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
        if (!videoStream) { reject(new Error('No video stream found')); return; }
        resolve({
          duration: metadata.format.duration || 0,
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          fps: Number(videoStream.r_frame_rate?.split('/')[0] || 30) / 
               Number(videoStream.r_frame_rate?.split('/')[1] || 1),
          codec: videoStream.codec_name || 'unknown',
          hasAudio: !!audioStream,
        });
      });
    });
  }

  private buildSmartCutsFilter(cuts: CutPoint[], duration: number): string {
    const keepSegments = cuts.filter(c => c.keep !== false);
    if (keepSegments.length === 0) return '';
    if (keepSegments.length === 1) {
      const seg = keepSegments[0];
      return `trim=start=${seg.startTime}:end=${seg.endTime}`;
    }
    const selectExpr = keepSegments.map(cut => 
      `between(t,${cut.startTime},${cut.endTime})`
    ).join('+');
    return `select=${selectExpr},asetpts=N/SR/TB`;
  }

  private buildZoompanFilter(zoomPoints: ZoomPoint[], fps: number = 30): string {
    if (zoomPoints.length === 0) return '';
    const zoomFilters = zoomPoints.map(point => {
      const durationFrames = Math.floor(point.duration * fps);
      const x = point.x ?? 'iw/2-(iw/zoom/2)';
      const y = point.y ?? 'ih/2-(ih/zoom/2)';
      return `zoompan=z='min(1+(${point.zoomLevel - 1})*t/${durationFrames}, ${point.zoomLevel})':d=${durationFrames}:x=${x}:y=${y}`;
    });
    return zoomFilters.join(',');
  }

  private buildXfadeFilter(transitions: Transition[], duration: number): string {
    if (transitions.length === 0) return '';
    const transitionMap: Record<string, string> = {
      xfade: 'fade', fade: 'fade', slideleft: 'slideleft', slideright: 'slideright',
      wipeleft: 'wipeleft', wiperight: 'wiperight', circleopen: 'circleopen',
      circleclose: 'circleclose', dissolve: 'dissolve',
    };
    const filters: string[] = [];
    transitions.forEach((trans) => {
      const offset = trans.offset ?? trans.timestamp;
      const xfadeType = transitionMap[trans.type] || 'fade';
      filters.push(`xfade=transition=${xfadeType}:duration=${trans.duration}:offset=${offset}`);
    });
    return filters.join(',');
  }

  private buildCaptionFilters(captions: Caption[], width: number, height: number): string[] {
    const filters: string[] = [];
    captions.forEach((caption) => {
      const fontSize = caption.fontSize || 48;
      const fontColor = caption.fontColor || 'white';
      const bgColor = caption.backgroundColor || 'black@0.7';
      const style = caption.style || 'normal';
      const animation = caption.animation || 'pop';
      
      let yPos: string;
      switch (caption.position) {
        case 'top': yPos = 'h*0.1'; break;
        case 'center': yPos = 'h/2'; break;
        default: yPos = 'h*0.9';
      }

      const escapedText = caption.text.replace(/'/g, "\\\\'").replace(/:/g, '\\\\:').replace(/%/g, '\\\\%');
      let filter = `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=${fontColor}:box=1:boxcolor=${bgColor}:x=(w-text_w)/2:y=${yPos}:enable='between(t,${caption.startTime},${caption.endTime})'`;

      if (style === 'bold') {
        filter += ':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
      } else if (style === 'highlight') {
        filter = filter.replace(/fontcolor=\w+/, 'fontcolor=#FFFF00');
        filter += ':boxcolor=black@0.9';
      }

      filters.push(filter);
    });
    return filters;
  }

  private buildAudioFilters(
    sfx: SFXEvent[], 
    backgroundMusic?: { enabled: boolean; filePath?: string; volume: number; fadeDuration: number },
    duration: number = 60
  ): string {
    const filters: string[] = [];
    let inputIndex = 1;

    if (sfx && sfx.length > 0) {
      sfx.forEach((event, idx) => {
        const sfxPath = event.filePath || SFX_LIBRARY[event.type];
        if (fs.existsSync(sfxPath)) {
          const volume = event.volume ?? 0.5;
          const delayMs = Math.floor(event.startTime * 1000);
          filters.push(`[${inputIndex}:a]adelay=${delayMs}|${delayMs},volume=${volume}[sfx${idx}]`);
          inputIndex++;
        }
      });

      if (filters.length > 0) {
        const sfxInputs = filters.map((_, i) => `[sfx${i}]`).join('');
        if (filters.length === 1) {
          filters.push('[sfx0][sfx_out]');
        } else {
          filters.push(`${sfxInputs}amix=inputs=${filters.length}:duration=shortest[sfx_out]`);
        }
      }
    }

    if (backgroundMusic?.enabled && backgroundMusic.filePath) {
      const musicVolume = backgroundMusic.volume ?? 0.3;
      const fadeDuration = backgroundMusic.fadeDuration ?? 1.0;
      filters.push(`[${inputIndex}:a]volume=${musicVolume},afade=t=in:st=0:d=${fadeDuration},afade=t=out:st=${Math.max(0, duration - fadeDuration)}:d=${fadeDuration}[music]`);
      const hasSFX = filters.some(f => f.includes('[sfx_out]'));
      if (hasSFX) {
        filters.push('[0:a][sfx_out][music]amix=inputs=3:duration=longest[aout]');
      } else {
        filters.push('[0:a][music]amix=inputs=2:duration=longest[aout]');
      }
    } else if (filters.length > 0 && !filters.some(f => f.includes('[aout]'))) {
      filters.push('[0:a][sfx_out]amix=inputs=2:duration=longest[aout]');
    }

    return filters.filter(f => f && !f.includes('amix=inputs=')).join(';');
  }

  async executePlan(plan: EditingPlan): Promise<string> {
    const jobId = `job_${Date.now()}`;
    const inputPath = path.resolve(plan.inputPath);
    const outputPath = path.resolve(plan.outputPath || path.join(this.outputDir, `edited_${Date.now()}.mp4`));

    if (plan.preset) {
      const videoInfo = await this.getVideoInfo(inputPath);
      plan = applyPresetToPlan({ ...plan, duration: videoInfo.duration }, plan.preset);
    }

    const videoInfo = await this.getVideoInfo(inputPath);
    const { duration, width, height, fps } = videoInfo;

    let command = ffmpeg(inputPath);

    if (plan.backgroundMusic?.enabled && plan.backgroundMusic.filePath) {
      command = command.input(plan.backgroundMusic.filePath).inputOptions(['-stream_loop', '-1']);
    }

    if (plan.sfx && plan.sfx.length > 0) {
      plan.sfx.forEach(sfx => {
        const sfxPath = sfx.filePath || SFX_LIBRARY[sfx.type];
        if (fs.existsSync(sfxPath)) {
          command = command.input(sfxPath);
        }
      });
    }

    const filterComplex: string[] = [];
    const videoFilters: string[] = [];

    if (plan.cuts && plan.cuts.length > 0) {
      const cutFilter = this.buildSmartCutsFilter(plan.cuts, duration);
      if (cutFilter) videoFilters.push(cutFilter);
    }

    if (plan.zoomPoints && plan.zoomPoints.length > 0) {
      const zoomFilter = this.buildZoompanFilter(plan.zoomPoints, fps);
      if (zoomFilter) videoFilters.push(zoomFilter);
    }

    if (plan.transitions && plan.transitions.length > 0) {
      const transitionFilter = this.buildXfadeFilter(plan.transitions, duration);
      if (transitionFilter) videoFilters.push(transitionFilter);
    }

    if (plan.captions && plan.captions.length > 0) {
      const captionFilters = this.buildCaptionFilters(plan.captions, width, height);
      videoFilters.push(...captionFilters);
    }

    if (videoFilters.length > 0) {
      filterComplex.push(videoFilters.join(','));
    }

    if ((plan.sfx && plan.sfx.length > 0) || plan.backgroundMusic?.enabled) {
      const audioFilter = this.buildAudioFilters(plan.sfx || [], plan.backgroundMusic, duration);
      if (audioFilter) filterComplex.push(audioFilter);
    }

    if (filterComplex.length > 0) {
      command = command.complexFilter(filterComplex.join(';'));
    }

    command.outputOptions(['-c:v libx264', '-preset medium', '-crf 23', '-c:a aac', '-b:a 192k', '-movflags +faststart'])
      .on('start', (cmd) => { console.log(`FFmpeg started: ${cmd}`); this.emit('start', { jobId, command: cmd }); })
      .on('progress', (progress) => {
        const ffmpegProgress: FFmpegProgress = {
          percent: progress.percent || 0, currentFps: progress.currentFps || 0,
          currentKbps: progress.currentKbps || 0, targetSize: progress.targetSize || 0,
          timemark: progress.timemark || '00:00:00',
        };
        this.emit('progress', { jobId, progress: ffmpegProgress });
      })
      .on('end', () => { console.log(`FFmpeg completed: ${outputPath}`); this.emit('end', { jobId, outputPath }); })
      .on('error', (err) => { console.error(`FFmpeg error: ${err.message}`); this.emit('error', { jobId, error: err.message }); })
      .save(outputPath);

    this.jobs.set(jobId, { id: jobId, command, status: 'running', progress: { percent: 0, currentFps: 0, currentKbps: 0, targetSize: 0, timemark: '00:00:00' } });
    return jobId;
  }

  getJobStatus(jobId: string): FFmpegJob | undefined { return this.jobs.get(jobId); }

  cancelJob(_jobId: string): boolean {
    const job = this.jobs.get(_jobId);
    if (job && job.status === 'running') {
      job.command.kill('SIGTERM');
      job.status = 'failed';
      job.error = 'Cancelled by user';
      this.emit('cancelled', { jobId: _jobId });
      return true;
    }
    return false;
  }

  cleanupJobs(maxAge: number = 3600000): void {
    const now = Date.now();
    for (const [id, job] of this.jobs.entries()) {
      if (now - parseInt(id.split('_')[1]) > maxAge) this.jobs.delete(id);
    }
  }
}

export const ffmpegEngine = new FFmpegEngine();

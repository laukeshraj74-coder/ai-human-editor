import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { 
  EditingPlan, 
  CutPoint, 
  ZoomPoint, 
  Transition, 
  FFmpegProgress, 
  VideoInfo
} from '../shared/types';
import { getVideoInfo, executeFFmpegCommand, generateFFmpegCommand } from './ffmpeg';

/**
 * Core Video Editing Engine
 * Executes the Director Plan from OmniRoute AI
 */

export interface EngineOptions {
  tempDir?: string;
  outputDir?: string;
}

export class VideoEditingEngine {
  private tempDir: string;
  private outputDir: string;

  constructor(options: EngineOptions = {}) {
    this.tempDir = options.tempDir || path.join(process.cwd(), 'temp');
    this.outputDir = options.outputDir || path.join(process.cwd(), 'output');
    
    // Ensure directories exist
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  /**
   * Execute smart cuts based on the director plan
   * Removes filler/pause sections and keeps engaging content
   */
  async executeSmartCuts(
    inputPath: string,
    cutPoints: CutPoint[],
    onProgress?: (progress: FFmpegProgress) => void
  ): Promise<string> {
    const outputPath = path.join(
      this.outputDir,
      `cut_${path.basename(inputPath)}`
    );

    const keepSegments = cutPoints.filter(cp => cp.keep);
    
    if (keepSegments.length === 0) {
      throw new Error('No segments to keep in cut points');
    }

    // If only one segment, simple cut
    if (keepSegments.length === 1) {
      const segment = keepSegments[0];
      await this.cutSegment(inputPath, outputPath, segment.startTime, segment.endTime, onProgress);
      return outputPath;
    }

    // Multiple segments - use concat approach
    return await this.concatSegments(inputPath, keepSegments, outputPath, onProgress);
  }

  /**
   * Cut a single video segment
   */
  private async cutSegment(
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
        .outputOptions(['-c:v libx264', '-preset medium', '-crf 23', '-c:a aac'])
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
        .on('error', reject)
        .save(outputPath);
    });
  }

  /**
   * Concatenate multiple video segments
   */
  private async concatSegments(
    inputPath: string,
    segments: CutPoint[],
    outputPath: string,
    onProgress?: (progress: FFmpegProgress) => void
  ): Promise<string> {
    // Create temp files for each segment
    const tempFiles: string[] = [];
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const tempPath = path.join(this.tempDir, `segment_${i}.mp4`);
      tempFiles.push(tempPath);
      
      await this.cutSegment(inputPath, tempPath, segment.startTime, segment.endTime, onProgress);
    }

    // Create concat file
    const concatListPath = path.join(this.tempDir, 'concat_list.txt');
    const concatContent = tempFiles.map(f => `file '${f}'`).join('\n');
    fs.writeFileSync(concatListPath, concatContent);

    // Concatenate using ffmpeg concat demuxer
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

  /**
   * Apply dynamic zoom effects using zoompan filter
   */
  async applyDynamicZoom(
    inputPath: string,
    outputPath: string,
    zoomPoints: ZoomPoint[],
    onProgress?: (progress: FFmpegProgress) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath);
      
      // Build zoompan filter chain
      const zoomFilters = zoomPoints.map(point => {
        const x = point.x || 'iw/2-(iw/zoom/2)';
        const y = point.y || 'ih/2-(ih/zoom/2)';
        return `zoompan=z=${point.zoomLevel}:d=${point.duration * 30}:x=${x}:y=${y}`;
      });

      command.videoFilters(zoomFilters.join(','));
      
      command
        .outputOptions(['-c:v libx264', '-preset medium', '-crf 23'])
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
        .on('error', reject)
        .save(outputPath);
    });
  }

  /**
   * Apply transitions between video segments
   */
  async applyTransitions(
    inputPath: string,
    outputPath: string,
    transitions: Transition[],
    onProgress?: (progress: FFmpegProgress) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath);
      
      // Apply xfade transitions
      const xfadeTransitions = transitions.filter(t => t.type === 'xfade');
      
      if (xfadeTransitions.length > 0) {
        const filterChain = xfadeTransitions.map(t => 
          `xfade=transition=fade:duration=${t.duration}:offset=${t.timestamp}`
        );
        
        command.videoFilters(filterChain);
      }

      command
        .outputOptions(['-c:v libx264', '-preset medium', '-crf 23'])
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
        .on('error', reject)
        .save(outputPath);
    });
  }

  /**
   * Execute complete editing plan
   */
  async executePlan(
    plan: EditingPlan,
    onProgress?: (progress: FFmpegProgress) => void
  ): Promise<{ success: boolean; outputPath: string; duration: number }> {
    try {
      // Use the executeFFmpegCommand from ffmpeg.ts
      const result = await executeFFmpegCommand(plan, onProgress);
      return result;
    } catch (error: any) {
      console.error('Error executing editing plan:', error);
      throw error;
    }
  }

  /**
   * Get video information
   */
  async getVideoInfo(videoPath: string): Promise<VideoInfo> {
    return await getVideoInfo(videoPath);
  }

  /**
   * Generate FFmpeg command for preview
   */
  generateCommand(plan: EditingPlan): string {
    return generateFFmpegCommand(plan);
  }
}

export default VideoEditingEngine;

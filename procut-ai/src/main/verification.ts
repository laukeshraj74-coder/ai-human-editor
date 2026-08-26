import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { VerificationResult, VideoInfo } from '../shared/types';
import { getVideoInfo } from './ffmpeg';

/**
 * Video Verification Module
 * Performs quality checks on the final output video
 */

export interface VerificationOptions {
  expectedMinDuration?: number;
  expectedMaxDuration?: number;
  expectedWidth?: number;
  expectedHeight?: number;
  requireAudio?: boolean;
}

export class VideoVerifier {
  private options: VerificationOptions;

  constructor(options: VerificationOptions = {}) {
    this.options = {
      expectedMinDuration: options.expectedMinDuration || 1, // 1 second minimum
      expectedMaxDuration: options.expectedMaxDuration || 3600, // 1 hour maximum
      expectedWidth: options.expectedWidth,
      expectedHeight: options.expectedHeight,
      requireAudio: options.requireAudio ?? true,
    };
  }

  /**
   * Verify the output video meets quality standards
   */
  async verify(outputPath: string, inputInfo?: VideoInfo): Promise<VerificationResult> {
    const errors: string[] = [];
    const checks = {
      resolution: true,
      audioSync: true,
      duration: true,
      codec: true,
    };

    let outputInfo: VideoInfo | undefined;

    try {
      // Check if file exists
      if (!fs.existsSync(outputPath)) {
        return {
          success: false,
          checks,
          errors: ['Output file does not exist'],
        };
      }

      // Get video information
      outputInfo = await getVideoInfo(outputPath);

      // Duration check
      if (outputInfo && outputInfo.duration < this.options.expectedMinDuration!) {
        checks.duration = false;
        errors.push(`Video duration (${outputInfo.duration}s) is below minimum (${this.options.expectedMinDuration}s)`);
      }

      if (outputInfo && outputInfo.duration > this.options.expectedMaxDuration!) {
        checks.duration = false;
        errors.push(`Video duration (${outputInfo.duration}s) exceeds maximum (${this.options.expectedMaxDuration}s)`);
      }

      // Resolution check
      if (this.options.expectedWidth && outputInfo && outputInfo.width !== this.options.expectedWidth) {
        checks.resolution = false;
        errors.push(`Video width (${outputInfo.width}) does not match expected (${this.options.expectedWidth})`);
      }

      if (this.options.expectedHeight && outputInfo && outputInfo.height !== this.options.expectedHeight) {
        checks.resolution = false;
        errors.push(`Video height (${outputInfo.height}) does not match expected (${this.options.expectedHeight})`);
      }

      // Audio check
      if (this.options.requireAudio && outputInfo && !outputInfo.hasAudio) {
        checks.audioSync = false;
        errors.push('Output video has no audio track');
      }

      // Codec check
      if (outputInfo && (outputInfo.codec === 'unknown' || outputInfo.codec === '')) {
        checks.codec = false;
        errors.push('Unknown video codec detected');
      }

      // Audio sync check (compare with input if provided)
      if (inputInfo && outputInfo) {
        const durationDiff = Math.abs(inputInfo.duration - outputInfo.duration);
        // Allow 2 seconds tolerance for audio sync
        if (durationDiff > 2) {
          checks.audioSync = false;
          errors.push(`Possible audio sync issue: duration difference of ${durationDiff.toFixed(2)}s`);
        }
      }

      // Additional FFprobe-based checks
      const syncCheck = await this.checkAudioVideoSync(outputPath);
      if (!syncCheck) {
        checks.audioSync = false;
        errors.push('Audio/video streams may be out of sync');
      }

    } catch (error: any) {
      errors.push(`Verification failed: ${error.message}`);
      return {
        success: false,
        checks,
        errors,
      };
    }

    const success = errors.length === 0;

    return {
      success,
      checks,
      errors,
      outputInfo,
    };
  }

  /**
   * Check audio/video synchronization using ffprobe
   */
  private async checkAudioVideoSync(videoPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(videoPath, (err: any, metadata: any) => {
        if (err) {
          resolve(false);
          return;
        }

        const videoStream = metadata.streams.find((s: any) => s.codec_type === 'video');
        const audioStream = metadata.streams.find((s: any) => s.codec_type === 'audio');

        if (!videoStream) {
          resolve(false);
          return;
        }

        if (!audioStream) {
          // No audio stream, skip sync check
          resolve(true);
          return;
        }

        // Check if both streams have similar start times
        const videoStartTime = videoStream.start_time || 0;
        const audioStartTime = audioStream.start_time || 0;
        
        const timeDiff = Math.abs(parseFloat(videoStartTime) - parseFloat(audioStartTime));
        
        // Allow up to 100ms difference
        resolve(timeDiff < 0.1);
      });
    });
  }

  /**
   * Quick validation without detailed checks
   */
  async quickValidate(outputPath: string): Promise<boolean> {
    try {
      const result = await this.verify(outputPath);
      return result.success;
    } catch {
      return false;
    }
  }

  /**
   * Get detailed verification report as string
   */
  async getReport(outputPath: string, inputInfo?: VideoInfo): Promise<string> {
    const result = await this.verify(outputPath, inputInfo);
    
    const lines: string[] = [
      '=== Video Verification Report ===',
      `File: ${path.basename(outputPath)}`,
      `Status: ${result.success ? 'PASSED' : 'FAILED'}`,
      '',
      'Checks:',
      `  Resolution: ${result.checks.resolution ? '✓' : '✗'}`,
      `  Audio Sync: ${result.checks.audioSync ? '✓' : '✗'}`,
      `  Duration: ${result.checks.duration ? '✓' : '✗'}`,
      `  Codec: ${result.checks.codec ? '✓' : '✗'}`,
    ];

    if (result.outputInfo) {
      lines.push('', 'Output Info:');
      lines.push(`  Duration: ${result.outputInfo.duration.toFixed(2)}s`);
      lines.push(`  Resolution: ${result.outputInfo.width}x${result.outputInfo.height}`);
      lines.push(`  FPS: ${result.outputInfo.fps}`);
      lines.push(`  Codec: ${result.outputInfo.codec}`);
      lines.push(`  Has Audio: ${result.outputInfo.hasAudio}`);
    }

    if (result.errors.length > 0) {
      lines.push('', 'Errors:');
      result.errors.forEach(err => lines.push(`  - ${err}`));
    }

    return lines.join('\n');
  }
}

export default VideoVerifier;

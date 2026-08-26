import ffmpeg from 'fluent-ffmpeg';
import path from 'path';
import fs from 'fs';
import { VerificationResult, VideoInfo } from '../shared/types';

export class VideoVerifier {
  /**
   * Verify the final output video
   */
  async verify(outputPath: string, expectedDuration?: number): Promise<VerificationResult> {
    const result: VerificationResult = {
      success: true,
      checks: {
        resolution: false,
        audioSync: false,
        duration: false,
        codec: false,
      },
      errors: [],
    };

    try {
      // Check if file exists
      if (!fs.existsSync(outputPath)) {
        result.success = false;
        result.errors.push('Output file does not exist');
        return result;
      }

      // Get video info
      const videoInfo = await this.getVideoInfo(outputPath);
      result.outputInfo = videoInfo;

      // Check resolution (must be valid)
      if (videoInfo.width > 0 && videoInfo.height > 0) {
        result.checks.resolution = true;
      } else {
        result.success = false;
        result.errors.push('Invalid resolution');
      }

      // Check codec (must be h264)
      if (videoInfo.codec === 'h264' || videoInfo.codec === 'libx264') {
        result.checks.codec = true;
      } else {
        result.success = false;
        result.errors.push(`Unexpected codec: ${videoInfo.codec}`);
      }

      // Check duration
      if (videoInfo.duration > 0) {
        result.checks.duration = true;
        
        // If expected duration provided, check if it's within 5% tolerance
        if (expectedDuration) {
          const tolerance = expectedDuration * 0.05;
          if (Math.abs(videoInfo.duration - expectedDuration) > tolerance) {
            result.success = false;
            result.errors.push(
              `Duration mismatch: expected ${expectedDuration}s, got ${videoInfo.duration}s`
            );
          }
        }
      } else {
        result.success = false;
        result.errors.push('Invalid duration');
      }

      // Check audio sync (audio and video should have similar duration)
      result.checks.audioSync = await this.checkAudioSync(outputPath);
      if (!result.checks.audioSync) {
        result.success = false;
        result.errors.push('Audio sync issue detected');
      }

      // Additional integrity checks
      const integrityCheck = await this.checkFileIntegrity(outputPath);
      if (!integrityCheck) {
        result.success = false;
        result.errors.push('File integrity check failed');
      }

    } catch (error: any) {
      result.success = false;
      result.errors.push(`Verification error: ${error.message}`);
    }

    return result;
  }

  /**
   * Get video information
   */
  private async getVideoInfo(inputPath: string): Promise<VideoInfo> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        if (!videoStream) {
          reject(new Error('No video stream found'));
          return;
        }

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

  /**
   * Check audio sync by comparing audio and video durations
   */
  private async checkAudioSync(inputPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          resolve(false);
          return;
        }

        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        const audioStream = metadata.streams.find(s => s.codec_type === 'audio');

        if (!videoStream) {
          resolve(false);
          return;
        }

        // If no audio, consider it synced (silent video)
        if (!audioStream) {
          resolve(true);
          return;
        }

        const videoDuration = videoStream.duration || metadata.format.duration || 0;
        const audioDuration = audioStream.duration || metadata.format.duration || 0;

        // Allow 0.5 second tolerance
        const diff = Math.abs(videoDuration - audioDuration);
        resolve(diff < 0.5);
      });
    });
  }

  /**
   * Check file integrity by attempting to read frames
   */
  private async checkFileIntegrity(inputPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      let frameCount = 0;
      let errorOccurred = false;

      ffmpeg(inputPath)
        .on('error', () => {
          errorOccurred = true;
        })
        .on('end', () => {
          resolve(!errorOccurred && frameCount > 0);
        })
        .frames()
        .on('frame', () => {
          frameCount++;
          if (frameCount >= 5) {
            // Only check first 5 frames for performance
            (this as any)._ffmpeg?.kill();
          }
        })
        .save('/dev/null');

      // Timeout after 5 seconds
      setTimeout(() => {
        resolve(!errorOccurred && frameCount > 0);
      }, 5000);
    });
  }

  /**
   * Generate a verification report
   */
  generateReport(result: VerificationResult): string {
    const lines: string[] = [
      '=== Video Verification Report ===',
      '',
      `Overall Status: ${result.success ? '✅ PASSED' : '❌ FAILED'}`,
      '',
      'Checks:',
      `  Resolution: ${result.checks.resolution ? '✅' : '❌'}`,
      `  Audio Sync: ${result.checks.audioSync ? '✅' : '❌'}`,
      `  Duration: ${result.checks.duration ? '✅' : '❌'}`,
      `  Codec: ${result.checks.codec ? '✅' : '❌'}`,
      '',
    ];

    if (result.errors.length > 0) {
      lines.push('Errors:');
      result.errors.forEach(err => lines.push(`  - ${err}`));
      lines.push('');
    }

    if (result.outputInfo) {
      lines.push('Output Info:');
      lines.push(`  Duration: ${result.outputInfo.duration.toFixed(2)}s`);
      lines.push(`  Resolution: ${result.outputInfo.width}x${result.outputInfo.height}`);
      lines.push(`  FPS: ${result.outputInfo.fps.toFixed(2)}`);
      lines.push(`  Codec: ${result.outputInfo.codec}`);
      lines.push(`  Has Audio: ${result.outputInfo.hasAudio}`);
    }

    return lines.join('\n');
  }
}

// Export singleton instance
export const videoVerifier = new VideoVerifier();
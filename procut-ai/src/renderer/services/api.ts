import { FFmpegProgress, VerificationResult } from '../../shared/types';

export interface ApiUploadResponse {
  success: boolean;
  filePath: string;
  fileName: string;
  videoInfo: {
    duration: number;
    width: number;
    height: number;
    fps: number;
    codec: string;
    hasAudio: boolean;
  };
}

export interface ApiAnalyzeResponse {
  success: boolean;
  analysis: {
    chunks: any[];
    overallSummary: string;
    suggestedCuts: any[];
    captions: any[];
    effects: string[];
  };
  videoInfo: any;
}

export interface ApiEditResponse {
  jobId?: string;
  status?: string;
  message?: string;
  outputPath?: string;
  ffmpegCommand?: string;
  verification?: VerificationResult;
  success?: boolean;
  duration?: number;
}

export interface ApiProgressResponse {
  jobId: string;
  progress: FFmpegProgress & { status: string };
  verification?: VerificationResult;
}

const API_BASE_URL = 'http://localhost:3001/api';

export class ApiService {
  /**
   * Upload a video file to the server
   */
  async uploadVideo(file: File): Promise<ApiUploadResponse> {
    const formData = new FormData();
    formData.append('video', file);

    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload video');
    }

    return response.json();
  }

  /**
   * Analyze video using OmniRoute AI
   */
  async analyzeVideo(videoPath: string, apiKey?: string): Promise<ApiAnalyzeResponse> {
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videoPath, apiKey }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to analyze video');
    }

    return response.json();
  }

  /**
   * Execute video editing based on Director Plan
   */
  async editVideo(plan: any): Promise<{ jobId: string }> {
    const response = await fetch(`${API_BASE_URL}/edit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ plan }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to edit video');
    }

    return response.json();
  }

  /**
   * Poll for editing progress
   */
  async getProgress(jobId: string): Promise<ApiProgressResponse> {
    const response = await fetch(`${API_BASE_URL}/progress/${jobId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get progress');
    }

    return response.json();
  }

  /**
   * Get video information
   */
  async getVideoInfo(videoPath: string): Promise<any> {
    const encodedPath = encodeURIComponent(videoPath);
    const response = await fetch(`${API_BASE_URL}/video-info/${encodedPath}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to get video info');
    }

    return response.json();
  }

  /**
   * Verify edited video quality
   */
  async verifyVideo(outputPath: string, inputPath?: string): Promise<any> {
    const encodedPath = encodeURIComponent(outputPath);
    const url = inputPath 
      ? `${API_BASE_URL}/verify/${encodedPath}?inputPath=${encodeURIComponent(inputPath)}`
      : `${API_BASE_URL}/verify/${encodedPath}`;

    const response = await fetch(url, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to verify video');
    }

    return response.json();
  }
}

export const apiService = new ApiService();
export default apiService;

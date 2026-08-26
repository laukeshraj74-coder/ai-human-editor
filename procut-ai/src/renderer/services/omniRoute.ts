import { OmniRouteConfig, VideoAnalysis, EditingPlan } from '../../shared/types';

const DEFAULT_BASE_URL = 'https://omni.ai.api';

export class OmniRouteClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: OmniRouteConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  }

  /**
   * Analyze video chunk using Qwen3-VL model
   */
  async analyzeVideoChunk(
    chunkPath: string,
    chunkIndex: number
  ): Promise<{
    summary: string;
    engagement: number;
    hasSpeech: boolean;
    detectedObjects: string[];
    mood: string;
  }> {
    // In production, this would call the actual OmniRoute API
    // For now, we'll simulate the response structure
    
    const response = await this.callModel('Qwen3-VL', {
      action: 'analyze_video_chunk',
      chunkPath,
      chunkIndex,
      prompt: `Analyze this video chunk. Provide:
1. A brief summary of what's happening
2. Engagement score (0-1)
3. Whether there's speech
4. Detected objects/people
5. Overall mood/tone`,
    });

    return {
      summary: response.summary || 'No content detected',
      engagement: response.engagement || 0.5,
      hasSpeech: response.hasSpeech || false,
      detectedObjects: response.detectedObjects || [],
      mood: response.mood || 'neutral',
    };
  }

  /**
   * Generate editing plan using Qwen3-Coder model
   */
  async generateEditingPlan(
    videoAnalysis: VideoAnalysis,
    userPreferences?: {
      style?: 'mrbeast' | 'documentary' | 'tutorial' | 'cinematic';
      targetDuration?: number;
      includeCaptions?: boolean;
      includeEffects?: boolean;
    }
  ): Promise<EditingPlan> {
    const response = await this.callModel('Qwen3-Coder', {
      action: 'generate_editing_plan',
      analysis: videoAnalysis,
      preferences: userPreferences,
      prompt: `Based on this video analysis, create a detailed editing plan.
Include:
1. Cut points to remove filler/slow sections
2. Suggested effects (zooms, transitions)
3. Caption placements
4. Pacing recommendations

Style: ${userPreferences?.style || 'mrbeast'}
Target Duration: ${userPreferences?.targetDuration || 'original length'}
`,
    });

    return {
      inputPath: '',
      outputPath: '',
      cuts: response.cuts || [],
      effects: response.effects || ['zoompan', 'xfade'],
      captions: response.captions || [],
      backgroundMusic: response.backgroundMusic,
      sfx: response.sfx || [],
    };
  }

  /**
   * Generate captions/subtitles from audio transcription
   */
  async generateCaptions(audioPath: string): Promise<Array<{
    text: string;
    startTime: number;
    endTime: number;
  }>> {
    const response = await this.callModel('Qwen3-VL', {
      action: 'speech_to_text',
      audioPath,
      prompt: 'Transcribe the speech in this audio and provide timestamps for each segment.',
    });

    return response.captions || [];
  }

  /**
   * Detect filler moments and pauses
   */
  async detectFillerMoments(videoAnalysis: VideoAnalysis): Promise<Array<{
    startTime: number;
    endTime: number;
    type: 'pause' | 'filler' | 'dead_air';
    confidence: number;
  }>> {
    const response = await this.callModel('Qwen3-VL', {
      action: 'detect_filler',
      analysis: videoAnalysis,
      prompt: 'Identify all filler moments, long pauses, and dead air that should be cut.',
    });

    return response.fillerMoments || [];
  }

  /**
   * Call OmniRoute API model
   */
  private async callModel(modelName: string, payload: any): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: modelName,
          messages: [
            {
              role: 'system',
              content: 'You are an expert video editor assistant. Provide structured JSON responses.',
            },
            {
              role: 'user',
              content: JSON.stringify(payload),
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      // Try to parse as JSON
      try {
        return JSON.parse(content);
      } catch {
        return { raw: content };
      }
    } catch (error) {
      console.error('OmniRoute API error:', error);
      // Return mock data for development
      return this.getMockResponse(modelName, payload);
    }
  }

  /**
   * Mock responses for development without API key
   */
  private getMockResponse(modelName: string, payload: any): any {
    if (modelName === 'Qwen3-VL') {
      if (payload.action === 'analyze_video_chunk') {
        return {
          summary: 'Person speaking to camera with dynamic background',
          engagement: 0.75,
          hasSpeech: true,
          detectedObjects: ['person', 'microphone', 'background'],
          mood: 'energetic',
        };
      }
      if (payload.action === 'speech_to_text') {
        return {
          captions: [
            { text: "Hey everyone, welcome back!", startTime: 0, endTime: 2 },
            { text: "Today we're doing something amazing", startTime: 2, endTime: 5 },
          ],
        };
      }
      if (payload.action === 'detect_filler') {
        return {
          fillerMoments: [
            { startTime: 10, endTime: 12, type: 'pause', confidence: 0.9 },
            { startTime: 45, endTime: 48, type: 'dead_air', confidence: 0.85 },
          ],
        };
      }
    }
    
    if (modelName === 'Qwen3-Coder') {
      return {
        cuts: [
          { startTime: 10, endTime: 12, keep: false, reason: 'pause' },
          { startTime: 45, endTime: 48, keep: false, reason: 'dead_air' },
        ],
        effects: ['zoompan', 'xfade'],
        captions: [
          { text: "Hey everyone, welcome back!", startTime: 0, endTime: 2 },
        ],
      };
    }

    return {};
  }

  /**
   * Update API key
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }
}

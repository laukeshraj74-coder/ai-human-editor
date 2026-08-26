import { VideoMetadata, VideoCategory, EditingPreset, PresetConfig } from '../shared/types';
import { presets } from './presets';

/**
 * Universal Video Analyzer
 * Analyzes video content using AI to automatically classify and select optimal editing preset
 */
export class UniversalAnalyzer {

  constructor(_apiKey?: string) {
    // OmniRoute client initialized when needed
  }

  /**
   * Analyze video and determine optimal editing strategy
   * @param metadata - Video metadata (duration, resolution, fps, etc.)
   * @param frameSamples - Base64 encoded frame samples for visual analysis
   * @param audioTranscript - Optional transcript for content analysis
   */
  async analyzeVideo(
    metadata: VideoMetadata,
    frameSamples: string[] = [],
    audioTranscript?: string
  ): Promise<{
    category: VideoCategory;
    confidence: number;
    recommendedPreset: EditingPreset;
    presetConfig: PresetConfig;
    analysis: string;
  }> {
    try {
      // Build analysis prompt based on available data
      const analysisPrompt = this.buildAnalysisPrompt(metadata, frameSamples, audioTranscript);
      
      // Call OmniRoute AI for video classification (mock implementation for now)
      // In production, this would call the actual API endpoint
      const aiResponse = await this.mockAnalyzeVideoContent({
        prompt: analysisPrompt,
        frames: frameSamples,
        metadata
      });

      // Parse AI response to extract category and recommendations
      const parsedResult = this.parseAIResponse(aiResponse, metadata);

      // Get the corresponding preset configuration
      const presetConfig = presets[parsedResult.recommendedPreset];

      console.log(`[UniversalAnalyzer] Detected category: ${parsedResult.category} (${parsedResult.confidence.toFixed(2)} confidence)`);
      console.log(`[UniversalAnalyzer] Recommended preset: ${parsedResult.recommendedPreset}`);

      return {
        category: parsedResult.category,
        confidence: parsedResult.confidence,
        recommendedPreset: parsedResult.recommendedPreset,
        presetConfig,
        analysis: parsedResult.analysis
      };
    } catch (error) {
      console.error('[UniversalAnalyzer] Analysis failed, falling back to default preset:', error);
      
      // Fallback: use generic preset based on duration
      const fallbackPreset = this.getFallbackPreset(metadata);
      return {
        category: 'other',
        confidence: 0.5,
        recommendedPreset: fallbackPreset,
        presetConfig: presets[fallbackPreset],
        analysis: 'Auto-detection failed. Applied fallback preset based on video duration.'
      };
    }
  }

  /**
   * Build analysis prompt for AI
   */
  private buildAnalysisPrompt(
    metadata: VideoMetadata,
    frames: string[],
    transcript?: string
  ): string {
    let prompt = `Analyze this video and classify it into one of these categories:
- vlog: Personal, casual footage with direct camera address
- tutorial: Educational content with step-by-step instructions
- documentary: Narrative-driven with interviews and B-roll
- gaming: Gameplay footage with commentary
- product_ad: Commercial/promotional content showcasing products
- interview: Conversation between two or more people
- other: Content that doesn't fit above categories

Video Metadata:
- Duration: ${metadata.duration}s
- Resolution: ${metadata.width}x${metadata.height}
- Aspect Ratio: ${(metadata.width / metadata.height).toFixed(2)}
- FPS: ${metadata.fps}
- Has Audio: ${metadata.hasAudio ? 'Yes' : 'No'}
- Codec: ${metadata.codec || 'Unknown'}

`;

    if (transcript && transcript.length > 0) {
      prompt += `\nAudio Transcript (first 500 chars):\n${transcript.substring(0, 500)}\n`;
    }

    if (frames.length > 0) {
      prompt += `\nVisual Analysis: ${frames.length} frame samples provided for visual content analysis.\n`;
    }

    prompt += `\nRespond in JSON format:
{
  "category": "<one of the categories above>",
  "confidence": <0.0 to 1.0>,
  "reasoning": "<brief explanation>",
  "editingRecommendations": {
    "pacing": "<fast|medium|slow>",
    "transitionStyle": "<quick|smooth|cinematic>",
    "captionStyle": "<bold|minimal|none>",
    "musicIntensity": "<high|medium|low|none>",
    "zoomFrequency": "<high|medium|low|none>"
  }
}`;

    return prompt;
  }

  /**
   * Parse AI response and map to preset
   */
  private parseAIResponse(
    response: any,
    metadata: VideoMetadata
  ): {
    category: VideoCategory;
    confidence: number;
    recommendedPreset: EditingPreset;
    analysis: string;
  } {
    try {
      // Try to parse JSON from response
      let parsedData;
      if (typeof response === 'string') {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
        const jsonString = jsonMatch ? jsonMatch[1] : response;
        parsedData = JSON.parse(jsonString);
      } else {
        parsedData = response;
      }

      const category = (parsedData.category as VideoCategory) || 'other';
      const confidence = parseFloat(parsedData.confidence) || 0.5;
      const reasoning = parsedData.reasoning || 'AI classification based on content analysis';

      // Map category to preset - MrBeast is default for high-energy content
      const presetMap: Record<VideoCategory, EditingPreset> = {
        vlog: 'mrbeast',        // Vlogs benefit from aggressive MrBeast-style editing
        tutorial: 'tutorial',
        documentary: 'documentary',
        gaming: 'mrbeast',       // Gaming content uses high-energy MrBeast style
        product_ad: 'mrbeast',   // Ads need high-energy, fast-paced editing
        interview: 'documentary',
        other: 'mrbeast'         // Default to MrBeast for maximum engagement
      };

      const recommendedPreset = presetMap[category] || 'mrbeast';

      // Build analysis summary
      const analysis = `${reasoning}. Recommended editing style: ${recommendedPreset} preset with ${parsedData.editingRecommendations?.pacing || 'medium'} pacing.`;

      return {
        category,
        confidence,
        recommendedPreset,
        analysis
      };
    } catch (parseError) {
      console.error('[UniversalAnalyzer] Failed to parse AI response:', parseError);
      
      // Fallback based on metadata heuristics
      const fallbackCategory = this.heuristicClassification(metadata);
      return {
        category: fallbackCategory,
        confidence: 0.6,
        recommendedPreset: this.getFallbackPreset(metadata),
        analysis: 'AI parsing failed. Applied heuristic classification based on video metadata.'
      };
    }
  }

  /**
   * Heuristic classification when AI fails
   */
  private heuristicClassification(metadata: VideoMetadata): VideoCategory {
    // Simple heuristics based on metadata
    const aspectRatio = metadata.width / metadata.height;
    
    // Vertical video likely vlog/mobile content -> will use MrBeast preset
    if (aspectRatio < 1) {
      return 'vlog';
    }
    
    // Very long videos often documentaries or tutorials
    if (metadata.duration > 600) { // > 10 minutes
      return 'documentary';
    }
    
    // Short videos often vlogs or ads -> MrBeast style
    if (metadata.duration < 180) {
      return 'product_ad';
    }
    
    // Default to vlog (will map to MrBeast preset)
    return 'vlog';
  }

  /**
   * Get fallback preset based on duration
   * MrBeast preset is the default for maximum engagement
   */
  private getFallbackPreset(metadata: VideoMetadata): EditingPreset {
    if (metadata.duration < 60) {
      return 'mrbeast'; // Short = high energy MrBeast style
    } else if (metadata.duration < 300) {
      return 'mrbeast'; // Medium = still use MrBeast for engagement
    } else if (metadata.duration > 600) {
      return 'documentary'; // Long-form = smooth documentary pacing
    } else {
      return 'mrbeast'; // Default to MrBeast for maximum engagement
    }
  }

  /**
   * Mock AI analysis for development (replace with actual API call in production)
   * Defaults to MrBeast-style high-energy editing for most content types
   */
  private async mockAnalyzeVideoContent(params: {
    prompt: string;
    frames: string[];
    metadata: VideoMetadata;
  }): Promise<any> {
    // Simulate AI response based on metadata heuristics
    const { metadata } = params;
    const aspectRatio = metadata.width / metadata.height;
    
    let category: VideoCategory = 'vlog';
    let confidence = 0.7;
    
    // Vertical video = vlog/mobile content -> MrBeast preset
    if (aspectRatio < 1) {
      category = 'vlog';
      confidence = 0.85;
    }
    // Very long videos = documentary
    else if (metadata.duration > 600) {
      category = 'documentary';
      confidence = 0.75;
    }
    // Short to medium videos = product_ad or vlog -> MrBeast style
    else if (metadata.duration < 300) {
      category = 'product_ad';
      confidence = 0.8;
    }
    // Medium length = tutorial
    else if (metadata.duration >= 180 && metadata.duration <= 600) {
      category = 'tutorial';
      confidence = 0.7;
    }

    return {
      category,
      confidence,
      reasoning: `Classified based on duration (${metadata.duration}s) and aspect ratio (${aspectRatio.toFixed(2)}). Defaulting to high-energy MrBeast-style editing for maximum engagement.`,
      editingRecommendations: {
        pacing: category === 'documentary' ? 'medium' : 'fast',
        transitionStyle: category === 'documentary' ? 'smooth' : 'quick',
        captionStyle: category === 'tutorial' ? 'highlight' : 'bold',
        musicIntensity: category === 'documentary' ? 'low' : 'high',
        zoomFrequency: category === 'documentary' ? 'low' : 'high'
      }
    };
  }

  /**
   * Extract key moments from video for enhanced analysis
   */
  async extractKeyMoments(
    _videoPath: string,
    metadata: VideoMetadata
  ): Promise<{ timestamps: number[]; descriptions: string[] }> {
    try {
      // Sample frames at regular intervals and at potential key moments
      const sampleCount = Math.min(5, Math.floor(metadata.duration / 30));
      const timestamps: number[] = [];
      
      for (let i = 0; i < sampleCount; i++) {
        timestamps.push((metadata.duration / sampleCount) * i + 5); // Start at 5s to avoid intro
      }

      // In a real implementation, we'd extract frames here using FFmpeg
      // For now, return placeholder
      return {
        timestamps,
        descriptions: timestamps.map(t => `Frame at ${t.toFixed(1)}s`)
      };
    } catch (error) {
      console.error('[UniversalAnalyzer] Key moment extraction failed:', error);
      return { timestamps: [], descriptions: [] };
    }
  }
}

export const universalAnalyzer = new UniversalAnalyzer();

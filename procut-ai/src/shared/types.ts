export interface VideoAnalysis {
  chunks: VideoChunk[];
  overallSummary: string;
  suggestedCuts: SuggestedCut[];
  captions: Caption[];
  effects: string[];
}

export interface VideoChunk {
  id: number;
  startTime: number;
  endTime: number;
  summary: string;
  engagement: number; // 0-1 score
  hasSpeech: boolean;
  detectedObjects: string[];
  mood: string;
}

export interface SuggestedCut {
  startTime: number;
  endTime: number;
  reason: 'filler' | 'pause' | 'low_engagement' | 'slow_pacing';
  confidence: number;
}

export interface Caption {
  text: string;
  startTime: number;
  endTime: number;
  speaker?: string;
}

export interface EditingPlan {
  inputPath: string;
  outputPath: string;
  cuts: CutPoint[];
  effects: string[];
  captions: Caption[];
  backgroundMusic?: string;
  sfx?: SoundEffect[];
}

export interface CutPoint {
  startTime: number;
  endTime: number;
  keep: boolean;
  reason?: string;
}

export interface SoundEffect {
  type: 'riser' | 'whoosh' | 'hit' | 'transition';
  timestamp: number;
  duration: number;
}

export interface OmniRouteConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  attachments?: {
    type: 'video' | 'image' | 'file';
    path?: string;
    name?: string;
  }[];
}

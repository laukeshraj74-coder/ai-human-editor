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
  fontSize?: number;
  fontColor?: string;
  backgroundColor?: string;
  position?: 'bottom' | 'top' | 'center';
  style?: 'normal' | 'bold' | 'highlight';
  animation?: 'pop' | 'slide' | 'typewriter';
}

export interface SFXEvent {
  type: 'riser' | 'whoosh' | 'hit' | 'boom' | 'laugh' | 'transition';
  startTime: number;
  duration?: number;
  volume?: number; // 0.0 to 1.0
  filePath?: string;
}

export interface EditingPlan {
  inputPath: string;
  outputPath: string;
  cuts: CutPoint[];
  effects: string[];
  captions: Caption[];
  backgroundMusic?: {
    enabled: boolean;
    filePath?: string;
    volume: number;
    fadeDuration: number;
  };
  sfx?: SFXEvent[];
  zoomPoints?: ZoomPoint[];
  transitions?: Transition[];
  preset?: EditPreset;
}

export type EditPreset = 'mrbeast' | 'documentary' | 'tutorial' | 'vlog';

export interface PresetConfig {
  name: EditPreset;
  cutThreshold: number; // Max seconds of silence before cut
  zoomIntensity: number; // 1.0 to 2.0
  transitionType: Transition['type'];
  captionStyle: Caption['style'];
  sfxDensity: 'low' | 'medium' | 'high';
  pacing: 'slow' | 'medium' | 'fast' | 'aggressive';
}

export interface CutPoint {
  startTime: number;
  endTime: number;
  keep: boolean;
  reason?: string;
}

export interface ZoomPoint {
  timestamp: number;
  duration: number;
  zoomLevel: number;
  x?: number;
  y?: number;
}

export interface Transition {
  type: 'xfade' | 'fade' | 'slideleft' | 'slideright' | 'wipeleft' | 'wiperight' | 'circleopen' | 'circleclose' | 'dissolve';
  timestamp: number;
  duration: number;
  offset?: number;
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

export interface VideoInfo {
  duration: number;
  width: number;
  height: number;
  fps: number;
  codec: string;
  hasAudio: boolean;
}

export interface FFmpegProgress {
  percent: number;
  currentFps: number;
  currentKbps: number;
  targetSize: number;
  timemark: string;
  eta?: number;
}

export interface VerificationResult {
  success: boolean;
  checks: {
    resolution: boolean;
    audioSync: boolean;
    duration: boolean;
    codec: boolean;
  };
  errors: string[];
  outputInfo?: VideoInfo;
}

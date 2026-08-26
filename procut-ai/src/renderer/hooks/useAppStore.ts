import { create } from 'zustand';
import { ChatMessage, VideoAnalysis, EditingPlan } from '../../shared/types';

interface AppState {
  // Video state
  currentVideo: string | null;
  videoDuration: number;
  videoInfo: {
    width: number;
    height: number;
    fps: number;
    hasAudio: boolean;
  } | null;
  
  // Analysis state
  isAnalyzing: boolean;
  analysisProgress: number;
  videoAnalysis: VideoAnalysis | null;
  
  // Editing state
  editingPlan: EditingPlan | null;
  isProcessing: boolean;
  processProgress: number;
  
  // Chat state
  messages: ChatMessage[];
  
  // Settings
  darkMode: boolean;
  omniRouteApiKey: string;
  
  // Actions
  setCurrentVideo: (path: string) => void;
  setVideoInfo: (info: { width: number; height: number; fps: number; hasAudio: boolean }) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setAnalysisProgress: (progress: number) => void;
  setVideoAnalysis: (analysis: VideoAnalysis) => void;
  setEditingPlan: (plan: EditingPlan) => void;
  setProcessing: (processing: boolean) => void;
  setProcessProgress: (progress: number) => void;
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  toggleDarkMode: () => void;
  setOmniRouteApiKey: (key: string) => void;
  resetState: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Initial state
  currentVideo: null,
  videoDuration: 0,
  videoInfo: null,
  isAnalyzing: false,
  analysisProgress: 0,
  videoAnalysis: null,
  editingPlan: null,
  isProcessing: false,
  processProgress: 0,
  messages: [],
  darkMode: true,
  omniRouteApiKey: '',
  
  // Actions
  setCurrentVideo: (path: string) => set({ currentVideo: path }),
  setVideoInfo: (info) => set({ videoInfo: info }),
  setAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
  setAnalysisProgress: (progress) => set({ analysisProgress: progress }),
  setVideoAnalysis: (analysis) => set({ videoAnalysis: analysis }),
  setEditingPlan: (plan) => set({ editingPlan: plan }),
  setProcessing: (processing) => set({ isProcessing: processing }),
  setProcessProgress: (progress) => set({ processProgress: progress }),
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),
  clearMessages: () => set({ messages: [] }),
  toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
  setOmniRouteApiKey: (key: string) => set({ omniRouteApiKey: key }),
  resetState: () => set({
    currentVideo: null,
    videoDuration: 0,
    videoInfo: null,
    isAnalyzing: false,
    analysisProgress: 0,
    videoAnalysis: null,
    editingPlan: null,
    isProcessing: false,
    processProgress: 0,
    messages: [],
  }),
}));

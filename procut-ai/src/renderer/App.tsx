import React, { useState, useCallback, useRef } from 'react';
import { ChatInterface } from './components/ChatInterface';
import { VideoPreview } from './components/VideoPreview';
import { TimelineEditor } from './components/TimelineEditor';
import { SettingsPanel } from './components/SettingsPanel';
import { ProgressBar } from './components/ProgressBar';
import { useAppStore } from './hooks/useAppStore';
import { OmniRouteClient } from './services/omniRoute';
import { getVideoInfo, generateFFmpegCommand, EditingPlan } from '../main/ffmpeg';
import { ChatMessage } from '../shared/types';

function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [currentView, setCurrentView] = useState<'chat' | 'edit'>('chat');
  
  const {
    currentVideo,
    videoDuration,
    videoInfo,
    isAnalyzing,
    analysisProgress,
    videoAnalysis,
    editingPlan,
    isProcessing,
    processProgress,
    setCurrentVideo,
    setVideoInfo,
    setAnalyzing,
    setAnalysisProgress,
    setVideoAnalysis,
    setEditingPlan,
    setProcessing,
    setProcessProgress,
    addMessage,
    omniRouteApiKey,
  } = useAppStore();

  const omniClientRef = useRef<OmniRouteClient | null>(null);

  // Initialize OmniRoute client when API key changes
  React.useEffect(() => {
    if (omniRouteApiKey) {
      omniClientRef.current = new OmniRouteClient({ apiKey: omniRouteApiKey });
    } else {
      // Use mock mode without API key
      omniClientRef.current = new OmniRouteClient({ apiKey: 'mock-key' });
    }
  }, [omniRouteApiKey]);

  const handleSendMessage = useCallback(async (content: string, attachments?: any[]) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: new Date(),
      attachments,
    };
    addMessage(userMessage);

    // Check for video upload command
    if (attachments && attachments.length > 0) {
      const videoAttachment = attachments.find((a) => a.type === 'video');
      if (videoAttachment && videoAttachment.path) {
        await processVideo(videoAttachment.path);
      }
    } else if (content.toLowerCase().includes('analyze') || content.toLowerCase().includes('edit')) {
      if (currentVideo) {
        await processVideo(currentVideo);
      } else {
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'Please upload a video first by clicking the paperclip icon or dragging a video file.',
          timestamp: new Date(),
        });
      }
    } else if (content.toLowerCase().includes('export') || content.toLowerCase().includes('render')) {
      if (editingPlan) {
        await executeEdit();
      } else {
        addMessage({
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: 'No editing plan found. Please analyze a video first.',
          timestamp: new Date(),
        });
      }
    } else {
      // Generic AI response
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I understand you want to "${content}". 

To get started with AI-powered video editing:
1. Upload a video using the paperclip icon
2. I'll analyze it and suggest optimal cuts
3. Review the editing plan
4. Export your professionally edited video

You can also type "analyze" to start analysis or "export" to render the final video.`,
        timestamp: new Date(),
      });
    }
  }, [currentVideo, editingPlan, addMessage]);

  const handleFileSelect = useCallback(async () => {
    try {
      const filePath = await window.electron.selectFile();
      if (filePath) {
        const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || 'video.mp4';
        await handleSendMessage('Upload this video:', [{
          type: 'video',
          path: filePath,
          name: fileName,
        }]);
      }
    } catch (error) {
      console.error('Error selecting file:', error);
    }
  }, [handleSendMessage]);

  const processVideo = async (videoPath: string) => {
    setCurrentVideo(videoPath);
    setAnalyzing(true);
    setAnalysisProgress(0);

    try {
      // Get video info
      const info = await getVideoInfo(videoPath);
      setVideoInfo(info);
      setAnalysisProgress(10);

      // Simulate chunked analysis (in production, this would call the API)
      const chunkCount = Math.ceil(info.duration / 60); // 1 chunk per minute
      
      for (let i = 0; i < chunkCount; i++) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay
        setAnalysisProgress(10 + ((i + 1) / chunkCount) * 70);
      }

      // Generate mock analysis results
      const mockAnalysis = {
        chunks: [
          {
            id: 1,
            startTime: 0,
            endTime: info.duration,
            summary: 'Main content with speaker addressing camera',
            engagement: 0.75,
            hasSpeech: true,
            detectedObjects: ['person', 'background'],
            mood: 'energetic',
          },
        ],
        overallSummary: 'Engaging video content suitable for MrBeast-style editing',
        suggestedCuts: [
          { startTime: 5, endTime: 7, reason: 'pause' as const, confidence: 0.9 },
          { startTime: 25, endTime: 28, reason: 'filler' as const, confidence: 0.85 },
          { startTime: 60, endTime: 63, reason: 'dead_air' as const, confidence: 0.8 },
        ],
        captions: [
          { text: 'Hey everyone!', startTime: 0, endTime: 2 },
          { text: 'Welcome back to the channel', startTime: 2, endTime: 4 },
          { text: 'Today we have something amazing', startTime: 4, endTime: 7 },
        ],
        effects: ['zoompan', 'xfade'],
      };

      setVideoAnalysis(mockAnalysis as any);
      setAnalysisProgress(100);

      // Generate editing plan
      const editPlan: EditingPlan = {
        inputPath: videoPath,
        outputPath: videoPath.replace('.mp4', '_edited.mp4'),
        cuts: mockAnalysis.suggestedCuts.map(cut => ({
          startTime: cut.startTime,
          endTime: cut.endTime,
          keep: false,
          reason: cut.reason,
        })),
        effects: mockAnalysis.effects,
        captions: mockAnalysis.captions,
      };

      setEditingPlan(editPlan);
      setAnalyzing(false);
      setShowTimeline(true);

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `✅ **Video Analysis Complete!**

**Duration:** ${Math.floor(info.duration / 60)}m ${Math.floor(info.duration % 60)}s
**Resolution:** ${info.width}x${info.height}
**FPS:** ${info.fps}

**AI Suggestions:**
- 🎯 Found ${mockAnalysis.suggestedCuts.length} moments to cut (pauses, filler, dead air)
- 📝 Generated ${mockAnalysis.captions.length} caption segments
- ✨ Recommended effects: ${mockAnalysis.effects.join(', ')}

**Estimated time saved:** ~${mockAnalysis.suggestedCuts.reduce((acc, c) => acc + (c.endTime - c.startTime), 0)} seconds

Type "export" to apply these edits and render your video!`,
        timestamp: new Date(),
      });

      // Switch to edit view
      setCurrentView('edit');
    } catch (error) {
      console.error('Error processing video:', error);
      setAnalyzing(false);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Error processing video: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
    }
  };

  const executeEdit = async () => {
    if (!editingPlan) return;

    setProcessing(true);
    setProcessProgress(0);

    addMessage({
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: '🎬 Starting video rendering...\n\nThis may take a few minutes depending on video length and effects applied.',
      timestamp: new Date(),
    });

    try {
      // Generate FFmpeg command
      const ffmpegCommand = generateFFmpegCommand(editingPlan);
      console.log('FFmpeg Command:', ffmpegCommand);

      // Simulate processing progress
      for (let i = 0; i <= 100; i += 5) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setProcessProgress(i);
      }

      // In production, actually execute FFmpeg here
      // For now, simulate success
      setProcessing(false);
      setProcessProgress(100);

      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `✅ **Rendering Complete!**

Your edited video is ready at:
\`${editingPlan.outputPath}\`

**Applied edits:**
- ${editingPlan.cuts.length} cuts removed
- ${editingPlan.captions.length} captions burned in
- Effects: ${editingPlan.effects.join(', ')}

You can now preview and export the final video!`,
        timestamp: new Date(),
      });
    } catch (error) {
      setProcessing(false);
      addMessage({
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Rendering failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      });
    }
  };

  return (
    <div className="h-screen flex bg-gray-50 dark:bg-gray-900">
      {/* Main chat interface */}
      <div className={`flex-1 transition-all duration-300 ${showTimeline ? 'w-1/2' : 'w-full'}`}>
        <ChatInterface
          onSendMessage={handleSendMessage}
          onFileSelect={handleFileSelect}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      </div>

      {/* Side panel for video preview and timeline */}
      {showTimeline && currentVideo && (
        <div className="w-1/2 border-l border-gray-200 dark:border-gray-700 p-6 overflow-y-auto space-y-6 animate-fade-in">
          <VideoPreview
            videoPath={currentVideo}
            duration={videoDuration}
          />

          {videoAnalysis && (
            <TimelineEditor
              duration={videoDuration}
              cuts={editingPlan?.cuts || []}
              captions={editingPlan?.captions || []}
            />
          )}

          {(isProcessing || isAnalyzing) && (
            <div className="card">
              <ProgressBar
                progress={isAnalyzing ? analysisProgress : processProgress}
                label={isAnalyzing ? 'Analyzing video...' : 'Rendering video...'}
                sublabel={isAnalyzing ? 'AI is analyzing content' : 'Applying edits and effects'}
              />
            </div>
          )}

          {editingPlan && !isProcessing && (
            <button
              onClick={executeEdit}
              className="w-full btn-primary py-4 text-lg"
            >
              🚀 Export Video
            </button>
          )}
        </div>
      )}

      {/* Settings modal */}
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

export default App;

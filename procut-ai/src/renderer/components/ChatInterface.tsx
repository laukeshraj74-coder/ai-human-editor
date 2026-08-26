import React from 'react';
import { Send, Paperclip, Sun, Moon, Settings, Trash2 } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';
import { useDarkMode } from '../hooks/useDarkMode';
import { ChatMessage } from '../../shared/types';

interface ChatInterfaceProps {
  onSendMessage: (content: string, attachments?: any[]) => void;
  onFileSelect: () => void;
  onOpenSettings: () => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  onSendMessage,
  onFileSelect,
  onOpenSettings,
}) => {
  const [inputValue, setInputValue] = React.useState('');
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const { messages, darkMode, currentVideo } = useAppStore();
  const { toggle } = useDarkMode();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    onSendMessage(inputValue.trim());
    setInputValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">PC</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            ProCut AI
          </h1>
        </div>
        
        <div className="flex items-center space-x-2">
          {currentVideo && (
            <span className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
              📁 {currentVideo.split('/').pop()}
            </span>
          )}
          
          <button
            onClick={toggle}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? (
              <Sun className="w-5 h-5 text-yellow-500" />
            ) : (
              <Moon className="w-5 h-5 text-gray-600" />
            )}
          </button>
          
          <button
            onClick={onOpenSettings}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Settings"
          >
            <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-12 animate-fade-in">
              <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                Welcome to ProCut AI
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Professional AI-powered video editing with MrBeast-level quality
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                <div className="card text-left p-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                    🎬 Upload a Video
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Drag & drop or click to select your video file
                  </p>
                </div>
                <div className="card text-left p-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                    🤖 AI Analysis
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    AI analyzes content and suggests optimal edits
                  </p>
                </div>
                <div className="card text-left p-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                    ✨ Smart Edits
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Auto-cuts, transitions, captions, and effects
                  </p>
                </div>
                <div className="card text-left p-4">
                  <h3 className="font-medium text-gray-900 dark:text-white mb-1">
                    🚀 Export
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Download your professionally edited video
                  </p>
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-slide-up`}
            >
              <div
                className={`max-w-[80%] ${
                  message.role === 'user'
                    ? 'message-user ml-auto'
                    : 'message-assistant'
                }`}
              >
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mb-3 space-y-2">
                    {message.attachments.map((attachment, idx) => (
                      <div
                        key={idx}
                        className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-lg"
                      >
                        <Paperclip className="w-4 h-4" />
                        <span>{attachment.name || attachment.path}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {message.content}
                </div>
                
                <div className="text-xs text-gray-400 mt-2">
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </div>
          ))}
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-4">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="flex items-end space-x-3">
            <button
              type="button"
              onClick={onFileSelect}
              className="p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Attach video"
            >
              <Paperclip className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            
            <div className="flex-1 relative">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Send a message or upload a video..."
                rows={1}
                className="input-base resize-none min-h-[44px] max-h-32 pr-12"
                style={{ height: 'auto', minHeight: '44px' }}
              />
            </div>
            
            <button
              type="submit"
              disabled={!inputValue.trim()}
              className="p-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 rounded-lg transition-colors"
            >
              <Send className="w-5 h-5 text-white" />
            </button>
          </div>
          
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
            ProCut AI can make mistakes. Review your edits before exporting.
          </p>
        </form>
      </div>
    </div>
  );
};

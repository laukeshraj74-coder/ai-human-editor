import React from 'react';
import { X, Key, Film, Wand2 } from 'lucide-react';
import { useAppStore } from '../hooks/useAppStore';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { omniRouteApiKey, setOmniRouteApiKey, darkMode, toggleDarkMode } = useAppStore();
  const [localApiKey, setLocalApiKey] = React.useState(omniRouteApiKey);
  const [showApiKey, setShowApiKey] = React.useState(false);

  React.useEffect(() => {
    setLocalApiKey(omniRouteApiKey);
  }, [omniRouteApiKey]);

  const handleSave = () => {
    setOmniRouteApiKey(localApiKey);
    localStorage.setItem('omniRouteApiKey', localApiKey);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* API Key Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <Key className="w-4 h-4 inline mr-1" />
              OmniRoute API Key
            </label>
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={localApiKey}
                onChange={(e) => setLocalApiKey(e.target.value)}
                placeholder="Enter your OmniRoute API key"
                className="input-base pr-20"
              />
              <button
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                {showApiKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Get your free API key from{' '}
              <a
                href="https://omniroute.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline"
              >
                OmniRoute
              </a>
            </p>
          </div>

          {/* Appearance Section */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Appearance
            </label>
            <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <span className="text-gray-700 dark:text-gray-300">Dark Mode</span>
              <button
                onClick={toggleDarkMode}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  darkMode ? 'bg-primary-600' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    darkMode ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Info Section */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              🎬 Video Processing
            </h3>
            <p className="text-xs text-blue-700 dark:text-blue-300">
              ProCut AI uses FFmpeg for all video processing. Make sure FFmpeg is installed on your system.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="btn-ghost"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="btn-primary"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};

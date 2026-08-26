import React from 'react';
import { X, Check, AlertCircle } from 'lucide-react';
import { CutPoint, Caption } from '../../shared/types';

interface TimelineEditorProps {
  duration: number;
  cuts: CutPoint[];
  captions: Caption[];
  onCutsChange?: (cuts: CutPoint[]) => void;
  onCaptionsChange?: (captions: Caption[]) => void;
}

export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  duration,
  cuts,
  captions,
  onCutsChange,
  onCaptionsChange,
}) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getCutColor = (reason?: string) => {
    switch (reason) {
      case 'filler':
        return 'bg-yellow-500';
      case 'pause':
        return 'bg-orange-500';
      case 'low_engagement':
        return 'bg-red-500';
      case 'slow_pacing':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Editing Timeline
      </h3>
      
      {/* Timeline ruler */}
      <div className="relative h-24 bg-gray-100 dark:bg-gray-700 rounded-lg mb-4 overflow-hidden">
        {/* Time markers */}
        <div className="absolute inset-0 flex justify-between px-2">
          {Array.from({ length: Math.min(Math.ceil(duration / 30) + 1, 20) }).map((_, i) => (
            <div key={i} className="text-xs text-gray-500 dark:text-gray-400">
              {formatTime(i * 30)}
            </div>
          ))}
        </div>
        
        {/* Cuts visualization */}
        <div className="absolute bottom-0 left-0 right-0 h-16">
          {cuts.map((cut, index) => (
            <div
              key={index}
              className={`absolute h-full ${getCutColor(cut.reason)} opacity-60 hover:opacity-80 transition-opacity cursor-pointer`}
              style={{
                left: `${(cut.startTime / duration) * 100}%`,
                width: `${((cut.endTime - cut.startTime) / duration) * 100}%`,
              }}
              title={`${cut.reason || 'Cut'}: ${formatTime(cut.startTime)} - ${formatTime(cut.endTime)}`}
            />
          ))}
        </div>
        
        {/* Captions visualization */}
        <div className="absolute top-0 left-0 right-0 h-8">
          {captions.map((caption, index) => (
            <div
              key={index}
              className="absolute h-full bg-blue-500 opacity-60 hover:opacity-80 transition-opacity cursor-pointer rounded text-xs text-white flex items-center px-1 overflow-hidden"
              style={{
                left: `${(caption.startTime / duration) * 100}%`,
                width: `${((caption.endTime - caption.startTime) / duration) * 100}%`,
              }}
              title={caption.text}
            >
              {caption.text.length < 20 ? caption.text : caption.text.substring(0, 20) + '...'}
            </div>
          ))}
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {cuts.filter(c => !c.keep).length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Cuts to Remove
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {captions.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Captions
          </div>
        </div>
        
        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-primary-600">
            {duration - cuts.filter(c => !c.keep).reduce((acc, c) => acc + (c.endTime - c.startTime), 0)}s
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Final Duration
          </div>
        </div>
      </div>
      
      {/* Cut list */}
      {cuts.length > 0 && (
        <div className="space-y-2 max-h-48 overflow-y-auto">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Suggested Cuts
          </h4>
          {cuts.slice(0, 10).map((cut, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <div className="flex items-center space-x-2">
                {!cut.keep ? (
                  <X className="w-4 h-4 text-red-500" />
                ) : (
                  <Check className="w-4 h-4 text-green-500" />
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {formatTime(cut.startTime)} - {formatTime(cut.endTime)}
                </span>
                {cut.reason && (
                  <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded-full text-gray-600 dark:text-gray-400">
                    {cut.reason}
                  </span>
                )}
              </div>
            </div>
          ))}
          {cuts.length > 10 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              ...and {cuts.length - 10} more cuts
            </p>
          )}
        </div>
      )}
    </div>
  );
};

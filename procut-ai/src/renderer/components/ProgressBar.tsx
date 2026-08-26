import React from 'react';

interface ProgressBarProps {
  progress: number;
  label?: string;
  sublabel?: string;
  showPercentage?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  sublabel,
  showPercentage = true,
}) => {
  const clampedProgress = Math.min(Math.max(progress, 0), 100);

  return (
    <div className="w-full">
      {(label || sublabel) && (
        <div className="flex justify-between items-center mb-2">
          {label && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {label}
            </span>
          )}
          {sublabel && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {sublabel}
            </span>
          )}
          {showPercentage && (
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {Math.round(clampedProgress)}%
            </span>
          )}
        </div>
      )}
      
      <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-300 ease-out rounded-full"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
    </div>
  );
};

export default ProgressBar;

import React, { useCallback, useState } from 'react';
import { FileVideo, X } from 'lucide-react';

interface FileUploadProps {
  onFileSelect: (file: File, path?: string) => void;
  acceptedTypes?: string[];
  maxSize?: number; // in MB
  multiple?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  acceptedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska', 'video/webm'],
  maxSize = 500, // 500MB default
  multiple = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateFile = useCallback((file: File): boolean => {
    // Check file type
    const isAcceptedType = acceptedTypes.some(type => 
      file.type.startsWith(type.split('/')[0]) || acceptedTypes.includes(file.type)
    );
    
    if (!isAcceptedType) {
      setError(`File type not supported. Please upload a video file.`);
      return false;
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      setError(`File too large. Maximum size is ${maxSize}MB.`);
      return false;
    }

    setError(null);
    return true;
  }, [acceptedTypes, maxSize]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    const validFiles = files.filter(validateFile);
    if (validFiles.length > 0) {
      onFileSelect(validFiles[0]);
    }
  }, [onFileSelect, validateFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter(validateFile);
    if (validFiles.length > 0) {
      onFileSelect(validFiles[0]);
    }

    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [onFileSelect, validateFile]);

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 cursor-pointer
          ${isDragging 
            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 scale-[1.02]' 
            : 'border-gray-300 dark:border-gray-600 hover:border-primary-400 dark:hover:border-primary-500'
          }
        `}
      >
        <input
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileInput}
          multiple={multiple}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        
        <div className="flex flex-col items-center space-y-4">
          <div className={`
            w-16 h-16 rounded-full flex items-center justify-center transition-colors
            ${isDragging 
              ? 'bg-primary-100 dark:bg-primary-800' 
              : 'bg-gray-100 dark:bg-gray-700'
            }
          `}>
            <FileVideo className={`w-8 h-8 ${isDragging ? 'text-primary-600' : 'text-gray-400 dark:text-gray-500'}`} />
          </div>
          
          <div>
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
              {isDragging ? 'Drop your video here' : 'Drag & drop your video'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              or click to browse (MP4, MOV, AVI, MKV, WebM)
            </p>
          </div>
          
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Maximum file size: {maxSize}MB
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center space-x-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-lg">
          <X className="w-4 h-4" />
          <span className="text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto hover:text-red-800 dark:hover:text-red-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default FileUpload;

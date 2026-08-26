import { useState, useEffect, useCallback } from 'react';
import apiService, { ApiProgressResponse } from '../services/api';

export function useEditProgress(jobId: string | null, pollInterval: number = 1000) {
  const [progress, setProgress] = useState<ApiProgressResponse['progress'] | null>(null);
  const [verification, setVerification] = useState<ApiProgressResponse['verification'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (!jobId) {
      return;
    }

    let pollingInterval: NodeJS.Timeout;
    let isCancelled = false;

    const pollProgress = async () => {
      try {
        const response = await apiService.getProgress(jobId);
        
        if (isCancelled) return;
        
        setProgress(response.progress);
        setVerification(response.verification);

        if (response.progress.status === 'complete') {
          setIsComplete(true);
          clearInterval(pollingInterval);
        } else if (response.progress.status === 'error') {
          setError('Video editing failed');
          setIsComplete(true);
          clearInterval(pollingInterval);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setError(err.message || 'Failed to get progress');
          setIsComplete(true);
          clearInterval(pollingInterval);
        }
      }
    };

    // Initial poll
    pollProgress();

    // Set up polling interval
    pollingInterval = setInterval(pollProgress, pollInterval);

    // Cleanup
    return () => {
      isCancelled = true;
      clearInterval(pollingInterval);
    };
  }, [jobId, pollInterval]);

  const reset = useCallback(() => {
    setProgress(null);
    setVerification(null);
    setError(null);
    setIsComplete(false);
  }, []);

  return {
    progress,
    verification,
    error,
    isComplete,
    reset,
  };
}

export default useEditProgress;

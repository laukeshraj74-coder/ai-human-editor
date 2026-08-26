import { FFmpegProgress } from '../shared/types';

export type WSMessageType = 'connected' | 'progress' | 'complete' | 'error';

export interface WSMessage {
  type: WSMessageType;
  jobId?: string;
  progress?: FFmpegProgress;
  outputPath?: string;
  error?: string;
  message?: string;
}

export class ProgressWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscriptions: Set<string> = new Set();
  
  // Event callbacks
  onConnected?: () => void;
  onProgress?: (jobId: string, progress: FFmpegProgress) => void;
  onComplete?: (jobId: string, outputPath: string) => void;
  onError?: (jobId: string, error: string) => void;
  onDisconnected?: () => void;

  constructor(baseUrl: string = 'ws://localhost:3001') {
    this.url = `${baseUrl}/ws/progress`;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        
        // Resubscribe to any previous subscriptions
        this.subscriptions.forEach(jobId => this.subscribe(jobId));
        
        if (this.onConnected) {
          this.onConnected();
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        if (this.onDisconnected) {
          this.onDisconnected();
        }
        
        // Attempt reconnection
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(message: WSMessage): void {
    switch (message.type) {
      case 'connected':
        console.log(message.message);
        break;
        
      case 'progress':
        if (message.jobId && message.progress && this.onProgress) {
          this.onProgress(message.jobId, message.progress);
        }
        break;
        
      case 'complete':
        if (message.jobId && message.outputPath && this.onComplete) {
          this.onComplete(message.jobId, message.outputPath);
        }
        break;
        
      case 'error':
        if (message.jobId && message.error && this.onError) {
          this.onError(message.jobId, message.error);
        }
        break;
    }
  }

  /**
   * Subscribe to a job's progress updates
   */
  subscribe(jobId: string): void {
    this.subscriptions.add(jobId);
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'subscribe',
        jobId,
      }));
    }
  }

  /**
   * Unsubscribe from a job's updates
   */
  unsubscribe(jobId: string): void {
    this.subscriptions.delete(jobId);
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;
    
    console.log(`Attempting reconnection in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    this.subscriptions.clear();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export const wsClient = new ProgressWebSocketClient();

import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { FFmpegProgress } from '../shared/types';

interface ClientConnection {
  ws: WebSocket;
  jobId?: string;
}

export class ProgressWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection[]> = new Map();

  constructor(server: http.Server) {
    this.wss = new WebSocketServer({ server, path: '/ws/progress' });

    this.wss.on('connection', (ws) => {
      console.log('WebSocket client connected');

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'subscribe') {
            const { jobId } = message;
            this.subscribeToJob(jobId, { ws });
            console.log(`Client subscribed to job: ${jobId}`);
          }
        } catch (error) {
          console.error('WebSocket message error:', error);
        }
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
        this.removeClient(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.removeClient(ws);
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'Connected to ProCut AI progress server',
      }));
    });
  }

  /**
   * Subscribe a client to a specific job's progress updates
   */
  private subscribeToJob(jobId: string, connection: ClientConnection): void {
    connection.jobId = jobId;
    
    if (!this.clients.has(jobId)) {
      this.clients.set(jobId, []);
    }
    
    this.clients.get(jobId)!.push(connection);
  }

  /**
   * Remove a client from all subscriptions
   */
  private removeClient(ws: WebSocket): void {
    for (const [jobId, connections] of this.clients.entries()) {
      const filtered = connections.filter(conn => conn.ws !== ws);
      
      if (filtered.length === 0) {
        this.clients.delete(jobId);
      } else {
        this.clients.set(jobId, filtered);
      }
    }
  }

  /**
   * Broadcast progress update to all clients subscribed to a job
   */
  broadcastProgress(jobId: string, progress: FFmpegProgress): void {
    const connections = this.clients.get(jobId);
    
    if (!connections || connections.length === 0) {
      return;
    }

    const message = JSON.stringify({
      type: 'progress',
      jobId,
      progress,
    });

    connections.forEach(({ ws }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  /**
   * Broadcast job completion
   */
  broadcastComplete(jobId: string, outputPath: string): void {
    const connections = this.clients.get(jobId);
    
    if (!connections || connections.length === 0) {
      return;
    }

    const message = JSON.stringify({
      type: 'complete',
      jobId,
      outputPath,
    });

    connections.forEach(({ ws }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  /**
   * Broadcast job error
   */
  broadcastError(jobId: string, error: string): void {
    const connections = this.clients.get(jobId);
    
    if (!connections || connections.length === 0) {
      return;
    }

    const message = JSON.stringify({
      type: 'error',
      jobId,
      error,
    });

    connections.forEach(({ ws }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }

  /**
   * Get number of connected clients for a job
   */
  getClientCount(jobId: string): number {
    return this.clients.get(jobId)?.length || 0;
  }

  /**
   * Get total connected clients
   */
  getTotalClients(): number {
    let count = 0;
    for (const connections of this.clients.values()) {
      count += connections.length;
    }
    return count;
  }

  /**
   * Close the WebSocket server
   */
  close(): void {
    this.wss.clients.forEach(client => {
      client.close(1000, 'Server shutting down');
    });
    this.wss.close();
  }
}

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import apiRouter from './api';
import { ffmpegEngine } from './engine';
import { ProgressWebSocketServer } from './websocket';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files for uploads and output
app.use('/uploads', express.static(path.join(__dirname, '../../uploads')));
app.use('/output', express.static(path.join(__dirname, '../../output')));

// API routes
app.use('/api', apiRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
  });
});

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server for real-time progress
const wsServer = new ProgressWebSocketServer(server);

// Wire up FFmpeg engine events to WebSocket broadcasts
ffmpegEngine.on('progress', ({ jobId, progress }) => {
  wsServer.broadcastProgress(jobId, progress);
});

ffmpegEngine.on('end', ({ jobId, outputPath }) => {
  wsServer.broadcastComplete(jobId, outputPath);
});

ffmpegEngine.on('error', ({ jobId, error }) => {
  wsServer.broadcastError(jobId, error);
});

// Start server
server.listen(PORT, () => {
  console.log(`ProCut AI API Server running on http://localhost:${PORT}`);
  console.log(`WebSocket available at ws://localhost:${PORT}/ws/progress`);
  console.log(`Uploads available at http://localhost:${PORT}/uploads`);
  console.log(`Output videos at http://localhost:${PORT}/output`);
});

export default app;
export { server };

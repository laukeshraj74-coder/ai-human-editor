import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { EditingPlan, VideoInfo } from '../shared/types';
import { ffmpegEngine } from './engine';
import { videoVerifier } from './verification';
import { OmniRouteClient } from './omniRoute';
import { applyPresetToPlan } from './presets';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowedTypes = /mp4|mov|avi|mkv|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed'));
    }
  },
});

/**
 * POST /api/upload
 * Upload a video file
 */
router.post('/upload', upload.single('video'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No video file uploaded' });
      return;
    }

    const videoPath = req.file.path;
    const videoInfo = await ffmpegEngine.getVideoInfo(videoPath);

    res.json({
      success: true,
      filePath: videoPath,
      fileName: req.file.originalname,
      videoInfo,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ 
      error: 'Failed to upload video',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/analyze
 * Analyze video using OmniRoute AI and generate Director Plan
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { videoPath, apiKey, preset } = req.body;

    if (!videoPath) {
      res.status(400).json({ error: 'Video path is required' });
      return;
    }

    // Get video info
    const videoInfo = await ffmpegEngine.getVideoInfo(videoPath);
    
    // Initialize OmniRoute client
    const omniClient = new OmniRouteClient({ 
      apiKey: apiKey || process.env.OMNIROUTE_API_KEY || '' 
    });

    // Chunk the video (1 chunk per minute for analysis)
    const chunkCount = Math.ceil(videoInfo.duration / 60);
    const chunks = [];

    // Analyze each chunk
    for (let i = 0; i < chunkCount; i++) {
      const startTime = i * 60;
      const endTime = Math.min((i + 1) * 60, videoInfo.duration);
      
      const chunkAnalysis = await omniClient.analyzeVideoChunk(videoPath, i);
      chunks.push({
        id: i,
        startTime,
        endTime,
        ...chunkAnalysis,
      });
    }

    // Detect filler moments
    const fillerMoments = await omniClient.detectFillerMoments({
      chunks,
      overallSummary: '',
      suggestedCuts: [],
      captions: [],
      effects: [],
    });

    // Generate captions with speech-to-text
    const captions = await omniClient.generateCaptions(videoPath);

    // Compile analysis results into Director Plan
    const directorPlan: EditingPlan = {
      inputPath: videoPath,
      outputPath: '',
      cuts: fillerMoments.map(moment => ({
        startTime: moment.startTime,
        endTime: moment.endTime,
        keep: false,
        reason: moment.type,
      })),
      effects: [],
      zoomPoints: [],
      transitions: [],
      captions,
      preset: preset || undefined,
    };

    // Apply preset if specified
    if (preset) {
      const modifiedPlan = applyPresetToPlan(directorPlan, preset);
      Object.assign(directorPlan, modifiedPlan);
    }

    res.json({
      success: true,
      plan: directorPlan,
      videoInfo,
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze video',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/edit
 * Execute video editing based on Director Plan with WebSocket progress
 */
router.post('/edit', async (req: Request, res: Response) => {
  try {
    const { plan }: { plan: EditingPlan } = req.body;

    if (!plan || !plan.inputPath) {
      res.status(400).json({ error: 'Editing plan is required' });
      return;
    }

    // Generate output path if not provided
    if (!plan.outputPath) {
      const ext = path.extname(plan.inputPath);
      const base = path.basename(plan.inputPath, ext);
      plan.outputPath = path.join(__dirname, `../../output/${base}_edited${ext}`);
    }

    // Ensure output directory exists
    const outputDir = path.dirname(plan.outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Execute the editing plan
    const jobId = await ffmpegEngine.executePlan(plan);

    // Return job ID immediately for WebSocket updates
    res.json({
      jobId,
      status: 'processing',
      message: 'Video editing started. Progress will be sent via WebSocket.',
    });
  } catch (error) {
    console.error('Edit error:', error);
    res.status(500).json({ 
      error: 'Failed to edit video',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/progress/:jobId
 * Poll for editing progress (fallback for non-WebSocket clients)
 */
router.get('/progress/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = ffmpegEngine.getJobStatus(jobId);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json({
    jobId,
    progress: job.progress,
    status: job.status,
    error: job.error,
  });
});

/**
 * GET /api/video-info/:videoPath
 * Get video information
 */
router.get('/video-info/:videoPath', async (req: Request, res: Response) => {
  try {
    const videoPath = decodeURIComponent(req.params.videoPath);
    const videoInfo = await ffmpegEngine.getVideoInfo(videoPath);

    res.json({
      success: true,
      videoInfo,
    });
  } catch (error) {
    console.error('Video info error:', error);
    res.status(500).json({ 
      error: 'Failed to get video info',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/verify/:outputPath
 * Verify edited video quality
 */
router.get('/verify/:outputPath', async (req: Request, res: Response) => {
  try {
    const outputPath = decodeURIComponent(req.params.outputPath);
    const inputPath = req.query.inputPath as string | undefined;
    
    let inputInfo: VideoInfo | undefined;
    
    if (inputPath) {
      inputInfo = await ffmpegEngine.getVideoInfo(inputPath);
    }
    
    const verification = await videoVerifier.verify(outputPath, inputInfo?.duration);
    
    res.json({
      success: true,
      verification,
      report: videoVerifier.generateReport(verification),
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      error: 'Failed to verify video',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/presets
 * Get available editing presets
 */
router.get('/presets', (_req: Request, res: Response) => {
  const { PRESETS } = require('./presets');
  
  res.json({
    success: true,
    presets: Object.values(PRESETS),
  });
});

export default router;

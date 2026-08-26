import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getVideoInfo, EditingPlan, generateFFmpegCommand, executeFFmpegCommand } from './ffmpeg';
import { OmniRouteClient } from './omniRoute';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
  fileFilter: (req, file, cb) => {
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
    const videoInfo = await getVideoInfo(videoPath);

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
 * Analyze video using OmniRoute AI
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { videoPath, apiKey } = req.body;

    if (!videoPath) {
      res.status(400).json({ error: 'Video path is required' });
      return;
    }

    // Get video info
    const videoInfo = await getVideoInfo(videoPath);
    
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

    // Generate captions
    const captions = await omniClient.generateCaptions(videoPath);

    // Compile analysis results
    const analysis = {
      chunks,
      overallSummary: 'AI-generated video analysis',
      suggestedCuts: fillerMoments.map(moment => ({
        startTime: moment.startTime,
        endTime: moment.endTime,
        reason: moment.type,
        confidence: moment.confidence,
      })),
      captions,
      effects: ['zoompan', 'xfade'],
    };

    res.json({
      success: true,
      analysis,
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
 * Execute video editing based on analysis
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
      const base = plan.inputPath.slice(0, -ext.length);
      plan.outputPath = `${base}_edited${ext}`;
    }

    // Execute FFmpeg command
    const result = await executeFFmpegCommand(plan, (progress) => {
      // In production, emit progress via WebSocket or Server-Sent Events
      console.log('FFmpeg progress:', progress);
    });

    res.json({
      success: true,
      outputPath: plan.outputPath,
      ffmpegCommand: generateFFmpegCommand(plan),
      ...result,
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
 * GET /api/video-info/:videoPath
 * Get video information
 */
router.get('/video-info/:videoPath', async (req: Request, res: Response) => {
  try {
    const videoPath = decodeURIComponent(req.params.videoPath);
    const videoInfo = await getVideoInfo(videoPath);

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

export default router;

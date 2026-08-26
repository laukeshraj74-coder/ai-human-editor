import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { EditingPlan, FFmpegProgress, VideoInfo, VerificationResult } from '../shared/types';
import { getVideoInfo, executeFFmpegCommand, generateFFmpegCommand } from './ffmpeg';
import { OmniRouteClient } from './omniRoute';
import { VideoVerifier } from './verification';

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

// Store progress for polling
const progressStore = new Map<string, FFmpegProgress & { status: string }>();
const verificationStore = new Map<string, VerificationResult>();

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
 * Analyze video using OmniRoute AI and generate Director Plan
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

    // Compile analysis results into Director Plan
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
 * Execute video editing based on Director Plan with progress tracking
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

    const jobId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize progress tracking
    progressStore.set(jobId, {
      percent: 0,
      currentFps: 0,
      currentKbps: 0,
      targetSize: 0,
      timemark: '00:00:00',
      status: 'initializing'
    });

    // Initialize engine and execute plan
    executeFFmpegCommand(plan, (progress) => {
      progressStore.set(jobId, {
        ...progress,
        status: 'processing'
      });
    })
      .then(async (result) => {
        // Verify output
        const verifier = new VideoVerifier();
        const inputInfo = await getVideoInfo(plan.inputPath);
        const verification = await verifier.verify(plan.outputPath, inputInfo);
        
        verificationStore.set(jobId, verification);
        progressStore.set(jobId, {
          percent: 100,
          currentFps: 0,
          currentKbps: 0,
          targetSize: 0,
          timemark: 'complete',
          status: 'complete'
        });

        res.json({
          jobId,
          outputPath: plan.outputPath,
          ffmpegCommand: generateFFmpegCommand(plan),
          verification,
          ...result,
        });
      })
      .catch((error) => {
        console.error('Edit error:', error);
        progressStore.set(jobId, {
          percent: 0,
          currentFps: 0,
          currentKbps: 0,
          targetSize: 0,
          timemark: 'error',
          status: 'error'
        });
        
        res.status(500).json({ 
          error: 'Failed to edit video',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      });

    // Return job ID immediately for polling
    res.json({
      jobId,
      status: 'processing',
      message: 'Video editing started',
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
 * Poll for editing progress
 */
router.get('/progress/:jobId', (req: Request, res: Response) => {
  const { jobId } = req.params;
  const progress = progressStore.get(jobId);
  const verification = verificationStore.get(jobId);

  if (!progress) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  res.json({
    jobId,
    progress,
    verification,
  });
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

/**
 * GET /api/verify/:outputPath
 * Verify edited video quality
 */
router.get('/verify/:outputPath', async (req: Request, res: Response) => {
  try {
    const outputPath = decodeURIComponent(req.params.outputPath);
    const inputPath = req.query.inputPath as string | undefined;
    
    const verifier = new VideoVerifier();
    let inputInfo: VideoInfo | undefined;
    
    if (inputPath) {
      inputInfo = await getVideoInfo(inputPath);
    }
    
    const verification = await verifier.verify(outputPath, inputInfo);
    
    res.json({
      success: true,
      verification,
    });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ 
      error: 'Failed to verify video',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;

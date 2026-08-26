# ProCut AI - MrBeast-Style AI Video Editor

A professional-grade desktop AI video editor built with Electron, React, TypeScript, and FFmpeg. Features ChatGPT-style UI, real-time WebSocket progress updates, and automated MrBeast-style editing.

## 🎬 Features

### Core Editing
- **Smart Cuts**: Automatic filler/pause removal using AI analysis
- **Dynamic Zooms**: `zoompan` filter for dramatic MrBeast-style zoom-ins
- **9 Transition Types**: fade, slideleft, slideright, wipeleft, wiperight, circleopen, circleclose, dissolve
- **Animated Captions**: Bold pop-up, slide, and typewriter effects with customizable styling
- **SFX Integration**: Automatic sound effect mixing (risers, whooshes, hits) using `amix` and `adelay` filters
- **Background Music**: Fade in/out with volume control

### Presets
- **MrBeast**: Aggressive pacing, heavy zooms, high-tempo SFX, bold captions
- **Documentary**: Slow pacing, subtle zooms, minimal SFX
- **Tutorial**: Medium pacing, slide transitions, highlighted captions
- **Vlog**: Fast pacing, dissolve transitions, bold captions

### Technical
- Real-time WebSocket progress updates
- ChatGPT-style dark mode UI
- Drag-and-drop video upload
- Built-in video preview player
- Quality verification (resolution, audio sync, duration, codec)

## 📁 Project Structure

```
procut-ai/
├── src/
│   ├── main/                      # Backend + Electron Main Process
│   │   ├── main.ts                # Electron entry point
│   │   ├── server.ts              # Express + WebSocket server
│   │   ├── api.ts                 # REST API routes
│   │   ├── engine.ts              # FFmpeg editing engine
│   │   ├── ffmpeg.ts              # FFmpeg wrapper utilities
│   │   ├── verification.ts        # Quality verification
│   │   ├── presets.ts             # Edit presets (mrbeast, etc.)
│   │   ├── websocket.ts           # WebSocket server
│   │   └── omniRoute.ts           # OmniRoute AI client
│   │
│   ├── renderer/                  # React Frontend
│   │   ├── App.tsx                # Main React component
│   │   ├── components/            # UI components
│   │   │   ├── ChatInterface.tsx  # ChatGPT-style chat
│   │   │   ├── VideoPreview.tsx   # Video player
│   │   │   ├── ProgressBar.tsx    # FFmpeg progress
│   │   │   ├── FileUpload.tsx     # Drag-drop upload
│   │   │   └── TimelineEditor.tsx # Visual timeline
│   │   ├── services/              # API + WebSocket clients
│   │   └── hooks/                 # Custom React hooks
│   │
│   └── shared/types.ts            # TypeScript interfaces
│
├── assets/sfx/                    # Sound effects library
├── uploads/                       # Input videos
├── output/                        # Edited videos
└── package.json
```

## 🚀 Installation & Running

### Prerequisites
1. **Node.js** v18+ installed
2. **FFmpeg** installed on your system

#### Install FFmpeg on Windows:
```powershell
# Using Chocolatey
choco install ffmpeg

# OR download from https://gyan.dev/ffmpeg-builds/
# Add to PATH manually
```

### Setup

```bash
cd procut-ai

# Install dependencies
npm install

# Optional: Set OmniRoute API key for AI features
echo OMNIROUTE_API_KEY=your_api_key > .env
```

### Development Mode

**Terminal 1 - Start Backend Server:**
```bash
npm run server:dev
```
Server runs at: http://localhost:3001
WebSocket at: ws://localhost:3001/ws/progress

**Terminal 2 - Start Electron App:**
```bash
npm run electron:dev
```

### Build Windows .exe

```bash
npm run build:win
```

The installer will be created at: `release/ProCut AI Setup.exe`

## 📡 WebSocket Protocol

### Subscribe to Job Progress
```json
{ "type": "subscribe", "jobId": "job_1234567890" }
```

### Server Messages
```json
// Progress Update
{ "type": "progress", "jobId": "...", "progress": { "percent": 45, "currentFps": 30, "timemark": "00:01:23" } }

// Complete
{ "type": "complete", "jobId": "...", "outputPath": "/path/to/video.mp4" }

// Error
{ "type": "error", "jobId": "...", "error": "message" }
```

## 🔌 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload video file |
| `/api/analyze` | POST | Analyze video with AI |
| `/api/edit` | POST | Execute editing plan |
| `/api/progress/:jobId` | GET | Poll job progress (fallback) |
| `/api/video-info/:path` | GET | Get video metadata |
| `/api/verify/:path` | GET | Verify output quality |
| `/api/presets` | GET | List available presets |

## 🎯 Usage Flow

1. **Upload Video**: Click paperclip icon or drag video file
2. **AI Analysis**: System analyzes content and suggests cuts
3. **Review Plan**: Check suggested edits in timeline
4. **Select Preset**: Choose MrBeast, Documentary, Tutorial, or Vlog
5. **Export**: Click "Export Video" to render
6. **Monitor Progress**: Watch real-time progress via WebSocket
7. **Download**: Get your professionally edited video!

## 🎵 SFX Library

Place your SFX files in `assets/sfx/`:
- `riser.mp3` - Buildup tension
- `whoosh.mp3` - Transition swoosh
- `hit.mp3` - Impact sound
- `boom.mp3` - Explosion
- `laugh.mp3` - Comedy laugh track
- `transition.mp3` - General transition

Free SFX sources:
- Freesound.org
- ZapSplat.com
- Mixkit.co

## 🛠️ Tech Stack

- **Frontend**: Electron + React + TypeScript + Tailwind CSS
- **Backend**: Express.js + WebSocket (ws)
- **Video Processing**: fluent-ffmpeg
- **AI**: OmniRoute API (Qwen3-VL, Qwen3-Coder)
- **Build**: electron-builder

## 📝 License

MIT License - See LICENSE file for details.

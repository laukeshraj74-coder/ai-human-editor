# ProCut AI - Professional Desktop AI Video Editor

## Overview
ProCut AI is an Electron-based desktop application that leverages AI to automatically edit videos with MrBeast-level quality. It uses the OmniRoute API for intelligent video analysis and FFmpeg for professional video processing.

## Project Architecture

### Tech Stack
- **Frontend**: Electron + React + TypeScript + Tailwind CSS (ChatGPT-like UI)
- **AI Backend**: OmniRoute API (Qwen3-VL for video analysis, Qwen3-Coder for editing plans)
- **Video Processing**: FFmpeg (cutting, merging, filters, transitions, overlays)

### Folder Structure
```
procut-ai/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── main.ts              # Main entry point
│   │   ├── preload.ts           # Preload script for IPC
│   │   └── ffmpeg.ts            # FFmpeg wrapper
│   ├── renderer/                # React frontend
│   │   ├── App.tsx              # Main app component
│   │   ├── index.tsx            # React entry point
│   │   ├── components/          # UI components
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── VideoPreview.tsx
│   │   │   ├── TimelineEditor.tsx
│   │   │   ├── SettingsPanel.tsx
│   │   │   └── ProgressBar.tsx
│   │   ├── hooks/               # Custom React hooks
│   │   │   ├── useVideoAnalysis.ts
│   │   │   ├── useFFmpeg.ts
│   │   │   └── useDarkMode.ts
│   │   ├── services/            # API & processing services
│   │   │   ├── omniRoute.ts     # OmniRoute API client
│   │   │   ├── videoProcessor.ts # Video analysis & editing
│   │   │   └── audioHandler.ts  # Audio processing
│   │   ├── styles/              # Global styles
│   │   │   └── index.css        # Tailwind imports
│   │   └── types/               # TypeScript types
│   │       └── index.ts
│   ├── shared/                  # Shared types & utilities
│   │   └── types.ts
│   └── assets/                  # Static assets
├── public/
│   └── icon.ico
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── electron-builder.json
├── vite.config.ts
└── README.md
```

## Implementation Phases

### Phase 1: Core Setup & Basic Video Operations
1. Initialize Electron + React + TypeScript project
2. Configure Tailwind CSS with dark mode
3. Set up FFmpeg integration
4. Implement basic video cutting/trimming functionality
5. Create ChatGPT-like UI components

### Phase 2: Advanced Filters & Effects
1. Add zoompan filter for dynamic zoom-ins
2. Implement xfade transitions
3. Add overlay support for graphics/text
4. Create audio mixing capabilities
5. Build timeline editor component

### Phase 3: AI Integration (OmniRoute)
1. Integrate OmniRoute API client
2. Implement video chunking and analysis with Qwen3-VL
3. Generate editing scripts using Qwen3-Coder
4. Auto-detect filler moments and dead air
5. Smart caption generation via Speech-to-Text

### Phase 4: Full Pipeline & Polish
1. Complete end-to-end workflow (upload → analyze → edit → export)
2. Add quality verification checks
3. Implement progress tracking
4. Add settings panel for API keys and preferences
5. Build Windows .exe with electron-builder

## Key Features

### Smart Cuts
- Automatically detects pauses, slow sections, and filler content
- Ensures new hooks appear every 1-3 minutes
- Uses AI to identify engaging vs boring segments

### Dynamic Pacing
- Smooth zoom-ins using FFmpeg zoompan filter
- Cinematic crossfade transitions
- Automatic pacing adjustments based on content type

### Audio & SFX
- Background music auto-mixing
- Sound effect placement (risers, whooshes) at key moments
- Audio level normalization

### Captions & Graphics
- Speech-to-Text subtitle generation
- Animated caption burning
- Customizable text styles and positions

## Getting Started

### Prerequisites
- Node.js 18+
- FFmpeg installed on system
- OmniRoute API key (free tier available)

### Installation
```bash
npm install
```

### Development
```bash
npm run dev
```

### Build Windows Executable
```bash
npm run build:win
```

## Usage Workflow
1. Launch ProCut AI
2. Drag and drop or select a video file
3. AI analyzes the video and generates an editing plan
4. Review/edit the plan in the chat interface
5. Execute the edit and preview results
6. Export the final video

## License
MIT

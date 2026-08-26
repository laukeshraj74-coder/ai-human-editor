# SFX Sound Effects Library for ProCut AI

This directory contains sound effect files used by the MrBeast-style video editing engine.

## Required Files

Place the following free-to-use SFX files in this directory:

- `riser.mp3` - Rising tension sound (before reveals/dramatic moments)
- `whoosh.mp3` - Whoosh transition sound (for quick cuts/zooms)
- `hit.mp3` - Hit/impact sound (for emphasis moments)
- `boom.mp3` - Boom sound effect (for dramatic reveals)
- `laugh.mp3` - Laugh track (optional, for comedic moments)
- `transition.mp3` - General transition sound

## Where to Get Free SFX

1. **Freesound.org** - Creative Commons licensed sounds
2. **ZapSplat.com** - Free sound effects library
3. **Mixkit.co** - Free stock music and SFX
4. **YouTube Audio Library** - Free sounds for creators

## Usage

The engine automatically loads these files when referenced in the editing plan:

```typescript
// In your editing plan
{
  sfx: [
    { type: 'riser', startTime: 5.0, volume: 0.7 },
    { type: 'whoosh', startTime: 10.5, volume: 0.5 },
    { type: 'hit', startTime: 15.0, volume: 0.6 }
  ]
}
```

The preset system (mrbeast, documentary, tutorial, vlog) automatically generates appropriate SFX placements based on the detected video content.

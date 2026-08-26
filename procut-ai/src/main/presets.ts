import { PresetConfig, EditPreset, EditingPreset } from '../shared/types';

export const PRESETS: Record<EditPreset, PresetConfig> = {
  mrbeast: {
    name: 'mrbeast',
    cutThreshold: 2.0, // Cut silence longer than 2 seconds
    zoomIntensity: 1.5, // Aggressive zooms (1.5x)
    transitionType: 'xfade',
    captionStyle: 'bold',
    sfxDensity: 'high',
    pacing: 'aggressive',
  },
  documentary: {
    name: 'documentary',
    cutThreshold: 4.0, // Longer pauses allowed
    zoomIntensity: 1.2, // Subtle zooms
    transitionType: 'fade',
    captionStyle: 'normal',
    sfxDensity: 'low',
    pacing: 'slow',
  },
  tutorial: {
    name: 'tutorial',
    cutThreshold: 3.0,
    zoomIntensity: 1.3,
    transitionType: 'slideleft',
    captionStyle: 'highlight',
    sfxDensity: 'medium',
    pacing: 'medium',
  },
  vlog: {
    name: 'vlog',
    cutThreshold: 2.5,
    zoomIntensity: 1.4,
    transitionType: 'dissolve',
    captionStyle: 'bold',
    sfxDensity: 'medium',
    pacing: 'fast',
  },
};

/**
 * Get preset configuration by name
 */
export function getPreset(name: EditPreset | EditingPreset): PresetConfig {
  return PRESETS[name as EditPreset];
}

/**
 * Apply preset to an editing plan
 * Modifies cuts, zooms, captions, and SFX based on preset settings
 */
export function applyPresetToPlan(plan: any, preset: EditPreset | EditingPreset): any {
  const config = PRESETS[preset as EditPreset];
  
  return {
    ...plan,
    preset: preset as EditPreset,
    // Adjust cuts based on pacing
    cuts: plan.cuts?.map((cut: any) => ({
      ...cut,
      threshold: config.cutThreshold,
    })),
    // Adjust zoom intensity
    zoomPoints: plan.zoomPoints?.map((zoom: any) => ({
      ...zoom,
      zoomLevel: zoom.zoomLevel * config.zoomIntensity,
    })),
    // Adjust caption style
    captions: plan.captions?.map((caption: any) => ({
      ...caption,
      style: config.captionStyle,
      fontSize: config.captionStyle === 'bold' ? 48 : 32,
      fontColor: config.captionStyle === 'highlight' ? '#FFFF00' : '#FFFFFF',
      backgroundColor: config.captionStyle === 'highlight' ? 'black@0.8' : undefined,
    })),
    // Add SFX based on density
    sfx: config.sfxDensity !== 'low' ? generateSFXForPreset(plan, config.sfxDensity) : [],
    // Set background music volume
    backgroundMusic: plan.backgroundMusic ? {
      ...plan.backgroundMusic,
      volume: config.pacing === 'aggressive' ? 0.3 : 0.5,
      fadeDuration: config.pacing === 'slow' ? 2.0 : 0.5,
    } : undefined,
  };
}

/**
 * Generate SFX events based on preset density and video content
 */
function generateSFXForPreset(plan: any, density: 'low' | 'medium' | 'high'): any[] {
  const sfx: any[] = [];
  
  // Add risers before zoom points
  if (plan.zoomPoints) {
    plan.zoomPoints.forEach((zoom: any) => {
      sfx.push({
        type: 'riser',
        startTime: Math.max(0, zoom.timestamp - 1.5),
        duration: 1.5,
        volume: density === 'high' ? 0.8 : 0.5,
      });
    });
  }
  
  // Add whooshes at transitions
  if (plan.transitions) {
    plan.transitions.forEach((trans: any) => {
      sfx.push({
        type: 'whoosh',
        startTime: trans.timestamp - 0.3,
        duration: 0.5,
        volume: density === 'high' ? 0.7 : 0.4,
      });
    });
  }
  
  // Add hit marks for aggressive pacing
  if (density === 'high' && plan.cuts) {
    plan.cuts
      .filter((cut: any) => !cut.keep)
      .forEach((cut: any, index: number) => {
        if (index % 2 === 0) { // Every other cut
          sfx.push({
            type: 'hit',
            startTime: cut.endTime,
            duration: 0.3,
            volume: 0.6,
          });
        }
      });
  }
  
  // Sort by start time
  return sfx.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Get recommended preset based on video characteristics
 */
export function recommendPreset(videoInfo: {
  duration: number;
  hasSpeech: boolean;
  mood?: string;
}): EditPreset {
  const { duration, hasSpeech, mood } = videoInfo;
  
  // Short, high-energy videos -> MrBeast
  if (duration < 180 && mood === 'energetic') {
    return 'mrbeast';
  }
  
  // Long-form with speech -> Documentary
  if (duration > 600 && hasSpeech && mood === 'calm') {
    return 'documentary';
  }
  
  // Medium length with instructional content -> Tutorial
  if (duration >= 180 && duration <= 600 && hasSpeech) {
    return 'tutorial';
  }
  
  // Default to vlog style
  return 'vlog';
}

// Export presets object for direct access
export const presets = PRESETS;

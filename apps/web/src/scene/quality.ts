export type SceneQualityLevel = 'compact' | 'balanced' | 'high';

export interface SceneQuality {
  level: SceneQualityLevel;
  dpr: [number, number];
  radialSegments: number;
  tubularSegments: number;
  fieldLineCount: number;
  shadows: boolean;
  animate: boolean;
}

export interface SceneViewport {
  width: number;
  height: number;
  compact: boolean;
  quality: SceneQuality;
}

export function resolveSceneQuality(
  width: number,
  height: number,
  devicePixelRatio: number,
  reducedMotion: boolean,
): SceneQuality {
  const compact = width < 720 || height < 440;
  const expensiveDisplay = devicePixelRatio > 2;

  if (compact) {
    return {
      level: 'compact',
      dpr: [1, Math.min(devicePixelRatio, 1.35)],
      radialSegments: 18,
      tubularSegments: 72,
      fieldLineCount: 4,
      shadows: false,
      animate: !reducedMotion,
    };
  }

  if (expensiveDisplay || width < 1180) {
    return {
      level: 'balanced',
      dpr: [1, Math.min(devicePixelRatio, 1.65)],
      radialSegments: 24,
      tubularSegments: 112,
      fieldLineCount: 6,
      shadows: false,
      animate: !reducedMotion,
    };
  }

  return {
    level: 'high',
    dpr: [1, Math.min(devicePixelRatio, 2)],
    radialSegments: 32,
    tubularSegments: 160,
    fieldLineCount: 8,
    shadows: true,
    animate: !reducedMotion,
  };
}

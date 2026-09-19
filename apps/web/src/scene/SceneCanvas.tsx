import { PerformanceMonitor } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { createContext, type PropsWithChildren, useContext } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  downgradeSceneQuality,
  resolveSceneQuality,
  type SceneViewport,
} from './quality';

interface SceneCanvasProps extends PropsWithChildren {
  className?: string;
  reducedMotion: boolean;
  onViewportChange?: (viewport: SceneViewport) => void;
  onContextLost?: () => void;
}

const INITIAL_VIEWPORT = { width: 960, height: 640 };
const SceneViewportContext = createContext<SceneViewport>({
  ...INITIAL_VIEWPORT,
  compact: false,
  degraded: false,
  quality: resolveSceneQuality(960, 640, 1, false),
});

export function useSceneViewport() {
  return useContext(SceneViewportContext);
}

export function SceneCanvas({
  children,
  className,
  reducedMotion,
  onViewportChange,
  onContextLost,
}: SceneCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(INITIAL_VIEWPORT);
  const [performanceDegraded, setPerformanceDegraded] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = (width: number, height: number) => {
      if (width > 0 && height > 0) setSize({ width, height });
    };
    const rect = container.getBoundingClientRect();
    update(rect.width, rect.height);

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) update(entry.contentRect.width, entry.contentRect.height);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const viewport = useMemo<SceneViewport>(() => {
    const devicePixelRatio =
      typeof window === 'undefined' ? 1 : window.devicePixelRatio;
    const preferredQuality = resolveSceneQuality(
      size.width,
      size.height,
      devicePixelRatio,
      reducedMotion,
    );
    const quality = performanceDegraded
      ? downgradeSceneQuality(preferredQuality)
      : preferredQuality;
    return {
      ...size,
      compact: size.width < 720 || size.height < 440,
      degraded: performanceDegraded,
      quality,
    };
  }, [performanceDegraded, reducedMotion, size]);

  useEffect(() => {
    onViewportChange?.(viewport);
  }, [onViewportChange, viewport]);

  return (
    <div
      ref={containerRef}
      className={className}
      data-scene-quality={viewport.quality.level}
      data-scene-degraded={viewport.degraded || undefined}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 360,
        height: '100%',
        overflow: 'hidden',
        background:
          'radial-gradient(circle at 50% 42%, #0c2024 0%, #071216 45%, #03080a 100%)',
      }}
    >
      <Canvas
        dpr={viewport.quality.dpr}
        camera={{ position: [5.8, 3.3, 6.4], fov: 34, near: 0.1, far: 100 }}
        gl={{
          alpha: false,
          antialias: viewport.quality.level !== 'compact',
          powerPreference: 'high-performance',
        }}
        shadows={viewport.quality.shadows}
        style={{ position: 'absolute', inset: 0 }}
        onCreated={({ gl }) => {
          gl.domElement.addEventListener(
            'webglcontextlost',
            (event) => {
              event.preventDefault();
              onContextLost?.();
            },
            { once: true },
          );
        }}
      >
        <color attach="background" args={['#03080a']} />
        <PerformanceMonitor
          onDecline={() => setPerformanceDegraded(true)}
        />
        <SceneViewportContext.Provider value={viewport}>
          {children}
        </SceneViewportContext.Provider>
      </Canvas>
    </div>
  );
}

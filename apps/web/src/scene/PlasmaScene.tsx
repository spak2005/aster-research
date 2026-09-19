import { Suspense } from 'react';
import { useState } from 'react';
import type { PlasmaSceneProps } from '../../../../contracts/recording';
import { SceneCanvas } from './SceneCanvas';
import { SceneControls } from './SceneControls';
import { TokamakStage } from './TokamakStage';

export default function PlasmaScene({
  experiment,
  baseline = null,
  frameIndex,
  temperatureScale,
  geometry,
  compare = false,
  reducedMotion = false,
  className,
}: PlasmaSceneProps) {
  const [cameraResetRevision, setCameraResetRevision] = useState(0);
  const label = experiment
    ? `${experiment.label}, frame ${frameIndex + 1}`
    : 'No experiment selected';

  return (
    <section
      aria-label={`Schematic plasma visualization: ${label}`}
      data-scene-mode={compare && baseline ? 'comparison' : 'single'}
      style={{
        position: 'relative',
        width: '100%',
        minHeight: 360,
        height: '100%',
        color: '#d7eef0',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <SceneCanvas className={className} reducedMotion={reducedMotion}>
        <Suspense fallback={null}>
          <TokamakStage geometry={geometry} />
          <SceneControls
            resetRevision={cameraResetRevision}
            reducedMotion={reducedMotion}
          />
        </Suspense>
      </SceneCanvas>
      <div
        aria-live="polite"
        style={{
          position: 'absolute',
          left: 16,
          top: 14,
          maxWidth: 'calc(100% - 32px)',
          fontSize: 11,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#83aeb2',
          pointerEvents: 'none',
        }}
      >
        {label} · {geometry.major_radius_m.toFixed(2)} m major radius ·{' '}
        {temperatureScale[0].toFixed(1)}–{temperatureScale[1].toFixed(1)} keV
      </div>
      <button
        type="button"
        onClick={() => setCameraResetRevision((revision) => revision + 1)}
        style={{
          position: 'absolute',
          right: 14,
          top: 12,
          border: '1px solid rgba(125, 197, 202, 0.32)',
          borderRadius: 999,
          padding: '7px 11px',
          background: 'rgba(4, 13, 15, 0.78)',
          color: '#a9cdd0',
          font: 'inherit',
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          cursor: 'pointer',
        }}
        aria-label="Reset plasma camera"
      >
        Reset view
      </button>
    </section>
  );
}

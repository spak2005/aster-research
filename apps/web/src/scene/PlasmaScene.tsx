import { Suspense } from 'react';
import type { PlasmaSceneProps } from '../../../../contracts/recording';
import { SceneCanvas } from './SceneCanvas';

function EmptyStage() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 6, 4]} intensity={1.2} color="#bfeff2" />
      <gridHelper args={[12, 24, '#15383c', '#0a1d20']} position={[0, -2.15, 0]} />
    </>
  );
}

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
          <EmptyStage />
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
    </section>
  );
}

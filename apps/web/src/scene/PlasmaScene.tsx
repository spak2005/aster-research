import { Suspense } from 'react';
import { useCallback, useState } from 'react';
import type { PlasmaSceneProps } from '../../../../contracts/recording';
import { SceneCanvas } from './SceneCanvas';
import { SceneControls } from './SceneControls';
import { getHeatingEnvelope } from './heatingProfile';
import { loadProfileFrame } from './profileFrames';
import { TemperatureLegend } from './TemperatureLegend';
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
  const [compact, setCompact] = useState(false);
  const handleViewportChange = useCallback(
    (viewport: { compact: boolean }) => setCompact(viewport.compact),
    [],
  );
  const profile = loadProfileFrame(experiment, frameIndex);
  const heating = getHeatingEnvelope(experiment);
  const label =
    profile.status === 'ready' && experiment
      ? `${experiment.label}, frame ${profile.value.index + 1} of ${profile.value.count}`
      : experiment?.label ?? 'No experiment selected';

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
      <SceneCanvas
        className={className}
        reducedMotion={reducedMotion}
        onViewportChange={handleViewportChange}
      >
        <Suspense fallback={null}>
          <TokamakStage
            geometry={geometry}
            frame={profile.status === 'ready' ? profile.value.frame : null}
            temperatureScale={temperatureScale}
            heating={heating}
          />
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
      {heating ? (
        <div
          style={{
            position: 'absolute',
            left: 16,
            top: 38,
            paddingLeft: 8,
            borderLeft: '2px solid #d99b4f',
            color: '#c9aa78',
            fontSize: 10,
            letterSpacing: '0.045em',
            fontVariantNumeric: 'tabular-nums',
            pointerEvents: 'none',
          }}
        >
          CONFIGURED HEATING · ρ {heating.locationRho.toFixed(2)} · Δρ{' '}
          {heating.widthRho.toFixed(2)}
          <span style={{ color: '#6f8585' }}> · NOT A MEASURED FIELD</span>
        </div>
      ) : null}
      {profile.status === 'ready' ? (
        <div
          style={{
            position: 'absolute',
            left: 16,
            bottom: 14,
            maxWidth: 'calc(100% - 32px)',
            fontSize: 10,
            lineHeight: 1.45,
            letterSpacing: '0.04em',
            color: '#73979a',
            pointerEvents: 'none',
          }}
        >
          SCHEMATIC AXISYMMETRIC RECONSTRUCTION
          <br />
          VOLUME ENCODING: MEAN RECORDED Tₑ / Tᵢ PROFILE
        </div>
      ) : null}
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
      {profile.status !== 'ready' ? (
        <div
          role="status"
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 18,
            transform: 'translateX(-50%)',
            maxWidth: 'calc(100% - 36px)',
            border: '1px solid rgba(202, 157, 91, 0.3)',
            borderRadius: 4,
            padding: '8px 11px',
            background: 'rgba(17, 15, 11, 0.86)',
            color: '#d2b27d',
            fontSize: 11,
            textAlign: 'center',
          }}
        >
          {profile.reason}
        </div>
      ) : null}
      {profile.status === 'ready' ? (
        <TemperatureLegend scale={temperatureScale} compact={compact} />
      ) : null}
    </section>
  );
}

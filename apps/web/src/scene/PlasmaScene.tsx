import { Suspense } from 'react';
import { useCallback, useState } from 'react';
import type { PlasmaSceneProps } from '../../../../contracts/recording';
import { SceneCanvas } from './SceneCanvas';
import { SceneControls } from './SceneControls';
import { getHeatingEnvelope } from './heatingProfile';
import {
  loadProfileFrame,
  loadProfileFrameAtTime,
} from './profileFrames';
import { TemperatureLegend } from './TemperatureLegend';
import { TokamakStage } from './TokamakStage';
import { hasWebGLSupport, WebGLFallback } from './WebGLFallback';

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
  const [webGLAvailable, setWebGLAvailable] = useState(hasWebGLSupport);
  const [cameraResetRevision, setCameraResetRevision] = useState(0);
  const [compact, setCompact] = useState(false);
  const [compactSelection, setCompactSelection] = useState<
    'candidate' | 'baseline'
  >('candidate');
  const handleViewportChange = useCallback(
    (viewport: { compact: boolean }) => setCompact(viewport.compact),
    [],
  );
  const handleContextLost = useCallback(() => setWebGLAvailable(false), []);
  const profile = loadProfileFrame(experiment, frameIndex);
  const heating = getHeatingEnvelope(experiment);
  const comparisonEnabled = Boolean(compare && experiment && baseline);
  const selectedTime =
    profile.status === 'ready' ? profile.value.frame.time_s : Number.NaN;
  const baselineProfile = comparisonEnabled
    ? loadProfileFrameAtTime(baseline, selectedTime)
    : loadProfileFrame(baseline, frameIndex);
  const baselineHeating = getHeatingEnvelope(baseline);
  const showSplitComparison = comparisonEnabled && !compact;
  const showCompactBaseline =
    comparisonEnabled && compact && compactSelection === 'baseline';
  const displayedProfile = showCompactBaseline ? baselineProfile : profile;
  const displayedHeating = showCompactBaseline ? baselineHeating : heating;
  const displayedExperiment = showCompactBaseline ? baseline : experiment;
  const label =
    displayedProfile.status === 'ready' && displayedExperiment
      ? `${displayedExperiment.label}, frame ${displayedProfile.value.index + 1} of ${displayedProfile.value.count}`
      : displayedExperiment?.label ?? 'No experiment selected';

  if (!webGLAvailable) {
    return (
      <WebGLFallback
        experiment={experiment}
        baseline={baseline}
        frameIndex={frameIndex}
        temperatureScale={temperatureScale}
        geometry={geometry}
        compare={compare}
        reducedMotion={reducedMotion}
        className={className}
      />
    );
  }

  return (
    <section
      aria-label={`Schematic plasma visualization: ${label}`}
      data-scene-mode={comparisonEnabled ? 'comparison' : 'single'}
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
        onContextLost={handleContextLost}
      >
        <Suspense fallback={null}>
          {showSplitComparison ? (
            <>
              <TokamakStage
                geometry={geometry}
                frame={
                  baselineProfile.status === 'ready'
                    ? baselineProfile.value.frame
                    : null
                }
                temperatureScale={temperatureScale}
                heating={baselineHeating}
                position={[-3.3, 0, 0]}
                scale={0.6}
              />
              <TokamakStage
                geometry={geometry}
                frame={profile.status === 'ready' ? profile.value.frame : null}
                temperatureScale={temperatureScale}
                heating={heating}
                position={[3.3, 0, 0]}
                scale={0.6}
              />
            </>
          ) : (
            <TokamakStage
              geometry={geometry}
              frame={
                displayedProfile.status === 'ready'
                  ? displayedProfile.value.frame
                  : null
              }
              temperatureScale={temperatureScale}
              heating={displayedHeating}
            />
          )}
          <SceneControls
            resetRevision={cameraResetRevision}
            reducedMotion={reducedMotion}
            comparison={showSplitComparison}
            focusRole={showSplitComparison ? null : displayedExperiment?.role}
            transitionKey={
              showSplitComparison
                ? `compare:${baseline?.id ?? 'none'}:${experiment?.id ?? 'none'}`
                : displayedExperiment?.id
            }
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
      {showSplitComparison ? (
        <div
          aria-label="Synchronized baseline and candidate"
          style={{
            position: 'absolute',
            top: 54,
            left: 16,
            right: 16,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            pointerEvents: 'none',
          }}
        >
          {[
            {
              title: 'Baseline',
              experiment: baseline,
              result: baselineProfile,
              heating: baselineHeating,
            },
            {
              title: 'Candidate',
              experiment,
              result: profile,
              heating,
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                justifySelf: 'center',
                minWidth: 136,
                padding: '7px 10px',
                borderTop: `1px solid ${
                  item.title === 'Baseline' ? '#45777b' : '#c89450'
                }`,
                background: 'rgba(3, 11, 13, 0.62)',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  color: item.title === 'Baseline' ? '#87b2b5' : '#ddb477',
                  fontSize: 9,
                  letterSpacing: '0.13em',
                  textTransform: 'uppercase',
                }}
              >
                {item.title}
              </div>
              <div
                style={{
                  marginTop: 3,
                  color: '#b8ced0',
                  fontSize: 10,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {item.experiment?.label ?? 'Unavailable'}
                {item.result.status === 'ready'
                  ? ` · t ${item.result.value.frame.time_s.toFixed(2)} s`
                  : ''}
                {item.heating
                  ? ` · ρ ${item.heating.locationRho.toFixed(2)}`
                  : ''}
              </div>
            </div>
          ))}
        </div>
      ) : null}
      {comparisonEnabled && compact ? (
        <div
          role="group"
          aria-label="Choose compact comparison view"
          style={{
            position: 'absolute',
            left: 16,
            top: 52,
            display: 'flex',
            padding: 2,
            border: '1px solid rgba(112, 166, 170, 0.24)',
            borderRadius: 4,
            background: 'rgba(3, 11, 13, 0.82)',
          }}
        >
          {(['baseline', 'candidate'] as const).map((selection) => (
            <button
              key={selection}
              type="button"
              onClick={() => setCompactSelection(selection)}
              aria-pressed={compactSelection === selection}
              style={{
                border: 0,
                borderRadius: 2,
                padding: '6px 9px',
                background:
                  compactSelection === selection
                    ? 'rgba(79, 139, 143, 0.24)'
                    : 'transparent',
                color:
                  compactSelection === selection ? '#c5e0e2' : '#6f9194',
                font: 'inherit',
                fontSize: 9,
                letterSpacing: '0.09em',
                textTransform: 'uppercase',
                cursor: 'pointer',
              }}
            >
              {selection}
            </button>
          ))}
        </div>
      ) : null}
      {displayedHeating && !showSplitComparison ? (
        <div
          style={{
            position: 'absolute',
            left: 16,
            top: comparisonEnabled && compact ? 92 : 38,
            paddingLeft: 8,
            borderLeft: '2px solid #d99b4f',
            color: '#c9aa78',
            fontSize: 10,
            letterSpacing: '0.045em',
            fontVariantNumeric: 'tabular-nums',
            pointerEvents: 'none',
          }}
        >
          CONFIGURED HEATING · ρ {displayedHeating.locationRho.toFixed(2)} · Δρ{' '}
          {displayedHeating.widthRho.toFixed(2)}
          <span style={{ color: '#6f8585' }}> · NOT A MEASURED FIELD</span>
        </div>
      ) : null}
      {displayedProfile.status === 'ready' ? (
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
      {displayedProfile.status !== 'ready' ? (
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
          {displayedProfile.reason}
        </div>
      ) : null}
      {displayedProfile.status === 'ready' ? (
        <TemperatureLegend scale={temperatureScale} compact={compact} />
      ) : null}
    </section>
  );
}

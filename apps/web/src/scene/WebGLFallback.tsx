import type {
  Experiment,
  PlasmaSceneProps,
  ProfileFrame,
} from '../../../../contracts/recording';
import { getHeatingEnvelope } from './heatingProfile';
import {
  loadProfileFrame,
  loadProfileFrameAtTime,
  type ProfileFrameLoadResult,
} from './profileFrames';

export function hasWebGLSupport() {
  if (
    typeof document === 'undefined' ||
    typeof WebGLRenderingContext === 'undefined'
  ) {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') || canvas.getContext('webgl'),
    );
  } catch {
    return false;
  }
}

function profilePoints(
  frame: ProfileFrame,
  values: number[],
  maximum: number,
) {
  const safeMaximum = maximum > 0 ? maximum : 1;
  return frame.rho
    .map((rho, index) => {
      const value = values[index] ?? 0;
      const x = 12 + rho * 276;
      const y = 76 - Math.min(1, Math.max(0, value / safeMaximum)) * 62;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function ProfileSummary({
  experiment,
  result,
  temperatureScale,
  heading,
}: {
  experiment: Experiment | null | undefined;
  result: ProfileFrameLoadResult;
  temperatureScale: [number, number];
  heading: string;
}) {
  const heating = getHeatingEnvelope(experiment);
  if (result.status !== 'ready' || !experiment) {
    const reason =
      result.status === 'ready' ? 'No experiment selected.' : result.reason;
    return (
      <article
        style={{
          padding: 18,
          border: '1px solid rgba(104, 156, 160, 0.18)',
          color: '#bd9e70',
        }}
      >
        <strong>{heading}</strong>
        <p>{reason}</p>
      </article>
    );
  }
  const frame = result.value.frame;
  const coreElectron = frame.electron_temperature_kev[0] ?? 0;
  const coreIon = frame.ion_temperature_kev[0] ?? 0;

  return (
    <article
      style={{
        minWidth: 0,
        padding: 16,
        border: '1px solid rgba(104, 156, 160, 0.18)',
        background: 'rgba(5, 18, 21, 0.68)',
      }}
    >
      <div
        style={{
          color: heading === 'Baseline' ? '#7daeb2' : '#d3a35f',
          fontSize: 10,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
        }}
      >
        {heading}
      </div>
      <h3 style={{ margin: '5px 0 2px', fontSize: 15, fontWeight: 500 }}>
        {experiment.label}
      </h3>
      <div style={{ color: '#78999c', fontSize: 11 }}>
        Stored frame {result.value.index + 1}/{result.value.count} · t{' '}
        {frame.time_s.toFixed(2)} s
      </div>
      <svg
        viewBox="0 0 300 88"
        role="img"
        aria-label="Recorded radial electron and ion temperature profiles"
        style={{ display: 'block', width: '100%', marginTop: 12 }}
      >
        <line x1="12" y1="76" x2="288" y2="76" stroke="#29464a" />
        <line x1="12" y1="14" x2="12" y2="76" stroke="#29464a" />
        <polyline
          points={profilePoints(
            frame,
            frame.electron_temperature_kev,
            temperatureScale[1],
          )}
          fill="none"
          stroke="#66c4c5"
          strokeWidth="2"
        />
        <polyline
          points={profilePoints(
            frame,
            frame.ion_temperature_kev,
            temperatureScale[1],
          )}
          fill="none"
          stroke="#e5a85d"
          strokeWidth="2"
        />
        <text x="14" y="11" fill="#698b8e" fontSize="8">
          {temperatureScale[1].toFixed(1)} keV
        </text>
        <text x="276" y="86" fill="#698b8e" fontSize="8">
          ρ 1
        </text>
      </svg>
      <dl
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '7px 12px',
          margin: '10px 0 0',
          fontSize: 11,
        }}
      >
        <div>
          <dt style={{ color: '#66888b' }}>Core Tₑ</dt>
          <dd style={{ margin: 0 }}>{coreElectron.toFixed(2)} keV</dd>
        </div>
        <div>
          <dt style={{ color: '#66888b' }}>Core Tᵢ</dt>
          <dd style={{ margin: 0 }}>{coreIon.toFixed(2)} keV</dd>
        </div>
        <div>
          <dt style={{ color: '#66888b' }}>Fusion power</dt>
          <dd style={{ margin: 0 }}>{frame.fusion_power_mw.toFixed(2)} MW</dd>
        </div>
        <div>
          <dt style={{ color: '#66888b' }}>Configured heating</dt>
          <dd style={{ margin: 0 }}>
            {heating
              ? `ρ ${heating.locationRho.toFixed(2)}, Δρ ${heating.widthRho.toFixed(2)}`
              : 'Unavailable'}
          </dd>
        </div>
      </dl>
    </article>
  );
}

export function WebGLFallback({
  experiment,
  baseline = null,
  frameIndex,
  temperatureScale,
  compare = false,
  className,
}: PlasmaSceneProps) {
  const candidateResult = loadProfileFrame(experiment, frameIndex);
  const selectedTime =
    candidateResult.status === 'ready'
      ? candidateResult.value.frame.time_s
      : Number.NaN;
  const baselineResult = loadProfileFrameAtTime(baseline, selectedTime);

  return (
    <section
      className={className}
      aria-label="Plasma profile fallback"
      style={{
        minHeight: 360,
        padding: 18,
        color: '#d7eef0',
        background:
          'radial-gradient(circle at 50% 20%, #0c2529 0%, #061316 55%, #03080a 100%)',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <div
        role="status"
        style={{
          marginBottom: 14,
          color: '#98b9bc',
          fontSize: 11,
          lineHeight: 1.5,
        }}
      >
        3D WebGL rendering is unavailable. Showing the recorded radial profiles
        without animation. This remains a schematic axisymmetric encoding.
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            compare && baseline
              ? 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))'
              : '1fr',
          gap: 12,
        }}
      >
        {compare && baseline ? (
          <ProfileSummary
            heading="Baseline"
            experiment={baseline}
            result={baselineResult}
            temperatureScale={temperatureScale}
          />
        ) : null}
        <ProfileSummary
          heading={compare && baseline ? 'Candidate' : 'Selected experiment'}
          experiment={experiment}
          result={candidateResult}
          temperatureScale={temperatureScale}
        />
      </div>
    </section>
  );
}

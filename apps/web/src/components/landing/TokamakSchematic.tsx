/**
 * Schematic poloidal cross-section of a tokamak.
 *
 * This is geometry only: nested flux-surface contours drawn from shape
 * parameters. It carries no simulation output and must always be labelled as a
 * schematic wherever it appears.
 */

const R0 = 6.2; // major radius, m
const A = 2.0; // minor radius, m
const KAPPA = 1.72; // elongation
const DELTA = 0.33; // triangularity
const SHIFT = 0.36; // outward displacement of inner surfaces, m

/** Closed contour for a normalised flux-surface label rho in [0, 1.2]. */
function surfacePath(rho: number, samples = 120): string {
  const points: string[] = [];
  for (let i = 0; i <= samples; i += 1) {
    const theta = (2 * Math.PI * i) / samples;
    const r = R0 + SHIFT * (1 - rho * rho) + A * rho * Math.cos(theta + DELTA * Math.sin(theta));
    const z = KAPPA * A * rho * Math.sin(theta);
    points.push(`${r.toFixed(3)},${(-z).toFixed(3)}`);
  }
  return `M${points.join(' L')} Z`;
}

const CONTOURS = [0.14, 0.28, 0.42, 0.56, 0.7, 0.84, 1];

/** Temperature-ramp colour token for a surface label. Core is hottest. */
function rampToken(rho: number): string {
  if (rho <= 0.2) return 'var(--t-4)';
  if (rho <= 0.4) return 'var(--t-3)';
  if (rho <= 0.62) return 'var(--t-2)';
  if (rho <= 0.85) return 'var(--t-1)';
  return 'var(--t-0)';
}

interface TokamakSchematicProps {
  className?: string;
}

export default function TokamakSchematic({ className }: TokamakSchematicProps) {
  const midZ = 0;

  return (
    <svg
      className={className}
      viewBox="3.2 -4.5 5.9 9"
      role="img"
      aria-label="Schematic poloidal cross-section of a tokamak showing nested flux surfaces and an illustrative heating deposition band."
    >
      <defs>
        <radialGradient id="aster-core" cx="52%" cy="50%" r="52%">
          <stop offset="0%" stopColor="var(--t-4)" stopOpacity="0.5" />
          <stop offset="38%" stopColor="var(--t-3)" stopOpacity="0.22" />
          <stop offset="72%" stopColor="var(--t-1)" stopOpacity="0.1" />
          <stop offset="100%" stopColor="var(--t-0)" stopOpacity="0" />
        </radialGradient>
        <clipPath id="aster-plasma-clip">
          <path d={surfacePath(1)} />
        </clipPath>
      </defs>

      {/* Vacuum vessel wall */}
      <g className="schematic__vessel">
        <path
          d={surfacePath(1.19)}
          fill="none"
          stroke="var(--line-strong)"
          strokeWidth="0.045"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={surfacePath(1.11)}
          fill="none"
          stroke="var(--line)"
          strokeWidth="0.02"
          vectorEffect="non-scaling-stroke"
        />
      </g>

      {/* Plasma volume wash */}
      <path d={surfacePath(1)} fill="url(#aster-core)" className="schematic__glow" />

      {/* Flux surfaces */}
      <g
        className="schematic__surfaces"
        fill="none"
        strokeWidth="0.018"
        vectorEffect="non-scaling-stroke"
      >
        {CONTOURS.map((rho) => (
          <path
            key={rho}
            d={surfacePath(rho)}
            stroke={rampToken(rho)}
            strokeOpacity={rho >= 1 ? 0.75 : 0.42}
          />
        ))}
      </g>

      {/* Illustrative heating deposition band */}
      <g className="schematic__band" clipPath="url(#aster-plasma-clip)">
        <path
          d={surfacePath(0.36)}
          fill="none"
          stroke="var(--heat)"
          strokeOpacity="0.85"
          strokeWidth="0.03"
          strokeDasharray="0.14 0.1"
          vectorEffect="non-scaling-stroke"
          className="schematic__deposition"
        />
      </g>

      {/* Magnetic axis */}
      <circle
        className="schematic__axis"
        cx={R0 + SHIFT}
        cy={midZ}
        r="0.045"
        fill="var(--t-4)"
        fillOpacity="0.9"
      />
    </svg>
  );
}

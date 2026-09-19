import type { ProfileFrame } from '../../types';
import { linePath, linearScale, niceDomain, plotArea, ticks } from './chartUtils';
import { formatNumber } from '../../lib/format';
import '../../styles/charts.css';

interface EnergyChartProps {
  frames: ProfileFrame[];
  baselineFrames: ProfileFrame[];
  frameIndex: number;
  label: string;
  baselineLabel?: string;
  units: string;
}

const W = 470;
const H = 250;

/** Cumulative fusion energy against simulation time, straight from stored frames. */
export default function EnergyChart({
  frames,
  baselineFrames,
  frameIndex,
  label,
  baselineLabel,
  units,
}: EnergyChartProps) {
  const plot = plotArea(W, H, { left: 50, right: 18, top: 18, bottom: 40 });

  if (frames.length === 0) {
    return (
      <figure className="chart">
        <figcaption className="chart__caption">
          <span className="label">Cumulative fusion energy</span>
        </figcaption>
        <p className="chart__empty">
          No stored frames for this experiment at this point in the run.
        </p>
      </figure>
    );
  }

  const timeDomain: [number, number] = [0, frames.at(-1)?.time_s ?? 1];
  const energyDomain = niceDomain([
    ...frames.map((frame) => frame.cumulative_fusion_energy_mj),
    ...baselineFrames.map((frame) => frame.cumulative_fusion_energy_mj),
  ]);

  const x = linearScale(timeDomain, [plot.margin.left, plot.margin.left + plot.innerWidth]);
  const y = linearScale(energyDomain, [plot.margin.top + plot.innerHeight, plot.margin.top]);

  const toPath = (source: ProfileFrame[]) =>
    linePath(source.map((frame) => [x(frame.time_s), y(frame.cumulative_fusion_energy_mj)]));

  const current = frames[Math.min(frameIndex, frames.length - 1)];

  return (
    <figure className="chart">
      <figcaption className="chart__caption">
        <span className="label">Cumulative fusion energy</span>
        <span className="chart__note">
          {formatNumber(current.cumulative_fusion_energy_mj, 2)} {units} at t ={' '}
          {formatNumber(current.time_s, 2)} s
        </span>
      </figcaption>

      <svg
        className="chart__svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Cumulative fusion energy in ${units} against simulation time in seconds.`}
      >
        {ticks(energyDomain, 4).map((value) => (
          <g key={value}>
            <line
              x1={plot.margin.left}
              x2={plot.margin.left + plot.innerWidth}
              y1={y(value)}
              y2={y(value)}
              className="chart__grid"
            />
            <text x={plot.margin.left - 8} y={y(value) + 3.5} className="chart__tick chart__tick--y">
              {formatNumber(value, 0)}
            </text>
          </g>
        ))}

        {baselineFrames.length > 0 ? (
          <path d={toPath(baselineFrames)} className="chart__line chart__line--reference" />
        ) : null}
        <path d={toPath(frames)} className="chart__line chart__line--ion" />

        {/* Playback position along simulation time */}
        <line
          x1={x(current.time_s)}
          x2={x(current.time_s)}
          y1={plot.margin.top}
          y2={plot.margin.top + plot.innerHeight}
          className="chart__band-centre"
        />
        <circle
          cx={x(current.time_s)}
          cy={y(current.cumulative_fusion_energy_mj)}
          r={3.4}
          className="chart__marker"
        />

        <line
          x1={plot.margin.left}
          x2={plot.margin.left + plot.innerWidth}
          y1={plot.margin.top + plot.innerHeight}
          y2={plot.margin.top + plot.innerHeight}
          className="chart__axis"
        />
        {ticks(timeDomain, 5).map((value) => (
          <text
            key={value}
            x={x(value)}
            y={plot.margin.top + plot.innerHeight + 16}
            className="chart__tick"
            textAnchor="middle"
          >
            {formatNumber(value, 1)}
          </text>
        ))}
        <text
          x={plot.margin.left + plot.innerWidth / 2}
          y={H - 6}
          className="chart__axis-label"
          textAnchor="middle"
        >
          simulation time — s
        </text>
        <text
          className="chart__axis-label"
          transform={`translate(12 ${plot.margin.top + plot.innerHeight / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          {units}
        </text>
      </svg>

      <ul className="chart__legend">
        <li className="chart__key chart__key--ion">{label}</li>
        {baselineFrames.length > 0 ? (
          <li className="chart__key chart__key--reference">{baselineLabel ?? 'baseline'}</li>
        ) : null}
      </ul>
    </figure>
  );
}

import type { Experiment, ProfileFrame } from '../../types';
import { linePath, linearScale, plotArea, ticks } from './chartUtils';
import { formatNumber } from '../../lib/format';
import '../../styles/charts.css';

interface ProfileChartProps {
  frame: ProfileFrame | null;
  baselineFrame: ProfileFrame | null;
  /** Fixed for the whole recording so a cooler candidate can never look hotter. */
  temperatureScaleKev: [number, number];
  /** Deposition radius and width, drawn as an applied-energy band. */
  config: Experiment['config'] | null;
  label: string;
  baselineLabel?: string;
}

const W = 470;
const H = 250;

export default function ProfileChart({
  frame,
  baselineFrame,
  temperatureScaleKev,
  config,
  label,
  baselineLabel,
}: ProfileChartProps) {
  const plot = plotArea(W, H, { left: 50, right: 18, top: 18, bottom: 40 });
  const x = linearScale([0, 1], [plot.margin.left, plot.margin.left + plot.innerWidth]);
  const y = linearScale(temperatureScaleKev, [
    plot.margin.top + plot.innerHeight,
    plot.margin.top,
  ]);

  const series = (values: number[] | undefined, rho: number[] | undefined) =>
    values && rho ? linePath(values.map((value, i) => [x(rho[i]), y(value)])) : '';

  const bandStart = config ? x(Math.max(0, config.heating_location - config.heating_width)) : 0;
  const bandEnd = config ? x(Math.min(1, config.heating_location + config.heating_width)) : 0;

  return (
    <figure className="chart">
      <figcaption className="chart__caption">
        <span className="label">Radial temperature profile</span>
        <span className="chart__note">
          {frame ? `simulation t = ${formatNumber(frame.time_s, 2)} s` : 'no frame available'}
        </span>
      </figcaption>

      <svg className="chart__svg" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Ion and electron temperature against normalised radius, in kiloelectronvolts${
          frame ? `, at simulation time ${frame.time_s} seconds` : ''
        }.`}
      >
        {/* Horizontal gridlines with keV labels */}
        {ticks(temperatureScaleKev, 4).map((value) => (
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

        {/* Applied heating deposition, from the recorded configuration */}
        {config ? (
          <>
            <rect
              x={bandStart}
              y={plot.margin.top}
              width={Math.max(0, bandEnd - bandStart)}
              height={plot.innerHeight}
              className="chart__band"
            />
            <line
              x1={x(config.heating_location)}
              x2={x(config.heating_location)}
              y1={plot.margin.top}
              y2={plot.margin.top + plot.innerHeight}
              className="chart__band-centre"
            />
          </>
        ) : null}

        {/* Baseline reference, drawn first so the selection sits on top */}
        {baselineFrame ? (
          <path
            d={series(baselineFrame.ion_temperature_kev, baselineFrame.rho)}
            className="chart__line chart__line--reference"
          />
        ) : null}

        {frame ? (
          <>
            <path
              d={series(frame.electron_temperature_kev, frame.rho)}
              className="chart__line chart__line--electron"
            />
            <path
              d={series(frame.ion_temperature_kev, frame.rho)}
              className="chart__line chart__line--ion"
            />
          </>
        ) : null}

        {/* Axes */}
        <line
          x1={plot.margin.left}
          x2={plot.margin.left + plot.innerWidth}
          y1={plot.margin.top + plot.innerHeight}
          y2={plot.margin.top + plot.innerHeight}
          className="chart__axis"
        />
        {ticks([0, 1], 4).map((value) => (
          <text
            key={value}
            x={x(value)}
            y={plot.margin.top + plot.innerHeight + 16}
            className="chart__tick"
            textAnchor="middle"
          >
            {formatNumber(value, 2)}
          </text>
        ))}
        <text
          x={plot.margin.left + plot.innerWidth / 2}
          y={H - 6}
          className="chart__axis-label"
          textAnchor="middle"
        >
          ρ — normalised radius
        </text>
        <text
          className="chart__axis-label"
          transform={`translate(12 ${plot.margin.top + plot.innerHeight / 2}) rotate(-90)`}
          textAnchor="middle"
        >
          keV
        </text>
      </svg>

      <ul className="chart__legend">
        <li className="chart__key chart__key--ion">Ion temperature · {label}</li>
        <li className="chart__key chart__key--electron">Electron temperature · {label}</li>
        {baselineFrame ? (
          <li className="chart__key chart__key--reference">Ion temperature · {baselineLabel ?? 'baseline'}</li>
        ) : null}
        {config ? <li className="chart__key chart__key--band">Heating deposition</li> : null}
      </ul>
    </figure>
  );
}

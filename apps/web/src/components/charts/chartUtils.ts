/**
 * Minimal helpers for hand-drawn SVG charts.
 *
 * No charting library: these plots show a handful of recorded series and the
 * axes must state their units explicitly, which is easier to guarantee here
 * than to configure elsewhere.
 */

export interface Plot {
  width: number;
  height: number;
  margin: { top: number; right: number; bottom: number; left: number };
  innerWidth: number;
  innerHeight: number;
}

export function plotArea(
  width: number,
  height: number,
  margin: Partial<Plot['margin']> = {},
): Plot {
  const resolved = { top: 16, right: 16, bottom: 34, left: 46, ...margin };
  return {
    width,
    height,
    margin: resolved,
    innerWidth: width - resolved.left - resolved.right,
    innerHeight: height - resolved.top - resolved.bottom,
  };
}

export type Scale = (value: number) => number;

export function linearScale(domain: [number, number], range: [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  if (span === 0) return () => r0;
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
}

/** Evenly spaced tick values across a domain, inclusive of both ends. */
export function ticks(domain: [number, number], count: number): number[] {
  const [d0, d1] = domain;
  return Array.from({ length: count + 1 }, (_, i) => d0 + ((d1 - d0) * i) / count);
}

export function linePath(points: readonly [number, number][]): string {
  if (points.length === 0) return '';
  return points
    .map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(' ');
}

/** Domain padded to a round-ish span so axis labels do not read as noise. */
export function niceDomain(values: readonly number[], floorAtZero = true): [number, number] {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return [0, 1];
  const min = floorAtZero ? Math.min(0, ...finite) : Math.min(...finite);
  const max = Math.max(...finite);
  if (max === min) return [min, min + 1];
  const pad = (max - min) * 0.08;
  return [floorAtZero ? min : min - pad, max + pad];
}

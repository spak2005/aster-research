import { Color } from 'three';

export interface TemperatureColorStop {
  at: number;
  color: string;
}

export const TEMPERATURE_COLOR_STOPS: readonly TemperatureColorStop[] = [
  { at: 0, color: '#092a2f' },
  { at: 0.2, color: '#10555b' },
  { at: 0.4, color: '#2f9699' },
  { at: 0.58, color: '#9dc1a6' },
  { at: 0.75, color: '#dca45e' },
  { at: 0.9, color: '#ee7544' },
  { at: 1, color: '#ffe2ad' },
] as const;

export function normalizeTemperature(
  temperatureKev: number,
  [minimum, maximum]: [number, number],
) {
  const span = maximum - minimum;
  if (!Number.isFinite(temperatureKev) || !Number.isFinite(span) || span <= 0) {
    return 0;
  }
  return Math.min(1, Math.max(0, (temperatureKev - minimum) / span));
}

export function temperatureColor(
  temperatureKev: number,
  scale: [number, number],
) {
  const normalized = normalizeTemperature(temperatureKev, scale);
  const upperIndex = TEMPERATURE_COLOR_STOPS.findIndex(
    (stop) => stop.at >= normalized,
  );
  if (upperIndex <= 0) {
    return new Color(TEMPERATURE_COLOR_STOPS[0]?.color ?? '#092a2f');
  }

  const lower = TEMPERATURE_COLOR_STOPS[upperIndex - 1];
  const upper = TEMPERATURE_COLOR_STOPS[upperIndex];
  if (!lower || !upper) return new Color('#ffe2ad');
  const localSpan = upper.at - lower.at;
  const mix = localSpan > 0 ? (normalized - lower.at) / localSpan : 0;
  return new Color(lower.color).lerp(new Color(upper.color), mix);
}

export function temperatureGradientCss() {
  return `linear-gradient(90deg, ${TEMPERATURE_COLOR_STOPS.map(
    (stop) => `${stop.color} ${stop.at * 100}%`,
  ).join(', ')})`;
}

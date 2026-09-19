import type { Experiment } from '../../../../contracts/recording';

export interface HeatingEnvelope {
  locationRho: number;
  widthRho: number;
  innerRho: number;
  outerRho: number;
}

/**
 * Converts recorded heating controls to normalized minor-radius coordinates.
 * The returned envelope is configuration, not a measured heating field.
 */
export function getHeatingEnvelope(
  experiment: Experiment | null | undefined,
): HeatingEnvelope | null {
  if (!experiment) return null;
  const locationRho = experiment.config.heating_location;
  const widthRho = experiment.config.heating_width;
  if (
    !Number.isFinite(locationRho) ||
    !Number.isFinite(widthRho) ||
    locationRho < 0 ||
    locationRho > 1 ||
    widthRho <= 0 ||
    widthRho > 1
  ) {
    return null;
  }

  return {
    locationRho,
    widthRho,
    innerRho: Math.max(0, locationRho - widthRho / 2),
    outerRho: Math.min(1, locationRho + widthRho / 2),
  };
}

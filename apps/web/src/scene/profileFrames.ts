import type {
  Experiment,
  ProfileFrame,
} from '../../../../contracts/recording';

export interface LoadedProfileFrame {
  frame: ProfileFrame;
  index: number;
  count: number;
}

export type ProfileFrameLoadResult =
  | { status: 'ready'; value: LoadedProfileFrame }
  | { status: 'empty'; reason: string }
  | { status: 'invalid'; reason: string };

function isFiniteNonNegative(value: number) {
  return Number.isFinite(value) && value >= 0;
}

function validateFrame(frame: ProfileFrame): string | null {
  const sampleCount = frame.rho.length;
  if (sampleCount < 2) return 'Profile frame has fewer than two radial samples.';
  if (
    frame.electron_temperature_kev.length !== sampleCount ||
    frame.ion_temperature_kev.length !== sampleCount
  ) {
    return 'Profile frame radial and temperature arrays have different lengths.';
  }
  if (
    !isFiniteNonNegative(frame.time_s) ||
    !isFiniteNonNegative(frame.fusion_power_mw) ||
    !isFiniteNonNegative(frame.cumulative_fusion_energy_mj) ||
    !isFiniteNonNegative(frame.cumulative_heating_energy_mj)
  ) {
    return 'Profile frame contains a non-finite or negative recorded scalar.';
  }

  for (let index = 0; index < sampleCount; index += 1) {
    const rho = frame.rho[index];
    const electronTemperature = frame.electron_temperature_kev[index];
    const ionTemperature = frame.ion_temperature_kev[index];
    if (
      rho === undefined ||
      electronTemperature === undefined ||
      ionTemperature === undefined ||
      !Number.isFinite(rho) ||
      rho < 0 ||
      rho > 1 ||
      !isFiniteNonNegative(electronTemperature) ||
      !isFiniteNonNegative(ionTemperature)
    ) {
      return `Profile frame has an invalid sample at radial index ${index}.`;
    }
    if (index > 0 && rho < (frame.rho[index - 1] ?? rho)) {
      return 'Profile frame rho coordinates are not monotonic.';
    }
  }
  return null;
}

/**
 * Selects a recorded profile frame without interpolation.
 * Fractional and out-of-range indices clamp to the nearest stored boundary.
 */
export function loadProfileFrame(
  experiment: Experiment | null | undefined,
  requestedIndex: number,
): ProfileFrameLoadResult {
  if (!experiment) {
    return { status: 'empty', reason: 'No experiment selected.' };
  }
  if (experiment.frames.length === 0) {
    return {
      status: 'empty',
      reason: `${experiment.label} has no recorded profile frames.`,
    };
  }

  const finiteIndex = Number.isFinite(requestedIndex) ? requestedIndex : 0;
  const index = Math.min(
    experiment.frames.length - 1,
    Math.max(0, Math.round(finiteIndex)),
  );
  const frame = experiment.frames[index];
  if (!frame) {
    return { status: 'empty', reason: 'Requested profile frame is unavailable.' };
  }

  const validationError = validateFrame(frame);
  if (validationError) {
    return { status: 'invalid', reason: validationError };
  }
  return {
    status: 'ready',
    value: { frame, index, count: experiment.frames.length },
  };
}

/**
 * Selects the stored frame nearest a physical simulation time.
 * No profile values are interpolated.
 */
export function loadProfileFrameAtTime(
  experiment: Experiment | null | undefined,
  timeS: number,
): ProfileFrameLoadResult {
  if (!experiment || experiment.frames.length === 0) {
    return loadProfileFrame(experiment, 0);
  }
  if (!Number.isFinite(timeS)) return loadProfileFrame(experiment, 0);

  let nearestIndex = 0;
  let nearestDistance = Number.POSITIVE_INFINITY;
  experiment.frames.forEach((frame, index) => {
    const distance = Math.abs(frame.time_s - timeS);
    if (distance < nearestDistance) {
      nearestIndex = index;
      nearestDistance = distance;
    }
  });
  return loadProfileFrame(experiment, nearestIndex);
}

import type { Experiment, ProfileFrame } from '../types';

function sameGrid(a: Experiment, b: Experiment): boolean {
  const radialA = a.config.n_rho ?? a.frames[0]?.rho.length;
  const radialB = b.config.n_rho ?? b.frames[0]?.rho.length;
  return radialA !== undefined && radialA === radialB &&
    ['chi_timestep_prefactor', 'max_dt_s', 'duration_s', 'heating_power_mw']
      .every(key => a.config[key] === b.config[key]);
}

/** Pass only evidence already visible at the selected event. */
export function matchedBaseline(experiment: Experiment | null, visible: Experiment[], originalId: string): Experiment | null {
  if (!experiment || experiment.status !== 'completed') return null;
  return visible.find(candidate => candidate.status === 'completed' &&
    (candidate.id === originalId || candidate.label === 'baseline_refined') && sameGrid(experiment, candidate)) ?? null;
}

/** A derived display percentage, never a scientific verdict. */
export function matchedGain(experiment: Experiment | null, baseline: Experiment | null): number | null {
  if (!experiment || !baseline || experiment.id === baseline.id || !sameGrid(experiment, baseline)) return null;
  const reference = baseline.metrics.fusion_energy_mj;
  const outcome = experiment.metrics.fusion_energy_mj;
  return Number.isFinite(reference) && reference > 0 && Number.isFinite(outcome)
    ? (outcome - reference) / reference * 100 : null;
}

export function nearestFrame(frames: ProfileFrame[], time: number): ProfileFrame | null {
  return frames.reduce<ProfileFrame | null>((best, frame) =>
    best === null || Math.abs(frame.time_s - time) < Math.abs(best.time_s - time) ? frame : best, null);
}

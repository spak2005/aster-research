/**
 * The bounded configuration a visitor may submit.
 *
 * Only two settings are open: how many experiments the run may spend, and the
 * seed. Everything else belongs to the preset and is fixed before the run
 * starts, which is what makes the result interpretable. These bounds mirror the
 * server's; the server validates again regardless.
 */
import { MAX_EXPERIMENTS, MIN_EXPERIMENTS, type CreateRunRequest } from './api';

export const SUPPORTED_QUESTION =
  'At fixed total heating energy, can the system find a heating profile that improves integrated simulated fusion energy, and does that improvement survive stricter checks?';

export const SUPPORTED_PRESET = 'fixed-energy' as const;

export interface RunConfig {
  question: string;
  preset: typeof SUPPORTED_PRESET;
  max_experiments: number;
  seed: number;
}

export const SEED_MAX = 2_147_483_647;

export function randomSeed(): number {
  return Math.floor(Math.random() * SEED_MAX);
}

export const DEFAULT_CONFIG: RunConfig = {
  question: SUPPORTED_QUESTION,
  preset: SUPPORTED_PRESET,
  max_experiments: 9,
  seed: 20260919,
};

export function clampConfig(config: RunConfig): RunConfig {
  const experiments = Number.isFinite(config.max_experiments)
    ? Math.round(config.max_experiments)
    : DEFAULT_CONFIG.max_experiments;
  const seed = Number.isFinite(config.seed) ? Math.round(config.seed) : DEFAULT_CONFIG.seed;
  return {
    question: SUPPORTED_QUESTION,
    preset: SUPPORTED_PRESET,
    max_experiments: Math.min(Math.max(experiments, MIN_EXPERIMENTS), MAX_EXPERIMENTS),
    seed: Math.min(Math.max(seed, 0), SEED_MAX),
  };
}

/**
 * Exactly the body the local API accepts, so the downloaded file can be posted
 * verbatim with curl. No commentary fields are added to it.
 */
export function toRequestBody(config: RunConfig): CreateRunRequest {
  const safe = clampConfig(config);
  return {
    question: safe.question,
    preset: safe.preset,
    max_experiments: safe.max_experiments,
    seed: safe.seed,
  };
}

export function configFilename(config: RunConfig): string {
  return `aster-${config.preset}-${config.max_experiments}x-seed-${config.seed}.json`;
}

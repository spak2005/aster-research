/**
 * Vocabulary for recorded states.
 *
 * Wording matters here: a hypothesis is "supported", never "proven"; a check
 * that did not run is "pending", not "passed"; an experiment that crashed is
 * "failed", which is a first-class outcome rather than an absence of one.
 */
import type { Experiment, Verdict } from '../types';

export type Tone = 'signal' | 'adverse' | 'neutral' | 'faint';

export interface StatusMeta {
  label: string;
  tone: Tone;
  description: string;
}

export const VERDICT_META: Record<Verdict, StatusMeta> = {
  proposed: {
    label: 'Proposed',
    tone: 'faint',
    description: 'Stated with a prediction. No experiment has run against it yet.',
  },
  running: {
    label: 'Running',
    tone: 'neutral',
    description: 'Work is underway; no outcome has been recorded at this point in the run.',
  },
  supported: {
    label: 'Supported',
    tone: 'signal',
    description: 'The recorded evidence is consistent with the prediction and survived its checks.',
  },
  refuted: {
    label: 'Refuted',
    tone: 'adverse',
    description: 'The evidence contradicted the prediction, or the claim failed a declared check.',
  },
  inconclusive: {
    label: 'Inconclusive',
    tone: 'neutral',
    description: 'No usable evidence either way, so nothing is claimed.',
  },
  abandoned: {
    label: 'Abandoned',
    tone: 'faint',
    description: 'Dropped without resolution — rejected before execution or left outside budget.',
  },
};

export type CheckStatus = Experiment['checks'][number]['status'];

export const CHECK_META: Record<CheckStatus, StatusMeta> = {
  passed: { label: 'Passed', tone: 'signal', description: 'Criterion met.' },
  failed: { label: 'Failed', tone: 'adverse', description: 'Criterion not met.' },
  pending: { label: 'Pending', tone: 'faint', description: 'Not evaluated at this point in the run.' },
  inconclusive: {
    label: 'Inconclusive',
    tone: 'neutral',
    description: 'Evaluated without a decisive result.',
  },
};

export const ROLE_LABEL: Record<Experiment['role'], string> = {
  baseline: 'Baseline',
  candidate: 'Candidate',
  verification: 'Verification',
  control: 'Control',
};

export const EXPERIMENT_STATUS_META: Record<Experiment['status'], StatusMeta> = {
  running: { label: 'Running', tone: 'neutral', description: 'Executing; no result recorded yet.' },
  completed: {
    label: 'Completed',
    tone: 'signal',
    description: 'Reached the requested horizon and produced outputs.',
  },
  failed: {
    label: 'Failed',
    tone: 'adverse',
    description: 'Did not produce a usable result. No objective value exists for it.',
  },
};

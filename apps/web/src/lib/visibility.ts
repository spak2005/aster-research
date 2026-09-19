/**
 * Sequence-gated view of a recording.
 *
 * Playback must never leak the future. A summary shown at sequence S may use
 * only the evidence that existed at S: an experiment's metrics appear with its
 * completion event, a hypothesis keeps its provisional status until the event
 * that resolved it, and the conclusion does not exist until it was recorded.
 *
 * Everything here is derived from the event log. Nothing is computed, ranked or
 * inferred on the renderer's behalf — where the harness did not record a value,
 * this module reports its absence instead of supplying one.
 */
import type { Experiment, Hypothesis, Recording, ResearchEvent, Verdict } from '../types';

export interface VisibleExperiment {
  id: string;
  label: string;
  role: Experiment['role'];
  hypothesisId: string;
  /** Known from the request event onwards: the agent chose it before running it. */
  config: Experiment['config'];
  status: Experiment['status'];
  /** Sequence at which this experiment first appears in the log. */
  introSequence: number;
  /** Sequence at which its outcome became known, or null if still running here. */
  completedSequence: number | null;
  /** Full record including metrics, frames and artifacts. Null until resolved. */
  result: Experiment | null;
  /** Verification checks, revealed with the event that produced them. */
  checks: Experiment['checks'];
}

export interface VisibleHypothesis {
  id: string;
  parentId: string | null;
  title: string;
  prediction: string;
  /** Provisional until the resolving event is reached. */
  status: Verdict;
  /** True once the recorded verdict is legitimately visible. */
  statusResolved: boolean;
  /** Empty until resolved: an assessment written later is not evidence now. */
  assessment: string;
  experimentIds: string[];
  evidenceIds: string[];
  createdSequence: number;
}

export interface Chapter {
  sequence: number;
  title: string;
  type: ResearchEvent['type'];
}

export interface VisibleState {
  sequence: number;
  minSequence: number;
  maxSequence: number;
  events: ResearchEvent[];
  latestEvent: ResearchEvent | null;
  hypotheses: VisibleHypothesis[];
  experiments: VisibleExperiment[];
  experimentById: Map<string, VisibleExperiment>;
  /** Null until the conclusion event has been reached. */
  conclusion: Recording['conclusion'] | null;
  /** Null until the conclusion is visible: a leader is a claim about the future. */
  bestExperimentId: string | null;
  completedExperiments: number;
  /** Research wall-clock from the first event to the current one, in seconds. */
  elapsedWallTimeS: number | null;
}

const RESOLVING_TYPES: ReadonlySet<ResearchEvent['type']> = new Set([
  'experiment.completed',
  'experiment.failed',
  'verification.completed',
]);

const INTRODUCING_TYPES: ReadonlySet<ResearchEvent['type']> = new Set([
  'experiment.requested',
  'experiment.started',
  'verification.requested',
]);

const CHAPTER_TYPES: ReadonlySet<ResearchEvent['type']> = new Set([
  'run.started',
  'branch.created',
  'experiment.completed',
  'experiment.failed',
  'verification.completed',
  'conclusion.recorded',
  'run.completed',
  'run.failed',
  'run.canceled',
]);

interface EventIndex {
  introSequence: Map<string, number>;
  resolveSequence: Map<string, number>;
  /** Sequence at which each experiment's checks became available. */
  checkSequence: Map<string, number>;
  conclusionSequence: number | null;
  resolvedHypothesis: Map<string, number>;
}

/** Events that end a run without a separately recorded conclusion. */
const TERMINAL_TYPES = new Set<ResearchEvent['type']>([
  'run.completed',
  'run.failed',
  'run.canceled',
]);

function indexEvents(recording: Recording): EventIndex {
  const introSequence = new Map<string, number>();
  const resolveSequence = new Map<string, number>();
  const checkSequence = new Map<string, number>();
  const resolvedHypothesis = new Map<string, number>();
  let conclusionSequence: number | null = null;
  let terminalSequence: number | null = null;

  for (const event of recording.events) {
    const experimentId = event.experiment_id;
    if (experimentId) {
      if (INTRODUCING_TYPES.has(event.type) && !introSequence.has(experimentId)) {
        introSequence.set(experimentId, event.sequence);
      }
      if (RESOLVING_TYPES.has(event.type) && !resolveSequence.has(experimentId)) {
        resolveSequence.set(experimentId, event.sequence);
        if (!introSequence.has(experimentId)) introSequence.set(experimentId, event.sequence);
      }
      if (event.type === 'verification.completed' && !checkSequence.has(experimentId)) {
        checkSequence.set(experimentId, event.sequence);
      }
    }
    if (event.type === 'conclusion.recorded' && conclusionSequence === null) {
      conclusionSequence = event.sequence;
    }
    // A run that was canceled or failed still records what it ended with, and
    // withholding that would misrepresent the run as unfinished rather than
    // stopped. The terminating event is when that outcome became known.
    if (TERMINAL_TYPES.has(event.type) && conclusionSequence === null) {
      terminalSequence = event.sequence;
    }
  }

  if (conclusionSequence === null) conclusionSequence = terminalSequence;

  // Hypothesis resolution comes from the recorded field; the event log is only
  // consulted when the field is absent.
  for (const hypothesis of recording.hypotheses) {
    if (typeof hypothesis.resolved_sequence === 'number') {
      resolvedHypothesis.set(hypothesis.id, hypothesis.resolved_sequence);
    }
  }

  return { introSequence, resolveSequence, checkSequence, conclusionSequence, resolvedHypothesis };
}

/** Status of an unresolved hypothesis: running once work has started under it. */
function provisionalStatus(hypothesis: Hypothesis, experiments: VisibleExperiment[]): Verdict {
  const started = experiments.some((experiment) => experiment.hypothesisId === hypothesis.id);
  return started ? 'running' : 'proposed';
}

export function sequenceBounds(recording: Recording): { min: number; max: number } {
  if (recording.events.length === 0) return { min: 0, max: 0 };
  const sequences = recording.events.map((event) => event.sequence);
  return { min: Math.min(...sequences), max: Math.max(...sequences) };
}

export function getVisibleState(recording: Recording, sequence: number): VisibleState {
  const { min, max } = sequenceBounds(recording);
  const clamped = Number.isFinite(sequence) ? Math.min(Math.max(sequence, min), max) : min;
  const index = indexEvents(recording);
  const events = recording.events.filter((event) => event.sequence <= clamped);
  const latestEvent = events.length > 0 ? events[events.length - 1] : null;

  const experiments: VisibleExperiment[] = [];
  for (const experiment of recording.experiments) {
    // Without an introducing event there is no evidence that this experiment
    // existed at the selected point in the investigation.
    const intro = index.introSequence.get(experiment.id);
    if (intro === undefined || intro > clamped) continue;

    const resolved = index.resolveSequence.get(experiment.id) ?? null;
    const isResolved = resolved !== null && resolved <= clamped;
    // Aggregate checks have no individual timestamps in v1. Hold them until
    // explicit verification or a terminal event instead of leaking later checks.
    const terminal = events.some(event => ['run.completed','run.failed','run.canceled'].includes(event.type));
    const checksAt = index.checkSequence.get(experiment.id);
    const checksVisible = isResolved && (terminal || (checksAt !== undefined && checksAt <= clamped));

    experiments.push({
      id: experiment.id,
      label: experiment.label,
      role: experiment.role,
      hypothesisId: experiment.hypothesis_id,
      config: experiment.config,
      status: isResolved ? experiment.status : 'running',
      introSequence: intro,
      completedSequence: isResolved ? resolved : null,
      result: isResolved ? { ...experiment, checks: checksVisible ? experiment.checks : [] } : null,
      checks: checksVisible ? experiment.checks : [],
    });
  }

  const knownExperimentIds = new Set(experiments.map(experiment => experiment.id));
  const knownEvidenceIds = new Set(events.flatMap(event => event.evidence_ids));
  const hypotheses: VisibleHypothesis[] = [];
  for (const hypothesis of recording.hypotheses) {
    if (hypothesis.created_sequence > clamped) continue;
    const resolvedAt = index.resolvedHypothesis.get(hypothesis.id);
    const statusResolved = resolvedAt !== undefined && resolvedAt <= clamped;
    hypotheses.push({
      id: hypothesis.id,
      parentId: hypothesis.parent_id,
      title: hypothesis.title,
      prediction: hypothesis.prediction,
      status: statusResolved ? hypothesis.status : provisionalStatus(hypothesis, experiments),
      statusResolved,
      assessment: statusResolved ? hypothesis.assessment : '',
      experimentIds: hypothesis.experiment_ids.filter(id => knownExperimentIds.has(id)),
      evidenceIds: hypothesis.evidence_ids.filter(id => knownEvidenceIds.has(id)),
      createdSequence: hypothesis.created_sequence,
    });
  }

  const conclusionVisible =
    index.conclusionSequence !== null && index.conclusionSequence <= clamped;

  const firstTimestamp = recording.events[0]?.timestamp;
  const elapsedWallTimeS =
    firstTimestamp && latestEvent
      ? (Date.parse(latestEvent.timestamp) - Date.parse(firstTimestamp)) / 1000
      : null;

  return {
    sequence: clamped,
    minSequence: min,
    maxSequence: max,
    events,
    latestEvent,
    hypotheses,
    experiments,
    experimentById: new Map(experiments.map((experiment) => [experiment.id, experiment])),
    conclusion: conclusionVisible ? recording.conclusion : null,
    bestExperimentId: conclusionVisible ? recording.best_experiment_id : null,
    completedExperiments: experiments.filter((experiment) => experiment.result !== null).length,
    elapsedWallTimeS: Number.isFinite(elapsedWallTimeS) ? elapsedWallTimeS : null,
  };
}

/** Navigable points in the run, used by chapter jumps in the transport. */
export function getChapters(recording: Recording): Chapter[] {
  return recording.events
    .filter((event) => CHAPTER_TYPES.has(event.type))
    .map((event) => ({ sequence: event.sequence, title: event.title, type: event.type }));
}

/**
 * The experiment a viewer would reasonably be looking at, given the position in
 * the run: the most recently resolved one, otherwise the most recently started.
 */
export function defaultExperimentId(state: VisibleState): string | null {
  const resolved = state.experiments
    .filter((experiment) => experiment.completedSequence !== null)
    .sort((a, b) => (b.completedSequence ?? 0) - (a.completedSequence ?? 0));
  if (resolved.length > 0) return resolved[0].id;
  const introduced = [...state.experiments].sort((a, b) => b.introSequence - a.introSequence);
  return introduced[0]?.id ?? null;
}

/**
 * Sequence at which a node first has something honest to show: an experiment's
 * outcome event, or the moment a hypothesis was proposed. Selecting a node in
 * the tree advances playback to this point rather than revealing it early.
 */
export function revealSequence(recording: Recording, nodeId: string): number | null {
  const hypothesis = recording.hypotheses.find((candidate) => candidate.id === nodeId);
  if (hypothesis) return hypothesis.created_sequence;
  if (!recording.experiments.some((experiment) => experiment.id === nodeId)) return null;
  const index = indexEvents(recording);
  return index.resolveSequence.get(nodeId) ?? index.introSequence.get(nodeId) ?? null;
}

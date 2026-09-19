import type {
  Experiment,
  Hypothesis,
  Recording,
  ResearchEvent,
  Verdict,
} from '../../../../contracts/recording';
import {
  createReplayTimeline,
  getSequenceAtProgress,
} from './timeline';

export {
  REPLAY_SPEEDS,
  useReplayPlayback,
  type ReplayPlaybackController,
  type ReplayPlaybackOptions,
  type ReplaySpeed,
} from './useReplayPlayback';
export {
  createReplayTimeline,
  getProgressAtSequence,
  getSequenceAtProgress,
  type ReplayTimeline,
  type ReplayTimelinePoint,
} from './timeline';
export {
  createReplayChapters,
  getChapterAtSequence,
  getNextChapter,
  getPreviousChapter,
  getVisibleChapters,
  type ReplayChapter,
  type ReplayChapterKind,
} from './chapters';
export {
  isRecording,
  loadRecording,
  RecordingLoadError,
  useRecording,
  type LoadRecordingOptions,
  type RecordingLoadErrorCode,
  type RecordingLoadState,
} from './recordingLoader';

export type ReplayRunStatus = 'pending' | Recording['status'];
export type VisibleExperimentStatus =
  | 'requested'
  | 'running'
  | 'completed'
  | 'failed';

/** Experiment data that is safe to display at a replay sequence. */
export interface VisibleExperiment {
  id: string;
  hypothesisId: string;
  label: string;
  role: Experiment['role'];
  status: VisibleExperimentStatus;
  config: Experiment['config'];
  metrics: Experiment['metrics'] | null;
  frames: Experiment['frames'];
  artifacts: Experiment['artifacts'];
  checks: Experiment['checks'];
  wallTimeS: number | null;
  error?: string;
  resultVisible: boolean;
}

/** Hypothesis snapshot reconstructed only from events visible at the cursor. */
export interface VisibleHypothesis {
  id: string;
  parentId: string | null;
  title: string;
  prediction: string;
  status: Verdict;
  assessment: string;
  experimentIds: string[];
  evidenceIds: string[];
  createdSequence: number;
  resolvedSequence?: number;
}

export interface VisibleConclusion {
  status: Verdict;
  title: string;
  summary: string;
  evidenceIds: string[];
}

/**
 * Complete replay snapshot returned by getVisibleState.
 * It intentionally omits the source Recording so callers cannot accidentally
 * read aggregate future results from it.
 */
export interface VisibleReplayState {
  sequence: number;
  runStatus: ReplayRunStatus;
  events: ResearchEvent[];
  hypotheses: VisibleHypothesis[];
  experiments: VisibleExperiment[];
  activeExperiment: VisibleExperiment | null;
  conclusion: VisibleConclusion | null;
  budget: {
    maxExperiments: number;
    completedExperiments: number;
    wallTimeS: number;
  };
}

export interface SceneReplaySelection {
  experiment: Experiment | null;
  baseline: Experiment | null;
  frameIndex: number;
  compare: boolean;
  selectedExperimentId: string | null;
  status: 'ready' | 'pending' | 'empty';
}

const TERMINAL_EVENT_STATUS: Partial<
  Record<ResearchEvent['type'], Recording['status']>
> = {
  'run.completed': 'completed',
  'run.failed': 'failed',
  'run.canceled': 'canceled',
};

const VERDICTS = new Set<Verdict>([
  'proposed',
  'running',
  'supported',
  'refuted',
  'inconclusive',
  'abandoned',
]);

function normalizeSequence(sequence: number) {
  return Number.isFinite(sequence) ? Math.max(0, Math.floor(sequence)) : 0;
}

function visibleEvents(recording: Recording, sequence: number) {
  return recording.events
    .filter(
      (event) =>
        event.run_id === recording.id &&
        Number.isFinite(event.sequence) &&
        event.sequence <= sequence,
    )
    .slice()
    .sort(
      (left, right) =>
        left.sequence - right.sequence ||
        left.event_id.localeCompare(right.event_id),
    );
}

function isVerdict(value: unknown): value is Verdict {
  return typeof value === 'string' && VERDICTS.has(value as Verdict);
}

function findLastMatching<T>(
  items: T[],
  predicate: (item: T) => boolean,
): T | undefined {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const item = items[index];
    if (item !== undefined && predicate(item)) return item;
  }
  return undefined;
}

function latestEventForExperiment(
  events: ResearchEvent[],
  experimentId: string,
) {
  return findLastMatching(
    events,
    (event) => event.experiment_id === experimentId,
  );
}

function resultIsVisible(events: ResearchEvent[], experimentId: string) {
  return events.some(
    (event) =>
      event.experiment_id === experimentId &&
      (event.type === 'experiment.completed' ||
        event.type === 'verification.completed'),
  );
}

function failureIsVisible(events: ResearchEvent[], experimentId: string) {
  return events.some(
    (event) =>
      event.experiment_id === experimentId &&
      event.type === 'experiment.failed',
  );
}

function experimentStatus(
  events: ResearchEvent[],
  experimentId: string,
): VisibleExperimentStatus {
  if (failureIsVisible(events, experimentId)) return 'failed';
  if (resultIsVisible(events, experimentId)) return 'completed';
  const latest = latestEventForExperiment(events, experimentId);
  return latest?.type === 'experiment.requested' ||
    latest?.type === 'verification.requested'
    ? 'requested'
    : 'running';
}

function experimentIsKnown(events: ResearchEvent[], experimentId: string) {
  return events.some((event) => event.experiment_id === experimentId);
}

function terminalRunIsVisible(events: ResearchEvent[]) {
  return events.some((event) => event.type in TERMINAL_EVENT_STATUS);
}

function toVisibleExperiment(
  experiment: Experiment,
  events: ResearchEvent[],
): VisibleExperiment {
  const resultVisible = resultIsVisible(events, experiment.id);
  const failureVisible = failureIsVisible(events, experiment.id);
  const showFinalChecks =
    terminalRunIsVisible(events) ||
    events.some(
      (event) =>
        event.experiment_id === experiment.id &&
        event.type === 'verification.completed',
    );

  return {
    id: experiment.id,
    hypothesisId: experiment.hypothesis_id,
    label: experiment.label,
    role: experiment.role,
    status: experimentStatus(events, experiment.id),
    config: { ...experiment.config },
    metrics: resultVisible ? { ...experiment.metrics } : null,
    frames: resultVisible ? experiment.frames.slice() : [],
    artifacts: resultVisible ? experiment.artifacts.map((item) => ({ ...item })) : [],
    checks: showFinalChecks
      ? experiment.checks.map((check) => ({ ...check }))
      : [],
    wallTimeS: resultVisible || failureVisible ? experiment.wall_time_s : null,
    ...(failureVisible && experiment.error ? { error: experiment.error } : {}),
    resultVisible,
  };
}

function hypothesisSnapshot(
  hypothesis: Hypothesis,
  events: ResearchEvent[],
  sequence: number,
  knownExperimentIds: Set<string>,
  visibleEvidenceIds: Set<string>,
): VisibleHypothesis {
  const related = events.filter(
    (event) => event.hypothesis_id === hypothesis.id,
  );
  const proposal = related.find(
    (event) =>
      event.type === 'hypothesis.proposed' ||
      event.type === 'hypothesis.revised',
  );
  const latestRevision = findLastMatching(
    related,
    (event) => event.type === 'hypothesis.revised',
  );
  const latestAssessment = findLastMatching(
    related,
    (event) => event.type === 'assessment.recorded',
  );
  const isResolved =
    hypothesis.resolved_sequence !== undefined &&
    hypothesis.resolved_sequence <= sequence;
  const hasRunningExperiment = related.some(
    (event) => event.type === 'experiment.started',
  );

  return {
    id: hypothesis.id,
    parentId: hypothesis.parent_id,
    title: latestRevision?.title ?? proposal?.title ?? hypothesis.title,
    prediction:
      typeof proposal?.payload.prediction === 'string'
        ? proposal.payload.prediction
        : proposal?.summary ?? hypothesis.prediction,
    status: isResolved
      ? hypothesis.status
      : hasRunningExperiment
        ? 'running'
        : 'proposed',
    assessment: latestAssessment?.summary ?? '',
    experimentIds: hypothesis.experiment_ids.filter((id) =>
      knownExperimentIds.has(id),
    ),
    evidenceIds: hypothesis.evidence_ids.filter((id) =>
      visibleEvidenceIds.has(id),
    ),
    createdSequence: hypothesis.created_sequence,
    ...(isResolved && hypothesis.resolved_sequence !== undefined
      ? { resolvedSequence: hypothesis.resolved_sequence }
      : {}),
  };
}

function runStatus(events: ResearchEvent[]): ReplayRunStatus {
  let status: ReplayRunStatus = 'pending';
  for (const event of events) {
    if (event.type === 'run.started') status = 'running';
    const terminal = TERMINAL_EVENT_STATUS[event.type];
    if (terminal) status = terminal;
  }
  return status;
}

/**
 * Reconstructs all displayable state at `sequence`.
 *
 * Return type: VisibleReplayState. Future events, experiment results, frames,
 * assessments, checks, and conclusions are excluded. Invalid sequences resolve
 * to sequence zero, and empty/incomplete recordings return empty safe arrays.
 */
export function getVisibleState(
  recording: Recording,
  sequence: number,
): VisibleReplayState {
  const cursor = normalizeSequence(sequence);
  const events = visibleEvents(recording, cursor);
  const experiments = recording.experiments
    .filter((experiment) => experimentIsKnown(events, experiment.id))
    .map((experiment) => toVisibleExperiment(experiment, events));
  const knownExperimentIds = new Set(
    experiments.map((experiment) => experiment.id),
  );
  const visibleEvidenceIds = new Set(
    events.flatMap((event) => event.evidence_ids),
  );
  const hypotheses = recording.hypotheses
    .filter((hypothesis) => hypothesis.created_sequence <= cursor)
    .map((hypothesis) =>
      hypothesisSnapshot(
        hypothesis,
        events,
        cursor,
        knownExperimentIds,
        visibleEvidenceIds,
      ),
    );
  const lastExperimentEvent = findLastMatching(
    events,
    (event) =>
      event.experiment_id !== undefined &&
      knownExperimentIds.has(event.experiment_id),
  );
  const activeExperiment =
    experiments.find(
      (experiment) => experiment.id === lastExperimentEvent?.experiment_id,
    ) ?? null;
  const conclusionEvent = findLastMatching(
    events,
    (event) => event.type === 'conclusion.recorded',
  );
  const conclusion = conclusionEvent
    ? {
        status: isVerdict(conclusionEvent.payload.status)
          ? conclusionEvent.payload.status
          : recording.conclusion.status,
        title: conclusionEvent.title,
        summary: conclusionEvent.summary,
        evidenceIds: conclusionEvent.evidence_ids.slice(),
      }
    : null;
  const completedExperiments = experiments.filter(
    (experiment) => experiment.resultVisible,
  );

  return {
    sequence: cursor,
    runStatus: runStatus(events),
    events,
    hypotheses,
    experiments,
    activeExperiment,
    conclusion,
    budget: {
      maxExperiments: recording.budget.max_experiments,
      completedExperiments: completedExperiments.length,
      wallTimeS: completedExperiments.reduce(
        (total, experiment) => total + (experiment.wallTimeS ?? 0),
        0,
      ),
    },
  };
}

/**
 * Reconstructs VisibleReplayState from a normalized scrub position in [0, 1].
 * Invalid progress values resolve to the beginning of the recording.
 */
export function getVisibleStateAtProgress(
  recording: Recording,
  progress: number,
): VisibleReplayState {
  const timeline = createReplayTimeline(recording);
  return getVisibleState(
    recording,
    getSequenceAtProgress(timeline, progress),
  );
}

function toSceneExperiment(
  experiment: VisibleExperiment | null | undefined,
): Experiment | null {
  if (!experiment?.resultVisible || !experiment.metrics) return null;
  return {
    id: experiment.id,
    hypothesis_id: experiment.hypothesisId,
    label: experiment.label,
    role: experiment.role,
    status: 'completed',
    config: { ...experiment.config },
    metrics: { ...experiment.metrics },
    frames: experiment.frames.slice(),
    artifacts: experiment.artifacts.map((artifact) => ({ ...artifact })),
    checks: experiment.checks.map((check) => ({ ...check })),
    wall_time_s: experiment.wallTimeS ?? 0,
  };
}

/**
 * Resolves tree/experiment selection into leak-safe PlasmaScene inputs.
 * Explicit experiment selection wins, followed by the latest completed
 * experiment on the selected visible hypothesis, then the active experiment.
 */
export function getSceneSelection(
  recording: Recording,
  sequence: number,
  options: {
    selectedHypothesisId?: string | null;
    selectedExperimentId?: string | null;
    frameIndex?: number;
    compare?: boolean;
  } = {},
): SceneReplaySelection {
  const state = getVisibleState(recording, sequence);
  let selected: VisibleExperiment | null = null;
  let selectedKnownButPending = false;

  if (options.selectedExperimentId) {
    selected =
      state.experiments.find(
        (experiment) => experiment.id === options.selectedExperimentId,
      ) ?? null;
    selectedKnownButPending = Boolean(selected && !selected.resultVisible);
  } else if (options.selectedHypothesisId) {
    const hypothesis = state.hypotheses.find(
      (item) => item.id === options.selectedHypothesisId,
    );
    if (hypothesis) {
      for (let index = hypothesis.experimentIds.length - 1; index >= 0; index -= 1) {
        const experimentId = hypothesis.experimentIds[index];
        const candidate = state.experiments.find(
          (experiment) => experiment.id === experimentId,
        );
        if (candidate?.resultVisible) {
          selected = candidate;
          break;
        }
        if (candidate) selectedKnownButPending = true;
      }
    }
  } else {
    selected = state.activeExperiment;
    selectedKnownButPending = Boolean(selected && !selected.resultVisible);
  }

  if (
    !selected?.resultVisible &&
    !options.selectedExperimentId &&
    !options.selectedHypothesisId
  ) {
    selected =
      state.experiments
        .slice()
        .reverse()
        .find((experiment) => experiment.resultVisible) ?? selected;
  }

  const sceneExperiment = toSceneExperiment(selected);
  const baselineVisible = state.experiments.find(
    (experiment) => experiment.id === recording.baseline_id,
  );
  const sceneBaseline =
    baselineVisible?.id === sceneExperiment?.id
      ? null
      : toSceneExperiment(baselineVisible);
  const requestedFrame = Number.isFinite(options.frameIndex)
    ? Math.round(options.frameIndex ?? 0)
    : 0;
  const frameIndex = sceneExperiment
    ? Math.min(
        Math.max(0, requestedFrame),
        Math.max(0, sceneExperiment.frames.length - 1),
      )
    : 0;

  return {
    experiment: sceneExperiment,
    baseline: sceneBaseline,
    frameIndex,
    compare: Boolean(options.compare && sceneExperiment && sceneBaseline),
    selectedExperimentId: selected?.id ?? null,
    status: sceneExperiment
      ? 'ready'
      : selectedKnownButPending
        ? 'pending'
        : 'empty',
  };
}

/**
 * Returns the most recently referenced visible experiment at `sequence`.
 *
 * Return type: VisibleExperiment | null. Results and frames remain hidden until
 * their recorded completion event, and no experiment returns for an empty
 * event stream or a cursor before its first event.
 */
export function getExperimentAtSequence(
  recording: Recording,
  sequence: number,
): VisibleExperiment | null {
  return getVisibleState(recording, sequence).activeExperiment;
}

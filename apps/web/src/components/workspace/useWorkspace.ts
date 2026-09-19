import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Experiment, Recording } from '../../types';
import {
  type Chapter,
  type VisibleExperiment,
  type VisibleState,
  defaultExperimentId,
  getChapters,
  getVisibleState,
  revealSequence,
  sequenceBounds,
} from '../../lib/visibility';
import { useReducedMotion } from '../../lib/useMediaQuery';
import type { Moment } from '../../lib/shareLink';

/** Milliseconds one research event occupies at 1x. */
const EVENT_DWELL_MS = 1100;
/** Milliseconds one stored profile frame occupies at 1x. */
const FRAME_DWELL_MS = 220;

export const SPEEDS = [0.5, 1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

export interface WorkspaceController {
  recording: Recording;
  visible: VisibleState;
  chapters: Chapter[];

  sequence: number;
  setSequence: (value: number) => void;
  stepSequence: (delta: number) => void;
  jumpChapter: (direction: 1 | -1) => void;

  playing: boolean;
  togglePlaying: () => void;
  speed: Speed;
  setSpeed: (value: Speed) => void;
  atEnd: boolean;

  /** The node the reader chose explicitly, if any; null while following the run. */
  selectedNodeId: string | null;
  /** Selected tree node: a hypothesis, an experiment, or both. */
  selectedHypothesisId: string | null;
  selectedExperimentId: string | null;
  select: (nodeId: string) => void;

  selectedExperiment: VisibleExperiment | null;
  /** Baseline as known at the current sequence; null before its result exists. */
  baseline: Experiment | null;
  compare: boolean;
  toggleCompare: () => void;

  frameIndex: number;
  setFrameIndex: (value: number) => void;
  frameCount: number;
  reducedMotion: boolean;
}

export function useWorkspace(
  recording: Recording,
  initial?: Moment,
): WorkspaceController {
  const bounds = useMemo(() => sequenceBounds(recording), [recording]);
  const chapters = useMemo(() => getChapters(recording), [recording]);
  const reducedMotion = useReducedMotion();

  // A shared link may open the run at an earlier point. The position is taken
  // literally: if the link also names a node that is not yet visible there, the
  // selection is dropped rather than the timeline jumped forward.
  const [sequence, setSequenceRaw] = useState(() => {
    const clamp = (value: number) => Math.min(Math.max(value, bounds.min), bounds.max);
    if (initial?.sequence != null) return clamp(initial.sequence);
    if (initial?.node) {
      const reveal = revealSequence(recording, initial.node);
      if (reveal !== null) return clamp(reveal);
    }
    return bounds.max;
  });
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initial?.node ?? (initial?.sequence == null ? recording.best_experiment_id : null));
  const [frameIndex, setFrameIndexRaw] = useState(0);
  const [compare, setCompare] = useState(true);

  const previousRunId = useRef(recording.id);
  const previousMax = useRef(bounds.max);

  useEffect(() => {
    if (previousRunId.current !== recording.id) {
      // A different run resets the transport rather than carrying position over.
      previousRunId.current = recording.id;
      previousMax.current = bounds.max;
      setSequenceRaw(bounds.max);
      setSelectedNodeId(recording.best_experiment_id);
      setFrameIndexRaw(0);
      setPlaying(false);
      return;
    }
    // Same run, new events: follow the live edge only if we were already on it,
    // so reading an earlier point is not interrupted by incoming evidence.
    if (bounds.max !== previousMax.current) {
      const wasAtEnd = previousMax.current;
      previousMax.current = bounds.max;
      setSequenceRaw((current) => (current >= wasAtEnd ? bounds.max : current));
    }
  }, [recording.id, bounds.max]);

  const visible = useMemo(() => getVisibleState(recording, sequence), [recording, sequence]);

  const setSequence = useCallback(
    (value: number) => {
      setSelectedNodeId(null);
      setSequenceRaw(Math.min(Math.max(Math.round(value), bounds.min), bounds.max));
    },
    [bounds.min, bounds.max],
  );

  const stepSequence = useCallback(
    (delta: number) => {
      setSelectedNodeId(null);
      setPlaying(false);
      setSequenceRaw((current) =>
        Math.min(Math.max(current + delta, bounds.min), bounds.max),
      );
    },
    [bounds.min, bounds.max],
  );

  const jumpChapter = useCallback(
    (direction: 1 | -1) => {
      setSelectedNodeId(null);
      setPlaying(false);
      setSequenceRaw((current) => {
        const target =
          direction === 1
            ? chapters.find((chapter) => chapter.sequence > current)
            : [...chapters].reverse().find((chapter) => chapter.sequence < current);
        return target ? target.sequence : current;
      });
    },
    [chapters],
  );

  const atEnd = sequence >= bounds.max;

  const togglePlaying = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setSelectedNodeId(null);
    setSequenceRaw(position => position >= bounds.max ? bounds.min : position);
    setPlaying(true);
  }, [playing, bounds.min, bounds.max]);

  // Research timeline transport.
  useEffect(() => {
    if (!playing) return undefined;
    const timer = window.setInterval(() => {
      setSequenceRaw((current) => {
        if (current >= bounds.max) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, EVENT_DWELL_MS / speed);
    return () => window.clearInterval(timer);
  }, [playing, speed, bounds.max]);

  // Selection: an explicit choice wins; otherwise follow the run.
  const followedExperimentId = useMemo(() => defaultExperimentId(visible), [visible]);
  const selectedHypothesis = visible.hypotheses.find(h => h.id === selectedNodeId);
  const hypothesisExperiments = selectedHypothesis
    ? visible.experiments.filter(e => e.hypothesisId === selectedHypothesis.id)
    : [];
  const selectedExperimentId =
    selectedNodeId && visible.experimentById.has(selectedNodeId)
      ? selectedNodeId
      : selectedHypothesis
        ? [...hypothesisExperiments].reverse().find(e => e.result !== null)?.id
          ?? hypothesisExperiments.at(-1)?.id ?? null
        : followedExperimentId;

  const selectedExperiment = selectedExperimentId
    ? visible.experimentById.get(selectedExperimentId) ?? null
    : null;

  const selectedHypothesisId = useMemo(() => {
    if (selectedNodeId && visible.hypotheses.some((h) => h.id === selectedNodeId)) {
      return selectedNodeId;
    }
    return selectedExperiment?.hypothesisId ?? null;
  }, [selectedNodeId, visible.hypotheses, selectedExperiment]);

  const select = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      // Selecting a node never reveals it early: playback moves forward to the
      // point where the node's evidence exists, and stays put if already past it.
      const reveal = revealSequence(recording, nodeId);
      if (reveal !== null) {
        setSequenceRaw((current) => (reveal > current ? reveal : current));
      }
    },
    [recording],
  );

  const baselineSource = visible.experimentById.get(recording.baseline_id) ?? null;
  const baseline = baselineSource?.result ?? null;

  const frameCount = selectedExperiment?.result?.frames.length ?? 0;

  // A paused selection opens on its final measured frame, so comparisons show
  // the outcome rather than the shared initial condition. Pausing itself freezes
  // the current frame; it must not secretly keep animating the simulation clock.
  useEffect(() => {
    setFrameIndexRaw(frameCount === 0 || playing ? 0 : frameCount - 1);
  }, [frameCount, selectedExperimentId]);

  // Simulation-time cursor. Loops over stored frames; interpolation is never
  // introduced here, so each step corresponds to a saved sample.
  useEffect(() => {
    if (!playing || reducedMotion || frameCount < 2) return undefined;
    const timer = window.setInterval(() => {
      setFrameIndexRaw((current) => (current + 1) % frameCount);
    }, FRAME_DWELL_MS / speed);
    return () => window.clearInterval(timer);
  }, [frameCount, speed, reducedMotion, playing]);

  const setFrameIndex = useCallback(
    (value: number) => {
      setFrameIndexRaw(Math.min(Math.max(Math.round(value), 0), Math.max(0, frameCount - 1)));
    },
    [frameCount],
  );

  return {
    recording,
    visible,
    chapters,
    sequence: visible.sequence,
    setSequence,
    stepSequence,
    jumpChapter,
    playing,
    togglePlaying,
    speed,
    setSpeed,
    atEnd,
    selectedNodeId,
    selectedHypothesisId,
    selectedExperimentId,
    select,
    selectedExperiment,
    baseline,
    compare,
    toggleCompare: useCallback(() => setCompare((value) => !value), []),
    frameIndex,
    setFrameIndex,
    frameCount,
    reducedMotion,
  };
}

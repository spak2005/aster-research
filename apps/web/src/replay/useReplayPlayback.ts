import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Recording, ResearchEvent } from '../../../../contracts/recording';
import {
  createReplayChapters,
  getChapterAtSequence,
  getNextChapter,
  getPreviousChapter,
  type ReplayChapter,
} from './chapters';
import {
  createReplayTimeline,
  getProgressAtSequence,
  getSequenceAtProgress,
} from './timeline';

export const REPLAY_SPEEDS = [0.5, 1, 2, 4] as const;
export type ReplaySpeed = (typeof REPLAY_SPEEDS)[number];

export interface ReplayPlaybackOptions {
  initialSequence?: number;
  initialSpeed?: ReplaySpeed;
  autoplay?: boolean;
  onComplete?: () => void;
}

/** Controller returned by useReplayPlayback. Frame selection remains separate. */
export interface ReplayPlaybackController {
  sequence: number;
  minimumSequence: number;
  maximumSequence: number;
  progress: number;
  chapter: ReplayChapter | null;
  chapters: ReplayChapter[];
  playing: boolean;
  speed: ReplaySpeed;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (speed: ReplaySpeed) => void;
  seek: (sequence: number) => void;
  seekProgress: (progress: number) => void;
  nextChapter: () => void;
  previousChapter: () => void;
  restart: () => void;
}

function orderedEvents(recording: Recording) {
  return recording.events
    .filter(
      (event) =>
        event.run_id === recording.id && Number.isFinite(event.sequence),
    )
    .slice()
    .sort(
      (left, right) =>
        left.sequence - right.sequence ||
        left.event_id.localeCompare(right.event_id),
    );
}

function clampSequence(sequence: number, maximum: number) {
  const finite = Number.isFinite(sequence) ? Math.floor(sequence) : 0;
  return Math.min(maximum, Math.max(0, finite));
}

function eventDelayMs(current: ResearchEvent | undefined, next: ResearchEvent) {
  if (!current) return 0;
  const currentTime = Date.parse(current.timestamp);
  const nextTime = Date.parse(next.timestamp);
  if (
    !Number.isFinite(currentTime) ||
    !Number.isFinite(nextTime) ||
    nextTime <= currentTime
  ) {
    return 750;
  }
  return nextTime - currentTime;
}

/**
 * Advances replay sequence using recorded event timestamps.
 * Speed changes presentation timing only; events and scientific frames are
 * never generated or interpolated by this hook.
 */
export function useReplayPlayback(
  recording: Recording,
  options: ReplayPlaybackOptions = {},
): ReplayPlaybackController {
  const events = useMemo(() => orderedEvents(recording), [recording]);
  const timeline = useMemo(() => createReplayTimeline(recording), [recording]);
  const chapters = useMemo(() => createReplayChapters(recording), [recording]);
  const minimumSequence = events[0]?.sequence ?? 0;
  const maximumSequence = events[events.length - 1]?.sequence ?? 0;
  const initialSequence = clampSequence(
    options.initialSequence ?? 0,
    maximumSequence,
  );
  const [sequence, setSequence] = useState(initialSequence);
  const [playing, setPlaying] = useState(options.autoplay ?? false);
  const [speed, setSpeedState] = useState<ReplaySpeed>(
    options.initialSpeed ?? 1,
  );
  const onCompleteRef = useRef(options.onComplete);

  useEffect(() => {
    onCompleteRef.current = options.onComplete;
  }, [options.onComplete]);

  useEffect(() => {
    setSequence(
      clampSequence(options.initialSequence ?? 0, maximumSequence),
    );
    setPlaying(options.autoplay ?? false);
  }, [
    maximumSequence,
    options.autoplay,
    options.initialSequence,
    recording.id,
  ]);

  useEffect(() => {
    if (!playing) return;
    const next = events.find((event) => event.sequence > sequence);
    if (!next) {
      setPlaying(false);
      onCompleteRef.current?.();
      return;
    }
    const current = events
      .slice()
      .reverse()
      .find((event) => event.sequence <= sequence);
    const delay = Math.min(
      2_147_000_000,
      Math.max(0, eventDelayMs(current, next) / speed),
    );
    const timer = window.setTimeout(() => {
      setSequence(next.sequence);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [events, playing, sequence, speed]);

  const seek = useCallback(
    (nextSequence: number) => {
      setSequence(clampSequence(nextSequence, maximumSequence));
    },
    [maximumSequence],
  );
  const seekProgress = useCallback(
    (progress: number) => {
      setSequence(getSequenceAtProgress(timeline, progress));
    },
    [timeline],
  );
  const nextChapter = useCallback(() => {
    const next = getNextChapter(chapters, sequence);
    if (next) setSequence(next.sequence);
  }, [chapters, sequence]);
  const previousChapter = useCallback(() => {
    const previous = getPreviousChapter(chapters, sequence);
    if (previous) setSequence(previous.sequence);
  }, [chapters, sequence]);
  const play = useCallback(() => {
    if (events.length > 0) setPlaying(true);
  }, [events.length]);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => {
    if (events.length > 0) setPlaying((value) => !value);
  }, [events.length]);
  const setSpeed = useCallback((nextSpeed: ReplaySpeed) => {
    if ((REPLAY_SPEEDS as readonly number[]).includes(nextSpeed)) {
      setSpeedState(nextSpeed);
    }
  }, []);
  const restart = useCallback(() => {
    setSequence(0);
    setPlaying(events.length > 0);
  }, [events.length]);

  return {
    sequence,
    minimumSequence,
    maximumSequence,
    progress: getProgressAtSequence(timeline, sequence),
    chapter: getChapterAtSequence(chapters, sequence),
    chapters,
    playing,
    speed,
    play,
    pause,
    toggle,
    setSpeed,
    seek,
    seekProgress,
    nextChapter,
    previousChapter,
    restart,
  };
}

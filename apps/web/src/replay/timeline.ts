import type { Recording, ResearchEvent } from '../../../../contracts/recording';

export interface ReplayTimelinePoint {
  sequence: number;
  eventId: string;
  type: ResearchEvent['type'];
  title: string;
  timestamp: string;
  researchElapsedMs: number | null;
  progress: number;
}

export interface ReplayTimeline {
  points: ReplayTimelinePoint[];
  minimumSequence: number;
  maximumSequence: number;
  researchDurationMs: number | null;
  usesRecordedTiming: boolean;
}

function orderedRunEvents(recording: Recording) {
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

function parsedTimestamp(event: ResearchEvent) {
  const value = Date.parse(event.timestamp);
  return Number.isFinite(value) ? value : null;
}

/**
 * Builds a deterministic scrub timeline. Recorded timestamps drive progress
 * only when every event has a monotonic timestamp; otherwise ordinal event
 * position is used and usesRecordedTiming is false.
 */
export function createReplayTimeline(recording: Recording): ReplayTimeline {
  const events = orderedRunEvents(recording);
  if (events.length === 0) {
    return {
      points: [],
      minimumSequence: 0,
      maximumSequence: 0,
      researchDurationMs: null,
      usesRecordedTiming: false,
    };
  }

  const timestamps = events.map(parsedTimestamp);
  const firstTimestamp = timestamps[0];
  const everyTimestampValid = timestamps.every(
    (value): value is number => value !== null,
  );
  const monotonic =
    everyTimestampValid &&
    timestamps.every(
      (value, index) => index === 0 || value >= (timestamps[index - 1] ?? value),
    );
  const lastTimestamp = timestamps[timestamps.length - 1];
  const duration =
    monotonic && firstTimestamp !== null && lastTimestamp !== null
      ? lastTimestamp - firstTimestamp
      : null;
  const usesRecordedTiming = duration !== null && duration > 0;

  const points = events.map<ReplayTimelinePoint>((event, index) => {
    const timestamp = timestamps[index];
    const researchElapsedMs =
      firstTimestamp !== null && timestamp !== null
        ? Math.max(0, timestamp - firstTimestamp)
        : null;
    const ordinalProgress =
      events.length <= 1 ? 1 : index / (events.length - 1);
    return {
      sequence: event.sequence,
      eventId: event.event_id,
      type: event.type,
      title: event.title,
      timestamp: event.timestamp,
      researchElapsedMs,
      progress:
        usesRecordedTiming && researchElapsedMs !== null && duration
          ? researchElapsedMs / duration
          : ordinalProgress,
    };
  });

  return {
    points,
    minimumSequence: points[0]?.sequence ?? 0,
    maximumSequence: points[points.length - 1]?.sequence ?? 0,
    researchDurationMs: usesRecordedTiming ? duration : null,
    usesRecordedTiming,
  };
}

export function getSequenceAtProgress(
  timeline: ReplayTimeline,
  progress: number,
) {
  if (timeline.points.length === 0) return 0;
  const cursor = Number.isFinite(progress)
    ? Math.min(1, Math.max(0, progress))
    : 0;
  let sequence = timeline.points[0]?.sequence ?? 0;
  for (const point of timeline.points) {
    if (point.progress > cursor) break;
    sequence = point.sequence;
  }
  return sequence;
}

export function getProgressAtSequence(
  timeline: ReplayTimeline,
  sequence: number,
) {
  if (timeline.points.length === 0) return 0;
  const cursor = Number.isFinite(sequence) ? Math.floor(sequence) : 0;
  let progress = 0;
  for (const point of timeline.points) {
    if (point.sequence > cursor) break;
    progress = point.progress;
  }
  return progress;
}

import type { Recording } from '../../../../contracts/recording';

export type ReplayChapterKind = 'experiment' | 'verification';

export interface ReplayChapter {
  id: string;
  kind: ReplayChapterKind;
  sequence: number;
  endSequence: number;
  title: string;
  summary: string;
  experimentId: string | null;
  hypothesisId: string | null;
}

export function createReplayChapters(recording: Recording): ReplayChapter[] {
  const chapterEvents = recording.events
    .filter(
      (event) =>
        event.run_id === recording.id &&
        (event.type === 'experiment.requested' ||
          event.type === 'verification.requested'),
    )
    .slice()
    .sort(
      (left, right) =>
        left.sequence - right.sequence ||
        left.event_id.localeCompare(right.event_id),
    );
  const maximumSequence = recording.events.reduce(
    (maximum, event) =>
      event.run_id === recording.id
        ? Math.max(maximum, event.sequence)
        : maximum,
    0,
  );

  return chapterEvents.map((event, index) => {
    const next = chapterEvents[index + 1];
    return {
      id: event.event_id,
      kind:
        event.type === 'verification.requested'
          ? 'verification'
          : 'experiment',
      sequence: event.sequence,
      endSequence: next
        ? Math.max(event.sequence, next.sequence - 1)
        : maximumSequence,
      title: event.title,
      summary: event.summary,
      experimentId: event.experiment_id ?? null,
      hypothesisId: event.hypothesis_id ?? null,
    };
  });
}

export function getChapterAtSequence(
  chapters: ReplayChapter[],
  sequence: number,
) {
  let current: ReplayChapter | null = null;
  for (const chapter of chapters) {
    if (chapter.sequence > sequence) break;
    current = chapter;
  }
  return current;
}

export function getNextChapter(
  chapters: ReplayChapter[],
  sequence: number,
) {
  return chapters.find((chapter) => chapter.sequence > sequence) ?? null;
}

export function getPreviousChapter(
  chapters: ReplayChapter[],
  sequence: number,
) {
  let previous: ReplayChapter | null = null;
  for (const chapter of chapters) {
    if (chapter.sequence >= sequence) break;
    previous = chapter;
  }
  return previous;
}

export function getVisibleChapters(
  recording: Recording,
  sequence: number,
) {
  const cursor = Number.isFinite(sequence) ? Math.floor(sequence) : 0;
  return createReplayChapters(recording).filter(
    (chapter) => chapter.sequence <= cursor,
  );
}

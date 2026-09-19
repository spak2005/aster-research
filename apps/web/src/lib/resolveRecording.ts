/**
 * Turns a route id into a recording.
 *
 * Ids come from the published catalogue. Two prefixes are special: the
 * development fixture, which only the dev server serves, and `live:` runs read
 * from a local research service.
 */
import type { Recording } from '../types';
import {
  DEVELOPMENT_FIXTURE_ID,
  RECORDING_INDEX_URL,
  fetchRecording,
  fetchRecordingIndex,
  loadDevelopmentFixture,
} from './recordings';

export async function resolveRecording(id: string, signal?: AbortSignal): Promise<Recording> {
  if (id === DEVELOPMENT_FIXTURE_ID) {
    return loadDevelopmentFixture(signal);
  }

  const index = await fetchRecordingIndex(signal);
  const entry = index.find((summary) => summary.id === id);
  if (!entry) {
    throw new Error(
      index.length === 0
        ? `No investigation has been published yet, so "${id}" cannot be opened. ${RECORDING_INDEX_URL} is empty or absent.`
        : `"${id}" is not listed in ${RECORDING_INDEX_URL}.`,
    );
  }
  return fetchRecording(entry.path, signal);
}

/**
 * Client for the published recording catalogue.
 *
 * The catalogue is a static, same-origin JSON file written by the harness when
 * a genuine investigation is exported. Until one exists the file is absent or
 * empty; both are legitimate states and must be shown as such. Nothing in this
 * module invents a recording, a metric or a fallback "demo" run.
 */
import type { Recording, RecordingSummary } from '../types';

export const RECORDING_INDEX_URL = '/recordings/index.json';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSummary(value: unknown): value is RecordingSummary {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.path === 'string' &&
    (value.mode === 'recorded' || value.mode === 'live' || value.mode === 'development-fixture')
  );
}

async function readJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`${url} responded ${response.status} ${response.statusText}`.trim());
  }
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${url} did not return JSON. The catalogue may not be published yet.`);
  }
}

/**
 * Reads the catalogue. A missing file resolves to an empty list, because "no
 * investigation has been published yet" is a true statement, not a failure.
 * Any other transport or parse problem is reported.
 */
export async function fetchRecordingIndex(signal?: AbortSignal): Promise<RecordingSummary[]> {
  let payload: unknown;
  try {
    payload = await readJson(RECORDING_INDEX_URL, signal);
  } catch (error) {
    if (error instanceof Error && /responded 404/.test(error.message)) return [];
    throw error;
  }
  if (!Array.isArray(payload)) {
    throw new Error('Recording catalogue is malformed: expected an array of summaries.');
  }
  return payload.filter(isSummary);
}

/** Structural guard. The renderer must never fabricate fields the harness did not export. */
export function assertRecording(value: unknown, source: string): Recording {
  if (!isObject(value)) {
    throw new Error(`${source} is not a recording object.`);
  }
  if (value.schema_version !== '1.0') {
    throw new Error(
      `${source} declares schema_version ${JSON.stringify(value.schema_version)}; this build reads 1.0.`,
    );
  }
  for (const key of ['id', 'title', 'question', 'mode', 'status', 'baseline_id'] as const) {
    if (typeof value[key] !== 'string') {
      throw new Error(`${source} is missing the required string field "${key}".`);
    }
  }
  for (const key of ['hypotheses', 'experiments', 'events'] as const) {
    if (!Array.isArray(value[key])) {
      throw new Error(`${source} is missing the required array field "${key}".`);
    }
  }
  return value as unknown as Recording;
}

export async function fetchRecording(path: string, signal?: AbortSignal): Promise<Recording> {
  const payload = await readJson(path, signal);
  return assertRecording(payload, path);
}

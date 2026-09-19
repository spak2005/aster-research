import { publicAssetUrl } from '../../../../contracts/public-url';
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
  const response = await fetch(publicAssetUrl(url, import.meta.env.BASE_URL), { signal, headers: { accept: 'application/json' } });
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

/** A 404, or a host that answers missing files with its own index page. */
function looksAbsent(response: Response, text: string): boolean {
  if (response.status === 404 || response.status === 410) return true;
  const type = response.headers.get('content-type') ?? '';
  if (type.includes('text/html')) return true;
  return text.trimStart().startsWith('<');
}

/**
 * Reads the catalogue. An absent file resolves to an empty list, because "no
 * investigation has been published yet" is a true statement, not a failure —
 * and static hosts announce absence inconsistently, some with a 404 and some
 * with a 200 carrying their own HTML. A file that is present but malformed is
 * reported instead, since that is a genuine fault rather than an empty shelf.
 */
export async function fetchRecordingIndex(signal?: AbortSignal): Promise<RecordingSummary[]> {
  const response = await fetch(RECORDING_INDEX_URL, {
    signal,
    headers: { accept: 'application/json' },
  });
  const text = response.body ? await response.text() : '';

  if (looksAbsent(response, text)) return [];
  if (!response.ok) {
    throw new Error(
      `${RECORDING_INDEX_URL} responded ${response.status} ${response.statusText}`.trim(),
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    throw new Error('Recording catalogue is present but is not valid JSON.');
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

/* ---- Development fixture ---------------------------------------------------
 * A synthetic run used to build and regression-check this interface. It is
 * served by the dev server only, is never listed in the published catalogue,
 * and is labelled `development-fixture` so every view marks it as non-research
 * data. `import.meta.env.DEV` is statically replaced, so production builds drop
 * the fetch entirely.
 * -------------------------------------------------------------------------- */

export const DEVELOPMENT_FIXTURE_ID = 'development-fixture';
export const DEVELOPMENT_FIXTURE_URL = '/contracts/examples/development.json';

export function developmentFixtureSummary(): RecordingSummary {
  return {
    id: DEVELOPMENT_FIXTURE_ID,
    title: 'Development fixture — synthetic heating-profile search',
    description:
      'Synthetic data for interface development. Not a scientific result and not published.',
    path: DEVELOPMENT_FIXTURE_URL,
    mode: 'development-fixture',
    created_at: '',
  };
}

export async function loadDevelopmentFixture(signal?: AbortSignal): Promise<Recording> {
  if (!import.meta.env.DEV) {
    throw new Error('The development fixture is not part of the published build.');
  }
  const payload = await readJson(DEVELOPMENT_FIXTURE_URL, signal);
  return assertRecording(payload, DEVELOPMENT_FIXTURE_URL);
}

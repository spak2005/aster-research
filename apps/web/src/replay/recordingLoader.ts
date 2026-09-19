import { useCallback, useEffect, useState } from 'react';
import type { Recording } from '../../../../contracts/recording';

export type RecordingLoadErrorCode =
  | 'cross-origin'
  | 'http'
  | 'invalid'
  | 'network';

export class RecordingLoadError extends Error {
  readonly code: RecordingLoadErrorCode;

  constructor(code: RecordingLoadErrorCode, message: string) {
    super(message);
    this.name = 'RecordingLoadError';
    this.code = code;
  }
}

export type RecordingLoadState =
  | { status: 'idle'; recording: null; error: null }
  | { status: 'loading'; recording: null; error: null }
  | { status: 'ready'; recording: Recording; error: null }
  | { status: 'error'; recording: null; error: RecordingLoadError };

export interface LoadRecordingOptions {
  signal?: AbortSignal;
  fetcher?: typeof fetch;
  allowCrossOrigin?: boolean;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Runtime guard for the shared Recording contract's playback-critical shape. */
export function isRecording(value: unknown): value is Recording {
  if (!isObject(value)) return false;
  const geometry = value.geometry;
  const scale = value.temperature_scale_kev;
  const budget = value.budget;
  const provenance = value.provenance;
  const conclusion = value.conclusion;
  if (
    value.schema_version !== '1.0' ||
    typeof value.id !== 'string' ||
    typeof value.title !== 'string' ||
    typeof value.question !== 'string' ||
    typeof value.created_at !== 'string' ||
    !['recorded', 'live', 'development-fixture'].includes(String(value.mode)) ||
    !['running', 'completed', 'failed', 'canceled'].includes(
      String(value.status),
    ) ||
    typeof value.baseline_id !== 'string' ||
    !Array.isArray(value.events) ||
    !Array.isArray(value.experiments) ||
    !Array.isArray(value.hypotheses) ||
    !Array.isArray(value.limitations) ||
    !Array.isArray(scale) ||
    scale.length !== 2 ||
    !isFiniteNumber(scale[0]) ||
    !isFiniteNumber(scale[1]) ||
    scale[1] <= scale[0] ||
    !isObject(geometry) ||
    !isFiniteNumber(geometry.major_radius_m) ||
    !isFiniteNumber(geometry.minor_radius_m) ||
    !isFiniteNumber(geometry.elongation) ||
    !isObject(budget) ||
    !isFiniteNumber(budget.max_experiments) ||
    !isObject(provenance) ||
    !isObject(conclusion)
  ) {
    return false;
  }

  return value.events.every(
    (event) =>
      isObject(event) &&
      event.schema_version === '1.0' &&
      event.run_id === value.id &&
      typeof event.event_id === 'string' &&
      isFiniteNumber(event.sequence) &&
      typeof event.timestamp === 'string' &&
      typeof event.type === 'string' &&
      Array.isArray(event.evidence_ids) &&
      isObject(event.payload),
  );
}

function resolveRecordingUrl(source: string, allowCrossOrigin: boolean) {
  const base =
    typeof window === 'undefined'
      ? 'http://localhost/'
      : window.location.href;
  let url: URL;
  try {
    url = new URL(source, base);
  } catch {
    throw new RecordingLoadError('invalid', 'Recording path is not a valid URL.');
  }

  if (
    !allowCrossOrigin &&
    typeof window !== 'undefined' &&
    url.origin !== window.location.origin
  ) {
    throw new RecordingLoadError(
      'cross-origin',
      'Cross-origin recording assets are disabled.',
    );
  }
  return url;
}

/**
 * Lazily fetches one recording JSON asset. It never substitutes a fixture or
 * fabricates data when loading or validation fails.
 */
export async function loadRecording(
  source: string,
  options: LoadRecordingOptions = {},
): Promise<Recording> {
  const url = resolveRecordingUrl(source, options.allowCrossOrigin ?? false);
  const fetcher = options.fetcher ?? fetch;
  let response: Response;
  try {
    response = await fetcher(url, {
      signal: options.signal,
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new RecordingLoadError(
      'network',
      error instanceof Error
        ? `Recording request failed: ${error.message}`
        : 'Recording request failed.',
    );
  }
  if (!response.ok) {
    throw new RecordingLoadError(
      'http',
      `Recording request returned HTTP ${response.status}.`,
    );
  }

  let value: unknown;
  try {
    value = await response.json();
  } catch {
    throw new RecordingLoadError(
      'invalid',
      'Recording response is not valid JSON.',
    );
  }
  if (!isRecording(value)) {
    throw new RecordingLoadError(
      'invalid',
      'Recording does not match the v1 playback contract.',
    );
  }
  return value;
}

export function useRecording(
  source: string | null,
  options: { enabled?: boolean } = {},
): RecordingLoadState & { reload: () => void } {
  const enabled = options.enabled ?? true;
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<RecordingLoadState>({
    status: 'idle',
    recording: null,
    error: null,
  });

  useEffect(() => {
    if (!source || !enabled) {
      setState({ status: 'idle', recording: null, error: null });
      return;
    }

    const controller = new AbortController();
    setState({ status: 'loading', recording: null, error: null });
    loadRecording(source, { signal: controller.signal })
      .then((recording) => {
        setState({ status: 'ready', recording, error: null });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setState({
          status: 'error',
          recording: null,
          error:
            error instanceof RecordingLoadError
              ? error
              : new RecordingLoadError('network', 'Recording could not load.'),
        });
      });
    return () => controller.abort();
  }, [enabled, revision, source]);

  const reload = useCallback(() => {
    setRevision((value) => value + 1);
  }, []);

  return { ...state, reload };
}

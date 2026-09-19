/**
 * Client for the local research service.
 *
 * The published site normally has no API at all: it serves recordings. When the
 * service is running on the visitor's own machine, the dev server proxies
 * `/api` to 127.0.0.1:8765 and these calls start a real run. There is no third
 * state — the interface never pretends a job was queued.
 *
 * Shapes follow the frozen local API contract.
 */
import type { Recording, ResearchEvent } from '../types';
import { assertRecording } from './recordings';

export const API_BASE = '/api';

/** Server-enforced bounds, mirrored here so the form cannot offer more. */
export const MIN_EXPERIMENTS = 3;
export const MAX_EXPERIMENTS = 12;

export interface Health {
  status: string;
  simulator: string;
  ready: boolean;
}

export interface RunSummary {
  id: string;
  title?: string;
  status: string;
  created_at?: string;
}

export interface CreateRunRequest {
  question: string;
  preset: 'fixed-energy';
  max_experiments: number;
  seed: number;
}

export interface CreateRunResponse {
  id: string;
  status: string;
}

export type BackendProbe =
  | { state: 'connected'; health: Health }
  | { state: 'absent' }
  | { state: 'error'; message: string };

/** Aborts on the caller's signal or after `timeoutMs`, whichever comes first. */
function withTimeout(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timed out')), timeoutMs);
  const cleanup = () => clearTimeout(timer);
  controller.signal.addEventListener('abort', cleanup, { once: true });
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

async function request(path: string, init: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    signal: withTimeout(timeoutMs, init.signal ?? undefined),
    headers: { accept: 'application/json', ...(init.headers ?? {}) },
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `${path} responded ${response.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`,
    );
  }
  return response;
}

/**
 * Looks for a local research service. A missing service is the normal state on
 * the public site and is reported as `absent`, not as a failure.
 */
export async function probeBackend(signal?: AbortSignal): Promise<BackendProbe> {
  try {
    const response = await request('/health', { signal }, 2000);
    const payload = (await response.json()) as Partial<Health>;
    if (typeof payload.status !== 'string') {
      return { state: 'error', message: '/api/health did not return a status field.' };
    }
    return {
      state: 'connected',
      health: {
        status: payload.status,
        simulator: payload.simulator ?? 'unknown',
        ready: payload.ready === true,
      },
    };
  } catch (error) {
    // A static host answers /api/health with 404 or with HTML; both mean "no service".
    const message = error instanceof Error ? error.message : String(error);
    if (/404|timed out|Failed to fetch|NetworkError|Unexpected token/i.test(message)) {
      return { state: 'absent' };
    }
    return { state: 'error', message };
  }
}

export async function createRun(
  body: CreateRunRequest,
  signal?: AbortSignal,
): Promise<CreateRunResponse> {
  const response = await request('/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  return (await response.json()) as CreateRunResponse;
}

export async function listRuns(signal?: AbortSignal): Promise<RunSummary[]> {
  const response = await request('/runs', { signal });
  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) ? (payload as RunSummary[]) : [];
}

export async function getRun(id: string, signal?: AbortSignal): Promise<Recording> {
  const response = await request(`/runs/${encodeURIComponent(id)}`, { signal }, 15000);
  return assertRecording(await response.json(), `${API_BASE}/runs/${id}`);
}

export async function getRunEvents(
  id: string,
  after = 0,
  signal?: AbortSignal,
): Promise<ResearchEvent[]> {
  const response = await request(
    `/runs/${encodeURIComponent(id)}/events?after=${after}`,
    { signal },
  );
  const payload = (await response.json()) as unknown;
  return Array.isArray(payload) ? (payload as ResearchEvent[]) : [];
}

export async function cancelRun(id: string, signal?: AbortSignal): Promise<void> {
  await request(`/runs/${encodeURIComponent(id)}/cancel`, { method: 'POST', signal });
}

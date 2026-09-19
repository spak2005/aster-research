/**
 * Links to a specific moment of a run.
 *
 * A shared link carries the event position and the selected node, nothing more.
 * It cannot carry a claim: opening it replays the same recorded evidence, gated
 * to the same point, so two people reading the same URL see the same thing.
 */
import { buildHash } from './router';

export interface Moment {
  sequence: number | null;
  node: string | null;
}

export function readMoment(query: URLSearchParams): Moment {
  const rawSequence = query.get('seq');
  const parsed = rawSequence === null ? Number.NaN : Number.parseInt(rawSequence, 10);
  const node = query.get('node');
  return {
    sequence: Number.isFinite(parsed) && parsed >= 0 ? parsed : null,
    node: node && node.length > 0 ? node : null,
  };
}

export function runHash(runId: string): string {
  return buildHash(`/research/${encodeURIComponent(runId)}`);
}

export function momentHash(runId: string, sequence: number, node: string | null): string {
  return buildHash(`/research/${encodeURIComponent(runId)}`, {
    seq: sequence,
    node: node ?? undefined,
  });
}

/** Absolute URL for the given hash, preserving however the site is hosted. */
export function absoluteHref(hash: string): string {
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}${hash}`;
}

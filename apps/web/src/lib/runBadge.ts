/**
 * Persistent run provenance for the site header.
 *
 * The plan requires the recorded/live label and the actual run date to be
 * available at all times while an investigation is open, not only at the top of
 * the page. A tiny external store keeps that out of the page tree so the header
 * does not need the workspace's props.
 */
import { useSyncExternalStore } from 'react';
import type { Recording } from '../types';

export interface RunBadge {
  mode: Recording['mode'];
  createdAt: string;
  title: string;
}

let current: RunBadge | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setRunBadge(value: RunBadge | null): void {
  current = value;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRunBadge(): RunBadge | null {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

/**
 * Minimal hash router.
 *
 * Hash routing keeps the site deployable as plain static files with no server
 * rewrite rules, which is the delivery constraint for the public build.
 *
 * Shape: `#/research/<id>?seq=12&node=h-2`
 */
import { useMemo, useSyncExternalStore } from 'react';

export interface Route {
  /** Normalised path with a leading slash and no trailing slash, e.g. `/research/abc`. */
  path: string;
  /** Path split into non-empty segments, e.g. `['research', 'abc']`. */
  segments: string[];
  query: URLSearchParams;
}

function normalisePath(path: string): string {
  const withLeading = path.startsWith('/') ? path : `/${path}`;
  if (withLeading.length > 1 && withLeading.endsWith('/')) {
    return withLeading.slice(0, -1);
  }
  return withLeading;
}

export function parseHash(raw: string): Route {
  const body = raw.startsWith('#') ? raw.slice(1) : raw;
  const source = body.length === 0 ? '/' : body;
  const queryStart = source.indexOf('?');
  const path = normalisePath(queryStart === -1 ? source : source.slice(0, queryStart));
  const query = new URLSearchParams(queryStart === -1 ? '' : source.slice(queryStart + 1));
  return {
    path,
    segments: path.split('/').filter(Boolean).map(decodeURIComponent),
    query,
  };
}

export function buildHash(path: string, query?: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const suffix = params.toString();
  return `#${normalisePath(path)}${suffix ? `?${suffix}` : ''}`;
}

export function navigate(to: string, options: { replace?: boolean } = {}): void {
  const target = to.startsWith('#') ? to : `#${normalisePath(to)}`;
  if (window.location.hash === target) return;
  if (options.replace) {
    window.history.replaceState(null, '', target);
    // replaceState does not emit hashchange, so subscribers are notified directly.
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

function getSnapshot(): string {
  return window.location.hash || '#/';
}

export function useRoute(): Route {
  const raw = useSyncExternalStore(subscribe, getSnapshot, () => '#/');
  return useMemo(() => parseHash(raw), [raw]);
}

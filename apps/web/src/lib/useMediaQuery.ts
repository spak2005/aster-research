import { useCallback, useSyncExternalStore } from 'react';

/** Subscribes to a CSS media query and re-renders when it changes. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    [query],
  );
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * True when the visitor has asked for reduced motion. Playback still works; it
 * simply does not start moving on its own, and transitions are suppressed.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/** Narrow viewports get a stacked workspace instead of the three-pane console. */
export function useIsNarrow(): boolean {
  return useMediaQuery('(max-width: 1080px)');
}

/**
 * Phone-sized viewports, where stacking three tall panes would bury the
 * transport. These show one pane at a time instead.
 */
export function useIsCompact(): boolean {
  return useMediaQuery('(max-width: 760px)');
}

/**
 * Scroll-coordinated reveal.
 *
 * One shared IntersectionObserver marks an element `data-revealed` the first
 * time it crosses into the viewport, and then forgets it: reveals happen once,
 * there is no scroll listener, and nothing re-hides when the reader scrolls
 * back up.
 *
 * The hidden state lives entirely in CSS and is gated on the root attribute set
 * below. If this module never runs, or the browser has no observer, or the
 * visitor asked for reduced motion, the attribute is absent and every element
 * renders in its final state.
 */
import { useCallback, useRef } from 'react';

/** Reveal as soon as the element's leading edge clears the lower tenth. */
const ROOT_MARGIN = '0px 0px -10% 0px';

const supported =
  typeof window !== 'undefined' &&
  'IntersectionObserver' in window &&
  !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (supported) document.documentElement.dataset.motion = 'ready';

let observer: IntersectionObserver | null = null;

function sharedObserver(): IntersectionObserver | null {
  if (!supported) return null;
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.revealed = 'true';
          observer?.unobserve(entry.target);
        }
      },
      { rootMargin: ROOT_MARGIN, threshold: 0 },
    );
  }
  return observer;
}

/**
 * Ref for an element that should reveal on entry. Children stagger from the
 * revealed ancestor in CSS, so one observed container covers a whole section.
 */
export function useReveal<T extends HTMLElement>(): (node: T | null) => void {
  const observed = useRef<T | null>(null);

  return useCallback((node: T | null) => {
    const active = sharedObserver();
    if (observed.current && active) active.unobserve(observed.current);
    observed.current = node;
    if (!node) return;
    if (!active) {
      node.dataset.revealed = 'true';
      return;
    }
    active.observe(node);
  }, []);
}

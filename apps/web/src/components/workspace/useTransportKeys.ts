/**
 * Keyboard transport for the workspace.
 *
 * Playback is a reading activity, so the whole timeline is reachable without a
 * pointer. Keys are ignored while a field has focus, and modifier combinations
 * the browser owns are left alone.
 */
import { useEffect, useRef } from 'react';
import { SPEEDS, type Speed, type WorkspaceController } from './useWorkspace';

export interface Shortcut {
  keys: string;
  action: string;
}

export const SHORTCUTS: Shortcut[] = [
  { keys: 'Space', action: 'Play or pause the investigation' },
  { keys: '← →', action: 'Step one research event' },
  { keys: '⇧ ← →', action: 'Jump to the previous or next stage' },
  { keys: 'Home End', action: 'Go to the first or last event' },
  { keys: '[ ]', action: 'Step one stored simulation frame' },
  { keys: 'S', action: 'Cycle playback speed' },
  { keys: 'C', action: 'Compare against the baseline' },
  { keys: '?', action: 'Show or hide this list' },
];

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

export function useTransportKeys(
  workspace: WorkspaceController,
  onToggleHelp: () => void,
): void {
  // The controller changes identity on every tick; a ref keeps one listener
  // bound for the life of the workspace instead of rebinding several times a
  // second during playback.
  const latest = useRef(workspace);
  latest.current = workspace;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;

      switch (event.key) {
        case ' ':
        case 'Spacebar':
          event.preventDefault();
          latest.current.togglePlaying();
          break;
        case 'ArrowLeft':
          event.preventDefault();
          if (event.shiftKey) latest.current.jumpChapter(-1);
          else latest.current.stepSequence(-1);
          break;
        case 'ArrowRight':
          event.preventDefault();
          if (event.shiftKey) latest.current.jumpChapter(1);
          else latest.current.stepSequence(1);
          break;
        case 'Home':
          event.preventDefault();
          latest.current.setSequence(0);
          break;
        case 'End':
          event.preventDefault();
          latest.current.setSequence(Number.MAX_SAFE_INTEGER);
          break;
        case '[':
          event.preventDefault();
          latest.current.setFrameIndex(latest.current.frameIndex - 1);
          break;
        case ']':
          event.preventDefault();
          latest.current.setFrameIndex(latest.current.frameIndex + 1);
          break;
        case 's':
        case 'S': {
          const next = SPEEDS[(SPEEDS.indexOf(latest.current.speed) + 1) % SPEEDS.length] as Speed;
          latest.current.setSpeed(next);
          break;
        }
        case 'c':
        case 'C':
          latest.current.toggleCompare();
          break;
        case '?':
          event.preventDefault();
          onToggleHelp();
          break;
        default:
          break;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onToggleHelp]);
}

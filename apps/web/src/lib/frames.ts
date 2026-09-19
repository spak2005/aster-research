/**
 * Frame lookup by simulation time.
 *
 * Experiments in the same run do not share a time grid: a refined run stores
 * more frames over the same second than a coarse one. Comparing frame *index*
 * across two experiments therefore compares two different instants, which
 * would put a candidate at 0.8 s beside a baseline at 1.0 s and call it a
 * comparison. Everything that puts two experiments side by side matches on
 * time instead, and reports the residual mismatch rather than hiding it.
 */
import type { ProfileFrame } from '../types';

export interface AlignedFrame {
  frame: ProfileFrame;
  /** Seconds between the requested time and the frame actually available. */
  offsetS: number;
}

/** The stored frame closest in simulation time, or null if there are none. */
export function frameAtTime(frames: ProfileFrame[], timeS: number): AlignedFrame | null {
  if (frames.length === 0) return null;

  let best = frames[0];
  let bestDistance = Math.abs(best.time_s - timeS);
  for (const frame of frames) {
    const distance = Math.abs(frame.time_s - timeS);
    if (distance < bestDistance) {
      best = frame;
      bestDistance = distance;
    }
  }
  return { frame: best, offsetS: best.time_s - timeS };
}

/**
 * Whether two frames are far enough apart in time that presenting them as a
 * pair needs saying so. One percent of a second is below the resolution the
 * charts label anyway.
 */
export function isMisaligned(offsetS: number): boolean {
  return Math.abs(offsetS) > 0.01;
}

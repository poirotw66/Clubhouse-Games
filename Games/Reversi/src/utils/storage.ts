/** localStorage helpers for streaks and legacy keys. */

import type { SeriesLength } from './match';

export const STREAK_KEY = 'clubhouse-reversi-win-streak';
export const BEST_STREAK_KEY = 'clubhouse-reversi-best-streak';
export const MARGIN_KEY = 'clubhouse-reversi-best-margin';

export function readStoredInt(key: string): number {
  try {
    const n = Number(localStorage.getItem(key));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function writeStoredInt(key: string, value: number): void {
  try {
    localStorage.setItem(key, String(Math.max(0, Math.floor(value))));
  } catch {
    /* ignore */
  }
}

const SERIES_PREF_KEY = 'clubhouse-reversi-series-length';

/** Preferred best-of length; first-time players default to single (1). */
export function loadSeriesLength(): SeriesLength {
  try {
    const n = Number(localStorage.getItem(SERIES_PREF_KEY));
    if (n === 1 || n === 3 || n === 5) return n;
  } catch {
    /* ignore */
  }
  return 1;
}

export function saveSeriesLength(length: SeriesLength): void {
  try {
    localStorage.setItem(SERIES_PREF_KEY, String(length));
  } catch {
    /* ignore */
  }
}

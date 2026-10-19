/** localStorage helpers for streaks and legacy keys. */

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

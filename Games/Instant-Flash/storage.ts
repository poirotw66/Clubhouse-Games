export interface BestRecord {
  highScore: number;
  maxCombo: number;
}

export const STORAGE_KEY = 'clubhouse-instant-flash-best';

const EMPTY: BestRecord = { highScore: 0, maxCombo: 0 };

export function loadBest(): BestRecord {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<BestRecord>;
    return {
      highScore: Number(parsed.highScore) || 0,
      maxCombo: Number(parsed.maxCombo) || 0,
    };
  } catch {
    return EMPTY;
  }
}

/** Merge run stats into personal bests (challenge mode only). */
export function saveBest(score: number, maxCombo: number): BestRecord {
  const previous = loadBest();
  const merged: BestRecord = {
    highScore: Math.max(previous.highScore, score),
    maxCombo: Math.max(previous.maxCombo, maxCombo),
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* private mode / quota — bests are nice-to-have */
  }
  return merged;
}

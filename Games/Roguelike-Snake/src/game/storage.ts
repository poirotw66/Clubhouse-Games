import { STORAGE_KEY } from './config';

export interface BestRecord {
  score: number;
  floor: number;
}

const EMPTY: BestRecord = { score: 0, floor: 0 };

export function loadBest(): BestRecord {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<BestRecord>;
    return {
      score: Number(parsed.score) || 0,
      floor: Number(parsed.floor) || 0,
    };
  } catch {
    return EMPTY;
  }
}

export function saveBest(record: BestRecord): BestRecord {
  const previous = loadBest();
  const merged: BestRecord = {
    score: Math.max(previous.score, record.score),
    floor: Math.max(previous.floor, record.floor),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // Private mode or storage disabled: best-effort only.
  }
  return merged;
}

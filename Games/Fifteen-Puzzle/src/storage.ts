/**
 * localStorage for free-play bests, daily history, and campaign progress.
 * Keys follow the `clubhouse:fifteen-puzzle:*` namespace used by recent puzzles.
 */

import type { BoardSize, ScrambleTier } from './fifteenLogic.ts';

const BEST_KEY = 'clubhouse:fifteen-puzzle:best';
/** Legacy key from the fixed 4×4 build — migrated on first read. */
const LEGACY_BEST_KEY = 'clubhouse-fifteen-best';
const DAILY_KEY = 'clubhouse:fifteen-puzzle:daily';
const CAMPAIGN_KEY = 'clubhouse:fifteen-puzzle:campaign';

export type BestMap = Record<string, number>;

function migrateLegacyBest(): void {
  try {
    if (localStorage.getItem(BEST_KEY)) return;
    const raw = localStorage.getItem(LEGACY_BEST_KEY);
    if (!raw) return;
    const legacy = JSON.parse(raw) as Record<string, number>;
    const next: BestMap = {};
    for (const [k, v] of Object.entries(legacy)) {
      if (typeof v !== 'number' || !(v > 0)) continue;
      // Old keys: moves-{tier} / sprint-{tier} → size 4.
      if (k.startsWith('moves-')) next[`moves-4-${k.slice(6)}`] = v;
      else if (k.startsWith('sprint-')) next[`sprint-4-${k.slice(7)}`] = v;
      else next[k] = v;
    }
    localStorage.setItem(BEST_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function readBest(): BestMap {
  migrateLegacyBest();
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as BestMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeBest(map: BestMap): void {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

function movesKey(size: BoardSize, tier: ScrambleTier): string {
  return `moves-${size}-${tier}`;
}

function sprintKey(size: BoardSize, tier: ScrambleTier): string {
  return `sprint-${size}-${tier}`;
}

export function loadBestMoves(size: BoardSize, tier: ScrambleTier): number | null {
  const v = readBest()[movesKey(size, tier)];
  return typeof v === 'number' && v > 0 ? v : null;
}

export function saveBestMoves(size: BoardSize, tier: ScrambleTier, moves: number): number | null {
  const prev = loadBestMoves(size, tier);
  if (prev !== null && moves >= prev) return prev;
  const map = readBest();
  map[movesKey(size, tier)] = moves;
  writeBest(map);
  return moves;
}

export function loadBestSprintSec(size: BoardSize, tier: ScrambleTier): number | null {
  const v = readBest()[sprintKey(size, tier)];
  return typeof v === 'number' && v > 0 ? v : null;
}

export function saveBestSprintSec(size: BoardSize, tier: ScrambleTier, sec: number): number | null {
  const prev = loadBestSprintSec(size, tier);
  if (prev !== null && sec >= prev) return prev;
  const map = readBest();
  map[sprintKey(size, tier)] = sec;
  writeBest(map);
  return sec;
}

// —— Daily ——

export type DailyRecord = {
  date: string;
  moves: number;
  elapsedSec: number;
  optimal: number;
  grade: string;
};

export function loadDaily(): DailyRecord[] {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DailyRecord[];
    return Array.isArray(parsed)
      ? parsed.filter((r) => r && typeof r.date === 'string')
      : [];
  } catch {
    return [];
  }
}

/** One record per day; keep the better (fewer moves, then faster). */
export function recordDaily(record: DailyRecord): DailyRecord[] {
  const existing = loadDaily();
  const previous = existing.find((r) => r.date === record.date);
  const better = (a: DailyRecord, b: DailyRecord): DailyRecord => {
    if (a.moves !== b.moves) return a.moves < b.moves ? a : b;
    return a.elapsedSec <= b.elapsedSec ? a : b;
  };
  const merged = previous
    ? existing.map((r) => (r.date === record.date ? better(r, record) : r))
    : [...existing, record];
  const trimmed = merged.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 400);
  try {
    localStorage.setItem(DAILY_KEY, JSON.stringify(trimmed));
  } catch {
    /* ignore */
  }
  return trimmed;
}

// —— Campaign ——

export type CampaignProgress = {
  clearedCount: number;
  bestMoves: Record<string, number>;
  bestTimeSec: Record<string, number>;
};

export const EMPTY_CAMPAIGN: CampaignProgress = {
  clearedCount: 0,
  bestMoves: {},
  bestTimeSec: {},
};

export function loadCampaignProgress(): CampaignProgress {
  try {
    const raw = localStorage.getItem(CAMPAIGN_KEY);
    if (!raw) return { ...EMPTY_CAMPAIGN, bestMoves: {}, bestTimeSec: {} };
    const parsed = JSON.parse(raw) as Partial<CampaignProgress>;
    const clearedCount = Math.max(0, Math.floor(Number(parsed.clearedCount) || 0));
    const bestMoves: Record<string, number> = {};
    const bestTimeSec: Record<string, number> = {};
    if (parsed.bestMoves && typeof parsed.bestMoves === 'object') {
      for (const [k, v] of Object.entries(parsed.bestMoves)) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0) bestMoves[k] = Math.floor(n);
      }
    }
    if (parsed.bestTimeSec && typeof parsed.bestTimeSec === 'object') {
      for (const [k, v] of Object.entries(parsed.bestTimeSec)) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0) bestTimeSec[k] = Math.floor(n);
      }
    }
    return { clearedCount, bestMoves, bestTimeSec };
  } catch {
    return { ...EMPTY_CAMPAIGN, bestMoves: {}, bestTimeSec: {} };
  }
}

export function saveCampaignProgress(progress: CampaignProgress): void {
  try {
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

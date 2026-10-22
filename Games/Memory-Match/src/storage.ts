/**
 * Persistence for daily history, campaign stars, and CPU roster unlocks.
 * Free-play bests stay in memoryLogic (legacy key clubhouse-memory-match-best).
 */

import type { OpponentId } from './opponents.ts';

const DAILY_KEY = 'clubhouse-memory-match-daily';
const CAMPAIGN_KEY = 'clubhouse-memory-match-campaign';
const ROSTER_KEY = 'clubhouse-memory-match-roster';

export type DailyRecord = {
  date: string;
  moves: number;
  elapsedSec: number;
  score: number;
  pairCount: number;
};

export type CampaignProgress = {
  /** Highest stage index cleared + 1 (sequential within unlocked chapters). */
  clearedCount: number;
  /** Best star count 1–3 per stage id. */
  stars: Record<string, number>;
  bestMoves: Record<string, number>;
  bestTimeSec: Record<string, number>;
};

export const EMPTY_CAMPAIGN: CampaignProgress = {
  clearedCount: 0,
  stars: {},
  bestMoves: {},
  bestTimeSec: {},
};

export type RosterProgress = {
  /** Highest opponent index unlocked (0 = first always open). */
  unlockedIndex: number;
  wins: Record<string, number>;
};

export const EMPTY_ROSTER: RosterProgress = {
  unlockedIndex: 0,
  wins: {},
};

export function loadDaily(): DailyRecord[] {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DailyRecord[];
    return Array.isArray(parsed)
      ? parsed.filter(
          (r) =>
            r &&
            typeof r.date === 'string' &&
            typeof r.moves === 'number' &&
            typeof r.elapsedSec === 'number',
        )
      : [];
  } catch {
    return [];
  }
}

/** One record per day; keep better (fewer moves, then faster). */
export function recordDaily(record: DailyRecord): DailyRecord[] {
  const existing = loadDaily();
  const previous = existing.find((r) => r.date === record.date);
  const better = (a: DailyRecord, b: DailyRecord): DailyRecord => {
    if (a.moves !== b.moves) return a.moves < b.moves ? a : b;
    if (a.elapsedSec !== b.elapsedSec) return a.elapsedSec < b.elapsedSec ? a : b;
    return a.score >= b.score ? a : b;
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

export function loadCampaignProgress(): CampaignProgress {
  try {
    const raw = localStorage.getItem(CAMPAIGN_KEY);
    if (!raw) return { ...EMPTY_CAMPAIGN, stars: {}, bestMoves: {}, bestTimeSec: {} };
    const parsed = JSON.parse(raw) as Partial<CampaignProgress>;
    const clearedCount = Math.max(0, Math.floor(Number(parsed.clearedCount) || 0));
    const stars: Record<string, number> = {};
    const bestMoves: Record<string, number> = {};
    const bestTimeSec: Record<string, number> = {};
    if (parsed.stars && typeof parsed.stars === 'object') {
      for (const [k, v] of Object.entries(parsed.stars)) {
        const n = Math.floor(Number(v));
        if (Number.isFinite(n) && n >= 1 && n <= 3) stars[k] = n;
      }
    }
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
    return { clearedCount, stars, bestMoves, bestTimeSec };
  } catch {
    return { ...EMPTY_CAMPAIGN, stars: {}, bestMoves: {}, bestTimeSec: {} };
  }
}

export function saveCampaignProgress(progress: CampaignProgress): void {
  try {
    localStorage.setItem(CAMPAIGN_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export function loadRosterProgress(): RosterProgress {
  try {
    const raw = localStorage.getItem(ROSTER_KEY);
    if (!raw) return { ...EMPTY_ROSTER, wins: {} };
    const parsed = JSON.parse(raw) as Partial<RosterProgress>;
    const unlockedIndex = Math.max(0, Math.floor(Number(parsed.unlockedIndex) || 0));
    const wins: Record<string, number> = {};
    if (parsed.wins && typeof parsed.wins === 'object') {
      for (const [k, v] of Object.entries(parsed.wins)) {
        const n = Math.floor(Number(v));
        if (Number.isFinite(n) && n >= 0) wins[k] = n;
      }
    }
    return { unlockedIndex, wins };
  } catch {
    return { ...EMPTY_ROSTER, wins: {} };
  }
}

export function saveRosterProgress(progress: RosterProgress): void {
  try {
    localStorage.setItem(ROSTER_KEY, JSON.stringify(progress));
  } catch {
    /* ignore */
  }
}

export function recordRosterWin(opponentId: OpponentId, opponentIndex: number): RosterProgress {
  const prev = loadRosterProgress();
  const wins = { ...prev.wins };
  wins[opponentId] = (wins[opponentId] ?? 0) + 1;
  const unlockedIndex = Math.max(prev.unlockedIndex, opponentIndex + 1);
  const next = { unlockedIndex, wins };
  saveRosterProgress(next);
  return next;
}

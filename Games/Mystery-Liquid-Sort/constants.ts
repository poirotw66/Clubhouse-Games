import { Color } from './types.ts';

/** Default capacity for UI/fallback (e.g. new bottle in quick play level 1). */
export const DEFAULT_CAPACITY = 4;
/** Maximum bottle capacity at highest difficulty. */
export const MAX_CAPACITY = 6;

export const INITIAL_COINS = 1200;

/** Capacity by difficulty: 4 (easy) -> 5 (mid) -> 6 (hard). */
export function getCapacityForLevel(level: number): number {
  if (level < 5) return 4;
  if (level < 10) return 5;
  return 6;
}

export const LEVEL_COLORS = [
  Color.RED,
  Color.BLUE,
  Color.GREEN,
  Color.YELLOW,
  Color.PURPLE,
  Color.ORANGE,
  Color.CYAN,
];

// Costs for powerups
export const COST_SHUFFLE = 100;
export const COST_UNDO = 50;
export const COST_ADD_BOTTLE = 200;
export const COST_REVEAL = 150; // Cost to reveal hidden layers
export const COST_CLEAR = 300;

/** Quick-play best pour counts keyed by difficulty label (lower is better). */
export const QP_BEST_MOVES_KEY = 'mls-qp-best-moves-v1';

/** Stable storage ids for quick-play difficulties (do not localize these keys). */
export const QP_DIFFICULTY_IDS = ['EASY', 'MEDIUM', 'HARD', 'EXPERT'] as const;
export type QpDifficultyId = (typeof QP_DIFFICULTY_IDS)[number];

export const QP_DIFFICULTY_LABELS: Record<QpDifficultyId, string> = {
  EASY: '簡單',
  MEDIUM: '普通',
  HARD: '困難',
  EXPERT: '專家',
};

export function qpDifficultyLabel(id: string | undefined): string {
  if (!id) return '自訂';
  if (id in QP_DIFFICULTY_LABELS) return QP_DIFFICULTY_LABELS[id as QpDifficultyId];
  return id;
}

export function loadQpBestMoves(): Record<string, number> {
  try {
    const raw = localStorage.getItem(QP_BEST_MOVES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) out[k] = Math.floor(n);
    }
    return out;
  } catch {
    return {};
  }
}

/** Persist min pour count for a QP label; returns the best after update. */
export function persistQpBestMoves(label: string, moves: number): number {
  const bests = loadQpBestMoves();
  const prev = bests[label];
  const next = prev == null ? moves : Math.min(prev, moves);
  bests[label] = next;
  try {
    localStorage.setItem(QP_BEST_MOVES_KEY, JSON.stringify(bests));
  } catch {
    /* private mode */
  }
  return next;
}
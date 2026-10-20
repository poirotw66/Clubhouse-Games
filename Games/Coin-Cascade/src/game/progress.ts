/**
 * Persistent meta: tokens, table / special / cosmetic unlocks, milestones.
 * Free-play best keys (`coin-cascade:best`, `coin-cascade:best-cascade`) stay
 * untouched — this module never reads or writes them.
 */
import type { RunState } from './types';
import { TABLE_PACK, isTableUnlocked, type TableId } from './tables';

export const META_STORAGE_KEY = 'coin-cascade:meta-v1';

/** Unlockable special beyond the free heavy / ball / vibrate trio. */
export type UnlockableSpecial = 'magnet';

export type CoinSetId = 'classic' | 'jade' | 'neon';

export interface CoinSetDef {
  readonly id: CoinSetId;
  readonly name: string;
  readonly blurb: string;
  readonly unlockTokens: number;
  /** Canvas tint hues for normal / heavy faces. */
  readonly normalHue: number;
  readonly heavyHue: number;
}

export const COIN_SETS: readonly CoinSetDef[] = [
  {
    id: 'classic',
    name: '黃金幣',
    blurb: '預設黃銅光澤',
    unlockTokens: 0,
    normalHue: 42,
    heavyHue: 28,
  },
  {
    id: 'jade',
    name: '翠玉幣',
    blurb: '冷調青玉質感',
    unlockTokens: 30,
    normalHue: 152,
    heavyHue: 168,
  },
  {
    id: 'neon',
    name: '霓虹幣',
    blurb: '夜市霓虹邊光',
    unlockTokens: 80,
    normalHue: 300,
    heavyHue: 320,
  },
];

export interface SpecialUnlockDef {
  readonly id: UnlockableSpecial;
  readonly name: string;
  readonly blurb: string;
  readonly unlockTokens: number;
  readonly cost: number;
}

export const SPECIAL_UNLOCKS: readonly SpecialUnlockDef[] = [
  {
    id: 'magnet',
    name: '磁吸幣',
    blurb: '落地時把附近幣往自己拉——能拆牆也能自毀佈局',
    unlockTokens: 60,
    cost: 3,
  },
];

export interface MetaProgress {
  readonly tokens: number;
  readonly lifetimeTokens: number;
  readonly unlockedTables: readonly TableId[];
  readonly unlockedSpecials: readonly UnlockableSpecial[];
  readonly unlockedCoinSets: readonly CoinSetId[];
  readonly activeCoinSet: CoinSetId;
  readonly milestones: Readonly<Record<string, true>>;
  /** Best free-play score per table id (does not replace coin-cascade:best). */
  readonly tableBest: Readonly<Record<string, number>>;
}

export const EMPTY_META: MetaProgress = {
  tokens: 0,
  lifetimeTokens: 0,
  unlockedTables: ['classic'],
  unlockedSpecials: [],
  unlockedCoinSets: ['classic'],
  activeCoinSet: 'classic',
  milestones: {},
  tableBest: {},
};

const MILESTONE_DEFS: readonly { id: string; name: string; test: (s: RunState, meta: MetaProgress) => boolean }[] = [
  { id: 'first-cascade', name: '首次連鎖', test: (s) => s.longestCascade >= 3 },
  { id: 'cascade-6', name: '雪崩六枚', test: (s) => s.longestCascade >= 6 },
  { id: 'first-jackpot', name: '首次彩池', test: (s) => s.jackpotBursts >= 1 },
  { id: 'jackpot-3', name: '三連彩池', test: (s) => s.jackpotBursts >= 3 },
  { id: 'score-150', name: '分數破百五', test: (s) => s.score >= 150 },
  { id: 'score-250', name: '分數破兩百五', test: (s) => s.score >= 250 },
  { id: 'tokens-50', name: '潮幣五十', test: (_s, m) => m.lifetimeTokens >= 50 },
  { id: 'tokens-150', name: '潮幣一百五', test: (_s, m) => m.lifetimeTokens >= 150 },
];

export function milestoneDefs(): readonly { id: string; name: string }[] {
  return MILESTONE_DEFS.map(({ id, name }) => ({ id, name }));
}

export function coinSetById(id: string): CoinSetDef | undefined {
  return COIN_SETS.find((c) => c.id === id);
}

export function specialUnlockById(id: string): SpecialUnlockDef | undefined {
  return SPECIAL_UNLOCKS.find((s) => s.id === id);
}

/** Tokens granted at the end of a finished run. */
export function tokensFromRun(state: RunState): number {
  if (state.phase !== 'ended') return 0;
  const fromScore = Math.floor(state.score / 12);
  const fromCascades = state.cascadeCount * 2;
  const fromJackpots = state.jackpotBursts * 5;
  const fromTiming = Math.min(8, Math.floor(state.timingBonusCount / 4));
  return Math.max(1, fromScore + fromCascades + fromJackpots + fromTiming);
}

function asFiniteInt(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === 'string' && x.length > 0 && x.length < 64);
}

/**
 * Validate and normalise a raw localStorage payload. Corrupt / partial data
 * falls back field-by-field rather than wiping the whole save.
 */
export function parseMetaProgress(raw: unknown): MetaProgress {
  const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};

  const tokens = asFiniteInt(obj.tokens, 0);
  const lifetimeTokens = Math.max(tokens, asFiniteInt(obj.lifetimeTokens, tokens));

  const unlockedTablesRaw = parseStringArray(obj.unlockedTables);
  const unlockedTables: TableId[] = ['classic'];
  for (const id of unlockedTablesRaw) {
    if (TABLE_PACK.some((t) => t.id === id) && !unlockedTables.includes(id as TableId)) {
      unlockedTables.push(id as TableId);
    }
  }

  const unlockedSpecials: UnlockableSpecial[] = [];
  for (const id of parseStringArray(obj.unlockedSpecials)) {
    if (SPECIAL_UNLOCKS.some((s) => s.id === id) && !unlockedSpecials.includes(id as UnlockableSpecial)) {
      unlockedSpecials.push(id as UnlockableSpecial);
    }
  }

  const unlockedCoinSets: CoinSetId[] = ['classic'];
  for (const id of parseStringArray(obj.unlockedCoinSets)) {
    if (COIN_SETS.some((c) => c.id === id) && !unlockedCoinSets.includes(id as CoinSetId)) {
      unlockedCoinSets.push(id as CoinSetId);
    }
  }

  let activeCoinSet: CoinSetId = 'classic';
  if (typeof obj.activeCoinSet === 'string' && unlockedCoinSets.includes(obj.activeCoinSet as CoinSetId)) {
    activeCoinSet = obj.activeCoinSet as CoinSetId;
  }

  const milestones: Record<string, true> = {};
  if (obj.milestones && typeof obj.milestones === 'object') {
    for (const id of Object.keys(obj.milestones as object)) {
      if (MILESTONE_DEFS.some((m) => m.id === id)) milestones[id] = true;
    }
  }

  const tableBest: Record<string, number> = {};
  if (obj.tableBest && typeof obj.tableBest === 'object') {
    for (const [id, score] of Object.entries(obj.tableBest as Record<string, unknown>)) {
      if (TABLE_PACK.some((t) => t.id === id)) {
        const n = asFiniteInt(score, 0);
        if (n > 0) tableBest[id] = n;
      }
    }
  }

  return {
    tokens,
    lifetimeTokens,
    unlockedTables,
    unlockedSpecials,
    unlockedCoinSets,
    activeCoinSet,
    milestones,
    tableBest,
  };
}

export function loadMetaProgress(): MetaProgress {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY);
    if (!raw) return { ...EMPTY_META, unlockedTables: ['classic'], unlockedCoinSets: ['classic'], milestones: {}, tableBest: {} };
    return parseMetaProgress(JSON.parse(raw));
  } catch {
    return { ...EMPTY_META, unlockedTables: ['classic'], unlockedCoinSets: ['classic'], milestones: {}, tableBest: {} };
  }
}

export function saveMetaProgress(meta: MetaProgress): void {
  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    /* ignore quota / private mode */
  }
}

export function isSpecialUnlocked(id: UnlockableSpecial, meta: MetaProgress): boolean {
  if (meta.unlockedSpecials.includes(id)) return true;
  const def = specialUnlockById(id);
  return Boolean(def && meta.tokens >= def.unlockTokens);
}

export function isCoinSetUnlocked(id: CoinSetId, meta: MetaProgress): boolean {
  if (meta.unlockedCoinSets.includes(id)) return true;
  const def = coinSetById(id);
  return Boolean(def && meta.tokens >= def.unlockTokens);
}

/**
 * Apply end-of-run rewards: tokens, auto-unlocks, milestones, per-table best.
 * Never touches `coin-cascade:best`.
 */
export function applyRunToMeta(
  meta: MetaProgress,
  state: RunState,
  modeClears: number,
): { meta: MetaProgress; earned: number; newlyUnlocked: string[] } {
  if (state.phase !== 'ended') {
    return { meta, earned: 0, newlyUnlocked: [] };
  }

  const earned = tokensFromRun(state);
  let tokens = meta.tokens + earned;
  const lifetimeTokens = meta.lifetimeTokens + earned;
  const unlockedTables = [...meta.unlockedTables];
  const unlockedSpecials = [...meta.unlockedSpecials];
  const unlockedCoinSets = [...meta.unlockedCoinSets];
  const milestones = { ...meta.milestones };
  const tableBest = { ...meta.tableBest };
  const newlyUnlocked: string[] = [];

  const tableId = state.tableId;
  const prevBest = tableBest[tableId] ?? 0;
  if (state.score > prevBest) tableBest[tableId] = state.score;

  const draft: MetaProgress = {
    tokens,
    lifetimeTokens,
    unlockedTables,
    unlockedSpecials,
    unlockedCoinSets,
    activeCoinSet: meta.activeCoinSet,
    milestones,
    tableBest,
  };

  for (const m of MILESTONE_DEFS) {
    if (!milestones[m.id] && m.test(state, draft)) {
      milestones[m.id] = true;
      newlyUnlocked.push(m.name);
    }
  }

  for (const table of TABLE_PACK) {
    if (unlockedTables.includes(table.id)) continue;
    if (isTableUnlocked(table, tokens, modeClears, unlockedTables)) {
      unlockedTables.push(table.id);
      newlyUnlocked.push(table.name);
    }
  }

  for (const special of SPECIAL_UNLOCKS) {
    if (unlockedSpecials.includes(special.id)) continue;
    if (tokens >= special.unlockTokens) {
      unlockedSpecials.push(special.id);
      newlyUnlocked.push(special.name);
    }
  }

  for (const set of COIN_SETS) {
    if (unlockedCoinSets.includes(set.id)) continue;
    if (tokens >= set.unlockTokens) {
      unlockedCoinSets.push(set.id);
      newlyUnlocked.push(set.name);
    }
  }

  return {
    meta: {
      tokens,
      lifetimeTokens,
      unlockedTables,
      unlockedSpecials,
      unlockedCoinSets,
      activeCoinSet: meta.activeCoinSet,
      milestones,
      tableBest,
    },
    earned,
    newlyUnlocked,
  };
}

export function setActiveCoinSet(meta: MetaProgress, id: CoinSetId): MetaProgress {
  if (!isCoinSetUnlocked(id, meta)) return meta;
  const unlockedCoinSets = meta.unlockedCoinSets.includes(id)
    ? meta.unlockedCoinSets
    : [...meta.unlockedCoinSets, id];
  return { ...meta, activeCoinSet: id, unlockedCoinSets };
}

/** Spend tokens to force-unlock a table early (optional shop path). */
export function purchaseTable(meta: MetaProgress, tableId: TableId): MetaProgress | null {
  const table = TABLE_PACK.find((t) => t.id === tableId);
  if (!table || table.unlockTokens <= 0) return null;
  if (meta.unlockedTables.includes(tableId)) return null;
  if (meta.tokens < table.unlockTokens) return null;
  return {
    ...meta,
    tokens: meta.tokens - table.unlockTokens,
    unlockedTables: [...meta.unlockedTables, tableId],
  };
}

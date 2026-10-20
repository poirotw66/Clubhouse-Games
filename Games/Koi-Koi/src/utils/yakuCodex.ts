import type { YakuId } from '../types';

export const CODEX_KEY = 'clubhouse-koi-koi-yaku-codex';

export const ALL_YAKU_IDS: readonly YakuId[] = [
  'gokou',
  'shikou',
  'ame_shikou',
  'sankou',
  'ino_shika_cho',
  'tsukimi_zake',
  'hanami_zake',
  'tane',
  'akatan',
  'aotan',
  'tanzaku',
  'kasu',
] as const;

const YAKU_ID_SET: ReadonlySet<string> = new Set(ALL_YAKU_IDS);

export interface YakuCatalogEntry {
  id: YakuId;
  /** Short Traditional Chinese name for lists. */
  name: string;
  /** Locked-silhouette hint (does not spoil exact card list). */
  hint: string;
  /** Typical point blurb shown in the codex. */
  pointsBlurb: string;
}

/** Static catalog for every yaku the scorer can produce. */
export const YAKU_CATALOG: Record<YakuId, YakuCatalogEntry> = {
  gokou: {
    id: 'gokou',
    name: '五光',
    hint: '集齊五張光牌的極致光輝。',
    pointsBlurb: '10 分',
  },
  shikou: {
    id: 'shikou',
    name: '四光',
    hint: '四張光牌，但不含雨中人。',
    pointsBlurb: '8 分',
  },
  ame_shikou: {
    id: 'ame_shikou',
    name: '雨四光',
    hint: '四張光牌，且含十一月的雨中人。',
    pointsBlurb: '7 分',
  },
  sankou: {
    id: 'sankou',
    name: '三光',
    hint: '三張非雨的光牌。',
    pointsBlurb: '5 分',
  },
  ino_shika_cho: {
    id: 'ino_shika_cho',
    name: '豬鹿蝶',
    hint: '野豬、鹿與蝴蝶三隻動物齊聚。',
    pointsBlurb: '5 分',
  },
  tsukimi_zake: {
    id: 'tsukimi_zake',
    name: '月見酒',
    hint: '賞月時配上一杯濁酒。',
    pointsBlurb: '5 分',
  },
  hanami_zake: {
    id: 'hanami_zake',
    name: '花見酒',
    hint: '櫻花簾下舉杯同歡。',
    pointsBlurb: '5 分',
  },
  tane: {
    id: 'tane',
    name: '種',
    hint: '收集足夠多的種牌。',
    pointsBlurb: '5 張起 1 分+',
  },
  akatan: {
    id: 'akatan',
    name: '赤短',
    hint: '三條赤色短冊。',
    pointsBlurb: '5 分',
  },
  aotan: {
    id: 'aotan',
    name: '青短',
    hint: '三條青色短冊。',
    pointsBlurb: '5 分',
  },
  tanzaku: {
    id: 'tanzaku',
    name: '短冊',
    hint: '收集足夠多的短冊牌。',
    pointsBlurb: '5 張起 1 分+',
  },
  kasu: {
    id: 'kasu',
    name: '菓子',
    hint: '大量素牌堆成的菓子山。',
    pointsBlurb: '10 張起 1 分+',
  },
};

export interface YakuCodexEntry {
  /** ISO date (YYYY-MM-DD) of first completion. */
  firstCompletedAt: string;
  timesAchieved: number;
  /** Best total hand score when this yaku was present. */
  bestHandScore: number;
}

export type YakuCodexState = {
  entries: Partial<Record<YakuId, YakuCodexEntry>>;
};

export const DEFAULT_CODEX: YakuCodexState = {
  entries: {},
};

export interface YakuCompletionInput {
  id: YakuId;
  /** Total points of the hand when the yaku was completed. */
  handScore: number;
  /**
   * When false, only refresh bestHandScore (and unlock if missing).
   * Defaults to true — counts as a new achievement.
   */
  countAchievement?: boolean;
  /** Optional clock for tests; defaults to Date.now(). */
  nowMs?: number;
}

export interface RecordYakuResult {
  codex: YakuCodexState;
  /** Yaku ids newly unlocked in this write. */
  newlyUnlocked: YakuId[];
}

function asNonNegInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function isYakuId(value: unknown): value is YakuId {
  return typeof value === 'string' && YAKU_ID_SET.has(value);
}

function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function parseIsoDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const t = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(t)) return null;
  return value;
}

function mergeEntry(raw: unknown): YakuCodexEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Partial<YakuCodexEntry>;
  const firstCompletedAt = parseIsoDate(o.firstCompletedAt);
  if (!firstCompletedAt) return null;
  return {
    firstCompletedAt,
    timesAchieved: Math.max(1, asNonNegInt(o.timesAchieved)),
    bestHandScore: asNonNegInt(o.bestHandScore),
  };
}

/** Merge partial / corrupt storage into a valid YakuCodexState. */
export function mergeCodex(raw: unknown): YakuCodexState {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_CODEX, entries: {} };
  const o = raw as { entries?: unknown };
  const entries: Partial<Record<YakuId, YakuCodexEntry>> = {};
  if (o.entries && typeof o.entries === 'object') {
    for (const [key, value] of Object.entries(o.entries as Record<string, unknown>)) {
      if (!isYakuId(key)) continue;
      const entry = mergeEntry(value);
      if (entry) entries[key] = entry;
    }
  }
  return { entries };
}

export function isYakuUnlocked(codex: YakuCodexState, id: YakuId): boolean {
  return Boolean(codex.entries[id]);
}

export function unlockedCount(codex: YakuCodexState): number {
  return ALL_YAKU_IDS.filter(id => isYakuUnlocked(codex, id)).length;
}

/**
 * Record player yaku completions. Updates times/best score; tracks first-unlock ids.
 */
export function recordYakuCompletions(
  codex: YakuCodexState,
  completions: YakuCompletionInput[],
): RecordYakuResult {
  if (completions.length === 0) {
    return { codex, newlyUnlocked: [] };
  }

  const entries: Partial<Record<YakuId, YakuCodexEntry>> = { ...codex.entries };
  const newlyUnlocked: YakuId[] = [];

  for (const completion of completions) {
    if (!isYakuId(completion.id)) continue;
    const handScore = asNonNegInt(completion.handScore);
    const nowMs = completion.nowMs ?? Date.now();
    const countAchievement = completion.countAchievement !== false;
    const existing = entries[completion.id];
    if (!existing) {
      entries[completion.id] = {
        firstCompletedAt: toIsoDate(nowMs),
        timesAchieved: 1,
        bestHandScore: handScore,
      };
      newlyUnlocked.push(completion.id);
    } else {
      entries[completion.id] = {
        firstCompletedAt: existing.firstCompletedAt,
        timesAchieved: countAchievement
          ? existing.timesAchieved + 1
          : existing.timesAchieved,
        bestHandScore: Math.max(existing.bestHandScore, handScore),
      };
    }
  }

  return { codex: { entries }, newlyUnlocked };
}

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadCodex(storage: StorageLike | null = defaultStorage()): YakuCodexState {
  if (!storage) return { entries: {} };
  try {
    const raw = storage.getItem(CODEX_KEY);
    if (!raw) return { entries: {} };
    return mergeCodex(JSON.parse(raw));
  } catch {
    return { entries: {} };
  }
}

export function saveCodex(
  codex: YakuCodexState,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(CODEX_KEY, JSON.stringify(mergeCodex(codex)));
  } catch {
    // quota / private mode — skip persist
  }
}

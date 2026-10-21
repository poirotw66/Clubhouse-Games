/**
 * Daily challenge: calendar date (UTC+8) seeds map + affix bag.
 * Fully deterministic — same date always yields the same challenge.
 */
import {
  MAP_ENTRANCES,
  type Difficulty,
  type MapId,
  type TowerType,
} from './constants.ts';
import type { RunModifiers } from './engine.ts';

export const DAILY_STORAGE_KEY = 'clockwork-keep:daily-v1';

const MAP_POOL: readonly MapId[] = ['open', 'corridor', 'fork', 'islands', 'dual', 'gauntlet'];

export type DailyAffixId =
  | 'thrift'
  | 'iron-tide'
  | 'no-sell'
  | 'dual-only'
  | 'artillery';

export interface DailyAffixDef {
  id: DailyAffixId;
  /** Traditional Chinese name shown in UI. */
  name: string;
  blurb: string;
}

export const DAILY_AFFIXES: Record<DailyAffixId, DailyAffixDef> = {
  thrift: { id: 'thrift', name: '拮据', blurb: '起始金幣 ×0.75' },
  'iron-tide': { id: 'iron-tide', name: '鐵潮', blurb: '敵人血量 ×1.12' },
  'no-sell': { id: 'no-sell', name: '一鏡', blurb: '全程不得售出塔' },
  'dual-only': { id: 'dual-only', name: '雙塔', blurb: '僅開放弩台與迫擊砲' },
  artillery: { id: 'artillery', name: '重火力', blurb: '僅開放磨盤、錘與迫擊砲' },
};

const AFFIX_POOL: readonly DailyAffixId[] = [
  'thrift',
  'iron-tide',
  'no-sell',
  'dual-only',
  'artillery',
];

export interface DailyChallenge {
  /** Calendar day YYYY-MM-DD in UTC+8. */
  date: string;
  mapId: MapId;
  difficulty: Difficulty;
  endless: boolean;
  affixIds: DailyAffixId[];
  /** Labels for HUD. */
  affixLabels: string[];
  modifiers: RunModifiers;
}

export interface DailyBestRecord {
  date: string;
  bestScore: number;
  bestWave: number;
  cleared: boolean;
  attempts: number;
}

/** FNV-1a 32-bit hash — deterministic, no Math.random. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Today's date key in UTC+8 (Asia/Taipei wall clock for the challenge calendar). */
export function todayKeyUTC8(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function pick<T>(pool: readonly T[], seed: number, salt: number): T {
  return pool[(seed + salt * 2654435761) % pool.length >>> 0];
}

/** Build the challenge for a calendar day. Same date → same challenge forever. */
export function dailyChallengeFor(date: string): DailyChallenge {
  const seed = hashString(`clockwork-keep:daily:${date}`);
  const mapId = pick(MAP_POOL, seed, 1);
  const difficulty = pick(['standard', 'harsh'] as const, seed, 3);
  // One or two affixes; second is skipped when it would collide with dual-only vs artillery.
  const first = pick(AFFIX_POOL, seed, 5);
  let second: DailyAffixId | null = pick(AFFIX_POOL, seed, 7);
  if (second === first) second = null;
  if (
    (first === 'dual-only' && second === 'artillery') ||
    (first === 'artillery' && second === 'dual-only')
  ) {
    // Tower-limit affixes are mutually exclusive — replace the second with an economy hit.
    second = 'thrift';
  }
  const affixIds: DailyAffixId[] = second ? [first, second] : [first];

  let goldMult = 1;
  let enemyHpBonusMult = 1;
  let allowSell = true;
  let allowedTowers: TowerType[] | null = null;
  const labels: string[] = [];

  for (const id of affixIds) {
    const def = DAILY_AFFIXES[id];
    labels.push(def.name);
    if (id === 'thrift') goldMult *= 0.75;
    if (id === 'iron-tide') enemyHpBonusMult *= 1.12;
    if (id === 'no-sell') allowSell = false;
    if (id === 'dual-only') allowedTowers = ['crossbow', 'mortar'];
    if (id === 'artillery') allowedTowers = ['grinder', 'hammer', 'mortar'];
  }

  // Sanity: dual map must advertise two entrances (guards drift if MAP_ENTRANCES changes).
  if (mapId === 'dual' && MAP_ENTRANCES.dual.length < 2) {
    throw new Error('dual map must define two entrances');
  }

  return {
    date,
    mapId,
    difficulty,
    endless: false,
    affixIds,
    affixLabels: labels,
    modifiers: {
      goldMult,
      enemyHpBonusMult,
      allowSell,
      allowedTowers,
      dailyDate: date,
      dailyAffixes: labels.map((name, i) => {
        const id = affixIds[i];
        return `${name}：${DAILY_AFFIXES[id].blurb}`;
      }),
    },
  };
}

export function loadDailyBest(): DailyBestRecord | null {
  try {
    const raw = localStorage.getItem(DAILY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DailyBestRecord>;
    if (typeof parsed.date !== 'string' || !parsed.date) return null;
    return {
      date: parsed.date,
      bestScore: Math.max(0, Math.floor(Number(parsed.bestScore) || 0)),
      bestWave: Math.max(0, Math.floor(Number(parsed.bestWave) || 0)),
      cleared: Boolean(parsed.cleared),
      attempts: Math.max(0, Math.floor(Number(parsed.attempts) || 0)),
    };
  } catch {
    return null;
  }
}

export function saveDailyBest(record: DailyBestRecord): void {
  try {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* ignore */
  }
}

export function mergeDailyBest(
  previous: DailyBestRecord | null,
  date: string,
  score: number,
  wave: number,
  cleared: boolean,
): DailyBestRecord {
  if (!previous || previous.date !== date) {
    return {
      date,
      bestScore: Math.max(0, Math.floor(score)),
      bestWave: Math.max(0, Math.floor(wave)),
      cleared,
      attempts: 1,
    };
  }
  return {
    date,
    bestScore: Math.max(previous.bestScore, Math.floor(score)),
    bestWave: Math.max(previous.bestWave, Math.floor(wave)),
    cleared: previous.cleared || cleared,
    attempts: previous.attempts + 1,
  };
}

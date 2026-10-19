/**
 * Playable crafts: distinct shot / focus tradeoffs. Starter is free; extras
 * unlock from free-play or mode-pack clears. Stats live in progress storage so
 * grinding a craft never overwrites the free-play best integer key.
 */
import type { RunState } from './types';

export const PROGRESS_STORAGE_KEY = 'danmaku-abyss:progress-v1';

export interface CraftDef {
  id: string;
  /** Traditional Chinese display name. */
  name: string;
  /** Short Traditional Chinese blurb for the picker. */
  blurb: string;
  /** Free-play / pack clears required to unlock (0 = starter). */
  unlockClears: number;
  /** Multipliers applied on top of upgrade-derived stats. */
  fireRateMult: number;
  damageMult: number;
  shotWidthBonus: number;
  /** Extra lateral reach for hitscan volleys (units). */
  reachBonus: number;
  focusSpeedMult: number;
  fastSpeedMult: number;
  hitboxMult: number;
  grazeRangeMult: number;
  /** Hull / beam paint for the canvas. */
  hullHue: number;
  beamHue: number;
}

/**
 * Three crafts with readable tradeoffs — not flat reskins:
 *   迅羽  balanced starter
 *   重炮  slow / hard / wide; sluggish focus
 *   縫影  tiny hitbox + fast focus; thin weak stream
 */
export const CRAFTS: readonly CraftDef[] = [
  {
    id: 'swift',
    name: '迅羽',
    blurb: '均衡機體・射速與機動無偏科',
    unlockClears: 0,
    fireRateMult: 1,
    damageMult: 1,
    shotWidthBonus: 0,
    reachBonus: 0,
    focusSpeedMult: 1,
    fastSpeedMult: 1,
    hitboxMult: 1,
    grazeRangeMult: 1,
    hullHue: 198,
    beamHue: 190,
  },
  {
    id: 'cannon',
    name: '重炮',
    blurb: '齊射更寬、單發更痛・射速與集中速度較慢',
    unlockClears: 1,
    fireRateMult: 0.72,
    damageMult: 1.45,
    shotWidthBonus: 2,
    reachBonus: 18,
    focusSpeedMult: 0.78,
    fastSpeedMult: 0.88,
    hitboxMult: 1.08,
    grazeRangeMult: 0.9,
    hullHue: 28,
    beamHue: 40,
  },
  {
    id: 'stitch',
    name: '縫影',
    blurb: '判定更小、集中更快・火力細弱、擦彈圈略大',
    unlockClears: 2,
    fireRateMult: 1.15,
    damageMult: 0.72,
    shotWidthBonus: -1,
    reachBonus: -8,
    focusSpeedMult: 1.28,
    fastSpeedMult: 1.06,
    hitboxMult: 0.78,
    grazeRangeMult: 1.2,
    hullHue: 280,
    beamHue: 300,
  },
];

export const DEFAULT_CRAFT_ID = CRAFTS[0].id;

export interface ProgressSave {
  /** Lifetime clears (free-play wins + mode goals met). Unlocks crafts. */
  clearCount: number;
  /** Best free-play score per craft id. */
  craftBest: Record<string, number>;
  /** Spell card ids captured at least once. */
  capturedSpells: Record<string, true>;
  selectedCraftId: string;
}

export const EMPTY_PROGRESS: ProgressSave = {
  clearCount: 0,
  craftBest: {},
  capturedSpells: {},
  selectedCraftId: DEFAULT_CRAFT_ID,
};

export function craftById(id: string): CraftDef {
  return CRAFTS.find((c) => c.id === id) ?? CRAFTS[0];
}

export function isCraftUnlocked(craft: CraftDef, clearCount: number): boolean {
  return clearCount >= craft.unlockClears;
}

export function loadProgress(): ProgressSave {
  try {
    const raw = localStorage.getItem(PROGRESS_STORAGE_KEY);
    if (!raw) return { ...EMPTY_PROGRESS, craftBest: {}, capturedSpells: {} };
    const parsed = JSON.parse(raw) as Partial<ProgressSave>;
    const clearCount = Math.max(0, Math.floor(Number(parsed.clearCount) || 0));
    const craftBest: Record<string, number> = {};
    if (parsed.craftBest && typeof parsed.craftBest === 'object') {
      for (const [id, score] of Object.entries(parsed.craftBest)) {
        if (CRAFTS.some((c) => c.id === id) && typeof score === 'number' && score > 0) {
          craftBest[id] = Math.floor(score);
        }
      }
    }
    const capturedSpells: Record<string, true> = {};
    if (parsed.capturedSpells && typeof parsed.capturedSpells === 'object') {
      for (const id of Object.keys(parsed.capturedSpells)) {
        capturedSpells[id] = true;
      }
    }
    const selected =
      typeof parsed.selectedCraftId === 'string' && CRAFTS.some((c) => c.id === parsed.selectedCraftId)
        ? parsed.selectedCraftId
        : DEFAULT_CRAFT_ID;
    return { clearCount, craftBest, capturedSpells, selectedCraftId: selected };
  } catch {
    return { ...EMPTY_PROGRESS, craftBest: {}, capturedSpells: {} };
  }
}

export function saveProgress(progress: ProgressSave): void {
  try {
    localStorage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* ignore quota / private mode */
  }
}

/**
 * Merge a finished free-play run into progress. Mode-pack clears call
 * `recordModeClear` separately so pack grinding still unlocks crafts.
 */
export function applyFreePlayResult(
  progress: ProgressSave,
  state: RunState,
): ProgressSave {
  const craftId = state.craftId || DEFAULT_CRAFT_ID;
  const craftBest = { ...progress.craftBest };
  const prev = craftBest[craftId] ?? 0;
  if (state.score > prev) craftBest[craftId] = state.score;

  const capturedSpells = { ...progress.capturedSpells };
  for (const id of state.capturedCardIds) {
    capturedSpells[id] = true;
  }

  let clearCount = progress.clearCount;
  if (state.phase === 'won') clearCount += 1;

  return {
    ...progress,
    clearCount,
    craftBest,
    capturedSpells,
  };
}

/** Mode goal met: count as a clear for craft unlocks and merge captures. */
export function applyModeClearToProgress(
  progress: ProgressSave,
  state: RunState,
  goalMet: boolean,
): ProgressSave {
  const capturedSpells = { ...progress.capturedSpells };
  for (const id of state.capturedCardIds) {
    capturedSpells[id] = true;
  }
  return {
    ...progress,
    clearCount: goalMet ? progress.clearCount + 1 : progress.clearCount,
    capturedSpells,
  };
}

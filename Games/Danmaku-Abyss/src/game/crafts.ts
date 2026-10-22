/**
 * Playable crafts: distinct shot styles, hitboxes, and special skills. Starter
 * is free; extras unlock from free-play or mode-pack clears. Stats live in
 * progress storage so grinding a craft never overwrites the free-play best key.
 */
import type { RunState } from './types';

export const PROGRESS_STORAGE_KEY = 'danmaku-abyss:progress-v1';

/** How hitscan volleys distribute damage across the field. */
export type ShotStyle = 'balanced' | 'wide' | 'needle';

/** Cooldown special unique to each craft (X / 特技 button). */
export type SpecialKind = 'dash' | 'overdrive' | 'rift';

export interface CraftSpecial {
  kind: SpecialKind;
  /** Traditional Chinese short name shown in HUD / picker. */
  name: string;
  /** One-line Traditional Chinese description. */
  blurb: string;
  /** Seconds before the special can be used again. */
  cooldown: number;
  /** Active window length in seconds. */
  duration: number;
}

export interface CraftDef {
  id: string;
  /** Traditional Chinese display name. */
  name: string;
  /** Short Traditional Chinese blurb for the picker. */
  blurb: string;
  /** Free-play / pack clears required to unlock (0 = starter). */
  unlockClears: number;
  /** Hitscan distribution style — not just numeric multipliers. */
  shotStyle: ShotStyle;
  special: CraftSpecial;
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
 *   迅羽  balanced starter + dash special
 *   重炮  wide hard shots + overdrive special
 *   縫影  needle stream, tiny hitbox + rift special
 */
export const CRAFTS: readonly CraftDef[] = [
  {
    id: 'swift',
    name: '迅羽',
    blurb: '均衡扇射・特技「羽閃」短距突進並短暫無敵',
    unlockClears: 0,
    shotStyle: 'balanced',
    special: {
      kind: 'dash',
      name: '羽閃',
      blurb: '短距突進並短暫無敵',
      cooldown: 7.5,
      duration: 0.28,
    },
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
    blurb: '寬幅重擊・特技「過載」短暫暴傷但減速',
    unlockClears: 1,
    shotStyle: 'wide',
    special: {
      kind: 'overdrive',
      name: '過載',
      blurb: '短暫暴傷，移動變慢',
      cooldown: 9,
      duration: 2.4,
    },
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
    blurb: '細針集火・判定更小・特技「縫隙」清近彈並擴擦彈圈',
    unlockClears: 2,
    shotStyle: 'needle',
    special: {
      kind: 'rift',
      name: '縫隙',
      blurb: '清近彈並短暫擴大擦彈圈',
      cooldown: 8.5,
      duration: 1.8,
    },
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

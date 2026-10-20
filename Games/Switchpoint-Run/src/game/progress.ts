/**
 * Persistent meta: rail bolts, unlocked runners/themes/modifiers, per-mode
 * records, and daily best-of-day. Every field is validated on parse so a
 * corrupted localStorage blob never crashes the title screen.
 */
import { dailySeedCode, EMPTY_DAILY_BEST, mergeDailyBest, todayKey, type DailyBestRecord } from './daily';
import { isModifierId, MODIFIERS, type ModifierId } from './modifiers';
import {
  DEFAULT_RUNNER_ID,
  isRunnerId,
  RUNNERS,
  type RunnerId,
} from './profiles';
import {
  DEFAULT_THEME_ID,
  isThemeId,
  THEMES,
  type ThemeId,
} from './themes';
import type { RunState } from './types';
import { finalScore } from './engine';

export const META_STORAGE_KEY = 'switchpoint-run:meta-v1';
/** Legacy free-play keys — migrated once into meta on first load. */
export const LEGACY_BEST_DIST_KEY = 'switchpoint-run:best-distance';
export const LEGACY_BEST_SCORE_KEY = 'switchpoint-run:best-score';

export type RunMode = 'free' | 'daily' | 'challenge';

export interface ModeRecord {
  bestDistance: number;
  bestScore: number;
  runs: number;
}

export interface MetaProgress {
  bolts: number;
  unlockedRunners: RunnerId[];
  unlockedThemes: ThemeId[];
  unlockedModifiers: ModifierId[];
  selectedRunnerId: RunnerId;
  selectedThemeId: ThemeId;
  /** Modifiers equipped for the next free/daily run (challenge ignores). */
  equippedModifiers: ModifierId[];
  free: ModeRecord;
  daily: DailyBestRecord;
  challenge: ModeRecord;
  totalRuns: number;
  lifetimeDistance: number;
  lifetimeBranches: number;
}

export const EMPTY_MODE_RECORD: ModeRecord = {
  bestDistance: 0,
  bestScore: 0,
  runs: 0,
};

export function defaultMeta(): MetaProgress {
  return {
    bolts: 0,
    unlockedRunners: [DEFAULT_RUNNER_ID],
    unlockedThemes: [DEFAULT_THEME_ID],
    unlockedModifiers: [],
    selectedRunnerId: DEFAULT_RUNNER_ID,
    selectedThemeId: DEFAULT_THEME_ID,
    equippedModifiers: [],
    free: { ...EMPTY_MODE_RECORD },
    daily: { ...EMPTY_DAILY_BEST },
    challenge: { ...EMPTY_MODE_RECORD },
    totalRuns: 0,
    lifetimeDistance: 0,
    lifetimeBranches: 0,
  };
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(v)));
}

function parseModeRecord(raw: unknown): ModeRecord {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_MODE_RECORD };
  const r = raw as Partial<ModeRecord>;
  return {
    bestDistance: clampInt(r.bestDistance, 0, 99_999_999, 0),
    bestScore: clampInt(r.bestScore, 0, 99_999_999, 0),
    runs: clampInt(r.runs, 0, 9_999_999, 0),
  };
}

function parseDaily(raw: unknown): DailyBestRecord {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_DAILY_BEST };
  const r = raw as Partial<DailyBestRecord>;
  const date = typeof r.date === 'string' && /^\d{8}$/.test(r.date) ? r.date : '';
  return {
    date,
    bestDistance: clampInt(r.bestDistance, 0, 99_999_999, 0),
    bestScore: clampInt(r.bestScore, 0, 99_999_999, 0),
    attempts: clampInt(r.attempts, 0, 9_999_999, 0),
  };
}

function syncUnlocks(meta: MetaProgress): MetaProgress {
  const runners = new Set<RunnerId>([DEFAULT_RUNNER_ID]);
  for (const id of meta.unlockedRunners) {
    if (isRunnerId(id)) runners.add(id);
  }
  // Milestone unlocks for modifiers (distance thresholds).
  const unlockedMods = new Set<ModifierId>();
  for (const id of meta.unlockedModifiers) {
    if (isModifierId(id)) unlockedMods.add(id);
  }
  for (const mod of MODIFIERS) {
    if (meta.free.bestDistance >= mod.unlockBestDistance) unlockedMods.add(mod.id);
  }

  const themes = new Set<ThemeId>([DEFAULT_THEME_ID]);
  for (const id of meta.unlockedThemes) {
    if (isThemeId(id)) themes.add(id);
  }

  const unlockedRunners = RUNNERS.map((r) => r.id).filter((id) => runners.has(id));
  const unlockedThemes = THEMES.map((t) => t.id).filter((id) => themes.has(id));
  const unlockedModifiers = MODIFIERS.map((m) => m.id).filter((id) => unlockedMods.has(id));

  const selectedRunnerId = unlockedRunners.includes(meta.selectedRunnerId)
    ? meta.selectedRunnerId
    : DEFAULT_RUNNER_ID;
  const selectedThemeId = unlockedThemes.includes(meta.selectedThemeId)
    ? meta.selectedThemeId
    : DEFAULT_THEME_ID;
  const equippedModifiers = meta.equippedModifiers.filter((id) => unlockedModifiers.includes(id));

  return {
    ...meta,
    unlockedRunners,
    unlockedThemes,
    unlockedModifiers,
    selectedRunnerId,
    selectedThemeId,
    equippedModifiers,
  };
}

function parseMeta(raw: string): MetaProgress {
  const parsed = JSON.parse(raw) as Partial<MetaProgress>;
  const base = defaultMeta();
  const unlockedRunners: RunnerId[] = [DEFAULT_RUNNER_ID];
  if (Array.isArray(parsed.unlockedRunners)) {
    for (const id of parsed.unlockedRunners) {
      if (isRunnerId(id) && !unlockedRunners.includes(id)) unlockedRunners.push(id);
    }
  }
  const unlockedThemes: ThemeId[] = [DEFAULT_THEME_ID];
  if (Array.isArray(parsed.unlockedThemes)) {
    for (const id of parsed.unlockedThemes) {
      if (isThemeId(id) && !unlockedThemes.includes(id)) unlockedThemes.push(id);
    }
  }
  const unlockedModifiers: ModifierId[] = [];
  if (Array.isArray(parsed.unlockedModifiers)) {
    for (const id of parsed.unlockedModifiers) {
      if (isModifierId(id) && !unlockedModifiers.includes(id)) unlockedModifiers.push(id);
    }
  }
  const equippedModifiers: ModifierId[] = [];
  if (Array.isArray(parsed.equippedModifiers)) {
    for (const id of parsed.equippedModifiers) {
      if (isModifierId(id) && !equippedModifiers.includes(id)) equippedModifiers.push(id);
    }
  }
  const draft: MetaProgress = {
    bolts: clampInt(parsed.bolts, 0, 9_999_999, 0),
    unlockedRunners,
    unlockedThemes,
    unlockedModifiers,
    selectedRunnerId: isRunnerId(parsed.selectedRunnerId)
      ? parsed.selectedRunnerId
      : DEFAULT_RUNNER_ID,
    selectedThemeId: isThemeId(parsed.selectedThemeId) ? parsed.selectedThemeId : DEFAULT_THEME_ID,
    equippedModifiers,
    free: parseModeRecord(parsed.free),
    daily: parseDaily(parsed.daily),
    challenge: parseModeRecord(parsed.challenge),
    totalRuns: clampInt(parsed.totalRuns, 0, 9_999_999, 0),
    lifetimeDistance: clampInt(parsed.lifetimeDistance, 0, 99_999_999, 0),
    lifetimeBranches: clampInt(parsed.lifetimeBranches, 0, 9_999_999, 0),
  };
  // Soft-merge legacy keys if meta never saw them (browser only).
  if (
    typeof window !== 'undefined' &&
    draft.free.bestDistance === 0 &&
    draft.free.bestScore === 0
  ) {
    try {
      const ld = Number(window.localStorage.getItem(LEGACY_BEST_DIST_KEY));
      const ls = Number(window.localStorage.getItem(LEGACY_BEST_SCORE_KEY));
      if (Number.isFinite(ld) && ld > 0) draft.free.bestDistance = Math.floor(ld);
      if (Number.isFinite(ls) && ls > 0) draft.free.bestScore = Math.floor(ls);
    } catch {
      // ignore
    }
  }
  void base;
  return syncUnlocks(draft);
}

export function loadMeta(): MetaProgress {
  try {
    const raw = window.localStorage.getItem(META_STORAGE_KEY);
    if (!raw) {
      // Migrate legacy bests into a fresh meta blob.
      const draft = defaultMeta();
      try {
        const ld = Number(window.localStorage.getItem(LEGACY_BEST_DIST_KEY));
        const ls = Number(window.localStorage.getItem(LEGACY_BEST_SCORE_KEY));
        if (Number.isFinite(ld) && ld > 0) draft.free.bestDistance = Math.floor(ld);
        if (Number.isFinite(ls) && ls > 0) draft.free.bestScore = Math.floor(ls);
      } catch {
        // ignore
      }
      return syncUnlocks(draft);
    }
    return parseMeta(raw);
  } catch {
    return syncUnlocks(defaultMeta());
  }
}

export function saveMeta(meta: MetaProgress): MetaProgress {
  const synced = syncUnlocks(meta);
  try {
    window.localStorage.setItem(META_STORAGE_KEY, JSON.stringify(synced));
  } catch {
    // Private mode / quota: best-effort only.
  }
  return synced;
}

/** Pure parse for headless tests (no window). */
export function parseMetaJson(raw: string): MetaProgress {
  try {
    return syncUnlocks(parseMeta(raw));
  } catch {
    return syncUnlocks(defaultMeta());
  }
}

/** Rail bolts earned from one finished run. */
export function boltsFromRun(state: RunState, mode: RunMode, modifierBonus = 0): number {
  const dist = Math.round(state.distance);
  const score = finalScore(state);
  const base =
    Math.floor(dist / 120) +
    state.branchesCleared * 2 +
    Math.floor(state.maxNoHitStreak / 3) +
    Math.floor(score / 800);
  const modeMul = mode === 'daily' ? 1.25 : mode === 'challenge' ? 1.1 : 1;
  return Math.max(1, Math.floor(base * modeMul) + modifierBonus);
}

export interface SettlementInput {
  state: RunState;
  mode: RunMode;
  /** YYYYMMDD when mode === 'daily'. */
  dailyDate?: string;
  modifierBoltBonus?: number;
}

export interface SettlementResult {
  meta: MetaProgress;
  boltsEarned: number;
  newRunners: RunnerId[];
  newThemes: ThemeId[];
  newModifiers: ModifierId[];
  newFreeBest: boolean;
  newDailyBest: boolean;
}

/** Merge a finished run into meta (records, bolts, milestone unlocks). */
export function settleRun(previous: MetaProgress, input: SettlementInput): SettlementResult {
  const dist = Math.round(input.state.distance);
  const score = finalScore(input.state);
  const boltsEarned = boltsFromRun(input.state, input.mode, input.modifierBoltBonus ?? 0);
  const prevRunners = new Set(previous.unlockedRunners);
  const prevThemes = new Set(previous.unlockedThemes);
  const prevMods = new Set(previous.unlockedModifiers);

  let free = { ...previous.free };
  let challenge = { ...previous.challenge };
  let daily = { ...previous.daily };
  let newFreeBest = false;
  let newDailyBest = false;

  if (input.mode === 'free') {
    newFreeBest = dist > free.bestDistance || score > free.bestScore;
    free = {
      bestDistance: Math.max(free.bestDistance, dist),
      bestScore: Math.max(free.bestScore, score),
      runs: free.runs + 1,
    };
  } else if (input.mode === 'challenge') {
    challenge = {
      bestDistance: Math.max(challenge.bestDistance, dist),
      bestScore: Math.max(challenge.bestScore, score),
      runs: challenge.runs + 1,
    };
  } else if (input.mode === 'daily' && input.dailyDate) {
    const before = daily;
    daily = mergeDailyBest(daily, input.dailyDate, dist, score);
    newDailyBest =
      before.date !== input.dailyDate ||
      dist > before.bestDistance ||
      score > before.bestScore;
  }

  const draft: MetaProgress = {
    ...previous,
    bolts: previous.bolts + boltsEarned,
    free,
    challenge,
    daily,
    totalRuns: previous.totalRuns + 1,
    lifetimeDistance: previous.lifetimeDistance + dist,
    lifetimeBranches: previous.lifetimeBranches + input.state.branchesCleared,
  };
  const meta = saveMeta(draft);
  return {
    meta,
    boltsEarned,
    newRunners: meta.unlockedRunners.filter((id) => !prevRunners.has(id)),
    newThemes: meta.unlockedThemes.filter((id) => !prevThemes.has(id)),
    newModifiers: meta.unlockedModifiers.filter((id) => !prevMods.has(id)),
    newFreeBest,
    newDailyBest,
  };
}

export function buyRunner(meta: MetaProgress, id: RunnerId): MetaProgress | null {
  if (meta.unlockedRunners.includes(id)) return null;
  const runner = RUNNERS.find((r) => r.id === id);
  if (!runner || runner.cost <= 0) return null;
  if (meta.bolts < runner.cost) return null;
  return saveMeta({
    ...meta,
    bolts: meta.bolts - runner.cost,
    unlockedRunners: [...meta.unlockedRunners, id],
    selectedRunnerId: id,
  });
}

export function buyTheme(meta: MetaProgress, id: ThemeId): MetaProgress | null {
  if (meta.unlockedThemes.includes(id)) return null;
  const theme = THEMES.find((t) => t.id === id);
  if (!theme || theme.cost <= 0) return null;
  if (meta.bolts < theme.cost) return null;
  return saveMeta({
    ...meta,
    bolts: meta.bolts - theme.cost,
    unlockedThemes: [...meta.unlockedThemes, id],
    selectedThemeId: id,
  });
}

export function selectRunner(meta: MetaProgress, id: RunnerId): MetaProgress | null {
  if (!meta.unlockedRunners.includes(id)) return null;
  return saveMeta({ ...meta, selectedRunnerId: id });
}

export function selectTheme(meta: MetaProgress, id: ThemeId): MetaProgress | null {
  if (!meta.unlockedThemes.includes(id)) return null;
  return saveMeta({ ...meta, selectedThemeId: id });
}

export function toggleModifier(meta: MetaProgress, id: ModifierId): MetaProgress | null {
  if (!meta.unlockedModifiers.includes(id)) return null;
  const equipped = meta.equippedModifiers.includes(id)
    ? meta.equippedModifiers.filter((m) => m !== id)
    : [...meta.equippedModifiers, id];
  return saveMeta({ ...meta, equippedModifiers: equipped });
}

/** Today's daily seed + whether we already have a best for it. */
export function dailyStatus(meta: MetaProgress, now: Date = new Date()): {
  date: string;
  seedCode: string;
  best: DailyBestRecord | null;
} {
  const date = todayKey(now);
  const seedCode = dailySeedCode(now);
  const best = meta.daily.date === date ? meta.daily : null;
  return { date, seedCode, best };
}

/**
 * Title-level mode / level pack: practice stages, hard clear, and authored
 * spell-card challenges. Progress and per-mode best scores are stored apart
 * from free-play `danmaku-abyss:best` so grinding a pack never overwrites it.
 */
import { STAGE_COUNT } from './constants';
import { ALL_BOSSES } from './cards';
import type { RunState } from './types';

export const MODES_STORAGE_KEY = 'danmaku-abyss:modes-v1';

export type ModeGoal =
  /** Reach `phase === 'won'` under the mode's run config. */
  | { kind: 'clear' }
  /** Win and capture at least `min` spell cards this run. */
  | { kind: 'capture'; min: number }
  /** Win with score at least `min`. */
  | { kind: 'score'; min: number };

export interface ModeRunConfig {
  startStage: number;
  /** Inclusive: clearing this stage ends the mode (win). */
  endStage: number;
  /** Added on top of `intensityFor`. */
  intensityBonus: number;
  lives: number;
  bombs: number;
  /** Skip midway waves; spawn the stage boss immediately. */
  skipMidway: boolean;
  /** Which card of the stage boss to open on (0-based). */
  startCardIndex: number;
  /** Fight only `startCardIndex`, then clear the stage (no later cards). */
  singleCard: boolean;
}

export interface ModeDef {
  id: string;
  /** Traditional Chinese display name. */
  name: string;
  /** Short Traditional Chinese blurb for the mode list. */
  blurb: string;
  /** One-line goal reminder. */
  goalLabel: string;
  /** Fixed seed so the pack is grindable and checkable. */
  seedCode: string;
  goal: ModeGoal;
  run: ModeRunConfig;
}

/**
 * Six authored modes: three practice stages, one hard full clear, two spell
 * challenges. Unlock is sequential by pack index (same pattern as Liquid-Sort /
 * Baseball-Life packs).
 */
export const MODE_PACK: readonly ModeDef[] = [
  {
    id: 'practice-lamp',
    name: '燈守演習',
    blurb: '練習・僅第 1 階段・跳過道中直上王戰',
    goalLabel: '擊破燈守全符卡',
    seedCode: 'mode-lamp',
    goal: { kind: 'clear' },
    run: {
      startStage: 1,
      endStage: 1,
      intensityBonus: 0,
      lives: 3,
      bombs: 3,
      skipMidway: true,
      startCardIndex: 0,
      singleCard: false,
    },
  },
  {
    id: 'practice-tide',
    name: '潮鳴演習',
    blurb: '練習・僅第 2 階段・跳過道中',
    goalLabel: '擊破潮鳴全符卡',
    seedCode: 'mode-tide',
    goal: { kind: 'clear' },
    run: {
      startStage: 2,
      endStage: 2,
      intensityBonus: 0,
      lives: 3,
      bombs: 3,
      skipMidway: true,
      startCardIndex: 0,
      singleCard: false,
    },
  },
  {
    id: 'practice-frost',
    name: '刃霜演習',
    blurb: '練習・僅第 3 階段・含凍符「靜止的雨」',
    goalLabel: '擊破刃霜全符卡',
    seedCode: 'mode-frost',
    goal: { kind: 'clear' },
    run: {
      startStage: 3,
      endStage: 3,
      intensityBonus: 0,
      lives: 3,
      bombs: 3,
      skipMidway: true,
      startCardIndex: 0,
      singleCard: false,
    },
  },
  {
    id: 'hard-abyss',
    name: '高難深潛',
    blurb: '五階段全通・強度＋0.55・殘機／靈擊各 2',
    goalLabel: '通關五階段',
    seedCode: 'mode-hard',
    goal: { kind: 'clear' },
    run: {
      startStage: 1,
      endStage: STAGE_COUNT,
      intensityBonus: 0.55,
      lives: 2,
      bombs: 2,
      skipMidway: false,
      startCardIndex: 0,
      singleCard: false,
    },
  },
  {
    id: 'spell-frost-rain',
    name: '符卡・靜止的雨',
    blurb: '指定符卡・凍符「靜止的雨」・必須 Capture',
    goalLabel: 'Capture 凍符「靜止的雨」',
    seedCode: 'mode-rain',
    goal: { kind: 'capture', min: 1 },
    run: {
      startStage: 3,
      endStage: 3,
      intensityBonus: 0,
      lives: 3,
      bombs: 3,
      skipMidway: true,
      startCardIndex: 2,
      singleCard: true,
    },
  },
  {
    id: 'spell-abyss-gaze',
    name: '符卡・深淵回望',
    blurb: '指定符卡・終符「深淵回望」・必須 Capture',
    goalLabel: 'Capture 終符「深淵回望」',
    seedCode: 'mode-gaze',
    goal: { kind: 'capture', min: 1 },
    run: {
      startStage: 5,
      endStage: 5,
      intensityBonus: 0.25,
      lives: 3,
      bombs: 2,
      skipMidway: true,
      startCardIndex: 2,
      singleCard: true,
    },
  },
];

export interface ModeProgress {
  /** Sequential unlock cursor: modes with index < clearedCount are done. */
  clearedCount: number;
  cleared: Record<string, true>;
  /** Best score per mode id (updated on any finished run of that mode). */
  bestScore: Record<string, number>;
}

export const EMPTY_MODE_PROGRESS: ModeProgress = {
  clearedCount: 0,
  cleared: {},
  bestScore: {},
};

export function modeCount(): number {
  return MODE_PACK.length;
}

export function modeAt(index: number): ModeDef | undefined {
  return MODE_PACK[index];
}

export function modeById(id: string): ModeDef | undefined {
  return MODE_PACK.find((m) => m.id === id);
}

export function modeIndexOf(id: string): number {
  return MODE_PACK.findIndex((m) => m.id === id);
}

export function isModeUnlocked(index: number, clearedCount: number): boolean {
  if (index < 0 || index >= MODE_PACK.length) return false;
  return index <= clearedCount;
}

export function continueModeIndex(clearedCount: number): number {
  if (clearedCount >= MODE_PACK.length) return MODE_PACK.length - 1;
  return Math.max(0, clearedCount);
}

export function evaluateModeGoal(mode: ModeDef, state: RunState): boolean {
  if (state.phase !== 'won') return false;
  const goal = mode.goal;
  if (goal.kind === 'clear') return true;
  if (goal.kind === 'capture') return state.captures >= goal.min;
  if (goal.kind === 'score') return state.score >= goal.min;
  return false;
}

/**
 * Apply a finished mode run onto progress. Only advances the unlock cursor when
 * the next locked mode is cleared (same sequential rule as other packs).
 */
export function applyModeResult(
  progress: ModeProgress,
  modeIndex: number,
  state: RunState,
): ModeProgress {
  const mode = MODE_PACK[modeIndex];
  if (!mode) return progress;

  const bestScore = { ...progress.bestScore };
  const prevBest = bestScore[mode.id] ?? 0;
  if (state.score > prevBest) bestScore[mode.id] = state.score;

  const cleared = { ...progress.cleared };
  let clearedCount = progress.clearedCount;

  if (evaluateModeGoal(mode, state)) {
    cleared[mode.id] = true;
    if (modeIndex === clearedCount && clearedCount < MODE_PACK.length) {
      clearedCount += 1;
    }
  }

  return { clearedCount, cleared, bestScore };
}

export function loadModeProgress(): ModeProgress {
  try {
    const raw = localStorage.getItem(MODES_STORAGE_KEY);
    if (!raw) return { ...EMPTY_MODE_PROGRESS, cleared: {}, bestScore: {} };
    const parsed = JSON.parse(raw) as Partial<ModeProgress>;
    const clearedCount = Math.max(
      0,
      Math.min(MODE_PACK.length, Math.floor(Number(parsed.clearedCount) || 0)),
    );
    const cleared: Record<string, true> = {};
    if (parsed.cleared && typeof parsed.cleared === 'object') {
      for (const id of Object.keys(parsed.cleared)) {
        if (modeById(id)) cleared[id] = true;
      }
    }
    const bestScore: Record<string, number> = {};
    if (parsed.bestScore && typeof parsed.bestScore === 'object') {
      for (const [id, score] of Object.entries(parsed.bestScore)) {
        if (modeById(id) && typeof score === 'number' && score > 0) {
          bestScore[id] = Math.floor(score);
        }
      }
    }
    return { clearedCount, cleared, bestScore };
  } catch {
    return { ...EMPTY_MODE_PROGRESS, cleared: {}, bestScore: {} };
  }
}

export function saveModeProgress(progress: ModeProgress): void {
  try {
    localStorage.setItem(MODES_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Self-check: every mode's startCardIndex points at a real card. */
export function assertModeCardTargets(): void {
  for (const mode of MODE_PACK) {
    const boss = ALL_BOSSES[mode.run.startStage - 1];
    if (!boss) {
      throw new Error(`mode ${mode.id}: startStage ${mode.run.startStage} has no boss`);
    }
    if (mode.run.startCardIndex < 0 || mode.run.startCardIndex >= boss.cards.length) {
      throw new Error(
        `mode ${mode.id}: startCardIndex ${mode.run.startCardIndex} out of range for ${boss.name}`,
      );
    }
    if (mode.run.endStage < mode.run.startStage) {
      throw new Error(`mode ${mode.id}: endStage < startStage`);
    }
  }
}

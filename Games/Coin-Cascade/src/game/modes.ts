/**
 * Title-level challenge / mode pack: score gates, cascade gates, and a timed
 * rush. Progress and per-mode best scores live apart from free-play
 * `coin-cascade:best` so grinding the pack never overwrites it.
 */
import type { RunState } from './types';

export const MODES_STORAGE_KEY = 'coin-cascade:modes-v1';

export type ModeGoal =
  | { kind: 'score'; min: number }
  | { kind: 'cascade'; min: number };

export interface ModeRunConfig {
  /** Credits granted at run start (overrides free-play STARTING_CREDITS). */
  startingCredits: number;
  /**
   * Playable tick budget after the opening settle; null = no clock.
   * When the deadline hits, drops stop and the run settles out.
   */
  timeLimitTicks: number | null;
  /** End early once score reaches the goal (after settle grace). */
  earlyClearScore: boolean;
  /** End early once longest cascade reaches the goal (after settle grace). */
  earlyClearCascade: boolean;
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
 * Six authored modes: three score gates, two cascade gates, one timed rush.
 * Unlock is sequential by pack index (same pattern as Danmaku / Liquid-Sort).
 */
export const MODE_PACK: readonly ModeDef[] = [
  {
    id: 'score-novice',
    name: '分數入門',
    blurb: '投幣 100・分數達標即可提前結束',
    goalLabel: '分數達到 70',
    seedCode: 'cc-score-1',
    goal: { kind: 'score', min: 70 },
    run: {
      startingCredits: 100,
      timeLimitTicks: null,
      earlyClearScore: true,
      earlyClearCascade: false,
    },
  },
  {
    id: 'score-steady',
    name: '穩健回收',
    blurb: '投幣 180・回收接近機台期望',
    goalLabel: '分數達到 130',
    seedCode: 'cc-score-2',
    goal: { kind: 'score', min: 130 },
    run: {
      startingCredits: 180,
      timeLimitTicks: null,
      earlyClearScore: true,
      earlyClearCascade: false,
    },
  },
  {
    id: 'score-surge',
    name: '高分潮',
    blurb: '投幣 220・高於平均返還才算過',
    goalLabel: '分數達到 190',
    seedCode: 'cc-score-3',
    goal: { kind: 'score', min: 190 },
    run: {
      startingCredits: 220,
      timeLimitTicks: null,
      earlyClearScore: true,
      earlyClearCascade: false,
    },
  },
  {
    id: 'cascade-trio',
    name: '連鎖起步',
    blurb: '投幣 120・單次推程連鎖達標即過',
    goalLabel: '最長連鎖達到 4',
    seedCode: 'cc-casc-1',
    goal: { kind: 'cascade', min: 4 },
    run: {
      startingCredits: 120,
      timeLimitTicks: null,
      earlyClearScore: false,
      earlyClearCascade: true,
    },
  },
  {
    id: 'cascade-avalanche',
    name: '雪崩挑戰',
    blurb: '投幣 200・推程雪崩六枚以上',
    goalLabel: '最長連鎖達到 6',
    seedCode: 'cc-casc-2',
    goal: { kind: 'cascade', min: 6 },
    run: {
      startingCredits: 200,
      timeLimitTicks: null,
      earlyClearScore: false,
      earlyClearCascade: true,
    },
  },
  {
    id: 'timed-rush',
    name: '限時衝刺',
    blurb: '75 秒・投幣充足但時間會掐斷',
    goalLabel: '75 秒內分數達到 45',
    seedCode: 'cc-time-1',
    goal: { kind: 'score', min: 45 },
    run: {
      startingCredits: 220,
      // 75s at FIXED_DT = 1/60 → 4500 ticks of play after settle.
      timeLimitTicks: 4500,
      earlyClearScore: true,
      earlyClearCascade: false,
    },
  },
];

export interface ModeProgress {
  /** Sequential unlock cursor: modes with index < clearedCount are done. */
  clearedCount: number;
  cleared: Record<string, true>;
  /** Best score per mode id (updated on any finished run of that mode). */
  bestScore: Record<string, number>;
  /** Best longest-cascade per mode id. */
  bestCascade: Record<string, number>;
}

export const EMPTY_MODE_PROGRESS: ModeProgress = {
  clearedCount: 0,
  cleared: {},
  bestScore: {},
  bestCascade: {},
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
  if (state.phase !== 'ended') return false;
  const goal = mode.goal;
  if (goal.kind === 'score') return state.score >= goal.min;
  if (goal.kind === 'cascade') return state.longestCascade >= goal.min;
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

  const bestCascade = { ...progress.bestCascade };
  const prevCasc = bestCascade[mode.id] ?? 0;
  if (state.longestCascade > prevCasc) bestCascade[mode.id] = state.longestCascade;

  const cleared = { ...progress.cleared };
  let clearedCount = progress.clearedCount;

  if (evaluateModeGoal(mode, state)) {
    cleared[mode.id] = true;
    if (modeIndex === clearedCount && clearedCount < MODE_PACK.length) {
      clearedCount += 1;
    }
  }

  return { clearedCount, cleared, bestScore, bestCascade };
}

export function loadModeProgress(): ModeProgress {
  try {
    const raw = localStorage.getItem(MODES_STORAGE_KEY);
    if (!raw) {
      return { ...EMPTY_MODE_PROGRESS, cleared: {}, bestScore: {}, bestCascade: {} };
    }
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
    const bestCascade: Record<string, number> = {};
    if (parsed.bestCascade && typeof parsed.bestCascade === 'object') {
      for (const [id, cascade] of Object.entries(parsed.bestCascade)) {
        if (modeById(id) && typeof cascade === 'number' && cascade > 0) {
          bestCascade[id] = Math.floor(cascade);
        }
      }
    }
    return { clearedCount, cleared, bestScore, bestCascade };
  } catch {
    return { ...EMPTY_MODE_PROGRESS, cleared: {}, bestScore: {}, bestCascade: {} };
  }
}

export function saveModeProgress(progress: ModeProgress): void {
  try {
    localStorage.setItem(MODES_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Map a ModeDef onto createRun options (engine knobs only). */
export function modeCreateOptions(mode: ModeDef): {
  startingCredits: number;
  timeLimitTicks: number | null;
  modeId: string;
  clearScore: number | null;
  clearCascade: number | null;
} {
  return {
    startingCredits: mode.run.startingCredits,
    timeLimitTicks: mode.run.timeLimitTicks,
    modeId: mode.id,
    clearScore: mode.run.earlyClearScore && mode.goal.kind === 'score' ? mode.goal.min : null,
    clearCascade:
      mode.run.earlyClearCascade && mode.goal.kind === 'cascade' ? mode.goal.min : null,
  };
}

/** Self-check: pack shape, unique ids, sensible goals. */
export function assertModePackShape(): void {
  if (MODE_PACK.length < 6) {
    throw new Error(`mode pack too thin: ${MODE_PACK.length}`);
  }
  const ids = new Set<string>();
  const seeds = new Set<string>();
  for (const mode of MODE_PACK) {
    if (ids.has(mode.id)) throw new Error(`duplicate mode id ${mode.id}`);
    ids.add(mode.id);
    if (seeds.has(mode.seedCode)) throw new Error(`duplicate mode seed ${mode.seedCode}`);
    seeds.add(mode.seedCode);
    if (mode.run.startingCredits < 1) {
      throw new Error(`mode ${mode.id}: startingCredits must be positive`);
    }
    if (mode.run.timeLimitTicks !== null && mode.run.timeLimitTicks < 60) {
      throw new Error(`mode ${mode.id}: timeLimitTicks too short`);
    }
    if (mode.goal.kind === 'score' && mode.goal.min < 1) {
      throw new Error(`mode ${mode.id}: score goal must be positive`);
    }
    if (mode.goal.kind === 'cascade' && mode.goal.min < 3) {
      throw new Error(`mode ${mode.id}: cascade goal must be at least CASCADE_MIN (3)`);
    }
  }
}

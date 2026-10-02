/**
 * Title-level mission pack: constrained setups with explicit clear goals.
 *
 * Progress is stored apart from free-play best-wave / best-score keys so
 * grinding a mission never overwrites casual records. Unlock is sequential
 * (same pattern as Dynasty / Danmaku / Liquid-Sort packs).
 */
import { TOTAL_WAVES, type Difficulty, type MapId, type TowerType } from './constants.ts';
import type { GameState } from './types.ts';

export const MISSIONS_STORAGE_KEY = 'clockwork-keep:missions-v1';

export type MissionGoal =
  /** Reach `phase === 'won'` under the mission's run config. */
  | { kind: 'clear' }
  /** Survive until the run wins at `winAtWave` (endless survival cards). */
  | { kind: 'surviveWaves'; min: number }
  /** Win with score at least `min`. */
  | { kind: 'score'; min: number };

export interface MissionRunConfig {
  difficulty: Difficulty;
  mapId: MapId;
  endless: boolean;
  /**
   * Towers the player may place. `null` means all four types.
   * Spec variants: 限塔挑戰.
   */
  allowedTowers: TowerType[] | null;
  /** When false, sell is refused (一鏡到底). */
  allowSell: boolean;
  /**
   * Clearing this wave ends the run as a win. For standard 20-wave cards this
   * is `TOTAL_WAVES`; for endless survival cards it is the survive target.
   * Free-play endless leaves this unset via a null mission.
   */
  winAtWave: number;
}

export interface MissionDef {
  id: string;
  /** Traditional Chinese display name. */
  name: string;
  /** Short Traditional Chinese blurb for the mission list. */
  blurb: string;
  /** One-line goal reminder shown on title / play / result. */
  goalLabel: string;
  goal: MissionGoal;
  run: MissionRunConfig;
}

/**
 * Six authored missions: corridor / harsh clear, tower limits, no-sell, and
 * an endless survive card. Unlock is sequential by pack index.
 */
export const MISSION_PACK: readonly MissionDef[] = [
  {
    id: 'corridor-standard',
    name: '窄廊初試',
    blurb: '窄廊地圖・標準難度・20 波通關',
    goalLabel: '窄廊・標準・通關 20 波',
    goal: { kind: 'clear' },
    run: {
      difficulty: 'standard',
      mapId: 'corridor',
      endless: false,
      allowedTowers: null,
      allowSell: true,
      winAtWave: TOTAL_WAVES,
    },
  },
  {
    id: 'corridor-harsh',
    name: '窄廊嚴苛',
    blurb: '窄廊地圖・嚴苛難度・20 波通關',
    goalLabel: '窄廊・嚴苛・通關 20 波',
    goal: { kind: 'clear' },
    run: {
      difficulty: 'harsh',
      mapId: 'corridor',
      endless: false,
      allowedTowers: null,
      allowSell: true,
      winAtWave: TOTAL_WAVES,
    },
  },
  {
    id: 'dual-tower',
    name: '雙塔迴廊',
    blurb: '開闊地圖・僅發條弩台與冰霜噴罐・20 波通關',
    goalLabel: '限塔・弩台＋噴罐・通關 20 波',
    goal: { kind: 'clear' },
    run: {
      difficulty: 'standard',
      mapId: 'open',
      endless: false,
      allowedTowers: ['crossbow', 'frost'],
      allowSell: true,
      winAtWave: TOTAL_WAVES,
    },
  },
  {
    id: 'no-sell',
    name: '一鏡到底',
    blurb: '開闊地圖・全程不得售出塔・20 波通關',
    goalLabel: '禁售・通關 20 波',
    goal: { kind: 'clear' },
    run: {
      difficulty: 'standard',
      mapId: 'open',
      endless: false,
      allowedTowers: null,
      allowSell: false,
      winAtWave: TOTAL_WAVES,
    },
  },
  {
    id: 'endless-thirty',
    name: '無盡三十',
    blurb: '開闊地圖・標準難度・無盡模式撐到第 30 波',
    goalLabel: '無盡・撐過第 30 波',
    goal: { kind: 'surviveWaves', min: 30 },
    run: {
      difficulty: 'standard',
      mapId: 'open',
      endless: true,
      allowedTowers: null,
      allowSell: true,
      winAtWave: 30,
    },
  },
  {
    id: 'harsh-splash',
    name: '嚴苛濺射',
    blurb: '窄廊・嚴苛・僅齒輪磨盤與電磁線圈・20 波通關',
    goalLabel: '限塔・磨盤＋線圈・嚴苛通關',
    goal: { kind: 'clear' },
    run: {
      difficulty: 'harsh',
      mapId: 'corridor',
      endless: false,
      allowedTowers: ['grinder', 'coil'],
      allowSell: true,
      winAtWave: TOTAL_WAVES,
    },
  },
];

export interface MissionProgress {
  /** Sequential unlock cursor: missions with index < clearedCount are done. */
  clearedCount: number;
  cleared: Record<string, true>;
  /** Best score per mission id (updated on any finished run of that mission). */
  bestScore: Record<string, number>;
  /** Best wave reached per mission id. */
  bestWave: Record<string, number>;
}

export const EMPTY_MISSION_PROGRESS: MissionProgress = {
  clearedCount: 0,
  cleared: {},
  bestScore: {},
  bestWave: {},
};

export function missionCount(): number {
  return MISSION_PACK.length;
}

export function missionAt(index: number): MissionDef | undefined {
  return MISSION_PACK[index];
}

export function missionById(id: string): MissionDef | undefined {
  return MISSION_PACK.find((m) => m.id === id);
}

export function missionIndexOf(id: string): number {
  return MISSION_PACK.findIndex((m) => m.id === id);
}

export function isMissionUnlocked(index: number, clearedCount: number): boolean {
  if (index < 0 || index >= MISSION_PACK.length) return false;
  return index <= clearedCount;
}

export function continueMissionIndex(clearedCount: number): number {
  if (clearedCount >= MISSION_PACK.length) return MISSION_PACK.length - 1;
  return Math.max(0, clearedCount);
}

export function evaluateMissionGoal(mission: MissionDef, state: GameState): boolean {
  if (state.missionId !== mission.id) return false;
  if (state.phase !== 'won') return false;
  const goal = mission.goal;
  if (goal.kind === 'clear') return true;
  if (goal.kind === 'surviveWaves') return state.wave >= goal.min;
  if (goal.kind === 'score') return state.score >= goal.min;
  return false;
}

/**
 * Apply a finished mission run onto progress. Only advances the unlock cursor
 * when the next locked mission is cleared (same sequential rule as other packs).
 */
export function applyMissionResult(
  progress: MissionProgress,
  missionIndex: number,
  state: GameState,
): { progress: MissionProgress; cleared: boolean } {
  const mission = MISSION_PACK[missionIndex];
  if (!mission) return { progress, cleared: false };

  const bestScore = { ...progress.bestScore };
  const prevBest = bestScore[mission.id] ?? 0;
  const score = Math.max(0, Math.round(state.score));
  if (score > prevBest) bestScore[mission.id] = score;

  const bestWave = { ...progress.bestWave };
  const reachedWave = state.phase === 'won' ? Math.max(state.wave, mission.run.winAtWave) : state.wave;
  const prevWave = bestWave[mission.id] ?? 0;
  if (reachedWave > prevWave) bestWave[mission.id] = reachedWave;

  const clearedMap = { ...progress.cleared };
  let clearedCount = progress.clearedCount;
  const cleared = evaluateMissionGoal(mission, state);

  if (cleared) {
    clearedMap[mission.id] = true;
    if (missionIndex === clearedCount && clearedCount < MISSION_PACK.length) {
      clearedCount += 1;
    }
  }

  return {
    progress: { clearedCount, cleared: clearedMap, bestScore, bestWave },
    cleared,
  };
}

export function loadMissionProgress(): MissionProgress {
  try {
    const raw = localStorage.getItem(MISSIONS_STORAGE_KEY);
    if (!raw) return { ...EMPTY_MISSION_PROGRESS, cleared: {}, bestScore: {}, bestWave: {} };
    const parsed = JSON.parse(raw) as Partial<MissionProgress>;
    const clearedCount = Math.max(
      0,
      Math.min(MISSION_PACK.length, Math.floor(Number(parsed.clearedCount) || 0)),
    );
    const cleared: Record<string, true> = {};
    if (parsed.cleared && typeof parsed.cleared === 'object') {
      for (const id of Object.keys(parsed.cleared)) {
        if (missionById(id)) cleared[id] = true;
      }
    }
    const bestScore: Record<string, number> = {};
    if (parsed.bestScore && typeof parsed.bestScore === 'object') {
      for (const [id, score] of Object.entries(parsed.bestScore)) {
        if (missionById(id) && typeof score === 'number' && score > 0) {
          bestScore[id] = Math.floor(score);
        }
      }
    }
    const bestWave: Record<string, number> = {};
    if (parsed.bestWave && typeof parsed.bestWave === 'object') {
      for (const [id, wave] of Object.entries(parsed.bestWave)) {
        if (missionById(id) && typeof wave === 'number' && wave > 0) {
          bestWave[id] = Math.floor(wave);
        }
      }
    }
    return { clearedCount, cleared, bestScore, bestWave };
  } catch {
    return { ...EMPTY_MISSION_PROGRESS, cleared: {}, bestScore: {}, bestWave: {} };
  }
}

export function saveMissionProgress(progress: MissionProgress): void {
  try {
    localStorage.setItem(MISSIONS_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Tower type is placeable under the mission (or free play). */
export function isTowerAllowed(state: GameState, type: TowerType): boolean {
  if (!state.allowedTowers) return true;
  return state.allowedTowers.includes(type);
}

/** Self-check: every mission's run config is internally consistent. */
export function assertMissionConfigs(): void {
  for (const mission of MISSION_PACK) {
    if (mission.run.winAtWave < 1) {
      throw new Error(`mission ${mission.id}: winAtWave must be >= 1`);
    }
    if (mission.run.allowedTowers && mission.run.allowedTowers.length === 0) {
      throw new Error(`mission ${mission.id}: allowedTowers must not be empty`);
    }
    if (mission.goal.kind === 'surviveWaves' && mission.run.winAtWave < mission.goal.min) {
      throw new Error(`mission ${mission.id}: winAtWave < surviveWaves.min`);
    }
    if (!mission.run.endless && mission.run.winAtWave !== TOTAL_WAVES && mission.goal.kind === 'clear') {
      // Clear cards on the 20-wave table should target TOTAL_WAVES unless intentionally shorter.
      // Allow intentional shorter clears later; for now pack uses full clears.
    }
  }
  if (MISSION_PACK.length < 4 || MISSION_PACK.length > 8) {
    throw new Error(`mission pack size ${MISSION_PACK.length} outside 4–8`);
  }
}

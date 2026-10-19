/**
 * Starting builds (character identities). The first is free; others unlock by
 * reaching floors, escaping, or clearing a daily seed.
 */
import type { RelicId } from './types';

export type BuildUnlock =
  | { kind: 'free' }
  /** Best free-play floor ever reached (inclusive). */
  | { kind: 'floor'; min: number }
  /** At least one escape (phase won on floor 15). */
  | { kind: 'escape' }
  /** At least one daily-seed clear. */
  | { kind: 'daily' };

export interface StartingBuild {
  id: string;
  /** Traditional Chinese display name. */
  name: string;
  /** Short Traditional Chinese blurb. */
  blurb: string;
  unlock: BuildUnlock;
  /** Starting HP / max HP (Ironsnake overrides to 1). */
  startHp: number;
  startEnergy: number;
  startMaxEnergy?: number;
  startCoins?: number;
  /** Relics granted at run start (applied through the normal relic path). */
  startingRelics: RelicId[];
}

export const DEFAULT_BUILD_ID = 'hatchling';

export const STARTING_BUILDS: readonly StartingBuild[] = [
  {
    id: 'hatchling',
    name: '青鱗幼蛇',
    blurb: '均衡起步。熟悉地窟節奏，慢慢構築流派。',
    unlock: { kind: 'free' },
    startHp: 3,
    startEnergy: 60,
    startingRelics: [],
  },
  {
    id: 'swiftling',
    name: '疾行遊蛇',
    blurb: '血薄但動能充沛，擅長以衝刺輾殺開路。',
    unlock: { kind: 'floor', min: 5 },
    startHp: 2,
    startEnergy: 90,
    startMaxEnergy: 120,
    startingRelics: ['swift'],
  },
  {
    id: 'ironscale',
    name: '鐵鱗守蛇',
    blurb: '厚皮硬鱗，受傷不縮身，靠容錯慢慢變強。',
    unlock: { kind: 'floor', min: 10 },
    startHp: 4,
    startEnergy: 50,
    startingRelics: ['shed'],
  },
  {
    id: 'bloodcoil',
    name: '血祭狂蛇',
    blurb: '尖牙起步，以頭撞擊為戰術核心，高風險高回報。',
    unlock: { kind: 'daily' },
    startHp: 2,
    startEnergy: 70,
    startCoins: 4,
    startingRelics: ['fang'],
  },
];

export function buildById(id: string): StartingBuild | undefined {
  return STARTING_BUILDS.find((build) => build.id === id);
}

export function buildUnlockHint(build: StartingBuild): string {
  switch (build.unlock.kind) {
    case 'free':
      return '初始可用';
    case 'floor':
      return `抵達第 ${build.unlock.min} 層解鎖`;
    case 'escape':
      return '逃出蛇窟後解鎖';
    case 'daily':
      return '完成今日挑戰或逃出蛇窟後解鎖';
    default:
      return '未解鎖';
  }
}

export interface BuildUnlockContext {
  bestFloor: number;
  escapes: number;
  dailyClears: number;
}

export function isBuildUnlocked(build: StartingBuild, ctx: BuildUnlockContext): boolean {
  switch (build.unlock.kind) {
    case 'free':
      return true;
    case 'floor':
      return ctx.bestFloor >= build.unlock.min;
    case 'escape':
      return ctx.escapes >= 1;
    case 'daily':
      return ctx.dailyClears >= 1 || ctx.escapes >= 1;
    default:
      return false;
  }
}

/** Newly unlocked build ids given previous and next meta context. */
export function newlyUnlockedBuilds(
  previous: BuildUnlockContext,
  next: BuildUnlockContext,
): string[] {
  const unlocked: string[] = [];
  for (const build of STARTING_BUILDS) {
    if (!isBuildUnlocked(build, previous) && isBuildUnlocked(build, next)) {
      unlocked.push(build.id);
    }
  }
  return unlocked;
}

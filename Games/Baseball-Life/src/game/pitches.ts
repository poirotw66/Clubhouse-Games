import type { Arsenal, GameState, PitchId } from './types';

/**
 * A pitcher's repertoire, broken out so that "變化球 B" becomes "滑球 A、曲球 C,
 * still no changeup". The aggregate `breaking` attribute the season sim reads
 * is derived from this list rather than trained directly.
 */
export interface PitchInfo {
  id: PitchId;
  label: string;
  blurb: string;
  /** How hard it is to learn from scratch, 1 = easy. */
  difficulty: number;
}

export const PITCHES: PitchInfo[] = [
  { id: 'slider', label: '滑球', blurb: '橫向急墜，對同側打者最有效。', difficulty: 1.0 },
  { id: 'curve', label: '曲球', blurb: '大幅度縱向落差，用來偷好球數。', difficulty: 1.1 },
  { id: 'forkball', label: '指叉球', blurb: '進本壘前失速下墜，三振的武器。', difficulty: 1.35 },
  { id: 'changeup', label: '變速球', blurb: '和直球一樣的出手，慢上 15 公里。', difficulty: 1.15 },
  { id: 'cutter', label: '卡特球', blurb: '在最後一刻切進來，專門咬斷球棒。', difficulty: 1.25 },
  { id: 'sinker', label: '伸卡球', blurb: '沉重的下沉尾勁，製造滾地球。', difficulty: 1.05 },
];

export function pitchInfo(id: PitchId): PitchInfo {
  return PITCHES.find((p) => p.id === id) ?? PITCHES[0];
}

/**
 * The aggregate breaking-ball rating. A pitcher lives off their best pitch, so
 * it dominates; the second and third add setup value, and anything beyond that
 * is mostly for show. Having only one good pitch caps you well short of an ace.
 */
export function breakingFromArsenal(arsenal: Arsenal): number {
  const levels = arsenal.map((p) => p.level).sort((a, b) => b - a);
  if (levels.length === 0) return 0;
  const best = levels[0] ?? 0;
  const second = levels[1] ?? 0;
  const third = levels[2] ?? 0;
  const depth = Math.min(3, Math.max(0, levels.length - 1)) * 2;
  return Math.min(99, Math.round(best * 0.6 + second * 0.26 + third * 0.14 + depth));
}

/** Pitches the player has not learned yet, cheapest to learn first. */
export function learnablePitches(arsenal: Arsenal): PitchInfo[] {
  const known = new Set(arsenal.map((p) => p.id));
  return PITCHES.filter((p) => !known.has(p.id)).sort((a, b) => a.difficulty - b.difficulty);
}

export function describeArsenal(arsenal: Arsenal): string {
  if (arsenal.length === 0) return '只有直球';
  return [...arsenal]
    .sort((a, b) => b.level - a.level)
    .map((p) => `${pitchInfo(p.id).label} ${p.level}`)
    .join('・');
}

/** Keeps the derived `breaking` attribute in step with the arsenal. */
export function syncBreaking(state: GameState): void {
  state.attrs.breaking = breakingFromArsenal(state.arsenal);
}

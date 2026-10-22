/**
 * Versus meta: best-of-3 series + unlockable CPU playstyles by career wins.
 */

import type { Difficulty } from './tetrisLogic.ts';
import type { DifficultyPreset } from './cpuAi.ts';
import { DIFFICULTY_PRESETS } from './cpuAi.ts';

export const VERSUS_META_KEY = 'clubhouse:tetris-versus-meta-v1';

export type CpuStyleId = 'balanced' | 'conservative' | 'digger' | 'tspin';

export interface CpuStyleDef {
  id: CpuStyleId;
  label: string;
  blurb: string;
  /** Career versus wins required to unlock (0 = always). */
  unlockWins: number;
  /** Weight multipliers applied on top of the difficulty preset. */
  weights: Partial<
    Pick<
      DifficultyPreset,
      | 'holeWeight'
      | 'heightWeight'
      | 'bumpWeight'
      | 'clearWeight'
      | 'attackWeight'
      | 'tSlotWeight'
      | 'noise'
    >
  >;
}

export const CPU_STYLES: Record<CpuStyleId, CpuStyleDef> = {
  balanced: {
    id: 'balanced',
    label: '均衡',
    blurb: '預設打法，攻守兼顧',
    unlockWins: 0,
    weights: {},
  },
  conservative: {
    id: 'conservative',
    label: '保守',
    blurb: '少挖洞、堆得平，輸出較慢',
    unlockWins: 1,
    weights: {
      holeWeight: 1.45,
      heightWeight: 1.15,
      bumpWeight: 1.2,
      attackWeight: 0.55,
      tSlotWeight: 0.4,
      clearWeight: 0.85,
    },
  },
  digger: {
    id: 'digger',
    label: '積極挖洞',
    blurb: '猛消行、較敢留洞',
    unlockWins: 3,
    weights: {
      holeWeight: 0.65,
      clearWeight: 1.4,
      attackWeight: 1.35,
      heightWeight: 0.85,
      tSlotWeight: 0.5,
    },
  },
  tspin: {
    id: 'tspin',
    label: 'T-Spin 型',
    blurb: '偏重 T 槽與攻擊機會',
    unlockWins: 5,
    weights: {
      tSlotWeight: 2.2,
      attackWeight: 1.25,
      holeWeight: 0.9,
      clearWeight: 1.1,
    },
  },
};

export const CPU_STYLE_ORDER: CpuStyleId[] = [
  'balanced',
  'conservative',
  'digger',
  'tspin',
];

export interface VersusMeta {
  /** Preferred BO3 toggle. */
  bo3: boolean;
  style: CpuStyleId;
  /** Wins within the current BO3 series (first to 2). */
  seriesPlayer: number;
  seriesCpu: number;
}

export function emptyVersusMeta(): VersusMeta {
  return { bo3: false, style: 'balanced', seriesPlayer: 0, seriesCpu: 0 };
}

export function loadVersusMeta(): VersusMeta {
  try {
    const parsed = JSON.parse(localStorage.getItem(VERSUS_META_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return emptyVersusMeta();
    const style =
      parsed.style === 'conservative' ||
      parsed.style === 'digger' ||
      parsed.style === 'tspin' ||
      parsed.style === 'balanced'
        ? parsed.style
        : 'balanced';
    return {
      bo3: Boolean(parsed.bo3),
      style,
      seriesPlayer: Math.max(0, Math.min(2, Number(parsed.seriesPlayer) || 0)),
      seriesCpu: Math.max(0, Math.min(2, Number(parsed.seriesCpu) || 0)),
    };
  } catch {
    return emptyVersusMeta();
  }
}

export function saveVersusMeta(meta: VersusMeta): void {
  try {
    localStorage.setItem(VERSUS_META_KEY, JSON.stringify(meta));
  } catch {
    /* storage unavailable */
  }
}

export function isStyleUnlocked(style: CpuStyleId, careerWins: number): boolean {
  return careerWins >= CPU_STYLES[style].unlockWins;
}

export function applyCpuStyle(
  difficulty: Difficulty,
  style: CpuStyleId,
): DifficultyPreset {
  const base = DIFFICULTY_PRESETS[difficulty];
  const w = CPU_STYLES[style].weights;
  return {
    ...base,
    holeWeight: base.holeWeight * (w.holeWeight ?? 1),
    heightWeight: base.heightWeight * (w.heightWeight ?? 1),
    bumpWeight: base.bumpWeight * (w.bumpWeight ?? 1),
    clearWeight: base.clearWeight * (w.clearWeight ?? 1),
    attackWeight: base.attackWeight * (w.attackWeight ?? 1),
    tSlotWeight: base.tSlotWeight * (w.tSlotWeight ?? 1),
    noise: base.noise * (w.noise ?? 1),
  };
}

export function seriesComplete(meta: VersusMeta): boolean {
  return meta.seriesPlayer >= 2 || meta.seriesCpu >= 2;
}

export function recordSeriesGame(
  meta: VersusMeta,
  winner: 'player' | 'cpu',
): VersusMeta {
  if (!meta.bo3) return meta;
  const next = {
    ...meta,
    seriesPlayer: meta.seriesPlayer + (winner === 'player' ? 1 : 0),
    seriesCpu: meta.seriesCpu + (winner === 'cpu' ? 1 : 0),
  };
  return next;
}

export function resetSeries(meta: VersusMeta): VersusMeta {
  return { ...meta, seriesPlayer: 0, seriesCpu: 0 };
}

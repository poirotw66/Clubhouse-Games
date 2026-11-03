import { Color, type BottleData, type Order } from '../types.ts';
import { canPour } from '../services/gameLogic.ts';

export const COLOR_LABELS_ZH: Record<string, string> = {
  [Color.RED]: '緋紅',
  [Color.BLUE]: '湛藍',
  [Color.GREEN]: '翠綠',
  [Color.YELLOW]: '澄黃',
  [Color.PURPLE]: '紫晶',
  [Color.ORANGE]: '暖橙',
  [Color.CYAN]: '青碧',
  [Color.GRAY]: '灰質',
};

export interface ColorPurityMetric {
  color: Color;
  name: string;
  totalUnits: number;
  pureUnits: number;
  completedUnits: number;
  purityPct: number;
}

export interface LabPuritySummary {
  metrics: ColorPurityMetric[];
  overallPurityPct: number;
  totalPureBottles: number;
  totalVisibleLayers: number;
}

/**
 * Calculates real-time purity metrics for each liquid color and the laboratory overall.
 */
export function calculateLabPurity(bottles: BottleData[], orders: Order[]): LabPuritySummary {
  const colorUnits: Record<string, { total: number; pure: number; completed: number }> = {};

  // Initialize from orders to ensure required colors are represented
  for (const ord of orders) {
    if (!colorUnits[ord.color]) {
      colorUnits[ord.color] = { total: 0, pure: 0, completed: 0 };
    }
  }

  let totalVisibleLayers = 0;
  let totalPureLayers = 0;
  let totalPureBottles = 0;

  for (const bottle of bottles) {
    if (bottle.layers.length === 0) continue;

    const visibleLayers = bottle.layers.filter((l) => !l.isHidden);
    totalVisibleLayers += visibleLayers.length;

    // Check if the tube has uniform visible color and no hidden layers
    const firstColor = bottle.layers[0]?.color;
    const isSingleColor =
      bottle.layers.every((l) => !l.isHidden && l.color === firstColor);

    if (isSingleColor) {
      totalPureLayers += bottle.layers.length;
      if (bottle.isCompleted) {
        totalPureBottles += 1;
      }
    }

    for (const layer of visibleLayers) {
      if (!colorUnits[layer.color]) {
        colorUnits[layer.color] = { total: 0, pure: 0, completed: 0 };
      }
      colorUnits[layer.color].total += 1;
      if (isSingleColor) {
        colorUnits[layer.color].pure += 1;
        if (bottle.isCompleted) {
          colorUnits[layer.color].completed += 1;
        }
      }
    }
  }

  const metrics: ColorPurityMetric[] = Object.entries(colorUnits)
    .filter(([_, data]) => data.total > 0)
    .map(([color, data]) => {
      const purityPct =
        data.total > 0 ? Math.min(100, Math.round((data.pure / data.total) * 100)) : 100;
      return {
        color: color as Color,
        name: COLOR_LABELS_ZH[color] ?? '未知',
        totalUnits: data.total,
        pureUnits: data.pure,
        completedUnits: data.completed,
        purityPct,
      };
    })
    .sort((a, b) => b.totalUnits - a.totalUnits);

  const overallPurityPct =
    totalVisibleLayers > 0
      ? Math.min(100, Math.round((totalPureLayers / totalVisibleLayers) * 100))
      : 100;

  return {
    metrics,
    overallPurityPct,
    totalPureBottles,
    totalVisibleLayers,
  };
}

/**
 * Calculates all legal pour movements available on the current board.
 */
export function calculateLegalPours(bottles: BottleData[]): {
  count: number;
  pairs: [string, string][];
} {
  const pairs: [string, string][] = [];
  const n = bottles.length;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      if (canPour(bottles[i], bottles[j])) {
        pairs.push([bottles[i].id, bottles[j].id]);
      }
    }
  }

  return {
    count: pairs.length,
    pairs,
  };
}

/**
 * Calculates buffer tube availability (empty bottles).
 */
export function calculateBufferTubes(bottles: BottleData[]): {
  emptyCount: number;
  emptyTubeIds: string[];
} {
  const emptyTubeIds: string[] = [];
  for (const b of bottles) {
    if (!b.isCompleted && !b.isBlocked && b.layers.length === 0) {
      emptyTubeIds.push(b.id);
    }
  }
  return {
    emptyCount: emptyTubeIds.length,
    emptyTubeIds,
  };
}

/**
 * Estimates baseline Par steps for the level based on tube disorder and stage limits.
 */
export function calculateParSteps(
  bottles: BottleData[],
  orders: Order[],
  mechMinSteps?: number,
): number {
  if (mechMinSteps != null && mechMinSteps > 0) {
    return mechMinSteps;
  }

  // Calculate disorder score: color transitions in each tube
  let disorderScore = 0;
  for (const bottle of bottles) {
    for (let i = 0; i < bottle.layers.length - 1; i++) {
      if (bottle.layers[i].color !== bottle.layers[i + 1].color) {
        disorderScore += 1;
      }
    }
  }

  // Baseline minimum steps formula
  const base = Math.max(6, disorderScore * 2 + Math.max(2, orders.length));
  return base;
}

export type StepRatingTier = 'S' | 'A' | 'B' | 'C';

export interface StepRatingResult {
  rating: StepRatingTier;
  label: string;
  subLabel: string;
  badgeClass: string;
  textColor: string;
  ratio: number;
}

/**
 * Evaluates current step efficiency rating against Par steps.
 */
export function calculateStepRating(moves: number, par: number): StepRatingResult {
  const effectivePar = Math.max(1, par);
  const ratio = moves / effectivePar;

  if (ratio <= 1.0) {
    return {
      rating: 'S',
      label: 'S級 卓越',
      subLabel: '極致步數控制',
      badgeClass: 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-900 shadow-[0_0_12px_rgba(251,191,36,0.5)]',
      textColor: 'text-amber-300',
      ratio,
    };
  }
  if (ratio <= 1.3) {
    return {
      rating: 'A',
      label: 'A級 精準',
      subLabel: '高效純化推進',
      badgeClass: 'bg-emerald-500/90 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]',
      textColor: 'text-emerald-300',
      ratio,
    };
  }
  if (ratio <= 1.7) {
    return {
      rating: 'B',
      label: 'B級 平穩',
      subLabel: '平穩實驗調配',
      badgeClass: 'bg-sky-500/90 text-white shadow-[0_0_10px_rgba(14,165,233,0.4)]',
      textColor: 'text-sky-300',
      ratio,
    };
  }
  return {
    rating: 'C',
    label: 'C級 冗餘',
    subLabel: '倒水次數偏多',
    badgeClass: 'bg-rose-500/90 text-white shadow-[0_0_10px_rgba(244,63,94,0.4)]',
    textColor: 'text-rose-300',
    ratio,
  };
}

export type TubeQuickStatusType = 'sealed' | 'pure' | 'mixed' | 'empty' | 'blocked';

export interface TubeQuickStatus {
  status: TubeQuickStatusType;
  label: string;
  badgeClass: string;
  icon: string;
}

/**
 * Gets concise status for quick matrix representation.
 */
export function getTubeQuickStatus(bottle: BottleData): TubeQuickStatus {
  if (bottle.isBlocked) {
    return {
      status: 'blocked',
      label: '封鎖',
      badgeClass: 'bg-slate-700/80 text-amber-200 border-amber-400/40',
      icon: '🧊',
    };
  }
  if (bottle.isCompleted) {
    return {
      status: 'sealed',
      label: '純淨封裝',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-400/50',
      icon: '🔒',
    };
  }
  if (bottle.layers.length === 0) {
    return {
      status: 'empty',
      label: '緩衝空管',
      badgeClass: 'bg-white/10 text-white/70 border-white/20',
      icon: '⚪',
    };
  }
  const firstColor = bottle.layers[0]?.color;
  const isAllSameColor =
    bottle.layers.every((l) => !l.isHidden && l.color === firstColor);

  if (isAllSameColor) {
    return {
      status: 'pure',
      label: '同色匯整',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/50',
      icon: '💧',
    };
  }

  return {
    status: 'mixed',
    label: '混雜待析',
    badgeClass: 'bg-purple-500/20 text-purple-200 border-purple-400/40',
    icon: '🧪',
  };
}

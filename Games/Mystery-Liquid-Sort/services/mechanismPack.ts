/**
 * Mechanism pack: blocked bottles, mixed capacities, optional move limits.
 * Progress and star ratings are tracked separately from other packs.
 */
import { Color, type BottleData, type Layer, type Order } from '../types.ts';
import { createLayer } from './gameLogic.ts';

export const MECHANISM_PACK_STORAGE_KEY = 'mls-mechanism-pack-v1';

export type MechLayerDef = {
  color: keyof typeof Color;
  isHidden?: boolean;
};

export type MechBottleDef = {
  /** Bottom → top layers; `[]` = empty spare. */
  layers: MechLayerDef[];
  /** Defaults to stage.defaultCapacity. */
  capacity?: number;
  /** Starts sealed; unlocks one-per-delivery in board order. */
  blocked?: boolean;
};

export type MechStageDef = {
  id: string;
  name: string;
  blurb: string;
  tip: string;
  defaultCapacity: number;
  bottles: MechBottleDef[];
  orderColors: (keyof typeof Color)[];
  /**
   * Shortest known legal pour count to clear (verified by check-liquid-sort.mjs).
   * Used as the 3-star threshold.
   */
  minSteps: number;
  /** Optional hard fail if the player exceeds this many pours. */
  moveLimit?: number;
};

/**
 * Curated 6-stage mechanism pack. Layouts verified solvable with minSteps
 * by check-liquid-sort.mjs (delivery-aware search including blocked unlocks).
 */
export const MECHANISM_PACK_STAGES: readonly MechStageDef[] = [
  {
    id: 'block-intro',
    name: '封鎖初見',
    blurb: '封鎖瓶・交付後解鎖',
    tip: '鎖住的瓶子不能倒入或倒出；交一筆訂單會依序解開下一瓶。',
    defaultCapacity: 4,
    minSteps: 6,
    bottles: [
      { layers: [{ color: 'RED' }, { color: 'BLUE' }, { color: 'RED' }] },
      { layers: [{ color: 'BLUE' }, { color: 'BLUE' }, { color: 'RED' }, { color: 'BLUE' }] },
      { layers: [{ color: 'RED' }], blocked: true },
      { layers: [] },
    ],
    orderColors: ['RED', 'BLUE'],
  },
  {
    id: 'block-twin',
    name: '雙重封鎖',
    blurb: '兩瓶封鎖・依序解鎖',
    tip: '先清可見的顏色，解鎖後再處理封印裡的液體。',
    defaultCapacity: 4,
    minSteps: 6,
    bottles: [
      { layers: [{ color: 'RED' }, { color: 'BLUE' }, { color: 'RED' }] },
      { layers: [{ color: 'BLUE' }, { color: 'BLUE' }, { color: 'RED' }, { color: 'BLUE' }] },
      { layers: [{ color: 'GREEN' }, { color: 'GREEN' }], blocked: true },
      { layers: [{ color: 'GREEN' }, { color: 'GREEN' }], blocked: true },
      { layers: [{ color: 'RED' }] },
      { layers: [] },
    ],
    orderColors: ['RED', 'BLUE', 'GREEN'],
  },
  {
    id: 'cap-mix',
    name: '容量參差',
    blurb: '同關不同容量',
    tip: '小瓶先滿就封口；別把大瓶的量硬塞進小瓶。',
    defaultCapacity: 4,
    minSteps: 6,
    bottles: [
      { layers: [{ color: 'YELLOW' }, { color: 'RED' }, { color: 'YELLOW' }], capacity: 3 },
      { layers: [{ color: 'RED' }, { color: 'RED' }, { color: 'YELLOW' }], capacity: 3 },
      { layers: [{ color: 'BLUE' }, { color: 'BLUE' }, { color: 'BLUE' }, { color: 'RED' }], capacity: 4 },
      { layers: [], capacity: 4 },
      { layers: [], capacity: 3 },
    ],
    orderColors: ['RED', 'YELLOW', 'BLUE'],
  },
  {
    id: 'cap-tight',
    name: '小瓶迷宮',
    blurb: '容量 2 三色',
    tip: '兩格瓶一倒就滿——先規劃暫存空間。',
    defaultCapacity: 2,
    minSteps: 4,
    bottles: [
      { layers: [{ color: 'RED' }, { color: 'BLUE' }], capacity: 2 },
      { layers: [{ color: 'BLUE' }, { color: 'GREEN' }], capacity: 2 },
      { layers: [{ color: 'GREEN' }, { color: 'RED' }], capacity: 2 },
      { layers: [], capacity: 2 },
      { layers: [], capacity: 2 },
    ],
    orderColors: ['RED', 'BLUE', 'GREEN'],
  },
  {
    id: 'block-limit',
    name: '封鎖限步',
    blurb: '封鎖＋步數上限',
    tip: '步數有限；解鎖時機與倒次都要算準。',
    defaultCapacity: 4,
    minSteps: 6,
    moveLimit: 12,
    bottles: [
      { layers: [{ color: 'ORANGE' }, { color: 'GREEN' }, { color: 'ORANGE' }] },
      { layers: [{ color: 'GREEN' }, { color: 'GREEN' }, { color: 'ORANGE' }, { color: 'GREEN' }] },
      { layers: [{ color: 'ORANGE' }], blocked: true },
      { layers: [] },
      { layers: [] },
    ],
    orderColors: ['ORANGE', 'GREEN'],
  },
  {
    id: 'mech-finale',
    name: '機制終章',
    blurb: '封鎖＋參差容量',
    tip: '封印與小瓶同時登場——先交可見訂單再開鎖。',
    defaultCapacity: 4,
    minSteps: 5,
    moveLimit: 14,
    bottles: [
      { layers: [{ color: 'RED' }, { color: 'YELLOW' }], capacity: 3 },
      { layers: [{ color: 'YELLOW' }, { color: 'RED' }, { color: 'YELLOW' }], capacity: 3 },
      { layers: [{ color: 'BLUE' }, { color: 'BLUE' }], capacity: 4, blocked: true },
      { layers: [{ color: 'BLUE' }, { color: 'BLUE' }], capacity: 4 },
      { layers: [{ color: 'RED' }], capacity: 3 },
      { layers: [], capacity: 4 },
    ],
    orderColors: ['RED', 'YELLOW', 'BLUE'],
  },
];

export type MechanismPackProgress = {
  clearedCount: number;
  bestMoves: Record<string, number>;
  /** Best star rating earned per stage (1–3). */
  bestStars: Record<string, number>;
};

export const EMPTY_MECH_PROGRESS: MechanismPackProgress = {
  clearedCount: 0,
  bestMoves: {},
  bestStars: {},
};

export function mechStageCount(): number {
  return MECHANISM_PACK_STAGES.length;
}

export function getMechStage(index: number): MechStageDef | undefined {
  return MECHANISM_PACK_STAGES[index];
}

export function isMechStageUnlocked(index: number, clearedCount: number): boolean {
  if (index < 0 || index >= MECHANISM_PACK_STAGES.length) return false;
  return index <= clearedCount;
}

export function continueMechIndex(clearedCount: number): number {
  if (clearedCount <= 0) return 0;
  if (clearedCount >= MECHANISM_PACK_STAGES.length) return MECHANISM_PACK_STAGES.length - 1;
  return clearedCount;
}

/** 3★ at minSteps; 2★ within a soft buffer; else 1★ for any clear. */
export function starsForMoves(moves: number, minSteps: number): 1 | 2 | 3 {
  if (!Number.isFinite(moves) || moves < 0) return 1;
  if (moves <= minSteps) return 3;
  const buffer = Math.max(2, Math.ceil(minSteps * 0.35));
  if (moves <= minSteps + buffer) return 2;
  return 1;
}

export function applyMechStageClear(
  progress: MechanismPackProgress,
  stageIndex: number,
  moves: number,
): MechanismPackProgress {
  const stage = MECHANISM_PACK_STAGES[stageIndex];
  if (!stage || !Number.isFinite(moves) || moves < 0) return progress;

  const bestMoves = { ...progress.bestMoves };
  const bestStars = { ...progress.bestStars };
  const nextMoves = Math.floor(moves);
  const prev = bestMoves[stage.id];
  bestMoves[stage.id] = prev == null ? nextMoves : Math.min(prev, nextMoves);

  const stars = starsForMoves(bestMoves[stage.id], stage.minSteps);
  const prevStars = bestStars[stage.id] ?? 0;
  bestStars[stage.id] = Math.max(prevStars, stars);

  let clearedCount = progress.clearedCount;
  if (stageIndex === clearedCount && clearedCount < MECHANISM_PACK_STAGES.length) {
    clearedCount = stageIndex + 1;
  }

  return { clearedCount, bestMoves, bestStars };
}

export function loadMechProgress(): MechanismPackProgress {
  try {
    const raw = localStorage.getItem(MECHANISM_PACK_STORAGE_KEY);
    if (!raw) return { ...EMPTY_MECH_PROGRESS, bestMoves: {}, bestStars: {} };
    const parsed = JSON.parse(raw) as Partial<MechanismPackProgress>;
    const clearedCount = Math.max(
      0,
      Math.min(MECHANISM_PACK_STAGES.length, Math.floor(Number(parsed.clearedCount) || 0)),
    );
    const bestMoves: Record<string, number> = {};
    if (parsed.bestMoves && typeof parsed.bestMoves === 'object') {
      for (const [k, v] of Object.entries(parsed.bestMoves)) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0) bestMoves[k] = Math.floor(n);
      }
    }
    const bestStars: Record<string, number> = {};
    if (parsed.bestStars && typeof parsed.bestStars === 'object') {
      for (const [k, v] of Object.entries(parsed.bestStars)) {
        const n = Math.floor(Number(v));
        if (n >= 1 && n <= 3) bestStars[k] = n;
      }
    }
    return { clearedCount, bestMoves, bestStars };
  } catch {
    return { ...EMPTY_MECH_PROGRESS, bestMoves: {}, bestStars: {} };
  }
}

export function saveMechProgress(progress: MechanismPackProgress): void {
  try {
    localStorage.setItem(MECHANISM_PACK_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* private mode */
  }
}

export function persistMechStageClear(stageIndex: number, moves: number): MechanismPackProgress {
  const next = applyMechStageClear(loadMechProgress(), stageIndex, moves);
  saveMechProgress(next);
  return next;
}

function resolveColor(key: keyof typeof Color): Color {
  return Color[key];
}

export function materializeMechStage(stage: MechStageDef): { bottles: BottleData[]; orders: Order[] } {
  const bottles: BottleData[] = stage.bottles.map((def, bottleIndex) => {
    const capacity = def.capacity ?? stage.defaultCapacity;
    if (def.layers.length > capacity) {
      throw new Error(`mech ${stage.id}: bottle ${bottleIndex} exceeds capacity ${capacity}`);
    }
    const layers: Layer[] = def.layers.map((d, layerIndex) => {
      const color = resolveColor(d.color);
      const isTop = layerIndex === def.layers.length - 1;
      const isHidden = Boolean(d.isHidden) && !isTop;
      return createLayer(color, isHidden);
    });
    const isCompleted =
      layers.length === capacity &&
      layers.length > 0 &&
      layers.every((l) => l.color === layers[0].color && !l.isHidden);
    return {
      id: `mech-${stage.id}-b${bottleIndex}`,
      layers,
      capacity,
      isCompleted,
      mixingEnabled: false,
      isBlocked: Boolean(def.blocked) && !isCompleted,
    };
  });

  // Per-colour units must equal the capacity of exactly one "home" full bottle
  // for that colour (orders map 1:1 to mono bottles). With mixed capacities,
  // that home capacity is the unique capacity among bottles that can hold
  // that colour's full count — we require count(color) to match the max
  // capacity among bottles (typical home), which equals order fulfilment.
  const counts = new Map<Color, number>();
  for (const b of bottles) {
    for (const l of b.layers) {
      counts.set(l.color, (counts.get(l.color) ?? 0) + 1);
    }
  }

  // Each order colour must appear a positive number of times that equals some
  // bottle capacity on the board (so a mono fill is possible).
  const capacities = new Set(bottles.map((b) => b.capacity));
  for (const key of stage.orderColors) {
    const color = resolveColor(key);
    const n = counts.get(color) ?? 0;
    if (!capacities.has(n)) {
      throw new Error(
        `mech ${stage.id}: colour ${key} has ${n} units, not equal to any bottle capacity`,
      );
    }
  }
  if (counts.size !== stage.orderColors.length) {
    throw new Error(`mech ${stage.id}: extra colours on board beyond orders`);
  }

  if (stage.moveLimit != null && stage.moveLimit < stage.minSteps) {
    throw new Error(`mech ${stage.id}: moveLimit ${stage.moveLimit} < minSteps ${stage.minSteps}`);
  }

  const orders: Order[] = stage.orderColors.map((key, index) => ({
    id: `mech-${stage.id}-o${index}`,
    color: resolveColor(key),
    isCompleted: false,
    isLocked: index >= 2,
  }));

  return { bottles, orders };
}

export function materializeMechStageAt(index: number): {
  bottles: BottleData[];
  orders: Order[];
  stage: MechStageDef;
} {
  const stage = MECHANISM_PACK_STAGES[index];
  if (!stage) throw new Error(`mech stage index out of range: ${index}`);
  const board = materializeMechStage(stage);
  return { ...board, stage };
}

/**
 * Hand-authored puzzle pack: fixed named boards with progress tracked
 * separately from adventure (`mls_level`) and quick-play bests.
 */
import { Color, type BottleData, type Layer, type Order } from '../types.ts';
import { createLayer } from './gameLogic.ts';

export const PUZZLE_PACK_STORAGE_KEY = 'mls-puzzle-pack-v1';

export type PackLayerDef = {
  /** Color const key, e.g. 'RED' — kept as string so check scripts can import defs without Color enum. */
  color: keyof typeof Color;
  isHidden?: boolean;
};

export type PackStageDef = {
  id: string;
  /** Traditional Chinese display name. */
  name: string;
  /** Short Traditional Chinese blurb for the stage list. */
  blurb: string;
  capacity: number;
  /** Bottom → top layers per bottle; `[]` = empty spare. */
  bottles: PackLayerDef[][];
  /** Order colour keys in unlock order (first two open, rest locked). */
  orderColors: (keyof typeof Color)[];
};

/**
 * Curated 8-stage pack. Layouts were reverse-scrambled from solved boards and
 * independently verified solvable by check-liquid-sort.mjs (no mixing).
 */
export const PUZZLE_PACK_STAGES: readonly PackStageDef[] = [
  {
    id: 'intro-three',
    name: '三色入門',
    blurb: '容量 4・三色・兩空瓶',
    capacity: 4,
    bottles: [
      [{ color: 'RED' }, { color: 'BLUE' }, { color: 'RED' }],
      [{ color: 'BLUE' }, { color: 'BLUE' }, { color: 'RED' }, { color: 'BLUE' }],
      [{ color: 'RED' }],
      [],
      [{ color: 'GREEN' }, { color: 'GREEN' }, { color: 'GREEN' }, { color: 'GREEN' }],
    ],
    orderColors: ['RED', 'BLUE', 'GREEN'],
  },
  {
    id: 'cross-three',
    name: '交錯三色',
    blurb: '容量 4・三色交疊',
    capacity: 4,
    bottles: [
      [],
      [],
      [{ color: 'RED' }, { color: 'RED' }, { color: 'GREEN' }, { color: 'BLUE' }],
      [{ color: 'RED' }, { color: 'RED' }, { color: 'BLUE' }, { color: 'BLUE' }],
      [{ color: 'GREEN' }, { color: 'GREEN' }, { color: 'GREEN' }, { color: 'BLUE' }],
    ],
    orderColors: ['RED', 'BLUE', 'GREEN'],
  },
  {
    id: 'veil-three',
    name: '隱藏初見',
    blurb: '容量 4・首次隱藏層',
    capacity: 4,
    bottles: [
      [{ color: 'GREEN', isHidden: true }, { color: 'RED' }],
      [{ color: 'BLUE', isHidden: true }, { color: 'GREEN' }, { color: 'GREEN' }],
      [],
      [{ color: 'RED' }, { color: 'RED' }, { color: 'RED' }],
      [
        { color: 'BLUE', isHidden: true },
        { color: 'GREEN', isHidden: true },
        { color: 'BLUE' },
        { color: 'BLUE' },
      ],
    ],
    orderColors: ['RED', 'BLUE', 'GREEN'],
  },
  {
    id: 'four-split',
    name: '四色分流',
    blurb: '容量 4・四色・兩空瓶',
    capacity: 4,
    bottles: [
      [{ color: 'BLUE' }, { color: 'YELLOW' }, { color: 'BLUE' }, { color: 'RED' }],
      [],
      [{ color: 'GREEN' }, { color: 'GREEN' }, { color: 'GREEN' }, { color: 'RED' }],
      [{ color: 'GREEN' }, { color: 'BLUE' }, { color: 'BLUE' }, { color: 'RED' }],
      [{ color: 'YELLOW' }, { color: 'YELLOW' }, { color: 'RED' }, { color: 'YELLOW' }],
      [],
    ],
    orderColors: ['RED', 'BLUE', 'GREEN', 'YELLOW'],
  },
  {
    id: 'four-tight',
    name: '四色緊湊',
    blurb: '容量 4・四色・僅一空瓶',
    capacity: 4,
    bottles: [
      [{ color: 'RED' }, { color: 'RED' }, { color: 'GREEN' }, { color: 'RED' }],
      [{ color: 'BLUE' }, { color: 'BLUE' }, { color: 'GREEN' }, { color: 'YELLOW' }],
      [{ color: 'GREEN' }, { color: 'GREEN' }, { color: 'YELLOW' }, { color: 'BLUE' }],
      [],
      [{ color: 'RED' }, { color: 'YELLOW' }, { color: 'BLUE' }, { color: 'YELLOW' }],
    ],
    orderColors: ['RED', 'BLUE', 'GREEN', 'YELLOW'],
  },
  {
    id: 'five-open',
    name: '五色開局',
    blurb: '容量 5・五色',
    capacity: 5,
    bottles: [
      [{ color: 'RED' }],
      [],
      [{ color: 'GREEN' }, { color: 'GREEN' }, { color: 'GREEN' }, { color: 'GREEN' }, { color: 'PURPLE' }],
      [{ color: 'BLUE' }, { color: 'GREEN' }, { color: 'RED' }, { color: 'YELLOW' }, { color: 'RED' }],
      [{ color: 'YELLOW' }, { color: 'RED' }, { color: 'YELLOW' }, { color: 'BLUE' }],
      [{ color: 'BLUE' }, { color: 'PURPLE' }, { color: 'PURPLE' }, { color: 'PURPLE' }, { color: 'RED' }],
      [{ color: 'BLUE' }, { color: 'BLUE' }, { color: 'PURPLE' }, { color: 'YELLOW' }, { color: 'YELLOW' }],
    ],
    orderColors: ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE'],
  },
  {
    id: 'five-veil',
    name: '五色迷霧',
    blurb: '容量 5・隱藏層增多',
    capacity: 5,
    bottles: [
      [],
      [
        { color: 'YELLOW', isHidden: true },
        { color: 'BLUE', isHidden: true },
        { color: 'RED' },
        { color: 'RED' },
      ],
      [{ color: 'GREEN' }, { color: 'BLUE' }, { color: 'BLUE' }],
      [
        { color: 'PURPLE', isHidden: true },
        { color: 'PURPLE', isHidden: true },
        { color: 'RED' },
        { color: 'GREEN' },
        { color: 'PURPLE' },
      ],
      [
        { color: 'YELLOW', isHidden: true },
        { color: 'YELLOW', isHidden: true },
        { color: 'PURPLE' },
        { color: 'RED' },
        { color: 'PURPLE' },
      ],
      [
        { color: 'BLUE', isHidden: true },
        { color: 'GREEN', isHidden: true },
        { color: 'GREEN' },
        { color: 'GREEN' },
        { color: 'RED' },
      ],
      [{ color: 'BLUE' }, { color: 'YELLOW' }, { color: 'YELLOW' }],
    ],
    orderColors: ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE'],
  },
  {
    id: 'six-finale',
    name: '六色終章',
    blurb: '容量 6・六色收官',
    capacity: 6,
    bottles: [
      [
        { color: 'RED' },
        { color: 'RED' },
        { color: 'GREEN' },
        { color: 'YELLOW' },
        { color: 'YELLOW' },
        { color: 'RED' },
      ],
      [
        { color: 'BLUE' },
        { color: 'BLUE' },
        { color: 'BLUE' },
        { color: 'BLUE' },
        { color: 'GREEN' },
        { color: 'ORANGE' },
      ],
      [
        { color: 'PURPLE' },
        { color: 'PURPLE' },
        { color: 'PURPLE' },
        { color: 'PURPLE' },
        { color: 'BLUE' },
        { color: 'YELLOW' },
      ],
      [{ color: 'YELLOW' }, { color: 'YELLOW' }, { color: 'YELLOW' }, { color: 'PURPLE' }],
      [{ color: 'GREEN' }, { color: 'RED' }, { color: 'GREEN' }, { color: 'BLUE' }, { color: 'RED' }],
      [
        { color: 'ORANGE' },
        { color: 'ORANGE' },
        { color: 'ORANGE' },
        { color: 'ORANGE' },
        { color: 'RED' },
      ],
      [{ color: 'ORANGE' }, { color: 'GREEN' }, { color: 'GREEN' }, { color: 'PURPLE' }],
      [],
    ],
    orderColors: ['RED', 'BLUE', 'GREEN', 'YELLOW', 'PURPLE', 'ORANGE'],
  },
];

export type PuzzlePackProgress = {
  /** Number of stages cleared from the start (0 = none). Stage i unlocks when i <= clearedCount. */
  clearedCount: number;
  /** Best pour counts keyed by stage id (lower is better). */
  bestMoves: Record<string, number>;
};

export const EMPTY_PACK_PROGRESS: PuzzlePackProgress = {
  clearedCount: 0,
  bestMoves: {},
};

export function packStageCount(): number {
  return PUZZLE_PACK_STAGES.length;
}

export function getPackStage(index: number): PackStageDef | undefined {
  return PUZZLE_PACK_STAGES[index];
}

export function packStageIndexById(id: string): number {
  return PUZZLE_PACK_STAGES.findIndex((s) => s.id === id);
}

/** Stage `index` is playable when every prior stage is cleared (stage 0 always open). */
export function isPackStageUnlocked(index: number, clearedCount: number): boolean {
  if (index < 0 || index >= PUZZLE_PACK_STAGES.length) return false;
  return index <= clearedCount;
}

/** Next stage to continue from (first uncleared, or last if pack complete). */
export function continuePackIndex(clearedCount: number): number {
  if (clearedCount <= 0) return 0;
  if (clearedCount >= PUZZLE_PACK_STAGES.length) return PUZZLE_PACK_STAGES.length - 1;
  return clearedCount;
}

/**
 * Pure progress update after clearing a stage. Does not touch localStorage.
 * Advancing the unlock cursor only happens when clearing the current frontier.
 */
export function applyPackStageClear(
  progress: PuzzlePackProgress,
  stageIndex: number,
  moves: number,
): PuzzlePackProgress {
  const stage = PUZZLE_PACK_STAGES[stageIndex];
  if (!stage || !Number.isFinite(moves) || moves < 0) return progress;

  const bestMoves = { ...progress.bestMoves };
  const prev = bestMoves[stage.id];
  const nextMoves = Math.floor(moves);
  bestMoves[stage.id] = prev == null ? nextMoves : Math.min(prev, nextMoves);

  let clearedCount = progress.clearedCount;
  if (stageIndex === clearedCount && clearedCount < PUZZLE_PACK_STAGES.length) {
    clearedCount = stageIndex + 1;
  }

  return { clearedCount, bestMoves };
}

export function loadPackProgress(): PuzzlePackProgress {
  try {
    const raw = localStorage.getItem(PUZZLE_PACK_STORAGE_KEY);
    if (!raw) return { ...EMPTY_PACK_PROGRESS, bestMoves: {} };
    const parsed = JSON.parse(raw) as Partial<PuzzlePackProgress>;
    const clearedCount = Math.max(
      0,
      Math.min(PUZZLE_PACK_STAGES.length, Math.floor(Number(parsed.clearedCount) || 0)),
    );
    const bestMoves: Record<string, number> = {};
    if (parsed.bestMoves && typeof parsed.bestMoves === 'object') {
      for (const [k, v] of Object.entries(parsed.bestMoves)) {
        const n = Number(v);
        if (Number.isFinite(n) && n >= 0) bestMoves[k] = Math.floor(n);
      }
    }
    return { clearedCount, bestMoves };
  } catch {
    return { ...EMPTY_PACK_PROGRESS, bestMoves: {} };
  }
}

export function savePackProgress(progress: PuzzlePackProgress): void {
  try {
    localStorage.setItem(PUZZLE_PACK_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* private mode */
  }
}

/** Persist a clear and return the updated progress. */
export function persistPackStageClear(stageIndex: number, moves: number): PuzzlePackProgress {
  const next = applyPackStageClear(loadPackProgress(), stageIndex, moves);
  savePackProgress(next);
  return next;
}

function resolveColor(key: keyof typeof Color): Color {
  return Color[key];
}

/**
 * Materialise a pack stage into playable bottles + orders.
 * Throws if the definition violates colour accounting (caught by check).
 */
export function materializePackStage(stage: PackStageDef): { bottles: BottleData[]; orders: Order[] } {
  const capacity = stage.capacity;
  const bottles: BottleData[] = stage.bottles.map((defs, bottleIndex) => {
    if (defs.length > capacity) {
      throw new Error(`pack ${stage.id}: bottle ${bottleIndex} exceeds capacity ${capacity}`);
    }
    const layers: Layer[] = defs.map((d, layerIndex) => {
      const color = resolveColor(d.color);
      const isTop = layerIndex === defs.length - 1;
      const isHidden = Boolean(d.isHidden) && !isTop;
      return createLayer(color, isHidden);
    });
    const isCompleted =
      layers.length === capacity &&
      layers.length > 0 &&
      layers.every((l) => l.color === layers[0].color && !l.isHidden);
    return {
      id: `pack-${stage.id}-b${bottleIndex}`,
      layers,
      capacity,
      isCompleted,
      mixingEnabled: false,
    };
  });

  // Colour accounting: each order colour must appear exactly `capacity` times.
  const counts = new Map<Color, number>();
  for (const b of bottles) {
    for (const l of b.layers) {
      counts.set(l.color, (counts.get(l.color) ?? 0) + 1);
    }
  }
  for (const key of stage.orderColors) {
    const color = resolveColor(key);
    const n = counts.get(color) ?? 0;
    if (n !== capacity) {
      throw new Error(`pack ${stage.id}: colour ${key} has ${n} units, expected ${capacity}`);
    }
  }
  if (counts.size !== stage.orderColors.length) {
    throw new Error(`pack ${stage.id}: extra colours on board beyond orders`);
  }

  const orders: Order[] = stage.orderColors.map((key, index) => ({
    id: `pack-${stage.id}-o${index}`,
    color: resolveColor(key),
    isCompleted: false,
    isLocked: index >= 2,
  }));

  return { bottles, orders };
}

export function materializePackStageAt(index: number): { bottles: BottleData[]; orders: Order[]; stage: PackStageDef } {
  const stage = PUZZLE_PACK_STAGES[index];
  if (!stage) throw new Error(`pack stage index out of range: ${index}`);
  const board = materializePackStage(stage);
  return { ...board, stage };
}

/**
 * Mix challenge pack: hand-authored boards that *require* mixing to fulfil
 * at least one order. Progress is tracked separately from the pure-sort
 * puzzle pack (`mls-puzzle-pack-v1`) and adventure / quick-play keys.
 */
import { Color, type BottleData, type Layer, type Order } from '../types.ts';
import { createLayer } from './gameLogic.ts';

export const MIX_CHALLENGE_STORAGE_KEY = 'mls-mix-challenge-v1';

export type MixLayerDef = {
  color: keyof typeof Color;
  isHidden?: boolean;
};

export type MixStageDef = {
  id: string;
  /** Traditional Chinese display name. */
  name: string;
  /** Short Traditional Chinese blurb for the stage list. */
  blurb: string;
  /** On-board tip shown during play (recipe reminder). */
  tip: string;
  capacity: number;
  /** Bottom → top layers per bottle; `[]` = empty spare. */
  bottles: MixLayerDef[][];
  /** Order colour keys — at least one must be mix-producible and under-supplied. */
  orderColors: (keyof typeof Color)[];
};

/**
 * Five forced-mix recipe stages. Colour accounting allows mix products to be
 * absent at deal time when their primary components supply the volume.
 * Independently verified solvable by check-liquid-sort.mjs.
 */
export const MIX_CHALLENGE_STAGES: readonly MixStageDef[] = [
  {
    id: 'mix-orange-intro',
    name: '橙墨初混',
    blurb: '紅+黃→橙・必混教學',
    tip: '把紅倒進黃（或反過來）混出橙色訂單',
    capacity: 4,
    bottles: [
      [{ color: 'RED' }, { color: 'RED' }],
      [{ color: 'YELLOW' }, { color: 'YELLOW' }],
      [],
    ],
    orderColors: ['ORANGE'],
  },
  {
    id: 'mix-green-split',
    name: '綠墨分流',
    blurb: '藍+黃→綠・另有紅單',
    tip: '先混出綠，紅可直接分裝交單',
    capacity: 4,
    bottles: [
      [{ color: 'RED' }, { color: 'RED' }, { color: 'BLUE' }],
      [{ color: 'RED' }, { color: 'RED' }, { color: 'YELLOW' }],
      [{ color: 'BLUE' }, { color: 'YELLOW' }],
      [],
    ],
    orderColors: ['RED', 'GREEN'],
  },
  {
    id: 'mix-purple-line',
    name: '紫墨雙線',
    blurb: '紅+藍→紫・黃單並行',
    tip: '紫必須混；黃不要誤混掉',
    capacity: 4,
    bottles: [
      [{ color: 'RED' }, { color: 'YELLOW' }],
      [{ color: 'BLUE' }, { color: 'YELLOW' }],
      [{ color: 'RED' }, { color: 'YELLOW' }],
      [{ color: 'BLUE' }, { color: 'YELLOW' }],
      [],
    ],
    orderColors: ['PURPLE', 'YELLOW'],
  },
  {
    id: 'mix-dual-recipe',
    name: '雙配方交錯',
    blurb: '橙與綠都要混・黃共用',
    tip: '黃要分給橙與綠各一半，別混錯',
    capacity: 4,
    bottles: [
      [{ color: 'RED' }, { color: 'BLUE' }],
      [{ color: 'YELLOW' }, { color: 'YELLOW' }],
      [{ color: 'RED' }, { color: 'YELLOW' }],
      [{ color: 'BLUE' }, { color: 'YELLOW' }],
      [],
      [],
    ],
    orderColors: ['ORANGE', 'GREEN'],
  },
  {
    id: 'mix-deep-six',
    name: '六格深混',
    blurb: '容量 6・橙必混＋藍單',
    tip: '三紅三黃混滿一瓶橙，藍另裝',
    capacity: 6,
    bottles: [
      [{ color: 'RED' }, { color: 'RED' }, { color: 'BLUE' }],
      [{ color: 'YELLOW' }, { color: 'YELLOW' }, { color: 'BLUE' }],
      [{ color: 'RED' }, { color: 'YELLOW' }, { color: 'BLUE' }],
      [{ color: 'BLUE' }, { color: 'BLUE' }, { color: 'BLUE' }],
      [],
      [],
    ],
    orderColors: ['ORANGE', 'BLUE'],
  },
  {
    id: 'mix-triple-finale',
    name: '三色混終章',
    blurb: '橙・綠・紫全靠配方',
    tip: '三組配方都要用；原色剛好分完',
    capacity: 4,
    bottles: [
      [{ color: 'RED' }, { color: 'YELLOW' }, { color: 'BLUE' }],
      [{ color: 'RED' }, { color: 'BLUE' }, { color: 'YELLOW' }],
      [{ color: 'YELLOW' }, { color: 'RED' }],
      [{ color: 'BLUE' }, { color: 'YELLOW' }],
      [{ color: 'RED' }, { color: 'BLUE' }],
      [],
      [],
    ],
    orderColors: ['ORANGE', 'GREEN', 'PURPLE'],
  },
];

export type MixChallengeProgress = {
  clearedCount: number;
  bestMoves: Record<string, number>;
};

export const EMPTY_MIX_PROGRESS: MixChallengeProgress = {
  clearedCount: 0,
  bestMoves: {},
};

export function mixStageCount(): number {
  return MIX_CHALLENGE_STAGES.length;
}

export function getMixStage(index: number): MixStageDef | undefined {
  return MIX_CHALLENGE_STAGES[index];
}

export function isMixStageUnlocked(index: number, clearedCount: number): boolean {
  if (index < 0 || index >= MIX_CHALLENGE_STAGES.length) return false;
  return index <= clearedCount;
}

export function continueMixIndex(clearedCount: number): number {
  if (clearedCount <= 0) return 0;
  if (clearedCount >= MIX_CHALLENGE_STAGES.length) return MIX_CHALLENGE_STAGES.length - 1;
  return clearedCount;
}

export function applyMixStageClear(
  progress: MixChallengeProgress,
  stageIndex: number,
  moves: number,
): MixChallengeProgress {
  const stage = MIX_CHALLENGE_STAGES[stageIndex];
  if (!stage || !Number.isFinite(moves) || moves < 0) return progress;

  const bestMoves = { ...progress.bestMoves };
  const prev = bestMoves[stage.id];
  const nextMoves = Math.floor(moves);
  bestMoves[stage.id] = prev == null ? nextMoves : Math.min(prev, nextMoves);

  let clearedCount = progress.clearedCount;
  if (stageIndex === clearedCount && clearedCount < MIX_CHALLENGE_STAGES.length) {
    clearedCount = stageIndex + 1;
  }

  return { clearedCount, bestMoves };
}

export function loadMixProgress(): MixChallengeProgress {
  try {
    const raw = localStorage.getItem(MIX_CHALLENGE_STORAGE_KEY);
    if (!raw) return { ...EMPTY_MIX_PROGRESS, bestMoves: {} };
    const parsed = JSON.parse(raw) as Partial<MixChallengeProgress>;
    const clearedCount = Math.max(
      0,
      Math.min(MIX_CHALLENGE_STAGES.length, Math.floor(Number(parsed.clearedCount) || 0)),
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
    return { ...EMPTY_MIX_PROGRESS, bestMoves: {} };
  }
}

export function saveMixProgress(progress: MixChallengeProgress): void {
  try {
    localStorage.setItem(MIX_CHALLENGE_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    /* private mode */
  }
}

export function persistMixStageClear(stageIndex: number, moves: number): MixChallengeProgress {
  const next = applyMixStageClear(loadMixProgress(), stageIndex, moves);
  saveMixProgress(next);
  return next;
}

function resolveColor(key: keyof typeof Color): Color {
  return Color[key];
}

/** Mix products that can be formed from the three registered recipes. */
const MIX_PRODUCT_KEYS = new Set<keyof typeof Color>(['ORANGE', 'GREEN', 'PURPLE']);
const MIX_COMPONENTS_KEYS: Record<string, [keyof typeof Color, keyof typeof Color]> = {
  ORANGE: ['RED', 'YELLOW'],
  GREEN: ['BLUE', 'YELLOW'],
  PURPLE: ['RED', 'BLUE'],
};

/**
 * Materialise a mix stage into playable bottles + orders.
 * Mix products may be under-supplied on the board when components make up the volume.
 */
export function materializeMixStage(stage: MixStageDef): { bottles: BottleData[]; orders: Order[] } {
  const capacity = stage.capacity;
  const bottles: BottleData[] = stage.bottles.map((defs, bottleIndex) => {
    if (defs.length > capacity) {
      throw new Error(`mix ${stage.id}: bottle ${bottleIndex} exceeds capacity ${capacity}`);
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
      id: `mix-${stage.id}-b${bottleIndex}`,
      layers,
      capacity,
      isCompleted,
      mixingEnabled: true,
    };
  });

  const counts = new Map<Color, number>();
  for (const b of bottles) {
    for (const l of b.layers) {
      counts.set(l.color, (counts.get(l.color) ?? 0) + 1);
    }
  }

  const totalUnits = [...counts.values()].reduce((a, n) => a + n, 0);
  const expectedUnits = capacity * stage.orderColors.length;
  if (totalUnits !== expectedUnits) {
    throw new Error(`mix ${stage.id}: board has ${totalUnits} units, expected ${expectedUnits}`);
  }

  // Each non-mix order colour must already have exactly `capacity` units.
  // Each mix-product order may be short; components must cover the deficit
  // (1 unit of each component → 1 unit of product after a 1:1 pair; volume
  // is conserved so deficit D needs D/2 of each component beyond other needs).
  for (const key of stage.orderColors) {
    const color = resolveColor(key);
    const onBoard = counts.get(color) ?? 0;
    if (MIX_PRODUCT_KEYS.has(key)) {
      if (onBoard > capacity) {
        throw new Error(`mix ${stage.id}: colour ${key} has ${onBoard} units (> capacity)`);
      }
      if (onBoard < capacity) {
        const deficit = capacity - onBoard;
        if (deficit % 2 !== 0) {
          throw new Error(`mix ${stage.id}: odd deficit for mix product ${key}`);
        }
        // Soft check — full solvability is verified by the check script solver.
        const comps = MIX_COMPONENTS_KEYS[key];
        if (!comps) throw new Error(`mix ${stage.id}: unknown mix product ${key}`);
      }
    } else if (onBoard !== capacity) {
      throw new Error(`mix ${stage.id}: colour ${key} has ${onBoard} units, expected ${capacity}`);
    }
  }

  const orders: Order[] = stage.orderColors.map((key, index) => ({
    id: `mix-${stage.id}-o${index}`,
    color: resolveColor(key),
    isCompleted: false,
    isLocked: index >= 2,
  }));

  return { bottles, orders };
}

export function materializeMixStageAt(index: number): {
  bottles: BottleData[];
  orders: Order[];
  stage: MixStageDef;
} {
  const stage = MIX_CHALLENGE_STAGES[index];
  if (!stage) throw new Error(`mix stage index out of range: ${index}`);
  const board = materializeMixStage(stage);
  return { ...board, stage };
}

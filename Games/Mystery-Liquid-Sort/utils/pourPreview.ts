import { Color, type BottleData } from '../types.ts';
import { canPour, pourLiquid, isMixingPour, MIX_RECIPES } from '../services/gameLogic.ts';

export interface PourPreview {
  movedCount: number;
  isMix: boolean;
  resultingColor: Color;
  mixFormula?: string;
  willComplete: boolean;
}

/**
 * Calculates live pour projection when a source bottle is selected.
 * Returns null if the pour is not possible.
 */
export function calculatePourPreview(
  source: BottleData | null | undefined,
  target: BottleData
): PourPreview | null {
  if (!source || !canPour(source, target)) {
    return null;
  }

  const { newTarget, movedCount } = pourLiquid(source, target);
  const isMix = isMixingPour(source, target);
  const sourceTop = source.layers[source.layers.length - 1];
  const targetTop = target.layers[target.layers.length - 1];

  let mixFormula: string | undefined;
  if (isMix && targetTop && sourceTop) {
    const match = MIX_RECIPES.find(
      (r) =>
        (r.a === sourceTop.color && r.b === targetTop.color) ||
        (r.a === targetTop.color && r.b === sourceTop.color)
    );
    mixFormula = match ? match.label : `${sourceTop.color} + ${targetTop.color}`;
  }

  const topLayer = newTarget.layers[newTarget.layers.length - 1];
  const resultingColor = topLayer ? topLayer.color : sourceTop.color;
  const willComplete = newTarget.isCompleted;

  return {
    movedCount,
    isMix,
    resultingColor,
    mixFormula,
    willComplete,
  };
}

/**
 * Partitions bottles into visually balanced rows for test-tube rack presentation.
 * Avoids awkward orphaned bottles (e.g., 4 on row 1, 1 on row 2).
 */
export function partitionBottlesIntoRows(bottles: BottleData[]): BottleData[][] {
  const total = bottles.length;
  if (total <= 4) {
    return [bottles];
  }
  if (total === 5) {
    return [bottles.slice(0, 3), bottles.slice(3, 5)];
  }
  if (total === 6) {
    return [bottles.slice(0, 3), bottles.slice(3, 6)];
  }
  if (total === 7) {
    return [bottles.slice(0, 4), bottles.slice(4, 7)];
  }
  if (total === 8) {
    return [bottles.slice(0, 4), bottles.slice(4, 8)];
  }
  // 9 or more: divide into two as-equal-as-possible rows
  const half = Math.ceil(total / 2);
  return [bottles.slice(0, half), bottles.slice(half)];
}

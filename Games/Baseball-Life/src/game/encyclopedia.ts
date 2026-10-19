/**
 * Cross-career special-ability encyclopedia progress (M4).
 * Separate from a single GameState so collection survives retirement.
 */
import { ABILITIES } from './abilities';
import type { GameState } from './types';

export interface EncyclopediaProgress {
  /** Ability ids ever unlocked in any finished (or mid) career. */
  unlocked: Record<string, true>;
  /** How many times each ability has been earned. */
  counts: Record<string, number>;
}

export const EMPTY_ENCYCLOPEDIA: EncyclopediaProgress = {
  unlocked: {},
  counts: {},
};

export function encyclopediaStats(progress: EncyclopediaProgress): {
  unlocked: number;
  total: number;
} {
  return {
    unlocked: Object.keys(progress.unlocked).length,
    total: ABILITIES.length,
  };
}

/** Merge abilities from a career into encyclopedia progress. */
export function recordAbilitiesInEncyclopedia(
  progress: EncyclopediaProgress,
  abilityIds: string[],
): EncyclopediaProgress {
  const next: EncyclopediaProgress = {
    unlocked: { ...progress.unlocked },
    counts: { ...progress.counts },
  };
  abilityIds.forEach((id) => {
    if (!ABILITIES.some((a) => a.id === id)) return;
    next.unlocked[id] = true;
    next.counts[id] = (next.counts[id] ?? 0) + 1;
  });
  return next;
}

export function recordCareerEncyclopedia(
  progress: EncyclopediaProgress,
  state: GameState,
): EncyclopediaProgress {
  return recordAbilitiesInEncyclopedia(progress, state.abilities);
}

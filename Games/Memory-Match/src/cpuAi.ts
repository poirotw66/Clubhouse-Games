import {
  CPU_RETAIN,
  cpuCapacityFor,
  type CpuDifficulty,
  type FaceId,
  type MemoryCard,
  type PairCount,
  unmatchedIndices,
} from './memoryLogic.ts';

/** One remembered sighting of a face-down card. */
export interface MemoryEntry {
  index: number;
  face: FaceId;
  /** Global turn index when last seen (increments each completed flip-pair). */
  seenAtTurn: number;
}

export type CpuMemory = MemoryEntry[];

export function emptyCpuMemory(): CpuMemory {
  return [];
}

/**
 * Record revealed cards into CPU memory, pruning by capacity (oldest first).
 * Matched cards are dropped; re-seeing a card refreshes its timestamp.
 * Pass `pairCount` so capacity scales with board size.
 */
export function rememberRevealed(
  memory: CpuMemory,
  cards: MemoryCard[],
  indices: readonly number[],
  turn: number,
  difficulty: CpuDifficulty,
  pairCount: PairCount = 12,
): CpuMemory {
  let next = memory.filter((e) => !cards[e.index]?.matched);
  for (const index of indices) {
    const card = cards[index];
    if (!card || card.matched) continue;
    next = next.filter((e) => e.index !== index);
    next.push({ index, face: card.face, seenAtTurn: turn });
  }
  const capacity = cpuCapacityFor(difficulty, pairCount);
  if (next.length > capacity) {
    next = [...next].sort((a, b) => a.seenAtTurn - b.seenAtTurn).slice(next.length - capacity);
  }
  return next;
}

/** Probability the CPU still recalls an entry at `currentTurn`. */
export function recallProbability(
  entry: MemoryEntry,
  currentTurn: number,
  difficulty: CpuDifficulty,
): number {
  const age = Math.max(0, currentTurn - entry.seenAtTurn);
  const retain = CPU_RETAIN[difficulty];
  return retain ** age;
}

/**
 * Entries the CPU successfully recalls this decision (stochastic).
 * Decay is monotonic in age for a fixed retain in (0,1).
 */
export function recalledEntries(
  memory: CpuMemory,
  cards: MemoryCard[],
  currentTurn: number,
  difficulty: CpuDifficulty,
  rand: () => number,
): MemoryEntry[] {
  const live = memory.filter((e) => {
    const card = cards[e.index];
    return card && !card.matched && card.face === e.face;
  });
  return live.filter((e) => rand() < recallProbability(e, currentTurn, difficulty));
}

/**
 * Known matching pair among recalled entries, if any.
 * Prefers freshest pair when several exist.
 */
export function knownMatchPair(recalled: MemoryEntry[]): [number, number] | null {
  const byFace = new Map<FaceId, MemoryEntry[]>();
  for (const e of recalled) {
    const list = byFace.get(e.face) ?? [];
    list.push(e);
    byFace.set(e.face, list);
  }
  let best: [number, number, number] | null = null;
  for (const list of byFace.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => b.seenAtTurn - a.seenAtTurn);
    const a = sorted[0];
    const b = sorted[1];
    const freshness = a.seenAtTurn + b.seenAtTurn;
    if (!best || freshness > best[2]) best = [a.index, b.index, freshness];
  }
  return best ? [best[0], best[1]] : null;
}

function pickRandom<T>(items: readonly T[], rand: () => number): T {
  return items[Math.floor(rand() * items.length)];
}

/** Probability hard CPU stalls when clearly behind (preferStall). Softened from 0.35. */
export const HARD_STALL_CHANCE = 0.25;

/**
 * Hard CPU sometimes opens two already-known cards that do NOT match,
 * denying the player new information ("stall"). Only used when clearly behind.
 */
function stallPair(
  recalled: MemoryEntry[],
  rand: () => number,
): [number, number] | null {
  if (recalled.length < 2) return null;
  const shuffled = [...recalled].sort(() => rand() - 0.5);
  for (let i = 0; i < shuffled.length; i++) {
    for (let j = i + 1; j < shuffled.length; j++) {
      if (shuffled[i].face !== shuffled[j].face) {
        return [shuffled[i].index, shuffled[j].index];
      }
    }
  }
  return null;
}

export interface CpuPickContext {
  cards: MemoryCard[];
  memory: CpuMemory;
  turn: number;
  difficulty: CpuDifficulty;
  /** When true and difficulty is hard, may stall with known non-matching cards. */
  preferStall?: boolean;
  rand?: () => number;
}

/**
 * Choose two unmatched indices for the CPU turn.
 * Never selects already-matched cards.
 */
export function pickCpuMove(ctx: CpuPickContext): [number, number] {
  const rand = ctx.rand ?? Math.random;
  const open = unmatchedIndices(ctx.cards);
  if (open.length < 2) {
    throw new Error('pickCpuMove requires at least two unmatched cards');
  }

  const recalled = recalledEntries(ctx.memory, ctx.cards, ctx.turn, ctx.difficulty, rand);
  const known = knownMatchPair(recalled);

  if (
    ctx.difficulty === 'hard' &&
    ctx.preferStall &&
    rand() < HARD_STALL_CHANCE &&
    !known
  ) {
    const stall = stallPair(recalled, rand);
    if (stall) return stall;
  }

  if (known) return known;

  // First flip: unknown card preferred.
  const unknown = open.filter((i) => !recalled.some((e) => e.index === i));
  const firstPool = unknown.length > 0 ? unknown : open;
  const first = pickRandom(firstPool, rand);

  // After seeing first (simulated), try to match from memory of that face.
  const firstFace = ctx.cards[first].face;
  const mate = recalled.find((e) => e.face === firstFace && e.index !== first);
  if (mate) return [first, mate.index];

  const secondPool = open.filter((i) => i !== first);
  const second = pickRandom(secondPool, rand);
  return [first, second];
}

/** Pure helper for checks: decay must be non-increasing as age grows. */
export function decayIsMonotonic(retain: number, maxAge = 12): boolean {
  if (!(retain > 0 && retain < 1)) return false;
  let prev = 1;
  for (let age = 0; age <= maxAge; age++) {
    const p = retain ** age;
    if (p > prev + 1e-12) return false;
    prev = p;
  }
  return true;
}

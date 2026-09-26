export const FACE_IDS = ['star', 'moon', 'fish', 'cherry', 'leaf', 'gem'] as const;
export type FaceId = (typeof FACE_IDS)[number];

export type PairCount = 4 | 6;

export type PlayMode = 'classic' | 'sprint';

export const SPRINT_LIMIT_SEC = 60;

export interface MemoryCard {
  id: string;
  face: FaceId;
  matched: boolean;
}

export function buildDeck(pairCount: PairCount = 6, rand: () => number = Math.random): MemoryCard[] {
  const chosen = FACE_IDS.slice(0, pairCount);
  const faces = [...chosen, ...chosen];
  for (let i = faces.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = faces[i];
    faces[i] = faces[j];
    faces[j] = tmp;
  }
  return faces.map((face, i) => ({ id: `${face}-${i}`, face, matched: false }));
}

export function allMatched(cards: MemoryCard[]): boolean {
  return cards.every((c) => c.matched);
}

/**
 * Pick one unmatched face and return both card indices (for a brief peek hint).
 */
export function hintPairIndices(cards: MemoryCard[]): [number, number] | null {
  const byFace = new Map<FaceId, number[]>();
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (card.matched) continue;
    const list = byFace.get(card.face) ?? [];
    list.push(i);
    byFace.set(card.face, list);
  }
  for (const indices of byFace.values()) {
    if (indices.length >= 2) return [indices[0], indices[1]];
  }
  return null;
}

const BEST_KEY = 'clubhouse-memory-match-best';

export function loadBestMoves(pairCount: PairCount): number | null {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, number>;
    const v = parsed[String(pairCount)];
    return typeof v === 'number' && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function saveBestMoves(pairCount: PairCount, moves: number): number | null {
  const prev = loadBestMoves(pairCount);
  if (prev !== null && moves >= prev) return prev;
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    parsed[String(pairCount)] = moves;
    localStorage.setItem(BEST_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
  return moves;
}

export function loadBestSprintSec(pairCount: PairCount): number | null {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, number>;
    const v = parsed[`sprint-${pairCount}`];
    return typeof v === 'number' && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function saveBestSprintSec(pairCount: PairCount, sec: number): number | null {
  const prev = loadBestSprintSec(pairCount);
  if (prev !== null && sec >= prev) return prev;
  try {
    const raw = localStorage.getItem(BEST_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    parsed[`sprint-${pairCount}`] = sec;
    localStorage.setItem(BEST_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore */
  }
  return sec;
}

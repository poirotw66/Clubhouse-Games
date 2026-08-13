export const FACE_IDS = ['star', 'moon', 'fish', 'cherry', 'leaf', 'gem'] as const;
export type FaceId = (typeof FACE_IDS)[number];

export type PairCount = 4 | 6;

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

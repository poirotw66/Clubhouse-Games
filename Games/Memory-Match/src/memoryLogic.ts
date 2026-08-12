export const FACE_IDS = ['star', 'moon', 'fish', 'cherry', 'leaf', 'gem'] as const;
export type FaceId = (typeof FACE_IDS)[number];

export interface MemoryCard {
  id: string;
  face: FaceId;
  matched: boolean;
}

export function buildDeck(rand: () => number = Math.random): MemoryCard[] {
  const faces = [...FACE_IDS, ...FACE_IDS];
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

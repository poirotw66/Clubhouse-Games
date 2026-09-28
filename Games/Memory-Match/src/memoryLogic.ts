export const FACE_IDS = ['star', 'moon', 'fish', 'cherry', 'leaf', 'gem'] as const;
export type FaceId = (typeof FACE_IDS)[number];

export type PairCount = 4 | 6;

export type PlayMode = 'classic' | 'sprint';

/** Named face pools that change which symbols appear on the board. */
export type ThemeId = 'classic' | 'night' | 'orchard' | 'jewel';

export const SPRINT_LIMIT_SEC = 60;

export const THEME_OPTIONS: {
  id: ThemeId;
  label: string;
  faces: readonly FaceId[];
}[] = [
  {
    id: 'classic',
    label: '經典全圖',
    faces: FACE_IDS,
  },
  {
    id: 'night',
    label: '夜空',
    faces: ['star', 'moon', 'gem', 'fish'],
  },
  {
    id: 'orchard',
    label: '果園',
    faces: ['cherry', 'leaf', 'fish', 'star'],
  },
  {
    id: 'jewel',
    label: '寶庫',
    faces: ['gem', 'star', 'moon', 'cherry'],
  },
];

export function themeFaces(themeId: ThemeId): readonly FaceId[] {
  const found = THEME_OPTIONS.find((t) => t.id === themeId);
  return found?.faces ?? FACE_IDS;
}

/** Max pairs a theme can deal (floor of its face pool size). */
export function maxPairsForTheme(themeId: ThemeId): PairCount {
  const n = themeFaces(themeId).length;
  return n >= 6 ? 6 : 4;
}

export function clampPairCount(themeId: ThemeId, pairCount: PairCount): PairCount {
  const max = maxPairsForTheme(themeId);
  return pairCount > max ? max : pairCount;
}

export interface MemoryCard {
  id: string;
  face: FaceId;
  matched: boolean;
}

export function buildDeck(
  pairCount: PairCount = 6,
  themeId: ThemeId = 'classic',
  rand: () => number = Math.random,
): MemoryCard[] {
  const pool = themeFaces(themeId);
  const n = clampPairCount(themeId, pairCount);
  const chosen = pool.slice(0, n);
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

/** Classic theme keeps legacy keys `4` / `6` / `sprint-4` / `sprint-6`. */
export function bestStorageSlot(
  mode: PlayMode,
  themeId: ThemeId,
  pairCount: PairCount,
): string {
  const n = clampPairCount(themeId, pairCount);
  if (themeId === 'classic') {
    return mode === 'classic' ? String(n) : `sprint-${n}`;
  }
  return mode === 'classic' ? `${themeId}-${n}` : `sprint-${themeId}-${n}`;
}

function readBestMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(BEST_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeBestMap(parsed: Record<string, number>): void {
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(parsed));
  } catch {
    /* ignore quota / private mode */
  }
}

export function loadBestMoves(pairCount: PairCount, themeId: ThemeId = 'classic'): number | null {
  const v = readBestMap()[bestStorageSlot('classic', themeId, pairCount)];
  return typeof v === 'number' && v > 0 ? v : null;
}

export function saveBestMoves(
  pairCount: PairCount,
  moves: number,
  themeId: ThemeId = 'classic',
): number | null {
  const slot = bestStorageSlot('classic', themeId, pairCount);
  const prev = loadBestMoves(pairCount, themeId);
  if (prev !== null && moves >= prev) return prev;
  const parsed = readBestMap();
  parsed[slot] = moves;
  writeBestMap(parsed);
  return moves;
}

export function loadBestSprintSec(
  pairCount: PairCount,
  themeId: ThemeId = 'classic',
): number | null {
  const v = readBestMap()[bestStorageSlot('sprint', themeId, pairCount)];
  return typeof v === 'number' && v > 0 ? v : null;
}

export function saveBestSprintSec(
  pairCount: PairCount,
  sec: number,
  themeId: ThemeId = 'classic',
): number | null {
  const slot = bestStorageSlot('sprint', themeId, pairCount);
  const prev = loadBestSprintSec(pairCount, themeId);
  if (prev !== null && sec >= prev) return prev;
  const parsed = readBestMap();
  parsed[slot] = sec;
  writeBestMap(parsed);
  return sec;
}

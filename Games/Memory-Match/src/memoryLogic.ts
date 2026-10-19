/** Face ids — at least 24 unique symbols for large boards. */
export const FACE_IDS = [
  'star',
  'moon',
  'fish',
  'cherry',
  'leaf',
  'gem',
  'sun',
  'comet',
  'cloud',
  'planet',
  'apple',
  'grape',
  'mushroom',
  'flower',
  'tree',
  'acorn',
  'ruby',
  'sapphire',
  'crown',
  'key',
  'coin',
  'ring',
  'bell',
  'heart',
  'anchor',
  'shell',
] as const;

export type FaceId = (typeof FACE_IDS)[number];

/** Photo faces shipped under public/faces/; others render as emoji. */
export const PHOTO_FACE_IDS: readonly FaceId[] = [
  'star',
  'moon',
  'fish',
  'cherry',
  'leaf',
  'gem',
] as const;

export const FACE_EMOJI: Record<FaceId, string> = {
  star: '⭐',
  moon: '🌙',
  fish: '🐟',
  cherry: '🍒',
  leaf: '🍃',
  gem: '💎',
  sun: '☀️',
  comet: '☄️',
  cloud: '☁️',
  planet: '🪐',
  apple: '🍎',
  grape: '🍇',
  mushroom: '🍄',
  flower: '🌸',
  tree: '🌳',
  acorn: '🌰',
  ruby: '🔴',
  sapphire: '🔵',
  crown: '👑',
  key: '🔑',
  coin: '🪙',
  ring: '💍',
  bell: '🔔',
  heart: '❤️',
  anchor: '⚓',
  shell: '🐚',
};

export type PairCount = 6 | 12 | 18 | 24;

export type PlayMode = 'classic' | 'sprint' | 'versus' | 'special';

export type ThemeId = 'classic' | 'night' | 'orchard' | 'jewel';

export type CpuDifficulty = 'easy' | 'normal' | 'hard';

export const SPRINT_LIMIT_SEC = 60;

export const PAIR_OPTIONS: { count: PairCount; label: string }[] = [
  { count: 6, label: '簡單 · 6 對' },
  { count: 12, label: '普通 · 12 對' },
  { count: 18, label: '困難 · 18 對' },
  { count: 24, label: '專家 · 24 對' },
];

export const CPU_DIFFICULTY_OPTIONS: {
  id: CpuDifficulty;
  label: string;
  blurb: string;
}[] = [
  { id: 'easy', label: '簡單', blurb: '記性差、忘得快' },
  { id: 'normal', label: '普通', blurb: '會記幾張，偶爾忘' },
  { id: 'hard', label: '困難', blurb: '記性好，還會藏資訊' },
];

/** Per-match retain rate: p = retain ^ ageInTurns. */
export const CPU_RETAIN: Record<CpuDifficulty, number> = {
  easy: 0.5,
  normal: 0.8,
  hard: 0.95,
};

/** How many face sightings the CPU can hold. */
export const CPU_CAPACITY: Record<CpuDifficulty, number> = {
  easy: 4,
  normal: 8,
  hard: 16,
};

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
    faces: [
      'star',
      'moon',
      'sun',
      'comet',
      'cloud',
      'planet',
      'gem',
      'sapphire',
      'fish',
      'shell',
      'anchor',
      'bell',
    ],
  },
  {
    id: 'orchard',
    label: '果園',
    faces: [
      'cherry',
      'leaf',
      'apple',
      'grape',
      'mushroom',
      'flower',
      'tree',
      'acorn',
      'fish',
      'star',
      'heart',
      'bell',
    ],
  },
  {
    id: 'jewel',
    label: '寶庫',
    faces: [
      'gem',
      'ruby',
      'sapphire',
      'crown',
      'key',
      'coin',
      'ring',
      'star',
      'moon',
      'cherry',
      'heart',
      'bell',
    ],
  },
];

export type CardKind = 'normal' | 'insight';

export interface MemoryCard {
  id: string;
  face: FaceId;
  matched: boolean;
  kind: CardKind;
}

export function themeFaces(themeId: ThemeId): readonly FaceId[] {
  const found = THEME_OPTIONS.find((t) => t.id === themeId);
  return found?.faces ?? FACE_IDS;
}

export function maxPairsForTheme(themeId: ThemeId): PairCount {
  const n = themeFaces(themeId).length;
  if (n >= 24) return 24;
  if (n >= 18) return 18;
  if (n >= 12) return 12;
  return 6;
}

export function clampPairCount(themeId: ThemeId, pairCount: PairCount): PairCount {
  const max = maxPairsForTheme(themeId);
  const allowed = PAIR_OPTIONS.map((p) => p.count).filter((c) => c <= max);
  if (allowed.includes(pairCount)) return pairCount;
  return allowed[allowed.length - 1] ?? 6;
}

export function gridColsClass(pairCount: PairCount): string {
  switch (pairCount) {
    case 6:
      return 'grid-cols-4';
    case 12:
      return 'grid-cols-4 sm:grid-cols-6';
    case 18:
      return 'grid-cols-6';
    case 24:
      return 'grid-cols-6 sm:grid-cols-8';
    default:
      return 'grid-cols-4';
  }
}

export function buildDeck(
  pairCount: PairCount = 12,
  themeId: ThemeId = 'classic',
  rand: () => number = Math.random,
  options: { specialInsight?: boolean } = {},
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

  let insightFace: FaceId | null = null;
  if (options.specialInsight && chosen.length > 0) {
    const idx = Math.floor(rand() * chosen.length);
    insightFace = chosen[idx];
  }

  return faces.map((face, i) => ({
    id: `${face}-${i}`,
    face,
    matched: false,
    kind: insightFace !== null && face === insightFace ? 'insight' : 'normal',
  }));
}

export function allMatched(cards: MemoryCard[]): boolean {
  return cards.length > 0 && cards.every((c) => c.matched);
}

export function unmatchedIndices(cards: MemoryCard[]): number[] {
  const out: number[] = [];
  for (let i = 0; i < cards.length; i++) {
    if (!cards[i].matched) out.push(i);
  }
  return out;
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

/** Combo scoring: each consecutive match multiplies base points. */
export const MATCH_BASE_SCORE = 100;

export function scoreForMatch(comboAfterMatch: number): number {
  const combo = Math.max(1, comboAfterMatch);
  return MATCH_BASE_SCORE * combo;
}

export function nextCombo(prevCombo: number, matched: boolean): number {
  return matched ? prevCombo + 1 : 0;
}

const BEST_KEY = 'clubhouse-memory-match-best';

/**
 * Storage slots:
 * - classic theme legacy: `6`, `12`, … / `sprint-6`, …
 * - themed: `{theme}-{n}` / `sprint-{theme}-{n}`
 * - versus wins: `versus-{diff}-{theme}-{n}`
 * - best time (classic): `time-{theme}-{n}`
 * - best score: `score-{mode}-{theme}-{n}`
 */
export function bestStorageSlot(
  mode: PlayMode,
  themeId: ThemeId,
  pairCount: PairCount,
  extra?: { cpuDifficulty?: CpuDifficulty; metric?: 'moves' | 'time' | 'score' | 'wins' },
): string {
  const n = clampPairCount(themeId, pairCount);
  const metric = extra?.metric ?? (mode === 'sprint' ? 'time' : 'moves');

  if (mode === 'versus') {
    const diff = extra?.cpuDifficulty ?? 'normal';
    return `versus-${diff}-${themeId}-${n}`;
  }

  if (metric === 'score') {
    return `score-${mode}-${themeId}-${n}`;
  }

  if (metric === 'time' && mode === 'classic') {
    return themeId === 'classic' ? `time-${n}` : `time-${themeId}-${n}`;
  }

  if (mode === 'sprint' || (metric === 'time' && mode === 'special')) {
    if (themeId === 'classic' && mode === 'sprint') return `sprint-${n}`;
    return mode === 'sprint' ? `sprint-${themeId}-${n}` : `time-special-${themeId}-${n}`;
  }

  // classic / special moves
  if (themeId === 'classic' && mode === 'classic') return String(n);
  if (mode === 'special') return `special-${themeId}-${n}`;
  return `${themeId}-${n}`;
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

function loadSlot(slot: string): number | null {
  const v = readBestMap()[slot];
  return typeof v === 'number' && v > 0 ? v : null;
}

function saveMin(slot: string, value: number, prev: number | null): number | null {
  if (prev !== null && value >= prev) return prev;
  const parsed = readBestMap();
  parsed[slot] = value;
  writeBestMap(parsed);
  return value;
}

function saveMax(slot: string, value: number, prev: number | null): number | null {
  if (prev !== null && value <= prev) return prev;
  const parsed = readBestMap();
  parsed[slot] = value;
  writeBestMap(parsed);
  return value;
}

export function loadBestMoves(
  pairCount: PairCount,
  themeId: ThemeId = 'classic',
  mode: PlayMode = 'classic',
): number | null {
  return loadSlot(bestStorageSlot(mode, themeId, pairCount, { metric: 'moves' }));
}

export function saveBestMoves(
  pairCount: PairCount,
  moves: number,
  themeId: ThemeId = 'classic',
  mode: PlayMode = 'classic',
): number | null {
  const slot = bestStorageSlot(mode, themeId, pairCount, { metric: 'moves' });
  return saveMin(slot, moves, loadBestMoves(pairCount, themeId, mode));
}

export function loadBestSprintSec(
  pairCount: PairCount,
  themeId: ThemeId = 'classic',
): number | null {
  return loadSlot(bestStorageSlot('sprint', themeId, pairCount, { metric: 'time' }));
}

export function saveBestSprintSec(
  pairCount: PairCount,
  sec: number,
  themeId: ThemeId = 'classic',
): number | null {
  const slot = bestStorageSlot('sprint', themeId, pairCount, { metric: 'time' });
  return saveMin(slot, sec, loadBestSprintSec(pairCount, themeId));
}

export function loadBestTimeSec(
  pairCount: PairCount,
  themeId: ThemeId = 'classic',
  mode: PlayMode = 'classic',
): number | null {
  return loadSlot(bestStorageSlot(mode, themeId, pairCount, { metric: 'time' }));
}

export function saveBestTimeSec(
  pairCount: PairCount,
  sec: number,
  themeId: ThemeId = 'classic',
  mode: PlayMode = 'classic',
): number | null {
  const slot = bestStorageSlot(mode, themeId, pairCount, { metric: 'time' });
  return saveMin(slot, sec, loadBestTimeSec(pairCount, themeId, mode));
}

export function loadBestScore(
  mode: PlayMode,
  pairCount: PairCount,
  themeId: ThemeId = 'classic',
): number | null {
  return loadSlot(bestStorageSlot(mode, themeId, pairCount, { metric: 'score' }));
}

export function saveBestScore(
  mode: PlayMode,
  pairCount: PairCount,
  score: number,
  themeId: ThemeId = 'classic',
): number | null {
  const slot = bestStorageSlot(mode, themeId, pairCount, { metric: 'score' });
  return saveMax(slot, score, loadBestScore(mode, pairCount, themeId));
}

export function loadVersusWins(
  pairCount: PairCount,
  themeId: ThemeId,
  cpuDifficulty: CpuDifficulty,
): number {
  return loadSlot(bestStorageSlot('versus', themeId, pairCount, { cpuDifficulty, metric: 'wins' })) ?? 0;
}

export function saveVersusWin(
  pairCount: PairCount,
  themeId: ThemeId,
  cpuDifficulty: CpuDifficulty,
): number {
  const slot = bestStorageSlot('versus', themeId, pairCount, { cpuDifficulty, metric: 'wins' });
  const prev = loadVersusWins(pairCount, themeId, cpuDifficulty);
  const next = prev + 1;
  const parsed = readBestMap();
  parsed[slot] = next;
  writeBestMap(parsed);
  return next;
}

export function faceUsesPhoto(face: FaceId): boolean {
  return (PHOTO_FACE_IDS as readonly string[]).includes(face);
}

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
  ruby: '♦️',
  sapphire: '🔷',
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

export type PlayMode = 'classic' | 'sprint' | 'versus' | 'special' | 'daily' | 'campaign';

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

/** Per-match retain rate: p = retain ^ ageInTurns. Tuned so hard is tough but not omniscient. */
export const CPU_RETAIN: Record<CpuDifficulty, number> = {
  easy: 0.48,
  normal: 0.74,
  hard: 0.86,
};

/** Base how many face sightings the CPU can hold (scaled by board size via cpuCapacityFor). */
export const CPU_CAPACITY: Record<CpuDifficulty, number> = {
  easy: 4,
  normal: 7,
  hard: 10,
};

/** Capacity grows gently on larger boards so expert 24-pair stays readable, not magical. */
export function cpuCapacityFor(difficulty: CpuDifficulty, pairCount: PairCount): number {
  const base = CPU_CAPACITY[difficulty];
  const step = Math.floor((pairCount - 6) / 6);
  const maxBonus = difficulty === 'hard' ? 3 : difficulty === 'normal' ? 2 : 1;
  return base + Math.min(Math.max(0, step), maxBonus);
}

/** Sprint clock scales with board size — 60s was impossible on 24 pairs. */
export function sprintLimitSec(pairCount: PairCount): number {
  switch (pairCount) {
    case 6:
      return 45;
    case 12:
      return 60;
    case 18:
      return 90;
    case 24:
      return 120;
    default:
      return SPRINT_LIMIT_SEC;
  }
}

/** Soft face tints so emoji cards stay distinguishable when tiny on mobile. */
export const FACE_TINT: Record<FaceId, string> = {
  star: '#fff7ed',
  moon: '#e0e7ff',
  fish: '#e0f2fe',
  cherry: '#ffe4e6',
  leaf: '#ecfccb',
  gem: '#ede9fe',
  sun: '#fef9c3',
  comet: '#fae8ff',
  cloud: '#f1f5f9',
  planet: '#ffedd5',
  apple: '#fee2e2',
  grape: '#f3e8ff',
  mushroom: '#ffedd5',
  flower: '#fce7f3',
  tree: '#dcfce7',
  acorn: '#fef3c7',
  ruby: '#ffe4e6',
  sapphire: '#dbeafe',
  crown: '#fef08a',
  key: '#fef9c3',
  coin: '#fde68a',
  ring: '#e2e8f0',
  bell: '#fef3c7',
  heart: '#fecdd3',
  anchor: '#cbd5e1',
  shell: '#ffedd5',
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

export type CardKind = 'normal' | 'insight' | 'bomb';

export interface MemoryCard {
  id: string;
  face: FaceId;
  matched: boolean;
  kind: CardKind;
}

export type BuildDeckOptions = {
  specialInsight?: boolean;
  /** 2 = classic pairs; 3 = match-three groups. */
  copiesPerFace?: 2 | 3;
  /** Mark one face as a bomb pair/group (miss with bomb costs time in campaign). */
  bombPair?: boolean;
};

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

export function gridColsClass(pairCount: number): string {
  if (pairCount <= 4) return 'grid-cols-3 sm:grid-cols-4';
  if (pairCount <= 6) return 'grid-cols-3 sm:grid-cols-4';
  if (pairCount <= 12) return 'grid-cols-4 sm:grid-cols-6';
  if (pairCount <= 18) return 'grid-cols-4 sm:grid-cols-6';
  // Avoid 6-col phone grids (≈56×74) — 4 cols keeps targets near 80×+ px.
  return 'grid-cols-4 sm:grid-cols-6 lg:grid-cols-8';
}

export function gridGapClass(pairCount: number): string {
  return pairCount >= 18 ? 'gap-1.5 sm:gap-2' : 'gap-2';
}

/**
 * Build a shuffled deck. `faceCount` is clamped to the theme pool.
 * When `copiesPerFace` is 3, each face appears three times (match-three).
 */
export function buildDeck(
  faceCount: number = 12,
  themeId: ThemeId = 'classic',
  rand: () => number = Math.random,
  options: BuildDeckOptions = {},
): MemoryCard[] {
  const pool = themeFaces(themeId);
  const copies = options.copiesPerFace ?? 2;
  const maxFaces = Math.min(pool.length, maxPairsForTheme(themeId));
  const n = Math.max(1, Math.min(Math.floor(faceCount), maxFaces));
  const chosen = pool.slice(0, n);
  const faces: FaceId[] = [];
  for (const face of chosen) {
    for (let c = 0; c < copies; c++) faces.push(face);
  }
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

  let bombFace: FaceId | null = null;
  if (options.bombPair && chosen.length > 0) {
    const candidates = chosen.filter((f) => f !== insightFace);
    const poolForBomb = candidates.length > 0 ? candidates : chosen;
    bombFace = poolForBomb[Math.floor(rand() * poolForBomb.length)];
  }

  return faces.map((face, i) => {
    let kind: CardKind = 'normal';
    if (insightFace !== null && face === insightFace) kind = 'insight';
    else if (bombFace !== null && face === bombFace) kind = 'bomb';
    return {
      id: `${face}-${i}`,
      face,
      matched: false,
      kind,
    };
  });
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
 * Pick one unmatched face and return `need` card indices (for a brief peek hint).
 * Defaults to a classic pair (need=2).
 */
export function hintPairIndices(cards: MemoryCard[], need = 2): number[] | null {
  const byFace = new Map<FaceId, number[]>();
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (card.matched) continue;
    const list = byFace.get(card.face) ?? [];
    list.push(i);
    byFace.set(card.face, list);
  }
  for (const indices of byFace.values()) {
    if (indices.length >= need) return indices.slice(0, need);
  }
  return null;
}

/** True when all flipped indices share the same face. */
export function isMatchGroup(cards: MemoryCard[], indices: readonly number[]): boolean {
  if (indices.length < 2) return false;
  const face = cards[indices[0]]?.face;
  if (!face) return false;
  return indices.every((i) => cards[i]?.face === face);
}

/**
 * Swap positions of two face-down unmatched cards (campaign swap mechanic).
 * Returns a new array; no-op when fewer than two eligible cards.
 */
export function swapTwoHiddenCards(
  cards: MemoryCard[],
  flipped: readonly number[],
  rand: () => number,
): MemoryCard[] {
  const eligible: number[] = [];
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].matched) continue;
    if (flipped.includes(i)) continue;
    eligible.push(i);
  }
  if (eligible.length < 2) return cards;
  const i = eligible[Math.floor(rand() * eligible.length)];
  let j = eligible[Math.floor(rand() * eligible.length)];
  let guard = 0;
  while (j === i && guard < 8) {
    j = eligible[Math.floor(rand() * eligible.length)];
    guard += 1;
  }
  if (j === i) return cards;
  const next = cards.slice();
  const a = next[i];
  const b = next[j];
  next[i] = { ...b, id: `${b.face}-swap-${i}-${b.id}` };
  next[j] = { ...a, id: `${a.face}-swap-${j}-${a.id}` };
  return next;
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

  // Daily / campaign use dedicated storage modules — keep free-play slots stable.
  const slotMode: PlayMode =
    mode === 'daily' || mode === 'campaign' ? 'classic' : mode;

  if (slotMode === 'versus') {
    const diff = extra?.cpuDifficulty ?? 'normal';
    return `versus-${diff}-${themeId}-${n}`;
  }

  if (metric === 'score') {
    return `score-${slotMode}-${themeId}-${n}`;
  }

  if (metric === 'time' && slotMode === 'classic') {
    return themeId === 'classic' ? `time-${n}` : `time-${themeId}-${n}`;
  }

  if (slotMode === 'sprint' || (metric === 'time' && slotMode === 'special')) {
    if (themeId === 'classic' && slotMode === 'sprint') return `sprint-${n}`;
    return slotMode === 'sprint' ? `sprint-${themeId}-${n}` : `time-special-${themeId}-${n}`;
  }

  // classic / special moves
  if (themeId === 'classic' && slotMode === 'classic') return String(n);
  if (slotMode === 'special') return `special-${themeId}-${n}`;
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

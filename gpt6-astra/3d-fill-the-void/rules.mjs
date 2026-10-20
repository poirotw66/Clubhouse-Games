/**
 * Pure logic for Fill the Void: shapes, stars, progress, daily seed, solver.
 * Storage key is prefixed so it never collides with other Astra games.
 */

import { CAMPAIGN, DAILY_POOL, PACKS, levelsInPack } from './levels.mjs';

export const STORAGE_KEY = 'astra-fill-the-void:v1';
export const LEGACY_LEVEL_KEY = 'fill-void-level';

export { CAMPAIGN, DAILY_POOL, PACKS, levelsInPack };

/** @typedef {[number, number]} Cell */
/** @typedef {{ id: string, cells: Cell[] }} PieceShape */

export function normalize(cells) {
  const minX = Math.min(...cells.map((c) => c[0]));
  const minZ = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, z]) => [x - minX, z - minZ]);
}

export function rotateCells(cells) {
  return normalize(cells.map(([x, z]) => [-z, x]));
}

/** Mirror across the vertical axis of the piece bounding box. */
export function flipCells(cells) {
  const maxX = Math.max(...cells.map((c) => c[0]));
  return normalize(cells.map(([x, z]) => [maxX - x, z]));
}

export function cellsKey(cells) {
  return normalize(cells)
    .map(([x, z]) => `${x},${z}`)
    .sort()
    .join('|');
}

export function scrambleTurns(pieceIndex, levelIndex) {
  return (pieceIndex * 3 + levelIndex + 1) % 4;
}

/** Minimum CW rotations to undo a scramble of `turns` (0–3). */
export function rotationsToUndo(turns) {
  return (4 - (turns % 4)) % 4;
}

/**
 * Extract ordered pieces from a letter grid (insertion order of first sighting).
 * @param {string[]} rows
 * @returns {PieceShape[]}
 */
export function extractPieces(rows) {
  const depth = rows.length;
  const width = rows[0]?.length ?? 0;
  const map = new Map();
  for (let z = 0; z < depth; z++) {
    const row = rows[z];
    if (row.length !== width) {
      throw new Error(`Non-rectangular row ${z}: expected ${width}, got ${row.length}`);
    }
    for (let x = 0; x < width; x++) {
      const id = row[x];
      if (!map.has(id)) map.set(id, []);
      map.get(id).push([x, z]);
    }
  }
  return [...map.entries()].map(([id, cells]) => ({ id, cells: normalize(cells) }));
}

export function isConnected(cells) {
  if (cells.length === 0) return false;
  const set = new Set(cells.map(([x, z]) => `${x},${z}`));
  const start = cells[0];
  const seen = new Set();
  const queue = [start];
  seen.add(`${start[0]},${start[1]}`);
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  while (queue.length) {
    const [x, z] = queue.shift();
    for (const [dx, dz] of dirs) {
      const key = `${x + dx},${z + dz}`;
      if (set.has(key) && !seen.has(key)) {
        seen.add(key);
        queue.push([x + dx, z + dz]);
      }
    }
  }
  return seen.size === cells.length;
}

export function validateLevel(level) {
  const rows = level.rows;
  if (!rows?.length) return { ok: false, reason: 'empty' };
  const width = rows[0].length;
  if (width < 2 || rows.length < 2) return { ok: false, reason: 'too-small' };
  try {
    const pieces = extractPieces(rows);
    for (const piece of pieces) {
      if (!isConnected(piece.cells)) {
        return { ok: false, reason: `disconnected:${piece.id}` };
      }
    }
    const filled = rows.join('').length;
    const pieceCells = pieces.reduce((n, p) => n + p.cells.length, 0);
    if (filled !== width * rows.length || filled !== pieceCells) {
      return { ok: false, reason: 'fill-mismatch' };
    }
    return { ok: true, pieces, width, depth: rows.length };
  } catch (error) {
    return { ok: false, reason: String(error.message || error) };
  }
}

/**
 * Par rotations = total CW turns needed to restore each piece from scramble.
 * @param {object} level
 * @param {number} levelIndex
 */
export function parRotationsFor(level, levelIndex) {
  const pieces = extractPieces(level.rows);
  return pieces.reduce(
    (sum, _p, i) => sum + rotationsToUndo(scrambleTurns(i, levelIndex)),
    0,
  );
}

/**
 * Star rating from a finished attempt.
 * 1★ clear · 2★ ≤1 undo · 3★ no undo + rotations ≤ par
 */
export function rateStars({ undos, rotations, parRotations }) {
  if (undos === 0 && rotations <= parRotations) return 3;
  if (undos <= 1) return 2;
  return 1;
}

export function emptyProgress() {
  return {
    version: 1,
    /** @type {Record<string, { stars: number, bestUndos: number, bestRotations: number }>} */
    clears: {},
    currentId: CAMPAIGN[0].id,
    /** @type {{ dateKey: string, stars: number } | null} */
    daily: null,
  };
}

export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function seedFromString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1000003 || 1;
}

export function dailyLevel(date = new Date()) {
  const dateKey = localDateKey(date);
  const idx = seedFromString(`fill-void-daily:${dateKey}`) % DAILY_POOL.length;
  return { dateKey, level: DAILY_POOL[idx], index: idx };
}

export function packCleared(progress, packId) {
  const levels = levelsInPack(packId);
  return levels.every((l) => (progress.clears[l.id]?.stars ?? 0) >= 1);
}

export function isPackUnlocked(progress, packId) {
  const order = PACKS.map((p) => p.id);
  const i = order.indexOf(packId);
  if (i <= 0) return true;
  return packCleared(progress, order[i - 1]);
}

export function isLevelUnlocked(progress, levelId) {
  const idx = CAMPAIGN.findIndex((l) => l.id === levelId);
  if (idx < 0) return false;
  const level = CAMPAIGN[idx];
  if (!isPackUnlocked(progress, level.pack)) return false;
  if (idx === 0) return true;
  const prev = CAMPAIGN[idx - 1];
  if (prev.pack !== level.pack) return packCleared(progress, prev.pack);
  return (progress.clears[prev.id]?.stars ?? 0) >= 1;
}

export function recordClear(progress, levelId, { stars, undos, rotations }) {
  const next = {
    ...progress,
    clears: { ...progress.clears },
    currentId: levelId,
  };
  const prev = next.clears[levelId];
  if (!prev || stars > prev.stars) {
    next.clears[levelId] = { stars, bestUndos: undos, bestRotations: rotations };
  } else if (stars === prev.stars) {
    next.clears[levelId] = {
      stars,
      bestUndos: Math.min(prev.bestUndos, undos),
      bestRotations: Math.min(prev.bestRotations, rotations),
    };
  }
  return next;
}

export function recordDailyClear(progress, dateKey, stars) {
  const next = { ...progress, daily: { ...(progress.daily || {}) } };
  if (!next.daily.dateKey || next.daily.dateKey !== dateKey) {
    next.daily = { dateKey, stars };
  } else {
    next.daily = { dateKey, stars: Math.max(next.daily.stars || 0, stars) };
  }
  return next;
}

export function migrateProgress(raw, legacyLevelIndex = null) {
  if (raw && typeof raw === 'object' && raw.version === 1 && raw.clears) {
    return {
      ...emptyProgress(),
      ...raw,
      clears: { ...raw.clears },
      daily: raw.daily ?? null,
      currentId:
        typeof raw.currentId === 'string' && CAMPAIGN.some((l) => l.id === raw.currentId)
          ? raw.currentId
          : CAMPAIGN[0].id,
    };
  }

  const progress = emptyProgress();
  if (
    Number.isInteger(legacyLevelIndex) &&
    legacyLevelIndex >= 0 &&
    legacyLevelIndex < CAMPAIGN.length
  ) {
    // Old save only stored an index into the original 5 boards.
    const legacyIds = [
      'breath-01',
      'breath-02',
      'breath-03',
      'garden-01',
      'hush-01',
    ];
    const unlockedThrough = Math.min(legacyLevelIndex, legacyIds.length - 1);
    for (let i = 0; i <= unlockedThrough; i++) {
      // Mark prior clears so sequential unlock continues from where they left off.
      if (i < unlockedThrough) {
        progress.clears[legacyIds[i]] = {
          stars: 1,
          bestUndos: 99,
          bestRotations: 99,
        };
      }
    }
    progress.currentId = legacyIds[unlockedThrough] || CAMPAIGN[0].id;
  }
  return progress;
}

export function totalStars(progress) {
  return Object.values(progress.clears).reduce((n, c) => n + (c.stars || 0), 0);
}

export function campaignStarsPossible() {
  return CAMPAIGN.length * 3;
}

/** Unique orientations including mirrors (player may flip). */
export function orientationsOf(cells) {
  const out = [];
  const add = (shape) => {
    const key = cellsKey(shape);
    if (!out.some((o) => cellsKey(o) === key)) out.push(normalize(shape));
  };
  let shape = cells;
  for (let i = 0; i < 4; i++) {
    add(shape);
    shape = rotateCells(shape);
  }
  shape = flipCells(cells);
  for (let i = 0; i < 4; i++) {
    add(shape);
    shape = rotateCells(shape);
  }
  return out;
}

/**
 * Exact-cover style packer: each step fills the first empty cell with any
 * remaining piece (any orientation).
 * @param {PieceShape[]} pieces
 * @param {number} width
 * @param {number} depth
 */
export function canPack(pieces, width, depth) {
  const board = Array(width * depth).fill(null);
  const remaining = pieces.map((p) => ({
    id: p.id,
    orients: orientationsOf(p.cells),
    size: p.cells.length,
  }));
  // Larger pieces first when iterating candidates for a cell.
  remaining.sort((a, b) => b.size - a.size);

  function firstEmpty() {
    for (let i = 0; i < board.length; i++) if (board[i] === null) return i;
    return -1;
  }

  function fits(cells, ox, oz) {
    for (const [dx, dz] of cells) {
      const x = ox + dx;
      const z = oz + dz;
      if (x < 0 || z < 0 || x >= width || z >= depth) return false;
      if (board[z * width + x] !== null) return false;
    }
    return true;
  }

  function place(cells, ox, oz, id) {
    for (const [dx, dz] of cells) board[(oz + dz) * width + (ox + dx)] = id;
  }

  function unplace(cells, ox, oz) {
    for (const [dx, dz] of cells) board[(oz + dz) * width + (ox + dx)] = null;
  }

  function solve() {
    const slot = firstEmpty();
    if (slot < 0) return remaining.every((p) => p.used);
    const sx = slot % width;
    const sz = Math.floor(slot / width);

    for (const piece of remaining) {
      if (piece.used) continue;
      for (const orient of piece.orients) {
        for (const [dx, dz] of orient) {
          const ox = sx - dx;
          const oz = sz - dz;
          if (!fits(orient, ox, oz)) continue;
          place(orient, ox, oz, piece.id);
          piece.used = true;
          if (solve()) return true;
          piece.used = false;
          unplace(orient, ox, oz);
        }
      }
    }
    return false;
  }

  for (const piece of remaining) piece.used = false;
  return solve();
}

/**
 * Verify a level is solvable from the game's scramble (rotations + optional flips).
 * Uses the letter-grid solution identity: extracting pieces and allowing all
 * orientations must pack the board. Also asserts connectivity.
 */
export function levelIsSolvable(level, levelIndex = 0) {
  const check = validateLevel(level);
  if (!check.ok) return { ok: false, reason: check.reason };

  // Known solution exists in the letter grid — solvability is guaranteed if
  // pieces stay connected. Still run packer on scrambled→all-orients for safety.
  const pieces = extractPieces(level.rows).map((p, i) => {
    let cells = p.cells;
    const turns = scrambleTurns(i, levelIndex);
    for (let r = 0; r < turns; r++) cells = rotateCells(cells);
    return { id: p.id, cells };
  });

  const width = level.rows[0].length;
  const depth = level.rows.length;
  const packed = canPack(pieces, width, depth);
  if (!packed) return { ok: false, reason: 'unsolvable-pack' };
  return {
    ok: true,
    parRotations: parRotationsFor(level, levelIndex),
    pieceCount: pieces.length,
    width,
    depth,
  };
}

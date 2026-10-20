/**
 * Pure rules for Endless Train (不停號).
 * Keep this free of DOM so check-train.mjs can import it in Node.
 */

export const STORAGE_KEY = "unstoppable-train-v2";
export const LEGACY_BEST_KEY = "unstoppable-best";

/** Wagon upgrade cap (levels 0 → MAX_LEVEL). */
export const MAX_LEVEL = 5;

/** @typedef {"easy"|"normal"|"hard"} DifficultyId */

/**
 * Difficulty / rule variants. Numbers are consumed by the live game loop.
 * Ordering invariants (asserted in check-train.mjs):
 *   easy is gentler than normal is gentler than hard
 *   on baseSpeed, speedRamp, waterDrain, dryDrain, bridgeWood, craftTime
 *   and harsher on starting rails / density multipliers.
 */
export const DIFFICULTIES = {
  easy: {
    id: "easy",
    label: "輕鬆",
    blurb: "火車較慢、水耗較低，開局鐵軌較多，適合熟悉流程。",
    baseSpeed: 0.24,
    speedRamp: 0.00055,
    speedCap: 0.32,
    waterDrain: 0.42,
    dryDrain: 0.72,
    startBank: { wood: 7, ore: 7, rail: 14 },
    startWater: 100,
    treeDensityMul: 1.15,
    rockDensityMul: 1.1,
    craftBaseSec: 1.8,
    bridgeWood: 1,
    scorePerTile: 10,
  },
  normal: {
    id: "normal",
    label: "標準",
    blurb: "原本的不停號節奏：邊採邊鋪，永遠覺得差一點。",
    baseSpeed: 0.31,
    speedRamp: 0.00085,
    speedCap: 0.43,
    waterDrain: 0.62,
    dryDrain: 1.05,
    startBank: { wood: 5, ore: 5, rail: 9 },
    startWater: 100,
    treeDensityMul: 1,
    rockDensityMul: 1,
    craftBaseSec: 2.2,
    bridgeWood: 2,
    scorePerTile: 10,
  },
  hard: {
    id: "hard",
    label: "高壓",
    blurb: "火車催得兇、水耗更快、資源更稀，架橋也更貴。",
    baseSpeed: 0.36,
    speedRamp: 0.00115,
    speedCap: 0.55,
    waterDrain: 0.85,
    dryDrain: 1.35,
    startBank: { wood: 3, ore: 3, rail: 6 },
    startWater: 85,
    treeDensityMul: 0.78,
    rockDensityMul: 0.85,
    craftBaseSec: 2.6,
    bridgeWood: 3,
    scorePerTile: 10,
  },
};

export const DIFFICULTY_ORDER = /** @type {DifficultyId[]} */ ([
  "easy",
  "normal",
  "hard",
]);

/**
 * Daily (and seeded) run modifiers. Exactly one or two are picked from the seed.
 * Effects are applied in applyRunModifiers / waterDrainPerSec / bridge cost helpers.
 */
export const DAILY_MODIFIERS = {
  double_water: {
    id: "double_water",
    label: "雙倍耗水",
    blurb: "鍋爐更渴：冷卻水消耗 ×2。",
    waterMul: 2,
    bridgeDelta: 0,
    fog: false,
    moveMul: 1,
    hazardMul: 1,
  },
  cheap_bridge: {
    id: "cheap_bridge",
    label: "便宜的橋",
    blurb: "架橋木材需求 −1（至少 1）。",
    waterMul: 1,
    bridgeDelta: -1,
    fog: false,
    moveMul: 1,
    hazardMul: 1,
  },
  fog: {
    id: "fog",
    label: "濃霧",
    blurb: "視野變窄，暴風區更難辨識。",
    waterMul: 1,
    bridgeDelta: 0,
    fog: true,
    moveMul: 1,
    hazardMul: 1.15,
  },
  storm_front: {
    id: "storm_front",
    label: "暴風前線",
    blurb: "暴風區更密，進入時移動變慢。",
    waterMul: 1.15,
    bridgeDelta: 0,
    fog: false,
    moveMul: 0.88,
    hazardMul: 1.45,
  },
  scrap_drop: {
    id: "scrap_drop",
    label: "貨廂補給",
    blurb: "開局多一次貨廂投放（把倉庫物資丟到前方）。",
    waterMul: 1,
    bridgeDelta: 0,
    fog: false,
    moveMul: 1,
    hazardMul: 1,
    extraCargo: 1,
  },
};

export const MODIFIER_ORDER = Object.keys(DAILY_MODIFIERS);

export function getDifficulty(id) {
  return DIFFICULTIES[id] || DIFFICULTIES.normal;
}

export function getModifier(id) {
  return DAILY_MODIFIERS[id] || null;
}

/** Local calendar date as YYYY-MM-DD (player timezone). */
export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Stable 1..999998 seed from a date key (or any string). */
export function seedFromString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 999999 || 1;
}

export function dailySeed(date = new Date()) {
  return seedFromString(`train-daily:${localDateKey(date)}`);
}

/**
 * Derive 1–2 daily modifiers from a numeric seed (stable across clients).
 * @param {number} seed
 * @returns {typeof DAILY_MODIFIERS[keyof typeof DAILY_MODIFIERS][]}
 */
export function modifiersFromSeed(seed) {
  const s = (Number(seed) >>> 0) || 1;
  const count = s % 5 === 0 ? 2 : 1;
  const pool = MODIFIER_ORDER.slice();
  const picked = [];
  let x = s;
  for (let i = 0; i < count && pool.length; i++) {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    const idx = x % pool.length;
    const id = pool.splice(idx, 1)[0];
    picked.push(DAILY_MODIFIERS[id]);
  }
  return picked;
}

/**
 * Fold modifier list into runtime scalars used by the game loop.
 * @param {ReturnType<typeof getDifficulty>} difficulty
 * @param {ReturnType<typeof modifiersFromSeed>} mods
 */
export function applyRunModifiers(difficulty, mods) {
  const list = Array.isArray(mods) ? mods : [];
  let waterMul = 1;
  let bridgeDelta = 0;
  let fog = false;
  let moveMul = 1;
  let hazardMul = 1;
  let cargoCharges = 1;
  for (const m of list) {
    if (!m) continue;
    waterMul *= m.waterMul || 1;
    bridgeDelta += m.bridgeDelta || 0;
    fog = fog || !!m.fog;
    moveMul *= m.moveMul || 1;
    hazardMul *= m.hazardMul || 1;
    cargoCharges += m.extraCargo || 0;
  }
  const bridgeWood = Math.max(1, (difficulty.bridgeWood || 2) + bridgeDelta);
  return {
    waterMul,
    bridgeWood,
    fog,
    moveMul,
    hazardMul,
    cargoCharges: Math.max(1, Math.min(3, cargoCharges)),
    labels: list.map((m) => m.label),
    ids: list.map((m) => m.id),
  };
}

export function trainSpeed(elapsedSec, difficulty) {
  const d = getDifficulty(difficulty);
  return d.baseSpeed + Math.min(d.speedCap, elapsedSec * d.speedRamp);
}

/**
 * @param {number} zoneIndex
 * @param {number} level
 * @param {DifficultyId|string} difficulty
 * @param {{ waterMul?: number, inStorm?: boolean, hazardMul?: number }} [opts]
 */
export function waterDrainPerSec(zoneIndex, level, difficulty, opts = {}) {
  const d = getDifficulty(difficulty);
  const dry = zoneIndex % 3 === 2;
  const base = dry ? d.dryDrain : d.waterDrain;
  const levelMul = 1 - Math.min(MAX_LEVEL, level) * 0.12;
  const waterMul = opts.waterMul ?? 1;
  const stormMul = opts.inStorm ? 1.35 * (opts.hazardMul ?? 1) : 1;
  return base * levelMul * waterMul * stormMul;
}

export function craftDurationSec(level, difficulty) {
  const d = getDifficulty(difficulty);
  return Math.max(0.7, d.craftBaseSec - Math.min(MAX_LEVEL, level) * 0.32);
}

export function upgradeCost(level) {
  return 6 + Math.min(MAX_LEVEL, Math.max(0, level)) * 3;
}

export function scoreFromProgress(progress, initialProgress, difficulty) {
  const d = getDifficulty(difficulty);
  return (progress - initialProgress) * d.scorePerTile;
}

export function railsLaid(pathLength, initialPathLength = 25) {
  return Math.max(0, pathLength - initialPathLength);
}

export function endReasonLabel(reason) {
  if (reason === "water") return "鍋爐過熱";
  if (reason === "rail") return "衝出軌道";
  if (reason === "gap") return "斷橋未補";
  if (reason === "storm") return "暴風中失控";
  return "行程結束";
}

/** Whether a world cell is inside a storm band (seeded, zone-aware). */
export function isStormCell(x, y, seed, hazardMul = 1) {
  const zone = Math.max(0, Math.floor(x / 45));
  // Storm bands start after the tutorial stretch and thicken with hazardMul.
  if (x < 28) return false;
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ ((seed | 0) + zone * 97), 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  const n = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  const band = 0.045 * hazardMul + Math.min(0.08, zone * 0.008);
  const stripe = Math.abs(((x + zone * 3) % 17) - 8) < 2 + Math.floor(hazardMul);
  return stripe && n < band * 2.2;
}

/** Broken-bridge (gap) cells: river-adjacent cracks that need wood + rail. */
export function isGapCell(x, y, seed) {
  if (x < 30) return false;
  const riverX = 26 + Math.floor((x - 24) / 45) * 45;
  const bend = Math.round(Math.sin(y * 0.32) * 1.5);
  const nearRiver = Math.abs(x - (riverX + bend)) >= 1.1 && Math.abs(x - (riverX + bend)) < 2.4;
  if (!nearRiver) return false;
  let h = Math.imul(x | 0, 915799661) ^ Math.imul(y | 0, 2654435761);
  h = Math.imul(h ^ (seed | 0), 2246822519);
  const n = ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  return n < 0.22;
}

export function emptyStats() {
  return {
    bestByMode: { easy: 0, normal: 0, hard: 0 },
    bestDaily: { date: "", score: 0, mode: "normal" },
    lastMode: "normal",
    lastPlayers: 1,
  };
}

/** Merge legacy single best into normal-mode best. */
export function migrateStats(raw, legacyBest = 0) {
  const base = emptyStats();
  if (raw && typeof raw === "object") {
    for (const id of DIFFICULTY_ORDER) {
      const n = Number(raw.bestByMode?.[id]);
      if (Number.isFinite(n) && n > 0) base.bestByMode[id] = Math.floor(n);
    }
    if (raw.bestDaily && typeof raw.bestDaily === "object") {
      base.bestDaily = {
        date: String(raw.bestDaily.date || ""),
        score: Math.max(0, Math.floor(Number(raw.bestDaily.score) || 0)),
        mode: DIFFICULTIES[raw.bestDaily.mode] ? raw.bestDaily.mode : "normal",
      };
    }
    if (DIFFICULTIES[raw.lastMode]) base.lastMode = raw.lastMode;
    const players = Number(raw.lastPlayers);
    if (players === 1 || players === 2) base.lastPlayers = players;
  }
  const legacy = Math.floor(Number(legacyBest) || 0);
  if (legacy > base.bestByMode.normal) base.bestByMode.normal = legacy;
  return base;
}

/**
 * Apply a finished run into persisted stats.
 * Returns { stats, isModeBest, isDailyBest }.
 */
export function recordRun(stats, { mode, score, daily, dateKey }) {
  const next = {
    bestByMode: { ...stats.bestByMode },
    bestDaily: { ...stats.bestDaily },
    lastMode: mode,
    lastPlayers: stats.lastPlayers,
  };
  const s = Math.max(0, Math.floor(score));
  const isModeBest = s > (next.bestByMode[mode] || 0);
  if (isModeBest) next.bestByMode[mode] = s;

  let isDailyBest = false;
  if (daily && dateKey) {
    const sameDay = next.bestDaily.date === dateKey;
    if (!sameDay || s > next.bestDaily.score) {
      next.bestDaily = { date: dateKey, score: s, mode };
      isDailyBest = true;
    }
  }
  return { stats: next, isModeBest, isDailyBest };
}

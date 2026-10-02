/**
 * Pure rules for Endless Train (不停號).
 * Keep this free of DOM so check-train.mjs can import it in Node.
 */

export const STORAGE_KEY = "unstoppable-train-v2";
export const LEGACY_BEST_KEY = "unstoppable-best";

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

export function getDifficulty(id) {
  return DIFFICULTIES[id] || DIFFICULTIES.normal;
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

export function trainSpeed(elapsedSec, difficulty) {
  const d = getDifficulty(difficulty);
  return d.baseSpeed + Math.min(d.speedCap, elapsedSec * d.speedRamp);
}

export function waterDrainPerSec(zoneIndex, level, difficulty) {
  const d = getDifficulty(difficulty);
  const dry = zoneIndex % 3 === 2;
  const base = dry ? d.dryDrain : d.waterDrain;
  return base * (1 - Math.min(3, level) * 0.16);
}

export function craftDurationSec(level, difficulty) {
  const d = getDifficulty(difficulty);
  return Math.max(0.8, d.craftBaseSec - level * 0.4);
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
  return "行程結束";
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

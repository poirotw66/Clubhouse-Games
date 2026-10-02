/**
 * Pure rules for Dust Riot / Borderland wave defense.
 * Keep this free of DOM so check-borderland.mjs can import it in Node.
 */

export const STORAGE_KEY = "dust-riot-v1";

/** @typedef {"easy"|"normal"|"hard"} DifficultyId */

/**
 * Difficulty / wave-goal variants. Numbers are consumed by the live game loop.
 * Ordering invariants (asserted in check-borderland.mjs):
 *   easy is gentler than normal is gentler than hard on enemy pressure;
 *   clearWave rises easy→hard (harder modes ask for a longer hold).
 */
export const DIFFICULTIES = {
  easy: {
    id: "easy",
    label: "輕鬆",
    blurb: "敵人較弱、彈傷較輕。清完第 5 波即通關。",
    enemyHpBase: 50,
    enemyHpPerWave: 5,
    enemySpeedBase: 1.35,
    enemySpeedPerWave: 0.1,
    enemySpeedCapAdd: 1.2,
    enemyDamage: 8,
    spawnBase: 2,
    spawnPerWave: 1.5,
    spawnCap: 16,
    fireCooldownBase: 2.2,
    fireCooldownWave: 0.04,
    fireCooldownMin: 0.9,
    projectileSpeedBase: 9,
    projectileSpeedWave: 0.6,
    clearWave: 5,
    startingHp: 100,
    betweenWaveHeal: 20,
    pickupHeal: 35,
  },
  normal: {
    id: "normal",
    label: "標準",
    blurb: "原本荒土節奏。清完第 8 波即通關。",
    enemyHpBase: 65,
    enemyHpPerWave: 7,
    enemySpeedBase: 1.6,
    enemySpeedPerWave: 0.14,
    enemySpeedCapAdd: 1.8,
    enemyDamage: 11,
    spawnBase: 3,
    spawnPerWave: 2,
    spawnCap: 22,
    fireCooldownBase: 2,
    fireCooldownWave: 0.06,
    fireCooldownMin: 0.75,
    projectileSpeedBase: 11,
    projectileSpeedWave: 1,
    clearWave: 8,
    startingHp: 100,
    betweenWaveHeal: 15,
    pickupHeal: 28,
  },
  hard: {
    id: "hard",
    label: "高壓",
    blurb: "血厚、彈密、來得多。清完第 12 波才算通關。",
    enemyHpBase: 85,
    enemyHpPerWave: 10,
    enemySpeedBase: 1.85,
    enemySpeedPerWave: 0.18,
    enemySpeedCapAdd: 2.4,
    enemyDamage: 15,
    spawnBase: 4,
    spawnPerWave: 2.5,
    spawnCap: 28,
    fireCooldownBase: 1.7,
    fireCooldownWave: 0.07,
    fireCooldownMin: 0.55,
    projectileSpeedBase: 13,
    projectileSpeedWave: 1.2,
    clearWave: 12,
    startingHp: 90,
    betweenWaveHeal: 10,
    pickupHeal: 22,
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

export function enemyHp(wave, difficulty) {
  const d = getDifficulty(difficulty);
  return d.enemyHpBase + Math.max(0, wave) * d.enemyHpPerWave;
}

export function enemySpeed(wave, difficulty) {
  const d = getDifficulty(difficulty);
  return d.enemySpeedBase + Math.min(d.enemySpeedCapAdd, Math.max(0, wave) * d.enemySpeedPerWave);
}

export function spawnCount(wave, difficulty) {
  const d = getDifficulty(difficulty);
  return Math.min(d.spawnCap, Math.floor(d.spawnBase + Math.max(0, wave) * d.spawnPerWave));
}

export function enemyFireCooldown(wave, difficulty) {
  const d = getDifficulty(difficulty);
  return Math.max(d.fireCooldownMin, d.fireCooldownBase - Math.max(0, wave) * d.fireCooldownWave);
}

export function projectileSpeed(wave, difficulty) {
  const d = getDifficulty(difficulty);
  return d.projectileSpeedBase + Math.min(8, Math.max(0, wave) * d.projectileSpeedWave);
}

export function killScore(wave) {
  return 100 + Math.max(0, wave) * 15;
}

/** Soft goal met when the cleared wave index reaches clearWave. */
export function reachedClearWave(wave, difficulty) {
  const d = getDifficulty(difficulty);
  return wave >= d.clearWave;
}

export function endReasonLabel(outcome) {
  if (outcome === "victory") return "目標波次達成";
  if (outcome === "defeat") return "倒下了";
  return "出動結束";
}

export function emptyModeBest() {
  return { wave: 0, score: 0 };
}

export function emptyStats() {
  return {
    bestByMode: {
      easy: emptyModeBest(),
      normal: emptyModeBest(),
      hard: emptyModeBest(),
    },
    clearsByMode: { easy: 0, normal: 0, hard: 0 },
    lastMode: "normal",
  };
}

function sanitizeBest(raw) {
  const wave = Math.max(0, Math.floor(Number(raw?.wave) || 0));
  const score = Math.max(0, Math.floor(Number(raw?.score) || 0));
  return { wave, score };
}

export function migrateStats(raw) {
  const base = emptyStats();
  if (!raw || typeof raw !== "object") return base;
  for (const id of DIFFICULTY_ORDER) {
    const entry = raw.bestByMode?.[id];
    if (entry && typeof entry === "object") {
      base.bestByMode[id] = sanitizeBest(entry);
    } else if (Number.isFinite(Number(entry))) {
      // tolerate a flat score-only legacy shape
      base.bestByMode[id] = { wave: 0, score: Math.max(0, Math.floor(Number(entry))) };
    }
    const clears = Number(raw.clearsByMode?.[id]);
    if (Number.isFinite(clears) && clears > 0) {
      base.clearsByMode[id] = Math.floor(clears);
    }
  }
  if (DIFFICULTIES[raw.lastMode]) base.lastMode = raw.lastMode;
  return base;
}

/**
 * Apply a finished run into persisted stats.
 * Best wave and best score are tracked independently per mode.
 * Returns { stats, isWaveBest, isScoreBest }.
 */
export function recordRun(stats, { mode, wave, score, won }) {
  const id = DIFFICULTIES[mode] ? mode : "normal";
  const next = {
    bestByMode: {
      easy: { ...stats.bestByMode.easy },
      normal: { ...stats.bestByMode.normal },
      hard: { ...stats.bestByMode.hard },
    },
    clearsByMode: { ...stats.clearsByMode },
    lastMode: id,
  };
  const w = Math.max(0, Math.floor(wave));
  const s = Math.max(0, Math.floor(score));
  const prev = next.bestByMode[id] || emptyModeBest();
  const isWaveBest = w > (prev.wave || 0);
  const isScoreBest = s > (prev.score || 0);
  next.bestByMode[id] = {
    wave: Math.max(prev.wave || 0, w),
    score: Math.max(prev.score || 0, s),
  };
  if (won) next.clearsByMode[id] = (next.clearsByMode[id] || 0) + 1;
  return { stats: next, isWaveBest, isScoreBest };
}

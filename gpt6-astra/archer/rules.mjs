/**
 * Pure rules for Stillshot (停步射手).
 * Keep this free of DOM so check-archer.mjs can import it in Node.
 */

export const STORAGE_KEY = "stillshot-save-v2";
export const LEGACY_SAVE_KEY = "stillshot-save";

/** @typedef {"easy"|"normal"|"hard"|"raid"} ModeId */

/**
 * Difficulty / limited-room modes.
 * Ordering for easy→normal→hard (raid is a separate limited-room variant):
 *   enemyHpMul, enemyDmgMul, spawnCountMul, enemySpeedMul rise with pressure.
 */
export const MODES = {
  easy: {
    id: "easy",
    label: "輕鬆",
    blurb: "敵勢較弱、受傷較輕，適合熟悉停步節奏。",
    roomCap: 15,
    enemyHpMul: 0.78,
    enemyDmgMul: 0.82,
    spawnCountMul: 0.85,
    enemySpeedMul: 0.92,
    goldMul: 0.9,
    clearBonus: 120,
    kind: "difficulty",
  },
  normal: {
    id: "normal",
    label: "標準",
    blurb: "原本的十五房冒險：三區域、每五房 Boss。",
    roomCap: 15,
    enemyHpMul: 1,
    enemyDmgMul: 1,
    spawnCountMul: 1,
    enemySpeedMul: 1,
    goldMul: 1,
    clearBonus: 150,
    kind: "difficulty",
  },
  hard: {
    id: "hard",
    label: "高壓",
    blurb: "敵血更厚、彈幕更兇，停步久一點就會付出代價。",
    roomCap: 15,
    enemyHpMul: 1.28,
    enemyDmgMul: 1.22,
    spawnCountMul: 1.15,
    enemySpeedMul: 1.08,
    goldMul: 1.15,
    clearBonus: 200,
    kind: "difficulty",
  },
  raid: {
    id: "raid",
    label: "五房突襲",
    blurb: "限房模式：五房打到守門者即通關，一局更短、節奏更緊。",
    roomCap: 5,
    enemyHpMul: 1.08,
    enemyDmgMul: 1.05,
    spawnCountMul: 1.05,
    enemySpeedMul: 1.04,
    goldMul: 1.1,
    clearBonus: 90,
    kind: "limited",
  },
};

export const MODE_ORDER = /** @type {ModeId[]} */ ([
  "easy",
  "normal",
  "hard",
  "raid",
]);

export function getMode(id) {
  return MODES[id] || MODES.normal;
}

export function emptyMeta() {
  return {
    gold: 0,
    attack: 0,
    health: 0,
    best: 0,
    bestByMode: { easy: 0, normal: 0, hard: 0, raid: 0 },
    clearsByMode: { easy: 0, normal: 0, hard: 0, raid: 0 },
    lastMode: "normal",
  };
}

/**
 * Merge v2 save or legacy { gold, attack, health, best } into v2 shape.
 * Legacy `best` folds into normal-mode farthest room.
 */
export function migrateMeta(raw) {
  const base = emptyMeta();
  if (!raw || typeof raw !== "object") return base;

  for (const key of ["gold", "attack", "health", "best"]) {
    const n = Number(raw[key]);
    if (Number.isFinite(n) && n > 0) base[key] = Math.floor(n);
  }
  base.attack = Math.min(10, base.attack);
  base.health = Math.min(10, base.health);

  if (raw.bestByMode && typeof raw.bestByMode === "object") {
    for (const id of MODE_ORDER) {
      const n = Number(raw.bestByMode[id]);
      if (Number.isFinite(n) && n > 0) base.bestByMode[id] = Math.floor(n);
    }
  }
  if (raw.clearsByMode && typeof raw.clearsByMode === "object") {
    for (const id of MODE_ORDER) {
      const n = Number(raw.clearsByMode[id]);
      if (Number.isFinite(n) && n > 0) base.clearsByMode[id] = Math.floor(n);
    }
  }

  if (MODES[raw.lastMode]) base.lastMode = raw.lastMode;

  // Legacy single best → normal mode farthest.
  if (base.best > base.bestByMode.normal) {
    base.bestByMode.normal = base.best;
  }

  base.best = Math.max(base.best, ...MODE_ORDER.map((id) => base.bestByMode[id]));
  return base;
}

export function upgradeCost(type, level) {
  return 40 + Math.max(0, Math.floor(level)) * 35;
}

export function spawnCount(room, mode) {
  const m = getMode(mode);
  const base = Math.min(11, 4 + Math.ceil(room * 0.6));
  return Math.max(3, Math.round(base * m.spawnCountMul));
}

export function enemyScale(type, room, mode) {
  const m = getMode(mode);
  const roomScale =
    type === "boss"
      ? 1 + (Math.ceil(room / 5) - 1) * 0.8
      : 1 + (room - 1) * 0.115;
  return roomScale * m.enemyHpMul;
}

export function incomingDamage(amount, room, armor, mode) {
  const m = getMode(mode);
  const roomMul = 1 + (room - 1) * 0.055;
  return amount * roomMul * m.enemyDmgMul * (1 - armor);
}

export function awardedGold(base, mode) {
  return Math.max(0, Math.floor(base * getMode(mode).goldMul));
}

export function clearBonus(mode) {
  return getMode(mode).clearBonus;
}

export function isVictoryRoom(room, mode) {
  return room >= getMode(mode).roomCap;
}

export function endTitle({ win, retired }) {
  if (win) return "神殿已重見光明！";
  if (retired) return "暫時返回營地";
  return "下一箭，再出發";
}

export function endEyebrow(win) {
  return win ? "VICTORY" : "ANOTHER SHOT";
}

/**
 * Apply a finished run into persisted meta.
 * Score for bests is farthest room reached this run.
 */
export function recordRun(meta, { mode, room, win }) {
  const next = migrateMeta(meta);
  const m = getMode(mode);
  const farthest = Math.max(1, Math.min(m.roomCap, Math.floor(room) || 1));
  const prev = next.bestByMode[mode] || 0;
  const isModeBest = farthest > prev;
  if (isModeBest) next.bestByMode[mode] = farthest;
  if (win) next.clearsByMode[mode] = (next.clearsByMode[mode] || 0) + 1;
  next.best = Math.max(next.best, ...MODE_ORDER.map((id) => next.bestByMode[id]));
  next.lastMode = mode;
  return { meta: next, isModeBest, farthest };
}

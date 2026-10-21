/**
 * Pure rules for Stillshot (停步射手).
 * Keep this free of DOM so check-archer.mjs can import it in Node.
 */

export const STORAGE_KEY = "stillshot-save-v3";
export const LEGACY_SAVE_KEY = "stillshot-save";
export const LEGACY_SAVE_KEY_V2 = "stillshot-save-v2";

/** @typedef {"easy"|"normal"|"hard"|"raid"|"raid_night"|"raid_glass"|"daily"} ModeId */

/**
 * Difficulty / limited-room / daily modes.
 * Ordering for easy→normal→hard (raid* are limited-room variants):
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
  raid_night: {
    id: "raid_night",
    label: "夜襲突襲",
    blurb: "限房變體：彈幕更密、敵人更快，通關金幣更高。",
    roomCap: 5,
    enemyHpMul: 1.12,
    enemyDmgMul: 1.18,
    spawnCountMul: 1.22,
    enemySpeedMul: 1.12,
    goldMul: 1.35,
    clearBonus: 130,
    kind: "limited",
    requiresUnlock: "raidNight",
  },
  raid_glass: {
    id: "raid_glass",
    label: "玻璃突襲",
    blurb: "限房變體：雙方玻璃血——你更脆、敵人也更脆，輸出為王。",
    roomCap: 5,
    enemyHpMul: 0.58,
    enemyDmgMul: 1.48,
    spawnCountMul: 1.08,
    enemySpeedMul: 1.06,
    goldMul: 1.25,
    clearBonus: 120,
    playerHpMul: 0.62,
    kind: "limited",
    requiresUnlock: "raidGlass",
  },
  daily: {
    id: "daily",
    label: "今日挑戰",
    blurb: "固定種子房間配置，部分能力禁用；與全球同日同局。",
    roomCap: 8,
    enemyHpMul: 1.05,
    enemyDmgMul: 1.08,
    spawnCountMul: 1.05,
    enemySpeedMul: 1.02,
    goldMul: 1.2,
    clearBonus: 110,
    kind: "daily",
  },
};

/** Base lobby modes (unlockable variants appended by visibleModes). */
export const MODE_ORDER = /** @type {ModeId[]} */ ([
  "easy",
  "normal",
  "hard",
  "raid",
]);

export const UNLOCKABLE_MODE_ORDER = /** @type {ModeId[]} */ ([
  "raid_night",
  "raid_glass",
]);

/** Ability ids that may be banned or granted by the permanent tree. */
export const META_ABILITY_POOL = [
  "speed",
  "damage",
  "crit",
  "multi",
  "front",
  "diagonal",
  "pierce",
  "ricochet",
  "bounce",
  "fire",
  "poison",
  "lightning",
  "ice",
  "hp",
  "armor",
  "dodge",
  "shield",
  "steal",
  "rage",
  "healKill",
  "size",
  "move",
  "pulse",
];

/**
 * Permanent unlock tree — identity / structure, not pure % stats.
 * Costs are flat one-time purchases.
 */
export const META_UNLOCKS = {
  startPierce: {
    id: "startPierce",
    label: "開局穿透",
    blurb: "每局開始自帶穿透 Lv.1。箭可穿過第一名敵人。",
    cost: 90,
    ability: "pierce",
    abilityLevel: 1,
  },
  startMulti: {
    id: "startMulti",
    label: "開局多重",
    blurb: "每局開始自帶多重射擊 Lv.1。停步時追加一輪。",
    cost: 110,
    ability: "multi",
    abilityLevel: 1,
  },
  startShield: {
    id: "startShield",
    label: "開局護盾",
    blurb: "每局開始自帶守護護盾 Lv.1，可擋一次傷害。",
    cost: 100,
    ability: "shield",
    abilityLevel: 1,
  },
  startIce: {
    id: "startIce",
    label: "開局冰霜",
    blurb: "每局開始自帶冰霜箭 Lv.1，命中減速敵人。",
    cost: 85,
    ability: "ice",
    abilityLevel: 1,
  },
  healRooms: {
    id: "healRooms",
    label: "泉水客房",
    blurb: "解鎖額外治療房：第 6、11 房改為泉水房（無敵人）。",
    cost: 140,
  },
  raidNight: {
    id: "raidNight",
    label: "夜襲解鎖",
    blurb: "解鎖限房變體「夜襲突襲」：彈幕更密、獎勵更高。",
    cost: 160,
    unlocksMode: "raid_night",
  },
  raidGlass: {
    id: "raidGlass",
    label: "玻璃解鎖",
    blurb: "解鎖限房變體「玻璃突襲」：雙方玻璃血，輸出為王。",
    cost: 160,
    unlocksMode: "raid_glass",
  },
};

export const META_UNLOCK_ORDER = [
  "startPierce",
  "startIce",
  "startShield",
  "startMulti",
  "healRooms",
  "raidNight",
  "raidGlass",
];

/** @typedef {keyof typeof META_UNLOCKS} MetaUnlockId */

export function getMode(id) {
  return MODES[id] || MODES.normal;
}

export function emptyUnlocked() {
  /** @type {Record<string, boolean>} */
  const unlocked = {};
  for (const id of META_UNLOCK_ORDER) unlocked[id] = false;
  return unlocked;
}

export function emptyMeta() {
  return {
    gold: 0,
    /** @deprecated refunded into gold; kept for migrate compatibility */
    attack: 0,
    /** @deprecated refunded into gold; kept for migrate compatibility */
    health: 0,
    unlocked: emptyUnlocked(),
    best: 0,
    bestByMode: {
      easy: 0,
      normal: 0,
      hard: 0,
      raid: 0,
      raid_night: 0,
      raid_glass: 0,
      daily: 0,
    },
    clearsByMode: {
      easy: 0,
      normal: 0,
      hard: 0,
      raid: 0,
      raid_night: 0,
      raid_glass: 0,
      daily: 0,
    },
    bestDaily: { date: "", room: 0, win: false },
    lastMode: "normal",
  };
}

/** Legacy flat upgrade cost (used only to refund old attack/health into gold). */
export function upgradeCost(type, level) {
  void type;
  return 40 + Math.max(0, Math.floor(level)) * 35;
}

export function unlockCost(id) {
  return META_UNLOCKS[id]?.cost ?? Infinity;
}

export function isUnlockOwned(meta, id) {
  return !!(meta?.unlocked && meta.unlocked[id]);
}

/**
 * Modes shown in the lobby for this save.
 * Unlockable raid variants appear only after purchase; daily is separate.
 */
export function visibleModes(meta) {
  const ids = [...MODE_ORDER];
  for (const id of UNLOCKABLE_MODE_ORDER) {
    const mode = MODES[id];
    if (mode.requiresUnlock && isUnlockOwned(meta, mode.requiresUnlock)) {
      ids.push(id);
    }
  }
  return ids;
}

/**
 * Spend gold on a one-time unlock. Returns { ok, meta, reason? }.
 */
export function buyMeta(meta, unlockId) {
  const next = migrateMeta(meta);
  const def = META_UNLOCKS[unlockId];
  if (!def) return { ok: false, meta: next, reason: "unknown" };
  if (next.unlocked[unlockId]) return { ok: false, meta: next, reason: "owned" };
  if (next.gold < def.cost) return { ok: false, meta: next, reason: "gold" };
  next.gold -= def.cost;
  next.unlocked[unlockId] = true;
  return { ok: true, meta: next };
}

/**
 * Starting build granted by permanent unlocks (ability id → level).
 */
export function startingBuildFromMeta(meta) {
  /** @type {Record<string, number>} */
  const build = {};
  const m = migrateMeta(meta);
  for (const id of META_UNLOCK_ORDER) {
    const def = META_UNLOCKS[id];
    if (!m.unlocked[id] || !def.ability) continue;
    const level = def.abilityLevel || 1;
    build[def.ability] = Math.max(build[def.ability] || 0, level);
  }
  return build;
}

/** Extra fountain rooms (no combat) when healRooms is owned. */
export function isHealRoom(room, mode, meta) {
  if (!isUnlockOwned(meta, "healRooms")) return false;
  const m = getMode(mode);
  if (m.kind === "limited" || m.kind === "daily") return false;
  return room === 6 || room === 11;
}

export function playerHpMul(mode) {
  return getMode(mode).playerHpMul || 1;
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
  return seedFromString(`stillshot-daily:${localDateKey(date)}`);
}

/** Deterministic PRNG (mulberry32). */
export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Today's challenge: fixed seed, scripted rooms, banned upgrade abilities.
 * @returns {{
 *   dateKey: string,
 *   seed: number,
 *   roomCap: number,
 *   bannedAbilityIds: string[],
 *   rooms: Array<{ kind: string, enemies?: string[], count?: number, label: string }>
 * }}
 */
export function dailyChallenge(date = new Date()) {
  const dateKey = localDateKey(date);
  const seed = dailySeed(date);
  const rng = makeRng(seed);
  const bannedAbilityIds = [];
  const pool = [...META_ABILITY_POOL];
  while (bannedAbilityIds.length < 3 && pool.length) {
    const idx = Math.floor(rng() * pool.length);
    bannedAbilityIds.push(pool.splice(idx, 1)[0]);
  }

  const combatTypes = ["chaser", "shooter", "fast", "spread", "dash", "aoe"];
  const pickType = () => combatTypes[Math.floor(rng() * combatTypes.length)];

  const rooms = [
    {
      kind: "combat",
      count: 4,
      enemies: [pickType(), pickType(), pickType(), pickType()],
      label: "開局試煉",
    },
    {
      kind: "combat",
      count: 5,
      enemies: [pickType(), pickType(), pickType(), pickType(), pickType()],
      label: "夾擊走廊",
    },
    {
      kind: "elite",
      count: 3,
      enemies: ["elite", pickType(), pickType()],
      label: "精英哨站",
    },
    {
      kind: "combat",
      count: 6,
      enemies: Array.from({ length: 6 }, pickType),
      label: "彈幕窄巷",
    },
    {
      kind: "boss",
      enemies: ["boss"],
      label: "中段守門者",
    },
    {
      kind: "combat",
      count: 5,
      enemies: [pickType(), pickType(), "spread", pickType(), pickType()],
      label: "殘火回廊",
    },
    {
      kind: "elite",
      count: 4,
      enemies: ["elite", "dash", pickType(), pickType()],
      label: "雙精英夾擊",
    },
    {
      kind: "boss",
      enemies: ["boss"],
      label: "今日終局",
    },
  ];

  return {
    dateKey,
    seed,
    roomCap: MODES.daily.roomCap,
    bannedAbilityIds,
    rooms,
  };
}

/**
 * Boss attack pattern sequence by zone (1–3) and phase (1–2).
 * Zone themes change *behavior*, not only palette.
 */
export function bossPatterns(zone, phase = 1) {
  const z = Math.max(1, Math.min(3, Math.floor(zone) || 1));
  const p = phase >= 2 ? 2 : 1;
  if (z === 1) {
    return p === 1
      ? ["dash", "fan", "dash", "lunge"]
      : ["dash", "dash", "fan", "lunge", "dash"];
  }
  if (z === 2) {
    return p === 1
      ? ["area", "fan", "ring", "area"]
      : ["area", "ring", "fan", "area", "ring"];
  }
  return p === 1
    ? ["ring", "fan", "dash", "area"]
    : ["ring", "fan", "ring", "dash", "area", "fan"];
}

export function bossWindup(zone, kind) {
  const z = Math.max(1, Math.min(3, Math.floor(zone) || 1));
  if (kind === "dash") return z === 1 ? 0.85 : 0.95;
  if (kind === "lunge") return 0.48;
  if (kind === "area") return z >= 2 ? 0.7 : 0.8;
  if (kind === "ring") return z === 3 ? 0.75 : 0.8;
  return 0.8;
}

export function bossFanCount(zone, phase) {
  const z = Math.max(1, Math.min(3, Math.floor(zone) || 1));
  const base = z === 3 ? 8 : z === 2 ? 7 : 6;
  return phase >= 2 ? base + 2 : base;
}

export function bossRingCount(zone, phase) {
  const z = Math.max(1, Math.min(3, Math.floor(zone) || 1));
  const base = z === 3 ? 18 : z === 2 ? 16 : 14;
  return phase >= 2 ? base + 5 : base;
}

/**
 * Refund legacy flat attack/health purchases into gold (once).
 */
function refundLegacyPercents(base, raw) {
  const attack = Math.min(10, Math.max(0, Math.floor(Number(raw?.attack) || 0)));
  const health = Math.min(10, Math.max(0, Math.floor(Number(raw?.health) || 0)));
  let refund = 0;
  for (let i = 0; i < attack; i++) refund += upgradeCost("attack", i);
  for (let i = 0; i < health; i++) refund += upgradeCost("health", i);
  if (refund > 0) base.gold += refund;
  base.attack = 0;
  base.health = 0;
  return { attack, health, refund };
}

/**
 * Merge v3 / v2 / legacy saves into v3 shape.
 * Legacy `best` folds into normal-mode farthest room.
 * Old attack/health % purchases are refunded as gold.
 */
export function migrateMeta(raw) {
  const base = emptyMeta();
  if (!raw || typeof raw !== "object") return base;

  const gold = Number(raw.gold);
  if (Number.isFinite(gold) && gold > 0) base.gold = Math.floor(gold);

  const best = Number(raw.best);
  if (Number.isFinite(best) && best > 0) base.best = Math.floor(best);

  refundLegacyPercents(base, raw);

  if (raw.unlocked && typeof raw.unlocked === "object") {
    for (const id of META_UNLOCK_ORDER) {
      if (raw.unlocked[id]) base.unlocked[id] = true;
    }
  }

  const modeIds = Object.keys(MODES);
  if (raw.bestByMode && typeof raw.bestByMode === "object") {
    for (const id of modeIds) {
      const n = Number(raw.bestByMode[id]);
      if (Number.isFinite(n) && n > 0) base.bestByMode[id] = Math.floor(n);
    }
  }
  if (raw.clearsByMode && typeof raw.clearsByMode === "object") {
    for (const id of modeIds) {
      const n = Number(raw.clearsByMode[id]);
      if (Number.isFinite(n) && n > 0) base.clearsByMode[id] = Math.floor(n);
    }
  }

  if (raw.bestDaily && typeof raw.bestDaily === "object") {
    base.bestDaily = {
      date: String(raw.bestDaily.date || ""),
      room: Math.max(0, Math.floor(Number(raw.bestDaily.room) || 0)),
      win: !!raw.bestDaily.win,
    };
  }

  if (MODES[raw.lastMode]) base.lastMode = raw.lastMode;

  if (base.best > base.bestByMode.normal) {
    base.bestByMode.normal = base.best;
  }

  base.best = Math.max(
    base.best,
    ...modeIds.map((id) => base.bestByMode[id] || 0),
  );
  return base;
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
 * Daily also updates bestDaily for the calendar date.
 */
export function recordRun(meta, { mode, room, win, dateKey }) {
  const next = migrateMeta(meta);
  const m = getMode(mode);
  const farthest = Math.max(1, Math.min(m.roomCap, Math.floor(room) || 1));
  const prev = next.bestByMode[mode] || 0;
  const isModeBest = farthest > prev;
  if (isModeBest) next.bestByMode[mode] = farthest;
  if (win) next.clearsByMode[mode] = (next.clearsByMode[mode] || 0) + 1;
  next.best = Math.max(
    next.best,
    ...Object.keys(MODES).map((id) => next.bestByMode[id] || 0),
  );
  next.lastMode = mode === "daily" ? next.lastMode : mode;

  let isDailyBest = false;
  if (mode === "daily" && dateKey) {
    const sameDay = next.bestDaily.date === dateKey;
    const betterRoom = farthest > (next.bestDaily.room || 0);
    const betterWin = win && !next.bestDaily.win;
    if (!sameDay || betterRoom || (farthest === next.bestDaily.room && betterWin)) {
      next.bestDaily = { date: dateKey, room: farthest, win: !!win };
      isDailyBest = true;
    }
  }

  return { meta: next, isModeBest, isDailyBest, farthest };
}

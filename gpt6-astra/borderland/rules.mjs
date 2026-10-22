/**
 * Pure rules for Dust Riot / Borderland wave defense.
 * Keep this free of DOM so check-borderland.mjs can import it in Node.
 */

export const STORAGE_KEY = "dust-riot-v3";
export const LEGACY_STORAGE_KEY = "dust-riot-v2";
export const LEGACY_STORAGE_KEY_V1 = "dust-riot-v1";

/** @typedef {"easy"|"normal"|"hard"|"daily"} DifficultyId */
/** @typedef {"smg"|"rifle"|"shotgun"} WeaponId */
/** @typedef {"grunt"|"rusher"|"mortar"|"shield"} EnemyKind */

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
  /**
   * Daily uses normal combat scalars as the base; banned weapon / focus
   * enemy / mutation come from dailyChallenge(Asia/Taipei date).
   */
  daily: {
    id: "daily",
    label: "每日突變",
    blurb: "以台北日為種子：禁用武器、主力兵種、一則突變規則。",
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
};

/** Lobby difficulty buttons (daily is separate). */
export const DIFFICULTY_ORDER = /** @type {Exclude<DifficultyId, "daily">[]} */ ([
  "easy",
  "normal",
  "hard",
]);

/** All modes that track best/clears, including daily. */
export const MODE_ORDER = /** @type {DifficultyId[]} */ ([
  "easy",
  "normal",
  "hard",
  "daily",
]);

/**
 * Loadout identities — real tradeoffs, not pure number swaps.
 * SMG: spray volume vs range (clears rushers, struggles vs mortar).
 * Rifle: reach + headshot — best vs mortar / mid range.
 * Shotgun: pellet cone shreds shields up close, useless past range.
 */
export const WEAPONS = {
  smg: {
    id: "smg",
    label: "廢鐵衝鋒槍",
    code: "SCRAP-SMG // MK.02",
    blurb: "射速高、彈匣大，中近距壓制衝鋒。遠距傷害腰斬。",
    tip: "擅長清理衝鋒兵；對迫擊砲手偏弱。",
    magSize: 36,
    reloadSec: 1.55,
    fireCooldown: 0.07,
    bodyDamage: 18,
    headMult: 1.75,
    range: 38,
    falloffStart: 18,
    falloffMin: 0.45,
    pellets: 1,
    spread: 0.028,
    recoilKick: 0.04,
    recoilCap: 0.1,
  },
  rifle: {
    id: "rifle",
    label: "廢土步槍",
    code: "SCRAP-RIFLE // MK.04",
    blurb: "精準中遠距；爆頭獎勵高。彈匣小、射速穩。",
    tip: "對迫擊砲手與中距最划算。",
    magSize: 24,
    reloadSec: 1.35,
    fireCooldown: 0.115,
    bodyDamage: 26,
    headMult: 2,
    range: 85,
    falloffStart: 50,
    falloffMin: 0.75,
    pellets: 1,
    spread: 0.006,
    recoilKick: 0.065,
    recoilCap: 0.14,
  },
  shotgun: {
    id: "shotgun",
    label: "散彈破盾",
    code: "SCATTER-BORE // MK.01",
    blurb: "近距多彈丸，可打穿盾牌側緣。遠距離幾乎無效。",
    tip: "專剋盾兵；遠距請換掩體靠近。",
    magSize: 8,
    reloadSec: 1.85,
    fireCooldown: 0.55,
    bodyDamage: 14,
    headMult: 1.5,
    range: 22,
    falloffStart: 8,
    falloffMin: 0.2,
    pellets: 6,
    spread: 0.12,
    recoilKick: 0.12,
    recoilCap: 0.22,
  },
};

export const WEAPON_ORDER = /** @type {WeaponId[]} */ ([
  "smg",
  "rifle",
  "shotgun",
]);

/**
 * Enemy archetypes — behaviors differ, not only HP/speed scalars.
 * kindMult applied on top of difficulty wave scaling.
 */
export const ENEMY_KINDS = {
  grunt: {
    id: "grunt",
    label: "掠奪者",
    hpMult: 1,
    speedMult: 1,
    damageMult: 1,
    scoreMult: 1,
    preferRange: 3.5,
    canShoot: true,
    meleeOnly: false,
    shieldFront: false,
    lobShot: false,
    color: 0xa94734,
    headColor: 0xf3bd49,
  },
  rusher: {
    id: "rusher",
    label: "衝鋒兵",
    hpMult: 0.55,
    speedMult: 1.85,
    damageMult: 1.35,
    scoreMult: 1.15,
    preferRange: 1.4,
    canShoot: false,
    meleeOnly: true,
    shieldFront: false,
    lobShot: false,
    color: 0xc45a2a,
    headColor: 0xffd27a,
  },
  mortar: {
    id: "mortar",
    label: "迫擊砲手",
    hpMult: 0.85,
    speedMult: 0.55,
    damageMult: 1.5,
    scoreMult: 1.4,
    preferRange: 18,
    canShoot: true,
    meleeOnly: false,
    shieldFront: false,
    lobShot: true,
    color: 0x6b4a6e,
    headColor: 0xe8c070,
  },
  shield: {
    id: "shield",
    label: "盾兵",
    hpMult: 1.35,
    speedMult: 0.75,
    damageMult: 0.9,
    scoreMult: 1.25,
    preferRange: 4.5,
    canShoot: true,
    meleeOnly: false,
    shieldFront: true,
    lobShot: false,
    color: 0x4a5560,
    headColor: 0xd4a84a,
  },
};

export const ENEMY_KIND_ORDER = /** @type {EnemyKind[]} */ ([
  "grunt",
  "rusher",
  "mortar",
  "shield",
]);

/** Elite every N waves (wave index is 1-based). */
export const ELITE_EVERY = 4;

export function getDifficulty(id) {
  return DIFFICULTIES[id] || DIFFICULTIES.normal;
}

export function getWeapon(id) {
  return WEAPONS[id] || WEAPONS.rifle;
}

export function getEnemyKind(id) {
  return ENEMY_KINDS[id] || ENEMY_KINDS.grunt;
}

export function enemyHp(wave, difficulty, kind = "grunt", elite = false) {
  const d = getDifficulty(difficulty);
  const k = getEnemyKind(kind);
  const base = d.enemyHpBase + Math.max(0, wave) * d.enemyHpPerWave;
  return Math.round(base * k.hpMult * (elite ? 2.4 : 1));
}

export function enemySpeed(wave, difficulty, kind = "grunt", elite = false) {
  const d = getDifficulty(difficulty);
  const k = getEnemyKind(kind);
  const base =
    d.enemySpeedBase +
    Math.min(d.enemySpeedCapAdd, Math.max(0, wave) * d.enemySpeedPerWave);
  return base * k.speedMult * (elite ? 1.12 : 1);
}

export function spawnCount(wave, difficulty) {
  const d = getDifficulty(difficulty);
  return Math.min(
    d.spawnCap,
    Math.floor(d.spawnBase + Math.max(0, wave) * d.spawnPerWave),
  );
}

export function enemyFireCooldown(wave, difficulty, kind = "grunt") {
  const d = getDifficulty(difficulty);
  const k = getEnemyKind(kind);
  let cd = Math.max(
    d.fireCooldownMin,
    d.fireCooldownBase - Math.max(0, wave) * d.fireCooldownWave,
  );
  if (k.lobShot) cd *= 1.35;
  if (k.meleeOnly) cd *= 0.55;
  return cd;
}

export function projectileSpeed(wave, difficulty) {
  const d = getDifficulty(difficulty);
  return (
    d.projectileSpeedBase +
    Math.min(8, Math.max(0, wave) * d.projectileSpeedWave)
  );
}

export function killScore(wave, kind = "grunt", elite = false) {
  const k = getEnemyKind(kind);
  const base = 100 + Math.max(0, wave) * 15;
  return Math.round(base * k.scoreMult * (elite ? 2.5 : 1));
}

/** Soft goal met when the cleared wave index reaches clearWave. */
export function reachedClearWave(wave, difficulty) {
  const d = getDifficulty(difficulty);
  return wave >= d.clearWave;
}

export function isEliteWave(wave) {
  return wave > 0 && wave % ELITE_EVERY === 0;
}

/**
 * Pick enemy kinds for a wave. Mix unlocks with wave progress;
 * elite waves guarantee one elite + more pressure units.
 * Optional focusKind biases slots toward that kind once unlocked.
 * eliteEvery overrides the default ELITE_EVERY cadence (daily mutations).
 */
export function pickWaveComposition(
  wave,
  count,
  focusKind = null,
  eliteEvery = ELITE_EVERY,
) {
  /** @type {{ kind: EnemyKind, elite: boolean }[]} */
  const list = [];
  const eliteWave = isEliteWaveFor(wave, eliteEvery);
  const pool = /** @type {EnemyKind[]} */ (["grunt"]);
  if (wave >= 2) pool.push("rusher");
  if (wave >= 3) pool.push("mortar");
  if (wave >= 4) pool.push("shield");
  const focus =
    focusKind && ENEMY_KINDS[focusKind] && pool.includes(focusKind)
      ? focusKind
      : null;

  let remaining = Math.max(0, Math.floor(count));
  if (eliteWave && remaining > 0) {
    const eliteKind = focus
      ? focus
      : wave >= 8
        ? "shield"
        : wave >= 4
          ? "mortar"
          : "rusher";
    list.push({ kind: eliteKind, elite: true });
    remaining--;
  }

  for (let i = 0; i < remaining; i++) {
    // Bias: later waves lean into specialty kinds.
    let kind = pool[i % pool.length];
    if (wave >= 5 && i % 3 === 0 && pool.includes("rusher")) kind = "rusher";
    if (wave >= 6 && i % 4 === 1 && pool.includes("mortar")) kind = "mortar";
    if (wave >= 7 && i % 5 === 2 && pool.includes("shield")) kind = "shield";
    if (focus && i % 5 < 2) kind = focus;
    list.push({ kind, elite: false });
  }
  return list;
}

/* ---- Asia/Taipei daily mutation ---- */

const TAIPEI_OFFSET_MINUTES = 8 * 60;

/** Calendar date YYYY-MM-DD in Asia/Taipei. */
export function taipeiDateKey(now = new Date()) {
  const shifted = new Date(now.getTime() + TAIPEI_OFFSET_MINUTES * 60_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function previousTaipeiDay(key) {
  const [y, m, d] = key.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return taipeiDateKey(new Date(utc.getTime() - TAIPEI_OFFSET_MINUTES * 60_000));
}

/** Stable 1..999998 seed from a string. */
export function seedFromString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 999999 || 1;
}

export function dailySeed(date = new Date()) {
  return seedFromString(`dust-riot-daily:${taipeiDateKey(date)}`);
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
 * Daily mutation rules — one is picked per Taipei day.
 * Effects fold into applyDailyMutation / elite cadence / fog.
 */
export const DAILY_MUTATIONS = {
  ammo_drought: {
    id: "ammo_drought",
    label: "彈匣乾旱",
    blurb: "彈匣容量只剩六成，每一發都要算準。",
    magMul: 0.6,
    enemyHpMul: 1,
    enemySpeedMul: 1,
    enemyDamageMul: 1,
    reloadMul: 1,
    fogNear: false,
    eliteEvery: ELITE_EVERY,
  },
  thick_fog: {
    id: "thick_fog",
    label: "濃霧壓境",
    blurb: "視線縮短，遠距點殺變難。",
    magMul: 1,
    enemyHpMul: 1,
    enemySpeedMul: 1,
    enemyDamageMul: 1,
    reloadMul: 1,
    fogNear: true,
    eliteEvery: ELITE_EVERY,
  },
  blood_rush: {
    id: "blood_rush",
    label: "血色衝鋒",
    blurb: "敵軍移速提高，衝鋒壓力更大。",
    magMul: 1,
    enemyHpMul: 1,
    enemySpeedMul: 1.22,
    enemyDamageMul: 1,
    reloadMul: 1,
    fogNear: false,
    eliteEvery: ELITE_EVERY,
  },
  iron_hide: {
    id: "iron_hide",
    label: "鐵皮外包",
    blurb: "敵人體力加厚，清場更慢。",
    magMul: 1,
    enemyHpMul: 1.28,
    enemySpeedMul: 1,
    enemyDamageMul: 1,
    reloadMul: 1,
    fogNear: false,
    eliteEvery: ELITE_EVERY,
  },
  glass_line: {
    id: "glass_line",
    label: "玻璃防線",
    blurb: "敵彈更痛，但補血箱也更慷慨。",
    magMul: 1,
    enemyHpMul: 1,
    enemySpeedMul: 1,
    enemyDamageMul: 1.35,
    reloadMul: 1,
    fogNear: false,
    eliteEvery: ELITE_EVERY,
    pickupHealMul: 1.4,
  },
  slow_hands: {
    id: "slow_hands",
    label: "鏽蝕槍機",
    blurb: "換彈變慢，節奏被打亂。",
    magMul: 1,
    enemyHpMul: 1,
    enemySpeedMul: 1,
    enemyDamageMul: 1,
    reloadMul: 1.4,
    fogNear: false,
    eliteEvery: ELITE_EVERY,
  },
  elite_tide: {
    id: "elite_tide",
    label: "精英潮汐",
    blurb: "每 2 波就有精英壓陣。",
    magMul: 1,
    enemyHpMul: 1,
    enemySpeedMul: 1,
    enemyDamageMul: 1,
    reloadMul: 1,
    fogNear: false,
    eliteEvery: 2,
  },
};

export const MUTATION_ORDER = Object.keys(DAILY_MUTATIONS);

/**
 * @returns {{
 *   dateKey: string,
 *   seed: number,
 *   bannedWeapon: WeaponId,
 *   focusEnemy: EnemyKind,
 *   mutation: typeof DAILY_MUTATIONS[keyof typeof DAILY_MUTATIONS],
 * }}
 */
export function dailyChallenge(date = new Date()) {
  const dateKey = taipeiDateKey(date);
  const seed = dailySeed(date);
  const rng = makeRng(seed);
  const bannedWeapon =
    WEAPON_ORDER[Math.floor(rng() * WEAPON_ORDER.length)];
  const focusEnemy =
    ENEMY_KIND_ORDER[Math.floor(rng() * ENEMY_KIND_ORDER.length)];
  const mutation =
    DAILY_MUTATIONS[
      MUTATION_ORDER[Math.floor(rng() * MUTATION_ORDER.length)]
    ];
  return { dateKey, seed, bannedWeapon, focusEnemy, mutation };
}

export function getMutation(id) {
  return DAILY_MUTATIONS[id] || null;
}

/**
 * Fold daily mutation into difficulty scalars used by the loop.
 * @param {ReturnType<typeof getDifficulty>} difficulty
 * @param {typeof DAILY_MUTATIONS[keyof typeof DAILY_MUTATIONS]|null} mutation
 */
export function applyDailyMutation(difficulty, mutation) {
  const m = mutation || null;
  if (!m) {
    return {
      ...difficulty,
      magMul: 1,
      reloadMul: 1,
      enemyHpMul: 1,
      enemySpeedMul: 1,
      enemyDamageMul: 1,
      pickupHealMul: 1,
      fogNear: false,
      eliteEvery: ELITE_EVERY,
    };
  }
  return {
    ...difficulty,
    enemyDamage: Math.round(difficulty.enemyDamage * (m.enemyDamageMul || 1)),
    pickupHeal: Math.round(
      difficulty.pickupHeal * (m.pickupHealMul || 1),
    ),
    magMul: m.magMul || 1,
    reloadMul: m.reloadMul || 1,
    enemyHpMul: m.enemyHpMul || 1,
    enemySpeedMul: m.enemySpeedMul || 1,
    enemyDamageMul: m.enemyDamageMul || 1,
    pickupHealMul: m.pickupHealMul || 1,
    fogNear: !!m.fogNear,
    eliteEvery: m.eliteEvery || ELITE_EVERY,
  };
}

export function isEliteWaveFor(wave, eliteEvery = ELITE_EVERY) {
  const n = Math.max(1, Math.floor(eliteEvery) || ELITE_EVERY);
  return wave > 0 && wave % n === 0;
}

/* ---- Permanent meta unlocks (scrap points) ---- */

/**
 * One-time permanent unlocks — starting gear or small passives.
 * Bought with scrap earned from clears / milestones.
 */
export const META_UNLOCKS = {
  startBandage: {
    id: "startBandage",
    label: "開局繃帶",
    blurb: "每局開場生命值 +15。",
    cost: 40,
    startingHpBonus: 15,
  },
  extraMag: {
    id: "extraMag",
    label: "備用彈匣",
    blurb: "開局彈匣容量 +40%（向上取整）。",
    cost: 50,
    magMul: 1.4,
  },
  quickHands: {
    id: "quickHands",
    label: "快手換彈",
    blurb: "換彈時間 −15%。",
    cost: 55,
    reloadMul: 0.85,
  },
  scrapVest: {
    id: "scrapVest",
    label: "廢鐵背心",
    blurb: "每局第一次受傷無效。",
    cost: 70,
    absorbFirstHit: true,
  },
  fieldMedic: {
    id: "fieldMedic",
    label: "戰地醫包",
    blurb: "波次間補血 +8。",
    cost: 45,
    betweenWaveHealBonus: 8,
  },
  keenEye: {
    id: "keenEye",
    label: "銳眼瞄具",
    blurb: "爆頭傷害倍率 +0.25。",
    cost: 80,
    headMultBonus: 0.25,
  },
  scavKit: {
    id: "scavKit",
    label: "拾荒套件",
    blurb: "綠箱補血 +10。",
    cost: 35,
    pickupHealBonus: 10,
  },
};

export const META_UNLOCK_ORDER = Object.keys(META_UNLOCKS);

/** @typedef {keyof typeof META_UNLOCKS} MetaUnlockId */

export function emptyUnlocked() {
  /** @type {Record<string, boolean>} */
  const unlocked = {};
  for (const id of META_UNLOCK_ORDER) unlocked[id] = false;
  return unlocked;
}

export function unlockCost(id) {
  return META_UNLOCKS[id]?.cost ?? Infinity;
}

export function isUnlockOwned(stats, id) {
  return !!(stats?.unlocked && stats.unlocked[id]);
}

/**
 * Spend scrap on a one-time unlock. Returns { ok, stats, reason? }.
 */
export function buyMeta(stats, unlockId) {
  const next = migrateStats(stats);
  const def = META_UNLOCKS[unlockId];
  if (!def) return { ok: false, stats: next, reason: "unknown" };
  if (next.unlocked[unlockId]) return { ok: false, stats: next, reason: "owned" };
  if (next.scrap < def.cost) return { ok: false, stats: next, reason: "scrap" };
  next.scrap -= def.cost;
  next.unlocked[unlockId] = true;
  return { ok: true, stats: next };
}

/**
 * Aggregate permanent modifiers from owned unlocks.
 */
export function metaRunBonuses(stats) {
  const m = migrateStats(stats);
  let startingHpBonus = 0;
  let magMul = 1;
  let reloadMul = 1;
  let absorbFirstHit = false;
  let betweenWaveHealBonus = 0;
  let headMultBonus = 0;
  let pickupHealBonus = 0;
  for (const id of META_UNLOCK_ORDER) {
    if (!m.unlocked[id]) continue;
    const def = META_UNLOCKS[id];
    startingHpBonus += def.startingHpBonus || 0;
    if (def.magMul) magMul *= def.magMul;
    if (def.reloadMul) reloadMul *= def.reloadMul;
    if (def.absorbFirstHit) absorbFirstHit = true;
    betweenWaveHealBonus += def.betweenWaveHealBonus || 0;
    headMultBonus += def.headMultBonus || 0;
    pickupHealBonus += def.pickupHealBonus || 0;
  }
  return {
    startingHpBonus,
    magMul,
    reloadMul,
    absorbFirstHit,
    betweenWaveHealBonus,
    headMultBonus,
    pickupHealBonus,
  };
}

/**
 * Effective weapon for a run after daily mag/reload + meta bonuses.
 */
export function effectiveWeapon(weaponId, { mutation = null, meta = null } = {}) {
  const base = getWeapon(weaponId);
  const mut = mutation || { magMul: 1, reloadMul: 1 };
  const bonuses = meta || {
    magMul: 1,
    reloadMul: 1,
    headMultBonus: 0,
  };
  const magMul = (mut.magMul || 1) * (bonuses.magMul || 1);
  const reloadMul = (mut.reloadMul || 1) * (bonuses.reloadMul || 1);
  return {
    ...base,
    magSize: Math.max(1, Math.round(base.magSize * magMul)),
    reloadSec: Math.max(0.4, base.reloadSec * reloadMul),
    headMult: base.headMult + (bonuses.headMultBonus || 0),
  };
}

/**
 * Scrap awarded for a finished run (clears + wave milestones).
 */
export function scrapForRun({ mode, wave, score, won }) {
  const d = getDifficulty(mode);
  let scrap = Math.floor(Math.max(0, wave) * 2 + Math.max(0, score) / 400);
  if (wave >= 3) scrap += 5;
  if (wave >= 5) scrap += 8;
  if (wave >= d.clearWave) scrap += 12;
  if (won) {
    if (mode === "easy") scrap += 25;
    else if (mode === "normal") scrap += 40;
    else if (mode === "hard") scrap += 65;
    else if (mode === "daily") scrap += 45;
  }
  return Math.max(0, Math.floor(scrap));
}

/**
 * Consecutive Taipei days with a recorded daily run (play streak).
 * @param {string[]} playDates
 * @param {string} today
 */
export function computeDailyStreak(playDates, today) {
  const days = new Set(
    (Array.isArray(playDates) ? playDates : []).filter(
      (k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k),
    ),
  );
  let cursor = days.has(today) ? today : previousTaipeiDay(today);
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = previousTaipeiDay(cursor);
  }
  return streak;
}

/**
 * Traditional Chinese share blurb for today's daily run.
 */
export function formatDailyShareText({
  dateKey,
  wave,
  score,
  won,
  streak,
  bannedWeapon,
  focusEnemy,
  mutation,
}) {
  const w = getWeapon(bannedWeapon);
  const e = getEnemyKind(focusEnemy);
  const mut = typeof mutation === "string" ? getMutation(mutation) : mutation;
  const lines = [
    `DUST RIOT 每日突變 ${dateKey}`,
    `波次 ${wave} · ${score.toLocaleString()} 分 · ${won ? "通關" : "戰敗"}`,
    `禁用：${w.label} · 主力：${e.label} · 突變：${mut?.label || "—"}`,
    `連續 ${streak} 天`,
    `#DustRiot #ClubhouseGames`,
  ];
  return lines.join("\n");
}

/**
 * Damage after range falloff. Pellets each call this independently.
 * Optional weaponOverride lets callers pass effectiveWeapon(...) (meta/daily).
 * Returns { damage, inRange }.
 */
export function weaponHitDamage(weaponId, distance, isHead, weaponOverride = null) {
  const w = weaponOverride || getWeapon(weaponId);
  if (distance > w.range) return { damage: 0, inRange: false };
  let mult = 1;
  if (distance > w.falloffStart) {
    const t =
      (distance - w.falloffStart) / Math.max(0.01, w.range - w.falloffStart);
    mult = 1 - t * (1 - w.falloffMin);
  }
  let dmg = w.bodyDamage * mult;
  if (isHead) dmg *= w.headMult;
  return { damage: Math.max(1, Math.round(dmg)), inRange: true };
}

/**
 * Frontal shield blocks hits when the shot comes from roughly in front
 * of the shield bearer (dot of facing vs shot direction).
 * Shotgun pellets past the rim (wide angle) can still land.
 */
export function shieldBlocksHit(facingY, fromX, fromZ, toX, toZ, weaponId) {
  const dx = fromX - toX;
  const dz = fromZ - toZ;
  const len = Math.hypot(dx, dz) || 1;
  const fx = Math.sin(facingY);
  const fz = Math.cos(facingY);
  const dot = (dx / len) * fx + (dz / len) * fz;
  // Front hemisphere blocks for rifle/smg; shotgun needs near-frontal to block all pellets.
  const threshold = weaponId === "shotgun" ? 0.72 : 0.15;
  return dot > threshold;
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
      daily: emptyModeBest(),
    },
    clearsByMode: { easy: 0, normal: 0, hard: 0, daily: 0 },
    lastMode: "normal",
    lastWeapon: "rifle",
    weaponClears: { smg: 0, rifle: 0, shotgun: 0 },
    scrap: 0,
    unlocked: emptyUnlocked(),
    bestDaily: { date: "", wave: 0, score: 0, win: false },
    dailyPlayDates: [],
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
  for (const id of MODE_ORDER) {
    const entry = raw.bestByMode?.[id];
    if (entry && typeof entry === "object") {
      base.bestByMode[id] = sanitizeBest(entry);
    } else if (Number.isFinite(Number(entry))) {
      // tolerate a flat score-only legacy shape
      base.bestByMode[id] = {
        wave: 0,
        score: Math.max(0, Math.floor(Number(entry))),
      };
    }
    const clears = Number(raw.clearsByMode?.[id]);
    if (Number.isFinite(clears) && clears > 0) {
      base.clearsByMode[id] = Math.floor(clears);
    }
  }
  if (DIFFICULTIES[raw.lastMode]) base.lastMode = raw.lastMode;
  if (WEAPONS[raw.lastWeapon]) base.lastWeapon = raw.lastWeapon;
  for (const id of WEAPON_ORDER) {
    const n = Number(raw.weaponClears?.[id]);
    if (Number.isFinite(n) && n > 0) base.weaponClears[id] = Math.floor(n);
  }
  const scrap = Number(raw.scrap);
  if (Number.isFinite(scrap) && scrap > 0) base.scrap = Math.floor(scrap);
  if (raw.unlocked && typeof raw.unlocked === "object") {
    for (const id of META_UNLOCK_ORDER) {
      if (raw.unlocked[id]) base.unlocked[id] = true;
    }
  }
  if (raw.bestDaily && typeof raw.bestDaily === "object") {
    base.bestDaily = {
      date: String(raw.bestDaily.date || ""),
      wave: Math.max(0, Math.floor(Number(raw.bestDaily.wave) || 0)),
      score: Math.max(0, Math.floor(Number(raw.bestDaily.score) || 0)),
      win: !!raw.bestDaily.win,
    };
  }
  if (Array.isArray(raw.dailyPlayDates)) {
    base.dailyPlayDates = [
      ...new Set(
        raw.dailyPlayDates.filter(
          (k) => typeof k === "string" && /^\d{4}-\d{2}-\d{2}$/.test(k),
        ),
      ),
    ].slice(-60);
  }
  return base;
}

/**
 * Apply a finished run into persisted stats.
 * Best wave and best score are tracked independently per mode.
 * Awards scrap; daily updates bestDaily + play dates for streak.
 * Returns { stats, isWaveBest, isScoreBest, isDailyBest, scrapGained, streak }.
 */
export function recordRun(
  stats,
  { mode, wave, score, won, weapon, dateKey = null },
) {
  const id = DIFFICULTIES[mode] ? mode : "normal";
  const weaponId = WEAPONS[weapon] ? weapon : "rifle";
  const next = migrateStats(stats);
  next.bestByMode = {
    easy: { ...next.bestByMode.easy },
    normal: { ...next.bestByMode.normal },
    hard: { ...next.bestByMode.hard },
    daily: { ...next.bestByMode.daily },
  };
  next.clearsByMode = { ...next.clearsByMode };
  next.weaponClears = {
    smg: next.weaponClears.smg || 0,
    rifle: next.weaponClears.rifle || 0,
    shotgun: next.weaponClears.shotgun || 0,
  };
  next.unlocked = { ...next.unlocked };
  next.dailyPlayDates = [...next.dailyPlayDates];

  const w = Math.max(0, Math.floor(wave));
  const s = Math.max(0, Math.floor(score));
  const prev = next.bestByMode[id] || emptyModeBest();
  const isWaveBest = w > (prev.wave || 0);
  const isScoreBest = s > (prev.score || 0);
  next.bestByMode[id] = {
    wave: Math.max(prev.wave || 0, w),
    score: Math.max(prev.score || 0, s),
  };
  if (won) {
    next.clearsByMode[id] = (next.clearsByMode[id] || 0) + 1;
    next.weaponClears[weaponId] = (next.weaponClears[weaponId] || 0) + 1;
  }
  if (id !== "daily") next.lastMode = id;
  next.lastWeapon = weaponId;

  const scrapGained = scrapForRun({ mode: id, wave: w, score: s, won });
  next.scrap += scrapGained;

  let isDailyBest = false;
  let streak = computeDailyStreak(next.dailyPlayDates, dateKey || "");
  if (id === "daily" && dateKey) {
    if (!next.dailyPlayDates.includes(dateKey)) {
      next.dailyPlayDates.push(dateKey);
      next.dailyPlayDates = next.dailyPlayDates.slice(-60);
    }
    streak = computeDailyStreak(next.dailyPlayDates, dateKey);
    const sameDay = next.bestDaily.date === dateKey;
    const betterWave = w > (next.bestDaily.wave || 0);
    const betterScore =
      w === (next.bestDaily.wave || 0) && s > (next.bestDaily.score || 0);
    const betterWin = won && !next.bestDaily.win && w >= (next.bestDaily.wave || 0);
    if (!sameDay || betterWave || betterScore || betterWin) {
      next.bestDaily = { date: dateKey, wave: w, score: s, win: !!won };
      isDailyBest = true;
    }
  }

  return {
    stats: next,
    isWaveBest,
    isScoreBest,
    isDailyBest,
    scrapGained,
    streak,
  };
}

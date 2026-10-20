/**
 * Pure rules for Dust Riot / Borderland wave defense.
 * Keep this free of DOM so check-borderland.mjs can import it in Node.
 */

export const STORAGE_KEY = "dust-riot-v2";
export const LEGACY_STORAGE_KEY = "dust-riot-v1";

/** @typedef {"easy"|"normal"|"hard"} DifficultyId */
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
};

export const DIFFICULTY_ORDER = /** @type {DifficultyId[]} */ ([
  "easy",
  "normal",
  "hard",
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
 */
export function pickWaveComposition(wave, count) {
  /** @type {{ kind: EnemyKind, elite: boolean }[]} */
  const list = [];
  const eliteWave = isEliteWave(wave);
  const pool = /** @type {EnemyKind[]} */ (["grunt"]);
  if (wave >= 2) pool.push("rusher");
  if (wave >= 3) pool.push("mortar");
  if (wave >= 4) pool.push("shield");

  let remaining = Math.max(0, Math.floor(count));
  if (eliteWave && remaining > 0) {
    const eliteKind =
      wave >= 8 ? "shield" : wave >= 4 ? "mortar" : "rusher";
    list.push({ kind: eliteKind, elite: true });
    remaining--;
  }

  for (let i = 0; i < remaining; i++) {
    // Bias: later waves lean into specialty kinds.
    let kind = pool[i % pool.length];
    if (wave >= 5 && i % 3 === 0 && pool.includes("rusher")) kind = "rusher";
    if (wave >= 6 && i % 4 === 1 && pool.includes("mortar")) kind = "mortar";
    if (wave >= 7 && i % 5 === 2 && pool.includes("shield")) kind = "shield";
    list.push({ kind, elite: false });
  }
  return list;
}

/**
 * Damage after range falloff. Pellets each call this independently.
 * Returns { damage, inRange }.
 */
export function weaponHitDamage(weaponId, distance, isHead) {
  const w = getWeapon(weaponId);
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
    },
    clearsByMode: { easy: 0, normal: 0, hard: 0 },
    lastMode: "normal",
    lastWeapon: "rifle",
    weaponClears: { smg: 0, rifle: 0, shotgun: 0 },
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
  return base;
}

/**
 * Apply a finished run into persisted stats.
 * Best wave and best score are tracked independently per mode.
 * Returns { stats, isWaveBest, isScoreBest }.
 */
export function recordRun(stats, { mode, wave, score, won, weapon }) {
  const id = DIFFICULTIES[mode] ? mode : "normal";
  const weaponId = WEAPONS[weapon] ? weapon : "rifle";
  const next = {
    bestByMode: {
      easy: { ...stats.bestByMode.easy },
      normal: { ...stats.bestByMode.normal },
      hard: { ...stats.bestByMode.hard },
    },
    clearsByMode: { ...stats.clearsByMode },
    lastMode: id,
    lastWeapon: weaponId,
    weaponClears: {
      smg: stats.weaponClears?.smg || 0,
      rifle: stats.weaponClears?.rifle || 0,
      shotgun: stats.weaponClears?.shotgun || 0,
    },
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
  if (won) {
    next.clearsByMode[id] = (next.clearsByMode[id] || 0) + 1;
    next.weaponClears[weaponId] = (next.weaponClears[weaponId] || 0) + 1;
  }
  return { stats: next, isWaveBest, isScoreBest };
}

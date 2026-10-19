/**
 * Smash arsenal: each type has a readable tell (wind-up colour / lean) and flight bias.
 * Fakes show one tell then fly as another type.
 */

/** @typedef {'straight' | 'cross' | 'drop' | 'body'} SmashTypeId */

/**
 * @typedef {object} SmashDef
 * @property {SmashTypeId} id
 * @property {string} label
 * @property {string} tellHint  short Traditional Chinese cue for HUD
 * @property {number} speedMul
 * @property {number} dropRate  extra downward accel while approaching
 * @property {number} windupSec
 * @property {number} trailColor  hex
 * @property {number} tellColor   hex
 * @property {number} aimSpreadMul
 * @property {boolean} trackPlayer  body smash tracks hand X at spawn
 * @property {'center' | 'side' | 'player'} aimProfile
 */

/** @type {Record<SmashTypeId, SmashDef>} */
export const SMASH_DEFS = {
  straight: {
    id: 'straight',
    label: '直線殺',
    tellHint: '高舉・直攻',
    speedMul: 1.18,
    dropRate: 0.02,
    windupSec: 0.42,
    trailColor: 0xff4444,
    tellColor: 0xff3333,
    aimSpreadMul: 0.55,
    trackPlayer: false,
    aimProfile: 'center',
  },
  cross: {
    id: 'cross',
    label: '斜線殺',
    tellHint: '側傾・斜殺',
    speedMul: 1.02,
    dropRate: 0.06,
    windupSec: 0.55,
    trailColor: 0x44aaff,
    tellColor: 0x3399ff,
    aimSpreadMul: 1.35,
    trackPlayer: false,
    aimProfile: 'side',
  },
  drop: {
    id: 'drop',
    label: '切吊',
    tellHint: '肩沉・減速',
    speedMul: 0.7,
    dropRate: 0.42,
    windupSec: 0.72,
    trailColor: 0x88ff66,
    tellColor: 0x66ee55,
    aimSpreadMul: 0.9,
    trackPlayer: false,
    aimProfile: 'center',
  },
  body: {
    id: 'body',
    label: '追身殺',
    tellHint: '對準身體',
    speedMul: 1.08,
    dropRate: 0.08,
    windupSec: 0.38,
    trailColor: 0xffcc44,
    tellColor: 0xffaa22,
    aimSpreadMul: 0.35,
    trackPlayer: true,
    aimProfile: 'player',
  },
};

/** @type {readonly SmashTypeId[]} */
export const SMASH_TYPE_IDS = Object.freeze(['straight', 'cross', 'drop', 'body']);

/**
 * Phase mixes for drill / score-attack waves (warm → pressure → chaos).
 * @type {ReadonlyArray<Readonly<Record<SmashTypeId, number>>>}
 */
export const PHASE_MIX = Object.freeze([
  { straight: 0.45, cross: 0.25, drop: 0.2, body: 0.1 },
  { straight: 0.3, cross: 0.3, drop: 0.15, body: 0.25 },
  { straight: 0.25, cross: 0.3, drop: 0.15, body: 0.3 },
]);

/**
 * Resolve aim X for a smash given player hand side and optional live player X.
 * @param {SmashTypeId} type
 * @param {{ handedness: 'left'|'right', playerX: number, aimSpread: number, sideSign?: -1|1, rng: () => number }} opts
 */
export function resolveAimX(type, opts) {
  const def = SMASH_DEFS[type];
  const handX = opts.handedness === 'right' ? 4 : -4;
  const spread = opts.aimSpread * def.aimSpreadMul;
  const jitter = (opts.rng() - 0.5) * spread;

  if (def.aimProfile === 'player' || def.trackPlayer) {
    return opts.playerX + jitter * 0.35;
  }
  if (def.aimProfile === 'side') {
    const sign = opts.sideSign ?? (opts.rng() < 0.5 ? -1 : 1);
    return handX + sign * (8 + opts.rng() * 6) + jitter * 0.25;
  }
  return handX + jitter;
}

/**
 * Pick smash type from a weight map.
 * @param {Readonly<Record<SmashTypeId, number>>} mix
 * @param {() => number} rng
 * @returns {SmashTypeId}
 */
export function pickSmashType(mix, rng) {
  const table = SMASH_TYPE_IDS.map((id) => ({ id, weight: mix[id] ?? 0 }));
  let sum = 0;
  for (const row of table) sum += Math.max(0, row.weight);
  let roll = rng() * Math.max(sum, 1e-6);
  for (const row of table) {
    roll -= Math.max(0, row.weight);
    if (roll <= 0) return row.id;
  }
  return 'straight';
}

/**
 * Fake: show a different tell than the real flight type.
 * Prefer a visually distinct pair (speed or lean differs).
 * @param {SmashTypeId} real
 * @param {() => number} rng
 * @returns {SmashTypeId}
 */
export function pickFakeTell(real, rng) {
  const candidates = SMASH_TYPE_IDS.filter((id) => id !== real);
  // Bias toward opposite "feel": fast↔slow, center↔side
  const preferred =
    real === 'drop'
      ? ['straight', 'body']
      : real === 'straight'
        ? ['drop', 'cross']
        : real === 'cross'
          ? ['straight', 'drop']
          : ['cross', 'drop'];
  if (rng() < 0.65) {
    return preferred[Math.floor(rng() * preferred.length)];
  }
  return candidates[Math.floor(rng() * candidates.length)];
}

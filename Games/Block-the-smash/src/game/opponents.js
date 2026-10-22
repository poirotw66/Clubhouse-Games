/**
 * CPU roster: styles differ in smash mix, fake rate, cover — plus signature habits.
 * Ladder is best-of-3 series; unlock by beating prior opponents.
 */

import { pickFakeTell, pickSmashType } from './smashTypes.js';

/** @typedef {import('./smashTypes.js').SmashTypeId} SmashTypeId */

/**
 * @typedef {object} OpponentStyle
 * @property {number} straight
 * @property {number} cross
 * @property {number} drop
 * @property {number} body
 * @property {number} fakeRate
 * @property {number} speedMul
 * @property {number} spawnMul
 * @property {number} defense
 * @property {number} coverLeft
 * @property {number} coverCenter
 * @property {number} coverRight
 * @property {number} aimSpread
 */

/**
 * Signature habit knobs consumed by queueWindup / chooseSmash wrappers.
 * @typedef {object} OpponentHabit
 * @property {string} id
 * @property {string} label  Traditional Chinese habit name for UI
 * @property {number} [burstChance]  enter consecutive heavy after a power smash
 * @property {number} [burstLen]
 * @property {number} [tempoJitter]  wind-up duration variance 0–1
 * @property {number} [spawnJitter]  spawn delay variance 0–1
 * @property {number} [heavyBias]  extra weight toward straight/body
 * @property {boolean} [altTempo]  alternate slow/fast wind-ups
 */

/**
 * @typedef {object} OpponentDef
 * @property {string} id
 * @property {string} name
 * @property {string} tagline
 * @property {string} catchphrase
 * @property {number} unlockWins  prior distinct wins needed on ladder
 * @property {OpponentStyle} style
 * @property {OpponentHabit} habit
 * @property {number} pointsToWin  first to N within a game
 * @property {number} bestOf  series length (odd); first to ceil(bestOf/2) games
 */

/** @type {readonly OpponentDef[]} */
export const OPPONENTS = Object.freeze([
  {
    id: 'hao',
    name: '閃電阿豪',
    tagline: '直線炸彈・少假動作',
    catchphrase: '接得住這球嗎！',
    unlockWins: 0,
    pointsToWin: 4,
    bestOf: 3,
    habit: { id: 'power', label: '直線重殺', heavyBias: 0.12, burstChance: 0.08, burstLen: 1 },
    style: {
      straight: 0.55,
      cross: 0.2,
      drop: 0.1,
      body: 0.15,
      fakeRate: 0.06,
      speedMul: 1.08,
      spawnMul: 1.05,
      defense: 0.28,
      coverLeft: 0.35,
      coverCenter: 0.55,
      coverRight: 0.35,
      aimSpread: 10,
    },
  },
  {
    id: 'mei',
    name: '斜線美美',
    tagline: '大斜線・邊線獵手',
    catchphrase: '左右拉開！',
    unlockWins: 1,
    pointsToWin: 4,
    bestOf: 3,
    habit: { id: 'cross', label: '邊線拉開', tempoJitter: 0.1 },
    style: {
      straight: 0.15,
      cross: 0.5,
      drop: 0.2,
      body: 0.15,
      fakeRate: 0.18,
      speedMul: 1.0,
      spawnMul: 1.0,
      defense: 0.42,
      coverLeft: 0.62,
      coverCenter: 0.4,
      coverRight: 0.62,
      aimSpread: 16,
    },
  },
  {
    id: 'gui',
    name: '假動作阿鬼',
    tagline: '騙招專家・切吊混打',
    catchphrase: '看你還信不信眼睛！',
    unlockWins: 2,
    pointsToWin: 5,
    bestOf: 3,
    habit: { id: 'fake', label: '假動作連發', tempoJitter: 0.18 },
    style: {
      straight: 0.18,
      cross: 0.22,
      drop: 0.3,
      body: 0.3,
      fakeRate: 0.42,
      speedMul: 0.96,
      spawnMul: 0.95,
      defense: 0.4,
      coverLeft: 0.48,
      coverCenter: 0.48,
      coverRight: 0.48,
      aimSpread: 14,
    },
  },
  {
    id: 'coach',
    name: '鐵壁教練',
    tagline: '高壓全能・難騙',
    catchphrase: '防守也要有靈魂。',
    unlockWins: 3,
    pointsToWin: 5,
    bestOf: 3,
    habit: { id: 'wall', label: '鐵壁防守', heavyBias: 0.06 },
    style: {
      straight: 0.28,
      cross: 0.28,
      drop: 0.2,
      body: 0.24,
      fakeRate: 0.28,
      speedMul: 1.18,
      spawnMul: 0.85,
      defense: 0.72,
      coverLeft: 0.7,
      coverCenter: 0.75,
      coverRight: 0.7,
      aimSpread: 15,
    },
  },
  {
    id: 'lu',
    name: '節奏阿律',
    tagline: '忽快忽慢・打亂呼吸',
    catchphrase: '跟得上我的拍子嗎？',
    unlockWins: 4,
    pointsToWin: 5,
    bestOf: 3,
    habit: { id: 'tempo', label: '節奏變化', altTempo: true, tempoJitter: 0.35, spawnJitter: 0.4 },
    style: {
      straight: 0.3,
      cross: 0.28,
      drop: 0.22,
      body: 0.2,
      fakeRate: 0.22,
      speedMul: 1.05,
      spawnMul: 1.0,
      defense: 0.48,
      coverLeft: 0.52,
      coverCenter: 0.5,
      coverRight: 0.52,
      aimSpread: 13,
    },
  },
  {
    id: 'bao',
    name: '連殺猛寶',
    tagline: '連續重殺・不給喘息',
    catchphrase: '一球不夠，再來三球！',
    unlockWins: 5,
    pointsToWin: 5,
    bestOf: 3,
    habit: { id: 'burst', label: '連續重殺', burstChance: 0.42, burstLen: 2, heavyBias: 0.2 },
    style: {
      straight: 0.42,
      cross: 0.18,
      drop: 0.08,
      body: 0.32,
      fakeRate: 0.12,
      speedMul: 1.22,
      spawnMul: 0.72,
      defense: 0.45,
      coverLeft: 0.5,
      coverCenter: 0.58,
      coverRight: 0.5,
      aimSpread: 11,
    },
  },
  {
    id: 'min',
    name: '追身小敏',
    tagline: '追身殺專精・貼身壓迫',
    catchphrase: '躲得開嗎？',
    unlockWins: 6,
    pointsToWin: 6,
    bestOf: 3,
    habit: { id: 'body', label: '追身壓迫', heavyBias: 0.05, tempoJitter: 0.12 },
    style: {
      straight: 0.18,
      cross: 0.2,
      drop: 0.12,
      body: 0.5,
      fakeRate: 0.32,
      speedMul: 1.12,
      spawnMul: 0.88,
      defense: 0.55,
      coverLeft: 0.58,
      coverCenter: 0.65,
      coverRight: 0.58,
      aimSpread: 12,
    },
  },
  {
    id: 'king',
    name: '羽球魔王',
    tagline: '全能終關・假動作＋連殺',
    catchphrase: '這裡才是真正的接殺課。',
    unlockWins: 7,
    pointsToWin: 6,
    bestOf: 3,
    habit: {
      id: 'chaos',
      label: '假動作＋連續重殺',
      burstChance: 0.28,
      burstLen: 2,
      tempoJitter: 0.28,
      spawnJitter: 0.25,
      heavyBias: 0.1,
      altTempo: true,
    },
    style: {
      straight: 0.28,
      cross: 0.26,
      drop: 0.2,
      body: 0.26,
      fakeRate: 0.38,
      speedMul: 1.28,
      spawnMul: 0.78,
      defense: 0.78,
      coverLeft: 0.74,
      coverCenter: 0.8,
      coverRight: 0.74,
      aimSpread: 16,
    },
  },
]);

/**
 * @param {string} id
 * @returns {OpponentDef | null}
 */
export function getOpponent(id) {
  return OPPONENTS.find((o) => o.id === id) ?? null;
}

/** Games needed to win a series (best-of-N). */
export function seriesWinsNeeded(bestOf = 3) {
  const n = Math.max(1, Math.floor(bestOf) || 3);
  return Math.ceil(n / 2);
}

/**
 * Ladder unlock: beat N distinct prior opponents (wins recorded elsewhere).
 * @param {Readonly<Record<string, number>>} versusWins  opponentId → win count
 * @param {OpponentDef} opp
 */
export function isOpponentUnlocked(versusWins, opp) {
  if (opp.unlockWins <= 0) return true;
  let beaten = 0;
  for (const o of OPPONENTS) {
    if (o.id === opp.id) break;
    if ((versusWins[o.id] ?? 0) > 0) beaten += 1;
  }
  return beaten >= opp.unlockWins;
}

/**
 * Apply habit heavy-bias to a mix copy.
 * @param {Readonly<Record<SmashTypeId, number>>} mix
 * @param {OpponentHabit | null | undefined} habit
 */
export function biasMixForHabit(mix, habit) {
  const bias = habit?.heavyBias ?? 0;
  if (bias <= 0) return { ...mix };
  const out = {
    straight: mix.straight + bias,
    cross: Math.max(0.02, mix.cross - bias * 0.35),
    drop: Math.max(0.02, mix.drop - bias * 0.35),
    body: mix.body + bias * 0.5,
  };
  return out;
}

/**
 * Choose next smash for an opponent (or drill mix).
 * @param {OpponentStyle | null} style
 * @param {Readonly<Record<SmashTypeId, number>>} fallbackMix
 * @param {() => number} rng
 * @param {{ habit?: OpponentHabit | null, forceBurst?: boolean }} [opts]
 * @returns {{ real: SmashTypeId, tell: SmashTypeId, isFake: boolean }}
 */
export function chooseSmash(style, fallbackMix, rng, opts = {}) {
  const habit = opts.habit ?? null;
  const mix = style
    ? biasMixForHabit(
        {
          straight: style.straight,
          cross: style.cross,
          drop: style.drop,
          body: style.body,
        },
        habit,
      )
    : { ...fallbackMix };

  if (opts.forceBurst) {
    const heavy = rng() < 0.55 ? 'straight' : 'body';
    return { real: heavy, tell: heavy, isFake: false };
  }

  const real = pickSmashType(mix, rng);
  const fakeRate = style?.fakeRate ?? 0;
  if (fakeRate > 0 && rng() < fakeRate) {
    return { real, tell: pickFakeTell(real, rng), isFake: true };
  }
  return { real, tell: real, isFake: false };
}

/**
 * Whether this smash should start / extend a heavy burst streak.
 * @param {OpponentHabit | null | undefined} habit
 * @param {SmashTypeId} real
 * @param {() => number} rng
 */
export function shouldStartBurst(habit, real, rng) {
  if (!habit?.burstChance || habit.burstChance <= 0) return false;
  if (real !== 'straight' && real !== 'body') return false;
  return rng() < habit.burstChance;
}

/** Difficulty knobs layered on top of opponent / drill base. */
export const DIFFICULTY = Object.freeze({
  easy: {
    id: 'easy',
    label: '簡單',
    speedMul: 0.8,
    spawnMul: 1.18,
    aimSpread: 8,
    tierBoost: [0, 40, 80],
    fakeMul: 0.45,
    doubleChance: 0,
    lives: 5,
  },
  normal: {
    id: 'normal',
    label: '普通',
    speedMul: 1,
    spawnMul: 1,
    aimSpread: 12,
    tierBoost: [0, 70, 130],
    fakeMul: 1,
    doubleChance: 0.08,
    lives: 3,
  },
  hard: {
    id: 'hard',
    label: '困難',
    speedMul: 1.2,
    spawnMul: 0.8,
    aimSpread: 17,
    tierBoost: [30, 100, 180],
    fakeMul: 1.35,
    doubleChance: 0.16,
    lives: 3,
  },
});

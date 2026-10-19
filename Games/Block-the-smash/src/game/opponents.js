/**
 * CPU roster: styles differ in smash mix, fake rate, and court cover — not only "faster".
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
 * @typedef {object} OpponentDef
 * @property {string} id
 * @property {string} name
 * @property {string} tagline
 * @property {string} catchphrase
 * @property {number} unlockWins  prior wins needed on ladder
 * @property {OpponentStyle} style
 * @property {number} pointsToWin  first to N
 */

/** @type {readonly OpponentDef[]} */
export const OPPONENTS = Object.freeze([
  {
    id: 'hao',
    name: '閃電阿豪',
    tagline: '直線炸彈・少假動作',
    catchphrase: '接得住這球嗎！',
    unlockWins: 0,
    pointsToWin: 5,
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
    pointsToWin: 6,
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
    pointsToWin: 7,
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
    pointsToWin: 7,
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
]);

/**
 * @param {string} id
 * @returns {OpponentDef | null}
 */
export function getOpponent(id) {
  return OPPONENTS.find((o) => o.id === id) ?? null;
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
 * Choose next smash for an opponent (or drill mix).
 * @param {OpponentStyle | null} style
 * @param {Readonly<Record<SmashTypeId, number>>} fallbackMix
 * @param {() => number} rng
 * @returns {{ real: SmashTypeId, tell: SmashTypeId, isFake: boolean }}
 */
export function chooseSmash(style, fallbackMix, rng) {
  const mix = style
    ? {
        straight: style.straight,
        cross: style.cross,
        drop: style.drop,
        body: style.body,
      }
    : fallbackMix;
  const real = pickSmashType(mix, rng);
  const fakeRate = style?.fakeRate ?? 0;
  if (fakeRate > 0 && rng() < fakeRate) {
    return { real, tell: pickFakeTell(real, rng), isFake: true };
  }
  return { real, tell: real, isFake: false };
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

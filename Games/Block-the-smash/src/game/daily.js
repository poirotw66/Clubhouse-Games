/**
 * Daily challenge: fixed smash/fake script seeded by Taipei calendar date.
 */

import { createRng } from './rng.js';
import { SMASH_TYPE_IDS } from './smashTypes.js';
import { pickFakeTell } from './smashTypes.js';

const TZ_OFFSET_MINUTES = 8 * 60;

/** Default rally length for the daily script. */
export const DAILY_BALL_COUNT = 18;

/**
 * @param {Date} [now]
 * @returns {string} YYYY-MM-DD in Asia/Taipei
 */
export function taipeiDateKey(now = new Date()) {
  const shifted = new Date(now.getTime() + TZ_OFFSET_MINUTES * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * @param {string} key
 */
export function previousTaipeiDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - 1);
  return taipeiDateKey(new Date(date.getTime() - TZ_OFFSET_MINUTES * 60_000));
}

/**
 * @param {string} str
 */
export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * @param {string} dateKey
 */
export function dailySeedCode(dateKey) {
  return `block-the-smash-daily-${dateKey}`;
}

/**
 * @param {string} dateKey
 */
export function dailySeedNumber(dateKey) {
  return hashString(dailySeedCode(dateKey));
}

/**
 * @typedef {object} DailyShot
 * @property {import('./smashTypes.js').SmashTypeId} real
 * @property {import('./smashTypes.js').SmashTypeId} tell
 * @property {boolean} isFake
 * @property {number} sideSign
 */

/**
 * Build a deterministic smash/fake script for the day.
 * @param {string} dateKey
 * @param {number} [count]
 * @returns {DailyShot[]}
 */
export function buildDailyScript(dateKey, count = DAILY_BALL_COUNT) {
  const rng = createRng(dailySeedNumber(dateKey));
  /** @type {DailyShot[]} */
  const shots = [];
  for (let i = 0; i < count; i++) {
    const progress = i / Math.max(1, count - 1);
    // Escalate: early mostly straight/cross; mid adds drop; late more fakes + body.
    const weights = [
      { id: /** @type {const} */ ('straight'), weight: 0.4 - progress * 0.1 },
      { id: /** @type {const} */ ('cross'), weight: 0.28 },
      { id: /** @type {const} */ ('drop'), weight: 0.12 + progress * 0.12 },
      { id: /** @type {const} */ ('body'), weight: 0.2 + progress * 0.1 },
    ];
    let sum = 0;
    for (const w of weights) sum += w.weight;
    let roll = rng() * sum;
    /** @type {import('./smashTypes.js').SmashTypeId} */
    let real = 'straight';
    for (const w of weights) {
      roll -= w.weight;
      if (roll <= 0) {
        real = w.id;
        break;
      }
    }
    const fakeChance = 0.08 + progress * 0.32;
    const isFake = rng() < fakeChance;
    const tell = isFake ? pickFakeTell(real, rng) : real;
    const sideSign = rng() < 0.5 ? -1 : 1;
    shots.push({ real, tell, isFake, sideSign });
  }
  // Sanity: every type id is valid.
  for (const s of shots) {
    if (!SMASH_TYPE_IDS.includes(s.real) || !SMASH_TYPE_IDS.includes(s.tell)) {
      throw new Error('daily script produced invalid smash type');
    }
  }
  return shots;
}

/**
 * Consecutive days with a recorded daily play ending today or yesterday.
 * @param {Readonly<Record<string, number>>} bestByDate  dateKey → best score
 * @param {string} today
 */
export function computeDailyStreak(bestByDate, today) {
  const days = new Set(Object.keys(bestByDate).filter((k) => (bestByDate[k] ?? 0) > 0));
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
 * @param {{
 *   dateKey: string,
 *   score: number,
 *   perfects: number,
 *   accuracy: number,
 *   streak: number,
 * }} opts
 */
export function buildDailyShareText(opts) {
  return [
    `羽毛球接殺 每日 ${opts.dateKey}`,
    `得分 ${opts.score} · 完美 ${opts.perfects} · 命中 ${opts.accuracy}%`,
    `連續 ${opts.streak} 天`,
    'Clubhouse Games',
  ].join('\n');
}

/**
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyText(text) {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    if (typeof document === 'undefined') return false;
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.left = '-9999px';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

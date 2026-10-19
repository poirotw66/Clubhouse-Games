/**
 * Daily challenge — same colors for everyone on the same Asia/Taipei calendar day.
 */

import { hashString } from './rng.mjs';
import { buildTargets, seededRand, DAILY_ROUNDS } from './colors.mjs';

const TZ_OFFSET_MINUTES = 8 * 60;

export function dateKey(now = new Date()) {
  const shifted = new Date(now.getTime() + TZ_OFFSET_MINUTES * 60_000);
  const year = shifted.getUTCFullYear();
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const day = String(shifted.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dailySeedCode(key) {
  return `dialed-color-daily-${key}`;
}

export function dailyBaseSeed(key) {
  return hashString(dailySeedCode(key));
}

function previousDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - 1);
  // Convert the UTC midnight of previous calendar day back through Taipei offset
  // so dateKey stays consistent with dateKey(now).
  return dateKey(new Date(utc.getTime() - TZ_OFFSET_MINUTES * 60_000));
}

/**
 * @param {{ date: string, average: number, scores: number[] }[]} records
 * @param {string} today
 */
export function computeStreak(records, today) {
  const days = new Set(records.map((r) => r.date));
  let cursor = days.has(today) ? today : previousDay(today);
  if (!days.has(cursor)) return 0;
  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = previousDay(cursor);
  }
  return streak;
}

/** @param {string} [key] */
export function dailyTargets(key = dateKey()) {
  const seed = dailyBaseSeed(key);
  const rand = seededRand(seed);
  return buildTargets('daily', rand, { count: DAILY_ROUNDS });
}

export { DAILY_ROUNDS, previousDay };

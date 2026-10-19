/**
 * Wordle-style shareable result text for the daily challenge.
 */

import { scoreEmoji, scoreToAccuracy } from './score.mjs';

/**
 * @param {{
 *   date: string,
 *   scores: number[],
 *   average: number,
 *   streak: number,
 * }} opts
 */
export function buildDailyShareText(opts) {
  const grid = opts.scores.map((s) => scoreEmoji(s)).join('');
  const lines = [
    `色感記憶 每日 ${opts.date}`,
    grid,
    `${opts.average} 分（準確度 ${scoreToAccuracy(opts.average)}%）· 連勝 ${opts.streak} 天`,
  ];
  return lines.join('\n');
}

/**
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to execCommand
  }
  try {
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

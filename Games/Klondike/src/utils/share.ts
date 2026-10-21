/**
 * Wordle-style shareable daily result for Klondike.
 */

import type { DailyRecord } from './daily.ts';
import { scoreLabel, type ScoreMode } from './scoring.ts';
import type { DrawCount } from './gameLogic.ts';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export type DailyShareInput = {
  date: string;
  won: boolean;
  score: number;
  elapsedSec: number;
  moves: number;
  drawCount: DrawCount;
  scoreMode: ScoreMode;
  streak: number;
};

/** Build clipboard text from a daily attempt (today's best when recording wins). */
export function buildDailyShareText(input: DailyShareInput): string {
  const modeLine = `翻 ${input.drawCount} · ${scoreLabel(input.scoreMode)} · 連勝 ${input.streak} 天`;
  const resultLine = input.won
    ? `✓ ${input.score} 分 · ${formatTime(input.elapsedSec)} · ${input.moves} 步`
    : `✗ 未過關 · 本局 ${input.score} 分 · ${input.moves} 步`;
  return [`接龍 每日 ${input.date}`, resultLine, modeLine].join('\n');
}

export function dailyRecordToShare(
  record: DailyRecord,
  streak: number,
): string {
  return buildDailyShareText({ ...record, streak });
}

/** Copy text to clipboard; falls back to execCommand when Clipboard API is blocked. */
export async function copyText(text: string): Promise<boolean> {
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

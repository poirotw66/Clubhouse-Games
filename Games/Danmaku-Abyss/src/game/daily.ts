/**
 * Daily challenge: calendar-day seed code + best-of-day record + share text.
 * Determinism already lives in (seed, inputs); this only picks the seed and
 * stores a local best that never overwrites free-play / mode-pack keys.
 */

export const DAILY_STORAGE_KEY = 'danmaku-abyss:daily-v1';

/** Local calendar day as YYYY-MM-DD (shareable, human-readable). */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Seed code for today's daily run (hashString maps any string stably). */
export function dailySeedCode(now: Date = new Date()): string {
  return `D${todayKey(now).replace(/-/g, '')}`;
}

export interface DailyBestRecord {
  date: string;
  bestScore: number;
  bestStage: number;
  craftId: string;
  captures: number;
  attempts: number;
  /** True if any attempt today reached phase won. */
  cleared: boolean;
}

export const EMPTY_DAILY_BEST: DailyBestRecord = {
  date: '',
  bestScore: 0,
  bestStage: 0,
  craftId: '',
  captures: 0,
  attempts: 0,
  cleared: false,
};

export function mergeDailyBest(
  previous: DailyBestRecord,
  date: string,
  score: number,
  stage: number,
  craftId: string,
  captures: number,
  cleared: boolean,
): DailyBestRecord {
  const scoreFloor = Math.max(0, Math.floor(score));
  const stageFloor = Math.max(0, Math.floor(stage));
  const capsFloor = Math.max(0, Math.floor(captures));
  if (previous.date !== date) {
    return {
      date,
      bestScore: scoreFloor,
      bestStage: stageFloor,
      craftId,
      captures: capsFloor,
      attempts: 1,
      cleared,
    };
  }
  const beat = scoreFloor > previous.bestScore;
  return {
    date,
    bestScore: Math.max(previous.bestScore, scoreFloor),
    bestStage: beat ? stageFloor : Math.max(previous.bestStage, stageFloor),
    craftId: beat ? craftId : previous.craftId,
    captures: beat ? capsFloor : Math.max(previous.captures, capsFloor),
    attempts: previous.attempts + 1,
    cleared: previous.cleared || cleared,
  };
}

export function loadDailyBest(now: Date = new Date()): DailyBestRecord {
  const today = todayKey(now);
  try {
    const raw = localStorage.getItem(DAILY_STORAGE_KEY);
    if (!raw) return { ...EMPTY_DAILY_BEST };
    const parsed = JSON.parse(raw) as Partial<DailyBestRecord>;
    if (typeof parsed.date !== 'string' || parsed.date !== today) {
      return { ...EMPTY_DAILY_BEST, date: today };
    }
    return {
      date: today,
      bestScore: Math.max(0, Math.floor(Number(parsed.bestScore) || 0)),
      bestStage: Math.max(0, Math.floor(Number(parsed.bestStage) || 0)),
      craftId: typeof parsed.craftId === 'string' ? parsed.craftId : '',
      captures: Math.max(0, Math.floor(Number(parsed.captures) || 0)),
      attempts: Math.max(0, Math.floor(Number(parsed.attempts) || 0)),
      cleared: Boolean(parsed.cleared),
    };
  } catch {
    return { ...EMPTY_DAILY_BEST, date: today };
  }
}

export function saveDailyBest(record: DailyBestRecord): void {
  try {
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(record));
  } catch {
    /* ignore quota / private mode */
  }
}

/** Clipboard-friendly share blurb for today's best (or the just-finished run). */
export function buildDailyShareText(input: {
  date: string;
  seedCode: string;
  score: number;
  stage: number;
  endStage: number;
  craftName: string;
  captures: number;
  cleared: boolean;
  attempts?: number;
}): string {
  const result = input.cleared ? '通關' : `止於第 ${input.stage} 階`;
  const lines = [
    `彈幕深淵 每日挑戰 ${input.date}`,
    `${result}・${input.score.toLocaleString('zh-Hant')} 分・${input.craftName}`,
    `階段 ${Math.min(input.stage, input.endStage)}/${input.endStage}・Capture ${input.captures}・種子 ${input.seedCode}`,
  ];
  if (typeof input.attempts === 'number' && input.attempts > 0) {
    lines.push(`今日嘗試 ${input.attempts} 次`);
  }
  return lines.join('\n');
}

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

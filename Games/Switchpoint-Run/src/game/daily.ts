/**
 * Daily seeded run helpers. The calendar day string is itself a valid seed
 * code — hashString already maps any string to a stable 32-bit seed — so the
 * existing deterministic junction stream needs no special path.
 */

/** Local calendar day as YYYYMMDD. */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

/** Seed code for today's daily run (same string the engine hashes). */
export function dailySeedCode(now: Date = new Date()): string {
  return `D${todayKey(now)}`;
}

export interface DailyBestRecord {
  date: string;
  bestDistance: number;
  bestScore: number;
  attempts: number;
}

export const EMPTY_DAILY_BEST: DailyBestRecord = {
  date: '',
  bestDistance: 0,
  bestScore: 0,
  attempts: 0,
};

/** Merge a finished daily attempt into the best-of-day record. */
export function mergeDailyBest(
  previous: DailyBestRecord,
  date: string,
  distance: number,
  score: number,
): DailyBestRecord {
  if (previous.date !== date) {
    return {
      date,
      bestDistance: Math.max(0, Math.floor(distance)),
      bestScore: Math.max(0, Math.floor(score)),
      attempts: 1,
    };
  }
  return {
    date,
    bestDistance: Math.max(previous.bestDistance, Math.floor(distance)),
    bestScore: Math.max(previous.bestScore, Math.floor(score)),
    attempts: previous.attempts + 1,
  };
}

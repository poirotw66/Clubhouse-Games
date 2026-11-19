/**
 * Daily login rewards anchored to Asia/Taipei calendar rollover
 * and idle credit replenishment economy.
 */

export interface DailyLoginTier {
  readonly day: number;
  readonly tokens: number;
  readonly bonusCredits: number;
  readonly label: string;
}

/** 7-day rolling login reward progression ladder. */
export const DAILY_LOGIN_LADDER: readonly DailyLoginTier[] = [
  { day: 1, tokens: 10, bonusCredits: 20, label: '第 1 天：起步補給' },
  { day: 2, tokens: 15, bonusCredits: 25, label: '第 2 天：穩健續航' },
  { day: 3, tokens: 20, bonusCredits: 30, label: '第 3 天：潮湧漸起' },
  { day: 4, tokens: 25, bonusCredits: 35, label: '第 4 天：中流砥柱' },
  { day: 5, tokens: 35, bonusCredits: 45, label: '第 5 天：狂潮先驅' },
  { day: 6, tokens: 45, bonusCredits: 60, label: '第 6 天：黃金前夕' },
  { day: 7, tokens: 70, bonusCredits: 100, label: '第 7 天：七日大滿貫' },
];

/** Seconds required of idle or offline time to replenish 1 credit. */
export const IDLE_REPLENISH_INTERVAL_SEC = 90;

/** Default ceiling on credits accumulated through idle replenishment. */
export const IDLE_REPLENISH_MAX_CAP = 80;

/**
 * Returns YYYY-MM-DD anchored specifically to Asia/Taipei (UTC+8) wall clock.
 */
export function todayDateKeyTaipei(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Checks whether `nextDateKey` is strictly the consecutive calendar day after `prevDateKey`
 * in the Asia/Taipei (UTC+8) timezone.
 */
export function isConsecutiveTaipeiDay(prevDateKey: string, nextDateKey: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(prevDateKey) || !/^\d{4}-\d{2}-\d{2}$/.test(nextDateKey)) {
    return false;
  }
  const [py, pm, pd] = prevDateKey.split('-').map(Number);
  const prevDate = new Date(Date.UTC(py!, pm! - 1, pd!));
  // Add 1 calendar day in UTC
  prevDate.setUTCDate(prevDate.getUTCDate() + 1);

  const ey = prevDate.getUTCFullYear();
  const em = String(prevDate.getUTCMonth() + 1).padStart(2, '0');
  const ed = String(prevDate.getUTCDate()).padStart(2, '0');
  const expectedKey = `${ey}-${em}-${ed}`;

  return expectedKey === nextDateKey;
}

export interface LoginClaimResult {
  readonly eligible: boolean;
  readonly newStreak: number;
  readonly reward: DailyLoginTier | null;
  readonly isConsecutive: boolean;
  readonly alreadyClaimedToday: boolean;
}

/**
 * Evaluates a daily login claim against the Asia/Taipei calendar.
 */
export function evaluateTaipeiLoginReward(
  lastClaimDateKey: string | null,
  todayTaipeiKey: string,
  currentStreak: number,
): LoginClaimResult {
  if (lastClaimDateKey === todayTaipeiKey) {
    return {
      eligible: false,
      newStreak: currentStreak,
      reward: null,
      isConsecutive: true,
      alreadyClaimedToday: true,
    };
  }

  let isConsecutive = false;
  let newStreak = 1;

  if (lastClaimDateKey && isConsecutiveTaipeiDay(lastClaimDateKey, todayTaipeiKey)) {
    isConsecutive = true;
    newStreak = currentStreak >= 7 ? 1 : currentStreak + 1;
  }

  const tierIndex = Math.min(DAILY_LOGIN_LADDER.length - 1, Math.max(0, newStreak - 1));
  const reward = DAILY_LOGIN_LADDER[tierIndex]!;

  return {
    eligible: true,
    newStreak,
    reward,
    isConsecutive,
    alreadyClaimedToday: false,
  };
}

export interface IdleReplenishParams {
  readonly lastActiveTimestampMs: number;
  readonly currentTimestampMs: number;
  readonly currentCredits: number;
  readonly cap?: number;
  readonly intervalSec?: number;
}

export interface IdleReplenishResult {
  readonly replenishedCredits: number;
  readonly finalCredits: number;
  readonly elapsedSec: number;
  readonly secondsUntilNextCredit: number;
  readonly reachedCap: boolean;
}

/**
 * Calculates deterministic idle credit replenishment for offline or idle elapsed time.
 * Invariant: currentCredits + replenishedCredits never exceeds cap.
 */
export function calculateIdleReplenishment(params: IdleReplenishParams): IdleReplenishResult {
  const cap = params.cap ?? IDLE_REPLENISH_MAX_CAP;
  const intervalSec = params.intervalSec ?? IDLE_REPLENISH_INTERVAL_SEC;

  const rawElapsedMs = Math.max(0, params.currentTimestampMs - params.lastActiveTimestampMs);
  const elapsedSec = Math.floor(rawElapsedMs / 1000);

  if (params.currentCredits >= cap || elapsedSec <= 0) {
    return {
      replenishedCredits: 0,
      finalCredits: params.currentCredits,
      elapsedSec,
      secondsUntilNextCredit: intervalSec,
      reachedCap: params.currentCredits >= cap,
    };
  }

  const possibleGains = Math.floor(elapsedSec / intervalSec);
  const headroom = Math.max(0, cap - params.currentCredits);
  const replenishedCredits = Math.min(possibleGains, headroom);
  const finalCredits = params.currentCredits + replenishedCredits;
  const remainderSec = elapsedSec % intervalSec;
  const secondsUntilNextCredit = finalCredits >= cap ? 0 : intervalSec - remainderSec;

  return {
    replenishedCredits,
    finalCredits,
    elapsedSec,
    secondsUntilNextCredit,
    reachedCap: finalCredits >= cap,
  };
}

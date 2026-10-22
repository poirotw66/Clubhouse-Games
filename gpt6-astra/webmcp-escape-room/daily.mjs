/**
 * Taipei-timezone daily challenge helpers for WebMCP Escape Room.
 * Pure: no DOM. Used by rules, engine, UI, and check-escape-room.
 */

export const TAIPEI_TZ = "Asia/Taipei";

/**
 * Calendar date in Asia/Taipei as YYYY-MM-DD.
 * @param {Date|number} [now]
 */
export function taipeiDateKey(now = Date.now()) {
  const d = new Date(now);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TAIPEI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Deterministic daily seed string for a pack. */
export function dailySeedFor(dateKey, packId = "facility") {
  return `daily-${dateKey}-${packId}`;
}

/**
 * Consecutive-day streak update when clearing today's daily.
 * @param {{ lastDailyClearDate: string|null, dailyStreak: number }} meta
 * @param {string} dateKey
 */
export function nextDailyStreak(meta, dateKey) {
  const last = meta.lastDailyClearDate || null;
  if (last === dateKey) {
    return { dailyStreak: meta.dailyStreak || 0, lastDailyClearDate: dateKey };
  }
  const prev = previousTaipeiDateKey(dateKey);
  if (last === prev) {
    return { dailyStreak: (meta.dailyStreak || 0) + 1, lastDailyClearDate: dateKey };
  }
  return { dailyStreak: 1, lastDailyClearDate: dateKey };
}

/** Previous calendar day for a YYYY-MM-DD key (Taipei civil date arithmetic). */
export function previousTaipeiDateKey(dateKey) {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d, 12, 0, 0);
  const prev = new Date(utc - 24 * 60 * 60 * 1000);
  const y2 = prev.getUTCFullYear();
  const m2 = String(prev.getUTCMonth() + 1).padStart(2, "0");
  const d2 = String(prev.getUTCDate()).padStart(2, "0");
  return `${y2}-${m2}-${d2}`;
}

/**
 * Copy-paste share blurb for a finished (or best-of-day) run.
 */
export function formatShareText({
  dateKey,
  packId,
  packTitle,
  elapsedLabel,
  streak,
  noHints,
  endingTitle,
  rating,
  isDaily,
}) {
  const mode = isDaily ? `Daily ${dateKey}` : "Custom run";
  const hintBadge = noHints ? " · No-Hint ✓" : "";
  const streakBit = isDaily && streak > 0 ? ` · streak ${streak}` : "";
  return `WebMCP Escape Room · ${packTitle || packId} · ${mode} · ${elapsedLabel}${streakBit}${hintBadge} · ${endingTitle || "escape"} · ${rating || "—"}`;
}

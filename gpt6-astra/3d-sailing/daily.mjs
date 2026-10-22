/**
 * Asia/Taipei daily ghost challenge for Windward.
 * Pure logic — no DOM / Three.js.
 */

import {
  COURSES,
  formatTimePrecise,
  getCourse,
  sampleWind,
} from './rules.mjs';

export const TAIPEI_TZ = 'Asia/Taipei';
export const STORAGE_DAILY = 'windward-daily-v1';
export const STORAGE_DAILY_GHOSTS = 'windward-daily-ghosts-v1';

/**
 * @typedef {{ bestTime: number|null, courseId: string, collisions: number|null }} DailyEntry
 * @typedef {{ streak: number, lastPlayedDate: string|null, byDate: Record<string, DailyEntry> }} DailyProgress
 * @typedef {{ courseId: string, dateKey: string, wind: import('./rules.mjs').CourseDef['wind'], blurb: string, timeLimit: number }} DailyChallenge
 */

/**
 * Calendar date in Asia/Taipei as YYYY-MM-DD.
 * @param {Date|number} [now]
 */
export function taipeiDateKey(now = Date.now()) {
  const d = new Date(now);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TAIPEI_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Previous civil day for a YYYY-MM-DD key. */
export function previousTaipeiDateKey(dateKey) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d, 12, 0, 0);
  const prev = new Date(utc - 24 * 60 * 60 * 1000);
  const y2 = prev.getUTCFullYear();
  const m2 = String(prev.getUTCMonth() + 1).padStart(2, '0');
  const d2 = String(prev.getUTCDate()).padStart(2, '0');
  return `${y2}-${m2}-${d2}`;
}

export function seedFromString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1000003 || 1;
}

/** @returns {DailyProgress} */
export function defaultDailyProgress() {
  return { streak: 0, lastPlayedDate: null, byDate: {} };
}

function asFinitePositive(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

function asNonNegInt(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
}

/** @returns {DailyProgress} */
export function loadDailyProgress(storage = globalThis.localStorage) {
  const base = defaultDailyProgress();
  if (!storage) return base;
  try {
    const raw = storage.getItem(STORAGE_DAILY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;
    /** @type {Record<string, DailyEntry>} */
    const byDate = {};
    if (parsed.byDate && typeof parsed.byDate === 'object') {
      for (const [key, entry] of Object.entries(parsed.byDate)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) continue;
        if (!entry || typeof entry !== 'object') continue;
        const courseId = typeof entry.courseId === 'string' ? entry.courseId : COURSES[0].id;
        byDate[key] = {
          bestTime: asFinitePositive(entry.bestTime),
          courseId,
          collisions: asNonNegInt(entry.collisions),
        };
      }
    }
    return {
      streak:
        typeof parsed.streak === 'number' && parsed.streak >= 0
          ? Math.floor(parsed.streak)
          : 0,
      lastPlayedDate:
        typeof parsed.lastPlayedDate === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(parsed.lastPlayedDate)
          ? parsed.lastPlayedDate
          : null,
      byDate,
    };
  } catch {
    return base;
  }
}

/** @param {DailyProgress} daily */
export function saveDailyProgress(daily, storage = globalThis.localStorage) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_DAILY, JSON.stringify(daily));
  } catch {
    /* private mode */
  }
}

/**
 * Deterministic daily course + wind for a Taipei date key.
 * @param {string} [dateKey]
 * @returns {DailyChallenge}
 */
export function getDailyChallenge(dateKey = taipeiDateKey()) {
  const seed = seedFromString(`windward-daily:${dateKey}`);
  const course = COURSES[seed % COURSES.length];
  const base = course.wind;
  const headingJitter = ((seed % 17) - 8) * 0.035;
  const baseHeading = Math.atan2(base.dirX, -base.dirZ) + headingJitter;
  const dirX = Math.sin(baseHeading);
  const dirZ = -Math.cos(baseHeading);
  const gustBoost = 1 + ((seed % 5) - 2) * 0.03;
  const wind = {
    dirX,
    dirZ,
    baseSpeed: Math.max(0.85, base.baseSpeed * gustBoost),
    gustAmp: Math.min(0.28, base.gustAmp + (seed % 3) * 0.02),
    gustRate: base.gustRate * (1 + ((seed % 4) - 1.5) * 0.04),
    shiftAmp: Math.min(0.35, base.shiftAmp + (seed % 4) * 0.02),
    shiftRate: Math.max(0.05, base.shiftRate + (seed % 3) * 0.01),
  };
  // Sanity: sample once so malformed wind fails early in checks.
  sampleWind(wind, 0);
  const timeTrim = (seed % 7) - 3;
  return {
    courseId: course.id,
    dateKey,
    wind,
    blurb: `每日幽靈賽 · ${course.name} · 風況種子 ${dateKey}`,
    timeLimit: Math.max(120, Math.min(240, course.timeLimit + timeTrim * 5)),
  };
}

/**
 * Build a playable course object for today's daily (gates/start from base, wind/limit overridden).
 * @param {DailyChallenge} challenge
 */
export function dailyCourseFromChallenge(challenge) {
  const base = getCourse(challenge.courseId);
  return {
    ...base,
    id: `daily:${challenge.dateKey}`,
    name: `每日 · ${base.name}`,
    blurb: challenge.blurb,
    unlockAfter: null,
    timeLimit: challenge.timeLimit,
    wind: challenge.wind,
    gates: base.gates.map((g) => /** @type {[number, number]} */ ([g[0], g[1]])),
  };
}

/**
 * @param {DailyProgress} daily
 * @param {string} dateKey
 * @param {string} courseId
 * @param {number} time
 * @param {number} collisions
 */
export function recordDailyFinish(daily, dateKey, courseId, time, collisions) {
  const next = JSON.parse(JSON.stringify(daily));
  const prev = next.byDate[dateKey];
  const isRecord = !prev || prev.bestTime == null || time < prev.bestTime;
  if (isRecord) {
    next.byDate[dateKey] = {
      bestTime: time,
      courseId,
      collisions,
    };
  } else if (!prev) {
    next.byDate[dateKey] = { bestTime: time, courseId, collisions };
  }

  if (next.lastPlayedDate !== dateKey) {
    const prevDay = previousTaipeiDateKey(dateKey);
    if (next.lastPlayedDate === prevDay) {
      next.streak = (next.streak || 0) + 1;
    } else {
      next.streak = 1;
    }
    next.lastPlayedDate = dateKey;
  }

  saveDailyProgress(next);
  return { daily: next, isRecord };
}

/**
 * @param {DailyProgress} daily
 * @param {string} dateKey
 */
export function formatDailyShareText(daily, dateKey) {
  const entry = daily.byDate[dateKey];
  const challenge = getDailyChallenge(dateKey);
  const course = getCourse(challenge.courseId);
  const best =
    entry?.bestTime != null ? formatTimePrecise(entry.bestTime) : '尚未完賽';
  const streak = daily.streak || 0;
  return [
    `Windward 每日幽靈賽 ${dateKey}`,
    `航線：${course.name}`,
    `今日最佳：${best}`,
    `連續天數：${streak}`,
    '挑戰自己的幽靈船 — Clubhouse Games',
  ].join('\n');
}

function loadAllDailyGhosts(storage = globalThis.localStorage) {
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_DAILY_GHOSTS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveAllDailyGhosts(map, storage = globalThis.localStorage) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_DAILY_GHOSTS, JSON.stringify(map));
  } catch {
    /* private mode */
  }
}

/** @returns {import('./rules.mjs').GhostTape|null} */
export function loadDailyGhost(dateKey, storage = globalThis.localStorage) {
  const tape = loadAllDailyGhosts(storage)[dateKey];
  if (!tape || !Array.isArray(tape.samples) || tape.samples.length < 2) return null;
  if (typeof tape.time !== 'number' || !(tape.time > 0)) return null;
  return tape;
}

/**
 * Keep only the best daily ghost per date; prune older than ~14 days when saving.
 * @param {string} dateKey
 * @param {import('./rules.mjs').GhostSample[]} samples
 * @param {number} time
 */
export function saveDailyGhost(dateKey, samples, time, storage = globalThis.localStorage) {
  if (!samples.length || !(time > 0)) return false;
  const map = loadAllDailyGhosts(storage);
  const prev = map[dateKey];
  if (prev && typeof prev.time === 'number' && prev.time <= time) return false;
  map[dateKey] = {
    time,
    samples: samples.slice(0, 2400).map((s) => ({
      t: s.t,
      x: s.x,
      z: s.z,
      heading: s.heading,
    })),
  };
  // Bound storage: keep recent keys only.
  const keys = Object.keys(map).sort();
  while (keys.length > 16) {
    const drop = keys.shift();
    if (drop) delete map[drop];
  }
  saveAllDailyGhosts(map, storage);
  return true;
}

// Persist unlocks, per-course bests, and regatta records for 海灣帆航.

import { COURSES } from './courses.js';

const KEY = 'sailing-progress-v5';
const BESTS_LEGACY = 'sailing-bests-v4';
const BEST_LEGACY = 'sailing-best-v3';

/** @typedef {{ easy: number|null, pro: number|null }} ModeBests */

/**
 * @typedef {object} Progress
 * @property {{ [courseId: string]: ModeBests }} bests
 * @property {string[]} unlocked
 * @property {number} races
 * @property {{ played: number, wins: number, bestPoints: number|null }} regatta
 */

function emptyBests() {
  /** @type {{ [id: string]: ModeBests }} */
  const bests = {};
  for (const c of COURSES) bests[c.id] = { easy: null, pro: null };
  return bests;
}

/** @returns {Progress} */
export function defaultProgress() {
  return {
    bests: emptyBests(),
    unlocked: ['harbor'],
    races: 0,
    regatta: { played: 0, wins: 0, bestPoints: null },
  };
}

function asFinitePositive(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

function clone(progress) {
  return JSON.parse(JSON.stringify(progress));
}

/** @returns {Progress} */
export function loadProgress() {
  const base = defaultProgress();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const bests = emptyBests();
      if (parsed && typeof parsed === 'object' && parsed.bests) {
        for (const id of Object.keys(bests)) {
          const row = parsed.bests[id];
          if (row && typeof row === 'object') {
            bests[id] = {
              easy: asFinitePositive(row.easy),
              pro: asFinitePositive(row.pro),
            };
          }
        }
      }
      const unlocked = Array.isArray(parsed.unlocked)
        ? parsed.unlocked.filter((id) => typeof id === 'string' && COURSES.some((c) => c.id === id))
        : ['harbor'];
      if (!unlocked.includes('harbor')) unlocked.unshift('harbor');
      const reg = parsed.regatta && typeof parsed.regatta === 'object' ? parsed.regatta : {};
      return {
        bests,
        unlocked: [...new Set(unlocked)],
        races: typeof parsed.races === 'number' && parsed.races >= 0 ? parsed.races : 0,
        regatta: {
          played: typeof reg.played === 'number' ? reg.played : 0,
          wins: typeof reg.wins === 'number' ? reg.wins : 0,
          bestPoints: asFinitePositive(reg.bestPoints),
        },
      };
    }
  } catch {
    /* fall through to migrate */
  }

  // Migrate v4 easy/pro bests into harbor.
  try {
    const raw = localStorage.getItem(BESTS_LEGACY);
    if (raw) {
      const parsed = JSON.parse(raw);
      base.bests.harbor = {
        easy: asFinitePositive(parsed?.easy),
        pro: asFinitePositive(parsed?.pro),
      };
      if (base.bests.harbor.easy || base.bests.harbor.pro) {
        // Finishing the old single course unlocks beat.
        if (!base.unlocked.includes('beat')) base.unlocked.push('beat');
      }
      return base;
    }
  } catch {
    /* ignore */
  }

  const legacy = Number(localStorage.getItem(BEST_LEGACY) || '');
  if (Number.isFinite(legacy) && legacy > 0) {
    base.bests.harbor.easy = legacy;
    if (!base.unlocked.includes('beat')) base.unlocked.push('beat');
  }
  return base;
}

/** @param {Progress} progress */
export function saveProgress(progress) {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    /* private mode */
  }
}

/**
 * @param {Progress} progress
 * @param {string} courseId
 * @param {'easy'|'pro'} mode
 * @param {number} time
 * @returns {{ progress: Progress, isRecord: boolean, unlocked: string[] }}
 */
export function recordFinish(progress, courseId, mode, time) {
  const next = clone(progress);
  if (!next.bests[courseId]) next.bests[courseId] = { easy: null, pro: null };
  const prev = next.bests[courseId][mode];
  const isRecord = prev == null || time < prev;
  if (isRecord) next.bests[courseId][mode] = time;
  next.races += 1;

  const unlocked = [];
  const course = COURSES.find((c) => c.id === courseId);
  // Unlock the next course in the ladder when this one is finished.
  for (const c of COURSES) {
    if (c.unlockAfter === courseId && !next.unlocked.includes(c.id)) {
      next.unlocked.push(c.id);
      unlocked.push(c.id);
    }
  }
  // Also unlock anything whose prerequisite now has any best.
  for (const c of COURSES) {
    if (!c.unlockAfter || next.unlocked.includes(c.id)) continue;
    const pre = next.bests[c.unlockAfter];
    if (pre && (pre.easy != null || pre.pro != null)) {
      next.unlocked.push(c.id);
      unlocked.push(c.id);
    }
  }

  saveProgress(next);
  return { progress: next, isRecord, unlocked: [...new Set(unlocked)] };
}

/**
 * @param {Progress} progress
 * @param {{ points: number, won: boolean }} result
 */
export function recordRegatta(progress, result) {
  const next = clone(progress);
  next.regatta.played += 1;
  if (result.won) next.regatta.wins += 1;
  if (next.regatta.bestPoints == null || result.points > next.regatta.bestPoints) {
    next.regatta.bestPoints = result.points;
  }
  // Completing a regatta unlocks every course.
  for (const c of COURSES) {
    if (!next.unlocked.includes(c.id)) next.unlocked.push(c.id);
  }
  saveProgress(next);
  return next;
}

export function isUnlocked(progress, courseId) {
  return progress.unlocked.includes(courseId);
}

export function bestFor(progress, courseId, mode) {
  return progress.bests[courseId]?.[mode] ?? null;
}

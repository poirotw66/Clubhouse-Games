/**
 * Windward (Astra 3D Sailing) — courses, progress, ghost tapes, gate math.
 * Pure logic so check-sailing.mjs can run in Node without Three.js.
 */

export const STORAGE_PROGRESS = 'windward-progress-v1';
export const STORAGE_GHOSTS = 'windward-ghosts-v1';

const SAMPLE_HZ = 8;
const MAX_SAMPLES = 2400;

/**
 * @typedef {{ x: number, z: number, r: number }} Island
 * @typedef {{
 *   id: string,
 *   name: string,
 *   blurb: string,
 *   unlockAfter: string|null,
 *   unlockStars?: number,
 *   unlockBestUnder?: { courseId: string, time: number },
 *   timeLimit: number,
 *   difficulty: number,
 *   starTimes: [number, number],
 *   collisionPen?: number,
 *   start: { x: number, z: number, heading: number },
 *   wind: { dirX: number, dirZ: number, baseSpeed: number, gustAmp: number, gustRate: number, shiftAmp: number, shiftRate: number },
 *   gates: [number, number][]
 * }} CourseDef
 * @typedef {{ bestTime: number|null, collisions: number|null, stars: number }} CourseBest
 * @typedef {{ bests: Record<string, CourseBest>, unlocked: string[], races: number, clears: number }} Progress
 * @typedef {{ t: number, x: number, z: number, heading: number }} GhostSample
 * @typedef {{ time: number, samples: GhostSample[] }} GhostTape
 */

/** Shared archipelago scenery — gate courses weave through these. */
export const ISLANDS = /** @type {Island[]} */ ([
  { x: -78, z: -72, r: 24 },
  { x: 108, z: 14, r: 30 },
  { x: 298, z: -163, r: 41 },
  { x: -190, z: 95, r: 37 },
  { x: 32, z: 254, r: 43 },
  { x: -184, z: -220, r: 46 },
  { x: 282, z: 207, r: 36 },
  { x: 52, z: -280, r: 33 },
]);

/** @type {CourseDef[]} */
export const COURSES = [
  {
    id: 'archipelago',
    name: '群島巡航',
    blurb: '經典八道門；東南微風，適合熱身與記航線。',
    unlockAfter: null,
    timeLimit: 180,
    difficulty: 1,
    starTimes: [95, 120],
    start: { x: 0, z: 45, heading: 0 },
    wind: {
      dirX: -0.68,
      dirZ: -0.73,
      baseSpeed: 1,
      gustAmp: 0.07,
      gustRate: 0.35,
      shiftAmp: 0,
      shiftRate: 0,
    },
    gates: [
      [0, -45],
      [90, -130],
      [205, -80],
      [220, 70],
      [95, 155],
      [-45, 90],
      [-115, -30],
      [-55, -130],
    ],
  },
  {
    id: 'beam-reach',
    name: '橫風疾航',
    blurb: '偏東風鎖定橫風腿；長直道加速，轉彎要提前收帆。',
    unlockAfter: 'archipelago',
    timeLimit: 165,
    difficulty: 2,
    starTimes: [88, 110],
    start: { x: -20, z: 80, heading: -0.35 },
    wind: {
      dirX: 1,
      dirZ: 0.05,
      baseSpeed: 1.08,
      gustAmp: 0.1,
      gustRate: 0.42,
      shiftAmp: 0.12,
      shiftRate: 0.08,
    },
    gates: [
      [40, 20],
      [130, -40],
      [200, -140],
      [90, -200],
      [-30, -160],
      [-120, -60],
      [-90, 40],
      [10, 100],
    ],
  },
  {
    id: 'gusty-slalom',
    name: '陣風繞島',
    blurb: '陣風與緩移風向；貼島穿門，碰撞代價更高。',
    unlockAfter: 'beam-reach',
    timeLimit: 150,
    difficulty: 3,
    starTimes: [95, 115],
    collisionPen: 6,
    start: { x: 20, z: 60, heading: 0.2 },
    wind: {
      dirX: -0.35,
      dirZ: -0.94,
      baseSpeed: 1.12,
      gustAmp: 0.18,
      gustRate: 0.55,
      shiftAmp: 0.28,
      shiftRate: 0.11,
    },
    gates: [
      [-40, -20],
      [-100, -100],
      [20, -160],
      [140, -90],
      [160, 40],
      [60, 120],
      [-70, 140],
      [-130, 40],
      [-50, -50],
    ],
  },
  {
    id: 'close-hauled',
    name: '迎風折線',
    blurb: '頂風之字形；需要精準轉向，效率掉得很快。',
    unlockAfter: 'gusty-slalom',
    timeLimit: 170,
    difficulty: 3,
    starTimes: [105, 130],
    start: { x: -40, z: 100, heading: 0.55 },
    wind: {
      dirX: 0.12,
      dirZ: -0.99,
      baseSpeed: 0.98,
      gustAmp: 0.08,
      gustRate: 0.3,
      shiftAmp: 0.08,
      shiftRate: 0.06,
    },
    gates: [
      [-10, 20],
      [70, -40],
      [-20, -100],
      [90, -160],
      [160, -80],
      [40, 10],
      [-80, 50],
      [-140, -20],
      [-60, -90],
    ],
  },
  {
    id: 'narrow-channel',
    name: '窄灣穿梭',
    blurb: '門距更近、貼島通道；需星級累積才開鎖。',
    unlockAfter: null,
    unlockStars: 5,
    timeLimit: 155,
    difficulty: 4,
    starTimes: [100, 125],
    collisionPen: 5,
    start: { x: 60, z: -40, heading: -0.9 },
    wind: {
      dirX: -0.92,
      dirZ: 0.38,
      baseSpeed: 1.05,
      gustAmp: 0.14,
      gustRate: 0.48,
      shiftAmp: 0.18,
      shiftRate: 0.1,
    },
    gates: [
      [20, -100],
      [-50, -150],
      [-130, -80],
      [-90, 30],
      [10, 90],
      [110, 50],
      [180, -20],
      [120, -110],
      [40, -180],
    ],
  },
  {
    id: 'tradewind-loop',
    name: '信風環島',
    blurb: '穩定偏南信風、長環線；需在橫風疾航跑進百秒內。',
    unlockAfter: null,
    unlockBestUnder: { courseId: 'beam-reach', time: 100 },
    timeLimit: 200,
    difficulty: 3,
    starTimes: [120, 150],
    start: { x: -60, z: -20, heading: 0.1 },
    wind: {
      dirX: 0.25,
      dirZ: 0.97,
      baseSpeed: 1.15,
      gustAmp: 0.05,
      gustRate: 0.22,
      shiftAmp: 0.05,
      shiftRate: 0.04,
    },
    gates: [
      [30, -90],
      [140, -160],
      [240, -60],
      [200, 80],
      [80, 180],
      [-80, 160],
      [-170, 40],
      [-140, -100],
      [-40, -180],
      [40, -40],
    ],
  },
  {
    id: 'lee-shore',
    name: '下風岸邊',
    blurb: '強順風腿後急轉；門配置偏向南方岸線。',
    unlockAfter: 'close-hauled',
    unlockStars: 8,
    timeLimit: 160,
    difficulty: 4,
    starTimes: [98, 122],
    start: { x: 100, z: 120, heading: 2.4 },
    wind: {
      dirX: -0.55,
      dirZ: 0.84,
      baseSpeed: 1.18,
      gustAmp: 0.16,
      gustRate: 0.5,
      shiftAmp: 0.22,
      shiftRate: 0.09,
    },
    gates: [
      [40, 40],
      [-40, -40],
      [-120, -120],
      [30, -200],
      [160, -140],
      [220, -20],
      [140, 100],
      [20, 160],
      [-80, 80],
    ],
  },
  {
    id: 'typhoon-run',
    name: '颱風前哨',
    blurb: '高陣風、大幅偏轉；星級與完賽時間雙重門檻。',
    unlockAfter: null,
    unlockStars: 14,
    unlockBestUnder: { courseId: 'gusty-slalom', time: 110 },
    timeLimit: 145,
    difficulty: 5,
    starTimes: [90, 115],
    collisionPen: 7,
    start: { x: -30, z: 40, heading: -0.15 },
    wind: {
      dirX: 0.7,
      dirZ: -0.72,
      baseSpeed: 1.22,
      gustAmp: 0.26,
      gustRate: 0.7,
      shiftAmp: 0.34,
      shiftRate: 0.14,
    },
    gates: [
      [50, -50],
      [150, -120],
      [80, -210],
      [-40, -180],
      [-150, -80],
      [-100, 60],
      [20, 140],
      [130, 90],
      [180, -10],
      [60, -80],
    ],
  },
];

export const COURSE_ORDER = COURSES.map((c) => c.id);

export function getCourse(id) {
  return COURSES.find((c) => c.id === id) ?? COURSES[0];
}

export function listCourses() {
  return COURSES.slice();
}

function emptyBests() {
  /** @type {Record<string, CourseBest>} */
  const bests = {};
  for (const c of COURSES) {
    bests[c.id] = { bestTime: null, collisions: null, stars: 0 };
  }
  return bests;
}

/** @returns {Progress} */
export function defaultProgress() {
  return {
    bests: emptyBests(),
    unlocked: ['archipelago'],
    races: 0,
    clears: 0,
  };
}

function asFinitePositive(v) {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

function asNonNegInt(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
}

function asStars(v) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(3, Math.floor(v)));
}

function clone(progress) {
  return JSON.parse(JSON.stringify(progress));
}

/** @returns {Progress} */
export function loadProgress(storage = globalThis.localStorage) {
  const base = defaultProgress();
  if (!storage) return base;
  try {
    const raw = storage.getItem(STORAGE_PROGRESS);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return base;

    const bests = emptyBests();
    if (parsed.bests && typeof parsed.bests === 'object') {
      for (const id of Object.keys(bests)) {
        const row = parsed.bests[id];
        if (row && typeof row === 'object') {
          bests[id] = {
            bestTime: asFinitePositive(row.bestTime),
            collisions: asNonNegInt(row.collisions),
            stars: asStars(row.stars),
          };
          // Migrate: any prior PB implies at least 1★ so unlock ladders keep working.
          if (bests[id].bestTime != null && bests[id].stars < 1) {
            bests[id].stars = 1;
          }
        }
      }
    }

    const unlocked = Array.isArray(parsed.unlocked)
      ? parsed.unlocked.filter(
          (id) => typeof id === 'string' && COURSES.some((c) => c.id === id),
        )
      : ['archipelago'];
    if (!unlocked.includes('archipelago')) unlocked.unshift('archipelago');

    const progress = {
      bests,
      unlocked: [...new Set(unlocked)],
      races: typeof parsed.races === 'number' && parsed.races >= 0 ? parsed.races : 0,
      clears: typeof parsed.clears === 'number' && parsed.clears >= 0 ? parsed.clears : 0,
    };
    // Re-evaluate star / time unlocks against migrated bests.
    applyUnlocks(progress);
    return progress;
  } catch {
    return base;
  }
}

/** @param {Progress} progress */
export function saveProgress(progress, storage = globalThis.localStorage) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_PROGRESS, JSON.stringify(progress));
  } catch {
    /* private mode */
  }
}

export function isUnlocked(progress, courseId) {
  return progress.unlocked.includes(courseId);
}

export function bestFor(progress, courseId) {
  return progress.bests[courseId] ?? { bestTime: null, collisions: null, stars: 0 };
}

export function totalStars(progress) {
  let n = 0;
  for (const id of Object.keys(progress.bests)) {
    n += progress.bests[id]?.stars || 0;
  }
  return n;
}

/**
 * Rate a finish: 3★ under gold + zero collisions, 2★ under silver, else 1★.
 * @param {CourseDef|string} courseOrId
 * @param {number} time
 * @param {number} collisions
 */
export function rateStars(courseOrId, time, collisions) {
  const course = typeof courseOrId === 'string' ? getCourse(courseOrId) : courseOrId;
  const [gold, silver] = course.starTimes || [90, 120];
  if (time <= gold && collisions <= 0) return 3;
  if (time <= silver) return 2;
  return 1;
}

export function starGlyph(stars) {
  const n = Math.max(0, Math.min(3, Math.floor(stars || 0)));
  return '★'.repeat(n) + '☆'.repeat(3 - n);
}

/**
 * Human-readable lock reason when a course is still locked.
 * @param {Progress} progress
 * @param {CourseDef} course
 */
export function unlockHint(progress, course) {
  if (isUnlocked(progress, course.id)) return '';
  /** @type {string[]} */
  const parts = [];
  if (course.unlockAfter) {
    const pre = getCourse(course.unlockAfter);
    if (!bestFor(progress, course.unlockAfter).bestTime) {
      parts.push(`完成「${pre.name}」`);
    }
  }
  if (course.unlockStars != null && totalStars(progress) < course.unlockStars) {
    parts.push(`累積 ${course.unlockStars}★（目前 ${totalStars(progress)}★）`);
  }
  if (course.unlockBestUnder) {
    const { courseId, time } = course.unlockBestUnder;
    const pre = getCourse(courseId);
    const pb = bestFor(progress, courseId).bestTime;
    if (pb == null || pb > time) {
      parts.push(`「${pre.name}」PB ≤ ${formatTimePrecise(time)}`);
    }
  }
  return parts.length ? parts.join(' · ') : '尚未解鎖';
}

/**
 * Mutates progress.unlocked; returns newly unlocked ids.
 * @param {Progress} progress
 * @param {string} [justFinishedId]
 * @returns {string[]}
 */
function applyUnlocks(progress, justFinishedId) {
  /** @type {string[]} */
  const unlocked = [];
  const stars = totalStars(progress);

  for (const c of COURSES) {
    if (progress.unlocked.includes(c.id)) continue;

    let ok = true;
    if (c.unlockAfter) {
      const viaFinish = justFinishedId === c.unlockAfter;
      const viaBest = bestFor(progress, c.unlockAfter).bestTime != null;
      if (!viaFinish && !viaBest) ok = false;
    }
    if (ok && c.unlockStars != null && stars < c.unlockStars) ok = false;
    if (ok && c.unlockBestUnder) {
      const pb = bestFor(progress, c.unlockBestUnder.courseId).bestTime;
      if (pb == null || pb > c.unlockBestUnder.time) ok = false;
    }
    // Courses with no unlockAfter / unlockStars / unlockBestUnder stay locked
    // unless they are the starter (archipelago already unlocked).
    if (
      ok &&
      c.unlockAfter == null &&
      c.unlockStars == null &&
      c.unlockBestUnder == null &&
      c.id !== 'archipelago'
    ) {
      ok = false;
    }

    if (ok) {
      progress.unlocked.push(c.id);
      unlocked.push(c.id);
    }
  }
  return unlocked;
}

/**
 * @param {Progress} progress
 * @param {string} courseId
 * @param {number} time
 * @param {number} collisions
 */
export function recordFinish(progress, courseId, time, collisions) {
  const next = clone(progress);
  if (!next.bests[courseId]) {
    next.bests[courseId] = { bestTime: null, collisions: null, stars: 0 };
  }
  const prev = next.bests[courseId].bestTime;
  const isRecord = prev == null || time < prev;
  if (isRecord) {
    next.bests[courseId].bestTime = time;
    next.bests[courseId].collisions = collisions;
  }
  const earned = rateStars(courseId, time, collisions);
  if (earned > (next.bests[courseId].stars || 0)) {
    next.bests[courseId].stars = earned;
  }
  next.races += 1;
  next.clears += 1;

  const unlocked = applyUnlocks(next, courseId);

  saveProgress(next);
  return { progress: next, isRecord, unlocked: [...new Set(unlocked)], starsEarned: earned };
}

/** @param {Progress} progress */
export function recordDnf(progress) {
  const next = clone(progress);
  next.races += 1;
  saveProgress(next);
  return next;
}

export function formatTime(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function formatTimePrecise(seconds) {
  if (!(seconds >= 0) || !Number.isFinite(seconds)) return '—';
  const m = Math.floor(seconds / 60);
  const rest = seconds - m * 60;
  return `${m}:${rest.toFixed(2).padStart(5, '0')}`;
}

/**
 * Gate counts when the segment before→after crosses the buoy line.
 * @param {{ x: number, z: number }} before
 * @param {{ x: number, z: number }} after
 * @param {[number, number][]} course
 * @param {number} index
 * @param {{ x: number, z: number }} startPose
 * @param {number} [halfWidth]
 */
export function crossedGate(before, after, course, index, startPose, halfWidth = 9.2) {
  const center = course[index];
  const prev = index ? course[index - 1] : [startPose.x, startPose.z];
  let nx = center[0] - prev[0];
  let nz = center[1] - prev[1];
  const len = Math.hypot(nx, nz);
  if (len < 1e-6) return false;
  nx /= len;
  nz /= len;
  const a = (before.x - center[0]) * nx + (before.z - center[1]) * nz;
  const b = (after.x - center[0]) * nx + (after.z - center[1]) * nz;
  if (a === b || a * b > 0) return false;
  const t = a / (a - b);
  if (t < 0 || t > 1) return false;
  const x = before.x + (after.x - before.x) * t - center[0];
  const z = before.z + (after.z - before.z) * t - center[1];
  return Math.abs(x * -nz + z * nx) < halfWidth;
}

/**
 * Instantaneous wind heading (atan2 style matching the game) + gust factor.
 * @param {CourseDef['wind']} profile
 * @param {number} t
 */
export function sampleWind(profile, t) {
  const shift = profile.shiftAmp
    ? Math.sin(t * profile.shiftRate) * profile.shiftAmp
    : 0;
  const baseHeading = Math.atan2(profile.dirX, -profile.dirZ) + shift;
  const dirX = Math.sin(baseHeading);
  const dirZ = -Math.cos(baseHeading);
  const gust =
    1 +
    Math.sin(t * profile.gustRate) * profile.gustAmp +
    Math.sin(t * profile.gustRate * 2.3) * profile.gustAmp * 0.35;
  return {
    dirX,
    dirZ,
    heading: baseHeading,
    gust: Math.max(0.75, gust) * profile.baseSpeed,
  };
}

/** Collision time penalty seconds (gusty / hard courses bite harder). */
export function collisionPenalty(courseId) {
  const course = COURSES.find((c) => c.id === courseId);
  if (course?.collisionPen != null) return course.collisionPen;
  return courseId === 'gusty-slalom' ? 6 : 4;
}

// ——— Ghost tapes ———

function loadAllGhosts(storage = globalThis.localStorage) {
  if (!storage) return {};
  try {
    const raw = storage.getItem(STORAGE_GHOSTS);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveAllGhosts(map, storage = globalThis.localStorage) {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_GHOSTS, JSON.stringify(map));
  } catch {
    /* private mode */
  }
}

/** @returns {GhostTape|null} */
export function loadGhost(courseId, storage = globalThis.localStorage) {
  const tape = loadAllGhosts(storage)[courseId];
  if (!tape || !Array.isArray(tape.samples) || tape.samples.length < 2) return null;
  if (typeof tape.time !== 'number' || !(tape.time > 0)) return null;
  return tape;
}

/**
 * @param {string} courseId
 * @param {GhostSample[]} samples
 * @param {number} time
 */
export function saveGhost(courseId, samples, time, storage = globalThis.localStorage) {
  if (!samples.length || !(time > 0)) return false;
  const map = loadAllGhosts(storage);
  const prev = map[courseId];
  if (prev && typeof prev.time === 'number' && prev.time <= time) return false;
  map[courseId] = {
    time,
    samples: samples.slice(0, MAX_SAMPLES).map((s) => ({
      t: s.t,
      x: s.x,
      z: s.z,
      heading: s.heading,
    })),
  };
  saveAllGhosts(map, storage);
  return true;
}

export function createGhostRecorder() {
  /** @type {GhostSample[]} */
  const samples = [];
  let acc = 0;

  return {
    reset() {
      samples.length = 0;
      acc = 0;
    },
    /**
     * @param {number} dt
     * @param {number} raceTime
     * @param {{ x: number, z: number, heading: number }} boat
     */
    push(dt, raceTime, boat) {
      acc += dt;
      if (acc < 1 / SAMPLE_HZ && samples.length > 0) return;
      acc = 0;
      samples.push({
        t: raceTime,
        x: boat.x,
        z: boat.z,
        heading: boat.heading,
      });
      if (samples.length > MAX_SAMPLES) samples.shift();
    },
    samples() {
      return samples.slice();
    },
  };
}

/** @param {GhostTape} tape */
export function createGhostPlayback(tape) {
  let index = 0;

  return {
    get time() {
      return tape.time;
    },
    reset() {
      index = 0;
    },
    /**
     * @param {number} t
     * @returns {{ x: number, z: number, heading: number, done: boolean }}
     */
    sample(t) {
      const samples = tape.samples;
      if (!samples.length) {
        return { x: 0, z: 0, heading: 0, done: true };
      }
      while (index < samples.length - 2 && samples[index + 1].t < t) index += 1;
      const a = samples[index];
      const b = samples[Math.min(index + 1, samples.length - 1)];
      const span = Math.max(1e-4, b.t - a.t);
      const u = Math.max(0, Math.min(1, (t - a.t) / span));
      const heading =
        a.heading +
        Math.atan2(Math.sin(b.heading - a.heading), Math.cos(b.heading - a.heading)) * u;
      return {
        x: a.x + (b.x - a.x) * u,
        z: a.z + (b.z - a.z) * u,
        heading,
        done: t >= tape.time,
      };
    },
  };
}

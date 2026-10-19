// Time-trial ghost: record a personal-best path and play it back.

const KEY = 'sailing-ghosts-v1';
const SAMPLE_HZ = 8;
const MAX_SAMPLES = 2400;

/**
 * @typedef {{ t: number, x: number, z: number, heading: number, trim: number, side: number }} GhostSample
 * @typedef {{ time: number, samples: GhostSample[] }} GhostTape
 */

/** @returns {{ [key: string]: GhostTape }} */
function loadAll() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveAll(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* private mode */
  }
}

function tapeKey(courseId, mode) {
  return `${courseId}:${mode}`;
}

/**
 * @param {string} courseId
 * @param {'easy'|'pro'} mode
 * @returns {GhostTape|null}
 */
export function loadGhost(courseId, mode) {
  const tape = loadAll()[tapeKey(courseId, mode)];
  if (!tape || !Array.isArray(tape.samples) || tape.samples.length < 2) return null;
  if (typeof tape.time !== 'number' || !(tape.time > 0)) return null;
  return tape;
}

/**
 * @param {string} courseId
 * @param {'easy'|'pro'} mode
 * @param {GhostSample[]} samples
 * @param {number} time
 */
export function saveGhost(courseId, mode, samples, time) {
  if (!samples.length || !(time > 0)) return;
  const map = loadAll();
  const key = tapeKey(courseId, mode);
  const prev = map[key];
  if (prev && typeof prev.time === 'number' && prev.time <= time) return;
  map[key] = {
    time,
    samples: samples.slice(0, MAX_SAMPLES).map((s) => ({
      t: s.t,
      x: s.x,
      z: s.z,
      heading: s.heading,
      trim: s.trim,
      side: s.side,
    })),
  };
  saveAll(map);
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
    /** @param {number} dt @param {number} raceTime @param {object} boat */
    push(dt, raceTime, boat) {
      acc += dt;
      if (acc < 1 / SAMPLE_HZ && samples.length > 0) return;
      acc = 0;
      samples.push({
        t: raceTime,
        x: boat.x,
        z: boat.z,
        heading: boat.heading,
        trim: boat.trim,
        side: boat.side,
      });
      if (samples.length > MAX_SAMPLES) samples.shift();
    },
    samples() {
      return samples.slice();
    },
  };
}

/**
 * @param {GhostTape} tape
 */
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
     * Sample pose at race time `t`.
     * @returns {{ x: number, z: number, heading: number, trim: number, side: number, done: boolean }}
     */
    sample(t) {
      const samples = tape.samples;
      if (!samples.length) {
        return { x: 0, z: 0, heading: 0, trim: 0.7, side: 1, done: true };
      }
      while (index < samples.length - 2 && samples[index + 1].t < t) index += 1;
      const a = samples[index];
      const b = samples[Math.min(index + 1, samples.length - 1)];
      const span = Math.max(1e-4, b.t - a.t);
      const u = Math.max(0, Math.min(1, (t - a.t) / span));
      const heading = a.heading + Math.atan2(
        Math.sin(b.heading - a.heading),
        Math.cos(b.heading - a.heading)
      ) * u;
      return {
        x: a.x + (b.x - a.x) * u,
        z: a.z + (b.z - a.z) * u,
        heading,
        trim: a.trim + (b.trim - a.trim) * u,
        side: u < 0.5 ? a.side : b.side,
        done: t >= tape.time,
      };
    },
  };
}

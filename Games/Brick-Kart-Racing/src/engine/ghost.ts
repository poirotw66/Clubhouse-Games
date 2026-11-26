/** Time-trial ghost recording / playback (best-lap path). */

import {indexDelta, nearestIndex, type Centerline} from './spline.ts';

export interface GhostSample {
  t: number;
  x: number;
  y: number;
  angle: number;
}

export interface GhostLap {
  trackId: string;
  mirror: boolean;
  /** Lap duration in seconds. */
  duration: number;
  samples: GhostSample[];
}

export const GHOST_SAMPLE_HZ = 12.5;
export const GHOST_SAMPLE_DT = 1 / GHOST_SAMPLE_HZ;
/** Cap samples so a pathological lap cannot blow localStorage. */
export const GHOST_MAX_SAMPLES = 900;

export function ghostStorageKey(trackId: string, mirror: boolean): string {
  return mirror ? `${trackId}:tt:mir` : `${trackId}:tt`;
}

/** Keep a running buffer of pose samples while racing. */
export class GhostRecorder {
  private samples: GhostSample[] = [];
  private accum = 0;
  private started = false;

  reset(): void {
    this.samples = [];
    this.accum = 0;
    this.started = false;
  }

  /** Call once racing begins (after countdown). */
  begin(): void {
    this.started = true;
    this.samples = [];
    this.accum = 0;
  }

  sample(raceTime: number, x: number, y: number, angle: number, dt: number): void {
    if (!this.started) return;
    this.accum += dt;
    if (this.samples.length === 0) {
      this.samples.push({t: raceTime, x, y, angle});
      this.accum = 0;
      return;
    }
    if (this.accum < GHOST_SAMPLE_DT) return;
    this.accum = 0;
    if (this.samples.length >= GHOST_MAX_SAMPLES) return;
    this.samples.push({t: raceTime, x, y, angle});
  }

  /**
   * Slice samples belonging to one finished lap.
   * `lapStart` / `lapEnd` are race-clock times.
   */
  sliceLap(lapStart: number, lapEnd: number): GhostSample[] {
    const duration = lapEnd - lapStart;
    if (duration <= 0.2 || this.samples.length < 2) return [];
    const sliced: GhostSample[] = [];
    for (const s of this.samples) {
      if (s.t < lapStart - 0.02) continue;
      if (s.t > lapEnd + 0.02) break;
      sliced.push({
        t: Math.max(0, s.t - lapStart),
        x: s.x,
        y: s.y,
        angle: s.angle,
      });
    }
    if (sliced.length < 2) return [];
    // Ensure the last sample lands on the lap duration.
    const last = sliced[sliced.length - 1];
    if (last.t < duration) {
      sliced.push({t: duration, x: last.x, y: last.y, angle: last.angle});
    }
    return sliced;
  }

  snapshot(): GhostSample[] {
    return this.samples.slice();
  }
}

export function poseAt(ghost: GhostLap, time: number): GhostSample | null {
  const samples = ghost.samples;
  if (samples.length < 2) return null;
  // Loop the ghost for multi-lap time trials.
  const cycle = ghost.duration > 0 ? ghost.duration : samples[samples.length - 1].t;
  if (cycle <= 0) return null;
  const t = ((time % cycle) + cycle) % cycle;

  let lo = 0;
  let hi = samples.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].t <= t) lo = mid;
    else hi = mid;
  }
  const a = samples[lo];
  const b = samples[Math.min(lo + 1, samples.length - 1)];
  const span = Math.max(1e-4, b.t - a.t);
  const u = Math.max(0, Math.min(1, (t - a.t) / span));
  return {
    t,
    x: a.x + (b.x - a.x) * u,
    y: a.y + (b.y - a.y) * u,
    angle: lerpAngle(a.angle, b.angle, u),
  };
}

function lerpAngle(a: number, b: number, u: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * u;
}

export function parseGhostLap(raw: unknown): GhostLap | null {
  if (!raw || typeof raw !== 'object') return null;
  const g = raw as Partial<GhostLap>;
  if (typeof g.trackId !== 'string' || typeof g.duration !== 'number') return null;
  if (!Array.isArray(g.samples) || g.samples.length < 2) return null;
  if (g.duration <= 0 || g.duration > 600) return null;
  const samples: GhostSample[] = [];
  for (const s of g.samples) {
    if (!s || typeof s !== 'object') continue;
    const t = Number((s as GhostSample).t);
    const x = Number((s as GhostSample).x);
    const y = Number((s as GhostSample).y);
    const angle = Number((s as GhostSample).angle);
    if (![t, x, y, angle].every((n) => Number.isFinite(n))) continue;
    samples.push({t, x, y, angle});
    if (samples.length >= GHOST_MAX_SAMPLES) break;
  }
  if (samples.length < 2) return null;
  return {
    trackId: g.trackId,
    mirror: Boolean(g.mirror),
    duration: g.duration,
    samples,
  };
}

/**
 * Serialize a ghost lap to JSON string for storage or transmission.
 */
export function serializeGhostLap(ghost: GhostLap): string {
  return JSON.stringify(ghost);
}

/**
 * Deserialize and validate a ghost lap from JSON string.
 * Returns null if the JSON is malformed or violates integrity invariants.
 */
export function deserializeGhostLap(raw: string): GhostLap | null {
  try {
    const parsed = JSON.parse(raw);
    return parseGhostLap(parsed);
  } catch {
    return null;
  }
}

interface GhostSplineProgressMap {
  centerlineLength: number;
  progress: number[];
}

const ghostProgressCache = new WeakMap<GhostLap, GhostSplineProgressMap>();

export function getGhostSplineProgress(ghost: GhostLap, line: Centerline): number[] {
  let cached = ghostProgressCache.get(ghost);
  const n = line.points.length;
  if (!cached || cached.centerlineLength !== n) {
    const samples = ghost.samples;
    const progress: number[] = new Array(samples.length);
    let accum = 0;
    let lastIdx = 0;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const idx = nearestIndex(line, s.x, s.y, lastIdx);
      if (i > 0) {
        const delta = indexDelta(lastIdx, idx, n);
        accum += delta;
      } else {
        accum = idx;
      }
      lastIdx = idx;
      progress[i] = accum;
    }
    cached = {centerlineLength: n, progress};
    ghostProgressCache.set(ghost, cached);
  }
  return cached.progress;
}

export function ghostTimeAtProgress(ghost: GhostLap, line: Centerline, lapProgress: number): number {
  const samples = ghost.samples;
  if (samples.length < 2) return 0;
  const n = line.points.length;
  const p = Math.max(0, Math.min(n, ((lapProgress % n) + n) % n));
  const progMap = getGhostSplineProgress(ghost, line);

  const startProg = progMap[0];
  const endProg = progMap[progMap.length - 1];
  const totalProg = Math.max(1, endProg - startProg);

  const targetProg = startProg + (p / n) * totalProg;

  let lo = 0;
  let hi = progMap.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (progMap[mid] <= targetProg) lo = mid;
    else hi = mid;
  }

  const p0 = progMap[lo];
  const p1 = progMap[Math.min(lo + 1, progMap.length - 1)];
  const t0 = samples[lo].t;
  const t1 = samples[Math.min(lo + 1, samples.length - 1)].t;

  const span = Math.max(1e-4, p1 - p0);
  const u = Math.max(0, Math.min(1, (targetProg - p0) / span));
  return t0 + (t1 - t0) * u;
}

export function calculateContinuousGhostDelta(
  ghost: GhostLap,
  line: Centerline,
  playerLapElapsed: number,
  playerProgress: number,
): number {
  const n = line.points.length;
  const lapProgress = ((playerProgress % n) + n) % n;
  const ghostTime = ghostTimeAtProgress(ghost, line, lapProgress);
  return playerLapElapsed - ghostTime;
}


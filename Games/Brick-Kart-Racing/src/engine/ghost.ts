/** Time-trial ghost recording / playback (best-lap path). */

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

export interface Vec2 {
  x: number;
  y: number;
}

/** Catmull-Rom interpolation of the segment p1 → p2. */
function catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x:
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
    y:
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
  };
}

/** Dense sampling of a closed Catmull-Rom loop through `control`. */
function denseLoop(control: Vec2[], perSegment: number): Vec2[] {
  const n = control.length;
  const out: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = control[(i - 1 + n) % n];
    const p1 = control[i];
    const p2 = control[(i + 1) % n];
    const p3 = control[(i + 2) % n];
    for (let s = 0; s < perSegment; s++) {
      out.push(catmullRom(p0, p1, p2, p3, s / perSegment));
    }
  }
  return out;
}

export interface Centerline {
  /** Evenly spaced points around the closed loop. */
  points: Vec2[];
  /** Unit forward vector at each point. */
  tangents: Vec2[];
  /** Unit right-hand normal at each point (world is y-down). */
  normals: Vec2[];
  /** Arc length between consecutive samples. */
  spacing: number;
  length: number;
}

/**
 * Builds an arc-length parameterised centerline so that index arithmetic can be
 * used directly for progress, lap counting and AI look-ahead.
 */
export function buildCenterline(control: Vec2[], sampleCount: number): Centerline {
  const dense = denseLoop(control, 24);
  const n = dense.length;

  const cum: number[] = new Array(n + 1);
  cum[0] = 0;
  for (let i = 0; i < n; i++) {
    const a = dense[i];
    const b = dense[(i + 1) % n];
    cum[i + 1] = cum[i] + Math.hypot(b.x - a.x, b.y - a.y);
  }
  const total = cum[n];
  const spacing = total / sampleCount;

  const points: Vec2[] = new Array(sampleCount);
  let cursor = 0;
  for (let i = 0; i < sampleCount; i++) {
    const target = i * spacing;
    while (cursor < n - 1 && cum[cursor + 1] < target) cursor++;
    const segLen = cum[cursor + 1] - cum[cursor] || 1;
    const t = (target - cum[cursor]) / segLen;
    const a = dense[cursor];
    const b = dense[(cursor + 1) % n];
    points[i] = {x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t};
  }

  const tangents: Vec2[] = new Array(sampleCount);
  const normals: Vec2[] = new Array(sampleCount);
  for (let i = 0; i < sampleCount; i++) {
    const a = points[(i - 1 + sampleCount) % sampleCount];
    const b = points[(i + 1) % sampleCount];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    tangents[i] = {x: dx / len, y: dy / len};
    // Right-hand normal in a y-down space: rotate the tangent 90° clockwise.
    normals[i] = {x: -dy / len, y: dx / len};
  }

  return {points, tangents, normals, spacing, length: total};
}

/** Signed shortest index delta around the closed loop. */
export function indexDelta(from: number, to: number, count: number): number {
  let d = to - from;
  const half = count / 2;
  while (d > half) d -= count;
  while (d < -half) d += count;
  return d;
}

/**
 * Nearest centerline index, searched locally around `hint` so this stays O(1)
 * during the race. Falls back to a full scan when no hint is available.
 */
export function nearestIndex(line: Centerline, x: number, y: number, hint: number): number {
  const n = line.points.length;
  const range = hint < 0 ? n : 32;
  const start = hint < 0 ? 0 : hint - range;
  let best = hint < 0 ? 0 : hint;
  let bestDist = Infinity;
  for (let k = 0; k <= range * 2; k++) {
    const i = (((start + k) % n) + n) % n;
    const p = line.points[i];
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
    if (hint < 0 && k >= n - 1) break;
  }
  return best;
}

/** Signed lateral offset from the centerline (positive = right of travel). */
export function lateralOffset(line: Centerline, idx: number, x: number, y: number): number {
  const p = line.points[idx];
  const nrm = line.normals[idx];
  return (x - p.x) * nrm.x + (y - p.y) * nrm.y;
}

export function pointAt(line: Centerline, idx: number, lateral: number): Vec2 {
  const n = line.points.length;
  const i = (((Math.round(idx) % n) + n) % n);
  const p = line.points[i];
  const nrm = line.normals[i];
  return {x: p.x + nrm.x * lateral, y: p.y + nrm.y * lateral};
}

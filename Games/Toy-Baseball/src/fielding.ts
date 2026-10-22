/**
 * Nine-fielder defense: outcomes from landing spot + whether a fielder arrives in time.
 * Aiming for gaps (swingDir) matters because fielders occupy lanes.
 */

import type { DifficultyConfig } from './difficulty.ts';

export type DefenseAlignment = 'normal' | 'pull' | 'deep';

export type FielderId = 'P' | 'C' | '1B' | '2B' | '3B' | 'SS' | 'LF' | 'CF' | 'RF';

export interface Fielder {
  id: FielderId;
  x: number;
  y: number;
  /** Chase speed in screen units / second. */
  speed: number;
  /** Catch radius once at the spot. */
  reach: number;
}

export type FieldPlay =
  | 'catch'
  | 'groundout'
  | 'single'
  | 'double'
  | 'triple'
  | 'homerun';

export interface FieldOutcome {
  result: string;
  bases: number;
  play: FieldPlay;
  /** Nearest fielder considered for the play (for heat-map juice). */
  fielderId: FielderId | null;
  landingX: number;
  landingY: number;
}

const HOME = { x: 400, y: 450 };
/**
 * Approximate fence distance from home in screen units.
 * Tuned so solid contact can clear; weak liners die on the track.
 */
export const FENCE_DIST = 520;

const BASE_POSITIONS: Record<FielderId, { x: number; y: number; speed: number; reach: number }> = {
  P: { x: 400, y: 255, speed: 145, reach: 28 },
  C: { x: 400, y: 485, speed: 90, reach: 22 },
  '1B': { x: 530, y: 305, speed: 155, reach: 32 },
  '2B': { x: 475, y: 215, speed: 170, reach: 30 },
  '3B': { x: 270, y: 305, speed: 155, reach: 32 },
  SS: { x: 325, y: 215, speed: 175, reach: 30 },
  LF: { x: 195, y: 85, speed: 195, reach: 38 },
  CF: { x: 400, y: 45, speed: 205, reach: 40 },
  RF: { x: 605, y: 85, speed: 195, reach: 38 },
};

export function getFielders(alignment: DefenseAlignment = 'normal'): Fielder[] {
  const ids = Object.keys(BASE_POSITIONS) as FielderId[];
  return ids.map((id) => {
    const base = BASE_POSITIONS[id];
    let { x, y } = base;
    if (alignment === 'pull') {
      // Shift toward pull side (screen left from RH batter = 3B/LF).
      if (id === '3B' || id === 'SS' || id === 'LF') x -= 28;
      if (id === '1B' || id === '2B' || id === 'RF') x -= 18;
      if (id === 'CF') x -= 20;
    } else if (alignment === 'deep') {
      if (id === 'LF' || id === 'CF' || id === 'RF') y -= 28;
      if (id === '2B' || id === 'SS') y -= 12;
    }
    return { id, x, y, speed: base.speed, reach: base.reach };
  });
}

export function distFromHome(x: number, y: number): number {
  return Math.sqrt((x - HOME.x) ** 2 + (y - HOME.y) ** 2);
}

export function isFoulTerritory(x: number, y: number): boolean {
  // Foul when outside the 45° foul lines from home toward outfield (smaller y).
  const dx = x - HOME.x;
  const dy = HOME.y - y; // positive toward outfield
  if (dy < -10) return true; // behind home
  if (x < -20 || x > 820) return true;
  // |dx| > dy means outside the 45° wedge.
  return Math.abs(dx) > dy + 8;
}

export interface FairBallInput {
  landingX: number;
  landingY: number;
  /** Peak height of the batted ball (z). */
  peakZ: number;
  /** Contact quality 0–1. */
  quality: number;
  /** Estimated hang / grounder travel time to landing. */
  flightTime: number;
  alignment?: DefenseAlignment;
  cfg: DifficultyConfig;
  /** Park fence distance override (defaults to FENCE_DIST). */
  fenceDist?: number;
  /** Park gap openness multiplier (defaults to 1). */
  gapMul?: number;
}

/**
 * Resolve a fair ball against live fielders.
 * Gaps between fielders produce hits; early arrival produces outs.
 */
export function resolveFairBall(input: FairBallInput): FieldOutcome {
  const {
    landingX,
    landingY,
    peakZ,
    quality,
    flightTime,
    cfg,
    alignment = 'normal',
    fenceDist = FENCE_DIST,
    gapMul = 1,
  } = input;
  const fielders = getFielders(alignment);
  const dist = distFromHome(landingX, landingY);
  // Loft / hang decides fly vs grounder — quality alone must not force a catch.
  const isFly = peakZ > 85;
  const fence = Math.max(420, fenceDist);

  // Wall clearance with authority → home run.
  if (dist >= fence && quality >= 0.58 && peakZ > 95) {
    return {
      result: '全壘打！',
      bases: 4,
      play: 'homerun',
      fielderId: null,
      landingX,
      landingY,
    };
  }

  // Deep fly that dies at the track / warning track catch.
  if (dist >= fence * 0.92 && quality < 0.58) {
    const cf = fielders.find((f) => f.id === 'CF') ?? null;
    return {
      result: '牆前接殺 (OUT)',
      bases: 0,
      play: 'catch',
      fielderId: cf?.id ?? null,
      landingX,
      landingY,
    };
  }

  const nearest = nearestFielder(fielders, landingX, landingY);
  const travel = Math.hypot(nearest.x - landingX, nearest.y - landingY);
  // Easy defense chases a bit slower so gaps stay readable.
  const chaseMul = cfg.fielderSpeedMul ?? 1;
  const arriveTime = travel / Math.max(40, nearest.speed * chaseMul);
  // Soft contact gives fielders more effective time.
  const effectiveFlight = flightTime * (0.7 + quality * 0.35);
  const openGap = Math.min(1, gapScore(fielders, landingX, landingY) * gapMul);
  // Need a real margin to glove a ball in open grass — gaps stay hits.
  const reachSlack = openGap > 0.55 ? -0.2 : 0.04;
  const canReach = arriveTime <= effectiveFlight + reachSlack;
  // Deep flies expand the glove — center shots near CF should be outs, not free doubles.
  const glovePad = isFly ? (dist > 320 ? 34 : 14) : 7;
  const inGlove = travel <= nearest.reach + glovePad;

  if (isFly && (inGlove || (canReach && openGap < 0.52) || (canReach && dist > 360 && openGap < 0.62))) {
    return {
      result: '接殺出局 (OUT)',
      bases: 0,
      play: 'catch',
      fielderId: nearest.id,
      landingX,
      landingY,
    };
  }

  if (!isFly) {
    // Grounder: infielders cut the lane before the ball clears the dirt.
    const cut = cutOffInfielder(fielders, landingX, landingY);
    if (cut) {
      const cutDist = Math.hypot(cut.x - landingX, cut.y - landingY);
      const cutTime = cutDist / Math.max(40, cut.speed * chaseMul);
      const groundWindow = Math.min(effectiveFlight, dist / 280);
      if (cutTime <= groundWindow * (1.1 - quality * 0.3)) {
        return {
          result: '滾地球出局 (OUT)',
          bases: 0,
          play: 'groundout',
          fielderId: cut.id,
          landingX,
          landingY,
        };
      }
    }
  }

  // Gap / through the infield — depth + quality decide bases.
  // Prefer singles; extras require real carry (no auto-double from gap alone).
  const gapBonus = openGap;
  const effective = dist * (0.42 + quality * 0.62) * (1 + gapBonus * 0.08);

  if (quality < cfg.weakQuality) {
    return {
      result: '軟弱飛球出局 (OUT)',
      bases: 0,
      play: 'catch',
      fielderId: nearest.id,
      landingX,
      landingY,
    };
  }

  if (
    effective >= cfg.tripleMin
    && quality >= 0.8
    && dist > 420
  ) {
    return {
      result: '三壘安打 (3B)',
      bases: 3,
      play: 'triple',
      fielderId: nearest.id,
      landingX,
      landingY,
    };
  }
  // Doubles need solid contact — deep soft liners fall in for singles instead.
  if (effective >= cfg.doubleMin && quality >= 0.62 && dist > 290) {
    return {
      result: '二壘安打 (2B)',
      bases: 2,
      play: 'double',
      fielderId: nearest.id,
      landingX,
      landingY,
    };
  }
  if (
    effective >= cfg.singleMin
    || (gapBonus > 0.38 && quality >= 0.38 && dist > 150)
  ) {
    return {
      result: '一壘安打 (1B)',
      bases: 1,
      play: 'single',
      fielderId: nearest.id,
      landingX,
      landingY,
    };
  }
  if (effective < cfg.outMax || quality < cfg.weakQuality + 0.1) {
    return {
      result: '接殺出局 (OUT)',
      bases: 0,
      play: 'catch',
      fielderId: nearest.id,
      landingX,
      landingY,
    };
  }
  return {
    result: '一壘安打 (1B)',
    bases: 1,
    play: 'single',
    fielderId: nearest.id,
    landingX,
    landingY,
  };
}

function nearestFielder(fielders: Fielder[], x: number, y: number): Fielder {
  let best = fielders[0];
  let bestD = Infinity;
  for (const f of fielders) {
    const d = Math.hypot(f.x - x, f.y - y);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}

function cutOffInfielder(
  fielders: Fielder[],
  landingX: number,
  landingY: number,
): Fielder | null {
  const infield = fielders.filter((f) =>
    f.id === 'P' || f.id === '1B' || f.id === '2B' || f.id === '3B' || f.id === 'SS',
  );
  // Only cut if the ball is still in/near the diamond.
  if (landingY < 120) return null;
  return nearestFielder(infield, landingX, Math.max(landingY, 200));
}

/** 0–1: how open the landing is (far from the two nearest fielders). */
export function gapScore(fielders: Fielder[], x: number, y: number): number {
  const dists = fielders
    .map((f) => Math.hypot(f.x - x, f.y - y))
    .sort((a, b) => a - b);
  const a = dists[0] ?? 0;
  const b = dists[1] ?? a;
  // Typical glove spacing ~80–140; normalize.
  return Math.min(1, (a + b * 0.5) / 220);
}

/** Estimate hang time from launch velocity (arcade). */
export function estimateFlightTime(vz: number, peakHint: number): number {
  const up = Math.max(0.15, vz / 400);
  return Math.min(2.8, 0.35 + up + peakHint / 400);
}

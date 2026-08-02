import { LANE_DAMPING, LANE_SPRING, laneToX } from './constants';

export interface LaneBody {
  x: number;
  vx: number;
  targetLane: number;
}

export function createLaneBody(lane = 1): LaneBody {
  return { x: laneToX(lane), vx: 0, targetLane: lane };
}

/** Critically-ish damped spring toward the target lane center. */
export function stepLaneBody(body: LaneBody, dt: number): void {
  const targetX = laneToX(body.targetLane);
  const ax = (targetX - body.x) * LANE_SPRING - body.vx * LANE_DAMPING;
  body.vx += ax * dt;
  body.x += body.vx * dt;
  // Snap when settled to avoid micro jitter.
  if (Math.abs(targetX - body.x) < 0.002 && Math.abs(body.vx) < 0.02) {
    body.x = targetX;
    body.vx = 0;
  }
}

export function laneBodyRoll(body: LaneBody): number {
  return -body.vx * 0.045;
}

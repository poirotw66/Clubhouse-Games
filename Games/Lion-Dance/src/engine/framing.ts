/**
 * Front three-quarter camera framing (v6.2).
 * Lion sits in the playable band between top HUD and bottom pad;
 * feet ~60–70% screen height, silhouette width ~40–55%.
 */

import * as THREE from 'three';
import { BODY_HEIGHT, BODY_LENGTH, LION_SCALE } from './constants';

/** Approximate upright lion height in world metres (after LION_SCALE). */
export const LION_WORLD_HEIGHT = 4.2 * LION_SCALE;
/** Core silhouette length (nose→tail tip). */
export const LION_WORLD_LENGTH = BODY_LENGTH * 1.55;

/**
 * Desired half-width at the lion — ~2.3 m clear each side of a ~3.3 m body
 * → ~4 m half-span on desk; portrait pulls farther for side margins.
 */
export const HALF_WIDTH = 3.15;
export const HALF_WIDTH_PORTRAIT = 2.3;

export const CAM_FOV = 38;
export const DIST_MIN = 9.2;
export const DIST_MAX = 16;
export const FOLLOW_RATE = 5;
export const DIST_FOLLOW_RATE = 4;

/** NDC margin that must remain clear around the projected AABB. */
export const FRAME_MARGIN_NDC = 0.04;

/** Top of lion AABB must sit at or below this UV (top-left origin). */
export const TOP_SAFE_UV = 0.08;
/** Lion center Y (top-left UV) must stay in this band. */
export const CENTER_Y_MIN = 0.35;
export const CENTER_Y_MAX = 0.6;
/** Target silhouette width band. */
export const WIDTH_FRAC_MIN = 0.35;
export const WIDTH_FRAC_MAX = 0.58;

export interface CameraFrame {
  fov: number;
  distance: number;
  camY: number;
  lookY: number;
  /** Ahead along +X for three-quarter (fraction of distance). */
  aheadFrac: number;
  lookAhead: number;
  /** Extra virtual height (fraction of viewport) reserved for the touch pad. */
  padFrac: number;
}

/** Aspect-adaptive distance so portrait/mobile keeps the lion readable. */
export function computeCameraFrame(aspect: number): CameraFrame {
  const halfW = aspect < 0.8 ? HALF_WIDTH_PORTRAIT : HALF_WIDTH;
  const vFov = (CAM_FOV * Math.PI) / 180;
  const halfV = Math.tan(vFov / 2);
  const halfH = halfV * Math.max(0.35, aspect);
  let distance = halfW / halfH;
  distance = Math.max(DIST_MIN, Math.min(DIST_MAX, distance));

  const hip = BODY_HEIGHT;
  const portrait = aspect < 0.8;
  return {
    fov: CAM_FOV,
    distance,
    // Lower camera + look so the lion sits in the mid playable band
    camY: (portrait ? 1.7 : 1.15) * hip + 0.045 * distance,
    lookY: (portrait ? 0.55 : 0.95) * hip,
    // Portrait: strongly frontal so the long body fits with side gutters
    aheadFrac: aspect < 0.7 ? 1.22 : aspect < 0.9 ? 0.55 : 0.22,
    lookAhead: 0,
    // Desk: light pad clears QWOP without shoving the head into the top crop
    padFrac: portrait ? 0.04 : 0.12,
  };
}

export interface ScreenBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  heightFrac: number;
  widthFrac: number;
}

const _box = new THREE.Box3();
const _v = new THREE.Vector3();
const _corners = Array.from({ length: 8 }, () => new THREE.Vector3());

export function projectObjectBounds(
  object: THREE.Object3D,
  camera: THREE.Camera,
): ScreenBounds {
  object.updateWorldMatrix(true, true);
  _box.setFromObject(object);
  const min = _box.min;
  const max = _box.max;
  const pts = _corners;
  pts[0]!.set(min.x, min.y, min.z);
  pts[1]!.set(min.x, min.y, max.z);
  pts[2]!.set(min.x, max.y, min.z);
  pts[3]!.set(min.x, max.y, max.z);
  pts[4]!.set(max.x, min.y, min.z);
  pts[5]!.set(max.x, min.y, max.z);
  pts[6]!.set(max.x, max.y, min.z);
  pts[7]!.set(max.x, max.y, max.z);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    _v.copy(p).project(camera);
    const x = (_v.x + 1) * 0.5;
    const y = (1 - _v.y) * 0.5;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return {
    minX,
    maxX,
    minY,
    maxY,
    heightFrac: Math.max(0, maxY - minY),
    widthFrac: Math.max(0, maxX - minX),
  };
}

/** Project a world point into viewport UV [0,1] (top-left origin for Y). */
export function projectWorldToUv(
  world: THREE.Vector3,
  camera: THREE.Camera,
): { x: number; y: number; ndcZ: number } {
  _v.copy(world).project(camera);
  return {
    x: (_v.x + 1) * 0.5,
    y: (1 - _v.y) * 0.5,
    ndcZ: _v.z,
  };
}

export interface FrameCheck {
  ok: boolean;
  bounds: ScreenBounds;
  reasons: string[];
}

export function checkLionFramed(bounds: ScreenBounds, margin = FRAME_MARGIN_NDC): FrameCheck {
  const reasons: string[] = [];
  const sideSlop = 0.02;
  if (bounds.minX < -sideSlop) reasons.push(`left ${bounds.minX.toFixed(3)}`);
  if (bounds.maxX > 1 + sideSlop) reasons.push(`right ${bounds.maxX.toFixed(3)}`);
  // Head / horn must stay fully in frame below top HUD band
  if (bounds.minY < TOP_SAFE_UV) reasons.push(`top ${bounds.minY.toFixed(3)}`);
  // Bottom may approach the pad; still keep clear of the very edge
  if (bounds.maxY > 1 - margin * 0.5) reasons.push(`bottom ${bounds.maxY.toFixed(3)}`);
  if (bounds.heightFrac > 0.55) reasons.push(`too tall ${bounds.heightFrac.toFixed(3)}`);
  if (bounds.heightFrac < 0.16) reasons.push(`too short ${bounds.heightFrac.toFixed(3)}`);
  if (bounds.widthFrac < WIDTH_FRAC_MIN) reasons.push(`narrow ${bounds.widthFrac.toFixed(3)}`);
  if (bounds.widthFrac > WIDTH_FRAC_MAX) reasons.push(`wide ${bounds.widthFrac.toFixed(3)}`);
  // Side margins: silhouette must leave clear gutters (not edge-to-edge)
  if (bounds.minX < 0.08) reasons.push(`leftGutter ${bounds.minX.toFixed(3)}`);
  if (bounds.maxX > 0.92) reasons.push(`rightGutter ${bounds.maxX.toFixed(3)}`);
  const centerY = (bounds.minY + bounds.maxY) * 0.5;
  if (centerY < CENTER_Y_MIN || centerY > CENTER_Y_MAX) {
    reasons.push(`centerY ${centerY.toFixed(3)}`);
  }
  return { ok: reasons.length === 0, bounds, reasons };
}

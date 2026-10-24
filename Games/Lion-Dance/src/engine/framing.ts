/**
 * Front three-quarter camera framing (v6 feel).
 * FOV 38°, follow with velocity lead, pad-aware view offset.
 */

import * as THREE from 'three';
import { BODY_HEIGHT, BODY_LENGTH, LION_SCALE } from './constants';

/** Approximate upright lion height in world metres (after LION_SCALE). */
export const LION_WORLD_HEIGHT = 4.2 * LION_SCALE;
/** Core silhouette length (nose→tail tip). */
export const LION_WORLD_LENGTH = BODY_LENGTH * 1.55;

/** Desired half-width at the lion (≈ 0.55 × length). */
export const HALF_WIDTH = Math.max(2.3, LION_WORLD_LENGTH * 0.55);
export const HALF_WIDTH_PORTRAIT = HALF_WIDTH * (1.9 / 2.3);

export const CAM_FOV = 38;
export const DIST_MIN = 7.5;
export const DIST_MAX = 15;
export const FOLLOW_RATE = 5;
export const DIST_FOLLOW_RATE = 4;

/** NDC margin that must remain clear around the projected AABB. */
export const FRAME_MARGIN_NDC = 0.04;

export interface CameraFrame {
  fov: number;
  distance: number;
  camY: number;
  lookY: number;
  /** Ahead along +X for three-quarter (fraction of distance). */
  aheadFrac: number;
  lookAhead: number;
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
  return {
    fov: CAM_FOV,
    distance,
    camY: 1.47 * hip + 0.08 * distance,
    lookY: 0.82 * hip,
    aheadFrac: 0.28,
    lookAhead: 0,
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

export interface FrameCheck {
  ok: boolean;
  bounds: ScreenBounds;
  reasons: string[];
}

export function checkLionFramed(bounds: ScreenBounds, margin = FRAME_MARGIN_NDC): FrameCheck {
  const reasons: string[] = [];
  if (bounds.minX < margin) reasons.push(`left ${bounds.minX.toFixed(3)}`);
  if (bounds.maxX > 1 - margin) reasons.push(`right ${bounds.maxX.toFixed(3)}`);
  if (bounds.minY < margin) reasons.push(`top ${bounds.minY.toFixed(3)}`);
  if (bounds.maxY > 1 - margin) reasons.push(`bottom ${bounds.maxY.toFixed(3)}`);
  if (bounds.heightFrac > 0.72) reasons.push(`too tall ${bounds.heightFrac.toFixed(3)}`);
  return { ok: reasons.length === 0, bounds, reasons };
}

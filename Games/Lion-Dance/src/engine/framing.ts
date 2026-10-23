/**
 * Side-view camera framing helpers (v4).
 * Target: whole lion visible with margin; height ≈ 35–40% of viewport.
 */

import * as THREE from 'three';

/** Approximate upright lion height in world metres (feet→horn). */
export const LION_WORLD_HEIGHT = 4.15;
/** Core silhouette length (nose→tail tip) — longer draped 醒獅 body. */
export const LION_WORLD_LENGTH = 8.8;

/** Desired lion height as fraction of viewport height. */
export const LION_FILL = 0.34;

/** NDC margin that must remain clear around the projected AABB. */
export const FRAME_MARGIN_NDC = 0.04;

export interface CameraFrame {
  fov: number;
  distance: number;
  camY: number;
  lookY: number;
  /** Extra look-ahead along +X so space sits ahead of the lion. */
  lookAhead: number;
}

/** Aspect-adaptive FOV + distance so portrait/mobile does not crop. */
export function computeCameraFrame(aspect: number): CameraFrame {
  let fov = 28;
  if (aspect < 0.7) fov = 48;
  else if (aspect < 0.9) fov = 42;
  else if (aspect < 1.15) fov = 34;
  else if (aspect < 1.45) fov = 30;

  const vFov = (fov * Math.PI) / 180;
  const halfV = Math.tan(vFov / 2);
  // Distance from height fill target
  const distH = LION_WORLD_HEIGHT / LION_FILL / (2 * halfV);
  // Distance from length so the whole lion fits horizontally with margin
  const halfH = halfV * Math.max(0.35, aspect);
  // Portrait is width-limited for a side-on lion — pull back enough for clear
  // side margins (height fill will sit under the desktop band).
  // Longer lion is width-limited — portrait may sit under the desktop height band.
  const widthFill = aspect < 0.7 ? 0.88 : aspect < 1 ? 0.74 : 0.6;
  const distW = LION_WORLD_LENGTH / widthFill / (2 * halfH);
  const distance = Math.max(distH, distW) * (aspect < 0.7 ? 1.06 : aspect < 1 ? 1.08 : 1.04);

  return {
    fov,
    distance,
    camY: LION_WORLD_HEIGHT * 0.46,
    lookY: LION_WORLD_HEIGHT * 0.4,
    // Slight left bias so space sits ahead; keep portrait nearly centred.
    lookAhead: aspect < 0.7 ? 0.05 : aspect < 1 ? 0.25 : 0.55,
  };
}

export interface ScreenBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** Fraction of viewport height occupied by the AABB. */
  heightFrac: number;
  /** Fraction of viewport width occupied by the AABB. */
  widthFrac: number;
}

const _box = new THREE.Box3();
const _v = new THREE.Vector3();
const _corners = Array.from({ length: 8 }, () => new THREE.Vector3());

/** Project object world AABB into NDC [−1,1] and report UV-ish [0,1] bounds. */
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
    const y = (1 - _v.y) * 0.5; // top=0
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

/** Fail if any part of the AABB lacks clear margin inside the viewport. */
export function checkLionFramed(bounds: ScreenBounds, margin = FRAME_MARGIN_NDC): FrameCheck {
  const reasons: string[] = [];
  if (bounds.minX < margin) reasons.push(`left ${bounds.minX.toFixed(3)}`);
  if (bounds.maxX > 1 - margin) reasons.push(`right ${bounds.maxX.toFixed(3)}`);
  if (bounds.minY < margin) reasons.push(`top ${bounds.minY.toFixed(3)}`);
  if (bounds.maxY > 1 - margin) reasons.push(`bottom ${bounds.maxY.toFixed(3)}`);
  // Soft preference: height fill band (allow wider band when fallen)
  if (bounds.heightFrac > 0.62) reasons.push(`too tall ${bounds.heightFrac.toFixed(3)}`);
  return { ok: reasons.length === 0, bounds, reasons };
}

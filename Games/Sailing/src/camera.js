// Chase camera that hangs off the stern and softens pitch/roll so the horizon
// stays readable while the boat heels. Pulls back and widens FOV with speed so
// the water feels like it is rushing past.

import { mat4, damp, clamp } from './math.js';

export function createCamera() {
  const position = new Float32Array([0, 8, 16]);
  const target = new Float32Array([0, 1, 0]);
  const up = new Float32Array([0, 1, 0]);
  const view = mat4.create();
  const proj = mat4.create();
  const viewProj = mat4.create();
  const invViewProj = mat4.create();

  let yaw = Math.PI;
  let pitch = 0.28;
  let distance = 16;
  let height = 5.5;
  let fov = (52 * Math.PI) / 180;
  let aspect = 1;

  return {
    position,
    viewProj,
    invViewProj,

    /**
     * Where the camera is looking, as a world heading. Screen-space overlays
     * need this rather than the boat's heading: the camera eases toward the
     * boat and carries the player's look bias, so the two differ whenever the
     * boat is turning.
     */
    get viewHeading() {
      return yaw + Math.PI;
    },

    /**
     * World point → normalised device coords. Returns null when the point is
     * behind the camera, where the perspective divide would mirror it back
     * into view.
     */
    project(x, y, z) {
      const m = viewProj;
      const cx = m[0] * x + m[4] * y + m[8] * z + m[12];
      const cy = m[1] * x + m[5] * y + m[9] * z + m[13];
      const cw = m[3] * x + m[7] * y + m[11] * z + m[15];
      if (cw <= 1e-4) return null;
      return { x: cx / cw, y: cy / cw };
    },

    /**
     * Follow the boat. lookYawBias lets the player peek (mouse / touch drag).
     */
    update(boat, lookYawBias, dt) {
      const desiredYaw = boat.heading + Math.PI + lookYawBias;
      yaw += (desiredYaw - yaw) * damp(2.4, dt);
      // Soften heel in the camera so the world doesn't tip violently.
      const desiredPitch = 0.26 + Math.abs(boat.heel) * 0.08 + boat.pitch * 0.15;
      pitch += (desiredPitch - pitch) * damp(3.0, dt);
      pitch = clamp(pitch, 0.12, 0.55);

      // Pull back + widen FOV with speed so the water rushes past.
      const speedBoost = clamp(boat.speed / 7, 0, 1.35);
      const dist = distance + speedBoost * 7;
      const h = height + speedBoost * 1.8;
      const wantFov = ((52 + speedBoost * 14) * Math.PI) / 180;
      fov += (wantFov - fov) * damp(4.0, dt);

      const behindX = Math.sin(yaw);
      const behindZ = Math.cos(yaw);
      const eyeY = boat.waterY + h + Math.sin(pitch) * dist * 0.35;
      const eyeX = boat.x + behindX * dist * Math.cos(pitch);
      const eyeZ = boat.z + behindZ * dist * Math.cos(pitch);

      // Slightly lag the eye so acceleration reads as a punch.
      const follow = 4.2 + speedBoost * 1.4;
      position[0] += (eyeX - position[0]) * damp(follow, dt);
      position[1] += (eyeY - position[1]) * damp(follow, dt);
      position[2] += (eyeZ - position[2]) * damp(follow, dt);

      target[0] = boat.x + Math.sin(boat.heading) * (4 + speedBoost * 2);
      target[1] = boat.waterY + 1.4;
      target[2] = boat.z + Math.cos(boat.heading) * (4 + speedBoost * 2);
    },

    resize(a) {
      aspect = a;
      mat4.perspective(proj, fov, aspect, 0.4, 1400);
    },

    commit() {
      mat4.perspective(proj, fov, aspect, 0.4, 1400);
      mat4.lookAt(view, position, target, up);
      mat4.multiply(viewProj, proj, view);
      mat4.invert(invViewProj, viewProj);
    },

    /** Snap immediately behind the boat (used on reset). */
    snap(boat) {
      yaw = boat.heading + Math.PI;
      fov = (52 * Math.PI) / 180;
      const behindX = Math.sin(yaw);
      const behindZ = Math.cos(yaw);
      position[0] = boat.x + behindX * distance;
      position[1] = boat.waterY + height;
      position[2] = boat.z + behindZ * distance;
      target[0] = boat.x;
      target[1] = boat.waterY + 1.4;
      target[2] = boat.z;
      this.commit();
    },
  };
}

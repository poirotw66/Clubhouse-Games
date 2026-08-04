// Sailing model.
//
// The sail is treated as an aerofoil in the *apparent* wind (true wind minus
// boat velocity). With the apparent wind β degrees off the bow, lift L and
// drag D resolve into the classic pair:
//
//   drive = L·sin β − D·cos β        side = L·cos β + D·sin β
//
// which is what makes the boat behave like a real one: no drive in the no-go
// zone, best speed on a reach, and a big heeling force when close-hauled that
// you pay for in leeway.

import { clamp, damp, angleDelta } from './math.js';
import { sampleWater } from './shaderChunks.js';

export const NO_GO = (32 * Math.PI) / 180;      // can't point closer than this
const NO_GO_SOFT = (48 * Math.PI) / 180;        // full power by here
const STALL = (24 * Math.PI) / 180;             // angle of attack at peak lift
const MAX_TRIM = (88 * Math.PI) / 180;
const MIN_TRIM = (6 * Math.PI) / 180;

const TURN_RATE = 1.7;
const TURN_RATE_ARCADE = 2.85;
const MAX_HEEL = (28 * Math.PI) / 180;
// Arcade cruise / boost — raised so the bay race doesn't crawl.
const ARCADE_CRUISE = 9.0;
const ARCADE_BOOST = 17.5;
const ARCADE_MAX = 20.5;
const POWER = 0.038;          // sail force scale (hard mode a bit quicker too)
const DRAG_FWD = 0.034;       // hull resistance (quadratic)
const DRAG_LAT = 0.9;         // keel resistance to leeway

/**
 * Lift coefficient: rises to a peak at STALL, then bleeds away post-stall.
 * The decay runs out to broadside rather than to 2·STALL, because cutting lift
 * to exactly zero at 48° left a dead band on the deeper angles — the sail
 * stopped working before drag took over, so bearing away could *gain* speed.
 */
function liftCoef(alpha) {
  const a = Math.abs(alpha);
  if (a <= 0) return 0;
  if (a <= STALL) return 1.55 * Math.sin((Math.PI / 2) * (a / STALL));
  const t = clamp((a - STALL) / (Math.PI / 2 - STALL), 0, 1);
  return 1.55 * Math.pow(1 - t, 1.3);
}

/** Drag coefficient: small when attached, flat-plate when broadside. */
function dragCoef(alpha) {
  const s = Math.sin(clamp(Math.abs(alpha), 0, Math.PI / 2));
  return 0.09 + 1.45 * s * s;
}

export function pointOfSail(awa) {
  const a = Math.abs(awa);
  if (a < NO_GO) return { key: 'irons', label: '頂風（無法前進）' };
  if (a < (60 * Math.PI) / 180) return { key: 'close', label: '搶風航行' };
  if (a < (100 * Math.PI) / 180) return { key: 'beam', label: '橫風航行' };
  if (a < (150 * Math.PI) / 180) return { key: 'broad', label: '斜順風' };
  return { key: 'run', label: '順風航行' };
}

export function createBoatState(startHeading = 0) {
  return {
    x: 0,
    z: 0,
    heading: startHeading,
    surge: 0,            // forward speed, m/s
    sway: 0,             // sideways slip (leeway), m/s
    yawRate: 0,
    heel: 0,
    pitch: 0,
    trim: (45 * Math.PI) / 180,
    rudder: 0,
    side: 1,             // which side the sail is set on (+1 / -1)
    awa: Math.PI,
    apparentSpeed: 0,
    drive: 0,
    heelForce: 0,
    luffing: 0,
    autoTrim: true,
    waterY: 0,
  };
}

export function createWind(seed = 1) {
  // 80°: matches the course start heading (−100°) so leg 1 opens as a run
  // (wind at your back) — easiest default for the first course.
  const DOWNWIND_FROM = (80 * Math.PI) / 180;
  return {
    baseFrom: DOWNWIND_FROM, // direction the wind blows FROM
    baseSpeed: 7.0,
    from: DOWNWIND_FROM,
    speed: 7.0,
    seed,
    update(time) {
      // Slow oscillating shifts plus gusts, so no two legs sail the same.
      const shift =
        Math.sin(time * 0.055 + this.seed) * 0.16 +
        Math.sin(time * 0.021 + this.seed * 2.1) * 0.1;
      const gust =
        Math.sin(time * 0.13 + this.seed * 1.7) * 0.9 +
        Math.sin(time * 0.041 + this.seed * 3.3) * 0.6;
      this.from = this.baseFrom + shift;
      this.speed = Math.max(1.5, this.baseSpeed + gust);
    },
    /** Velocity vector of the air (where it is going), in world XZ. */
    vector() {
      return {
        x: -Math.sin(this.from) * this.speed,
        z: -Math.cos(this.from) * this.speed,
      };
    },
  };
}

/**
 * Advance the boat one step.
 * input: { rudder: -1..1, trimDelta: -1..1, autoTrim: bool }
 * assist: truthy in easy mode — keeps a little steerage way on (see below).
 */
export function stepSailing(boat, wind, input, dt, time, waveAmp, assist = false) {
  const forwardX = Math.sin(boat.heading);
  const forwardZ = Math.cos(boat.heading);
  // Starboard (right of the bow) in a +Y-up right-handed frame.
  const rightX = forwardZ;
  const rightZ = -forwardX;

  // World velocity from body-frame surge/sway.
  const velX = forwardX * boat.surge + rightX * boat.sway;
  const velZ = forwardZ * boat.surge + rightZ * boat.sway;

  // Apparent wind = true wind - boat velocity.
  const w = wind.vector();
  const appX = w.x - velX;
  const appZ = w.z - velZ;
  const apparentSpeed = Math.hypot(appX, appZ);

  // Angle of the apparent wind measured from the bow (0 = dead ahead).
  const fromX = -appX;
  const fromZ = -appZ;
  const dot = forwardX * fromX + forwardZ * fromZ;
  const cross = rightX * fromX + rightZ * fromZ;
  const awa = Math.atan2(cross, dot);
  const beta = Math.abs(awa);

  // The sail sets to leeward; hold the old side through head-to-wind so it
  // doesn't flip-flop while tacking.
  if (beta > (12 * Math.PI) / 180) {
    boat.side = Math.sign(cross) || boat.side;
  }

  // --- trim -----------------------------------------------------------------
  // Ease the sheet as the wind moves aft, holding the sail near its peak-lift
  // angle of attack. A fixed fraction of beta can't do this: it only hits the
  // peak at one point of sail and stalls the sail everywhere else, which
  // hollows out the reach where the boat should be quickest.
  const ideal = clamp(beta - STALL, MIN_TRIM, MAX_TRIM);
  // Easy / arcade: always lock the sail to the ideal angle — player never
  // manages the sheet.
  if (assist || input.autoTrim) {
    const rate = assist ? 18 : 5.5;
    boat.trim += (ideal - boat.trim) * damp(rate, dt);
    if (assist) boat.trim = ideal; // snap — no lagging sheet in easy mode
  } else if (input.trimDelta) {
    boat.trim = clamp(boat.trim + input.trimDelta * 1.35 * dt, MIN_TRIM, MAX_TRIM);
  }

  // --- sail forces ----------------------------------------------------------
  const alpha = beta - boat.trim;         // angle of attack on the sail
  // Easy mode almost removes the dead zone — slightly-off still pulls hard.
  const noGoLo = assist ? (8 * Math.PI) / 180 : NO_GO;
  const noGoHi = assist ? (30 * Math.PI) / 180 : NO_GO_SOFT;
  const noGo = smoothstep(noGoLo, noGoHi, beta);

  let cl = 0;
  let cd = dragCoef(alpha);
  let luff = 0;

  if (alpha < 0) {
    // Sheeted out too far: the luff collapses and the sail shakes.
    luff = clamp(-alpha / 0.5, 0, 1);
    cd *= 0.35;
  } else {
    cl = liftCoef(alpha) * noGo;
    luff = (1 - noGo) * 0.85;
    if (alpha > STALL * 2) luff = Math.max(luff, clamp((alpha - STALL * 2) / 0.7, 0, 0.8));
  }

  const heelFactor = Math.cos(boat.heel);
  const q = POWER * (assist ? 1.35 : 1.15) * apparentSpeed * apparentSpeed;
  let drive = q * (cl * Math.sin(beta) - cd * Math.cos(beta)) * heelFactor;
  const side = q * (cl * Math.cos(beta) + cd * Math.sin(beta)) * heelFactor * Math.sign(cross || 1);

  // --- hull -----------------------------------------------------------------
  const dragScale = assist ? 0.78 : 1;
  const resist = (DRAG_FWD * boat.surge * Math.abs(boat.surge)
    + 0.18 * boat.surge
    + 0.022 * Math.pow(Math.max(0, Math.abs(boat.surge) - (assist ? 14.5 : 6.8)), 3)
      * Math.sign(boat.surge || 1)) * dragScale;

  const lateralResist = DRAG_LAT * boat.sway * Math.abs(boat.sway) + 2.6 * boat.sway;

  boat.surge += (drive - resist + boat.sway * boat.yawRate) * dt;
  boat.sway += (side - lateralResist - boat.surge * boat.yawRate) * dt;
  boat.surge = Math.max(boat.surge, -1.2);

  // Arcade easy: motor boat you STEER. Wind still gives a bonus on a reach,
  // but pointing into the wind never kills you — it only slows the motor.
  if (assist) {
    const boosting = Boolean(input.holdCourse);
    // Soft wind flavour only — apparent-wind shift must not throttle the motor
    // back to a crawl once the boat is already moving.
    const windBonus = clamp((beta - (8 * Math.PI) / 180) / ((100 * Math.PI) / 180), 0.9, 1.12);
    const target = (boosting ? ARCADE_BOOST : ARCADE_CRUISE) * windBonus;
    boat.surge += (target - boat.surge) * (boosting ? 3.6 : 2.4) * dt;
    boat.sway *= Math.exp(-2.6 * dt);
    boat.surge = Math.min(boat.surge, ARCADE_MAX);
  }

  // --- steering -------------------------------------------------------------
  const turnRate = assist ? TURN_RATE_ARCADE : TURN_RATE;
  boat.rudder += (input.rudder * (assist ? 1.0 : 0.75) - boat.rudder) * damp(assist ? 14 : 9, dt);
  // Rudder needs flow, but keep a floor so you can still turn out of irons.
  const authority = clamp(0.55 + Math.abs(boat.surge) / 1.6, 0, 1.45);
  // Weather helm: mild so beginners aren't constantly fighting the boat.
  const weatherHelm = assist ? 0 : -Math.sin(awa) * boat.heel * 0.08;
  const targetYaw = (boat.rudder * turnRate * authority + weatherHelm) * Math.sign(boat.surge >= 0 ? 1 : -1);
  boat.yawRate += (targetYaw - boat.yawRate) * damp(assist ? 10 : 6, dt);
  boat.heading += boat.yawRate * dt;

  // --- attitude -------------------------------------------------------------
  const targetHeel = clamp(-side * 1.35, -MAX_HEEL, MAX_HEEL);
  boat.heel += (targetHeel - boat.heel) * damp(2.6, dt);

  // --- position, riding the wave surface ------------------------------------
  const nvX = forwardX * boat.surge + rightX * boat.sway;
  const nvZ = forwardZ * boat.surge + rightZ * boat.sway;
  boat.x += nvX * dt;
  boat.z += nvZ * dt;

  const surface = sampleWater(boat.x, boat.z, time, waveAmp);
  boat.waterY = surface.y;

  // Pitch/roll follow the local wave slope, blended with sail-driven heel.
  const slopeFwd = -(surface.nx * forwardX + surface.nz * forwardZ);
  const slopeSide = -(surface.nx * rightX + surface.nz * rightZ);
  boat.pitch += (Math.atan(slopeFwd * 1.15) - boat.pitch) * damp(3.4, dt);
  boat.waveRoll = Math.atan(slopeSide * 0.9);

  boat.awa = awa;
  boat.apparentSpeed = apparentSpeed;
  boat.drive = drive;
  boat.heelForce = Math.abs(side);
  boat.luffing = luff;
  boat.speed = Math.hypot(nvX, nvZ);
  boat.trimIdeal = ideal;

  return boat;
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export { smoothstep };

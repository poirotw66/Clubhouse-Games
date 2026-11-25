/* Pure Wall Flip simulation. No DOM or Three.js dependencies. */
(() => {
const TAU = 6.283185307179586;
// ---------- trig: exact ports of the original series helpers ----------
const SIN_C = [], COS_C = [], ATAN_C = Array.from({ length: 16 }, (_, i) => (i % 2 ? -1 : 1) / (2 * i + 1));
{
  let f = 1;
  for (let i = 1; i <= 25; i++) {
    f *= i;
    const r = (Math.floor(i / 2) % 2 ? -1 : 1) / f;
    if (i % 2) SIN_C[(i - 1) / 2] = r; else COS_C[i / 2] = r;
  }
  COS_C[0] = 1;
}
const wrapAng = n => n >= -Math.PI && n <= Math.PI ? n : n - Math.round(n / TAU) * TAU;
function tsin(n) { // original rt
  n = wrapAng(n);
  const t = n * n;
  let r = SIN_C[12];
  for (let i = 11; i >= 0; i--) r = r * t + SIN_C[i];
  return r * n;
}
function tcos(n) { // original at
  n = wrapAng(n);
  const t = n * n;
  let r = COS_C[12];
  for (let i = 11; i >= 0; i--) r = r * t + COS_C[i];
  return r;
}
function tatan(n) { // original Ye
  n = n / (1 + Math.sqrt(1 + n * n));
  n = n / (1 + Math.sqrt(1 + n * n));
  const t = n * n;
  let r = ATAN_C[15];
  for (let i = 14; i >= 0; i--) r = r * t + ATAN_C[i];
  return 4 * n * r;
}
function atan2p(n, t) { // original Ze
  const r = Math.abs(n), a = Math.abs(t);
  if (r === 0 && a === 0) return 0;
  let d = r <= a ? tatan(r / a) : Math.PI / 2 - tatan(a / r);
  if (t < 0) d = Math.PI - d;
  return n < 0 ? -d : d;
}

// ---------- constants (exact) ----------
const G0 = 9.8;
// BASE is the untouched physics constant set; createSim shadows it with an
// optional vehicle/daily clone — the base object is never mutated.
const BASE = {
  G0,
  STEP: 1 / 240, RUNUP: 16, VMAX: 90, MOTOR_A: 30, MOTOR_P: 1200, MU: 3.1,
  SUCK: 1.4 * G0, ROLL: .25, DRAG: .003, THRUST: 1.5 * G0, ANG: 16,
  ROLL_DAMP: 7, SPIN_DAMP: .8, LEVEL: 2, LEVEL_CLEAR: 3,
  WORLD_X: 3e3, WORLD_Y: 3e3, AIR_G: 1.25, AIR_SUCK: 8, AIR_JET: 5,
  COAST: 20, CREEP: 5, WALL_CRASH: 9, GRACE: .15,
  LAND_TILT: 25 * (Math.PI / 180), LAND_SPEED: 5, LAND_SPIN: 2.5,
};
const CAR = {
  LEN: 4.4, H: .66, WHEEL_X: 1.38, WHEEL_Z: .86, WHEEL_R: .36, JET_Z: .78,
  POINTS: [
    [1.38, -.66, -.86, 'wheel'], [1.38, -.66, .86, 'wheel'],
    [-1.38, -.66, -.86, 'wheel'], [-1.38, -.66, .86, 'wheel'],
    [2.2, -.36, -.8], [2.2, -.36, .8], [-2.2, -.36, -.85], [-2.2, -.36, .85],
    [.2, -.1, -1.05], [.2, -.1, 1.05], [-.5, .55, -.5], [-.5, .55, .5],
  ],
};
const ROAD_W = 4.6;
const TRACK_DEF = [[165, 10.5], ['straight', 4.4 * 2]];
const SAMPLE = .05;

// ---------- courses, aerial rings and target landing pad ----------
const COURSES = Object.freeze([
  Object.freeze({ name: '宙返り', nameEn: 'Loop', arcDeg: 165, arcR: 10.5, straight: 8.8, wind: 0 }),
  Object.freeze({ name: '長空', nameEn: 'Long Sky', arcDeg: 172, arcR: 11.5, straight: 14, wind: 0 }),
  Object.freeze({ name: '疾風跳躍', nameEn: 'Gale Leap', arcDeg: 158, arcR: 9.6, straight: 12.0, wind: -2.0 }),
  Object.freeze({ name: '超重力巨塔', nameEn: 'Hyper Spire', arcDeg: 175, arcR: 12.5, straight: 16.5, wind: 1.5 }),
]);

const AERIAL_RINGS = Object.freeze([
  Object.freeze({ id: 'ring-1', x: -18, y: 22, z: 0, r: 3.5, pts: 30 }),
  Object.freeze({ id: 'ring-2', x: -44, y: 19, z: 0, r: 3.5, pts: 40 }),
  Object.freeze({ id: 'ring-3', x: -70, y: 12, z: 0, r: 3.5, pts: 50 }),
]);

const TARGET_PAD = Object.freeze({
  xMin: -135,
  xMax: -105,
  sweetMin: -125,
  sweetMax: -115,
  zMax: 2.3,
});

// ---------- track (exact port of the builder) ----------
const track = (() => {
  const pts = [{ s: 0, x: 0, y: 0, phi: 0, k: 0 }];
  let s = 0, x = 0, y = 0, phi = 0;
  for (const [seg, rad] of TRACK_DEF) {
    if (seg === 'straight') {
      for (let rem = rad; rem > 1e-9;) {
        const q = Math.min(SAMPLE, rem);
        x += tcos(phi) * q; y += tsin(phi) * q; s += q;
        pts.push({ s, x, y, phi, k: 0 });
        rem -= q;
      }
      continue;
    }
    const end = seg * Math.PI / 180;
    for (; phi < end - 1e-9;) {
      const ds = Math.min(SAMPLE, (end - phi) * rad), mid = phi + ds / rad / 2;
      x += tcos(mid) * ds; y += tsin(mid) * ds; phi += ds / rad; s += ds;
      pts.push({ s, x, y, phi, k: 1 / rad });
    }
  }
  let idx = pts.length - 1;
  while (idx > 0 && pts[idx].k === 0) idx--;
  return { pts, len: s, top: pts[pts.length - 1], straightFrom: pts[idx].s };
})();
const A = track.pts;

function trackAt(n) { // original Lt
  if (n <= 0) return { x: n, y: 0, phi: 0, k: 0 };
  if (n >= track.len) {
    const t = track.top, b = n - track.len;
    return { x: t.x + tcos(t.phi) * b, y: t.y + tsin(t.phi) * b, phi: t.phi, k: 0 };
  }
  let i = Math.min(A.length - 2, Math.floor(n / SAMPLE));
  for (; i > 0 && A[i].s > n; i--);
  for (; i < A.length - 2 && A[i + 1].s < n; i++);
  const a = A[i], b = A[i + 1], f = (n - a.s) / (b.s - a.s || 1);
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f, phi: a.phi + (b.phi - a.phi) * f, k: b.k };
}

function bodyPose(u) { // original Qe
  const a = trackAt(u - CAR.WHEEL_X), b = trackAt(u + CAR.WHEEL_X);
  const th = atan2p(b.y - a.y, b.x - a.x);
  return {
    x: (a.x + b.x) / 2 - tsin(th) * CAR.H,
    y: (a.y + b.y) / 2 + tcos(th) * CAR.H,
    th,
  };
}

// roll/pitch/yaw local -> world (original ne); yaw truthy mirrors x/z
function localToWorld(roll, pitch, x, y, z, yaw = Math.PI) {
  const cp = tcos(pitch), sp = tsin(pitch), cr = tcos(roll), sr = tsin(roll);
  const q = cp * x - sp * y, K = sp * x + cp * y;
  const k = K * cr - z * sr, E = K * sr + z * cr;
  return yaw ? [-q, k, -E] : [q, k, E];
}

function closestOnTrack(px, py) { // original oe
  let best = Infinity, out = null;
  for (let i = 0; i < A.length; i++) {
    const p = A[i];
    const dx = px - p.x, dy = py - p.y, d2 = dx * dx + dy * dy;
    if (d2 >= best) continue;
    best = d2;
    const along = tcos(p.phi) * dx + tsin(p.phi) * dy;
    out = (i === A.length - 1 && along > 0) || (i === 0 && along < 0) ? null
      : { n: -tsin(p.phi) * dx + tcos(p.phi) * dy, nx: -tsin(p.phi), ny: tcos(p.phi) };
  }
  return out;
}

const rollsCount = (roll, roll0) => Math.floor((Math.abs(roll - roll0) + roll0 + BASE.LAND_TILT) / TAU); // original en

// ---------- simulation factory (exact port of Kt) ----------
function createSim(hooks = {}, consts = null) {
  // shadow the module constants: consts is a patched clone (daily) or BASE
  const I = consts || BASE;
  const G0 = I.G0;
  const p0 = bodyPose(0);
  const s = {
    mode: 'road', u: -I.RUNUP, v: 0,
    x: p0.x - I.RUNUP, y: p0.y, z: 0,
    vx: 0, vy: 0, vz: 0,
    th: 0, yaw: Math.PI, roll: Math.PI, roll0: Math.PI, pitch: 0, rw: 0,
    air: 100, time: 0, airTime: 0, acc: 0,
    suck: false, drive: false, left: false, right: false, slip: false, onWall: false,
    gripLeft: 1, clear: false, peeled: false, lifted: false, launched: false,
    launchV: 0, pw: 0, landRoll: 0, land: null, crash: null,
    events: [],
    spinTotal: 0, rollsAccum: 0, spinRight: 0, spinLeft: 0,
    hasSwitchedDir: false, phase: 'upright',
    comboMult: 1.0, hasSkimmed: false, skimTime: 0, hasInverted: false, invertTime: 0,
    collectedRings: [], ringsCount: 0, ringBonus: 0,
  };
  const snap = () => { const q = bodyPose(s.u); s.x = q.x; s.y = q.y; s.th = q.th; };
  const toAir = kind => {
    if (s.u >= track.straightFrom) kind = 'launch';
    else if (s.u <= .5) kind = 'lift';
    const k = trackAt(s.u);
    s.mode = 'air'; s.airTime = 0;
    s.vx = tcos(k.phi) * s.v; s.vy = tsin(k.phi) * s.v; s.vz = 0;
    const over = s.th > Math.PI / 2;
    s.yaw = over ? Math.PI : 0;
    s.roll = s.roll0 = over ? Math.PI : 0;
    s.pitch = over ? s.th - Math.PI : s.th;
    s.rw = 0; s.launchV = s.v;
    s.spinTotal = 0; s.rollsAccum = 0; s.spinRight = 0; s.spinLeft = 0;
    s.hasSwitchedDir = false;
    s.comboMult = 1.0; s.hasSkimmed = false; s.skimTime = 0; s.hasInverted = false; s.invertTime = 0;
    s.collectedRings = []; s.ringsCount = 0; s.ringBonus = 0;
    s.phase = over ? 'inverted' : 'upright';
    s.launched = kind === 'launch'; s.peeled = kind === 'detach'; s.lifted = kind === 'lift';
    s.clear = false;
    s.events.push({ type: kind, x: s.x, y: s.y });
    hooks.onAir?.(kind);
  };
  const doCrash = (reason, x, y) => {
    if (s.mode !== 'crash') {
      s.mode = 'crash'; s.crash = reason; s.pw = 2.5;
      s.events.push({ type: 'crash', reason, x, y });
    }
  };
  // attached road mode (original M)
  const stepRoad = (dt, inp) => {
    const sm = trackAt(s.u), onWall = s.u > 0;
    const sucking = inp.suck && s.air > 0;
    if (sucking) s.air = Math.max(0, s.air - I.AIR_SUCK * dt);
    const A2 = sucking ? I.SUCK : 0;
    const braking=I.LANDING_ASSIST&&inp.suck&&inp.left&&inp.right;
    const jL = !braking&&inp.left&&s.air>0, jR = !braking&&inp.right&&s.air>0;
    const Z = (jL ? 1 : 0) + (jR ? 1 : 0);
    if (Z) s.air = Math.max(0, s.air - I.AIR_JET * Z * dt);
    s.left = jL; s.right = jR;
    const N = s.v * s.v * sm.k + G0 * tcos(sm.phi) - I.THRUST * Z;
    s.gripLeft = onWall ? Math.max(0, Math.min(1, (N + A2) / (G0 * 1.5))) : 1;
    if ((onWall || Z) && N + A2 < 0) { toAir('detach'); return; }
    const tract = I.MU * Math.max(0, N + A2);
    let o = 0;
    s.slip = false;
    if (inp.drive) {
      const cap = s.v >= I.VMAX ? 0 : Math.min(I.MOTOR_A, I.MOTOR_P / Math.max(s.v, 1));
      o = Math.min(cap, tract);
      s.slip = cap > tract + .5;
    }
    o -= G0 * tsin(sm.phi);
    o -= Math.sign(s.v) * (I.ROLL + I.DRAG * s.v * s.v + (inp.drive ? 0 : I.COAST));
    if (!inp.drive && !onWall && Math.abs(s.v) < .3) { s.v = 0; o = 0; }
    if (onWall && !inp.drive && s.v <= 0) {
      const creep = -I.CREEP * tsin(sm.phi);
      s.v = s.v > creep ? Math.max(creep, s.v - G0 * tsin(sm.phi) * dt) : Math.min(creep, s.v + I.COAST * dt);
    } else s.v += o * dt;
    s.u += s.v * dt;
    if (s.u < -I.RUNUP) { s.u = -I.RUNUP; s.v = Math.max(0, s.v); }
    s.suck = sucking; s.drive = !!inp.drive; s.onWall = onWall;
    if (s.u - CAR.WHEEL_X >= track.len) { snap(); toAir('launch'); return; }
    snap();
  };
  const worldPt = pt => {
    const w = localToWorld(s.roll, s.pitch, pt[0], pt[1], pt[2], s.yaw);
    return [s.x + w[0], s.y + w[1], s.z + w[2]];
  };
  // air mode (original b)
  const stepAir = (dt, inp) => {
    s.airTime += dt;
    const control=I.LANDING_ASSIST?window.WallFlipGarage.airControl({angle:s.roll,spin:s.rw,y:s.y,vy:s.vy,air:s.air,clear:s.clear},inp,{thrust:I.THRUST,gravity:G0*I.AIR_G}):inp;
    const jL = control.left && s.air > 0, jR = control.right && s.air > 0;
    const Z = (jL ? 1 : 0) + (jR ? 1 : 0);
    if (Z) s.air = Math.max(0, s.air - I.AIR_JET * Z * dt);
    const roof = localToWorld(s.roll, s.pitch, 0, 1, 0, s.yaw);
    const manualThrust = control.verticalThrust === undefined ? I.THRUST * Z : 0;
    s.vx += roof[0] * manualThrust * dt;
    s.vy += ((control.verticalThrust ?? roof[1] * manualThrust) - G0 * I.AIR_G) * dt;
    s.vz += roof[2] * manualThrust * dt;
    s.vz *= 1 - Math.min(1, dt * 2.8);
    if (I.wind) s.vx += I.wind * dt;
    const rings = I.RINGS || AERIAL_RINGS;
    for (const ring of rings) {
      if (s.collectedRings.includes(ring.id)) continue;
      const dx = s.x - ring.x;
      const dy = s.y - ring.y;
      const dz = (s.z || 0) - (ring.z || 0);
      if (Math.hypot(dx, dy, dz) <= ring.r) {
        s.collectedRings.push(ring.id);
        s.ringsCount = (s.ringsCount || 0) + 1;
        s.ringBonus = (s.ringBonus || 0) + ring.pts;
        hooks.onRingPass?.(ring, s.ringsCount);
      }
    }
    const damp = jL !== jR ? I.SPIN_DAMP : I.ROLL_DAMP;
    s.rw += (control.rollAccel ?? (((jL ? 1 : 0) - (jR ? 1 : 0)) * I.ANG - s.rw * damp)) * dt;
    const dRoll = s.rw * dt;
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.roll += dRoll;
    const absDRoll = Math.abs(dRoll);
    s.spinTotal = (s.spinTotal || 0) + absDRoll;
    if (dRoll < 0) s.spinRight = (s.spinRight || 0) - dRoll;
    else if (dRoll > 0) s.spinLeft = (s.spinLeft || 0) + dRoll;

    // Track full revolution milestones (inverted -> upright transitions)
    const tiltRoll = Math.abs(s.roll - Math.round(s.roll / TAU) * TAU);
    if (s.phase === 'inverted') {
      if (tiltRoll <= I.LAND_TILT) {
        s.rollsAccum = (s.rollsAccum || 0) + 1;
        s.phase = 'upright';
        hooks.onRollMilestone?.(s.rollsAccum);
      }
    } else {
      if (tiltRoll >= Math.PI - 0.55) {
        s.phase = 'inverted';
      }
    }

    if (!s.hasSwitchedDir && s.spinRight >= Math.PI - 0.35 && s.spinLeft >= Math.PI - 0.35) {
      s.hasSwitchedDir = true;
      hooks.onDirSwitch?.();
    }
    const curRolls = Math.max(rollsCount(s.roll, s.roll0), s.rollsAccum || 0);
    const altM = Math.max(0, s.y - CAR.H);
    const forwardSpd = Math.hypot(s.vx, s.vy);
    if (altM <= 2.2 && forwardSpd >= 16.5) {
      s.skimTime = (s.skimTime || 0) + dt;
      if (s.skimTime >= 0.12 && !s.hasSkimmed) {
        s.hasSkimmed = true;
        hooks.onSkim?.();
      }
    }
    const levelCos = tcos(s.roll) * tcos(s.pitch);
    if (levelCos <= -0.55 && altM > 3.0) {
      s.invertTime = (s.invertTime || 0) + dt;
      if (s.invertTime >= 0.35 && !s.hasInverted) {
        s.hasInverted = true;
        hooks.onInvert?.();
      }
    }
    const rotTotal = Math.max(Math.abs(s.roll - s.roll0), s.spinTotal || 0);
    let mult = 1.0 + curRolls * 0.4;
    if (rotTotal >= 1260 * (Math.PI / 180)) mult = Math.max(mult, 3.0);
    if (s.hasSkimmed) mult += 0.5;
    if (s.hasInverted) mult += 0.4;
    if (s.hasSwitchedDir) mult += 0.3;
    if (s.ringsCount > 0) mult += s.ringsCount * 0.3;
    s.comboMult = mult;
    if (Math.abs(s.x) > I.WORLD_X) { s.x = Math.sign(s.x) * I.WORLD_X; s.vx = 0; }
    if (Math.abs(s.z) > 18) { s.z = Math.sign(s.z) * 18; s.vz = 0; }
    if (s.y > I.WORLD_Y) { s.y = I.WORLD_Y; s.vy = Math.min(0, s.vy); }
    if (!s.clear) {
      if (s.x < -10 || s.x > 15 || s.y < -4 || s.y > 27) {
        s.clear = true;
      } else {
        const cp = closestOnTrack(s.x, s.y);
        s.clear = !cp || Math.abs(cp.n) > I.LEVEL_CLEAR;
      }
    }
    if (s.clear) s.pitch -= s.pitch * Math.min(1, I.LEVEL * dt);
    s.left = jL; s.right = jR; s.suck = false; s.drive = false; s.slip = false; s.onWall = false;
    if (s.airTime > I.GRACE) {
      for (const pt of CAR.POINTS) {
        const [wx, wy, wz] = worldPt(pt);
        if (Math.abs(wz) >= ROAD_W / 2 + .2) continue;
        if (wx < -8 || wx > 13 || wy < -2 || wy > 25) continue;
        const cp = closestOnTrack(wx, wy);
        if (!cp || cp.n >= -.02 || cp.n < -1.5) continue;
        const J = s.vx * cp.nx + s.vy * cp.ny;
        if (J < -I.WALL_CRASH) { doCrash(s.peeled ? 'fall' : 'wall', wx, wy); return; }
        s.x -= cp.nx * cp.n; s.y -= cp.ny * cp.n;
        if (J < 0) { s.vx -= J * cp.nx * 1.2; s.vy -= J * cp.ny * 1.2; }
        s.vx *= 1 - Math.min(1, dt * 1.5); s.vy *= 1 - Math.min(1, dt * 1.5);
      }
    }
    let low = null;
    for (const pt of CAR.POINTS) {
      const w = worldPt(pt);
      if (w[1] <= 0 && (!low || w[1] < low.w[1])) low = { pt, w };
    }
    if (!low) return;
    const q = Math.round(s.roll / TAU);
    const tilt = Math.max(Math.abs(s.roll - q * TAU), Math.abs(s.pitch));
    const [lx, ly, lz] = low.pt;
    const ky = tsin(s.pitch) * lx + tcos(s.pitch) * ly;
    const spinTerm = -ky * tsin(s.roll) - lz * tcos(s.roll);
    const spinDamp = Math.abs(s.rw) <= (I.LAND_SPIN ?? BASE.LAND_SPIN) ? 0.35 : 1.0;
    const fall = -(s.vy + s.rw * spinTerm * spinDamp);
    const completedRolls = Math.max(rollsCount(s.roll, s.roll0), s.rollsAccum || 0);
    const pad = I.TARGET_PAD || TARGET_PAD;
    const inTargetZone = s.x <= pad.xMax && s.x >= pad.xMin && Math.abs(s.z || 0) <= (pad.zMax || 4);
    const inSweetSpot = inTargetZone && s.x <= pad.sweetMax && s.x >= pad.sweetMin && Math.abs(s.z || 0) <= 1.8;
    s.land = {
      x: s.x, z: s.z, fall, tilt, spin: Math.abs(s.rw), rolls: completedRolls, vx: s.vx,
      hasSkimmed: !!s.hasSkimmed, hasInverted: !!s.hasInverted, hasSwitchedDir: !!s.hasSwitchedDir,
      comboMult: s.comboMult || 1,
      rings: s.ringsCount || 0,
      ringBonus: s.ringBonus || 0,
      targetZone: inTargetZone,
      sweetSpot: inSweetSpot,
    };
    if (low.pt[3] !== 'wheel' || tilt > I.LAND_TILT) { doCrash('tilt', low.w[0], 0); return; }
    if (fall > I.LAND_SPEED || Math.abs(s.rw) > I.LAND_SPIN) { doCrash('hard', low.w[0], 0); return; }
    if (!I.LANDING_ASSIST && s.lifted && s.x <= 0 && Math.abs(s.z) < ROAD_W / 2) {
      s.land = null; s.mode = 'road';
      s.u = Math.max(-I.RUNUP, s.x); s.v = s.vx * tcos(s.yaw);
      s.z = 0; s.vz = 0; s.rw = 0;
      s.spinTotal = 0; s.rollsAccum = 0; s.spinRight = 0; s.spinLeft = 0;
      s.hasSwitchedDir = false; s.phase = 'upright';
      s.comboMult = 1.0; s.hasSkimmed = false; s.skimTime = 0; s.hasInverted = false; s.invertTime = 0;
      snap();
      s.events.push({ type: 'touch', x: s.x, y: 0 });
      return;
    }
    s.mode = 'landed'; s.landRoll = q * TAU;
    s.events.push({ type: 'land', x: s.x, y: 0 });
  };
  // landed rollout (original g)
  const stepLanded = dt => {
    const k = Math.min(1, dt * 12);
    s.roll += (s.landRoll - s.roll) * k;
    s.pitch -= s.pitch * k;
    s.rw = 0; s.vy = 0; s.y = CAR.H;
    const E = 7 * dt;
    s.vx = Math.abs(s.vx) <= E ? 0 : s.vx - Math.sign(s.vx) * E;
    s.vz *= 1 - Math.min(1, dt * 4);
    s.x += s.vx * dt; s.z += s.vz * dt;
    s.left = s.right = false;
  };
  // crash tumble (original P)
  const stepCrash = dt => {
    s.vy -= G0 * dt;
    s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
    s.roll += s.rw * dt; s.pitch += s.pw * dt;
    const cp = Math.abs(s.z) < ROAD_W / 2 + .5 ? closestOnTrack(s.x, s.y) : null;
    if (cp && cp.n < .7 && cp.n > -1.5) {
      s.x += cp.nx * (.7 - cp.n); s.y += cp.ny * (.7 - cp.n);
      const Hn = s.vx * cp.nx + s.vy * cp.ny;
      if (Hn < 0) { s.vx -= Hn * cp.nx * 1.2; s.vy -= Hn * cp.ny * 1.2; }
      s.vx *= 1 - dt * 2; s.vy *= 1 - dt * 2; s.rw *= 1 - dt * 3;
    }
    let low = Infinity;
    for (const pt of CAR.POINTS) low = Math.min(low, s.y + localToWorld(s.roll, s.pitch, pt[0], pt[1], pt[2], s.yaw)[1]);
    if (low < 0) {
      s.y -= low;
      if (s.vy < 0) s.vy = -s.vy * .3;
      s.vx *= .6; s.vz *= .6; s.rw *= .6; s.pw *= .6;
    }
    if (low < .05 && Math.abs(s.vy) < 1.5) {
      const k = Math.min(1, dt * 6);
      s.roll += (Math.round(s.roll / Math.PI) * Math.PI - s.roll) * k;
      s.pitch += (Math.round(s.pitch / Math.PI) * Math.PI - s.pitch) * k;
      s.rw *= 1 - k; s.pw *= 1 - k;
      s.vx *= 1 - Math.min(1, dt * 2); s.vz *= 1 - Math.min(1, dt * 2);
    }
    s.left = s.right = s.suck = s.drive = false;
  };
  const step = (dt, inp) => {
    s.time += dt;
    if (s.mode === 'road') stepRoad(dt, inp);
    else if (s.mode === 'air') stepAir(dt, inp);
    else if (s.mode === 'landed') stepLanded(dt);
    else stepCrash(dt);
  };
  const advance = (dt, inp) => {
    for (s.acc += dt; s.acc >= I.STEP;) { s.acc -= I.STEP; step(I.STEP, inp); }
  };
  snap();
  return { state: s, step, advance };
}

// ---------- scoring (exact port of se) ----------
function scoreOf(land) {
  const c = v => Math.max(0, Math.min(1, v));
  const roll = 50 * land.rolls;
  const soft = 30 * c(1 - land.fall / BASE.LAND_SPEED);
  const level = 20 * c(1 - land.tilt / BASE.LAND_TILT);
  const stuntBase = (land.hasSkimmed ? 25 : 0) + (land.hasInverted ? 20 : 0) + (land.hasSwitchedDir ? 20 : 0);
  const comboMult = land.comboMult ?? 1;
  const stunt = stuntBase > 0 ? Math.round(stuntBase * comboMult) : 0;
  const ringBonus = land.ringBonus ?? ((land.rings || 0) * 30);
  const targetBonus = land.targetZone ? (land.sweetSpot ? 40 : 20) : 0;
  const total = Math.round(roll + soft + level + stunt + ringBonus + targetBonus);
  return { roll, soft, level, stunt, rings: ringBonus, target: targetBonus, total };
}


globalThis.WallFlipSimulation = Object.freeze({
  TAU, BASE, CAR, ROAD_W, TRACK_DEF, track, trackAt, bodyPose, localToWorld,
  closestOnTrack, rollsCount, createSim, scoreOf, tsin, tcos, tatan, atan2p,
  COURSES, AERIAL_RINGS, TARGET_PAD
});
})();

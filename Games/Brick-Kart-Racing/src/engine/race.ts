import {CHARACTERS, DIFFICULTIES, type DifficultyId} from '../data/characters';
import {LAP_TOTAL, RACER_COUNT, SURFACE_BOOST, SURFACE_GRASS} from './constants';
import {indexDelta, lateralOffset, nearestIndex, pointAt} from './spline';
import {getTrackAssets, surfaceAt, type TrackAssets} from './trackAssets';

export type ItemId = 'boost' | 'oil' | 'homing' | 'shield';

export interface RaceInput {
  steer: number;
  throttle: boolean;
  brake: boolean;
  drift: boolean;
  useItem: boolean;
}

export interface Racer {
  index: number;
  charId: string;
  name: string;
  isPlayer: boolean;

  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  /** Forward speed, cached for HUD and AI. */
  speed: number;
  /** Extra body yaw while sliding, for the sprite only. */
  bodyYaw: number;

  drifting: boolean;
  driftDir: number;
  driftCharge: number;
  boostTime: number;
  spinTime: number;
  slipTime: number;
  invulnTime: number;

  item: ItemId | null;
  itemRoll: number;
  shields: number;
  shieldAngle: number;

  lastIdx: number;
  progress: number;
  lap: number;
  /** Highest lap index banked so far; never decreases. */
  lapsCompleted: number;
  place: number;
  finished: boolean;
  finishTime: number;
  lapTimes: number[];
  lapStart: number;

  cpuOffset: number;
  cpuItemTimer: number;
  cpuNoise: number;
}

export interface OilDrop {
  x: number;
  y: number;
  life: number;
  owner: number;
}

export interface Homing {
  x: number;
  y: number;
  angle: number;
  life: number;
  owner: number;
  target: number;
}

export interface Particle {
  x: number;
  y: number;
  z: number;
  vz: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export type RacePhase = 'countdown' | 'racing' | 'finished';

export interface RaceState {
  assets: TrackAssets;
  racers: Racer[];
  oils: OilDrop[];
  homings: Homing[];
  particles: Particle[];
  /** Respawn timer per item brick spot; 0 means available. */
  itemRespawn: number[];
  phase: RacePhase;
  countdown: number;
  time: number;
  laps: number;
  difficulty: DifficultyId;
  events: string[];
  playerIndex: number;
}

const BASE_TOP_SPEED = 330;
const BASE_ACCEL = 285;
const BRAKE_FORCE = 430;
const REVERSE_TOP = 110;
const GRASS_SPEED = 0.5;
const LATERAL_GRIP = 9;
const DRIFT_GRIP = 2.6;
const TURN_RATE = 2.15;
const BOOST_TOP_MULT = 1.5;
const BOOST_ACCEL = 780;
/** How fast speed above the current ceiling bleeds away, in units/s². */
const SPEED_BLEED = 260;
const KART_COLLIDE_DIST = 30;
const ITEM_PICKUP_DIST = 26;
const OIL_HIT_DIST = 22;
const HOMING_HIT_DIST = 26;
const HOMING_SPEED = 470;
const MAX_LATERAL = 330;

const DRIFT_LEVELS = [
  {charge: 0.85, boost: 0.55},
  {charge: 1.8, boost: 1.0},
  {charge: 3.0, boost: 1.7},
];

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function char(id: string) {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export function driftLevel(charge: number): number {
  let level = 0;
  for (let i = 0; i < DRIFT_LEVELS.length; i++) if (charge >= DRIFT_LEVELS[i].charge) level = i + 1;
  return level;
}

export function createRace(
  trackId: string,
  playerCharId: string,
  difficulty: DifficultyId,
  laps = LAP_TOTAL,
): RaceState {
  const assets = getTrackAssets(trackId);
  const n = assets.centerline.points.length;

  const roster = [playerCharId, ...CHARACTERS.filter((c) => c.id !== playerCharId).map((c) => c.id)];
  const racers: Racer[] = [];
  for (let i = 0; i < RACER_COUNT; i++) {
    const spot = assets.grid[i];
    const gridIdx = nearestIndex(assets.centerline, spot.x, spot.y, -1);
    const c = char(roster[i % roster.length]);
    racers.push({
      index: i,
      charId: c.id,
      name: c.name,
      isPlayer: i === 0,
      x: spot.x,
      y: spot.y,
      angle: spot.angle,
      vx: 0,
      vy: 0,
      speed: 0,
      bodyYaw: 0,
      drifting: false,
      driftDir: 0,
      driftCharge: 0,
      boostTime: 0,
      spinTime: 0,
      slipTime: 0,
      invulnTime: 0,
      item: null,
      itemRoll: 0,
      shields: 0,
      shieldAngle: 0,
      lastIdx: gridIdx,
      progress: gridIdx - n,
      lap: 1,
      lapsCompleted: 0,
      place: i + 1,
      finished: false,
      finishTime: 0,
      lapTimes: [],
      lapStart: 0,
      cpuOffset: (i - 1.5) * 22,
      cpuItemTimer: 1 + i * 0.4,
      cpuNoise: Math.random() * Math.PI * 2,
    });
  }

  const state: RaceState = {
    assets,
    racers,
    oils: [],
    homings: [],
    particles: [],
    itemRespawn: new Array(assets.itemSpots.length).fill(0),
    phase: 'countdown',
    countdown: 3.6,
    time: 0,
    laps,
    difficulty,
    events: [],
    playerIndex: 0,
  };
  // Seed the standings from the grid so the HUD is right during the countdown.
  updatePlaces(state);
  return state;
}

function rollItem(place: number): ItemId {
  const table: Record<number, [ItemId, number][]> = {
    1: [
      ['oil', 0.45],
      ['shield', 0.25],
      ['boost', 0.25],
      ['homing', 0.05],
    ],
    2: [
      ['oil', 0.25],
      ['shield', 0.25],
      ['boost', 0.35],
      ['homing', 0.15],
    ],
    3: [
      ['oil', 0.15],
      ['shield', 0.2],
      ['boost', 0.4],
      ['homing', 0.25],
    ],
    4: [
      ['oil', 0.1],
      ['shield', 0.15],
      ['boost', 0.4],
      ['homing', 0.35],
    ],
  };
  const rows = table[Math.min(4, Math.max(1, place))];
  let r = Math.random();
  for (const [id, p] of rows) {
    r -= p;
    if (r <= 0) return id;
  }
  return 'boost';
}

function spawnParticle(state: RaceState, p: Particle): void {
  if (state.particles.length > 220) state.particles.shift();
  state.particles.push(p);
}

function spinOut(state: RaceState, r: Racer, duration = 1.35): void {
  if (r.invulnTime > 0 || r.spinTime > 0) return;
  if (r.shields > 0) {
    r.shields--;
    r.invulnTime = 0.6;
    state.events.push(r.isPlayer ? 'shield-block' : 'shield-block-cpu');
    return;
  }
  r.spinTime = duration;
  r.invulnTime = duration + 0.7;
  r.boostTime = 0;
  r.drifting = false;
  r.driftCharge = 0;
  state.events.push(r.isPlayer ? 'player-hit' : 'cpu-hit');
  for (let i = 0; i < 10; i++) {
    spawnParticle(state, {
      x: r.x + (Math.random() - 0.5) * 26,
      y: r.y + (Math.random() - 0.5) * 26,
      z: 18 + Math.random() * 22,
      vz: 20 + Math.random() * 30,
      life: 0.7,
      maxLife: 0.7,
      size: 7,
      color: '#ffe066',
    });
  }
}

function useItem(state: RaceState, r: Racer): void {
  if (!r.item || r.spinTime > 0) return;
  const item = r.item;
  r.item = null;

  if (item === 'boost') {
    r.boostTime = Math.max(r.boostTime, 1.5);
    state.events.push(r.isPlayer ? 'boost' : 'boost-cpu');
    return;
  }
  if (item === 'shield') {
    r.shields = 3;
    state.events.push('shield-up');
    return;
  }
  if (item === 'oil') {
    const bx = r.x - Math.cos(r.angle) * 44;
    const by = r.y - Math.sin(r.angle) * 44;
    state.oils.push({x: bx, y: by, life: 22, owner: r.index});
    state.events.push('drop');
    return;
  }

  // Homing brick: chase whoever is one place ahead.
  const ahead = state.racers
    .filter((o) => o.index !== r.index && o.progress > r.progress)
    .sort((a, b) => a.progress - b.progress)[0];
  state.homings.push({
    x: r.x + Math.cos(r.angle) * 42,
    y: r.y + Math.sin(r.angle) * 42,
    angle: r.angle,
    life: 7,
    owner: r.index,
    target: ahead ? ahead.index : -1,
  });
  state.events.push('fire');
}

function driveCpu(state: RaceState, r: Racer, dt: number): RaceInput {
  const line = state.assets.centerline;
  const diff = DIFFICULTIES.find((d) => d.id === state.difficulty)!;

  r.cpuNoise += dt * 0.7;
  const wander = Math.sin(r.cpuNoise) * 20 * (1.2 - diff.cpuSkill);
  let offset = r.cpuOffset + wander;

  // Steer around dropped oil that lies close to the intended line.
  for (const oil of state.oils) {
    const d = Math.hypot(oil.x - r.x, oil.y - r.y);
    if (d > 190 || d < 10) continue;
    const toward = Math.atan2(oil.y - r.y, oil.x - r.x);
    if (Math.abs(wrapAngle(toward - r.angle)) < 0.45) {
      const idx = nearestIndex(line, oil.x, oil.y, r.lastIdx);
      const oilLat = lateralOffset(line, idx, oil.x, oil.y);
      offset = oilLat > 0 ? oilLat - 62 : oilLat + 62;
    }
  }
  offset = Math.max(-52, Math.min(52, offset));

  const lookahead = 10 + Math.min(26, r.speed * 0.055);
  const target = pointAt(line, r.lastIdx + lookahead, offset);
  const desired = Math.atan2(target.y - r.y, target.x - r.x);
  const delta = wrapAngle(desired - r.angle);

  const steer = Math.max(-1, Math.min(1, delta * 2.6));
  const sharp = Math.abs(delta);

  r.cpuItemTimer -= dt;
  const wantItem = r.item !== null && r.cpuItemTimer <= 0;
  if (wantItem) r.cpuItemTimer = diff.cpuItemDelay + Math.random() * 1.5;

  return {
    steer,
    throttle: true,
    brake: sharp > 1.1 && r.speed > 240,
    drift: sharp > 0.42 && sharp < 1.3 && r.speed > 170 && diff.cpuSkill > 0.75,
    useItem: wantItem,
  };
}

function stepRacer(state: RaceState, r: Racer, input: RaceInput, dt: number): void {
  const c = char(r.charId);
  const line = state.assets.centerline;
  const n = line.points.length;
  const diff = DIFFICULTIES.find((d) => d.id === state.difficulty)!;

  r.invulnTime = Math.max(0, r.invulnTime - dt);
  r.slipTime = Math.max(0, r.slipTime - dt);
  r.itemRoll = Math.max(0, r.itemRoll - dt);
  r.shieldAngle += dt * 3.4;

  const surf = surfaceAt(state.assets, r.x, r.y);
  const onRoad = surf !== SURFACE_GRASS;
  if (surf === SURFACE_BOOST && r.spinTime <= 0) {
    if (r.boostTime < 0.9) state.events.push(r.isPlayer ? 'boost' : 'boost-cpu');
    r.boostTime = Math.max(r.boostTime, 0.95);
  }

  if (r.spinTime > 0) {
    r.spinTime -= dt;
    r.angle += dt * 11;
    r.drifting = false;
    input = {steer: 0, throttle: false, brake: false, drift: false, useItem: false};
  }

  if (input.useItem) useItem(state, r);

  // --- Steering -------------------------------------------------------------
  const speedFactor = Math.min(1, Math.abs(r.speed) / 70);
  const agility = (TURN_RATE * c.grip) / (0.72 + 0.28 * c.weight);

  if (r.spinTime <= 0) {
    if (input.drift && !r.drifting && Math.abs(input.steer) > 0.25 && r.speed > 130) {
      r.drifting = true;
      r.driftDir = Math.sign(input.steer);
      r.driftCharge = 0;
      state.events.push('drift-start');
    }
    if (r.drifting && (!input.drift || r.speed < 70)) {
      const level = driftLevel(r.driftCharge);
      if (level > 0) {
        r.boostTime = Math.max(r.boostTime, DRIFT_LEVELS[level - 1].boost);
        state.events.push(r.isPlayer ? `mini-turbo-${level}` : 'boost-cpu');
      }
      r.drifting = false;
      r.driftDir = 0;
      r.driftCharge = 0;
    }

    if (r.drifting) {
      r.driftCharge += dt;
      // Steering into the slide tightens it, away from it opens it up.
      const bias = 0.62 + 0.38 * Math.max(0, input.steer * r.driftDir);
      r.angle += r.driftDir * agility * 1.25 * bias * speedFactor * dt;
      r.bodyYaw += (r.driftDir * 0.42 - r.bodyYaw) * Math.min(1, dt * 8);
    } else {
      const slip = r.slipTime > 0 ? -0.7 : 1;
      r.angle += input.steer * agility * speedFactor * slip * dt;
      r.bodyYaw += (input.steer * 0.12 - r.bodyYaw) * Math.min(1, dt * 8);
    }
  }
  if (r.slipTime > 0) r.angle += dt * 3.2;

  // --- Longitudinal ---------------------------------------------------------
  const fx = Math.cos(r.angle);
  const fy = Math.sin(r.angle);
  const rx = -fy;
  const ry = fx;

  let topSpeed = BASE_TOP_SPEED * c.topSpeed * (onRoad ? 1 : GRASS_SPEED);
  if (!r.isPlayer) {
    topSpeed *= diff.cpuSpeed;
    // Gentle rubber banding keeps the pack together without feeling unfair.
    const player = state.racers[state.playerIndex];
    const gap = (player.progress - r.progress) / n;
    topSpeed *= 1 + Math.max(-0.06, Math.min(0.1, gap * 0.22));
  }
  if (r.boostTime > 0) {
    topSpeed *= BOOST_TOP_MULT;
    r.boostTime -= dt;
  }

  let vf = r.vx * fx + r.vy * fy;
  let vl = r.vx * rx + r.vy * ry;

  const accelRate = r.boostTime > 0 ? BOOST_ACCEL : input.throttle ? BASE_ACCEL * c.accel : 0;
  if (accelRate > 0) {
    // Acceleration never pushes past the current ceiling. Speed above it only
    // ever comes from a boost that has since expired, and bleeds off below.
    vf = Math.min(vf + accelRate * dt, Math.max(vf, topSpeed));
  } else if (input.brake) {
    vf -= BRAKE_FORCE * dt;
  }
  if (input.brake && !input.throttle && vf < 0) vf = Math.max(vf, -REVERSE_TOP);

  if (vf > topSpeed) vf = Math.max(topSpeed, vf - SPEED_BLEED * dt);
  if (!input.throttle && !input.brake) vf -= vf * Math.min(1, dt * 1.1);
  if (!onRoad) vf -= vf * Math.min(1, dt * 1.6);
  if (r.spinTime > 0) vf -= vf * Math.min(1, dt * 2.4);

  const grip = (r.drifting ? DRIFT_GRIP : LATERAL_GRIP) * (onRoad ? 1 : 0.55) * c.grip;
  vl *= Math.exp(-grip * dt);

  r.vx = fx * vf + rx * vl;
  r.vy = fy * vf + ry * vl;
  r.speed = vf;

  r.x += r.vx * dt;
  r.y += r.vy * dt;

  // --- Track position, laps -------------------------------------------------
  const idx = nearestIndex(line, r.x, r.y, r.lastIdx);
  const delta = indexDelta(r.lastIdx, idx, n);
  r.progress += delta;
  r.lastIdx = idx;

  const lateral = lateralOffset(line, idx, r.x, r.y);
  if (Math.abs(lateral) > MAX_LATERAL) {
    const home = pointAt(line, idx, Math.sign(lateral) * 40);
    r.x = home.x;
    r.y = home.y;
    const tan = line.tangents[idx];
    r.angle = Math.atan2(tan.y, tan.x);
    r.vx = 0;
    r.vy = 0;
    r.speed = 0;
    r.drifting = false;
    if (r.isPlayer) state.events.push('respawn');
  }

  if (!r.finished) {
    // `lapsCompleted` is a high-water mark, so drifting back over the line and
    // across it again cannot bank the same lap twice.
    const lapsDone = Math.floor(r.progress / n);
    if (lapsDone > r.lapsCompleted) {
      r.lapsCompleted = lapsDone;
      r.lapTimes.push(state.time - r.lapStart);
      r.lapStart = state.time;
      if (r.lapsCompleted >= state.laps) {
        r.finished = true;
        r.finishTime = state.time;
        state.events.push(r.isPlayer ? 'player-finish' : 'cpu-finish');
      } else if (r.isPlayer) {
        state.events.push('lap');
      }
    }
    r.lap = Math.min(state.laps, r.lapsCompleted + 1);
  }

  // --- Trail effects --------------------------------------------------------
  if (r.boostTime > 0 && Math.random() < dt * 60) {
    spawnParticle(state, {
      x: r.x - fx * 32 + (Math.random() - 0.5) * 16,
      y: r.y - fy * 32 + (Math.random() - 0.5) * 16,
      z: 8 + Math.random() * 10,
      vz: 26,
      life: 0.4,
      maxLife: 0.4,
      size: 9,
      color: '#ffb020',
    });
  }
  if (r.drifting && Math.random() < dt * 45) {
    const level = driftLevel(r.driftCharge);
    const colors = ['#dcdcdc', '#4fc3ff', '#ff9a2e', '#c56bff'];
    spawnParticle(state, {
      x: r.x - fx * 20 - rx * r.driftDir * 14,
      y: r.y - fy * 20 - ry * r.driftDir * 14,
      z: 5,
      vz: 34,
      life: 0.35,
      maxLife: 0.35,
      size: 7,
      color: colors[level],
    });
  }
  if (!onRoad && Math.abs(r.speed) > 60 && Math.random() < dt * 40) {
    spawnParticle(state, {
      x: r.x - fx * 22,
      y: r.y - fy * 22,
      z: 4,
      vz: 30,
      life: 0.5,
      maxLife: 0.5,
      size: 8,
      color: '#d8cba0',
    });
  }
}

function resolveCollisions(state: RaceState): void {
  const rs = state.racers;
  for (let i = 0; i < rs.length; i++) {
    for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i];
      const b = rs[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d > KART_COLLIDE_DIST || d < 0.001) continue;

      const nx = dx / d;
      const ny = dy / d;
      const push = (KART_COLLIDE_DIST - d) / 2;
      const ma = char(a.charId).weight;
      const mb = char(b.charId).weight;
      const total = ma + mb;

      a.x -= nx * push * ((mb / total) * 2);
      a.y -= ny * push * ((mb / total) * 2);
      b.x += nx * push * ((ma / total) * 2);
      b.y += ny * push * ((ma / total) * 2);

      const bump = 70;
      a.vx -= nx * bump * (mb / total);
      a.vy -= ny * bump * (mb / total);
      b.vx += nx * bump * (ma / total);
      b.vy += ny * bump * (ma / total);

      if (a.shields > 0 && b.shields === 0) {
        a.shields--;
        spinOut(state, b, 1.1);
      } else if (b.shields > 0 && a.shields === 0) {
        b.shields--;
        spinOut(state, a, 1.1);
      } else if (a.isPlayer || b.isPlayer) {
        state.events.push('bump');
      }
    }
  }
}

function stepProjectiles(state: RaceState, dt: number): void {
  for (let i = state.oils.length - 1; i >= 0; i--) {
    const oil = state.oils[i];
    oil.life -= dt;
    if (oil.life <= 0) {
      state.oils.splice(i, 1);
      continue;
    }
    for (const r of state.racers) {
      if (r.finished || r.invulnTime > 0 || r.slipTime > 0) continue;
      if (Math.hypot(r.x - oil.x, r.y - oil.y) > OIL_HIT_DIST) continue;
      if (r.shields > 0) {
        r.shields--;
      } else {
        r.slipTime = 1.3;
        r.invulnTime = 1.5;
        r.boostTime = 0;
        r.drifting = false;
        r.driftCharge = 0;
        r.vx *= 0.45;
        r.vy *= 0.45;
        state.events.push(r.isPlayer ? 'player-slip' : 'cpu-hit');
      }
      state.oils.splice(i, 1);
      break;
    }
  }

  for (let i = state.homings.length - 1; i >= 0; i--) {
    const h = state.homings[i];
    h.life -= dt;
    if (h.life <= 0) {
      state.homings.splice(i, 1);
      continue;
    }
    const target = h.target >= 0 ? state.racers[h.target] : null;
    if (target) {
      const desired = Math.atan2(target.y - h.y, target.x - h.x);
      const delta = wrapAngle(desired - h.angle);
      h.angle += Math.max(-3.4 * dt, Math.min(3.4 * dt, delta));
    } else {
      // No one ahead: run along the track until it expires.
      const line = state.assets.centerline;
      const idx = nearestIndex(line, h.x, h.y, -1);
      const ahead = pointAt(line, idx + 12, 0);
      const delta = wrapAngle(Math.atan2(ahead.y - h.y, ahead.x - h.x) - h.angle);
      h.angle += Math.max(-3 * dt, Math.min(3 * dt, delta));
    }
    h.x += Math.cos(h.angle) * HOMING_SPEED * dt;
    h.y += Math.sin(h.angle) * HOMING_SPEED * dt;

    for (const r of state.racers) {
      if (r.index === h.owner || r.finished) continue;
      if (Math.hypot(r.x - h.x, r.y - h.y) > HOMING_HIT_DIST) continue;
      spinOut(state, r);
      state.homings.splice(i, 1);
      break;
    }
  }
}

function stepItemBricks(state: RaceState, dt: number): void {
  const spots = state.assets.itemSpots;
  for (let i = 0; i < spots.length; i++) {
    if (state.itemRespawn[i] > 0) {
      state.itemRespawn[i] -= dt;
      continue;
    }
    const s = spots[i];
    for (const r of state.racers) {
      if (r.item || r.finished) continue;
      if (Math.hypot(r.x - s.x, r.y - s.y) > ITEM_PICKUP_DIST) continue;
      r.item = rollItem(r.place);
      r.itemRoll = 0.75;
      state.itemRespawn[i] = 3.5;
      state.events.push(r.isPlayer ? 'item-get' : 'item-get-cpu');
      break;
    }
  }
}

function updatePlaces(state: RaceState): void {
  const order = [...state.racers].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
  order.forEach((r, i) => {
    r.place = i + 1;
  });
}

export function stepRace(state: RaceState, playerInput: RaceInput, dt: number): void {
  if (state.phase === 'countdown') {
    state.countdown -= dt;
    if (state.countdown <= 0) {
      state.phase = 'racing';
      state.countdown = 0;
      state.events.push('go');
    }
    // Karts stay put but the item roulette and shields keep animating.
    for (const r of state.racers) r.shieldAngle += dt * 3.4;
    return;
  }

  state.time += dt;

  for (const r of state.racers) {
    if (r.finished) {
      // Finished karts coast on autopilot so the scene stays alive.
      const input = driveCpu(state, r, dt);
      stepRacer(state, r, {...input, useItem: false}, dt);
      continue;
    }
    const input = r.isPlayer ? playerInput : driveCpu(state, r, dt);
    stepRacer(state, r, input, dt);
  }

  resolveCollisions(state);
  stepProjectiles(state, dt);
  stepItemBricks(state, dt);
  updatePlaces(state);

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.life -= dt;
    p.z += p.vz * dt;
    p.vz -= 60 * dt;
    if (p.life <= 0) state.particles.splice(i, 1);
  }

  const player = state.racers[state.playerIndex];
  if (player.finished && state.phase === 'racing') {
    state.phase = 'finished';
  }
}

export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds <= 0) return "--'--\"---";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds * 1000) % 1000);
  return `${m}'${String(s).padStart(2, '0')}"${String(ms).padStart(3, '0')}`;
}

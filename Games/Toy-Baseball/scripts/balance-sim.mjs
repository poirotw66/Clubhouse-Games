/**
 * Monte-Carlo balance probe for Toy Baseball polish.
 * Run: node --experimental-strip-types scripts/balance-sim.mjs
 *
 * Prints hit / out / HR rates by difficulty and timing quality.
 * Exit 0 always — assertions live in check-baseball.mjs.
 */
import { computeHitLaunch } from '../src/hitting.ts';
import { createRng } from '../src/rng.ts';
import {
  resolveFairBall,
  estimateFlightTime,
  isFoulTerritory,
  FENCE_DIST,
} from '../src/fielding.ts';
import { DIFFICULTY } from '../src/difficulty.ts';
import {
  chooseCpuPitch,
  initialPitchVelocity,
  applyPitchFlight,
  MOUND,
} from '../src/pitching.ts';

const GRAVITY = 600;
const AIR = 0.2;
const DT = 1 / 60;
const HIT_RADIUS = { easy: 80, normal: 60, hard: 42 };

function flyBall(launch) {
  let x = 400;
  let y = 450;
  let z = 5;
  let vx = launch.vel.x;
  let vy = launch.vel.y;
  let vz = launch.vel.z;
  let peakZ = launch.peakZ;
  let t = 0;
  while (z > 0 && y > 40 && t < 5) {
    const sp = Math.hypot(vx, vy, vz) || 1;
    const drag = AIR * sp * DT;
    vx -= (vx / sp) * drag;
    vy -= (vy / sp) * drag;
    vz -= (vz / sp) * drag;
    vz -= GRAVITY * DT;
    x += vx * DT;
    y += vy * DT;
    z += vz * DT;
    peakZ = Math.max(peakZ, z);
    t += DT;
  }
  return { x, y, peakZ, dist: Math.hypot(x - 400, y - 450) };
}

function plateTimingError(ballY) {
  // Negative = early (ball still short of plate), positive = late.
  return (ballY - 450) / 90;
}

function simContact({ difficulty, timingAtPlate, swingDir, seed }) {
  const cfg = DIFFICULTY[difficulty];
  const rng = createRng(seed);
  const choice = chooseCpuPitch({ balls: 1, strikes: 1 }, difficulty, rng);
  const type = choice.type;
  const loc = choice.loc;

  let pos = { ...MOUND };
  let vel = initialPitchVelocity(type, loc);
  let age = 0;
  const hitR = HIT_RADIUS[difficulty];
  let entered = false;
  while (pos.y < 520 && age < 3) {
    applyPitchFlight(vel, type, age, DT, 0);
    pos.x += vel.x * DT;
    pos.y += vel.y * DT;
    pos.z += vel.z * DT;
    age += DT;
    const dist = Math.hypot(pos.x - 400, pos.y - 450);
    if (!entered && dist < hitR) {
      entered = true;
      // Contact at plate-relative timing: shift contact deeper/earlier in the window.
      const targetY = 450 + timingAtPlate * 90;
      // Keep integrating until near targetY or exit radius.
      while (pos.y < targetY && dist < hitR * 1.15 && pos.y < 520) {
        applyPitchFlight(vel, type, age, DT, 0);
        pos.x += vel.x * DT;
        pos.y += vel.y * DT;
        pos.z += vel.z * DT;
        age += DT;
      }
      break;
    }
  }
  if (!entered) return { outcome: 'whiff' };

  const timing = plateTimingError(pos.y);
  const launch = computeHitLaunch({
    swingTime: timing,
    swingDir,
    pitchLoc: loc,
    rng: createRng(seed + 99),
  });
  const land = flyBall(launch);
  if (isFoulTerritory(land.x, land.y)) {
    return { outcome: 'foul', quality: launch.contactQuality };
  }
  const graded = resolveFairBall({
    landingX: land.x,
    landingY: land.y,
    peakZ: land.peakZ,
    quality: launch.contactQuality,
    flightTime: estimateFlightTime(Math.abs(launch.vel.z), land.peakZ),
    cfg,
  });
  return {
    outcome: graded.play,
    bases: graded.bases,
    quality: launch.contactQuality,
    dist: land.dist,
  };
}

function summarize(label, rows) {
  const n = rows.length;
  const counts = {};
  let hits = 0;
  let hrs = 0;
  let singles = 0;
  let extras = 0;
  let outs = 0;
  let q = 0;
  let qn = 0;
  for (const r of rows) {
    counts[r.outcome] = (counts[r.outcome] || 0) + 1;
    if (r.quality != null) {
      q += r.quality;
      qn += 1;
    }
    if (['single', 'double', 'triple', 'homerun'].includes(r.outcome)) hits += 1;
    if (r.outcome === 'homerun') hrs += 1;
    if (r.outcome === 'single') singles += 1;
    if (r.outcome === 'double' || r.outcome === 'triple') extras += 1;
    if (r.outcome === 'catch' || r.outcome === 'groundout') outs += 1;
  }
  console.log(`\n${label} n=${n}`);
  console.log(
    `  avgQ=${qn ? (q / qn).toFixed(3) : '-'} hit=${(hits / n).toFixed(3)} 1B=${(singles / n).toFixed(3)} XBH=${(extras / n).toFixed(3)} HR=${(hrs / n).toFixed(3)} out=${(outs / n).toFixed(3)}`,
  );
  console.log(' ', counts);
}

console.log('FENCE_DIST', FENCE_DIST);

for (const diff of ['easy', 'normal', 'hard']) {
  const rows = [];
  for (let i = 0; i < 500; i++) {
    const rng = createRng(i + 100);
    const timing = (rng() - 0.5) * 0.5; // ±0.25 plate units ~ human scatter
    const dir = ['left', 'center', 'right'][Math.floor(rng() * 3)];
    rows.push(simContact({ difficulty: diff, timingAtPlate: timing, swingDir: dir, seed: 2000 + i }));
  }
  summarize(`${diff} human-ish timing`, rows);
}

{
  const rows = [];
  for (let i = 0; i < 300; i++) {
    rows.push(
      simContact({
        difficulty: 'normal',
        timingAtPlate: 0,
        swingDir: i % 2 === 0 ? 'left' : 'right',
        seed: 9000 + i,
      }),
    );
  }
  summarize('normal perfect timing pull/push (gap aim)', rows);
}

{
  const rows = [];
  for (let i = 0; i < 200; i++) {
    rows.push(
      simContact({
        difficulty: 'normal',
        timingAtPlate: 0,
        swingDir: 'center',
        seed: 11000 + i,
      }),
    );
  }
  summarize('normal perfect timing center', rows);
}

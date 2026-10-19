/**
 * Depth systems check: obstacle profiles, meta save validation,
 * credits/missions/upgrades, jump/dash timing constants.
 */
import assert from 'node:assert/strict';

function collisionProfile(kind) {
  switch (kind) {
    case 'cone':
    case 'lowBarrier':
      return 'jumpable';
    case 'slideBar':
      return 'slideable';
    case 'barrier':
    case 'highGate':
    case 'drone':
    default:
      return 'solid';
  }
}

assert.equal(collisionProfile('cone'), 'jumpable');
assert.equal(collisionProfile('lowBarrier'), 'jumpable');
assert.equal(collisionProfile('slideBar'), 'slideable');
assert.equal(collisionProfile('barrier'), 'solid');
assert.equal(collisionProfile('highGate'), 'solid');
assert.equal(collisionProfile('drone'), 'solid');

function pickObstacleKind(rng, progress) {
  const roll = rng();
  if (progress < 0.2) {
    if (roll < 0.4) return 'cone';
    if (roll < 0.7) return 'barrier';
    return 'drone';
  }
  if (progress < 0.45) {
    if (roll < 0.22) return 'cone';
    if (roll < 0.4) return 'lowBarrier';
    if (roll < 0.55) return 'slideBar';
    if (roll < 0.78) return 'barrier';
    return 'drone';
  }
  if (roll < 0.14) return 'cone';
  if (roll < 0.28) return 'lowBarrier';
  if (roll < 0.42) return 'slideBar';
  if (roll < 0.55) return 'highGate';
  if (roll < 0.78) return 'barrier';
  return 'drone';
}

const lateKinds = new Set();
for (let i = 0; i < 200; i++) {
  lateKinds.add(pickObstacleKind(() => (i % 100) / 100, 0.8));
}
assert.ok(lateKinds.has('slideBar'), 'late patterns should include slide bars');
assert.ok(lateKinds.has('highGate'), 'late patterns should include high gates');
assert.ok(lateKinds.has('lowBarrier'), 'late patterns should include low barriers');

function creditsFromRun({ score, avoids, pickups, powerups }) {
  return Math.floor(score / 45) + avoids * 2 + pickups * 3 + powerups * 8;
}
assert.ok(creditsFromRun({ score: 450, avoids: 5, pickups: 2, powerups: 1 }) >= 10);
assert.equal(creditsFromRun({ score: 0, avoids: 0, pickups: 0, powerups: 0 }), 0);

function dashCooldownSec(level) {
  return Math.max(1.1, 2.6 - level * 0.4);
}
assert.ok(dashCooldownSec(3) < dashCooldownSec(0), 'dash upgrade shortens cooldown');
assert.ok(dashCooldownSec(3) >= 1.1);

function powerDurationMul(level) {
  return 1 + level * 0.28;
}
assert.ok(powerDurationMul(3) > powerDurationMul(0));

function nearMissScoreMul(level) {
  return 1 + level * 0.22;
}
assert.ok(nearMissScoreMul(2) > 1);

function hashDay(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const MISSION_POOL = [
  { id: 'nm10', kind: 'nearMiss', target: 10, reward: 80 },
  { id: 'dist400', kind: 'distance', target: 400, reward: 90 },
  { id: 'cred80', kind: 'credits', target: 80, reward: 100 },
  { id: 'pu3', kind: 'powerups', target: 3, reward: 100 },
  { id: 'fever1', kind: 'fever', target: 1, reward: 70 },
  { id: 'dash5', kind: 'dash', target: 5, reward: 90 },
  { id: 'score3k', kind: 'score', target: 3000, reward: 120 },
  { id: 'perfect5', kind: 'perfect', target: 5, reward: 110 },
];

function pickMissionsForDate(date) {
  const h = hashDay(`cnr-missions:${date}`);
  const pool = MISSION_POOL.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (h + i * 2654435761) % (i + 1);
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  return pool.slice(0, 3);
}

const dayA = pickMissionsForDate('2026-10-19');
const dayA2 = pickMissionsForDate('2026-10-19');
assert.equal(dayA.length, 3);
assert.deepEqual(
  dayA.map((m) => m.id),
  dayA2.map((m) => m.id),
  'same day missions must be stable',
);
// Across a wide date window, at least two distinct mission sets must appear.
const sets = new Set();
for (let m = 1; m <= 12; m++) {
  for (const day of [1, 10, 20, 28]) {
    const key = `2026-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    sets.add(pickMissionsForDate(key).map((x) => x.id).join(','));
  }
}
assert.ok(sets.size >= 2, `missions should rotate across dates, got ${sets.size} unique sets`);

// Jump clears jumpable; dash clears slideable — mirror GameWorld hitsObstacle.
function hitsObstacle(kind, { jumping, dashing }) {
  const profile = collisionProfile(kind);
  if (profile === 'jumpable' && jumping) return false;
  if (profile === 'slideable' && dashing) return false;
  return true;
}
assert.equal(hitsObstacle('cone', { jumping: true, dashing: false }), false);
assert.equal(hitsObstacle('slideBar', { jumping: false, dashing: true }), false);
assert.equal(hitsObstacle('barrier', { jumping: true, dashing: true }), true);
assert.equal(hitsObstacle('highGate', { jumping: true, dashing: false }), true);

// Meta parse must not throw on garbage.
function clampInt(n, min, max, fallback) {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(v)));
}
assert.equal(clampInt('nope', 0, 10, 3), 3);
assert.equal(clampInt(99, 0, 3, 0), 3);
assert.equal(clampInt(-5, 0, 3, 0), 0);

console.log('check-depth: ok');

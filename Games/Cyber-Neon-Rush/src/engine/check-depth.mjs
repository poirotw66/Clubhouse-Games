/**
 * Direct production verification for Cyber Neon Rush depth systems:
 * obstacle collision profiles, procedural obstacle generation distributions,
 * jump/dash clearance mechanics, progression economy, upgrade curves,
 * deterministic daily mission rotation, and meta save validation.
 *
 * Imports directly from production TypeScript modules.
 */
import assert from 'node:assert/strict';
import {
  canClearObstacle,
  collisionProfile,
  dashCanBypassObstacle,
  hitsObstacle,
  pickObstacleKind,
} from './obstacleProfile.ts';
import {
  LANE_WIDTH,
  NEAR_MISS_WINDOW,
  PERFECT_MISS_WINDOW,
} from './constants.ts';
import { createGameWorld } from './GameWorld.ts';
import {
  COSMETIC_CATALOG,
  MISSION_POOL,
  UPGRADE_COST,
  UPGRADE_MAX,
  applyRunToMissions,
  clampInt,
  creditsFromRun,
  dashCooldownSec,
  defaultMeta,
  hashDay,
  magnetRange,
  nearMissScoreMul,
  pickMissionsForDate,
  powerDurationMul,
} from './progress.ts';

// ── 1) Real Obstacle Collision Profiles ──────────────────────────────────────
assert.equal(collisionProfile('cone'), 'jumpable');
assert.equal(collisionProfile('lowBarrier'), 'jumpable');
assert.equal(collisionProfile('slideBar'), 'slideable');
assert.equal(collisionProfile('barrier'), 'solid');
assert.equal(collisionProfile('highGate'), 'solid');
assert.equal(collisionProfile('drone'), 'solid');

// ── 2) Procedural Obstacle Progression & Distributions ───────────────────────
{
  // Early stretch (progress < 0.2): only cone, barrier, drone
  const earlyKinds = new Set();
  for (let i = 0; i < 100; i++) {
    earlyKinds.add(pickObstacleKind(() => (i % 100) / 100, 0.1));
  }
  assert.ok(earlyKinds.has('cone'), 'early run should spawn cones');
  assert.ok(earlyKinds.has('barrier'), 'early run should spawn barriers');
  assert.ok(earlyKinds.has('drone'), 'early run should spawn drones');
  assert.ok(!earlyKinds.has('slideBar'), 'early run should not spawn slide bars');
  assert.ok(!earlyKinds.has('highGate'), 'early run should not spawn high gates');

  // Mid stretch (progress 0.2 - 0.45): introduces lowBarrier, slideBar
  const midKinds = new Set();
  for (let i = 0; i < 100; i++) {
    midKinds.add(pickObstacleKind(() => (i % 100) / 100, 0.35));
  }
  assert.ok(midKinds.has('lowBarrier'), 'mid run should introduce low barriers');
  assert.ok(midKinds.has('slideBar'), 'mid run should introduce slide bars');
  assert.ok(!midKinds.has('highGate'), 'mid run should not yet spawn high gates');

  // Late stretch (progress >= 0.45): all profiles including highGate
  const lateKinds = new Set();
  for (let i = 0; i < 200; i++) {
    lateKinds.add(pickObstacleKind(() => (i % 100) / 100, 0.8));
  }
  assert.ok(lateKinds.has('slideBar'), 'late patterns should include slide bars');
  assert.ok(lateKinds.has('highGate'), 'late patterns should include high gates');
  assert.ok(lateKinds.has('lowBarrier'), 'late patterns should include low barriers');
  assert.ok(lateKinds.has('barrier'), 'late patterns should include barriers');
  assert.ok(lateKinds.has('drone'), 'late patterns should include drones');
}

// ── 3) Action Clearance & Collision Logic ────────────────────────────────────
{
  // Jumping clears jumpable obstacles only
  assert.equal(hitsObstacle('cone', { jumping: true, dashing: false }), false);
  assert.equal(hitsObstacle('lowBarrier', { jumping: true, dashing: false }), false);
  assert.equal(hitsObstacle('slideBar', { jumping: true, dashing: false }), true);
  assert.equal(hitsObstacle('barrier', { jumping: true, dashing: false }), true);
  assert.equal(hitsObstacle('highGate', { jumping: true, dashing: false }), true);
  assert.equal(hitsObstacle('drone', { jumping: true, dashing: false }), true);

  // Dashing clears slideable obstacles only
  assert.equal(hitsObstacle('slideBar', { jumping: false, dashing: true }), false);
  assert.equal(hitsObstacle('cone', { jumping: false, dashing: true }), true);
  assert.equal(hitsObstacle('barrier', { jumping: false, dashing: true }), true);
  assert.equal(hitsObstacle('highGate', { jumping: false, dashing: true }), true);
  assert.equal(hitsObstacle('drone', { jumping: false, dashing: true }), true);

  // Standing still hits all obstacles
  assert.equal(hitsObstacle('cone', { jumping: false, dashing: false }), true);
  assert.equal(hitsObstacle('slideBar', { jumping: false, dashing: false }), true);
  assert.equal(hitsObstacle('barrier', { jumping: false, dashing: false }), true);

  // Solid obstacles cannot be cleared by jump or dash
  assert.equal(canClearObstacle('barrier', { jumping: true, dashing: true }), false);
  assert.equal(canClearObstacle('highGate', { jumping: true, dashing: true }), false);
  assert.equal(canClearObstacle('drone', { jumping: true, dashing: true }), false);

  // Dash i-frame boundaries: dash cannot bypass solid barriers/highGates/drones
  assert.equal(dashCanBypassObstacle('barrier'), false, 'dash iframe cannot bypass solid barrier');
  assert.equal(dashCanBypassObstacle('highGate'), false, 'dash iframe cannot bypass solid high gate');
  assert.equal(dashCanBypassObstacle('drone'), false, 'dash iframe cannot bypass solid drone');
  assert.equal(dashCanBypassObstacle('slideBar'), true, 'slideBar is bypassed cleanly by dash');
  assert.equal(dashCanBypassObstacle('cone'), true, 'cone is non-solid');
  assert.equal(dashCanBypassObstacle('lowBarrier'), true, 'lowBarrier is non-solid');
}

// ── 4) Progression Economy & Upgrade Curves ──────────────────────────────────
{
  // Credit calculation formula
  assert.equal(creditsFromRun({ score: 0, avoids: 0, pickups: 0, powerups: 0 }), 0);
  const payout = creditsFromRun({ score: 450, avoids: 5, pickups: 2, powerups: 1 });
  // 450 / 45 = 10 + 5*2(10) + 2*3(6) + 1*8(8) = 34
  assert.equal(payout, 34);

  // Dash cooldown upgrade curve
  assert.equal(dashCooldownSec(0), 2.6);
  assert.ok(dashCooldownSec(1) < dashCooldownSec(0));
  assert.ok(dashCooldownSec(3) <= 1.4);
  assert.ok(dashCooldownSec(3) >= 1.1, 'dash cooldown must respect minimum clamp');

  // Power duration curve
  assert.equal(powerDurationMul(0), 1.0);
  assert.ok(powerDurationMul(1) > powerDurationMul(0));
  assert.ok(powerDurationMul(3) > 1.8);

  // Near miss score bonus curve
  assert.equal(nearMissScoreMul(0), 1.0);
  assert.ok(nearMissScoreMul(2) > 1.4);

  // Magnet range curve
  assert.equal(magnetRange(0, false), 0);
  assert.ok(magnetRange(0, true) > 3.0);
  assert.ok(magnetRange(2, true) > magnetRange(0, true));

  // Upgrade catalog definitions & cost consistency
  for (const [id, maxLevel] of Object.entries(UPGRADE_MAX)) {
    const costs = UPGRADE_COST[id];
    assert.equal(costs.length, maxLevel, `cost array length for ${id} must match max level ${maxLevel}`);
    for (const cost of costs) {
      assert.ok(cost > 0, `upgrade cost must be positive for ${id}`);
    }
  }

  // Cosmetics catalog
  assert.ok('cyan' in COSMETIC_CATALOG, 'cyan must exist');
  assert.equal(COSMETIC_CATALOG.cyan.cost, 0, 'starter cyan skin must be free');
  for (const [id, cosmetic] of Object.entries(COSMETIC_CATALOG)) {
    assert.ok(typeof cosmetic.name === 'string' && cosmetic.name.length > 0, `cosmetic ${id} must have name`);
    assert.ok(cosmetic.cost >= 0, `cosmetic ${id} must have non-negative cost`);
  }
}

// ── 5) Daily Mission Pool & Deterministic Rotation ───────────────────────────
{
  assert.ok(MISSION_POOL.length >= 8, 'mission pool must contain at least 8 mission definitions');
  const poolIds = new Set(MISSION_POOL.map((m) => m.id));
  assert.equal(poolIds.size, MISSION_POOL.length, 'all mission IDs in pool must be distinct');

  // Hash determinism
  assert.equal(hashDay('2026-10-19'), hashDay('2026-10-19'));
  assert.notEqual(hashDay('2026-10-19'), hashDay('2026-10-20'));

  // Stable day missions
  const dayA1 = pickMissionsForDate('2026-10-19');
  const dayA2 = pickMissionsForDate('2026-10-19');
  assert.equal(dayA1.length, 3);
  assert.deepEqual(
    dayA1.map((m) => m.id),
    dayA2.map((m) => m.id),
    'same day missions must be stable and deterministic',
  );

  // Verify missions rotate across different calendar dates
  const sets = new Set();
  for (let m = 1; m <= 12; m++) {
    for (const day of [1, 10, 20, 28]) {
      const key = `2026-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      sets.add(pickMissionsForDate(key).map((x) => x.id).join(','));
    }
  }
  assert.ok(sets.size >= 5, `missions should rotate across dates, got ${sets.size} unique sets`);
}

// ── 6) Meta Save Parsing, Clamping & Progress Application ────────────────────
{
  // clampInt robustness
  assert.equal(clampInt('invalid', 0, 10, 3), 3);
  assert.equal(clampInt(null, 0, 10, 5), 5);
  assert.equal(clampInt(99, 0, 3, 0), 3);
  assert.equal(clampInt(-5, 0, 3, 0), 0);
  assert.equal(clampInt(2.7, 0, 10, 0), 2);

  // defaultMeta integrity
  const meta = defaultMeta();
  assert.equal(meta.credits, 0);
  assert.equal(meta.equippedCosmetic, 'cyan');
  assert.deepEqual(meta.unlockedCosmetics, ['cyan']);
  assert.equal(meta.missions.length, 3);

  // applyRunToMissions progress tracking
  const updated = applyRunToMissions(meta, {
    nearMiss: 5,
    perfect: 2,
    distance: 350,
    credits: 40,
    powerups: 2,
    fever: 1,
    dash: 3,
    score: 1500,
  });
  assert.ok(updated.missions.length === 3);
  for (const m of updated.missions) {
    if (m.kind === 'nearMiss') assert.equal(m.progress, 5);
    if (m.kind === 'fever') assert.equal(m.progress, 1);
  }
}

// ── 7) Near-Miss Precision, Mid-Jump Fast-Fall & Input Buffering ─────────────
{
  // Near-miss window tightening verification:
  // Cruising down an adjacent lane gives lateral distance = LANE_WIDTH = 2.4.
  // Since NEAR_MISS_WINDOW is tightened to 2.0, adjacent-lane cruising never auto-procs near-miss.
  assert.ok(NEAR_MISS_WINDOW < LANE_WIDTH, 'NEAR_MISS_WINDOW must be smaller than LANE_WIDTH');
  assert.ok(LANE_WIDTH - NEAR_MISS_WINDOW >= 0.35, 'comfortable margin preventing passive adjacent lane farming');

  // Verify that a cruising adjacent lane pass does not satisfy near-miss window
  const cruisingAdjacentLateral = LANE_WIDTH; // 2.4
  assert.equal(cruisingAdjacentLateral < NEAR_MISS_WINDOW, false, 'cruising down adjacent lane must not satisfy near-miss window');

  // Verify that an active swerve or same-lane clearance within window satisfies it
  const activeSwerveLateral = 1.8;
  assert.equal(activeSwerveLateral < NEAR_MISS_WINDOW, true, 'tight swerve within 2.0m qualifies for near-miss');

  // Dash vs Solid obstacle collision verification
  assert.equal(hitsObstacle('barrier', { dashing: true }), true, 'dashing into solid barrier still hits');
  assert.equal(hitsObstacle('highGate', { dashing: true }), true, 'dashing into high gate still hits');
  assert.equal(hitsObstacle('drone', { dashing: true }), true, 'dashing into drone still hits');
  assert.equal(hitsObstacle('slideBar', { dashing: true }), false, 'dashing under slideBar clears cleanly');
  assert.equal(dashCanBypassObstacle('barrier'), false, 'dash iframe cannot bypass solid barrier');
  assert.equal(dashCanBypassObstacle('slideBar'), true, 'dash iframe bypasses slideBar');

  const world = createGameWorld({
    difficulty: 'normal',
    upgrades: defaultMeta().upgrades,
    cosmeticId: 'cyan',
  });
  world.start();

  // Test jump action sets jumpAir
  assert.equal(world.getHud().jumpAir, false);
  world.jump();
  assert.equal(world.getHud().jumpAir, true, 'jumping must set jumpAir to true');

  // Test pressing dash mid-jump cancels float into fast-fall slam
  world.dash();
  assert.equal(world.getHud().jumpAir, false, 'pressing dash mid-jump must cancel float into fast-fall');
  assert.equal(world.getHud().dashReady, false, 'dash must enter cooldown');

  // Test jump input buffer: pressing jump while airborne or dashing buffers the action
  world.jump(); // buffered because dash is active
  world.step?.(0.4); // dash ends -> buffered jump executes!
  assert.equal(world.getHud().jumpAir, true, 'buffered jump executes once dash ends');

  // Cancel jump with fast-fall again
  world.step?.(1.5); // cooldown expires
  world.dash();
  assert.equal(world.getHud().jumpAir, false, 'fast-fall cancels buffered jump float');
}

console.log('check-depth: ok');

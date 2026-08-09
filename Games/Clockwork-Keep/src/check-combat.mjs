/**
 * Headless checks for combat math:
 *  - flat-reduction armor (subtract, don't multiply, floor at 0)
 *  - slow stacking takes the strongest single effect, floored at 40% speed
 *  - chain tower hits at most 3 targets
 *  - targeting always picks the enemy closest to the exit
 *
 * Run: node --experimental-strip-types src/check-combat.mjs
 */
import assert from 'node:assert/strict';
import { MIN_SPEED_FACTOR } from './game/constants.ts';
import {
  applyDamage,
  applySlow,
  chainTargets,
  currentSpeedFactor,
  enemiesInRange,
  selectPrimaryTarget,
} from './game/combat.ts';

let nextId = 1;
function makeEnemy(overrides = {}) {
  return {
    id: nextId++,
    type: 'grunt',
    hp: 100,
    maxHp: 100,
    armor: 0,
    baseSpeed: 1,
    flying: false,
    killReward: 1,
    lifeCost: 1,
    cellX: 0,
    cellY: 0,
    dirX: 1,
    dirY: 0,
    progress: 0,
    flightProgress: 0,
    slowEffects: [],
    distanceToExit: 5,
    worldX: 0,
    worldY: 0,
    reachedExit: false,
    dead: false,
    spawnOrder: nextId,
    ...overrides,
  };
}

// ── 1) Flat-reduction armor math ────────────────────────────────────────────
{
  const e = makeEnemy({ hp: 100, armor: 6 });
  const dealt = applyDamage(e, 8);
  assert.equal(dealt, 2, `flat armor: 8 raw - 6 armor = 2 dealt, got ${dealt}`);
  assert.equal(e.hp, 98);

  // A high-fire-rate, low-single-hit tower becomes nearly useless against armor,
  // which is the whole point of flat (not percent) reduction — verify it floors at 0,
  // never goes negative and never heals.
  const armored = makeEnemy({ hp: 50, armor: 20 });
  const weakHit = applyDamage(armored, 8);
  assert.equal(weakHit, 0, 'raw damage at or below armor should deal exactly 0, not negative');
  assert.equal(armored.hp, 50, 'hp must not increase from a fully-absorbed hit');

  // Death flag flips exactly at 0 hp.
  const dying = makeEnemy({ hp: 5, armor: 0 });
  applyDamage(dying, 5);
  assert.equal(dying.hp, 0);
  assert.equal(dying.dead, true);
}

// ── 2) Slow: strongest effect wins, not multiplicative, floored at 40% ─────
{
  const e = makeEnemy();
  assert.equal(currentSpeedFactor(e), 1, 'no slow effects should mean full speed');

  applySlow(e, 0.3, 2);
  assert.ok(
    Math.abs(currentSpeedFactor(e) - 0.7) < 1e-9,
    `single 30% slow should give 0.7 speed factor, got ${currentSpeedFactor(e)}`,
  );

  // A second, weaker slow must NOT stack additively/multiplicatively with the first.
  applySlow(e, 0.15, 2);
  assert.ok(
    Math.abs(currentSpeedFactor(e) - 0.7) < 1e-9,
    `weaker second slow must not reduce speed further, got ${currentSpeedFactor(e)}`,
  );

  // A stronger slow overrides — still just "strongest wins", never multiplied together.
  applySlow(e, 0.5, 2);
  assert.ok(
    Math.abs(currentSpeedFactor(e) - 0.5) < 1e-9,
    `stronger slow should raise the reduction to 0.5 factor, got ${currentSpeedFactor(e)}`,
  );

  // Three overlapping heavy slows must still floor at MIN_SPEED_FACTOR (40%), not multiply down toward 0.
  const heavy = makeEnemy();
  applySlow(heavy, 0.8, 5);
  applySlow(heavy, 0.9, 5);
  applySlow(heavy, 0.99, 5);
  assert.ok(
    Math.abs(currentSpeedFactor(heavy) - MIN_SPEED_FACTOR) < 1e-9,
    `overlapping heavy slows must floor at ${MIN_SPEED_FACTOR}, got ${currentSpeedFactor(heavy)}`,
  );
  assert.ok(currentSpeedFactor(heavy) > 0, 'slow must never fully stop an enemy');
}

// ── 3) Chain tower hits at most 3 targets ───────────────────────────────────
{
  const primary = makeEnemy({ worldX: 0, worldY: 0 });
  const near1 = makeEnemy({ worldX: 1, worldY: 0 });
  const near2 = makeEnemy({ worldX: 2, worldY: 0 });
  const near3 = makeEnemy({ worldX: 3, worldY: 0 });
  const near4 = makeEnemy({ worldX: 4, worldY: 0 }); // within radius of near3 but chain cap should exclude it
  const candidates = [primary, near1, near2, near3, near4];

  const hit = chainTargets(primary, candidates, 3, 2.5);
  assert.equal(hit.length, 3, `chain should hit exactly 3 targets when enough are in range, got ${hit.length}`);
  assert.equal(hit[0], primary, 'chain must start at the primary target');
  const hitIds = new Set(hit.map((h) => h.id));
  assert.ok(hitIds.has(near1.id) && hitIds.has(near2.id), 'chain should jump to the nearest unhit targets first');
  assert.ok(!hitIds.has(near4.id), 'chain must not exceed the 3-target cap even with more in range');

  // Fewer in-radius candidates than the cap: chain should just take what's there, no crash / no duplicates.
  const isolatedPrimary = makeEnemy({ worldX: 0, worldY: 0 });
  const farAway = makeEnemy({ worldX: 100, worldY: 100 });
  const short = chainTargets(isolatedPrimary, [isolatedPrimary, farAway], 3, 2.5);
  assert.equal(short.length, 1, 'chain should not fabricate targets beyond chain radius');
}

// ── 4) Targeting always picks the enemy closest to the exit ────────────────
{
  const far = makeEnemy({ distanceToExit: 8, worldX: 0, worldY: 0 });
  const mid = makeEnemy({ distanceToExit: 4, worldX: 1, worldY: 0 });
  const close = makeEnemy({ distanceToExit: 1, worldX: 2, worldY: 0 });
  const picked = selectPrimaryTarget([far, mid, close]);
  assert.equal(picked, close, 'primary target must be whichever candidate is closest to the exit');

  // Deterministic tie-break by spawnOrder when distanceToExit is identical.
  const tieA = makeEnemy({ distanceToExit: 3, spawnOrder: 5 });
  const tieB = makeEnemy({ distanceToExit: 3, spawnOrder: 2 });
  const tiePick = selectPrimaryTarget([tieA, tieB]);
  assert.equal(tiePick, tieB, 'tie on distanceToExit must resolve deterministically by spawnOrder');

  // Range filtering: enemiesInRange must respect both radius and air/ground eligibility.
  const ground = makeEnemy({ worldX: 0, worldY: 0, flying: false });
  const flyer = makeEnemy({ worldX: 0.5, worldY: 0, flying: true });
  const outOfRange = makeEnemy({ worldX: 10, worldY: 10, flying: false });
  const inRangeGroundOnly = enemiesInRange([ground, flyer, outOfRange], 0, 0, 2, false);
  assert.deepEqual(
    inRangeGroundOnly.map((e) => e.id),
    [ground.id],
    'a ground-only tower must ignore both flyers and out-of-range enemies',
  );
  const inRangeAntiAir = enemiesInRange([ground, flyer, outOfRange], 0, 0, 2, true);
  assert.equal(inRangeAntiAir.length, 2, 'an anti-air tower should see both the ground and flying target in range');
}

console.log('check-combat: ok');

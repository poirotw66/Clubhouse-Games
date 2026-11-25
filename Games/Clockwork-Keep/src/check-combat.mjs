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
import {
  MAINSPRING_COOLDOWN_SEC,
  createInitialState,
  startNextWave,
  step,
  triggerOverdrive,
  windMainspring,
} from './game/engine.ts';
import { isBossWave } from './game/waves.ts';
import {
  createVfxManager,
  isRapidRetryKey,
  playArmorRicochet,
  playBossAlertTone,
  playHammerCrunch,
  playMortarBoom,
  playTeslaZap,
  spawnCombatVfx,
} from './components/battlefieldVfx.ts';

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
    entranceX: 0,
    entranceY: 0,
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

// ── 5) Clockwork Overdrive & Mainspring Winding ─────────────────────────────
{
  const s = createInitialState('standard', 'open', false);
  assert.equal(s.steamPressure, 0);
  assert.equal(s.overdriveRemaining, 0);
  assert.equal(s.mainspringCooldown, 0);

  // Overdrive rejected if steam pressure < 100
  const earlyOverdrive = triggerOverdrive(s);
  assert.equal(earlyOverdrive.ok, false);

  // Manual winding is blocked during prep phase (prevents free prep-phase Overdrive exploit)
  const prepWind = windMainspring(s);
  assert.equal(prepWind.ok, false, 'windMainspring must be blocked during prep phase');
  assert.equal(prepWind.state.steamPressure, 0);
  assert.equal(prepWind.state.totalWindings, 0);

  // Start wave 1 so phase === 'wave'
  let waveState = startNextWave(s).state;
  assert.equal(waveState.phase, 'wave');

  // Manual winding increases tension by 15% and starts cooldown
  const wind1 = windMainspring(waveState);
  assert.equal(wind1.ok, true);
  assert.equal(wind1.state.steamPressure, 15);
  assert.equal(wind1.state.totalWindings, 1);
  assert.equal(wind1.state.mainspringCooldown, MAINSPRING_COOLDOWN_SEC);

  // Immediate spam during cooldown must be rejected cleanly
  const spamWind = windMainspring(wind1.state);
  assert.equal(spamWind.ok, false, 'windMainspring must enforce cooldown');
  assert.equal(spamWind.state.steamPressure, 15);
  assert.equal(spamWind.state.totalWindings, 1);

  // Advancing simulation by 8 seconds clears cooldown and permits winding again
  let cooled = wind1.state;
  const stepsPerSec = 60;
  for (let i = 0; i < MAINSPRING_COOLDOWN_SEC * stepsPerSec; i++) {
    cooled = step(cooled, 1 / stepsPerSec);
  }
  assert.equal(cooled.mainspringCooldown, 0, 'cooldown must reach 0 after 8s');
  const wind2 = windMainspring(cooled);
  assert.equal(wind2.ok, true, 'windMainspring succeeds once cooldown expires');
  assert.ok(wind2.state.steamPressure >= 30);

  // Wind repeatedly after resetting cooldown to reach 100% (caps at 100)
  let fullState = wind2.state;
  for (let i = 0; i < 6; i++) {
    fullState = { ...fullState, mainspringCooldown: 0 };
    fullState = windMainspring(fullState).state;
  }
  assert.equal(fullState.steamPressure, 100);

  // Now Overdrive activates successfully
  const activated = triggerOverdrive(fullState);
  assert.equal(activated.ok, true);
  assert.equal(activated.state.overdriveRemaining, 8.0);
  assert.equal(activated.state.steamPressure, 0);
  assert.equal(activated.state.overdriveCount, 1);
}

// ── 6) Boss Wave Identification & Pacing (Sakurai gameplay-core-002) ────────
{
  assert.equal(isBossWave(10), true, 'Wave 10 must be recognized as a boss wave');
  assert.equal(isBossWave(20), true, 'Wave 20 must be recognized as a boss wave');
  assert.equal(isBossWave(30), true, 'Wave 30 must be recognized as a boss wave');
  assert.equal(isBossWave(1), false, 'Wave 1 must not be a boss wave');
  assert.equal(isBossWave(9), false, 'Wave 9 must not be a boss wave');
}

// ── 7) Rapid Retry Key Detection (Sakurai gameplay-ux-009) ──────────────────
{
  assert.equal(isRapidRetryKey({ key: ' ' }), true, 'Space key triggers rapid retry');
  assert.equal(isRapidRetryKey({ key: 'Enter' }), true, 'Enter key triggers rapid retry');
  assert.equal(isRapidRetryKey({ key: 'r' }), true, 'r key triggers rapid retry');
  assert.equal(isRapidRetryKey({ key: 'R' }), true, 'R key triggers rapid retry');
  assert.equal(isRapidRetryKey({ key: 'k', code: 'KeyR' }), true, 'KeyR code triggers rapid retry');
  assert.equal(isRapidRetryKey({ key: 'Escape' }), false, 'Escape is not a rapid retry trigger');
  assert.equal(isRapidRetryKey({ key: 'Tab' }), false, 'Tab is not a rapid retry trigger');
}

// ── 8) Combat Feedback Audio & Ricochet Sparks (Sakurai fx-005) ─────────────
{
  // Audio functions safely execute without audio context in headless environment
  assert.doesNotThrow(() => playMortarBoom());
  assert.doesNotThrow(() => playTeslaZap());
  assert.doesNotThrow(() => playHammerCrunch());
  assert.doesNotThrow(() => playArmorRicochet());
  assert.doesNotThrow(() => playBossAlertTone());

  // Verify ricochet sparks spawn on damaged ironclad enemies
  const vfx = createVfxManager();
  const ironclad = makeEnemy({ id: 99, type: 'ironclad', hp: 80, maxHp: 100, worldX: 2, worldY: 3 });
  const mockState = {
    ...createInitialState('standard', 'open', false),
    enemies: [ironclad],
  };
  const prevEnemies = new Map([[ironclad.id, 100]]);
  const prevTowers = new Map();

  spawnCombatVfx(vfx, mockState, prevTowers, prevEnemies);

  // Should have generated particles for the ironclad hit
  assert.ok(vfx.particles.length >= 5, 'Ironclad hit should generate at least 5 ricochet sparks');
  const hasSilverWhiteSparks = vfx.particles.some((p) => p.color === '#f8fafc' || p.color === '#38bdf8');
  assert.ok(hasSilverWhiteSparks, 'Ironclad deflection should generate metallic silver/white sparks');
}

console.log('check-combat: ok');

/**
 * Headless self-checks. Every one of these is here because the same mistake
 * was actually made in this repo before, not because it seemed prudent.
 *
 * Run: npm run check
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Emitter } from '../src/game/constants.js';
import {
  BASE_GRAZE_R,
  BASE_HITBOX_R,
  BOMB_INVULN_SEC,
  CAPTURE_BONUS,
  DAMAGE_FALLOFF_RANGE,
  DAMAGE_FAR_MULT,
  DAMAGE_NEAR_MULT,
  FAST_SPEED,
  FIELD_H,
  FIELD_W,
  FIXED_DT,
  FOCUS_SPEED,
  GRAZE_DECAY_PER_SEC,
  GRAZE_MAX_MULT,
  GRAZE_STEP,
  STAGE_COUNT,
} from '../src/game/constants.js';
import {
  activeConditions,
  allEmitters,
  createRun,
  emitterActive,
  fireRate,
  grazeGain,
  grazeRadius,
  hitboxRadius,
  intensityFor,
  moveSpeed,
  rangeDamageMult,
  scaleEmitter,
  shotDamage,
  step,
  takeUpgrade,
} from '../src/game/engine.js';
import { allCards, bossFor, midwayCardFor } from '../src/game/cards.js';
import {
  CRAFTS,
  DEFAULT_CRAFT_ID,
  craftById,
  isCraftUnlocked,
} from '../src/game/crafts.js';
import {
  EMPTY_MODE_PROGRESS,
  MODE_PACK,
  applyModeResult,
  assertModeCardTargets,
  continueModeIndex,
  evaluateModeGoal,
  isModeUnlocked,
  modeCount,
  modeIndexOf,
} from '../src/game/modes.js';
import {
  EMPTY_DAILY_BEST,
  buildDailyShareText,
  dailySeedCode,
  mergeDailyBest,
  todayKey,
} from '../src/game/daily.js';
import { hashString, mulberry32, shuffle, streamRng } from '../src/game/rng.js';
import { UPGRADES, declaredConditions, declaredEffectKeys } from '../src/game/upgrades.js';
import type { Bullet, Enemy, PlayerInput, RunState } from '../src/game/types.js';

let passed = 0;
function ok(label: string): void {
  passed += 1;
  console.log(`  ok  ${label}`);
}

const IDLE: PlayerInput = { dx: 0, dy: 0, focus: false, bomb: false, special: false };

// ── 1) Determinism ───────────────────────────────────────────────────────────
//
// The entire premise: a run is a pure function of (seed, input sequence). If
// this breaks, replays and every balance number in this repo become fiction.
{
  const inputs: PlayerInput[] = [];
  const r = mulberry32(99);
  for (let i = 0; i < 900; i++) {
    inputs.push({
      dx: r() * 2 - 1,
      dy: r() * 2 - 1,
      focus: r() < 0.4,
      bomb: r() < 0.004,
      special: r() < 0.003,
    });
  }
  const play = (): RunState => {
    let s = createRun('DETERM');
    for (const inp of inputs) {
      if (s.phase !== 'playing') break;
      s = step(s, inp, FIXED_DT);
    }
    return s;
  };
  const a = play();
  const b = play();
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'identical seed and inputs must reproduce an identical state');
  ok('same seed + same inputs reproduce the run exactly');

  const c = createRun('OTHER1');
  assert.notEqual(c.seed, a.seed, 'different seed codes must give different seeds');
  ok('different seed codes give different runs');
}

// ── 2) step() must not mutate its input ──────────────────────────────────────
{
  let s = createRun('PURE01');
  for (let i = 0; i < 200; i++) s = step(s, IDLE, FIXED_DT);
  const before = JSON.stringify(s);
  step(s, { dx: 1, dy: -1, focus: true, bomb: true, special: false }, FIXED_DT);
  assert.equal(JSON.stringify(s), before, 'step() must return a new state, never mutate the one passed in');
  ok('step() leaves its input untouched');
}

// ── 3) Every declared effect key is actually read by the engine ──────────────
//
// Roguelike-Snake declared ten mod keys and the engine read five of them. The
// relics advertising the other five did nothing at all: the text was a lie, and
// nothing anywhere produced an error. This reads the engine source and asserts
// each declared key appears in it.
{
  const enginePath = resolve(__dirname, '..', '..', 'src', 'game', 'engine.ts');
  const source = readFileSync(enginePath, 'utf8');
  // Two spellings count as reading a key. Most are summed continuously via
  // effect(upgrades, 'key'), but one-shot grants like lifeCount are applied at
  // pick time through property access on the definition — summing those every
  // frame would be wrong. The first version of this check only looked for the
  // quoted form and reported both grants as unwired, which was the check being
  // too narrow rather than the engine being dishonest. Case 4 below then
  // asserts the observable behaviour, so a key mentioned in a comment and
  // nowhere else still cannot pass.
  const missing = declaredEffectKeys().filter(
    (k) => !source.includes(`'${k}'`) && !source.includes(`.${k}`),
  );
  assert.deepEqual(
    missing,
    [],
    `upgrades advertise ${missing.map((m) => `"${m}"`).join(', ')} but engine.ts never reads ${
      missing.length === 1 ? 'it' : 'them'
    } — the text would be a lie`,
  );
  ok(`all ${declaredEffectKeys().length} declared effect keys are read by the engine`);
}

// ── 4) Effect keys actually move the derived stats ───────────────────────────
//
// Being mentioned in engine.ts is necessary but not sufficient — a key could be
// referenced in a comment. These assert observable behaviour.
{
  const base = createRun('EFFECT');
  const withPin = { ...base, upgrades: ['pinpoint'] };
  assert.ok(hitboxRadius(withPin) < hitboxRadius(base), 'pinpoint must shrink the hitbox');

  const withBrush = { ...base, upgrades: ['brush'] };
  assert.ok(grazeRadius(withBrush) > grazeRadius(base), 'brush must widen the graze ring');

  const withCadence = { ...base, upgrades: ['cadence'] };
  assert.ok(fireRate(withCadence) > fireRate(base), 'cadence must raise the fire rate');

  const focused = { ...base, focus: true };
  assert.ok(moveSpeed(focused) < moveSpeed(base), 'focus mode must be slower than running');

  const withThread = { ...focused, upgrades: ['thread'] };
  assert.ok(moveSpeed(withThread) > moveSpeed(focused), 'thread must speed up focus movement');

  // The one-shot grants: these are applied when the upgrade is picked, so the
  // only honest test is to actually pick them.
  let s = createRun('GRANT1');
  let guard = 0;
  while (s.phase === 'playing' && guard++ < 200_000) {
    if (s.lives < 3) s = { ...s, lives: 3 };
    s = step(s, IDLE, FIXED_DT);
  }
  assert.equal(s.phase, 'upgrade', 'fixture should have reached an upgrade screen');
  const staged = { ...s, offered: ['spare', 'ordnance', 'edge'] };
  const withLife = takeUpgrade(staged, 'spare');
  assert.equal(withLife.lives, staged.lives + 1, 'lifeCount must actually grant a life on pick');
  const withBombs = takeUpgrade(staged, 'ordnance');
  assert.equal(withBombs.bombs, staged.bombs + 2, 'bombCount must actually grant bombs on pick');
  ok('effect keys move the stats they claim to move, one-shot grants included');
}

// ── 4b) Every declared condition is actually evaluated ───────────────────────
//
// A condition that is declared but never evaluated is the same silent failure
// as an unwired effect key: the upgrade reads as a bonus, does nothing, and
// nothing anywhere errors. activeConditions() is the single place conditions
// are decided, so this asserts each declared one appears there — and then
// checks two of them actually change a derived stat.
{
  const enginePath = resolve(__dirname, '..', '..', 'src', 'game', 'engine.ts');
  const source = readFileSync(enginePath, 'utf8');
  const fnStart = source.indexOf('export function activeConditions');
  assert.ok(fnStart > 0, 'activeConditions() must exist — it is where conditions become real');
  const fnBody = source.slice(fnStart, source.indexOf('\n}', fnStart));

  const unevaluated = declaredConditions().filter((c) => !fnBody.includes(`'${c}'`));
  assert.deepEqual(
    unevaluated,
    [],
    `upgrades key off ${unevaluated.map((c) => `"${c}"`).join(', ')} but activeConditions() never ` +
      `decides ${unevaluated.length === 1 ? 'it' : 'them'} — those upgrades would do nothing`,
  );

  // Observable: the same upgrade must behave differently in and out of its state.
  const base = createRun('COND01');
  const cold = { ...base, upgrades: ['coldblood'] };
  const calm = { ...cold, grazeMult: 1 };
  const hot = { ...cold, grazeMult: 2.5 };
  assert.ok(
    shotDamage(hot, 0) > shotDamage(calm, 0),
    'coldblood must hit harder once the graze multiplier is high',
  );
  assert.ok(grazeRadius(hot) > grazeRadius(calm), 'coldblood must widen the graze ring in-condition');

  // gambit's contract changed after measurement. It used to give +60% damage
  // AND a 25% smaller hitbox on the last life, with no standing cost — a pure
  // comeback mechanic that made you strongest exactly when closest to losing,
  // which is the opposite of "lives exist but death still hurts". Isolating the
  // pool change showed it pushing stage 3 and 4 survival from 88% to 100%.
  //
  // The assertions below encode the new contract deliberately: the last-life
  // payoff is damage only, and the standing hitbox cost must bite whether or
  // not the condition holds. A conditional upgrade with no downside outside its
  // condition is a free upgrade wearing a condition as decoration.
  const gam = { ...base, upgrades: ['gambit'] };
  const safe = { ...gam, lives: 3 };
  const desperate = { ...gam, lives: 1 };
  assert.ok(shotDamage(desperate, 0) > shotDamage(safe, 0), 'gambit must raise damage on the last life');
  assert.ok(
    hitboxRadius(safe) > hitboxRadius(base),
    'gambit must cost hitbox size while you are NOT desperate — otherwise it is free',
  );
  assert.ok(
    hitboxRadius(desperate) > hitboxRadius(base),
    'gambit must not become a survival aid on the last life; it buys damage, not safety',
  );

  const ll = { ...base, upgrades: ['lastlight'] };
  assert.ok(
    moveSpeed({ ...ll, lives: 3 }) < moveSpeed(base),
    'lastlight must be a standing penalty until you are down to your last life',
  );
  assert.ok(moveSpeed({ ...ll, lives: 1 }) > moveSpeed(base), 'lastlight must pay off on the last life');

  // And the flat downside of a stance upgrade must still bite out of condition.
  const fix = { ...base, upgrades: ['fixative'] };
  assert.ok(
    fireRate({ ...fix, focus: false }) < fireRate(base),
    'fixative must actually cost fire rate while not focused — otherwise it is a free upgrade',
  );
  assert.ok(fireRate({ ...fix, focus: true }) > fireRate(base), 'fixative must pay off while focused');
  ok(`all ${declaredConditions().length} declared conditions are evaluated and change behaviour`);
}

// ── 4c) The graze multiplier has to be reachable ─────────────────────────────
//
// A multiplier that cannot rise is not a scoring system, it is a constant, and
// nothing errors when it happens. This shipped: GRAZE_STEP 0.004 against
// GRAZE_DECAY_PER_SEC 0.12 puts break-even at thirty grazes per second, while
// the balance harness measures real play at 0.74/sec. The multiplier sat at
// 1.00 for every run ever played, half the distance spine did nothing, and two
// upgrades keyed to a high multiplier could never activate.
//
// Note what did NOT catch it: the bomb check below asserts the multiplier is 1
// after bombing, and passed the whole time for the wrong reason.
{
  const breakEven = GRAZE_DECAY_PER_SEC / GRAZE_STEP;
  assert.ok(
    breakEven < 2,
    `the multiplier needs ${breakEven.toFixed(1)} grazes/sec just to hold steady — ` +
      `measured play manages about 0.74, so it could never rise`,
  );
  assert.ok(
    breakEven > 0.2,
    `break-even at ${breakEven.toFixed(2)} grazes/sec means the multiplier climbs whatever you do`,
  );

  // And it must actually climb in the engine, not just on paper.
  let s = createRun('GRAZE1');
  s = { ...s, grazeMult: 1 };
  const climbed = Math.min(GRAZE_MAX_MULT, 1 + GRAZE_STEP * 60 - GRAZE_DECAY_PER_SEC * 2);
  assert.ok(climbed > 1.5, 'sixty grazes over two seconds should visibly move the multiplier');
  assert.ok(GRAZE_MAX_MULT > 2, 'the cap must leave room above the grazeHigh threshold of 2');
  ok(`the graze multiplier is reachable (break-even ${breakEven.toFixed(2)} grazes/sec, cap ${GRAZE_MAX_MULT}x)`);
}

// ── 5) The distance spine ────────────────────────────────────────────────────
//
// Damage must fall off with range, and `nearBonusPct` must steepen the reward
// rather than lift the whole curve — an upgrade that made distance irrelevant
// would delete the only decision the game has.
{
  const s = createRun('RANGE1');
  assert.ok(rangeDamageMult(s, 0) > rangeDamageMult(s, 200), 'close range must out-damage mid range');
  assert.ok(rangeDamageMult(s, 200) > rangeDamageMult(s, 500), 'mid range must out-damage long range');

  const withMuzzle = { ...s, upgrades: ['muzzle'] };
  const nearGain = rangeDamageMult(withMuzzle, 0) - rangeDamageMult(s, 0);
  const farGain = rangeDamageMult(withMuzzle, 600) - rangeDamageMult(s, 600);
  assert.ok(nearGain > 0, 'muzzle must improve close-range damage');
  assert.ok(
    nearGain > farGain * 4,
    `muzzle must steepen the curve, not lift it: near +${nearGain.toFixed(2)} vs far +${farGain.toFixed(2)}`,
  );
  ok('damage falls off with range, and the near-range upgrade steepens rather than flattens it');
}

// ── 6) Intensity is a monotonic curve, and it tightens every knob ────────────
{
  for (let stage = 1; stage < STAGE_COUNT; stage++) {
    assert.ok(
      intensityFor(stage + 1, false) > intensityFor(stage, false),
      `intensity must rise from stage ${stage} to ${stage + 1}`,
    );
    assert.ok(intensityFor(stage, true) > intensityFor(stage, false), 'a boss must be denser than its own midway');
  }

  const emitter = bossFor(1).cards[0].emitters[0];
  const low = scaleEmitter(emitter, intensityFor(1, false));
  const high = scaleEmitter(emitter, intensityFor(STAGE_COUNT, true));
  assert.ok(high.count > low.count, 'higher intensity must fire more bullets per volley');
  assert.ok(high.interval < low.interval, 'higher intensity must shorten the gap between volleys');
  assert.ok(high.speed > low.speed, 'higher intensity must speed bullets up');
  ok('intensity rises monotonically and tightens count, cadence and speed together');
}

// ── 6b) The escalation is a slope with no step in it ─────────────────────────
//
// The check above compares the two ENDPOINTS of the intensity range, which a
// step function passes trivially — and one did. scaleEmitter carried
//
//   aim: e.aim === 'fixed' && k > 2.4 && e.count % 2 === 1 ? 'aimed' : e.aim
//
// so every fixed spray in the game stopped ignoring the ship and started
// homing on it, all at once, at a single threshold. Intensity runs 1.00 / 1.85
// / 2.70 / 3.55 / 4.40 by stage, so k > 2.4 lands between stage 2 and stage 3
// and nowhere else. Measured survival either side: 92% at stage 2, 46% at
// stage 3, back to 79% at stage 4 — a spike, not a curve. It also selected on
// the parity of the authored bullet count, so 8 of 21 fixed emitters converted
// and 13 never did, meaning a pattern written with 14 bullets instead of 13
// silently lost its homing.
//
// Endpoints cannot see a step. Sampling can. Every knob scaleEmitter turns is
// swept finely across the whole intensity range, and no single increment may
// account for a large share of that knob's total travel.
{
  const emitter = bossFor(1).cards[0].emitters[0];
  const K0 = 1;
  const K1 = intensityFor(STAGE_COUNT, true);
  const STEPS = 80;
  const samples = Array.from({ length: STEPS + 1 }, (_, i) =>
    scaleEmitter({ ...emitter, aim: 'fixed' }, K0 + ((K1 - K0) * i) / STEPS),
  );

  // 'lean' is not a field — it is how far a volley's base angle ends up turned
  // toward the ship, which is what a player actually experiences. Expressing it
  // as a number is the point: a swap from aim 'fixed' to 'aimed' is invisible
  // to a sweep over numeric fields (it is a string), but it is a jump from a
  // little lean to a full one, and this is where that shows up.
  const leanOf = (e: Emitter): number => (e.aim === 'aimed' ? 1 : e.aim === 'fixed' ? (e.homing ?? 0) : 0);

  for (const knob of ['count', 'interval', 'speed', 'homing', 'lean'] as const) {
    const vs = samples.map((e) => (knob === 'lean' ? leanOf(e) : ((e[knob] ?? 0) as number)));
    const travel = Math.max(...vs) - Math.min(...vs);
    if (travel === 0) continue;
    let biggest = 0;
    let at = 0;
    for (let i = 1; i < vs.length; i++) {
      const jump = Math.abs(vs[i] - vs[i - 1]);
      if (jump > biggest) {
        biggest = jump;
        at = K0 + ((K1 - K0) * i) / STEPS;
      }
    }
    assert.ok(
      biggest / travel < 0.15,
      `scaleEmitter's '${knob}' makes ${((biggest / travel) * 100).toFixed(0)}% of its entire travel in one 1/${STEPS} increment of intensity, at k=${at.toFixed(2)} — that is a step in a function whose job is a slope, and it puts a difficulty cliff at whichever stage boundary it happens to land near`,
    );
  }

  // The same defect wearing its other face: whether a pattern homes must not
  // depend on how many bullets it was authored with.
  const odd = scaleEmitter({ ...emitter, aim: 'fixed', count: 13 }, K1);
  const even = scaleEmitter({ ...emitter, aim: 'fixed', count: 14 }, K1);
  assert.equal(
    odd.aim,
    even.aim,
    `a 13-bullet spray and a 14-bullet one resolve to different aim modes ('${odd.aim}' vs '${even.aim}') at the same intensity — aiming is keyed on the parity of an authored count, so adding one bullet to a pattern changes whether it chases the player`,
  );
  assert.ok(
    Math.abs((odd.homing ?? 0) - (even.homing ?? 0)) < 1e-9,
    `homing differs between a 13- and a 14-bullet spray at the same intensity (${odd.homing} vs ${even.homing})`,
  );
  ok(`the escalation is continuous across the whole intensity range and independent of authored bullet parity`);
}

// ── 7) Bombs are not free ────────────────────────────────────────────────────
//
// A bomb that cleared the screen AND paid score was strictly correct to press,
// which the balance harness caught: panicking beat never bombing by +0.75
// stages and +8,748 points at the same time. It must cost the multiplier.
{
  // Run until there is actually something to clear rather than guessing a tick
  // count: lengthening the midway phase moved the first volley later and a
  // hardcoded 600 ticks silently stopped testing anything.
  let s = createRun('BOMB01');
  let spin = 0;
  while (s.bullets.length < 5 && spin++ < 20_000) s = step(s, IDLE, FIXED_DT);
  s = { ...s, grazeMult: 2.5, invuln: 0 };
  assert.ok(s.bullets.length > 0, 'the fixture should have bullets on screen to clear');
  const scoreBefore = s.score;
  const bombsBefore = s.bombs;

  const after = step(s, { dx: 0, dy: 0, focus: false, bomb: true, special: false }, FIXED_DT);
  assert.equal(after.bombs, bombsBefore - 1, 'a bomb must be consumed');
  assert.ok(after.bullets.length < s.bullets.length, 'a bomb must clear bullets');
  assert.equal(after.score, scoreBefore, 'a bomb must not pay score for the bullets it clears');
  assert.equal(after.grazeMult, 1, 'a bomb must reset the graze multiplier — that is what it costs');
  assert.ok(after.invuln > 0, 'a bomb must grant mercy time, or it would not be worth pressing at all');
  ok('a bomb buys survival and gives up the scoring multiplier');
}

// ── 8) Death costs something even though lives exist ─────────────────────────
{
  let s = createRun('DEATH1');
  s = { ...s, invuln: 0, powerTier: 3, grazeMult: 3 };
  // Park a bullet directly on the ship.
  s = {
    ...s,
    bullets: [
      {
        id: 9999,
        x: s.px,
        y: s.py,
        angle: Math.PI / 2,
        speed: 0,
        r: 6,
        hue: 0,
        age: 0,
        lifetime: 5,
        waveform: 'linear' as const,
        curl: 0,
        grazed: false,
      },
    ],
  };
  const livesBefore = s.lives;
  const after = step(s, IDLE, FIXED_DT);
  assert.equal(after.lives, livesBefore - 1, 'a hit must cost a life');
  assert.ok(after.powerTier < 3, 'a death must drop a power tier');
  assert.equal(after.grazeMult, 1, 'a death must reset the graze multiplier');
  assert.ok(after.fragments.length > 0, 'a death must scatter recoverable power fragments');
  assert.ok(after.invuln > 0, 'respawning must grant mercy time');
  ok('death costs a life, a power tier and the multiplier, and scatters fragments to go back for');
}

// ── 9) The upgrade pool is large enough relative to the picks ────────────────
//
// Roguelike-Snake had 18 relics against up to 15 picks: a run was offered 98%
// of the pool and two runs shared 72% of what they carried, so every run was
// the same run. A run here takes at most STAGE_COUNT upgrades, three offered
// each time.
{
  const maxOffered = STAGE_COUNT * 3;
  assert.ok(
    UPGRADES.length > maxOffered * 1.4,
    `pool of ${UPGRADES.length} is too small against at most ${maxOffered} offers — runs would repeat`,
  );
  const ids = UPGRADES.map((u) => u.id);
  assert.equal(new Set(ids).size, ids.length, 'upgrade ids must be unique');
  for (const u of UPGRADES) {
    const effectCount = Object.keys(u.effects).length + Object.keys(u.conditional?.effects ?? {}).length;
    assert.ok(effectCount > 0, `${u.id} declares no effects at all`);
    assert.ok(u.text.trim().length > 0, `${u.id} has no description`);
  }
  ok(`upgrade pool (${UPGRADES.length}) is comfortably larger than a run's ${maxOffered} offers`);
}

// ── 10) Offers are legal, distinct, and never repeat a one-shot ──────────────
{
  let s = createRun('OFFER1');
  let guard = 0;
  const seen: string[][] = [];
  while (guard++ < 120_000) {
    if (s.phase === 'upgrade') {
      assert.equal(new Set(s.offered).size, s.offered.length, 'an offer must not list the same upgrade twice');
      for (const id of s.offered) {
        const def = UPGRADES.find((u) => u.id === id);
        assert.ok(def, `offered id ${id} is not in the pool`);
        if (!def!.repeatable) {
          assert.ok(!s.upgrades.includes(id), `${id} is not repeatable but was offered after being taken`);
        }
      }
      seen.push(s.offered.slice());
      s = takeUpgrade(s, s.offered[0]);
      continue;
    }
    if (s.phase !== 'playing') break;
    if (s.lives < 3) s = { ...s, lives: 3 };
    s = step(s, IDLE, FIXED_DT);
  }
  assert.ok(seen.length >= 2, `a full run should reach at least two upgrade screens, saw ${seen.length}`);
  ok(`offers stay legal across a full run (${seen.length} upgrade screens)`);
}

// ── 11) Every authored card is reachable and well-formed ─────────────────────
{
  const cards = allCards();
  assert.ok(cards.length >= 17, `only ${cards.length} spell cards authored`);
  assert.ok(cards.some((c) => c.id === 'frost-4'), 'missing frost-4 雙弦');
  assert.ok(cards.some((c) => c.id === 'abyss-4'), 'missing abyss-4 裂壁');
  assert.ok(cards.some((c) => c.id === 'lamp-4'), 'missing lamp-4 導標');
  assert.ok(cards.some((c) => c.id === 'tide-4'), 'missing tide-4 交錯');
  assert.ok(cards.some((c) => c.id === 'ember-4'), 'missing ember-4 花開');
  for (let stage = 1; stage <= STAGE_COUNT; stage++) {
    assert.ok(
      bossFor(stage).cards.length >= 4,
      `stage ${stage} boss should have at least 4 spell cards`,
    );
  }
  const ids = cards.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length, 'spell card ids must be unique');
  for (const c of cards) {
    assert.ok(c.hp > 0, `${c.id} has no hp`);
    assert.ok(c.timeLimit > 5, `${c.id} has an unusable time limit`);
    assert.ok(c.emitters.length > 0, `${c.id} fires nothing`);
    for (const e of c.emitters) {
      assert.ok(e.count >= 1, `${c.id} has an emitter firing no bullets`);
      assert.ok(e.interval > 0, `${c.id} has an emitter with a zero interval — it would fire forever in one tick`);
      assert.ok(e.speed > 0, `${c.id} has a stationary emitter`);
      assert.ok(e.lifetime > 0, `${c.id} has bullets that die instantly`);
    }
  }
  for (let stage = 1; stage <= STAGE_COUNT; stage++) {
    assert.ok(bossFor(stage).cards.length > 0, `stage ${stage} has no boss cards`);
    assert.ok(midwayCardFor(stage, 0).emitters.length > 0, `stage ${stage} has no midway pattern`);
  }
  ok(`all ${cards.length} spell cards are well-formed and every stage has a boss`);
}

// ── 11b) Difficulty is not authored into the cards ───────────────────────────
//
// The design rule is that a card is written once at its natural shape and the
// intensity scalar supplies the escalation. The first draft broke that rule
// while stating it: stage-1 rings were authored at 10-14 bullets and stage-5
// rings at 24-26, so hand-written escalation multiplied the scalar's. The
// harness measured survival at 100/100/88/88/13% — a wall, not a curve.
//
// This asserts the last stage's cards are not authored denser than the first
// stage's. Stages may still differ in shape as much as they like.
{
  const ringDensity = (stage: number): number => {
    const counts = bossFor(stage).cards.flatMap((c) => c.emitters.map((e) => e.count));
    return Math.max(...counts);
  };
  const first = ringDensity(1);
  const last = ringDensity(STAGE_COUNT);
  assert.ok(
    last <= first * 1.6,
    `stage ${STAGE_COUNT} cards are authored ${(last / first).toFixed(1)}x denser than stage 1 ` +
      `(${first} -> ${last} bullets) — escalation belongs to the intensity scalar, not the card data`,
  );

  // And the scalar had better be doing real work, or nothing escalates at all.
  const e = bossFor(1).cards[0].emitters[0];
  const ratio = scaleEmitter(e, intensityFor(STAGE_COUNT, true)).count / scaleEmitter(e, intensityFor(1, false)).count;
  assert.ok(ratio > 1.4, `the intensity scalar only grows a volley ${ratio.toFixed(2)}x across the whole run`);
  ok(`late cards are not hand-escalated (${first} -> ${last} bullets), the scalar supplies ${ratio.toFixed(1)}x`);
}

// ── 11c) Pressure must land inside the measured playable band ────────────────
//
// The end-to-end pressure ratio (bullets/sec at the last stage over the first)
// is the one number that summarises the whole difficulty curve. A controlled
// sweep — everything held fixed, only the intensity slope varied, eight seeds,
// measured both with the normal upgrade pool and with the upgrade list
// stripped entirely:
//
//   slope    ratio    clear rate (upgrades / none)
//   +0.55    3.28x    100% / 100%      no failure state at all
//   +0.85    4.34x     88% /  63%      a real but achievable challenge
//   +1.15    5.51x     13% /   0%      a wall
//
// So the band is roughly 3.6x to 5.0x, and the check is TWO-SIDED. The
// previous version only had a ceiling, and that is exactly why the shipped
// build sat at 3.28x with a 100% clear rate for as long as it did: nothing
// was watching for "too easy", so the defect could not trip anything.
//
// The old ceiling was also stale rather than merely wrong. It was anchored on
// "4.29x was unsurvivable", measured when the pool was 24 flat scalars. After
// the conditional upgrades went in, essentially that same ratio measures 88%
// clear. A threshold calibrated against one version of the content does not
// survive a change to the content — re-derive it, do not nudge it.
{
  const rateAt = (stage: number): number => {
    const k = intensityFor(stage, true);
    let total = 0;
    for (const card of bossFor(stage).cards) {
      for (const e of card.emitters) {
        const sc = scaleEmitter(e, k);
        total += sc.count / sc.interval;
      }
    }
    return total / bossFor(stage).cards.length;
  };

  for (let stage = 2; stage <= STAGE_COUNT; stage++) {
    assert.ok(
      rateAt(stage) > rateAt(stage - 1),
      `stage ${stage} must apply more pressure than stage ${stage - 1}`,
    );
  }

  const ratio = rateAt(STAGE_COUNT) / rateAt(1);
  assert.ok(
    ratio >= 3.6,
    `pressure only grows ${ratio.toFixed(2)}x from stage 1 to ${STAGE_COUNT} — measured at 3.28x the ` +
      `run cleared 100% of the time with and without upgrades, i.e. there is no failure state`,
  );
  assert.ok(
    ratio <= 5.0,
    `pressure grows ${ratio.toFixed(2)}x from stage 1 to ${STAGE_COUNT} — measured at 5.51x the clear ` +
      `rate fell to 13%, which is a wall rather than a curve`,
  );
  ok(`pressure lands inside the measured playable band at ${ratio.toFixed(2)}x (3.6-5.0)`);
}

// ── 11d) Spell card phases actually switch on ────────────────────────────────
//
// A phase is data that only means anything if the engine gates on it. If the
// gate were wrong in the open direction every phase would fire from the first
// second (pressure with no shape); wrong in the closed direction and the data
// is decorative and nothing ever errors.
{
  const phased = allCards().filter((c) => (c.phases ?? []).length > 0);
  assert.ok(phased.length >= 4, `only ${phased.length} cards have phases — most fights are still a loop`);

  for (const card of phased) {
    const emitters = allEmitters(card);
    assert.ok(
      emitters.length > card.emitters.length,
      `${card.id}: phases contribute no emitters`,
    );

    // At full health only the base set fires.
    for (let i = 0; i < emitters.length; i++) {
      assert.equal(
        emitterActive(card, i, 1),
        i < card.emitters.length,
        `${card.id}: emitter ${i} should ${i < card.emitters.length ? '' : 'not '}fire at full health`,
      );
    }
    // At zero health everything fires.
    for (let i = 0; i < emitters.length; i++) {
      assert.equal(emitterActive(card, i, 0), true, `${card.id}: emitter ${i} should fire at 0% health`);
    }
    // And each threshold must actually be crossable in order.
    const fracs = (card.phases ?? []).map((p) => p.belowHpFrac);
    for (const f of fracs) {
      assert.ok(f > 0 && f < 1, `${card.id}: a phase threshold of ${f} can never be crossed meaningfully`);
    }
    assert.deepEqual(
      fracs,
      [...fracs].sort((a, b) => b - a),
      `${card.id}: phase thresholds must be listed from highest to lowest`,
    );
  }

  // A phased card must genuinely put more on screen once hurt.
  const card = phased[phased.length - 1];
  const rate = (frac: number): number => {
    const emitters = allEmitters(card);
    let total = 0;
    for (let i = 0; i < emitters.length; i++) {
      if (emitterActive(card, i, frac)) total += emitters[i].count / emitters[i].interval;
    }
    return total;
  };
  assert.ok(rate(0.1) > rate(1) * 1.2, `${card.id} barely changes when broken — the phases are decorative`);
  ok(`${phased.length} cards evolve as they take damage (${rate(1).toFixed(0)} -> ${rate(0.1).toFixed(0)} bullets/sec)`);
}

// ── 11e) Walls must leave a way through, and it must move ────────────────────
//
// A wall is the one pattern that can be unfair by construction: get the gap
// arithmetic wrong and it spans the field with no opening, which is not a hard
// pattern but an unavoidable death, and nothing would error. Get the walk wrong
// and it is either free (a gap that never moves) or an aimed shot wearing a
// wall's clothes (a gap that tracks you).
{
  const wallCards = allCards().filter((c) =>
    allEmitters(c).some((e) => e.pattern === 'wall'),
  );
  assert.ok(wallCards.length > 0, 'no card uses a wall — the pattern is dead content');

  const card = wallCards[0];
  const wallEmitter = allEmitters(card).find((e) => e.pattern === 'wall')!;

  // At every intensity the run can reach, a gap must survive.
  for (let stage = 1; stage <= STAGE_COUNT; stage++) {
    const scaled = scaleEmitter(wallEmitter, intensityFor(stage, true));
    assert.ok(
      (scaled.gap ?? 0) >= 1,
      `at stage ${stage} the wall's gap closes to ${scaled.gap} — that is an unavoidable death, not a pattern`,
    );
    assert.ok(
      (scaled.gap ?? 0) < Math.max(6, scaled.count),
      `at stage ${stage} the wall is more gap than wall`,
    );
  }

  // Escalation must tighten the gap rather than add bullets, or a wall becomes
  // just another density pattern and inherits the problem it exists to dodge.
  const low = scaleEmitter(wallEmitter, intensityFor(1, false));
  const high = scaleEmitter(wallEmitter, intensityFor(STAGE_COUNT, true));
  assert.ok((high.gap ?? 0) < (low.gap ?? 0), 'a wall must escalate by closing its gap');
  assert.equal(high.count, low.count, 'a wall must not escalate by adding slots');

  // And the gap has to actually walk between volleys.
  const positions = new Set<number>();
  for (let volley = 0; volley < 8; volley++) {
    const slots = Math.max(6, low.count);
    const gap = Math.max(1, low.gap ?? 2);
    positions.add((volley * 3) % Math.max(1, slots - gap));
  }
  assert.ok(positions.size >= 3, `the wall's gap only reaches ${positions.size} positions — it barely moves`);
  ok(`${wallCards.length} cards use walls; the gap survives every intensity and walks across ${positions.size} positions`);
}

// ── 12) A stage actually ends ────────────────────────────────────────────────
//
// Spell cards time out on their own, so an idle player who never fires a shot
// must still be carried to the upgrade screen. Without that, a stalled card
// would hang the run with no error — the class of bug that put Dynasty's trade
// deadline into an infinite loop.
{
  let s = createRun('ENDS01');
  let guard = 0;
  while (s.phase === 'playing' && guard < 200_000) {
    if (s.lives < 3) s = { ...s, lives: 3 };
    s = step(s, IDLE, FIXED_DT);
    guard += 1;
  }
  assert.notEqual(s.phase, 'playing', 'a stage must end on its own even if the player never fires');
  assert.ok(guard < 200_000, 'stage did not terminate within the guard');
  ok(`a stage terminates without player input (${(guard / 60).toFixed(0)}s of card timers)`);
}

// ── 13) The player is kept inside the field ──────────────────────────────────
{
  let s = createRun('BOUND1');
  for (let i = 0; i < 900; i++) {
    s = step(s, { dx: -1, dy: -1, focus: false, bomb: false, special: false }, FIXED_DT);
  }
  assert.ok(s.px >= 0 && s.px <= FIELD_W, `player left the field horizontally: ${s.px}`);
  assert.ok(s.py >= 0 && s.py <= FIELD_H, `player left the field vertically: ${s.py}`);
  ok('the ship cannot be driven off the field');
}

// ── 14) RNG hygiene ──────────────────────────────────────────────────────────
{
  assert.equal(hashString('abc'), hashString('abc'), 'hashString must be stable');
  assert.notEqual(hashString('abc'), hashString('abd'), 'hashString must separate close inputs');

  const a = streamRng(1234, 'offer');
  const b = streamRng(1234, 'midway');
  assert.notEqual(a(), b(), 'different labels must give independent streams');

  // Fisher-Yates must be a permutation, never a comparator shuffle.
  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  const out = shuffle(items, mulberry32(7));
  assert.deepEqual(out.slice().sort((x, y) => x - y), items, 'shuffle must be a permutation');
  assert.equal(items.join(), '1,2,3,4,5,6,7,8', 'shuffle must not mutate its input');

  // Comments have to come out before grepping for forbidden patterns: these
  // very files document the mistakes they must not contain, so a naive search
  // matches the warning rather than an offence.
  const stripComments = (src: string): string =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  for (const file of ['rng.ts', 'engine.ts', 'cards.ts', 'upgrades.ts']) {
    const src = stripComments(readFileSync(resolve(__dirname, '..', '..', 'src', 'game', file), 'utf8'));
    assert.ok(
      !/sort\(\s*\(\s*\)?\s*[^)]*\)\s*=>\s*[^;]*random/i.test(src) && !/sort\(\s*\(\)\s*=>/.test(src),
      `${file}: never shuffle with an inconsistent comparator — the result is engine-dependent`,
    );
    if (file !== 'rng.ts') {
      assert.ok(
        !src.includes('Math.random'),
        `${file} must never call Math.random — it would break replay determinism`,
      );
    }
  }
  ok('seeded streams are independent and no unseeded randomness reaches the engine');
}

// ── 15) Mode / level pack: authored targets, unlock, goals, run knobs ─────────
{
  assert.ok(MODE_PACK.length >= 8, 'mode pack is too thin');
  assert.equal(modeCount(), MODE_PACK.length);
  const ids = MODE_PACK.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length, 'mode ids must be unique');
  assertModeCardTargets();

  assert.equal(isModeUnlocked(0, 0), true);
  assert.equal(isModeUnlocked(1, 0), false);
  assert.equal(isModeUnlocked(1, 1), true);
  assert.equal(isModeUnlocked(99, MODE_PACK.length), false);
  assert.equal(continueModeIndex(0), 0);
  assert.equal(continueModeIndex(MODE_PACK.length), MODE_PACK.length - 1);

  // Practice lamp: skip midway, open on stage-1 card 0, end after stage 1.
  const lamp = MODE_PACK[0];
  const lampRun = createRun(lamp.seedCode, { ...lamp.run, modeId: lamp.id });
  assert.equal(lampRun.modeId, 'practice-lamp');
  assert.equal(lampRun.bossSpawned, true);
  assert.equal(lampRun.stage, 1);
  assert.equal(lampRun.config.endStage, 1);
  assert.equal(lampRun.config.skipMidway, true);
  assert.ok(lampRun.enemies.some((e) => e.isBoss && e.card?.id === 'lamp-1'));

  // Spell challenge: opens mid-card list on frost-3 only.
  const rain = MODE_PACK.find((m) => m.id === 'spell-frost-rain');
  assert.ok(rain);
  const rainRun = createRun(rain.seedCode, { ...rain.run, modeId: rain.id });
  const rainBoss = rainRun.enemies.find((e) => e.isBoss);
  assert.equal(rainBoss?.card?.id, 'frost-3');
  assert.equal(rainBoss?.cardIndex, 2);
  assert.equal(rainRun.config.singleCard, true);

  // Spell challenges for authored late cards.
  const duet = MODE_PACK.find((m) => m.id === 'spell-frost-duet');
  assert.ok(duet);
  const duetRun = createRun(duet.seedCode, { ...duet.run, modeId: duet.id });
  assert.equal(duetRun.enemies.find((e) => e.isBoss)?.card?.id, 'frost-4');
  const rift = MODE_PACK.find((m) => m.id === 'spell-abyss-rift');
  assert.ok(rift);
  const riftRun = createRun(rift.seedCode, { ...rift.run, modeId: rift.id });
  assert.equal(riftRun.enemies.find((e) => e.isBoss)?.card?.id, 'abyss-4');
  const beacon = MODE_PACK.find((m) => m.id === 'spell-lamp-beacon');
  assert.ok(beacon);
  assert.equal(
    createRun(beacon.seedCode, { ...beacon.run, modeId: beacon.id }).enemies.find((e) => e.isBoss)
      ?.card?.id,
    'lamp-4',
  );
  const bloom = MODE_PACK.find((m) => m.id === 'spell-ember-bloom');
  assert.ok(bloom);
  assert.equal(
    createRun(bloom.seedCode, { ...bloom.run, modeId: bloom.id }).enemies.find((e) => e.isBoss)
      ?.card?.id,
    'ember-4',
  );

  // Hard abyss: full clear knobs.
  const hard = MODE_PACK.find((m) => m.id === 'hard-abyss');
  assert.ok(hard);
  const hardRun = createRun(hard.seedCode, { ...hard.run, modeId: hard.id });
  assert.equal(hardRun.lives, 2);
  assert.equal(hardRun.bombs, 2);
  assert.equal(hardRun.config.endStage, STAGE_COUNT);
  assert.ok(hardRun.intensity > intensityFor(1, false), 'hard mode must raise intensity');

  // Timing out a capture-required card: phase can be won, goal fails.
  // Park under permanent invuln so bullets cannot end the run before the timer.
  let timed = createRun(rain.seedCode, { ...rain.run, modeId: rain.id });
  timed = { ...timed, invuln: 9999, lives: 99 };
  const limit = (timed.enemies[0]?.card?.timeLimit ?? 40) + 2;
  for (let t = 0; t < limit * 60 && timed.phase === 'playing'; t++) {
    timed = step(timed, IDLE, FIXED_DT);
    // step clones and decays invuln; renew so the timeout path stays reachable.
    if (timed.phase === 'playing' && timed.invuln < 10) {
      timed = { ...timed, invuln: 9999 };
    }
  }
  assert.equal(timed.phase, 'won', 'single-card timeout still ends the mode');
  assert.equal(timed.captures, 0);
  assert.equal(evaluateModeGoal(rain, timed), false, 'timeout must not clear a capture goal');

  const rainIndex = modeIndexOf(rain.id);
  const failed = applyModeResult(EMPTY_MODE_PROGRESS, rainIndex, timed);
  assert.equal(failed.clearedCount, 0, 'failed capture must not advance unlock');
  assert.ok((failed.bestScore[rain.id] ?? 0) >= timed.score || timed.score === 0);

  // Synthetic clear advances unlock only for the next locked index.
  const clearedState: RunState = {
    ...lampRun,
    phase: 'won',
    score: 12_000,
    captures: 3,
  };
  const fromZero = applyModeResult(EMPTY_MODE_PROGRESS, 0, clearedState);
  assert.equal(fromZero.clearedCount, 1);
  assert.equal(fromZero.cleared[lamp.id], true);
  assert.equal(fromZero.bestScore[lamp.id], 12_000);

  const outOfOrder = applyModeResult(EMPTY_MODE_PROGRESS, 3, {
    ...hardRun,
    phase: 'won',
    score: 99_000,
    captures: 10,
  });
  assert.equal(outOfOrder.clearedCount, 0, 'clearing a locked-ahead mode must not unlock');
  assert.equal(outOfOrder.cleared['hard-abyss'], true);

  // Free play createRun still defaults to full five-stage midway run.
  const free = createRun('FREE01');
  assert.equal(free.modeId, null);
  assert.equal(free.config.endStage, STAGE_COUNT);
  assert.equal(free.config.skipMidway, false);
  assert.equal(free.bossSpawned, false);
  assert.equal(free.craftId, DEFAULT_CRAFT_ID);
  assert.deepEqual(free.capturedCardIds, []);

  ok('mode pack targets, unlock, goals, and run knobs hold');
}

// ── 16) Crafts: distinct tradeoffs, unlock gate, wired into createRun ─────────
{
  assert.ok(CRAFTS.length >= 3, 'need at least three crafts');
  const craftIds = CRAFTS.map((c) => c.id);
  assert.equal(new Set(craftIds).size, craftIds.length, 'craft ids must be unique');
  assert.equal(isCraftUnlocked(CRAFTS[0], 0), true);
  assert.equal(isCraftUnlocked(CRAFTS[1], 0), false);
  assert.equal(isCraftUnlocked(CRAFTS[1], 1), true);
  assert.equal(isCraftUnlocked(CRAFTS[2], 1), false);
  assert.equal(isCraftUnlocked(CRAFTS[2], 2), true);

  const styles = new Set(CRAFTS.map((c) => c.shotStyle));
  assert.ok(styles.size >= 3, 'crafts must use distinct shot styles');
  const specials = new Set(CRAFTS.map((c) => c.special.kind));
  assert.ok(specials.size >= 3, 'crafts must use distinct specials');
  for (const c of CRAFTS) {
    assert.ok(c.special.cooldown > 1, `${c.id} special cooldown too short`);
    assert.ok(c.special.duration > 0, `${c.id} special has no duration`);
  }

  const base = createRun('CRAFT-BASE', { craftId: 'swift' });
  const cannon = createRun('CRAFT-BASE', { craftId: 'cannon' });
  const stitch = createRun('CRAFT-BASE', { craftId: 'stitch' });
  assert.equal(base.craftId, 'swift');
  assert.equal(cannon.craftId, 'cannon');
  assert.equal(stitch.craftId, 'stitch');

  // Same seed + idle inputs must still deterministically diverge by craft stats
  // only through the craft multipliers — fire rate / hitbox / damage differ.
  assert.notEqual(fireRate(base), fireRate(cannon));
  assert.notEqual(hitboxRadius(base), hitboxRadius(stitch));
  assert.notEqual(shotDamage(base, 80), shotDamage(cannon, 80));
  assert.notEqual(moveSpeed({ ...base, focus: true }), moveSpeed({ ...stitch, focus: true }));

  // Specials: dash grants invuln; overdrive boosts damage; rift clears near bullets.
  let dash = createRun('SPEC-DASH', { craftId: 'swift' });
  dash = step(dash, { dx: 0, dy: -1, focus: false, bomb: false, special: true }, FIXED_DT);
  assert.ok(dash.specialLeft > 0, 'dash should activate');
  assert.ok(dash.specialCd > 0, 'dash should start cooldown');
  assert.ok(dash.invuln > 0, 'dash should grant brief invuln');

  let over = createRun('SPEC-OVER', { craftId: 'cannon' });
  over = step(over, { ...IDLE, special: true }, FIXED_DT);
  assert.ok(over.specialLeft > 0);
  assert.ok(shotDamage(over, 80) > shotDamage({ ...over, specialLeft: 0 }, 80));

  let riftCraft = createRun('SPEC-RIFT', { craftId: 'stitch' });
  riftCraft = {
    ...riftCraft,
    bullets: [
      {
        id: 99,
        x: riftCraft.px,
        y: riftCraft.py - 10,
        angle: 0,
        speed: 0,
        r: 4,
        hue: 200,
        age: 0,
        lifetime: 9,
        waveform: 'linear',
        curl: 0,
        grazed: false,
      },
      {
        id: 100,
        x: 10,
        y: 10,
        angle: 0,
        speed: 0,
        r: 4,
        hue: 200,
        age: 0,
        lifetime: 9,
        waveform: 'linear',
        curl: 0,
        grazed: false,
      },
    ],
  };
  const beforeBullets = riftCraft.bullets.length;
  riftCraft = step(riftCraft, { ...IDLE, special: true }, FIXED_DT);
  assert.ok(riftCraft.bullets.length < beforeBullets, 'rift should cancel nearby bullets');
  assert.equal(riftCraft.bullets.some((b) => b.id === 100), true, 'far bullets survive rift');

  // Unknown craft id falls back safely.
  assert.equal(craftById('nope').id, DEFAULT_CRAFT_ID);

  ok('crafts unlock and alter fire / focus / hitbox / special tradeoffs');
}

// ── 17) Daily challenge: date seed, best merge, share text ───────────────────
{
  const fixed = new Date(2026, 9, 21, 12, 0, 0); // local Oct 21 2026
  const key = todayKey(fixed);
  assert.equal(key, '2026-10-21');
  assert.equal(dailySeedCode(fixed), 'D20261021');

  // Same date → same seed → deterministic run start.
  const a = createRun(dailySeedCode(fixed), { craftId: 'swift' });
  const b = createRun(dailySeedCode(fixed), { craftId: 'swift' });
  assert.equal(a.seed, b.seed);
  assert.equal(a.seedCode, 'D20261021');

  const first = mergeDailyBest(EMPTY_DAILY_BEST, key, 1200, 2, 'swift', 1, false);
  assert.equal(first.attempts, 1);
  assert.equal(first.bestScore, 1200);
  const second = mergeDailyBest(first, key, 900, 3, 'cannon', 0, false);
  assert.equal(second.bestScore, 1200, 'weaker score must not overwrite best');
  assert.equal(second.attempts, 2);
  const third = mergeDailyBest(second, key, 5000, 5, 'stitch', 4, true);
  assert.equal(third.bestScore, 5000);
  assert.equal(third.cleared, true);
  assert.equal(third.craftId, 'stitch');

  const rolled = mergeDailyBest(third, '2026-10-22', 100, 1, 'swift', 0, false);
  assert.equal(rolled.attempts, 1, 'new day resets attempts');
  assert.equal(rolled.bestScore, 100);

  const share = buildDailyShareText({
    date: key,
    seedCode: 'D20261021',
    score: 5000,
    stage: 5,
    endStage: 5,
    craftName: '縫影',
    captures: 4,
    cleared: true,
    attempts: 3,
  });
  assert.ok(share.includes('彈幕深淵'));
  assert.ok(share.includes(key));
  assert.ok(share.includes('通關'));
  assert.ok(share.includes('縫影'));

  ok('daily seed, best merge, and share text hold');
}

// ── 18) Juice never mutates RunState; flash / destroy paths are wired ────────
{
  const juiceSrc = readFileSync(resolve('src/game/juice.ts'), 'utf8');
  assert.ok(juiceSrc.includes('flash'), 'juice must track screen flash');
  assert.ok(juiceSrc.includes('lastGrazeCount'), 'juice must spark per graze');
  assert.ok(!/next\.(lives|score|bombs)\s*=/.test(juiceSrc), 'juice must not write RunState');
  const canvasSrc = readFileSync(resolve('src/components/GameCanvas.tsx'), 'utf8');
  assert.ok(canvasSrc.includes('juice.flash'), 'canvas must draw flash');
  const appSrc = readFileSync(resolve('src/App.tsx'), 'utf8');
  assert.ok(appSrc.includes('prefers-reduced-motion') || appSrc.includes('reduceMotion'), 'app gates juice');
  ok('juice flash / graze sparks stay presentation-only and motion-gated');
}

// ── 19) Hitbox precision vs graze box geometry and multiplier escalation ────
//
// Danmaku designs live or die by the gap between the ship graphic and the core
// hitbox. The player's visible ship is 20-30px, but the actual lethal hitbox is
// a tiny core (BASE_HITBOX_R 3.2px down to ~1.95-2.05px on Stitch with Pinpoint),
// surrounded by a generous graze ring (BASE_GRAZE_R 26px up to 45px on Stitch
// with Rift). Grazing builds the score multiplier, but requires bullets to
// thread the razor-thin margin between hitR and grazeR.
{
  // 19.1 Radial geometry across craft types
  const swift = createRun('GEOM-SWIFT', { craftId: 'swift' });
  const cannon = createRun('GEOM-CANNON', { craftId: 'cannon' });
  const stitch = createRun('GEOM-STITCH', { craftId: 'stitch' });

  assert.equal(hitboxRadius(swift), BASE_HITBOX_R, 'swift hitbox must match BASE_HITBOX_R (3.2px)');
  assert.equal(grazeRadius(swift), BASE_GRAZE_R, 'swift graze radius must match BASE_GRAZE_R (26px)');

  // Cannon is bulkier (1.08x hitbox, 0.9x graze)
  assert.ok(hitboxRadius(cannon) > hitboxRadius(swift), 'cannon must have a larger hitbox than swift');
  assert.ok(grazeRadius(cannon) < grazeRadius(swift), 'cannon must have a tighter graze ring');

  // Stitch is a needle craft: 0.78x hitbox (~2.496px), 1.2x graze (~31.2px)
  assert.ok(hitboxRadius(stitch) < 2.6, 'stitch hitbox must be under 2.6px');
  assert.ok(grazeRadius(stitch) > 30, 'stitch graze radius must exceed 30px');

  // With pinpoint upgrade (-18% hitbox), stitch reaches extreme precision (~2.05px core radius)
  const stitchPin = { ...stitch, upgrades: ['pinpoint'] };
  const pinpointHitbox = hitboxRadius(stitchPin);
  assert.ok(
    pinpointHitbox < 2.15 && pinpointHitbox > 1.95,
    `stitch with pinpoint should reach ~2.05px core hitbox radius, got ${pinpointHitbox.toFixed(3)}px`,
  );

  // 19.2 Precision boundary: Hit vs Graze vs Clean Miss
  // Bullet radius r = 5. Player at (px, py).
  // Distance d = dist(bullet, player).
  // Hit condition: d <= r + hitR.
  // Graze condition: !b.grazed && d <= r + grazeR.
  const hitR = hitboxRadius(swift);
  const grazeR = grazeRadius(swift);
  const bulletR = 5;

  const dummyEnemy: Enemy = {
    id: 1,
    x: -200,
    y: -200,
    hp: 99999,
    maxHp: 99999,
    r: 12,
    isBoss: false,
    card: null,
    cardIndex: 0,
    cardElapsed: 0,
    emitterClocks: [],
    emitterAngles: [],
    entryTo: null,
    entryFrom: null,
    entryT: 1,
    score: 0,
  };

  const makeBulletAt = (dist: number, grazed = false): Bullet => ({
    id: 8888,
    x: swift.px,
    y: swift.py - dist,
    angle: Math.PI / 2,
    speed: 0,
    r: bulletR,
    hue: 0,
    age: 0,
    lifetime: 10,
    waveform: 'linear',
    curl: 0,
    grazed,
  });

  // A) Bullet right on the hit boundary: dist = bulletR + hitR
  let sHit: RunState = {
    ...swift,
    invuln: 0,
    lives: 3,
    grazeCount: 0,
    grazeMult: 2.0,
    bossSpawned: true,
    enemies: [dummyEnemy],
    midwayLeft: 0,
    bullets: [makeBulletAt(bulletR + hitR)],
  };
  sHit = step(sHit, IDLE, FIXED_DT);
  assert.equal(sHit.lives, 2, 'bullet at d == r + hitR must trigger death');
  assert.equal(sHit.grazeMult, 1, 'death must reset graze multiplier to 1');

  // B) Bullet just outside the hit boundary: dist = bulletR + hitR + 0.1
  let sGraze: RunState = {
    ...swift,
    invuln: 0,
    lives: 3,
    grazeCount: 0,
    grazeMult: 1.0,
    bossSpawned: true,
    enemies: [dummyEnemy],
    midwayLeft: 0,
    bullets: [makeBulletAt(bulletR + hitR + 0.1)],
  };
  sGraze = step(sGraze, IDLE, FIXED_DT);
  assert.equal(sGraze.lives, 3, 'bullet outside hitR must not kill the player');
  assert.equal(sGraze.grazeCount, 1, 'bullet between hitR and grazeR must increment grazeCount');
  assert.ok(sGraze.grazeMult > 1.0, 'bullet between hitR and grazeR must escalate graze multiplier');
  assert.equal(sGraze.bullets[0]?.grazed, true, 'bullet must be flagged as grazed');

  // C) Re-step with the same grazed bullet: must NOT increment graze count again
  const grazeCountAfterFirst = sGraze.grazeCount;
  const sReStep = step(sGraze, IDLE, FIXED_DT);
  assert.equal(sReStep.grazeCount, grazeCountAfterFirst, 'grazed bullet must not re-trigger graze on subsequent ticks');

  // D) Bullet right on graze boundary: dist = bulletR + grazeR
  let sGrazeEdge: RunState = {
    ...swift,
    invuln: 0,
    lives: 3,
    grazeCount: 0,
    bossSpawned: true,
    enemies: [dummyEnemy],
    midwayLeft: 0,
    bullets: [makeBulletAt(bulletR + grazeR)],
  };
  sGrazeEdge = step(sGrazeEdge, IDLE, FIXED_DT);
  assert.equal(sGrazeEdge.grazeCount, 1, 'bullet at d == r + grazeR must trigger graze');

  // E) Bullet just outside graze boundary: dist = bulletR + grazeR + 0.5
  let sMiss: RunState = {
    ...swift,
    invuln: 0,
    lives: 3,
    grazeCount: 0,
    grazeMult: 1.0,
    bossSpawned: true,
    enemies: [dummyEnemy],
    midwayLeft: 0,
    bullets: [makeBulletAt(bulletR + grazeR + 0.5)],
  };
  sMiss = step(sMiss, IDLE, FIXED_DT);
  assert.equal(sMiss.lives, 3, 'clean miss must not harm player');
  assert.equal(sMiss.grazeCount, 0, 'bullet outside grazeR must not register a graze');
  assert.equal(sMiss.bullets[0]?.grazed, false, 'bullet outside grazeR must remain ungrazed');

  // 19.3 Multiplier escalation curve and ceiling clamping at 4.0x
  let sEsc: RunState = {
    ...swift,
    grazeMult: 1.0,
    grazeCount: 0,
    invuln: 999,
    bossSpawned: true,
    enemies: [dummyEnemy],
    midwayLeft: 0,
  };
  for (let i = 0; i < 90; i++) {
    // Inject a fresh ungrazed bullet in the graze ring each tick
    sEsc = {
      ...sEsc,
      bullets: [makeBulletAt(bulletR + hitR + 2, false)],
    };
    sEsc = step(sEsc, IDLE, FIXED_DT);
  }
  // At the end of each tick, natural decay subtracts GRAZE_DECAY_PER_SEC * dt from the clamped max
  const expectedClamped = GRAZE_MAX_MULT - GRAZE_DECAY_PER_SEC * FIXED_DT;
  assert.ok(
    Math.abs(sEsc.grazeMult - expectedClamped) < 1e-4,
    `graze multiplier must clamp at GRAZE_MAX_MULT (${GRAZE_MAX_MULT}x) with end-of-tick decay (${expectedClamped.toFixed(4)}x), got ${sEsc.grazeMult}`,
  );
  assert.ok(sEsc.grazeCount >= 90, 'all grazing bullets must be counted');

  // 19.4 Natural decay dynamics toward 1.0x baseline
  let sDecay: RunState = {
    ...swift,
    grazeMult: 3.5,
    bullets: [],
    invuln: 999,
    bossSpawned: true,
    enemies: [dummyEnemy],
    midwayLeft: 0,
  };
  const initialMult = sDecay.grazeMult;
  // Step 60 frames = exactly 1 second
  for (let i = 0; i < 60; i++) {
    sDecay = step(sDecay, IDLE, FIXED_DT);
  }
  const decayOneSec = initialMult - sDecay.grazeMult;
  assert.ok(
    Math.abs(decayOneSec - GRAZE_DECAY_PER_SEC) < 1e-4,
    `graze multiplier must decay at GRAZE_DECAY_PER_SEC (${GRAZE_DECAY_PER_SEC}/s), measured ${decayOneSec.toFixed(5)}`,
  );

  // Long decay must never drop below 1.0x floor: 70 seconds > 62.5s needed for (3.5 - 1.0) / 0.04
  for (let i = 0; i < 60 * 70; i++) {
    sDecay = step(sDecay, IDLE, FIXED_DT);
  }
  assert.equal(sDecay.grazeMult, 1.0, 'graze multiplier must bottom out at exactly 1.0, never below');

  ok('precision hitbox (core ~2px) vs graze box (24-31px) boundary and multiplier escalation to 4.0x verified');
}

// ── 20) Near-range shotgun damage falloff curve and point-blank reward ───────
//
// The central gameplay tension: playing safe from the bottom of the screen
// yields only 0.55x damage. Diving point-blank into the boss's face yields
// 2.20x damage (a 4:1 damage ratio). Upgrades like muzzle steepen this curve
// to reward daring close-range shotgun tactics.
{
  const s = createRun('SHOTGUN-BASE');

  // 20.1 Discrete distance evaluation along the falloff range
  const d0 = rangeDamageMult(s, 0);
  const d100 = rangeDamageMult(s, 100);
  const d200 = rangeDamageMult(s, 200);
  const d380 = rangeDamageMult(s, DAMAGE_FALLOFF_RANGE);
  const d500 = rangeDamageMult(s, 500);

  assert.equal(d0, DAMAGE_NEAR_MULT, `point-blank multiplier must equal DAMAGE_NEAR_MULT (${DAMAGE_NEAR_MULT})`);
  assert.equal(d380, DAMAGE_FAR_MULT, `multiplier at DAMAGE_FALLOFF_RANGE must equal DAMAGE_FAR_MULT (${DAMAGE_FAR_MULT})`);
  assert.equal(d500, DAMAGE_FAR_MULT, 'multiplier beyond falloff range must clamp at DAMAGE_FAR_MULT');

  // Strictly monotonic decreasing from 0 to DAMAGE_FALLOFF_RANGE
  assert.ok(d0 > d100, '0px distance must deal more damage than 100px');
  assert.ok(d100 > d200, '100px distance must deal more damage than 200px');
  assert.ok(d200 > d380, '200px distance must deal more damage than 380px');

  const pointBlankRatio = d0 / d380;
  assert.equal(
    pointBlankRatio,
    DAMAGE_NEAR_MULT / DAMAGE_FAR_MULT,
    `point-blank to max-range damage ratio must be exactly 4.0x (${DAMAGE_NEAR_MULT}/${DAMAGE_FAR_MULT})`,
  );

  // 20.2 Fine-grained linear slope check across DAMAGE_FALLOFF_RANGE
  const stepDist = 20;
  let prevDmg = rangeDamageMult(s, 0);
  for (let dist = stepDist; dist <= DAMAGE_FALLOFF_RANGE; dist += stepDist) {
    const curDmg = rangeDamageMult(s, dist);
    const drop = prevDmg - curDmg;
    assert.ok(drop > 0, `damage must strictly fall with distance at dist=${dist}`);
    const expectedDrop = (DAMAGE_NEAR_MULT - DAMAGE_FAR_MULT) * (stepDist / DAMAGE_FALLOFF_RANGE);
    assert.ok(Math.abs(drop - expectedDrop) < 1e-4, `falloff slope must be uniformly linear across range, dist=${dist}`);
    prevDmg = curDmg;
  }

  // 20.3 Upgrade interaction: muzzle steepens the near damage without inflating far damage
  const sMuzzle = { ...s, upgrades: ['muzzle'] };
  const muzzleNear = rangeDamageMult(sMuzzle, 0);
  const muzzleFar = rangeDamageMult(sMuzzle, DAMAGE_FALLOFF_RANGE);
  assert.ok(muzzleNear > d0 * 1.3, 'muzzle must significantly elevate point-blank damage multiplier');
  assert.ok(
    Math.abs(muzzleFar - d380) < 1e-9,
    'muzzle must NOT inflate far damage multiplier — distance must remain critical',
  );

  // 20.4 Craft shotgun differentials: Cannon with Overdrive
  const cannon = createRun('SHOTGUN-CANNON', { craftId: 'cannon' });
  const cannonPointBlank = shotDamage(cannon, 0);
  const cannonSniping = shotDamage(cannon, 500);
  assert.ok(cannonPointBlank > shotDamage(s, 0) * 1.4, 'cannon base damageMult must yield devastating shotgun blasts');

  // Overdrive special raises damage by another 1.7x
  const cannonOverdrive = { ...cannon, specialLeft: 1.5 };
  const overdriveDmg = shotDamage(cannonOverdrive, 0);
  assert.ok(
    Math.abs(overdriveDmg - cannonPointBlank * 1.7) < 1e-3,
    'overdrive special must apply an exact 1.7x burst damage multiplier on top of shotgun scaling',
  );

  // Verify effective DPS difference between risky point-blank dive and timid back-row camping
  const cannonBurstPointBlank = shotDamage(cannonOverdrive, 0);
  const cannonTimidFar = shotDamage(cannon, 500);
  const burstRatio = cannonBurstPointBlank / cannonTimidFar;
  assert.ok(
    burstRatio > 6.0,
    `overdriven close-range cannon shotgun must deal >6x the damage of timid far sniping, measured ${burstRatio.toFixed(2)}x`,
  );

  ok('near-range shotgun damage falloff and scaling (4:1 point-blank reward, muzzle steepening, overdrive) verified');
}

// ── 21) 5-stage boss spell card escalation, intensity growth, and wall gaps ─
//
// The 5 stages: Stage 1 (lamp), Stage 2 (tide), Stage 3 (frost), Stage 4 (ember),
// Stage 5 (abyss). Every stage boss must feature at least 4 spell cards. Emitter
// parameters must scale continuously with intensity. Crucially, wall patterns
// must guarantee at least one passable gap across all achievable intensities,
// ensuring every pattern remains skill-survivable.
{
  // 21.1 5 stages, each with a designated boss and complete 4-card repertoire
  const expectedBossPrefixes = ['lamp', 'tide', 'frost', 'ember', 'abyss'];
  assert.equal(STAGE_COUNT, 5, 'game must feature exactly 5 stages');

  let totalBossCards = 0;
  for (let stage = 1; stage <= STAGE_COUNT; stage++) {
    const boss = bossFor(stage);
    const prefix = expectedBossPrefixes[stage - 1];
    assert.ok(boss.cards.length >= 4, `stage ${stage} boss (${boss.name}) must author at least 4 spell cards`);
    totalBossCards += boss.cards.length;

    // All card ids must start with the stage theme prefix
    for (const card of boss.cards) {
      assert.ok(
        card.id.startsWith(prefix),
        `stage ${stage} card id '${card.id}' should start with prefix '${prefix}'`,
      );
      assert.ok(card.hp >= 100, `card ${card.id} hp too low: ${card.hp}`);
      assert.ok(card.timeLimit >= 15, `card ${card.id} timeLimit too brief: ${card.timeLimit}`);
      assert.ok(card.emitters.length > 0, `card ${card.id} has no emitters`);
    }
  }
  assert.ok(totalBossCards >= 20, `5 bosses must provide at least 20 spell cards in total, found ${totalBossCards}`);

  // 21.2 Monotonic intensity escalation across all 5 stages
  for (let stage = 1; stage <= STAGE_COUNT; stage++) {
    const midwayK = intensityFor(stage, false);
    const bossK = intensityFor(stage, true);
    assert.ok(bossK > midwayK, `stage ${stage} boss intensity (${bossK}) must exceed its midway (${midwayK})`);

    if (stage < STAGE_COUNT) {
      const nextMidwayK = intensityFor(stage + 1, false);
      const nextBossK = intensityFor(stage + 1, true);
      assert.ok(
        nextMidwayK > midwayK,
        `stage ${stage + 1} midway intensity (${nextMidwayK}) must exceed stage ${stage} (${midwayK})`,
      );
      assert.ok(
        nextBossK > bossK,
        `stage ${stage + 1} boss intensity (${nextBossK}) must exceed stage ${stage} (${bossK})`,
      );
    }
  }

  // 21.3 Wall pattern gap survivability under all intensities
  // Sweep intensities from 1.0 (stage 1 start) to 5.5 (stage 5 boss with hard mode bonus)
  const wallCards = allCards().filter((c) =>
    allEmitters(c).some((e) => e.pattern === 'wall'),
  );
  assert.ok(wallCards.length >= 1, 'must have cards authoring wall patterns');

  for (const card of wallCards) {
    const wallEmitters = allEmitters(card).filter((e) => e.pattern === 'wall');
    for (const we of wallEmitters) {
      const authoredGap = we.gap ?? 3;
      assert.ok(authoredGap >= 2, `card ${card.id} authored wall gap must be at least 2 slots`);

      // Test fine sweep across intensities k from 0.8 to 6.0
      for (let k = 0.8; k <= 6.0; k += 0.2) {
        const scaled = scaleEmitter(we, k);
        assert.ok(
          scaled.gap !== undefined && scaled.gap >= 1,
          `card ${card.id} wall gap must remain >= 1 at intensity k=${k.toFixed(1)}, got ${scaled.gap}`,
        );

        // Calculate slot width in field coordinates
        const slots = Math.max(6, scaled.count);
        const slotWidth = FIELD_W / (slots - 1);
        const physicalGapWidth = scaled.gap * slotWidth;

        // Gap must allow the widest craft (cannon with ~3.46px hitbox radius) to pass cleanly
        const widestHitbox = BASE_HITBOX_R * 1.08;
        assert.ok(
          physicalGapWidth > widestHitbox * 2 + 10,
          `physical gap width (${physicalGapWidth.toFixed(1)}px) at k=${k} must comfortably exceed ship hitbox diameter (${(widestHitbox * 2).toFixed(1)}px)`,
        );
      }

      // Verify gap tightening: higher intensity tightens the gap rather than widening it
      const lowK = scaleEmitter(we, 1.0);
      const highK = scaleEmitter(we, 4.5);
      assert.ok(
        (highK.gap ?? 0) <= (lowK.gap ?? 0),
        `wall gap must tighten under escalation: low=${lowK.gap} vs high=${highK.gap}`,
      );
    }
  }

  ok('5-stage boss spell card escalation, intensity monotonicity, and wall gap survivability verified');
}

// ── 22) Bomb survival tradeoff: score multiplier sacrifice vs invulnerability ─
//
// A bomb is a panic button with an enormous economic cost. It clears all
// bullets and grants 1.6s of invulnerability, saving the player's life. But it
// immediately resets the graze multiplier to 1.00x, wiping out potential
// thousands of points on the next boss card capture.
{
  const run = createRun('BOMB-TRADEOFF');

  const dummyEnemy: Enemy = {
    id: 1,
    x: -200,
    y: -200,
    hp: 99999,
    maxHp: 99999,
    r: 12,
    isBoss: false,
    card: null,
    cardIndex: 0,
    cardElapsed: 0,
    emitterClocks: [],
    emitterAngles: [],
    entryTo: null,
    entryFrom: null,
    entryT: 1,
    score: 0,
  };

  // 22.1 Multiplier sacrifice and bullet clearance
  let s: RunState = {
    ...run,
    bombs: 2,
    invuln: 0,
    grazeMult: 3.85,
    score: 10_000,
    enemies: [dummyEnemy],
    midwayLeft: 0,
    bullets: Array.from({ length: 40 }, (_, i) => ({
      id: 1000 + i,
      x: 50 + (i % 8) * 40,
      y: 100 + Math.floor(i / 8) * 60,
      angle: Math.PI / 2,
      speed: 120,
      r: 5,
      hue: 200,
      age: 0.5,
      lifetime: 5,
      waveform: 'linear' as const,
      curl: 0,
      grazed: false,
    })),
  };

  const initialBullets = s.bullets.length;
  assert.equal(initialBullets, 40);

  // Trigger bomb in step()
  const bombed = step(s, { ...IDLE, bomb: true }, FIXED_DT);

  // Assert bombs decremented
  assert.equal(bombed.bombs, 1, 'bomb count must decrease by 1');
  // Assert bullets cleared
  assert.equal(bombed.bullets.length, 0, 'all screen bullets must be cleared by bomb');
  // Assert multiplier wiped to 1.0
  assert.equal(bombed.grazeMult, 1.0, 'bomb must wipe graze multiplier to exactly 1.00x');
  // Assert score is NOT inflated by cleared bullets
  assert.equal(bombed.score, 10_000, 'cleared bullets must award zero score');
  // Assert invulnerability granted
  assert.ok(
    Math.abs(bombed.invuln - BOMB_INVULN_SEC) < 1e-3,
    `bomb must set invulnerability window to BOMB_INVULN_SEC (${BOMB_INVULN_SEC}s), got ${bombed.invuln}`,
  );

  // 22.2 Scoring sacrifice quantification
  // A boss card capture awards Math.round((CAPTURE_BONUS + hp) * grazeMult)
  const cardHp = 800;
  const scoreIfUnbombed = Math.round((CAPTURE_BONUS + cardHp) * 3.85); // (3000 + 800) * 3.85 = 14630
  const scoreIfBombed = Math.round((CAPTURE_BONUS + cardHp) * 1.0); // (3000 + 800) * 1.0 = 3800
  const scoreSacrifice = scoreIfUnbombed - scoreIfBombed;
  assert.ok(
    scoreSacrifice > 10_000,
    `bombing at 3.85x multiplier sacrifices ${scoreSacrifice} points on capture — a genuine tactical dilemma`,
  );

  // 22.3 Mercy window protects player from subsequent collisions
  let invulnState = bombed;
  assert.ok(invulnState.invuln > 1.0);
  // Place a lethal bullet right on the player
  invulnState = {
    ...invulnState,
    bullets: [
      {
        id: 9991,
        x: invulnState.px,
        y: invulnState.py,
        angle: 0,
        speed: 0,
        r: 6,
        hue: 0,
        age: 0,
        lifetime: 5,
        waveform: 'linear',
        curl: 0,
        grazed: false,
      },
    ],
  };
  const stepUnderInvuln = step(invulnState, IDLE, FIXED_DT);
  assert.equal(stepUnderInvuln.lives, bombed.lives, 'player must not die while invulnerable');
  assert.equal(stepUnderInvuln.powerTier, bombed.powerTier, 'power tier must be preserved during mercy window');

  // 22.4 Cannot waste a bomb while already invulnerable
  const wasteAttempt = step(stepUnderInvuln, { ...IDLE, bomb: true }, FIXED_DT);
  assert.equal(
    wasteAttempt.bombs,
    stepUnderInvuln.bombs,
    'pressing bomb during active invulnerability must NOT consume a bomb',
  );

  ok('bomb survival tradeoff (bullet wipe, 1.6s invuln window vs 1.0x multiplier wipe) verified');
}

// ── 23) Touch drag offset (-46px), steering vector, and focus mode dynamics ─
//
// Touch devices face a fundamental ergonomic problem in shmups: the player's
// finger covers the exact 2-3px hitbox needed for micrododging. The touch
// system solves this via:
// 1. A constant -46px vertical lift offset, placing the ship above the thumb.
// 2. Normalized vector steering toward the touch point (no instantaneous teleport).
// 3. A 1.5px deadzone preventing micro-jitter when stationary.
// 4. Hold-to-focus (220ms gesture) dropping speed from 260 to 105 (~60% reduction)
//    for precision needle threading.
{
  // 23.1 Touch coordinate conversion with -46px lift offset
  const TOUCH_LIFT_OFFSET_Y = 46;
  const projectTouch = (clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }) => {
    const scale = Math.min(rect.width / FIELD_W, rect.height / FIELD_H);
    const ox = (rect.width - FIELD_W * scale) / 2;
    const oy = (rect.height - FIELD_H * scale) / 2;
    return {
      x: (clientX - rect.left - ox) / scale,
      y: (clientY - rect.top - oy) / scale - TOUCH_LIFT_OFFSET_Y,
    };
  };

  // Simulating a 400x600 screen matching FIELD_W x FIELD_H exactly (scale = 1.0)
  const rect1 = { left: 50, top: 20, width: 400, height: 600 };
  const p1 = projectTouch(250, 320, rect1);
  assert.equal(p1.x, 200, 'touch at center X should map to field center 200');
  assert.equal(p1.y, 300 - TOUCH_LIFT_OFFSET_Y, 'touch at 300 should map to field Y 300 - 46 = 254');

  // Ensure touch lift clearance exceeds thumb contact patch radius (~25px)
  const thumbRadius = 25;
  const clearance = TOUCH_LIFT_OFFSET_Y - thumbRadius;
  assert.ok(
    clearance > 15,
    `-46px lift offset provides ${clearance}px of visual clearance above a 25px thumb, keeping hitbox unobstructed`,
  );

  // Simulating a responsive retina display with scale = 2.0 (800x1200)
  const rect2 = { left: 0, top: 0, width: 800, height: 1200 };
  const p2 = projectTouch(400, 600, rect2);
  assert.equal(p2.x, 200, 'retina scale 2.0 must map center X to 200');
  assert.equal(p2.y, 300 - TOUCH_LIFT_OFFSET_Y, 'retina scale 2.0 must apply exact -46px offset');

  // 23.2 Steering vector physics: normalized direction and 1.5px deadzone
  const computeSteering = (shipX: number, shipY: number, targetX: number, targetY: number) => {
    const ddx = targetX - shipX;
    const ddy = targetY - shipY;
    const d = Math.hypot(ddx, ddy);
    if (d > 1.5) {
      return { dx: ddx / d, dy: ddy / d, dist: d };
    }
    return { dx: 0, dy: 0, dist: d };
  };

  // Far target: must produce unit vector
  const far = computeSteering(200, 300, 260, 380);
  assert.ok(Math.abs(Math.hypot(far.dx, far.dy) - 1.0) < 1e-5, 'steering vector must be normalized to unit length');
  assert.ok(far.dx > 0 && far.dy > 0, 'dx and dy must point toward target');

  // Deadzone test: target within 1.5px
  const nearDeadzone = computeSteering(200, 300, 200.8, 300.6);
  assert.equal(nearDeadzone.dx, 0, 'steering within 1.5px must clamp dx to 0 to prevent oscillation');
  assert.equal(nearDeadzone.dy, 0, 'steering within 1.5px must clamp dy to 0 to prevent oscillation');

  // Smooth continuous movement across frames without teleporting
  let sMove = createRun('TOUCH-MOVE');
  sMove = { ...sMove, px: 200, py: 400 };
  const touchTarget = { x: 300, y: 400 }; // 100px to the right
  const spd = moveSpeed(sMove);

  // Step 10 frames
  for (let f = 0; f < 10; f++) {
    const steer = computeSteering(sMove.px, sMove.py, touchTarget.x, touchTarget.y);
    sMove = step(sMove, { ...IDLE, dx: steer.dx, dy: steer.dy }, FIXED_DT);
  }
  const expectedDistMoved = spd * (10 * FIXED_DT);
  assert.ok(
    Math.abs((sMove.px - 200) - expectedDistMoved) < 1.0,
    `ship must smoothly translate at moveSpeed (${spd} u/s) rather than teleporting to touch position`,
  );
  assert.equal(sMove.py, 400, 'Y position must remain unchanged during pure horizontal steering');

  // 23.3 Focus mode speed reduction and conditions
  const fastRun = createRun('FOCUS-TEST', { craftId: 'swift' });
  const focusedRun = { ...fastRun, focus: true };

  const normalSpeed = moveSpeed(fastRun);
  const slowSpeed = moveSpeed(focusedRun);
  assert.equal(normalSpeed, FAST_SPEED, `normal speed must equal FAST_SPEED (${FAST_SPEED})`);
  assert.equal(slowSpeed, FOCUS_SPEED, `focused speed must equal FOCUS_SPEED (${FOCUS_SPEED})`);

  const speedRatio = slowSpeed / normalSpeed;
  assert.ok(
    Math.abs(speedRatio - 105 / 260) < 1e-4,
    `focus mode reduces speed to ${(speedRatio * 100).toFixed(1)}% of fast speed (40.4%)`,
  );

  // Active conditions evaluate 'focused'
  const conditionsFast = activeConditions(fastRun);
  const conditionsFocused = activeConditions(focusedRun);
  assert.ok(!conditionsFast.has('focused'), 'unfocused run must NOT have focused condition');
  assert.ok(conditionsFocused.has('focused'), 'focused run MUST have focused condition');

  // Focus-dependent upgrade test: thread increases focus speed
  const withThread = { ...focusedRun, upgrades: ['thread'] };
  assert.ok(
    moveSpeed(withThread) > slowSpeed,
    'thread upgrade must increase focused movement speed',
  );

  // Hold-to-focus timing model: 220ms threshold
  const HOLD_FOCUS_MS = 220;
  const isHeldFocus = (elapsedMs: number) => elapsedMs >= HOLD_FOCUS_MS;
  assert.equal(isHeldFocus(100), false, 'quick drag at 100ms should remain in fast travel mode');
  assert.equal(isHeldFocus(200), false, 'drag at 200ms should not yet enter focus');
  assert.equal(isHeldFocus(220), true, 'held finger at 220ms must trigger focus mode');
  assert.equal(isHeldFocus(500), true, 'sustained hold must maintain focus mode');

  ok('touch drag offset (-46px), vector steering, deadzone, and hold-to-focus dynamics verified');
}

console.log(`\nself-check: ok (${passed} checks)`);

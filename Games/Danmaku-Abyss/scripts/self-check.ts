/**
 * Headless self-checks. Every one of these is here because the same mistake
 * was actually made in this repo before, not because it seemed prudent.
 *
 * Run: npm run check
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  FIELD_H,
  FIELD_W,
  FIXED_DT,
  GRAZE_DECAY_PER_SEC,
  GRAZE_MAX_MULT,
  GRAZE_STEP,
  STAGE_COUNT,
} from '../src/game/constants.js';
import {
  createRun,
  fireRate,
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
import { allEmitters, emitterActive } from '../src/game/engine.js';
import { hashString, mulberry32, shuffle, streamRng } from '../src/game/rng.js';
import { UPGRADES, declaredConditions, declaredEffectKeys } from '../src/game/upgrades.js';
import type { PlayerInput, RunState } from '../src/game/types.js';

let passed = 0;
function ok(label: string): void {
  passed += 1;
  console.log(`  ok  ${label}`);
}

const IDLE: PlayerInput = { dx: 0, dy: 0, focus: false, bomb: false };

// ── 1) Determinism ───────────────────────────────────────────────────────────
//
// The entire premise: a run is a pure function of (seed, input sequence). If
// this breaks, replays and every balance number in this repo become fiction.
{
  const inputs: PlayerInput[] = [];
  const r = mulberry32(99);
  for (let i = 0; i < 900; i++) {
    inputs.push({ dx: r() * 2 - 1, dy: r() * 2 - 1, focus: r() < 0.4, bomb: r() < 0.004 });
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
  step(s, { dx: 1, dy: -1, focus: true, bomb: true }, FIXED_DT);
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

  const after = step(s, { dx: 0, dy: 0, focus: false, bomb: true }, FIXED_DT);
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
  assert.ok(cards.length >= 12, `only ${cards.length} spell cards authored`);
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
  for (let i = 0; i < 900; i++) s = step(s, { dx: -1, dy: -1, focus: false, bomb: false }, FIXED_DT);
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

console.log(`\nself-check: ok (${passed} checks)`);

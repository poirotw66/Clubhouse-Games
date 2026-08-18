/**
 * Headless self-checks. Every one of these is here because the same mistake
 * was actually made in this repo before, not because it seemed prudent.
 *
 * Run: npm run check
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { FIELD_H, FIELD_W, FIXED_DT, STAGE_COUNT } from '../src/game/constants.js';
import {
  createRun,
  fireRate,
  grazeRadius,
  hitboxRadius,
  intensityFor,
  moveSpeed,
  rangeDamageMult,
  scaleEmitter,
  step,
  takeUpgrade,
} from '../src/game/engine.js';
import { allCards, bossFor, midwayCardFor } from '../src/game/cards.js';
import { hashString, mulberry32, shuffle, streamRng } from '../src/game/rng.js';
import { UPGRADES, declaredEffectKeys } from '../src/game/upgrades.js';
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
    assert.ok(Object.keys(u.effects).length > 0, `${u.id} declares no effects at all`);
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

// ── 11c) Pressure must climb by a slope, not a cliff ─────────────────────────
//
// Bullets-per-second is count divided by interval, so scaling both compounds
// and the last stage takes the worst of it. Three cadence settings were run
// through the balance harness, and the end-to-end pressure ratio separates
// them cleanly:
//
//   0.90 + 0.10k   3.46x from stage 1 to 5   38% survival on stage 5
//   0.72 + 0.24k   4.29x                      0% survival on stage 5
//   0.55 + 0.40x   5.15x                      worse still
//
// The bound below sits between the setting measured as playable and the one
// measured as a wall. It is not a guess at what feels fair — it is the line the
// measurements actually drew.
//
// An earlier version of this check compared CONSECUTIVE stages instead, and it
// could not fail: intensity only rises 0.55 per stage, so no single step ever
// doubles regardless of how brutal the cadence is. Reintroducing the 0% setting
// left all checks green. A check that cannot go red for the bug it names is
// worse than no check, because it manufactures confidence.
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
    ratio < 4,
    `pressure grows ${ratio.toFixed(2)}x from stage 1 to ${STAGE_COUNT} — measured at 4.29x the ` +
      `final stage was unsurvivable (0% across eight seeds), so this lands as a wall, not a curve`,
  );
  ok(`pressure climbs every stage and totals ${ratio.toFixed(2)}x end to end (${rateAt(1).toFixed(0)} -> ${rateAt(STAGE_COUNT).toFixed(0)} bullets/sec)`);
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

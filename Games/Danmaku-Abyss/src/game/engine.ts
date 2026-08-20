/**
 * The whole simulation: a fixed-timestep pure reducer `step(state, input, dt)`.
 * Nothing here touches the DOM, and every function returns a new RunState
 * rather than mutating its input, so the renderer, the self-check and the
 * balance harness can all treat RunState as an immutable snapshot.
 *
 * Determinism is the point. A run is a pure function of (seed, input
 * sequence): no Math.random is called during play, patterns advance off
 * accumulated clocks rather than rolls, and every random draw that does happen
 * (upgrade offers, midway placement) comes from its own labelled stream.
 */
import {
  BASE_GRAZE_R,
  BASE_HITBOX_R,
  BOMB_CLEARS_GRAZE,
  BOMB_INVULN_SEC,
  CAPTURE_BONUS,
  DAMAGE_FALLOFF_RANGE,
  DAMAGE_FAR_MULT,
  DAMAGE_NEAR_MULT,
  FAST_SPEED,
  FIELD_H,
  FIELD_W,
  FRAGMENT_ARM_SEC,
  FOCUS_SPEED,
  GRAZE_DECAY_PER_SEC,
  GRAZE_MAX_MULT,
  GRAZE_STEP,
  KILL_SCORE,
  MAX_POWER_TIER,
  MIDWAY_SEC,
  RESPAWN_INVULN_SEC,
  SCORE_PER_BOMB,
  SCORE_PER_LIFE,
  STAGE_COUNT,
  START_BOMBS,
  START_LIVES,
  type Emitter,
  type SpellCard,
  FIXED_HOMING_AT_MAX,
  FIXED_HOMING_FULL_K,
} from './constants';
import { bossFor, midwayCardFor } from './cards';
import { hashString, shuffle, streamRng } from './rng';
import {
  UPGRADES,
  UPGRADE_BY_ID,
  conditionalEffect,
  effect,
  type Condition,
} from './upgrades';
import type { Bullet, Enemy, PlayerInput, PowerFragment, RunState } from './types';

// ── Conditions ───────────────────────────────────────────────────────────────

/**
 * Which conditional states hold right now. Every Condition an upgrade can key
 * off is decided here and nowhere else, so there is exactly one place to check
 * when asking whether a condition is real — the self-check asserts each
 * declared condition appears in this function.
 *
 * A condition that is declared but never evaluated is the same silent failure
 * as an unwired effect key: the upgrade reads as a bonus, does nothing, and
 * produces no error anywhere.
 */
export function activeConditions(s: RunState): Set<Condition> {
  const active = new Set<Condition>();
  if (s.grazeMult >= 2) active.add('grazeHigh');
  if (s.lives <= 1) active.add('lastLife');
  if (s.focus) active.add('focused');
  if (s.bombs <= 0) active.add('bombless');
  if (s.powerTier >= MAX_POWER_TIER) active.add('fullPower');

  for (const e of s.enemies) {
    if (e.entryTo) continue;
    if (Math.hypot(e.x - s.px, e.y - s.py) < 120) {
      active.add('pointBlank');
      break;
    }
  }
  return active;
}

/**
 * The value of one effect key for this state: the flat contribution plus
 * whatever the currently-true conditions add. Everything downstream reads
 * through here rather than `effect` directly, so a conditional upgrade cannot
 * be silently ignored by one call site.
 */
export function effectNow(s: RunState, key: Parameters<typeof effect>[1]): number {
  return effect(s.upgrades, key) + conditionalEffect(s.upgrades, key, activeConditions(s));
}

// ── Derived player stats ─────────────────────────────────────────────────────
//
// Every EffectKey an upgrade can declare is read in this section or in step().
// The self-check greps this file for each declared key, because a key nothing
// reads makes the upgrade's text a silent lie.

export function hitboxRadius(s: RunState): number {
  return Math.max(1, BASE_HITBOX_R * (1 + effectNow(s, 'hitboxPct')));
}

export function grazeRadius(s: RunState): number {
  return BASE_GRAZE_R * (1 + effectNow(s, 'grazeRangePct'));
}

export function moveSpeed(s: RunState): number {
  return s.focus
    ? FOCUS_SPEED * (1 + effectNow(s, 'focusSpeedPct'))
    : FAST_SPEED * (1 + effectNow(s, 'fastSpeedPct'));
}

/** Volleys per second, rising with power tier and fireRatePct. */
export function fireRate(s: RunState): number {
  const base = 5.5 + s.powerTier * 1.1;
  return Math.max(1, base * (1 + effectNow(s, 'fireRatePct')));
}

export function shotsPerVolley(s: RunState): number {
  return Math.max(1, 1 + Math.floor(s.powerTier / 2) + effectNow(s, 'shotWidth'));
}

export function invulnAfterDeath(s: RunState): number {
  return Math.max(0.4, RESPAWN_INVULN_SEC + effectNow(s, 'invulnSec'));
}

export function cardTimeBonus(s: RunState): number {
  return effectNow(s, 'cardTimeSec');
}

/**
 * Damage multiplier by range. Close is worth far more, and `nearBonusPct`
 * steepens the reward rather than shifting the whole curve up — an upgrade
 * that made distance irrelevant would delete the game's only real decision.
 */
export function rangeDamageMult(s: RunState, dist: number): number {
  const t = Math.min(1, Math.max(0, dist / DAMAGE_FALLOFF_RANGE));
  const near = DAMAGE_NEAR_MULT * (1 + effectNow(s, 'nearBonusPct'));
  return near + (DAMAGE_FAR_MULT - near) * t;
}

export function shotDamage(s: RunState, dist: number): number {
  const base = 8 + s.powerTier * 3;
  return base * (1 + effectNow(s, 'damagePct')) * rangeDamageMult(s, dist);
}

export function grazeGain(s: RunState): number {
  return GRAZE_STEP * (1 + effectNow(s, 'grazeGainPct'));
}

export function fragmentPull(s: RunState): number {
  return effectNow(s, 'fragmentPullPct');
}

// ── Difficulty ───────────────────────────────────────────────────────────────

/**
 * A single continuous scalar drives every emitter parameter, so "the attacks
 * get crazier" is a curve that can be measured rather than a table of hand-cut
 * tiers. Boss fights sit a step above their stage's midway.
 */
export function intensityFor(stage: number, boss: boolean): number {
  // Raised from 0.55 after a controlled measurement. Holding everything else
  // fixed and varying only this slope, over eight seeds:
  //
  //            no upgrades        normal upgrades
  //   +0.55    100% / 3.0 lives   100% / 2.9   <- shipped, no failure state
  //   +0.85     63% / 1.1          88% / 1.6
  //   +1.15      0% / 0.0          13% / 0.1
  //
  // Perfectly monotonic in clear rate. An earlier note in this repo claimed the
  // lever had "saturated" and that adding danger cancelled itself through a
  // graze-to-combat feedback loop. That was wrong: it was built on the LIVES
  // figure wobbling (2.6 -> 2.9 -> 2.0 across three slopes), which is the
  // noisier of the two measures over eight seeds, while the clear rate was
  // monotone the whole time. The control that settled it was running with the
  // upgrade list stripped entirely — with nothing for the supposed loop to run
  // through, raising the slope still took clear rate from 100% to 63% to 0%.
  return 1 + (stage - 1) * 0.85 + (boss ? 0.35 : 0);
}

/** Tightens an authored emitter by the run's current intensity. */
export function scaleEmitter(e: Emitter, intensity: number): Emitter {
  const k = intensity;
  if (e.pattern === 'wall') {
    // A wall escalates by closing its gap, never by adding slots: more slots on
    // a fixed field width just puts smaller bullets in the same places, while a
    // narrower gap is what actually raises the demand.
    return {
      ...e,
      gap: Math.max(1, Math.round((e.gap ?? 3) - (k - 1) * 0.45)),
      interval: Math.max(0.4, e.interval / (0.9 + 0.1 * k)),
      speed: e.speed * (0.85 + 0.15 * k),
    };
  }
  return {
    ...e,
    count: Math.max(1, Math.round(e.count * (0.75 + 0.32 * k))),
    // Bullets-per-second is count divided by interval, so scaling both
    // aggressively makes the pressure grow quadratically and the last stage
    // lands as a wall. Measured at 0.72 + 0.24k: survival ran 100/100/100/88/0%
    // across the five stages. Letting count carry the escalation and easing the
    // cadence gives 100/100/88/88/38% — still clearly the hardest stage, but a
    // slope instead of a cliff.
    interval: Math.max(0.05, e.interval / (0.90 + 0.10 * k)),
    speed: e.speed * (0.8 + 0.2 * k),
    // A fixed spray you can stand still against leans toward the ship as the
    // run escalates. This used to be a hard swap to 'aimed' above k = 2.4, for
    // odd-count emitters only; see FIXED_HOMING_AT_MAX for why both halves of
    // that were wrong. The lean is continuous in k and applies to every fixed
    // emitter, so the escalation is a slope with no stage boundary in it and no
    // dependence on how many bullets the pattern happens to be authored with.
    homing:
      e.aim === 'fixed'
        ? FIXED_HOMING_AT_MAX *
          Math.max(0, Math.min(1, (k - 1) / (FIXED_HOMING_FULL_K - 1)))
        : 0,
  };
}

// ── Construction ─────────────────────────────────────────────────────────────

/**
 * `startStage` exists for measurement. The difficulty curve must be knowable
 * without the harness pilot first surviving everything before it — otherwise
 * every late-stage number is conditional on early-stage luck, and a run that
 * dies at stage 2 reports "peak bullet count: stage 1" as though that were a
 * property of the game rather than of the pilot.
 */
export function createRun(seedCode: string, startStage = 1): RunState {
  const seed = hashString(seedCode);
  const s: RunState = {
    seed,
    seedCode,
    tick: 0,
    phase: 'playing',
    stage: startStage,
    intensity: intensityFor(startStage, false),
    px: FIELD_W / 2,
    py: FIELD_H - 90,
    lives: START_LIVES,
    bombs: START_BOMBS,
    powerTier: 1,
    invuln: RESPAWN_INVULN_SEC,
    focus: false,
    bullets: [],
    enemies: [],
    fragments: [],
    nextId: 1,
    grazeCount: 0,
    grazeMult: 1,
    score: 0,
    captures: 0,
    upgrades: [],
    offered: [],
    midwayLeft: MIDWAY_SEC,
    bossSpawned: false,
    elapsed: 0,
    lastCardResult: null,
  };
  return s;
}

function clone(s: RunState): RunState {
  return {
    ...s,
    bullets: s.bullets.map((b) => ({ ...b })),
    enemies: s.enemies.map((e) => ({
      ...e,
      card: e.card ? { ...e.card, emitters: e.card.emitters.map((m: Emitter) => ({ ...m })) } : null,
      emitterClocks: e.emitterClocks.slice(),
      emitterAngles: e.emitterAngles.slice(),
      entryTo: e.entryTo ? { ...e.entryTo } : null,
      entryFrom: e.entryFrom ? { ...e.entryFrom } : null,
    })),
    fragments: s.fragments.map((f) => ({ ...f })),
    upgrades: s.upgrades.slice(),
    offered: s.offered.slice(),
  };
}

function makeEnemy(
  s: RunState,
  x: number,
  y: number,
  card: SpellCard | null,
  isBoss: boolean,
  entryTo: { x: number; y: number } | null,
): Enemy {
  return {
    id: s.nextId++,
    x,
    y,
    hp: card ? card.hp : 40,
    maxHp: card ? card.hp : 40,
    r: isBoss ? 26 : 12,
    isBoss,
    card,
    cardIndex: 0,
    cardElapsed: 0,
    emitterClocks: card ? allEmitters(card).map(() => 0) : [],
    emitterAngles: card ? allEmitters(card).map(() => 0) : [],
    entryTo,
    entryFrom: entryTo ? { x, y } : null,
    entryT: 0,
    score: isBoss ? KILL_SCORE * 20 : KILL_SCORE,
  };
}

/**
 * A card's emitters as one flat list: the base set first, then each phase's in
 * order. Indices are stable for the card's whole life, so an emitter's volley
 * clock and rotation survive a phase switching on — rebuilding the array per
 * phase would reset every rotating pattern mid-fight.
 */
export function allEmitters(card: SpellCard): Emitter[] {
  return [...card.emitters, ...(card.phases ?? []).flatMap((p) => p.emitters)];
}

/** Whether the emitter at `index` is firing right now, given how hurt the boss is. */
export function emitterActive(card: SpellCard, index: number, hpFrac: number): boolean {
  if (index < card.emitters.length) return true;
  let cursor = card.emitters.length;
  for (const phase of card.phases ?? []) {
    if (index < cursor + phase.emitters.length) return hpFrac <= phase.belowHpFrac;
    cursor += phase.emitters.length;
  }
  return false;
}

// ── Player shots ─────────────────────────────────────────────────────────────
//
// Player fire is modelled as instantaneous hitscan volleys rather than travelling
// projectiles. That keeps the damage a clean function of the distance at the
// moment of firing, which is exactly the quantity the whole design is built on;
// travelling shots would smear it across the flight time and make the falloff
// curve unmeasurable.

function fireVolley(s: RunState): void {
  const shots = shotsPerVolley(s);
  for (const e of s.enemies) {
    if (e.entryTo) continue; // still gliding in, not yet a target
    const dx = e.x - s.px;
    const dy = e.y - s.py;
    // Shots go up: only enemies roughly ahead of the ship can be hit.
    if (dy > 40) continue;
    const dist = Math.hypot(dx, dy);
    const lateral = Math.abs(dx);
    const reach = 26 + shots * 9;
    if (lateral > reach) continue;
    e.hp -= shotDamage(s, dist) * shots;
  }
}

// ── Bullets ──────────────────────────────────────────────────────────────────

/**
 * Lays a wall of bullets across the field with one gap, travelling down.
 *
 * The gap walks from volley to volley rather than tracking the player: a gap
 * that follows you is just an aimed shot, and a gap that stays put is free
 * after the first one. Walking it forces repositioning on a schedule you can
 * read but cannot ignore.
 */
function emitWall(s: RunState, e: Enemy, scaled: Emitter, volley: number): void {
  const slots = Math.max(6, scaled.count);
  const gap = Math.max(1, scaled.gap ?? 2);
  const span = Math.max(1, slots - gap);
  const gapStart = ((volley * 3) % span) | 0;
  const stepX = FIELD_W / (slots - 1);

  for (let i = 0; i < slots; i++) {
    if (i >= gapStart && i < gapStart + gap) continue;
    s.bullets.push({
      id: s.nextId++,
      x: i * stepX,
      y: e.y,
      angle: Math.PI / 2,
      speed: scaled.speed,
      r: scaled.bulletR,
      hue: scaled.hue,
      age: 0,
      lifetime: scaled.lifetime,
      waveform: scaled.waveform,
      curl: 0,
      grazed: false,
      isWall: true,
    });
  }
}

function emitFrom(s: RunState, e: Enemy, emitter: Emitter, index: number, volley: number): void {
  const scaled = scaleEmitter(emitter, s.intensity);
  if (scaled.pattern === 'wall') {
    emitWall(s, e, scaled, volley);
    return;
  }
  let base: number;
  if (scaled.aim === 'aimed') {
    base = Math.atan2(s.py - e.y, s.px - e.x);
  } else if (scaled.aim === 'rotating') {
    base = e.emitterAngles[index];
  } else {
    // Straight down the field as authored, rotated toward the ship by the
    // intensity-derived lean. Taken along the shortest arc so a player standing
    // to the emitter's left and one standing to its right are treated the same.
    const down = Math.PI / 2;
    const toward = Math.atan2(s.py - e.y, s.px - e.x);
    let delta = toward - down;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    base = down + delta * (scaled.homing ?? 0);
  }

  const n = scaled.count;
  const start = base - scaled.spread / 2;
  const stepAngle = n > 1 ? scaled.spread / (n - 1) : 0;
  for (let i = 0; i < n; i++) {
    const angle = start + stepAngle * i;
    s.bullets.push({
      id: s.nextId++,
      x: e.x,
      y: e.y,
      angle,
      speed: scaled.waveform === 'accel' ? scaled.speed * 0.45 : scaled.speed,
      r: scaled.bulletR,
      hue: scaled.hue,
      age: 0,
      lifetime: scaled.lifetime,
      waveform: scaled.waveform,
      curl: scaled.waveform === 'spiral' ? scaled.angularVel : 0,
      grazed: false,
    });
  }
}

function advanceBullet(b: Bullet, dt: number): void {
  b.age += dt;
  if (b.waveform === 'spiral') {
    b.angle += b.curl * dt;
  } else if (b.waveform === 'accel') {
    b.speed += 150 * dt;
  } else if (b.waveform === 'reverse') {
    // Slows to a stop, then comes back the way it came. Punishes anyone who
    // dodges once and stops paying attention.
    b.speed -= 130 * dt;
  }
  b.x += Math.cos(b.angle) * b.speed * dt;
  b.y += Math.sin(b.angle) * b.speed * dt;
}

function offField(b: Bullet): boolean {
  const m = 40;
  return b.x < -m || b.x > FIELD_W + m || b.y < -m || b.y > FIELD_H + m;
}

// ── Death ────────────────────────────────────────────────────────────────────

/**
 * Death costs a life, drops a power tier, and scatters part of that power back
 * onto the field at the spot you died. Going back for it is the immediate,
 * dangerous decision that keeps a stock of lives from making death cheap.
 */
function killPlayer(s: RunState): void {
  s.lives -= 1;
  s.grazeMult = 1;
  const droppedTier = s.powerTier > 1 ? 1 : 0;
  s.powerTier = Math.max(1, s.powerTier - droppedTier);
  s.invuln = invulnAfterDeath(s);
  s.bullets = [];

  if (droppedTier > 0) {
    for (let i = 0; i < 3; i++) {
      s.fragments.push({
        id: s.nextId++,
        x: s.px + (i - 1) * 26,
        y: s.py - 10,
        vy: -34 - i * 8,
        age: 0,
      });
    }
  }
  s.px = FIELD_W / 2;
  s.py = FIELD_H - 90;

  if (s.lives <= 0) {
    s.phase = 'lost';
    s.score += s.bombs * SCORE_PER_BOMB;
  }
}

// ── Stage flow ───────────────────────────────────────────────────────────────

function offerUpgrades(s: RunState): void {
  const r = streamRng(s.seed, `offer:${s.stage}:${s.upgrades.length}`);
  const eligible = UPGRADES.filter(
    (u) => u.repeatable || !s.upgrades.includes(u.id),
  ).map((u) => u.id);
  s.offered = shuffle(eligible, r).slice(0, 3);
  s.phase = 'upgrade';
}

/** Applies an offered upgrade and resumes play. Immediate grants land here. */
export function takeUpgrade(state: RunState, id: string): RunState {
  if (state.phase !== 'upgrade' || !state.offered.includes(id)) return state;
  const s = clone(state);
  s.upgrades.push(id);
  const def = UPGRADE_BY_ID[id];
  if (def) {
    const lives = def.effects.lifeCount ?? 0;
    const bombs = def.effects.bombCount ?? 0;
    if (lives) s.lives += lives;
    if (bombs) s.bombs += bombs;
  }
  s.offered = [];
  s.stage += 1;
  if (s.stage > STAGE_COUNT) {
    s.phase = 'won';
    s.score += s.lives * SCORE_PER_LIFE + s.bombs * SCORE_PER_BOMB;
    return s;
  }
  s.phase = 'playing';
  s.intensity = intensityFor(s.stage, false);
  s.midwayLeft = MIDWAY_SEC;
  s.bossSpawned = false;
  s.bullets = [];
  s.enemies = [];
  return s;
}

// ── The step ─────────────────────────────────────────────────────────────────

export function step(state: RunState, input: PlayerInput, dt: number): RunState {
  if (state.phase !== 'playing') return state;

  const s = clone(state);
  s.tick += 1;
  s.elapsed += dt;
  s.focus = input.focus;
  s.invuln = Math.max(0, s.invuln - dt);

  // 1) Move.
  const len = Math.hypot(input.dx, input.dy) || 1;
  const sp = moveSpeed(s);
  s.px = Math.min(FIELD_W - 8, Math.max(8, s.px + (input.dx / len) * sp * dt * (input.dx || input.dy ? 1 : 0)));
  s.py = Math.min(FIELD_H - 8, Math.max(8, s.py + (input.dy / len) * sp * dt * (input.dx || input.dy ? 1 : 0)));

  // 2) Bomb.
  if (input.bomb && s.bombs > 0 && s.invuln <= 0) {
    s.bombs -= 1;
    s.bullets = [];
    s.invuln = BOMB_INVULN_SEC + effectNow(s, 'invulnSec');
    // Bailing out costs the multiplier you built by staying close.
    if (BOMB_CLEARS_GRAZE) s.grazeMult = 1;
  }

  // 3) Spawn: midway pressure until the timer runs out, then the stage boss.
  if (!s.bossSpawned) {
    s.midwayLeft -= dt;
    const wave = Math.floor((MIDWAY_SEC - s.midwayLeft) / 8);
    const expected = Math.max(0, Math.min(7, wave));
    const midwayAlive = s.enemies.filter((e) => !e.isBoss).length;
    if (midwayAlive < expected && s.midwayLeft > 4) {
      const r = streamRng(s.seed, `midway:${s.stage}:${s.enemies.length}:${wave}`);
      const x = 40 + r() * (FIELD_W - 80);
      s.enemies.push(
        makeEnemy(s, x, -20, midwayCardFor(s.stage, Math.floor(r() * 1000)), false, { x, y: 90 + r() * 90 }),
      );
    }
    if (s.midwayLeft <= 0) {
      s.bossSpawned = true;
      s.enemies = s.enemies.filter((e) => e.isBoss);
      s.intensity = intensityFor(s.stage, true);
      const boss = bossFor(s.stage);
      s.enemies.push(makeEnemy(s, FIELD_W / 2, -40, boss.cards[0], true, { x: FIELD_W / 2, y: 120 }));
    }
  }

  // 4) Enemies: glide in, then run their card's emitters.
  for (const e of s.enemies) {
    if (e.entryTo && e.entryFrom) {
      e.entryT = Math.min(1, e.entryT + dt / 1.1);
      const t = e.entryT * e.entryT * (3 - 2 * e.entryT); // smoothstep
      e.x = e.entryFrom.x + (e.entryTo.x - e.entryFrom.x) * t;
      e.y = e.entryFrom.y + (e.entryTo.y - e.entryFrom.y) * t;
      if (e.entryT >= 1) {
        e.entryTo = null;
        e.entryFrom = null;
      }
      continue;
    }
    if (!e.card) continue;
    e.cardElapsed += dt;
    const emitters = allEmitters(e.card);
    const hpFrac = e.maxHp > 0 ? Math.max(0, e.hp / e.maxHp) : 0;
    for (let i = 0; i < emitters.length; i++) {
      const em = emitters[i];
      if (e.cardElapsed < em.delay) continue;
      if (!emitterActive(e.card, i, hpFrac)) continue;
      const scaled = scaleEmitter(em, s.intensity);
      e.emitterAngles[i] += scaled.angularVel * dt;
      e.emitterClocks[i] += dt;
      while (e.emitterClocks[i] >= scaled.interval) {
        e.emitterClocks[i] -= scaled.interval;
        // Volley index drives the wall's gap walk, derived from elapsed time
        // so it stays a pure function of the run.
        emitFrom(s, e, em, i, Math.floor(e.cardElapsed / scaled.interval));
      }
    }
  }

  // 5) Player fire.
  const interval = 1 / fireRate(s);
  // Volleys are driven off elapsed time so the cadence is frame-rate independent.
  const volleysBefore = Math.floor((s.elapsed - dt) / interval);
  const volleysNow = Math.floor(s.elapsed / interval);
  for (let i = volleysBefore; i < volleysNow; i++) fireVolley(s);

  // 6) Resolve dead enemies and finished spell cards.
  const survivors: Enemy[] = [];
  for (const e of s.enemies) {
    if (!e.isBoss) {
      if (e.hp <= 0) {
        s.score += Math.round(e.score * s.grazeMult);
        if (s.powerTier < MAX_POWER_TIER && (s.tick + e.id) % 3 === 0) {
          s.fragments.push({ id: s.nextId++, x: e.x, y: e.y, vy: 30, age: 0 });
        }
      } else if (e.y < FIELD_H + 40) {
        survivors.push(e);
      }
      continue;
    }

    // Boss: a card ends either by being broken (capture) or by timing out.
    const limit = (e.card?.timeLimit ?? 30) + cardTimeBonus(s);
    const broken = e.hp <= 0;
    const timedOut = e.cardElapsed >= limit;
    if (!broken && !timedOut) {
      survivors.push(e);
      continue;
    }

    if (broken) {
      s.captures += 1;
      s.score += Math.round((CAPTURE_BONUS + e.score) * s.grazeMult);
      s.lastCardResult = 'captured';
    } else {
      s.lastCardResult = 'timeout';
    }
    s.bullets = [];

    const boss = bossFor(s.stage);
    const nextIndex = e.cardIndex + 1;
    if (nextIndex < boss.cards.length) {
      const card = boss.cards[nextIndex];
      const next: Enemy = {
        ...e,
        card,
        cardIndex: nextIndex,
        cardElapsed: 0,
        hp: card.hp,
        maxHp: card.hp,
        emitterClocks: card.emitters.map(() => 0),
        emitterAngles: card.emitters.map(() => 0),
      };
      survivors.push(next);
    }
    // else: the stage is over; the boss simply leaves.
  }
  s.enemies = survivors;

  // 7) Bullets: advance, graze, hit.
  const hitR = hitboxRadius(s);
  const grazeR = grazeRadius(s);
  const kept: Bullet[] = [];
  let died = false;
  for (const b of s.bullets) {
    advanceBullet(b, dt);
    if (b.age > b.lifetime || offField(b)) continue;
    const d = Math.hypot(b.x - s.px, b.y - s.py);
    if (d <= b.r + hitR) {
      if (s.invuln <= 0 && !died) {
        died = true;
        continue;
      }
    } else if (!b.grazed && d <= b.r + grazeR) {
      b.grazed = true;
      s.grazeCount += 1;
      s.grazeMult = Math.min(GRAZE_MAX_MULT, s.grazeMult + grazeGain(s));
    }
    kept.push(b);
  }
  s.bullets = kept;
  s.grazeMult = Math.max(1, s.grazeMult - GRAZE_DECAY_PER_SEC * dt);
  if (died) killPlayer(s);
  if (s.phase !== 'playing') return s;

  // 8) Fragments.
  const pull = fragmentPull(s);
  const keptFrags: PowerFragment[] = [];
  for (const f of s.fragments) {
    f.age += dt;
    f.vy = Math.min(70, f.vy + 60 * dt);
    f.y += f.vy * dt;
    if (pull > 0) {
      const dx = s.px - f.x;
      const dy = s.py - f.y;
      const dd = Math.hypot(dx, dy) || 1;
      f.x += (dx / dd) * 70 * pull * dt;
      f.y += (dy / dd) * 70 * pull * dt;
    }
    if (f.age >= FRAGMENT_ARM_SEC && Math.hypot(f.x - s.px, f.y - s.py) < 22) {
      s.powerTier = Math.min(MAX_POWER_TIER, s.powerTier + 1);
      continue;
    }
    if (f.y < FIELD_H + 30 && f.age < 12) keptFrags.push(f);
  }
  s.fragments = keptFrags;

  // 9) Stage clear?
  if (s.bossSpawned && s.enemies.length === 0) {
    offerUpgrades(s);
  }

  return s;
}

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
} from './constants';
import { bossFor, midwayCardFor } from './cards';
import { hashString, shuffle, streamRng } from './rng';
import { UPGRADES, UPGRADE_BY_ID, effect } from './upgrades';
import type { Bullet, Enemy, PlayerInput, PowerFragment, RunState } from './types';

// ── Derived player stats ─────────────────────────────────────────────────────
//
// Every EffectKey an upgrade can declare is read in this section or in step().
// The self-check greps this file for each declared key, because a key nothing
// reads makes the upgrade's text a silent lie.

export function hitboxRadius(s: RunState): number {
  return Math.max(1, BASE_HITBOX_R * (1 + effect(s.upgrades, 'hitboxPct')));
}

export function grazeRadius(s: RunState): number {
  return BASE_GRAZE_R * (1 + effect(s.upgrades, 'grazeRangePct'));
}

export function moveSpeed(s: RunState): number {
  return s.focus
    ? FOCUS_SPEED * (1 + effect(s.upgrades, 'focusSpeedPct'))
    : FAST_SPEED * (1 + effect(s.upgrades, 'fastSpeedPct'));
}

/** Volleys per second, rising with power tier and fireRatePct. */
export function fireRate(s: RunState): number {
  const base = 5.5 + s.powerTier * 1.1;
  return Math.max(1, base * (1 + effect(s.upgrades, 'fireRatePct')));
}

export function shotsPerVolley(s: RunState): number {
  return Math.max(1, 1 + Math.floor(s.powerTier / 2) + effect(s.upgrades, 'shotWidth'));
}

export function invulnAfterDeath(s: RunState): number {
  return Math.max(0.4, RESPAWN_INVULN_SEC + effect(s.upgrades, 'invulnSec'));
}

export function cardTimeBonus(s: RunState): number {
  return effect(s.upgrades, 'cardTimeSec');
}

/**
 * Damage multiplier by range. Close is worth far more, and `nearBonusPct`
 * steepens the reward rather than shifting the whole curve up — an upgrade
 * that made distance irrelevant would delete the game's only real decision.
 */
export function rangeDamageMult(s: RunState, dist: number): number {
  const t = Math.min(1, Math.max(0, dist / DAMAGE_FALLOFF_RANGE));
  const near = DAMAGE_NEAR_MULT * (1 + effect(s.upgrades, 'nearBonusPct'));
  return near + (DAMAGE_FAR_MULT - near) * t;
}

export function shotDamage(s: RunState, dist: number): number {
  const base = 8 + s.powerTier * 3;
  return base * (1 + effect(s.upgrades, 'damagePct')) * rangeDamageMult(s, dist);
}

export function grazeGain(s: RunState): number {
  return GRAZE_STEP * (1 + effect(s.upgrades, 'grazeGainPct'));
}

export function fragmentPull(s: RunState): number {
  return effect(s.upgrades, 'fragmentPullPct');
}

// ── Difficulty ───────────────────────────────────────────────────────────────

/**
 * A single continuous scalar drives every emitter parameter, so "the attacks
 * get crazier" is a curve that can be measured rather than a table of hand-cut
 * tiers. Boss fights sit a step above their stage's midway.
 */
export function intensityFor(stage: number, boss: boolean): number {
  return 1 + (stage - 1) * 0.55 + (boss ? 0.35 : 0);
}

/** Tightens an authored emitter by the run's current intensity. */
export function scaleEmitter(e: Emitter, intensity: number): Emitter {
  const k = intensity;
  return {
    ...e,
    count: Math.max(1, Math.round(e.count * (0.75 + 0.32 * k))),
    interval: Math.max(0.05, e.interval / (0.72 + 0.24 * k)),
    speed: e.speed * (0.8 + 0.2 * k),
    // Aimed volleys become more common with intensity: a fixed spray you can
    // stand still against turns into something that follows you.
    aim: e.aim === 'fixed' && k > 2.4 && e.count % 2 === 1 ? 'aimed' : e.aim,
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
    emitterClocks: card ? card.emitters.map(() => 0) : [],
    emitterAngles: card ? card.emitters.map(() => 0) : [],
    entryTo,
    entryFrom: entryTo ? { x, y } : null,
    entryT: 0,
    score: isBoss ? KILL_SCORE * 20 : KILL_SCORE,
  };
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

function emitFrom(s: RunState, e: Enemy, emitter: Emitter, index: number): void {
  const scaled = scaleEmitter(emitter, s.intensity);
  let base: number;
  if (scaled.aim === 'aimed') {
    base = Math.atan2(s.py - e.y, s.px - e.x);
  } else if (scaled.aim === 'rotating') {
    base = e.emitterAngles[index];
  } else {
    base = Math.PI / 2; // straight down the field
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
    s.invuln = BOMB_INVULN_SEC + effect(s.upgrades, 'invulnSec');
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
    for (let i = 0; i < e.card.emitters.length; i++) {
      const em = e.card.emitters[i];
      if (e.cardElapsed < em.delay) continue;
      const scaled = scaleEmitter(em, s.intensity);
      e.emitterAngles[i] += scaled.angularVel * dt;
      e.emitterClocks[i] += dt;
      while (e.emitterClocks[i] >= scaled.interval) {
        e.emitterClocks[i] -= scaled.interval;
        emitFrom(s, e, em, i);
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

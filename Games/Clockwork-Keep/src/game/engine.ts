/**
 * The whole simulation lives here: a fixed-timestep reducer `step(state, dt)`
 * plus a handful of discrete player commands (place/sell/upgrade/undo/start
 * wave). Nothing in this file touches the DOM, and every function returns a
 * new GameState rather than mutating its input — the renderer (and the
 * check-*.mjs scripts) can treat GameState as an immutable snapshot.
 */
import {
  CHAIN_RADIUS,
  DIFFICULTIES,
  ENEMY_DEFS,
  ENTRANCE,
  EXIT,
  OVERLAP_CALL_SCORE_MULT_BONUS,
  PREP_TIME_SEC,
  TOTAL_WAVES,
  TOWER_DEFS,
  type Difficulty,
  type EnemyType,
  type MapId,
  type TowerType,
} from './constants.ts';
import {
  applyDamage,
  applySlow,
  chainTargets,
  currentSpeedFactor,
  enemiesInRange,
  selectPrimaryTarget,
  splashTargets,
  tickSlowEffects,
} from './combat.ts';
import { calculateScore, overlapCallBonus, purchaseCost, sellRefund, upgradeCost, waveClearBonus } from './economy.ts';
import {
  computeFlowField,
  distanceToExit,
  makeEmptyOccupancy,
  wouldSealExit,
  type FlowField,
} from './pathfinding.ts';
import { getWaveSpawns } from './waves.ts';
import type { Enemy, GameState, OccupancyGrid, Tower } from './types.ts';

export interface CommandResult {
  state: GameState;
  ok: boolean;
  reason?: string;
}

// ── State construction & cloning ────────────────────────────────────────────

export function createInitialState(
  difficulty: Difficulty,
  mapId: MapId,
  endless: boolean,
): GameState {
  const cfg = DIFFICULTIES[difficulty];
  return {
    difficulty,
    mapId,
    endless,
    gridW: 12,
    gridH: 8,
    rocks: [],
    towers: [],
    nextTowerId: 1,
    enemies: [],
    nextEnemyId: 1,
    nextSpawnOrder: 0,
    gold: cfg.startingGold,
    lives: cfg.startingLives,
    killScore: 0,
    score: 0,
    wave: 0,
    phase: 'prep',
    prepTimer: PREP_TIME_SEC,
    pendingSpawns: [],
    waveElapsed: 0,
    waveScoreMult: 1,
    lastReversible: null,
    elapsedTime: 0,
    kills: 0,
  };
}

/** Rocks come from constants.MAP_ROCKS but are only wired in by the caller (App), so this stays test-friendly. */
export function withRocks(state: GameState, rocks: Array<{ x: number; y: number }>): GameState {
  return { ...state, rocks: rocks.map((r) => ({ ...r })) };
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    rocks: state.rocks.map((r) => ({ ...r })),
    towers: state.towers.map((t) => ({ ...t })),
    enemies: state.enemies.map((e) => ({ ...e, slowEffects: e.slowEffects.map((s) => ({ ...s })) })),
    pendingSpawns: state.pendingSpawns.map((s) => ({ ...s })),
    lastReversible: state.lastReversible ? { ...state.lastReversible } : null,
  };
}

// ── Grid helpers ─────────────────────────────────────────────────────────────

export function buildOccupancy(state: GameState): OccupancyGrid {
  const grid = makeEmptyOccupancy(state.gridW, state.gridH);
  for (const r of state.rocks) grid[r.y][r.x] = true;
  for (const t of state.towers) grid[t.y][t.x] = true;
  return grid;
}

export function isCellFree(state: GameState, x: number, y: number): boolean {
  if (x < 0 || x >= state.gridW || y < 0 || y >= state.gridH) return false;
  if (x === ENTRANCE.x && y === ENTRANCE.y) return false;
  if (x === EXIT.x && y === EXIT.y) return false;
  if (state.rocks.some((r) => r.x === x && r.y === y)) return false;
  if (state.towers.some((t) => t.x === x && t.y === y)) return false;
  return true;
}

// ── Commands ─────────────────────────────────────────────────────────────────

export function placeTower(state: GameState, x: number, y: number, type: TowerType): CommandResult {
  if (state.phase !== 'prep' && state.phase !== 'wave') {
    return { state, ok: false, reason: '遊戲已結束' };
  }
  if (!isCellFree(state, x, y)) {
    return { state, ok: false, reason: '此格無法放置' };
  }
  const cost = purchaseCost(type);
  if (state.gold < cost) {
    return { state, ok: false, reason: '金幣不足' };
  }
  const occupancy = buildOccupancy(state);
  if (wouldSealExit(occupancy, x, y, state.gridW, state.gridH, ENTRANCE, EXIT)) {
    return { state, ok: false, reason: '此放置會封死出口' };
  }

  const next = cloneState(state);
  const tower: Tower = {
    id: next.nextTowerId++,
    type,
    x,
    y,
    level: 0,
    investedGold: cost,
    cooldown: 0,
  };
  next.towers.push(tower);
  next.gold -= cost;
  next.lastReversible =
    state.phase === 'prep'
      ? { kind: 'place', towerId: tower.id, cost, priorLevel: null, x, y, type }
      : null;
  return { state: next, ok: true };
}

export function sellTower(state: GameState, towerId: number): CommandResult {
  const tower = state.towers.find((t) => t.id === towerId);
  if (!tower) return { state, ok: false, reason: '找不到該塔' };

  const refund = sellRefund(tower.investedGold);
  const next = cloneState(state);
  next.towers = next.towers.filter((t) => t.id !== towerId);
  next.gold += refund;
  if (next.lastReversible?.towerId === towerId) next.lastReversible = null;
  return { state: next, ok: true };
}

export function upgradeTower(state: GameState, towerId: number): CommandResult {
  const tower = state.towers.find((t) => t.id === towerId);
  if (!tower) return { state, ok: false, reason: '找不到該塔' };
  if (tower.level >= 2) return { state, ok: false, reason: '已達最高等級' };
  const cost = upgradeCost(tower.type, tower.level);
  if (cost === null) return { state, ok: false, reason: '已達最高等級' };
  if (state.gold < cost) return { state, ok: false, reason: '金幣不足' };

  const next = cloneState(state);
  const nextTower = next.towers.find((t) => t.id === towerId)!;
  const priorLevel = nextTower.level;
  nextTower.level = (nextTower.level + 1) as 0 | 1 | 2;
  nextTower.investedGold += cost;
  next.gold -= cost;
  next.lastReversible =
    state.phase === 'prep'
      ? { kind: 'upgrade', towerId, cost, priorLevel, x: nextTower.x, y: nextTower.y, type: nextTower.type }
      : null;
  return { state: next, ok: true };
}

export function undoLast(state: GameState): CommandResult {
  if (state.phase !== 'prep' || !state.lastReversible) {
    return { state, ok: false, reason: '目前沒有可撤銷的操作' };
  }
  const action = state.lastReversible;
  const next = cloneState(state);
  next.gold += action.cost;

  if (action.kind === 'place') {
    next.towers = next.towers.filter((t) => t.id !== action.towerId);
  } else {
    const tower = next.towers.find((t) => t.id === action.towerId);
    if (tower && action.priorLevel !== null) {
      tower.level = action.priorLevel;
      tower.investedGold -= action.cost;
    }
  }
  next.lastReversible = null;
  return { state: next, ok: true };
}

/** Enemies of the current wave that are neither dead nor already through the exit, plus those not yet spawned. */
export function unresolvedCount(state: GameState): number {
  const onBoard = state.enemies.filter((e) => !e.dead && !e.reachedExit).length;
  return onBoard + state.pendingSpawns.length;
}

export interface OverlapOffer {
  /** Whether 強行加壓 would be accepted right now. */
  available: boolean;
  /** Gold the call would pay. 0 when unavailable. */
  bonus: number;
  /** Why it is unavailable, for the button's tooltip. */
  reason?: string;
}

/**
 * The single source of truth for whether 強行加壓 can be called and what it
 * pays. Both the command and the button read this.
 *
 * It exists because they did not: the button enabled itself whenever anything
 * was unresolved (which includes enemies that have not spawned yet) while the
 * command additionally required the wave to have finished spawning. The button
 * was therefore live during every wave's opening seconds, advertising a bonus,
 * and clicking it did nothing at all — no error, no feedback, the wave counter
 * simply did not move.
 */
export function overlapOffer(state: GameState): OverlapOffer {
  if (state.phase !== 'wave') return { available: false, bonus: 0, reason: '戰鬥中才能加壓' };
  if (state.pendingSpawns.length > 0) {
    return { available: false, bonus: 0, reason: '這一波還沒完全湧出' };
  }
  const unresolved = unresolvedCount(state);
  if (unresolved === 0) return { available: false, bonus: 0, reason: '這一波已經清完了' };
  return { available: true, bonus: overlapCallBonus(unresolved) };
}

/**
 * Starts the next wave. Two very different things go through here:
 *
 * - From `prep`: the ordinary start, whether the countdown ran out or the player
 *   skipped it. This pays nothing. Skipping an empty countdown is a convenience,
 *   not a decision, and it used to pay 6 gold per remaining second — 56% of a
 *   run's whole income for no cost at all.
 * - From `wave`: 強行加壓, allowed only once the current wave has finished
 *   spawning. The next wave is stacked on top of the survivors and pays out per
 *   enemy still on the board. This is the version with teeth:
 *   the leftovers keep coming while the new wave starts arriving immediately,
 *   and the two waves collapse into one clear bonus instead of two.
 */
export function startNextWave(state: GameState): CommandResult {
  if (state.phase !== 'prep' && state.phase !== 'wave') {
    return { state, ok: false, reason: '遊戲已結束' };
  }

  const next = cloneState(state);

  if (state.phase === 'wave') {
    // The gate lives in overlapOffer so the button cannot disagree with it.
    // Without it the call can be spammed every frame: each press stacks another
    // wave and pays another bonus, so a player could hold the button and arrive
    // at wave 20 in twenty frames, before a single enemy had spawned — measured
    // at 32,828 points off 19 kills. Requiring the current wave to have fully
    // spawned caps the stack at one wave deep and makes chaining impossible,
    // because calling immediately refills the pending queue.
    const offer = overlapOffer(state);
    if (!offer.available) {
      return { state, ok: false, reason: offer.reason };
    }
    next.gold += offer.bonus;
    next.waveScoreMult = 1 + OVERLAP_CALL_SCORE_MULT_BONUS;
    next.wave += 1;
    // Leftover entries keep their original absolute delays (waveElapsed keeps
    // running, so they fire on their original schedule); the incoming wave is
    // offset to "now".
    next.pendingSpawns = [
      ...next.pendingSpawns,
      ...getWaveSpawns(next.wave).map((s) => ({ ...s, delaySec: next.waveElapsed + s.delaySec })),
    ];
    next.lastReversible = null;
    return { state: next, ok: true };
  }

  next.waveScoreMult = 1;
  next.wave += 1;
  next.pendingSpawns = getWaveSpawns(next.wave).map((s) => ({ ...s }));
  next.waveElapsed = 0;
  next.prepTimer = 0;
  next.phase = 'wave';
  next.lastReversible = null;
  return { state: next, ok: true };
}

// ── Enemy factory ────────────────────────────────────────────────────────────

function spawnEnemy(state: GameState, type: EnemyType, waveHpMult: number, field: FlowField): Enemy {
  const def = ENEMY_DEFS[type];
  const hpMult = DIFFICULTIES[state.difficulty].enemyHpMult * waveHpMult;
  const hp = Math.round(def.hp * hpMult);
  const spawnOrder = state.nextSpawnOrder;

  const base: Enemy = {
    id: state.nextEnemyId,
    type,
    hp,
    maxHp: hp,
    armor: def.armor,
    baseSpeed: def.speed,
    flying: def.flying,
    killReward: def.killReward,
    lifeCost: def.lifeCost,
    cellX: ENTRANCE.x,
    cellY: ENTRANCE.y,
    dirX: 0,
    dirY: 0,
    progress: 0,
    flightProgress: 0,
    slowEffects: [],
    distanceToExit: 0,
    worldX: ENTRANCE.x + 0.5,
    worldY: ENTRANCE.y + 0.5,
    reachedExit: false,
    dead: false,
    spawnOrder,
  };

  if (def.flying) {
    const totalDist = Math.hypot(EXIT.x - ENTRANCE.x, EXIT.y - ENTRANCE.y);
    base.distanceToExit = totalDist;
  } else {
    const dir = field.step[ENTRANCE.y][ENTRANCE.x];
    if (dir) {
      base.dirX = dir.dx;
      base.dirY = dir.dy;
    }
    base.distanceToExit = distanceToExit(field, ENTRANCE.x, ENTRANCE.y);
  }
  return base;
}

// ── Movement ─────────────────────────────────────────────────────────────────

const FLIGHT_TOTAL_DIST = Math.hypot(EXIT.x - ENTRANCE.x, EXIT.y - ENTRANCE.y);

function moveGroundEnemy(enemy: Enemy, field: FlowField, dt: number): void {
  const speed = enemy.baseSpeed * currentSpeedFactor(enemy);
  let progress = enemy.progress + speed * dt;

  while (progress >= 1 && !enemy.reachedExit) {
    progress -= 1;
    enemy.cellX += enemy.dirX;
    enemy.cellY += enemy.dirY;
    if (enemy.cellX === EXIT.x && enemy.cellY === EXIT.y) {
      enemy.reachedExit = true;
      enemy.dirX = 0;
      enemy.dirY = 0;
      break;
    }
    const dir = field.step[enemy.cellY][enemy.cellX];
    if (!dir) {
      // Should be unreachable: placement legality guarantees connectivity.
      // Stop in place rather than throwing, so a modeling gap fails loudly
      // via check-pathing instead of crashing a live game.
      enemy.dirX = 0;
      enemy.dirY = 0;
      progress = 0;
      break;
    }
    enemy.dirX = dir.dx;
    enemy.dirY = dir.dy;
  }
  enemy.progress = enemy.reachedExit ? 0 : progress;

  if (enemy.reachedExit) {
    enemy.worldX = EXIT.x + 0.5;
    enemy.worldY = EXIT.y + 0.5;
    enemy.distanceToExit = 0;
  } else {
    enemy.worldX = enemy.cellX + 0.5 + enemy.dirX * enemy.progress;
    enemy.worldY = enemy.cellY + 0.5 + enemy.dirY * enemy.progress;
    const cellDist = distanceToExit(field, enemy.cellX, enemy.cellY);
    enemy.distanceToExit = cellDist === Infinity ? Infinity : cellDist - enemy.progress;
  }
}

function moveFlyingEnemy(enemy: Enemy, dt: number): void {
  const speed = enemy.baseSpeed * currentSpeedFactor(enemy);
  const delta = FLIGHT_TOTAL_DIST > 0 ? (speed * dt) / FLIGHT_TOTAL_DIST : 1;
  enemy.flightProgress = Math.min(1, enemy.flightProgress + delta);
  if (enemy.flightProgress >= 1) enemy.reachedExit = true;
  enemy.worldX = ENTRANCE.x + 0.5 + (EXIT.x - ENTRANCE.x) * enemy.flightProgress;
  enemy.worldY = ENTRANCE.y + 0.5 + (EXIT.y - ENTRANCE.y) * enemy.flightProgress;
  enemy.distanceToExit = FLIGHT_TOTAL_DIST * (1 - enemy.flightProgress);
}

// ── Tower firing ─────────────────────────────────────────────────────────────

function fireTower(tower: Tower, enemies: Enemy[], dt: number): void {
  const def = TOWER_DEFS[tower.type];
  const stats = def.levels[tower.level];
  tower.cooldown -= dt;
  if (tower.cooldown > 0) return;

  const cx = tower.x + 0.5;
  const cy = tower.y + 0.5;
  const inRange = enemiesInRange(enemies, cx, cy, stats.range, def.targetsAir);
  if (inRange.length === 0) return; // keep retrying next tick rather than resetting cooldown on a miss

  if (def.slowPercent > 0) {
    for (const e of inRange) applySlow(e, def.slowPercent, def.slowDurationSec);
    tower.cooldown = 1 / stats.fireRate;
    return;
  }

  const primary = selectPrimaryTarget(inRange);
  if (!primary) return;

  if (def.splashRadius > 0) {
    for (const e of splashTargets(inRange, primary.worldX, primary.worldY, def.splashRadius)) {
      applyDamage(e, stats.damage);
    }
  } else if (def.chainTargets > 1) {
    for (const e of chainTargets(primary, inRange, def.chainTargets, CHAIN_RADIUS)) {
      applyDamage(e, stats.damage);
    }
  } else {
    applyDamage(primary, stats.damage);
  }
  tower.cooldown = 1 / stats.fireRate;
}

// ── Fixed-timestep step ──────────────────────────────────────────────────────

export function step(state: GameState, dt: number): GameState {
  if (state.phase === 'won' || state.phase === 'lost') return state;

  const next = cloneState(state);
  next.elapsedTime += dt;

  if (next.phase === 'prep') {
    next.prepTimer -= dt;
    if (next.prepTimer <= 0) {
      return startNextWave(next).state;
    }
    return next;
  }

  // phase === 'wave'
  next.waveElapsed += dt;

  // 1) Spawn anything due.
  const stillPending = [];
  const occupancy = buildOccupancy(next);
  const field = computeFlowField(occupancy, next.gridW, next.gridH, EXIT);
  for (const spawn of next.pendingSpawns) {
    if (spawn.delaySec <= next.waveElapsed) {
      const enemy = spawnEnemy(next, spawn.type, spawn.hpMult, field);
      next.enemies.push(enemy);
      next.nextEnemyId += 1;
      next.nextSpawnOrder += 1;
    } else {
      stillPending.push(spawn);
    }
  }
  next.pendingSpawns = stillPending;

  // 2) Age slow effects, then move.
  for (const e of next.enemies) {
    tickSlowEffects(e, dt);
    if (e.flying) moveFlyingEnemy(e, dt);
    else moveGroundEnemy(e, field, dt);
  }

  // 3) Resolve enemies that reached the exit this tick.
  for (const e of next.enemies) {
    if (e.reachedExit && !e.dead) {
      next.lives -= e.lifeCost;
      e.dead = true;
    }
  }
  if (next.lives <= 0) {
    next.lives = 0;
    next.phase = 'lost';
    next.score = calculateScore({ killScore: next.killScore, lives: next.lives, unspentGold: next.gold });
    return next;
  }

  // 4) Towers fire using the freshly-updated positions/targets.
  for (const t of next.towers) fireTower(t, next.enemies, dt);

  // 5) Cleanup: remove dead enemies, crediting kill reward only for damage kills.
  const survivors: Enemy[] = [];
  for (const e of next.enemies) {
    if (!e.dead) {
      survivors.push(e);
      continue;
    }
    if (!e.reachedExit) {
      // Kill gold is the spec's first listed gold source (擊殺獎勵) and was
      // simply never wired up: killReward only ever reached killScore, so
      // killing things paid points and no money. The score multiplier is
      // deliberately *not* applied here — it multiplies score, not income.
      next.gold += e.killReward;
      next.killScore += e.killReward * next.waveScoreMult;
      next.kills += 1;
    }
  }
  next.enemies = survivors;

  // 6) Wave clear?
  if (next.pendingSpawns.length === 0 && next.enemies.length === 0) {
    next.gold += waveClearBonus(next.wave);
    if (!next.endless && next.wave >= TOTAL_WAVES) {
      next.phase = 'won';
    } else {
      next.phase = 'prep';
      next.prepTimer = PREP_TIME_SEC;
      next.waveScoreMult = 1;
      next.lastReversible = null;
    }
  }

  next.score = calculateScore({ killScore: next.killScore, lives: next.lives, unspentGold: next.gold });
  return next;
}

import {
  BASE_MAX_ENERGY,
  BLOOD_DASH_INTERVAL,
  CURSED_ENERGY,
  DASH_COOLDOWN_MS,
  DASH_COST,
  DASH_DISTANCE,
  DASH_INVULN_MS,
  ENERGY_REGEN_PER_TICK,
  FLOOR_SPEEDUP_MS,
  FRUIT_ENERGY,
  GRID,
  HEAL_COST,
  HOURGLASS_BONUS_MS,
  HURT_SHRINK,
  INVULN_MS,
  MAX_FLOOR,
  MAX_FRUITS,
  MIN_LENGTH,
  MIN_MOVE_MS,
  BASE_MOVE_MS,
  REROLL_COST,
  SCORE_BOSS,
  SCORE_ESCAPE,
  SCORE_FLOOR,
  SCORE_FRUIT,
  SCORE_HP_BONUS,
  SCORE_KILL,
  SPIKE_ARMED,
  SPIKE_CYCLE,
  START_ENERGY,
  START_HP,
  START_LENGTH,
} from './config';
import {
  CENTER,
  chebyshev,
  collectFloorCells,
  generateTerrain,
  isWall,
  samePos,
} from './level';
import { rollRelicChoices } from './relics';
import { createRng } from './rng';
import type {
  Boss,
  Dir,
  Enemy,
  EnemyType,
  Fruit,
  FruitType,
  GameState,
  RelicId,
  Vec,
} from './types';

const DELTA: Record<Dir, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

const ALL_DIRS: Dir[] = ['up', 'right', 'down', 'left'];

const BOSS_ANCHOR: Vec = { x: CENTER, y: CENTER - 6 };

export function hasRelic(state: GameState, id: RelicId): boolean {
  return state.relics.includes(id);
}

export function isBossFloor(floor: number): boolean {
  return floor % 5 === 0;
}

export function isSpikeArmed(state: GameState, offset: number): boolean {
  return (state.tick + offset) % SPIKE_CYCLE < SPIKE_ARMED;
}

export function bossCovers(boss: Boss, cell: Vec): boolean {
  return Math.abs(boss.pos.x - cell.x) <= 1 && Math.abs(boss.pos.y - cell.y) <= 1;
}

function key(pos: Vec): string {
  return `${pos.x},${pos.y}`;
}

function shuffledDirs(rng: () => number): Dir[] {
  const dirs = [...ALL_DIRS];
  for (let i = dirs.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
  }
  return dirs;
}

function computeInterval(state: GameState): number {
  let ms = Math.max(MIN_MOVE_MS, BASE_MOVE_MS - (state.floor - 1) * FLOOR_SPEEDUP_MS);
  if (hasRelic(state, 'swift')) ms *= 0.88;
  if (hasRelic(state, 'torpor')) ms *= 1.12;
  return ms;
}

function scoreMultiplier(state: GameState): number {
  let mult = 1 + state.floor * 0.1;
  if (hasRelic(state, 'torpor')) mult *= 1.3;
  if (hasRelic(state, 'gluttony')) mult *= 1.25;
  return mult;
}

function addScore(state: GameState, base: number, scaled = true): void {
  state.score += Math.round(scaled ? base * scoreMultiplier(state) : base);
}

function addEffect(
  state: GameState,
  kind: 'ring' | 'burst' | 'slash',
  pos: Vec,
  color: string,
  radius = 1,
  life = 420,
): void {
  state.effects.push({ kind, pos: { ...pos }, born: state.time, life, color, radius });
}

/** Cells nothing currently stands on — the spawn candidate pool. */
function freeCells(state: GameState): Vec[] {
  const taken = new Set<string>();
  for (const segment of state.snake) taken.add(key(segment));
  for (const fruit of state.fruits) taken.add(key(fruit.pos));
  for (const enemy of state.enemies) taken.add(key(enemy.pos));
  for (const spike of state.spikes) taken.add(key(spike.pos));
  if (state.exit) taken.add(key(state.exit));

  return collectFloorCells(state.tiles).filter((cell) => {
    if (taken.has(key(cell))) return false;
    if (state.boss && bossCovers(state.boss, cell)) return false;
    return true;
  });
}

function pickCell(state: GameState, cells: Vec[], minHeadDistance: number): Vec | null {
  const head = state.snake[0];
  const far = cells.filter((cell) => chebyshev(cell, head) >= minHeadDistance);
  const pool = far.length > 0 ? far : cells;
  if (pool.length === 0) return null;
  return pool[Math.floor(state.rng() * pool.length)];
}

function rollFruitType(state: GameState): FruitType {
  const golden = (0.1 + state.floor * 0.01) * (hasRelic(state, 'alchemy') ? 2 : 1);
  const cursed = state.floor >= 3 ? 0.1 : 0;
  const roll = state.rng();
  if (roll < golden) return 'golden';
  if (roll < golden + cursed) return 'cursed';
  return 'normal';
}

function spawnFruit(state: GameState): boolean {
  const cell = pickCell(state, freeCells(state), 2);
  if (!cell) return false;
  state.fruits.push({ pos: cell, type: rollFruitType(state) });
  return true;
}

function refillFruits(state: GameState): void {
  let guard = MAX_FRUITS;
  while (state.fruits.length < MAX_FRUITS && guard-- > 0) {
    if (!spawnFruit(state)) break;
  }
}

function enemyPoolFor(floor: number): EnemyType[] {
  if (floor <= 1) return ['wisp'];
  if (floor <= 3) return ['wisp', 'wisp', 'stalker'];
  return ['wisp', 'stalker', 'stalker', 'spitter'];
}

function spawnEnemy(state: GameState, type: EnemyType): void {
  const cell = pickCell(state, freeCells(state), 5);
  if (!cell) return;
  state.enemies.push({
    id: state.nextId++,
    type,
    pos: cell,
    prev: { ...cell },
    offset: Math.floor(state.rng() * 12),
  });
}

function spawnSpikes(state: GameState, count: number): void {
  for (let i = 0; i < count; i++) {
    const cell = pickCell(state, freeCells(state), 4);
    if (!cell) return;
    state.spikes.push({ pos: cell, offset: Math.floor(state.rng() * SPIKE_CYCLE) });
  }
}

function bossHpFor(floor: number): number {
  return 4 + (Math.floor(floor / 5) - 1) * 2;
}

function buildStartingSnake(state: GameState, length: number): Vec[] {
  const maxLength = Math.min(length, collectFloorCells(state.tiles).length);
  const path: Vec[] = [{ x: CENTER, y: CENTER }];
  const visited = new Set<string>([key(path[0])]);

  const extend = (): boolean => {
    if (path.length >= maxLength) return true;

    const tail = path[path.length - 1];
    for (const dir of shuffledDirs(state.rng)) {
      const next = {
        x: tail.x + DELTA[dir].x,
        y: tail.y + DELTA[dir].y,
      };
      if (isWall(state.tiles, next.x, next.y)) continue;
      if (visited.has(key(next))) continue;

      path.push(next);
      visited.add(key(next));
      if (extend()) return true;
      path.pop();
      visited.delete(key(next));
    }

    return false;
  };

  extend();
  return path;
}

export function buildFloor(state: GameState, floor: number): void {
  const boss = isBossFloor(floor);
  const terrain = generateTerrain(state.rng, floor, boss);
  const length = Math.max(START_LENGTH, state.snake.length || START_LENGTH);

  state.floor = floor;
  state.tiles = terrain.tiles;
  state.layout = terrain.layout;

  state.snake = buildStartingSnake(state, length);
  state.prevSnake = state.snake.map((segment) => ({ ...segment }));
  state.dir = 'right';
  state.pendingDirs = [];
  state.growth = 0;

  state.fruits = [];
  state.enemies = [];
  state.projectiles = [];
  state.spikes = [];
  state.exit = null;
  state.eaten = 0;
  state.quota = boss ? 0 : Math.min(4 + floor, 12);
  state.ghostUsed = false;
  state.effects = [];

  state.boss = boss
    ? {
        pos: { ...BOSS_ANCHOR },
        hp: bossHpFor(floor),
        maxHp: bossHpFor(floor),
        hitFlashUntil: 0,
      }
    : null;

  if (floor >= 3) spawnSpikes(state, Math.min(3 + floor, 12));
  if (!boss) {
    const pool = enemyPoolFor(floor);
    const count = Math.min(1 + floor, 7);
    for (let i = 0; i < count; i++) {
      spawnEnemy(state, pool[Math.floor(state.rng() * pool.length)]);
    }
  }

  refillFruits(state);
  state.moveInterval = computeInterval(state);
}

export function createRun(seed: number): GameState {
  const state: GameState = {
    seed,
    rng: createRng(seed),
    phase: 'playing',
    endless: false,
    floor: 1,
    layout: 'open',
    tiles: new Uint8Array(GRID * GRID),
    spikes: [],
    snake: [],
    prevSnake: [],
    dir: 'right',
    pendingDirs: [],
    growth: 0,
    fruits: [],
    eaten: 0,
    quota: 0,
    enemies: [],
    projectiles: [],
    boss: null,
    exit: null,
    hp: START_HP,
    maxHp: START_HP,
    energy: START_ENERGY,
    maxEnergy: BASE_MAX_ENERGY,
    coins: 0,
    score: 0,
    kills: 0,
    relics: [],
    relicChoices: [],
    pendingPicks: 0,
    moveInterval: BASE_MOVE_MS,
    time: 0,
    tick: 0,
    invulnUntil: 0,
    dashReadyAt: 0,
    dashUntil: 0,
    ghostUsed: false,
    echoCount: 0,
    dashCount: 0,
    effects: [],
    events: [],
    nextId: 1,
  };

  buildFloor(state, 1);
  return state;
}

export function queueDir(state: GameState, dir: Dir): void {
  if (state.phase !== 'playing') return;
  const last = state.pendingDirs.length > 0 ? state.pendingDirs[state.pendingDirs.length - 1] : state.dir;
  if (dir === last || dir === OPPOSITE[last]) return;
  if (state.pendingDirs.length >= 2) return;
  state.pendingDirs.push(dir);
}

/** Where a step lands, honouring 環界符 wrap-around; null when the move is blocked. */
function resolveTarget(state: GameState, from: Vec, dir: Dir): Vec | null {
  const delta = DELTA[dir];
  const raw = { x: from.x + delta.x, y: from.y + delta.y };
  const onBorder = raw.x <= 0 || raw.y <= 0 || raw.x >= GRID - 1 || raw.y >= GRID - 1;

  if (onBorder && hasRelic(state, 'warp')) {
    const wrapped = {
      x: raw.x <= 0 ? GRID - 2 : raw.x >= GRID - 1 ? 1 : raw.x,
      y: raw.y <= 0 ? GRID - 2 : raw.y >= GRID - 1 ? 1 : raw.y,
    };
    return isWall(state.tiles, wrapped.x, wrapped.y) ? null : wrapped;
  }

  return isWall(state.tiles, raw.x, raw.y) ? null : raw;
}

function bounce(state: GameState): void {
  const head = state.snake[0];
  const options = ALL_DIRS.filter((dir) => dir !== state.dir && dir !== OPPOSITE[state.dir]);
  options.push(OPPOSITE[state.dir]);
  for (const dir of options) {
    if (resolveTarget(state, head, dir)) {
      state.dir = dir;
      state.pendingDirs = [];
      return;
    }
  }
}

function truncate(state: GameState, amount: number): void {
  for (let i = 0; i < amount && state.snake.length > MIN_LENGTH; i++) {
    state.snake.pop();
  }
}

function hurt(state: GameState, force = false): void {
  if (state.phase !== 'playing') return;
  if (!force && state.time < state.invulnUntil) return;

  state.hp -= 1;
  if (!hasRelic(state, 'shed')) truncate(state, HURT_SHRINK);
  state.invulnUntil =
    state.time + INVULN_MS + (hasRelic(state, 'hourglass') ? HOURGLASS_BONUS_MS : 0);
  addEffect(state, 'ring', state.snake[0], '#f87171', 2, 500);
  state.events.push({ type: 'hurt' });

  if (state.hp <= 0) {
    state.hp = 0;
    state.phase = 'dead';
    state.events.push({ type: 'die' });
  }
}

function payBloodPrice(state: GameState): void {
  if (state.phase !== 'playing') return;

  state.hp -= 1;
  addEffect(state, 'ring', state.snake[0], '#dc2626', 1.6, 360);
  state.events.push({ type: 'hurt' });

  if (state.hp <= 0) {
    state.hp = 0;
    state.phase = 'dead';
    state.events.push({ type: 'die' });
  }
}

function removeEnemy(state: GameState, index: number, reward: boolean): void {
  const [enemy] = state.enemies.splice(index, 1);
  addEffect(state, 'burst', enemy.pos, '#fbbf24', 1, 340);
  if (!reward) return;
  state.kills += 1;
  state.coins += 1;
  addScore(state, SCORE_KILL);
  state.events.push({ type: 'kill' });
}

function shockwave(state: GameState): void {
  const head = state.snake[0];
  addEffect(state, 'ring', head, '#a78bfa', 3.5, 600);
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    if (chebyshev(state.enemies[i].pos, head) <= 3) removeEnemy(state, i, true);
  }
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    if (chebyshev(state.projectiles[i].pos, head) <= 3) state.projectiles.splice(i, 1);
  }
}

function eatFruit(state: GameState, fruit: Fruit): void {
  const ascetic = hasRelic(state, 'ascetic');
  const energyGain = (fruit.type === 'cursed' ? CURSED_ENERGY : FRUIT_ENERGY) * (ascetic ? 2 : 1);

  if (fruit.type === 'cursed') {
    truncate(state, 2);
    addScore(state, 5, false);
    state.events.push({ type: 'cursed' });
  } else {
    if (!ascetic) state.growth += 1 + (hasRelic(state, 'gluttony') ? 1 : 0);
    if (fruit.type === 'golden') {
      state.coins += 3;
      addScore(state, SCORE_FRUIT * 2);
      state.events.push({ type: 'golden' });
    } else {
      addScore(state, SCORE_FRUIT);
      state.events.push({ type: 'eat' });
    }
  }

  state.energy = Math.min(state.maxEnergy, state.energy + energyGain);
  state.eaten += 1;
  state.echoCount += 1;
  addEffect(state, 'burst', fruit.pos, fruit.type === 'golden' ? '#fcd34d' : '#4ade80', 1, 320);

  if (hasRelic(state, 'echo') && state.echoCount % 5 === 0) shockwave(state);
}

function consumeFruits(state: GameState): void {
  const head = state.snake[0];
  const magnet = hasRelic(state, 'magnet') ? 2 : 0;
  for (let i = state.fruits.length - 1; i >= 0; i--) {
    const fruit = state.fruits[i];
    if (samePos(fruit.pos, head) || chebyshev(fruit.pos, head) <= magnet) {
      state.fruits.splice(i, 1);
      eatFruit(state, fruit);
    }
  }
  refillFruits(state);
}

function advance(state: GameState, cell: Vec): void {
  state.prevSnake = state.snake.map((segment) => ({ ...segment }));
  state.snake.unshift(cell);
  if (state.growth > 0) state.growth -= 1;
  else state.snake.pop();
}

function openExit(state: GameState): void {
  const cell = pickCell(state, freeCells(state), 6);
  if (!cell) return;
  state.exit = cell;
  addEffect(state, 'ring', cell, '#38bdf8', 3, 700);
}

function maybeOpenExit(state: GameState): void {
  if (state.exit || state.boss) return;
  if (state.eaten < state.quota) return;
  openExit(state);
}

function enterExit(state: GameState): void {
  addScore(state, SCORE_FLOOR * state.floor, false);
  state.exit = null;
  state.events.push({ type: 'exit' });

  if (!state.endless && state.floor >= MAX_FLOOR) {
    addScore(state, SCORE_ESCAPE + state.hp * SCORE_HP_BONUS, false);
    state.phase = 'won';
    state.events.push({ type: 'win' });
    return;
  }

  state.pendingPicks += 1;
  state.relicChoices = rollRelicChoices(state.rng, state.relics, 3);
  state.phase = 'relic';
}

function moveSnake(state: GameState): void {
  const head = state.snake[0];
  const target = resolveTarget(state, head, state.dir);

  if (!target) {
    hurt(state);
    bounce(state);
    return;
  }

  const invulnerable = state.time < state.invulnUntil;

  if (state.boss && bossCovers(state.boss, target)) {
    hurt(state);
    bounce(state);
    return;
  }

  if (!invulnerable) {
    const bodyLimit = state.growth > 0 ? state.snake.length : state.snake.length - 1;
    const selfHit = state.snake.slice(0, bodyLimit).some((segment) => samePos(segment, target));
    if (selfHit) {
      if (hasRelic(state, 'ghost') && !state.ghostUsed) {
        state.ghostUsed = true;
        addEffect(state, 'ring', target, '#c4b5fd', 1.5, 420);
      } else {
        hurt(state);
        bounce(state);
        return;
      }
    }
  }

  const enemyIndex = state.enemies.findIndex((enemy) => samePos(enemy.pos, target));
  if (enemyIndex >= 0) {
    if (invulnerable || hasRelic(state, 'fang')) {
      removeEnemy(state, enemyIndex, true);
    } else {
      hurt(state);
      bounce(state);
      return;
    }
  }

  advance(state, target);
  consumeFruits(state);

  if (state.exit && samePos(state.snake[0], state.exit)) enterExit(state);
}

function stepEnemy(state: GameState, enemy: Enemy): void {
  const head = state.snake[0];
  const blocked = (cell: Vec): boolean => {
    if (isWall(state.tiles, cell.x, cell.y)) return true;
    if (state.boss && bossCovers(state.boss, cell)) return true;
    return state.enemies.some((other) => other.id !== enemy.id && samePos(other.pos, cell));
  };

  if (enemy.type === 'wisp') {
    if ((state.tick + enemy.offset) % 3 !== 0) return;
    const options = ALL_DIRS.map((dir) => ({
      x: enemy.pos.x + DELTA[dir].x,
      y: enemy.pos.y + DELTA[dir].y,
    })).filter((cell) => !blocked(cell));
    if (options.length === 0) return;
    enemy.pos = options[Math.floor(state.rng() * options.length)];
    return;
  }

  if (enemy.type === 'stalker') {
    if ((state.tick + enemy.offset) % 2 !== 0) return;
    const dx = head.x - enemy.pos.x;
    const dy = head.y - enemy.pos.y;
    const primary: Vec =
      Math.abs(dx) >= Math.abs(dy)
        ? { x: enemy.pos.x + Math.sign(dx), y: enemy.pos.y }
        : { x: enemy.pos.x, y: enemy.pos.y + Math.sign(dy) };
    const secondary: Vec =
      Math.abs(dx) >= Math.abs(dy)
        ? { x: enemy.pos.x, y: enemy.pos.y + Math.sign(dy) }
        : { x: enemy.pos.x + Math.sign(dx), y: enemy.pos.y };
    if (!samePos(primary, enemy.pos) && !blocked(primary)) enemy.pos = primary;
    else if (!samePos(secondary, enemy.pos) && !blocked(secondary)) enemy.pos = secondary;
    return;
  }

  // spitter: rooted, only fires when the head shares its row or column
  if ((state.tick + enemy.offset) % 12 !== 0) return;
  const dx = head.x - enemy.pos.x;
  const dy = head.y - enemy.pos.y;
  if (dx !== 0 && dy !== 0) return;
  const dir: Dir = dx !== 0 ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';
  const muzzle = { x: enemy.pos.x + DELTA[dir].x, y: enemy.pos.y + DELTA[dir].y };
  if (isWall(state.tiles, muzzle.x, muzzle.y)) return;
  state.projectiles.push({ id: state.nextId++, pos: muzzle, prev: { ...enemy.pos }, dir });
}

function resolveEnemyContacts(state: GameState): void {
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const enemy = state.enemies[i];
    const onSnake = state.snake.some((segment) => samePos(segment, enemy.pos));
    if (!onSnake) continue;

    const onHead = samePos(state.snake[0], enemy.pos);
    if (state.time < state.invulnUntil || hasRelic(state, 'fang')) {
      removeEnemy(state, i, true);
      continue;
    }
    if (hasRelic(state, 'thorn') && !onHead) {
      removeEnemy(state, i, true);
      continue;
    }
    hurt(state);
  }
}

function updateEnemies(state: GameState): void {
  for (const enemy of state.enemies) {
    enemy.prev = { ...enemy.pos };
    stepEnemy(state, enemy);
  }
  resolveEnemyContacts(state);
}

function updateProjectiles(state: GameState): void {
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const projectile = state.projectiles[i];
    projectile.prev = { ...projectile.pos };
    projectile.pos = {
      x: projectile.pos.x + DELTA[projectile.dir].x,
      y: projectile.pos.y + DELTA[projectile.dir].y,
    };

    if (isWall(state.tiles, projectile.pos.x, projectile.pos.y)) {
      state.projectiles.splice(i, 1);
      continue;
    }
    if (state.snake.some((segment) => samePos(segment, projectile.pos))) {
      state.projectiles.splice(i, 1);
      if (state.time >= state.invulnUntil) hurt(state);
    }
  }
}

function teleportBoss(state: GameState): void {
  const boss = state.boss;
  if (!boss) return;
  const head = state.snake[0];
  const candidates: Vec[] = [];
  for (let y = 2; y < GRID - 2; y++) {
    for (let x = 2; x < GRID - 2; x++) {
      const anchor = { x, y };
      if (chebyshev(anchor, head) < 5) continue;
      let clear = true;
      for (let oy = -1; oy <= 1 && clear; oy++) {
        for (let ox = -1; ox <= 1 && clear; ox++) {
          const cell = { x: x + ox, y: y + oy };
          if (isWall(state.tiles, cell.x, cell.y)) clear = false;
          else if (state.snake.some((segment) => samePos(segment, cell))) clear = false;
        }
      }
      if (clear) candidates.push(anchor);
    }
  }
  if (candidates.length === 0) return;
  boss.pos = candidates[Math.floor(state.rng() * candidates.length)];
  addEffect(state, 'ring', boss.pos, '#f472b6', 3, 500);
}

function damageBoss(state: GameState): void {
  const boss = state.boss;
  if (!boss || state.time < boss.hitFlashUntil) return;

  boss.hp -= 1;
  boss.hitFlashUntil = state.time + 500;
  addEffect(state, 'burst', boss.pos, '#f472b6', 2.5, 480);
  state.events.push({ type: 'bossHit' });

  if (boss.hp <= 0) {
    state.boss = null;
    state.coins += 10;
    state.kills += 1;
    addScore(state, SCORE_BOSS * state.floor, false);
    state.pendingPicks += 1;
    state.projectiles = [];
    openExit(state);
    state.events.push({ type: 'bossDown' });
    return;
  }

  teleportBoss(state);
}

function updateBoss(state: GameState): void {
  const boss = state.boss;
  if (!boss) return;
  if (state.tick % 20 === 0 && state.enemies.length < 4) spawnEnemy(state, 'stalker');
  if (state.tick % 20 === 0 && state.spikes.length < 20) spawnSpikes(state, 1);
}

function checkSpikes(state: GameState): void {
  const head = state.snake[0];
  const spike = state.spikes.find((entry) => samePos(entry.pos, head));
  if (spike && isSpikeArmed(state, spike.offset)) hurt(state);
}

function pruneEffects(state: GameState): void {
  state.effects = state.effects.filter((effect) => state.time - effect.born < effect.life);
}

export function tick(state: GameState): void {
  if (state.phase !== 'playing') return;

  state.tick += 1;
  state.time += state.moveInterval;
  state.energy = Math.min(state.maxEnergy, state.energy + ENERGY_REGEN_PER_TICK);
  pruneEffects(state);

  const queued = state.pendingDirs.shift();
  if (queued && queued !== OPPOSITE[state.dir]) state.dir = queued;

  moveSnake(state);
  if (state.phase !== 'playing') return;

  updateEnemies(state);
  if (state.phase !== 'playing') return;

  updateProjectiles(state);
  updateBoss(state);
  checkSpikes(state);
  maybeOpenExit(state);
}

export function dash(state: GameState): void {
  if (state.phase !== 'playing') return;
  if (state.time < state.dashReadyAt) return;

  const blood = hasRelic(state, 'blood');
  if (blood) {
    state.dashCount += 1;
    if (state.dashCount % BLOOD_DASH_INTERVAL === 0) payBloodPrice(state);
    if (state.phase !== 'playing') return;
  } else {
    if (state.energy < DASH_COST) return;
    state.energy -= DASH_COST;
  }

  state.dashReadyAt = state.time + DASH_COOLDOWN_MS;
  state.dashUntil = state.time + DASH_INVULN_MS;
  state.invulnUntil = Math.max(state.invulnUntil, state.dashUntil);
  state.events.push({ type: 'dash' });

  const distance = DASH_DISTANCE + (hasRelic(state, 'core') ? 1 : 0);
  for (let step = 0; step < distance; step++) {
    const head = state.snake[0];
    const target = resolveTarget(state, head, state.dir);
    if (!target) break;

    if (state.boss && bossCovers(state.boss, target)) {
      damageBoss(state);
      break;
    }

    const enemyIndex = state.enemies.findIndex((enemy) => samePos(enemy.pos, target));
    if (enemyIndex >= 0) removeEnemy(state, enemyIndex, true);

    addEffect(state, 'slash', target, '#67e8f9', 1, 260);
    advance(state, target);
    consumeFruits(state);

    if (state.exit && samePos(state.snake[0], state.exit)) {
      enterExit(state);
      return;
    }
  }
}

function applyRelic(state: GameState, id: RelicId): void {
  switch (id) {
    case 'heart':
      state.maxHp += 1;
      state.hp = state.maxHp;
      break;
    case 'core':
      state.maxEnergy += 40;
      state.energy = Math.min(state.maxEnergy, state.energy + 40);
      break;
    case 'bag':
      state.coins += 8;
      break;
    case 'mend':
      state.hp = Math.min(state.maxHp, state.hp + 1);
      break;
    default:
      break;
  }
}

export function chooseRelic(state: GameState, id: RelicId): void {
  if (state.phase !== 'relic') return;
  if (!state.relicChoices.includes(id)) return;

  if (id !== 'bag' && id !== 'mend') state.relics.push(id);
  applyRelic(state, id);

  state.pendingPicks -= 1;
  state.relicChoices = [];

  if (state.pendingPicks > 0) {
    state.relicChoices = rollRelicChoices(state.rng, state.relics, 3);
    return;
  }

  buildFloor(state, state.floor + 1);
  state.phase = 'playing';
}

export function rerollRelics(state: GameState): void {
  if (state.phase !== 'relic' || state.coins < REROLL_COST) return;
  state.coins -= REROLL_COST;
  state.relicChoices = rollRelicChoices(state.rng, state.relics, 3);
}

export function buyHeal(state: GameState): void {
  if (state.phase !== 'relic' || state.coins < HEAL_COST) return;
  if (state.hp >= state.maxHp) return;
  state.coins -= HEAL_COST;
  state.hp += 1;
}

/** Called from the victory screen to keep diving with the same build. */
export function continueEndless(state: GameState): void {
  if (state.phase !== 'won') return;
  state.endless = true;
  state.pendingPicks += 1;
  state.relicChoices = rollRelicChoices(state.rng, state.relics, 3);
  state.phase = 'relic';
}

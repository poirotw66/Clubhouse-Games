"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasRelic = hasRelic;
exports.isBossFloor = isBossFloor;
exports.isSpikeArmed = isSpikeArmed;
exports.bossCovers = bossCovers;
exports.buildFloor = buildFloor;
exports.createRun = createRun;
exports.queueDir = queueDir;
exports.tick = tick;
exports.dash = dash;
exports.chooseRelic = chooseRelic;
exports.rerollRelics = rerollRelics;
exports.buyHeal = buyHeal;
exports.continueEndless = continueEndless;
const config_1 = require("./config");
const level_1 = require("./level");
const relics_1 = require("./relics");
const rng_1 = require("./rng");
const DELTA = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
};
const OPPOSITE = {
    up: 'down',
    down: 'up',
    left: 'right',
    right: 'left',
};
const ALL_DIRS = ['up', 'right', 'down', 'left'];
const BOSS_ANCHOR = { x: level_1.CENTER, y: level_1.CENTER - 6 };
function hasRelic(state, id) {
    return state.relics.includes(id);
}
function isBossFloor(floor) {
    return floor % 5 === 0;
}
function isSpikeArmed(state, offset) {
    return (state.tick + offset) % config_1.SPIKE_CYCLE < config_1.SPIKE_ARMED;
}
function bossCovers(boss, cell) {
    return Math.abs(boss.pos.x - cell.x) <= 1 && Math.abs(boss.pos.y - cell.y) <= 1;
}
function key(pos) {
    return `${pos.x},${pos.y}`;
}
function shuffledDirs(rng) {
    const dirs = [...ALL_DIRS];
    for (let i = dirs.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    return dirs;
}
function computeInterval(state) {
    let ms = Math.max(config_1.MIN_MOVE_MS, config_1.BASE_MOVE_MS - (state.floor - 1) * config_1.FLOOR_SPEEDUP_MS);
    if (hasRelic(state, 'swift'))
        ms *= 0.88;
    if (hasRelic(state, 'torpor'))
        ms *= 1.12;
    return ms;
}
function scoreMultiplier(state) {
    let mult = 1 + state.floor * 0.1;
    if (hasRelic(state, 'torpor'))
        mult *= 1.3;
    if (hasRelic(state, 'gluttony'))
        mult *= 1.25;
    return mult;
}
function addScore(state, base, scaled = true) {
    state.score += Math.round(scaled ? base * scoreMultiplier(state) : base);
}
function addEffect(state, kind, pos, color, radius = 1, life = 420) {
    state.effects.push({ kind, pos: { ...pos }, born: state.time, life, color, radius });
}
/** Cells nothing currently stands on — the spawn candidate pool. */
function freeCells(state) {
    const taken = new Set();
    for (const segment of state.snake)
        taken.add(key(segment));
    for (const fruit of state.fruits)
        taken.add(key(fruit.pos));
    for (const enemy of state.enemies)
        taken.add(key(enemy.pos));
    for (const spike of state.spikes)
        taken.add(key(spike.pos));
    if (state.exit)
        taken.add(key(state.exit));
    return (0, level_1.collectFloorCells)(state.tiles).filter((cell) => {
        if (taken.has(key(cell)))
            return false;
        if (state.boss && bossCovers(state.boss, cell))
            return false;
        return true;
    });
}
function pickCell(state, cells, minHeadDistance) {
    const head = state.snake[0];
    const far = cells.filter((cell) => (0, level_1.chebyshev)(cell, head) >= minHeadDistance);
    const pool = far.length > 0 ? far : cells;
    if (pool.length === 0)
        return null;
    return pool[Math.floor(state.rng() * pool.length)];
}
function rollFruitType(state) {
    const golden = (0.1 + state.floor * 0.01) * (hasRelic(state, 'alchemy') ? 2 : 1);
    const cursed = state.floor >= 3 ? 0.1 : 0;
    const roll = state.rng();
    if (roll < golden)
        return 'golden';
    if (roll < golden + cursed)
        return 'cursed';
    return 'normal';
}
function spawnFruit(state) {
    const cell = pickCell(state, freeCells(state), 2);
    if (!cell)
        return false;
    state.fruits.push({ pos: cell, type: rollFruitType(state) });
    return true;
}
function refillFruits(state) {
    let guard = config_1.MAX_FRUITS;
    while (state.fruits.length < config_1.MAX_FRUITS && guard-- > 0) {
        if (!spawnFruit(state))
            break;
    }
}
function enemyPoolFor(floor) {
    if (floor <= 1)
        return ['wisp'];
    if (floor <= 3)
        return ['wisp', 'wisp', 'stalker'];
    return ['wisp', 'stalker', 'stalker', 'spitter'];
}
function spawnEnemy(state, type) {
    const cell = pickCell(state, freeCells(state), 5);
    if (!cell)
        return;
    state.enemies.push({
        id: state.nextId++,
        type,
        pos: cell,
        prev: { ...cell },
        offset: Math.floor(state.rng() * 12),
    });
}
function spawnSpikes(state, count) {
    for (let i = 0; i < count; i++) {
        const cell = pickCell(state, freeCells(state), 4);
        if (!cell)
            return;
        state.spikes.push({ pos: cell, offset: Math.floor(state.rng() * config_1.SPIKE_CYCLE) });
    }
}
function bossHpFor(floor) {
    return 4 + (Math.floor(floor / 5) - 1) * 2;
}
function buildStartingSnake(state, length) {
    const maxLength = Math.min(length, (0, level_1.collectFloorCells)(state.tiles).length);
    const path = [{ x: level_1.CENTER, y: level_1.CENTER }];
    const visited = new Set([key(path[0])]);
    const extend = () => {
        if (path.length >= maxLength)
            return true;
        const tail = path[path.length - 1];
        for (const dir of shuffledDirs(state.rng)) {
            const next = {
                x: tail.x + DELTA[dir].x,
                y: tail.y + DELTA[dir].y,
            };
            if ((0, level_1.isWall)(state.tiles, next.x, next.y))
                continue;
            if (visited.has(key(next)))
                continue;
            path.push(next);
            visited.add(key(next));
            if (extend())
                return true;
            path.pop();
            visited.delete(key(next));
        }
        return false;
    };
    extend();
    return path;
}
function buildFloor(state, floor) {
    const boss = isBossFloor(floor);
    const terrain = (0, level_1.generateTerrain)(state.rng, floor, boss);
    const length = Math.max(config_1.START_LENGTH, state.snake.length || config_1.START_LENGTH);
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
    if (floor >= 3)
        spawnSpikes(state, Math.min(3 + floor, 12));
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
function createRun(seed) {
    const state = {
        seed,
        rng: (0, rng_1.createRng)(seed),
        phase: 'playing',
        endless: false,
        floor: 1,
        layout: 'open',
        tiles: new Uint8Array(config_1.GRID * config_1.GRID),
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
        hp: config_1.START_HP,
        maxHp: config_1.START_HP,
        energy: config_1.START_ENERGY,
        maxEnergy: config_1.BASE_MAX_ENERGY,
        coins: 0,
        score: 0,
        kills: 0,
        relics: [],
        relicChoices: [],
        pendingPicks: 0,
        moveInterval: config_1.BASE_MOVE_MS,
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
function queueDir(state, dir) {
    if (state.phase !== 'playing')
        return;
    const last = state.pendingDirs.length > 0 ? state.pendingDirs[state.pendingDirs.length - 1] : state.dir;
    if (dir === last || dir === OPPOSITE[last])
        return;
    if (state.pendingDirs.length >= 2)
        return;
    state.pendingDirs.push(dir);
}
/** Where a step lands, honouring 環界符 wrap-around; null when the move is blocked. */
function resolveTarget(state, from, dir) {
    const delta = DELTA[dir];
    const raw = { x: from.x + delta.x, y: from.y + delta.y };
    const onBorder = raw.x <= 0 || raw.y <= 0 || raw.x >= config_1.GRID - 1 || raw.y >= config_1.GRID - 1;
    if (onBorder && hasRelic(state, 'warp')) {
        const wrapped = {
            x: raw.x <= 0 ? config_1.GRID - 2 : raw.x >= config_1.GRID - 1 ? 1 : raw.x,
            y: raw.y <= 0 ? config_1.GRID - 2 : raw.y >= config_1.GRID - 1 ? 1 : raw.y,
        };
        return (0, level_1.isWall)(state.tiles, wrapped.x, wrapped.y) ? null : wrapped;
    }
    return (0, level_1.isWall)(state.tiles, raw.x, raw.y) ? null : raw;
}
function bounce(state) {
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
function truncate(state, amount) {
    for (let i = 0; i < amount && state.snake.length > config_1.MIN_LENGTH; i++) {
        state.snake.pop();
    }
}
function hurt(state, force = false) {
    if (state.phase !== 'playing')
        return;
    if (!force && state.time < state.invulnUntil)
        return;
    state.hp -= 1;
    if (!hasRelic(state, 'shed'))
        truncate(state, config_1.HURT_SHRINK);
    state.invulnUntil =
        state.time + config_1.INVULN_MS + (hasRelic(state, 'hourglass') ? config_1.HOURGLASS_BONUS_MS : 0);
    addEffect(state, 'ring', state.snake[0], '#f87171', 2, 500);
    state.events.push({ type: 'hurt' });
    if (state.hp <= 0) {
        state.hp = 0;
        state.phase = 'dead';
        state.events.push({ type: 'die' });
    }
}
function payBloodPrice(state) {
    if (state.phase !== 'playing')
        return;
    state.hp -= 1;
    addEffect(state, 'ring', state.snake[0], '#dc2626', 1.6, 360);
    state.events.push({ type: 'hurt' });
    if (state.hp <= 0) {
        state.hp = 0;
        state.phase = 'dead';
        state.events.push({ type: 'die' });
    }
}
function removeEnemy(state, index, reward) {
    const [enemy] = state.enemies.splice(index, 1);
    addEffect(state, 'burst', enemy.pos, '#fbbf24', 1, 340);
    if (!reward)
        return;
    state.kills += 1;
    state.coins += 1;
    addScore(state, config_1.SCORE_KILL);
    state.events.push({ type: 'kill' });
}
function shockwave(state) {
    const head = state.snake[0];
    addEffect(state, 'ring', head, '#a78bfa', 3.5, 600);
    for (let i = state.enemies.length - 1; i >= 0; i--) {
        if ((0, level_1.chebyshev)(state.enemies[i].pos, head) <= 3)
            removeEnemy(state, i, true);
    }
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        if ((0, level_1.chebyshev)(state.projectiles[i].pos, head) <= 3)
            state.projectiles.splice(i, 1);
    }
}
function eatFruit(state, fruit) {
    const ascetic = hasRelic(state, 'ascetic');
    const energyGain = (fruit.type === 'cursed' ? config_1.CURSED_ENERGY : config_1.FRUIT_ENERGY) * (ascetic ? 2 : 1);
    if (fruit.type === 'cursed') {
        truncate(state, 2);
        addScore(state, 5, false);
        state.events.push({ type: 'cursed' });
    }
    else {
        if (!ascetic)
            state.growth += 1 + (hasRelic(state, 'gluttony') ? 1 : 0);
        if (fruit.type === 'golden') {
            state.coins += 3;
            addScore(state, config_1.SCORE_FRUIT * 2);
            state.events.push({ type: 'golden' });
        }
        else {
            addScore(state, config_1.SCORE_FRUIT);
            state.events.push({ type: 'eat' });
        }
    }
    state.energy = Math.min(state.maxEnergy, state.energy + energyGain);
    state.eaten += 1;
    state.echoCount += 1;
    addEffect(state, 'burst', fruit.pos, fruit.type === 'golden' ? '#fcd34d' : '#4ade80', 1, 320);
    if (hasRelic(state, 'echo') && state.echoCount % 5 === 0)
        shockwave(state);
}
function consumeFruits(state) {
    const head = state.snake[0];
    const magnet = hasRelic(state, 'magnet') ? 2 : 0;
    for (let i = state.fruits.length - 1; i >= 0; i--) {
        const fruit = state.fruits[i];
        if ((0, level_1.samePos)(fruit.pos, head) || (0, level_1.chebyshev)(fruit.pos, head) <= magnet) {
            state.fruits.splice(i, 1);
            eatFruit(state, fruit);
        }
    }
    refillFruits(state);
}
function advance(state, cell) {
    state.prevSnake = state.snake.map((segment) => ({ ...segment }));
    state.snake.unshift(cell);
    if (state.growth > 0)
        state.growth -= 1;
    else
        state.snake.pop();
}
function openExit(state) {
    const cell = pickCell(state, freeCells(state), 6);
    if (!cell)
        return;
    state.exit = cell;
    addEffect(state, 'ring', cell, '#38bdf8', 3, 700);
}
function maybeOpenExit(state) {
    if (state.exit || state.boss)
        return;
    if (state.eaten < state.quota)
        return;
    openExit(state);
}
function enterExit(state) {
    addScore(state, config_1.SCORE_FLOOR * state.floor, false);
    state.exit = null;
    state.events.push({ type: 'exit' });
    if (!state.endless && state.floor >= config_1.MAX_FLOOR) {
        addScore(state, config_1.SCORE_ESCAPE + state.hp * config_1.SCORE_HP_BONUS, false);
        state.phase = 'won';
        state.events.push({ type: 'win' });
        return;
    }
    state.pendingPicks += 1;
    state.relicChoices = (0, relics_1.rollRelicChoices)(state.rng, state.relics, 3);
    state.phase = 'relic';
}
function moveSnake(state) {
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
        const selfHit = state.snake.slice(0, bodyLimit).some((segment) => (0, level_1.samePos)(segment, target));
        if (selfHit) {
            if (hasRelic(state, 'ghost') && !state.ghostUsed) {
                state.ghostUsed = true;
                addEffect(state, 'ring', target, '#c4b5fd', 1.5, 420);
            }
            else {
                hurt(state);
                bounce(state);
                return;
            }
        }
    }
    const enemyIndex = state.enemies.findIndex((enemy) => (0, level_1.samePos)(enemy.pos, target));
    if (enemyIndex >= 0) {
        if (invulnerable || hasRelic(state, 'fang')) {
            removeEnemy(state, enemyIndex, true);
        }
        else {
            hurt(state);
            bounce(state);
            return;
        }
    }
    advance(state, target);
    consumeFruits(state);
    if (state.exit && (0, level_1.samePos)(state.snake[0], state.exit))
        enterExit(state);
}
function stepEnemy(state, enemy) {
    const head = state.snake[0];
    const blocked = (cell) => {
        if ((0, level_1.isWall)(state.tiles, cell.x, cell.y))
            return true;
        if (state.boss && bossCovers(state.boss, cell))
            return true;
        return state.enemies.some((other) => other.id !== enemy.id && (0, level_1.samePos)(other.pos, cell));
    };
    if (enemy.type === 'wisp') {
        if ((state.tick + enemy.offset) % 3 !== 0)
            return;
        const options = ALL_DIRS.map((dir) => ({
            x: enemy.pos.x + DELTA[dir].x,
            y: enemy.pos.y + DELTA[dir].y,
        })).filter((cell) => !blocked(cell));
        if (options.length === 0)
            return;
        enemy.pos = options[Math.floor(state.rng() * options.length)];
        return;
    }
    if (enemy.type === 'stalker') {
        if ((state.tick + enemy.offset) % 2 !== 0)
            return;
        const dx = head.x - enemy.pos.x;
        const dy = head.y - enemy.pos.y;
        const primary = Math.abs(dx) >= Math.abs(dy)
            ? { x: enemy.pos.x + Math.sign(dx), y: enemy.pos.y }
            : { x: enemy.pos.x, y: enemy.pos.y + Math.sign(dy) };
        const secondary = Math.abs(dx) >= Math.abs(dy)
            ? { x: enemy.pos.x, y: enemy.pos.y + Math.sign(dy) }
            : { x: enemy.pos.x + Math.sign(dx), y: enemy.pos.y };
        if (!(0, level_1.samePos)(primary, enemy.pos) && !blocked(primary))
            enemy.pos = primary;
        else if (!(0, level_1.samePos)(secondary, enemy.pos) && !blocked(secondary))
            enemy.pos = secondary;
        return;
    }
    // spitter: rooted, only fires when the head shares its row or column
    if ((state.tick + enemy.offset) % 12 !== 0)
        return;
    const dx = head.x - enemy.pos.x;
    const dy = head.y - enemy.pos.y;
    if (dx !== 0 && dy !== 0)
        return;
    const dir = dx !== 0 ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';
    const muzzle = { x: enemy.pos.x + DELTA[dir].x, y: enemy.pos.y + DELTA[dir].y };
    if ((0, level_1.isWall)(state.tiles, muzzle.x, muzzle.y))
        return;
    state.projectiles.push({ id: state.nextId++, pos: muzzle, prev: { ...enemy.pos }, dir });
}
function resolveEnemyContacts(state) {
    for (let i = state.enemies.length - 1; i >= 0; i--) {
        const enemy = state.enemies[i];
        const onSnake = state.snake.some((segment) => (0, level_1.samePos)(segment, enemy.pos));
        if (!onSnake)
            continue;
        const onHead = (0, level_1.samePos)(state.snake[0], enemy.pos);
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
function updateEnemies(state) {
    for (const enemy of state.enemies) {
        enemy.prev = { ...enemy.pos };
        stepEnemy(state, enemy);
    }
    resolveEnemyContacts(state);
}
function updateProjectiles(state) {
    for (let i = state.projectiles.length - 1; i >= 0; i--) {
        const projectile = state.projectiles[i];
        projectile.prev = { ...projectile.pos };
        projectile.pos = {
            x: projectile.pos.x + DELTA[projectile.dir].x,
            y: projectile.pos.y + DELTA[projectile.dir].y,
        };
        if ((0, level_1.isWall)(state.tiles, projectile.pos.x, projectile.pos.y)) {
            state.projectiles.splice(i, 1);
            continue;
        }
        if (state.snake.some((segment) => (0, level_1.samePos)(segment, projectile.pos))) {
            state.projectiles.splice(i, 1);
            if (state.time >= state.invulnUntil)
                hurt(state);
        }
    }
}
function teleportBoss(state) {
    const boss = state.boss;
    if (!boss)
        return;
    const head = state.snake[0];
    const candidates = [];
    for (let y = 2; y < config_1.GRID - 2; y++) {
        for (let x = 2; x < config_1.GRID - 2; x++) {
            const anchor = { x, y };
            if ((0, level_1.chebyshev)(anchor, head) < 5)
                continue;
            let clear = true;
            for (let oy = -1; oy <= 1 && clear; oy++) {
                for (let ox = -1; ox <= 1 && clear; ox++) {
                    const cell = { x: x + ox, y: y + oy };
                    if ((0, level_1.isWall)(state.tiles, cell.x, cell.y))
                        clear = false;
                    else if (state.snake.some((segment) => (0, level_1.samePos)(segment, cell)))
                        clear = false;
                }
            }
            if (clear)
                candidates.push(anchor);
        }
    }
    if (candidates.length === 0)
        return;
    boss.pos = candidates[Math.floor(state.rng() * candidates.length)];
    addEffect(state, 'ring', boss.pos, '#f472b6', 3, 500);
}
function damageBoss(state) {
    const boss = state.boss;
    if (!boss || state.time < boss.hitFlashUntil)
        return;
    boss.hp -= 1;
    boss.hitFlashUntil = state.time + 500;
    addEffect(state, 'burst', boss.pos, '#f472b6', 2.5, 480);
    state.events.push({ type: 'bossHit' });
    if (boss.hp <= 0) {
        state.boss = null;
        state.coins += 10;
        state.kills += 1;
        addScore(state, config_1.SCORE_BOSS * state.floor, false);
        state.pendingPicks += 1;
        state.projectiles = [];
        openExit(state);
        state.events.push({ type: 'bossDown' });
        return;
    }
    teleportBoss(state);
}
function updateBoss(state) {
    const boss = state.boss;
    if (!boss)
        return;
    if (state.tick % 20 === 0 && state.enemies.length < 4)
        spawnEnemy(state, 'stalker');
    if (state.tick % 20 === 0 && state.spikes.length < 20)
        spawnSpikes(state, 1);
}
function checkSpikes(state) {
    const head = state.snake[0];
    const spike = state.spikes.find((entry) => (0, level_1.samePos)(entry.pos, head));
    if (spike && isSpikeArmed(state, spike.offset))
        hurt(state);
}
function pruneEffects(state) {
    state.effects = state.effects.filter((effect) => state.time - effect.born < effect.life);
}
function tick(state) {
    if (state.phase !== 'playing')
        return;
    state.tick += 1;
    state.time += state.moveInterval;
    state.energy = Math.min(state.maxEnergy, state.energy + config_1.ENERGY_REGEN_PER_TICK);
    pruneEffects(state);
    const queued = state.pendingDirs.shift();
    if (queued && queued !== OPPOSITE[state.dir])
        state.dir = queued;
    moveSnake(state);
    if (state.phase !== 'playing')
        return;
    updateEnemies(state);
    if (state.phase !== 'playing')
        return;
    updateProjectiles(state);
    updateBoss(state);
    checkSpikes(state);
    maybeOpenExit(state);
}
function dash(state) {
    if (state.phase !== 'playing')
        return;
    if (state.time < state.dashReadyAt)
        return;
    const blood = hasRelic(state, 'blood');
    if (blood) {
        state.dashCount += 1;
        if (state.dashCount % config_1.BLOOD_DASH_INTERVAL === 0)
            payBloodPrice(state);
        if (state.phase !== 'playing')
            return;
    }
    else {
        if (state.energy < config_1.DASH_COST)
            return;
        state.energy -= config_1.DASH_COST;
    }
    state.dashReadyAt = state.time + config_1.DASH_COOLDOWN_MS;
    state.dashUntil = state.time + config_1.DASH_INVULN_MS;
    state.invulnUntil = Math.max(state.invulnUntil, state.dashUntil);
    state.events.push({ type: 'dash' });
    const distance = config_1.DASH_DISTANCE + (hasRelic(state, 'core') ? 1 : 0);
    for (let step = 0; step < distance; step++) {
        const head = state.snake[0];
        const target = resolveTarget(state, head, state.dir);
        if (!target)
            break;
        if (state.boss && bossCovers(state.boss, target)) {
            damageBoss(state);
            break;
        }
        const enemyIndex = state.enemies.findIndex((enemy) => (0, level_1.samePos)(enemy.pos, target));
        if (enemyIndex >= 0)
            removeEnemy(state, enemyIndex, true);
        addEffect(state, 'slash', target, '#67e8f9', 1, 260);
        advance(state, target);
        consumeFruits(state);
        if (state.exit && (0, level_1.samePos)(state.snake[0], state.exit)) {
            enterExit(state);
            return;
        }
    }
}
function applyRelic(state, id) {
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
function chooseRelic(state, id) {
    if (state.phase !== 'relic')
        return;
    if (!state.relicChoices.includes(id))
        return;
    if (id !== 'bag' && id !== 'mend')
        state.relics.push(id);
    applyRelic(state, id);
    state.pendingPicks -= 1;
    state.relicChoices = [];
    if (state.pendingPicks > 0) {
        state.relicChoices = (0, relics_1.rollRelicChoices)(state.rng, state.relics, 3);
        return;
    }
    buildFloor(state, state.floor + 1);
    state.phase = 'playing';
}
function rerollRelics(state) {
    if (state.phase !== 'relic' || state.coins < config_1.REROLL_COST)
        return;
    state.coins -= config_1.REROLL_COST;
    state.relicChoices = (0, relics_1.rollRelicChoices)(state.rng, state.relics, 3);
}
function buyHeal(state) {
    if (state.phase !== 'relic' || state.coins < config_1.HEAL_COST)
        return;
    if (state.hp >= state.maxHp)
        return;
    state.coins -= config_1.HEAL_COST;
    state.hp += 1;
}
/** Called from the victory screen to keep diving with the same build. */
function continueEndless(state) {
    if (state.phase !== 'won')
        return;
    state.endless = true;
    state.pendingPicks += 1;
    state.relicChoices = (0, relics_1.rollRelicChoices)(state.rng, state.relics, 3);
    state.phase = 'relic';
}

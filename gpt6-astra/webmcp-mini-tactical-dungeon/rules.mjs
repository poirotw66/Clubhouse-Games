/**
 * Pure rules for WebMCP Mini Tactical Dungeon (depth-4 campaign).
 * Keep this free of DOM so check-tactical.mjs can import it in Node.
 */

export const STORAGE_KEY = "astra-tactical-dungeon:v1";
export const FLOOR_COUNT = 6;
export const GRID_SIZE = 8;
export const TUTORIAL_SEED = "tutorial";
export const DEFAULT_AP = 2;

/** @typedef {"tutorial"|"campaign"|"daily"} RunMode */

export const MODE_ORDER = /** @type {RunMode[]} */ (["tutorial", "campaign", "daily"]);

export const MODES = {
  tutorial: {
    id: "tutorial",
    label: "教學地城",
    blurb: "固定種子：原版 8×8 地圖，單層通關，給 agent 與測試用。",
    floors: 1,
    seed: TUTORIAL_SEED,
  },
  campaign: {
    id: "campaign",
    label: "遠征",
    blurb: "六層程序化地城，層末三選一強化，最終層有 Boss。",
    floors: FLOOR_COUNT,
    seed: null,
  },
  daily: {
    id: "daily",
    label: "今日地城",
    blurb: "以當日日期為種子的六層挑戰，可比每日最佳紀錄。",
    floors: FLOOR_COUNT,
    seed: null,
  },
};

/** Exact original demo layout (depth-3 fixture). */
export const TUTORIAL_MAP = Object.freeze([
  "########",
  "#......#",
  "#.#....#",
  "#.#....#",
  "#....P.#",
  "#..#...#",
  "#.R....#",
  "########",
]);

export const TUTORIAL_FLOOR = Object.freeze({
  floor: 1,
  name: "Aether Vault",
  isBoss: false,
  map: TUTORIAL_MAP,
  exit: { x: 6, y: 6 },
  crystal: { x: 6, y: 5 },
  playerStart: { x: 1, y: 1 },
  items: Object.freeze([
    { id: "health-potion-1", type: "health_potion", x: 1, y: 5 },
    { id: "mana-potion-1", type: "mana_potion", x: 3, y: 2 },
    { id: "ancient-crystal", type: "ancient_crystal", x: 6, y: 5 },
  ]),
  hazards: Object.freeze([
    {
      id: "spike-trap-1",
      name: "Spike Trap",
      x: 6,
      y: 2,
      damage: 20,
      description:
        "Visible spikes. Every traversal of this tile deals 20 damage, ignoring defense and Barrier.",
    },
  ]),
  enemies: Object.freeze([
    {
      id: "goblin-1",
      kind: "goblin",
      name: "Goblin Scout",
      sprite: "goblin",
      x: 4,
      y: 1,
      hp: 35,
      maxHp: 35,
      attack: 10,
      attackRange: 1,
      moveRange: 2,
      behavior:
        "Aggressive melee. Within 5 tiles, attacks if adjacent; otherwise advances up to 2 tiles.",
      weakness: "No special weakness.",
    },
    {
      id: "skeleton-1",
      kind: "skeleton",
      name: "Skeleton Archer",
      sprite: "skeleton",
      x: 4,
      y: 3,
      hp: 28,
      maxHp: 28,
      attack: 12,
      attackRange: 3,
      moveRange: 1,
      behavior:
        "Activates within 5 tiles. Retreats one tile when adjacent if possible; otherwise attacks within 3 tiles or advances.",
      weakness: "Low health.",
    },
    {
      id: "orc-1",
      kind: "orc",
      name: "Orc Guardian",
      sprite: "orc",
      x: 5,
      y: 4,
      hp: 60,
      maxHp: 60,
      attack: 18,
      attackRange: 1,
      moveRange: 1,
      behavior:
        "Guards the Ancient Crystal. Activates when Aria is within 3 tiles of the crystal or adjacent to the Orc. Attacks if adjacent; otherwise advances one tile.",
      weakness: "Arcane attacks: Arcane Shot deals 10 bonus damage.",
    },
  ]),
});

/** Terrain codes used in map strings. */
export const TERRAIN = Object.freeze({
  "#": "wall",
  ".": "floor",
  P: "pillar",
  R: "rubble",
  C: "cover",
});

export const ENEMY_KINDS = Object.freeze({
  goblin: {
    kind: "goblin",
    name: "Goblin Scout",
    sprite: "goblin",
    hp: 35,
    attack: 10,
    attackRange: 1,
    moveRange: 2,
    behavior: "Aggressive melee scout.",
    weakness: "No special weakness.",
  },
  skeleton: {
    kind: "skeleton",
    name: "Skeleton Archer",
    sprite: "skeleton",
    hp: 28,
    attack: 12,
    attackRange: 3,
    moveRange: 1,
    behavior: "Keeps distance and shoots.",
    weakness: "Low health.",
  },
  orc: {
    kind: "orc",
    name: "Orc Guardian",
    sprite: "orc",
    hp: 60,
    attack: 18,
    attackRange: 1,
    moveRange: 1,
    behavior: "Guards the crystal.",
    weakness: "Arcane attacks: Arcane Shot deals 10 bonus damage.",
  },
  slime: {
    kind: "slime",
    name: "Aether Slime",
    sprite: "slime",
    hp: 48,
    attack: 8,
    attackRange: 1,
    moveRange: 1,
    behavior: "Slow melee. Regenerates 4 HP at the start of its action if below max.",
    weakness: "Arcane Shot deals +8 bonus damage.",
  },
  mage: {
    kind: "mage",
    name: "Shade Mage",
    sprite: "mage",
    hp: 32,
    attack: 14,
    attackRange: 4,
    moveRange: 1,
    behavior: "Long-range caster. Prefer attacking when in range; otherwise advances.",
    weakness: "Fragile: low HP.",
  },
  boss: {
    kind: "boss",
    name: "Vault Warden",
    sprite: "boss",
    hp: 120,
    attack: 22,
    attackRange: 1,
    moveRange: 2,
    behavior: "Final-floor boss. Always active. Melee rush with high HP.",
    weakness: "Arcane Shot deals +15 bonus damage.",
  },
});

export const REWARD_POOL = Object.freeze([
  {
    id: "iron_charm",
    kind: "equipment",
    name: "Iron Charm",
    description: "+4 Attack for the rest of this run.",
    apply: { attack: 4 },
  },
  {
    id: "shield_ring",
    kind: "equipment",
    name: "Shield Ring",
    description: "+3 Defense for the rest of this run.",
    apply: { defense: 3 },
  },
  {
    id: "vital_band",
    kind: "equipment",
    name: "Vital Band",
    description: "+20 max HP and heal 20 HP.",
    apply: { maxHp: 20, heal: 20 },
  },
  {
    id: "arcane_focus",
    kind: "equipment",
    name: "Arcane Focus",
    description: "+15 max mana and restore 15 mana.",
    apply: { maxMana: 15, restoreMana: 15 },
  },
  {
    id: "swift_boots",
    kind: "equipment",
    name: "Swift Boots",
    description: "+1 move range (max 5) for the rest of this run.",
    apply: { moveRange: 1 },
  },
  {
    id: "field_ration",
    kind: "consumable",
    name: "Field Ration",
    description: "Fully restore HP and mana.",
    apply: { fullRestore: true },
  },
  {
    id: "spike_ward",
    kind: "equipment",
    name: "Spike Ward",
    description: "Trap damage reduced by 50% for the rest of this run.",
    apply: { trapResist: 0.5 },
  },
  {
    id: "hunter_mark",
    kind: "equipment",
    name: "Hunter's Mark",
    description: "+1 attack range for the rest of this run.",
    apply: { attackRange: 1 },
  },
]);

export function getMode(id) {
  return MODES[id] || MODES.tutorial;
}

export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Stable positive seed from any string (FNV-1a style). */
export function seedFromString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 1000003 || 1;
}

export function dailySeed(date = new Date()) {
  return seedFromString(`tactical-daily:${localDateKey(date)}`);
}

export function floorSeed(runSeed, floorIndex) {
  return seedFromString(`tactical-floor:${runSeed}:${floorIndex}`);
}

/** Mulberry32 PRNG → [0, 1). */
export function createRng(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function emptyMeta() {
  return {
    version: 1,
    bestFloorCampaign: 0,
    bestFloorDaily: 0,
    bestTurnsCampaign: null,
    bestTurnsDaily: null,
    clearsTutorial: 0,
    clearsCampaign: 0,
    clearsDaily: 0,
    lastMode: "tutorial",
    lastDailyKey: null,
    dailyBestTurns: null,
  };
}

export function migrateMeta(raw) {
  const base = emptyMeta();
  if (!raw || typeof raw !== "object") return base;
  for (const key of Object.keys(base)) {
    if (key === "version") continue;
    if (raw[key] === undefined || raw[key] === null) continue;
    if (typeof base[key] === "number" || base[key] === null) {
      const n = Number(raw[key]);
      if (Number.isFinite(n)) base[key] = n;
    } else if (typeof base[key] === "string") {
      base[key] = String(raw[key]);
    }
  }
  if (MODE_ORDER.includes(raw.lastMode)) base.lastMode = raw.lastMode;
  if (typeof raw.lastDailyKey === "string") base.lastDailyKey = raw.lastDailyKey;
  base.version = 1;
  return base;
}

/**
 * Record a finished or abandoned run into meta.
 * @param {object} meta
 * @param {{ mode: RunMode, floorReached: number, win: boolean, turns: number, dateKey?: string|null }} run
 */
export function recordRun(meta, run) {
  const next = migrateMeta(meta);
  const mode = getMode(run.mode).id;
  const floor = Math.max(1, Math.floor(run.floorReached) || 1);
  const turns = Math.max(1, Math.floor(run.turns) || 1);

  if (mode === "tutorial") {
    if (run.win) next.clearsTutorial += 1;
  } else if (mode === "campaign") {
    if (floor > next.bestFloorCampaign) next.bestFloorCampaign = floor;
    if (run.win) {
      next.clearsCampaign += 1;
      if (next.bestTurnsCampaign == null || turns < next.bestTurnsCampaign) {
        next.bestTurnsCampaign = turns;
      }
    }
  } else if (mode === "daily") {
    if (floor > next.bestFloorDaily) next.bestFloorDaily = floor;
    if (run.win) {
      next.clearsDaily += 1;
      if (next.bestTurnsDaily == null || turns < next.bestTurnsDaily) {
        next.bestTurnsDaily = turns;
      }
    }
    const dateKey = run.dateKey || localDateKey();
    if (next.lastDailyKey !== dateKey) {
      next.lastDailyKey = dateKey;
      next.dailyBestTurns = run.win ? turns : null;
    } else if (run.win && (next.dailyBestTurns == null || turns < next.dailyBestTurns)) {
      next.dailyBestTurns = turns;
    }
  }

  next.lastMode = mode;
  return { meta: next, floor, turns };
}

export function terrainAt(mapRows, x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) return "out_of_bounds";
  if (y < 0 || x < 0 || y >= mapRows.length || x >= mapRows[0].length) {
    return "out_of_bounds";
  }
  return TERRAIN[mapRows[y][x]] || "wall";
}

export function isWalkable(mapRows, x, y) {
  const t = terrainAt(mapRows, x, y);
  return t === "floor" || t === "cover";
}

export function coverBonus(mapRows, x, y) {
  return terrainAt(mapRows, x, y) === "cover" ? 0.5 : 0;
}

export function enemyHpScale(floorIndex) {
  return 1 + Math.max(0, floorIndex) * 0.12;
}

export function enemyAtkScale(floorIndex) {
  return 1 + Math.max(0, floorIndex) * 0.08;
}

export function isBossFloor(floorIndex, floorCount = FLOOR_COUNT) {
  return floorIndex >= floorCount - 1;
}

export function floorName(floorIndex, isBoss) {
  if (isBoss) return "Vault Heart";
  const names = [
    "Aether Foyer",
    "Moss Gallery",
    "Runic Corridor",
    "Ember Crypt",
    "Mirror Hall",
    "Vault Heart",
  ];
  return names[Math.min(floorIndex, names.length - 1)];
}

function blankInterior() {
  const rows = [];
  for (let y = 0; y < GRID_SIZE; y++) {
    let row = "";
    for (let x = 0; x < GRID_SIZE; x++) {
      row += x === 0 || y === 0 || x === GRID_SIZE - 1 || y === GRID_SIZE - 1 ? "#" : ".";
    }
    rows.push(row);
  }
  return rows;
}

function setCell(rows, x, y, ch) {
  if (x <= 0 || y <= 0 || x >= GRID_SIZE - 1 || y >= GRID_SIZE - 1) return;
  const line = rows[y];
  rows[y] = line.slice(0, x) + ch + line.slice(x + 1);
}

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function carvePillars(rows, rng, count) {
  const candidates = [];
  for (let y = 2; y < GRID_SIZE - 2; y++) {
    for (let x = 2; x < GRID_SIZE - 2; x++) {
      if (rows[y][x] === ".") candidates.push({ x, y });
    }
  }
  for (const cell of shuffle(candidates, rng).slice(0, count)) {
    setCell(rows, cell.x, cell.y, rng() < 0.45 ? "P" : "R");
  }
}

function placeCover(rows, rng, count) {
  const candidates = [];
  for (let y = 1; y < GRID_SIZE - 1; y++) {
    for (let x = 1; x < GRID_SIZE - 1; x++) {
      if (rows[y][x] === ".") candidates.push({ x, y });
    }
  }
  for (const cell of shuffle(candidates, rng).slice(0, count)) {
    setCell(rows, cell.x, cell.y, "C");
  }
}

function openCells(rows) {
  const cells = [];
  for (let y = 1; y < GRID_SIZE - 1; y++) {
    for (let x = 1; x < GRID_SIZE - 1; x++) {
      if (isWalkable(rows, x, y)) cells.push({ x, y });
    }
  }
  return cells;
}

function bfsReachable(rows, start) {
  const seen = new Set([`${start.x},${start.y}`]);
  const q = [start];
  for (let i = 0; i < q.length; i++) {
    const p = q[i];
    for (const n of [
      { x: p.x, y: p.y - 1 },
      { x: p.x + 1, y: p.y },
      { x: p.x, y: p.y + 1 },
      { x: p.x - 1, y: p.y },
    ]) {
      const k = `${n.x},${n.y}`;
      if (seen.has(k) || !isWalkable(rows, n.x, n.y)) continue;
      seen.add(k);
      q.push(n);
    }
  }
  return seen;
}

function ensureConnectivity(rows, anchors) {
  const start = anchors[0];
  let reachable = bfsReachable(rows, start);
  for (const target of anchors.slice(1)) {
    if (reachable.has(`${target.x},${target.y}`)) continue;
    // Carve a simple Manhattan tunnel.
    let { x, y } = start;
    while (x !== target.x) {
      x += x < target.x ? 1 : -1;
      if (rows[y][x] === "#" || rows[y][x] === "P" || rows[y][x] === "R") {
        setCell(rows, x, y, ".");
      }
    }
    while (y !== target.y) {
      y += y < target.y ? 1 : -1;
      if (rows[y][x] === "#" || rows[y][x] === "P" || rows[y][x] === "R") {
        setCell(rows, x, y, ".");
      }
    }
    reachable = bfsReachable(rows, start);
  }
}

function scaleEnemy(base, floorIndex, id) {
  const hpMul = enemyHpScale(floorIndex);
  const atkMul = enemyAtkScale(floorIndex);
  const hp = Math.max(1, Math.round(base.hp * hpMul));
  return {
    id,
    kind: base.kind,
    name: base.name,
    sprite: base.sprite,
    x: 0,
    y: 0,
    hp,
    maxHp: hp,
    attack: Math.max(1, Math.round(base.attack * atkMul)),
    attackRange: base.attackRange,
    moveRange: base.moveRange,
    behavior: base.behavior,
    weakness: base.weakness,
  };
}

function pickEnemyKinds(floorIndex, isBoss, rng) {
  if (isBoss) return ["boss", "mage", "skeleton"];
  const pool = ["goblin", "skeleton", "orc", "slime", "mage"];
  const count = Math.min(4, 2 + Math.floor(floorIndex / 2) + (rng() < 0.4 ? 1 : 0));
  const kinds = [];
  // Prefer at least one melee and one ranged when possible.
  kinds.push(rng() < 0.5 ? "goblin" : "slime");
  if (count >= 2) kinds.push(rng() < 0.55 ? "skeleton" : "mage");
  while (kinds.length < count) {
    kinds.push(pool[Math.floor(rng() * pool.length)]);
  }
  if (floorIndex >= 2 && !kinds.includes("orc") && rng() < 0.55) {
    kinds[kinds.length - 1] = "orc";
  }
  return kinds.slice(0, count);
}

/**
 * Build a deterministic floor layout for a run seed + floor index.
 * Floor index is 0-based. Tutorial seed + floor 0 returns the original fixture.
 */
export function generateFloor(runSeed, floorIndex, options = {}) {
  const mode = options.mode || "campaign";
  const floorCount = options.floorCount ?? getMode(mode).floors;
  const seedText = String(runSeed ?? TUTORIAL_SEED);

  if (mode === "tutorial" || (seedText === TUTORIAL_SEED && floorIndex === 0 && floorCount === 1)) {
    return structuredClone
      ? structuredClone(TUTORIAL_FLOOR)
      : JSON.parse(JSON.stringify(TUTORIAL_FLOOR));
  }

  // Campaign/daily with tutorial seed still uses the original map on floor 1,
  // then procedural deeper floors.
  if (seedText === TUTORIAL_SEED && floorIndex === 0) {
    const tutorial = structuredClone
      ? structuredClone(TUTORIAL_FLOOR)
      : JSON.parse(JSON.stringify(TUTORIAL_FLOOR));
    tutorial.floor = 1;
    tutorial.isBoss = false;
    return tutorial;
  }

  const rng = createRng(floorSeed(seedText, floorIndex));
  const isBoss = isBossFloor(floorIndex, floorCount);
  const rows = blankInterior();

  carvePillars(rows, rng, isBoss ? 2 : 3 + Math.floor(rng() * 3));
  placeCover(rows, rng, isBoss ? 2 : 1 + Math.floor(rng() * 3));

  const open = openCells(rows);
  const shuffled = shuffle(open, rng);
  const playerStart = shuffled[0] || { x: 1, y: 1 };
  const exit = shuffled.find((c) => Math.abs(c.x - playerStart.x) + Math.abs(c.y - playerStart.y) >= 4) ||
    shuffled[shuffled.length - 1] ||
    { x: 6, y: 6 };
  const crystal =
    shuffled.find(
      (c) =>
        !(c.x === playerStart.x && c.y === playerStart.y) &&
        !(c.x === exit.x && c.y === exit.y) &&
        Math.abs(c.x - exit.x) + Math.abs(c.y - exit.y) <= 3,
    ) ||
    shuffled[1] ||
    { x: 5, y: 5 };

  ensureConnectivity(rows, [playerStart, crystal, exit]);

  const reserved = new Set([
    `${playerStart.x},${playerStart.y}`,
    `${exit.x},${exit.y}`,
    `${crystal.x},${crystal.y}`,
  ]);

  const free = openCells(rows).filter((c) => !reserved.has(`${c.x},${c.y}`));
  const freeShuffled = shuffle(free, rng);

  const hazards = [];
  const trapCount = isBoss ? 1 : 1 + (rng() < 0.5 ? 1 : 0);
  for (let i = 0; i < trapCount && freeShuffled.length; i++) {
    const cell = freeShuffled.pop();
    reserved.add(`${cell.x},${cell.y}`);
    hazards.push({
      id: `spike-trap-${floorIndex + 1}-${i + 1}`,
      name: "Spike Trap",
      x: cell.x,
      y: cell.y,
      damage: 16 + floorIndex * 2,
      description: `Visible spikes. Every traversal deals ${16 + floorIndex * 2} damage, ignoring defense and Barrier.`,
    });
  }

  const items = [
    {
      id: "ancient-crystal",
      type: "ancient_crystal",
      x: crystal.x,
      y: crystal.y,
    },
  ];
  if (freeShuffled.length) {
    const hp = freeShuffled.pop();
    reserved.add(`${hp.x},${hp.y}`);
    items.push({
      id: `health-potion-${floorIndex + 1}`,
      type: "health_potion",
      x: hp.x,
      y: hp.y,
    });
  }
  if (freeShuffled.length && (floorIndex > 0 || rng() < 0.7)) {
    const mp = freeShuffled.pop();
    reserved.add(`${mp.x},${mp.y}`);
    items.push({
      id: `mana-potion-${floorIndex + 1}`,
      type: "mana_potion",
      x: mp.x,
      y: mp.y,
    });
  }

  const kinds = pickEnemyKinds(floorIndex, isBoss, rng);
  const enemies = [];
  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i];
    const base = ENEMY_KINDS[kind];
    const spot =
      freeShuffled.pop() ||
      openCells(rows).find((c) => !reserved.has(`${c.x},${c.y}`)) ||
      { x: 4, y: 4 };
    reserved.add(`${spot.x},${spot.y}`);
    const enemy = scaleEnemy(base, floorIndex, `${kind}-${floorIndex + 1}-${i + 1}`);
    enemy.x = spot.x;
    enemy.y = spot.y;
    if (kind === "orc" || kind === "boss") {
      enemy.behavior = `${base.behavior} Guards the Ancient Crystal this floor.`;
    }
    enemies.push(enemy);
  }

  ensureConnectivity(rows, [playerStart, crystal, exit, ...enemies.map((e) => ({ x: e.x, y: e.y }))]);

  return {
    floor: floorIndex + 1,
    name: floorName(floorIndex, isBoss),
    isBoss,
    map: rows.map((r) => r),
    exit: { ...exit },
    crystal: { ...crystal },
    playerStart: { ...playerStart },
    items,
    hazards,
    enemies,
  };
}

/** Deterministic three reward options for a cleared floor. */
export function rewardChoices(runSeed, floorIndex) {
  const rng = createRng(seedFromString(`tactical-reward:${runSeed}:${floorIndex}`));
  const pool = shuffle([...REWARD_POOL], rng);
  return pool.slice(0, 3).map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    description: r.description,
  }));
}

export function applyRewardToPlayer(player, rewardId) {
  const reward = REWARD_POOL.find((r) => r.id === rewardId);
  if (!reward) return { success: false, error: "Unknown reward." };
  const next = { ...player };
  const a = reward.apply;
  if (a.attack) next.attack = (next.attack || 18) + a.attack;
  if (a.defense) next.defense = (next.defense || 5) + a.defense;
  if (a.maxHp) {
    next.maxHp = (next.maxHp || 100) + a.maxHp;
    next.hp = Math.min(next.maxHp, (next.hp || 0) + (a.heal || 0));
  } else if (a.heal) {
    next.hp = Math.min(next.maxHp || 100, (next.hp || 0) + a.heal);
  }
  if (a.maxMana) {
    next.maxMana = (next.maxMana || 60) + a.maxMana;
    next.mana = Math.min(next.maxMana, (next.mana || 0) + (a.restoreMana || 0));
  }
  if (a.moveRange) next.moveRange = Math.min(5, (next.moveRange || 3) + a.moveRange);
  if (a.attackRange) next.attackRange = Math.min(5, (next.attackRange || 3) + a.attackRange);
  if (a.trapResist != null) next.trapResist = Math.max(next.trapResist || 0, a.trapResist);
  if (a.fullRestore) {
    next.hp = next.maxHp || 100;
    next.mana = next.maxMana || 60;
  }
  const gear = Array.isArray(next.gear) ? [...next.gear] : [];
  if (!gear.includes(reward.id)) gear.push(reward.id);
  next.gear = gear;
  return { success: true, player: next, reward };
}

export function resolveRunSeed(mode, explicitSeed) {
  const m = getMode(mode);
  if (m.id === "tutorial") return TUTORIAL_SEED;
  if (m.id === "daily") return String(dailySeed());
  if (explicitSeed != null && String(explicitSeed).trim() !== "") {
    return String(explicitSeed).trim().slice(0, 64);
  }
  return String(seedFromString(`campaign:${Date.now()}:${Math.random()}`));
}

export function scoreRun({ floorsCleared, turns, hpRemaining, enemiesDefeated }) {
  return Math.max(
    0,
    floorsCleared * 100 + enemiesDefeated * 12 + hpRemaining - turns * 2,
  );
}

export function validateFloorLayout(floor) {
  if (!floor?.map?.length) return { ok: false, reason: "empty" };
  if (floor.map.length !== GRID_SIZE) return { ok: false, reason: "height" };
  if (floor.map.some((r) => r.length !== GRID_SIZE)) return { ok: false, reason: "width" };
  if (!isWalkable(floor.map, floor.playerStart.x, floor.playerStart.y)) {
    return { ok: false, reason: "start-blocked" };
  }
  if (!isWalkable(floor.map, floor.exit.x, floor.exit.y)) {
    return { ok: false, reason: "exit-blocked" };
  }
  if (!isWalkable(floor.map, floor.crystal.x, floor.crystal.y)) {
    return { ok: false, reason: "crystal-blocked" };
  }
  const reach = bfsReachable(floor.map, floor.playerStart);
  if (!reach.has(`${floor.exit.x},${floor.exit.y}`)) return { ok: false, reason: "exit-unreachable" };
  if (!reach.has(`${floor.crystal.x},${floor.crystal.y}`)) {
    return { ok: false, reason: "crystal-unreachable" };
  }
  return { ok: true };
}

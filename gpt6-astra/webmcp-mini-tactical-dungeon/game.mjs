/**
 * Shared GameEngine + WebMCP tool definitions for Mini Tactical Dungeon.
 * Browser UI and Node-less; importable for isolated self-tests.
 */
import {
  DEFAULT_AP,
  FLOOR_COUNT,
  GRID_SIZE,
  MODE_ORDER,
  MODES,
  STORAGE_KEY,
  TUTORIAL_SEED,
  applyRewardToPlayer,
  coverBonus,
  dailySeed,
  emptyMeta,
  generateFloor,
  getMode,
  isWalkable,
  localDateKey,
  migrateMeta,
  recordRun,
  resolveRunSeed,
  rewardChoices,
  scoreRun,
  terrainAt,
} from "./rules.mjs";

export {
  DEFAULT_AP,
  FLOOR_COUNT,
  GRID_SIZE,
  MODE_ORDER,
  MODES,
  STORAGE_KEY,
  TUTORIAL_SEED,
  dailySeed,
  emptyMeta,
  getMode,
  localDateKey,
  migrateMeta,
  resolveRunSeed,
};

export const ITEM_DATA = {
  health_potion: {
    id: "health_potion",
    name: "Health Potion",
    description: "Restore 35 HP, capped at max HP. Consumes 1 AP.",
    sprite: "health",
    restore: 35,
    resource: "hp",
    consumable: true,
  },
  mana_potion: {
    id: "mana_potion",
    name: "Mana Potion",
    description: "Restore 25 mana, capped at max mana. Consumes 1 AP.",
    sprite: "mana",
    restore: 25,
    resource: "mana",
    consumable: true,
  },
  ancient_crystal: {
    id: "ancient_crystal",
    name: "Ancient Crystal",
    description: "Floor objective. Carry it to the portal, then attempt to leave.",
    sprite: "crystal",
    consumable: false,
  },
};

export const SKILL_DATA = {
  arcane_shot: {
    name: "Arcane Shot",
    manaCost: 15,
    cooldown: 2,
    range: 4,
    targetType: "enemy",
    damage: 30,
    effect: "Deal 30 arcane damage; bonus vs Orc / Slime / Boss.",
    icon: "✧",
  },
  dash: {
    name: "Dash",
    manaCost: 10,
    cooldown: 0,
    range: 4,
    targetType: "tile",
    effect: "Move along a walkable path of up to 4 steps. Crossing traps still hurts.",
    icon: "➶",
  },
  heal: {
    name: "Heal",
    manaCost: 20,
    cooldown: 3,
    range: 0,
    targetType: "self",
    effect: "Restore 30 HP, capped at max HP.",
    icon: "✚",
  },
  barrier: {
    name: "Barrier",
    manaCost: 15,
    cooldown: 0,
    range: 0,
    targetType: "self",
    effect:
      "Halve the next incoming attack after defense. Expires at the end of the next turn's enemy phase.",
    icon: "⬡",
  },
};

export const copy = (value) => JSON.parse(JSON.stringify(value));
export const pos = (o) => ({ x: o.x, y: o.y });
export const key = (o) => `${o.x},${o.y}`;
export const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const same = (a, b) => a.x === b.x && a.y === b.y;
export const inBounds = (x, y) =>
  Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < GRID_SIZE && y < GRID_SIZE;
export const error = (message, extra = {}) => ({ success: false, error: message, ...extra });

function loadMeta() {
  try {
    if (typeof localStorage === "undefined") return emptyMeta();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyMeta();
    return migrateMeta(JSON.parse(raw));
  } catch {
    return emptyMeta();
  }
}

function saveMeta(meta) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrateMeta(meta)));
  } catch {
    /* ignore quota / private mode */
  }
}

export class MapEngine {
  static rows(engine) {
    return engine.s.mapRows;
  }
  static terrain(engine, x, y) {
    if (!inBounds(x, y)) return "out_of_bounds";
    return terrainAt(this.rows(engine), x, y);
  }
  static walkable(engine, x, y) {
    return isWalkable(this.rows(engine), x, y);
  }
  static neighbors(p) {
    return [
      { x: p.x, y: p.y - 1 },
      { x: p.x + 1, y: p.y },
      { x: p.x, y: p.y + 1 },
      { x: p.x - 1, y: p.y },
    ].filter((n) => inBounds(n.x, n.y));
  }
  static paths(engine, start, maxSteps, movingId = "hero") {
    const occupied = new Set(
      engine.s.enemies.filter((e) => e.hp > 0 && e.id !== movingId).map(key),
    );
    if (movingId !== "hero") occupied.add(key(engine.s.player));
    const found = new Map([[key(start), []]]);
    const queue = [{ p: pos(start), path: [] }];
    for (let i = 0; i < queue.length; i++) {
      const { p, path } = queue[i];
      if (path.length >= maxSteps) continue;
      for (const n of this.neighbors(p)) {
        if (!this.walkable(engine, n.x, n.y) || occupied.has(key(n)) || found.has(key(n))) continue;
        const next = [...path, n];
        found.set(key(n), next);
        queue.push({ p: n, path: next });
      }
    }
    found.delete(key(start));
    return found;
  }
}

function defaultPlayer() {
  return {
    id: "aria",
    name: "Aria",
    class: "Arcane Ranger",
    x: 1,
    y: 1,
    hp: 100,
    maxHp: 100,
    mana: 60,
    maxMana: 60,
    attack: 18,
    defense: 5,
    moveRange: 3,
    attackRange: 3,
    trapResist: 0,
    gear: [],
    cooldowns: { arcane_shot: 0, dash: 0, heal: 0, barrier: 0 },
    barrier: null,
  };
}

export class GameEngine {
  constructor(options = {}) {
    this.meta = loadMeta();
    this.reset(options);
  }

  reset(options = {}) {
    const mode = getMode(options.mode || this.meta.lastMode || "tutorial").id;
    const seed =
      options.seed != null
        ? String(options.seed)
        : resolveRunSeed(mode, options.seed);
    const floorCount = getMode(mode).floors;
    const floorIndex = 0;
    const floor = generateFloor(seed, floorIndex, { mode, floorCount });
    this.s = this.buildStateFromFloor({
      mode,
      seed,
      floorCount,
      floorIndex,
      floor,
      player: defaultPlayer(),
      inventory: { health_potion: 0, mana_potion: 0, ancient_crystal: 0 },
      runTurn: 1,
      floorsCleared: 0,
      enemiesDefeatedTotal: 0,
      awaitingReward: false,
      rewardOptions: [],
      runVictory: false,
      recorded: false,
    });
    this.effects = [];
    this.event(
      "System",
      "dungeon_ready",
      mode === "tutorial"
        ? "Aria enters the Aether Vault (tutorial fixture). Inspect, collect supplies, recover the crystal, then escape."
        : `Aria begins a ${getMode(mode).label} run · seed ${seed} · ${floorCount} floors.`,
    );
    return {
      success: true,
      message: "Dungeon reset.",
      mode,
      seed,
      floor: 1,
      floorCount,
    };
  }

  buildStateFromFloor({
    mode,
    seed,
    floorCount,
    floorIndex,
    floor,
    player,
    inventory,
    runTurn,
    floorsCleared,
    enemiesDefeatedTotal,
    awaitingReward,
    rewardOptions,
    runVictory,
    recorded,
  }) {
    const p = { ...player, x: floor.playerStart.x, y: floor.playerStart.y, barrier: null };
    p.cooldowns = { ...p.cooldowns };
    const objective =
      floorCount === 1
        ? "Collect the Ancient Crystal and reach the exit."
        : `Clear floor ${floorIndex + 1}/${floorCount}: collect the crystal and reach the portal${floor.isBoss ? " (Boss floor)" : ""}.`;
    return {
      mode,
      seed,
      floorCount,
      floorIndex,
      floorName: floor.name,
      isBossFloor: !!floor.isBoss,
      mapRows: floor.map.map((r) => r),
      turn: runTurn,
      phase: awaitingReward ? "reward" : "player",
      actionPoints: DEFAULT_AP,
      player: p,
      enemies: copy(floor.enemies).map((e) => ({ ...e, inspected: false })),
      map: floor.map.map((row, y) =>
        [...row].map((_, x) => ({ x, y, terrain: terrainAt(floor.map, x, y) })),
      ),
      items: copy(floor.items),
      hazards: copy(floor.hazards),
      inventory: { ...inventory, ancient_crystal: 0 },
      objective,
      crystalFound: false,
      objectiveCompleted: false,
      exitUnlocked: false,
      floorCleared: false,
      awaitingReward: !!awaitingReward,
      rewardOptions: copy(rewardOptions || []),
      victory: false,
      runVictory: !!runVictory,
      defeated: false,
      selectedTile: pos(p),
      activityLog: this.s?.activityLog ? copy(this.s.activityLog).slice(-20) : [],
      exit: copy(floor.exit),
      crystal: copy(floor.crystal),
      victorySource: null,
      floorsCleared,
      enemiesDefeatedTotal,
      recorded: !!recorded,
      dateKey: mode === "daily" ? localDateKey() : null,
    };
  }

  event(source, action, summary) {
    this.s.activityLog.push({
      timestamp: new Date().toLocaleTimeString("en-GB", { hour12: false }),
      turn: this.s.turn,
      source,
      action,
      summary,
    });
    if (this.s.activityLog.length > 50) {
      this.s.activityLog.splice(0, this.s.activityLog.length - 50);
    }
  }
  effect(p, text = "", kind = "action") {
    this.effects.push({ ...pos(p), text, kind });
  }
  active() {
    return (
      this.s.phase === "player" &&
      !this.s.victory &&
      !this.s.runVictory &&
      !this.s.defeated &&
      !this.s.awaitingReward &&
      this.s.actionPoints > 0
    );
  }
  guard() {
    if (this.s.defeated) return error("Aria has been defeated. Restart the dungeon.");
    if (this.s.runVictory || this.s.victory)
      return error("The dungeon is already cleared. Restart to play again.");
    if (this.s.awaitingReward)
      return error("Choose a floor reward with dungeon_choose_reward before continuing.");
    if (this.s.phase !== "player")
      return error("Actions are only allowed during the player phase.", { phase: this.s.phase });
    if (this.s.actionPoints <= 0) return error("No action points remain. End the turn.");
    return null;
  }
  spend() {
    this.s.actionPoints--;
    if (this.s.actionPoints === 0 && !this.s.defeated && !this.s.victory && !this.s.awaitingReward) {
      this.s.phase = "enemy";
    }
  }
  enemy(id) {
    return this.s.enemies.find((e) => e.id === id);
  }
  aliveEnemy(id) {
    const e = this.enemy(id);
    return e && e.hp > 0 ? e : null;
  }
  cooldown(id) {
    return Math.max(0, this.s.player.cooldowns[id] - this.s.turn);
  }
  publicEnemy(e) {
    const base = {
      enemyId: e.id,
      name: e.name,
      kind: e.kind,
      position: pos(e),
      inspected: e.inspected,
      alive: e.hp > 0,
    };
    if (e.inspected) {
      Object.assign(base, {
        hp: e.hp,
        maxHp: e.maxHp,
        attack: e.attack,
        attackRange: e.attackRange,
        moveRange: e.moveRange,
        behavior: e.behavior,
        weakness: e.weakness,
      });
    }
    return base;
  }
  visibleEnemies() {
    return this.s.enemies.filter((e) => e.hp > 0).map((e) => this.publicEnemy(e));
  }
  inventory() {
    return Object.values(ITEM_DATA).map((d) => ({
      itemId: d.id,
      name: d.name,
      quantity: this.s.inventory[d.id],
      description: d.description,
      consumable: d.consumable,
    }));
  }
  playerState() {
    const p = this.s.player;
    return {
      id: p.id,
      name: p.name,
      class: p.class,
      position: pos(p),
      hp: p.hp,
      maxHp: p.maxHp,
      mana: p.mana,
      maxMana: p.maxMana,
      attack: p.attack,
      defense: p.defense,
      moveRange: p.moveRange,
      attackRange: p.attackRange,
      trapResist: p.trapResist || 0,
      gear: copy(p.gear || []),
      actionPoints: this.s.actionPoints,
      turn: this.s.turn,
      phase: this.s.phase,
      statusEffects: p.barrier
        ? [{ type: "barrier", reduction: "50%", expiresAfterEnemyPhaseOfTurn: p.barrier.expires }]
        : [],
      cooldowns: Object.fromEntries(Object.keys(SKILL_DATA).map((id) => [id, this.cooldown(id)])),
      inventory: this.inventory(),
    };
  }
  tile(x, y) {
    if (!inBounds(x, y)) return error("Coordinates must be integers between 0 and 7.");
    const p = this.s.player;
    const e = this.s.enemies.find((en) => en.hp > 0 && en.x === x && en.y === y);
    const item = this.s.items.find((i) => i.x === x && i.y === y);
    const terrain = MapEngine.terrain(this, x, y);
    return {
      x,
      y,
      terrain,
      walkability: MapEngine.walkable(this, x, y) && !e,
      cover: terrain === "cover",
      occupant: same(p, { x, y }) ? { id: "aria", name: "Aria" } : e ? this.publicEnemy(e) : null,
      item: item ? { itemId: item.id, type: item.type, name: ITEM_DATA[item.type].name } : null,
      hazard: copy(this.s.hazards.find((h) => h.x === x && h.y === y) || null),
      exit: same(this.s.exit, { x, y }),
    };
  }
  mapState() {
    return {
      width: GRID_SIZE,
      height: GRID_SIZE,
      floor: this.s.floorIndex + 1,
      floorCount: this.s.floorCount,
      floorName: this.s.floorName,
      isBossFloor: this.s.isBossFloor,
      coordinateSystem: "x increases right; y increases down; bounds 0–7",
      playerPosition: pos(this.s.player),
      tiles: this.s.map.flat().map((t) => this.tile(t.x, t.y)),
      exitPosition: copy(this.s.exit),
      reachableTiles: this.reachable(this.s.player.moveRange),
      movement:
        "Orthogonal BFS paths. Walls, pillars, rubble and enemies block movement. Cover is walkable and halves ranged hits against a unit standing on it. Hazards trigger on every crossed tile.",
      attackRules:
        "Manhattan distance. Cover halves incoming ranged damage (attackRange > 1) against the defender. Melee ignores cover.",
    };
  }
  runSummary() {
    return {
      mode: this.s.mode,
      seed: this.s.seed,
      floor: this.s.floorIndex + 1,
      floorCount: this.s.floorCount,
      floorName: this.s.floorName,
      isBossFloor: this.s.isBossFloor,
      floorsCleared: this.s.floorsCleared,
      awaitingReward: this.s.awaitingReward,
      rewardOptions: copy(this.s.rewardOptions),
      runVictory: this.s.runVictory,
      defeated: this.s.defeated,
      turn: this.s.turn,
      dateKey: this.s.dateKey,
      records: this.publicMeta(),
    };
  }
  publicMeta() {
    const m = migrateMeta(this.meta);
    return {
      bestFloorCampaign: m.bestFloorCampaign,
      bestFloorDaily: m.bestFloorDaily,
      bestTurnsCampaign: m.bestTurnsCampaign,
      bestTurnsDaily: m.bestTurnsDaily,
      clearsTutorial: m.clearsTutorial,
      clearsCampaign: m.clearsCampaign,
      clearsDaily: m.clearsDaily,
      dailyBestTurns: m.dailyBestTurns,
      lastMode: m.lastMode,
      lastDailyKey: m.lastDailyKey,
      storageKey: STORAGE_KEY,
    };
  }
  state() {
    return {
      turn: this.s.turn,
      phase: this.s.phase,
      actionPoints: this.s.actionPoints,
      player: this.playerState(),
      enemies: this.visibleEnemies(),
      defeatedEnemies: this.s.enemies.filter((e) => e.hp <= 0).map((e) => this.publicEnemy(e)),
      map: this.mapState(),
      items: this.s.items.map((i) => ({ ...copy(i), name: ITEM_DATA[i.type].name })),
      inventory: this.inventory(),
      objective: this.s.objective,
      objectiveCompleted: this.s.objectiveCompleted,
      exitUnlocked: this.s.exitUnlocked,
      victory: this.s.victory || this.s.runVictory,
      floorCleared: this.s.floorCleared,
      awaitingReward: this.s.awaitingReward,
      run: this.runSummary(),
      defeated: this.s.defeated,
      selectedTile: copy(this.s.selectedTile),
      mission: this.progress(),
      activityLog: copy(this.s.activityLog),
    };
  }
  reachable(range) {
    if (!this.active()) return [];
    return [...MapEngine.paths(this, this.s.player, range)].map(([, path]) => {
      const end = path[path.length - 1];
      return {
        ...end,
        steps: path.length,
        path: copy(path),
        hazardDamage: path.reduce((sum, t) => {
          const h = this.s.hazards.find((hz) => same(hz, t));
          if (!h) return sum;
          const resist = this.s.player.trapResist || 0;
          return sum + Math.ceil(h.damage * (1 - resist));
        }, 0),
      };
    });
  }
  targets(range) {
    return this.s.enemies
      .filter((e) => e.hp > 0 && distance(e, this.s.player) <= range)
      .map((e) => e.id);
  }
  skills() {
    const p = this.s.player;
    return Object.entries(SKILL_DATA).map(([id, d]) => {
      let reason = null;
      const targets = d.targetType === "enemy" ? this.targets(d.range) : [];
      const tiles = d.targetType === "tile" ? this.reachable(d.range) : [];
      if (!this.active()) reason = "Not an active player turn with AP.";
      else if (this.cooldown(id) > 0) reason = `On cooldown for ${this.cooldown(id)} more turn(s).`;
      else if (p.mana < d.manaCost) reason = "Not enough mana.";
      else if (id === "heal" && p.hp === p.maxHp) reason = "HP is already full.";
      else if (id === "barrier" && p.barrier) reason = "Barrier is already active.";
      else if (d.targetType === "enemy" && !targets.length) reason = "No enemies in range.";
      else if (d.targetType === "tile" && !tiles.length) reason = "No reachable destination.";
      return {
        skill: id,
        ...copy(d),
        actionPointCost: 1,
        remainingCooldown: this.cooldown(id),
        available: !reason,
        unavailableReason: reason,
        ...(d.targetType === "enemy" ? { validEnemyIds: targets } : {}),
        ...(d.targetType === "tile" ? { reachableTiles: tiles } : {}),
      };
    });
  }
  available() {
    const active = this.active();
    const reachable = this.reachable(this.s.player.moveRange);
    const skills = this.skills();
    const pickup = active
      ? this.s.items
          .filter((i) => distance(i, this.s.player) <= 1)
          .map((i) => ({ itemId: i.id, name: ITEM_DATA[i.type].name, position: pos(i) }))
      : [];
    return {
      phase: this.s.phase,
      actionPoints: this.s.actionPoints,
      canMove: reachable.length > 0,
      reachableTiles: reachable,
      attackableEnemies: active ? this.targets(this.s.player.attackRange) : [],
      availableSkills: skills.filter((s) => s.available),
      skills,
      pickupAvailable: pickup.length > 0,
      pickupItems: pickup,
      usableItems: active
        ? Object.values(ITEM_DATA)
            .filter((d) => {
              if (!d.consumable || this.s.inventory[d.id] <= 0) return false;
              const max = d.resource === "hp" ? this.s.player.maxHp : this.s.player.maxMana;
              return this.s.player[d.resource] < max;
            })
            .map((d) => d.id)
        : [],
      canEndTurn: active,
      canEscape: active && this.progress().canEscape,
      canChooseReward: this.s.awaitingReward,
      rewardOptions: copy(this.s.rewardOptions),
      costs: {
        move: 1,
        attack: 1,
        skill: 1,
        pickup: 1,
        useItem: 1,
        inspect: 0,
        exit: 0,
        reward: 0,
      },
    };
  }
  validateMove(x, y, range) {
    if (!inBounds(x, y)) return error("Coordinates must be integers between 0 and 7.");
    if (!MapEngine.walkable(this, x, y))
      return error(`Tile (${x},${y}) is blocked by ${MapEngine.terrain(this, x, y)}.`);
    if (same(this.s.player, { x, y })) return error("Aria is already on that tile.");
    if (this.s.enemies.some((e) => e.hp > 0 && e.x === x && e.y === y))
      return error("That tile is occupied by an enemy.");
    const path = MapEngine.paths(this, this.s.player, range).get(`${x},${y}`);
    if (!path) return error(`Tile (${x},${y}) is not reachable within ${range} walkable steps.`);
    return { success: true, path };
  }
  moveAlong(path, label) {
    const from = pos(this.s.player);
    let trapDamage = 0;
    for (const tile of path) {
      this.s.player.x = tile.x;
      this.s.player.y = tile.y;
      const hazard = this.s.hazards.find((h) => same(h, tile));
      if (hazard) {
        const resist = this.s.player.trapResist || 0;
        const dmg = Math.ceil(hazard.damage * (1 - resist));
        trapDamage += dmg;
        this.hurtPlayer(dmg, "Spike Trap", true);
        if (this.s.defeated) break;
      }
    }
    const to = pos(this.s.player);
    this.s.selectedTile = to;
    this.effect(to, label === "Dash" ? "DASH" : "", label === "Dash" ? "skill" : "move");
    this.event(
      "System",
      "player_position",
      `Aria ${label === "Dash" ? "dashed" : "moved"} from (${from.x},${from.y}) to (${to.x},${to.y}).`,
    );
    this.spend();
    return { success: true, from, to, path: copy(path), trapDamage, remainingAP: this.s.actionPoints };
  }
  move(x, y) {
    const fail = this.guard();
    if (fail) return fail;
    const check = this.validateMove(x, y, this.s.player.moveRange);
    if (!check.success) return check;
    return this.moveAlong(check.path, "Move");
  }
  validateTarget(id, range) {
    const e = this.aliveEnemy(id);
    if (!e) return error("Target enemy does not exist or is already defeated.");
    if (distance(e, this.s.player) > range)
      return error("Target is outside attack range.", {
        range,
        distance: distance(e, this.s.player),
      });
    return { success: true, enemy: e };
  }
  outgoingDamage(base, enemy) {
    let bonus = 0;
    if (enemy.kind === "orc" || enemy.id === "orc-1") bonus += 10;
    if (enemy.kind === "slime") bonus += 8;
    if (enemy.kind === "boss") bonus += 15;
    return base + bonus;
  }
  damageEnemy(e, damage, kind) {
    const actual = Math.min(e.hp, damage);
    e.hp = Math.max(0, e.hp - damage);
    this.s.selectedTile = pos(e);
    this.effect(e, `−${actual}`, kind);
    this.event(
      "System",
      kind,
      `${e.name} −${actual} HP${e.hp === 0 ? " · defeated" : ""}.`,
    );
    if (e.hp === 0) this.s.enemiesDefeatedTotal += 1;
    return actual;
  }
  attack(enemyId) {
    const fail = this.guard();
    if (fail) return fail;
    const check = this.validateTarget(enemyId, this.s.player.attackRange);
    if (!check.success) return check;
    const damage = this.damageEnemy(check.enemy, this.s.player.attack, "basic_attack");
    this.spend();
    return {
      success: true,
      enemyId,
      damage,
      remainingEnemyHP: check.enemy.hp,
      enemyDefeated: check.enemy.hp === 0,
      remainingAP: this.s.actionPoints,
    };
  }
  useSkill(args) {
    const fail = this.guard();
    if (fail) return fail;
    const d = SKILL_DATA[args.skill];
    const p = this.s.player;
    if (!d) return error("Unknown skill.", { validSkills: Object.keys(SKILL_DATA) });
    if (this.cooldown(args.skill) > 0)
      return error(`${d.name} is on cooldown.`, { remainingTurns: this.cooldown(args.skill) });
    if (p.mana < d.manaCost)
      return error("Not enough mana.", { required: d.manaCost, available: p.mana });
    let check;
    if (args.skill === "arcane_shot") {
      check = this.validateTarget(args.enemyId, d.range);
      if (!check.success) return check;
    }
    if (args.skill === "dash") {
      check = this.validateMove(args.x, args.y, d.range);
      if (!check.success) return check;
    }
    if (args.skill === "heal" && p.hp === p.maxHp) return error("Aria is already at full health.");
    if (args.skill === "barrier" && p.barrier) return error("Barrier is already active.");
    p.mana -= d.manaCost;
    p.cooldowns[args.skill] = this.s.turn + d.cooldown;
    let result = { success: true, skill: args.skill };
    if (args.skill === "dash") {
      result = { ...result, ...this.moveAlong(check.path, "Dash") };
    } else {
      if (args.skill === "arcane_shot") {
        const damage = this.damageEnemy(
          check.enemy,
          this.outgoingDamage(30, check.enemy),
          "arcane_shot",
        );
        Object.assign(result, {
          enemyId: check.enemy.id,
          damage,
          remainingEnemyHP: check.enemy.hp,
          enemyDefeated: check.enemy.hp === 0,
        });
      }
      if (args.skill === "heal") {
        const before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + 30);
        Object.assign(result, { before, after: p.hp, restored: p.hp - before });
        this.effect(p, `+${p.hp - before}`, "heal");
        this.event("System", "heal", `Aria restored ${p.hp - before} HP.`);
      }
      if (args.skill === "barrier") {
        p.barrier = { expires: this.s.turn + 1 };
        this.effect(p, "BARRIER", "barrier");
        this.event(
          "System",
          "barrier",
          "Barrier raised: next incoming attack is reduced by 50%.",
        );
      }
      this.spend();
    }
    return {
      ...result,
      remainingMana: p.mana,
      remainingAP: this.s.actionPoints,
      remainingCooldown: this.cooldown(args.skill),
    };
  }
  inspectItem(itemId) {
    const world = this.s.items.find((i) => i.id === itemId);
    const definition = ITEM_DATA[world?.type || itemId];
    if (!definition)
      return error("Unknown item ID.", {
        validItemTypes: Object.keys(ITEM_DATA),
        worldItemIds: this.s.items.map((i) => i.id),
      });
    if (definition.id === "ancient_crystal") this.s.crystalFound = true;
    return {
      success: true,
      ...copy(definition),
      quantity: this.s.inventory[definition.id],
      ...(world ? { worldItemId: world.id, position: pos(world) } : {}),
    };
  }
  pickup(itemId) {
    const fail = this.guard();
    if (fail) return fail;
    const index = this.s.items.findIndex((i) => i.id === itemId);
    if (index < 0)
      return error("That item is not on the map.", {
        visibleItemIds: this.s.items.map((i) => i.id),
      });
    const item = this.s.items[index];
    if (distance(item, this.s.player) > 1)
      return error("Stand on or orthogonally adjacent to the item before picking it up.");
    this.s.inventory[item.type]++;
    this.s.items.splice(index, 1);
    if (item.type === "ancient_crystal") {
      this.s.crystalFound = true;
      this.s.exitUnlocked = true;
    }
    this.effect(item, "COLLECTED", "pickup");
    this.event("System", "item_collected", `Aria collected ${ITEM_DATA[item.type].name}.`);
    this.spend();
    return {
      success: true,
      itemId,
      itemType: item.type,
      quantity: this.s.inventory[item.type],
      remainingAP: this.s.actionPoints,
      mission: this.progress(),
    };
  }
  useItem(itemId) {
    const fail = this.guard();
    if (fail) return fail;
    const d = ITEM_DATA[itemId];
    if (!d) return error("Unknown inventory item type.");
    if (!d.consumable) return error("The Ancient Crystal is an objective item, not a consumable.");
    if (this.s.inventory[itemId] <= 0) return error(`${d.name} is not in inventory.`);
    const max = d.resource === "hp" ? this.s.player.maxHp : this.s.player.maxMana;
    if (this.s.player[d.resource] >= max)
      return error(`${d.resource === "hp" ? "Health" : "Mana"} is already full.`);
    const before = this.s.player[d.resource];
    this.s.player[d.resource] = Math.min(max, before + d.restore);
    this.s.inventory[itemId]--;
    const after = this.s.player[d.resource];
    this.effect(this.s.player, `+${after - before} ${d.resource.toUpperCase()}`, "item");
    this.event(
      "System",
      "item_used",
      `Aria used ${d.name}: ${before} → ${after} ${d.resource}.`,
    );
    this.spend();
    return {
      success: true,
      itemId,
      before,
      after,
      remainingQuantity: this.s.inventory[itemId],
      remainingAP: this.s.actionPoints,
    };
  }
  hurtPlayer(raw, attacker, trap = false) {
    const p = this.s.player;
    let damage = trap ? raw : Math.max(1, raw - p.defense);
    if (!trap && p.barrier) {
      damage = Math.ceil(damage * 0.5);
      p.barrier = null;
    }
    damage = Math.min(p.hp, damage);
    p.hp = Math.max(0, p.hp - damage);
    this.effect(p, `−${damage}`, trap ? "trap" : "enemy_attack");
    this.event(
      trap ? "System" : "Enemy",
      trap ? "trap_damage" : "enemy_attack",
      `${attacker} hit Aria for ${damage}. HP ${p.hp}/${p.maxHp}.`,
    );
    if (p.hp === 0) {
      this.s.defeated = true;
      this.s.phase = "defeated";
      this.s.actionPoints = 0;
      this.persistRun(false);
      this.event("System", "defeat", "Aria was defeated. Restart the dungeon to try again.");
    }
    return damage;
  }
  enemyStep(id) {
    if (this.s.phase !== "enemy" || this.s.defeated) return;
    const e = this.aliveEnemy(id);
    if (!e) return;
    const p = this.s.player;
    const d = distance(e, p);
    if (e.kind === "slime" && e.hp < e.maxHp) {
      e.hp = Math.min(e.maxHp, e.hp + 4);
      this.event("Enemy", "regen", `${e.name} regenerated to ${e.hp} HP.`);
    }
    const crystalGuard = e.kind === "orc" || e.kind === "boss" || e.id === "orc-1";
    const activated =
      e.kind === "boss" ||
      (crystalGuard
        ? distance(p, this.s.crystal) <= 3 || d <= 1
        : d <= 5);
    if (!activated) {
      this.event("Enemy", "guard", `${e.name} holds position.`);
      return;
    }
    if ((e.kind === "skeleton" || e.id === "skeleton-1") && d <= 1) {
      const retreats = MapEngine.neighbors(e)
        .filter(
          (t) =>
            MapEngine.walkable(this, t.x, t.y) &&
            !same(t, p) &&
            !this.s.enemies.some(
              (other) => other.hp > 0 && other.id !== e.id && same(other, t),
            ),
        )
        .sort((a, b) => distance(b, p) - distance(a, p) || a.y - b.y || a.x - b.x);
      if (retreats[0] && distance(retreats[0], p) > d) {
        Object.assign(e, retreats[0]);
        this.effect(e, "RETREAT", "enemy_move");
        this.event("Enemy", "enemy_move", `${e.name} retreated to (${e.x},${e.y}).`);
        return;
      }
    }
    if (d <= e.attackRange) {
      let raw = e.attack;
      if (e.attackRange > 1) {
        const cover = coverBonus(this.s.mapRows, p.x, p.y);
        if (cover > 0) raw = Math.ceil(raw * (1 - cover));
      }
      this.hurtPlayer(raw, e.name);
      return;
    }
    const paths = MapEngine.paths(this, e, 64, e.id);
    const candidates = [...paths.values()]
      .filter((path) => distance(path[path.length - 1], p) <= e.attackRange)
      .sort(
        (a, b) =>
          a.length - b.length ||
          distance(a[a.length - 1], p) - distance(b[b.length - 1], p) ||
          a[a.length - 1].y - b[b.length - 1].y ||
          a[a.length - 1].x - b[b.length - 1].x,
      );
    if (candidates.length) {
      const path = candidates[0];
      const destination = path[Math.min(e.moveRange, path.length) - 1];
      Object.assign(e, destination);
      this.effect(e, "", "enemy_move");
      this.event("Enemy", "enemy_move", `${e.name} moved to (${e.x},${e.y}).`);
    } else this.event("Enemy", "guard", `${e.name} has no clear approach.`);
  }
  finishEnemyPhase() {
    if (this.s.defeated) return;
    if (this.s.phase !== "enemy") return;
    if (this.s.player.barrier && this.s.turn >= this.s.player.barrier.expires) {
      this.s.player.barrier = null;
      this.event("System", "barrier_expired", "Barrier expired.");
    }
    this.s.turn++;
    this.s.actionPoints = DEFAULT_AP;
    this.s.phase = "player";
    this.event("System", "player_turn", `Turn ${this.s.turn}: Aria has ${DEFAULT_AP} AP.`);
  }
  resolveEnemies() {
    for (const e of this.s.enemies) this.enemyStep(e.id);
    this.finishEnemyPhase();
  }
  endTurn() {
    const fail = this.guard();
    if (fail) return fail;
    this.s.actionPoints = 0;
    this.s.phase = "enemy";
    return { success: true, message: "Player turn ended; resolving enemy actions." };
  }
  progress() {
    const has = !!this.s.inventory.ancient_crystal;
    const reached = same(this.s.player, this.s.exit);
    const blockers = [];
    if (!has) blockers.push("The Ancient Crystal is still inside the dungeon.");
    if (!reached)
      blockers.push(
        `Aria must stand on the exit at (${this.s.exit.x},${this.s.exit.y}).`,
      );
    if (this.s.defeated) blockers.push("Aria is defeated.");
    return {
      objective: this.s.objective,
      foundAncientCrystal: this.s.crystalFound,
      hasAncientCrystal: has,
      hasCrystal: has,
      exitPosition: copy(this.s.exit),
      exitReached: reached,
      alive: this.s.player.hp > 0,
      canEscape: has && reached && !this.s.defeated,
      completed: this.s.runVictory || this.s.victory,
      floor: this.s.floorIndex + 1,
      floorCount: this.s.floorCount,
      floorsCleared: this.s.floorsCleared,
      awaitingReward: this.s.awaitingReward,
      blockers,
    };
  }
  persistRun(win) {
    if (this.s.recorded) return;
    const result = recordRun(this.meta, {
      mode: this.s.mode,
      floorReached: win ? this.s.floorsCleared : this.s.floorIndex + 1,
      win,
      turns: this.s.turn,
      dateKey: this.s.dateKey,
    });
    this.meta = result.meta;
    this.s.recorded = true;
    saveMeta(this.meta);
  }
  leave(source) {
    const fail = this.guard();
    if (fail) return fail;
    if (!this.s.inventory.ancient_crystal)
      return error("You cannot leave yet. The Ancient Crystal is still inside the dungeon.");
    if (!same(this.s.player, this.s.exit))
      return error(
        `Aria must stand on the exit portal at (${this.s.exit.x},${this.s.exit.y}) before leaving.`,
      );

    this.s.floorCleared = true;
    this.s.floorsCleared += 1;
    this.s.objectiveCompleted = true;
    this.s.victorySource = source;
    this.effect(this.s.player, "CLEARED", "victory");

    const isFinal = this.s.floorIndex + 1 >= this.s.floorCount;
    if (isFinal) {
      this.s.victory = true;
      this.s.runVictory = true;
      this.s.phase = "victory";
      this.s.actionPoints = 0;
      this.persistRun(true);
      this.event(
        "System",
        "objective_completed",
        this.s.floorCount === 1
          ? "Ancient Crystal recovered. Dungeon cleared."
          : `All ${this.s.floorCount} floors cleared. Expedition complete.`,
      );
      return {
        success: true,
        victory: true,
        runComplete: true,
        turns: this.s.turn,
        floorsCleared: this.s.floorsCleared,
        enemiesDefeated: this.s.enemiesDefeatedTotal,
        hpRemaining: this.s.player.hp,
        score: scoreRun({
          floorsCleared: this.s.floorsCleared,
          turns: this.s.turn,
          hpRemaining: this.s.player.hp,
          enemiesDefeated: this.s.enemiesDefeatedTotal,
        }),
      };
    }

    this.s.awaitingReward = true;
    this.s.phase = "reward";
    this.s.actionPoints = 0;
    this.s.rewardOptions = rewardChoices(this.s.seed, this.s.floorIndex);
    this.event(
      "System",
      "floor_cleared",
      `Floor ${this.s.floorIndex + 1} cleared. Choose one reward before descending.`,
    );
    return {
      success: true,
      victory: false,
      floorCleared: true,
      runComplete: false,
      awaitingReward: true,
      rewardOptions: copy(this.s.rewardOptions),
      nextFloor: this.s.floorIndex + 2,
      turns: this.s.turn,
      floorsCleared: this.s.floorsCleared,
      enemiesDefeated: this.s.enemies.filter((e) => e.hp === 0).length,
      hpRemaining: this.s.player.hp,
    };
  }
  chooseReward(rewardId) {
    if (this.s.defeated) return error("Aria has been defeated. Restart the dungeon.");
    if (this.s.runVictory) return error("The dungeon is already cleared.");
    if (!this.s.awaitingReward)
      return error("No reward is pending. Clear a floor exit first.");
    if (!this.s.rewardOptions.some((r) => r.id === rewardId))
      return error("That reward is not one of the three offered choices.", {
        rewardOptions: copy(this.s.rewardOptions),
      });
    const applied = applyRewardToPlayer(this.s.player, rewardId);
    if (!applied.success) return applied;
    this.s.player = applied.player;
    this.s.awaitingReward = false;
    this.s.rewardOptions = [];
    this.event("System", "reward_chosen", `Aria claimed ${applied.reward.name}.`);
    return this.descend();
  }
  descend() {
    if (this.s.awaitingReward)
      return error("Choose a reward with dungeon_choose_reward before descending.");
    if (this.s.floorIndex + 1 >= this.s.floorCount)
      return error("Already on the final floor.");
    if (!this.s.floorCleared && this.s.phase !== "reward")
      return error("Clear the current floor exit before descending.");

    const nextIndex = this.s.floorIndex + 1;
    const floor = generateFloor(this.s.seed, nextIndex, {
      mode: this.s.mode,
      floorCount: this.s.floorCount,
    });
    const carriedLog = copy(this.s.activityLog);
    this.s = this.buildStateFromFloor({
      mode: this.s.mode,
      seed: this.s.seed,
      floorCount: this.s.floorCount,
      floorIndex: nextIndex,
      floor,
      player: this.s.player,
      inventory: this.s.inventory,
      runTurn: this.s.turn,
      floorsCleared: this.s.floorsCleared,
      enemiesDefeatedTotal: this.s.enemiesDefeatedTotal,
      awaitingReward: false,
      rewardOptions: [],
      runVictory: false,
      recorded: this.s.recorded,
    });
    this.s.activityLog = carriedLog;
    this.event(
      "System",
      "descend",
      `Aria descends to floor ${nextIndex + 1}: ${floor.name}${floor.isBoss ? " · BOSS" : ""}.`,
    );
    return {
      success: true,
      floor: nextIndex + 1,
      floorCount: this.s.floorCount,
      floorName: floor.name,
      isBossFloor: !!floor.isBoss,
      player: this.playerState(),
      run: this.runSummary(),
    };
  }
  startRun(args = {}) {
    const mode = getMode(args.mode || "tutorial").id;
    let seed = args.seed;
    if (mode === "daily") seed = String(dailySeed());
    else if (mode === "tutorial") seed = TUTORIAL_SEED;
    else if (seed == null || String(seed).trim() === "")
      seed = resolveRunSeed("campaign", `campaign-${Date.now()}`);
    else seed = String(seed).trim().slice(0, 64);
    this.meta.lastMode = mode;
    saveMeta(this.meta);
    return this.reset({ mode, seed });
  }

  invoke(name, a = {}, source = "UI") {
    switch (name) {
      case "game_get_state":
        return this.state();
      case "game_get_objective": {
        const p = this.progress();
        return {
          objective: p.objective,
          hasCrystal: p.hasCrystal,
          exitReached: p.exitReached,
          completed: p.completed,
          floor: p.floor,
          floorCount: p.floorCount,
          awaitingReward: p.awaitingReward,
        };
      }
      case "map_inspect":
        this.s.crystalFound = true;
        return this.mapState();
      case "tile_inspect": {
        const t = this.tile(a.x, a.y);
        if (t.success === false) return t;
        this.s.selectedTile = { x: a.x, y: a.y };
        if (t.item?.type === "ancient_crystal") this.s.crystalFound = true;
        return t;
      }
      case "player_get_state":
        return this.playerState();
      case "player_get_available_actions":
        return this.available();
      case "player_move":
        return this.move(a.x, a.y);
      case "enemy_list":
        return { enemies: this.visibleEnemies() };
      case "enemy_inspect": {
        const e = this.enemy(a.enemyId);
        if (!e) return error("Unknown enemy ID.", { enemyIds: this.s.enemies.map((en) => en.id) });
        e.inspected = true;
        this.s.selectedTile = pos(e);
        this.effect(e, "INSPECTED", "inspect");
        return { success: true, ...this.publicEnemy(e) };
      }
      case "player_attack":
        return this.attack(a.enemyId);
      case "player_use_skill":
        return this.useSkill(a);
      case "player_get_skills":
        return { skills: this.skills() };
      case "inventory_get":
        return { inventory: this.inventory() };
      case "item_inspect":
        return this.inspectItem(a.itemId);
      case "player_pickup":
        return this.pickup(a.itemId);
      case "player_use_item":
        return this.useItem(a.itemId);
      case "game_end_turn":
        return this.endTurn();
      case "game_get_recent_events":
        return { events: copy(this.s.activityLog.slice(-(a.limit ?? 10))) };
      case "mission_get_progress":
        return this.progress();
      case "exit_try_leave":
        return this.leave(source);
      case "game_reset":
        return this.reset({ mode: this.s.mode, seed: this.s.seed });
      case "dungeon_get_run":
        return this.runSummary();
      case "dungeon_start_run":
        return this.startRun(a);
      case "dungeon_choose_reward":
        return this.chooseReward(a.rewardId);
      case "dungeon_get_rewards":
        return {
          awaitingReward: this.s.awaitingReward,
          rewardOptions: copy(this.s.rewardOptions),
        };
      case "dungeon_get_records":
        return this.publicMeta();
      case "dungeon_get_daily":
        return {
          dateKey: localDateKey(),
          seed: String(dailySeed()),
          bestTurnsToday: this.meta.dailyBestTurns,
          lastDailyKey: this.meta.lastDailyKey,
        };
      case "game_get_available_options":
        return {
          coordinateBounds: { x: { min: 0, max: 7 }, y: { min: 0, max: 7 } },
          skillNames: Object.keys(SKILL_DATA),
          modes: MODE_ORDER,
          enemyIds: this.s.enemies.map((e) => ({
            enemyId: e.id,
            name: e.name,
            alive: e.hp > 0,
          })),
          visibleItemIds: this.s.items.map((i) => ({
            itemId: i.id,
            type: i.type,
            name: ITEM_DATA[i.type].name,
          })),
          inventoryItemTypes: Object.keys(ITEM_DATA),
          supportedActions: TOOLS.map((t) => t.name),
          rewardIds: this.s.rewardOptions.map((r) => r.id),
          run: this.runSummary(),
          rules: {
            movementAP: 1,
            attackAP: 1,
            skillAP: 1,
            pickupAP: 1,
            itemAP: 1,
            exitAP: 0,
            inspectionAP: 0,
            pickupDistance: 1,
            exitDistance: 0,
            attackMetric: "Manhattan; cover halves ranged hits",
            automaticEnemyPhaseAtZeroAP: true,
            floors: this.s.floorCount,
            storageKey: STORAGE_KEY,
          },
        };
      default:
        return error("Unknown capability.");
    }
  }
}

const coordinateProperties = {
  x: {
    type: "integer",
    minimum: 0,
    maximum: 7,
    description: "Column coordinate, from 0 at the left to 7 at the right.",
  },
  y: {
    type: "integer",
    minimum: 0,
    maximum: 7,
    description: "Row coordinate, from 0 at the top to 7 at the bottom.",
  },
};
const enemyProperty = {
  enemyId: {
    type: "string",
    minLength: 1,
    description: "Stable enemy ID obtained from enemy_list or map_inspect.",
  },
};
const worldItemProperty = {
  itemId: {
    type: "string",
    minLength: 1,
    description:
      "World item instance ID from map_inspect or available actions, e.g. health-potion-1 or ancient-crystal.",
  },
};
const schema = (properties = {}, required = []) => ({
  type: "object",
  properties,
  required,
  additionalProperties: false,
});
const define = (name, read, description, inputSchema = schema(), example = {}) => ({
  name,
  description,
  inputSchema,
  example,
  annotations: {
    readOnlyHint: read,
    consequentialHint: !read,
    untrustedContentHint: false,
  },
});
const skillSchema = schema(
  {
    skill: {
      type: "string",
      enum: Object.keys(SKILL_DATA),
      description:
        "Ability to use. Arcane Shot requires enemyId; Dash requires x and y; Heal and Barrier target Aria.",
    },
    ...enemyProperty,
    ...coordinateProperties,
  },
  ["skill"],
);
skillSchema.oneOf = [
  { properties: { skill: { const: "arcane_shot" } }, required: ["enemyId"] },
  { properties: { skill: { const: "dash" } }, required: ["x", "y"] },
  { properties: { skill: { enum: ["heal", "barrier"] } } },
];

export const TOOLS = [
  define(
    "game_get_state",
    true,
    "Get the current shared tactical state: hero statistics and position, AP, phase, floor progress, visible map objects, inventory, objective progress, victory, defeat, and recent events. Uninspected enemies reveal only identity and position; use enemy_inspect for detailed combat information.",
  ),
  define(
    "game_get_objective",
    true,
    "Get the mission, its completion requirements, and current progress: possession of the Ancient Crystal, whether Aria is standing on the exit, floor index, and whether the run has been cleared.",
  ),
  define(
    "map_inspect",
    true,
    "Inspect all 64 visible dungeon tiles, hero position, enemies, ground items, spike hazards, blocking terrain, cover tiles, exit, and currently reachable movement paths with hazard damage. Records that the visible crystal has been found; does not reveal uninspected enemy statistics.",
  ),
  define(
    "tile_inspect",
    true,
    "Inspect one coordinate to learn its terrain (including cover), occupant, ground item, hazard, walkability, and exit status. Free observation; does not move Aria or reveal an enemy's hidden combat stats.",
    schema(coordinateProperties, ["x", "y"]),
    { x: 6, y: 5 },
  ),
  define(
    "player_get_state",
    true,
    "Get Aria's current HP, mana, combat statistics, gear, position, AP, phase, Barrier status, remaining skill cooldowns, and inventory quantities.",
  ),
  define(
    "player_get_available_actions",
    true,
    "Get legal actions now, without guessing: reachable tiles and exact paths, trap damage along each path, basic-attack target IDs, usable skills with valid targets or destinations, nearby pickups, usable inventory items, end-turn availability, escape eligibility, and pending reward options.",
  ),
  define(
    "player_move",
    false,
    "Move Aria to a reachable tile during the player turn. Use map_inspect or player_get_available_actions first. Costs 1 AP and follows a deterministic orthogonal path of at most the hero move range; walls, pillars, rubble, and enemies block movement. Cover is walkable. Crossing a spike trap deals damage. If AP reaches zero, all enemy actions resolve before this tool returns.",
    schema(coordinateProperties, ["x", "y"]),
    { x: 3, y: 1 },
  ),
  define(
    "enemy_list",
    true,
    "List all living visible enemies with stable IDs, names, kinds, positions, and inspection status. Exact HP and tactical statistics are returned only for enemies previously inspected.",
  ),
  define(
    "enemy_inspect",
    true,
    "Inspect a visible enemy by ID to reveal its exact HP, attack, attack range, movement range, deterministic behavior, and weakness. Costs no AP and reveals the same information in the human target panel.",
    schema(enemyProperty, ["enemyId"]),
    { enemyId: "orc-1" },
  ),
  define(
    "player_attack",
    false,
    "Perform Aria's basic attack on a living enemy within Manhattan attack range. Deals attack damage, costs 1 AP and no mana. Validates phase, AP, target, and range before making any changes; resolves an automatic enemy phase if this spends the last AP.",
    schema(enemyProperty, ["enemyId"]),
    { enemyId: "goblin-1" },
  ),
  define(
    "player_use_skill",
    false,
    "Use one tactical skill for 1 AP. arcane_shot: enemyId required, range 4, 30 damage (+bonus vs Orc/Slime/Boss), 15 mana, cooldown 2. dash: x/y required, up to 4 walkable steps, 10 mana. heal: restore 30 HP, 20 mana, cooldown 3. barrier: halve the next incoming attack, 15 mana. Invalid actions consume no AP or mana.",
    skillSchema,
    { skill: "arcane_shot", enemyId: "orc-1" },
  ),
  define(
    "player_get_skills",
    true,
    "Get all hero abilities with effect, AP and mana cost, cooldown, remaining cooldown, target type, range, current availability, unavailability reason, and valid target IDs or reachable destinations.",
  ),
  define(
    "inventory_get",
    true,
    "Get inventory item type IDs, names, quantities, descriptions, and whether each item is consumable. Use inventory type IDs, not ground instance IDs, with player_use_item.",
  ),
  define(
    "item_inspect",
    true,
    "Inspect an inventory item type or visible ground-item instance to learn its effect, quantity, and position when on the map. Free observation. Inspecting the crystal records that it has been found.",
    schema(
      {
        itemId: {
          type: "string",
          minLength: 1,
          description:
            "Inventory type such as health_potion, mana_potion, ancient_crystal, or a visible world instance ID.",
        },
      },
      ["itemId"],
    ),
    { itemId: "health_potion" },
  ),
  define(
    "player_pickup",
    false,
    "Collect a specific ground-item instance on Aria's tile or one orthogonal tile away. Costs 1 AP. Use a visible world ID such as health-potion-1, mana-potion-1, or ancient-crystal. Picking up the crystal unlocks the exit but does not win the floor.",
    schema(worldItemProperty, ["itemId"]),
    { itemId: "health-potion-1" },
  ),
  define(
    "player_use_item",
    false,
    "Consume an inventory potion for 1 AP: health_potion restores 35 HP; mana_potion restores 25 mana, capped at the hero maximum. Requires a positive inventory quantity and a resource below its maximum. The Ancient Crystal cannot be consumed.",
    schema(
      {
        itemId: {
          type: "string",
          enum: ["health_potion", "mana_potion"],
          description: "Consumable inventory type ID, not its ground instance ID.",
        },
      },
      ["itemId"],
    ),
    { itemId: "health_potion" },
  ),
  define(
    "game_end_turn",
    false,
    "End the current player turn, discarding remaining AP. Resolve each living enemy's deterministic move or attack, incoming damage, Barrier expiry, cooldown progression, and the next player turn before returning a concise event summary. Each enemy either moves or attacks, never both.",
  ),
  define(
    "game_get_recent_events",
    true,
    "Get the most recent observable combat, inspection, movement, item, and dungeon events, including source and timestamp. Returns at most 50 entries.",
    schema({
      limit: {
        type: "integer",
        minimum: 1,
        maximum: 50,
        default: 10,
        description: "Number of recent events to return, between 1 and 50.",
      },
    }),
    { limit: 10 },
  ),
  define(
    "mission_get_progress",
    true,
    "Get crystal discovery and collection progress, hero survival, exit position, whether Aria is on the portal, escape eligibility, floor progress, pending rewards, completion status, and explicit blockers preventing victory.",
  ),
  define(
    "exit_try_leave",
    false,
    "Attempt to leave through the floor portal. Aria must be alive, in the player phase, carrying the Ancient Crystal, and standing exactly on the exit. Costs no AP. On non-final floors this clears the floor and offers three rewards; on the final floor (or tutorial) it completes the run.",
  ),
  define(
    "game_reset",
    false,
    "Restart the current run mode and seed from floor 1. Discards in-run progress. Meta records in localStorage are preserved.",
  ),
  define(
    "game_get_available_options",
    true,
    "Get valid skill enums, modes, known enemy IDs, visible ground-item IDs, inventory type IDs, supported capability names, coordinate bounds, action costs, pickup distance, exit rules, floor info, and attack metric so an agent does not need to guess tool arguments.",
  ),
  define(
    "dungeon_get_run",
    true,
    "Get multi-floor run status: mode, seed, current floor, floor count, boss flag, floors cleared, pending rewards, victory/defeat, and best-record summary.",
  ),
  define(
    "dungeon_start_run",
    false,
    "Start a new run. mode=tutorial uses the fixed original map (1 floor). mode=campaign starts a 6-floor seeded expedition (optional seed string). mode=daily uses today's date seed. Resets Aria to full resources for a fresh expedition.",
    schema(
      {
        mode: {
          type: "string",
          enum: MODE_ORDER,
          description: "tutorial | campaign | daily",
        },
        seed: {
          type: "string",
          minLength: 1,
          maxLength: 64,
          description: "Optional campaign seed. Ignored for tutorial/daily.",
        },
      },
      ["mode"],
    ),
    { mode: "campaign", seed: "demo-seed" },
  ),
  define(
    "dungeon_get_rewards",
    true,
    "Get whether a post-floor reward choice is pending and the three offered reward IDs with names and descriptions.",
  ),
  define(
    "dungeon_choose_reward",
    false,
    "Choose one of the three offered floor-clear rewards by rewardId. Applies the permanent-for-run upgrade, then automatically descends to the next floor.",
    schema(
      {
        rewardId: {
          type: "string",
          minLength: 1,
          description: "One of the three IDs from dungeon_get_rewards / exit_try_leave.",
        },
      },
      ["rewardId"],
    ),
    { rewardId: "iron_charm" },
  ),
  define(
    "dungeon_get_records",
    true,
    "Get persisted best floors, best clear turns, and clear counts from localStorage (astra-tactical-dungeon:v1).",
  ),
  define(
    "dungeon_get_daily",
    true,
    "Get today's daily dungeon date key, seed, and today's best clear turns if any.",
  ),
];

export const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

export function validateArgs(tool, args) {
  if (!args || typeof args !== "object" || Array.isArray(args))
    return error("Arguments must be a JSON object.");
  const s = tool.inputSchema;
  for (const required of s.required) if (!(required in args)) return error(`Missing required argument: ${required}.`);
  for (const [name, value] of Object.entries(args)) {
    const p = s.properties[name];
    if (!p) return error(`Unexpected argument: ${name}.`);
    if (p.type === "integer" && !Number.isInteger(value)) return error(`${name} must be an integer.`);
    if (p.type === "string" && typeof value !== "string") return error(`${name} must be a string.`);
    if (
      (p.minimum !== undefined && value < p.minimum) ||
      (p.maximum !== undefined && value > p.maximum)
    )
      return error(`${name} must be between ${p.minimum} and ${p.maximum}.`);
    if (p.minLength && value.length < p.minLength) return error(`${name} cannot be empty.`);
    if (p.maxLength && value.length > p.maxLength) return error(`${name} is too long.`);
    if (p.enum && !p.enum.includes(value)) return error(`Invalid ${name}.`, { validValues: p.enum });
  }
  if (tool.name === "player_use_skill") {
    if (args.skill === "arcane_shot" && !args.enemyId) return error("Arcane Shot requires enemyId.");
    if (args.skill === "dash" && (!("x" in args) || !("y" in args)))
      return error("Dash requires x and y.");
    const allowed =
      args.skill === "arcane_shot"
        ? ["skill", "enemyId"]
        : args.skill === "dash"
          ? ["skill", "x", "y"]
          : ["skill"];
    if (Object.keys(args).some((k) => !allowed.includes(k)))
      return error(`Unexpected target arguments for ${args.skill}.`);
  }
  return null;
}

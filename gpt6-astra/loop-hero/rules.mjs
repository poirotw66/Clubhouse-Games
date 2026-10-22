/**
 * Pure rules for Cinder Circuit (Astra · Loop Hero).
 * Keep DOM-free so self-check.mjs / check scripts can import in Node.
 */

export const SAVE_KEY = "cinder-circuit-refuge-v4";
export const SAVE_KEY_LEGACY_V3 = "cinder-circuit-refuge-v3";
export const SAVE_KEY_LEGACY_V2 = "cinder-circuit-refuge-v2";
export const SAVE_KEY_LEGACY_V1 = "cinder-circuit-refuge-v1";
export const DAILY_SAVE_KEY = "cinder-circuit-daily-v1";

export const COLS = 11;
export const ROWS = 9;

/** @typedef {"wood"|"stone"|"dust"|"iron"} ResourceKey */
/** @typedef {Record<ResourceKey, number>} Bank */

export const RESOURCE_KEYS = /** @type {const} */ (["wood", "stone", "dust", "iron"]);

export function emptyResources() {
  return { wood: 0, stone: 0, dust: 0, iron: 0 };
}

/**
 * Expedition tiers. `cardsNeeded` is the intended placements to awaken the
 * keeper at the listed `bossGain` (cardsNeeded × bossGain ≈ 100).
 */
export const EXPEDITIONS = {
  ember: {
    id: "ember",
    tier: "EMBER",
    name: "Ember Scout",
    blurb: "Gentle roads. Learn the loop.",
    goalLabel: "Survive 3 circuits, then return",
    goalKind: "circuits",
    goalTarget: 3,
    enemyScale: 0.85,
    bossGain: 4,
    spawnBonus: -1,
    rewardMult: 1,
    cardsNeeded: 25,
  },
  wick: {
    id: "wick",
    tier: "WICK",
    name: "Wick Expedition",
    blurb: "The road as it remembers.",
    goalLabel: "Defeat the route keeper",
    goalKind: "boss",
    goalTarget: 1,
    enemyScale: 1,
    bossGain: 5,
    spawnBonus: 0,
    rewardMult: 1.1,
    cardsNeeded: 20,
  },
  ash: {
    id: "ash",
    tier: "ASH",
    name: "Ash Trial",
    blurb: "Harsh fog. Faster awakening.",
    goalLabel: "Defeat the keeper by circuit 5",
    goalKind: "boss_by_circuit",
    goalTarget: 5,
    enemyScale: 1.28,
    bossGain: 7,
    spawnBonus: 1,
    rewardMult: 1.35,
    cardsNeeded: 15,
  },
};

/**
 * Map routes. Seal sits at road index 10; camp at index 0.
 * `bossId` selects which keeper awakenBoss spawns.
 * Optional `exclusiveEnemies` / `exclusiveCards` deepen a route's identity.
 */
export const ROUTES = {
  drowned: {
    id: "drowned",
    name: "Drowned Verge",
    blurb: "The familiar circuit. The Ninth Bell waits at the southeast seal.",
    unlockAfter: null,
    bossId: "boss",
    sealLabel: "SOUTHEAST",
    path: [
      [3, 1],
      [4, 1],
      [5, 1],
      [6, 1],
      [7, 1],
      [8, 2],
      [9, 3],
      [9, 4],
      [9, 5],
      [8, 6],
      [7, 7],
      [6, 7],
      [5, 7],
      [4, 7],
      [3, 7],
      [2, 6],
      [1, 5],
      [1, 4],
      [1, 3],
      [2, 2],
    ],
  },
  ashen: {
    id: "ashen",
    name: "Ashen Coil",
    blurb: "A tighter spiral. The Hollow Peal answers from the western seal.",
    unlockAfter: "drowned",
    bossId: "boss_hollow",
    sealLabel: "WEST",
    path: [
      [2, 1],
      [3, 1],
      [4, 1],
      [5, 2],
      [6, 2],
      [7, 3],
      [8, 4],
      [8, 5],
      [7, 6],
      [6, 7],
      [5, 7],
      [4, 6],
      [3, 5],
      [2, 4],
      [1, 3],
      [1, 2],
      [2, 2],
      [3, 3],
      [4, 3],
      [3, 2],
    ],
  },
  glassmere: {
    id: "glassmere",
    name: "Glassmere Rill",
    blurb: "A bright cold circuit. The Stillglass Knell listens at the southern seal.",
    unlockAfter: "ashen",
    unlockRequiresRoutes: ["drowned", "ashen"],
    bossId: "boss_glass",
    sealLabel: "SOUTH",
    exclusiveEnemies: ["brine", "echo", "reedkin", "prism"],
    exclusiveCards: ["mirror", "reed", "tide", "shard"],
    path: [
      [5, 1],
      [6, 1],
      [7, 1],
      [8, 2],
      [9, 3],
      [9, 4],
      [8, 5],
      [7, 6],
      [6, 7],
      [5, 7],
      [4, 7],
      [3, 6],
      [2, 5],
      [1, 4],
      [1, 3],
      [2, 2],
      [3, 1],
      [4, 1],
      [4, 2],
      [5, 2],
    ],
  },
};

/** Chebyshev adjacency for road steps (orthogonal or diagonal). */
export function pathStepsAdjacent(path) {
  if (!path?.length) return false;
  for (let i = 0; i < path.length; i++) {
    const [ax, ay] = path[i];
    const [bx, by] = path[(i + 1) % path.length];
    if (Math.max(Math.abs(ax - bx), Math.abs(ay - by)) !== 1) return false;
  }
  return true;
}

export const ROUTE_ORDER = ["drowned", "ashen", "glassmere"];

export const BOSS_DEFS = {
  boss: {
    id: "boss",
    type: "boss",
    name: "The Ninth Bell",
    kind: "Keeper of the unending road",
    hp: 280,
    attack: 16,
    defense: 4,
    speed: 0.85,
    xp: 40,
    color: "#c4ddb5",
    awakenTitle: "THE NINTH BELL",
    awakenSub: "THE KEEPER HAS HEARD YOU",
    tollLabel: "THE NINTH TOLL",
  },
  boss_hollow: {
    id: "boss_hollow",
    type: "boss_hollow",
    name: "The Hollow Peal",
    kind: "Keeper of the ashen coil",
    hp: 310,
    attack: 15,
    defense: 5,
    speed: 0.9,
    xp: 44,
    color: "#d4b48a",
    awakenTitle: "THE HOLLOW PEAL",
    awakenSub: "THE COIL ANSWERS WITHOUT A TONGUE",
    tollLabel: "THE HOLLOW TOLL",
  },
  boss_glass: {
    id: "boss_glass",
    type: "boss_glass",
    name: "The Stillglass Knell",
    kind: "Keeper of the glassmere rill",
    hp: 340,
    attack: 17,
    defense: 6,
    speed: 0.88,
    xp: 50,
    color: "#a8d4e0",
    awakenTitle: "THE STILLGLASS KNELL",
    awakenSub: "THE RILL REFLECTS WHAT YOU AWOKE",
    tollLabel: "THE GLASS TOLL",
  },
};

/** Route-exclusive world cards (Glassmere Rill). */
export const ROUTE_CARD_DEFS = {
  mirror: {
    name: "Stillglass Pane",
    where: "road",
    short: "Heal 8% on pass.\nEcho moth each loop.",
    effect:
      "Heals 8% max HP when passed. Spawns an Echo Moth nearby each circuit, including immediately. Salvage for 1 wood.",
    color: "#9ec9d4",
    routeId: "glassmere",
    salvage: 1,
  },
  reed: {
    name: "Reedglass Copse",
    where: "verge",
    short: "+3% evasion.\nNearby foes pierce 12%.",
    effect:
      "+3% hero evasion. Adjacent enemies ignore 12% of defense. Stacks with other Reedglass Copses.",
    color: "#8fb89a",
    routeId: "glassmere",
    salvage: 1,
  },
  tide: {
    name: "Tidemoon Marker",
    where: "road",
    short: "+8% Bell on place.\nHeal 6% once / loop.",
    effect:
      "When placed, grants +8% Bell awakening. Once per circuit when passed, heals 6% max HP.",
    color: "#7aa8c4",
    routeId: "glassmere",
    bossBonus: 8,
    salvage: 1,
  },
  shard: {
    name: "Prism Shrine",
    where: "verge",
    short: "+3% critical.\nNearby foes +2 DEF.",
    effect:
      "+3% hero critical chance. Adjacent enemies gain +2 defense. A bright risk for sharper strikes.",
    color: "#c4b8e0",
    routeId: "glassmere",
    salvage: 1,
  },
};

/** In-run event cards — temporary memories granted by road events. */
export const EVENT_CARD_DEFS = {
  omen: {
    name: "Road Omen",
    where: "road",
    short: "One-shot omen.\n+12% Bell on place.",
    effect:
      "A fleeting road omen. When placed, grants +12% Bell awakening and spawns a Mossjaw nearby. Salvage for 2 wood.",
    color: "#c9b58a",
    event: true,
    bossBonus: 12,
    salvage: 2,
  },
  eclipse: {
    name: "Veil Eclipse",
    where: "verge",
    short: "Brief shade.\nAdjacent foes −10% ATK.",
    effect:
      "Adjacent enemies deal 10% less damage while this shade lasts. Grants +8% Bell awakening on place.",
    color: "#8aa0b0",
    event: true,
    bossBonus: 8,
    salvage: 1,
  },
};

export const ELITE_MODIFIERS = {
  frenzied: {
    id: "frenzied",
    label: "Frenzied",
    blurb: "Attacks 25% faster.",
    speedMul: 1.25,
    attackMul: 1,
    hpMul: 1,
    defenseAdd: 0,
  },
  plated: {
    id: "plated",
    label: "Plated",
    blurb: "+4 defense.",
    speedMul: 1,
    attackMul: 1,
    hpMul: 1.1,
    defenseAdd: 4,
  },
  virulent: {
    id: "virulent",
    label: "Virulent",
    blurb: "Attacks ignore 30% of defense.",
    speedMul: 1,
    attackMul: 1.05,
    hpMul: 1,
    defenseAdd: 0,
    pierce: 0.3,
  },
};

export const ELITE_MODIFIER_IDS = Object.keys(ELITE_MODIFIERS);

/**
 * Daily loop modifiers — one rule seeded per Asia/Taipei calendar day.
 */
export const DAILY_MODIFIERS = {
  fogbound: {
    id: "fogbound",
    label: "Fogbound Road",
    blurb: "Foes strike 18% faster; fog never fully lifts.",
    enemySpeedMul: 1.18,
    fogFloor: 8,
  },
  thin_wick: {
    id: "thin_wick",
    label: "Thin Wick",
    blurb: "Start with 15% less max HP.",
    startHpMul: 0.85,
  },
  bell_hunger: {
    id: "bell_hunger",
    label: "Bell Hunger",
    blurb: "Each placement awakens +3% extra Bell progress.",
    bossGainBonus: 3,
  },
  rich_veins: {
    id: "rich_veins",
    label: "Rich Veins",
    blurb: "Loot rarity rolls one tier higher; elites appear more often.",
    lootTierBonus: 1,
    eliteChanceBonus: 0.08,
  },
  iron_road: {
    id: "iron_road",
    label: "Iron Road",
    blurb: "All foes gain +3 defense.",
    enemyDefenseAdd: 3,
  },
  frugal_hand: {
    id: "frugal_hand",
    label: "Frugal Hand",
    blurb: "Opening hand is trimmed by two memories.",
    handTrim: 2,
  },
};

export const DAILY_MODIFIER_IDS = Object.keys(DAILY_MODIFIERS);

/**
 * Camp card craft — spend bank materials to unlock / rank up refuge buildings.
 * Ranks permanently alter runs (new cards, stronger effects, route unlocks already separate).
 */
export const CRAFT_BUILDINGS = {
  archive: {
    id: "archive",
    name: "Waystone Archive",
    desc: "Unlock Road Omen event cards on the loop.",
    max: 1,
    cost: () => ({ wood: 12, dust: 8 }),
    unlocksCard: "omen",
  },
  veilwright: {
    id: "veilwright",
    name: "Veilwright Bench",
    desc: "Unlock Veil Eclipse event cards; +1 ranks improve shade strength.",
    max: 3,
    cost: (n) => ({ dust: 10 + n * 6, stone: 8 + n * 4 }),
    unlocksCard: "eclipse",
  },
  bellfoundry: {
    id: "bellfoundry",
    name: "Bellfoundry",
    desc: "Start each run with +5% Bell progress per rank.",
    max: 3,
    cost: (n) => ({ iron: 10 + n * 7, stone: 8 + n * 5 }),
  },
  cartographer: {
    id: "cartographer",
    name: "Cartographer's Desk",
    desc: "Unlocks the Ashen Coil route permanently.",
    max: 1,
    cost: () => ({ wood: 14, stone: 12, dust: 10 }),
    unlocksRoute: "ashen",
  },
};

export function emptyBuildings() {
  return { archive: 0, veilwright: 0, bellfoundry: 0, cartographer: 0 };
}

export function emptyCleared() {
  return { ember: 0, wick: 0, ash: 0 };
}

export function emptyRouteClears() {
  return { drowned: 0, ashen: 0, glassmere: 0 };
}

export function emptyUpgrades() {
  return { vitality: 0, forge: 0, draught: 0, dial: 0 };
}

export function getExpedition(id) {
  return EXPEDITIONS[id] || EXPEDITIONS.wick;
}

export function getRoute(id) {
  return ROUTES[id] || ROUTES.drowned;
}

export function getBossDef(bossId) {
  return BOSS_DEFS[bossId] || BOSS_DEFS.boss;
}

export function getDailyModifier(id) {
  return DAILY_MODIFIERS[id] || DAILY_MODIFIERS.fogbound;
}

export function cardsUntilBell(bossProgress, bossGain, cardsNeeded) {
  const gain = Math.max(1, Number(bossGain) || 1);
  const progress = Math.max(0, Math.min(100, Number(bossProgress) || 0));
  const byGain = Math.ceil((100 - progress) / gain);
  const needed = Math.max(1, Number(cardsNeeded) || byGain);
  // Prefer the expedition's published cardsNeeded when progress is fresh.
  if (progress <= 0) return needed;
  return Math.max(0, byGain);
}

export function sealHintText(expedition, bossProgress = 0) {
  const remaining = cardsUntilBell(
    bossProgress,
    expedition.bossGain,
    expedition.cardsNeeded,
  );
  if (bossProgress >= 100) {
    return "The keeper occupies this seal.";
  }
  if (remaining <= 0) {
    return "The next placement will call the keeper.";
  }
  const total = expedition.cardsNeeded;
  return `${remaining} more placement${remaining === 1 ? "" : "s"} until the Bell (${total} at +${expedition.bossGain}% each).`;
}

export function bossProgressLabel(expedition, bossProgress, bossSpawned) {
  if (bossSpawned) return "Keeper waits at the seal";
  const remaining = cardsUntilBell(
    bossProgress,
    expedition.bossGain,
    expedition.cardsNeeded,
  );
  return `Awake ${bossProgress}% · ${remaining} card${remaining === 1 ? "" : "s"} to Bell`;
}

/**
 * @param {{ goalKind: string, goalTarget: number }} exp
 * @param {"victory"|"death"|"retreat"} outcome
 * @param {number} loop
 */
export function evaluateGoal(exp, outcome, loop) {
  if (exp.goalKind === "circuits") {
    if (outcome === "victory") return "met";
    if (outcome === "death") return "failed";
    if (loop >= exp.goalTarget) return "met";
    return "abandoned";
  }
  if (exp.goalKind === "boss_by_circuit") {
    if (outcome === "victory") return loop <= exp.goalTarget ? "met" : "late";
    if (outcome === "death") return "failed";
    return "abandoned";
  }
  if (outcome === "victory") return "met";
  if (outcome === "death") return "failed";
  return "abandoned";
}

export function canAfford(bank, cost) {
  return Object.entries(cost).every(([k, v]) => (bank[k] || 0) >= v);
}

export function spendBank(bank, cost) {
  const next = { ...bank };
  for (const [k, v] of Object.entries(cost)) {
    next[k] = Math.max(0, (next[k] || 0) - v);
  }
  return next;
}

/**
 * Craft / rank up a camp building. Returns a new meta slice or an error code.
 * @param {{ bank: Bank, buildings: Record<string, number>, unlockedRoutes?: string[] }} meta
 * @param {string} buildingId
 */
export function craftBuilding(meta, buildingId) {
  const def = CRAFT_BUILDINGS[buildingId];
  if (!def) return { ok: false, error: "unknown_building" };
  const buildings = { ...emptyBuildings(), ...meta.buildings };
  const rank = buildings[buildingId] || 0;
  if (rank >= def.max) return { ok: false, error: "maxed" };
  const cost = def.cost(rank);
  if (!canAfford(meta.bank, cost)) return { ok: false, error: "cannot_afford" };
  buildings[buildingId] = rank + 1;
  const bank = spendBank(meta.bank, cost);
  const unlockedRoutes = new Set(meta.unlockedRoutes || ["drowned"]);
  if (def.unlocksRoute) unlockedRoutes.add(def.unlocksRoute);
  // Cartographer also unlocks ashen; finishing drowned clears also unlocks (UI).
  return {
    ok: true,
    bank,
    buildings,
    unlockedRoutes: [...unlockedRoutes],
    unlockedCard: def.unlocksCard || null,
    rank: buildings[buildingId],
  };
}

export function isRouteUnlocked(meta, routeId) {
  if (routeId === "drowned") return true;
  const route = getRoute(routeId);
  if (!route.unlockAfter) return true;
  if ((meta.unlockedRoutes || []).includes(routeId)) return true;

  if (routeId === "ashen") {
    if ((meta.buildings?.cartographer || 0) >= 1) return true;
    // Soft unlock: clear Wick once on the drowned verge.
    return (meta.cleared?.wick || 0) >= 1;
  }

  if (routeId === "glassmere") {
    const clears = meta.routeClears || emptyRouteClears();
    const required = route.unlockRequiresRoutes || ["drowned", "ashen"];
    return required.every((id) => (clears[id] || 0) >= 1);
  }

  return false;
}

/** Shared starter card keys (non-event, non-route-exclusive). */
export const BASE_CARD_KEYS = [
  "grove",
  "cairn",
  "altar",
  "hamlet",
  "burrow",
  "lantern",
  "basin",
  "bastion",
];

/**
 * Card keys available when starting / drawing on a route.
 * @param {string} routeId
 * @param {{ dial?: number }} [upgrades]
 */
export function cardPoolForRoute(routeId, upgrades = {}) {
  const route = getRoute(routeId);
  const exclusive = route.exclusiveCards || [];
  const pool = [...BASE_CARD_KEYS, ...exclusive];
  if ((upgrades?.dial || 0) >= 1) pool.push("dial");
  return pool;
}

export function eventCardPool(buildings) {
  const pool = [];
  if ((buildings?.archive || 0) >= 1) pool.push("omen");
  if ((buildings?.veilwright || 0) >= 1) pool.push("eclipse");
  return pool;
}

export function startingBossProgress(buildings) {
  return Math.min(40, (buildings?.bellfoundry || 0) * 5);
}

export function pickEliteModifier(rng = Math.random) {
  const ids = ELITE_MODIFIER_IDS;
  return ids[Math.floor(rng() * ids.length)];
}

export function applyEliteModifier(stats, modifierId) {
  const mod = ELITE_MODIFIERS[modifierId];
  if (!mod) return { ...stats, modifierId: null };
  return {
    ...stats,
    hp: Math.round(stats.hp * mod.hpMul),
    maxHp: Math.round(stats.maxHp * mod.hpMul),
    attack: stats.attack * mod.attackMul,
    defense: stats.defense + mod.defenseAdd,
    speed: stats.speed * mod.speedMul,
    modifierId,
    pierce: mod.pierce || 0,
    modifierLabel: mod.label,
    modifierBlurb: mod.blurb,
  };
}

/* ───────────────────────── Daily loop (Asia/Taipei seed) ───────────────────────── */

const TZ_OFFSET_MS = 8 * 60 * 60 * 1000;

/** YYYY-MM-DD in Asia/Taipei (UTC+8 wall clock). */
export function todayKeyTaipei(now = new Date()) {
  const shifted = new Date(now.getTime() + TZ_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function previousDayKey(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() - 1);
  return todayKeyTaipei(new Date(utc.getTime() - TZ_OFFSET_MS));
}

export function seedFromString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 999999 || 1;
}

export function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailySeed(dateKey = todayKeyTaipei()) {
  return seedFromString(`cinder-daily:${dateKey}`);
}

/**
 * Deterministic daily challenge: route, opening deck, one modifier.
 * @param {string} [dateKey]
 * @param {string[]} [baseCardKeys]
 */
export function dailyChallenge(
  dateKey = todayKeyTaipei(),
  baseCardKeys = BASE_CARD_KEYS,
) {
  const seed = dailySeed(dateKey);
  const rng = makeRng(seed);
  const routeId = ROUTE_ORDER[Math.floor(rng() * ROUTE_ORDER.length)];
  const route = getRoute(routeId);
  const modifierId =
    DAILY_MODIFIER_IDS[Math.floor(rng() * DAILY_MODIFIER_IDS.length)];
  const pool = cardPoolForRoute(routeId, { dial: 0 }).filter(
    (k) => k !== "dial",
  );
  const deckSize = Math.min(6, Math.max(4, pool.length));
  const bag = [...pool];
  const startingDeck = [];
  while (startingDeck.length < deckSize && bag.length) {
    const idx = Math.floor(rng() * bag.length);
    startingDeck.push(bag.splice(idx, 1)[0]);
  }
  // Ensure at least one exclusive card when the route has them.
  if (route.exclusiveCards?.length) {
    const hasExclusive = startingDeck.some((k) =>
      route.exclusiveCards.includes(k),
    );
    if (!hasExclusive) {
      const exclusive =
        route.exclusiveCards[
          Math.floor(rng() * route.exclusiveCards.length)
        ];
      startingDeck[startingDeck.length - 1] = exclusive;
    }
  }
  // Prefer shared base cards when route has no exclusives — keep deck from base.
  if (!route.exclusiveCards?.length && baseCardKeys?.length) {
    /* deck already drawn from BASE_CARD_KEYS via cardPoolForRoute */
  }
  return {
    dateKey,
    seed,
    routeId,
    modifierId,
    modifier: getDailyModifier(modifierId),
    startingDeck,
  };
}

export function emptyDailyPersist() {
  return {
    days: {},
    lastCompletedDate: null,
    streak: 0,
    bestStreak: 0,
  };
}

/**
 * @param {unknown} raw
 */
export function migrateDailyPersist(raw) {
  const base = emptyDailyPersist();
  if (!raw || typeof raw !== "object") return base;
  const src = /** @type {Record<string, unknown>} */ (raw);
  const days = {};
  if (src.days && typeof src.days === "object") {
    for (const [key, value] of Object.entries(
      /** @type {Record<string, unknown>} */ (src.days),
    )) {
      if (!value || typeof value !== "object") continue;
      const v = /** @type {Record<string, unknown>} */ (value);
      days[key] = {
        date: typeof v.date === "string" ? v.date : key,
        bestLoop: Math.max(0, Math.floor(Number(v.bestLoop) || 0)),
        bestKills: Math.max(0, Math.floor(Number(v.bestKills) || 0)),
        attempts: Math.max(0, Math.floor(Number(v.attempts) || 0)),
        completed: Boolean(v.completed),
        goalMet: Boolean(v.goalMet),
        routeId: typeof v.routeId === "string" ? v.routeId : null,
        modifierId: typeof v.modifierId === "string" ? v.modifierId : null,
      };
    }
  }
  return {
    days,
    lastCompletedDate:
      typeof src.lastCompletedDate === "string" ? src.lastCompletedDate : null,
    streak: Math.max(0, Math.floor(Number(src.streak) || 0)),
    bestStreak: Math.max(0, Math.floor(Number(src.bestStreak) || 0)),
  };
}

/**
 * Merge a finished daily attempt into persisted bests.
 * `completed` = any finished attempt counts for attempt tracking;
 * streak advances when goalMet (expedition goal cleared) for that day.
 */
export function mergeDailyAttempt(
  prev,
  dateKey,
  {
    loop = 1,
    kills = 0,
    goalMet = false,
    routeId = null,
    modifierId = null,
  } = {},
) {
  const existing = prev.days[dateKey];
  const bestLoop = Math.max(existing?.bestLoop || 0, Math.floor(loop) || 0);
  const better =
    !existing ||
    loop > (existing.bestLoop || 0) ||
    (loop === (existing.bestLoop || 0) && kills > (existing.bestKills || 0));
  const day = {
    date: dateKey,
    bestLoop,
    bestKills: better
      ? Math.max(0, Math.floor(kills) || 0)
      : (existing?.bestKills ?? Math.max(0, Math.floor(kills) || 0)),
    attempts: (existing?.attempts || 0) + 1,
    completed: true,
    goalMet: Boolean(existing?.goalMet) || Boolean(goalMet),
    routeId: routeId || existing?.routeId || null,
    modifierId: modifierId || existing?.modifierId || null,
  };

  let streak = prev.streak;
  let bestStreak = prev.bestStreak;
  let lastCompletedDate = prev.lastCompletedDate;

  if (goalMet) {
    if (lastCompletedDate === dateKey) {
      // already counted today
    } else if (lastCompletedDate === previousDayKey(dateKey)) {
      streak = streak + 1;
      lastCompletedDate = dateKey;
    } else {
      streak = 1;
      lastCompletedDate = dateKey;
    }
    bestStreak = Math.max(bestStreak, streak);
  }

  return {
    days: { ...prev.days, [dateKey]: day },
    lastCompletedDate,
    streak,
    bestStreak,
  };
}

export function currentDailyStreak(
  persist,
  today = todayKeyTaipei(),
) {
  const todayDone = persist.days[today]?.goalMet;
  if (todayDone) return persist.streak;
  if (persist.lastCompletedDate === previousDayKey(today)) return persist.streak;
  return 0;
}

export function formatDailyShareText({
  dateKey,
  routeName,
  modifierLabel,
  bestLoop,
  bestKills,
  streak,
  goalMet,
}) {
  return [
    `【Cinder Circuit · 每日迴路】`,
    `日期 ${dateKey}（台北）`,
    `路線 ${routeName} · 修正 ${modifierLabel}`,
    `今日最佳 迴路 ${bestLoop} · 擊殺 ${bestKills}${goalMet ? " · 目標達成" : ""}`,
    `連續天數 ${streak}`,
    `#CinderCircuit #每日迴路`,
  ].join("\n");
}

/**
 * Normalize / migrate saved meta from v1/v2/v3/v4 shapes.
 * @param {unknown} raw
 */
export function migrateMeta(raw) {
  const base = {
    bank: emptyResources(),
    upgrades: emptyUpgrades(),
    buildings: emptyBuildings(),
    runs: 0,
    wins: 0,
    best: 1,
    tutorial: false,
    howto: false,
    expeditionId: "wick",
    routeId: "drowned",
    unlockedRoutes: ["drowned"],
    cleared: emptyCleared(),
    routeClears: emptyRouteClears(),
  };
  if (!raw || typeof raw !== "object") return base;
  const src = /** @type {Record<string, unknown>} */ (raw);
  const bank = /** @type {Record<string, unknown>} */ (src.bank || {});
  for (const k of RESOURCE_KEYS) {
    base.bank[k] = Math.max(0, Number(bank[k]) || 0);
  }
  const upgrades = /** @type {Record<string, unknown>} */ (src.upgrades || {});
  for (const k of Object.keys(base.upgrades)) {
    base.upgrades[k] = Math.max(
      0,
      Math.min(k === "dial" ? 1 : 5, Number(upgrades[k]) || 0),
    );
  }
  const buildings = /** @type {Record<string, unknown>} */ (src.buildings || {});
  for (const k of Object.keys(base.buildings)) {
    const max = CRAFT_BUILDINGS[k]?.max ?? 1;
    base.buildings[k] = Math.max(0, Math.min(max, Number(buildings[k]) || 0));
  }
  for (const k of ["runs", "wins", "best"]) {
    base[k] = Math.max(base[k], Number(src[k]) || 0);
  }
  base.tutorial = !!src.tutorial;
  base.howto = !!src.howto || !!src.tutorial;
  if (typeof src.expeditionId === "string" && EXPEDITIONS[src.expeditionId]) {
    base.expeditionId = src.expeditionId;
  }
  if (typeof src.routeId === "string" && ROUTES[src.routeId]) {
    base.routeId = src.routeId;
  }
  const cleared = /** @type {Record<string, unknown>} */ (src.cleared || {});
  for (const k of Object.keys(base.cleared)) {
    base.cleared[k] = Math.max(0, Number(cleared[k]) || 0);
  }
  const routeClears = /** @type {Record<string, unknown>} */ (
    src.routeClears || {}
  );
  for (const k of Object.keys(base.routeClears)) {
    base.routeClears[k] = Math.max(0, Number(routeClears[k]) || 0);
  }
  const unlocked = Array.isArray(src.unlockedRoutes)
    ? src.unlockedRoutes.filter((id) => typeof id === "string" && ROUTES[id])
    : [];
  base.unlockedRoutes = [...new Set(["drowned", ...unlocked])];
  if (base.buildings.cartographer >= 1 && !base.unlockedRoutes.includes("ashen")) {
    base.unlockedRoutes.push("ashen");
  }
  if (base.cleared.wick >= 1 && !base.unlockedRoutes.includes("ashen")) {
    base.unlockedRoutes.push("ashen");
  }
  if (
    isRouteUnlocked(base, "glassmere") &&
    !base.unlockedRoutes.includes("glassmere")
  ) {
    base.unlockedRoutes.push("glassmere");
  }
  if (!isRouteUnlocked(base, base.routeId)) base.routeId = "drowned";
  return base;
}

/**
 * Pure campaign / progress logic for WebMCP Mini Factory.
 * Safe to import from Node check scripts and from the static ESM page.
 */

export const STORAGE_KEY = 'astra-webmcp-mini-factory:v1';
/** Legacy layout-only key from depth-3 Mini Factory. */
export const LEGACY_LAYOUT_KEY = 'webmcp-mini-factory-v1';

/** Machine power draw while online (storage / splitter are light). */
export const MACHINE_POWER = {
  miner: 3,
  smelter: 4,
  assembler: 5,
  robot_assembler: 6,
  storage: 1,
  splitter: 1,
};

/**
 * Research nodes. Completing a level can unlock research ids listed on that level.
 * Unlocks gate machine types / recipes for later floors.
 */
export const RESEARCH = [
  {
    id: 'splitter',
    name: 'Fair Splitter',
    description: 'Unlocks splitter machines for branching belts.',
    unlocks: { machines: ['splitter'] },
  },
  {
    id: 'circuits',
    name: 'Printed Circuits',
    description: 'Assemblers can fabricate circuits from iron + copper plates.',
    unlocks: { recipes: ['circuit'] },
  },
  {
    id: 'robotics',
    name: 'Robot Assembly',
    description: 'Unlocks the robot assembler and robot product line.',
    unlocks: { machines: ['robot_assembler'], recipes: ['robot'] },
  },
  {
    id: 'overclock',
    name: 'Overclock Modules',
    description: 'Online machines draw 1 less power (minimum 1). Levels 1–3 stay available from the start.',
    unlocks: { powerDiscount: 1 },
  },
];

/**
 * Campaign floors. Level 1 preserves the original “10 gears/min for 10s” mission
 * and the deterministic bottlenecked starter layout.
 *
 * @typedef {{
 *   id: string,
 *   index: number,
 *   title: string,
 *   blurb: string,
 *   product: string,
 *   target: number,
 *   sustain: number,
 *   credits: number,
 *   powerBudget: number | null,
 *   maxMachines: number | null,
 *   unlockResearch: string[],
 *   requiresResearch: string[],
 *   starMachines: number | null,
 *   starPower: number | null,
 *   starCredits: number | null,
 *   starter: 'classic' | 'blank' | 'copper_seed' | 'circuit_seed' | 'robot_seed',
 * }} LevelDef
 */

/** @type {LevelDef[]} */
export const LEVELS = [
  {
    id: 'L01',
    index: 1,
    title: 'Gear Rush',
    blurb: 'Sustain 10 gears/min for 10 simulation seconds. The classic bottlenecked starter floor.',
    product: 'gear',
    target: 10,
    sustain: 10,
    credits: 1000,
    powerBudget: null,
    maxMachines: null,
    unlockResearch: ['splitter'],
    requiresResearch: [],
    starMachines: 5,
    starPower: null,
    starCredits: 400,
    starter: 'classic',
  },
  {
    id: 'L02',
    index: 2,
    title: 'Crowded Floor',
    blurb: 'Same gear target, but you may keep at most 6 machines on the floor.',
    product: 'gear',
    target: 10,
    sustain: 10,
    credits: 900,
    powerBudget: null,
    maxMachines: 6,
    unlockResearch: [],
    requiresResearch: ['splitter'],
    starMachines: 5,
    starPower: null,
    starCredits: 350,
    starter: 'classic',
  },
  {
    id: 'L03',
    index: 3,
    title: 'Power Cap',
    blurb: 'Hit 10 gears/min under a hard 18-unit power budget. Offline idle machines to free watts.',
    product: 'gear',
    target: 10,
    sustain: 10,
    credits: 1000,
    powerBudget: 18,
    maxMachines: null,
    unlockResearch: ['circuits'],
    requiresResearch: ['splitter'],
    starMachines: null,
    starPower: 16,
    starCredits: 300,
    starter: 'classic',
  },
  {
    id: 'L04',
    index: 4,
    title: 'Copper Seed',
    blurb: 'Bring copper into the line and hold 6 circuits/min. Splitters help share plates.',
    product: 'circuit',
    target: 6,
    sustain: 10,
    credits: 1200,
    powerBudget: 28,
    maxMachines: 10,
    unlockResearch: [],
    requiresResearch: ['circuits', 'splitter'],
    starMachines: 8,
    starPower: 24,
    starCredits: 400,
    starter: 'copper_seed',
  },
  {
    id: 'L05',
    index: 5,
    title: 'Circuit Sprint',
    blurb: 'Push circuits to 8/min with a tighter power envelope.',
    product: 'circuit',
    target: 8,
    sustain: 10,
    credits: 1100,
    powerBudget: 26,
    maxMachines: 9,
    unlockResearch: ['overclock'],
    requiresResearch: ['circuits', 'splitter'],
    starMachines: 8,
    starPower: 22,
    starCredits: 250,
    starter: 'circuit_seed',
  },
  {
    id: 'L06',
    index: 6,
    title: 'Lean Gears',
    blurb: '12 gears/min with only 7 machine slots and 22 power. Prefer upgrades over sprawl.',
    product: 'gear',
    target: 12,
    sustain: 10,
    credits: 1000,
    powerBudget: 22,
    maxMachines: 7,
    unlockResearch: [],
    requiresResearch: ['overclock', 'splitter'],
    starMachines: 6,
    starPower: 20,
    starCredits: 200,
    starter: 'classic',
  },
  {
    id: 'L07',
    index: 7,
    title: 'Dual Demand',
    blurb: 'Hold 8 circuits/min while staying under 24 power. Branch copper and iron carefully.',
    product: 'circuit',
    target: 8,
    sustain: 12,
    credits: 1300,
    powerBudget: 24,
    maxMachines: 11,
    unlockResearch: ['robotics'],
    requiresResearch: ['circuits', 'splitter', 'overclock'],
    starMachines: 9,
    starPower: 22,
    starCredits: 350,
    starter: 'circuit_seed',
  },
  {
    id: 'L08',
    index: 8,
    title: 'First Robot',
    blurb: 'Assemble robots from gears + circuits. Sustain 4 robots/min.',
    product: 'robot',
    target: 4,
    sustain: 10,
    credits: 1400,
    powerBudget: 32,
    maxMachines: 12,
    unlockResearch: [],
    requiresResearch: ['robotics', 'circuits', 'splitter', 'overclock'],
    starMachines: 10,
    starPower: 28,
    starCredits: 300,
    starter: 'robot_seed',
  },
  {
    id: 'L09',
    index: 9,
    title: 'Compact Robotics',
    blurb: '6 robots/min on a crowded, low-power floor. Every watt and tile counts.',
    product: 'robot',
    target: 6,
    sustain: 10,
    credits: 1500,
    powerBudget: 30,
    maxMachines: 11,
    unlockResearch: [],
    requiresResearch: ['robotics', 'circuits', 'splitter', 'overclock'],
    starMachines: 9,
    starPower: 26,
    starCredits: 250,
    starter: 'robot_seed',
  },
  {
    id: 'L10',
    index: 10,
    title: 'Flagship Line',
    blurb: 'The final floor: sustain 8 robots/min. Spend wisely — power and slots are scarce.',
    product: 'robot',
    target: 8,
    sustain: 12,
    credits: 1600,
    powerBudget: 34,
    maxMachines: 13,
    unlockResearch: [],
    requiresResearch: ['robotics', 'circuits', 'splitter', 'overclock'],
    starMachines: 11,
    starPower: 30,
    starCredits: 200,
    starter: 'robot_seed',
  },
];

export function getLevel(id) {
  return LEVELS.find((level) => level.id === id) || null;
}

export function emptyProgress() {
  return {
    version: 1,
    currentLevelId: 'L01',
    /** @type {Record<string, { stars: number, bestTime: number | null, bestMachines: number | null, bestPowerPeak: number | null, bestRate: number | null, clears: number }>} */
    clears: {},
    /** @type {string[]} */
    research: [],
    /** @type {Record<string, object>} */
    layouts: {},
  };
}

/**
 * Rate stars for a completed attempt.
 * 1★ clear · 2★ meet one lean goal · 3★ meet both available lean goals
 * (machines / power / leftover credits — whichever the level defines).
 */
export function rateStars(level, { machineCount, powerPeak, creditsLeft }) {
  const goals = [];
  if (level.starMachines != null) goals.push(machineCount <= level.starMachines);
  if (level.starPower != null) goals.push(powerPeak <= level.starPower);
  if (level.starCredits != null) goals.push(creditsLeft >= level.starCredits);
  if (goals.length === 0) return 1;
  const hit = goals.filter(Boolean).length;
  if (hit >= Math.min(2, goals.length) && goals.length >= 2) return 3;
  if (hit >= 1) return goals.length === 1 && hit === 1 ? 3 : 2;
  return 1;
}

export function totalStars(progress) {
  return Object.values(progress.clears || {}).reduce((n, clear) => n + (clear.stars || 0), 0);
}

export function hasResearch(progress, researchId) {
  return (progress.research || []).includes(researchId);
}

export function isLevelUnlocked(progress, levelId) {
  const level = getLevel(levelId);
  if (!level) return false;
  if (level.index === 1) return true;
  const prev = LEVELS.find((entry) => entry.index === level.index - 1);
  if (!prev || !(progress.clears[prev.id]?.stars >= 1)) return false;
  return level.requiresResearch.every((id) => hasResearch(progress, id));
}

export function unlockedMachineTypes(progress) {
  const base = new Set(['miner', 'smelter', 'assembler', 'storage']);
  for (const id of progress.research || []) {
    const node = RESEARCH.find((entry) => entry.id === id);
    for (const machine of node?.unlocks?.machines || []) base.add(machine);
  }
  return [...base];
}

export function unlockedRecipes(progress) {
  const base = new Set(['iron_ore', 'copper_ore', 'iron_plate', 'copper_plate', 'gear']);
  for (const id of progress.research || []) {
    const node = RESEARCH.find((entry) => entry.id === id);
    for (const recipe of node?.unlocks?.recipes || []) base.add(recipe);
  }
  return [...base];
}

/** Depth-3 Mini Factory always allowed levels 1–3; keep that for every floor. */
export function maxMachineLevel(_progress) {
  return 3;
}

/** Extra power discount from Overclock research (0 if locked). */
export function powerDiscount(progress) {
  if (!hasResearch(progress, 'overclock')) return 0;
  const node = RESEARCH.find((entry) => entry.id === 'overclock');
  return node?.unlocks?.powerDiscount || 0;
}

export function powerDraw(type, progress = null, powerTable = MACHINE_POWER) {
  const base = powerTable[type] || 0;
  const discount = progress ? powerDiscount(progress) : 0;
  if (!discount || base <= 0) return base;
  return Math.max(1, base - discount);
}

/**
 * Apply research unlocks granted by clearing a level (idempotent).
 * @returns {string[]} newly unlocked research ids
 */
export function grantLevelResearch(progress, levelId) {
  const level = getLevel(levelId);
  if (!level) return [];
  const newly = [];
  for (const id of level.unlockResearch) {
    if (!progress.research.includes(id)) {
      progress.research.push(id);
      newly.push(id);
    }
  }
  return newly;
}

/**
 * Record a clear. Never downgrades stars; keeps best lean metrics.
 * @returns {{ stars: number, isNewBest: boolean, newlyResearch: string[] }}
 */
export function recordClear(progress, levelId, attempt) {
  const level = getLevel(levelId);
  if (!level) throw new Error(`Unknown level ${levelId}`);
  const stars = rateStars(level, attempt);
  const prev = progress.clears[levelId];
  const next = {
    stars: Math.max(prev?.stars || 0, stars),
    bestTime:
      prev?.bestTime == null
        ? attempt.completeTime
        : Math.min(prev.bestTime, attempt.completeTime),
    bestMachines:
      prev?.bestMachines == null
        ? attempt.machineCount
        : Math.min(prev.bestMachines, attempt.machineCount),
    bestPowerPeak:
      prev?.bestPowerPeak == null
        ? attempt.powerPeak
        : Math.min(prev.bestPowerPeak, attempt.powerPeak),
    bestRate:
      prev?.bestRate == null
        ? attempt.rate
        : Math.max(prev.bestRate, attempt.rate),
    clears: (prev?.clears || 0) + 1,
  };
  progress.clears[levelId] = next;
  const newlyResearch = grantLevelResearch(progress, levelId);
  const isNewBest = !prev || stars > (prev.stars || 0) || attempt.completeTime < (prev.bestTime ?? Infinity);
  return { stars, isNewBest, newlyResearch };
}

export function powerUsed(machines, powerTable = MACHINE_POWER, progress = null) {
  return machines.reduce((sum, machine) => {
    if (!machine.online) return sum;
    return sum + powerDraw(machine.type, progress, powerTable);
  }, 0);
}

export function canAffordPower(
  machines,
  type,
  powerBudget,
  powerTable = MACHINE_POWER,
  progress = null,
) {
  if (powerBudget == null) return true;
  return (
    powerUsed(machines, powerTable, progress) + powerDraw(type, progress, powerTable) <=
    powerBudget
  );
}

export function canEnablePower(
  machines,
  machineId,
  powerBudget,
  powerTable = MACHINE_POWER,
  progress = null,
) {
  if (powerBudget == null) return true;
  const target = machines.find((machine) => machine.id === machineId);
  if (!target || target.online) return true;
  return (
    powerUsed(machines, powerTable, progress) +
      powerDraw(target.type, progress, powerTable) <=
    powerBudget
  );
}

/**
 * Migrate raw localStorage JSON (or null) into a valid progress blob.
 * Optionally folds a legacy depth-3 layout into L01.
 */
export function migrateProgress(raw, legacyLayout = null) {
  const base = emptyProgress();
  if (!raw || typeof raw !== 'object') {
    if (legacyLayout && typeof legacyLayout === 'object') {
      base.layouts.L01 = legacyLayout;
    }
    return base;
  }
  const progress = {
    version: 1,
    currentLevelId:
      typeof raw.currentLevelId === 'string' && getLevel(raw.currentLevelId)
        ? raw.currentLevelId
        : 'L01',
    clears: {},
    research: Array.isArray(raw.research)
      ? raw.research.filter((id) => RESEARCH.some((node) => node.id === id))
      : [],
    layouts:
      raw.layouts && typeof raw.layouts === 'object' && !Array.isArray(raw.layouts)
        ? { ...raw.layouts }
        : {},
  };
  if (raw.clears && typeof raw.clears === 'object') {
    for (const [id, clear] of Object.entries(raw.clears)) {
      if (!getLevel(id) || !clear || typeof clear !== 'object') continue;
      progress.clears[id] = {
        stars: Math.max(0, Math.min(3, Number(clear.stars) || 0)),
        bestTime: clear.bestTime == null ? null : Number(clear.bestTime),
        bestMachines: clear.bestMachines == null ? null : Number(clear.bestMachines),
        bestPowerPeak: clear.bestPowerPeak == null ? null : Number(clear.bestPowerPeak),
        bestRate: clear.bestRate == null ? null : Number(clear.bestRate),
        clears: Math.max(0, Number(clear.clears) || 0),
      };
    }
  }
  // Re-derive research from clears so saves stay consistent if unlocks change.
  for (const id of Object.keys(progress.clears)) {
    if ((progress.clears[id].stars || 0) >= 1) grantLevelResearch(progress, id);
  }
  if (!progress.layouts.L01 && legacyLayout && typeof legacyLayout === 'object') {
    progress.layouts.L01 = legacyLayout;
  }
  if (!isLevelUnlocked(progress, progress.currentLevelId)) {
    progress.currentLevelId = 'L01';
  }
  return progress;
}

export function nextLevelId(levelId) {
  const level = getLevel(levelId);
  if (!level) return null;
  const next = LEVELS.find((entry) => entry.index === level.index + 1);
  return next?.id || null;
}

export function productLabel(product) {
  return (
    {
      gear: 'gears',
      circuit: 'circuits',
      robot: 'robots',
    }[product] || product
  );
}

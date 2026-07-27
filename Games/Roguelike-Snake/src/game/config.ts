/** Tunables for 蛇窟迴廊. Grid is square so the arena fits portrait and desktop alike. */
export const GRID = 21;

export const BASE_MOVE_MS = 150;
export const MIN_MOVE_MS = 90;
export const FLOOR_SPEEDUP_MS = 4;

export const START_LENGTH = 4;
export const MIN_LENGTH = 3;
export const HURT_SHRINK = 3;

export const START_HP = 3;
export const START_ENERGY = 60;
export const BASE_MAX_ENERGY = 100;

export const FRUIT_ENERGY = 12;
/** Trickle so a stranded run can always rebuild a dash. */
export const ENERGY_REGEN_PER_TICK = 0.15;
export const CURSED_ENERGY = 40;
export const MAX_FRUITS = 2;

export const DASH_COST = 30;
export const DASH_DISTANCE = 4;
export const DASH_COOLDOWN_MS = 600;
export const DASH_INVULN_MS = 300;
export const BLOOD_DASH_INTERVAL = 4;

export const INVULN_MS = 1200;
export const HOURGLASS_BONUS_MS = 1200;

export const MAX_FLOOR = 15;
export const BOSS_FLOORS = [5, 10, 15];

export const REROLL_COST = 4;
export const HEAL_COST = 8;

export const SPIKE_CYCLE = 3;
export const SPIKE_ARMED = 1;

export const SCORE_FRUIT = 10;
export const SCORE_KILL = 25;
export const SCORE_FLOOR = 100;
export const SCORE_BOSS = 500;
export const SCORE_ESCAPE = 2000;
export const SCORE_HP_BONUS = 300;

export const STORAGE_KEY = 'clubhouse:roguelike-snake:best';

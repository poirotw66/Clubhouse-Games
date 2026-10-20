/**
 * Themed tables: distinct physics / rules, not just skins. Each table keeps
 * its own RTP band; see scripts/self-check.ts and scripts/balance.ts.
 */
import {
  LATERAL_SLIDE,
  POT_BASE,
  POT_CUT_RATE,
  PUSHER_BACK_Y,
  PUSHER_PERIOD_TICKS,
  PUSHER_STROKE,
  PUSHER_THICK,
  SHELF_LEN,
  SHELF_W,
  SLOPE_PER_TICK,
  SPAWN_JITTER,
  TRIGGER_MASS,
  COIN_R,
} from './constants';

export type TableId = 'classic' | 'peg-alley' | 'spring-tide';

export type JackpotRule = 'standard' | 'cascade_bonus';

export interface Peg {
  readonly x: number;
  readonly y: number;
  readonly r: number;
}

/** Tunables the engine reads per run. Defaults match constants.ts (classic). */
export interface TablePhysics {
  readonly pusherPeriodTicks: number;
  readonly pusherStroke: number;
  readonly pusherBackY: number;
  readonly pusherThick: number;
  readonly slopePerTick: number;
  readonly potCutRate: number;
  readonly potBase: number;
  readonly triggerMass: number;
  readonly spawnJitter: number;
  readonly lateralSlide: number;
  readonly pegs: readonly Peg[];
  /**
   * standard — trigger pays the pot as usual.
   * cascade_bonus — if the trigger falls in the same forward stroke as ≥2
   * other coins, the pot pays 1.5× (theme of spring-tide's "潮湧彩池").
   */
  readonly jackpotRule: JackpotRule;
}

export interface TableDef {
  readonly id: TableId;
  /** Traditional Chinese display name. */
  readonly name: string;
  /** Short Traditional Chinese blurb. */
  readonly blurb: string;
  /** One-line mechanic reminder. */
  readonly mechanicLabel: string;
  /** Tokens required to unlock (0 = free). */
  readonly unlockTokens: number;
  /** Mode-pack clears required as an alternate unlock path. */
  readonly unlockModeClears: number;
  readonly physics: TablePhysics;
  /** Cabinet tint hint for the canvas (CSS-like hsl). */
  readonly cabinetHue: number;
}

const CLASSIC_PHYSICS: TablePhysics = {
  pusherPeriodTicks: PUSHER_PERIOD_TICKS,
  pusherStroke: PUSHER_STROKE,
  pusherBackY: PUSHER_BACK_Y,
  pusherThick: PUSHER_THICK,
  slopePerTick: SLOPE_PER_TICK,
  potCutRate: POT_CUT_RATE,
  potBase: POT_BASE,
  triggerMass: TRIGGER_MASS,
  spawnJitter: SPAWN_JITTER,
  lateralSlide: LATERAL_SLIDE,
  pegs: [],
  jackpotRule: 'standard',
};

/** Fixed peg layout — seed-independent so the table itself is the decision surface. */
const PEG_ALLEY_PEGS: readonly Peg[] = [
  { x: SHELF_W * 0.28, y: SHELF_LEN * 0.38, r: COIN_R * 0.95 },
  { x: SHELF_W * 0.5, y: SHELF_LEN * 0.48, r: COIN_R * 1.05 },
  { x: SHELF_W * 0.72, y: SHELF_LEN * 0.38, r: COIN_R * 0.95 },
  { x: SHELF_W * 0.38, y: SHELF_LEN * 0.62, r: COIN_R * 0.85 },
  { x: SHELF_W * 0.62, y: SHELF_LEN * 0.62, r: COIN_R * 0.85 },
];

export const TABLE_PACK: readonly TableDef[] = [
  {
    id: 'classic',
    name: '經典廳',
    blurb: '標準推程與彩池——基準機台',
    mechanicLabel: '標準推板週期・無障礙',
    unlockTokens: 0,
    unlockModeClears: 0,
    physics: CLASSIC_PHYSICS,
    cabinetHue: 38,
  },
  {
    id: 'peg-alley',
    name: '釘陣廳',
    blurb: '台面釘柱逼你繞路投幣，邊緣與縫隙變成佈局題',
    mechanicLabel: '固定釘柱碰撞・縫隙投幣',
    unlockTokens: 40,
    unlockModeClears: 2,
    physics: {
      ...CLASSIC_PHYSICS,
      // Slightly softer slope so pegs, not creep, dominate mid-shelf routing.
      slopePerTick: SLOPE_PER_TICK * 0.85,
      // Pegs shed some return; nudge pot cut up a touch so chase still matters.
      potCutRate: 0.18,
      pegs: PEG_ALLEY_PEGS,
      jackpotRule: 'standard',
    },
    cabinetHue: 210,
  },
  {
    id: 'spring-tide',
    name: '潮汐廳',
    blurb: '推板更快更長，時機窗變窄；彩池在潮湧連鎖時加碼',
    mechanicLabel: '快推程・潮湧彩池 1.5×',
    unlockTokens: 100,
    unlockModeClears: 4,
    physics: {
      ...CLASSIC_PHYSICS,
      // Faster, longer stroke — timing decision is sharper.
      pusherPeriodTicks: 100,
      pusherStroke: 58,
      potCutRate: 0.15,
      jackpotRule: 'cascade_bonus',
      pegs: [],
    },
    cabinetHue: 168,
  },
];

export function tableById(id: string): TableDef | undefined {
  return TABLE_PACK.find((t) => t.id === id);
}

export function tablePhysics(id: TableId): TablePhysics {
  return tableById(id)?.physics ?? CLASSIC_PHYSICS;
}

export function defaultTableId(): TableId {
  return 'classic';
}

export function isTableUnlocked(
  table: TableDef,
  tokens: number,
  modeClears: number,
  unlockedIds: readonly string[],
): boolean {
  if (table.unlockTokens === 0 && table.unlockModeClears === 0) return true;
  if (unlockedIds.includes(table.id)) return true;
  if (tokens >= table.unlockTokens) return true;
  if (modeClears >= table.unlockModeClears) return true;
  return false;
}

export function assertTablePackShape(): void {
  if (TABLE_PACK.length < 3) {
    throw new Error(`table pack too thin: ${TABLE_PACK.length}`);
  }
  const ids = new Set<string>();
  for (const table of TABLE_PACK) {
    if (ids.has(table.id)) throw new Error(`duplicate table id ${table.id}`);
    ids.add(table.id);
    if (table.physics.pusherPeriodTicks < 40) {
      throw new Error(`table ${table.id}: pusher period too short`);
    }
    if (table.physics.pusherStroke < 20) {
      throw new Error(`table ${table.id}: stroke too short`);
    }
    for (const peg of table.physics.pegs) {
      if (peg.r <= 0 || peg.x < 0 || peg.x > SHELF_W || peg.y < 0 || peg.y > SHELF_LEN) {
        throw new Error(`table ${table.id}: invalid peg`);
      }
    }
  }
  if (!ids.has('classic')) throw new Error('classic table is required');
}

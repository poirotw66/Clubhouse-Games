import { attrsFor, overall } from './config';
import { noise, pick, randInt } from './rng';
import type { Attributes, Player, Position } from './types';

const SURNAMES = [
  '陳', '林', '黃', '張', '李', '王', '吳', '劉', '蔡', '楊',
  '許', '鄭', '謝', '郭', '洪', '曾', '廖', '賴', '徐', '周',
  '葉', '蘇', '莊', '呂', '江', '何', '蕭', '羅', '高', '潘',
];

const GIVEN = [
  '志豪', '家瑋', '柏睿', '冠宇', '承翰', '宗翰', '建宏', '俊傑', '明哲', '國豪',
  '子軒', 'peng', '智勝', '偉倫', '大成', '祐緯', '政賢', '育霖', '文彬', '書豪',
  '威廷', '子豪', '哲宇', '皓宇', '仲翔', '孟哲', '柏豪', '彥廷', '宇軒', '奕辰',
];

const POSITIONS: Position[] = ['P', 'C', 'IF', 'OF'];

/** Rosters are pitcher-heavy, the way real ones are. */
const POSITION_WEIGHTS: Record<Position, number> = { P: 11, C: 3, IF: 8, OF: 6 };

export function randomName(r: () => number): string {
  const given = pick(r, GIVEN);
  // The placeholder in the given-name list keeps its slot deterministic; swap
  // it for something real rather than shipping it.
  return `${pick(r, SURNAMES)}${given === 'peng' ? '正豪' : given}`;
}

export function randomPosition(r: () => number): Position {
  const total = POSITIONS.reduce((sum, p) => sum + POSITION_WEIGHTS[p], 0);
  let roll = r() * total;
  for (const position of POSITIONS) {
    roll -= POSITION_WEIGHTS[position];
    if (roll <= 0) return position;
  }
  return 'IF';
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Builds an attribute block whose `overall` lands near `target`. The relevant
 * five attributes carry the target; the other five are filler so the shape
 * matches 棒球人生 without inflating anyone's rating.
 */
function attrsForTarget(r: () => number, position: Position, target: number): Attributes {
  const attrs: Attributes = {
    contact: 20, power: 20, speed: 20, fielding: 20, eye: 20,
    velocity: 20, control: 20, breaking: 20, stamina: 20, guts: 20,
  };
  const keys = attrsFor(position);
  keys.forEach((key) => {
    attrs[key] = clamp(Math.round(target + noise(r, 12)), 8, 99);
  });

  // Nudge until the weighted overall actually matches; the weights differ per
  // position, so a flat assignment would drift several points off target.
  for (let i = 0; i < 12; i++) {
    const gap = target - overall(attrs, position);
    if (Math.abs(gap) < 0.8) break;
    keys.forEach((key) => {
      attrs[key] = clamp(Math.round(attrs[key] + gap * 0.6), 8, 99);
    });
  }
  return attrs;
}

let idCounter = 0;

/** Ids only need to be unique within one save, not across sessions. */
export function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}${idCounter}`;
}

export function resetIds(): void {
  idCounter = 0;
}

export interface GenerateInput {
  r: () => number;
  teamId: string;
  age: number;
  /** Current-ability target. */
  ability: number;
  /** Ceiling; defaults to a little above ability for veterans. */
  potential?: number;
  level?: Player['level'];
  homegrown?: boolean;
}

export function generatePlayer(input: GenerateInput): Player {
  const { r, teamId, age, ability } = input;
  const position = randomPosition(r);
  const attrs = attrsForTarget(r, position, ability);
  const headroom = age <= 21 ? randInt(r, 8, 34) : age <= 25 ? randInt(r, 3, 18) : randInt(r, 0, 6);
  const potential = clamp(input.potential ?? ability + headroom, 20, 99);

  return {
    id: nextId('p'),
    name: randomName(r),
    position,
    age,
    attrs,
    potential,
    band: { low: potential, high: potential },
    salary: marketSalary(ability, age),
    years: randInt(r, 1, 4),
    level: input.level ?? 'major',
    injuredSeasons: 0,
    homegrown: input.homegrown ?? false,
    teamId,
  };
}

export function ability(player: Player): number {
  return overall(player.attrs, player.position);
}

/**
 * What the open market pays for this player. Ability dominates, and the curve
 * is steep in the band players actually occupy so a star really does cost
 * several times what a fringe regular costs.
 */
export function marketSalary(abilityValue: number, age: number): number {
  const edge = abilityValue - 52;
  // Scaled so a full 26-man roster lands near the salary cap rather than
  // comfortably under it. At the old scale wages were a rounding error next to
  // gate receipts and every strategy printed money for a decade.
  const base = 430 * clamp(0.3 + (edge + 12) / 14, 0.15, 2.6);
  const ageFactor = age <= 23 ? 0.55 : age <= 26 ? 0.85 : age <= 32 ? 1.1 : 0.8;
  return Math.max(40, Math.round(base * ageFactor));
}

/**
 * Trade value. Age matters enormously: the same rating on a 23-year-old and a
 * 34-year-old are completely different assets, and a bargain contract is worth
 * real money on its own.
 */
export function tradeValue(player: Player): number {
  const abilityValue = ability(player);
  const ageFactor =
    player.age <= 23 ? 1.35 : player.age <= 27 ? 1.15 : player.age <= 30 ? 1.0 : player.age <= 33 ? 0.7 : 0.4;
  const market = marketSalary(abilityValue, player.age);
  const contractFactor = clamp(market / Math.max(40, player.salary), 0.6, 1.4);
  // Prospects are valued off the midpoint of what scouting believes.
  const upside = player.age <= 22 ? (player.potential - abilityValue) * 0.35 : 0;
  return Math.max(0, (abilityValue + upside) * ageFactor * contractFactor);
}

const GROWTH_BY_AGE = (age: number): number => {
  if (age <= 20) return 1.3;
  if (age <= 23) return 1.0;
  if (age <= 26) return 0.5;
  if (age <= 29) return 0.2;
  return 0;
};

const DECLINE_ONSET = 30;

/**
 * One offseason of ageing. Young players climb towards their ceiling, old ones
 * fall away from it, and the fall accelerates — so every long contract handed
 * to a 31-year-old is a bet against this function.
 */
export function agePlayer(player: Player, r: () => number, farmBoost: number): void {
  player.age += 1;
  const keys = attrsFor(player.position);
  const current = ability(player);

  if (player.age <= 29 && current < player.potential) {
    const room = clamp((player.potential - current) / 20, 0.1, 1);
    const boost = player.level === 'farm' ? farmBoost : 1;
    const gain = GROWTH_BY_AGE(player.age) * room * boost * (2.6 + r() * 2.4);
    keys.forEach((key) => {
      player.attrs[key] = clamp(Math.round(player.attrs[key] + gain), 0, 99);
    });
  }

  if (player.age >= DECLINE_ONSET) {
    const severity = (player.age - DECLINE_ONSET + 1) * 0.75;
    keys.forEach((key) => {
      player.attrs[key] = clamp(Math.round(player.attrs[key] - severity * (0.6 + r() * 0.9)), 0, 99);
    });
  }

  if (player.years > 0) player.years -= 1;
  if (player.injuredSeasons > 0) player.injuredSeasons -= 1;
}

export function isStar(player: Player): boolean {
  return ability(player) >= 70;
}

export function describe(player: Player): string {
  return `${player.name}（${player.age} 歲）`;
}

import type { AttrKey, GameState, Position } from './types';
import { IS_PITCHER, IS_TWO_WAY } from './config';

/**
 * High-school special abilities (M1 vertical slice).
 *
 * These are earned by training patterns during the cultivation window, not by
 * hidden trait luck. M4 will expand this into a full encyclopedia; keep ids
 * stable and effects small so later milestones can layer match / relationship
 * bonuses without rewriting unlock rules.
 */
export interface Ability {
  id: string;
  label: string;
  desc: string;
  /** Which roles can unlock this ability. */
  roles: 'batter' | 'pitcher' | 'any';
  /** True when the ability should unlock for this state (caller filters stage). */
  check: (state: GameState) => boolean;
}

export interface AbilityEffects {
  /** Multiplier applied to gains on matching focus keys. */
  focusBonus: Partial<Record<AttrKey, number>>;
  /** Multiplier on tournament / high-risk injury chance (<1 = safer). */
  injury: number;
  /** Extra motivation recovered when resting. */
  restMotivation: number;
}

export const ABILITIES: Ability[] = [
  {
    id: 'keen-eye',
    label: '機會眼',
    desc: '選球與讀投練出火候。選球成長略快，大賽更吃得開壞球。',
    roles: 'batter',
    check: (s) =>
      (s.drillCounts.video ?? 0) + (s.drillCounts.swing ?? 0) >= 5 || s.attrs.eye >= 50,
  },
  {
    id: 'basepath',
    label: '盜壘起動',
    desc: '第一步比誰都快。跑壘成長略快，體能課的疲勞比較扛得住。',
    roles: 'batter',
    check: (s) => (s.drillCounts.run ?? 0) >= 4 || s.attrs.speed >= 52,
  },
  {
    id: 'range',
    label: '守備範圍',
    desc: '預判落點的腳步。守備成長略快，受傷機率略降。',
    roles: 'batter',
    check: (s) => (s.drillCounts.field ?? 0) >= 4 || s.attrs.fielding >= 50,
  },
  {
    id: 'pull',
    label: '強打拉打',
    desc: '重量室換來的揮擊軸心。長打成長略快。',
    roles: 'batter',
    check: (s) => (s.drillCounts.weight ?? 0) >= 4 || s.attrs.power >= 50,
  },
  {
    id: 'heavy-ball',
    label: '球質沉重',
    desc: '長傳與牛棚堆出來的球威。球速成長略快。',
    roles: 'pitcher',
    check: (s) =>
      (s.drillCounts.longtoss ?? 0) + (s.drillCounts.bullpen ?? 0) >= 5 ||
      s.attrs.velocity >= 52,
  },
];

function roleAllows(ability: Ability, position: Position): boolean {
  if (ability.roles === 'any') return true;
  if (IS_TWO_WAY[position]) return true;
  if (ability.roles === 'pitcher') return IS_PITCHER[position];
  return !IS_PITCHER[position];
}

export function abilityById(id: string): Ability | undefined {
  return ABILITIES.find((a) => a.id === id);
}

export function abilityEffects(abilityIds: string[]): AbilityEffects {
  const has = (id: string) => abilityIds.includes(id);
  const focusBonus: Partial<Record<AttrKey, number>> = {};
  if (has('keen-eye')) focusBonus.eye = 1.14;
  if (has('basepath')) focusBonus.speed = 1.12;
  if (has('range')) focusBonus.fielding = 1.12;
  if (has('pull')) focusBonus.power = 1.14;
  if (has('heavy-ball')) focusBonus.velocity = 1.14;
  return {
    focusBonus,
    injury: has('range') ? 0.9 : 1,
    restMotivation: has('basepath') ? 2 : 0,
  };
}

/**
 * Abilities unlock only in high school — that is the cultivation window M1
 * thickens. Returns newly earned ids (not yet on the roster).
 */
export function newlyUnlockedAbilities(state: GameState): string[] {
  if (state.stage !== 'highschool') return [];
  return ABILITIES.filter(
    (ability) =>
      !state.abilities.includes(ability.id) &&
      roleAllows(ability, state.position) &&
      ability.check(state),
  ).map((ability) => ability.id);
}

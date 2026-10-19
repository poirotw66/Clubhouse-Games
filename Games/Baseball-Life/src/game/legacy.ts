/**
 * M4 — Legacy / New Game+. A retired career can leave one inherit choice for
 * the next free-play run: a mentor style, an ability head-start, or a bloodline
 * attribute bump. Challenge runs ignore pending legacy so fixed seeds stay fair.
 */
import { ABILITIES, abilityById } from './abilities';
import { coachStyleInfo } from './people';
import type { AttrKey, CoachStyle, GameState, Position } from './types';
import { attrsForPosition } from './config';

export type LegacyKind = 'coach' | 'ability-hint' | 'bloodline';

export interface LegacyOption {
  id: string;
  kind: LegacyKind;
  label: string;
  hint: string;
  /** Coach style to seed the next career with (higher starting bond). */
  coachStyle?: CoachStyle;
  /** Ability id that unlocks immediately (or is queued as nearly unlocked). */
  abilityId?: string;
  /** Attribute bonuses for bloodline. */
  attrBonus?: Partial<Record<AttrKey, number>>;
  /** Potential bump per keyed attr. */
  potentialBonus?: number;
}

export interface PendingLegacy {
  fromName: string;
  fromSeed: string;
  fromHof: number;
  options: LegacyOption[];
  /** Set when the player picks one on the create screen. */
  chosenId?: string | null;
}

/** Build 2–3 inherit choices from a finished career. */
export function buildLegacyOptions(state: GameState): LegacyOption[] {
  const options: LegacyOption[] = [];

  if (state.coach) {
    const style = coachStyleInfo(state.coach.style);
    options.push({
      id: `coach-${state.coach.style}`,
      kind: 'coach',
      label: `師承・${style.label}`,
      hint: `下一段人生開局就遇到${style.label}教練（好感較高）。${style.blurb}`,
      coachStyle: state.coach.style,
    });
  }

  // Prefer a positive ability the player actually earned; fall back to a book tip.
  const earnedPositive = state.abilities
    .map((id) => abilityById(id))
    .filter((a): a is NonNullable<typeof a> => !!a && !a.negative);
  const tip =
    earnedPositive[earnedPositive.length - 1] ??
    ABILITIES.find((a) => !a.negative && a.roles !== 'pitcher') ??
    ABILITIES[0];
  if (tip) {
    options.push({
      id: `ability-${tip.id}`,
      kind: 'ability-hint',
      label: `血脈・${tip.label}`,
      hint: `下一段人生開局就帶著【${tip.label}】的感覺（直接覺醒或接近解鎖）。`,
      abilityId: tip.id,
    });
  }

  const keys = attrsForPosition(state.position).slice(0, 2);
  const attrBonus: Partial<Record<AttrKey, number>> = {};
  keys.forEach((key) => {
    attrBonus[key] = 3;
  });
  options.push({
    id: 'bloodline-core',
    kind: 'bloodline',
    label: '家傳・體能底子',
    hint: `主修屬性開局 +3，潛力上限微幅上修。來自 ${state.name} 的二十年。`,
    attrBonus,
    potentialBonus: 4,
  });

  return options.slice(0, 3);
}

export function pendingFromCareer(state: GameState): PendingLegacy | null {
  if (!state.summary) return null;
  const options = buildLegacyOptions(state);
  if (options.length === 0) return null;
  return {
    fromName: state.name,
    fromSeed: state.seedCode,
    fromHof: state.summary.hofScore,
    options,
    chosenId: null,
  };
}

export function legacyById(pending: PendingLegacy, id: string): LegacyOption | undefined {
  return pending.options.find((o) => o.id === id);
}

/** Apply a chosen legacy into a freshly created game state. */
export function applyLegacyToState(state: GameState, option: LegacyOption): void {
  if (option.kind === 'coach' && option.coachStyle && state.coach) {
    state.coach.style = option.coachStyle;
    state.coach.id = `coach-${option.coachStyle}`;
    state.coach.bond = Math.max(state.coach.bond, 48);
    state.log.push({
      id: state.log.length,
      label: '遺產',
      text: `師承仍在：這季的教練走${coachStyleInfo(option.coachStyle).label}路線。`,
      tone: 'good',
    });
  }

  if (option.kind === 'ability-hint' && option.abilityId) {
    const ability = abilityById(option.abilityId);
    if (ability) {
      bumpTowardAbility(state, option.abilityId);
      if (!state.abilities.includes(option.abilityId) && legacyCompatible(option, state.position)) {
        state.abilities.push(option.abilityId);
      }
      state.log.push({
        id: state.log.length,
        label: '遺產',
        text: `血脈隱約記得【${ability.label}】的感覺。`,
        tone: 'great',
      });
    }
  }

  if (option.kind === 'bloodline') {
    Object.entries(option.attrBonus ?? {}).forEach(([key, value]) => {
      const k = key as AttrKey;
      state.attrs[k] = Math.min(99, state.attrs[k] + (value ?? 0));
      if (option.potentialBonus) {
        state.potential[k] = Math.min(99, state.potential[k] + option.potentialBonus);
      }
    });
    state.log.push({
      id: state.log.length,
      label: '遺產',
      text: '家傳的底子還在——開局就比別人厚一截。',
      tone: 'good',
    });
  }
}

function bumpTowardAbility(state: GameState, abilityId: string): void {
  switch (abilityId) {
    case 'keen-eye':
      state.drillCounts.video = Math.max(state.drillCounts.video ?? 0, 4);
      state.drillCounts.swing = Math.max(state.drillCounts.swing ?? 0, 2);
      break;
    case 'basepath':
      state.drillCounts.run = Math.max(state.drillCounts.run ?? 0, 4);
      break;
    case 'range':
      state.drillCounts.field = Math.max(state.drillCounts.field ?? 0, 4);
      break;
    case 'pull':
      state.drillCounts.weight = Math.max(state.drillCounts.weight ?? 0, 4);
      break;
    case 'heavy-ball':
      state.drillCounts.longtoss = Math.max(state.drillCounts.longtoss ?? 0, 3);
      state.drillCounts.bullpen = Math.max(state.drillCounts.bullpen ?? 0, 2);
      break;
    case 'contact-artist':
      state.drillCounts.swing = Math.max(state.drillCounts.swing ?? 0, 6);
      break;
    case 'precision':
      state.drillCounts.bullpen = Math.max(state.drillCounts.bullpen ?? 0, 5);
      break;
    case 'film-room':
      state.drillCounts.video = Math.max(state.drillCounts.video ?? 0, 5);
      break;
    default:
      break;
  }
}

export function legacyCompatible(option: LegacyOption, position: Position): boolean {
  if (option.kind !== 'ability-hint' || !option.abilityId) return true;
  const ability = abilityById(option.abilityId);
  if (!ability) return true;
  if (ability.roles === 'any') return true;
  if (position === 'TW') return true;
  if (ability.roles === 'pitcher') return position === 'P';
  return position !== 'P';
}

/** Shared Connect Four types and rule presets. */

export type PieceColor = 'red' | 'yellow';
export type Cell = PieceColor | null;
export type Board = Cell[][];

export type Difficulty = 'easy' | 'normal' | 'hard';
export type PersonalityId = 'rusher' | 'blocker' | 'architect';
export type BoardPresetId = '7x6' | '8x7' | '9x7';
export type RuleVariantId = 'classic' | 'popout' | 'five';
export type SeriesTarget = 2 | 3 | 5;
export type GameMode = 'two' | 'bot' | 'puzzle';
export type MoveKind = 'drop' | 'pop';

export interface Move {
  kind: MoveKind;
  col: number;
}

export interface RulesConfig {
  cols: number;
  rows: number;
  connectN: number;
  allowPopOut: boolean;
  preset: BoardPresetId;
  variant: RuleVariantId;
}

export interface BoardPreset {
  id: BoardPresetId;
  cols: number;
  rows: number;
  label: string;
  blurb: string;
}

export interface RuleVariant {
  id: RuleVariantId;
  label: string;
  blurb: string;
  /** Default board when this variant is selected. */
  defaultPreset: BoardPresetId;
  connectN: number;
  allowPopOut: boolean;
}

export const BOARD_PRESETS: Record<BoardPresetId, BoardPreset> = {
  '7x6': {
    id: '7x6',
    cols: 7,
    rows: 6,
    label: '7×6',
    blurb: '標準盤',
  },
  '8x7': {
    id: '8x7',
    cols: 8,
    rows: 7,
    label: '8×7',
    blurb: '大盤，戰線更長',
  },
  '9x7': {
    id: '9x7',
    cols: 9,
    rows: 7,
    label: '9×7',
    blurb: '寬盤，適合五子勝',
  },
};

export const RULE_VARIANTS: Record<RuleVariantId, RuleVariant> = {
  classic: {
    id: 'classic',
    label: '經典',
    blurb: '先連四即勝',
    defaultPreset: '7x6',
    connectN: 4,
    allowPopOut: false,
  },
  popout: {
    id: 'popout',
    label: 'PopOut',
    blurb: '可取出底格己子，上方下墜',
    defaultPreset: '7x6',
    connectN: 4,
    allowPopOut: true,
  },
  five: {
    id: 'five',
    label: '五子勝',
    blurb: '先連五即勝',
    defaultPreset: '9x7',
    connectN: 5,
    allowPopOut: false,
  },
};

export const SERIES_TARGETS: SeriesTarget[] = [2, 3, 5];
export const DEFAULT_SERIES_TARGET: SeriesTarget = 3;

export function buildRules(
  variant: RuleVariantId,
  preset: BoardPresetId,
): RulesConfig {
  const v = RULE_VARIANTS[variant];
  const p = BOARD_PRESETS[preset];
  return {
    cols: p.cols,
    rows: p.rows,
    connectN: v.connectN,
    allowPopOut: v.allowPopOut,
    preset,
    variant,
  };
}

export function opponent(color: PieceColor): PieceColor {
  return color === 'red' ? 'yellow' : 'red';
}

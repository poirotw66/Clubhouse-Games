export interface Tile {
  id: number;
  left: number;
  right: number;
}

export type PlayerId = 0 | 1;

/** Draw = boneyard; Block = pass; Fives = All Fives scoring + spinner. */
export type RuleVariant = 'draw' | 'block' | 'fives';

/** Open ends of the layout. Up/down only after the spinner is branched. */
export type EndId = 'left' | 'right' | 'up' | 'down';

export const ALL_ENDS: EndId[] = ['left', 'right', 'up', 'down'];
export const LINE_ENDS: EndId[] = ['left', 'right'];

/** One tile on the board; outward faces the open end of its arm. */
export interface PlacedTile {
  tile: Tile;
  inward: number;
  outward: number;
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export const MATCH_TARGETS = [61, 100, 150] as const;
export type MatchTarget = (typeof MATCH_TARGETS)[number];
export const DEFAULT_MATCH_TARGET: MatchTarget = 100;

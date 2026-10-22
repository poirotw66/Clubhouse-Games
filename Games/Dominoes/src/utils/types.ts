export interface Tile {
  id: number;
  left: number;
  right: number;
}

/** Seat index around the table (0 = human / south). */
export type SeatId = 0 | 1 | 2 | 3;

/** @deprecated Prefer SeatId — kept for older call sites. */
export type PlayerId = SeatId;

export type PlayerCount = 2 | 4;

/** Team index: even seats vs odd seats in partners play. */
export type TeamId = 0 | 1;

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

/** Hand size by table size (double-six). */
export function handSizeFor(playerCount: PlayerCount): number {
  return playerCount === 4 ? 5 : 7;
}

export function teamOf(seat: SeatId, playerCount: PlayerCount): TeamId {
  if (playerCount === 2) return seat as TeamId;
  return (seat % 2) as TeamId;
}

export function partnerOf(seat: SeatId): SeatId {
  return ((seat + 2) % 4) as SeatId;
}

export function seatsFor(playerCount: PlayerCount): SeatId[] {
  if (playerCount === 2) return [0, 1];
  return [0, 1, 2, 3];
}

export function opponentSeats(seat: SeatId, playerCount: PlayerCount): SeatId[] {
  return seatsFor(playerCount).filter((s) => teamOf(s, playerCount) !== teamOf(seat, playerCount));
}

export function nextSeat(seat: SeatId, playerCount: PlayerCount): SeatId {
  return ((seat + 1) % playerCount) as SeatId;
}

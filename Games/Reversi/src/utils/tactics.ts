/**
 * Reversi Tactical Telemetry & Cockpit Analytics
 * Provides positional risk analysis, corner dominance, mobility indices,
 * flip potential mapping, and coordinate notations.
 */

import {
  CORNERS,
  X_SQUARES,
  countEmpties,
  getFlips,
  getLegalMoves,
  opponent,
  type Board,
  type Cell,
  type Piece,
} from './reversiLogic';

export const C_SQUARES: [number, number][] = [
  [0, 1],
  [1, 0],
  [0, 6],
  [1, 7],
  [6, 0],
  [7, 1],
  [6, 7],
  [7, 6],
];

export type DangerZoneType = 'corner' | 'x-square' | 'c-square' | 'safe';

/**
 * Maps coordinate (r, c) to Reversi algebraic notation (e.g. 0,0 -> "A1", 3,4 -> "E4").
 * Columns: A-H (0 to 7)
 * Rows: 1-8 (0 to 7)
 */
export function toAlgebraic(r: number, c: number): string {
  if (r < 0 || r > 7 || c < 0 || c > 7) return '??';
  const colChar = String.fromCharCode(65 + c);
  const rowChar = String(r + 1);
  return `${colChar}${rowChar}`;
}

/**
 * Returns which corner a dangerous X-square or C-square affects.
 */
export function getAssociatedCorner(r: number, c: number): [number, number] | null {
  if ((r === 1 && c === 1) || (r === 0 && c === 1) || (r === 1 && c === 0)) return [0, 0];
  if ((r === 1 && c === 6) || (r === 0 && c === 6) || (r === 1 && c === 7)) return [0, 7];
  if ((r === 6 && c === 1) || (r === 6 && c === 0) || (r === 7 && c === 1)) return [7, 0];
  if ((r === 6 && c === 6) || (r === 6 && c === 7) || (r === 7 && c === 6)) return [7, 7];
  return null;
}

/**
 * Checks whether (r, c) is a Corner, or a hazardous X or C square adjacent to an OPEN corner.
 * If the corner is already occupied, X and C squares lose their fatal penalty.
 */
export function getCellRiskType(board: Board, r: number, c: number): DangerZoneType {
  const isCorner = CORNERS.some(([cr, cc]) => cr === r && cc === c);
  if (isCorner) return 'corner';

  const isXSquare = X_SQUARES.some(([xr, xc]) => xr === r && xc === c);
  if (isXSquare) {
    const corner = getAssociatedCorner(r, c);
    if (corner && board[corner[0]][corner[1]] === null) {
      return 'x-square';
    }
  }

  const isCSquare = C_SQUARES.some(([cr, cc]) => cr === r && cc === c);
  if (isCSquare) {
    const corner = getAssociatedCorner(r, c);
    if (corner && board[corner[0]][corner[1]] === null) {
      return 'c-square';
    }
  }

  return 'safe';
}

export interface CornerControl {
  black: number;
  white: number;
  empty: number;
  tl: Cell;
  tr: Cell;
  bl: Cell;
  br: Cell;
}

/**
 * Evaluates the 4 corners and calculates ownership.
 */
export function calculateCornerControl(board: Board): CornerControl {
  const tl = board[0][0];
  const tr = board[0][7];
  const bl = board[7][0];
  const br = board[7][7];

  const corners = [tl, tr, bl, br];
  let black = 0;
  let white = 0;
  let empty = 0;

  for (const c of corners) {
    if (c === 'black') black++;
    else if (c === 'white') white++;
    else empty++;
  }

  return { black, white, empty, tl, tr, bl, br };
}

export type MobilityPressureStatus = 'squeeze' | 'dominant' | 'balanced' | 'constrained';

export interface MobilityData {
  currentLegalCount: number;
  opponentLegalCount: number;
  pressure: MobilityPressureStatus;
  leadRatio: number;
}

/**
 * Compares current player mobility with opponent mobility.
 */
export function calculateMobility(board: Board, currentTurn: Piece): MobilityData {
  const currentLegal = getLegalMoves(board, currentTurn).length;
  const opp = opponent(currentTurn);
  const oppLegal = getLegalMoves(board, opp).length;

  let pressure: MobilityPressureStatus = 'balanced';
  if (oppLegal === 0 && currentLegal > 0) {
    pressure = 'squeeze';
  } else if (currentLegal >= oppLegal * 2 && currentLegal > 3) {
    pressure = 'dominant';
  } else if (oppLegal >= currentLegal * 2 && oppLegal > 3) {
    pressure = 'constrained';
  }

  const denominator = Math.max(1, currentLegal + oppLegal);
  const leadRatio = Math.round((currentLegal / denominator) * 100);

  return {
    currentLegalCount: currentLegal,
    opponentLegalCount: oppLegal,
    pressure,
    leadRatio,
  };
}

/**
 * Precomputes immediate flip counts for all legal moves of the given turn.
 */
export function calculateFlipsMap(board: Board, turn: Piece): Map<string, number> {
  const legalMoves = getLegalMoves(board, turn);
  const map = new Map<string, number>();
  for (const [r, c] of legalMoves) {
    const flips = getFlips(board, r, c, turn);
    map.set(`${r},${c}`, flips.length);
  }
  return map;
}

export type GameStage = 'opening' | 'midgame' | 'endgame';

export function getGameStage(board: Board): GameStage {
  const empties = countEmpties(board);
  if (empties >= 48) return 'opening';
  if (empties <= 14) return 'endgame';
  return 'midgame';
}

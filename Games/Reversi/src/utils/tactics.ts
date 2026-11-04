/**
 * Reversi Tactical Telemetry & Cockpit Analytics
 * Provides positional risk analysis, corner dominance, mobility indices,
 * flip potential mapping, and coordinate notations.
 */

import {
  CORNERS,
  DIRECTIONS,
  SIZE,
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

export interface StabilityAnalysis {
  blackStable: number;
  whiteStable: number;
  blackFrontier: number;
  whiteFrontier: number;
  blackInterior: number;
  whiteInterior: number;
  blackFrontierRate: number;
  whiteFrontierRate: number;
  stableSet: Set<string>;
  frontierSet: Set<string>;
  interiorSet: Set<string>;
}

/**
 * Evaluates permanently stable discs, frontier discs, and interior discs.
 * Stable discs are anchored by corners and edges and can never be flipped.
 */
export function calculateStability(board: Board): StabilityAnalysis {
  const stableSet = new Set<string>();
  const frontierSet = new Set<string>();
  const interiorSet = new Set<string>();

  // 1. Four corners are unconditionally stable once occupied
  if (board[0][0] !== null) stableSet.add('0,0');
  if (board[0][7] !== null) stableSet.add('0,7');
  if (board[7][0] !== null) stableSet.add('7,0');
  if (board[7][7] !== null) stableSet.add('7,7');

  // 2. Scan edges anchored to corners
  // Top edge (row 0)
  if (stableSet.has('0,0')) {
    const colr = board[0][0];
    for (let c = 1; c <= 6; c++) {
      if (board[0][c] === colr) stableSet.add(`0,${c}`);
      else break;
    }
  }
  if (stableSet.has('0,7')) {
    const colr = board[0][7];
    for (let c = 6; c >= 1; c--) {
      if (board[0][c] === colr) stableSet.add(`0,${c}`);
      else break;
    }
  }
  if (board[0].every((cell) => cell !== null)) {
    for (let c = 0; c < SIZE; c++) stableSet.add(`0,${c}`);
  }

  // Bottom edge (row 7)
  if (stableSet.has('7,0')) {
    const colr = board[7][0];
    for (let c = 1; c <= 6; c++) {
      if (board[7][c] === colr) stableSet.add(`7,${c}`);
      else break;
    }
  }
  if (stableSet.has('7,7')) {
    const colr = board[7][7];
    for (let c = 6; c >= 1; c--) {
      if (board[7][c] === colr) stableSet.add(`7,${c}`);
      else break;
    }
  }
  if (board[7].every((cell) => cell !== null)) {
    for (let c = 0; c < SIZE; c++) stableSet.add(`7,${c}`);
  }

  // Left edge (col 0)
  if (stableSet.has('0,0')) {
    const colr = board[0][0];
    for (let r = 1; r <= 6; r++) {
      if (board[r][0] === colr) stableSet.add(`${r},0`);
      else break;
    }
  }
  if (stableSet.has('7,0')) {
    const colr = board[7][0];
    for (let r = 6; r >= 1; r--) {
      if (board[r][0] === colr) stableSet.add(`${r},0`);
      else break;
    }
  }
  if (Array.from({ length: SIZE }, (_, r) => board[r][0]).every((cell) => cell !== null)) {
    for (let r = 0; r < SIZE; r++) stableSet.add(`${r},0`);
  }

  // Right edge (col 7)
  if (stableSet.has('0,7')) {
    const colr = board[0][7];
    for (let r = 1; r <= 6; r++) {
      if (board[r][7] === colr) stableSet.add(`${r},7`);
      else break;
    }
  }
  if (stableSet.has('7,7')) {
    const colr = board[7][7];
    for (let r = 6; r >= 1; r--) {
      if (board[r][7] === colr) stableSet.add(`${r},7`);
      else break;
    }
  }
  if (Array.from({ length: SIZE }, (_, r) => board[r][7]).every((cell) => cell !== null)) {
    for (let r = 0; r < SIZE; r++) stableSet.add(`${r},7`);
  }

  // 3. Iterative relaxation for interior stable discs
  const AXES: [number, number][] = [
    [0, 1], // Horizontal
    [1, 0], // Vertical
    [1, 1], // Diagonal \
    [1, -1], // Diagonal /
  ];

  let changed = true;
  let iterations = 0;
  while (changed && iterations < 8) {
    changed = false;
    iterations++;

    for (let r = 1; r < SIZE - 1; r++) {
      for (let c = 1; c < SIZE - 1; c++) {
        const key = `${r},${c}`;
        if (stableSet.has(key)) continue;
        const cell = board[r][c];
        if (cell === null) continue;

        let allAxesStable = true;
        for (const [dr, dc] of AXES) {
          // Check positive ray
          let posStable = false;
          let pr = r + dr;
          let pc = c + dc;
          while (pr >= 0 && pr < SIZE && pc >= 0 && pc < SIZE) {
            if (!stableSet.has(`${pr},${pc}`) || board[pr][pc] !== cell) {
              break;
            }
            pr += dr;
            pc += dc;
          }
          if (pr < 0 || pr >= SIZE || pc < 0 || pc >= SIZE) {
            posStable = true;
          }

          // Check negative ray
          let negStable = false;
          let nr = r - dr;
          let nc = c - dc;
          while (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE) {
            if (!stableSet.has(`${nr},${nc}`) || board[nr][nc] !== cell) {
              break;
            }
            nr -= dr;
            nc -= dc;
          }
          if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) {
            negStable = true;
          }

          if (!posStable || !negStable) {
            allAxesStable = false;
            break;
          }
        }

        if (allAxesStable) {
          stableSet.add(key);
          changed = true;
        }
      }
    }
  }

  // 4. Frontier & Interior classification
  let blackCount = 0;
  let whiteCount = 0;
  let blackStable = 0;
  let whiteStable = 0;
  let blackFrontier = 0;
  let whiteFrontier = 0;
  let blackInterior = 0;
  let whiteInterior = 0;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = board[r][c];
      if (cell === null) continue;
      const key = `${r},${c}`;

      if (cell === 'black') {
        blackCount++;
        if (stableSet.has(key)) blackStable++;
      } else {
        whiteCount++;
        if (stableSet.has(key)) whiteStable++;
      }

      let hasEmptyNeighbor = false;
      for (const [dr, dc] of DIRECTIONS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] === null) {
          hasEmptyNeighbor = true;
          break;
        }
      }

      if (hasEmptyNeighbor) {
        frontierSet.add(key);
        if (cell === 'black') blackFrontier++;
        else whiteFrontier++;
      } else {
        interiorSet.add(key);
        if (cell === 'black') blackInterior++;
        else whiteInterior++;
      }
    }
  }

  const blackFrontierRate =
    blackCount > 0 ? Math.round((blackFrontier / blackCount) * 100) : 0;
  const whiteFrontierRate =
    whiteCount > 0 ? Math.round((whiteFrontier / whiteCount) * 100) : 0;

  return {
    blackStable,
    whiteStable,
    blackFrontier,
    whiteFrontier,
    blackInterior,
    whiteInterior,
    blackFrontierRate,
    whiteFrontierRate,
    stableSet,
    frontierSet,
    interiorSet,
  };
}

export interface CascadeStep {
  stepIndex: number;
  delayMs: number;
}

export interface CascadeWaveItem {
  r: number;
  c: number;
  key: string;
  dist: number;
  stepIndex: number;
  delayMs: number;
  dr: number;
  dc: number;
}

export interface CascadeWaveResult {
  placed: [number, number];
  isCorner: boolean;
  totalFlips: number;
  items: CascadeWaveItem[];
  itemsByStep: CascadeWaveItem[][];
  maxStep: number;
  comboTitle?: string;
}

/**
 * Calculates Domino Cascade Wave properties for a move at (r, c).
 * Flips propagate sequentially outward along rays.
 */
export function calculateCascadeWave(
  board: Board,
  r: number,
  c: number,
  color: Piece,
): CascadeWaveResult {
  const isCorner = (r === 0 || r === 7) && (c === 0 || c === 7);
  const items: CascadeWaveItem[] = [];

  for (const [dr, dc] of DIRECTIONS) {
    let i = r + dr;
    let j = c + dc;
    const ray: [number, number][] = [];
    while (i >= 0 && i < SIZE && j >= 0 && j < SIZE) {
      const cell = board[i][j];
      if (cell === null) {
        ray.length = 0;
        break;
      }
      if (cell === color) {
        break;
      }
      ray.push([i, j]);
      i += dr;
      j += dc;
    }

    if (i < 0 || i >= SIZE || j < 0 || j >= SIZE || board[i][j] !== color) {
      ray.length = 0;
    }

    for (const [fr, fc] of ray) {
      const dist = Math.max(Math.abs(fr - r), Math.abs(fc - c));
      const stepIndex = dist - 1;
      const delayMs = stepIndex * 70;
      items.push({
        r: fr,
        c: fc,
        key: `${fr},${fc}`,
        dist,
        stepIndex,
        delayMs,
        dr,
        dc,
      });
    }
  }

  // Group items by step
  let maxStep = 0;
  for (const item of items) {
    if (item.stepIndex > maxStep) maxStep = item.stepIndex;
  }

  const itemsByStep: CascadeWaveItem[][] = Array.from(
    { length: items.length > 0 ? maxStep + 1 : 0 },
    () => [],
  );

  for (const item of items) {
    itemsByStep[item.stepIndex].push(item);
  }

  let comboTitle: string | undefined;
  if (items.length >= 8) {
    comboTitle = '👑 8 翻巨浪大逆轉！';
  } else if (items.length >= 5) {
    comboTitle = '🔥 5 連波大連鎖！';
  } else if (items.length >= 3) {
    comboTitle = '⚡ 3 連翻連鎖！';
  }

  return {
    placed: [r, c],
    isCorner,
    totalFlips: items.length,
    items,
    itemsByStep,
    maxStep,
    comboTitle,
  };
}

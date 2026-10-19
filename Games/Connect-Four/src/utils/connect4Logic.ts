/**
 * Connect Four engine: variable boards, PopOut, five-in-a-row, styled AI.
 * Row 0 = top; pieces drop to the lowest empty cell in a column.
 */

import {
  BOARD_PRESETS,
  RULE_VARIANTS,
  buildRules,
  opponent,
  type Board,
  type BoardPresetId,
  type Cell,
  type Difficulty,
  type Move,
  type PersonalityId,
  type PieceColor,
  type RulesConfig,
  type RuleVariantId,
} from './types';

export type {
  Board,
  BoardPresetId,
  Cell,
  Difficulty,
  Move,
  PersonalityId,
  PieceColor,
  RulesConfig,
  RuleVariantId,
};
export {
  BOARD_PRESETS,
  RULE_VARIANTS,
  buildRules,
  opponent,
};

/** Back-compat constants for the classic 7×6 layout. */
export const COLS = 7;
export const ROWS = 6;

export function createInitialBoard(rules: RulesConfig): Board {
  return Array.from({ length: rules.rows }, () =>
    Array<Cell>(rules.cols).fill(null),
  );
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

/** Row where a piece would land in column c, or null if full. */
export function getDropRow(board: Board, col: number, rules: RulesConfig): number | null {
  if (col < 0 || col >= rules.cols) return null;
  for (let r = rules.rows - 1; r >= 0; r--) {
    if (board[r][col] === null) return r;
  }
  return null;
}

export function getLegalDropColumns(board: Board, rules: RulesConfig): number[] {
  const out: number[] = [];
  for (let c = 0; c < rules.cols; c++) {
    if (getDropRow(board, c, rules) !== null) out.push(c);
  }
  return out;
}

/** @deprecated Prefer getLegalDropColumns — kept for older call sites/tests. */
export function getLegalColumns(board: Board, rules?: RulesConfig): number[] {
  return getLegalDropColumns(board, rules ?? buildRules('classic', '7x6'));
}

export function dropPiece(
  board: Board,
  col: number,
  color: PieceColor,
  rules: RulesConfig,
): Board | null {
  const row = getDropRow(board, col, rules);
  if (row === null) return null;
  const next = cloneBoard(board);
  next[row][col] = color;
  return next;
}

/** Columns where the bottom cell is the given color (PopOut candidates). */
export function getPopOutColumns(
  board: Board,
  color: PieceColor,
  rules: RulesConfig,
): number[] {
  if (!rules.allowPopOut) return [];
  const out: number[] = [];
  for (let c = 0; c < rules.cols; c++) {
    if (board[rules.rows - 1][c] === color) out.push(c);
  }
  return out;
}

/** Remove the bottom piece of a column and let pieces above fall. */
export function popOutPiece(board: Board, col: number, rules: RulesConfig): Board | null {
  if (col < 0 || col >= rules.cols) return null;
  if (board[rules.rows - 1][col] === null) return null;
  const next = cloneBoard(board);
  for (let r = rules.rows - 1; r > 0; r--) {
    next[r][col] = next[r - 1][col];
  }
  next[0][col] = null;
  return next;
}

export function getLegalMoves(
  board: Board,
  color: PieceColor,
  rules: RulesConfig,
): Move[] {
  const drops = getLegalDropColumns(board, rules).map(
    (col): Move => ({ kind: 'drop', col }),
  );
  const pops = getPopOutColumns(board, color, rules).map(
    (col): Move => ({ kind: 'pop', col }),
  );
  return [...drops, ...pops];
}

export function applyMove(
  board: Board,
  move: Move,
  color: PieceColor,
  rules: RulesConfig,
): Board | null {
  if (move.kind === 'drop') return dropPiece(board, move.col, color, rules);
  return popOutPiece(board, move.col, rules);
}

const DIRECTIONS: [number, number][] = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
];

function countInDirection(
  board: Board,
  row: number,
  col: number,
  color: PieceColor,
  dr: number,
  dc: number,
  rules: RulesConfig,
): number {
  let count = 0;
  let r = row;
  let c = col;
  while (
    r >= 0 &&
    r < rules.rows &&
    c >= 0 &&
    c < rules.cols &&
    board[r][c] === color
  ) {
    count++;
    r += dr;
    c += dc;
  }
  return count;
}

/** True if color has connectN through (row, col). */
export function hasWonAt(
  board: Board,
  row: number,
  col: number,
  color: PieceColor,
  rules: RulesConfig,
): boolean {
  for (const [dr, dc] of DIRECTIONS) {
    const count =
      countInDirection(board, row, col, color, dr, dc, rules) +
      countInDirection(board, row, col, color, -dr, -dc, rules) -
      1;
    if (count >= rules.connectN) return true;
  }
  return false;
}

/** Scan the whole board for any connectN of `color`. */
export function hasConnectN(board: Board, color: PieceColor, rules: RulesConfig): boolean {
  for (let r = 0; r < rules.rows; r++) {
    for (let c = 0; c < rules.cols; c++) {
      if (board[r][c] !== color) continue;
      if (hasWonAt(board, r, c, color, rules)) return true;
    }
  }
  return false;
}

/**
 * After a move by `mover`, decide the winner.
 * Drop: only the new piece can complete a line.
 * Pop: gravity can create lines for either side — mover wins ties.
 */
export function resolveWinnerAfterMove(
  board: Board,
  mover: PieceColor,
  move: Move,
  dropRow: number | null,
  rules: RulesConfig,
): PieceColor | null {
  if (move.kind === 'drop' && dropRow !== null) {
    return hasWonAt(board, dropRow, move.col, mover, rules) ? mover : null;
  }
  const moverWin = hasConnectN(board, mover, rules);
  if (moverWin) return mover;
  const opp = opponent(mover);
  if (hasConnectN(board, opp, rules)) return opp;
  return null;
}

/** Cells belonging to a winning connectN line, if any. */
export function getWinningCells(board: Board, rules: RulesConfig): Set<string> | null {
  for (let r = 0; r < rules.rows; r++) {
    for (let c = 0; c < rules.cols; c++) {
      const color = board[r][c];
      if (!color || !hasWonAt(board, r, c, color, rules)) continue;
      for (const [dr, dc] of DIRECTIONS) {
        const line: [number, number][] = [[r, c]];
        let rr = r + dr;
        let cc = c + dc;
        while (
          rr >= 0 &&
          rr < rules.rows &&
          cc >= 0 &&
          cc < rules.cols &&
          board[rr][cc] === color
        ) {
          line.push([rr, cc]);
          rr += dr;
          cc += dc;
        }
        rr = r - dr;
        cc = c - dc;
        while (
          rr >= 0 &&
          rr < rules.rows &&
          cc >= 0 &&
          cc < rules.cols &&
          board[rr][cc] === color
        ) {
          line.unshift([rr, cc]);
          rr -= dr;
          cc -= dc;
        }
        if (line.length >= rules.connectN) {
          return new Set(line.map(([row, col]) => `${row},${col}`));
        }
      }
    }
  }
  return null;
}

export function isBoardFull(board: Board, rules: RulesConfig): boolean {
  for (let c = 0; c < rules.cols; c++) {
    if (board[0][c] === null) return false;
  }
  return true;
}

const WIN_SCORE = 1_000_000;

export type Personality = {
  id: PersonalityId;
  name: string;
  blurb: string;
  /** Prefer center columns when scores are close. */
  centerBias: number;
  /** Weight on own threats / open windows. */
  offenseWeight: number;
  /** Weight on denying opponent windows. */
  defenseWeight: number;
  /** Bonus for creating dual threats (forks). */
  forkWeight: number;
  /** Affinity for choosing PopOut when scores are close. */
  popoutAffinity: number;
};

export const PERSONALITIES: Record<PersonalityId, Personality> = {
  rusher: {
    id: 'rusher',
    name: '衝刺手',
    blurb: '搶中路、偏進攻，少想防守',
    centerBias: 1.4,
    offenseWeight: 1.35,
    defenseWeight: 0.75,
    forkWeight: 1.1,
    popoutAffinity: 0.3,
  },
  blocker: {
    id: 'blocker',
    name: '鐵壁',
    blurb: '優先擋殺，穩紮穩打',
    centerBias: 0.9,
    offenseWeight: 0.8,
    defenseWeight: 1.45,
    forkWeight: 0.95,
    popoutAffinity: 0.6,
  },
  architect: {
    id: 'architect',
    name: '佈局師',
    blurb: '築雙殺、愛用 PopOut 重組',
    centerBias: 1.0,
    offenseWeight: 1.05,
    defenseWeight: 1.05,
    forkWeight: 1.55,
    popoutAffinity: 1.35,
  },
};

export const PERSONALITY_IDS = Object.keys(PERSONALITIES) as PersonalityId[];

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '簡單',
  normal: '普通',
  hard: '困難',
};

export const DIFFICULTY_BLURBS: Record<Difficulty, string> = {
  easy: '常亂下，擋殺不穩',
  normal: '會擋連三，看短線',
  hard: '深算雙殺，不犯錯',
};

export type DifficultyConfig = {
  depth: number;
  blunderRate: number;
};

const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: { depth: 1, blunderRate: 0.45 },
  normal: { depth: 3, blunderRate: 0.12 },
  hard: { depth: 6, blunderRate: 0 },
};

export function getDifficultyConfig(difficulty: Difficulty): DifficultyConfig {
  return DIFFICULTY[difficulty];
}

function scoreWindow(
  cells: Cell[],
  player: PieceColor,
  connectN: number,
): { offense: number; defense: number } {
  let playerCount = 0;
  let empty = 0;
  let oppCount = 0;
  for (const cell of cells) {
    if (cell === null) empty++;
    else if (cell === player) playerCount++;
    else oppCount++;
  }
  if (playerCount > 0 && oppCount > 0) return { offense: 0, defense: 0 };

  const scoreSide = (count: number, empties: number): number => {
    if (count === 0) return 0;
    if (count + empties < connectN) return 0;
    if (count >= connectN) return 50_000;
    if (count === connectN - 1 && empties >= 1) return 120;
    if (count === connectN - 2 && empties >= 2) return 20;
    if (count === 1 && empties >= connectN - 1) return 2;
    return 4;
  };

  return {
    offense: scoreSide(playerCount, empty),
    defense: scoreSide(oppCount, empty),
  };
}

function collectWindows(board: Board, rules: RulesConfig): Cell[][] {
  const windows: Cell[][] = [];
  const n = rules.connectN;
  for (let r = 0; r < rules.rows; r++) {
    for (let c = 0; c <= rules.cols - n; c++) {
      windows.push(Array.from({ length: n }, (_, i) => board[r][c + i]));
    }
  }
  for (let c = 0; c < rules.cols; c++) {
    for (let r = 0; r <= rules.rows - n; r++) {
      windows.push(Array.from({ length: n }, (_, i) => board[r + i][c]));
    }
  }
  for (let r = 0; r <= rules.rows - n; r++) {
    for (let c = 0; c <= rules.cols - n; c++) {
      windows.push(Array.from({ length: n }, (_, i) => board[r + i][c + i]));
    }
  }
  for (let r = n - 1; r < rules.rows; r++) {
    for (let c = 0; c <= rules.cols - n; c++) {
      windows.push(Array.from({ length: n }, (_, i) => board[r - i][c + i]));
    }
  }
  return windows;
}

/** Count open threats (connectN-1 with one empty that is currently droppable). */
function countImmediateThreats(
  board: Board,
  color: PieceColor,
  rules: RulesConfig,
): number {
  let threats = 0;
  for (const col of getLegalDropColumns(board, rules)) {
    const row = getDropRow(board, col, rules);
    if (row === null) continue;
    const next = dropPiece(board, col, color, rules);
    if (next && hasWonAt(next, row, col, color, rules)) threats++;
  }
  return threats;
}

export function evaluateBoard(
  board: Board,
  player: PieceColor,
  rules: RulesConfig,
  style: Personality = PERSONALITIES.architect,
): number {
  const opp = opponent(player);
  let offense = 0;
  let defense = 0;
  for (const win of collectWindows(board, rules)) {
    const self = scoreWindow(win, player, rules.connectN);
    offense += self.offense;
    defense += self.defense;
  }

  const center = (rules.cols - 1) / 2;
  let centerScore = 0;
  for (let c = 0; c < rules.cols; c++) {
    const weight = Math.max(0, 3 - Math.abs(c - center));
    for (let r = 0; r < rules.rows; r++) {
      if (board[r][c] === player) centerScore += weight;
      if (board[r][c] === opp) centerScore -= weight;
    }
  }

  const ownThreats = countImmediateThreats(board, player, rules);
  const oppThreats = countImmediateThreats(board, opp, rules);
  const forkBonus =
    (ownThreats >= 2 ? 80 : ownThreats === 1 ? 15 : 0) -
    (oppThreats >= 2 ? 90 : oppThreats === 1 ? 25 : 0);

  return (
    offense * style.offenseWeight -
    defense * style.defenseWeight +
    centerScore * 2 * style.centerBias +
    forkBonus * style.forkWeight
  );
}

function orderMoves(moves: Move[], rules: RulesConfig): Move[] {
  const center = (rules.cols - 1) / 2;
  return [...moves].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'drop' ? -1 : 1;
    return Math.abs(a.col - center) - Math.abs(b.col - center) || a.col - b.col;
  });
}

function terminalLossDepth(
  board: Board,
  lastMove: Move,
  lastDropRow: number | null,
  previousTurn: PieceColor,
  depth: number,
  rules: RulesConfig,
): number | null {
  const winner = resolveWinnerAfterMove(
    board,
    previousTurn,
    lastMove,
    lastDropRow,
    rules,
  );
  if (!winner) return null;
  // From current `turn`'s view the previous mover just won → loss.
  return -WIN_SCORE - depth;
}

function negamax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  turn: PieceColor,
  lastMove: Move | null,
  lastDropRow: number | null,
  previousTurn: PieceColor | null,
  rules: RulesConfig,
  style: Personality,
): number {
  if (lastMove && previousTurn) {
    const terminal = terminalLossDepth(
      board,
      lastMove,
      lastDropRow,
      previousTurn,
      depth,
      rules,
    );
    if (terminal !== null) return terminal;
  }
  if (depth <= 0 || isBoardFull(board, rules)) {
    return evaluateBoard(board, turn, rules, style);
  }

  const legal = orderMoves(getLegalMoves(board, turn, rules), rules);
  if (legal.length === 0) return evaluateBoard(board, turn, rules, style);

  let value = -Infinity;
  for (const move of legal) {
    const dropRow =
      move.kind === 'drop' ? getDropRow(board, move.col, rules) : null;
    const next = applyMove(board, move, turn, rules);
    if (!next) continue;
    const score = -negamax(
      next,
      depth - 1,
      -beta,
      -alpha,
      opponent(turn),
      move,
      dropRow,
      turn,
      rules,
      style,
    );
    if (score > value) value = score;
    if (value > alpha) alpha = value;
    if (alpha >= beta) break;
  }
  return value;
}

function personalityTieBreak(
  move: Move,
  rules: RulesConfig,
  style: Personality,
): number {
  const center = (rules.cols - 1) / 2;
  let score = -Math.abs(move.col - center) * style.centerBias;
  if (move.kind === 'pop') score += 2 * style.popoutAffinity;
  else score += 0.5;
  return score;
}

/**
 * Pick a move for the bot. Ties among equal search scores are broken by
 * personality style, then at random so rematches do not replay identically.
 */
export function pickBotMove(
  board: Board,
  color: PieceColor,
  difficulty: Difficulty = 'normal',
  personality: PersonalityId = 'architect',
  rules: RulesConfig = buildRules('classic', '7x6'),
): Move | null {
  const legal = getLegalMoves(board, color, rules);
  if (legal.length === 0) return null;
  if (legal.length === 1) return legal[0];

  const config = DIFFICULTY[difficulty];
  const style = PERSONALITIES[personality];

  // Soften hard search on large / PopOut boards so the main thread stays responsive.
  let depth = config.depth;
  if (rules.allowPopOut || rules.cols >= 8) {
    depth = Math.max(1, depth - (rules.allowPopOut ? 1 : 0) - (rules.cols >= 9 ? 1 : 0));
  }

  if (config.blunderRate > 0 && Math.random() < config.blunderRate) {
    // True random legal move — personality only steers non-blunder search.
    return legal[Math.floor(Math.random() * legal.length)];
  }

  let best: Move[] = [];
  let bestScore = -Infinity;
  for (const move of orderMoves(legal, rules)) {
    const dropRow =
      move.kind === 'drop' ? getDropRow(board, move.col, rules) : null;
    const next = applyMove(board, move, color, rules);
    if (!next) continue;
    let score = -negamax(
      next,
      depth - 1,
      -Infinity,
      Infinity,
      opponent(color),
      move,
      dropRow,
      color,
      rules,
      style,
    );
    // Style nudge among near-equal lines (never overrides a forced win/loss).
    if (Math.abs(score) < WIN_SCORE / 2) {
      score += personalityTieBreak(move, rules, style) * 3;
    }
    if (score > bestScore) {
      bestScore = score;
      best = [move];
    } else if (score === bestScore) {
      best.push(move);
    }
  }
  if (best.length === 0) return legal[0];
  return best[Math.floor(Math.random() * best.length)];
}

/** Convenience wrapper returning only a drop column (classic boards / hints). */
export function pickBotColumn(
  board: Board,
  color: PieceColor,
  difficulty: Difficulty = 'normal',
  personality: PersonalityId = 'architect',
  rules: RulesConfig = buildRules('classic', '7x6'),
): number | null {
  const move = pickBotMove(board, color, difficulty, personality, rules);
  if (!move) return null;
  if (move.kind === 'drop') return move.col;
  // Hint / legacy callers expect a column; prefer a drop if the best was a pop.
  const drop = getLegalDropColumns(board, rules);
  if (drop.length === 0) return move.col;
  const preferred = pickBotMove(
    board,
    color,
    difficulty,
    personality,
    { ...rules, allowPopOut: false },
  );
  return preferred?.col ?? drop[Math.floor(drop.length / 2)];
}

export function moveKey(move: Move): string {
  return `${move.kind}:${move.col}`;
}

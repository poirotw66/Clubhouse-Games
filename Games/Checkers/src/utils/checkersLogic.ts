/**
 * Checkers / Draughts engine.
 * American 8×8 (short kings) and International 10×10 (flying kings, majority capture).
 */

import { RULESETS, type Ruleset, type RulesetId } from './rules';

export type { Ruleset, RulesetId } from './rules';
export { RULESETS, RULESET_IDS, colLabels } from './rules';

export type PieceColor = 'black' | 'white';

export interface Piece {
  color: PieceColor;
  king: boolean;
}

export type Cell = Piece | null;
export type Board = Cell[][];

/** Move: path[0]=from, path[1..]=landing squares (captures between hops). */
export interface Move {
  from: [number, number];
  path: [number, number][];
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '簡單',
  normal: '普通',
  hard: '困難',
};

export const DIFFICULTY_BLURBS: Record<Difficulty, string> = {
  easy: '淺看兩步，常亂走',
  normal: '中度搜尋，偶有失誤',
  hard: '深算吃子，不犯錯',
};

export type DifficultyConfig = {
  depth: number;
  blunderRate: number;
};

const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: { depth: 2, blunderRate: 0.45 },
  normal: { depth: 3, blunderRate: 0.12 },
  hard: { depth: 6, blunderRate: 0 },
};

export function getDifficultyConfig(difficulty: Difficulty): DifficultyConfig {
  return DIFFICULTY[difficulty];
}

function opponent(color: PieceColor): PieceColor {
  return color === 'black' ? 'white' : 'black';
}

export function isDark(r: number, c: number): boolean {
  return (r + c) % 2 === 1;
}

export function isDarkSquare(r: number, c: number): boolean {
  return isDark(r, c);
}

function inBounds(size: number, r: number, c: number): boolean {
  return r >= 0 && r < size && c >= 0 && c < size;
}

const KING_DIRS: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

const MAN_FORWARD: Record<PieceColor, [number, number][]> = {
  black: [
    [-1, -1],
    [-1, 1],
  ],
  white: [
    [1, -1],
    [1, 1],
  ],
};

function manMoveDirs(color: PieceColor): [number, number][] {
  return MAN_FORWARD[color];
}

function manCaptureDirs(rules: Ruleset, color: PieceColor): [number, number][] {
  return rules.menCaptureBackward ? KING_DIRS : MAN_FORWARD[color];
}

export function createEmptyBoard(size: number): Board {
  return Array.from({ length: size }, () => Array(size).fill(null));
}

export function createInitialBoard(ruleset: RulesetId = 'american'): Board {
  const rules = RULESETS[ruleset];
  const { size } = rules;
  const board = createEmptyBoard(size);
  // International: 4 front ranks; American: 3.
  const enemyRows = ruleset === 'international' ? 4 : 3;
  const ownStart = size - enemyRows;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!isDark(r, c)) continue;
      if (r < enemyRows) board[r][c] = { color: 'white', king: false };
      else if (r >= ownStart) board[r][c] = { color: 'black', king: false };
    }
  }
  return board;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function captureCount(move: Move): number {
  return Math.max(0, move.path.length - 1);
}

export function findCapturedOnHop(
  board: Board,
  fromR: number,
  fromC: number,
  toR: number,
  toC: number,
  color: PieceColor,
): [number, number] | null {
  const dr = Math.sign(toR - fromR);
  const dc = Math.sign(toC - fromC);
  if (dr === 0 || dc === 0) return null;
  if (Math.abs(toR - fromR) !== Math.abs(toC - fromC)) return null;
  let found: [number, number] | null = null;
  let r = fromR + dr;
  let c = fromC + dc;
  while (r !== toR || c !== toC) {
    const cell = board[r][c];
    if (cell) {
      if (cell.color === color) return null;
      if (found) return null;
      found = [r, c];
    }
    r += dr;
    c += dc;
  }
  return found;
}

export interface HopStep {
  from: [number, number];
  to: [number, number];
  captured: [number, number] | null;
}

export function getHopSteps(board: Board, move: Move): HopStep[] {
  const steps: HopStep[] = [];
  const next = cloneBoard(board);
  const [fromR, fromC] = move.from;
  const piece = next[fromR][fromC];
  if (!piece) return steps;

  for (let i = 1; i < move.path.length; i++) {
    const from = move.path[i - 1];
    const to = move.path[i];
    const cap = findCapturedOnHop(next, from[0], from[1], to[0], to[1], piece.color);
    if (cap) {
      next[cap[0]][cap[1]] = null;
    }
    steps.push({ from, to, captured: cap });
  }
  return steps;
}

export function getCapturedSquaresForMove(board: Board, move: Move): [number, number][] {
  const steps = getHopSteps(board, move);
  const captured: [number, number][] = [];
  for (const s of steps) {
    if (s.captured) captured.push(s.captured);
  }
  return captured;
}

/** Apply a completed move (full path). Removes jumped pieces between hops. */
export function applyMove(board: Board, move: Move, ruleset: RulesetId = 'american'): Board {
  const rules = RULESETS[ruleset];
  const next = cloneBoard(board);
  const [fromR, fromC] = move.from;
  const piece = next[fromR][fromC];
  if (!piece) return next;
  next[fromR][fromC] = null;

  let crownedDuring = piece.king;
  for (let i = 1; i < move.path.length; i++) {
    const [pr, pc] = move.path[i - 1];
    const [r, c] = move.path[i];
    const cap = findCapturedOnHop(next, pr, pc, r, c, piece.color);
    if (cap) next[cap[0]][cap[1]] = null;
    // Mid-sequence: piece is conceptually on the landing square but we wait until end.
    if (
      !crownedDuring &&
      ((piece.color === 'black' && r === 0) ||
        (piece.color === 'white' && r === rules.size - 1))
    ) {
      // International: promote only when the whole move ends on the back rank.
      // American short moves promote on landing.
      if (!rules.flyingKings || i === move.path.length - 1) {
        crownedDuring = true;
      }
    }
  }

  const [lastR, lastC] = move.path[move.path.length - 1];
  const crown =
    piece.king ||
    crownedDuring ||
    (piece.color === 'black' && lastR === 0) ||
    (piece.color === 'white' && lastR === rules.size - 1);
  next[lastR][lastC] = { color: piece.color, king: crown };
  return next;
}

function collectShortCaptures(
  board: Board,
  r: number,
  c: number,
  piece: Piece,
  rules: Ruleset,
  path: [number, number][],
  capturedKeys: Set<string>,
  results: Move[],
): void {
  const dirs = piece.king ? KING_DIRS : manCaptureDirs(rules, piece.color);
  let anyJump = false;
  for (const [dr, dc] of dirs) {
    const midR = r + dr;
    const midC = c + dc;
    const toR = r + 2 * dr;
    const toC = c + 2 * dc;
    if (!inBounds(rules.size, toR, toC) || !isDark(toR, toC)) continue;
    const mid = board[midR][midC];
    const toCell = board[toR][toC];
    const midKey = `${midR},${midC}`;
    if (!mid || mid.color !== opponent(piece.color) || toCell !== null) continue;
    if (capturedKeys.has(midKey)) continue;
    anyJump = true;
    const newPath: [number, number][] = [...path, [toR, toC]];
    const newBoard = cloneBoard(board);
    newBoard[midR][midC] = null;
    newBoard[r][c] = null;
    // American: crown immediately on landing (stops further man jumps as king).
    const crown =
      piece.king ||
      (piece.color === 'black' && toR === 0) ||
      (piece.color === 'white' && toR === rules.size - 1);
    newBoard[toR][toC] = { color: piece.color, king: crown };
    const nextKeys = new Set(capturedKeys);
    nextKeys.add(midKey);
    collectShortCaptures(
      newBoard,
      toR,
      toC,
      { color: piece.color, king: crown },
      rules,
      newPath,
      nextKeys,
      results,
    );
  }
  if (!anyJump && path.length >= 2) {
    results.push({ from: path[0], path });
  }
}

function collectFlyingCaptures(
  board: Board,
  r: number,
  c: number,
  piece: Piece,
  rules: Ruleset,
  path: [number, number][],
  capturedKeys: Set<string>,
  results: Move[],
): void {
  // Men still use short captures even in international; only kings fly.
  if (!piece.king) {
    collectShortCaptures(board, r, c, piece, rules, path, capturedKeys, results);
    return;
  }

  let anyJump = false;
  for (const [dr, dc] of KING_DIRS) {
    let cr = r + dr;
    let cc = c + dc;
    // Skip empty squares before the victim.
    while (inBounds(rules.size, cr, cc) && board[cr][cc] === null) {
      cr += dr;
      cc += dc;
    }
    if (!inBounds(rules.size, cr, cc)) continue;
    const victim = board[cr][cc];
    const vKey = `${cr},${cc}`;
    if (!victim || victim.color !== opponent(piece.color) || capturedKeys.has(vKey)) continue;

    let lr = cr + dr;
    let lc = cc + dc;
    while (inBounds(rules.size, lr, lc) && board[lr][lc] === null) {
      if (!isDark(lr, lc)) {
        lr += dr;
        lc += dc;
        continue;
      }
      anyJump = true;
      const newPath: [number, number][] = [...path, [lr, lc]];
      const newBoard = cloneBoard(board);
      newBoard[cr][cc] = null;
      newBoard[r][c] = null;
      newBoard[lr][lc] = { color: piece.color, king: true };
      const nextKeys = new Set(capturedKeys);
      nextKeys.add(vKey);
      collectFlyingCaptures(
        newBoard,
        lr,
        lc,
        { color: piece.color, king: true },
        rules,
        newPath,
        nextKeys,
        results,
      );
      lr += dr;
      lc += dc;
    }
  }
  if (!anyJump && path.length >= 2) {
    results.push({ from: path[0], path });
  }
}

function getAllCaptures(board: Board, color: PieceColor, rules: Ruleset): Move[] {
  const results: Move[] = [];
  for (let r = 0; r < rules.size; r++) {
    for (let c = 0; c < rules.size; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) continue;
      if (rules.flyingKings) {
        collectFlyingCaptures(board, r, c, piece, rules, [[r, c]], new Set(), results);
      } else {
        collectShortCaptures(board, r, c, piece, rules, [[r, c]], new Set(), results);
      }
    }
  }
  if (rules.majorityCapture && results.length > 0) {
    const maxCap = Math.max(...results.map(captureCount));
    return results.filter((m) => captureCount(m) === maxCap);
  }
  return results;
}

function getSimpleMoves(board: Board, color: PieceColor, rules: Ruleset): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < rules.size; r++) {
    for (let c = 0; c < rules.size; c++) {
      const piece = board[r][c];
      if (!piece || piece.color !== color) continue;

      if (piece.king && rules.flyingKings) {
        for (const [dr, dc] of KING_DIRS) {
          let toR = r + dr;
          let toC = c + dc;
          while (inBounds(rules.size, toR, toC) && isDark(toR, toC) && board[toR][toC] === null) {
            moves.push({ from: [r, c], path: [[r, c], [toR, toC]] });
            toR += dr;
            toC += dc;
          }
        }
      } else {
        const dirs = piece.king ? KING_DIRS : manMoveDirs(color);
        for (const [dr, dc] of dirs) {
          const toR = r + dr;
          const toC = c + dc;
          if (!inBounds(rules.size, toR, toC) || !isDark(toR, toC) || board[toR][toC] !== null) {
            continue;
          }
          moves.push({ from: [r, c], path: [[r, c], [toR, toC]] });
        }
      }
    }
  }
  return moves;
}

export function getLegalMoves(
  board: Board,
  color: PieceColor,
  ruleset: RulesetId = 'american',
): Move[] {
  const rules = RULESETS[ruleset];
  const captures = getAllCaptures(board, color, rules);
  if (captures.length > 0) return captures;
  return getSimpleMoves(board, color, rules);
}

export function getLegalMovesFrom(
  board: Board,
  color: PieceColor,
  fromR: number,
  fromC: number,
  ruleset: RulesetId = 'american',
): Move[] {
  return getLegalMoves(board, color, ruleset).filter(
    (m) => m.from[0] === fromR && m.from[1] === fromC,
  );
}

export function countPieces(board: Board): { black: number; white: number } {
  let black = 0;
  let white = 0;
  const size = board.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = board[r][c];
      if (cell?.color === 'black') black++;
      else if (cell?.color === 'white') white++;
    }
  }
  return { black, white };
}

export function getWinner(
  board: Board,
  currentTurn: PieceColor,
  ruleset: RulesetId = 'american',
): PieceColor | null {
  const moves = getLegalMoves(board, currentTurn, ruleset);
  if (moves.length > 0) return null;
  const { black, white } = countPieces(board);
  if (black === 0) return 'white';
  if (white === 0) return 'black';
  return currentTurn === 'black' ? 'white' : 'black';
}

/** True when consecutive path squares jump over at least one square (capture hop). */
export function isCaptureMove(move: Move): boolean {
  if (move.path.length < 2) return false;
  return Math.abs(move.path[1][0] - move.path[0][0]) >= 2;
}

export function captureHopCount(move: Move): number {
  return captureCount(move);
}

const WIN_SCORE = 8_000;

/** Style knobs layered on top of base difficulty for roster opponents. */
export type BotStyle = {
  /** Prefer longer capture chains (0–1). */
  captureGreed: number;
  /** Prefer crowning / advancing men (0–1). */
  crownHunger: number;
  /** Prefer keeping mobility / avoid trades (0–1). */
  caution: number;
  /** Prefer center control (0–1). */
  centerBias: number;
  depthOverride?: number;
  blunderOverride?: number;
};

export const DEFAULT_BOT_STYLE: BotStyle = {
  captureGreed: 0.5,
  crownHunger: 0.5,
  caution: 0.5,
  centerBias: 0.5,
};

function promotesKing(board: Board, move: Move, color: PieceColor, size: number): boolean {
  const [lastR] = move.path[move.path.length - 1];
  const piece = board[move.from[0]][move.from[1]];
  if (!piece || piece.king) return false;
  return (color === 'black' && lastR === 0) || (color === 'white' && lastR === size - 1);
}

function evaluateCheckers(
  board: Board,
  color: PieceColor,
  rules: Ruleset,
  style: BotStyle = DEFAULT_BOT_STYLE,
): number {
  const opp = opponent(color);
  const counts = countPieces(board);
  const mine = color === 'black' ? counts.black : counts.white;
  const theirs = color === 'black' ? counts.white : counts.black;
  const tradeWeight = 1 + style.caution * 0.4;
  let score = (mine - theirs) * 120 * tradeWeight;

  const mid = (rules.size - 1) / 2;
  for (let r = 0; r < rules.size; r++) {
    for (let c = 0; c < rules.size; c++) {
      const piece = board[r][c];
      if (!piece) continue;
      const sign = piece.color === color ? 1 : -1;
      score += piece.king ? 35 * sign : 12 * sign;
      if (!piece.king) {
        const progress =
          piece.color === 'black' ? rules.size - 1 - r : r;
        score += progress * (2 + style.crownHunger * 4) * sign;
        if (piece.color === 'black' && r === 0) score += 6 * sign;
        if (piece.color === 'white' && r === rules.size - 1) score += 6 * sign;
      }
      const centerDist = Math.abs(r - mid) + Math.abs(c - mid);
      score += (rules.size - centerDist) * style.centerBias * 1.5 * sign;
    }
  }

  const myMoves = getLegalMoves(board, color, rules.id);
  const oppMoves = getLegalMoves(board, opp, rules.id);
  score += (myMoves.length - oppMoves.length) * (4 + style.caution * 3);
  return score;
}

function minimaxCheckers(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  turn: PieceColor,
  rules: Ruleset,
  style: BotStyle,
): number {
  const moves = getLegalMoves(board, turn, rules.id);
  if (moves.length === 0) {
    const { black, white } = countPieces(board);
    if (black === 0 && white === 0) return 0;
    return -WIN_SCORE - depth;
  }
  if (depth <= 0) return evaluateCheckers(board, turn, rules, style);

  let value = -Infinity;
  for (const move of moves) {
    const next = applyMove(board, move, rules.id);
    const score = -minimaxCheckers(
      next,
      depth - 1,
      -beta,
      -alpha,
      opponent(turn),
      rules,
      style,
    );
    if (score > value) value = score;
    if (value > alpha) alpha = value;
    if (alpha >= beta) break;
  }
  return value;
}

function styleScoreMove(
  board: Board,
  move: Move,
  color: PieceColor,
  rules: Ruleset,
  style: BotStyle,
): number {
  let s = captureHopCount(move) * (20 + style.captureGreed * 40);
  if (promotesKing(board, move, color, rules.size)) {
    s += 30 + style.crownHunger * 40;
  }
  return s;
}

/**
 * Bot: forced captures take the longest / majority chain; quiet moves from search.
 * Optional `style` biases evaluation and capture preference for roster opponents.
 */
export function pickBotMove(
  board: Board,
  color: PieceColor,
  continuationFrom: [number, number] | null,
  difficulty: Difficulty = 'normal',
  ruleset: RulesetId = 'american',
  style: BotStyle = DEFAULT_BOT_STYLE,
): Move | null {
  const rules = RULESETS[ruleset];
  const moves = continuationFrom
    ? getLegalMovesFrom(board, color, continuationFrom[0], continuationFrom[1], ruleset)
    : getLegalMoves(board, color, ruleset);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const captures = moves.filter((m) => isCaptureMove(m));
  if (captures.length > 0) {
    return captures.reduce((best, move) => {
      const bestCap = captureHopCount(best);
      const moveCap = captureHopCount(move);
      if (moveCap !== bestCap) return moveCap > bestCap ? move : best;
      const bestStyle = styleScoreMove(board, best, color, rules, style);
      const moveStyle = styleScoreMove(board, move, color, rules, style);
      if (moveStyle !== bestStyle) return moveStyle > bestStyle ? move : best;
      const moveKing = promotesKing(board, move, color, rules.size);
      const bestKing = promotesKing(board, best, color, rules.size);
      if (moveKing !== bestKing) return moveKing ? move : best;
      return move;
    });
  }

  const config = DIFFICULTY[difficulty];
  const blunder = style.blunderOverride ?? config.blunderRate;
  const depth = style.depthOverride ?? config.depth;
  if (blunder > 0 && Math.random() < blunder) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  let best: Move[] = [];
  let bestScore = -Infinity;
  for (const move of moves) {
    const next = applyMove(board, move, ruleset);
    let score = -minimaxCheckers(
      next,
      depth - 1,
      -Infinity,
      Infinity,
      opponent(color),
      rules,
      style,
    );
    score += styleScoreMove(board, move, color, rules, style) * 0.15;
    if (score > bestScore) {
      bestScore = score;
      best = [move];
    } else if (score === bestScore) {
      best.push(move);
    }
  }
  return best.length ? best[Math.floor(Math.random() * best.length)] : moves[0];
}

/** Board fen-like key for repetition / puzzle hashing. */
export function boardKey(board: Board, turn: PieceColor): string {
  const rows: string[] = [turn[0]];
  for (let r = 0; r < board.length; r++) {
    let row = '';
    for (let c = 0; c < board.length; c++) {
      const p = board[r][c];
      if (!p) row += '.';
      else if (p.color === 'black') row += p.king ? 'B' : 'b';
      else row += p.king ? 'W' : 'w';
    }
    rows.push(row);
  }
  return rows.join('/');
}

export function placePieces(
  size: number,
  cells: Array<[number, number, Piece]>,
): Board {
  const board = createEmptyBoard(size);
  for (const [r, c, piece] of cells) {
    board[r][c] = { ...piece };
  }
  return board;
}

export interface CheckersTacticalAnalysis {
  /** Piece breakdown */
  blackMen: number;
  blackKings: number;
  whiteMen: number;
  whiteKings: number;
  totalBlack: number;
  totalWhite: number;

  /** Advantage percentage for Black (5% to 95%) */
  blackAdvantagePct: number;
  evaluationText: string;

  /** Mandatory capture status */
  isCaptureMandatory: boolean;
  maxJumpHops: number;
  canMultiJump: boolean;

  /** Opponent counter-threats */
  oppCanCapture: boolean;
  oppMaxJumpHops: number;

  /** Baseline guard counts (defensive rank pieces) */
  blackBackRankGuard: number;
  whiteBackRankGuard: number;

  /** Center control (pieces in center squares) */
  blackCenterControl: number;
  whiteCenterControl: number;

  /** Closest man to promotion (rows from kinging) */
  blackClosestPromotion: number | null;
  whiteClosestPromotion: number | null;

  /** Threat intel alert string */
  threatAlert: string;

  /** Coordinates of friendly pieces currently threatened by opponent jump */
  threatenedPieces: [number, number][];

  /** Opponent jump landing threat squares */
  oppLandingThreats: [number, number][];

  /** Friendly keystone guard pieces (solid back rank pieces) */
  keystoneGuards: [number, number][];
}

export function analyzeCheckersTactics(
  board: Board,
  currentTurn: PieceColor,
  ruleset: RulesetId = 'american',
): CheckersTacticalAnalysis {
  const size = board.length;
  const rules = RULESETS[ruleset];
  const kingValue = rules.flyingKings ? 3.2 : 2.5;

  let blackMen = 0;
  let blackKings = 0;
  let whiteMen = 0;
  let whiteKings = 0;
  let blackBackRankGuard = 0;
  let whiteBackRankGuard = 0;
  let blackCenterControl = 0;
  let whiteCenterControl = 0;
  let blackClosestPromotion: number | null = null;
  let whiteClosestPromotion: number | null = null;

  const midMin = Math.floor(size / 2) - 1;
  const midMax = Math.floor(size / 2);

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const piece = board[r][c];
      if (!piece) continue;

      const isCenter = r >= midMin && r <= midMax && c >= midMin && c <= midMax;

      if (piece.color === 'black') {
        if (piece.king) {
          blackKings++;
        } else {
          blackMen++;
          const dist = r; // Black moves toward r=0
          if (blackClosestPromotion === null || dist < blackClosestPromotion) {
            blackClosestPromotion = dist;
          }
        }
        if (r === size - 1) blackBackRankGuard++;
        if (isCenter) blackCenterControl++;
      } else {
        if (piece.king) {
          whiteKings++;
        } else {
          whiteMen++;
          const dist = size - 1 - r; // White moves toward r=size-1
          if (whiteClosestPromotion === null || dist < whiteClosestPromotion) {
            whiteClosestPromotion = dist;
          }
        }
        if (r === 0) whiteBackRankGuard++;
        if (isCenter) whiteCenterControl++;
      }
    }
  }

  const totalBlack = blackMen + blackKings;
  const totalWhite = whiteMen + whiteKings;

  // Compute material & positional evaluation
  const blackScore = blackMen * 1 + blackKings * kingValue + blackCenterControl * 0.25 + blackBackRankGuard * 0.15;
  const whiteScore = whiteMen * 1 + whiteKings * kingValue + whiteCenterControl * 0.25 + whiteBackRankGuard * 0.15;
  const scoreDiff = blackScore - whiteScore;

  let blackAdvantagePct = 50;
  if (totalBlack === 0) {
    blackAdvantagePct = 5;
  } else if (totalWhite === 0) {
    blackAdvantagePct = 95;
  } else {
    blackAdvantagePct = Math.max(5, Math.min(95, Math.round(50 + scoreDiff * 8)));
  }

  let evaluationText = '勢均力敵';
  if (blackAdvantagePct >= 75) evaluationText = '黑方大優';
  else if (blackAdvantagePct >= 58) evaluationText = '黑方微優';
  else if (blackAdvantagePct <= 25) evaluationText = '白方大優';
  else if (blackAdvantagePct <= 42) evaluationText = '白方微優';

  // Analyze legal moves for current player
  const legalMoves = getLegalMoves(board, currentTurn, ruleset);
  const isCaptureMandatory = legalMoves.some((m) => isCaptureMove(m));
  const maxJumpHops = legalMoves.reduce((max, m) => Math.max(max, captureHopCount(m)), 0);
  const canMultiJump = maxJumpHops >= 2;

  // Analyze counter-threats for opponent
  const oppColor = opponent(currentTurn);
  const oppMoves = getLegalMoves(board, oppColor, ruleset);
  const oppCanCapture = oppMoves.some((m) => isCaptureMove(m));
  const oppMaxJumpHops = oppMoves.reduce((max, m) => Math.max(max, captureHopCount(m)), 0);

  let threatAlert = '盤面穩健對峙中，推進控制大斜線';
  if (isCaptureMandatory && canMultiJump) {
    threatAlert = `⚡ 絕殺連跳：當前有 ${maxJumpHops} 連跳吃子殺局！`;
  } else if (isCaptureMandatory) {
    threatAlert = '⚔️ 強制吃子：規則要求必須跳吃，鎖定路徑！';
  } else if (oppCanCapture && oppMaxJumpHops >= 2) {
    threatAlert = `⚠️ 危機預警：敵方下步擁有 ${oppMaxJumpHops} 連跳殺局，請謹慎防守！`;
  } else if (oppCanCapture) {
    threatAlert = '🛡️ 防守警戒：敵方下步可跳吃己方子，注意走位！';
  } else if (currentTurn === 'black' && blackClosestPromotion === 1) {
    threatAlert = '👑 升王前鋒：一步之遙即刻封王！';
  } else if (currentTurn === 'white' && whiteClosestPromotion === 1) {
    threatAlert = '👑 升王前鋒：一步之遙即刻封王！';
  }

  // Analyze opponent capture threats to find threatened friendly pieces and landing squares
  const threatenedPiecesMap = new Map<string, [number, number]>();
  const oppLandingThreatsMap = new Map<string, [number, number]>();

  for (const m of oppMoves) {
    if (isCaptureMove(m)) {
      const caps = getCapturedSquaresForMove(board, m);
      for (const cap of caps) {
        threatenedPiecesMap.set(`${cap[0]},${cap[1]}`, cap);
      }
      const landing = m.path[m.path.length - 1];
      oppLandingThreatsMap.set(`${landing[0]},${landing[1]}`, landing);
    }
  }

  const threatenedPieces = Array.from(threatenedPiecesMap.values());
  const oppLandingThreats = Array.from(oppLandingThreatsMap.values());

  // Friendly keystone guards: pieces on the defensive back rank
  const keystoneGuards: [number, number][] = [];
  const guardRow = currentTurn === 'black' ? size - 1 : 0;
  for (let c = 0; c < size; c++) {
    const p = board[guardRow][c];
    if (p && p.color === currentTurn) {
      keystoneGuards.push([guardRow, c]);
    }
  }

  return {
    blackMen,
    blackKings,
    whiteMen,
    whiteKings,
    totalBlack,
    totalWhite,
    blackAdvantagePct,
    evaluationText,
    isCaptureMandatory,
    maxJumpHops,
    canMultiJump,
    oppCanCapture,
    oppMaxJumpHops,
    blackBackRankGuard,
    whiteBackRankGuard,
    blackCenterControl,
    whiteCenterControl,
    blackClosestPromotion,
    whiteClosestPromotion,
    threatAlert,
    threatenedPieces,
    oppLandingThreats,
    keystoneGuards,
  };
}


/**
 * Double-six dominoes: Draw, Block, and All Fives (Muggins) variants.
 * Match play accumulates round scores to a configurable target (default 100).
 */

import {
  boardToChain,
  canAttachToEnd,
  emptyBoard,
  getChainEnds,
  getEndPip,
  getOpenEndCounts,
  getOutwardPip,
  getPlayableEnds,
  isDouble,
  placeFirstTile,
  placeTile,
  scoreOpenEnds,
  sumOpenEnds,
  type Board,
} from './board';
import type {
  Difficulty,
  EndId,
  MatchTarget,
  PlayerId,
  PlacedTile,
  RuleVariant,
  Tile,
} from './types';
import { DEFAULT_MATCH_TARGET, MATCH_TARGETS } from './types';

export type {
  Board,
  Difficulty,
  EndId,
  MatchTarget,
  PlayerId,
  PlacedTile,
  RuleVariant,
  Tile,
};
export {
  boardToChain,
  canAttachToEnd,
  emptyBoard,
  getChainEnds,
  getEndPip,
  getOpenEndCounts,
  getOutwardPip,
  getPlayableEnds,
  isDouble,
  placeFirstTile,
  placeTile,
  scoreOpenEnds,
  sumOpenEnds,
  DEFAULT_MATCH_TARGET,
  MATCH_TARGETS,
};

// ponytail: local shuffle so check scripts can import without Vite aliases.
function shuffleArray<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface DominoesState {
  currentPlayer: PlayerId;
  hands: [Tile[], Tile[]];
  board: Board;
  boneyard: Tile[];
  phase: 'playing' | 'roundOver';
  winner: PlayerId | null;
  roundEndReason: 'domino' | 'blocked' | null;
  ruleVariant: RuleVariant;
  /** Points scored this hand (mid-play + round-end bonus). */
  handScores: [number, number];
  lastPlayScore: number;
  lastOpenSum: number;
  /** Suits each player appears to lack after draw/pass. */
  suspectedLack: [number[], number[]];
}

export interface MatchState {
  scores: [number, number];
  target: number;
  round: number;
  matchOver: boolean;
  matchWinner: PlayerId | null;
}

const BONEYARD_LEAVE = 2;
const HAND_SIZE = 7;

export function createSet(): Tile[] {
  const tiles: Tile[] = [];
  let id = 0;
  for (let a = 0; a <= 6; a++) {
    for (let b = a; b <= 6; b++) {
      tiles.push({ id: id++, left: a, right: b });
    }
  }
  return tiles;
}

export function tileSum(t: Tile): number {
  return t.left + t.right;
}

export function handSum(hand: Tile[]): number {
  return hand.reduce((s, t) => s + tileSum(t), 0);
}

export function roundToNearestFive(pips: number): number {
  return Math.round(pips / 5) * 5;
}

/** Round-end points from the loser's remaining hand. */
export function roundEndPoints(
  loserHand: Tile[],
  ruleVariant: RuleVariant,
): number {
  const raw = handSum(loserHand);
  return ruleVariant === 'fives' ? roundToNearestFive(raw) : raw;
}

export function getPlayableTiles(hand: Tile[], board: Board): Tile[] {
  if (!board.hub) return hand;
  const ends = getPlayableEnds(board);
  return hand.filter((t) =>
    ends.some((end) => {
      const pip = getEndPip(board, end);
      return pip !== null && canAttachToEnd(t, pip);
    }),
  );
}

export function canPlay(hand: Tile[], board: Board): boolean {
  return getPlayableTiles(hand, board).length > 0;
}

function removeFromHand(hand: Tile[], tileId: number): Tile[] {
  return hand.filter((t) => t.id !== tileId);
}

function drawOne(boneyard: Tile[]): [Tile[], Tile | null] {
  if (boneyard.length === 0) return [[], null];
  const [drawn, ...rest] = boneyard;
  return [rest, drawn];
}

function usesDraw(ruleVariant: RuleVariant): boolean {
  return ruleVariant === 'draw' || ruleVariant === 'fives';
}

function highestDouble(hand: Tile[]): Tile | null {
  for (let d = 6; d >= 0; d--) {
    const t = hand.find((x) => x.left === d && x.right === d);
    if (t) return t;
  }
  return null;
}

export function createMatchState(target: number = DEFAULT_MATCH_TARGET): MatchState {
  return {
    scores: [0, 0],
    target,
    round: 1,
    matchOver: false,
    matchWinner: null,
  };
}

export function createInitialState(
  ruleVariant: RuleVariant = 'draw',
): DominoesState {
  const shuffled = shuffleArray(createSet());
  const hand0: Tile[] = shuffled.slice(0, HAND_SIZE);
  const hand1: Tile[] = shuffled.slice(HAND_SIZE, HAND_SIZE * 2);
  const boneyard = shuffled.slice(HAND_SIZE * 2);

  const d0 = highestDouble(hand0);
  const d1 = highestDouble(hand1);
  let hands: [Tile[], Tile[]] = [[...hand0], [...hand1]];
  let board = emptyBoard();
  let firstPlayer: PlayerId = 0;

  const playOpening = (player: PlayerId, tile: Tile) => {
    board = placeFirstTile(board, tile, ruleVariant);
    hands[player] = removeFromHand(hands[player], tile.id);
    firstPlayer = player;
  };

  if (d0 && d1) {
    const player: PlayerId = d0.left >= d1.left ? 0 : 1;
    playOpening(player, player === 0 ? d0 : d1);
  } else if (d0) {
    playOpening(0, d0);
  } else if (d1) {
    playOpening(1, d1);
  } else {
    playOpening(0, hands[0][0]);
  }

  const openingScore = ruleVariant === 'fives' ? scoreOpenEnds(board) : 0;
  const handScores: [number, number] = [0, 0];
  if (openingScore > 0) handScores[firstPlayer] = openingScore;

  return {
    currentPlayer: firstPlayer === 0 ? 1 : 0,
    hands,
    board,
    boneyard,
    phase: 'playing',
    winner: null,
    roundEndReason: null,
    ruleVariant,
    handScores,
    lastPlayScore: openingScore,
    lastOpenSum: sumOpenEnds(board),
    suspectedLack: [[], []],
  };
}

function withLackNote(
  state: DominoesState,
  player: PlayerId,
  ends: number[],
): [number[], number[]] {
  const next: [number[], number[]] = [
    [...state.suspectedLack[0]],
    [...state.suspectedLack[1]],
  ];
  const set = new Set(next[player]);
  for (const e of ends) set.add(e);
  next[player] = [...set];
  return next;
}

function clearLackForTile(
  state: DominoesState,
  player: PlayerId,
  tile: Tile,
): [number[], number[]] {
  const next: [number[], number[]] = [
    [...state.suspectedLack[0]],
    [...state.suspectedLack[1]],
  ];
  next[player] = next[player].filter((n) => n !== tile.left && n !== tile.right);
  return next;
}

function openPipsOf(board: Board): number[] {
  return getPlayableEnds(board)
    .map((e) => getEndPip(board, e))
    .filter((p): p is number => p !== null);
}

function finishRound(
  state: DominoesState,
  winner: PlayerId,
  reason: 'domino' | 'blocked',
): DominoesState {
  const loser: PlayerId = winner === 0 ? 1 : 0;
  const bonus = roundEndPoints(state.hands[loser], state.ruleVariant);
  const handScores: [number, number] = [...state.handScores];
  handScores[winner] += bonus;
  return {
    ...state,
    phase: 'roundOver',
    winner,
    roundEndReason: reason,
    handScores,
    lastPlayScore: bonus,
    currentPlayer: winner,
  };
}

/** Fold a completed hand into the match scoreboard. */
export function applyRoundToMatch(
  match: MatchState,
  handScores: [number, number],
): MatchState {
  if (match.matchOver) return match;
  const scores: [number, number] = [
    match.scores[0] + handScores[0],
    match.scores[1] + handScores[1],
  ];
  const bothReached =
    scores[0] >= match.target || scores[1] >= match.target;
  if (bothReached && scores[0] !== scores[1]) {
    return {
      scores,
      target: match.target,
      // Keep the completed round number on the match-over screen.
      round: match.round,
      matchOver: true,
      matchWinner: scores[0] > scores[1] ? 0 : 1,
    };
  }
  // Do not bump `round` here — the between-round overlay still shows this
  // hand's results; `advanceMatchRound` runs when the next hand deals.
  return {
    scores,
    target: match.target,
    round: match.round,
    matchOver: false,
    matchWinner: null,
  };
}

/** Call when dealing the next hand after a completed round. */
export function advanceMatchRound(match: MatchState): MatchState {
  if (match.matchOver) return match;
  return { ...match, round: match.round + 1 };
}

export function playTile(
  state: DominoesState,
  player: PlayerId,
  tileId: number,
  end: EndId,
): DominoesState | null {
  if (state.phase !== 'playing' || state.currentPlayer !== player) return null;
  const hand = state.hands[player];
  const tile = hand.find((t) => t.id === tileId);
  if (!tile) return null;
  const newBoard = placeTile(state.board, tile, end, state.ruleVariant);
  if (!newBoard) return null;

  const newHands: [Tile[], Tile[]] = [...state.hands];
  newHands[player] = removeFromHand(hand, tileId);
  const playScore =
    state.ruleVariant === 'fives' ? scoreOpenEnds(newBoard) : 0;
  const handScores: [number, number] = [...state.handScores];
  handScores[player] += playScore;

  const base: DominoesState = {
    ...state,
    board: newBoard,
    hands: newHands,
    handScores,
    lastPlayScore: playScore,
    lastOpenSum: sumOpenEnds(newBoard),
    suspectedLack: clearLackForTile(state, player, tile),
  };

  if (newHands[player].length === 0) {
    return finishRound(base, player, 'domino');
  }

  return {
    ...base,
    currentPlayer: player === 0 ? 1 : 0,
  };
}

export function drawTiles(state: DominoesState, player: PlayerId): DominoesState {
  if (state.phase !== 'playing' || state.currentPlayer !== player) return state;
  if (!usesDraw(state.ruleVariant)) {
    return pass(state, player) ?? state;
  }

  const openPips = openPipsOf(state.board);
  let s = state;
  let drew = false;
  while (
    s.boneyard.length > BONEYARD_LEAVE &&
    !canPlay(s.hands[player], s.board)
  ) {
    const [newBoneyard, drawn] = drawOne(s.boneyard);
    if (!drawn) break;
    drew = true;
    const newHands: [Tile[], Tile[]] = [...s.hands];
    newHands[player] = [...newHands[player], drawn];
    s = { ...s, boneyard: newBoneyard, hands: newHands };
  }

  if (!canPlay(s.hands[player], s.board)) {
    return passTurn({ ...s, suspectedLack: withLackNote(s, player, openPips) });
  }
  if (drew) {
    s = { ...s, suspectedLack: withLackNote(s, player, openPips) };
  }
  return s;
}

function passTurn(state: DominoesState): DominoesState {
  const next: PlayerId = state.currentPlayer === 0 ? 1 : 0;
  const nextCanPlay = canPlay(state.hands[next], state.board);
  const boneyardExhausted =
    !usesDraw(state.ruleVariant) || state.boneyard.length <= BONEYARD_LEAVE;
  if (!nextCanPlay && boneyardExhausted) {
    const sum0 = handSum(state.hands[0]);
    const sum1 = handSum(state.hands[1]);
    const winner: PlayerId = sum0 <= sum1 ? 0 : 1;
    return finishRound(state, winner, 'blocked');
  }
  return { ...state, currentPlayer: next };
}

export function pass(
  state: DominoesState,
  player: PlayerId,
): DominoesState | null {
  if (state.phase !== 'playing' || state.currentPlayer !== player) return null;
  if (canPlay(state.hands[player], state.board)) return null;
  if (usesDraw(state.ruleVariant) && state.boneyard.length > BONEYARD_LEAVE) {
    return null;
  }
  return passTurn({
    ...state,
    suspectedLack: withLackNote(state, player, openPipsOf(state.board)),
  });
}

export function isValidPlay(
  hand: Tile[],
  board: Board,
  tileId: number,
  end: EndId,
  ruleVariant: RuleVariant = 'draw',
): boolean {
  const tile = hand.find((t) => t.id === tileId);
  if (!tile) return false;
  return placeTile(board, tile, end, ruleVariant) !== null;
}

export function getValidMoves(
  hand: Tile[],
  board: Board,
  ruleVariant: RuleVariant = 'draw',
): Array<{ tileId: number; end: EndId }> {
  if (!board.hub) {
    return hand.map((t) => ({ tileId: t.id, end: 'left' as const }));
  }
  const moves: Array<{ tileId: number; end: EndId }> = [];
  const seen = new Set<string>();
  for (const end of getPlayableEnds(board)) {
    const pip = getEndPip(board, end);
    if (pip === null) continue;
    for (const t of hand) {
      if (!canAttachToEnd(t, pip)) continue;
      if (!placeTile(board, t, end, ruleVariant)) continue;
      const key = `${t.id}:${end}`;
      if (seen.has(key)) continue;
      seen.add(key);
      moves.push({ tileId: t.id, end });
    }
  }
  return moves;
}

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  easy: '簡單',
  normal: '普通',
  hard: '困難',
};

export const DIFFICULTY_BLURBS: Record<Difficulty, string> = {
  easy: '常亂接，先丟輕牌',
  normal: '會出重點，偶有失手',
  hard: '算得分、堵對手端點',
};

export const RULE_LABELS: Record<RuleVariant, string> = {
  draw: '摸牌制',
  block: '封鎖制',
  fives: '五倍數',
};

export const RULE_BLURBS: Record<RuleVariant, string> = {
  draw: '無法出牌就摸牌，比誰先出完',
  block: '無法出牌就跳過，阻塞比點數',
  fives: '端點和為 5 的倍數得分，打到目標分',
};

export type DifficultyConfig = {
  blunderRate: number;
  flexibilityWeight: number;
  dumpLightFirst: boolean;
  scoreWeight: number;
  leaveScorePenalty: number;
  lackFeedWeight: number;
};

const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: {
    blunderRate: 0.45,
    flexibilityWeight: 0,
    dumpLightFirst: true,
    scoreWeight: 0,
    leaveScorePenalty: 0,
    lackFeedWeight: 0,
  },
  normal: {
    blunderRate: 0.12,
    flexibilityWeight: 3,
    dumpLightFirst: false,
    scoreWeight: 4,
    leaveScorePenalty: 0,
    lackFeedWeight: 0,
  },
  hard: {
    blunderRate: 0,
    flexibilityWeight: 6,
    dumpLightFirst: false,
    scoreWeight: 12,
    leaveScorePenalty: 10,
    lackFeedWeight: 8,
  },
};

export function getDifficultyConfig(difficulty: Difficulty): DifficultyConfig {
  return DIFFICULTY[difficulty];
}

function countFollowUps(
  hand: Tile[],
  board: Board,
  move: { tileId: number; end: EndId },
  ruleVariant: RuleVariant,
): number {
  const played = hand.find((t) => t.id === move.tileId);
  if (!played) return 0;
  const nextBoard = placeTile(board, played, move.end, ruleVariant);
  if (!nextBoard) return 0;
  let count = 0;
  for (const tile of hand) {
    if (tile.id === move.tileId) continue;
    if (getPlayableTiles([tile], nextBoard).length > 0) count += 1;
  }
  return count;
}

function estimateLeaveDanger(
  board: Board,
  opponentLack: number[],
  ruleVariant: RuleVariant,
): number {
  if (ruleVariant !== 'fives') return 0;
  const open = sumOpenEnds(board);
  if (open > 0 && open % 5 === 0) return open;

  let danger = 0;
  const mod = open % 5;
  if (mod === 4 || mod === 1) danger += 4;
  else if (mod === 3 || mod === 2) danger += 1;

  for (const end of getPlayableEnds(board)) {
    const pip = getEndPip(board, end);
    if (pip === null) continue;
    if (opponentLack.includes(pip)) danger -= 4;
    else danger += 2;
  }
  return Math.max(0, danger);
}

export type BotMove = { tileId: number; end: EndId };

export function pickBotMove(
  hand: Tile[],
  board: Board,
  opponentHandSize: number = 7,
  difficulty: Difficulty = 'normal',
  options: {
    ruleVariant?: RuleVariant;
    opponentLack?: number[];
  } = {},
): BotMove | null {
  const ruleVariant = options.ruleVariant ?? 'draw';
  const opponentLack = options.opponentLack ?? [];
  const moves = getValidMoves(hand, board, ruleVariant);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const config = DIFFICULTY[difficulty];
  if (config.blunderRate > 0 && Math.random() < config.blunderRate) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const tileById = new Map(hand.map((t) => [t.id, t]));
  let best: BotMove[] = [];
  let bestScore = -Infinity;

  for (const move of moves) {
    const tile = tileById.get(move.tileId);
    if (!tile) continue;
    const nextBoard = placeTile(board, tile, move.end, ruleVariant);
    if (!nextBoard) continue;

    let score = config.dumpLightFirst ? -tileSum(tile) : tileSum(tile);
    if (isDouble(tile) && !config.dumpLightFirst) {
      score += 24 + tile.left * 2;
    }

    if (opponentHandSize <= 3) {
      const endPip = getEndPip(board, move.end) ?? -1;
      const outward = getOutwardPip(tile, endPip) ?? 0;
      score += outward * 3;
    }

    if (config.flexibilityWeight > 0) {
      score +=
        countFollowUps(hand, board, move, ruleVariant) * config.flexibilityWeight;
    }

    if (config.scoreWeight > 0 && ruleVariant === 'fives') {
      score += scoreOpenEnds(nextBoard) * config.scoreWeight;
    }

    if (config.leaveScorePenalty > 0 && ruleVariant === 'fives') {
      const danger = estimateLeaveDanger(nextBoard, opponentLack, ruleVariant);
      score -= danger * (config.leaveScorePenalty / 10);
      const leaveSum = sumOpenEnds(nextBoard);
      if (leaveSum > 0 && leaveSum % 5 === 0) {
        score -= leaveSum * 0.8;
      }
    }

    if (config.lackFeedWeight > 0 && opponentLack.length > 0) {
      const newEnds = openPipsOf(nextBoard);
      const lackHits = newEnds.filter((p) => opponentLack.includes(p)).length;
      score += lackHits * config.lackFeedWeight;
    }

    if (score > bestScore) {
      bestScore = score;
      best = [move];
    } else if (score === bestScore) {
      best.push(move);
    }
  }

  if (best.length === 0) return moves[0];
  return best[Math.floor(Math.random() * best.length)];
}

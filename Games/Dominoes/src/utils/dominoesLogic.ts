/**
 * Double-six dominoes: Draw, Block, and All Fives (Muggins) variants.
 * Supports 2-seat and 4-seat partners tables; match play to a target score.
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
  PlayerCount,
  PlayerId,
  PlacedTile,
  RuleVariant,
  SeatId,
  TeamId,
  Tile,
} from './types';
import {
  DEFAULT_MATCH_TARGET,
  MATCH_TARGETS,
  handSizeFor,
  nextSeat,
  opponentSeats,
  partnerOf,
  seatsFor,
  teamOf,
} from './types';
import { shuffleWithRng, shuffleWithSeed } from './rng';

export type {
  Board,
  Difficulty,
  EndId,
  MatchTarget,
  PlayerCount,
  PlayerId,
  PlacedTile,
  RuleVariant,
  SeatId,
  TeamId,
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
  handSizeFor,
  nextSeat,
  opponentSeats,
  partnerOf,
  seatsFor,
  teamOf,
};

function shuffleArray<T>(items: readonly T[]): T[] {
  return shuffleWithRng(items, Math.random);
}

export interface DominoesState {
  currentPlayer: SeatId;
  playerCount: PlayerCount;
  hands: Tile[][];
  board: Board;
  boneyard: Tile[];
  phase: 'playing' | 'roundOver';
  /** Seat that went out / represents the winning side on a block. */
  winner: SeatId | null;
  winningTeam: TeamId | null;
  roundEndReason: 'domino' | 'blocked' | null;
  ruleVariant: RuleVariant;
  /** Mid-play + round-end points credited to each seat. */
  handScores: number[];
  lastPlayScore: number;
  lastOpenSum: number;
  /** Suits each seat appears to lack after draw/pass. */
  suspectedLack: number[][];
}

export interface MatchState {
  /** Team scores (2p: seat === team; 4p: even vs odd). */
  scores: [number, number];
  target: number;
  round: number;
  matchOver: boolean;
  matchWinner: TeamId | null;
  playerCount: PlayerCount;
}

const BONEYARD_LEAVE = 2;

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

/** Round-end points from remaining opponent tiles. */
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

function emptyLacks(playerCount: PlayerCount): number[][] {
  return seatsFor(playerCount).map(() => []);
}

function emptyScores(playerCount: PlayerCount): number[] {
  return seatsFor(playerCount).map(() => 0);
}

export function createMatchState(
  target: number = DEFAULT_MATCH_TARGET,
  playerCount: PlayerCount = 2,
): MatchState {
  return {
    scores: [0, 0],
    target,
    round: 1,
    matchOver: false,
    matchWinner: null,
    playerCount,
  };
}

export interface CreateStateOptions {
  playerCount?: PlayerCount;
  /** Deterministic deal seed (daily challenge). */
  seed?: string;
}

export function createInitialState(
  ruleVariant: RuleVariant = 'draw',
  options: CreateStateOptions = {},
): DominoesState {
  const playerCount: PlayerCount = options.playerCount ?? 2;
  const handSize = handSizeFor(playerCount);
  const shuffled = options.seed
    ? shuffleWithSeed(createSet(), options.seed)
    : shuffleArray(createSet());

  const hands: Tile[][] = [];
  for (let i = 0; i < playerCount; i++) {
    hands.push(shuffled.slice(i * handSize, (i + 1) * handSize));
  }
  const boneyard = shuffled.slice(playerCount * handSize);

  let board = emptyBoard();
  let firstPlayer: SeatId = 0;

  const playOpening = (player: SeatId, tile: Tile) => {
    board = placeFirstTile(board, tile, ruleVariant);
    hands[player] = removeFromHand(hands[player], tile.id);
    firstPlayer = player;
  };

  // Highest double across the table opens; ties break by seat order.
  let bestSeat: SeatId | null = null;
  let bestDouble: Tile | null = null;
  for (const seat of seatsFor(playerCount)) {
    const d = highestDouble(hands[seat]);
    if (!d) continue;
    if (!bestDouble || d.left > bestDouble.left) {
      bestDouble = d;
      bestSeat = seat;
    }
  }

  if (bestSeat !== null && bestDouble) {
    playOpening(bestSeat, bestDouble);
  } else {
    playOpening(0, hands[0][0]);
  }

  const openingScore = ruleVariant === 'fives' ? scoreOpenEnds(board) : 0;
  const handScores = emptyScores(playerCount);
  if (openingScore > 0) handScores[firstPlayer] = openingScore;

  return {
    currentPlayer: nextSeat(firstPlayer, playerCount),
    playerCount,
    hands,
    board,
    boneyard,
    phase: 'playing',
    winner: null,
    winningTeam: null,
    roundEndReason: null,
    ruleVariant,
    handScores,
    lastPlayScore: openingScore,
    lastOpenSum: sumOpenEnds(board),
    suspectedLack: emptyLacks(playerCount),
  };
}

function cloneLacks(state: DominoesState): number[][] {
  return state.suspectedLack.map((row) => [...row]);
}

function withLackNote(
  state: DominoesState,
  player: SeatId,
  ends: number[],
): number[][] {
  const next = cloneLacks(state);
  const set = new Set(next[player]);
  for (const e of ends) set.add(e);
  next[player] = [...set];
  return next;
}

function clearLackForTile(
  state: DominoesState,
  player: SeatId,
  tile: Tile,
): number[][] {
  const next = cloneLacks(state);
  next[player] = next[player].filter((n) => n !== tile.left && n !== tile.right);
  return next;
}

function openPipsOf(board: Board): number[] {
  return getPlayableEnds(board)
    .map((e) => getEndPip(board, e))
    .filter((p): p is number => p !== null);
}

/** Combined remaining tiles for a team (partners). */
export function teamHandSum(
  hands: Tile[][],
  team: TeamId,
  playerCount: PlayerCount,
): number {
  let sum = 0;
  for (const seat of seatsFor(playerCount)) {
    if (teamOf(seat, playerCount) === team) sum += handSum(hands[seat]);
  }
  return sum;
}

/** Team hand scores for the current round. */
export function teamHandScores(
  handScores: number[],
  playerCount: PlayerCount,
): [number, number] {
  const out: [number, number] = [0, 0];
  for (const seat of seatsFor(playerCount)) {
    out[teamOf(seat, playerCount)] += handScores[seat] ?? 0;
  }
  return out;
}

function finishRound(
  state: DominoesState,
  winnerSeat: SeatId,
  reason: 'domino' | 'blocked',
): DominoesState {
  const winTeam = teamOf(winnerSeat, state.playerCount);
  const oppTiles: Tile[] = [];
  for (const seat of opponentSeats(winnerSeat, state.playerCount)) {
    oppTiles.push(...state.hands[seat]);
  }
  const bonus = roundEndPoints(oppTiles, state.ruleVariant);
  const handScores = [...state.handScores];
  handScores[winnerSeat] += bonus;
  return {
    ...state,
    phase: 'roundOver',
    winner: winnerSeat,
    winningTeam: winTeam,
    roundEndReason: reason,
    handScores,
    lastPlayScore: bonus,
    currentPlayer: winnerSeat,
  };
}

/** Fold a completed hand into the match scoreboard (by team). */
export function applyRoundToMatch(
  match: MatchState,
  handScores: number[],
): MatchState {
  if (match.matchOver) return match;
  const playerCount = match.playerCount;
  const roundTeams = teamHandScores(handScores, playerCount);
  const scores: [number, number] = [
    match.scores[0] + roundTeams[0],
    match.scores[1] + roundTeams[1],
  ];
  const bothReached =
    scores[0] >= match.target || scores[1] >= match.target;
  if (bothReached && scores[0] !== scores[1]) {
    return {
      scores,
      target: match.target,
      round: match.round,
      matchOver: true,
      matchWinner: scores[0] > scores[1] ? 0 : 1,
      playerCount,
    };
  }
  return {
    scores,
    target: match.target,
    round: match.round,
    matchOver: false,
    matchWinner: null,
    playerCount,
  };
}

/** Call when dealing the next hand after a completed round. */
export function advanceMatchRound(match: MatchState): MatchState {
  if (match.matchOver) return match;
  return { ...match, round: match.round + 1 };
}

export function playTile(
  state: DominoesState,
  player: SeatId,
  tileId: number,
  end: EndId,
): DominoesState | null {
  if (state.phase !== 'playing' || state.currentPlayer !== player) return null;
  const hand = state.hands[player];
  const tile = hand.find((t) => t.id === tileId);
  if (!tile) return null;
  const newBoard = placeTile(state.board, tile, end, state.ruleVariant);
  if (!newBoard) return null;

  const newHands = state.hands.map((h, i) =>
    i === player ? removeFromHand(h, tileId) : h,
  );
  const playScore =
    state.ruleVariant === 'fives' ? scoreOpenEnds(newBoard) : 0;
  const handScores = [...state.handScores];
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
    currentPlayer: nextSeat(player, state.playerCount),
  };
}

export function drawTiles(state: DominoesState, player: SeatId): DominoesState {
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
    const newHands = s.hands.map((h, i) =>
      i === player ? [...h, drawn] : h,
    );
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

function allBlocked(state: DominoesState): boolean {
  const boneyardExhausted =
    !usesDraw(state.ruleVariant) || state.boneyard.length <= BONEYARD_LEAVE;
  if (!boneyardExhausted) return false;
  return seatsFor(state.playerCount).every(
    (seat) => !canPlay(state.hands[seat], state.board),
  );
}

function passTurn(state: DominoesState): DominoesState {
  if (allBlocked(state)) {
    // Lowest team pip count wins the block.
    const sum0 = teamHandSum(state.hands, 0, state.playerCount);
    const sum1 = teamHandSum(state.hands, 1, state.playerCount);
    const winTeam: TeamId = sum0 <= sum1 ? 0 : 1;
    const winnerSeat =
      seatsFor(state.playerCount).find(
        (s) => teamOf(s, state.playerCount) === winTeam,
      ) ?? 0;
    return finishRound(state, winnerSeat, 'blocked');
  }
  return {
    ...state,
    currentPlayer: nextSeat(state.currentPlayer, state.playerCount),
  };
}

export function pass(
  state: DominoesState,
  player: SeatId,
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
  hard: '記過牌缺門、算得分與堵端',
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
  /** Extra weight when hard AI remembers pass-voids (pip inference). */
  voidMemoryWeight: number;
  /** Partners: prefer leaving ends the partner can still use. */
  partnerHelpWeight: number;
};

const DIFFICULTY: Record<Difficulty, DifficultyConfig> = {
  easy: {
    blunderRate: 0.45,
    flexibilityWeight: 0,
    dumpLightFirst: true,
    scoreWeight: 0,
    leaveScorePenalty: 0,
    lackFeedWeight: 0,
    voidMemoryWeight: 0,
    partnerHelpWeight: 0,
  },
  normal: {
    blunderRate: 0.12,
    flexibilityWeight: 3,
    dumpLightFirst: false,
    scoreWeight: 4,
    leaveScorePenalty: 0,
    lackFeedWeight: 0,
    voidMemoryWeight: 0,
    partnerHelpWeight: 2,
  },
  hard: {
    blunderRate: 0,
    flexibilityWeight: 6,
    dumpLightFirst: false,
    scoreWeight: 12,
    leaveScorePenalty: 10,
    lackFeedWeight: 8,
    voidMemoryWeight: 14,
    partnerHelpWeight: 10,
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

/**
 * Count how often each pip still appears among unseen tiles
 * (set minus board minus known hand). Used by hard AI as a soft prior.
 */
export function remainingPipCounts(
  board: Board,
  knownHand: Tile[],
): number[] {
  const counts = Array.from({ length: 7 }, () => 0);
  for (const t of createSet()) {
    counts[t.left] += 1;
    counts[t.right] += 1;
  }
  const seen = new Set<number>();
  const mark = (t: Tile) => {
    if (seen.has(t.id)) return;
    seen.add(t.id);
    counts[t.left] -= 1;
    counts[t.right] -= 1;
  };
  if (board.hub) mark(board.hub.tile);
  for (const end of ['left', 'right', 'up', 'down'] as EndId[]) {
    for (const p of board.arms[end]) mark(p.tile);
  }
  for (const t of knownHand) mark(t);
  return counts.map((c) => Math.max(0, c));
}

export type BotMove = { tileId: number; end: EndId };

export type BotOptions = {
  ruleVariant?: RuleVariant;
  /** Combined pip voids for opposing seats. */
  opponentLack?: number[];
  /** Pips the partner appears to lack — avoid leaving those ends. */
  partnerLack?: number[];
  /** When true, bot cooperates with a partner (partners table). */
  cooperative?: boolean;
  /** Prefer deterministic tie-break (daily / tests). */
  deterministic?: boolean;
};

export function pickBotMove(
  hand: Tile[],
  board: Board,
  opponentHandSize: number = 7,
  difficulty: Difficulty = 'normal',
  options: BotOptions = {},
): BotMove | null {
  const ruleVariant = options.ruleVariant ?? 'draw';
  const opponentLack = options.opponentLack ?? [];
  const partnerLack = options.partnerLack ?? [];
  const cooperative = options.cooperative ?? false;
  const moves = getValidMoves(hand, board, ruleVariant);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  const config = DIFFICULTY[difficulty];
  if (
    !options.deterministic &&
    config.blunderRate > 0 &&
    Math.random() < config.blunderRate
  ) {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const tileById = new Map(hand.map((t) => [t.id, t]));
  const pipRemain = remainingPipCounts(board, hand);
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

    const newEnds = openPipsOf(nextBoard);

    // Feed suits opponents appear to lack (block them).
    if (config.lackFeedWeight > 0 && opponentLack.length > 0) {
      const lackHits = newEnds.filter((p) => opponentLack.includes(p)).length;
      score += lackHits * config.lackFeedWeight;
    }

    // Hard: stronger void memory — prefer ends opponents passed on;
    // avoid opening suits that still look plentiful for them.
    if (config.voidMemoryWeight > 0) {
      for (const pip of newEnds) {
        if (opponentLack.includes(pip)) {
          score += config.voidMemoryWeight;
        } else {
          // Soft prior: fewer remaining copies → safer to leave for them.
          score -= Math.min(4, pipRemain[pip] ?? 0) * 0.35;
        }
      }
    }

    // Partners: do not leave ends the partner has voided; prefer ends they can use.
    if (cooperative && config.partnerHelpWeight > 0) {
      for (const pip of newEnds) {
        if (partnerLack.includes(pip)) {
          score -= config.partnerHelpWeight;
        } else {
          score += config.partnerHelpWeight * 0.35;
        }
      }
      // Avoid giving opponents an easy All Fives leave when partnering.
      if (ruleVariant === 'fives') {
        const leave = sumOpenEnds(nextBoard);
        if (leave > 0 && leave % 5 === 0) {
          score -= leave * 0.5;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      best = [move];
    } else if (score === bestScore) {
      best.push(move);
    }
  }

  if (best.length === 0) return moves[0];
  if (options.deterministic) {
    best.sort((a, b) => a.tileId - b.tileId || a.end.localeCompare(b.end));
    return best[0];
  }
  return best[Math.floor(Math.random() * best.length)];
}

/** Merge suspected-lack lists from several opposing seats. */
export function mergeLackLists(lists: number[][]): number[] {
  const set = new Set<number>();
  for (const list of lists) {
    for (const p of list) set.add(p);
  }
  return [...set];
}

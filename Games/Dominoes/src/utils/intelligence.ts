import {
  canAttachToEnd,
  getEndPip,
  getPlayableEnds,
  placeTile,
  scoreOpenEnds,
  sumOpenEnds,
  type Board,
} from './board';
import {
  createSet,
  handSum,
  tileSum,
  type DominoesState,
} from './dominoesLogic';
import type { GameMode } from './storage';
import type {
  EndId,
  SeatId,
  Tile,
} from './types';
import { opponentSeats } from './types';

export type TileMatrixStatus = 'board' | 'hand' | 'unseen';

export interface TileMatrixItem {
  tile: Tile;
  status: TileMatrixStatus;
}

export interface PipSuitAnalysis {
  pip: number;
  total: number;
  onBoard: number;
  inHand: number;
  unseen: number;
  isDead: boolean;
}

export interface MoveScoreSimulation {
  tileId: number;
  tile: Tile;
  end: EndId;
  endPip: number;
  resultingSum: number;
  score: number;
  isScoring: boolean;
}

export interface EndRadarStatus {
  end: EndId;
  pip: number;
  unseenCount: number;
  isDead: boolean;
  playerCanPlay: boolean;
}

export interface BlockadeAnalysis {
  openEnds: EndRadarStatus[];
  isLocked: boolean;
  playerHandSum: number;
  oppHandTileCount: number;
  estimatedOppHandSum: number;
  favorableBlock: boolean;
}

export interface OpponentDossier {
  seat: SeatId;
  label: string;
  handCount: number;
  suspectedLacks: number[];
  lackExplanations: string[];
  tacticalTip: string;
}

/** Check whether a tile ID is present on the board (hub or any arm). */
export function isTileOnBoard(board: Board, tileId: number): boolean {
  if (board.hub && board.hub.tile.id === tileId) return true;
  for (const end of ['left', 'right', 'up', 'down'] as EndId[]) {
    if (board.arms[end].some((p) => p.tile.id === tileId)) return true;
  }
  return false;
}

/**
 * Build the complete 28-tile matrix, classifying each tile as
 * placed on the board, in the viewer's hand, or unseen.
 */
export function getTileMatrix(
  state: DominoesState,
  viewerSeat: SeatId = 0,
): TileMatrixItem[] {
  const fullSet = createSet();
  const handIds = new Set((state.hands[viewerSeat] ?? []).map((t: Tile) => t.id));

  return fullSet.map((tile) => {
    if (isTileOnBoard(state.board, tile.id)) {
      return { tile, status: 'board' };
    }
    if (handIds.has(tile.id)) {
      return { tile, status: 'hand' };
    }
    return { tile, status: 'unseen' };
  });
}

/**
 * Calculate suit availability for pips 0 through 6.
 * Each pip appears on exactly 7 tiles in a standard double-six set.
 */
export function getPipSuitAnalysis(matrix: TileMatrixItem[]): PipSuitAnalysis[] {
  const results: PipSuitAnalysis[] = [];

  for (let pip = 0; pip <= 6; pip++) {
    const matching = matrix.filter(
      (m) => m.tile.left === pip || m.tile.right === pip,
    );
    const onBoard = matching.filter((m) => m.status === 'board').length;
    const inHand = matching.filter((m) => m.status === 'hand').length;
    const unseen = matching.filter((m) => m.status === 'unseen').length;
    const total = matching.length;
    const isDead = unseen === 0 && inHand === 0;

    results.push({
      pip,
      total,
      onBoard,
      inHand,
      unseen,
      isDead,
    });
  }

  return results;
}

/**
 * Simulate all legal moves for the current hand in All Fives variant
 * and calculate their resulting open end sums and instant scores.
 */
export function simulateAllFivesScores(
  hand: Tile[],
  board: Board,
): MoveScoreSimulation[] {
  if (!board.hub) {
    return [];
  }

  const playableEnds = getPlayableEnds(board);
  const simulations: MoveScoreSimulation[] = [];
  const seenKeys = new Set<string>();

  for (const end of playableEnds) {
    const endPip = getEndPip(board, end);
    if (endPip === null) continue;

    for (const tile of hand) {
      if (!canAttachToEnd(tile, endPip)) continue;
      const key = `${tile.id}:${end}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const nextBoard = placeTile(board, tile, end, 'fives');
      if (!nextBoard) continue;

      const sum = sumOpenEnds(nextBoard);
      const score = scoreOpenEnds(nextBoard);

      simulations.push({
        tileId: tile.id,
        tile,
        end,
        endPip,
        resultingSum: sum,
        score,
        isScoring: score > 0,
      });
    }
  }

  simulations.sort((a, b) => b.score - a.score || b.resultingSum - a.resultingSum);
  return simulations;
}

/**
 * Analyze open end vulnerability, unseen pool counters, and blockade advantage.
 */
export function analyzeBlockadeThreat(
  state: DominoesState,
  viewerSeat: SeatId = 0,
): BlockadeAnalysis {
  const matrix = getTileMatrix(state, viewerSeat);
  const playableEnds = getPlayableEnds(state.board);
  const playerHand = state.hands[viewerSeat] ?? [];
  const playerHandSum = handSum(playerHand);

  const openEnds: EndRadarStatus[] = [];
  for (const end of playableEnds) {
    const pip = getEndPip(state.board, end);
    if (pip === null) continue;

    const unseenCount = matrix.filter(
      (m) =>
        m.status === 'unseen' &&
        (m.tile.left === pip || m.tile.right === pip),
    ).length;

    const playerCanPlay = playerHand.some((t: Tile) => canAttachToEnd(t, pip));
    const isDead = unseenCount === 0 && !playerCanPlay;

    openEnds.push({
      end,
      pip,
      unseenCount,
      isDead,
      playerCanPlay,
    });
  }

  const oppSeats = opponentSeats(viewerSeat, state.playerCount);
  let oppHandTileCount = 0;
  for (const s of oppSeats) {
    oppHandTileCount += state.hands[s]?.length ?? 0;
  }

  const unseenTiles = matrix
    .filter((m) => m.status === 'unseen')
    .map((m) => m.tile);

  let estimatedOppHandSum = 0;
  if (unseenTiles.length > 0 && oppHandTileCount > 0) {
    const totalUnseenPips = unseenTiles.reduce((acc, t) => acc + tileSum(t), 0);
    const avgPipPerTile = totalUnseenPips / unseenTiles.length;
    estimatedOppHandSum = Math.round(oppHandTileCount * avgPipPerTile);
  } else {
    for (const s of oppSeats) {
      estimatedOppHandSum += handSum(state.hands[s] ?? []);
    }
  }

  const isLocked =
    openEnds.length > 0 && openEnds.every((e) => e.isDead && !e.playerCanPlay);
  const favorableBlock = playerHandSum < estimatedOppHandSum;

  return {
    openEnds,
    isLocked,
    playerHandSum,
    oppHandTileCount,
    estimatedOppHandSum,
    favorableBlock,
  };
}

/**
 * Generate tactical dossiers for opponent seats, including their suspected
 * lack pips, reasoning deductions, and strategic exploitation guidance.
 */
export function getOpponentDossiers(
  state: DominoesState,
  viewerSeat: SeatId = 0,
  mode: GameMode = 'bot',
): OpponentDossier[] {
  const oppSeats = opponentSeats(viewerSeat, state.playerCount);

  return oppSeats.map((seat) => {
    let label = `對手 ${seat}`;
    if (mode === 'partners') {
      label = seat === 1 ? '對手 A (右座)' : '對手 B (左座)';
    } else if (mode === 'bot' || mode === 'daily') {
      label = '電腦對手';
    } else if (mode === 'two') {
      label = `玩家 ${seat + 1}`;
    }

    const hand = state.hands[seat] ?? [];
    const suspectedLacks = state.suspectedLack[seat] ?? [];

    const lackExplanations: string[] = [];
    if (suspectedLacks.length > 0) {
      const pipsStr = suspectedLacks.join('、');
      lackExplanations.push(`曾在開放 [${pipsStr}] 點時過牌/抽牌，斷定無此花色`);
    }

    let tacticalTip = '對手手牌彈性良好，注意出重牌卸除點數防範封鎖。';
    if (suspectedLacks.length > 0) {
      const targetPips = suspectedLacks.slice(0, 2).join(' 或 ');
      tacticalTip = `控制端點保留 ${targetPips} 點，可壓制對手並迫使其抽牌/跳過！`;
    } else if (hand.length <= 2) {
      tacticalTip = '對手手牌告急，優先防守並計算阻擋可能。';
    }

    return {
      seat,
      label,
      handCount: hand.length,
      suspectedLacks,
      lackExplanations,
      tacticalTip,
    };
  });
}

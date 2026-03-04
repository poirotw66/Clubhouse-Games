import { GameState, Position } from '../types';
import { canMove, executeMove, checkWin, isValidSequence, getSafeFoundationMoves } from './gameLogic';

function hashState(state: GameState): string {
  const fc = state.freeCells.map(c => c ? c.id : '').join(',');
  const fd = `${state.foundations.spades},${state.foundations.hearts},${state.foundations.diamonds},${state.foundations.clubs}`;
  const tab = state.tableaus.map(col => col.map(c => c.id).join(',')).join('|');
  return `${fc}#${fd}#${tab}`;
}

function getAllValidMoves(state: GameState): { source: Position, dest: Position }[] {
  const sources: Position[] = [];
  for (let i = 0; i < 4; i++) {
    if (state.freeCells[i] !== null) sources.push({ zone: 'freeCell', index: i });
  }
  for (let i = 0; i < 8; i++) {
    const col = state.tableaus[i];
    if (col.length > 0) {
      for (let j = col.length - 1; j >= 0; j--) {
        if (isValidSequence(col.slice(j))) {
          sources.push({ zone: 'tableau', index: i, cardIndex: j });
        } else {
          break;
        }
      }
    }
  }

  const destinations: Position[] = [
    ...[0, 1, 2, 3].map(i => ({ zone: 'foundation', index: i } as Position)),
    ...[0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ zone: 'tableau', index: i } as Position)),
    ...[0, 1, 2, 3].map(i => ({ zone: 'freeCell', index: i } as Position))
  ];

  const validMoves: { source: Position, dest: Position }[] = [];
  for (const source of sources) {
    for (const dest of destinations) {
      if (source.zone === dest.zone && source.index === dest.index) continue;
      if (canMove(state, source, dest)) {
        if (source.zone === 'freeCell' && dest.zone === 'freeCell') continue;
        if (source.zone === 'tableau' && dest.zone === 'tableau' && source.cardIndex === 0 && state.tableaus[dest.index].length === 0) continue;
        validMoves.push({ source, dest });
      }
    }
  }
  return validMoves;
}

function getHeuristic(state: GameState): number {
  let score = 0;
  score += Object.values(state.foundations).reduce((a, b) => a + b, 0) * 100;
  score += state.freeCells.filter(c => c === null).length * 20;
  score += state.tableaus.filter(t => t.length === 0).length * 50;
  return score;
}

export async function solveGame(initialState: GameState, onProgress: (nodes: number) => void): Promise<{ source: Position, dest: Position }[] | null> {
  const visited = new Set<string>();
  
  interface Node {
    state: GameState;
    path: { source: Position, dest: Position }[];
    score: number;
  }

  const queue: Node[] = [{
    state: initialState,
    path: [],
    score: getHeuristic(initialState)
  }];

  let nodesExplored = 0;

  while (queue.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].score > bestScore) {
        bestScore = queue[i].score;
        bestIdx = i;
      }
    }
    
    const current = queue[bestIdx];
    queue.splice(bestIdx, 1);

    nodesExplored++;
    if (nodesExplored % 200 === 0) {
      onProgress(nodesExplored);
      await new Promise(r => setTimeout(r, 0));
    }

    if (nodesExplored > 15000) {
      return null;
    }

    if (checkWin(current.state)) {
      return current.path;
    }

    const hash = hashState(current.state);
    if (visited.has(hash)) continue;
    visited.add(hash);

    const safeMove = getSafeFoundationMoves(current.state);
    if (safeMove) {
        const nextState = executeMove(current.state, safeMove.source, safeMove.dest);
        queue.push({
          state: nextState,
          path: [...current.path, safeMove],
          score: getHeuristic(nextState)
        });
        continue;
    }

    const moves = getAllValidMoves(current.state);
    for (const move of moves) {
      const nextState = executeMove(current.state, move.source, move.dest);
      const nextHash = hashState(nextState);
      if (!visited.has(nextHash)) {
        queue.push({
          state: nextState,
          path: [...current.path, move],
          score: getHeuristic(nextState)
        });
      }
    }
  }
  return null;
}

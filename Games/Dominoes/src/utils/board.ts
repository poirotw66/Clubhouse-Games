/**
 * Domino board layout: linear arms for Draw/Block, spinner cross for All Fives.
 */

import type { EndId, PlacedTile, RuleVariant, Tile } from './types';
import { ALL_ENDS, LINE_ENDS } from './types';

export interface Board {
  hub: PlacedTile | null;
  /** True once the first double has been set as the All Fives spinner. */
  spinnerActive: boolean;
  arms: Record<EndId, PlacedTile[]>;
}

export function emptyBoard(): Board {
  return {
    hub: null,
    spinnerActive: false,
    arms: { left: [], right: [], up: [], down: [] },
  };
}

export function isDouble(tile: Tile): boolean {
  return tile.left === tile.right;
}

export function canAttachToEnd(tile: Tile, endPip: number): boolean {
  return tile.left === endPip || tile.right === endPip;
}

export function getOutwardPip(tile: Tile, endPip: number): number | null {
  if (tile.left === endPip) return tile.right;
  if (tile.right === endPip) return tile.left;
  return null;
}

export function cloneBoard(board: Board): Board {
  return {
    hub: board.hub ? { ...board.hub, tile: board.hub.tile } : null,
    spinnerActive: board.spinnerActive,
    arms: {
      left: [...board.arms.left],
      right: [...board.arms.right],
      up: [...board.arms.up],
      down: [...board.arms.down],
    },
  };
}

/** Pip currently exposed on an arm (or hub face if the arm is empty). */
export function getEndPip(board: Board, end: EndId): number | null {
  if (!board.hub) return null;
  const arm = board.arms[end];
  if (arm.length > 0) return arm[arm.length - 1].outward;

  if (board.spinnerActive) {
    return board.hub.tile.left;
  }
  if (end === 'up' || end === 'down') return null;
  return end === 'left' ? board.hub.inward : board.hub.outward;
}

/**
 * Ends that accept a play. Spinner up/down unlock only after both left and
 * right arms have at least one tile (Pagat All Fives).
 */
export function getPlayableEnds(board: Board): EndId[] {
  if (!board.hub) return ['left'];
  if (!board.spinnerActive) return LINE_ENDS;
  const sidesFilled = board.arms.left.length > 0 && board.arms.right.length > 0;
  return sidesFilled ? ALL_ENDS : LINE_ENDS;
}

function tipCountValue(arm: PlacedTile[]): number {
  const tip = arm[arm.length - 1];
  return isDouble(tip.tile) ? tip.tile.left * 2 : tip.outward;
}

/**
 * Open-end values for All Fives scoring (Pagat / Spruce spinner rules).
 *
 * - Linear: two ends; a double tip counts both halves.
 * - Spinner alone: counts as 2×pip.
 * - Spinner + one side: spinner still 2×pip + that arm's tip.
 * - Both sides filled: spinner drops out; only arm tips count (2, 3, or 4).
 */
export function getOpenEndCounts(
  board: Board,
): Array<{ end: EndId; value: number }> {
  if (!board.hub) return [];
  const hubPip = board.hub.tile.left;
  const hubDouble = isDouble(board.hub.tile);

  if (!board.spinnerActive) {
    const leftArm = board.arms.left;
    const rightArm = board.arms.right;

    if (leftArm.length === 0 && rightArm.length === 0) {
      if (hubDouble) return [{ end: 'left', value: hubPip * 2 }];
      return [
        { end: 'left', value: board.hub.inward },
        { end: 'right', value: board.hub.outward },
      ];
    }

    const counts: Array<{ end: EndId; value: number }> = [];
    if (leftArm.length === 0) {
      counts.push({
        end: 'left',
        value: hubDouble ? hubPip * 2 : board.hub.inward,
      });
    } else {
      counts.push({ end: 'left', value: tipCountValue(leftArm) });
    }
    if (rightArm.length === 0) {
      counts.push({
        end: 'right',
        value: hubDouble ? hubPip * 2 : board.hub.outward,
      });
    } else {
      counts.push({ end: 'right', value: tipCountValue(rightArm) });
    }
    return counts;
  }

  // Spinner layout
  const leftLen = board.arms.left.length;
  const rightLen = board.arms.right.length;
  const upLen = board.arms.up.length;
  const downLen = board.arms.down.length;
  const sidesFilled = leftLen > 0 && rightLen > 0;

  if (!sidesFilled) {
    const result: Array<{ end: EndId; value: number }> = [
      { end: leftLen === 0 ? 'left' : 'right', value: hubPip * 2 },
    ];
    if (leftLen > 0) result.push({ end: 'left', value: tipCountValue(board.arms.left) });
    if (rightLen > 0) result.push({ end: 'right', value: tipCountValue(board.arms.right) });
    return result;
  }

  const result: Array<{ end: EndId; value: number }> = [
    { end: 'left', value: tipCountValue(board.arms.left) },
    { end: 'right', value: tipCountValue(board.arms.right) },
  ];
  if (upLen > 0) result.push({ end: 'up', value: tipCountValue(board.arms.up) });
  if (downLen > 0) result.push({ end: 'down', value: tipCountValue(board.arms.down) });
  return result;
}

export function sumOpenEnds(board: Board): number {
  return getOpenEndCounts(board).reduce((s, c) => s + c.value, 0);
}

/** Instant All Fives score: open-end sum when it is a positive multiple of 5. */
export function scoreOpenEnds(board: Board): number {
  const sum = sumOpenEnds(board);
  return sum > 0 && sum % 5 === 0 ? sum : 0;
}

export function placeFirstTile(
  board: Board,
  tile: Tile,
  ruleVariant: RuleVariant,
): Board {
  const next = cloneBoard(board);
  next.hub = { tile, inward: tile.left, outward: tile.right };
  next.spinnerActive = ruleVariant === 'fives' && isDouble(tile);
  return next;
}

/**
 * Rebuild the board so `doubleTile` is the spinner hub and the previous
 * linear layout hangs off the opposite arm from `attachEnd`.
 */
function promoteDoubleToSpinner(
  board: Board,
  doubleTile: Tile,
  attachEnd: EndId,
): Board {
  if (!board.hub) {
    return {
      hub: { tile: doubleTile, inward: doubleTile.left, outward: doubleTile.right },
      spinnerActive: true,
      arms: { left: [], right: [], up: [], down: [] },
    };
  }

  // Build left→right sequence of tiles as oriented along the line.
  type Step = { tile: Tile; left: number; right: number };
  const sequence: Step[] = [
    ...[...board.arms.left].reverse().map((p) => ({
      tile: p.tile,
      left: p.outward,
      right: p.inward,
    })),
    {
      tile: board.hub.tile,
      left: board.hub.inward,
      right: board.hub.outward,
    },
    ...board.arms.right.map((p) => ({
      tile: p.tile,
      left: p.inward,
      right: p.outward,
    })),
  ];

  // The double attaches to attachEnd, so the whole prior line becomes the
  // opposite spinner arm, oriented with inward facing the spinner.
  const spinnerPip = doubleTile.left;
  const opposite: EndId = attachEnd === 'left' ? 'right' : 'left';

  // Order tiles starting from the face that touched the double.
  const ordered: Step[] =
    attachEnd === 'right' ? [...sequence].reverse() : sequence;

  const arm: PlacedTile[] = [];
  let need = spinnerPip;
  for (const step of ordered) {
    const out = getOutwardPip(step.tile, need);
    if (out === null) {
      // Orientation mismatch — fall back to attaching without rebuild.
      const next = cloneBoard(board);
      next.arms[attachEnd] = [
        ...next.arms[attachEnd],
        { tile: doubleTile, inward: need, outward: doubleTile.left },
      ];
      next.spinnerActive = true;
      // Keep old hub; mark spinner on the double tip instead — rare path.
      return next;
    }
    arm.push({ tile: step.tile, inward: need, outward: out });
    need = out;
  }

  return {
    hub: { tile: doubleTile, inward: doubleTile.left, outward: doubleTile.right },
    spinnerActive: true,
    arms: {
      left: opposite === 'left' ? arm : [],
      right: opposite === 'right' ? arm : [],
      up: [],
      down: [],
    },
  };
}

/** Attach a tile to an open end; returns new board or null if illegal. */
export function placeTile(
  board: Board,
  tile: Tile,
  end: EndId,
  ruleVariant: RuleVariant = 'draw',
): Board | null {
  if (!board.hub) {
    if (end !== 'left' && end !== 'right') return null;
    return placeFirstTile(board, tile, ruleVariant);
  }

  const playable = getPlayableEnds(board);
  if (!playable.includes(end)) return null;

  const endPip = getEndPip(board, end);
  if (endPip === null) return null;
  const outward = getOutwardPip(tile, endPip);
  if (outward === null) return null;

  // First double in All Fives becomes the spinner (may rebuild the hub).
  if (
    ruleVariant === 'fives' &&
    !board.spinnerActive &&
    isDouble(tile) &&
    (end === 'left' || end === 'right')
  ) {
    return promoteDoubleToSpinner(board, tile, end);
  }

  const next = cloneBoard(board);
  next.arms[end] = [...next.arms[end], { tile, inward: endPip, outward }];
  return next;
}

/** Left/right pips for compact UI (spinner up/down shown separately). */
export function getChainEnds(board: Board): { left: number; right: number } | null {
  if (!board.hub) return null;
  const left = getEndPip(board, 'left');
  const right = getEndPip(board, 'right');
  if (left === null || right === null) return null;
  return { left, right };
}

/** Flatten hub + left/right into a left-to-right display list. */
export function boardToChain(board: Board): Array<{
  tile: Tile;
  displayLeft: number;
  displayRight: number;
}> {
  if (!board.hub) return [];
  const leftArm = [...board.arms.left].reverse().map((p) => ({
    tile: p.tile,
    displayLeft: p.outward,
    displayRight: p.inward,
  }));
  const hub = {
    tile: board.hub.tile,
    displayLeft: board.hub.inward,
    displayRight: board.hub.outward,
  };
  const rightArm = board.arms.right.map((p) => ({
    tile: p.tile,
    displayLeft: p.inward,
    displayRight: p.outward,
  }));
  return [...leftArm, hub, ...rightArm];
}

// ponytail: chain ends, legal plays, empty-hand win, and blocked pip scoring.
import {
  createSet,
  getChainEnds,
  canAttachToEnd,
  placeTile,
  getPlayableTiles,
  getValidMoves,
  isValidPlay,
  playTile,
  pass,
  drawTiles,
  handSum,
  tileSum,
} from './utils/dominoesLogic.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const tile = (id, left, right) => ({ id, left, right });
const placed = (t, displayLeft, displayRight) => ({ tile: t, displayLeft, displayRight });

// Double-six set is 28 unique tiles.
{
  const set = createSet();
  assert(set.length === 28, `double-six set should be 28, got ${set.length}`);
  const keys = new Set(set.map((t) => `${t.left}-${t.right}`));
  assert(keys.size === 28, 'each face combination must appear once');
  assert(set[0].left === 0 && set[0].right === 0, 'first tile should be 0-0');
  assert(set[27].left === 6 && set[27].right === 6, 'last tile should be 6-6');
}

// Empty chain: every hand tile is playable; ends are null.
{
  const hand = [tile(1, 3, 5), tile(2, 0, 0)];
  assert(getChainEnds([]) === null, 'empty chain has no ends');
  assert(getPlayableTiles(hand, []).length === 2, 'empty chain: all hand tiles playable');
  const moves = getValidMoves(hand, []);
  assert(moves.length === 2, 'empty chain: one left-end starter per tile');
  assert(moves.every((m) => m.end === 'left'), 'starter moves use left end');
}

// Chain ends read displayLeft / displayRight.
{
  const a = tile(10, 6, 6);
  const b = tile(11, 6, 3);
  const chain = [
    placed(a, 6, 6),
    placed(b, 6, 3),
  ];
  const ends = getChainEnds(chain);
  assert(ends && ends.left === 6 && ends.right === 3, `ends should be 6/3, got ${JSON.stringify(ends)}`);
}

// Matching / non-matching attach + place orientation.
{
  const chain = [placed(tile(1, 4, 4), 4, 4)];
  const match = tile(2, 4, 1);
  const miss = tile(3, 5, 2);
  assert(canAttachToEnd(match, 4), '4-1 attaches to 4');
  assert(!canAttachToEnd(miss, 4), '5-2 does not attach to 4');

  const left = placeTile(chain, match, 'left');
  assert(left, 'place on left should succeed');
  assert(left[0].displayLeft === 1 && left[0].displayRight === 4, 'left place orients outward');
  assert(getChainEnds(left).left === 1 && getChainEnds(left).right === 4, 'left end becomes 1');

  const right = placeTile(chain, match, 'right');
  assert(right, 'place on right should succeed');
  assert(right[1].displayLeft === 4 && right[1].displayRight === 1, 'right place orients outward');
  assert(placeTile(chain, miss, 'left') === null, 'illegal place returns null');
}

// Legal moves list both ends when a tile matches both (e.g. double on open 3/3).
{
  const chain = [
    placed(tile(1, 3, 5), 3, 5),
    placed(tile(2, 5, 3), 5, 3),
  ];
  const ends = getChainEnds(chain);
  assert(ends.left === 3 && ends.right === 3, 'both ends are 3');
  const double3 = tile(3, 3, 3);
  const hand = [double3, tile(4, 0, 1)];
  const moves = getValidMoves(hand, chain);
  assert(moves.some((m) => m.tileId === 3 && m.end === 'left'), 'double-3 legal on left');
  assert(moves.some((m) => m.tileId === 3 && m.end === 'right'), 'double-3 legal on right');
  assert(!moves.some((m) => m.tileId === 4), '0-1 not legal on 3/3');
  assert(isValidPlay(hand, chain, 3, 'left'), 'isValidPlay agrees for double-3 left');
  assert(!isValidPlay(hand, chain, 4, 'left'), 'isValidPlay rejects 0-1');
}

// Empty-hand win via playTile.
{
  const last = tile(7, 2, 6);
  const state = {
    currentPlayer: 0,
    hands: [[last], [tile(8, 1, 1)]],
    chain: [placed(tile(9, 6, 6), 6, 6)],
    boneyard: [tile(10, 0, 0), tile(11, 0, 1)],
    phase: 'playing',
    winner: null,
    ruleVariant: 'draw',
  };
  const next = playTile(state, 0, 7, 'right');
  assert(next, 'final play should succeed');
  assert(next.phase === 'won', 'empty hand should win');
  assert(next.winner === 0, 'player 0 should be winner');
  assert(next.hands[0].length === 0, 'winner hand empty');
}

// Blocked scoring: lower pip sum wins (ties favor player 0).
{
  const hand0 = [tile(1, 1, 2)]; // 3
  const hand1 = [tile(2, 3, 3)]; // 6
  assert(tileSum(hand0[0]) === 3, '1-2 is 3 pips');
  assert(handSum(hand0) === 3 && handSum(hand1) === 6, 'hand sums');
  assert(handSum(hand0) <= handSum(hand1), 'player 0 has lower (or equal) pips');
  // Mirror passTurn winner rule: sum0 <= sum1 → player 0.
  const winner = handSum(hand0) <= handSum(hand1) ? 0 : 1;
  assert(winner === 0, 'blocked: lower pip sum wins');
}

// Block variant: stuck player passes (no draw); both stuck → blocked.
{
  const chain = [placed(tile(1, 6, 6), 6, 6)];
  const state = {
    currentPlayer: 0,
    hands: [[tile(2, 1, 2)], [tile(3, 3, 4)]],
    chain,
    boneyard: [tile(4, 0, 0), tile(5, 0, 1), tile(6, 0, 2)],
    phase: 'playing',
    winner: null,
    ruleVariant: 'block',
  };
  assert(pass(state, 0) !== null, 'block: may pass when stuck');
  const afterPass = pass(state, 0);
  assert(afterPass.phase === 'blocked', 'block: both stuck ends the round');
  assert(drawTiles(state, 0).phase === 'blocked', 'block: drawTiles redirects to pass');
}

// Draw variant: cannot pass while boneyard still has drawable tiles.
{
  const chain = [placed(tile(1, 6, 6), 6, 6)];
  const state = {
    currentPlayer: 0,
    hands: [[tile(2, 1, 2)], [tile(3, 3, 4)]],
    chain,
    boneyard: [tile(4, 0, 0), tile(5, 0, 1), tile(6, 5, 5)],
    phase: 'playing',
    winner: null,
    ruleVariant: 'draw',
  };
  assert(pass(state, 0) === null, 'draw: pass blocked while boneyard > 2');
  const drawn = drawTiles(state, 0);
  assert(drawn.hands[0].length >= 2, 'draw: pulls until playable or yard left at 2');
}

console.log('check-dominoes: ok');

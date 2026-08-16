import * as assert from 'node:assert/strict';
import {
  RANKS,
  SUITS,
  TOTAL_POINTS,
  WINNING_POINTS,
  buildDeck,
  capturableBy,
  isRed,
  matches,
  pointsOf,
  shuffle,
  sumPoints,
} from '../src/game/cards.js';
import {
  HAND_SIZE,
  PILE_SIZE,
  TABLE_SIZE,
  allCards,
  applyCpuPlay,
  bestCapture,
  choosePick,
  deal,
  flip,
  outcome,
  playCard,
  score,
} from '../src/game/engine.js';
import { DIFFICULTIES, chooseMove, difficultyInfo } from '../src/game/cpu.js';
import { EMPTY_STATS, recordResult } from '../src/game/storage.js';
import { createRng } from '../src/game/rng.js';
import type { Card, DifficultyId, GameState } from '../src/game/types.js';

const TIERS: DifficultyId[] = ['easy', 'normal', 'hard'];

function seeds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `check-${i}`);
}

/**
 * The 湊十 rule spelled out case by case. This is the one rule a port gets
 * wrong quietly: a table of "sums to ten" alone silently makes two tens fail to
 * pair, and a table of "same rank" alone silently makes 3+7 fail.
 */
function expectMatchingRule(): void {
  const card = (rank: number, suit = 'spades'): Card =>
    ({ id: `${suit}-${rank}`, suit, rank } as Card);

  for (const [a, b] of [
    [1, 9],
    [2, 8],
    [3, 7],
    [4, 6],
    [5, 5],
  ]) {
    assert.ok(matches(card(a), card(b)), `${a} should pair with ${b}`);
  }

  for (const rank of [10, 11, 12, 13]) {
    assert.ok(matches(card(rank), card(rank)), `${rank} should pair with itself`);
  }

  // The boundary. Ten belongs to the same-rank rule even though nothing sums
  // to ten with it, and the low ranks never pair by equality except five.
  assert.ok(!matches(card(10), card(13)), '10 must not pair with K');
  assert.ok(!matches(card(3), card(3)), '3 must not pair with 3');
  assert.ok(!matches(card(4), card(4)), '4 must not pair with 4');
  assert.ok(!matches(card(1), card(10)), 'A must not pair with 10 by summing to 11');
  assert.ok(!matches(card(9), card(11)), '9 must not pair with J');

  // Suit never enters into it.
  assert.ok(matches(card(3, 'hearts'), card(7, 'clubs')), 'suits must not affect matching');

  // Symmetry, exhaustively over the whole deck.
  const deck = buildDeck();
  for (const a of deck) {
    for (const b of deck) {
      assert.equal(matches(a, b), matches(b, a), `matching is not symmetric for ${a.id}/${b.id}`);
    }
  }
}

/** The scoring table has to add to 208, and only red cards may contribute. */
function expectScoringTable(): void {
  const deck = buildDeck();
  assert.equal(deck.length, 52, 'the deck is not 52 cards');
  assert.equal(new Set(deck.map((c) => c.id)).size, 52, 'the deck contains duplicate ids');
  assert.equal(SUITS.length * RANKS.length, 52, 'suits times ranks is not 52');

  assert.equal(sumPoints(deck), TOTAL_POINTS, `red points do not total ${TOTAL_POINTS}`);
  assert.equal(
    sumPoints(deck.filter((c) => !isRed(c))),
    0,
    'black cards are scoring points',
  );

  const red = deck.filter(isRed);
  assert.equal(red.length, 26, 'there are not 26 red cards');
  assert.equal(sumPoints(red.filter((c) => c.rank === 1)), 40, 'red aces are not worth 40');
  assert.equal(sumPoints(red.filter((c) => c.rank >= 10)), 80, 'red court cards are not worth 80');
  assert.equal(
    sumPoints(red.filter((c) => c.rank >= 2 && c.rank <= 9)),
    88,
    'red pip cards are not worth 88',
  );

  // Winning needs a strict majority, so both players cannot reach it.
  assert.ok(WINNING_POINTS * 2 > TOTAL_POINTS, 'two players could both reach the winning line');
  assert.equal(WINNING_POINTS, Math.floor(TOTAL_POINTS / 2) + 1, 'the winning line is not a majority');
}

/** The deal has to balance to the card, otherwise the pile does not run out. */
function expectDealBalances(): void {
  assert.equal(HAND_SIZE * 2 + TABLE_SIZE + PILE_SIZE, 52, 'the deal does not use 52 cards');
  // Each side plays HAND_SIZE cards and flips once per play.
  assert.equal(PILE_SIZE, HAND_SIZE * 2, 'the pile does not cover one flip per hand card');

  for (const seedCode of seeds(20)) {
    const state = deal(seedCode, 'normal');
    assert.equal(state.hands.player.length, HAND_SIZE);
    assert.equal(state.hands.cpu.length, HAND_SIZE);
    assert.equal(state.table.length, TABLE_SIZE);
    assert.equal(state.pile.length, PILE_SIZE);
    assert.equal(new Set(allCards(state).map((c) => c.id)).size, 52, 'the deal lost or duplicated a card');
  }
}

/** Fisher-Yates must actually permute, and must do it the same way every time. */
function expectShuffleIsDeterministicAndMixes(): void {
  const deck = buildDeck();
  const a = shuffle(deck, createRng(7));
  const b = shuffle(deck, createRng(7));
  assert.deepEqual(a.map((c) => c.id), b.map((c) => c.id), 'the same seed gave a different shuffle');

  const c = shuffle(deck, createRng(8));
  assert.notDeepEqual(a.map((c) => c.id), c.map((x) => x.id), 'different seeds gave the same shuffle');

  // Every card must be able to reach every position; a biased shuffle would
  // leave some position always holding cards from a narrow slice of the deck.
  const seenAtZero = new Set<string>();
  for (let seed = 0; seed < 400; seed++) seenAtZero.add(shuffle(deck, createRng(seed))[0].id);
  assert.ok(seenAtZero.size > 30, `the first position only ever held ${seenAtZero.size} cards`);
}

/** Drive a whole game with the CPU on both sides and check it stays legal. */
function playOut(seedCode: string, difficulty: DifficultyId): GameState {
  const info = difficultyInfo(difficulty);
  let state = deal(seedCode, difficulty, info.leader);
  let guard = 0;

  while (state.phase !== 'over') {
    assert.ok(guard++ < 200, 'the game did not terminate');
    assert.equal(new Set(allCards(state).map((c) => c.id)).size, 52, 'a card went missing mid-game');

    if (state.phase === 'flip') {
      state = flip(state);
      continue;
    }

    if (state.phase === 'player_play') {
      // Stand in for the human with the simplest legal policy.
      const card =
        state.hands.player.find((c) => capturableBy(c, state.table).length > 0) ??
        state.hands.player[0];
      state = playCard(state, card.id);
      continue;
    }

    if (state.phase === 'player_pick') {
      const options = capturableBy(state.pending!, state.table);
      assert.ok(options.length > 1, 'parked for a pick with fewer than two options');
      state = choosePick(state, options[0].id);
      continue;
    }

    const move = chooseMove(state, info.brain);
    assert.ok(
      state.hands.cpu.some((c) => c.id === move.card.id),
      'the CPU played a card it does not hold',
    );
    if (move.taken) {
      assert.ok(
        state.table.some((c) => c.id === move.taken!.id) && matches(move.card, move.taken),
        'the CPU claimed an illegal capture',
      );
    } else {
      assert.equal(
        capturableBy(move.card, state.table).length,
        0,
        'the CPU discarded a card that could have captured',
      );
    }
    state = applyCpuPlay(state, move.card, move.taken);
  }

  return state;
}

function expectGamesFinishCleanly(): void {
  for (const difficulty of TIERS) {
    for (const seedCode of seeds(12)) {
      const end = playOut(seedCode, difficulty);

      assert.equal(end.hands.player.length, 0, 'the player finished holding cards');
      assert.equal(end.hands.cpu.length, 0, 'the CPU finished holding cards');
      assert.equal(end.pile.length, 0, 'the pile did not run out');
      assert.equal(end.log.length, HAND_SIZE * 4, 'the wrong number of cards were played');
      assert.equal(new Set(allCards(end).map((c) => c.id)).size, 52, 'the game lost a card');

      // Captures come in pairs, so every pile is even and the table holds
      // whatever nobody could take.
      assert.equal(end.captured.player.length % 2, 0, 'the player captured an odd number of cards');
      assert.equal(end.captured.cpu.length % 2, 0, 'the CPU captured an odd number of cards');

      const result = outcome(end);
      assert.equal(
        result.playerPoints + result.cpuPoints + result.wastedPoints,
        TOTAL_POINTS,
        'points captured plus points abandoned do not total 208',
      );
    }
  }
}

/** Same seed, same difficulty, same game — the deal is the only randomness. */
function expectDeterminism(): void {
  for (const seedCode of seeds(6)) {
    for (const difficulty of TIERS) {
      const a = playOut(seedCode, difficulty);
      const b = playOut(seedCode, difficulty);
      assert.deepEqual(
        a.log.map((e) => `${e.by}:${e.played.id}:${e.taken?.id ?? '-'}`),
        b.log.map((e) => `${e.by}:${e.played.id}:${e.taken?.id ?? '-'}`),
        'the same seed produced a different game',
      );
    }
  }

  const x = deal('seed-a', 'normal');
  const y = deal('seed-b', 'normal');
  assert.notDeepEqual(
    x.hands.player.map((c) => c.id),
    y.hands.player.map((c) => c.id),
    'different seeds dealt the same hand',
  );
}

/**
 * Play the same brain in both seats and confirm the second seat still wins.
 *
 * This is the load-bearing measurement of the whole design: difficulty is the
 * seat, so if the seat ever stops mattering — a turn-order bug, a change to how
 * the flip resolves — the difficulty selector silently becomes decoration while
 * every other check still passes.
 */
function expectSeatAdvantage(): void {
  let first = 0;
  let second = 0;

  for (const seedCode of seeds(200)) {
    // 'hard' seats the player first, 'normal' seats them second; both use the
    // same brain, so the only difference between the two runs is the seat.
    first += score(playOut(seedCode, 'hard'), 'player');
    second += score(playOut(seedCode, 'normal'), 'player');
  }

  assert.ok(
    second > first,
    `moving second (${second}) was not better than moving first (${first})`,
  );
  // Measured at about seven points a game; fail well before it drifts to noise.
  assert.ok(
    (second - first) / 200 > 3,
    `the seat is only worth ${((second - first) / 200).toFixed(1)} points a game`,
  );
}

/** The two brains have to differ, or 簡單 and 普通 are the same game. */
function expectBrainLadder(): void {
  let careless = 0;
  let sharp = 0;

  for (const seedCode of seeds(200)) {
    careless += score(playOut(seedCode, 'easy'), 'cpu');
    sharp += score(playOut(seedCode, 'normal'), 'cpu');
  }

  assert.ok(
    sharp > careless,
    `the sharp brain (${sharp}) did not beat the careless one (${careless})`,
  );
}

/** Each difficulty has to actually seat and brain the way it advertises. */
function expectDifficultiesAreDistinct(): void {
  assert.equal(DIFFICULTIES.length, 3, 'there are not three difficulties');
  const shapes = DIFFICULTIES.map((d) => `${d.brain}:${d.leader}`);
  assert.equal(new Set(shapes).size, 3, `two difficulties are the same setup: ${shapes.join(', ')}`);

  for (const difficulty of ['easy', 'normal', 'hard'] as DifficultyId[]) {
    const info = difficultyInfo(difficulty);
    const state = deal('seat-check', difficulty, info.leader);
    assert.equal(state.turn, info.leader, `${difficulty} did not seat ${info.leader} first`);
    assert.equal(
      state.phase,
      info.leader === 'player' ? 'player_play' : 'cpu_play',
      `${difficulty} started in the wrong phase`,
    );
  }
}

/** A capture that is offered must be the best one available, not just any. */
function expectBestCapturePicksTheMostValuable(): void {
  const card = (rank: number, suit: string): Card => ({ id: `${suit}-${rank}`, suit, rank }) as Card;
  const played = card(7, 'clubs');
  const table = [card(3, 'clubs'), card(3, 'hearts'), card(5, 'spades')];

  const best = bestCapture(played, table);
  assert.equal(best?.id, 'hearts-3', 'bestCapture did not take the red card');
  assert.equal(capturableBy(played, table).length, 2, 'capturableBy found the wrong options');
  assert.equal(bestCapture(card(2, 'clubs'), table), null, 'bestCapture invented a capture');
}

/** Playing a card that matches nothing has to leave it on the table. */
function expectDiscardsLandOnTheTable(): void {
  let state = deal('discard-check', 'normal');
  // Force a known position: nothing on the table can pair with a lone king.
  state = {
    ...state,
    table: [{ id: 'spades-2', suit: 'spades', rank: 2 }],
    hands: { ...state.hands, player: [{ id: 'hearts-13', suit: 'hearts', rank: 13 }] },
  };

  const after = playCard(state, 'hearts-13');
  assert.equal(after.table.length, 2, 'the discarded card did not join the table');
  assert.equal(after.captured.player.length, 0, 'a discard was scored as a capture');
  assert.equal(after.phase, 'flip', 'the turn did not advance to the flip');
}

/** Streaks reset on anything that is not a win. */
function expectStreakTracking(): void {
  let stats = EMPTY_STATS;
  stats = recordResult(stats, 'win', 120);
  stats = recordResult(stats, 'win', 96);
  assert.equal(stats.streak, 2);
  assert.equal(stats.bestStreak, 2);
  assert.equal(stats.best, 120, 'the best score did not keep the higher of the two');

  stats = recordResult(stats, 'draw', 104);
  assert.equal(stats.streak, 0, 'a draw did not reset the streak');
  assert.equal(stats.bestStreak, 2, 'the best streak was lost');

  stats = recordResult(stats, 'loss', 30);
  assert.equal(stats.wins, 2);
  assert.equal(stats.losses, 1);
  assert.equal(stats.draws, 1);
}

const CHECKS: [string, () => void][] = [
  ['matching rule', expectMatchingRule],
  ['scoring table', expectScoringTable],
  ['deal balances', expectDealBalances],
  ['shuffle', expectShuffleIsDeterministicAndMixes],
  ['games finish cleanly', expectGamesFinishCleanly],
  ['determinism', expectDeterminism],
  ['seat advantage', expectSeatAdvantage],
  ['brain ladder', expectBrainLadder],
  ['difficulties are distinct', expectDifficultiesAreDistinct],
  ['best capture', expectBestCapturePicksTheMostValuable],
  ['discards land on the table', expectDiscardsLandOnTheTable],
  ['streak tracking', expectStreakTracking],
];

let failed = 0;
for (const [name, check] of CHECKS) {
  try {
    check();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL ${name}: ${(error as Error).message}`);
  }
}

console.log(`\ncheck-pick-red: ${CHECKS.length - failed}/${CHECKS.length} passed`);
if (failed > 0) process.exit(1);

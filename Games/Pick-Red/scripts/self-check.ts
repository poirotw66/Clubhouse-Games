import * as assert from 'node:assert/strict';
import {
  BLACK_ACE_POINTS,
  RANKS,
  SUITS,
  TOTAL_POINTS,
  buildDeck,
  capturableBy,
  isRed,
  matches,
  parScore,
  pointsOf,
  shuffle,
  sumPoints,
} from '../src/game/cards.js';
import {
  DEALT_TOTAL,
  PILE_SIZE,
  TABLE_SIZE,
  allCards,
  applyPlay,
  bestCapture,
  choosePick,
  deal,
  flip,
  handSize,
  outcome,
  playCard,
  score,
} from '../src/game/engine.js';
import { DIFFICULTIES, chooseMove, difficultyInfo, leaderFor } from '../src/game/cpu.js';
import { EMPTY_STATS, recordResult } from '../src/game/storage.js';
import { createRng } from '../src/game/rng.js';
import { HUMAN } from '../src/game/types.js';
import type { Card, DifficultyId, GameState, PlayerCount, Rules } from '../src/game/types.js';

const TIERS: DifficultyId[] = ['easy', 'normal', 'hard'];
const COUNTS: PlayerCount[] = [2, 3, 4];

function seeds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `check-${i}`);
}

function rules(players: PlayerCount, blackAces = false): Rules {
  return { players, blackAces };
}

/**
 * The 湊十 rule spelled out case by case. This is the one rule a port gets
 * wrong quietly: "sums to ten" alone silently makes two tens fail to pair, and
 * "same rank" alone silently makes 3+7 fail. Neither crashes.
 */
function expectMatchingRule(): void {
  const card = (rank: number, suit = 'spades'): Card =>
    ({ id: `${suit}-${rank}`, suit, rank }) as Card;

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

  // The boundary. Ten belongs to the same-rank rule even though nothing sums to
  // ten with it, and the low ranks never pair by equality except five.
  assert.ok(!matches(card(10), card(13)), '10 must not pair with K');
  assert.ok(!matches(card(3), card(3)), '3 must not pair with 3');
  assert.ok(!matches(card(9), card(9)), '9 must not pair with 9');
  assert.ok(!matches(card(1), card(10)), 'A must not pair with 10 by summing to 11');
  assert.ok(!matches(card(9), card(11)), '9 must not pair with J');
  assert.ok(matches(card(3, 'hearts'), card(7, 'clubs')), 'suits must not affect matching');

  const deck = buildDeck();
  for (const a of deck) {
    for (const b of deck) {
      assert.equal(matches(a, b), matches(b, a), `matching is not symmetric for ${a.id}/${b.id}`);
    }
  }
}

/**
 * The scoring table, and specifically that a **red nine is worth ten**.
 *
 * That single card decides whether the deck totals 210 or 208, and 210 is the
 * only total for which 105 — the number every account of this game quotes — is
 * an even half. A deck scoring 208 has no such landmark, so getting the nine
 * wrong is silently detectable right here and nowhere else.
 */
function expectScoringTable(): void {
  const deck = buildDeck();
  assert.equal(deck.length, 52, 'the deck is not 52 cards');
  assert.equal(new Set(deck.map((c) => c.id)).size, 52, 'the deck contains duplicate ids');
  assert.equal(SUITS.length * RANKS.length, 52, 'suits times ranks is not 52');

  const red = deck.filter(isRed);
  assert.equal(red.length, 26, 'there are not 26 red cards');
  for (const rank of [9, 10, 11, 12, 13]) {
    const card = red.find((c) => c.rank === rank)!;
    assert.equal(pointsOf(card), 10, `a red ${rank} is not worth 10`);
  }
  assert.equal(pointsOf(red.find((c) => c.rank === 8)!), 8, 'a red 8 is not worth its face value');
  assert.equal(pointsOf(red.find((c) => c.rank === 1)!), 20, 'a red ace is not worth 20');

  assert.equal(sumPoints(deck), TOTAL_POINTS, `red points do not total ${TOTAL_POINTS}`);
  assert.equal(TOTAL_POINTS, 210, 'the deck total is not 210');
  assert.equal(sumPoints(deck.filter((c) => !isRed(c))), 0, 'black cards are scoring points');
  assert.equal(sumPoints(red.filter((c) => c.rank === 1)), 40, 'red aces are not worth 40');
  assert.equal(
    sumPoints(red.filter((c) => c.rank >= 9)),
    100,
    'red nines through kings are not worth 100',
  );
  assert.equal(
    sumPoints(red.filter((c) => c.rank >= 2 && c.rank <= 8)),
    70,
    'red twos through eights are not worth 70',
  );

  // 105 at two players and exactly 70 at three is the tell that the total is
  // right — both are quoted numbers, and only 210 produces both.
  assert.equal(parScore(2), 105, 'the two-player par is not 105');
  assert.equal(parScore(3), 70, 'the three-player par is not 70');
  assert.equal(parScore(4), 52.5, 'the four-player par is not 52.5');

  // The black-ace variant adds 30 + 40 on top and nothing else.
  const clubAce = deck.find((c) => c.suit === 'clubs' && c.rank === 1)!;
  const spadeAce = deck.find((c) => c.suit === 'spades' && c.rank === 1)!;
  assert.equal(pointsOf(clubAce, true), 40, '梅花A is not worth 40 in the variant');
  assert.equal(pointsOf(spadeAce, true), 30, '黑桃A is not worth 30 in the variant');
  assert.equal(pointsOf(clubAce), 0, '梅花A scores with the variant off');
  assert.equal(
    sumPoints(deck, true),
    TOTAL_POINTS + BLACK_ACE_POINTS,
    'the variant total is not 280',
  );
}

/** Every deal has to balance to the card, or the pile fails to run out. */
function expectDealBalances(): void {
  assert.equal(DEALT_TOTAL + TABLE_SIZE + PILE_SIZE, 52, 'the deal does not use 52 cards');
  // One flip per hand card played, across all seats.
  assert.equal(PILE_SIZE, DEALT_TOTAL, 'the pile does not cover one flip per hand card');

  for (const players of COUNTS) {
    assert.equal(handSize(players) * players, DEALT_TOTAL, `${players} players do not deal 24`);
    assert.ok(Number.isInteger(handSize(players)), `${players} players deal a fractional hand`);

    for (const seedCode of seeds(12)) {
      const state = deal(seedCode, 'normal', rules(players));
      assert.equal(state.hands.length, players, 'the wrong number of hands were dealt');
      for (const hand of state.hands) assert.equal(hand.length, handSize(players));
      assert.equal(state.table.length, TABLE_SIZE);
      assert.equal(state.pile.length, PILE_SIZE);
      assert.equal(
        new Set(allCards(state).map((c) => c.id)).size,
        52,
        'the deal lost or duplicated a card',
      );
    }
  }
}

/** Fisher-Yates must actually permute, and identically for a given seed. */
function expectShuffleIsDeterministicAndMixes(): void {
  const deck = buildDeck();
  const a = shuffle(deck, createRng(7));
  const b = shuffle(deck, createRng(7));
  assert.deepEqual(a.map((c) => c.id), b.map((c) => c.id), 'the same seed gave a different shuffle');

  const c = shuffle(deck, createRng(8));
  assert.notDeepEqual(a.map((x) => x.id), c.map((x) => x.id), 'different seeds gave the same shuffle');

  const seenAtZero = new Set<string>();
  for (let seed = 0; seed < 400; seed++) seenAtZero.add(shuffle(deck, createRng(seed))[0].id);
  assert.ok(seenAtZero.size > 30, `the first position only ever held ${seenAtZero.size} cards`);
}

/** Drive a whole game with the CPU in every seat and check it stays legal. */
function playOut(seedCode: string, difficulty: DifficultyId, players: PlayerCount, blackAces = false): GameState {
  const info = difficultyInfo(difficulty);
  let state = deal(seedCode, difficulty, rules(players, blackAces), leaderFor(difficulty, players));
  let guard = 0;

  while (state.phase !== 'over') {
    assert.ok(guard++ < 300, 'the game did not terminate');
    assert.equal(new Set(allCards(state).map((c) => c.id)).size, 52, 'a card went missing mid-game');

    if (state.phase === 'flip') {
      state = flip(state);
      continue;
    }

    if (state.phase === 'pick_play' || state.phase === 'pick_flip') {
      const options = capturableBy(state.pending!, state.table);
      assert.ok(options.length > 1, 'parked for a pick with fewer than two options');
      state = choosePick(state, options[0].id);
      continue;
    }

    const move = chooseMove(state, info.brain);
    assert.ok(
      state.hands[state.turn].some((c) => c.id === move.card.id),
      'a seat played a card it does not hold',
    );
    if (move.taken) {
      assert.ok(
        state.table.some((c) => c.id === move.taken!.id) && matches(move.card, move.taken),
        'a seat claimed an illegal capture',
      );
    } else {
      assert.equal(
        capturableBy(move.card, state.table).length,
        0,
        'a seat discarded a card that could have captured',
      );
    }
    state = applyPlay(state, move.card, move.taken);
  }

  return state;
}

function expectGamesFinishCleanly(): void {
  for (const players of COUNTS) {
    for (const difficulty of TIERS) {
      for (const seedCode of seeds(8)) {
        const end = playOut(seedCode, difficulty, players);

        for (const hand of end.hands) assert.equal(hand.length, 0, 'a seat finished holding cards');
        assert.equal(end.pile.length, 0, 'the pile did not run out');
        assert.equal(end.log.length, DEALT_TOTAL * 2, 'the wrong number of cards were played');
        assert.equal(new Set(allCards(end).map((c) => c.id)).size, 52, 'the game lost a card');

        // Captures come in pairs, so every pile is even.
        for (const pile of end.captured) {
          assert.equal(pile.length % 2, 0, 'a seat captured an odd number of cards');
        }

        const result = outcome(end);
        assert.equal(
          result.scores.reduce((a, b) => a + b, 0) + result.wastedPoints,
          TOTAL_POINTS,
          'points captured plus points abandoned do not total 210',
        );
        assert.equal(result.scores.length, players, 'the wrong number of scores were reported');
        assert.ok(result.winners.length >= 1, 'nobody won');
      }
    }
  }

  // The variant only moves the total, not the machinery.
  const variant = outcome(playOut('variant', 'normal', 2, true));
  assert.equal(
    variant.scores.reduce((a, b) => a + b, 0) + variant.wastedPoints,
    TOTAL_POINTS + BLACK_ACE_POINTS,
    'the black-ace variant does not conserve 280 points',
  );
}

/** Every seat takes an equal number of turns, whatever the player count. */
function expectTurnsAreShared(): void {
  for (const players of COUNTS) {
    const end = playOut('turn-order', 'normal', players);
    const handPlays = end.log.filter((e) => e.source === 'hand');
    const flips = end.log.filter((e) => e.source === 'pile');

    for (let seat = 0; seat < players; seat++) {
      assert.equal(
        handPlays.filter((e) => e.by === seat).length,
        handSize(players),
        `seat ${seat} did not play its whole hand`,
      );
      assert.equal(
        flips.filter((e) => e.by === seat).length,
        handSize(players),
        `seat ${seat} did not take one flip per hand card`,
      );
    }

    // Turn order has to actually rotate rather than ping-pong.
    const order = handPlays.slice(0, players * 2).map((e) => e.by);
    for (let i = 1; i < order.length; i++) {
      assert.equal(order[i], (order[i - 1] + 1) % players, 'the turn order did not rotate');
    }
  }
}

/** Same seed, same settings, same game — the deal is the only randomness. */
function expectDeterminism(): void {
  for (const players of COUNTS) {
    for (const seedCode of seeds(4)) {
      for (const difficulty of TIERS) {
        const a = playOut(seedCode, difficulty, players);
        const b = playOut(seedCode, difficulty, players);
        assert.deepEqual(
          a.log.map((e) => `${e.by}:${e.played.id}:${e.taken?.id ?? '-'}`),
          b.log.map((e) => `${e.by}:${e.played.id}:${e.taken?.id ?? '-'}`),
          'the same seed produced a different game',
        );
      }
    }
  }

  assert.notDeepEqual(
    deal('seed-a', 'normal', rules(2)).hands[0].map((c) => c.id),
    deal('seed-b', 'normal', rules(2)).hands[0].map((c) => c.id),
    'different seeds dealt the same hand',
  );
}

/**
 * Play the same brain in every seat and confirm the later seat still wins.
 *
 * This is the load-bearing measurement of the whole design: difficulty *is* the
 * seat, so if turn order ever stops mattering the difficulty selector silently
 * becomes decoration while every other check still passes.
 */
function expectSeatAdvantage(): void {
  let first = 0;
  let later = 0;

  for (const seedCode of seeds(150)) {
    // Both use the sharp brain; only the human's position differs.
    first += score(playOut(seedCode, 'hard', 2), HUMAN);
    later += score(playOut(seedCode, 'normal', 2), HUMAN);
  }

  assert.ok(later > first, `playing later (${later}) was not better than first (${first})`);
  assert.ok(
    (later - first) / 150 > 3,
    `the seat is only worth ${((later - first) / 150).toFixed(1)} points a game`,
  );
}

/** The two brains have to differ, or 簡單 and 普通 are the same game. */
function expectBrainLadder(): void {
  let careless = 0;
  let sharp = 0;

  for (const seedCode of seeds(150)) {
    // Seat 1 is a CPU under both difficulties; only its brain changes.
    careless += score(playOut(seedCode, 'easy', 2), 1);
    sharp += score(playOut(seedCode, 'normal', 2), 1);
  }

  assert.ok(sharp > careless, `the sharp brain (${sharp}) did not beat the careless one (${careless})`);
}

/** Each difficulty has to seat and brain the way it advertises. */
function expectDifficultiesAreDistinct(): void {
  assert.equal(DIFFICULTIES.length, 3, 'there are not three difficulties');
  const shapes = DIFFICULTIES.map((d) => `${d.brain}:${d.humanLast}`);
  assert.equal(new Set(shapes).size, 3, `two difficulties are the same setup: ${shapes.join(', ')}`);

  for (const players of COUNTS) {
    for (const difficulty of TIERS) {
      const info = difficultyInfo(difficulty);
      const leader = leaderFor(difficulty, players);
      const state = deal('seat-check', difficulty, rules(players), leader);
      assert.equal(state.turn, leader, `${difficulty} did not seat the right leader`);
      assert.equal(
        leader === HUMAN,
        !info.humanLast,
        `${difficulty} seated the human on the wrong side`,
      );
    }
  }
}

/** A capture that is offered must be the most valuable one available. */
function expectBestCapturePicksTheMostValuable(): void {
  const card = (rank: number, suit: string): Card => ({ id: `${suit}-${rank}`, suit, rank }) as Card;
  const played = card(7, 'clubs');
  const table = [card(3, 'clubs'), card(3, 'hearts'), card(5, 'spades')];

  assert.equal(bestCapture(played, table)?.id, 'hearts-3', 'bestCapture did not take the red card');
  assert.equal(capturableBy(played, table).length, 2, 'capturableBy found the wrong options');
  assert.equal(bestCapture(card(2, 'clubs'), table), null, 'bestCapture invented a capture');
}

/** Playing a card that matches nothing has to leave it on the table. */
function expectDiscardsLandOnTheTable(): void {
  const base = deal('discard-check', 'normal', rules(2));
  const state: GameState = {
    ...base,
    table: [{ id: 'spades-2', suit: 'spades', rank: 2 }],
    hands: [[{ id: 'hearts-13', suit: 'hearts', rank: 13 }], base.hands[1]],
    turn: HUMAN,
    phase: 'play',
  };

  const after = playCard(state, 'hearts-13');
  assert.equal(after.table.length, 2, 'the discarded card did not join the table');
  assert.equal(after.captured[HUMAN].length, 0, 'a discard was scored as a capture');
  assert.equal(after.phase, 'flip', 'the turn did not advance to the flip');
}

/**
 * A flipped card that matches several table cards must stop for a choice.
 *
 * The real game lets whoever turned the card over decide what it takes, exactly
 * as when they play from hand. Resolving it automatically is the easy shortcut
 * and it quietly takes a decision away from the player.
 */
function expectFlipOffersAChoice(): void {
  const base = deal('flip-check', 'normal', rules(2));
  const state: GameState = {
    ...base,
    table: [
      { id: 'clubs-3', suit: 'clubs', rank: 3 },
      { id: 'hearts-3', suit: 'hearts', rank: 3 },
    ],
    pile: [{ id: 'spades-7', suit: 'spades', rank: 7 }],
    phase: 'flip',
    turn: HUMAN,
  };

  const flipped = flip(state);
  assert.equal(flipped.phase, 'pick_flip', 'a multi-way flip did not stop for a choice');
  assert.equal(flipped.pending?.id, 'spades-7', 'the flipped card was not the one parked');

  // Taking the black three is legal and must be honoured, not overridden by the
  // engine's own idea of the best capture.
  const chosen = choosePick(flipped, 'clubs-3');
  assert.equal(chosen.captured[HUMAN].map((c) => c.id).sort().join(), 'clubs-3,spades-7');
  assert.equal(chosen.table.length, 1, 'the unchosen card did not stay on the table');
  assert.equal(chosen.log[chosen.log.length - 1].source, 'pile', 'the capture was logged as a hand play');
  assert.notEqual(chosen.phase, 'flip', 'the flip ran twice in one turn');
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
  ['scoring table (210, red 9 = 10)', expectScoringTable],
  ['deals balance at 2/3/4 players', expectDealBalances],
  ['shuffle', expectShuffleIsDeterministicAndMixes],
  ['games finish cleanly', expectGamesFinishCleanly],
  ['turns are shared evenly', expectTurnsAreShared],
  ['determinism', expectDeterminism],
  ['seat advantage', expectSeatAdvantage],
  ['brain ladder', expectBrainLadder],
  ['difficulties are distinct', expectDifficultiesAreDistinct],
  ['best capture', expectBestCapturePicksTheMostValuable],
  ['discards land on the table', expectDiscardsLandOnTheTable],
  ['the flip offers a choice', expectFlipOffersAChoice],
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

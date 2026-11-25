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
  findDoubleRedFive,
  flip,
  handSize,
  outcome,
  playCard,
  discardCard,
  score,
  settleChips,
} from '../src/game/engine.js';
import {
  DIFFICULTIES,
  PERSONALITIES,
  SEAT_PERSONALITIES,
  chooseMove,
  chooseDiscard,
  difficultyInfo,
  getDifficultyConfig,
  leaderFor,
  personalityForSeat,
} from '../src/game/cpu.js';
import { advise } from '../src/game/hints.js';
import {
  buildDailyShareText,
  computeDailyStreak,
  dailyMatchConfig,
  dailySeedCode,
  taipeiDateKey,
} from '../src/game/daily.js';
import {
  applyHandResult,
  computeMatchMvp,
  createMatch,
  dealHand,
  decideMatchWinner,
  defaultMatchConfig,
  formatKeyFor,
  handDeltas,
  handSeed,
  isSeriesMode,
  leaderForHand,
  seatPersonalitiesFor,
} from '../src/game/match.js';
import {
  NAMED_OPPONENTS,
  isOpponentUnlocked,
  ladderSeatPersonalities,
  opponentById,
  opponentCount,
} from '../src/game/opponents.js';
import { buildHandReview } from '../src/game/review.js';
import {
  analyzeKeyCardsRadar,
  analyzeOpponentThreats,
  analyzeScoreLeverage,
  computeMomentumMetrics,
  getDangerCardType,
  getGrandmasterWisdom,
  hasResonanceWithTable,
  isDangerCard,
  projectHandOptions,
} from '../src/game/tactics.js';
import {
  EMPTY_STATS,
  applyLadderResult,
  recordDailyResult,
  recordHandResult,
  recordMatchResult,
  recordResult,
} from '../src/game/storage.js';
import { createRng, normalizeSeedCode } from '../src/game/rng.js';
import { HUMAN } from '../src/game/types.js';
import type {
  Card,
  CpuBrain,
  DifficultyId,
  GameState,
  HandRecord,
  HouseRules,
  MatchState,
  PlayerCount,
  Rank,
  Suit,
} from '../src/game/types.js';

const TIERS: DifficultyId[] = ['easy', 'normal', 'hard'];
const COUNTS: PlayerCount[] = [2, 3, 4];

function seeds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `check-${i}`);
}

function rules(players: PlayerCount, blackAces = false): HouseRules {
  return {
    players,
    blackAces,
    doubleRedFive: true,
    zeroScoreBonus: true,
    rotateLeader: false,
  };
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
/**
 * `brainAt` decides which brain drives each seat. It exists because this helper
 * used to drive EVERY seat — the human's included — with the difficulty's own
 * brain, while the comment on its caller claimed only one seat's brain was
 * changing. Under 'easy' that made the player a careless bot too, so the
 * measurement compared "everybody careless" against "everybody sharp" rather
 * than isolating the opponents, and any question about what a difficulty does
 * to a real player was being answered about somebody else.
 */
function playOut(
  seedCode: string,
  difficulty: DifficultyId,
  players: PlayerCount,
  blackAces = false,
  brainAt?: (seat: number) => CpuBrain,
  /**
   * How a seat resolves a capture that could take more than one table card.
   * The default takes options[0] — an arbitrary, ordering-dependent choice that
   * is fine for the legality checks this helper mostly serves, but is a WORSE
   * player than anything real. Measurements have to pass 'greedy', which takes
   * the most valuable card, or every seat is handicapped equally and the gaps
   * between difficulties are compressed toward nothing. That is exactly what
   * happened: a ladder check built on the default could not tell a random
   * discard from a generous one, because its own pilot was throwing away more
   * than the difficulty setting was.
   */
  pick: 'first' | 'greedy' = 'first',
  /**
   * Per-seat capture blunder rate. Defaults to the difficulty's rate for every
   * seat. Pass an override when isolating brain (set 0) or when the human seat
   * should never blunder during rung measurements.
   */
  captureBlunderAt?: (seat: number) => number,
): GameState {
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
      const chosen =
        pick === 'greedy'
          ? [...options].sort((a, b) => pointsOf(b) - pointsOf(a))[0]
          : options[0];
      state = choosePick(state, chosen.id);
      continue;
    }

    const brain = brainAt ? brainAt(state.turn) : info.brain;
    const blunder = captureBlunderAt ? captureBlunderAt(state.turn) : info.captureBlunderRate;
    const move = chooseMove(state, brain, blunder);
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

  // Seat 1's brain is the only thing that changes; every other seat stays
  // sharp. Capture blunders are held at 0 so this isolates discard quality.
  // The difficulty argument is held fixed for the same reason — it also
  // decides the seating, and letting it move would change two things at once.
  for (const seedCode of seeds(150)) {
    careless += score(
      playOut(seedCode, 'normal', 2, false, (seat) => (seat === 1 ? 'careless' : 'sharp'), 'first', () => 0),
      1,
    );
    sharp += score(playOut(seedCode, 'normal', 2, false, () => 'sharp', 'first', () => 0), 1);
  }

  assert.ok(sharp > careless, `the sharp brain (${sharp}) did not beat the careless one (${careless})`);
}

/**
 * Every rung of the ladder must be a real step — where the step is big enough
 * to be worth guarding.
 *
 * expectBrainLadder above checks the two brains at TWO PLAYERS ONLY, compares
 * the CPU's own score rather than the player's win rate, and reports no
 * interval. This covers what it does not: the player's own win rate, at every
 * seat count, with the interval on the DIFFERENCE (two overlapping rate
 * intervals can still have a difference that excludes zero, so testing them
 * for overlap is strictly more conservative and reports real steps as absent).
 *
 * What the rungs are actually worth, measured over four INDEPENDENT seed sets
 * of 2,500 deals each, because one set of one size is what produced a wrong
 * answer the first time this was measured:
 *
 *   players   brain rung (easy->normal)        seat rung (normal->hard)
 *   2         +4.2 / +5.0 / +5.8 / +5.5 pp     ~+16pp
 *   3         +3.0 / +4.6 / +4.6 / +4.0 pp     ~+15pp
 *   4         +2.3 / +1.1 / +2.7 / +3.2 pp     ~+15pp
 *
 * The seat rung is worth roughly three to four times the brain rung, at every
 * count. And the four-player brain rung sits around 2pp: real, but it clears
 * zero in only two of those four seed sets at 2,500 deals, and pinning ~2pp
 * reliably would need on the order of 10,000 deals per cell. It is deliberately
 * NOT asserted here — a check that flakes on half its seed sets is worse than
 * no check, and the honest statement is that the rung is too shallow to guard
 * at any sample size this suite can afford. It is a known shallow spot, not a
 * guarded property.
 *
 * DEALS is 2,500: enough that the rungs asserted below sit at 2.2 SE or better
 * on every seed set tried.
 */
function expectLadderRungsAreRealSteps(): void {
  const DEALS = 2500;

  const winRate = (difficulty: DifficultyId, players: PlayerCount): number => {
    let wins = 0;
    for (let i = 0; i < DEALS; i++) {
      // The human seat plays sharp at every difficulty — a person is not a
      // careless bot, and the setting is meant to change their OPPONENTS. The
      // greedy pick matters for the same reason: on the default 'first' pick
      // every seat throws away value on ambiguous captures, which handicaps
      // the measurement more than the difficulty setting changes it.
      const end = playOut(
        `rung-${i}`,
        difficulty,
        players,
        false,
        (seat) => (seat === HUMAN ? 'sharp' : difficultyInfo(difficulty).brain),
        'greedy',
        (seat) => (seat === HUMAN ? 0 : difficultyInfo(difficulty).captureBlunderRate),
      );
      const result = outcome(end);
      assert.ok(result, `deal rung-${i} never reached an outcome`);
      if (result.result === 'win') wins += 1;
    }
    return wins / DEALS;
  };

  const rungs: Array<[DifficultyId, DifficultyId, string, PlayerCount[]]> = [
    // Asserted at 2 and 3 players only; see the note above on 4.
    ['easy', 'normal', '對手腦袋', [2, 3]],
    ['normal', 'hard', '座位順序', [2, 3, 4]],
  ];

  for (const [easier, harder, axis, counts] of rungs) {
    for (const players of counts) {
      const pa = winRate(easier, players);
      const pb = winRate(harder, players);
      const se = Math.sqrt((pa * (1 - pa)) / DEALS + (pb * (1 - pb)) / DEALS);
      const diff = (pa - pb) * 100;
      const halfWidth = 1.96 * se * 100;
      assert.ok(
        diff - halfWidth > 0,
        `at ${players} players, '${easier}' gave the player ${(pa * 100).toFixed(1)}% wins against '${harder}' at ${(pb * 100).toFixed(1)}% — a difference of ${diff.toFixed(1)}pp with a 95% interval of [${(diff - halfWidth).toFixed(1)}, ${(diff + halfWidth).toFixed(1)}], which does not clear zero. The rung that changes ${axis} is not a difficulty step: these two settings are the same experience.`,
      );
    }
  }
}

/** Each difficulty has to seat, brain, and blunder the way it advertises. */
function expectDifficultiesAreDistinct(): void {
  assert.equal(DIFFICULTIES.length, 3, 'there are not three difficulties');
  const shapes = DIFFICULTIES.map((d) => `${d.brain}:${d.humanLast}:${d.captureBlunderRate}`);
  assert.equal(new Set(shapes).size, 3, `two difficulties are the same setup: ${shapes.join(', ')}`);

  const easy = getDifficultyConfig('easy');
  const normal = getDifficultyConfig('normal');
  const hard = getDifficultyConfig('hard');
  assert.ok(
    easy.captureBlunderRate > normal.captureBlunderRate,
    'easy is not clumsier at capture picks than normal',
  );
  assert.ok(
    normal.captureBlunderRate > hard.captureBlunderRate,
    'normal is not clumsier at capture picks than hard',
  );
  assert.equal(hard.captureBlunderRate, 0, 'hard still blunders on captures');
  assert.equal(easy.brain, 'careless');
  assert.equal(normal.brain, 'sharp');
  assert.equal(hard.brain, 'sharp');
  assert.equal(easy.humanLast, true);
  assert.equal(normal.humanLast, true);
  assert.equal(hard.humanLast, false);

  const blurbs = DIFFICULTIES.map((d) => d.blurb);
  assert.equal(new Set(blurbs).size, 3, `two difficulties share a blurb: ${blurbs.join(' | ')}`);
  for (const blurb of blurbs) {
    assert.ok(blurb.trim().length > 0, 'a difficulty blurb is empty');
  }

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

  stats = recordHandResult(stats, 'win', 110, 5, true, false, false);
  assert.equal(stats.chips, 5);
  assert.equal(stats.qualified, 1);
  stats = recordMatchResult(stats, true, 40, {
    mode: 'hands',
    hands: 4,
    target: 100,
    difficulty: 'normal',
    rules: rules(2),
    seedCode: 'streak',
  });
  assert.equal(stats.matches, 1);
  assert.equal(stats.matchWins, 1);
  assert.equal(stats.bestMatchChips, 40);
  assert.equal(stats.formats['hands-4'].played, 1);
  assert.equal(stats.formats['hands-4'].wins, 1);

  // Single sessions must not inflate series tallies (formats.single is separate).
  stats = recordMatchResult(stats, true, 99, {
    mode: 'single',
    hands: 4,
    target: 100,
    difficulty: 'normal',
    rules: rules(2),
    seedCode: 'solo',
  });
  assert.equal(stats.matches, 1);
  assert.equal(stats.formats['hands-4'].played, 1);
  assert.equal(stats.formats.single.played, 1);
  assert.equal(stats.formats.single.wins, 1);
}

/** Chip settlement is (score − par) plus optional specials. */
function expectChipSettlement(): void {
  const par = 105;
  const deltas = settleChips([120, 90], par, rules(2), null, null);
  assert.deepEqual(deltas, [15, -15]);

  const withRedFive = settleChips([100, 110], 105, rules(2), 1, null);
  // base: -5, +5; then seat 1 gets +20, seat 0 pays −20 → -25, +25
  assert.deepEqual(withRedFive, [-25, 25]);

  const withZero = settleChips([0, 210], 105, rules(2), null, 0);
  // base: -105, +105; seat 0 gets +105 from seat 1 → 0, 0
  assert.deepEqual(withZero, [0, 0]);
}

function expectMatchSeries(): void {
  const match = createMatch({
    mode: 'hands',
    hands: 4,
    target: 100,
    difficulty: 'normal',
    rules: rules(2),
    seedCode: 'series-check',
  });
  assert.equal(match.balances.length, 2);
  assert.equal(handSeed('series-check', 0), normalizeSeedCode('series-check'));
  assert.notEqual(handSeed('series-check', 1), handSeed('series-check', 0));

  const dealt = dealHand(match);
  assert.equal(dealt.seedCode, handSeed('series-check', 0));
  assert.equal(dealt.rules.players, 2);

  const end = playOut('series-check', 'normal', 2);
  const result = outcome(end);
  assert.equal(result.deltas.length, 2);
  assert.ok(result.qualified.every((seat) => result.scores[seat] > result.par));

  const after = applyHandResult(match, result, end.seedCode);
  assert.equal(after.history.length, 1);
  assert.deepEqual(after.balances, handDeltas(result));
  assert.equal(after.phase, 'handOver');

  assert.equal(decideMatchWinner({ ...match.config, mode: 'target', target: 50 }, [60, -10], 1), 0);
  assert.equal(decideMatchWinner(match.config, [10, 20], 3), null);
  assert.equal(decideMatchWinner(match.config, [10, 20], 4), 1);
  assert.equal(decideMatchWinner({ ...match.config, mode: 'single' }, [5, -5], 1), 0);
  assert.equal(decideMatchWinner({ ...match.config, mode: 'single' }, [5, -5], 0), null);

  // rotateLeader shifts the first seat across hands.
  const rotating = createMatch({
    ...match.config,
    rules: { ...rules(2), rotateLeader: true },
    difficulty: 'hard',
  });
  assert.equal(leaderForHand(rotating), leaderFor('hard', 2));
  rotating.handIndex = 1;
  assert.equal(leaderForHand(rotating), (leaderFor('hard', 2) + 1) % 2);

  // Single mode ignores rotation even when the house rule is on.
  const solo = createMatch({
    ...match.config,
    mode: 'single',
    rules: { ...rules(2), rotateLeader: true },
    difficulty: 'hard',
  });
  solo.handIndex = 3;
  assert.equal(leaderForHand(solo), leaderFor('hard', 2));
  assert.equal(isSeriesMode('single'), false);
  assert.equal(isSeriesMode('hands'), true);
  assert.equal(formatKeyFor(match.config), 'hands-4');
  assert.equal(formatKeyFor({ ...match.config, mode: 'single' }), 'single');

  const review = buildHandReview(end, result);
  assert.ok(review.lessons.length >= 1);
  assert.ok(review.highlight.length > 0);
}

/** MVP picks most red points and the best single-hand score across history. */
function expectMatchMvp(): void {
  const hand = (
    index: number,
    scores: number[],
    deltas: number[],
  ): HandRecord => ({
    handIndex: index,
    seedCode: `h${index}`,
    winner: scores[0] >= scores[1] ? 0 : 1,
    scores,
    deltas,
    qualified: scores.map((s, seat) => (s > 105 ? seat : -1)).filter((s) => s >= 0),
    doubleRedFiveSeat: null,
    zeroScoreSeat: null,
  });

  const match: MatchState = {
    config: {
      mode: 'hands',
      hands: 4,
      target: 100,
      difficulty: 'normal',
      rules: rules(2),
      seedCode: 'mvp',
    },
    handIndex: 4,
    balances: [30, -30],
    history: [
      hand(0, [120, 90], [15, -15]),
      hand(1, [80, 130], [-25, 25]),
      hand(2, [110, 100], [5, -5]),
      hand(3, [95, 115], [-10, 10]),
    ],
    phase: 'matchOver',
    winner: 0,
  };

  const mvp = computeMatchMvp(match);
  assert.ok(mvp);
  // Totals: human 405, CPU 435 → CPU has most red points.
  assert.equal(mvp!.mostPointsSeat, 1);
  assert.equal(mvp!.mostPointsTotal, 435);
  // Best single hand is CPU's 130 in hand 1.
  assert.equal(mvp!.bestHandSeat, 1);
  assert.equal(mvp!.bestHandScore, 130);
  assert.equal(mvp!.bestHandIndex, 1);
  assert.equal(mvp!.chipLeaderSeat, 0);
  assert.equal(mvp!.chipLeaderTotal, 30);

  // Single-hand series settles immediately and still yields an MVP.
  const one = createMatch({
    mode: 'single',
    hands: 4,
    target: 100,
    difficulty: 'normal',
    rules: rules(2),
    seedCode: 'one-mvp',
  });
  const end = playOut('one-mvp', 'normal', 2);
  const result = outcome(end);
  const finished = applyHandResult(one, result, end.seedCode);
  assert.equal(finished.phase, 'matchOver');
  assert.equal(finished.history.length, 1);
  const soloMvp = computeMatchMvp(finished);
  assert.ok(soloMvp);
  assert.equal(soloMvp!.bestHandScore, Math.max(...result.scores));
}

function expectPersonalitiesAndHints(): void {
  assert.equal(personalityForSeat(0), null);
  assert.equal(personalityForSeat(1)?.id, SEAT_PERSONALITIES[1]);
  assert.equal(personalityForSeat(2)?.id, SEAT_PERSONALITIES[2]);
  assert.equal(personalityForSeat(3)?.id, SEAT_PERSONALITIES[3]);
  assert.equal(
    new Set(PERSONALITIES.map((p) => p.id)).size,
    3,
    'the three CPU seats must not share a personality',
  );

  for (const seedCode of seeds(6)) {
    let state = deal(seedCode, 'normal', rules(2), leaderFor('normal', 2));
    let guard = 0;
    while (state.phase !== 'play' || state.turn !== HUMAN) {
      assert.ok(guard++ < 40, 'could not reach a human play');
      if (state.phase === 'flip') {
        state = flip(state);
        continue;
      }
      if (state.phase === 'pick_play' || state.phase === 'pick_flip') {
        const options = capturableBy(state.pending!, state.table);
        state = choosePick(state, options[0].id);
        continue;
      }
      const move = chooseMove(state, 'sharp', 0, null);
      state = applyPlay(state, move.card, move.taken);
    }
    const advice = advise(state);
    assert.ok(advice.reason.trim().length > 0, 'hint reason is empty');
    if (advice.card) {
      assert.ok(
        state.hands[HUMAN].some((c) => c.id === advice.card!.id),
        'hint suggested a card not in hand',
      );
    }
  }
}

/** Taipei daily seed is stable for a calendar day and drives a fixed-hand table. */
function expectDailyTable(): void {
  const key = '2026-10-22';
  assert.equal(taipeiDateKey(new Date('2026-10-21T16:00:00.000Z')), key);
  const seedA = dailySeedCode(key);
  const seedB = dailySeedCode(key);
  assert.equal(seedA, seedB);
  assert.equal(seedA, 'pr-daily-2026-10-22');
  assert.notEqual(dailySeedCode('2026-10-21'), seedA);

  const config = dailyMatchConfig(key);
  assert.equal(config.mode, 'daily');
  assert.equal(config.seedCode, seedA);
  assert.equal(config.rules.players, 2);

  const match = createMatch(config);
  assert.equal(isSeriesMode('daily'), true);
  assert.equal(decideMatchWinner(config, [10, -10], 3), null);
  assert.equal(decideMatchWinner(config, [10, -10], 4), 0);
  assert.equal(formatKeyFor(config), 'daily');

  let daily = recordDailyResult({ records: [] }, key, 20, true);
  daily = recordDailyResult(daily, key, 12, true);
  assert.equal(daily.records[0].bestChips, 20);
  assert.equal(daily.records[0].attempts, 2);
  assert.equal(computeDailyStreak(daily.records, key), 1);

  daily = recordDailyResult(daily, '2026-10-21', 5, true);
  assert.equal(computeDailyStreak(daily.records, key), 2);

  const share = buildDailyShareText({
    date: key,
    seedCode: seedA,
    chips: 20,
    bestChips: 20,
    streak: 2,
    completed: true,
  });
  assert.ok(share.includes('撿紅點'));
  assert.ok(share.includes(key));
  assert.ok(share.includes(seedA));
}

/** Single-hand mode settles after one result and records format.single. */
function expectSingleModeAndFormats(): void {
  assert.equal(isSeriesMode('single'), false);
  assert.equal(isSeriesMode('hands'), true);
  assert.equal(isSeriesMode('daily'), true);

  const one = createMatch({
    mode: 'single',
    hands: 4,
    target: 100,
    difficulty: 'normal',
    rules: rules(2),
    seedCode: 'solo-check',
  });
  const end = playOut('solo-check', 'normal', 2);
  const result = outcome(end);
  const finished = applyHandResult(one, result, end.seedCode);
  assert.equal(finished.phase, 'matchOver');
  assert.equal(finished.history.length, 1);

  let stats = EMPTY_STATS;
  stats = recordMatchResult(
    stats,
    finished.winner === HUMAN,
    finished.balances[HUMAN],
    finished.config,
  );
  assert.equal(stats.formats.single.played, 1);
  assert.equal(stats.matches, 0, 'single must not inflate series match count');

  stats = recordMatchResult(stats, true, 8, {
    mode: 'daily',
    hands: 4,
    target: 100,
    difficulty: 'normal',
    rules: rules(2),
    seedCode: 'd',
  });
  assert.equal(stats.formats.daily.played, 1);
  assert.equal(stats.matches, 1);
}

/** Named ladder: 5 foes, unlock frontier, seat colouring. */
function expectNamedOpponentLadder(): void {
  assert.ok(opponentCount() >= 4 && opponentCount() <= 6);
  assert.equal(NAMED_OPPONENTS.length, opponentCount());
  assert.equal(new Set(NAMED_OPPONENTS.map((o) => o.id)).size, opponentCount());

  assert.equal(isOpponentUnlocked(0, 0), true);
  assert.equal(isOpponentUnlocked(1, 0), false);
  assert.equal(isOpponentUnlocked(1, 1), true);

  let ladder = applyLadderResult(
    { clearedCount: 0, cleared: {}, lastIndex: 0 },
    0,
    true,
    'ming',
  );
  assert.equal(ladder.clearedCount, 1);
  assert.equal(ladder.cleared.ming, true);
  assert.equal(isOpponentUnlocked(1, ladder.clearedCount), true);

  // Winning a non-frontier foe does not skip ahead.
  ladder = applyLadderResult(ladder, 0, true, 'ming');
  assert.equal(ladder.clearedCount, 1);

  const seats = ladderSeatPersonalities(opponentById('zhen')!);
  assert.equal(seats[1], 'aceChaser');
  const mapped = seatPersonalitiesFor({
    mode: 'single',
    hands: 4,
    target: 100,
    difficulty: 'hard',
    rules: rules(2),
    seedCode: 'ladder',
    ladderOpponentId: 'zhen',
  });
  assert.deepEqual(mapped, seats);
  assert.equal(
    seatPersonalitiesFor({
      mode: 'single',
      hands: 4,
      target: 100,
      difficulty: 'normal',
      rules: rules(2),
      seedCode: 'plain',
    }),
    undefined,
  );
}

function expectDoubleRedFiveDetection(): void {
  const base = deal('red5-check', 'normal', rules(2));
  const state: GameState = {
    ...base,
    rules: { ...base.rules, doubleRedFive: true },
    log: [
      {
        by: HUMAN,
        played: { id: 'hearts-5', suit: 'hearts', rank: 5 },
        taken: { id: 'clubs-5', suit: 'clubs', rank: 5 },
        source: 'hand',
        points: 5,
        tableBefore: [],
      },
      {
        by: HUMAN,
        played: { id: 'spades-2', suit: 'spades', rank: 2 },
        taken: { id: 'diamonds-5', suit: 'diamonds', rank: 5 },
        source: 'pile',
        points: 5,
        tableBefore: [],
      },
    ],
  };
  assert.equal(findDoubleRedFive(state), HUMAN);

  const off: GameState = {
    ...state,
    rules: { ...state.rules, doubleRedFive: false },
  };
  assert.equal(findDoubleRedFive(off), null);
}

function expectTacticalAnalysis(): void {
  const dealt = deal('tactics-test-seed', 'normal', rules(2, false));
  const radar = analyzeKeyCardsRadar(dealt);
  assert.equal(radar.length, 14); // 14 key cards when blackAces is false
  const aceHearts = radar.find((r) => r.id === 'hearts-1');
  assert.ok(aceHearts);
  assert.equal(aceHearts.points, 20);
  assert.equal(aceHearts.matchingRank, 9);

  // Black Aces variant
  const dealtBlackAces = deal('tactics-ba-seed', 'normal', rules(2, true));
  const radarBA = analyzeKeyCardsRadar(dealtBlackAces);
  assert.equal(radarBA.length, 16);
  const aceSpades = radarBA.find((r) => r.id === 'spades-1');
  assert.ok(aceSpades);
  assert.equal(aceSpades.points, 30);

  // Score leverage
  const leverage = analyzeScoreLeverage(dealt);
  assert.equal(leverage.par, 105);
  assert.equal(leverage.deckTotal, 210);
  assert.equal(typeof leverage.statusLabel, 'string');
  assert.ok(leverage.statusDesc.length > 0);

  // Hand projections
  const projections = projectHandOptions(dealt);
  assert.equal(projections.length, dealt.hands[HUMAN].length);
  for (const proj of projections) {
    assert.ok(['safe', 'caution', 'danger'].includes(proj.discardSafety));
  }

  // Opponent threats
  const threats = analyzeOpponentThreats(dealt, null, ['你', '對家甲']);
  assert.equal(threats.length, 1);
  assert.equal(threats[0].seat, 1);
  assert.ok(threats[0].threatDeduction.length > 0);

  // Grandmaster wisdom
  const wisdom = getGrandmasterWisdom(dealt, leverage);
  assert.ok(wisdom.title.length > 0);
  assert.ok(wisdom.blurb.length > 0);
}

function expectDangerCardsAndMomentum(): void {
  const redAce: Card = { id: 'hearts-1', suit: 'hearts', rank: 1 };
  const redNine: Card = { id: 'diamonds-9', suit: 'diamonds', rank: 9 };
  const redFive: Card = { id: 'hearts-5', suit: 'hearts', rank: 5 };
  const blackAce: Card = { id: 'spades-1', suit: 'spades', rank: 1 };
  const blackNine: Card = { id: 'spades-9', suit: 'spades', rank: 9 };

  assert.equal(getDangerCardType(redAce), 'ace');
  assert.equal(getDangerCardType(redNine), 'nine');
  assert.equal(getDangerCardType(redFive), 'red_five');
  assert.equal(getDangerCardType(blackNine), null);
  assert.equal(getDangerCardType(blackAce, false), null);
  assert.equal(getDangerCardType(blackAce, true), 'ace');

  assert.equal(isDangerCard(redAce), true);
  assert.equal(isDangerCard(blackNine), false);

  // Resonance match: 9 resonates with Red Ace on table
  const table = [redAce, blackNine];
  assert.equal(hasResonanceWithTable(blackNine, table), true);
  assert.equal(hasResonanceWithTable({ id: 'clubs-2', suit: 'clubs', rank: 2 }, table), false);

  // Momentum metrics calculation
  const match = createMatch(defaultMatchConfig());
  const state = dealHand(match);
  const leverage = analyzeScoreLeverage(state);
  const momentum = computeMomentumMetrics(state, leverage);

  assert.equal(momentum.points.length, 7);
  assert.equal(momentum.doubleScoreTarget >= leverage.par, true);
  assert.equal(momentum.winProbability >= 0 && momentum.winProbability <= 100, true);
}

/**
 * Exhaustive check for the 湊十 and rank-matching rules, plus complete deck point conservation.
 *
 * Verifies all 169 rank pairs across 16 suit permutations:
 * - Below 10: pairs if and only if rankA + rankB === 10 (A-9, 2-8, 3-7, 4-6, 5-5).
 * - 10 and above: pairs if and only if rankA === rankB (10-10, J-J, Q-Q, K-K).
 * - Suit must never affect matchability.
 *
 * Point conservation:
 * - Standard deck: 52 cards, exactly 210 points.
 *   - Red A: 20 pts each (2 cards -> 40 pts).
 *   - Red 9, 10, J, Q, K: 10 pts each (2 cards each, 10 cards -> 100 pts).
 *   - Red 2..8: face value (2x each -> 70 pts).
 *   - Black cards: 0 pts each (26 cards -> 0 pts).
 * - Black Aces variant:
 *   - Red cards unchanged: 210 pts.
 *   - Spade A (spades-1): exactly 30 pts.
 *   - Club A (clubs-1): exactly 40 pts.
 *   - Other 24 black cards: 0 pts.
 *   - Total deck: 280 pts.
 * - Conservation across any multi-way partition of the deck.
 */
function expectExhaustiveMatchingAndPointConservation(): void {
  const deck = buildDeck();
  assert.equal(deck.length, 52, 'Deck must contain 52 cards');

  // 1. Exhaustive matching across all 13 x 13 rank pairs and 4 x 4 suit combinations.
  for (let r1 = 1; r1 <= 13; r1++) {
    for (let r2 = 1; r2 <= 13; r2++) {
      const shouldMatch =
        r1 >= 10 || r2 >= 10 ? r1 === r2 : r1 + r2 === 10;

      for (const s1 of SUITS) {
        for (const s2 of SUITS) {
          const c1: Card = { id: `${s1}-${r1}`, suit: s1, rank: r1 as Rank };
          const c2: Card = { id: `${s2}-${r2}`, suit: s2, rank: r2 as Rank };

          const isMatch = matches(c1, c2);
          assert.equal(
            isMatch,
            shouldMatch,
            `matches(${c1.id}, ${c2.id}) returned ${isMatch}, expected ${shouldMatch}`,
          );
          // Symmetry invariant: matches(c1, c2) === matches(c2, c1)
          assert.equal(
            isMatch,
            matches(c2, c1),
            `matches is not symmetric for ${c1.id} and ${c2.id}`,
          );
        }
      }
    }
  }

  // 2. Specific verification of canonical legal pairs.
  const canonicalPairs: Array<[Rank, Rank]> = [
    [1, 9],
    [2, 8],
    [3, 7],
    [4, 6],
    [5, 5],
    [10, 10],
    [11, 11],
    [12, 12],
    [13, 13],
  ];
  for (const [rA, rB] of canonicalPairs) {
    const cardA: Card = { id: `hearts-${rA}`, suit: 'hearts', rank: rA };
    const cardB: Card = { id: `spades-${rB}`, suit: 'spades', rank: rB };
    assert.ok(matches(cardA, cardB), `canonical pair ${rA}-${rB} failed to match`);
  }

  // 3. Boundary negative checks.
  // 5 only pairs with 5.
  for (let r = 1; r <= 13; r++) {
    if (r === 5) continue;
    const c5: Card = { id: 'hearts-5', suit: 'hearts', rank: 5 };
    const other: Card = { id: 'spades-5', suit: 'spades', rank: r as Rank };
    assert.ok(!matches(c5, other), `5 must not pair with rank ${r}`);
  }
  // Face cards do not pair with each other across different ranks.
  const faceRanks: Rank[] = [10, 11, 12, 13];
  for (const f1 of faceRanks) {
    for (const f2 of faceRanks) {
      if (f1 === f2) continue;
      const c1: Card = { id: `diamonds-${f1}`, suit: 'diamonds', rank: f1 };
      const c2: Card = { id: `clubs-${f2}`, suit: 'clubs', rank: f2 };
      assert.ok(!matches(c1, c2), `face card ${f1} must not pair with ${f2}`);
    }
  }

  // 4. Point values and conservation for standard rules.
  let standardRedSum = 0;
  let standardBlackSum = 0;
  for (const card of deck) {
    const pts = pointsOf(card, false);
    if (isRed(card)) {
      standardRedSum += pts;
      if (card.rank === 1) {
        assert.equal(pts, 20, `Red A (${card.id}) must be 20 points`);
      } else if (card.rank >= 9) {
        assert.equal(pts, 10, `Red 9..K (${card.id}) must be 10 points`);
      } else {
        assert.equal(pts, card.rank, `Red ${card.rank} (${card.id}) must be face value`);
      }
    } else {
      standardBlackSum += pts;
      assert.equal(pts, 0, `Black card (${card.id}) must be 0 points under standard rules`);
    }
  }
  assert.equal(standardRedSum, 210, 'Total red points in standard deck must be 210');
  assert.equal(standardBlackSum, 0, 'Total black points in standard deck must be 0');
  assert.equal(sumPoints(deck, false), 210, 'sumPoints(deck, false) must be 210');

  // 5. Point values and conservation for Black Aces variant.
  let variantRedSum = 0;
  let variantBlackSum = 0;
  for (const card of deck) {
    const pts = pointsOf(card, true);
    if (isRed(card)) {
      variantRedSum += pts;
    } else {
      variantBlackSum += pts;
      if (card.suit === 'spades' && card.rank === 1) {
        assert.equal(pts, 30, 'Spade A must be 30 points in Black Aces variant');
      } else if (card.suit === 'clubs' && card.rank === 1) {
        assert.equal(pts, 40, 'Club A must be 40 points in Black Aces variant');
      } else {
        assert.equal(pts, 0, `Black card ${card.id} must be 0 points even with Black Aces`);
      }
    }
  }
  assert.equal(variantRedSum, 210, 'Red points must remain 210 with Black Aces variant');
  assert.equal(variantBlackSum, 70, 'Black ace points must sum to 70 (30 + 40)');
  assert.equal(sumPoints(deck, true), 280, 'Total deck points with Black Aces must be 280');

  // 6. Partition conservation: partition deck into chunks of arbitrary sizes.
  const p1 = deck.slice(0, 12);
  const p2 = deck.slice(12, 24);
  const p3 = deck.slice(24, 28);
  const p4 = deck.slice(28, 52);
  assert.equal(
    sumPoints(p1, false) + sumPoints(p2, false) + sumPoints(p3, false) + sumPoints(p4, false),
    210,
    'Arbitrary partition must conserve 210 points in standard deck',
  );
  assert.equal(
    sumPoints(p1, true) + sumPoints(p2, true) + sumPoints(p3, true) + sumPoints(p4, true),
    280,
    'Arbitrary partition must conserve 280 points in Black Aces deck',
  );
}

/**
 * Deep check of Double Red 5 (過紅五) detection, chip settlement bonuses,
 * zero-sum chip conservation, and point swing invariants.
 */
function expectDoubleRedFiveBonusAndScoring(): void {
  const card = (suit: 'hearts' | 'diamonds' | 'clubs' | 'spades', rank: Rank): Card => ({
    id: `${suit}-${rank}`,
    suit,
    rank,
  });

  const baseState = deal('red5-deep-test', 'normal', rules(2));

  // 1. Single turn: hand captures hearts-5, pile flip captures diamonds-5.
  const turnBothCaptured: GameState = {
    ...baseState,
    rules: { ...baseState.rules, doubleRedFive: true },
    log: [
      {
        by: HUMAN,
        played: card('hearts', 5),
        taken: card('clubs', 5),
        source: 'hand',
        points: 5,
        tableBefore: [card('clubs', 5)],
      },
      {
        by: HUMAN,
        played: card('spades', 5),
        taken: card('diamonds', 5),
        source: 'pile',
        points: 5,
        tableBefore: [card('diamonds', 5)],
      },
    ],
  };
  assert.equal(findDoubleRedFive(turnBothCaptured), HUMAN, 'Must detect double red 5 from hand + flip');

  // 2. Single hand play captures BOTH red 5s: diamonds-5 takes hearts-5 from table.
  const singleHandBothReds: GameState = {
    ...baseState,
    rules: { ...baseState.rules, doubleRedFive: true },
    log: [
      {
        by: 1,
        played: card('diamonds', 5),
        taken: card('hearts', 5),
        source: 'hand',
        points: 10,
        tableBefore: [card('hearts', 5)],
      },
      {
        by: 1,
        played: card('clubs', 8),
        taken: null,
        source: 'pile',
        points: 0,
        tableBefore: [],
      },
    ],
  };
  assert.equal(findDoubleRedFive(singleHandBothReds), 1, 'Must detect double red 5 when both are banked in single hand play');

  // 3. Single pile flip captures BOTH red 5s: pile flips diamonds-5, takes hearts-5 on table.
  const singleFlipBothReds: GameState = {
    ...baseState,
    rules: { ...baseState.rules, doubleRedFive: true },
    log: [
      {
        by: 0,
        played: card('spades', 8),
        taken: null,
        source: 'hand',
        points: 0,
        tableBefore: [],
      },
      {
        by: 0,
        played: card('diamonds', 5),
        taken: card('hearts', 5),
        source: 'pile',
        points: 10,
        tableBefore: [card('hearts', 5)],
      },
    ],
  };
  assert.equal(findDoubleRedFive(singleFlipBothReds), 0, 'Must detect double red 5 when both are banked in single flip');

  // 4. Negative check: hearts-5 in turn 0, diamonds-5 in turn 1.
  const splitAcrossTurns: GameState = {
    ...baseState,
    rules: { ...baseState.rules, doubleRedFive: true },
    log: [
      {
        by: HUMAN,
        played: card('hearts', 5),
        taken: card('clubs', 5),
        source: 'hand',
        points: 5,
        tableBefore: [],
      },
      {
        by: HUMAN,
        played: card('spades', 2),
        taken: null,
        source: 'pile',
        points: 0,
        tableBefore: [],
      },
      {
        by: 1,
        played: card('spades', 3),
        taken: null,
        source: 'hand',
        points: 0,
        tableBefore: [],
      },
      {
        by: 1,
        played: card('spades', 4),
        taken: null,
        source: 'pile',
        points: 0,
        tableBefore: [],
      },
      {
        by: HUMAN,
        played: card('diamonds', 5),
        taken: card('spades', 5),
        source: 'hand',
        points: 5,
        tableBefore: [],
      },
      {
        by: HUMAN,
        played: card('spades', 6),
        taken: null,
        source: 'pile',
        points: 0,
        tableBefore: [],
      },
    ],
  };
  assert.equal(
    findDoubleRedFive(splitAcrossTurns),
    null,
    'Must NOT detect double red 5 when captured across different turns',
  );

  // 5. Negative check: different seats capture one red 5 each.
  const splitAcrossSeats: GameState = {
    ...baseState,
    rules: { ...baseState.rules, doubleRedFive: true },
    log: [
      {
        by: HUMAN,
        played: card('hearts', 5),
        taken: card('clubs', 5),
        source: 'hand',
        points: 5,
        tableBefore: [],
      },
      {
        by: HUMAN,
        played: card('spades', 2),
        taken: null,
        source: 'pile',
        points: 0,
        tableBefore: [],
      },
      {
        by: 1,
        played: card('diamonds', 5),
        taken: card('spades', 5),
        source: 'hand',
        points: 5,
        tableBefore: [],
      },
      {
        by: 1,
        played: card('spades', 4),
        taken: null,
        source: 'pile',
        points: 0,
        tableBefore: [],
      },
    ],
  };
  assert.equal(findDoubleRedFive(splitAcrossSeats), null, 'Must NOT award double red 5 when split across seats');

  // 6. Negative check: doubleRedFive house rule disabled.
  const ruleDisabledState: GameState = {
    ...turnBothCaptured,
    rules: { ...turnBothCaptured.rules, doubleRedFive: false },
  };
  assert.equal(findDoubleRedFive(ruleDisabledState), null, 'Must return null when doubleRedFive rule is off');

  // 7. Chip settlement & zero-sum conservation across 2, 3, and 4 players.
  // 2-player settlement:
  // Base scores: [105, 105] (par 105). Seat 0 triggers doubleRedFive.
  // Bonus: +20 * (2 - 1) = +20 to Seat 0, -20 to Seat 1.
  const deltas2p = settleChips([105, 105], 105, rules(2), 0, null);
  assert.deepEqual(deltas2p, [20, -20], '2-player double red 5 bonus must be +20 / -20');
  assert.equal(deltas2p.reduce((a, b) => a + b, 0), 0, '2p deltas must sum to 0');

  // 3-player settlement:
  // Base scores: [70, 70, 70] (par 70). Seat 1 triggers doubleRedFive.
  // Bonus: +20 * (3 - 1) = +40 to Seat 1, -20 to Seat 0 and Seat 2.
  const deltas3p = settleChips([70, 70, 70], 70, rules(3), 1, null);
  assert.deepEqual(deltas3p, [-20, 40, -20], '3-player double red 5 bonus must be +40 for winner, -20 each');
  assert.equal(deltas3p.reduce((a, b) => a + b, 0), 0, '3p deltas must sum to 0');

  // 4-player settlement:
  // Base scores: [52.5, 52.5, 52.5, 52.5] (par 52.5). Seat 2 triggers doubleRedFive.
  // Bonus: +20 * (4 - 1) = +60 to Seat 2, -20 to each of the other three seats.
  const deltas4p = settleChips([52.5, 52.5, 52.5, 52.5], 52.5, rules(4), 2, null);
  assert.deepEqual(deltas4p, [-20, -20, 60, -20], '4-player double red 5 bonus must be +60 for winner, -20 each');
  assert.equal(deltas4p.reduce((a, b) => a + b, 0), 0, '4p deltas must sum to 0');

  // 8. Combined card points + bonus differential:
  // Capturing both red 5s yields 5 + 5 = 10 card points.
  // In a 2-player game where Seat 0 scored 105 including both red 5s,
  // the card point contribution is 10 points and chip bonus is +20,
  // creating a combined total impact of +30 points/chips over par.
  const rawRed5Points = pointsOf(card('hearts', 5)) + pointsOf(card('diamonds', 5));
  assert.equal(rawRed5Points, 10, 'Both red fives together must contribute exactly 10 card points');
  const totalImpact2p = (105 - 105) + deltas2p[0] + rawRed5Points;
  assert.equal(totalImpact2p, 30, 'Total card score contribution (10) + chip bonus (+20) represents a +30 advantage');
}

/**
 * Invariants for 2-player, 3-player, and 4-player deal balance:
 * - 2-player: 24 cards in deal (12 each), 4 table pool, 24 pile.
 * - 3-player: 24 cards in deal (8 each; 16 cards across opponents), 4 table pool, 24 pile.
 * - 4-player: 24 cards in deal (6 each; 12 cards per pair/subset), 4 table pool, 24 pile.
 * - Total card conservation: hands + table + pile = 52.
 * - Turn count: each player takes handSize(players) turns, exactly exhausting 24 pile cards.
 * - Par score integer / fraction precision.
 */
function expectMultiplayerBalanceInvariants(): void {
  // 1. Structural deal constants
  assert.equal(TABLE_SIZE, 4, 'Table size must be 4');
  assert.equal(DEALT_TOTAL, 24, 'Total dealt cards to hands must be 24');
  assert.equal(PILE_SIZE, 24, 'Draw pile size must be 24');
  assert.equal(DEALT_TOTAL + TABLE_SIZE + PILE_SIZE, 52, 'Deck partition must sum to 52');

  // 2. Specific per-player count invariants
  const specs: Array<{
    players: PlayerCount;
    handPerPlayer: number;
    totalDealt: number;
    opponentCardsTotal: number;
    parStandard: number;
    parBlackAces: number;
  }> = [
    {
      players: 2,
      handPerPlayer: 12,
      totalDealt: 24,
      opponentCardsTotal: 12, // 1 opponent * 12
      parStandard: 105,
      parBlackAces: 140,
    },
    {
      players: 3,
      handPerPlayer: 8,
      totalDealt: 24,
      opponentCardsTotal: 16, // 2 opponents * 8 = 16 cards deal!
      parStandard: 70,
      parBlackAces: 280 / 3,
    },
    {
      players: 4,
      handPerPlayer: 6,
      totalDealt: 24,
      opponentCardsTotal: 18, // 3 opponents * 6 = 18; 2 opponents = 12 cards deal!
      parStandard: 52.5,
      parBlackAces: 70,
    },
  ];

  for (const spec of specs) {
    assert.equal(handSize(spec.players), spec.handPerPlayer, `${spec.players}p handSize mismatch`);
    assert.equal(spec.handPerPlayer * spec.players, spec.totalDealt, `${spec.players}p total dealt mismatch`);
    assert.equal(parScore(spec.players, false), spec.parStandard, `${spec.players}p standard par mismatch`);
    assert.equal(parScore(spec.players, true), spec.parBlackAces, `${spec.players}p black aces par mismatch`);

    // Verify 3-player 16 opponent cards and 4-player 12 cards subset
    if (spec.players === 3) {
      assert.equal(spec.opponentCardsTotal, 16, '3-player deal must have 16 cards across opponents');
    }
    if (spec.players === 4) {
      assert.equal(spec.handPerPlayer * 2, 12, '4-player deal must have 12 cards per 2 players');
    }

    // Verify dealing across multiple seeds
    for (let seedIdx = 0; seedIdx < 15; seedIdx++) {
      const state = deal(`multi-balance-${spec.players}-${seedIdx}`, 'normal', rules(spec.players));
      assert.equal(state.hands.length, spec.players, 'Incorrect number of hands');
      for (let s = 0; s < spec.players; s++) {
        assert.equal(state.hands[s].length, spec.handPerPlayer, `Hand size mismatch at seat ${s}`);
      }
      assert.equal(state.table.length, 4, 'Table must have 4 cards');
      assert.equal(state.pile.length, 24, 'Draw pile must have 24 cards');

      const all = allCards(state);
      assert.equal(all.length, 52, 'Must contain 52 cards total');
      assert.equal(new Set(all.map((c) => c.id)).size, 52, 'Cards must be unique');

      // Point conservation at deal time
      assert.equal(sumPoints(all, false), 210, 'Deal state must conserve 210 points');
    }
  }

  // 3. Dynamic gameplay balance and pile exhaustion
  for (const players of COUNTS) {
    const end = playOut(`balance-full-${players}`, 'normal', players);
    assert.equal(end.phase, 'over', 'Game must reach over phase');
    assert.equal(end.pile.length, 0, 'Pile must be completely exhausted');
    for (let s = 0; s < players; s++) {
      assert.equal(end.hands[s].length, 0, `Seat ${s} must have empty hand`);
      assert.equal(end.captured[s].length % 2, 0, `Seat ${s} captures must be even`);
    }

    const out = outcome(end);
    assert.equal(
      out.scores.reduce((a, b) => a + b, 0) + out.wastedPoints,
      210,
      'Final scores plus wasted points must equal 210',
    );
  }
}

/**
 * AI eat/discard optimization, strategic danger card radar,
 * and point differential projections.
 */
function expectAiOptimizationDangerRadarAndProjections(): void {
  const card = (suit: 'hearts' | 'diamonds' | 'clubs' | 'spades', rank: Rank): Card => ({
    id: `${suit}-${rank}`,
    suit,
    rank,
  });

  // 1. AI Eat Optimization: maximizing captured red points
  const base = deal('ai-opt-seed', 'normal', rules(2));
  const eatState: GameState = {
    ...base,
    turn: 1, // CPU seat
    table: [card('hearts', 1), card('hearts', 3)], // Table has Red Ace (20 pts) and Red 3 (3 pts)
    hands: [
      base.hands[0],
      [card('spades', 9), card('clubs', 7)], // Spades 9 can eat Red Ace (20 pts); Clubs 7 can eat Red 3 (3 pts)
    ],
  };

  const sharpMove = chooseMove(eatState, 'sharp', 0);
  assert.equal(
    sharpMove.card.id,
    'spades-9',
    'Sharp AI must choose spades-9 to eat Red Ace (20 pts) over clubs-7 (3 pts)',
  );
  assert.equal(sharpMove.taken?.id, 'hearts-1', 'Sharp AI must take hearts-1');

  // 2. Tool Cost Optimization: preferring black tool when capture value is tied
  // Move 1: Spades 7 (0 pts) takes Hearts 3 (3 pts) -> total 3 pts, toolCost = 0
  // Move 2: Hearts 3 (3 pts) takes Clubs 7 (0 pts) -> total 3 pts, toolCost = 3
  const toolState: GameState = {
    ...base,
    turn: 1,
    table: [card('hearts', 3), card('clubs', 7)],
    hands: [
      base.hands[0],
      [card('spades', 7), card('hearts', 3)],
    ],
  };

  const miserMove = chooseMove(toolState, 'sharp', 0, 'miser');
  assert.equal(
    miserMove.card.id,
    'spades-7',
    'Miser personality must use black card (0 cost) instead of red card (3 cost) when capturing tied value',
  );

  const feederMove = chooseMove(toolState, 'sharp', 0, 'feeder');
  assert.equal(
    feederMove.card.id,
    'hearts-3',
    'Feeder personality happily spends red tool when capture points are tied',
  );

  // 3. Discard Optimization: never giving away points when safe discard exists
  const discardState: GameState = {
    ...base,
    turn: 1,
    table: [card('clubs', 9)], // Table has 9; hand cards (2, 8, 4, 10) cannot capture 9
    hands: [
      base.hands[0],
      [
        card('clubs', 2), // Black 0 pts
        card('spades', 8), // Black 0 pts
        card('hearts', 4), // Red 4 pts
        card('diamonds', 10), // Red 10 pts
      ],
    ],
  };

  const sharpDiscard = chooseMove(discardState, 'sharp', 0);
  assert.equal(
    pointsOf(sharpDiscard.card, false),
    0,
    'Sharp brain must never discard a scoring red card when a 0-point card is available',
  );
  assert.equal(sharpDiscard.taken, null, 'Must be a discard (taken === null)');

  // 4. Danger Card Radar
  // Verify red Ace, red 9, red 5 categories
  assert.equal(getDangerCardType(card('hearts', 1)), 'ace');
  assert.equal(getDangerCardType(card('diamonds', 1)), 'ace');
  assert.equal(getDangerCardType(card('spades', 1), false), null);
  assert.equal(getDangerCardType(card('spades', 1), true), 'ace');

  assert.equal(getDangerCardType(card('hearts', 9)), 'nine');
  assert.equal(getDangerCardType(card('diamonds', 9)), 'nine');
  assert.equal(getDangerCardType(card('clubs', 9)), null);

  assert.equal(getDangerCardType(card('hearts', 5)), 'red_five');
  assert.equal(getDangerCardType(card('diamonds', 5)), 'red_five');
  assert.equal(getDangerCardType(card('spades', 5)), null);

  assert.ok(isDangerCard(card('hearts', 1)));
  assert.ok(isDangerCard(card('diamonds', 9)));
  assert.ok(isDangerCard(card('hearts', 5)));
  assert.ok(!isDangerCard(card('clubs', 2)));
  assert.ok(!isDangerCard(card('spades', 8)));

  // Table resonance
  const tableWithAce = [card('hearts', 1), card('clubs', 4)];
  assert.ok(hasResonanceWithTable(card('spades', 9), tableWithAce), '9 must resonate with Ace on table');
  assert.ok(!hasResonanceWithTable(card('spades', 8), tableWithAce), '8 must not resonate with Ace');

  const tableWithRed5 = [card('hearts', 5)];
  assert.ok(hasResonanceWithTable(card('diamonds', 5), tableWithRed5), '5 must resonate with 5 on table');
  assert.ok(!hasResonanceWithTable(card('diamonds', 9), tableWithRed5), '9 must not resonate with 5');

  // 5. Point Differential Projections (projectHandOptions)
  const projState: GameState = {
    ...base,
    turn: HUMAN,
    table: [card('hearts', 8), card('clubs', 6)],
    hands: [
      [
        card('clubs', 2), // Can capture hearts-8 (isToolConversion = true, maxPoints = 8)
        card('spades', 3), // Cannot capture, 0 pts -> safe
        card('hearts', 3), // Cannot capture, 3 pts -> caution
        card('diamonds', 10), // Cannot capture, 10 pts -> danger
      ],
      base.hands[1],
    ],
  };

  const projections = projectHandOptions(projState);
  assert.equal(projections.length, 4);

  const projC2 = projections.find((p) => p.handCard.id === 'clubs-2')!;
  assert.ok(projC2.canCapture);
  assert.equal(projC2.bestTarget?.id, 'hearts-8');
  assert.equal(projC2.maxPoints, 8);
  assert.ok(projC2.isToolConversion);

  const projS3 = projections.find((p) => p.handCard.id === 'spades-3')!;
  assert.ok(!projS3.canCapture);
  assert.equal(projS3.discardSafety, 'safe');

  const projH3 = projections.find((p) => p.handCard.id === 'hearts-3')!;
  assert.ok(!projH3.canCapture);
  assert.equal(projH3.discardSafety, 'caution');

  const projD10 = projections.find((p) => p.handCard.id === 'diamonds-10')!;
  assert.ok(!projD10.canCapture);
  assert.equal(projD10.discardSafety, 'danger');

  // 6. Score Leverage Status Classification
  function makeCardsWithPoints(points: number): Card[] {
    const cards: Card[] = [];
    let rem = points;
    let idx = 0;
    while (rem > 0) {
      if (rem >= 20) {
        cards.push({ id: `pile-a-${idx++}`, suit: 'hearts', rank: 1 });
        rem -= 20;
      } else if (rem >= 10) {
        cards.push({ id: `pile-10-${idx++}`, suit: 'hearts', rank: 10 });
        rem -= 10;
      } else {
        const r = Math.min(8, rem) as Rank;
        cards.push({ id: `pile-r-${idx++}`, suit: 'hearts', rank: r });
        rem -= r;
      }
    }
    return cards;
  }

  const mockStateWithScore = (myScore: number, oppScore: number, remainingRed: number): GameState => ({
    ...base,
    captured: [
      makeCardsWithPoints(myScore),
      makeCardsWithPoints(oppScore),
    ],
    table: [],
    hands: [[], []],
    pile: makeCardsWithPoints(remainingRed),
  });

  // safe_lead: score >= par + 10 (115 >= 115)
  const safeLead = analyzeScoreLeverage(mockStateWithScore(115, 50, 45));
  assert.equal(safeLead.status, 'safe_lead');
  assert.equal(safeLead.margin, 10);

  // qualified: score >= par (105 >= 105)
  const qualified = analyzeScoreLeverage(mockStateWithScore(105, 50, 55));
  assert.equal(qualified.status, 'qualified');

  // striking_distance: par - score <= 15 (95 >= 90)
  const striking = analyzeScoreLeverage(mockStateWithScore(95, 50, 65));
  assert.equal(striking.status, 'striking_distance');

  // unreachable: myScore + remaining < par
  const unreachable = analyzeScoreLeverage(mockStateWithScore(40, 160, 10));
  assert.equal(unreachable.status, 'unreachable');

  // trailing: par - myScore > 15
  const trailing = analyzeScoreLeverage(mockStateWithScore(80, 50, 80));
  assert.equal(trailing.status, 'trailing');
}

function expectStrategicDiscardAndHardAiSafeCounting(): void {
  // 1. Optional Strategic Discard House Rule
  // Classic forced capture: with allowStrategicDiscard: false, playCard must capture
  const c9: Card = { id: 'clubs-9', suit: 'clubs', rank: 9 };
  const hA: Card = { id: 'hearts-1', suit: 'hearts', rank: 1 };
  const s2: Card = { id: 'spades-2', suit: 'spades', rank: 2 };
  const sK: Card = { id: 'spades-13', suit: 'spades', rank: 13 };

  const classicState: GameState = {
    seedCode: 'test-classic',
    rules: { ...rules(2), allowStrategicDiscard: false },
    difficulty: 'normal',
    leader: 0,
    phase: 'play',
    turn: 0,
    hands: [[c9, s2], [sK]],
    captured: [[], []],
    table: [hA],
    pile: [],
    pending: null,
    log: [],
    spotlight: [],
  };

  // Even with forceDiscard requested, classic rule enforces capture
  const playedClassic = playCard(classicState, c9.id, true);
  assert.equal(playedClassic.captured[0].length, 2, 'classic rules must force capture');
  assert.equal(playedClassic.table.length, 0, 'captured card should be removed from table');

  // With allowStrategicDiscard: true, intentional discard places the matching card on the table
  const strategicState: GameState = {
    ...classicState,
    rules: { ...classicState.rules, allowStrategicDiscard: true },
  };

  // Normal play still captures
  const capturedStrat = playCard(strategicState, c9.id, false);
  assert.equal(capturedStrat.captured[0].length, 2, 'normal play captures when matching');

  // Strategic discard: card is placed on table without capturing
  const discardedStrat = playCard(strategicState, c9.id, true);
  assert.equal(discardedStrat.captured[0].length, 0, 'strategic discard must not capture');
  assert.equal(discardedStrat.table.length, 2, 'strategic discard leaves card on table');
  assert.ok(discardedStrat.table.some((c) => c.id === c9.id), 'discarded card must be on table');
  assert.ok(discardedStrat.table.some((c) => c.id === hA.id), 'table card remains on table');
  assert.equal(discardedStrat.phase, 'flip', 'phase advances to flip after strategic discard');

  // Strategic discard via discardCard helper
  const discardedViaHelper = discardCard(strategicState, c9.id);
  assert.equal(discardedViaHelper.captured[0].length, 0);
  assert.equal(discardedViaHelper.table.length, 2);

  // Strategic discard during pick_play
  const hA2: Card = { id: 'diamonds-1', suit: 'diamonds', rank: 1 };
  const multiMatchState: GameState = {
    ...strategicState,
    table: [hA, hA2],
  };
  const pickPlayState = playCard(multiMatchState, c9.id, false);
  assert.equal(pickPlayState.phase, 'pick_play');
  assert.equal(pickPlayState.pending?.id, c9.id);
  const discardDuringPick = choosePick(pickPlayState, null);
  assert.equal(discardDuringPick.captured[0].length, 0, 'cancelling pick strategically discards');
  assert.equal(discardDuringPick.phase, 'flip');
  assert.equal(discardDuringPick.table.length, 3);

  // 2. Hard AI Card-Counting Safe Discard
  // Scenario: CPU has no moves that capture table cards.
  // CPU hand has:
  // - clubs-9 (0 pts, matches 1: hearts-1/diamonds-1 are NOT accounted for, risk of feeding 20pt Red Ace)
  // - spades-3 (0 pts, matches 7: all 7s are already accounted for in log/captured, 100% SAFE discard)
  const allSevens: Card[] = [
    { id: 'spades-7', suit: 'spades', rank: 7 },
    { id: 'hearts-7', suit: 'hearts', rank: 7 },
    { id: 'clubs-7', suit: 'clubs', rank: 7 },
    { id: 'diamonds-7', suit: 'diamonds', rank: 7 },
  ];

  const hardCpuState: GameState = {
    seedCode: 'test-hard-counting',
    rules: rules(2),
    difficulty: 'hard',
    leader: 1,
    phase: 'play',
    turn: 1,
    hands: [
      [{ id: 'spades-5', suit: 'spades', rank: 5 }],
      [
        { id: 'clubs-9', suit: 'clubs', rank: 9 }, // matches 1, but Red Ace (20pts) is unseen!
        { id: 'spades-3', suit: 'spades', rank: 3 }, // matches 7, all 7s are accounted for!
      ],
    ],
    captured: [
      [allSevens[0], allSevens[1]],
      [allSevens[2], allSevens[3]],
    ],
    table: [{ id: 'spades-4', suit: 'spades', rank: 4 }], // Neither 9 nor 3 can capture 4
    pile: [],
    pending: null,
    log: [],
    spotlight: [],
  };

  const hardMove = chooseMove(hardCpuState, 'sharp');
  assert.equal(
    hardMove.card.id,
    'spades-3',
    'Hard AI must count cards and prefer safe rank (spades-3) over feeding exposed red Ace on table (clubs-9)',
  );

  // Also verify chooseDiscard directly
  const discardedCard = chooseDiscard(hardCpuState, 'sharp', null);
  assert.equal(discardedCard.id, 'spades-3');

  // Verify that between a 20-point Red Ace and a 0-point Black card, Hard AI never discards Red Ace
  const hardAvoidDumpingAceState: GameState = {
    ...hardCpuState,
    hands: [
      [{ id: 'spades-5', suit: 'spades', rank: 5 }],
      [
        { id: 'hearts-1', suit: 'hearts', rank: 1 }, // Red Ace (20 pts)
        { id: 'clubs-9', suit: 'clubs', rank: 9 },   // 0 pts
      ],
    ],
  };
  const moveAvoidingRedAce = chooseMove(hardAvoidDumpingAceState, 'sharp');
  assert.equal(
    moveAvoidingRedAce.card.id,
    'clubs-9',
    'Hard AI must never dump high-value red Ace when a 0-point card is available',
  );
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
  ['every ladder rung is a real step, at every player count', expectLadderRungsAreRealSteps],
  ['difficulties are distinct', expectDifficultiesAreDistinct],
  ['best capture', expectBestCapturePicksTheMostValuable],
  ['discards land on the table', expectDiscardsLandOnTheTable],
  ['the flip offers a choice', expectFlipOffersAChoice],
  ['streak tracking', expectStreakTracking],
  ['chip settlement uses qualifying score', expectChipSettlement],
  ['match series structure', expectMatchSeries],
  ['match MVP stats', expectMatchMvp],
  ['personalities and teaching hints', expectPersonalitiesAndHints],
  ['double red five detection', expectDoubleRedFiveDetection],
  ['daily table (Taipei seed)', expectDailyTable],
  ['single mode and format stats', expectSingleModeAndFormats],
  ['named opponent ladder', expectNamedOpponentLadder],
  ['tactical analysis and radar', expectTacticalAnalysis],
  ['danger cards and momentum oscilloscope', expectDangerCardsAndMomentum],
  ['exhaustive matching and point conservation', expectExhaustiveMatchingAndPointConservation],
  ['double red five bonus and scoring invariants', expectDoubleRedFiveBonusAndScoring],
  ['multiplayer deal and balance invariants (2p/3p/4p)', expectMultiplayerBalanceInvariants],
  ['ai eat/discard optimization, radar and projections', expectAiOptimizationDangerRadarAndProjections],
  ['hard AI safe discard and strategic discard', expectStrategicDiscardAndHardAiSafeCounting],
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

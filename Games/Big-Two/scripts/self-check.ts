import * as assert from 'node:assert/strict';
import {
  LOWEST_CARD_ID,
  buildDeck,
  cardLabel,
  power,
  rankStrength,
  shuffle,
  sortCards,
  suitStrength,
} from '../src/game/cards.js';
import { SEQUENCES, TYPE_LABEL, beats, detectPlay, legalPlays } from '../src/game/plays.js';
import {
  allCards,
  canPass,
  deal,
  isOpeningPlay,
  outcome,
  pass,
  play,
  playsFor,
  scoreSeat,
  sizeMultiplier,
} from '../src/game/engine.js';
import {
  DIFFICULTIES,
  EASY_PASS_RATE,
  PERSONALITIES,
  SEAT_PERSONALITIES,
  chooseMove,
  personalityForSeat,
  turnsToEmpty,
} from '../src/game/cpu.js';
import { advise } from '../src/game/hints.js';
import {
  buildDailyShareText,
  computeDailyStreak,
  dailyMatchConfig,
  dailySeedCode,
  DAILY_HANDS,
  taipeiDateKey,
} from '../src/game/daily.js';
import {
  applyHandResult,
  computeMatchMvp,
  createMatch,
  dealHand,
  decideMatchWinner,
  formatKeyFor,
  handDeltas,
  handExtras,
  handSeed,
  isSeriesMode,
} from '../src/game/match.js';
import { remainingCards } from '../src/game/memory.js';
import {
  NAMED_OPPONENTS,
  isOpponentUnlocked,
  ladderSeatPersonalities,
  opponentById,
  opponentCount,
} from '../src/game/opponents.js';
import { buildHandReview } from '../src/game/review.js';
import {
  EMPTY_STATS,
  applyLadderResult,
  recordDailyResult,
  recordHandResult,
  recordMatchResult,
} from '../src/game/storage.js';
import { createRng } from '../src/game/rng.js';
import { HAND_SIZE, HUMAN, SEATS } from '../src/game/types.js';
import type {
  Card,
  DifficultyId,
  GameState,
  HandRecord,
  HouseRules,
  MatchState,
  Play,
  SeatScore,
  StraightRule,
} from '../src/game/types.js';

const TEST_PROFILE = process.env.CLUBHOUSE_TEST_PROFILE || 'full';
if (TEST_PROFILE !== 'quick' && TEST_PROFILE !== 'full') {
  throw new Error(`Invalid CLUBHOUSE_TEST_PROFILE: ${JSON.stringify(TEST_PROFILE)} (expected quick or full)`);
}
console.log(`Test profile: ${TEST_PROFILE}`);

const TIERS: DifficultyId[] = ['easy', 'normal', 'hard'];
const RULE_SETS: StraightRule[] = ['topCard', 'sequence'];

function rules(straights: StraightRule = 'topCard'): HouseRules {
  return { straights, sizeLadder: true, deuceDouble: true };
}

function seeds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `check-${i}`);
}

const DECK = buildDeck();
const card = (label: string): Card => {
  const found = DECK.find((c) => cardLabel(c) === label);
  if (!found) throw new Error(`no such card: ${label}`);
  return found;
};
const hand = (...labels: string[]): Card[] => labels.map(card);

/**
 * Two is the highest card and three the lowest — the rule the game is named
 * after, and the one that a sort by face value silently inverts.
 */
function expectCardOrder(): void {
  assert.equal(rankStrength(3), 0, 'a three is not the weakest rank');
  assert.equal(rankStrength(13), 10, 'a king is out of place');
  assert.equal(rankStrength(1), 11, 'an ace should sit above the king');
  assert.equal(rankStrength(2), 12, 'a deuce should be the strongest rank');
  assert.ok(rankStrength(2) > rankStrength(1), 'the deuce must outrank the ace');
  assert.ok(rankStrength(1) > rankStrength(13), 'the ace must outrank the king');

  assert.equal(suitStrength('clubs'), 0);
  assert.equal(suitStrength('spades'), 3);
  assert.ok(power(card('♠2')) > power(card('♥2')), 'spades must outrank hearts');
  assert.ok(power(card('♣3')) === 0, '♣3 is not the weakest card');
  assert.equal(card('♣3').id, LOWEST_CARD_ID, 'the opening card is not ♣3');
  assert.ok(power(card('♠2')) === 51, '♠2 is not the strongest card');

  // Every card must have a distinct power, or comparisons could tie.
  assert.equal(new Set(DECK.map(power)).size, 52, 'two cards share a power value');
}

/** Detection of every play type, plus the shapes that must be rejected. */
function expectPlayDetection(): void {
  assert.equal(detectPlay(hand('♣3'))?.type, 'single');
  assert.equal(detectPlay(hand('♣3', '♦3'))?.type, 'pair');
  assert.equal(detectPlay(hand('♣3', '♦4')), null, 'two different ranks are not a pair');

  assert.equal(detectPlay(hand('♣3', '♦4', '♥5', '♠6', '♣7'))?.type, 'straight');
  assert.equal(detectPlay(hand('♣3', '♣5', '♣7', '♣9', '♣J'))?.type, 'flush');
  assert.equal(detectPlay(hand('♣3', '♦3', '♥3', '♠4', '♣4'))?.type, 'fullHouse');
  assert.equal(detectPlay(hand('♣3', '♦3', '♥3', '♠3', '♣9'))?.type, 'quads');
  assert.equal(detectPlay(hand('♣3', '♣4', '♣5', '♣6', '♣7'))?.type, 'straightFlush');

  // Three and four cards are not plays in their own right.
  assert.equal(detectPlay(hand('♣3', '♦3', '♥3')), null, 'a bare triple is not a play');
  assert.equal(detectPlay(hand('♣3', '♦3', '♥3', '♠3')), null, 'a bare quad is not a play');
  assert.equal(detectPlay(hand('♣3', '♦4', '♥5', '♠6')), null, 'four cards are not a play');

  // The ace sits at either end of a run but never in the middle.
  assert.equal(detectPlay(hand('♣A', '♦2', '♥3', '♠4', '♣5'))?.type, 'straight', 'A2345 is a run');
  assert.equal(
    detectPlay(hand('♣10', '♦J', '♥Q', '♠K', '♣A'))?.type,
    'straight',
    '10JQKA is a run',
  );
  assert.equal(detectPlay(hand('♣J', '♦Q', '♥K', '♠A', '♣2')), null, 'JQKA2 is not a run');
  assert.equal(detectPlay(hand('♣Q', '♦K', '♥A', '♠2', '♣3')), null, 'QKA23 is not a run');
  assert.equal(detectPlay(hand('♣K', '♦A', '♥2', '♠3', '♣4')), null, 'KA234 is not a run');

  assert.equal(SEQUENCES.length, 10, 'there are not ten legal sequences');
  assert.equal(Object.keys(TYPE_LABEL).length, 7, 'a play type is missing a label');
}

/** Five-card types must rank straight < flush < full house < quads < straight flush. */
function expectFiveCardTypeOrder(): void {
  const straight = detectPlay(hand('♣3', '♦4', '♥5', '♠6', '♣7'))!;
  const flush = detectPlay(hand('♣3', '♣5', '♣7', '♣9', '♣J'))!;
  const full = detectPlay(hand('♣3', '♦3', '♥3', '♠4', '♣4'))!;
  const quads = detectPlay(hand('♣3', '♦3', '♥3', '♠3', '♣9'))!;
  const sf = detectPlay(hand('♣3', '♣4', '♣5', '♣6', '♣7'))!;

  // Each of these is built from the *lowest* cards available, so if the type
  // ranking were not dominant the weaker ranks would win these comparisons.
  assert.ok(flush.key > straight.key, 'a flush must beat a straight');
  assert.ok(full.key > flush.key, 'a full house must beat a flush');
  assert.ok(quads.key > full.key, 'quads must beat a full house');
  assert.ok(sf.key > quads.key, 'a straight flush must beat quads');

  // A full house compares on its triple, not its pair.
  const lowTriple = detectPlay(hand('♣3', '♦3', '♥3', '♠K', '♣K'))!;
  const highTriple = detectPlay(hand('♣4', '♦4', '♥4', '♠5', '♣5'))!;
  assert.ok(highTriple.key > lowTriple.key, 'a full house did not compare on its triple');

  // Quads compare on the four, not the kicker.
  const lowQuads = detectPlay(hand('♣3', '♦3', '♥3', '♠3', '♣2'))!;
  const highQuads = detectPlay(hand('♣4', '♦4', '♥4', '♠4', '♣3'))!;
  assert.ok(highQuads.key > lowQuads.key, 'quads did not compare on the four');
}

/** Both straight conventions have to be coherent and actually differ. */
function expectStraightConventions(): void {
  const runs = (rule: StraightRule) =>
    SEQUENCES.map((seq) => {
      const cards = seq.map((rank) => DECK.find((c) => c.rank === rank && c.suit === 'clubs')!);
      // Force a non-flush so these read as plain straights.
      const mixed = cards.map((c, i) =>
        i === 0 ? DECK.find((d) => d.rank === c.rank && d.suit === 'diamonds')! : c,
      );
      return { seq, play: detectPlay(mixed, rule)! };
    });

  for (const rule of RULE_SETS) {
    const list = runs(rule);
    for (const entry of list) {
      assert.equal(entry.play.type, 'straight', `${entry.seq} was not read as a straight`);
    }
    assert.equal(
      new Set(list.map((entry) => entry.play.key)).size,
      SEQUENCES.length,
      `${rule}: two sequences share a rank`,
    );
  }

  const top = runs('topCard');
  const byKey = [...top].sort((a, b) => a.play.key - b.play.key);
  assert.deepEqual(byKey[0].seq, [1, 2, 3, 4, 5], 'topCard: A2345 should be the smallest run');
  assert.deepEqual(
    byKey[byKey.length - 1].seq,
    [2, 3, 4, 5, 6],
    'topCard: 23456 should be the largest run',
  );

  const seq = runs('sequence');
  const seqByKey = [...seq].sort((a, b) => a.play.key - b.play.key);
  assert.deepEqual(seqByKey[0].seq, [1, 2, 3, 4, 5], 'sequence: A2345 should be the smallest run');
  assert.deepEqual(
    seqByKey[seqByKey.length - 1].seq,
    [10, 11, 12, 13, 1],
    'sequence: 10JQKA should be the largest run',
  );
}

/**
 * The load-bearing property: comparison is a **total order** within each play
 * size.
 *
 * Every pair of distinct plays must resolve, and never both ways. A ranking
 * that ties or contradicts itself does not crash — it produces a game where
 * some hand mysteriously cannot be beaten, or can be beaten by itself, and
 * neither shows up as an error anywhere.
 */
function expectTotalOrder(): void {
  const r = createRng(99);
  for (const rule of RULE_SETS) {
    const samples: Play[] = [];
    for (let trial = 0; samples.length < 400 && trial < 20000; trial++) {
      const deck = shuffle(DECK, r);
      const size = [1, 2, 5][trial % 3];
      const found = detectPlay(deck.slice(0, size), rule);
      if (found) samples.push(found);
    }

    for (const a of samples) {
      assert.ok(!beats(a, a), 'a play beat itself');
      for (const b of samples) {
        if (a.cards.length !== b.cards.length) {
          assert.ok(!beats(a, b) && !beats(b, a), 'plays of different sizes compared');
          continue;
        }
        // Only plays that could actually meet across a table are comparable.
        // Two pairs of the same rank sharing a card — ♣3♠3 against ♥3♠3 — rank
        // equal because both top out at the ♠3, and that is correct: one deck
        // means they can never be in two hands at once, so the situation does
        // not arise. Overlapping plays are excluded rather than the rule bent.
        const overlaps = a.cards.some((x) => b.cards.some((y) => y.id === x.id));
        if (overlaps) continue;
        assert.ok(a.key !== b.key, `two distinct plays share a key: ${a.type}/${b.type}`);
        assert.equal(
          beats(a, b) !== beats(b, a),
          true,
          'comparison is not antisymmetric',
        );
      }
    }
  }
}

/** A five-card hand may never be dropped on a single or a pair. */
function expectSizeMustMatch(): void {
  const single = detectPlay(hand('♣3'))!;
  const pair = detectPlay(hand('♦3', '♥3'))!;
  const bomb = detectPlay(hand('♠2', '♥2', '♦2', '♣2', '♠A'))!;

  assert.ok(!beats(bomb, single), 'a five-card hand beat a single');
  assert.ok(!beats(bomb, pair), 'a five-card hand beat a pair');
  assert.ok(!beats(single, pair), 'a single beat a pair');
  assert.ok(beats(bomb, null), 'nothing can be led');

  // legalPlays must respect the table size too.
  const holding = hand('♣3', '♦3', '♥3', '♠3', '♠A', '♥K', '♦Q');
  assert.ok(
    legalPlays(holding, single).every((p) => p.cards.length === 1),
    'legalPlays offered the wrong size against a single',
  );
  assert.ok(
    legalPlays(holding, null).some((p) => p.cards.length === 5),
    'legalPlays found no five-card lead',
  );
}

/** The ♣3 holder opens, and the opening play has to contain it. */
function expectOpeningRule(): void {
  for (const seedCode of seeds(20)) {
    const state = deal(seedCode, 'normal', rules());
    assert.ok(
      state.hands[state.turn].some((c) => c.id === LOWEST_CARD_ID),
      'the opener was not dealt the ♣3',
    );
    assert.ok(isOpeningPlay(state), 'a fresh deal is not an opening play');
    assert.ok(!canPass(state), 'the opener was allowed to pass');
    assert.ok(
      playsFor(state).every((p) => p.cards.some((c) => c.id === LOWEST_CARD_ID)),
      'an opening play without the ♣3 was offered',
    );
    assert.ok(playsFor(state).length > 0, 'the opener had no legal play');

    // Trying to open without it must be refused rather than silently accepted.
    const other = state.hands[state.turn].find((c) => c.id !== LOWEST_CARD_ID)!;
    assert.equal(play(state, [other]), state, 'an illegal opening play was accepted');
  }
}

/** Three passes hand the lead back to whoever played last. */
function expectTrickResolution(): void {
  let state = deal('trick-check', 'normal', rules());
  const opener = state.turn;
  state = play(state, playsFor(state)[0].cards);
  assert.equal(state.tableOwner, opener, 'the table owner was not recorded');

  for (let i = 0; i < SEATS - 1; i++) {
    assert.ok(canPass(state), 'a seat could not pass against a live table');
    state = pass(state);
  }

  assert.equal(state.turn, opener, 'the lead did not return to the last player');
  assert.equal(state.table, null, 'the table was not cleared for a new trick');
  assert.equal(state.passed.length, 0, 'the pass list was not cleared');
  assert.ok(!canPass(state), 'the new leader was allowed to pass');
}

/** The scoring ladder, including the deuce doubling. */
function expectScoring(): void {
  assert.equal(sizeMultiplier(1), 1);
  assert.equal(sizeMultiplier(7), 1);
  assert.equal(sizeMultiplier(8), 2);
  assert.equal(sizeMultiplier(9), 2);
  assert.equal(sizeMultiplier(10), 3);
  assert.equal(sizeMultiplier(12), 3);
  assert.equal(sizeMultiplier(13), 4);

  // Holding every card is 13 × 4, then doubled once per deuce — all four of
  // them here, so 52 × 16.
  const whole = scoreSeat(
    [...DECK.filter((c) => c.rank === 2), ...DECK.filter((c) => c.rank !== 2).slice(0, 9)],
    1,
  );
  assert.equal(whole.remaining, HAND_SIZE);
  assert.equal(whole.base, 52, 'a full hand is not worth 52 before doubling');
  assert.equal(whole.deuces, 4);
  assert.equal(whole.penalty, 52 * 16, 'four deuces did not multiply the penalty by sixteen');

  const clean = scoreSeat(DECK.filter((c) => c.rank === 5).slice(0, 3), 2);
  assert.equal(clean.penalty, 3, 'a small clean hand should just be its card count');

  const oneDeuce = scoreSeat([card('♠2'), card('♣5'), card('♦7')], 3);
  assert.equal(oneDeuce.penalty, 6, 'one deuce should double a three-card hand');

  const flat = scoreSeat(
    [...DECK.filter((c) => c.rank === 2), ...DECK.filter((c) => c.rank !== 2).slice(0, 9)],
    1,
    { sizeLadder: false, deuceDouble: false },
  );
  assert.equal(flat.penalty, HAND_SIZE, 'house rules off should score raw remaining cards');

  const noDeuceDouble = scoreSeat([card('♠2'), card('♣5'), card('♦7')], 3, {
    sizeLadder: true,
    deuceDouble: false,
  });
  assert.equal(noDeuceDouble.penalty, 3, 'deuce doubling off should not multiply');
}

/** Play whole games and check nothing illegal or non-terminating happens. */
function playOut(seedCode: string, difficulty: DifficultyId, straights: StraightRule): GameState {
  let state = deal(seedCode, difficulty, rules(straights));
  let guard = 0;

  while (state.phase === 'playing') {
    assert.ok(guard++ < 400, 'the game did not terminate');
    assert.equal(allCards(state).length + countPlayed(state), 52, 'a card went missing');

    const move = chooseMove(state);
    if (move === null) {
      assert.ok(canPass(state), 'a seat passed when passing was illegal');
      state = pass(state);
      continue;
    }

    assert.ok(
      move.cards.every((c) => state.hands[state.turn].some((held) => held.id === c.id)),
      'a seat played a card it does not hold',
    );
    const before = state.turn;
    const next = play(state, move.cards);
    assert.notEqual(next, state, 'a chosen move was rejected as illegal');
    assert.equal(
      next.hands[before].length,
      state.hands[before].length - move.cards.length,
      'the played cards did not leave the hand',
    );
    state = next;
  }

  return state;
}

function countPlayed(state: GameState): number {
  return state.log.reduce((total, entry) => total + (entry.play?.cards.length ?? 0), 0);
}

function expectGamesFinishCleanly(): void {
  for (const straights of RULE_SETS) {
    for (const difficulty of TIERS) {
      for (const seedCode of seeds(10)) {
        const end = playOut(seedCode, difficulty, straights);

        assert.equal(end.phase, 'over', 'the game did not end');
        assert.notEqual(end.winner, null, 'the game ended without a winner');
        assert.equal(end.hands[end.winner!].length, 0, 'the winner still holds cards');

        const result = outcome(end)!;
        assert.equal(result.scores.length, SEATS);
        assert.equal(result.scores[end.winner!].penalty, 0, 'the winner was penalised');
        assert.ok(result.pot > 0, 'the winner took nothing');
        for (const entry of result.scores) {
          if (entry.seat === end.winner) continue;
          assert.ok(entry.remaining > 0, 'a loser finished with an empty hand');
        }
      }
    }
  }
}

/** Same seed, same settings, same game. */
function expectDeterminism(): void {
  for (const seedCode of seeds(6)) {
    for (const difficulty of TIERS) {
      const a = playOut(seedCode, difficulty, 'topCard');
      const b = playOut(seedCode, difficulty, 'topCard');
      assert.deepEqual(
        a.log.map((e) => `${e.seat}:${e.play?.cards.map((c) => c.id).join('+') ?? 'pass'}`),
        b.log.map((e) => `${e.seat}:${e.play?.cards.map((c) => c.id).join('+') ?? 'pass'}`),
        'the same seed produced a different game',
      );
    }
  }

  assert.notDeepEqual(
    deal('seed-a', 'normal', rules()).hands[0].map((c) => c.id),
    deal('seed-b', 'normal', rules()).hands[0].map((c) => c.id),
    'different seeds dealt the same hand',
  );
}

/** The deal has to hand out all 52 cards, thirteen each, sorted. */
function expectDealIsSound(): void {
  for (const seedCode of seeds(20)) {
    const state = deal(seedCode, 'normal', rules());
    assert.equal(state.hands.length, SEATS);
    for (const held of state.hands) {
      assert.equal(held.length, HAND_SIZE);
      assert.deepEqual(held, sortCards(held), 'a hand was dealt out of order');
    }
    assert.equal(new Set(allCards(state).map((c) => c.id)).size, 52, 'the deal lost a card');
  }
}

/**
 * The count that decides Big Two: how many turns a hand needs to empty.
 *
 * Thirteen singles is thirteen turns; a hand that cuts into two five-card
 * hands, a pair and a single is four.
 */
function expectTurnsToEmpty(): void {
  const singles = hand('♣3', '♦5', '♥7', '♠9', '♣J');
  assert.equal(turnsToEmpty(singles), 5, 'five unconnected cards should take five turns');

  const onePair = hand('♣3', '♦3', '♥7');
  assert.equal(turnsToEmpty(onePair), 2, 'a pair plus a single should take two turns');

  const run = hand('♣3', '♦4', '♥5', '♠6', '♣7');
  assert.equal(turnsToEmpty(run), 1, 'a straight should take one turn');

  const mixed = hand('♣3', '♦4', '♥5', '♠6', '♣7', '♦9', '♥9', '♠K');
  assert.equal(turnsToEmpty(mixed), 3, 'a run, a pair and a single should take three turns');

  assert.equal(turnsToEmpty([]), 0, 'an empty hand needs no turns');
}

/** The three tiers have to be three different players. */
function expectDifficultiesDiffer(): void {
  assert.equal(DIFFICULTIES.length, 3, 'there are not three difficulties');
  assert.equal(new Set(DIFFICULTIES.map((d) => d.id)).size, 3, 'two difficulties share an id');
  assert.equal(new Set(DIFFICULTIES.map((d) => d.blurb)).size, 3, 'two difficulties share a blurb');
  for (const info of DIFFICULTIES) {
    assert.ok(info.blurb.trim().length > 0, `${info.id} has an empty blurb`);
  }
  assert.ok(EASY_PASS_RATE > 0.2 && EASY_PASS_RATE < 0.5, 'easy pass rate drifted out of a soft-tier band');

  const logs = TIERS.map((difficulty) =>
    playOut('tier-check', difficulty, 'topCard')
      .log.map((e) => `${e.seat}:${e.play?.cards.map((c) => c.id).join('+') ?? 'pass'}`)
      .join('|'),
  );
  assert.equal(new Set(logs).size, 3, 'two difficulties played an identical game');
}

/**
 * The three tiers must be ORDERED, not merely distinguishable.
 *
 * expectDifficultiesDiffer above asserts the three brains produce different
 * move logs on one seed. Three equally strong brains pass that trivially — it
 * separates "these are not the same code path" from nothing at all, and says
 * nothing about which one wins. This repo has already shipped a game whose
 * three difficulty settings were measurably two, guarded by a check of exactly
 * that shape.
 *
 * So: seat each tier against a field of the tier below it and require it to win
 * more, with the interval on the DIFFERENCE clearing zero. The difference is
 * the right quantity — checking whether the two per-cell intervals overlap is a
 * strictly more conservative test and calls real effects absent. Measured here,
 * hard against a normal field is 34.0% vs normal's 27.5%: those two intervals
 * overlap, while their difference is 6.5pp [0.1, 12.9].
 *
 * DEALS is set from that measurement rather than picked. The weakest of the six
 * comparisons is hard-over-normal against a normal field; at 400 deals it sits
 * at 2.0 SE (a coin-flip away from flaking), at 1,600 it firms to 7.2pp
 * [4.1, 10.4]. 1,000 puts it near 3.5 SE, which is enough margin for a check
 * that must not flake while staying quick.
 */
function expectDifficultiesAreOrdered(): void {
  const DEALS = 1000;

  const winRate = (subject: DifficultyId, field: DifficultyId): number => {
    let wins = 0;
    let counted = 0;
    for (let i = 0; i < DEALS; i++) {
      const brains: DifficultyId[] = [subject, field, field, field];
      let state = deal(`order-${i}`, subject, rules('topCard'));
      let guard = 0;
      while (state.phase === 'playing' && guard++ < 400) {
        const move = chooseMove({ ...state, difficulty: brains[state.turn] });
        if (move === null) {
          assert.ok(canPass(state), 'a seat declined to move when passing was illegal');
          state = pass(state);
          continue;
        }
        state = play(state, move.cards);
      }
      const end = outcome(state);
      // Never divide by DEALS regardless of how many deals actually resolved;
      // an unfinished deal would otherwise drag the rate down silently.
      if (!end) continue;
      counted += 1;
      if (end.winner === 0) wins += 1;
    }
    assert.ok(counted > DEALS * 0.99, `${DEALS - counted} of ${DEALS} deals never reached an outcome`);
    return wins / counted;
  };

  for (const [stronger, weaker] of [
    ['hard', 'normal'],
    ['normal', 'easy'],
  ] as const) {
    const field: DifficultyId = weaker;
    const pa = winRate(stronger, field);
    const pb = winRate(weaker, field);
    const se = Math.sqrt((pa * (1 - pa)) / DEALS + (pb * (1 - pb)) / DEALS);
    const diff = (pa - pb) * 100;
    const halfWidth = 1.96 * se * 100;
    assert.ok(
      diff - halfWidth > 0,
      `against a ${field} field, '${stronger}' won ${(pa * 100).toFixed(1)}% against '${weaker}' at ${(pb * 100).toFixed(1)}% — a difference of ${diff.toFixed(1)}pp with a 95% interval of [${(diff - halfWidth).toFixed(1)}, ${(diff + halfWidth).toFixed(1)}], which does not clear zero. The tiers are distinguishable but not ordered: picking a harder setting does not measurably make the opponents better.`,
    );
  }
}

/** Streaks reset on a loss; chips accumulate both ways. */
function expectStatsTracking(): void {
  let stats = EMPTY_STATS;
  stats = recordHandResult(stats, true, 40);
  stats = recordHandResult(stats, true, 22);
  assert.equal(stats.streak, 2);
  assert.equal(stats.bestStreak, 2);
  assert.equal(stats.chips, 62);
  assert.equal(stats.bestPot, 40, 'the best pot did not keep the larger win');

  stats = recordHandResult(stats, false, -18);
  assert.equal(stats.streak, 0, 'a loss did not reset the streak');
  assert.equal(stats.bestStreak, 2, 'the best streak was lost');
  assert.equal(stats.chips, 44);
  assert.equal(stats.games, 3);
  assert.equal(stats.wins, 2);

  stats = recordMatchResult(stats, true, 55);
  stats = recordMatchResult(stats, false, -10);
  assert.equal(stats.matches, 2);
  assert.equal(stats.matchWins, 1);
  assert.equal(stats.matchStreak, 0);
  assert.equal(stats.bestMatchStreak, 1);
  assert.equal(stats.bestMatchChips, 55);
}

/** Series: fixed hands and race-to-target both end with a winner. */
function expectMatchSeries(): void {
  const handsMatch = createMatch({
    mode: 'hands',
    hands: 4,
    target: 100,
    difficulty: 'normal',
    rules: rules(),
    seedCode: 'series-a',
  });
  assert.equal(handsMatch.phase, 'playing');
  assert.equal(handSeed('series-a', 0) !== handSeed('series-a', 1), true, 'hands must diverge');

  let state = dealHand(handsMatch);
  let guard = 0;
  while (state.phase === 'playing' && guard++ < 400) {
    const move = chooseMove(state);
    state = move === null ? pass(state) : play(state, move.cards);
  }
  const end1 = outcome(state);
  assert.ok(end1, 'first hand did not finish');
  const deltas = handDeltas(end1!);
  assert.equal(
    deltas.reduce((a, b) => a + b, 0),
    0,
    'hand chip deltas must sum to zero',
  );
  const after1 = applyHandResult(handsMatch, end1!, state.seedCode);
  assert.equal(after1.phase, 'handOver', 'four-hand match should not end after hand 1');
  assert.equal(after1.handIndex, 1);

  // Force the series boundary: after N hands the highest balance wins.
  const forced = decideMatchWinner(handsMatch.config, [12, 4, -8, -8], 4);
  assert.equal(forced, HUMAN);

  let short = createMatch({
    ...handsMatch.config,
    seedCode: 'series-short',
  });
  // Simulate completing exactly `hands` results via applyHandResult in a loop.
  for (let i = 0; i < 4; i++) {
    let dealState = dealHand({ ...short, phase: 'playing', handIndex: i });
    guard = 0;
    while (dealState.phase === 'playing' && guard++ < 400) {
      const move = chooseMove(dealState);
      dealState = move === null ? pass(dealState) : play(dealState, move.cards);
    }
    const end = outcome(dealState);
    assert.ok(end, `hand ${i} did not finish`);
    short = applyHandResult(
      { ...short, phase: 'playing', handIndex: i },
      end!,
      dealState.seedCode,
    );
  }
  assert.equal(short.phase, 'matchOver');
  assert.ok(short.winner !== null);

  // Target mode: artificially push seat 0 over the line.
  const targetWinner = decideMatchWinner(
    { ...handsMatch.config, mode: 'target', target: 50 },
    [50, 10, -20, -40],
    1,
  );
  assert.equal(targetWinner, HUMAN, 'first to target should win');
  assert.equal(
    decideMatchWinner(
      { ...handsMatch.config, mode: 'target', target: 50 },
      [40, 10, -20, -30],
      1,
    ),
    null,
    'below target must continue',
  );
}

/** Three named personalities, one per CPU seat. */
function expectPersonalities(): void {
  assert.equal(PERSONALITIES.length, 3);
  assert.equal(new Set(PERSONALITIES.map((p) => p.id)).size, 3);
  assert.equal(personalityForSeat(0), null);
  assert.equal(personalityForSeat(1)?.id, SEAT_PERSONALITIES[1]);
  assert.equal(personalityForSeat(2)?.id, SEAT_PERSONALITIES[2]);
  assert.equal(personalityForSeat(3)?.id, SEAT_PERSONALITIES[3]);
  assert.equal(
    new Set([SEAT_PERSONALITIES[1], SEAT_PERSONALITIES[2], SEAT_PERSONALITIES[3]]).size,
    3,
    'the three CPU seats must not share a personality',
  );
}

/** Hints always return a reason, and match a legal hard-policy move. */
function expectTeachingHints(): void {
  for (const seed of seeds(20)) {
    let state = deal(seed, 'normal', rules());
    // Advance until the human can act with a table to answer, or just advise openers.
    let guard = 0;
    while (state.phase === 'playing' && state.turn !== HUMAN && guard++ < 40) {
      const move = chooseMove(state);
      state = move === null ? pass(state) : play(state, move.cards);
    }
    if (state.phase !== 'playing' || state.turn !== HUMAN) continue;
    const advice = advise(state);
    assert.ok(advice.reason.trim().length > 0, 'hint reason must not be empty');
    if (advice.play === null) {
      assert.ok(canPass(state) || playsFor(state).length === 0);
    } else {
      const legal = playsFor(state);
      assert.ok(
        legal.some(
          (option) =>
            option.cards.length === advice.play!.cards.length &&
            option.cards.every((c) => advice.play!.cards.some((x) => x.id === c.id)),
        ),
        'hint suggested an illegal play',
      );
    }
  }
}

/** Card memory shrinks exactly with the log. */
function expectCardMemory(): void {
  let state = deal('memory-seed', 'hard', rules());
  assert.equal(remainingCards(state).length, 52);
  const open = playsFor(state)[0];
  state = play(state, open.cards);
  assert.equal(remainingCards(state).length, 52 - open.cards.length);
}

/** Hand review always yields at least one lesson. */
function expectHandReview(): void {
  const state = playOut('review-seed', 'normal', 'topCard');
  const end = outcome(state);
  assert.ok(end);
  const review = buildHandReview(state, end!);
  assert.ok(review.lessons.length >= 1);
  assert.ok(review.highlight.length > 0);
}

/** Taipei daily seed is stable for a calendar day and drives a 5-hand table. */
function expectDailyTable(): void {
  const key = taipeiDateKey(new Date(Date.UTC(2026, 9, 22, 4, 0, 0))); // 12:00 Taipei
  assert.equal(key, '2026-10-22');
  // Same UTC instant just before Taipei midnight still belongs to the prior day.
  const late = taipeiDateKey(new Date(Date.UTC(2026, 9, 21, 15, 30, 0))); // 23:30 Taipei Oct 21
  assert.equal(late, '2026-10-21');
  const seedA = dailySeedCode(key);
  const seedB = dailySeedCode(key);
  assert.equal(seedA, seedB);
  assert.equal(seedA, 'b2-daily-2026-10-22');
  assert.notEqual(dailySeedCode('2026-10-21'), seedA);

  const config = dailyMatchConfig(key);
  assert.equal(config.mode, 'daily');
  assert.equal(config.seedCode, seedA);
  assert.equal(DAILY_HANDS, 5);

  let match = createMatch(config);
  assert.equal(decideMatchWinner(match.config, [10, -5, -3, -2], 4), null);
  assert.equal(decideMatchWinner(match.config, [10, -5, -3, -2], 5), HUMAN);

  // Deterministic first deal across two createMatch calls.
  const a = dealHand(createMatch(config));
  const b = dealHand(createMatch(config));
  assert.deepEqual(
    a.hands[0].map((c) => c.id),
    b.hands[0].map((c) => c.id),
  );

  const streak = computeDailyStreak(
    [
      { date: '2026-10-20', bestChips: 5, completed: true, attempts: 1 },
      { date: '2026-10-21', bestChips: 12, completed: true, attempts: 1 },
      { date: '2026-10-22', bestChips: 8, completed: true, attempts: 1 },
    ],
    '2026-10-22',
  );
  assert.equal(streak, 3);
  assert.equal(
    computeDailyStreak(
      [{ date: '2026-10-20', bestChips: 1, completed: true, attempts: 1 }],
      '2026-10-22',
    ),
    0,
  );

  let daily = recordDailyResult({ records: [] }, key, 20, true);
  daily = recordDailyResult(daily, key, 12, true);
  assert.equal(daily.records[0].bestChips, 20);
  assert.equal(daily.records[0].attempts, 2);

  const share = buildDailyShareText({
    date: key,
    seedCode: seedA,
    chips: 20,
    bestChips: 20,
    streak: 3,
    completed: true,
  });
  assert.ok(share.includes('每日牌桌'));
  assert.ok(share.includes(seedA));
  assert.ok(share.includes('連續 3 天'));

  const finished = playOut(seedA, 'normal', 'topCard');
  const handResult = outcome(finished);
  assert.ok(handResult);
  match = applyHandResult(match, handResult!, seedA, finished);
  assert.equal(match.history.length, 1);
  assert.equal(match.phase, 'handOver');
}

/** Single-hand mode settles after one result and records format.single. */
function expectSingleModeAndFormats(): void {
  assert.equal(isSeriesMode('single'), false);
  assert.equal(isSeriesMode('hands'), true);
  assert.equal(isSeriesMode('daily'), true);
  assert.equal(
    formatKeyFor({
      mode: 'single',
      hands: 4,
      target: 100,
      difficulty: 'normal',
      rules: rules(),
      seedCode: 'x',
    }),
    'single',
  );
  assert.equal(
    formatKeyFor({
      mode: 'daily',
      hands: 4,
      target: 100,
      difficulty: 'normal',
      rules: rules(),
      seedCode: 'x',
    }),
    'daily',
  );

  const one = createMatch({
    mode: 'single',
    hands: 4,
    target: 100,
    difficulty: 'normal',
    rules: rules(),
    seedCode: 'solo-check',
  });
  const end = playOut('solo-check', 'normal', 'topCard');
  const result = outcome(end)!;
  const finished = applyHandResult(one, result, end.seedCode, end);
  assert.equal(finished.phase, 'matchOver');
  assert.equal(finished.history.length, 1);
  assert.ok(finished.history[0].bombs.length === SEATS);
  assert.ok(finished.history[0].winnerPlayCount >= 1);

  let stats = EMPTY_STATS;
  stats = recordMatchResult(stats, finished.winner === HUMAN, finished.balances[HUMAN], finished.config);
  assert.equal(stats.formats.single.played, 1);
  assert.equal(stats.matches, 0, 'single must not inflate series match count');
}

/** MVP picks fastest empty, most bombs, and biggest comeback. */
function expectMatchMvp(): void {
  const score = (seat: number, penalty: number): SeatScore => ({
    seat,
    remaining: penalty,
    base: penalty,
    deuces: 0,
    penalty,
  });
  const hand = (
    index: number,
    winner: number,
    deltas: number[],
    bombs: number[],
    winnerPlayCount: number,
  ): HandRecord => ({
    handIndex: index,
    seedCode: `h${index}`,
    winner,
    scores: deltas.map((d, seat) => score(seat, d < 0 ? -d : 0)),
    pot: deltas[winner],
    deltas,
    bombs,
    winnerPlayCount,
  });

  const match: MatchState = {
    config: {
      mode: 'hands',
      hands: 4,
      target: 100,
      difficulty: 'normal',
      rules: rules(),
      seedCode: 'mvp',
    },
    handIndex: 3,
    balances: [30, -10, -15, -5],
    history: [
      hand(0, 1, [-20, 40, -10, -10], [0, 2, 0, 0], 6),
      hand(1, 0, [50, -20, -15, -15], [1, 0, 0, 0], 4),
      hand(2, 0, [0, -30, 10, 20], [0, 0, 1, 0], 5),
    ],
    phase: 'matchOver',
    winner: 0,
  };

  const mvp = computeMatchMvp(match);
  assert.ok(mvp);
  assert.equal(mvp!.fastestSeat, 0, 'human finished in 4 plays');
  assert.equal(mvp!.fastestPlays, 4);
  assert.equal(mvp!.mostBombsSeat, 1);
  assert.equal(mvp!.mostBombsCount, 2);
  assert.equal(mvp!.chipLeaderSeat, 0);
  assert.ok(mvp!.biggestComebackDelta >= 0);

  const extras = handExtras(playOut('mvp-live', 'normal', 'topCard'), 0);
  assert.equal(extras.bombs.length, SEATS);
  assert.ok(extras.winnerPlayCount >= 0);
}

/** Named ladder: 5 foes, unlock frontier, seat colouring. */
function expectNamedOpponentLadder(): void {
  assert.ok(opponentCount() >= 4 && opponentCount() <= 6);
  assert.equal(NAMED_OPPONENTS.length, opponentCount());
  assert.equal(new Set(NAMED_OPPONENTS.map((o) => o.id)).size, opponentCount());
  assert.ok(isOpponentUnlocked(0, 0));
  assert.ok(!isOpponentUnlocked(1, 0));
  assert.ok(isOpponentUnlocked(1, 1));

  const first = NAMED_OPPONENTS[0];
  let progress = applyLadderResult(
    { clearedCount: 0, cleared: {}, lastIndex: 0 },
    0,
    true,
    first.id,
  );
  assert.equal(progress.clearedCount, 1);
  assert.equal(progress.cleared[first.id], true);
  assert.ok(isOpponentUnlocked(1, progress.clearedCount));

  // Losing the frontier must not unlock the next.
  progress = applyLadderResult(progress, 1, false, NAMED_OPPONENTS[1].id);
  assert.equal(progress.clearedCount, 1);

  const seats = ladderSeatPersonalities(opponentById('zhen')!);
  assert.equal(seats[1], 'counter');
  assert.ok(seats[2]);
  assert.ok(seats[3]);
}

/** Bounded scripted turns exercise replay and state contracts without AI search. */
function expectQuickStateContracts(): void {
  const replay = (): GameState => {
    let state = deal('quick-replay', 'normal', rules());
    for (let turn = 0; turn < 12 && state.phase === 'playing'; turn++) {
      const before = JSON.stringify(state);
      const options = playsFor(state);
      const move = options[0];
      const next = move ? play(state, move.cards) : pass(state);
      assert.notEqual(next, state, 'a legal scripted action must advance the state');
      assert.equal(JSON.stringify(state), before, 'actions must not mutate prior states');
      assert.equal(allCards(next).length + countPlayed(next), 52, 'a scripted action lost a card');
      assert.equal(new Set(allCards(next).map((c) => c.id)).size, allCards(next).length);
      state = next;
    }
    return state;
  };
  assert.deepEqual(replay(), replay(), 'same seed and scripted actions must reproduce the state');
  assert.notDeepEqual(deal('quick-a', 'normal').hands, deal('quick-b', 'normal').hands);

  const config = dailyMatchConfig('2026-10-22');
  assert.equal(config.seedCode, dailySeedCode('2026-10-22'));
  assert.equal(config.mode, 'daily');
  assert.equal(DAILY_HANDS, 5);
  assert.deepEqual(dealHand(createMatch(config)), dealHand(createMatch(config)));
  assert.equal(decideMatchWinner(config, [10, -5, -3, -2], DAILY_HANDS - 1), null);
  assert.equal(decideMatchWinner(config, [10, -5, -3, -2], DAILY_HANDS), HUMAN);
  const score = (seat: number): SeatScore => ({ seat, remaining: 1, base: 1, deuces: 0, penalty: 1 });
  const result = { winner: HUMAN, scores: [{ ...score(HUMAN), remaining: 0, base: 0, penalty: 0 }, score(1), score(2), score(3)], pot: 3 };
  assert.equal(handDeltas(result).reduce((a, b) => a + b, 0), 0);
  const match = applyHandResult(createMatch(config), result, config.seedCode);
  assert.equal(match.phase, 'handOver');
  assert.equal(match.handIndex, 1);
  assert.equal(match.history.length, 1);
  assert.equal(taipeiDateKey(new Date('2026-10-21T16:00:00Z')), '2026-10-22');
  let daily = recordDailyResult({ records: [] }, '2026-10-22', 20, true);
  daily = recordDailyResult(daily, '2026-10-22', 12, true);
  assert.equal(daily.records[0].bestChips, 20);
  assert.equal(daily.records[0].attempts, 2);
  const streak = computeDailyStreak(daily.records, '2026-10-22');
  assert.equal(streak, 1);
  assert.ok(buildDailyShareText({ date: '2026-10-22', seedCode: config.seedCode,
    chips: 12, bestChips: 20, streak, completed: true }).includes(config.seedCode));
  const single = applyHandResult(createMatch({ ...config, mode: 'single' }), result, config.seedCode);
  assert.equal(single.phase, 'matchOver');
  const stats = recordMatchResult(EMPTY_STATS, true, single.balances[HUMAN], single.config);
  assert.equal(stats.formats.single.played, 1);
  assert.equal(stats.matches, 0, 'single results must not inflate series totals');
}

const CHECKS: [string, () => void][] = [
  ['card order (2 is highest)', expectCardOrder],
  ['play detection', expectPlayDetection],
  ['five-card type order', expectFiveCardTypeOrder],
  ['both straight conventions', expectStraightConventions],
  ['comparison is a total order', expectTotalOrder],
  ['size must match', expectSizeMustMatch],
  ['the ♣3 opens', expectOpeningRule],
  ['trick resolution', expectTrickResolution],
  ['scoring ladder and deuces', expectScoring],
  ['deal is sound', expectDealIsSound],
  ['games finish cleanly', expectGamesFinishCleanly],
  ['determinism', expectDeterminism],
  ['turns to empty', expectTurnsToEmpty],
  ['difficulties differ', expectDifficultiesDiffer],
  ['difficulties are ordered, not just different', expectDifficultiesAreOrdered],
  ['stats tracking', expectStatsTracking],
  ['match series structure', expectMatchSeries],
  ['cpu personalities', expectPersonalities],
  ['teaching hints', expectTeachingHints],
  ['card memory', expectCardMemory],
  ['hand review', expectHandReview],
  ['daily table (Taipei seed)', expectDailyTable],
  ['single mode and format stats', expectSingleModeAndFormats],
  ['match MVP stats', expectMatchMvp],
  ['named opponent ladder', expectNamedOpponentLadder],
];

const QUICK_CORE = new Set([
  expectCardOrder, expectPlayDetection, expectFiveCardTypeOrder, expectStraightConventions,
  expectSizeMustMatch, expectOpeningRule, expectTrickResolution, expectScoring,
  expectDealIsSound, expectTurnsToEmpty, expectStatsTracking, expectPersonalities,
  expectCardMemory, expectNamedOpponentLadder,
]);
const selectedChecks: [string, () => void][] = TEST_PROFILE === 'quick'
  ? [...CHECKS.filter(([, check]) => QUICK_CORE.has(check)), ['bounded replay and match contracts', expectQuickStateContracts]]
  : CHECKS;
if (TEST_PROFILE === 'quick') {
  for (const [name] of CHECKS.filter(([, check]) => !QUICK_CORE.has(check))) {
    console.log(`  DEFERRED (full profile): ${name}`);
  }
}

let failed = 0;
for (const [name, check] of selectedChecks) {
  try {
    check();
    console.log(`  ok   ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`  FAIL ${name}: ${(error as Error).message}`);
  }
}

console.log(`\ncheck-big-two: ${selectedChecks.length - failed}/${selectedChecks.length} passed (${TEST_PROFILE} profile)`);
if (failed > 0) process.exit(1);

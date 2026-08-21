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
import { DIFFICULTIES, chooseMove, turnsToEmpty } from '../src/game/cpu.js';
import { EMPTY_STATS, recordResult } from '../src/game/storage.js';
import { createRng } from '../src/game/rng.js';
import { HAND_SIZE, SEATS } from '../src/game/types.js';
import type { Card, DifficultyId, GameState, Play, Rules, StraightRule } from '../src/game/types.js';

const TIERS: DifficultyId[] = ['easy', 'normal', 'hard'];
const RULE_SETS: StraightRule[] = ['topCard', 'sequence'];

function rules(straights: StraightRule = 'topCard'): Rules {
  return { straights };
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
  stats = recordResult(stats, true, 40);
  stats = recordResult(stats, true, 22);
  assert.equal(stats.streak, 2);
  assert.equal(stats.bestStreak, 2);
  assert.equal(stats.chips, 62);
  assert.equal(stats.bestPot, 40, 'the best pot did not keep the larger win');

  stats = recordResult(stats, false, -18);
  assert.equal(stats.streak, 0, 'a loss did not reset the streak');
  assert.equal(stats.bestStreak, 2, 'the best streak was lost');
  assert.equal(stats.chips, 44);
  assert.equal(stats.games, 3);
  assert.equal(stats.wins, 2);
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

console.log(`\ncheck-big-two: ${CHECKS.length - failed}/${CHECKS.length} passed`);
if (failed > 0) process.exit(1);

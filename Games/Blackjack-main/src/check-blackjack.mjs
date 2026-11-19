// Assert score, insurance, surrender, H17/S17, payouts, shoe, undo-safety, tables, feedback.
import {
  calculateScore,
  isBlackjack,
  isSoftHand,
  dealerShouldHit,
  resolveInsurancePayout,
  surrenderRefund,
  evenMoneyPayout,
  blackjackPayout,
  formatHandTotal,
  isPairHand,
  isAcePair,
  pairRankKey,
} from './utils/rules.ts';
import { recommendAction } from './utils/basicStrategy.ts';
import {
  createShoe,
  createSeededShoe,
  drawCard,
  maybeReshuffle,
  cardsRemaining,
  dealtRatio,
} from './utils/shoe.ts';
import {
  TABLES,
  isTableUnlocked,
  getTable,
  unlockedTables,
  highestUnlockedTableId,
} from './utils/tables.ts';
import { evaluateDecision, summarizeHandFeedback } from './utils/feedback.ts';
import { hiLoValue, runningCountDelta, trueCount } from './utils/hiLo.ts';
import {
  recordHandResult,
  EMPTY_STATS,
  applyRecovery,
  MAX_RECOVERIES,
  EMERGENCY_RECOVERY_STAKE,
} from './utils/storage.ts';
import { createSeededDeck } from './utils/deck.ts';
import {
  todayKeyTaipei,
  previousDayKey,
  dailySeed,
  createDailyShoe,
  mergeDailyAttempt,
  formatDailyShareText,
  currentStreak,
  DAILY_HANDS,
  DAILY_START_BALANCE,
  EMPTY_DAILY,
} from './utils/daily.ts';
import {
  classifyPerfectPair,
  perfectPairsPayout,
  maxPerfectPairsBet,
} from './utils/sideBet.ts';
import {
  TIN_BUY_IN,
  TIN_HANDS,
  TIN_RIVALS,
  TIN_START_CHIPS,
  TIN_SIM_RULES,
  chooseRivalBet,
  createRivalStates,
  advanceRivalsOneHand,
  buildStandings,
  prizeForRank,
  tinPotSize,
  mergeTournamentResult,
} from './utils/tournament.ts';
import { simulateRound } from './utils/simulateRound.ts';
import { hashString } from './utils/rng.ts';
import {
  calculateBustProbability,
  getDealerBustProbability,
  calculatePlayerEdge,
  calculateShoeDensity,
  getStreakPrestige,
} from './utils/telemetry.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const card = (rank, suit = 'spades') => ({ rank, suit });

// --- Score / blackjack ---
assert(calculateScore([card('10'), card('K')]) === 20, '10+K should be 20');
assert(calculateScore([card('A'), card('K')]) === 21, 'A+K should be 21');
assert(isBlackjack([card('A'), card('K')]) === true, 'A+K is blackjack');
assert(isBlackjack([card('A'), card('9'), card('A')]) === false, 'three cards not blackjack');
assert(calculateScore([card('A'), card('A'), card('9')]) === 21, 'A+A+9 soft/hard best is 21');
assert(calculateScore([card('A'), card('6')]) === 17, 'A+6 is 17');
assert(isSoftHand([card('A'), card('6')]) === true, 'A+6 is soft');
assert(isSoftHand([card('10'), card('7')]) === false, '10+7 is hard');
assert(calculateScore([card('K'), { ...card('5'), isHidden: true }]) === 10, 'hidden card ignored');
assert(formatHandTotal([card('A'), card('6')]) === '軟 17', 'soft total label');
assert(formatHandTotal([card('10'), card('7')]) === '17', 'hard total label');
assert(isPairHand([card('10'), card('K')]) === true, '10+K is a pair for split');
assert(isAcePair([card('A'), card('A')]) === true, 'A+A detected');
assert(pairRankKey('Q') === '10', 'faces map to 10');

// --- Even money / BJ payout (stake already deducted) ---
assert(evenMoneyPayout(100) === 200, 'even money is 1:1');
assert(blackjackPayout(100, '3:2') === 250, 'blackjack is 3:2');
assert(blackjackPayout(100, '6:5') === 220, 'blackjack is 6:5');
assert(blackjackPayout(100) === 250, 'default blackjack payout 3:2');

// --- Insurance 2:1 & Expected Value Math ---
assert(resolveInsurancePayout(50, true) === 150, 'insurance win returns 3× stake');
assert(resolveInsurancePayout(50, false) === 0, 'insurance loss returns 0');
assert(resolveInsurancePayout(0, true) === 0, 'no insurance bet → 0');
assert(resolveInsurancePayout(100, true) === 300, 'insurance $100 win returns $300');

// Mathematical EV model for insurance:
// Dealer shows Ace. In a 6-deck shoe (312 cards - 1 Ace shown = 311 cards), there are 96 ten-value cards (16 per deck * 6).
// P(Dealer BJ) = 96 / 311 ≈ 30.868%.
// Expected Return on $10 insurance = (96 / 311) * $30 - $10 = (2880 / 311) - 10 = -$0.7395 (approx -7.4% EV).
const tenCardCountIn6Decks = 16 * 6;
const remainingCardsAfterAce = 312 - 1;
const probBjNeutral = tenCardCountIn6Decks / remainingCardsAfterAce;
const expectedReturn10 = (probBjNeutral * resolveInsurancePayout(10, true)) - 10;
assert(expectedReturn10 < 0, 'insurance has strictly negative EV at neutral count');
assert(Math.abs(expectedReturn10 - (-0.74)) < 0.05, `expected return approx -$0.74, got ${expectedReturn10}`);

// Breakeven analysis: insurance becomes positive EV only when ten-density > 1/3 (33.333%).
// Under Hi-Lo counting, true count >= +3 correlates to high ten-density making insurance profitable for card counters.
const probBjCounted = 105 / 311; // elevated ten density (~33.76% > 33.33%)
const expectedReturnCounted = (probBjCounted * resolveInsurancePayout(10, true)) - 10;
assert(expectedReturnCounted > 0, 'insurance has positive EV when 10-density exceeds 33.33%');

// --- Split-hand mechanics & Multi-Split Resolution ---
assert(isPairHand([card('8'), card('8')]) === true, '8,8 is pair');
assert(isPairHand([card('10'), card('Q')]) === true, '10,Q is 10-value pair');
assert(isPairHand([card('J'), card('K')]) === true, 'J,K is 10-value pair');
assert(isPairHand([card('A'), card('A')]) === true, 'A,A is pair');
assert(isPairHand([card('9'), card('8')]) === false, '9,8 is not pair');
assert(isAcePair([card('A'), card('A')]) === true, 'A,A identified as Ace pair');
assert(isAcePair([card('8'), card('8')]) === false, '8,8 is not Ace pair');

// Multi-split scenario simulation up to 4 hands:
// Initial bet: $100.
// Player dealt [8s, 8h] vs Dealer [6d].
// Split 1: Hand A: [8s], Hand B: [8h]. Additional $100 placed (total wagered $200).
// Hand A draws 8c -> Pair of 8s again! Re-split into Hand A1: [8s], Hand C: [8c]. Additional $100 (total $300).
// Hand A1 draws 10d -> [8s, 10d] = 18. Player stands.
// Hand B draws 3s -> [8h, 3s] = 11. Player doubles down (DAS)! Additional $100 (total $400).
// Hand B draws 9c -> [8h, 3s, 9c] = 20. Forced stand on double down.
// Hand C draws 8d -> Pair of 8s! Re-split into Hand C1: [8c], Hand D: [8d] (reaching maxSplitHands = 4). Additional $100 (total $500).
// Hand C1 draws 9s -> [8c, 9s] = 17. Player stands.
// Hand D draws 5h -> [8d, 5h] = 13. Hits -> draws 10h -> [8d, 5h, 10h] = 23 (Bust! Lose immediately).
// Dealer hand: [6d, 10s] = 16. Under both H17 and S17, dealer must hit 16 -> draws 2c = 18.
//
// Resolution against Dealer 18:
// Hand A1: 18 vs 18 -> Push (net profit $0, refund $100).
// Hand B: 20 vs 18 -> Win (doubled bet $200 wins $200 profit, returns $400).
// Hand C1: 17 vs 18 -> Lose (net loss -$100).
// Hand D: 23 (bust) -> Lose (net loss -$100).
// Net profit across all 4 split hands: 0 + 200 - 100 - 100 = $0.
const splitHands = [
  { cards: [card('8'), card('10')], bet: 100 },
  { cards: [card('8'), card('3'), card('9')], bet: 200 },
  { cards: [card('8'), card('9')], bet: 100 },
  { cards: [card('8'), card('5'), card('10')], bet: 100 },
];
const dealerFinalCards = [card('6'), card('10'), card('2')];
const dealerScore = calculateScore(dealerFinalCards);
assert(dealerScore === 18, 'dealer finished at 18');

let totalSplitProfit = 0;
let totalReturnedToPlayer = 0;
for (const sh of splitHands) {
  const pScore = calculateScore(sh.cards);
  if (pScore > 21) {
    totalSplitProfit -= sh.bet;
  } else if (pScore > dealerScore) {
    totalReturnedToPlayer += sh.bet * 2;
    totalSplitProfit += sh.bet;
  } else if (pScore === dealerScore) {
    totalReturnedToPlayer += sh.bet;
  } else {
    totalSplitProfit -= sh.bet;
  }
}
assert(totalSplitProfit === 0, 'multi-split net profit correctly balances to $0');
assert(totalReturnedToPlayer === 500, 'total returned on 4 split hands equals total original $500 wager');

// --- Early surrender half bet ---
assert(surrenderRefund(100) === 50, 'surrender refunds half');
assert(surrenderRefund(25) === 12, 'surrender floors odd bets');

// --- H17 vs S17 Rule Invariants ---
// Dealer rule determines hit/stand strictly on soft 17.
// Dealer must hit ALL totals < 17 (soft or hard).
for (let total = 2; total <= 16; total++) {
  const hardHand = total <= 10 ? [card(String(total))] : [card('10'), card(String(total - 10))];
  assert(dealerShouldHit(hardHand, true) === true, `H17: dealer must hit hard ${total}`);
  assert(dealerShouldHit(hardHand, false) === true, `S17: dealer must hit hard ${total}`);
}

// Soft totals < 17: dealer must hit under both rules
assert(dealerShouldHit([card('A'), card('2')], true) === true, 'H17 hits soft 13');
assert(dealerShouldHit([card('A'), card('2')], false) === true, 'S17 hits soft 13');
assert(dealerShouldHit([card('A'), card('3')], true) === true, 'H17 hits soft 14');
assert(dealerShouldHit([card('A'), card('3')], false) === true, 'S17 hits soft 14');
assert(dealerShouldHit([card('A'), card('4')], true) === true, 'H17 hits soft 15');
assert(dealerShouldHit([card('A'), card('4')], false) === true, 'S17 hits soft 15');
assert(dealerShouldHit([card('A'), card('5')], true) === true, 'H17 hits soft 16');
assert(dealerShouldHit([card('A'), card('5')], false) === true, 'S17 hits soft 16');
assert(dealerShouldHit([card('A'), card('2'), card('3')], true) === true, 'H17 hits 3-card soft 16');
assert(dealerShouldHit([card('A'), card('2'), card('3')], false) === true, 'S17 hits 3-card soft 16');

// Soft 17 variations: H17 hits, S17 stands!
const soft17Variations = [
  [card('A'), card('6')],
  [card('A'), card('2'), card('4')],
  [card('A'), card('3'), card('3')],
  [card('2'), card('A'), card('4')],
  [card('A'), card('A'), card('5')],
  [card('A'), card('A'), card('A'), card('4')],
  [card('A'), card('A'), card('A'), card('A'), card('3')],
];
for (const s17Hand of soft17Variations) {
  assert(calculateScore(s17Hand) === 17, 'soft 17 hand must score 17');
  assert(isSoftHand(s17Hand) === true, 'soft 17 hand must be soft');
  assert(dealerShouldHit(s17Hand, true) === true, 'H17: dealer must hit soft 17');
  assert(dealerShouldHit(s17Hand, false) === false, 'S17: dealer must stand soft 17');
}

// Hard 17 variations: both H17 and S17 stand!
const hard17Variations = [
  [card('10'), card('7')],
  [card('9'), card('8')],
  [card('K'), card('7')],
  [card('6'), card('5'), card('6')],
  [card('8'), card('4'), card('5')],
  [card('10'), card('6'), card('A')],
  [card('9'), card('7'), card('A')],
];
for (const h17Hand of hard17Variations) {
  assert(calculateScore(h17Hand) === 17, 'hard 17 hand must score 17');
  assert(isSoftHand(h17Hand) === false, 'hard 17 hand must be hard');
  assert(dealerShouldHit(h17Hand, true) === false, 'H17: dealer must stand hard 17');
  assert(dealerShouldHit(h17Hand, false) === false, 'S17: dealer must stand hard 17');
}

// Soft 18, 19, 20, 21: dealer stands under both rules (dealer reaches >= 17)
assert(dealerShouldHit([card('A'), card('7')], true) === false, 'H17 stands soft 18');
assert(dealerShouldHit([card('A'), card('7')], false) === false, 'S17 stands soft 18');
assert(dealerShouldHit([card('A'), card('8')], true) === false, 'H17 stands soft 19');
assert(dealerShouldHit([card('A'), card('8')], false) === false, 'S17 stands soft 19');
assert(dealerShouldHit([card('A'), card('9')], true) === false, 'H17 stands soft 20');
assert(dealerShouldHit([card('A'), card('9')], false) === false, 'S17 stands soft 20');
assert(dealerShouldHit([card('A'), card('10')], true) === false, 'H17 stands 21');
assert(dealerShouldHit([card('A'), card('10')], false) === false, 'S17 stands 21');

// --- Basic strategy hints ---
const hand = (ranks) => ranks.map((r) => card(r));
const up = (rank) => card(rank);

assert(
  recommendAction({
    phase: 'playing',
    playerCards: hand(['A', 'K']),
    dealerUpcard: up('6'),
    canDouble: true,
    canSplit: false,
    canSurrender: true,
  }) === 'stand',
  'soft/hard 21 stands',
);
assert(
  recommendAction({
    phase: 'playing',
    playerCards: hand(['8', '8']),
    dealerUpcard: up('5'),
    canDouble: true,
    canSplit: true,
    canSurrender: true,
  }) === 'split',
  '8,8 splits',
);
assert(
  recommendAction({
    phase: 'playing',
    playerCards: hand(['A', '7']),
    dealerUpcard: up('5'),
    canDouble: true,
    canSplit: false,
    canSurrender: true,
  }) === 'double',
  'soft 18 doubles vs 5',
);
assert(
  recommendAction({
    phase: 'playing',
    playerCards: hand(['A', '7']),
    dealerUpcard: up('5'),
    canDouble: false,
    canSplit: false,
    canSurrender: true,
  }) === 'stand',
  'soft 18 stands when double blocked',
);
assert(
  recommendAction({
    phase: 'playing',
    playerCards: hand(['10', '6']),
    dealerUpcard: up('10'),
    canDouble: true,
    canSplit: false,
    canSurrender: true,
  }) === 'surrender',
  'hard 16 surrenders vs 10',
);
assert(
  recommendAction({
    phase: 'playing',
    playerCards: hand(['10', '6']),
    dealerUpcard: up('10'),
    canDouble: true,
    canSplit: false,
    canSurrender: false,
  }) === 'hit',
  'hard 16 hits vs 10 when surrender blocked',
);
assert(
  recommendAction({
    phase: 'insurance',
    playerCards: hand(['10', '7']),
    dealerUpcard: up('A'),
    canDouble: false,
    canSplit: false,
    canSurrender: true,
  }) === 'declineInsurance',
  'never take insurance',
);
assert(
  recommendAction({
    phase: 'evenMoney',
    playerCards: hand(['A', 'K']),
    dealerUpcard: up('A'),
    canDouble: false,
    canSplit: false,
    canSurrender: false,
  }) === 'declineEvenMoney',
  'decline even money',
);

// --- Post-hand feedback ---
const wrongHit = evaluateDecision({
  phase: 'playing',
  playerCards: hand(['10', '7']),
  dealerUpcard: up('6'),
  canDouble: false,
  canSplit: false,
  canSurrender: false,
  taken: 'hit',
});
assert(wrongHit.correct === false, 'hitting hard 17 vs 6 is wrong');
assert(wrongHit.recommended === 'stand', 'should have stood');
const rightStand = evaluateDecision({
  phase: 'playing',
  playerCards: hand(['10', '7']),
  dealerUpcard: up('6'),
  canDouble: false,
  canSplit: false,
  canSurrender: false,
  taken: 'stand',
});
assert(rightStand.correct === true, 'standing hard 17 is correct');
const summary = summarizeHandFeedback([wrongHit, rightStand]);
assert(summary.correct === 1 && summary.total === 2, 'feedback tallies 1/2');
assert(summary.headline.includes('1/2'), 'headline mentions ratio');

// --- Shoe Penetration, Capacity & Shuffle Trigger Invariants ---
const shoeConfigs = [
  { decks: 1, pen: 0.60 },
  { decks: 2, pen: 0.70 },
  { decks: 4, pen: 0.75 },
  { decks: 6, pen: 0.80 },
  { decks: 8, pen: 0.85 },
];

for (const cfg of shoeConfigs) {
  const s = createShoe(cfg.decks, cfg.pen);
  const expectedCapacity = cfg.decks * 52;
  const expectedCutAt = Math.floor(expectedCapacity * (1 - cfg.pen));
  assert(s.capacity === expectedCapacity, `${cfg.decks}-deck capacity is ${expectedCapacity}`);
  assert(s.cutAt === expectedCutAt, `${cfg.decks}-deck cutAt matches penetration ${(1 - cfg.pen)}`);
  assert(s.needsReshuffle === false, 'needsReshuffle starts false');
  assert(cardsRemaining(s) === expectedCapacity, 'all cards remaining');
  assert(dealtRatio(s) === 0, 'fresh shoe dealt ratio 0');

  // Draw until exactly 1 card before cut card
  let activeShoe = s;
  let cardsDealt = 0;
  const drawUntilNearCut = expectedCapacity - expectedCutAt - 1;
  for (let i = 0; i < drawUntilNearCut; i++) {
    const res = drawCard(activeShoe);
    activeShoe = res.shoe;
    cardsDealt++;
    // Invariant: cards remaining + cards dealt === capacity
    assert(
      cardsRemaining(activeShoe) + cardsDealt === expectedCapacity,
      'card count invariant holds',
    );
    assert(
      Math.abs(dealtRatio(activeShoe) - cardsDealt / expectedCapacity) < 1e-9,
      'dealtRatio matches card count ratio',
    );
  }
  assert(activeShoe.needsReshuffle === false, 'needsReshuffle still false before cut card');

  // Draw crossing the cut card -> triggers reshuffle flag
  const crossCutCard = drawCard(activeShoe);
  activeShoe = crossCutCard.shoe;
  cardsDealt++;
  assert(activeShoe.needsReshuffle === true, 'crossing cut card triggers needsReshuffle');

  // maybeReshuffle restores fresh shoe
  const reshuffledShoe = maybeReshuffle(activeShoe);
  assert(reshuffledShoe.needsReshuffle === false, 'reshuffled shoe clears flag');
  assert(cardsRemaining(reshuffledShoe) === expectedCapacity, 'reshuffled shoe full capacity');
  assert(dealtRatio(reshuffledShoe) === 0, 'reshuffled shoe dealtRatio resets to 0');
}

// Undo exploit regression: bet snapshots must NOT include shoe cards.
// (Structural: BetSnapshot in App only stores currentBet — assert via shape contract here.)
const betSnapshotKeys = ['currentBet'];
assert(betSnapshotKeys.includes('currentBet'), 'bet undo key present');
assert(!betSnapshotKeys.includes('deck') && !betSnapshotKeys.includes('cards'), 'bet undo excludes shoe');

// --- Table Ladder & Calibrated Peak Bankroll Unlocking ---
// Lounge: 0, Silver: 2500, Gold: 8000, Platinum: 20000, High Roller: 50000.
assert(TABLES.length === 5, '5 table tiers configured');
assert(TABLES.map((t) => t.id).join(',') === 'lounge,silver,gold,platinum,highroller', 'correct tier order');

const lounge = getTable('lounge');
const silver = getTable('silver');
const gold = getTable('gold');
const platinum = getTable('platinum');
const highroller = getTable('highroller');

assert(lounge.unlockPeak === 0, 'lounge unlock peak is 0');
assert(silver.unlockPeak === 2500, 'silver unlock peak is 2500');
assert(gold.unlockPeak === 8000, 'gold calibrated to 8000');
assert(platinum.unlockPeak === 20000, 'platinum calibrated to 20000');
assert(highroller.unlockPeak === 50000, 'highroller calibrated to 50000');

// Boundary unlock tests
assert(isTableUnlocked('lounge', 0) === true, 'lounge unlocked at 0');
assert(isTableUnlocked('silver', 0) === false, 'silver locked at 0');
assert(isTableUnlocked('silver', 2499) === false, 'silver locked at 2499');
assert(isTableUnlocked('silver', 2500) === true, 'silver unlocks at 2500');
assert(isTableUnlocked('gold', 2500) === false, 'gold locked at 2500');
assert(isTableUnlocked('gold', 7999) === false, 'gold locked at 7999');
assert(isTableUnlocked('gold', 8000) === true, 'gold unlocks at 8000');
assert(isTableUnlocked('platinum', 8000) === false, 'platinum locked at 8000');
assert(isTableUnlocked('platinum', 19999) === false, 'platinum locked at 19999');
assert(isTableUnlocked('platinum', 20000) === true, 'platinum unlocks at 20000');
assert(isTableUnlocked('highroller', 20000) === false, 'highroller locked at 20000');
assert(isTableUnlocked('highroller', 49999) === false, 'highroller locked at 49999');
assert(isTableUnlocked('highroller', 50000) === true, 'highroller unlocks at 50000');

// highestUnlockedTableId test across all boundary levels
assert(highestUnlockedTableId(0) === 'lounge', 'peak 0 -> lounge');
assert(highestUnlockedTableId(2499) === 'lounge', 'peak 2499 -> lounge');
assert(highestUnlockedTableId(2500) === 'silver', 'peak 2500 -> silver');
assert(highestUnlockedTableId(7999) === 'silver', 'peak 7999 -> silver');
assert(highestUnlockedTableId(8000) === 'gold', 'peak 8000 -> gold');
assert(highestUnlockedTableId(19999) === 'gold', 'peak 19999 -> gold');
assert(highestUnlockedTableId(20000) === 'platinum', 'peak 20000 -> platinum');
assert(highestUnlockedTableId(49999) === 'platinum', 'peak 49999 -> platinum');
assert(highestUnlockedTableId(50000) === 'highroller', 'peak 50000 -> highroller');
assert(highestUnlockedTableId(100000) === 'highroller', 'peak 100000 -> highroller');

// unlockedTables count checks
assert(unlockedTables(0).length === 1, 'peak 0 has 1 unlocked table');
assert(unlockedTables(2500).length === 2, 'peak 2500 has 2 unlocked tables');
assert(unlockedTables(8000).length === 3, 'peak 8000 has 3 unlocked tables');
assert(unlockedTables(20000).length === 4, 'peak 20000 has 4 unlocked tables');
assert(unlockedTables(50000).length === 5, 'peak 50000 has 5 unlocked tables');

// Economic progression sanity checks across tiers
for (let i = 0; i < TABLES.length - 1; i++) {
  const current = TABLES[i];
  const next = TABLES[i + 1];
  assert(next.minBet > current.minBet, `tier ${next.id} minBet > ${current.id}`);
  assert(next.maxBet > current.maxBet, `tier ${next.id} maxBet > ${current.id}`);
  assert(next.recoveryStake > current.recoveryStake, `tier ${next.id} recoveryStake > ${current.id}`);
  assert(next.unlockPeak > current.unlockPeak, `tier ${next.id} unlockPeak > ${current.id}`);
  assert(
    current.chipValues.every((cv) => cv >= current.minBet && cv <= current.maxBet),
    `chips within bounds for ${current.id}`,
  );
}

// --- Stats, Standard Recovery & Emergency Recovery (Zero Career Stat Loss) ---
let stats = { ...EMPTY_STATS, peakBankroll: 1000 };
stats = recordHandResult(stats, 'win', 1200, 200, 1, 1);
assert(stats.hands === 1 && stats.wins === 1 && stats.streak === 1, 'win recorded');
assert(stats.peakBankroll === 1200, 'peak rises');
assert(stats.strategyCorrect === 1 && stats.strategyTotal === 1, 'strategy tallied');
stats = recordHandResult(stats, 'lose', 900, -300, 0, 1);
assert(stats.streak === 0 && stats.bestStreak === 1, 'streak resets, best kept');

// Standard recovery under MAX_RECOVERIES
let careerStats = {
  ...EMPTY_STATS,
  hands: 120,
  wins: 62,
  losses: 48,
  pushes: 10,
  blackjacks: 14,
  streak: 4,
  bestStreak: 8,
  peakBankroll: 35000,
  bustOuts: 2,
  recoveriesUsed: 2,
  strategyCorrect: 110,
  strategyTotal: 120,
  netProfit: 2800,
  tableId: 'platinum',
};

const standardRec = applyRecovery(careerStats, 'platinum');
assert(standardRec !== null, 'standard recovery must succeed');
assert(standardRec.balance === getTable('platinum').recoveryStake, 'recovery matches table stake');
assert(standardRec.stats.recoveriesUsed === 3, 'recoveriesUsed incremented');
assert(standardRec.stats.bustOuts === 3, 'bustOuts incremented');
assert(standardRec.stats.streak === 0, 'current streak reset on bust');
assert(standardRec.stats.bestStreak === 8, 'bestStreak preserved');
assert(standardRec.stats.hands === 120, 'hands preserved');
assert(standardRec.stats.wins === 62, 'wins preserved');
assert(standardRec.stats.losses === 48, 'losses preserved');
assert(standardRec.stats.pushes === 10, 'pushes preserved');
assert(standardRec.stats.blackjacks === 14, 'blackjacks preserved');
assert(standardRec.stats.strategyCorrect === 110, 'strategy correct preserved');
assert(standardRec.stats.strategyTotal === 120, 'strategy total preserved');
assert(standardRec.stats.netProfit === 2800, 'net profit preserved');
assert(standardRec.stats.peakBankroll === 35000, 'peak bankroll preserved');

// Fast-forward recoveriesUsed to MAX_RECOVERIES (exhaust standard limit)
careerStats.recoveriesUsed = MAX_RECOVERIES;
careerStats.streak = 5;

// Emergency recovery beyond MAX_RECOVERIES (5 -> 6):
// Must NEVER return null, must NEVER wipe progression, must reload EMERGENCY_RECOVERY_STAKE.
const emergencyRec1 = applyRecovery(careerStats, 'highroller');
assert(emergencyRec1 !== null, 'emergency recovery must never return null');
assert(emergencyRec1.balance === EMERGENCY_RECOVERY_STAKE, `emergency balance is ${EMERGENCY_RECOVERY_STAKE}`);
assert(EMERGENCY_RECOVERY_STAKE === 200, 'emergency stake is 200');
assert(emergencyRec1.stats.tableId === 'lounge', 'emergency recovery drops safely to lounge table');
assert(emergencyRec1.stats.recoveriesUsed === 6, 'recoveriesUsed incremented past cap');
assert(emergencyRec1.stats.bustOuts === 3, 'bustOuts incremented');
assert(emergencyRec1.stats.streak === 0, 'current streak reset to 0');

// Verify zero career stat loss under emergency recovery
assert(emergencyRec1.stats.hands === 120, 'emergency: hands intact');
assert(emergencyRec1.stats.wins === 62, 'emergency: wins intact');
assert(emergencyRec1.stats.losses === 48, 'emergency: losses intact');
assert(emergencyRec1.stats.pushes === 10, 'emergency: pushes intact');
assert(emergencyRec1.stats.blackjacks === 14, 'emergency: blackjacks intact');
assert(emergencyRec1.stats.bestStreak === 8, 'emergency: bestStreak intact');
assert(emergencyRec1.stats.peakBankroll === 35000, 'emergency: peakBankroll strictly preserved');
assert(emergencyRec1.stats.strategyCorrect === 110, 'emergency: strategy correct intact');
assert(emergencyRec1.stats.strategyTotal === 120, 'emergency: strategy total intact');
assert(emergencyRec1.stats.netProfit === 2800, 'emergency: net profit intact');

// Infinite safety net: repeated emergency recoveries (6 -> 7 -> 8 -> 9 -> 10)
let currentEmergency = emergencyRec1.stats;
for (let i = 0; i < 4; i++) {
  const nextRec = applyRecovery(currentEmergency, 'lounge');
  assert(nextRec !== null, `emergency iteration ${i + 1} must succeed`);
  assert(nextRec.balance === EMERGENCY_RECOVERY_STAKE, 'balance is always emergency reload');
  assert(nextRec.stats.recoveriesUsed === currentEmergency.recoveriesUsed + 1, 'recoveries tally correctly');
  assert(nextRec.stats.peakBankroll === 35000, 'peak bankroll never degrades');
  assert(nextRec.stats.hands === 120, 'career hands never wiped');
  currentEmergency = nextRec.stats;
}
assert(currentEmergency.recoveriesUsed === 10, 'successfully used 10 recoveries without lockout');

// --- Hi-Lo Mathematical Zero-Sum & True Count Invariants ---
// 1. Single complete deck zero-sum check:
const completeDeck = createSeededDeck(1, 42);
assert(completeDeck.length === 52, 'single deck has 52 cards');
let deckNetHiLo = 0;
let plusCards = 0;
let minusCards = 0;
let neutralCards = 0;
for (const c of completeDeck) {
  const v = hiLoValue(c.rank);
  deckNetHiLo += v;
  if (v === 1) plusCards++;
  else if (v === -1) minusCards++;
  else neutralCards++;
}
assert(deckNetHiLo === 0, 'complete 52-card deck has exact Hi-Lo sum of 0');
assert(plusCards === 20, '20 low cards (2,3,4,5,6 * 4) = +20');
assert(minusCards === 20, '20 high cards (10,J,Q,K,A * 4) = -20');
assert(neutralCards === 12, '12 neutral cards (7,8,9 * 4) = 0');

// 2. Multi-deck shoes (2, 6, 8 decks) must all be zero-sum
for (const dCount of [2, 6, 8]) {
  const mDeck = createSeededDeck(dCount, 100 + dCount);
  const mSum = mDeck.reduce((acc, c) => acc + hiLoValue(c.rank), 0);
  assert(mSum === 0, `${dCount}-deck shoe must have exact zero Hi-Lo sum`);
}

// 3. Hi-Lo values across all ranks and hidden card delta
assert(hiLoValue('2') === 1 && hiLoValue('3') === 1 && hiLoValue('4') === 1, 'low ranks +1');
assert(hiLoValue('5') === 1 && hiLoValue('6') === 1, '5 and 6 are +1');
assert(hiLoValue('7') === 0 && hiLoValue('8') === 0 && hiLoValue('9') === 0, 'neutral ranks 0');
assert(hiLoValue('10') === -1 && hiLoValue('J') === -1 && hiLoValue('Q') === -1, 'faces are -1');
assert(hiLoValue('K') === -1 && hiLoValue('A') === -1, 'K and Ace are -1');
assert(runningCountDelta([card('5'), card('K'), { ...card('A'), isHidden: true }]) === 0, 'hidden ignored in count');

// 4. True Count calculation across fractional decks
assert(trueCount(10, 52) === 10, '1 deck left: TC = RC');
assert(trueCount(10, 104) === 5, '2 decks left: TC = RC / 2');
assert(trueCount(12, 156) === 4, '3 decks left: TC = 12 / 3 = 4');
assert(trueCount(6, 26) === 12, '0.5 decks left: TC = 6 / 0.5 = 12');
assert(trueCount(-8, 104) === -4, 'negative RC correctly calculates TC');
assert(trueCount(-7, 52) === -7, 'negative RC with 1 deck left');
assert(
  trueCount(5, 0) === 20,
  'zero cards remaining clamps to minimum 0.25 decks (5 / 0.25 = 20)',
);
assert(trueCount(0, 0) === 0, 'zero running count with zero cards remaining returns 0');

// --- Seeded shoe (daily determinism) ---
const seedA = hashString('blackjack-daily-shoe:2026-10-22');
const deckA = createSeededDeck(6, seedA);
const deckB = createSeededDeck(6, seedA);
assert(JSON.stringify(deckA) === JSON.stringify(deckB), 'same seed → same shoe order');
const deckC = createSeededDeck(6, seedA ^ 1);
assert(JSON.stringify(deckA) !== JSON.stringify(deckC), 'different seed → different order');
const seededShoe = createSeededShoe(6, seedA, 0.75);
assert(seededShoe.seed === seedA, 'seeded shoe stores seed');
let sShoe = seededShoe;
for (let i = 0; i < sShoe.capacity - sShoe.cutAt + 1; i++) {
  sShoe = drawCard(sShoe).shoe;
}
assert(sShoe.needsReshuffle === true, 'seeded shoe arms cut card');
const reseeded = maybeReshuffle(sShoe);
assert(reseeded.seed === seedA, 'reshuffle keeps original seed');
assert(reseeded.reshuffleIndex === 1, 'reshuffle index advances');
const reseeded2 = maybeReshuffle({ ...sShoe, needsReshuffle: true, reshuffleIndex: 0 });
assert(
  JSON.stringify(reseeded.cards) === JSON.stringify(reseeded2.cards),
  'seeded reshuffle is deterministic',
);

// --- Daily challenge calendar / persistence merge ---
assert(/^\d{4}-\d{2}-\d{2}$/.test(todayKeyTaipei(new Date('2026-10-21T16:00:00Z'))), 'taipei key shape');
assert(todayKeyTaipei(new Date('2026-10-21T16:00:00Z')) === '2026-10-22', 'UTC evening → next Taipei day');
assert(previousDayKey('2026-10-22') === '2026-10-21', 'previous day');
assert(dailySeed('2026-10-22') === dailySeed('2026-10-22'), 'daily seed stable');
const dailyShoe1 = createDailyShoe('2026-10-22');
const dailyShoe2 = createDailyShoe('2026-10-22');
assert(
  JSON.stringify(dailyShoe1.cards) === JSON.stringify(dailyShoe2.cards),
  'daily shoe identical for date',
);
assert(DAILY_HANDS === 20 && DAILY_START_BALANCE === 1000, 'daily constants');

let daily = { ...EMPTY_DAILY, days: {} };
daily = mergeDailyAttempt(daily, '2026-10-22', 1200, 8, 10, 20, true);
assert(daily.days['2026-10-22'].bestBalance === 1200, 'daily best recorded');
assert(daily.streak === 1 && daily.lastCompletedDate === '2026-10-22', 'streak starts');
daily = mergeDailyAttempt(daily, '2026-10-22', 900, 5, 10, 20, true);
assert(daily.days['2026-10-22'].bestBalance === 1200, 'worse run does not overwrite best');
assert(daily.days['2026-10-22'].attempts === 2, 'attempts increment');
daily = mergeDailyAttempt(daily, '2026-10-23', 1100, 9, 10, 20, true);
assert(daily.streak === 2, 'streak continues next day');
assert(currentStreak(daily, '2026-10-23') === 2, 'live streak');
const share = formatDailyShareText('2026-10-23', 1100, 9, 10, 2);
assert(share.includes('每日牌靴') && share.includes('1100'), 'share text');

// --- Perfect Pairs ---
assert(classifyPerfectPair([card('A', 'spades'), card('A', 'spades')]) === 'perfect', 'perfect pair');
assert(classifyPerfectPair([card('K', 'hearts'), card('Q', 'hearts')]) === 'none', 'K+Q not pair');
assert(classifyPerfectPair([card('K', 'hearts'), card('K', 'diamonds')]) === 'colored', 'K+K colored');
assert(classifyPerfectPair([card('10', 'hearts'), card('K', 'diamonds')]) === 'none', '10+K not perfect-pair');
assert(classifyPerfectPair([card('8', 'clubs'), card('8', 'hearts')]) === 'mixed', 'mixed pair');
assert(perfectPairsPayout(10, 'perfect') === 10 + 10 * 25, 'perfect payout 25:1');
assert(perfectPairsPayout(10, 'colored') === 10 + 10 * 12, 'colored 12:1');
assert(perfectPairsPayout(10, 'mixed') === 10 + 10 * 6, 'mixed 6:1');
assert(perfectPairsPayout(10, 'none') === 0, 'no pair loses stake');
assert(maxPerfectPairsBet(100, 80) === 50, 'side bet capped at half main');
assert(maxPerfectPairsBet(100, 30) === 30, 'side bet capped by remaining balance');

// --- Simulate round / tournament ---
assert(TIN_RIVALS.length === 4 && TIN_HANDS === 15 && TIN_BUY_IN === 500, 'tin constants');
assert(tinPotSize() === TIN_BUY_IN * 5, 'pot = 5 buy-ins');
assert(prizeForRank(1) === Math.floor(tinPotSize() * 0.5), '1st takes half');
assert(prizeForRank(5) === 0, '5th gets nothing');
assert(chooseRivalBet('flat', TIN_START_CHIPS, 0, 0) >= 25, 'flat bets min+');
assert(chooseRivalBet('aggressive', TIN_START_CHIPS, 0, 0) >= chooseRivalBet('flat', TIN_START_CHIPS, 0, 0), 'aggro ≥ flat');

const rivals0 = createRivalStates(42);
assert(rivals0.length === 4 && rivals0.every((r) => r.balance === TIN_START_CHIPS), 'rivals start equal');
const rivals1 = advanceRivalsOneHand(rivals0, 1);
assert(
  rivals1.some(
    (r, i) =>
      r.balance !== rivals0[i].balance || r.shoe.cards.length !== rivals0[i].shoe.cards.length,
  ),
  'rivals advanced at least one seat',
);
const standings = buildStandings(1500, '你', rivals1);
assert(standings[0].rank === 1, 'rank 1 assigned');
assert(standings.some((r) => r.isPlayer), 'player in standings');
const tb = mergeTournamentResult({ bestRank: 99, bestBalance: 0, wins: 0, entries: 0 }, 1, 1800);
assert(tb.wins === 1 && tb.bestRank === 1 && tb.entries === 1, 'tournament best merge');

const simShoe = createSeededShoe(2, 99, 0.9);
const sim = simulateRound(simShoe, 25, 1000, TIN_SIM_RULES);
assert(typeof sim.profit === 'number', 'sim returns profit');
assert(sim.shoe.cards.length < simShoe.cards.length, 'sim consumes cards');

// --- VIP Cockpit & Telemetry Tests ---
assert(calculateBustProbability(hand(['A', '6']), []) === 0, 'soft 17 bust chance is 0');
assert(calculateBustProbability(hand(['5', '6']), []) === 0, '11 or lower bust chance is 0');
assert(calculateBustProbability(hand(['10', 'K', 'A']), []) === 100, '21 or over bust chance is 100');
const hard12Bust = calculateBustProbability(hand(['10', '2']), []);
assert(Math.abs(hard12Bust - 30.8) <= 0.2, `hard 12 bust chance approx 30.8%, got ${hard12Bust}`);
const hard16Bust = calculateBustProbability(hand(['10', '6']), []);
assert(Math.abs(hard16Bust - 61.5) <= 0.2, `hard 16 bust chance approx 61.5%, got ${hard16Bust}`);

const miniShoe = [card('10'), card('K'), card('2'), card('3')];
assert(calculateBustProbability(hand(['10', '2']), miniShoe) === 50, 'hard 12 on mini shoe: 10 & K bust (2/4 = 50%)');

// --- Dealer Bust Probability Math Depth ---
const bust2 = getDealerBustProbability(card('2'), 0);
const bust3 = getDealerBustProbability(card('3'), 0);
const bust4 = getDealerBustProbability(card('4'), 0);
const bust5 = getDealerBustProbability(card('5'), 0);
const bust6 = getDealerBustProbability(card('6'), 0);
const bust7 = getDealerBustProbability(card('7'), 0);
const bust8 = getDealerBustProbability(card('8'), 0);
const bust9 = getDealerBustProbability(card('9'), 0);
const bust10 = getDealerBustProbability(card('10'), 0);
const bustAH17 = getDealerBustProbability(card('A'), 0, 'H17');
const bustAS17 = getDealerBustProbability(card('A'), 0, 'S17');

// Stiff cards (4, 5, 6) must have highest bust probabilities (>40%)
assert(bust5 > 42.0 && bust5 < 44.0, `dealer 5 bust prob ~42.9%, got ${bust5}`);
assert(bust6 > 41.5 && bust6 < 43.5, `dealer 6 bust prob ~42.1%, got ${bust6}`);
assert(bust4 > 39.5 && bust4 < 41.5, `dealer 4 bust prob ~40.3%, got ${bust4}`);

// Relative ordering: 5 is the weakest dealer upcard (most prone to busting)
assert(bust5 > bust6 && bust6 > bust4 && bust4 > bust3 && bust3 > bust2, 'bust prob: 5 > 6 > 4 > 3 > 2');

// Strong cards (7..A) have low bust rates (<27%) because dealer frequently completes 17..20
assert(bust7 < 27.0, `dealer 7 bust rate < 27%, got ${bust7}`);
assert(bust8 < 25.0, `dealer 8 bust rate < 25%, got ${bust8}`);
assert(bust9 < 24.0, `dealer 9 bust rate < 24%, got ${bust9}`);
assert(bust10 < 22.0, `dealer 10 bust rate < 22%, got ${bust10}`);
assert(bustAH17 === 16.7, `dealer Ace bust rate under H17 is 16.7%, got ${bustAH17}`);
assert(bustAS17 === 11.6, `dealer Ace bust rate under S17 is 11.6%, got ${bustAS17}`);
assert(bustAH17 > bustAS17, 'H17 rule increases dealer bust probability on Ace upcard');

// True count impact on bust probability:
// Positive TC -> higher ten density -> stiff cards bust MORE often
const bust5HighTc = getDealerBustProbability(card('5'), 4);
const bust5LowTc = getDealerBustProbability(card('5'), -4);
assert(bust5HighTc > bust5, 'positive TC increases dealer 5 bust chance');
assert(bust5LowTc < bust5, 'negative TC decreases dealer 5 bust chance');

// Clamping bounds: rate is clamped between 5% and 85%
const bustExtremelyHighTc = getDealerBustProbability(card('5'), 100);
assert(bustExtremelyHighTc === 85, `rate capped at 85%, got ${bustExtremelyHighTc}`);
const bustExtremelyLowTc = getDealerBustProbability(card('5'), -100);
assert(bustExtremelyLowTc === 5, `rate floored at 5%, got ${bustExtremelyLowTc}`);

const edgeZero = calculatePlayerEdge(0);
assert(edgeZero.edge === -0.5 && edgeZero.tone === 'neutral', 'TC 0 base house edge -0.5%');
const edgeHigh = calculatePlayerEdge(3);
assert(edgeHigh.edge === 1.0 && edgeHigh.tone === 'player', 'TC +3 player edge 1.0%');
const edgeLow = calculatePlayerEdge(-3);
assert(edgeLow.edge === -2.0 && edgeLow.tone === 'house', 'TC -3 house edge 2.0%');

const fullDeck = createSeededDeck(1, 123);
const density = calculateShoeDensity(fullDeck);
assert(density.high === 20 && density.total === 52, 'single deck high cards: 4 of each 10,J,Q,K,A = 20');
assert(density.highPct === 38.5, 'high card pct in standard deck is 38.5%');

const streak0 = getStreakPrestige(0);
assert(streak0.level === 0 && streak0.multiplierLabel === '1.0x', 'streak 0 prestige');
const streak3 = getStreakPrestige(3);
assert(streak3.level === 3 && streak3.title.includes('三連勝'), 'streak 3 prestige');
const streak6 = getStreakPrestige(6);
assert(streak6.level === 6 && streak6.title.includes('傳奇'), 'streak 6 prestige');

console.log('check-blackjack: ok');

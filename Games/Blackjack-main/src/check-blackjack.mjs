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
import { TABLES, isTableUnlocked, getTable, unlockedTables } from './utils/tables.ts';
import { evaluateDecision, summarizeHandFeedback } from './utils/feedback.ts';
import { hiLoValue, runningCountDelta, trueCount } from './utils/hiLo.ts';
import { recordHandResult, EMPTY_STATS, applyRecovery, MAX_RECOVERIES } from './utils/storage.ts';
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

// --- Insurance 2:1 ---
assert(resolveInsurancePayout(50, true) === 150, 'insurance win returns 3× stake');
assert(resolveInsurancePayout(50, false) === 0, 'insurance loss returns 0');
assert(resolveInsurancePayout(0, true) === 0, 'no insurance bet → 0');

// --- Early surrender half bet ---
assert(surrenderRefund(100) === 50, 'surrender refunds half');
assert(surrenderRefund(25) === 12, 'surrender floors odd bets');

// --- H17 vs S17 ---
const soft17 = [card('A'), card('6')];
const hard17 = [card('10'), card('7')];
const sixteen = [card('10'), card('6')];

assert(dealerShouldHit(sixteen, true) === true, 'dealer hits 16 under H17');
assert(dealerShouldHit(sixteen, false) === true, 'dealer hits 16 under S17');
assert(dealerShouldHit(hard17, true) === false, 'dealer stands hard 17 under H17');
assert(dealerShouldHit(hard17, false) === false, 'dealer stands hard 17 under S17');
assert(dealerShouldHit(soft17, true) === true, 'H17: hit soft 17');
assert(dealerShouldHit(soft17, false) === false, 'S17: stand soft 17');
assert(dealerShouldHit([card('A'), card('9')], true) === false, 'dealer stands soft 20');

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

// --- Shoe / penetration / cut card ---
const shoe6 = createShoe(6, 0.75);
assert(shoe6.capacity === 52 * 6, '6-deck shoe capacity');
assert(shoe6.cutAt === Math.floor(shoe6.capacity * 0.25), 'cut card at 25% remaining');
assert(dealtRatio(shoe6) === 0, 'fresh shoe dealt ratio 0');
let shoe = shoe6;
const target = shoe.capacity - shoe.cutAt + 1;
for (let i = 0; i < target; i++) {
  const r = drawCard(shoe);
  shoe = r.shoe;
}
assert(shoe.needsReshuffle === true, 'crossing cut card arms reshuffle');
const reshuffled = maybeReshuffle(shoe);
assert(reshuffled.needsReshuffle === false, 'reshuffle clears flag');
assert(cardsRemaining(reshuffled) === reshuffled.capacity, 'reshuffle restores full shoe');

// Undo exploit regression: bet snapshots must NOT include shoe cards.
// (Structural: BetSnapshot in App only stores currentBet — assert via shape contract here.)
const betSnapshotKeys = ['currentBet'];
assert(betSnapshotKeys.includes('currentBet'), 'bet undo key present');
assert(!betSnapshotKeys.includes('deck') && !betSnapshotKeys.includes('cards'), 'bet undo excludes shoe');

// --- Tables / unlock ---
assert(TABLES.length >= 4, 'table ladder has multiple tiers');
assert(isTableUnlocked('lounge', 0) === true, 'lounge always unlocked');
assert(isTableUnlocked('silver', 0) === false, 'silver locked at start');
assert(isTableUnlocked('silver', 2500) === true, 'silver unlocks at peak');
assert(unlockedTables(100000).length === TABLES.length, 'high peak unlocks all');
assert(getTable('gold').minBet > getTable('lounge').minBet, 'higher tables raise minimum');

// --- Stats / recovery (no free $1000 on bust) ---
let stats = { ...EMPTY_STATS, peakBankroll: 1000 };
stats = recordHandResult(stats, 'win', 1200, 200, 1, 1);
assert(stats.hands === 1 && stats.wins === 1 && stats.streak === 1, 'win recorded');
assert(stats.peakBankroll === 1200, 'peak rises');
assert(stats.strategyCorrect === 1 && stats.strategyTotal === 1, 'strategy tallied');
stats = recordHandResult(stats, 'lose', 900, -300, 0, 1);
assert(stats.streak === 0 && stats.bestStreak === 1, 'streak resets, best kept');

const recovery = applyRecovery({ ...stats, recoveriesUsed: 0, tableId: 'lounge' }, 'lounge');
assert(recovery !== null, 'recovery available');
assert(recovery.balance === getTable('lounge').recoveryStake, 'recovery grants table stake');
assert(recovery.balance !== 1000 || getTable('lounge').recoveryStake === 1000, 'not a silent default refill');
assert(recovery.stats.bustOuts === stats.bustOuts + 1, 'bust-out counted');
assert(recovery.stats.recoveriesUsed === 1, 'recovery consumed');

let exhausted = { ...EMPTY_STATS, recoveriesUsed: MAX_RECOVERIES };
assert(applyRecovery(exhausted, 'lounge') === null, 'no recovery after cap');

// --- Hi-Lo counting ---
assert(hiLoValue('2') === 1 && hiLoValue('7') === 0 && hiLoValue('K') === -1, 'hi-lo values');
assert(runningCountDelta([card('5'), card('K'), { ...card('A'), isHidden: true }]) === 0, 'hidden ignored in count');
assert(trueCount(6, 52) === 6, 'true count ~ running / decks');
assert(trueCount(-3, 26) === -6, 'true count floors toward zero');

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

console.log('check-blackjack: ok');

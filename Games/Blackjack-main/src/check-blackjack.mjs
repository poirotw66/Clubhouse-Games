// ponytail: assert score, insurance payout, surrender, and H17/S17 dealer hits.
import {
  calculateScore,
  isBlackjack,
  isSoftHand,
  dealerShouldHit,
  resolveInsurancePayout,
  surrenderRefund,
} from './utils/rules.ts';

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

console.log('check-blackjack: ok');

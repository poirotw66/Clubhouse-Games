import { canPass, deal, outcome, pass, play, playsFor } from '../src/game/engine.js';
import { chooseMove, turnsToEmpty } from '../src/game/cpu.js';
import { SEATS } from '../src/game/types.js';
import type { DifficultyId, GameState, Play } from '../src/game/types.js';

/**
 * Reproduces the measured numbers in the README.
 *
 * Every seat is driven by a named brain, so a tier can be sat at one seat
 * against three of another and its real strength read off the win rate. With
 * four seats the break-even rate is 25%.
 */
function brainFor(state: GameState, brains: DifficultyId[]): Play | null {
  return chooseMove({ ...state, difficulty: brains[state.turn] });
}

function run(seedCode: string, brains: DifficultyId[]) {
  let state = deal(seedCode, brains[0], { straights: 'topCard' });
  let guard = 0;

  while (state.phase === 'playing' && guard++ < 400) {
    const move = brainFor(state, brains);
    if (move === null) {
      if (!canPass(state)) {
        // A brain may only decline when passing is legal; fall back so the
        // measurement never stalls on a bad policy.
        state = play(state, playsFor(state)[0].cards);
        continue;
      }
      state = pass(state);
      continue;
    }
    state = play(state, move.cards);
  }

  return outcome(state);
}

const N = Number(process.env.N ?? 400);
const TIERS: DifficultyId[] = ['easy', 'normal', 'hard'];

/** 95% half-width for a proportion, in percentage points. */
function rateHalfWidth(wins: number, n: number): number {
  const p = wins / n;
  return 1.96 * Math.sqrt((p * (1 - p)) / n) * 100;
}

/**
 * 95% interval on the DIFFERENCE between two win rates, in percentage points.
 *
 * This is the number the table is actually read for, and printing only the
 * per-cell rates invites the wrong test. Two intervals that overlap can still
 * have a difference that excludes zero — checking overlap is a strictly more
 * conservative test than testing the difference, and using it says "no effect"
 * about effects that are real. Measured here: hard-vs-normal against a normal
 * field is 34.0% against 27.5%, whose per-cell intervals overlap, while the
 * difference is 6.5pp with a 95% interval of [0.1, 12.9] — marginal, but not
 * absent. So the comparison gets its own interval rather than leaving the
 * reader to eyeball two others.
 */
function diffCI(winsA: number, winsB: number, n: number): { diff: number; halfWidth: number } {
  const pa = winsA / n;
  const pb = winsB / n;
  const se = Math.sqrt((pa * (1 - pa)) / n + (pb * (1 - pb)) / n);
  return { diff: (pa - pb) * 100, halfWidth: 1.96 * se * 100 };
}

console.log(`${N} deals per row. Seat 0 is the tier under test, seats 1-3 are the field.\n`);
console.log('under test  field           win%          avg penalty   avg cards left   break-even 25%');

const winsBy = new Map<string, number>();
let skipped = 0;

for (const subject of TIERS) {
  for (const field of TIERS) {
    let wins = 0;
    let penalty = 0;
    let cards = 0;
    // Deals that never reached an outcome must not be divided into by N — that
    // would drag every average toward zero without saying so. Measured at 0 of
    // 3,600 with a comfortable margin (longest deal 90 turns against a 400-turn
    // guard), but counted rather than assumed, and the divisor follows it.
    let counted = 0;

    for (let i = 0; i < N; i++) {
      const brains: DifficultyId[] = [subject, field, field, field];
      const result = run(`bal-${i}`, brains);
      if (!result) {
        skipped += 1;
        continue;
      }
      counted += 1;
      if (result.winner === 0) wins++;
      penalty += result.scores[0].penalty;
      cards += result.scores[0].remaining;
    }

    winsBy.set(`${subject}/${field}`, wins);
    const hw = rateHalfWidth(wins, counted);
    console.log(
      `${subject.padEnd(12)}${field.padEnd(12)}` +
        `${((wins / counted) * 100).toFixed(1).padStart(6)} ± ${hw.toFixed(1).padEnd(5)}` +
        `${(penalty / counted).toFixed(1).padStart(12)}${(cards / counted).toFixed(2).padStart(17)}`,
    );
  }
}
if (skipped > 0) console.log(`\n  ⚠ ${skipped} deal(s) never reached an outcome and were excluded from their row's divisor`);

// The ordering claim, tested directly rather than by eyeballing the rows.
console.log('\n--- Does a stronger brain actually win more, against the same field? ---\n');
for (const field of TIERS) {
  for (const [a, b] of [['hard', 'normal'], ['normal', 'easy']] as const) {
    const { diff, halfWidth } = diffCI(winsBy.get(`${a}/${field}`) ?? 0, winsBy.get(`${b}/${field}`) ?? 0, N);
    const clears = diff - halfWidth > 0;
    console.log(
      `  vs a ${field.padEnd(7)} field: ${a} over ${b.padEnd(7)} ${diff >= 0 ? '+' : ''}${diff.toFixed(1)}pp ` +
        `[${(diff - halfWidth).toFixed(1)}, ${(diff + halfWidth).toFixed(1)}]  ${clears ? '✓ clears zero' : '✗ does not clear zero'}`,
    );
  }
}

// Sanity: how much room the partition heuristic actually has to work with.
let total = 0;
for (let i = 0; i < 200; i++) {
  total += turnsToEmpty(deal(`spread-${i}`, 'normal', { straights: 'topCard' }).hands[0]);
}
console.log(`\nmean turns to empty a fresh 13-card hand: ${(total / 200).toFixed(2)}`);
console.log(`seats: ${SEATS}`);

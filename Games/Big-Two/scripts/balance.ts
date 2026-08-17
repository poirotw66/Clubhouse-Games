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

console.log(`${N} deals per row. Seat 0 is the tier under test, seats 1-3 are the field.\n`);
console.log('under test  field       win%    avg penalty   avg cards left   break-even 25%');

for (const subject of TIERS) {
  for (const field of TIERS) {
    let wins = 0;
    let penalty = 0;
    let cards = 0;

    for (let i = 0; i < N; i++) {
      const brains: DifficultyId[] = [subject, field, field, field];
      const result = run(`bal-${i}`, brains);
      if (!result) continue;
      if (result.winner === 0) wins++;
      penalty += result.scores[0].penalty;
      cards += result.scores[0].remaining;
    }

    console.log(
      `${subject.padEnd(12)}${field.padEnd(12)}${((wins / N) * 100).toFixed(1).padStart(6)}` +
        `${(penalty / N).toFixed(1).padStart(14)}${(cards / N).toFixed(2).padStart(17)}`,
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

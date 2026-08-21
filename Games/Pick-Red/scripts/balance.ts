import { capturableBy, pointsOf } from '../src/game/cards.js';
import { applyPlay, choosePick, deal, flip, outcome, playCard } from '../src/game/engine.js';
import { DIFFICULTIES, chooseMove, difficultyInfo, leaderFor } from '../src/game/cpu.js';
import { HUMAN } from '../src/game/types.js';
import type { CpuBrain, DifficultyId, GameState, PlayerCount } from '../src/game/types.js';

/**
 * Reproduces every measured number quoted in the README.
 *
 * The human seat is driven by a CPU brain so that seat and brain can be varied
 * independently — the whole point being that the seat turns out to matter more.
 */
function run(seedCode: string, difficulty: DifficultyId, players: PlayerCount, humanBrain: CpuBrain) {
  const cpuBrain = difficultyInfo(difficulty).brain;
  let state = deal(seedCode, difficulty, { players, blackAces: false }, leaderFor(difficulty, players));
  let guard = 0;

  while (state.phase !== 'over' && guard++ < 400) {
    if (state.phase === 'flip') {
      state = flip(state);
      continue;
    }

    if (state.phase === 'pick_play' || state.phase === 'pick_flip') {
      const best = [...capturableBy(state.pending!, state.table)].sort(
        (a, b) => pointsOf(b) - pointsOf(a),
      )[0];
      state = choosePick(state, best.id);
      continue;
    }

    const brain = state.turn === HUMAN ? humanBrain : cpuBrain;
    const move = chooseMove(state, brain);
    state = state.turn === HUMAN ? playCard(state, move.card.id) : applyPlay(state, move.card, move.taken);
  }

  return outcome(state);
}

const N = Number(process.env.N ?? 1500);

/** 95% interval on the difference between two win rates, in percentage points. */
function diffCI(winsA: number, winsB: number, n: number): { diff: number; halfWidth: number } {
  const pa = winsA / n;
  const pb = winsB / n;
  const se = Math.sqrt((pa * (1 - pa)) / n + (pb * (1 - pb)) / n);
  return { diff: (pa - pb) * 100, halfWidth: 1.96 * se * 100 };
}

console.log(`${N} deals per row. The human seat plays the sharp brain throughout.\n`);
console.log('players  difficulty  seat  playerAvg  par        win%        合格%');

const winsBy = new Map<string, number>();

for (const players of [2, 3, 4] as PlayerCount[]) {
  for (const info of DIFFICULTIES) {
    let points = 0;
    let wins = 0;
    let passes = 0;
    let par = 0;

    for (let i = 0; i < N; i++) {
      const result = run(`lad-${i}`, info.id, players, 'sharp');
      points += result.scores[HUMAN];
      par = result.par;
      if (result.result === 'win') wins++;
      if (result.scores[HUMAN] > result.par) passes++;
    }

    winsBy.set(`${players}/${info.id}`, wins);
    const p = wins / N;
    const hw = 1.96 * Math.sqrt((p * (1 - p)) / N) * 100;
    console.log(
      `${String(players).padEnd(9)}${info.label.padEnd(12)}${(info.humanLast ? '後' : '先').padEnd(6)}` +
        `${(points / N).toFixed(1).padStart(9)}${String(par).padStart(7)}` +
        `${((wins / N) * 100).toFixed(1).padStart(9)} ± ${hw.toFixed(1).padEnd(5)}` +
        `${((passes / N) * 100).toFixed(1).padStart(8)}`,
    );
  }
}

// The ladder claim, tested rather than eyeballed.
//
// Two intervals that overlap can still have a difference that excludes zero,
// so checking the rows against each other by eye is the wrong test — it is
// strictly more conservative than testing the difference, and calls real
// effects absent. Each rung gets its own interval.
//
// The two rungs are also different KINDS of change: easy -> normal swaps the
// opponents' brain and nothing else, normal -> hard swaps the seat order and
// nothing else. Printing them separately is what showed that the seat is worth
// roughly three times the brain, and that the brain rung used to be worth
// nothing at all once a third player sat down.
console.log('\n--- Is each rung of the ladder a real step? ---\n');
for (const players of [2, 3, 4] as PlayerCount[]) {
  for (const [easier, harder, axis] of [
    ['easy', 'normal', 'opponent brain'],
    ['normal', 'hard', 'seat order'],
  ] as const) {
    const { diff, halfWidth } = diffCI(winsBy.get(`${players}/${easier}`) ?? 0, winsBy.get(`${players}/${harder}`) ?? 0, N);
    const clears = diff - halfWidth > 0;
    console.log(
      `  ${players}p  ${easier.padEnd(6)} over ${harder.padEnd(6)} (${axis.padEnd(14)}) ` +
        `${diff >= 0 ? '+' : ''}${diff.toFixed(1)}pp [${(diff - halfWidth).toFixed(1)}, ${(diff + halfWidth).toFixed(1)}]  ` +
        `${clears ? '✓ clears zero' : '✗ DOES NOT clear zero — these two settings are the same difficulty'}`,
    );
  }
}

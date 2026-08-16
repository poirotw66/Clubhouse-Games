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

console.log(`${N} deals per row. The human seat plays the sharp brain throughout.\n`);
console.log('players  difficulty  seat  playerAvg  par     win%   合格%');

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

    console.log(
      `${String(players).padEnd(9)}${info.label.padEnd(12)}${(info.humanLast ? '後' : '先').padEnd(6)}` +
        `${(points / N).toFixed(1).padStart(9)}${String(par).padStart(7)}` +
        `${((wins / N) * 100).toFixed(1).padStart(8)}${((passes / N) * 100).toFixed(1).padStart(8)}`,
    );
  }
}

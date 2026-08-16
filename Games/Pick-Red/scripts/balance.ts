import { capturableBy, pointsOf } from '../src/game/cards.js';
import { deal, applyCpuPlay, choosePick, flip, playCard, outcome } from '../src/game/engine.js';
import { DIFFICULTIES, chooseMove, difficultyInfo } from '../src/game/cpu.js';
import type { CpuBrain, DifficultyId, GameState } from '../src/game/types.js';

/** Run a CPU brain in the player's seat, so seat and brain can be varied apart. */
function mirrored(s: GameState): GameState {
  return { ...s, hands: { player: s.hands.cpu, cpu: s.hands.player },
    captured: { player: s.captured.cpu, cpu: s.captured.player } };
}

function run(seedCode: string, difficulty: DifficultyId, humanBrain: CpuBrain) {
  const info = difficultyInfo(difficulty);
  let s = deal(seedCode, difficulty, info.leader);
  let g = 0;
  while (s.phase !== 'over' && g++ < 300) {
    if (s.phase === 'flip') { s = flip(s); continue; }
    if (s.phase === 'player_play' || s.phase === 'player_pick') {
      const m = chooseMove(mirrored(s), humanBrain);
      s = playCard(s, m.card.id);
      if (s.phase === 'player_pick') {
        const opts = capturableBy(s.pending!, s.table).sort((a, b) => pointsOf(b) - pointsOf(a));
        s = choosePick(s, opts[0].id);
      }
      continue;
    }
    const m = chooseMove(s, info.brain);
    s = applyCpuPlay(s, m.card, m.taken);
  }
  return outcome(s);
}

const N = 1500;
console.log('difficulty  seat    cpuBrain   playerAvg  cpuAvg  playerWin%  draw%');
for (const d of DIFFICULTIES) {
  for (const human of ['sharp'] as CpuBrain[]) {
    let p = 0, c = 0, w = 0, dr = 0;
    for (let i = 0; i < N; i++) {
      const o = run(`lad-${i}`, d.id, human);
      p += o.playerPoints; c += o.cpuPoints;
      if (o.result === 'win') w++; else if (o.result === 'draw') dr++;
    }
    console.log(
      `${d.label.padEnd(12)}${(d.leader === 'cpu' ? '後手' : '先手').padEnd(8)}${d.brain.padEnd(11)}` +
      `${(p/N).toFixed(1).padStart(9)}${(c/N).toFixed(1).padStart(8)}${((w/N)*100).toFixed(1).padStart(12)}${((dr/N)*100).toFixed(1).padStart(7)}`,
    );
  }
}

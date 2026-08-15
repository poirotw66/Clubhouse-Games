// ponytail: assert fair-ball grading uses quality, and difficulty tables stay ordered.
import {
  DIFFICULTY,
  gradeFairLanding,
  cpuSwingTargetY,
} from './difficulty.ts';
import {
  EMPTY_BESTS,
  STORAGE_KEY,
  STORAGE_KEY_V2,
  loadBests,
  loadBestsMap,
  saveBests,
  updateDerbyBests,
  updateMatchBests,
} from './stats.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// Crushed contact at medium depth stays a hit; weak contact becomes an out.
{
  const cfg = DIFFICULTY.normal;
  const crush = gradeFairLanding(250, 0.9, cfg);
  assert(crush.bases >= 1, `crushed medium ball should be a hit, got ${crush.result}`);
  const weak = gradeFairLanding(250, 0.1, cfg);
  assert(weak.bases === 0, `weak medium ball should be out, got ${weak.result}`);
}

// Hard is stricter on the player and sharper for the CPU.
assert(DIFFICULTY.hard.hitRadius < DIFFICULTY.easy.hitRadius, 'hard hit window should be smaller');
assert(DIFFICULTY.hard.cpuAimSkill > DIFFICULTY.easy.cpuAimSkill, 'hard CPU should aim better');
assert(DIFFICULTY.hard.cpuPitchDelayMax < DIFFICULTY.easy.cpuPitchDelayMin, 'hard pitches sooner');

// Target Y stays near the plate.
{
  const y = cpuSwingTargetY(1, () => 0.5);
  assert(Math.abs(y - 448) < 1, `perfect skill should aim ~448, got ${y}`);
}

// Match: win bumps wins/streak/best runs; loss clears streak.
{
  const afterWin = updateMatchBests(EMPTY_BESTS, 5, 2);
  assert(afterWin.matchWins === 1, 'win should count');
  assert(afterWin.matchWinStreak === 1, 'win should start streak');
  assert(afterWin.matchBestWinStreak === 1, 'win should set best streak');
  assert(afterWin.matchBestRuns === 5, 'win should record runs');
  const afterLoss = updateMatchBests(afterWin, 1, 3);
  assert(afterLoss.matchWins === 1, 'loss should keep career wins');
  assert(afterLoss.matchWinStreak === 0, 'loss should clear streak');
  assert(afterLoss.matchBestWinStreak === 1, 'loss should keep best streak');
  assert(afterLoss.matchBestRuns === 5, 'loss should keep best runs');
  const afterTie = updateMatchBests(afterWin, 2, 2);
  assert(afterTie.matchWinStreak === 0, 'tie should clear streak');
}

// Derby: keep max HRs and distance only.
{
  const a = updateDerbyBests(EMPTY_BESTS, 2, 400);
  const b = updateDerbyBests(a, 1, 500);
  assert(b.derbyBestHrs === 2, 'derby should keep max HRs');
  assert(b.derbyBestDist === 500, 'derby should keep max distance');
}

// Load/save round-trip keyed by difficulty + legacy migrate.
{
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => {
      mem.set(k, v);
    },
  };
  assert(loadBests('normal', storage).matchWins === 0, 'empty storage should yield empty bests');
  const written = updateMatchBests(EMPTY_BESTS, 4, 0);
  saveBests('hard', written, storage);
  assert(mem.has(STORAGE_KEY_V2), 'save should write v2 key');
  assert(loadBests('hard', storage).matchWins === 1, 'hard slot restored');
  assert(loadBests('easy', storage).matchWins === 0, 'other slot empty');

  mem.clear();
  mem.set(STORAGE_KEY, JSON.stringify({ matchWins: 2, matchWinStreak: 2, matchBestRuns: 7 }));
  const migrated = loadBestsMap(storage);
  assert(migrated.normal.matchWins === 2, 'legacy → normal');
  assert(migrated.hard.matchWins === 0, 'legacy does not fill hard');
  assert(mem.has(STORAGE_KEY_V2), 'migration writes v2');
}

console.log('check-baseball: ok');

// ponytail: assert career stats merge + streak update (no DOM needed).
import {
  DEFAULT_STATS,
  STATS_KEY,
  loadStats,
  mergeStats,
  modeStats,
  recordResult,
  saveStats,
  withDifficulty,
} from './stats.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// mergeStats: corrupt / partial → defaults filled; legacy flat → normal.
{
  const m = mergeStats({ wins: 3, winStreak: -2, lastDifficulty: 'nightmare' });
  assert(m.byDifficulty.normal.wins === 3, `legacy wins → normal, got ${m.byDifficulty.normal.wins}`);
  assert(m.byDifficulty.normal.losses === 0, 'missing losses → 0');
  assert(m.byDifficulty.normal.draws === 0, 'missing draws → 0');
  assert(m.byDifficulty.normal.winStreak === 0, `negative streak clamped`);
  assert(m.lastDifficulty === 'normal', `bad difficulty → normal, got ${m.lastDifficulty}`);
  assert(mergeStats(null).byDifficulty.easy.wins === 0, 'null → defaults');
  assert(mergeStats('nope').byDifficulty.hard.wins === 0, 'non-object → defaults');
}

// recordResult: win streak climbs + best streak; loss/draw reset current only.
{
  let s = mergeStats(null);
  s = recordResult(s, 'win', 'hard');
  s = recordResult(s, 'win', 'hard');
  const hard = modeStats(s, 'hard');
  assert(hard.wins === 2 && hard.winStreak === 2 && hard.bestWinStreak === 2, `hard streak, got ${JSON.stringify(hard)}`);
  assert(modeStats(s, 'easy').wins === 0, 'other difficulty untouched');
  s = recordResult(s, 'loss', 'hard');
  assert(modeStats(s, 'hard').winStreak === 0 && modeStats(s, 'hard').bestWinStreak === 2, 'loss keeps best');
  s = recordResult(s, 'win', 'hard');
  s = recordResult(s, 'draw', 'hard');
  assert(modeStats(s, 'hard').draws === 1 && modeStats(s, 'hard').winStreak === 0, 'draw resets streak');
}

// load/save round-trip via fake storage.
{
  const store = new Map();
  const fake = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  };
  assert(loadStats(fake).byDifficulty.normal.wins === 0, 'empty storage → defaults');
  const next = withDifficulty(recordResult(DEFAULT_STATS, 'win', 'hard'), 'hard');
  saveStats(next, fake);
  assert(store.has(STATS_KEY), 'key written');
  const loaded = loadStats(fake);
  assert(modeStats(loaded, 'hard').wins === 1 && modeStats(loaded, 'hard').winStreak === 1, `loaded wins`);
  assert(loaded.lastDifficulty === 'hard', `loaded difficulty, got ${loaded.lastDifficulty}`);
}

console.log('check-stats: ok');

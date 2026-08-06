// ponytail: assert career stats merge + streak update (no DOM needed).
import {
  DEFAULT_STATS,
  STATS_KEY,
  loadStats,
  mergeStats,
  recordResult,
  saveStats,
  withDifficulty,
} from './stats.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// mergeStats: corrupt / partial → defaults filled.
{
  const m = mergeStats({ wins: 3, winStreak: -2, lastDifficulty: 'nightmare' });
  assert(m.wins === 3, `wins kept, got ${m.wins}`);
  assert(m.losses === 0, 'missing losses → 0');
  assert(m.draws === 0, 'missing draws → 0');
  assert(m.winStreak === 0, `negative streak clamped, got ${m.winStreak}`);
  assert(m.lastDifficulty === 'normal', `bad difficulty → normal, got ${m.lastDifficulty}`);
  assert(mergeStats(null).wins === 0, 'null → defaults');
  assert(mergeStats('nope').wins === 0, 'non-object → defaults');
}

// recordResult: win streak climbs; loss/draw reset.
{
  let s = { ...DEFAULT_STATS };
  s = recordResult(s, 'win');
  s = recordResult(s, 'win');
  assert(s.wins === 2 && s.winStreak === 2, `two wins → streak 2, got ${JSON.stringify(s)}`);
  s = recordResult(s, 'loss');
  assert(s.losses === 1 && s.winStreak === 0 && s.wins === 2, `loss resets streak, got ${JSON.stringify(s)}`);
  s = recordResult(s, 'win');
  s = recordResult(s, 'draw');
  assert(s.draws === 1 && s.winStreak === 0, `draw resets streak, got ${JSON.stringify(s)}`);
}

// load/save round-trip via fake storage.
{
  const store = new Map();
  const fake = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  };
  assert(loadStats(fake).wins === 0, 'empty storage → defaults');
  const next = withDifficulty(recordResult(DEFAULT_STATS, 'win'), 'hard');
  saveStats(next, fake);
  assert(store.has(STATS_KEY), 'key written');
  const loaded = loadStats(fake);
  assert(loaded.wins === 1 && loaded.winStreak === 1, `loaded wins, got ${JSON.stringify(loaded)}`);
  assert(loaded.lastDifficulty === 'hard', `loaded difficulty, got ${loaded.lastDifficulty}`);
}

console.log('check-stats: ok');

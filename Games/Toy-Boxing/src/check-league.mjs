// ponytail: league unlock cursor + corrupt storage merge.
import { OPPONENTS, opponentCount } from './opponents.ts';
import {
  EMPTY_LEAGUE,
  LEAGUE_KEY,
  applyLeagueWin,
  continueLeagueIndex,
  isLeagueComplete,
  isOpponentUnlocked,
  loadLeague,
  mergeLeague,
  saveLeague,
} from './league.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(opponentCount() === 6, `expected 6 opponents, got ${opponentCount()}`);
assert(OPPONENTS.length === 6, 'OPPONENTS length');

// Distinct style personalities (not the same reactChance clone).
{
  const aggressions = OPPONENTS.map((o) => o.style.aggression);
  const biases = OPPONENTS.map((o) => o.style.highLowBias);
  const feints = OPPONENTS.map((o) => o.style.feintRate);
  assert(new Set(aggressions.map((n) => n.toFixed(2))).size >= 4, 'aggression should vary');
  assert(Math.min(...biases) < -0.4 && Math.max(...biases) > 0.4, 'high/low bias should swing both ways');
  assert(Math.max(...feints) > 0.3, 'at least one feint-heavy boxer');
  for (const o of OPPONENTS) {
    assert(o.signature?.name && o.signature.windup >= 0.15, `${o.id} needs signature`);
    assert(o.catchphrases?.taunt, `${o.id} needs catchphrases`);
  }
}

// Unlock ladder: only frontier advances clearedCount.
{
  let p = mergeLeague(null);
  assert(isOpponentUnlocked(0, p.clearedCount), 'first always open');
  assert(!isOpponentUnlocked(1, p.clearedCount), 'second locked');
  const r0 = applyLeagueWin(p, 0, 120);
  assert(r0.newlyCleared && r0.progress.clearedCount === 1, 'beat #0 unlocks #1');
  p = r0.progress;
  assert(isOpponentUnlocked(1, p.clearedCount), 'second unlocked');
  // Beating an already-open but not frontier opponent shouldn't skip.
  const r1 = applyLeagueWin(p, 0, 200);
  assert(r1.progress.clearedCount === 1, 're-beating #0 should not advance cursor');
  assert(r1.progress.bestScore.pillow === 200, 'best score updates');
}

// Complete pack.
{
  let p = mergeLeague(null);
  for (let i = 0; i < opponentCount(); i++) {
    p = applyLeagueWin(p, i, 50 + i).progress;
  }
  assert(isLeagueComplete(p), 'all six cleared');
  assert(continueLeagueIndex(p.clearedCount) === opponentCount() - 1, 'continue stays on last');
}

// Corrupt storage.
{
  assert(mergeLeague('nope').clearedCount === 0, 'junk → empty');
  assert(mergeLeague({ clearedCount: -3, lastIndex: 99 }).clearedCount === 0, 'neg cleared');
  assert(mergeLeague({ clearedCount: 99 }).clearedCount === 6, 'cleared clamped');
  const store = new Map();
  const fake = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, v),
  };
  const next = applyLeagueWin(EMPTY_LEAGUE, 0, 10).progress;
  saveLeague(next, fake);
  assert(store.has(LEAGUE_KEY), 'key written');
  const loaded = loadLeague(fake);
  assert(loaded.clearedCount === 1 && loaded.cleared.pillow, 'round-trip');
}

console.log('check-league: ok');

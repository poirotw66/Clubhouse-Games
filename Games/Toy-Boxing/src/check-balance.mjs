// ponytail: league ladder style separation + jab/hook mix + character spreads.
import { CHARACTERS } from './characters.ts';
import { emptyHabit, recordPlayerHeight } from './combat.ts';
import { decideCpuIntent, resolveStyle } from './cpuAi.ts';
import { OPPONENTS, opponentCount } from './opponents.ts';
import { LEAGUE_KEY, mergeLeague } from './league.ts';
import { STATS_KEY, mergeStats } from './stats.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function attackMix(opponentId, dist, samples = 400) {
  let jab = 0;
  let hook = 0;
  let high = 0;
  let low = 0;
  let feint = 0;
  let mem = emptyHabit();
  for (let i = 0; i < 8; i++) mem = recordPlayerHeight(mem, i % 2 === 0 ? 'high' : 'low');
  const rng = mulberry32(1000 + opponentId.length * 31 + dist);
  for (let i = 0; i < samples; i++) {
    const intent = decideCpuIntent({
      dist,
      stamina: 90,
      superMeter: i % 9 === 0 ? 100 : 25,
      opponentAction: 'IDLE',
      opponentHeight: null,
      opponentInWindup: false,
      lastHitHeight: null,
      habit: mem,
      difficulty: 'normal',
      opponentId,
      rng,
    });
    if (intent.type !== 'act') continue;
    if (intent.feint) feint += 1;
    if (intent.action === 'JAB' || intent.action === 'HOOK') {
      if (intent.action === 'JAB') jab += 1;
      else hook += 1;
      if (intent.height === 'high') high += 1;
      else low += 1;
    }
  }
  const atk = jab + hook;
  return {
    jab,
    hook,
    high,
    low,
    feint,
    atk,
    jabShare: atk ? jab / atk : 0,
    highShare: atk ? high / atk : 0,
  };
}

assert(opponentCount() === 6, 'six league rungs');
assert(LEAGUE_KEY === 'clubhouse-toy-boxing-league', 'league save key stable');
assert(STATS_KEY === 'clubhouse-toy-boxing-stats', 'stats save key stable');

// Existing saves must still merge (no schema break).
{
  const legacy = mergeLeague({
    clearedCount: 2,
    bestScore: { pillow: 80, rush: 40 },
    cleared: { pillow: true, rush: true },
    lastIndex: 1,
  });
  assert(legacy.clearedCount === 2 && legacy.cleared.rush, 'league merge keeps progress');
  const stats = mergeStats({
    lastDifficulty: 'hard',
    byDifficulty: {
      easy: { wins: 1, losses: 0, draws: 0, winStreak: 1, bestWinStreak: 1 },
      normal: { wins: 0, losses: 0, draws: 0, winStreak: 0, bestWinStreak: 0 },
      hard: { wins: 3, losses: 1, draws: 0, winStreak: 2, bestWinStreak: 2 },
    },
  });
  assert(stats.byDifficulty.hard.wins === 3, 'stats merge keeps career');
}

// Difficulty / personality ladder (not a flat clone).
{
  const pillow = resolveStyle('normal', 'pillow');
  const rush = resolveStyle('normal', 'rush');
  const needle = resolveStyle('normal', 'needle');
  const feint = resolveStyle('normal', 'feint');
  const iron = resolveStyle('normal', 'ironbelly');
  const champ = resolveStyle('normal', 'champ');

  assert(pillow.aggression < rush.aggression, 'pillow calmer than rush');
  assert(pillow.reactChance < champ.reactChance, 'champ reacts harder than pillow');
  assert(needle.hookBias < 0.25, 'needle stays jab-leaning');
  assert(rush.hookBias > 0.55, 'rush leans hooks');
  assert(feint.feintRate > 0.35, 'feint rabbit feints a lot');
  assert(iron.highLowBias < -0.5, 'ironbelly body bias');
  assert(champ.adaptHabit > feint.adaptHabit, 'champ reads habits hardest');
}

// Simulated mixes at striking distance.
{
  const needle = attackMix('needle', 88);
  assert(needle.atk >= 80, `needle should attack often, atk=${needle.atk}`);
  assert(
    needle.jabShare >= 0.55,
    `needle jab share should dominate close range, got ${(needle.jabShare * 100).toFixed(0)}%`,
  );
  assert(needle.highShare >= 0.7, `needle should favor high, got ${needle.highShare}`);

  const iron = attackMix('ironbelly', 88);
  assert(iron.atk >= 60, `ironbelly should attack, atk=${iron.atk}`);
  assert(iron.highShare <= 0.35, `ironbelly should favor low, high=${iron.highShare}`);

  const pillow = attackMix('pillow', 100);
  assert(pillow.atk >= 40, `pillow must throw enough to teach, atk=${pillow.atk}`);
  assert(pillow.highShare <= 0.45, `pillow should lean low, high=${pillow.highShare}`);

  const feint = attackMix('feint', 95);
  assert(feint.feint >= 20, `feint rabbit should feint often, feints=${feint.feint}`);

  const rush = attackMix('rush', 80);
  assert(rush.jabShare <= 0.4, `rush should prefer hooks, jabShare=${rush.jabShare}`);
  assert(rush.highShare >= 0.65, `rush high bias, high=${rush.highShare}`);
}

// Playable roster: no single toy with both best power and best health.
{
  const byPower = [...CHARACTERS].sort((a, b) => b.power - a.power);
  const byHp = [...CHARACTERS].sort((a, b) => b.health - a.health);
  assert(byPower[0].id !== byHp[0].id || byPower[0].speed < 1, 'no pure all-stats bully');
  const bunny = CHARACTERS.find((c) => c.id === 'bunny');
  const bear = CHARACTERS.find((c) => c.id === 'bear');
  assert(bunny.health >= 90, 'bunny should not be glass-cannon fragile');
  assert(bear.power <= 1.18, 'bear power capped after polish');
  assert(bunny.speed > bear.speed, 'speed tradeoff preserved');
}

// Signature defs remain distinct and wired for overrides.
{
  const winds = OPPONENTS.map((o) => o.signature.windup);
  assert(Math.max(...winds) - Math.min(...winds) >= 0.1, 'signature windups should vary');
  assert(
    OPPONENTS.some((o) => o.signature.height === 'low'),
    'at least one low signature',
  );
  assert(
    OPPONENTS.some((o) => o.signature.unblockable === false),
    'at least one blockable signature',
  );
}

console.log('check-balance: ok');

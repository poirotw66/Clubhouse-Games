// ponytail: assert CPU difficulty reacts instead of pure coin-flips.
import { decideCpuIntent, DIFFICULTY, DIFFICULTY_BLURBS } from './cpuAi.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const seed = (values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

// Hard: player jabbing in range should usually defend (not jab into it).
{
  let defend = 0;
  for (let i = 0; i < 40; i++) {
    const intent = decideCpuIntent({
      dist: 90,
      stamina: 80,
      superMeter: 0,
      opponentAction: 'JAB',
      difficulty: 'hard',
      rng: () => (i * 0.07) % 1,
    });
    if (intent.type === 'act' && ['BLOCK', 'DODGE', 'PARRY'].includes(intent.action)) defend += 1;
  }
  assert(defend >= 20, `hard should often defend incoming jabs, got ${defend}/40`);
}

// Easy: farther from preferred distance → move in.
{
  const intent = decideCpuIntent({
    dist: 200,
    stamina: 100,
    superMeter: 0,
    opponentAction: 'IDLE',
    difficulty: 'easy',
    rng: seed([0.1, 0.2, 0.3]),
  });
  assert(intent.type === 'move', `easy far away should close distance, got ${intent.type}`);
}

// Difficulty tables must stay ordered: hard reacts more than easy.
assert(
  DIFFICULTY.hard.reactChance > DIFFICULTY.normal.reactChance
    && DIFFICULTY.normal.reactChance > DIFFICULTY.easy.reactChance,
  'reactChance should rise with difficulty',
);
assert(
  DIFFICULTY.hard.mistakeChance < DIFFICULTY.easy.mistakeChance,
  'hard should mistake less than easy',
);
assert(
  DIFFICULTY.hard.parryShare > DIFFICULTY.normal.parryShare
    && DIFFICULTY.normal.parryShare > DIFFICULTY.easy.parryShare,
  'parryShare should rise with difficulty',
);
assert(
  DIFFICULTY.hard.thinkMax < DIFFICULTY.easy.thinkMin,
  'hard should think faster than easy',
);

// Easy should fail to react more often than hard on the same incoming jab stream.
{
  let easyReact = 0;
  let hardReact = 0;
  for (let i = 0; i < 50; i++) {
    const rng = () => ((i * 0.13) % 1);
    const easy = decideCpuIntent({
      dist: 90,
      stamina: 80,
      superMeter: 0,
      opponentAction: 'JAB',
      difficulty: 'easy',
      rng,
    });
    const hard = decideCpuIntent({
      dist: 90,
      stamina: 80,
      superMeter: 0,
      opponentAction: 'JAB',
      difficulty: 'hard',
      rng,
    });
    if (easy.type === 'act' && ['BLOCK', 'DODGE', 'PARRY'].includes(easy.action)) easyReact += 1;
    if (hard.type === 'act' && ['BLOCK', 'DODGE', 'PARRY'].includes(hard.action)) hardReact += 1;
  }
  assert(
    hardReact > easyReact + 8,
    `hard should defend incoming jabs more than easy (${hardReact} vs ${easyReact})`,
  );
}

// Player-facing blurbs must stay distinct so the setup screen shows three feels.
{
  const blurbs = Object.values(DIFFICULTY_BLURBS);
  assert(blurbs.length === 3, 'expected three difficulty blurbs');
  assert(new Set(blurbs).size === 3, 'difficulty blurbs must be unique');
  for (const [id, text] of Object.entries(DIFFICULTY_BLURBS)) {
    assert(typeof text === 'string' && text.length >= 4, `${id} blurb too short`);
  }
}

console.log('check-cpu: ok');

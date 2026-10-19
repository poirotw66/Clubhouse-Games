// ponytail: assert CPU difficulty + habit-adaptive league styles.
import { emptyHabit, recordPlayerHeight } from './combat.ts';
import {
  DIFFICULTY,
  DIFFICULTY_BLURBS,
  decideCpuIntent,
  resolveStyle,
} from './cpuAi.ts';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const seed = (values) => {
  let i = 0;
  return () => values[i++ % values.length];
};

function baseInput(over = {}) {
  return {
    dist: 90,
    stamina: 80,
    superMeter: 0,
    opponentAction: 'JAB',
    opponentHeight: 'high',
    opponentInWindup: true,
    lastHitHeight: null,
    habit: emptyHabit(),
    difficulty: 'hard',
    opponentId: null,
    ...over,
  };
}

// Hard: player jabbing in range should usually defend.
{
  let defend = 0;
  for (let i = 0; i < 40; i++) {
    const intent = decideCpuIntent({
      ...baseInput({
        difficulty: 'hard',
        rng: () => (i * 0.07) % 1,
      }),
    });
    if (intent.type === 'act' && ['BLOCK', 'DODGE', 'PARRY'].includes(intent.action)) defend += 1;
  }
  assert(defend >= 20, `hard should often defend incoming jabs, got ${defend}/40`);
}

// Easy: farther from preferred distance → move in.
{
  const intent = decideCpuIntent({
    ...baseInput({
      dist: 200,
      stamina: 100,
      opponentAction: 'IDLE',
      opponentInWindup: false,
      opponentHeight: null,
      difficulty: 'easy',
      rng: seed([0.1, 0.2, 0.3]),
    }),
  });
  assert(intent.type === 'move', `easy far away should close distance, got ${intent.type}`);
}

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
assert(
  DIFFICULTY.hard.adaptHabit > DIFFICULTY.easy.adaptHabit,
  'hard should adapt to habits more',
);

// Easy should fail to react more often than hard on the same incoming jab stream.
{
  let easyReact = 0;
  let hardReact = 0;
  for (let i = 0; i < 50; i++) {
    const rng = () => (i * 0.13) % 1;
    const easy = decideCpuIntent({ ...baseInput({ difficulty: 'easy', rng }) });
    const hard = decideCpuIntent({ ...baseInput({ difficulty: 'hard', rng }) });
    if (easy.type === 'act' && ['BLOCK', 'DODGE', 'PARRY'].includes(easy.action)) easyReact += 1;
    if (hard.type === 'act' && ['BLOCK', 'DODGE', 'PARRY'].includes(hard.action)) hardReact += 1;
  }
  assert(
    hardReact > easyReact + 8,
    `hard should defend incoming jabs more than easy (${hardReact} vs ${easyReact})`,
  );
}

// Champ mirrors player high bias when adapting.
{
  let mem = emptyHabit();
  for (let i = 0; i < 10; i++) mem = recordPlayerHeight(mem, 'high');
  let highGuards = 0;
  for (let i = 0; i < 30; i++) {
    const intent = decideCpuIntent({
      ...baseInput({
        opponentAction: 'WINDUP',
        opponentHeight: 'high',
        opponentInWindup: true,
        habit: mem,
        opponentId: 'champ',
        difficulty: 'normal',
        rng: () => (0.2 + i * 0.03) % 1,
      }),
    });
    if (intent.type === 'act' && intent.height === 'high') highGuards += 1;
  }
  assert(highGuards >= 12, `champ should often guard high vs high-habit player, got ${highGuards}`);
}

// Ironbelly prefers low attacks when free to swing.
{
  let lowAttacks = 0;
  let samples = 0;
  for (let i = 0; i < 40; i++) {
    const intent = decideCpuIntent({
      ...baseInput({
        dist: 85,
        stamina: 90,
        opponentAction: 'IDLE',
        opponentInWindup: false,
        opponentHeight: null,
        opponentId: 'ironbelly',
        difficulty: 'normal',
        rng: () => (0.15 + i * 0.05) % 1,
      }),
    });
    if (intent.type === 'act' && (intent.action === 'JAB' || intent.action === 'HOOK')) {
      samples += 1;
      if (intent.height === 'low') lowAttacks += 1;
    }
  }
  assert(samples >= 5, `ironbelly should attack sometimes, samples=${samples}`);
  assert(lowAttacks >= samples * 0.45, `ironbelly should favor low (${lowAttacks}/${samples})`);
}

// League styles differ from plain difficulty.
{
  const champ = resolveStyle('normal', 'champ');
  const pillow = resolveStyle('normal', 'pillow');
  const free = resolveStyle('normal', null);
  assert(champ.adaptHabit > pillow.adaptHabit, 'champ adapts more than pillow');
  assert(pillow.defenseBias > champ.defenseBias * 0.5, 'pillow more defensive');
  assert(champ.adaptHabit > free.adaptHabit, 'champ harder habit read than free normal');
}

{
  const blurbs = Object.values(DIFFICULTY_BLURBS);
  assert(blurbs.length === 3, 'expected three difficulty blurbs');
  assert(new Set(blurbs).size === 3, 'difficulty blurbs must be unique');
  for (const [id, text] of Object.entries(DIFFICULTY_BLURBS)) {
    assert(typeof text === 'string' && text.length >= 4, `${id} blurb too short`);
  }
}

console.log('check-cpu: ok');

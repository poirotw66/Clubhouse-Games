/**
 * Reproduces the numbers quoted in the README: whether the regular-season
 * situations actually change a tenure. Every phase but the block uses the same
 * policy, so the spread below is the block choices alone.
 */
import { acknowledge, createGame, resolve } from '../src/game/engine.js';
import type { Decision, GameState } from '../src/game/types.js';

type Chooser = (d: Decision, step: number) => string;
const on = (d: Decision) => d.options.filter((o) => !o.disabled);

function run(seed: string, choose: Chooser) {
  let s: GameState = createGame({ seedCode: seed, gmName: '測試', teamId: 'dolphins' });
  let step = 0;
  while (!s.over && step < 400) {
    const d = s.decision;
    if (!d || d.phase === 'over' || d.options.length === 0) break;
    s = acknowledge(resolve(s, choose(d, step)));
    step++;
  }
  return s;
}

/** Only the regular-season blocks differ between these; everything else is the same policy. */
const blockFirst: Chooser = (d) => on(d)[0].id;
const blockLast: Chooser = (d) => (d.phase === 'block' ? on(d)[on(d).length - 1].id : on(d)[0].id);
const blockCash: Chooser = (d) =>
  d.phase === 'block'
    ? [...on(d)].sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))[0].id
    : on(d)[0].id;

const seeds = Array.from({ length: 60 }, (_, i) => `imp-${i}`);
for (const [label, chooser] of [
  ['block=first ', blockFirst],
  ['block=last  ', blockLast],
  ['block=cheap ', blockCash],
] as [string, Chooser][]) {
  let score = 0, cash = 0, titles = 0, fired = 0;
  for (const seed of seeds) {
    const end = run(seed, chooser);
    score += end.summary?.score ?? 0;
    cash += end.finance.cash;
    titles += end.summary?.titles ?? 0;
    if (end.summary?.fired) fired++;
  }
  const n = seeds.length;
  console.log(
    `${label} 分數 ${(score / n).toFixed(1).padStart(6)}   資金 ${(cash / n).toFixed(0).padStart(7)}   冠軍 ${(titles / n).toFixed(2)}   被開除 ${((fired / n) * 100).toFixed(0)}%`,
  );
}

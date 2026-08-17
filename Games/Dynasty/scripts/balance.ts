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
/**
 * Policies have to mean the same thing before and after a content change.
 *
 * The first version of this file fell back to `options[0]` for every phase
 * except the block. That was not policy-neutral: under the old fixed menus
 * `options[0]` was `train-lean` (cost 0, bonus -1, morale -2) and the cheapest
 * budget — deliberately the worst plan, every single year. Against a scenario
 * pool, `options[0]` is just whatever that scenario lists first. Comparing the
 * two therefore measured "always pick the worst plan" against "pick a normal
 * one" and reported it as the game getting easier. It was not.
 *
 * These three apply the same intent at *every* decision instead.
 */
const spendMost: Chooser = (d) =>
  [...on(d)].sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))[0].id;
const spendLeast: Chooser = (d) =>
  [...on(d)].sort((a, b) => (a.cost ?? 0) - (b.cost ?? 0))[0].id;
const alternate: Chooser = (d, step) => on(d)[step % on(d).length].id;

const seeds = Array.from({ length: 60 }, (_, i) => `imp-${i}`);
for (const [label, chooser] of [
  ['砸錢投資  ', spendMost],
  ['輪流嘗試  ', alternate],
  ['囤錢不花  ', spendLeast],
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

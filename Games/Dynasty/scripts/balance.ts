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

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const sd = (xs: number[]): number => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length || 1));
};
/** 95% half-width of the mean. */
const meanHW = (xs: number[]): number => 1.96 * (sd(xs) / Math.sqrt(xs.length || 1));
/** 95% half-width on a proportion, in percentage points. */
const rateHW = (k: number, n: number): number => {
  const p = k / n;
  return 1.96 * Math.sqrt((p * (1 - p)) / n) * 100;
};
/** 95% interval on the difference between two independent means. */
const diffHW = (a: number[], b: number[]): number =>
  1.96 * Math.sqrt(sd(a) ** 2 / a.length + sd(b) ** 2 / b.length);

/**
 * Sixty seeds was enough to rank the policies and not enough to say anything
 * about the two below the top. Reported without intervals, the middle and
 * bottom rows read as a ranking — 1,725.5 against 1,688.3 — while the same two
 * rows put them the other way round on titles (1.92 against 2.13). A table that
 * contradicts itself between columns is a table whose rows are inside each
 * other's noise, and nothing in the output said so.
 */
const seeds = Array.from({ length: 60 }, (_, i) => `imp-${i}`);
const runs = new Map<string, { score: number[]; cash: number[]; titles: number[]; fired: number }>();

for (const [label, chooser] of [
  ['砸錢投資  ', spendMost],
  ['輪流嘗試  ', alternate],
  ['囤錢不花  ', spendLeast],
] as [string, Chooser][]) {
  const score: number[] = [];
  const cash: number[] = [];
  const titles: number[] = [];
  let fired = 0;
  for (const seed of seeds) {
    const end = run(seed, chooser);
    score.push(end.summary?.score ?? 0);
    cash.push(end.finance.cash);
    titles.push(end.summary?.titles ?? 0);
    if (end.summary?.fired) fired++;
  }
  runs.set(label.trim(), { score, cash, titles, fired });
  const n = seeds.length;
  console.log(
    `${label} 分數 ${mean(score).toFixed(0).padStart(5)} ± ${meanHW(score).toFixed(0).padEnd(4)}` +
      `  資金 ${mean(cash).toFixed(0).padStart(6)} ± ${meanHW(cash).toFixed(0).padEnd(5)}` +
      `  冠軍 ${mean(titles).toFixed(2)} ± ${meanHW(titles).toFixed(2)}` +
      `  被開除 ${((fired / n) * 100).toFixed(0)}% ± ${rateHW(fired, n).toFixed(0)}pp`,
  );
}

// Which of these differences are real. Printing three rows and letting the
// reader rank them by eye invites two mistakes at once: reading a gap that is
// inside the noise as a ranking, and testing two intervals for overlap instead
// of testing the difference (the former is strictly more conservative and calls
// real gaps absent).
console.log('\n--- 哪些差距是真的？（分數，95% 區間套在差值上）---\n');
const labels = ['砸錢投資', '輪流嘗試', '囤錢不花'];
for (let i = 0; i < labels.length; i++) {
  for (let j = i + 1; j < labels.length; j++) {
    const a = runs.get(labels[i])!.score;
    const b = runs.get(labels[j])!.score;
    const d = mean(a) - mean(b);
    const hw = diffHW(a, b);
    console.log(
      `  ${labels[i]} − ${labels[j]}: ${d >= 0 ? '+' : ''}${d.toFixed(0)} [${(d - hw).toFixed(0)}, ${(d + hw).toFixed(0)}]  ` +
        `${Math.abs(d) - hw > 0 ? '✓ 區間不含零' : '✗ 區間含零 —— 這兩個策略分不出高下'}`,
    );
  }
}

/**
 * Balance measurement. Not pass/fail — it prints numbers.
 *
 * The four things the spec commits to measuring, all of them lessons paid for
 * in earlier games in this repo:
 *   1. survival against the intensity scalar — the curve must be continuous,
 *      not a cliff at one stage;
 *   2. how much of the upgrade pool a single run actually sees, and how much
 *      two runs overlap;
 *   3. whether bombs have become free insurance (a button that is always
 *      correct is not a decision);
 *   4. whether any single upgrade dominates.
 *
 * The pilot below is deliberately crude and identical across every row. A
 * smarter pilot would make comparisons better but it must be the SAME pilot on
 * both sides of any before/after, or the comparison measures the pilot.
 */
import { FAST_SPEED, FIELD_H, FIELD_W, FIXED_DT, FOCUS_SPEED, STAGE_COUNT } from '../src/game/constants.js';
import { createRun, hitboxRadius, step, takeUpgrade } from '../src/game/engine.js';
import { streamRng } from '../src/game/rng.js';
import { UPGRADES, effect } from '../src/game/upgrades.js';
import type { PlayerInput, RunState } from '../src/game/types.js';

type BombPolicy = 'never' | 'panic';

/**
 * Candidate-sampling dodger. For each of a fan of directions (plus standing
 * still), it projects both the ship and every nearby bullet forward and scores
 * the option by how close the worst approach gets. It then takes the best one.
 *
 * The first version of this pilot only pushed away from bullets already near
 * it, weighted by inverse-square distance. That is not how danmaku is played —
 * dodging requires looking at where bullets are *going* — and it died at stage
 * 2 on every seed. Reporting that as "the game is too hard" would have been
 * reporting the harness. This one is still well below a competent human: it
 * has no route planning and no idea what a pattern will do next. Treat its
 * numbers as a floor on playability, not a description of one.
 */
const DIRS: Array<[number, number]> = (() => {
  const out: Array<[number, number]> = [[0, 0]];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    out.push([Math.cos(a), Math.sin(a)]);
  }
  return out;
})();

const LOOKAHEAD = 0.35;
const SAMPLES = 5;

function pilot(s: RunState, bombPolicy: BombPolicy): PlayerInput {
  const hit = hitboxRadius(s);
  const near = s.bullets.filter((b) => Math.hypot(b.x - s.px, b.y - s.py) < 150);

  // Present danger decides focus mode and the bomb, before any movement choice.
  let closestNow = Infinity;
  for (const b of near) closestNow = Math.min(closestNow, Math.hypot(b.x - s.px, b.y - s.py) - b.r - hit);
  const focus = closestNow < 34;
  const speed = focus
    ? FOCUS_SPEED * (1 + effect(s.upgrades, 'focusSpeedPct'))
    : FAST_SPEED * (1 + effect(s.upgrades, 'fastSpeedPct'));

  let bestDir: [number, number] = [0, 0];
  let bestScore = -Infinity;

  for (const [dx, dy] of DIRS) {
    let worst = Infinity;
    let blocked = false;
    for (let k = 1; k <= SAMPLES; k++) {
      const t = (LOOKAHEAD * k) / SAMPLES;
      const nx = s.px + dx * speed * t;
      const ny = s.py + dy * speed * t;
      if (nx < 10 || nx > FIELD_W - 10 || ny < 10 || ny > FIELD_H - 10) {
        blocked = true;
        break;
      }
      for (const b of near) {
        const bx = b.x + Math.cos(b.angle) * b.speed * t;
        const by = b.y + Math.sin(b.angle) * b.speed * t;
        worst = Math.min(worst, Math.hypot(bx - nx, by - ny) - b.r - hit);
      }
    }
    if (blocked) continue;

    const endX = s.px + dx * speed * LOOKAHEAD;
    const endY = s.py + dy * speed * LOOKAHEAD;
    // Safety dominates; the rest is a mild pull toward a normal standing spot,
    // and toward the middle horizontally so it does not paint itself into a
    // corner during a quiet moment.
    const safety = Math.min(worst === Infinity ? 200 : worst, 200);
    const home = -Math.abs(endX - FIELD_W / 2) * 0.02 - Math.abs(endY - (FIELD_H - 140)) * 0.02;
    const score = safety + home;
    if (score > bestScore) {
      bestScore = score;
      bestDir = [dx, dy];
    }
  }

  return {
    dx: bestDir[0],
    dy: bestDir[1],
    focus,
    bomb: bombPolicy === 'panic' && closestNow < 8 && s.invuln <= 0,
  };
}

interface RunResult {
  stage: number;
  startStage: number;
  won: boolean;
  score: number;
  lives: number;
  bombsUsed: number;
  captures: number;
  grazeCount: number;
  seconds: number;
  taken: string[];
  offered: string[];
}

function playRun(seedCode: string, bombPolicy: BombPolicy, pickIndex = 0, startStage = 1): RunResult {
  let s = createRun(seedCode, startStage);
  const startBombs = s.bombs;
  const offered: string[] = [];
  let guard = 0;

  while (s.phase === 'playing' || s.phase === 'upgrade') {
    if (s.phase === 'upgrade') {
      for (const id of s.offered) if (!offered.includes(id)) offered.push(id);
      s = takeUpgrade(s, s.offered[pickIndex % s.offered.length]);
      continue;
    }
    s = step(s, pilot(s, bombPolicy), FIXED_DT);
    guard += 1;
    if (guard > 200_000) break;
  }

  return {
    stage: s.stage,
    startStage,
    won: s.phase === 'won',
    score: s.score,
    lives: s.lives,
    bombsUsed: Math.max(0, startBombs - s.bombs),
    captures: s.captures,
    grazeCount: s.grazeCount,
    seconds: s.elapsed,
    taken: s.upgrades,
    offered,
  };
}

const SEEDS = ['ALPHA1', 'BRAVO2', 'CHARL3', 'DELTA4', 'ECHO55', 'FOXTR6', 'GOLF77', 'HOTEL8'];

/**
 * Equips a run the way a player who actually reached that stage would be:
 * upgrades picked along the way and a grown power tier.
 *
 * Without this, starting a measurement at stage 5 puts a stage-1 ship — no
 * upgrades, power tier 1 — into the hardest danmaku in the game, and the 0%
 * survival it reports is a fact about the harness, not about the stage.
 */
function equip(s: RunState, stage: number): RunState {
  const r = streamRng(s.seed, `equip:${stage}`);
  const picks: string[] = [];
  const pool = UPGRADES.map((u) => u.id);
  for (let i = 0; i < stage - 1; i++) {
    picks.push(pool[Math.floor(r() * pool.length)]);
  }
  return {
    ...s,
    upgrades: picks,
    powerTier: Math.min(4, 1 + Math.floor((stage - 1) * 0.8)),
  };
}

/**
 * Walks a run through every stage regardless of whether the pilot could
 * survive it, by refilling lives between stages. Used only for questions about
 * the *content* — pool reach, overlap — which must not be conditional on
 * skill.
 */
function fullRun(seedCode: string): RunResult {
  let s = createRun(seedCode);
  const offered: string[] = [];
  let guard = 0;
  while (s.phase === 'playing' || s.phase === 'upgrade') {
    if (s.phase === 'upgrade') {
      for (const id of s.offered) if (!offered.includes(id)) offered.push(id);
      s = takeUpgrade(s, s.offered[0]);
      continue;
    }
    if (s.lives < 3) s = { ...s, lives: 3 };
    s = step(s, pilot(s, 'never'), FIXED_DT);
    if (++guard > 400_000) break;
  }
  return {
    stage: s.stage,
    startStage: 1,
    won: s.phase === 'won',
    score: s.score,
    lives: s.lives,
    bombsUsed: 0,
    captures: s.captures,
    grazeCount: s.grazeCount,
    seconds: s.elapsed,
    taken: s.upgrades,
    offered,
  };
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
}

// ── 1) How far a run gets, and how long it takes ─────────────────────────────
console.log('=== 一趟能走多遠（相同駕駛、八個種子）===\n');
console.log('靈擊策略 | 平均到達  通關率  平均分數   平均時長  平均擦彈  Capture');
for (const policy of ['never', 'panic'] as BombPolicy[]) {
  const rs = SEEDS.map((s) => playRun(s, policy));
  const label = policy === 'never' ? '從不使用' : '危險就按';
  console.log(
    `${label} | ${mean(rs.map((r) => r.stage)).toFixed(2)} / ${STAGE_COUNT}   ` +
      `${((rs.filter((r) => r.won).length / rs.length) * 100).toFixed(0)}%   ` +
      `${Math.round(mean(rs.map((r) => r.score))).toString().padStart(8)}   ` +
      `${mean(rs.map((r) => r.seconds)).toFixed(0).padStart(5)}s   ` +
      `${Math.round(mean(rs.map((r) => r.grazeCount))).toString().padStart(6)}   ` +
      `${mean(rs.map((r) => r.captures)).toFixed(1)}`,
  );
}

// ── 2) Is the bomb free insurance? ───────────────────────────────────────────
//
// If panicking is better on every axis at no cost, the button is not a
// decision. The bomb should buy survival and give up score.
console.log('\n=== 靈擊是不是免費保險 ===\n');
{
  const never = SEEDS.map((s) => playRun(s, 'never'));
  const panic = SEEDS.map((s) => playRun(s, 'panic'));
  const dStage = mean(panic.map((r) => r.stage)) - mean(never.map((r) => r.stage));
  // Raw score is the wrong yardstick: surviving longer scores more no matter
  // what, so a bomb that only bought survival would still look like it paid.
  // Score per stage reached is the honest comparison — it asks whether the
  // bomb costs anything at the moment it is pressed.
  const perStage = (rs: RunResult[]) => mean(rs.map((r) => r.score / Math.max(1, r.stage)));
  const dPer = perStage(panic) - perStage(never);
  console.log(`  按靈擊換到的階段：  ${dStage >= 0 ? '+' : ''}${dStage.toFixed(2)}`);
  console.log(`  每階段分數的變化：  ${dPer >= 0 ? '+' : ''}${Math.round(dPer)}`);
  console.log(`  平均使用次數：      ${mean(panic.map((r) => r.bombsUsed)).toFixed(1)}`);
  // Three outcomes, not two. The first version only named "free insurance" and
  // then printed "it's a trade" for everything else — including the case where
  // panicking was worse on BOTH axes, which is a different problem (a button
  // nobody would ever press) wearing the same label.
  if (dStage > 0.15 && dPer > 0) {
    console.log('  ⚠ 兩邊都變好 —— 靈擊是免費保險，不是決策');
  } else if (dStage < -0.15 && dPer < 0) {
    console.log('  ⚠ 兩邊都變差 —— 對這個水準的駕駛而言按了純虧，等於沒有這個按鈕');
    console.log('     （合理：好的閃避者不需要恐慌按彈；弱一點的玩家才靠它救場）');
  } else {
    console.log('  ✓ 是取捨：一邊得到、另一邊付出');
  }
}

// ── 3) Upgrade pool reach and run-to-run overlap ─────────────────────────────
//
// Measured on runs that actually reach the end. Reading these off runs that
// die at stage 2 would report a wonderfully low overlap that only means the
// pilot never lived long enough to pick anything.
console.log('\n=== 強化池：一趟看到多少、兩趟重複多少（走完全程）===\n');
{
  const runs = SEEDS.map((s) => fullRun(s));
  const offeredPct = mean(runs.map((r) => (r.offered.length / UPGRADES.length) * 100));
  let overlapSum = 0;
  let pairs = 0;
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const a = new Set(runs[i].taken);
      const b = new Set(runs[j].taken);
      const shared = [...a].filter((x) => b.has(x)).length;
      const union = new Set([...a, ...b]).size;
      overlapSum += union === 0 ? 0 : (shared / union) * 100;
      pairs += 1;
    }
  }
  console.log(`  池子大小        ${UPGRADES.length}`);
  console.log(`  一趟拿到        ${mean(runs.map((r) => r.taken.length)).toFixed(1)} 個`);
  console.log(`  一趟被提供到    ${offeredPct.toFixed(0)}% 的池子`);
  console.log(`  兩趟之間重疊    ${(overlapSum / pairs).toFixed(0)}%`);
  console.log(
    offeredPct > 80 || overlapSum / pairs > 45
      ? '  ⚠ 每一趟都太像同一趟 —— 池子相對於選擇次數太小'
      : '  ✓ 留了夠多沒被看到的東西',
  );
}

// ── 4) Does any one upgrade dominate? ────────────────────────────────────────
//
// Forced single-upgrade runs: take only this upgrade whenever it is offered,
// otherwise take the first option. A pick that is far ahead of the field is
// the coil problem from Clockwork-Keep, where one tower cleared everything and
// the other three were decoration.
console.log('\n=== 單一強化是不是碾壓其他 ===\n');
{
  // Two seeds and a tick cap: the predictive pilot is expensive and a full
  // 24-upgrade sweep over long runs takes minutes. Ranking only needs enough
  // signal to spot a runaway pick.
  const rows: Array<{ id: string; stage: number; score: number }> = [];
  for (const u of UPGRADES) {
    const rs = SEEDS.slice(0, 2).map((seedCode) => {
      let s = createRun(seedCode);
      let guard = 0;
      while (s.phase === 'playing' || s.phase === 'upgrade') {
        if (s.phase === 'upgrade') {
          const want = s.offered.includes(u.id) ? u.id : s.offered[0];
          s = takeUpgrade(s, want);
          continue;
        }
        s = step(s, pilot(s, 'never'), FIXED_DT);
        if (++guard > 40_000) break;
      }
      return { stage: s.stage, score: s.score };
    });
    rows.push({ id: u.id, stage: mean(rs.map((r) => r.stage)), score: mean(rs.map((r) => r.score)) });
  }
  rows.sort((a, b) => b.stage - a.stage || b.score - a.score);
  console.log('  最強的五個：');
  for (const r of rows.slice(0, 5)) console.log(`    ${r.id.padEnd(14)} 到達 ${r.stage.toFixed(2)}  分數 ${Math.round(r.score)}`);
  console.log('  最弱的五個：');
  for (const r of rows.slice(-5)) console.log(`    ${r.id.padEnd(14)} 到達 ${r.stage.toFixed(2)}  分數 ${Math.round(r.score)}`);
  const spread = rows[0].stage - rows[rows.length - 1].stage;
  console.log(`  最強與最弱的階段差距：${spread.toFixed(2)}`);
}

// ── 5) The difficulty curve, per stage, measured independently ───────────────
//
// Each stage is started directly so its difficulty is not conditional on
// surviving the ones before it. This is the curve the spec promises: it must
// climb, and it must not cliff.
console.log('\n=== 每個階段單獨量測（直接從該階段開始，同一個駕駛）===\n');
console.log('階段 | 存活率  平均秒數  子彈峰值  Capture');
for (let stage = 1; stage <= STAGE_COUNT; stage++) {
  let survived = 0;
  const secs: number[] = [];
  const peaks: number[] = [];
  let captures = 0;
  for (const seedCode of SEEDS) {
    let s = equip(createRun(seedCode, stage), stage);
    const startLives = s.lives;
    let peak = 0;
    let guard = 0;
    while (s.phase === 'playing' && guard < 200_000) {
      s = step(s, pilot(s, 'never'), FIXED_DT);
      peak = Math.max(peak, s.bullets.length);
      guard += 1;
    }
    if (s.lives === startLives) survived += 1;
    secs.push(s.elapsed);
    peaks.push(peak);
    captures += s.captures;
  }
  console.log(
    `  ${stage}  | ${((survived / SEEDS.length) * 100).toFixed(0).padStart(4)}%  ` +
      `${mean(secs).toFixed(0).padStart(7)}s  ${Math.round(Math.max(...peaks)).toString().padStart(7)}  ` +
      `${(captures / SEEDS.length).toFixed(1)}`,
  );
}

// Keep the unused-import checker honest about streamRng: it is the engine's
// source of run-to-run variety and this file asserts nothing about it directly.
void streamRng;

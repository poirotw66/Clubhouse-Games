/**
 * Balance measurement. Not pass/fail — it prints numbers.
 *
 * The four things the spec commits to measuring:
 *   1. no branch-choice policy (always fastest / always safest / always
 *      reward) strictly dominates the others;
 *   2. how much of the branch template pool a single run actually sees, and
 *      how much two runs overlap;
 *   3. the buffer curve — no "dead at the start", no "unkillable once past
 *      the opening";
 *   4. whether reading the preview actually beats ignoring it (blind vs
 *      informed choice), which is the only evidence that the preview is
 *      doing anything besides decorating the screen.
 *
 * One execution pilot is shared by every policy and every row below — it
 * decides jump/slide/wall-dodge timing with a fixed per-obstacle mistake
 * rate, seeded so it is reproducible. Only the CHOICE of which branch to
 * enter differs between policies. Comparing policies that also differed in
 * how well they executed would measure the pilot, not the choice.
 */
import { FIXED_DT, JUMP_DURATION, SLIDE_DURATION } from '../src/game/constants.js';
import { BRANCH_TEMPLATES } from '../src/game/branches.js';
import { createRun, currentSpeed, finalScore, step } from '../src/game/engine.js';
import { hashString, streamRng, type Rng } from '../src/game/rng.js';
import type { ActiveBranch, Junction, PlacedBranch, PlayerInput } from '../src/game/types.js';

/**
 * Nearest not-yet-resolved obstacle in the player's own lane that needs a
 * decision NOW — "now" is derived from the action's own duration and the
 * player's CURRENT pace, not a single fixed lookahead distance. A fixed
 * distance is wrong at every speed but one: at low speed (a 'decel' branch)
 * it triggers a jump long before the hurdle arrives and JUMP_DURATION
 * expires first, which is exactly what this file's self-check counterpart
 * caught on `supply-siding` — a "perfect foreknowledge" pilot missing an
 * obstacle it had correctly identified, purely from bad trigger timing.
 */
function pickUpcoming(obstacles: ActiveBranch['obstacles'], lane: number, distance: number, speed: number) {
  const jumpReach = speed * JUMP_DURATION * 0.85;
  const slideReach = speed * SLIDE_DURATION * 0.85;
  const wallReach = 90;
  return obstacles.find((o) => {
    if (o.resolved || o.lane !== lane) return false;
    const d = o.absDistance - distance;
    if (d <= 0) return false;
    if (o.kind === 'hurdle') return d < jumpReach;
    if (o.kind === 'beam') return d < slideReach;
    return d < wallReach;
  });
}

/** See the identical helper in scripts/self-check.ts for why this can't just
 * be "the first lane that isn't the blocked one": that walks straight from
 * dodging one wall into a second wall sitting just past it in whichever lane
 * happened to come first. */
function chooseSafeLane(obstacles: ActiveBranch['obstacles'], avoidLane: number, distance: number): number {
  const candidates = [0, 1, 2].filter((l) => l !== avoidLane);
  let best = candidates[0];
  let bestNext = -Infinity;
  for (const lane of candidates) {
    let next = Infinity;
    for (const o of obstacles) {
      if (o.resolved || o.lane !== lane || o.absDistance <= distance) continue;
      next = Math.min(next, o.absDistance - distance);
    }
    if (next > bestNext) {
      bestNext = next;
      best = lane;
    }
  }
  return best;
}

const SEEDS = ['ALPHA1', 'BRAVO2', 'CHARL3', 'DELTA4', 'ECHO55', 'FOXTR6', 'GOLF77', 'HOTEL8'];

/** How often the execution pilot fails the correct action on an obstacle it
 * has already committed to, independent of which policy is choosing branches.
 * Nonzero on purpose: a pilot that never misses can't show density mattering
 * at all, and "a weak bot proves nothing about difficulty" cuts both ways —
 * a bot that literally cannot fail proves nothing about density either. */
const MISTAKE_RATE = 0.18;

type ChoicePolicy = 'fastest' | 'safest' | 'reward' | 'blind' | 'informed';

/**
 * Canonical, criterion-free tie-break: sorted by template id, take the
 * middle one. Used any time a policy's own criterion doesn't distinguish the
 * offered branches, so no policy quietly degrades into "always index 0" —
 * that would compare "pick on purpose" against "pick whatever happened to
 * shuffle first", not against the policy's stated rule.
 */
function neutralPick(branches: PlacedBranch[]): PlacedBranch {
  const sorted = [...branches].slice().sort((a, b) => a.templateId.localeCompare(b.templateId));
  return sorted[Math.floor(sorted.length / 2)];
}

function chooseBranch(pj: Junction, policy: ChoicePolicy, buffer: number, execR: Rng): PlacedBranch {
  const branches = pj.branches;
  switch (policy) {
    case 'fastest':
      return branches.reduce((a, b) => (b.speedMult > a.speedMult ? b : a));
    case 'safest':
      return branches.reduce((a, b) => (b.density < a.density ? b : a));
    case 'reward': {
      const rewarding = branches.filter((b) => b.reward !== 'none');
      if (rewarding.length === 0) return neutralPick(branches);
      return rewarding.reduce((a, b) => (b.density < a.density ? b : a));
    }
    case 'blind':
      // Ignores every field in the preview, including density and reward —
      // this is the floor the "informed" policy has to beat.
      return branches[Math.floor(execR() * branches.length)];
    case 'informed': {
      if (buffer < 90) return branches.reduce((a, b) => (b.density < a.density ? b : a));
      if (buffer > 190) return branches.reduce((a, b) => (b.speedMult > a.speedMult ? b : a));
      const rewarding = branches.filter((b) => b.reward !== 'none');
      if (rewarding.length > 0) return rewarding.reduce((a, b) => (b.density < a.density ? b : a));
      return neutralPick(branches);
    }
  }
}

interface RunResult {
  distance: number;
  score: number;
  elapsed: number;
  branchesCleared: number;
  hitsTotal: number;
  offered: string[];
  taken: string[];
  bufferSamples: Array<{ distance: number; buffer: number }>;
  /** True if the run was still alive when SESSION_GUARD ran out — it did not
   * die, the measurement window ended. */
  cappedAt: boolean;
}

/**
 * Steers laneStep to move one lane toward `targetLane`, one lane per call —
 * the caller drives this every tick while approaching a junction, same as a
 * player tapping the direction key repeatedly.
 */
function stepToward(current: number, target: number): -1 | 0 | 1 {
  if (target === current) return 0;
  return target > current ? 1 : -1;
}

/**
 * Session cap for measurement: 900s (15 minutes) of simulated play. A policy
 * that never dies within this window is reported as having reached the cap
 * rather than run forever — see `cappedAt` on the result. Below RAMP_CAP_SEC
 * the difficulty ramp is still climbing (a real run's actual shape); above it
 * pace is flat, so ANY policy that nets a positive expected value per branch
 * is a positive-drift random walk that will, given long enough, essentially
 * never return to zero. That is not a bug in the simulation — it is what
 * "flawless play should be able to survive" means — but it also means
 * "does fastest eventually die" is the wrong question to ask this harness.
 * The right one is "how far do the three policies get in the same realistic
 * session", which is what SESSION_GUARD bounds.
 */
const SESSION_GUARD = 54_000; // 900s at 60 ticks/sec

function playRun(seedCode: string, policy: ChoicePolicy, sampleEvery = 250): RunResult {
  const seed = hashString(seedCode);
  const execR = streamRng(seed, `exec:${policy}`);
  // One mistake roll per obstacle INSTANCE (keyed by the branch's own
  // startDistance, since the same template — and so the same offset/lane —
  // recurs many times over a long run). The first version rolled on every
  // tick an obstacle stayed inside the reach window instead of once: a
  // "mistake" tick just deferred to the next tick's fresh roll, so the real
  // per-obstacle failure probability was MISTAKE_RATE^(ticks in window),
  // which collapses to nearly zero within a handful of ticks regardless of
  // MISTAKE_RATE. That is why raising it from 0.15 to 0.35 barely moved the
  // measured hit count — the parameter was real, the wiring was not.
  const verdicts = new Map<string, boolean>();
  let s = createRun(seedCode);
  let guard = 0;
  let nextSample = 0;
  const bufferSamples: Array<{ distance: number; buffer: number }> = [];
  const offered = new Set<string>();
  const taken: string[] = [];
  let plannedLane: number | null = null;

  while (s.phase === 'playing' && guard++ < SESSION_GUARD) {
    for (const b of s.pendingJunction.branches) offered.add(b.templateId);

    let input: PlayerInput = { laneStep: 0, jump: false, slide: false };
    const branch = s.activeBranch as ActiveBranch | null;
    if (!branch) {
      if (plannedLane === null) {
        const choice = chooseBranch(s.pendingJunction, policy, s.buffer, execR);
        plannedLane = choice.lane;
        taken.push(choice.templateId);
      }
      input = { laneStep: stepToward(s.lane, plannedLane), jump: false, slide: false };
    } else {
      plannedLane = null;
      const upcoming = pickUpcoming(branch.obstacles, s.lane, s.distance, currentSpeed(s));
      if (upcoming) {
        const key = `${branch.startDistance}:${upcoming.offset}:${upcoming.lane}`;
        let mistake = verdicts.get(key);
        if (mistake === undefined) {
          mistake = execR() < MISTAKE_RATE;
          verdicts.set(key, mistake);
        }
        if (!mistake) {
          if (upcoming.kind === 'hurdle' && s.jumpTimer <= 0) input = { laneStep: 0, jump: true, slide: false };
          else if (upcoming.kind === 'beam' && s.slideTimer <= 0) input = { laneStep: 0, jump: false, slide: true };
          else if (upcoming.kind === 'wall' && s.laneChangeCooldown <= 0) {
            const safeLane = chooseSafeLane(branch.obstacles, upcoming.lane, s.distance);
            input = { laneStep: safeLane > s.lane ? 1 : -1, jump: false, slide: false };
          }
        }
        // On a mistake, input stays idle — the pilot "knew" what to do and
        // still didn't do it, which is exactly what a per-obstacle miss rate
        // is supposed to model.
      }
    }

    s = step(s, input, FIXED_DT);
    if (s.distance >= nextSample) {
      bufferSamples.push({ distance: Math.round(s.distance), buffer: s.buffer });
      nextSample += sampleEvery;
    }
  }

  return {
    distance: s.distance,
    score: finalScore(s),
    elapsed: s.elapsed,
    branchesCleared: s.branchesCleared,
    hitsTotal: s.hitsTotal,
    offered: [...offered],
    taken,
    bufferSamples,
    cappedAt: s.phase === 'playing',
  };
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
}

/** Spread-argument Math.min/max blow the call stack on large sample arrays
 * (a long buffer-curve run easily produces tens of thousands of samples). */
function minOf(xs: number[]): number {
  return xs.reduce((a, b) => Math.min(a, b), Infinity);
}
function maxOf(xs: number[]): number {
  return xs.reduce((a, b) => Math.max(a, b), -Infinity);
}

// ── 1) Does any single choice policy dominate? ────────────────────────────────
console.log(`=== 路線策略：永遠選最快 / 永遠選最安全 / 永遠選補給（同一個 ${SESSION_GUARD / 60}s 場次上限，相同執行失誤率）===\n`);
console.log('策略       平均距離   平均分數   平均秒數  平均撞擊  清過的岔道  撐滿場次');
const policyResults: Record<ChoicePolicy, RunResult[]> = {
  fastest: [],
  safest: [],
  reward: [],
  blind: [],
  informed: [],
};
for (const policy of ['fastest', 'safest', 'reward'] as ChoicePolicy[]) {
  const rs = SEEDS.map((seed) => playRun(seed, policy));
  policyResults[policy] = rs;
  console.log(
    `${policy.padEnd(10)} ${mean(rs.map((r) => r.distance)).toFixed(0).padStart(8)}   ` +
      `${Math.round(mean(rs.map((r) => r.score))).toString().padStart(8)}   ` +
      `${mean(rs.map((r) => r.elapsed)).toFixed(0).padStart(7)}s  ` +
      `${mean(rs.map((r) => r.hitsTotal)).toFixed(1).padStart(8)}  ` +
      `${mean(rs.map((r) => r.branchesCleared)).toFixed(1).padStart(10)}  ` +
      `${rs.filter((r) => r.cappedAt).length}/${SEEDS.length}`,
  );
}
{
  const dists = (['fastest', 'safest', 'reward'] as ChoicePolicy[]).map((p) => mean(policyResults[p].map((r) => r.distance)));
  const spread = maxOf(dists) / minOf(dists);
  console.log(`\n  最遠/最近策略的距離比：${spread.toFixed(2)}x`);
  // Guard against degenerate measurement: if two policies' per-seed distances
  // are identical in bulk, they may never actually have diverged in choice
  // (e.g. every junction only ever offered one template each policy would
  // pick differently for, collapsing to the same run).
  let ties = 0;
  for (let i = 0; i < SEEDS.length; i++) {
    const vals = (['fastest', 'safest', 'reward'] as ChoicePolicy[]).map((p) => Math.round(policyResults[p][i].distance));
    if (new Set(vals).size < vals.length) ties += 1;
  }
  if (ties > SEEDS.length * 0.5) {
    console.log(`  ⚠ ${ties}/${SEEDS.length} 個種子三種策略距離幾乎相同 —— 量測可能退化了`);
  }
  console.log(
    spread > 2.2
      ? '  ⚠ 有一種策略明顯碾壓其他 —— 密度沒有真的在為速度/收益付費'
      : spread < 1.03
        ? '  ⚠ 三種策略幾乎沒有差異 —— 選擇可能不構成真正的決策'
        : '  ✓ 三種策略落在可比較區間，沒有一種碾壓其他',
  );
}

// ── 2) Branch template pool reach and run-to-run overlap ────────────────────
console.log('\n=== 支線模板池：一趟看到多少、兩趟重複多少（informed 策略，走到超時或抓到）===\n');
{
  const runs = SEEDS.map((seed) => playRun(seed, 'informed'));
  policyResults.informed = runs;
  const offeredPct = mean(runs.map((r) => (r.offered.length / BRANCH_TEMPLATES.length) * 100));
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
  console.log(`  池子大小        ${BRANCH_TEMPLATES.length}`);
  console.log(`  一趟被提供到    ${offeredPct.toFixed(0)}% 的池子`);
  console.log(`  一趟實際選過    ${mean(runs.map((r) => new Set(r.taken).size)).toFixed(1)} 種模板`);
  console.log(`  兩趟之間重疊    ${(overlapSum / pairs).toFixed(0)}%`);
  console.log(
    offeredPct > 90 || overlapSum / pairs > 55
      ? '  ⚠ 每一趟都太像同一趟 —— 池子相對於岔道次數太小'
      : '  ✓ 留了夠多沒被看到的東西',
  );
}

// ── 3) The buffer curve ───────────────────────────────────────────────────────
console.log('\n=== 緩衝曲線：分距離區段取樣（informed 策略，八個種子平均）===\n');
{
  const runs = policyResults.informed;
  const bands = [0, 1000, 2500, 5000, 9000];
  console.log('距離區段     樣本數  平均緩衝  最低緩衝');
  for (let i = 0; i < bands.length; i++) {
    const lo = bands[i];
    const hi = bands[i + 1] ?? Infinity;
    const inBand = runs.flatMap((r) => r.bufferSamples.filter((b) => b.distance >= lo && b.distance < hi));
    if (inBand.length === 0) continue;
    console.log(
      `${lo}-${hi === Infinity ? '∞' : hi}`.padEnd(13) +
        `${inBand.length.toString().padStart(6)}  ` +
        `${mean(inBand.map((b) => b.buffer)).toFixed(0).padStart(8)}  ` +
        `${minOf(inBand.map((b) => b.buffer)).toFixed(0).padStart(8)}`,
    );
  }
  const earlySamples = runs.flatMap((r) => r.bufferSamples.filter((b) => b.distance < 400));
  const earlyDeaths = runs.filter((r) => r.distance < 400).length;
  const lateSamples = runs.flatMap((r) => r.bufferSamples.filter((b) => b.distance > 4000));
  const lateMin = lateSamples.length > 0 ? minOf(lateSamples.map((b) => b.buffer)) : NaN;
  console.log(`\n  400 距離內死亡的種子數：  ${earlyDeaths}/${SEEDS.length}`);
  if (earlySamples.length > 0) {
    console.log(`  400 距離內最低緩衝：      ${minOf(earlySamples.map((b) => b.buffer)).toFixed(0)}`);
  }
  if (!Number.isNaN(lateMin)) {
    console.log(`  4000 距離後最低緩衝：     ${lateMin.toFixed(0)}`);
    console.log(
      lateMin > 245
        ? '  ⚠ 過了前段之後緩衝再也不會真的降低 —— 後期等於無敵'
        : '  ✓ 後期緩衝仍然會真的下降，不是不死之身',
    );
  } else {
    console.log('  （八個種子都沒有活到 4000 距離之後 —— 見下方策略比較，這通常代表 MISTAKE_RATE 或密度需要調整，而不是後期不可達）');
  }
  console.log(
    earlyDeaths > SEEDS.length * 0.4
      ? '  ⚠ 開頭死亡率偏高 —— 可能是「一開局就死」'
      : '  ✓ 開局不是必死',
  );
}

// ── 4) Does the preview carry information? Blind vs informed choice ──────────
console.log('\n=== 預覽是否真的有資訊：盲選 vs 讀預覽（相同執行失誤率）===\n');
{
  const blind = SEEDS.map((seed) => playRun(seed, 'blind'));
  policyResults.blind = blind;
  const informed = policyResults.informed;
  const dDist = mean(informed.map((r) => r.distance)) - mean(blind.map((r) => r.distance));
  const dScore = mean(informed.map((r) => r.score)) - mean(blind.map((r) => r.score));
  const pctGain = (mean(informed.map((r) => r.distance)) / mean(blind.map((r) => r.distance)) - 1) * 100;
  console.log(`  盲選   平均距離 ${mean(blind.map((r) => r.distance)).toFixed(0).padStart(8)}   平均分數 ${Math.round(mean(blind.map((r) => r.score)))}`);
  console.log(`  讀預覽 平均距離 ${mean(informed.map((r) => r.distance)).toFixed(0).padStart(8)}   平均分數 ${Math.round(mean(informed.map((r) => r.score)))}`);
  console.log(`\n  距離差：+${dDist.toFixed(0)}（${pctGain.toFixed(0)}%）　分數差：+${Math.round(dScore)}`);
  console.log(
    pctGain > 15
      ? '  ✓ 讀預覽明顯優於盲選 —— 預覽真的帶有資訊，不是裝飾'
      : '  ⚠ 兩者差距太小 —— 預覽可能只是裝飾',
  );
}

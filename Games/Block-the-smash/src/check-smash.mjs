/**
 * Block-the-smash depth checks: smash types, timing, 8-opponent ladder, counter, daily.
 */
import {
  PHASE_MIX,
  SMASH_DEFS,
  SMASH_TYPE_IDS,
  pickFakeTell,
  pickSmashType,
  resolveAimX,
} from './game/smashTypes.js';
import {
  COMBO_PENTATONIC_SEMITONES,
  IMPACT_Z,
  POS_GOOD,
  POS_PERFECT,
  POS_REACH,
  WINDOW_GOOD_MS,
  WINDOW_PERFECT_MS,
  aimZoneFromMouse,
  combineContact,
  comboPitchMultiplier,
  etaToImpact,
  getTimingWindowsMs,
  gradePosition,
  gradeTiming,
  scoreForContact,
  versusReturnWinsPoint,
} from './game/timing.js';
import {
  DIFFICULTY,
  OPPONENTS,
  biasMixForHabit,
  chooseSmash,
  getOpponent,
  isOpponentUnlocked,
  seriesWinsNeeded,
  shouldStartBurst,
} from './game/opponents.js';
import {
  STATS_KEY,
  applyDailyResult,
  applyDrillResult,
  applyScoreAttackResult,
  applyVersusResult,
  drillAccuracy,
  emptyStats,
  gradeFromAccuracy,
  gradeFromScore,
  loadStats,
  normalizeStats,
  phaseTierFromProgress,
  saveStats,
  scoreAttackWave,
} from './game/scoring.js';
import { createRng } from './game/rng.js';
import {
  COUNTER_WINDOW_SEC,
  counterDisruptsRhythm,
  counterScoreBonus,
  counterVersusBonus,
  resolvePerfectCounter,
} from './game/counter.js';
import {
  DAILY_BALL_COUNT,
  buildDailyScript,
  buildDailyShareText,
  computeDailyStreak,
  dailySeedNumber,
  previousTaipeiDay,
  taipeiDateKey,
} from './game/daily.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// ============================================================================
// 1. Grades & Phase Progression
// ============================================================================
assert(gradeFromAccuracy(100).grade === 'S', 'perfect should be S');
assert(gradeFromAccuracy(92).grade === 'S', '92 should be S');
assert(gradeFromAccuracy(85).grade === 'A', '85 should be A');
assert(gradeFromAccuracy(80).grade === 'A', '80 should be A');
assert(gradeFromAccuracy(70).grade === 'B', '70 should be B');
assert(gradeFromAccuracy(65).grade === 'B', '65 should be B');
assert(gradeFromAccuracy(50).grade === 'C', '50 should be C');
assert(gradeFromAccuracy(45).grade === 'C', '45 should be C');
assert(gradeFromAccuracy(10).grade === 'D', 'low should be D');
assert(gradeFromAccuracy(0).grade === 'D', 'zero should be D');

assert(gradeFromScore(30000).grade === 'S', 'high score S');
assert(gradeFromScore(25000).grade === 'S', '25000 score S');
assert(gradeFromScore(16000).grade === 'A', '16000 score A');
assert(gradeFromScore(15000).grade === 'A', '15000 score A');
assert(gradeFromScore(8000).grade === 'B', '8000 score B');
assert(gradeFromScore(7000).grade === 'C', '7000 score C');
assert(gradeFromScore(3500).grade === 'C', '3500 score C');
assert(gradeFromScore(100).grade === 'D', 'low score D');

assert(phaseTierFromProgress(0.0) === 0, 'progress 0 tier warm');
assert(phaseTierFromProgress(0.32) === 0, 'progress 0.32 tier warm');
assert(phaseTierFromProgress(0.33) === 1, 'progress 0.33 tier pressure');
assert(phaseTierFromProgress(0.65) === 1, 'progress 0.65 tier pressure');
assert(phaseTierFromProgress(0.66) === 2, 'progress 0.66 tier chaos');
assert(phaseTierFromProgress(1.0) === 2, 'progress 1.0 tier chaos');

assert(scoreAttackWave(0) === 0, 'wave 0 step');
assert(scoreAttackWave(7) === 0, 'wave 7 step');
assert(scoreAttackWave(8) === 1, 'wave 8 step');
assert(scoreAttackWave(16) === 2, 'wave 16 step');
assert(scoreAttackWave(48) === 6, 'wave 48 step');

assert(
  drillAccuracy({ perfects: 5, goods: 3, blocks: 2, misses: 0, maxBalls: 10 }) === 100,
  'all contacts 100%',
);
assert(
  drillAccuracy({ perfects: 0, goods: 0, blocks: 0, misses: 10, maxBalls: 10 }) === 0,
  'all misses 0%',
);
assert(
  drillAccuracy({ perfects: 5, goods: 0, blocks: 0, misses: 5, maxBalls: 10 }) === 50,
  'half misses 50%',
);

// Pentatonic pitch ladder checks (Sakurai coordinate-audio-visual-priority)
assert(COMBO_PENTATONIC_SEMITONES.length === 8, 'eight pentatonic steps');
assert(comboPitchMultiplier(1) === 1, 'combo 1 multiplier base 1.0');
assert(Math.abs(comboPitchMultiplier(2) - Math.pow(2, 2 / 12)) < 1e-6, 'combo 2 semitone 2');
assert(Math.abs(comboPitchMultiplier(4) - Math.pow(2, 7 / 12)) < 1e-6, 'combo 4 semitone 7');
assert(Math.abs(comboPitchMultiplier(6) - 2.0) < 1e-6, 'combo 6 octave 2.0');
assert(Math.abs(comboPitchMultiplier(8) - Math.pow(2, 16 / 12)) < 1e-6, 'combo 8 semitone 16');
assert(Math.abs(comboPitchMultiplier(99) - Math.pow(2, 16 / 12)) < 1e-6, 'combo > 8 clamps to max');
assert(comboPitchMultiplier(0) === 1, 'combo 0 multiplier base');
assert(comboPitchMultiplier(null) === 1, 'combo null multiplier base');

// ============================================================================
// 2. Smash Arsenal & Aim Profiles
// ============================================================================
assert(SMASH_TYPE_IDS.length === 4, 'four smash types');
assert(SMASH_DEFS.straight.speedMul > SMASH_DEFS.drop.speedMul, 'straight faster than drop');
assert(SMASH_DEFS.cross.aimSpreadMul > SMASH_DEFS.straight.aimSpreadMul, 'cross wider aim');
assert(SMASH_DEFS.body.trackPlayer === true, 'body tracks player');
assert(SMASH_DEFS.drop.windupSec > SMASH_DEFS.straight.windupSec, 'drop longer tell');
assert(PHASE_MIX.length === 3, 'three phase mixes');

for (const mix of PHASE_MIX) {
  const sum = SMASH_TYPE_IDS.reduce((a, id) => a + mix[id], 0);
  assert(Math.abs(sum - 1) < 0.02, 'phase mix ~1');
}

// Fake tell never equals real when forced
{
  const rng = createRng(42);
  for (let i = 0; i < 40; i++) {
    const real = pickSmashType(PHASE_MIX[2], rng);
    const tell = pickFakeTell(real, rng);
    assert(tell !== real, 'fake tell differs');
    assert(SMASH_TYPE_IDS.includes(tell), 'fake tell valid type');
  }
}

// ============================================================================
// 3. AimX Lateral Boundary Clamping Across Difficulties
// ============================================================================
{
  // Test aimX across easy, normal, and hard difficulties
  const difficulties = ['easy', 'normal', 'hard'];
  const handSides = ['right', 'left'];

  for (const diffKey of difficulties) {
    const diff = DIFFICULTY[diffKey];
    assert(diff.aimSpread > 0, `${diffKey} aimSpread positive`);

    // Cross smash spread must scale with diff.aimSpread * 1.35
    const expectedCrossSpread = diff.aimSpread * SMASH_DEFS.cross.aimSpreadMul;
    assert(expectedCrossSpread > diff.aimSpread, 'cross spread multiplier expands base spread');

    for (const hand of handSides) {
      const handBaseX = hand === 'right' ? 4 : -4;
      const rngLeft = createRng(100 + diff.aimSpread);
      const rngRight = createRng(200 + diff.aimSpread);

      const crossLeft = resolveAimX('cross', {
        handedness: hand,
        playerX: 0,
        aimSpread: diff.aimSpread,
        sideSign: -1,
        rng: rngLeft,
      });

      const crossRight = resolveAimX('cross', {
        handedness: hand,
        playerX: 0,
        aimSpread: diff.aimSpread,
        sideSign: 1,
        rng: rngRight,
      });

      // sideSign: -1 must push aim towards the left relative to handBaseX
      assert(crossLeft < handBaseX, `cross with sideSign -1 pushes left of handBase (${diffKey}, ${hand})`);
      // sideSign: 1 must push aim towards the right relative to handBaseX
      assert(crossRight > handBaseX, `cross with sideSign 1 pushes right of handBase (${diffKey}, ${hand})`);
    }
  }

  // Verify empirical spread bounds monotonic expansion across difficulty tiers
  const getSpreadExtent = (diffKey, smashType) => {
    let minX = Infinity;
    let maxX = -Infinity;
    const rng = createRng(777);
    for (let i = 0; i < 200; i++) {
      const val = resolveAimX(smashType, {
        handedness: 'right',
        playerX: 0,
        aimSpread: DIFFICULTY[diffKey].aimSpread,
        sideSign: -1,
        rng,
      });
      if (val < minX) minX = val;
      if (val > maxX) maxX = val;
    }
    return maxX - minX;
  };

  const crossSpreadEasy = getSpreadExtent('easy', 'cross');
  const crossSpreadNormal = getSpreadExtent('normal', 'cross');
  const crossSpreadHard = getSpreadExtent('hard', 'cross');

  assert(
    crossSpreadHard > crossSpreadNormal && crossSpreadNormal > crossSpreadEasy,
    'cross aim spread broadens monotonically from easy -> normal -> hard',
  );

  // Body smash player tracking invariant across various player X coordinates
  const testPlayerXPositions = [-6.5, -3.0, 0.0, 2.5, 5.0, 8.0];
  for (const px of testPlayerXPositions) {
    for (const diffKey of difficulties) {
      const rng = createRng(333);
      for (let i = 0; i < 20; i++) {
        const bodyAim = resolveAimX('body', {
          handedness: 'right',
          playerX: px,
          aimSpread: DIFFICULTY[diffKey].aimSpread,
          rng,
        });
        const maxOffset = DIFFICULTY[diffKey].aimSpread * SMASH_DEFS.body.aimSpreadMul * 0.35 * 0.5 + 0.01;
        assert(
          Math.abs(bodyAim - px) <= maxOffset,
          `body smash strictly tracks playerX ${px} within bounded jitter (${diffKey})`,
        );
      }
    }
  }

  // Straight smash stays centered around hand position
  for (const hand of handSides) {
    const baseHandX = hand === 'right' ? 4 : -4;
    const rng = createRng(888);
    let sum = 0;
    const n = 300;
    for (let i = 0; i < n; i++) {
      const aim = resolveAimX('straight', {
        handedness: hand,
        playerX: 0,
        aimSpread: DIFFICULTY.normal.aimSpread,
        rng,
      });
      sum += aim;
    }
    const mean = sum / n;
    assert(Math.abs(mean - baseHandX) < 0.6, `straight smash mean matches hand position ${baseHandX}`);
  }
}

// ============================================================================
// 4. Contact Evaluation Under Extreme Timing Deltas and Offsets
// ============================================================================
{
  // Position grading boundaries: POS_PERFECT = 1.6, POS_GOOD = 3.2, POS_REACH = 4.2
  assert(gradePosition(0.0) === 'perfect', 'dist 0.0 perfect');
  assert(gradePosition(1.599) === 'perfect', 'dist 1.599 perfect');
  assert(gradePosition(POS_PERFECT) === 'perfect', 'dist POS_PERFECT perfect');
  assert(gradePosition(POS_PERFECT + 0.001) === 'good', 'dist 1.601 good');
  assert(gradePosition(3.199) === 'good', 'dist 3.199 good');
  assert(gradePosition(POS_GOOD) === 'good', 'dist POS_GOOD good');
  assert(gradePosition(POS_GOOD + 0.001) === 'reach', 'dist 3.201 reach');
  assert(gradePosition(4.199) === 'reach', 'dist 4.199 reach');
  assert(gradePosition(POS_REACH) === 'reach', 'dist POS_REACH reach');
  assert(gradePosition(POS_REACH + 0.001) === 'out', 'dist 4.201 out');
  assert(gradePosition(10.0) === 'out', 'dist 10 out');
  assert(gradePosition(500.0) === 'out', 'dist 500 out');

  // Timing grading with peak = duration * 0.45
  // For swingDurationSec = 0.20, peak = 0.09s (90ms)
  const windowsBase = getTimingWindowsMs(0, 0); // { perfect: 100, good: 260 }
  const swingDuration = 0.20;
  const peakSec = swingDuration * 0.45; // 0.09s

  // Perfect window: error <= 100ms
  assert(gradeTiming(0.09, swingDuration, peakSec, windowsBase) === 'perfect', 'exact peak timing');
  assert(gradeTiming(0.09, swingDuration, peakSec + 0.05, windowsBase) === 'perfect', '+50ms error perfect');
  assert(gradeTiming(0.09, swingDuration, peakSec - 0.05, windowsBase) === 'perfect', '-50ms error perfect');
  assert(gradeTiming(0.09, swingDuration, peakSec + 0.10, windowsBase) === 'perfect', '+100ms boundary perfect');
  assert(gradeTiming(0.09, swingDuration, peakSec - 0.10, windowsBase) === 'perfect', '-100ms boundary perfect');

  // Good window: 100ms < error <= 260ms
  assert(gradeTiming(0.09, swingDuration, peakSec + 0.101, windowsBase) === 'good', '+101ms good');
  assert(gradeTiming(0.09, swingDuration, peakSec - 0.101, windowsBase) === 'good', '-101ms good');
  assert(gradeTiming(0.09, swingDuration, peakSec + 0.260, windowsBase) === 'good', '+260ms boundary good');
  assert(gradeTiming(0.09, swingDuration, peakSec - 0.260, windowsBase) === 'good', '-260ms boundary good');

  // Late window: error > 260ms
  assert(gradeTiming(0.09, swingDuration, peakSec + 0.261, windowsBase) === 'late', '+261ms late');
  assert(gradeTiming(0.09, swingDuration, peakSec - 0.261, windowsBase) === 'late', '-261ms late');
  assert(gradeTiming(0.09, swingDuration, peakSec + 0.800, windowsBase) === 'late', '+800ms late');
  assert(gradeTiming(0.09, swingDuration, peakSec - 0.800, windowsBase) === 'late', '-800ms late');

  // Non-finite and null ETA values fall back to late
  assert(gradeTiming(0.09, swingDuration, null, windowsBase) === 'late', 'null eta late');
  assert(gradeTiming(0.09, swingDuration, undefined, windowsBase) === 'late', 'undefined eta late');
  assert(gradeTiming(0.09, swingDuration, NaN, windowsBase) === 'late', 'NaN eta late');
  assert(gradeTiming(0.09, swingDuration, Infinity, windowsBase) === 'late', 'Infinity eta late');
  assert(gradeTiming(0.09, swingDuration, -Infinity, windowsBase) === 'late', '-Infinity eta late');

  // combineContact full truth table verification
  const timingOptions = ['perfect', 'good', 'late'];
  const positionOptions = ['perfect', 'good', 'reach', 'out'];

  for (const timing of timingOptions) {
    // Whenever position is out, contact must ALWAYS be miss regardless of swing or timing
    assert(combineContact({ swinging: true, timing, position: 'out' }) === 'miss', 'out is miss (swinging)');
    assert(combineContact({ swinging: false, timing, position: 'out' }) === 'miss', 'out is miss (passive)');

    // Whenever not swinging and in position, contact must ALWAYS be block
    for (const position of ['perfect', 'good', 'reach']) {
      assert(
        combineContact({ swinging: false, timing, position }) === 'block',
        `passive contact in ${position} is always block`,
      );
    }
  }

  // Active swinging contact outcomes
  assert(combineContact({ swinging: true, timing: 'perfect', position: 'perfect' }) === 'perfect', 'perf+perf');
  assert(combineContact({ swinging: true, timing: 'perfect', position: 'good' }) === 'perfect', 'perf+good');
  assert(combineContact({ swinging: true, timing: 'perfect', position: 'reach' }) === 'good', 'perf+reach -> good');

  assert(combineContact({ swinging: true, timing: 'good', position: 'perfect' }) === 'good', 'good+perf -> good');
  assert(combineContact({ swinging: true, timing: 'good', position: 'good' }) === 'good', 'good+good -> good');
  assert(combineContact({ swinging: true, timing: 'good', position: 'reach' }) === 'good', 'good+reach -> good');

  assert(combineContact({ swinging: true, timing: 'late', position: 'perfect' }) === 'good', 'late+perf saved -> good');
  assert(combineContact({ swinging: true, timing: 'late', position: 'good' }) === 'block', 'late+good -> block');
  assert(combineContact({ swinging: true, timing: 'late', position: 'reach' }) === 'block', 'late+reach -> block');

  // ETA to impact calculations
  assert(etaToImpact({ z: -16 }, { z: 20 }, IMPACT_Z) === 1.0, '20 units at 20 u/s = 1.0s');
  assert(etaToImpact({ z: 0 }, { z: 20 }, IMPACT_Z) === 0.2, '4 units at 20 u/s = 0.2s');
  assert(etaToImpact({ z: 4 }, { z: 20 }, IMPACT_Z) === 0, 'on plane = 0s');
  assert(etaToImpact({ z: 5 }, { z: 20 }, IMPACT_Z) === 0, 'past plane = 0s');
  assert(etaToImpact({ z: -10 }, { z: 0 }, IMPACT_Z) === null, 'zero velocity = null');
  assert(etaToImpact({ z: -10 }, { z: -10 }, IMPACT_Z) === null, 'receding = null');
  assert(etaToImpact({ z: -10 }, { z: 0.005 }, IMPACT_Z) === null, 'sub-threshold velocity = null');

  // Window tightening under combo and wave tier
  const tier0Combo0 = getTimingWindowsMs(0, 0);
  const tier2Combo16 = getTimingWindowsMs(2, 16);
  const tier6Max = getTimingWindowsMs(6, 48);

  assert(tier0Combo0.perfect === 100 && tier0Combo0.good === 260, 'base window numbers');
  assert(tier2Combo16.perfect < tier0Combo0.perfect, 'combo tightens perfect window');
  assert(tier2Combo16.good < tier0Combo0.good, 'combo tightens good window');
  assert(tier6Max.perfect >= 50, 'perfect window obeys 50ms floor');
  assert(tier6Max.good >= 140, 'good window obeys 140ms floor');

  // Touch bonus offset calibration in getTimingWindowsMs
  const touchCalibrated = getTimingWindowsMs(2, 16, 20);
  assert(touchCalibrated.good === tier2Combo16.good + 20, 'good window expands by bonusMs');
  assert(touchCalibrated.perfect === tier2Combo16.perfect, 'perfect window remains strict');
}

// ============================================================================
// 5. Perfect Counter Window Timing and Score Multipliers
// ============================================================================
{
  // Window timing invariants
  assert(COUNTER_WINDOW_SEC === 1.15, 'counter window matches 1.15s standard');
  assert(COUNTER_WINDOW_SEC >= 1.0 && COUNTER_WINDOW_SEC <= 1.5, 'counter window within ergonomic range');

  // Score multiplier invariants
  const combos = [0, 1, 5, 10, 20, 50];
  for (const c of combos) {
    const centerBonus = counterScoreBonus('center', c);
    const leftBonus = counterScoreBonus('left', c);
    const rightBonus = counterScoreBonus('right', c);

    // Lateral symmetry
    assert(leftBonus === rightBonus, `corner counter symmetry at combo ${c}`);
    // Corner pays strictly more than center
    assert(leftBonus > centerBonus, `corner pays more than center at combo ${c}`);

    // Exact formula check: center = round(420 + c * 55), corner = round((420 + c * 55) * 1.4)
    const expectedCenter = Math.round(420 + c * 55);
    const expectedCorner = Math.round((420 + c * 55) * 1.4);
    assert(centerBonus === expectedCenter, `center bonus formula combo ${c}`);
    assert(leftBonus === expectedCorner, `corner bonus formula combo ${c}`);

    // Ratio verification
    const ratio = leftBonus / centerBonus;
    assert(Math.abs(ratio - 1.4) < 0.05, `corner multiplier ratio ~1.4 at combo ${c}`);
  }

  // Monotonicity: bonus strictly increases with combo
  for (let c = 0; c < 30; c++) {
    assert(
      counterScoreBonus('center', c + 1) > counterScoreBonus('center', c),
      `center counter monotonic at ${c}`,
    );
    assert(
      counterScoreBonus('left', c + 1) > counterScoreBonus('left', c),
      `left counter monotonic at ${c}`,
    );
  }

  // scoreForContact integration check
  assert(scoreForContact('miss', 5, 'center') === 0, 'miss pays 0');
  assert(scoreForContact('block', 5, 'center') === 40, 'block pays 40');
  assert(scoreForContact('block', 5, 'left') === 40, 'block unaffected by aim zone');

  const goodCenter = scoreForContact('good', 0, 'center');
  const goodLeft = scoreForContact('good', 0, 'left');
  assert(Math.round(goodCenter * 1.35) === goodLeft, 'corner aim adds 35% to good hit');

  const perfCenter = scoreForContact('perfect', 0, 'center');
  const perfLeft = scoreForContact('perfect', 0, 'left');
  assert(Math.round(perfCenter * 1.35) === perfLeft, 'corner aim adds 35% to perfect hit');
  assert(perfCenter > goodCenter * 3, 'perfect hit pays substantially more than good');

  // counterVersusBonus tests
  const coverBalanced = { coverLeft: 0.5, coverCenter: 0.5, coverRight: 0.5 };
  const coverOpenLeft = { coverLeft: 0.1, coverCenter: 0.8, coverRight: 0.9 };

  const bonusBalanced = counterVersusBonus('left', coverBalanced);
  const bonusOpen = counterVersusBonus('left', coverOpenLeft);
  assert(bonusOpen > bonusBalanced, 'open lane gives higher versus bonus');
  assert(bonusBalanced >= 0.08 && bonusOpen <= 0.26, 'versus bonus within bounded range');

  // AimZone from mouse coordinates
  assert(aimZoneFromMouse(-0.8) === 'left', 'mouse -0.8 left');
  assert(aimZoneFromMouse(-0.29) === 'left', 'mouse -0.29 left');
  assert(aimZoneFromMouse(-0.28) === 'center', 'mouse -0.28 center boundary');
  assert(aimZoneFromMouse(0.0) === 'center', 'mouse 0.0 center');
  assert(aimZoneFromMouse(0.28) === 'center', 'mouse +0.28 center boundary');
  assert(aimZoneFromMouse(0.29) === 'right', 'mouse +0.29 right');
  assert(aimZoneFromMouse(0.8) === 'right', 'mouse +0.8 right');
}

// ============================================================================
// 6. Multi-Rally Burst Succession & Rhythm Disruption
// ============================================================================
{
  // shouldStartBurst invariants
  const habitNoBurst = { id: 'test', label: '測試' };
  const habitZeroBurst = { id: 'test', label: '測試', burstChance: 0 };
  const habitNegBurst = { id: 'test', label: '測試', burstChance: -0.1 };
  const habitHighBurst = { id: 'burst', label: '連續', burstChance: 0.5, burstLen: 2 };

  assert(shouldStartBurst(null, 'straight', () => 0) === false, 'null habit no burst');
  assert(shouldStartBurst(undefined, 'straight', () => 0) === false, 'undefined habit no burst');
  assert(shouldStartBurst(habitNoBurst, 'straight', () => 0) === false, 'no burstChance no burst');
  assert(shouldStartBurst(habitZeroBurst, 'straight', () => 0) === false, 'zero burstChance no burst');
  assert(shouldStartBurst(habitNegBurst, 'straight', () => 0) === false, 'negative burstChance no burst');

  // Burst triggers strictly on heavy smashes (straight, body), NEVER on cross or drop
  assert(shouldStartBurst(habitHighBurst, 'straight', () => 0.1) === true, 'straight triggers burst');
  assert(shouldStartBurst(habitHighBurst, 'body', () => 0.1) === true, 'body triggers burst');
  assert(shouldStartBurst(habitHighBurst, 'cross', () => 0.0) === false, 'cross never triggers burst');
  assert(shouldStartBurst(habitHighBurst, 'drop', () => 0.0) === false, 'drop never triggers burst');

  // Burst chance roll boundary
  assert(shouldStartBurst(habitHighBurst, 'straight', () => 0.499) === true, 'roll below chance triggers');
  assert(shouldStartBurst(habitHighBurst, 'straight', () => 0.500) === false, 'roll at chance fails');
  assert(shouldStartBurst(habitHighBurst, 'straight', () => 0.501) === false, 'roll above chance fails');

  // Multi-rally burst succession simulation for Opponent 6 ('bao')
  const bao = getOpponent('bao');
  assert(bao !== null, 'bao opponent exists');
  assert(bao.habit.burstChance === 0.42, 'bao burst chance 0.42');
  assert(bao.habit.burstLen === 2, 'bao burst length 2');

  let burstCount = 0;
  let forceBurstCount = 0;
  const rallyLength = 200;
  let burstLeft = 0;
  const simRng = createRng(9999);

  for (let i = 0; i < rallyLength; i++) {
    const forceBurst = burstLeft > 0;
    if (forceBurst) {
      burstLeft -= 1;
      forceBurstCount += 1;
    }

    const smash = chooseSmash(bao.style, PHASE_MIX[0], simRng, {
      habit: bao.habit,
      forceBurst,
    });

    if (forceBurst) {
      // During forced burst, smash must be heavy and genuine
      assert(
        smash.real === 'straight' || smash.real === 'body',
        'forced burst must be straight or body',
      );
      assert(smash.isFake === false, 'forced burst cannot be a fake');
      assert(smash.tell === smash.real, 'forced burst tell equals real');
    }

    if (!forceBurst && shouldStartBurst(bao.habit, smash.real, simRng)) {
      burstCount += 1;
      burstLeft = Math.max(0, (bao.habit.burstLen ?? 1) - 1);
    }
  }

  assert(burstCount > 20 && burstCount < 70, `bao burst initiated ~40 times (got ${burstCount})`);
  assert(forceBurstCount === burstCount, 'every burst trigger produced exactly 1 forced follow-up');

  // Opponents without burst habit never initiate burst
  for (const oppId of ['mei', 'gui', 'coach', 'lu', 'min']) {
    const opp = getOpponent(oppId);
    assert(opp !== null, `${oppId} exists`);
    assert(shouldStartBurst(opp.habit, 'straight', () => 0) === false, `${oppId} never starts burst`);
    assert(shouldStartBurst(opp.habit, 'body', () => 0) === false, `${oppId} never starts burst`);
  }

  // Rhythm disruption invariants (counterDisruptsRhythm)
  // Center lane disruption is independent of cover and always rolls < 0.35
  const weakCover = { coverLeft: 0.1, coverCenter: 0.2, coverRight: 0.1 };
  const heavyCover = { coverLeft: 0.9, coverCenter: 0.8, coverRight: 0.9 };

  let centerDisruptWeak = 0;
  let centerDisruptHeavy = 0;
  for (let i = 0; i < 400; i++) {
    const r = createRng(10000 + i);
    if (counterDisruptsRhythm('center', weakCover, r)) centerDisruptWeak += 1;
    const r2 = createRng(10000 + i);
    if (counterDisruptsRhythm('center', heavyCover, r2)) centerDisruptHeavy += 1;
  }
  assert(centerDisruptWeak === centerDisruptHeavy, 'center disruption independent of cover');
  assert(centerDisruptWeak > 110 && centerDisruptWeak < 170, 'center disruption ~35%');

  // Corner disruption depends inversely on lane cover: 0.55 + (1 - covered) * 0.4 (capped at 0.92)
  let leftDisruptOpen = 0;
  let leftDisruptCovered = 0;
  for (let i = 0; i < 400; i++) {
    const rOpen = createRng(20000 + i);
    if (counterDisruptsRhythm('left', weakCover, rOpen)) leftDisruptOpen += 1;
    const rCov = createRng(20000 + i);
    if (counterDisruptsRhythm('left', heavyCover, rCov)) leftDisruptCovered += 1;
  }

  assert(
    leftDisruptOpen > leftDisruptCovered,
    'open corner disrupts significantly more often than covered corner',
  );
  assert(leftDisruptOpen > 330, `open corner disruption > 85% (got ${leftDisruptOpen}/400)`);
  assert(leftDisruptCovered < 270, `covered corner disruption < 65% (got ${leftDisruptCovered}/400)`);

  // Monotonicity of disruption formula
  const coverSteps = [0.0, 0.2, 0.4, 0.6, 0.8, 1.0];
  let prevRate = 1.0;
  for (const cov of coverSteps) {
    const covObj = { coverLeft: cov, coverCenter: 0.5, coverRight: 0.5 };
    const rollAlwaysTrue = () => 0.58; // roll value between 0.55 and 0.92
    const disrupts = counterDisruptsRhythm('left', covObj, rollAlwaysTrue);
    if (cov === 0.0) {
      assert(disrupts === true, 'fully open lane disrupts roll 0.58');
    } else if (cov === 1.0) {
      assert(disrupts === false, 'fully covered lane cannot disrupt roll 0.58');
    }
  }
}

// ============================================================================
// 7. 8-Opponent Ladder Progression, Unlocking, and Series Win Criteria
// ============================================================================
{
  assert(OPPONENTS.length === 8, 'eight opponents in roster');
  const expectedIds = ['hao', 'mei', 'gui', 'coach', 'lu', 'bao', 'min', 'king'];
  for (let i = 0; i < 8; i++) {
    assert(OPPONENTS[i].id === expectedIds[i], `opponent ${i} id ${expectedIds[i]}`);
    assert(OPPONENTS[i].unlockWins === i, `opponent ${i} requires ${i} unlock wins`);
    assert(OPPONENTS[i].bestOf === 3, `opponent ${i} series is bestOf 3`);
    assert(OPPONENTS[i].pointsToWin >= 4, `opponent ${i} pointsToWin >= 4`);
    assert(Boolean(OPPONENTS[i].name), `opponent ${i} has Traditional Chinese name`);
    assert(Boolean(OPPONENTS[i].habit?.id), `opponent ${i} has habit id`);
    assert(Boolean(OPPONENTS[i].habit?.label), `opponent ${i} has Traditional Chinese habit label`);

    // Verify style weights sum to ~1
    const st = OPPONENTS[i].style;
    const weightSum = st.straight + st.cross + st.drop + st.body;
    assert(Math.abs(weightSum - 1.0) < 0.01, `opponent ${i} style weights sum to 1`);
  }

  // Opponent 8 ('羽球魔王', king) high-tier reaction calibration
  const king = getOpponent('king');
  assert(king !== null, 'king opponent exists');
  assert(king.name === '羽球魔王', 'king name is Traditional Chinese 羽球魔王');
  assert(king.habit.windupBonusSec === 0.02, 'king has +20ms windup bonus for touch fairness');
  assert(king.habit.goodWindowBonusMs === 20, 'king has +20ms good window bonus for touch reaction');
  assert(king.habit.altTempo === true, 'king alternates tempo');
  assert(king.style.speedMul === 1.28, 'king maintains top speed ceiling 1.28');
  assert(king.style.fakeRate === 0.38, 'king maintains high fake ceiling 0.38');

  // seriesWinsNeeded calculations
  assert(seriesWinsNeeded(1) === 1, 'BO1 needs 1');
  assert(seriesWinsNeeded(3) === 2, 'BO3 needs 2');
  assert(seriesWinsNeeded(5) === 3, 'BO5 needs 3');
  assert(seriesWinsNeeded(7) === 4, 'BO7 needs 4');
  assert(seriesWinsNeeded(9) === 5, 'BO9 needs 5');
  assert(seriesWinsNeeded(0) === 2, 'default fallback for 0 is BO3 (2)');
  assert(seriesWinsNeeded(-3) === 1, 'negative clamped to 1 game (1)');
  assert(seriesWinsNeeded(null) === 2, 'null fallback is BO3 (2)');
  assert(seriesWinsNeeded(undefined) === 2, 'undefined fallback is BO3 (2)');

  // Step-by-step ladder unlocking simulation
  const winState = {};
  for (let i = 0; i < 8; i++) {
    const opp = OPPONENTS[i];
    if (i === 0) {
      assert(isOpponentUnlocked(winState, opp) === true, 'initial opponent is unlocked');
    } else {
      assert(isOpponentUnlocked(winState, opp) === false, `opponent ${opp.id} locked before previous win`);
      winState[OPPONENTS[i - 1].id] = 1;
      assert(isOpponentUnlocked(winState, opp) === true, `opponent ${opp.id} unlocked after beating predecessor`);
    }
  }

  // Repeat wins on one opponent do NOT advance ladder
  const repeatWins = { hao: 10 };
  assert(isOpponentUnlocked(repeatWins, OPPONENTS[0]) === true, 'hao unlocked');
  assert(isOpponentUnlocked(repeatWins, OPPONENTS[1]) === true, 'mei unlocked with 1 distinct win');
  assert(isOpponentUnlocked(repeatWins, OPPONENTS[2]) === false, 'gui remains locked without mei win');
  assert(isOpponentUnlocked(repeatWins, OPPONENTS[7]) === false, 'king remains locked');

  // Out of order corrupted win table safety
  const corruptedWins = { king: 5 };
  assert(isOpponentUnlocked(corruptedWins, OPPONENTS[1]) === false, 'mei locked if hao unrecorded');
  assert(isOpponentUnlocked(corruptedWins, OPPONENTS[2]) === false, 'gui locked if hao/mei unrecorded');
}

// ============================================================================
// 8. Versus Match Point Resolution
// ============================================================================
{
  const weak = { coverLeft: 0.2, coverCenter: 0.2, coverRight: 0.2, defense: 0.2 };
  const wall = { coverLeft: 0.9, coverCenter: 0.9, coverRight: 0.9, defense: 0.8 };
  let perfectWins = 0;
  let goodVsWall = 0;
  for (let i = 0; i < 200; i++) {
    const rng = createRng(1000 + i);
    if (versusReturnWinsPoint('perfect', 'left', weak, rng)) perfectWins += 1;
    if (versusReturnWinsPoint('good', 'center', wall, rng)) goodVsWall += 1;
  }
  assert(perfectWins > 150, 'perfect should usually win');
  assert(goodVsWall < 80, 'good vs wall should often fail');

  // Miss and block never score in versus
  assert(versusReturnWinsPoint('miss', 'left', weak, () => 0) === false, 'miss never wins point');
  assert(versusReturnWinsPoint('block', 'left', weak, () => 0) === false, 'block never wins point');
}

// ============================================================================
// 9. Taipei Daily Seed Determinism, Share Text, and Streak Preservation
// ============================================================================
{
  // Taipei date key (UTC+8) edge tests
  const utcMorning = new Date('2026-10-21T02:00:00Z'); // 10:00 Taipei -> 2026-10-21
  const utcLate = new Date('2026-10-21T15:59:59Z'); // 23:59 Taipei -> 2026-10-21
  const utcMidnight = new Date('2026-10-21T16:00:00Z'); // 00:00 next day Taipei -> 2026-10-22
  const utcNextDay = new Date('2026-10-21T16:00:01Z'); // 00:00:01 Taipei -> 2026-10-22

  assert(taipeiDateKey(utcMorning) === '2026-10-21', 'morning taipei date');
  assert(taipeiDateKey(utcLate) === '2026-10-21', 'late evening taipei date');
  assert(taipeiDateKey(utcMidnight) === '2026-10-22', 'midnight boundary taipei date');
  assert(taipeiDateKey(utcNextDay) === '2026-10-22', 'just past midnight taipei date');

  // Month and year boundaries in Taipei time
  assert(previousTaipeiDay('2026-10-01') === '2026-09-30', 'prev day month crossing');
  assert(previousTaipeiDay('2026-03-01') === '2026-02-28', 'prev day feb crossing standard');
  assert(previousTaipeiDay('2028-03-01') === '2028-02-29', 'prev day leap year crossing');
  assert(previousTaipeiDay('2027-01-01') === '2026-12-31', 'prev day year crossing');

  // Determinism across multiple calls
  const dateKey = '2026-11-19';
  const scriptA = buildDailyScript(dateKey);
  const scriptB = buildDailyScript(dateKey);
  const scriptC = buildDailyScript(dateKey);

  assert(scriptA.length === DAILY_BALL_COUNT, `daily script length ${DAILY_BALL_COUNT}`);
  assert(JSON.stringify(scriptA) === JSON.stringify(scriptB), 'daily script deterministic (A vs B)');
  assert(JSON.stringify(scriptB) === JSON.stringify(scriptC), 'daily script deterministic (B vs C)');

  // Distinct day keys produce distinct seed numbers and scripts
  const seedToday = dailySeedNumber('2026-11-19');
  const seedTomorrow = dailySeedNumber('2026-11-20');
  assert(seedToday !== seedTomorrow, 'different days produce distinct seeds');

  const scriptTomorrow = buildDailyScript('2026-11-20');
  assert(JSON.stringify(scriptA) !== JSON.stringify(scriptTomorrow), 'different days produce distinct scripts');

  // Daily shot escalation: late phase has higher fake chance than early phase
  let earlyFakes = 0;
  let lateFakes = 0;
  for (let day = 1; day <= 40; day++) {
    const k = `2026-10-${String(day).padStart(2, '0')}`;
    const s = buildDailyScript(k);
    for (let i = 0; i < 6; i++) {
      if (s[i].isFake) earlyFakes += 1;
    }
    for (let i = 12; i < 18; i++) {
      if (s[i].isFake) lateFakes += 1;
    }
  }
  assert(lateFakes > earlyFakes * 1.5, `late daily shots have higher fake rate (late ${lateFakes} vs early ${earlyFakes})`);

  // Daily streak preservation and boundary gap handling
  assert(computeDailyStreak({}, '2026-10-22') === 0, 'empty streak 0');
  assert(computeDailyStreak({ '2026-10-22': 5000 }, '2026-10-22') === 1, 'played today streak 1');
  assert(computeDailyStreak({ '2026-10-21': 5000 }, '2026-10-22') === 1, 'played yesterday grace period 1');
  assert(
    computeDailyStreak({ '2026-10-22': 5000, '2026-10-21': 4000 }, '2026-10-22') === 2,
    'two day streak',
  );
  assert(
    computeDailyStreak({ '2026-10-21': 5000, '2026-10-20': 4000 }, '2026-10-22') === 2,
    'two day streak ending yesterday',
  );
  assert(
    computeDailyStreak({ '2026-10-22': 5000, '2026-10-20': 4000 }, '2026-10-22') === 1,
    'gap yesterday breaks streak back to 1',
  );
  assert(
    computeDailyStreak({ '2026-10-20': 4000 }, '2026-10-22') === 0,
    'gap two days ago with no play yesterday or today yields 0',
  );

  // Month-crossing streak preservation
  const monthCrossingStreak = {
    '2026-11-02': 100,
    '2026-11-01': 200,
    '2026-10-31': 300,
    '2026-10-30': 400,
  };
  assert(computeDailyStreak(monthCrossingStreak, '2026-11-02') === 4, 'month crossing streak intact (4 days)');

  // Year-crossing streak preservation
  const yearCrossingStreak = {
    '2027-01-02': 100,
    '2027-01-01': 200,
    '2026-12-31': 300,
    '2026-12-30': 400,
    '2026-12-29': 500,
  };
  assert(computeDailyStreak(yearCrossingStreak, '2027-01-02') === 5, 'year crossing streak intact (5 days)');

  // Non-positive scores do not count towards streak
  const zeroScoreMap = { '2026-10-22': 0, '2026-10-21': 500 };
  assert(computeDailyStreak(zeroScoreMap, '2026-10-22') === 1, 'zero score falls back to yesterday streak');

  // Share text formatting verification
  const share = buildDailyShareText({
    dateKey: '2026-11-19',
    score: 14500,
    perfects: 15,
    accuracy: 94,
    streak: 7,
  });

  const lines = share.split('\n');
  assert(lines.length === 4, 'share text has exactly 4 lines');
  assert(lines[0] === '羽毛球接殺 每日 2026-11-19', 'share line 1 header in Traditional Chinese');
  assert(lines[1] === '得分 14500 · 完美 15 · 命中 94%', 'share line 2 telemetry in Traditional Chinese');
  assert(lines[2] === '連續 7 天', 'share line 3 streak in Traditional Chinese');
  assert(lines[3] === 'Clubhouse Games', 'share line 4 branding');
}

// ============================================================================
// 10. LocalStorage Schema Sanitization and Migration Roundtrip
// ============================================================================
{
  const mem = new Map();
  const storage = {
    getItem: (k) => (mem.has(k) ? mem.get(k) : null),
    setItem: (k, v) => mem.set(k, v),
  };

  const bad = normalizeStats({
    careerPerfects: -3,
    careerMaxCombo: 'invalid',
    careerPlays: null,
    drillBestAcc: { 'normal:25': 'nope', 'easy:10': 88 },
    dailyBest: { '2026-10-22': 12.5 },
    versusWins: { hao: 3, mei: 'bogus' },
  });

  assert(bad.careerPerfects === 0, 'clamp negative perfects to 0');
  assert(bad.careerMaxCombo === 0, 'sanitize invalid max combo to 0');
  assert(bad.careerPlays === 0, 'sanitize null plays to 0');
  assert(bad.drillBestAcc['easy:10'] === 88, 'keep valid accuracy');
  assert(bad.drillBestAcc['normal:25'] == null, 'drop invalid accuracy string');
  assert(bad.dailyBest['2026-10-22'] === 12, 'floor decimal daily score');
  assert(bad.versusWins.hao === 3, 'keep valid versus wins');
  assert(bad.versusWins.mei == null, 'drop invalid versus wins');
  assert(bad.careerCounters === 0, 'default career counters to 0');

  let stats = emptyStats();
  assert(applyDrillResult(stats, { difficulty: 'normal', balls: 25, accuracy: 80, perfects: 4, maxCombo: 5 }));
  assert(!applyDrillResult(stats, { difficulty: 'normal', balls: 25, accuracy: 70, perfects: 1, maxCombo: 2 }));
  assert(stats.drillBestAcc['normal:25'] === 80, 'best drill accuracy kept');
  assert(stats.careerPerfects === 5, 'career perfects accumulated');
  assert(stats.careerMaxCombo === 5, 'career max combo updated');

  assert(applyScoreAttackResult(stats, { difficulty: 'hard', score: 9000, perfects: 2, maxCombo: 6 }));
  assert(!applyScoreAttackResult(stats, { difficulty: 'hard', score: 8500, perfects: 1, maxCombo: 3 }));
  assert(stats.scoreAttackBest.hard === 9000, 'best score attack kept');
  assert(stats.careerMaxCombo === 6, 'max combo raised to 6');

  applyVersusResult(stats, {
    opponentId: 'hao',
    won: true,
    perfects: 1,
    maxCombo: 3,
    streak: 2,
    counters: 4,
  });
  assert(stats.versusWins.hao === 1, 'versus win recorded');
  assert(stats.versusBestStreak.hao === 2, 'versus streak recorded');
  assert(stats.careerCounters === 4, 'versus counters recorded');

  assert(applyDailyResult(stats, { dateKey: '2026-10-22', score: 5000, perfects: 3, maxCombo: 4, counters: 2 }));
  assert(!applyDailyResult(stats, { dateKey: '2026-10-22', score: 4000, perfects: 1, maxCombo: 2, counters: 1 }));
  assert(stats.dailyBest['2026-10-22'] === 5000, 'daily best preserved');
  assert(stats.careerCounters === 7, 'career counters accumulated');

  saveStats(stats, storage);
  assert(mem.has(STATS_KEY), 'saved to v3 storage key');

  const loaded = loadStats(storage);
  assert(loaded.versusWins.hao === 1, 'versus win roundtrip');
  assert(loaded.scoreAttackBest.hard === 9000, 'score attack roundtrip');
  assert(loaded.dailyBest['2026-10-22'] === 5000, 'daily roundtrip');
  assert(loaded.careerCounters === 7, 'career counters roundtrip');
  assert(loaded.careerPerfects === 13, 'career perfects roundtrip');
  assert(loaded.careerPlays === 7, 'career plays roundtrip');
}

console.log('check-smash: ok');

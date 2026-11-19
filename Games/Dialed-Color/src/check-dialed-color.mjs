import {
  calculateScore,
  distanceComponents,
  hueDelta,
  scoreEmoji,
  scoreBandLabel,
  scoreToAccuracy,
} from './score.mjs';
import {
  mixColors,
  complementaryOf,
  analogousOf,
  survivalParams,
  buildTargets,
  clampColor,
  colorToCss,
  huePatternId,
  huePatternLabel,
  meanHue,
  hslToRgb,
  rgbToHsl,
  ASCENT_SHOW_MS,
  ASCENT_PASS,
} from './colors.mjs';
import {
  dateKey,
  dailyBaseSeed,
  dailySeedCode,
  dailyTargets,
  computeStreak,
  previousDay,
  DAILY_ROUNDS,
} from './daily.mjs';
import { buildDailyShareText } from './share.mjs';
import { mulberry32, hashString } from './rng.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertClose(actual, expected, tol, msg) {
  if (Math.abs(actual - expected) > tol) {
    throw new Error(`${msg}: expected ${expected} ± ${tol}, got ${actual}`);
  }
}

// ============================================================================
// 1. 3D HSL Distance Normalization & Scoring Curve
// ============================================================================

// Identical colors must score 999 with 0 distance
const same = { h: 120, s: 50, l: 50 };
assert(calculateScore(same, same) === 999, 'identical colors should score 999');
const sameComps = distanceComponents(same, same);
assert(sameComps.distance === 0, 'identical distance should be 0');

// Maximum theoretical distance bounds:
// Diametrically opposite extremes in the normalized 3D HSL cube (dh=1, ds=1, dl=1)
const cornerA = { h: 0, s: 0, l: 0 };
const cornerB = { h: 180, s: 100, l: 100 };
const cornerComps = distanceComponents(cornerA, cornerB);
assertClose(cornerComps.distance, 1.0, 1e-6, 'extreme corner distance should normalize to 1.0');
assert(calculateScore(cornerA, cornerB) === 0, 'maximum distance corner should score 0');

// Verify distance is strictly bounded in [0, 1] across various color combinations
const sampleColors = [
  { h: 0, s: 0, l: 0 },
  { h: 180, s: 100, l: 100 },
  { h: 45, s: 100, l: 20 },
  { h: 225, s: 10, l: 80 },
  { h: 359, s: 50, l: 50 },
  { h: 1, s: 50, l: 50 },
  { h: 90, s: 0, l: 50 },
  { h: 270, s: 100, l: 50 },
];
for (let i = 0; i < sampleColors.length; i += 1) {
  for (let j = 0; j < sampleColors.length; j += 1) {
    const c1 = sampleColors[i];
    const c2 = sampleColors[j];
    const { distance } = distanceComponents(c1, c2);
    assert(distance >= 0 && distance <= 1.0, `distance out of [0, 1] bound: ${distance}`);
    const score = calculateScore(c1, c2);
    assert(score >= 0 && score <= 999, `score out of [0, 999] bound: ${score}`);
  }
}

// Opposite hue with same saturation & lightness:
// dh = 1, ds = 0, dl = 0 -> distance = Math.sqrt(1/3) ≈ 0.57735.
// Smooth decay: should score floor(999 * (1 - 1/sqrt(3))) = 422, NOT clip to 0!
const oppositeHue = calculateScore({ h: 0, s: 50, l: 50 }, { h: 180, s: 50, l: 50 });
assert(oppositeHue === 422, `opposite hue should smoothly score 422, got ${oppositeHue}`);

// Half hue (90° delta):
// dh = 0.5, ds = 0, dl = 0 -> distance = Math.sqrt(0.25/3) ≈ 0.288675.
// Score = floor(999 * (1 - 0.288675)) = 710.
const halfHue = calculateScore({ h: 0, s: 50, l: 50 }, { h: 90, s: 50, l: 50 });
assert(halfHue === 710, `90° hue delta should score 710, got ${halfHue}`);

// Saturation-only full delta (ds=1, dh=0, dl=0):
const satOnly = calculateScore({ h: 40, s: 0, l: 50 }, { h: 40, s: 100, l: 50 });
assert(satOnly === 422, `full saturation-only delta should score 422, got ${satOnly}`);

// Lightness-only full delta (dl=1, dh=0, ds=0):
const lightOnly = calculateScore({ h: 40, s: 50, l: 0 }, { h: 40, s: 50, l: 100 });
assert(lightOnly === 422, `full lightness-only delta should score 422, got ${lightOnly}`);

// Near-miss calibration: 10-20° hue delta with small sat/light deltas should score in 800-950 range
const nearMiss1 = calculateScore({ h: 10, s: 50, l: 50 }, { h: 20, s: 55, l: 52 });
assert(nearMiss1 >= 900 && nearMiss1 <= 960, `near miss 1 (10° dh) expected 900-960, got ${nearMiss1}`);

const nearMiss2 = calculateScore({ h: 0, s: 50, l: 50 }, { h: 15, s: 55, l: 55 });
assert(nearMiss2 >= 900 && nearMiss2 <= 950, `near miss 2 (15° dh) expected 900-950, got ${nearMiss2}`);

const nearMiss3 = calculateScore({ h: 0, s: 50, l: 50 }, { h: 20, s: 60, l: 60 });
assert(nearMiss3 >= 850 && nearMiss3 <= 920, `near miss 3 (20° dh) expected 850-920, got ${nearMiss3}`);

const nearMiss4 = calculateScore({ h: 180, s: 70, l: 40 }, { h: 205, s: 60, l: 45 });
assert(nearMiss4 >= 850 && nearMiss4 <= 920, `near miss 4 (25° dh) expected 850-920, got ${nearMiss4}`);

const nearMiss5 = calculateScore({ h: 240, s: 60, l: 50 }, { h: 270, s: 75, l: 60 });
assert(nearMiss5 >= 800 && nearMiss5 <= 900, `near miss 5 (30° dh) expected 800-900, got ${nearMiss5}`);

// Circular hue wrapping:
// 10° ↔ 350° distance is 20°, identical to 10° ↔ 30° distance
const wrapHue = calculateScore({ h: 10, s: 40, l: 40 }, { h: 350, s: 40, l: 40 });
const noWrap = calculateScore({ h: 10, s: 40, l: 40 }, { h: 30, s: 40, l: 40 });
assert(wrapHue === noWrap, 'hue wrap 10↔350 should match 10↔30 distance');
assert(hueDelta({ h: 5, s: 50, l: 50 }, { h: 355, s: 50, l: 50 }) === 10, 'hueDelta wrap');
assert(hueDelta({ h: 0, s: 50, l: 50 }, { h: 360, s: 50, l: 50 }) === 0, 'hueDelta 0/360 identical');

// Telemetry components check:
const comps = distanceComponents({ h: 0, s: 10, l: 20 }, { h: 90, s: 60, l: 70 });
assert(comps.hueDeg === 90, `hueDeg expected 90, got ${comps.hueDeg}`);
assert(comps.satPct === 50, `satPct expected 50, got ${comps.satPct}`);
assert(comps.lightPct === 50, `lightPct expected 50, got ${comps.lightPct}`);
assert(comps.hueNorm === 0.5, `hueNorm expected 0.5, got ${comps.hueNorm}`);
assert(comps.satNorm === 0.5, `satNorm expected 0.5, got ${comps.satNorm}`);
assert(comps.lightNorm === 0.5, `lightNorm expected 0.5, got ${comps.lightNorm}`);
assertClose(comps.distance, 0.5, 1e-6, 'expected distance 0.5 for equal 0.5 components');

// Score emoji, labels, and accuracy conversion:
assert(scoreEmoji(950) === '🟩', 'high score emoji');
assert(scoreEmoji(900) === '🟩', '900 boundary emoji');
assert(scoreEmoji(800) === '🟨', 'mid-high emoji');
assert(scoreEmoji(750) === '🟨', '750 boundary emoji');
assert(scoreEmoji(600) === '🟧', 'mid emoji');
assert(scoreEmoji(550) === '🟧', '550 boundary emoji');
assert(scoreEmoji(549) === '⬛', 'low emoji below 550');
assert(scoreEmoji(100) === '⬛', 'low emoji');

assert(scoreBandLabel(950) === '精準', 'band label >= 900');
assert(scoreBandLabel(800) === '不錯', 'band label >= 750');
assert(scoreBandLabel(600) === '尚可', 'band label >= 550');
assert(scoreBandLabel(200) === '偏離', 'band label < 550');

assert(scoreToAccuracy(999) === 100, 'perfect accuracy');
assert(scoreToAccuracy(0) === 0, 'zero accuracy');
assert(scoreToAccuracy(499) === 50, 'half accuracy');

// ============================================================================
// 2. Perceptual Gradient Monotonic Decay
// ============================================================================

// Hue gradient monotonic decay:
const baseHueColor = { h: 180, s: 60, l: 50 };
const hueOffsets = [0, 5, 10, 15, 20, 30, 45, 60, 90, 120, 150, 180];
let lastHueDist = -1;
let lastHueScore = 1000;
for (const dh of hueOffsets) {
  const c = { h: (baseHueColor.h + dh) % 360, s: baseHueColor.s, l: baseHueColor.l };
  const { distance } = distanceComponents(baseHueColor, c);
  const score = calculateScore(baseHueColor, c);
  assert(distance > lastHueDist || dh === 0, `hue distance should increase at dh=${dh}`);
  assert(score <= lastHueScore, `hue score should monotonically decrease at dh=${dh}: ${score} vs ${lastHueScore}`);
  lastHueDist = distance;
  lastHueScore = score;
}

// Saturation gradient monotonic decay:
const baseSatColor = { h: 120, s: 50, l: 50 };
const satDeltas = [0, 5, 10, 15, 20, 30, 40, 50];
let lastSatDist = -1;
let lastSatScore = 1000;
for (const ds of satDeltas) {
  const c = { h: baseSatColor.h, s: baseSatColor.s + ds, l: baseSatColor.l };
  const { distance } = distanceComponents(baseSatColor, c);
  const score = calculateScore(baseSatColor, c);
  assert(distance > lastSatDist || ds === 0, `sat distance should increase at ds=${ds}`);
  assert(score <= lastSatScore, `sat score should monotonically decrease at ds=${ds}: ${score} vs ${lastSatScore}`);
  lastSatDist = distance;
  lastSatScore = score;
}

// Lightness gradient monotonic decay:
const baseLightColor = { h: 240, s: 60, l: 50 };
const lightDeltas = [0, 5, 10, 15, 20, 30, 40, 50];
let lastLightDist = -1;
let lastLightScore = 1000;
for (const dl of lightDeltas) {
  const c = { h: baseLightColor.h, s: baseLightColor.s, l: baseLightColor.l + dl };
  const { distance } = distanceComponents(baseLightColor, c);
  const score = calculateScore(baseLightColor, c);
  assert(distance > lastLightDist || dl === 0, `light distance should increase at dl=${dl}`);
  assert(score <= lastLightScore, `light score should monotonically decrease at dl=${dl}: ${score} vs ${lastLightScore}`);
  lastLightDist = distance;
  lastLightScore = score;
}

// Simultaneous 3D diagonal decay:
let lastDiagDist = -1;
let lastDiagScore = 1000;
for (let step = 0; step <= 10; step += 1) {
  const t = step / 10;
  const c = { h: Math.round(t * 180), s: Math.round(t * 100), l: Math.round(t * 100) };
  const { distance } = distanceComponents(cornerA, c);
  const score = calculateScore(cornerA, c);
  assert(distance > lastDiagDist || step === 0, `diagonal distance should increase at step=${step}`);
  assert(score <= lastDiagScore, `diagonal score should monotonically decrease at step=${step}`);
  lastDiagDist = distance;
  lastDiagScore = score;
}
assert(lastDiagScore === 0, 'full diagonal 3D opposite should score 0');

// ============================================================================
// 3. RGB / HSL Conversion Boundaries & Round-Trip Fidelity
// ============================================================================

// Primary colors HSL -> RGB
const [redR, redG, redB] = hslToRgb({ h: 0, s: 100, l: 50 });
assert(redR === 255 && redG === 0 && redB === 0, `pure red expected [255, 0, 0], got [${redR}, ${redG}, ${redB}]`);

const [greenR, greenG, greenB] = hslToRgb({ h: 120, s: 100, l: 50 });
assert(greenR === 0 && greenG === 255 && greenB === 0, `pure green expected [0, 255, 0], got [${greenR}, ${greenG}, ${greenB}]`);

const [blueR, blueG, blueB] = hslToRgb({ h: 240, s: 100, l: 50 });
assert(blueR === 0 && blueG === 0 && blueB === 255, `pure blue expected [0, 0, 255], got [${blueR}, ${blueG}, ${blueB}]`);

// Primary colors RGB -> HSL
const redHsl = rgbToHsl(255, 0, 0);
assert(redHsl.h === 0 && redHsl.s === 100 && redHsl.l === 50, 'RGB to HSL pure red');

const greenHsl = rgbToHsl(0, 255, 0);
assert(greenHsl.h === 120 && greenHsl.s === 100 && greenHsl.l === 50, 'RGB to HSL pure green');

const blueHsl = rgbToHsl(0, 0, 255);
assert(blueHsl.h === 240 && blueHsl.s === 100 && blueHsl.l === 50, 'RGB to HSL pure blue');

// Secondary colors:
const [yellowR, yellowG, yellowB] = hslToRgb({ h: 60, s: 100, l: 50 });
assert(yellowR === 255 && yellowG === 255 && yellowB === 0, 'yellow RGB');
const yellowHsl = rgbToHsl(255, 255, 0);
assert(yellowHsl.h === 60 && yellowHsl.s === 100 && yellowHsl.l === 50, 'yellow HSL');

const [cyanR, cyanG, cyanB] = hslToRgb({ h: 180, s: 100, l: 50 });
assert(cyanR === 0 && cyanG === 255 && cyanB === 255, 'cyan RGB');
const cyanHsl = rgbToHsl(0, 255, 255);
assert(cyanHsl.h === 180 && cyanHsl.s === 100 && cyanHsl.l === 50, 'cyan HSL');

const [magentaR, magentaG, magentaB] = hslToRgb({ h: 300, s: 100, l: 50 });
assert(magentaR === 255 && magentaG === 0 && magentaB === 255, 'magenta RGB');
const magentaHsl = rgbToHsl(255, 0, 255);
assert(magentaHsl.h === 300 && magentaHsl.s === 100 && magentaHsl.l === 50, 'magenta HSL');

// Extremes: black & white
const [blackR, blackG, blackB] = hslToRgb({ h: 0, s: 50, l: 0 });
assert(blackR === 0 && blackG === 0 && blackB === 0, 'pure black RGB');
const blackHsl = rgbToHsl(0, 0, 0);
assert(blackHsl.l === 0, 'pure black HSL lightness 0');

const [whiteR, whiteG, whiteB] = hslToRgb({ h: 200, s: 80, l: 100 });
assert(whiteR === 255 && whiteG === 255 && whiteB === 255, 'pure white RGB');
const whiteHsl = rgbToHsl(255, 255, 255);
assert(whiteHsl.l === 100, 'pure white HSL lightness 100');

// Grayscale (s=0):
const [grayR, grayG, grayB] = hslToRgb({ h: 0, s: 0, l: 50 });
assert(grayR === 128 && grayG === 128 && grayB === 128, 'gray RGB 128');
const grayHsl = rgbToHsl(128, 128, 128);
assert(grayHsl.s === 0 && grayHsl.l === 50, 'gray HSL s=0, l=50');

// Clamping and normalization helpers:
assert(clampColor(-45, 120, -10).h === 315, 'negative hue wraps to 315');
assert(clampColor(720, 120, -10).h === 0, '720 wraps to 0');
assert(clampColor(0, 150, 150).s === 100 && clampColor(0, 150, 150).l === 100, 'saturation and lightness clamped to 100');
assert(colorToCss({ h: 210, s: 80, l: 60 }) === 'hsl(210, 80%, 60%)', 'CSS string formatter');

// Colorblind pattern id & labels (0–5):
assert(huePatternId(0) === 0 && huePatternLabel(0) === '斜紋', 'pattern 0');
assert(huePatternId(60) === 1 && huePatternLabel(60) === '點陣', 'pattern 1');
assert(huePatternId(120) === 2 && huePatternLabel(120) === '橫線', 'pattern 2');
assert(huePatternId(180) === 3 && huePatternLabel(180) === '格紋', 'pattern 3');
assert(huePatternId(240) === 4 && huePatternLabel(240) === '菱形', 'pattern 4');
assert(huePatternId(300) === 5 && huePatternLabel(300) === '波紋', 'pattern 5');
assert(huePatternId(360) === 0, 'pattern 360 wrap');

// Round-trip fidelity: HSL -> RGB -> HSL across color space
const testHues = [15, 45, 90, 150, 210, 270, 330];
const testSats = [30, 60, 90];
const testLights = [25, 50, 75];
for (const h of testHues) {
  for (const s of testSats) {
    for (const l of testLights) {
      const orig = { h, s, l };
      const [r, g, b] = hslToRgb(orig);
      const recovered = rgbToHsl(r, g, b);
      const score = calculateScore(orig, recovered);
      assert(score >= 970, `round-trip score too low for HSL(${h},${s},${l}): got ${score}`);
    }
  }
}

// Circular mean hue:
assertClose(meanHue(10, 30), 20, 1e-4, 'meanHue 10 and 30');
assertClose(meanHue(350, 10), 0, 1e-4, 'meanHue across wrap 350 and 10');

// ============================================================================
// 4. Harmonies & Color Mixing
// ============================================================================

const ref = clampColor(40, 70, 50);
const comp = complementaryOf(ref);
assert(comp.h === 220, `complement of 40 should be 220, got ${comp.h}`);
assert(complementaryOf({ h: 220, s: 70, l: 50 }).h === 40, 'complement symmetry');
assert(complementaryOf({ h: 350, s: 50, l: 50 }).h === 170, 'complement wrap');

assert(analogousOf(ref, 30).h === 70, 'analogous +30');
assert(analogousOf(ref, -30).h === 10, 'analogous -30');
assert(analogousOf({ h: 10, s: 50, l: 50 }, -30).h === 340, 'analogous wrap negative');

const mixed = mixColors({ h: 0, s: 100, l: 50 }, { h: 120, s: 100, l: 50 });
assert(typeof mixed.h === 'number' && mixed.s >= 0, 'mixColors returns color');
// Red + green additive light mix produces yellow
assert(mixed.h > 30 && mixed.h < 90, `red+green mix hue should be yellowish, got ${mixed.h}`);

// Blue + red mix produces magenta
const blueRedMix = mixColors({ h: 240, s: 100, l: 50 }, { h: 0, s: 100, l: 50 });
assert(blueRedMix.h > 270 && blueRedMix.h < 330, `blue+red mix should be magenta, got ${blueRedMix.h}`);

// ============================================================================
// 5. Game Modes & Survival Progression
// ============================================================================

// Survival parameters progression over rounds:
const s0 = survivalParams(0);
const s5 = survivalParams(5);
const s10 = survivalParams(10);
const s20 = survivalParams(20);

// showMs strictly decreases to clamp
assert(s0.showMs > s5.showMs && s5.showMs > s10.showMs, 'survival showMs shortens');
assert(s20.showMs === 400, 'survival showMs clamps at 400');

// pass score strictly increases to clamp
assert(s0.pass < s5.pass && s5.pass < s10.pass, 'survival pass score rises');
assert(s20.pass === 820, 'survival pass clamps at 820');

// nearHueWindow strictly narrows to clamp
assert(s0.nearHueWindow > s5.nearHueWindow && s5.nearHueWindow > s10.nearHueWindow, 'survival hues tighten');
assert(s20.nearHueWindow === 18, 'survival nearHueWindow clamps at 18');

// Ascent mode levels and pass threshold:
assert(ASCENT_SHOW_MS.length === 5, 'ascent mode 5 stages');
assert(ASCENT_PASS === 650, 'ascent pass score 650');
for (let i = 1; i < ASCENT_SHOW_MS.length; i += 1) {
  assert(ASCENT_SHOW_MS[i] < ASCENT_SHOW_MS[i - 1], 'ascent showMs strictly decreasing');
}

// Mode target builders:
const rand = mulberry32(hashString('test-seed-42'));
const singlePack = buildTargets('single', rand);
assert(singlePack.targets.length === 1, 'single mode target count');

const blitz = buildTargets('blitz', rand);
assert(blitz.targets.length >= 20, `blitz pool size should be >= 20, got ${blitz.targets.length}`);

const mixPack = buildTargets('mix', mulberry32(42));
assert(mixPack.mixPairs?.length === 1, 'mix has pair');
assert(mixPack.targets.length === 1, 'mix has one target');
assert(mixPack.refs?.length === 2, 'mix has two references');

const complementPack = buildTargets('complement', mulberry32(99));
assert(complementPack.targets.length === 1, 'complement mode has one target');
assert(complementPack.prompts?.length === 1, 'complement mode prompt text');

const analogousPack = buildTargets('analogous', mulberry32(99));
assert(analogousPack.targets.length === 1, 'analogous mode has one target');
assert(analogousPack.prompts?.length === 1, 'analogous mode prompt text');

const ascentPack = buildTargets('ascent', mulberry32(123));
assert(ascentPack.targets.length === 5, 'ascent mode 5 targets');

// ============================================================================
// 6. Streak Handling & Date Math
// ============================================================================

// UTC to Taipei dateKey:
assert(dateKey(new Date('2026-10-18T16:00:00Z')) === '2026-10-19', 'UTC 16:00 → Taipei next day');
assert(dateKey(new Date('2026-10-18T15:59:00Z')) === '2026-10-18', 'UTC 15:59 → Taipei same day');

// previousDay date arithmetic:
assert(previousDay('2026-10-15') === '2026-10-14', 'mid-month previousDay');
assert(previousDay('2026-10-01') === '2026-09-30', 'month boundary previousDay');
assert(previousDay('2024-03-01') === '2024-02-29', 'leap year Feb boundary previousDay');
assert(previousDay('2025-03-01') === '2025-02-28', 'non-leap year Feb boundary previousDay');
assert(previousDay('2027-01-01') === '2026-12-31', 'year boundary previousDay');

// computeStreak test scenarios:
assert(computeStreak([], '2026-10-19') === 0, 'empty streak is 0');

// Played today only:
assert(
  computeStreak([{ date: '2026-10-19', average: 750, scores: [750] }], '2026-10-19') === 1,
  'played today only is streak 1',
);

// Played yesterday only (today not played yet):
assert(
  computeStreak([{ date: '2026-10-18', average: 750, scores: [750] }], '2026-10-19') === 1,
  'played yesterday only keeps active streak 1',
);

// Multi-day consecutive streak:
const continuousRecords = [
  { date: '2026-10-19', average: 850, scores: [850] },
  { date: '2026-10-18', average: 720, scores: [720] },
  { date: '2026-10-17', average: 900, scores: [900] },
  { date: '2026-10-16', average: 650, scores: [650] },
  { date: '2026-10-15', average: 780, scores: [780] },
];
assert(computeStreak(continuousRecords, '2026-10-19') === 5, '5-day streak');

// Broken streak (played today and yesterday, but missed day before):
const brokenRecords = [
  { date: '2026-10-19', average: 700, scores: [700] },
  { date: '2026-10-18', average: 600, scores: [600] },
  { date: '2026-10-16', average: 800, scores: [800] }, // missed 2026-10-17
];
assert(computeStreak(brokenRecords, '2026-10-19') === 2, 'broken streak after 2 days');

// Missed both today and yesterday:
const expiredRecords = [
  { date: '2026-10-17', average: 700, scores: [700] },
];
assert(computeStreak(expiredRecords, '2026-10-19') === 0, 'broken streak beyond 1 day gap is 0');

// Duplicate dates (e.g. multiple sessions on same day):
const dupRecords = [
  { date: '2026-10-19', average: 700, scores: [700] },
  { date: '2026-10-19', average: 850, scores: [850] },
  { date: '2026-10-18', average: 600, scores: [600] },
];
assert(computeStreak(dupRecords, '2026-10-19') === 2, 'duplicate date entries deduplicated');

// Out of order date array:
const shuffledRecords = [
  { date: '2026-10-17', average: 900, scores: [900] },
  { date: '2026-10-19', average: 850, scores: [850] },
  { date: '2026-10-18', average: 720, scores: [720] },
];
assert(computeStreak(shuffledRecords, '2026-10-19') === 3, 'shuffled records yield correct streak');

// ============================================================================
// 7. Daily Seeded Stability & RNG Determinism
// ============================================================================

const testDate = '2026-10-19';
assert(dailySeedCode(testDate) === 'dialed-color-daily-2026-10-19', 'dailySeedCode format');

const seedA = dailyBaseSeed(testDate);
const seedB = dailyBaseSeed(testDate);
assert(seedA === seedB, 'daily seed is deterministic');
assert(seedA !== dailyBaseSeed('2026-10-20'), 'different dates produce different seeds');

const d1 = dailyTargets(testDate);
const d2 = dailyTargets(testDate);
assert(d1.targets.length === DAILY_ROUNDS, `daily target count should be ${DAILY_ROUNDS}`);
assert(
  d1.targets.every((c, i) => c.h === d2.targets[i].h && c.s === d2.targets[i].s && c.l === d2.targets[i].l),
  'daily targets identical for same date across independent invocations',
);

// Target bounds validity:
for (const t of d1.targets) {
  assert(t.h >= 0 && t.h < 360, `target hue in [0, 360): ${t.h}`);
  assert(t.s >= 0 && t.s <= 100, `target sat in [0, 100]: ${t.s}`);
  assert(t.l >= 0 && t.l <= 100, `target light in [0, 100]: ${t.l}`);
}

// Consecutive days targets must differ:
const dNext = dailyTargets('2026-10-20');
const isDifferent = d1.targets.some((c, i) => c.h !== dNext.targets[i].h || c.s !== dNext.targets[i].s);
assert(isDifferent, 'consecutive days must generate different target colors');

// Mulberry32 determinism:
const rng1 = mulberry32(12345);
const rng2 = mulberry32(12345);
const seq1 = Array.from({ length: 100 }, () => rng1());
const seq2 = Array.from({ length: 100 }, () => rng2());
assert(seq1.every((v, i) => v === seq2[i]), 'mulberry32 generates identical sequence for identical seed');
assert(seq1.every((v) => v >= 0 && v < 1), 'mulberry32 outputs in [0, 1)');

// HashString consistency:
assert(hashString('dialed-color') === hashString('dialed-color'), 'hashString deterministic');
assert(hashString('abc') !== hashString('abd'), 'hashString differentiates strings');

// ============================================================================
// 8. Wordle Share Card Formatting
// ============================================================================

const share = buildDailyShareText({
  date: '2026-10-19',
  scores: [920, 800, 600, 100, 950],
  average: 674,
  streak: 3,
});
assert(share.includes('色感記憶 每日 2026-10-19'), 'share header includes date');
assert(share.includes('🟩🟨🟧⬛🟩'), `share grid expected emojis, got: ${share}`);
assert(share.includes('連勝 3 天'), 'share includes streak count');
assert(share.includes('674 分'), 'share includes average score');
assert(share.includes('準確度 67%'), 'share includes accuracy percentage');

console.log('check-dialed-color: ok');

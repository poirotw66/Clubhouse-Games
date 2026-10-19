import { calculateScore, distanceComponents, scoreEmoji, scoreToAccuracy } from './score.mjs';
import { mixColors, complementaryOf, analogousOf, survivalParams, buildTargets, clampColor } from './colors.mjs';
import { dateKey, dailyBaseSeed, dailyTargets, computeStreak, previousDay } from './daily.mjs';
import { buildDailyShareText } from './share.mjs';
import { mulberry32, hashString } from './rng.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// —— Distance scoring ——
const same = { h: 120, s: 50, l: 50 };
assert(calculateScore(same, same) === 999, 'identical colors should score 999');

const oppositeHue = calculateScore({ h: 0, s: 50, l: 50 }, { h: 180, s: 50, l: 50 });
assert(oppositeHue === 0, `hue opposite (dh=1) should score 0, got ${oppositeHue}`);

const halfHue = calculateScore({ h: 0, s: 50, l: 50 }, { h: 90, s: 50, l: 50 });
assert(halfHue === 499, `90° hue delta should score 499, got ${halfHue}`);

const satOnly = calculateScore({ h: 40, s: 0, l: 50 }, { h: 40, s: 100, l: 50 });
assert(satOnly === 0, `full saturation delta should score 0, got ${satOnly}`);

const lightOnly = calculateScore({ h: 40, s: 50, l: 0 }, { h: 40, s: 50, l: 100 });
assert(lightOnly === 0, `full lightness delta should score 0, got ${lightOnly}`);

const nearMiss = calculateScore({ h: 10, s: 50, l: 50 }, { h: 20, s: 55, l: 52 });
assert(nearMiss > 900 && nearMiss < 999, `near miss should be high but not perfect, got ${nearMiss}`);

const wrapHue = calculateScore({ h: 10, s: 40, l: 40 }, { h: 350, s: 40, l: 40 });
const noWrap = calculateScore({ h: 10, s: 40, l: 40 }, { h: 30, s: 40, l: 40 });
assert(wrapHue === noWrap, 'hue wrap 10↔350 should match 10↔30 distance');

const comps = distanceComponents({ h: 0, s: 10, l: 20 }, { h: 90, s: 60, l: 70 });
assert(comps.hueDeg === 90, `hueDeg expected 90, got ${comps.hueDeg}`);
assert(comps.satPct === 50, `satPct expected 50, got ${comps.satPct}`);
assert(comps.lightPct === 50, `lightPct expected 50, got ${comps.lightPct}`);

assert(scoreEmoji(950) === '🟩', 'high score emoji');
assert(scoreEmoji(800) === '🟨', 'mid-high emoji');
assert(scoreEmoji(600) === '🟧', 'mid emoji');
assert(scoreEmoji(100) === '⬛', 'low emoji');
assert(scoreToAccuracy(999) === 100, 'perfect accuracy');
assert(scoreToAccuracy(0) === 0, 'zero accuracy');

// —— Harmony / mix ——
const ref = clampColor(40, 70, 50);
const comp = complementaryOf(ref);
assert(comp.h === 220, `complement of 40 should be 220, got ${comp.h}`);
assert(analogousOf(ref, 30).h === 70, 'analogous +30');
assert(analogousOf(ref, -30).h === 10, 'analogous -30');

const mixed = mixColors({ h: 0, s: 100, l: 50 }, { h: 120, s: 100, l: 50 });
assert(typeof mixed.h === 'number' && mixed.s >= 0, 'mixColors returns color');
// Red+green light mix tends toward yellow-ish
assert(mixed.h > 20 && mixed.h < 100, `red+green mix hue should be yellowish, got ${mixed.h}`);

// —— Survival difficulty rises ——
const s0 = survivalParams(0);
const s10 = survivalParams(10);
assert(s10.showMs < s0.showMs, 'survival showMs shortens');
assert(s10.pass > s0.pass, 'survival pass rises');
assert(s10.nearHueWindow < s0.nearHueWindow, 'survival hues tighten');

// —— Seeded daily determinism (Taipei date) ——
assert(dateKey(new Date('2026-10-18T16:00:00Z')) === '2026-10-19', 'UTC 16:00 → Taipei next day');
assert(dateKey(new Date('2026-10-18T15:59:00Z')) === '2026-10-18', 'UTC 15:59 → Taipei same day');

const key = '2026-10-19';
const seedA = dailyBaseSeed(key);
const seedB = dailyBaseSeed(key);
assert(seedA === seedB, 'daily seed stable');
assert(seedA !== dailyBaseSeed('2026-10-20'), 'different days differ');

const d1 = dailyTargets(key);
const d2 = dailyTargets(key);
assert(d1.targets.length === 5, 'daily has 5 colors');
assert(
  d1.targets.every((c, i) => c.h === d2.targets[i].h && c.s === d2.targets[i].s && c.l === d2.targets[i].l),
  'daily targets identical for same date',
);

const rand = mulberry32(hashString('test'));
const blitz = buildTargets('blitz', rand);
assert(blitz.targets.length >= 20, 'blitz pool size');

const mixPack = buildTargets('mix', mulberry32(42));
assert(mixPack.mixPairs?.length === 1, 'mix has pair');
assert(mixPack.targets.length === 1, 'mix has one target');

// —— Streak ——
assert(computeStreak([], '2026-10-19') === 0, 'empty streak');
assert(
  computeStreak(
    [
      { date: '2026-10-19', average: 700, scores: [700] },
      { date: '2026-10-18', average: 600, scores: [600] },
    ],
    '2026-10-19',
  ) === 2,
  'two-day streak',
);
assert(
  computeStreak([{ date: '2026-10-17', average: 700, scores: [700] }], '2026-10-19') === 0,
  'broken streak',
);
assert(previousDay('2026-10-01') === '2026-09-30', 'month boundary previousDay');

// —— Share text ——
const share = buildDailyShareText({
  date: '2026-10-19',
  scores: [920, 800, 600, 100, 950],
  average: 674,
  streak: 3,
});
assert(share.includes('色感記憶 每日 2026-10-19'), 'share header');
assert(share.includes('🟩🟨🟧⬛🟩'), `share grid, got ${share}`);
assert(share.includes('連勝 3 天'), 'share streak');

console.log('check-dialed-color: ok');

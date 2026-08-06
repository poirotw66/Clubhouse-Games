import { calculateScore } from './score.mjs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const same = { h: 120, s: 50, l: 50 };
assert(calculateScore(same, same) === 999, 'identical colors should score 999');

const oppositeHue = calculateScore({ h: 0, s: 50, l: 50 }, { h: 180, s: 50, l: 50 });
assert(oppositeHue === 0, `hue opposite (dh=1) should score 0, got ${oppositeHue}`);

const halfHue = calculateScore({ h: 0, s: 50, l: 50 }, { h: 90, s: 50, l: 50 });
// dh = 90/180 = 0.5 → distance 0.5 → floor(999 * 0.5) = 499
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

console.log('check-dialed-color: ok');

/**
 * Result title thresholds for Bloom Lion Dance.
 */
import assert from 'node:assert/strict';

const RANK_THRESHOLDS = {
  legend: 25,
  king: 40,
  awakened: 60,
};

function rankForFinishTime(seconds) {
  if (seconds < RANK_THRESHOLDS.legend) return 'legend';
  if (seconds < RANK_THRESHOLDS.king) return 'king';
  if (seconds < RANK_THRESHOLDS.awakened) return 'awakened';
  return 'cub';
}

assert.equal(rankForFinishTime(24.9), 'legend');
assert.equal(rankForFinishTime(25), 'king');
assert.equal(rankForFinishTime(39.9), 'king');
assert.equal(rankForFinishTime(40), 'awakened');
assert.equal(rankForFinishTime(59.9), 'awakened');
assert.equal(rankForFinishTime(60), 'cub');
assert.equal(rankForFinishTime(89), 'cub');

assert.ok(RANK_THRESHOLDS.legend < RANK_THRESHOLDS.king);
assert.ok(RANK_THRESHOLDS.king < RANK_THRESHOLDS.awakened);

const labels = {
  legend: '廟會傳奇',
  king: '獅王',
  awakened: '醒獅',
  cub: '小獅仔',
  retry: '再試一次',
};
for (const v of Object.values(labels)) {
  assert.ok(v.length >= 2, 'rank label present');
}

console.log('check-titles: ok');

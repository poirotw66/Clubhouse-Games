/**
 * Drum-beat timing invariants for 踩鼓點加速 (v3 — modest bonuses).
 */
import assert from 'node:assert/strict';

const DRUM_BPM = 108;
const PERFECT_WINDOW = 0.1;
const BEAT_BONUS_IMPULSE = 0.12;
const COMBO_SPEED_PER = 0.012;
const COMBO_SPEED_MAX = 0.08;
const COMBO_CAP = 8;

const period = 60 / DRUM_BPM;

function beatPhase(elapsed) {
  return ((elapsed % period) + period) % period;
}

function offsetFromBeat(elapsed) {
  const phase = beatPhase(elapsed);
  return phase > period / 2 ? phase - period : phase;
}

function isPerfectPlant(elapsed) {
  return Math.abs(offsetFromBeat(elapsed)) <= PERFECT_WINDOW;
}

function comboSpeedBonus(combo) {
  const n = Math.max(0, Math.min(COMBO_CAP, Math.floor(combo)));
  return Math.min(COMBO_SPEED_MAX, n * COMBO_SPEED_PER);
}

function onBeatRatio(perfects, plants) {
  if (plants <= 0) return 0;
  return Math.max(0, Math.min(1, perfects / plants));
}

assert.ok(period > 0.4 && period < 0.7, `period out of band: ${period}`);
assert.equal(PERFECT_WINDOW, 0.1);
assert.ok(isPerfectPlant(0));
assert.ok(isPerfectPlant(period));
assert.ok(isPerfectPlant(period * 3 + 0.05));
assert.ok(!isPerfectPlant(period * 3 + 0.2));
assert.ok(BEAT_BONUS_IMPULSE > 0 && BEAT_BONUS_IMPULSE <= 0.15, 'bonus must stay modest');
assert.equal(comboSpeedBonus(0), 0);
assert.ok(comboSpeedBonus(4) > comboSpeedBonus(2));
assert.equal(comboSpeedBonus(99), COMBO_SPEED_MAX);
assert.equal(onBeatRatio(0, 0), 0);
assert.equal(onBeatRatio(3, 4), 0.75);

assert.ok((PERFECT_WINDOW * 2) / period < 0.45, 'perfect window too wide vs tempo');

console.log(
  `check-beat: ok (BPM ${DRUM_BPM}, period ${period.toFixed(3)}s, window ±${PERFECT_WINDOW}s, bonus ${BEAT_BONUS_IMPULSE})`,
);

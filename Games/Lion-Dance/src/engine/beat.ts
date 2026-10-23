/**
 * Drum-beat timing helpers for 踩鼓點加速.
 * Pure functions — shared with check-beat.mjs twin values.
 */

import {
  BEAT_BONUS_IMPULSE,
  COMBO_CAP,
  COMBO_SPEED_MAX,
  COMBO_SPEED_PER,
  PERFECT_WINDOW,
  drumPeriod,
} from './constants';

export interface BeatState {
  /** Elapsed seconds since run start (same clock as sim). */
  elapsed: number;
  combo: number;
  perfects: number;
  plants: number;
  lastBeatIndex: number;
  pulse: number;
}

export function createBeatState(): BeatState {
  return {
    elapsed: 0,
    combo: 0,
    perfects: 0,
    plants: 0,
    lastBeatIndex: -1,
    pulse: 0,
  };
}

export function beatPhase(elapsed: number): number {
  const period = drumPeriod();
  return ((elapsed % period) + period) % period;
}

/** Signed offset from nearest beat in [-period/2, period/2]. */
export function offsetFromBeat(elapsed: number): number {
  const period = drumPeriod();
  const phase = beatPhase(elapsed);
  return phase > period / 2 ? phase - period : phase;
}

export function isPerfectPlant(elapsed: number): boolean {
  return Math.abs(offsetFromBeat(elapsed)) <= PERFECT_WINDOW;
}

export function comboSpeedBonus(combo: number): number {
  const n = Math.max(0, Math.min(COMBO_CAP, Math.floor(combo)));
  return Math.min(COMBO_SPEED_MAX, n * COMBO_SPEED_PER);
}

export function onBeatRatio(perfects: number, plants: number): number {
  if (plants <= 0) return 0;
  return Math.max(0, Math.min(1, perfects / plants));
}

export function registerPlant(beat: BeatState, elapsed: number): {
  perfect: boolean;
  combo: number;
  bonusImpulse: number;
} {
  beat.plants += 1;
  const perfect = isPerfectPlant(elapsed);
  if (perfect) {
    beat.perfects += 1;
    beat.combo = Math.min(COMBO_CAP, beat.combo + 1);
    return { perfect: true, combo: beat.combo, bonusImpulse: BEAT_BONUS_IMPULSE };
  }
  beat.combo = 0;
  return { perfect: false, combo: 0, bonusImpulse: 0 };
}

/** Advance metronome; returns true when a new beat fires. */
export function stepBeat(beat: BeatState, elapsed: number, dt: number): boolean {
  beat.elapsed = elapsed;
  beat.pulse = Math.max(0, beat.pulse - dt * 4.5);
  const period = drumPeriod();
  const idx = Math.floor(elapsed / period);
  if (idx !== beat.lastBeatIndex && elapsed >= 0) {
    beat.lastBeatIndex = idx;
    beat.pulse = 1;
    return true;
  }
  return false;
}

export function formatOnBeatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

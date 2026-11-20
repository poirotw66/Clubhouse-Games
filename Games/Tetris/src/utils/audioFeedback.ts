import { playTone } from '@clubhouse/shared/synthAudio';
import type { ScoreBreakdown } from './tetrisLogic';

/**
 * Pentatonic / diatonic musical scale frequencies in Hz:
 * C4, D4, E4, G4, A4, C5, D5, E5
 */
export const PENTATONIC_SCALE = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  392.00, // G4
  440.00, // A4
  523.25, // C5
  587.33, // D5
  659.25, // E5
] as const;

/**
 * Map combo (1–8) to pentatonic pitch frequency.
 * Combo <= 1 maps to C4 (index 0).
 * Combo 8+ clamps to E5 (index 7).
 */
export function getPentatonicPitch(combo: number): number {
  const count = Math.max(1, Math.floor(combo));
  const noteIndex = Math.min(PENTATONIC_SCALE.length - 1, count - 1);
  return PENTATONIC_SCALE[noteIndex];
}

/**
 * Determine if a line clearance qualifies as a 4-line Tetris or T-Spin
 * for triumphant fanfare and heavy ground-slam shake escalation.
 */
export function isFanfareClear(breakdown?: {
  label?: string;
  linesCleared?: number;
} | null): boolean {
  if (!breakdown) return false;
  if (breakdown.linesCleared === 4) return true;
  const label = breakdown.label ?? '';
  return label.includes('TETRIS') || label.includes('T-SPIN');
}

/**
 * Keyboard input recognizer for Sakurai gameplay-ux-009 Rapid Retry.
 * Detects Space, Enter, or KeyR (r / R).
 */
export function isRapidRetryKey(event: {
  key: string;
  code?: string;
}): boolean {
  const { key, code } = event;
  return (
    key === ' ' ||
    key === 'Enter' ||
    key === 'r' ||
    key === 'R' ||
    code === 'Space' ||
    code === 'Enter' ||
    code === 'KeyR'
  );
}

/**
 * Play pentatonic chime tone with warm melodic overtones.
 */
export function playPentatonicChime(frequency: number): void {
  playTone(frequency, 'sine', 0.2, 0, 0.09);
  playTone(frequency * 1.5, 'triangle', 0.16, 0.02, 0.06);
  playTone(frequency * 2, 'sine', 0.12, 0.04, 0.04);
}

/**
 * Play triumphant major triad chime fanfare:
 * C5 (523.25 Hz), E5 (659.25 Hz), G5 (783.99 Hz), C6 (1046.50 Hz).
 */
export function playMajorTriadFanfare(): void {
  playTone(523.25, 'triangle', 0.22, 0, 0.1);
  playTone(1046.5, 'sine', 0.22, 0, 0.05);

  playTone(659.25, 'triangle', 0.22, 0.07, 0.1);
  playTone(1318.5, 'sine', 0.22, 0.07, 0.05);

  playTone(783.99, 'triangle', 0.25, 0.14, 0.11);
  playTone(1567.98, 'sine', 0.25, 0.14, 0.05);

  playTone(1046.5, 'triangle', 0.45, 0.21, 0.12);
  playTone(2093.0, 'sine', 0.45, 0.21, 0.06);
}

/**
 * Sakurai coordinate-audio-visual-priority:
 * Replace flat playScore() with pentatonic pitch escalation or major triad fanfare.
 */
export function playClearFeedback(breakdown: ScoreBreakdown): void {
  if (isFanfareClear(breakdown)) {
    playMajorTriadFanfare();
    return;
  }
  const combo = breakdown.combo ?? breakdown.nextCombo ?? 1;
  const pitch = getPentatonicPitch(combo);
  playPentatonicChime(pitch);
}

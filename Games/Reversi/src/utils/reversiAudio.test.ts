import { describe, expect, it } from 'vitest';
import {
  playCascadeComboFanfare,
  playCascadeNote,
  playGoldenFortressChime,
  playTactileDrop,
} from './reversiAudio';

describe('reversiAudio synth', () => {
  it('executes audio synthesizer methods safely in test environments without throwing', () => {
    expect(() => playTactileDrop(false)).not.toThrow();
    expect(() => playTactileDrop(true)).not.toThrow();
    expect(() => playCascadeNote(0, 1)).not.toThrow();
    expect(() => playCascadeNote(5, 6)).not.toThrow();
    expect(() => playGoldenFortressChime()).not.toThrow();
    expect(() => playCascadeComboFanfare(5)).not.toThrow();
  });
});

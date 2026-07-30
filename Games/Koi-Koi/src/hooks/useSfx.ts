import {useCallback, useRef} from 'react';

type SfxKind = 'match' | 'yaku' | 'win' | 'draw';

const SFX_MUTED_KEY = 'koi-koi-sfx-muted';

function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  volume: number,
  type: OscillatorType = 'sine',
  delay = 0,
) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  osc.connect(gain);
  gain.connect(ctx.destination);
  const start = ctx.currentTime + delay;
  osc.start(start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
  osc.stop(start + duration);
}

export function useSfx() {
  const ctxRef = useRef<AudioContext | null>(null);
  const mutedRef = useRef(localStorage.getItem(SFX_MUTED_KEY) === 'true');

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new AudioContext();
    }
    return ctxRef.current;
  }, []);

  const play = useCallback((kind: SfxKind) => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }

    if (kind === 'match') {
      playTone(ctx, 520, 0.08, 0.12, 'triangle');
    } else if (kind === 'yaku') {
      playTone(ctx, 660, 0.1, 0.1, 'sine');
      playTone(ctx, 880, 0.12, 0.1, 'sine', 0.08);
    } else if (kind === 'win') {
      playTone(ctx, 523, 0.15, 0.12, 'sine');
      playTone(ctx, 659, 0.15, 0.12, 'sine', 0.12);
      playTone(ctx, 784, 0.25, 0.12, 'sine', 0.24);
    } else {
      playTone(ctx, 280, 0.2, 0.08, 'sine');
    }
  }, [getCtx]);

  return {play};
}

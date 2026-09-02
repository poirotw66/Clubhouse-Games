import React, { useEffect, useState } from 'react';
import { DICE_MULT } from '../game/engine';

const DIE_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

type DiceTone = 'bad' | 'normal' | 'good' | 'great';

/** The training result is already decided by the seed; this only colours the
 * face so a great roll reads as great at a glance. */
function diceTone(value: number): DiceTone {
  if (value <= 1) return 'bad';
  if (value <= 3) return 'normal';
  if (value <= 5) return 'good';
  return 'great';
}

const TONE_TEXT: Record<DiceTone, string> = {
  bad: 'text-rose-300',
  normal: 'text-slate-100',
  good: 'text-emerald-300',
  great: 'text-amber-300',
};

const TONE_GLOW: Record<DiceTone, string> = {
  bad: '0 0 18px rgba(248,113,113,0.55)',
  normal: '0 0 14px rgba(148,163,184,0.45)',
  good: '0 0 18px rgba(74,222,128,0.6)',
  great: '0 0 28px rgba(251,191,36,0.9)',
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function randomFace(): number {
  return 1 + Math.floor(Math.random() * 6);
}

const TUMBLE_TICKS = 9;
const TUMBLE_INTERVAL_MS = 75;

interface Props {
  /** The final, seed-derived face (1–6). */
  value: number;
  /** Changes every roll so the animation replays on each new training turn. */
  rollKey: string;
}

/**
 * A d6 that tumbles through a few random faces before landing on the real
 * result. The tumble is cosmetic only — it never feeds back into the
 * deterministic simulation, so the same seed and choices still rebuild the
 * same career.
 */
export function DiceRoll({ value, rollKey }: Props): React.ReactElement {
  // Seed the first paint from the reduced-motion preference so the die starts
  // mid-tumble (a random face) rather than briefly flashing the real result.
  const [reduce] = useState(prefersReducedMotion);
  const [face, setFace] = useState(() => (reduce ? value : randomFace()));
  const [rolling, setRolling] = useState(!reduce);

  useEffect(() => {
    if (reduce) {
      setFace(value);
      setRolling(false);
      return;
    }
    setRolling(true);
    setFace(randomFace());
    let ticks = 0;
    const timer = window.setInterval(() => {
      ticks += 1;
      if (ticks >= TUMBLE_TICKS) {
        window.clearInterval(timer);
        setFace(value);
        setRolling(false);
      } else {
        setFace(randomFace());
      }
    }, TUMBLE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [rollKey, value, reduce]);

  const tone = diceTone(value);
  const shownFace = rolling ? face : value;

  return (
    <div className="flex shrink-0 flex-col items-center gap-1" aria-label={`骰出 ${value} 點`}>
      <span
        key={`${rollKey}-${rolling ? 'roll' : 'land'}`}
        className={`text-5xl leading-none ${
          rolling ? 'bl-die-rolling text-slate-100' : `bl-die-land ${TONE_TEXT[tone]}`
        }`}
        style={rolling ? undefined : { textShadow: TONE_GLOW[tone] }}
      >
        {DIE_FACES[shownFace]}
      </span>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums transition-opacity duration-200 ${
          rolling ? 'opacity-0' : `opacity-100 ${TONE_TEXT[tone]}`
        }`}
      >
        成長 ×{DICE_MULT[value].toFixed(2)}
      </span>
    </div>
  );
}

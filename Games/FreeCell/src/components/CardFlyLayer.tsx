import React, { useEffect, useState } from 'react';
import type { Card } from '../types.ts';
import { PlayingCard } from './PlayingCard.tsx';

export type FlyCard = {
  id: string;
  card: Card;
  from: { x: number; y: number; w: number; h: number };
  to: { x: number; y: number; w: number; h: number };
  waveIndex?: number;
  waveTotal?: number;
};

type Props = {
  flights: FlyCard[];
  onFlightDone: (id: string) => void;
};

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Absolute-positioned card clones that tween from source to target rects.
 * Features staggered 3D wave cascade and dynamic spring damping for multi-card supermoves.
 */
export function CardFlyLayer({ flights, onFlightDone }: Props): React.ReactElement | null {
  const [phase, setPhase] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (flights.length === 0) return;
    const reduced = prefersReducedMotion();
    const timers: number[] = [];

    for (const flight of flights) {
      if (reduced) {
        onFlightDone(flight.id);
        continue;
      }

      const staggerDelay = (flight.waveIndex ?? 0) * 38;

      const triggerTimer = window.setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setPhase((prev) => ({ ...prev, [flight.id]: true }));
          });
        });
      }, staggerDelay);
      timers.push(triggerTimer);

      const doneTimer = window.setTimeout(() => {
        onFlightDone(flight.id);
      }, staggerDelay + 340);
      timers.push(doneTimer);
    }

    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [flights, onFlightDone]);

  if (flights.length === 0) return null;

  const reduced = prefersReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden>
      {flights.map((flight) => {
        const atTarget = Boolean(phase[flight.id]);
        const box = atTarget ? flight.to : flight.from;
        const total = flight.waveTotal ?? 1;
        const idx = flight.waveIndex ?? 0;
        const fanAngle = total > 1 ? (idx - (total - 1) / 2) * 5.5 : 0;
        const scale = atTarget ? 1 : 1.05;

        return (
          <div
            key={flight.id}
            className="absolute will-change-transform"
            style={{
              left: box.x,
              top: box.y,
              width: box.w,
              height: box.h,
              transform: reduced
                ? undefined
                : `perspective(750px) rotateZ(${atTarget ? 0 : fanAngle}deg) scale(${scale})`,
              transition: reduced
                ? undefined
                : 'left 320ms cubic-bezier(0.34, 1.25, 0.64, 1), top 320ms cubic-bezier(0.34, 1.25, 0.64, 1), transform 320ms cubic-bezier(0.34, 1.25, 0.64, 1)',
              zIndex: 70 + idx,
            }}
          >
            <PlayingCard card={flight.card} />
          </div>
        );
      })}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import type { CardType } from '../types';
import { Card } from './Card';

export type FlyCard = {
  id: string;
  card: CardType;
  from: { x: number; y: number; w: number; h: number };
  to: { x: number; y: number; w: number; h: number };
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
      // Double-rAF so the browser paints the start pose before transitioning.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setPhase((prev) => ({ ...prev, [flight.id]: true }));
        });
      });
      timers.push(
        window.setTimeout(() => onFlightDone(flight.id), 320),
      );
    }
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [flights, onFlightDone]);

  if (flights.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden>
      {flights.map((flight) => {
        const atTarget = phase[flight.id];
        const box = atTarget ? flight.to : flight.from;
        return (
          <div
            key={flight.id}
            className="absolute will-change-transform"
            style={{
              left: box.x,
              top: box.y,
              width: box.w,
              height: box.h,
              transition: prefersReducedMotion()
                ? undefined
                : 'left 280ms cubic-bezier(0.22, 1, 0.36, 1), top 280ms cubic-bezier(0.22, 1, 0.36, 1)',
              zIndex: 70,
            }}
          >
            <Card card={{ ...flight.card, faceUp: true }} />
          </div>
        );
      })}
    </div>
  );
}

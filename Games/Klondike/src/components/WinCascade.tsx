import React, { useEffect, useState } from 'react';
import type { CardType } from '../types';
import { Card } from './Card';
import { playScore } from '@clubhouse/shared/synthAudio';

type Props = {
  active: boolean;
  foundations: CardType[][];
};

type Particle = {
  id: string;
  card: CardType;
  x: number;
  delay: number;
  rot: number;
};

/**
 * Staggered fountain of foundation cards when the player wins.
 */
export function WinCascade({ active, foundations }: Props): React.ReactElement | null {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (!active) {
      setParticles([]);
      return;
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const next: Particle[] = [];
    let n = 0;
    for (let f = 0; f < foundations.length; f++) {
      const pile = foundations[f]!;
      for (let i = Math.max(0, pile.length - 5); i < pile.length; i++) {
        const card = pile[i]!;
        next.push({
          id: `${card.id}-${n}`,
          card,
          x: 18 + f * 20 + (n % 3) * 4,
          delay: n * 70,
          rot: -20 + ((n * 37) % 40),
        });
        n += 1;
        if (n % 4 === 0) {
          window.setTimeout(() => playScore(), n * 70);
        }
      }
    }
    setParticles(next);
  }, [active, foundations]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[65] overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <div
          key={p.id}
          className="klondike-cascade-card absolute"
          style={{
            left: `${p.x}%`,
            top: '-10%',
            animationDelay: `${p.delay}ms`,
            ['--cascade-rot' as string]: `${p.rot}deg`,
          }}
        >
          <Card card={{ ...p.card, faceUp: true }} />
        </div>
      ))}
    </div>
  );
}

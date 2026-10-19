import React, { useEffect, useState } from 'react';
import { playScore } from '@clubhouse/shared/synthAudio';
import type { Card, Suit } from '../types.ts';
import { PlayingCard } from './PlayingCard.tsx';
import { SUITS } from '../utils/deck.ts';

type Props = {
  active: boolean;
  foundations: Record<Suit, number>;
};

type Particle = {
  id: string;
  card: Card;
  x: number;
  delay: number;
  rot: number;
};

function foundationCards(foundations: Record<Suit, number>): Card[] {
  const cards: Card[] = [];
  for (const suit of SUITS) {
    const rank = foundations[suit];
    if (rank <= 0) continue;
    const color = suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black';
    // Spray the top few ranks from each foundation pile.
    for (let r = Math.max(1, rank - 4); r <= rank; r++) {
      cards.push({ id: `cascade-${suit}-${r}`, suit, rank: r, color });
    }
  }
  return cards;
}

/** Staggered fountain of foundation cards when the player wins. */
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

    const cards = foundationCards(foundations);
    const next: Particle[] = cards.map((card, n) => ({
      id: `${card.id}-${n}`,
      card,
      x: 12 + (n % 8) * 10 + (n % 3) * 2,
      delay: n * 55,
      rot: -22 + ((n * 37) % 44),
    }));
    setParticles(next);

    for (let n = 0; n < next.length; n++) {
      if (n % 4 === 0) {
        window.setTimeout(() => playScore(), n * 55);
      }
    }
  }, [active, foundations]);

  if (!active || particles.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-[65] overflow-hidden" aria-hidden>
      {particles.map((p) => (
        <div
          key={p.id}
          className="freecell-cascade-card absolute w-16 sm:w-20"
          style={{
            left: `${p.x}%`,
            top: '-10%',
            animationDelay: `${p.delay}ms`,
            ['--cascade-rot' as string]: `${p.rot}deg`,
          }}
        >
          <PlayingCard card={p.card} />
        </div>
      ))}
    </div>
  );
}

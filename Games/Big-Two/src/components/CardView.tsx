import React from 'react';
import { SUIT_SYMBOL, rankLabel } from '../game/cards';
import type { Card } from '../game/types';

interface Props {
  card: Card;
  size?: 'sm' | 'md';
  selected?: boolean;
  hinted?: boolean;
  onClick?: () => void;
}

const SIZES = {
  sm: 'w-9 h-13 text-xs rounded',
  md: 'w-11 h-16 text-base rounded-md sm:w-12 sm:h-18',
};

function suitIconUrl(card: Card): string {
  return `${import.meta.env.BASE_URL}suits/${card.suit}.jpg`;
}

function faceBackgroundFor(red: boolean): string {
  return red
    ? 'linear-gradient(rgba(255, 228, 230, 0.75), rgba(251, 191, 36, 0.05)), url(face-plate.jpg)'
    : 'linear-gradient(rgba(226, 232, 240, 0.75), rgba(148, 163, 184, 0.05)), url(face-plate.jpg)';
}

export function CardView({ card, size = 'md', selected, hinted, onClick }: Props): React.ReactElement {
  const red = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitIcon = suitIconUrl(card);
  const className = [
    'bt-card relative flex flex-col items-center justify-center font-bold select-none shrink-0 border',
    SIZES[size],
    'bg-cover bg-center',
    red ? 'text-rose-600' : 'text-slate-800',
    selected ? 'bt-card-selected border-amber-400 ring-2 ring-amber-400' : 'border-stone-400/60',
    hinted && !selected ? 'ring-2 ring-sky-400' : '',
    onClick ? 'cursor-pointer' : 'cursor-default',
  ]
    .filter(Boolean)
    .join(' ');

  const label = `${SUIT_SYMBOL[card.suit]}${rankLabel(card.rank)}`;
  const backgroundImage = faceBackgroundFor(red).replace(
    'url(face-plate.jpg)',
    `url(${import.meta.env.BASE_URL}face-plate.jpg)`,
  );

  const body = (
    <>
      <span className="leading-none">{rankLabel(card.rank)}</span>
      <img
        src={suitIcon}
        alt={SUIT_SYMBOL[card.suit]}
        className={`leading-none ${size === 'sm' ? 'w-3 h-3 mt-0.5' : 'w-4 h-4 mt-0.5'}`}
        aria-hidden="true"
      />
    </>
  );

  if (!onClick) {
    return (
      <div className={className} role="img" aria-label={label} style={{ backgroundImage }}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      style={{ backgroundImage }}
    >
      {body}
    </button>
  );
}

/** A face-down card, for the other seats. */
export function CardBack({ size = 'sm' }: { size?: 'sm' | 'md' }): React.ReactElement {
  return (
    <div
      className={`${SIZES[size]} bg-cover bg-center border border-indigo-600/70 flex items-center justify-center shrink-0`}
      style={{ backgroundImage: `url(${import.meta.env.BASE_URL}card-back.jpg)` }}
      aria-hidden="true"
    >
      <span className="sr-only">牌背</span>
    </div>
  );
}

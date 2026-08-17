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

export function CardView({ card, size = 'md', selected, hinted, onClick }: Props): React.ReactElement {
  const red = card.suit === 'hearts' || card.suit === 'diamonds';
  const className = [
    'bt-card relative flex flex-col items-center justify-center font-bold select-none shrink-0 border',
    SIZES[size],
    red ? 'bg-stone-50 text-rose-600' : 'bg-stone-50 text-slate-800',
    selected ? 'bt-card-selected border-amber-400 ring-2 ring-amber-400' : 'border-stone-400/60',
    hinted && !selected ? 'ring-2 ring-sky-400' : '',
    onClick ? 'cursor-pointer' : 'cursor-default',
  ]
    .filter(Boolean)
    .join(' ');

  const label = `${SUIT_SYMBOL[card.suit]}${rankLabel(card.rank)}`;

  const body = (
    <>
      <span className="leading-none">{rankLabel(card.rank)}</span>
      <span className="leading-none text-[0.8em]">{SUIT_SYMBOL[card.suit]}</span>
    </>
  );

  if (!onClick) {
    return (
      <div className={className} role="img" aria-label={label}>
        {body}
      </div>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick} aria-label={label} aria-pressed={selected}>
      {body}
    </button>
  );
}

/** A face-down card, for the other seats. */
export function CardBack({ size = 'sm' }: { size?: 'sm' | 'md' }): React.ReactElement {
  return (
    <div
      className={`${SIZES[size]} bg-indigo-900 border border-indigo-600/70 flex items-center justify-center shrink-0`}
      aria-hidden="true"
    >
      <span className="text-indigo-400 text-xs">✦</span>
    </div>
  );
}

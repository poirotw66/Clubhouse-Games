import React from 'react';
import { SUIT_SYMBOL, isRed, pointsOf, rankLabel } from '../game/cards';
import type { Card } from '../game/types';

interface Props {
  card: Card;
  size?: 'sm' | 'md';
  selected?: boolean;
  target?: boolean;
  landed?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  label?: string;
}

const SIZES = {
  sm: 'w-10 h-14 text-sm rounded-md',
  md: 'w-14 h-20 text-lg rounded-lg sm:w-16 sm:h-24 sm:text-xl',
};

/**
 * One playing card.
 *
 * The point value is printed on every red card. Nothing is gained by making the
 * player memorise that a red ace is 20 and a red king is 10 — the game is the
 * arithmetic of pairing to ten, not a recall test for the scoring table.
 */
export function CardView({
  card,
  size = 'md',
  selected,
  target,
  landed,
  dimmed,
  onClick,
  label,
}: Props): React.ReactElement {
  const red = isRed(card);
  const points = pointsOf(card);
  const interactive = Boolean(onClick);

  const className = [
    'pr-card relative flex flex-col items-center justify-center font-bold select-none',
    SIZES[size],
    red ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-800',
    selected ? 'pr-card-selected ring-4 ring-emerald-400' : '',
    target ? 'pr-card-target ring-4 ring-amber-300' : '',
    landed ? 'pr-land' : '',
    dimmed ? 'opacity-40' : '',
    interactive ? 'cursor-pointer' : 'cursor-default',
  ]
    .filter(Boolean)
    .join(' ');

  const name = `${red ? '紅' : '黑'}${SUIT_SYMBOL[card.suit]}${rankLabel(card.rank)}${
    points > 0 ? `，${points} 分` : ''
  }`;

  const content = (
    <>
      <span className="leading-none">{rankLabel(card.rank)}</span>
      <span className={`leading-none ${size === 'sm' ? 'text-xs' : 'text-base'}`}>
        {SUIT_SYMBOL[card.suit]}
      </span>
      {points > 0 && (
        <span className="absolute top-0.5 right-1 text-[10px] font-black text-rose-500/90">
          {points}
        </span>
      )}
    </>
  );

  if (!interactive) {
    return (
      <div className={className} role="img" aria-label={name}>
        {content}
      </div>
    );
  }

  return (
    <button type="button" className={className} onClick={onClick} aria-label={label ?? name}>
      {content}
    </button>
  );
}

/** A face-down card, for the pile. */
export function CardBack({ size = 'md' }: { size?: 'sm' | 'md' }): React.ReactElement {
  return (
    <div
      className={`${SIZES[size]} bg-emerald-900 border-2 border-emerald-700/70 flex items-center justify-center`}
      aria-hidden="true"
    >
      <span className="text-emerald-600 text-xl">✿</span>
    </div>
  );
}

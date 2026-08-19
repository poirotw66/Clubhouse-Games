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
  blackAces?: boolean;
  onClick?: () => void;
  label?: string;
}

const SIZES = {
  sm: 'w-10 h-14 text-sm rounded-md',
  md: 'w-14 h-20 text-lg rounded-lg sm:w-16 sm:h-24 sm:text-xl',
};

function suitIconUrl(card: Card): string {
  return `${import.meta.env.BASE_URL}suits/${card.suit}.jpg`;
}

function faceBackgroundFor(red: boolean): string {
  return red
    ? 'linear-gradient(rgba(255, 228, 230, 0.75), rgba(251, 191, 36, 0.05)), url(face-plate.jpg)'
    : 'linear-gradient(rgba(226, 232, 240, 0.75), rgba(148, 163, 184, 0.05)), url(face-plate.jpg)';
}

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
  blackAces = false,
  onClick,
  label,
}: Props): React.ReactElement {
  const red = isRed(card);
  const points = pointsOf(card, blackAces);
  const interactive = Boolean(onClick);
  const suitIcon = suitIconUrl(card);

  const className = [
    'pr-card relative flex flex-col items-center justify-center font-bold select-none',
    SIZES[size],
    'bg-cover bg-center',
    red ? 'text-rose-700' : 'text-slate-800',
    selected ? 'pr-card-selected ring-4 ring-emerald-400' : '',
    target ? 'pr-card-target ring-4 ring-amber-300' : '',
    landed ? 'pr-land' : '',
    dimmed ? 'opacity-40' : '',
    interactive ? 'cursor-pointer' : 'cursor-default',
  ]
    .filter(Boolean)
    .join(' ');

  const backgroundImage = faceBackgroundFor(red).replace(
    'url(face-plate.jpg)',
    `url(${import.meta.env.BASE_URL}face-plate.jpg)`,
  );

  const name = `${red ? '紅' : '黑'}${SUIT_SYMBOL[card.suit]}${rankLabel(card.rank)}${
    points > 0 ? `，${points} 分` : ''
  }`;

  const content = (
    <>
      <span className="leading-none">{rankLabel(card.rank)}</span>
      <img
        src={suitIcon}
        alt={SUIT_SYMBOL[card.suit]}
        className={`leading-none ${size === 'sm' ? 'w-3 h-3 mt-0.5' : 'w-4 h-4 mt-0.5'}`}
        aria-hidden="true"
      />
      {points > 0 && (
        <span className="absolute top-0.5 right-1 text-[10px] font-black text-rose-500/90">
          {points}
        </span>
      )}
    </>
  );

  if (!interactive) {
    return (
      <div className={className} role="img" aria-label={name} style={{ backgroundImage }}>
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className={className}
      onClick={onClick}
      aria-label={label ?? name}
      style={{ backgroundImage }}
    >
      {content}
    </button>
  );
}

/** A face-down card, for the pile. */
export function CardBack({ size = 'md' }: { size?: 'sm' | 'md' }): React.ReactElement {
  return (
    <div
      className={`${SIZES[size]} bg-cover bg-center border-2 border-emerald-700/70 flex items-center justify-center`}
      style={{ backgroundImage: `url(${import.meta.env.BASE_URL}card-back.jpg)` }}
      aria-hidden="true"
    >
      <span className="sr-only">牌背</span>
    </div>
  );
}

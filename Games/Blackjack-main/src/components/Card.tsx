import React from 'react';
import { Card as CardType } from '../types';

interface CardProps {
  card: CardType;
}

export const Card: React.FC<CardProps> = ({ card }) => {
  if (card.isHidden) {
    return (
      <div
        className="w-16 h-24 sm:w-[4.5rem] sm:h-28 md:w-20 md:h-32 rounded-lg border-2 border-white/25 shadow-xl overflow-hidden touch-manipulation bg-cover bg-center"
        style={{
          backgroundColor: '#1e3a8a',
          backgroundImage: `url(${import.meta.env.BASE_URL}card-back.jpg)`,
        }}
        aria-label="Hidden card"
      />
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const suitSymbol = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠',
  }[card.suit];

  return (
    <div className="w-16 h-24 sm:w-[4.5rem] sm:h-28 md:w-20 md:h-32 rounded-lg bg-white shadow-xl flex flex-col justify-between p-1.5 relative border border-gray-200 touch-manipulation">
      <div className={`text-sm md:text-base font-bold leading-tight ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {card.rank}
        <div className="text-base md:text-lg leading-none">{suitSymbol}</div>
      </div>
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl md:text-4xl opacity-10 ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {suitSymbol}
      </div>
      <div className={`text-sm md:text-base font-bold rotate-180 leading-tight ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {card.rank}
        <div className="text-base md:text-lg leading-none">{suitSymbol}</div>
      </div>
    </div>
  );
};

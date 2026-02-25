import React from 'react';
import { Card as CardType } from '../types';

interface CardProps {
  card: CardType;
}

export const Card: React.FC<CardProps> = ({ card }) => {
  if (card.isHidden) {
    return (
      <div className="w-14 h-20 sm:w-16 sm:h-24 md:w-[4.5rem] md:h-28 rounded-lg border-2 border-white/20 bg-blue-900 bg-[repeating-linear-gradient(45deg,transparent,transparent_8px,rgba(255,255,255,0.1)_8px,rgba(255,255,255,0.1)_16px)] shadow-xl flex items-center justify-center">
        <div className="w-8 h-12 sm:w-10 sm:h-14 border-2 border-white/20 rounded"></div>
      </div>
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
    <div className="w-14 h-20 sm:w-16 sm:h-24 md:w-[4.5rem] md:h-28 rounded-lg bg-white shadow-xl flex flex-col justify-between p-1.5 relative border border-gray-200">
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

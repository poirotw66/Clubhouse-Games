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
        aria-label="隱藏牌"
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

  const faceStyle = {
    backgroundColor: '#f8fafc',
    backgroundImage: [
      'linear-gradient(rgba(255,255,255,0.72), rgba(255,255,255,0.82))',
      `url(${import.meta.env.BASE_URL}face-plate.jpg)`,
    ].join(', '),
  };

  return (
    <div
      className="w-16 h-24 sm:w-[4.5rem] sm:h-28 md:w-20 md:h-32 rounded-lg shadow-xl flex flex-col justify-between p-1.5 relative border border-gray-200 touch-manipulation bg-cover bg-center overflow-hidden"
      style={faceStyle}
    >
      <div className={`text-sm md:text-base font-bold leading-tight relative z-10 ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {card.rank}
        <div className="text-base md:text-lg leading-none">{suitSymbol}</div>
      </div>
      <img
        src={`${import.meta.env.BASE_URL}suits/${card.suit}.jpg`}
        alt=""
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 md:w-10 md:h-10 object-contain opacity-55 pointer-events-none"
      />
      <div className={`text-sm md:text-base font-bold rotate-180 leading-tight relative z-10 ${isRed ? 'text-red-600' : 'text-slate-900'}`}>
        {card.rank}
        <div className="text-base md:text-lg leading-none">{suitSymbol}</div>
      </div>
    </div>
  );
};

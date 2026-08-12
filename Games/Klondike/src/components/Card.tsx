import React from 'react';
import { CardType } from '../types';

interface CardProps {
  card?: CardType;
  isDraggable?: boolean;
  isDragging?: boolean;
  isSelected?: boolean;
  isHinted?: boolean;
  isPlayableToFoundation?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDoubleClick?: () => void;
  onClick?: () => void;
  className?: string;
  faceDown?: boolean;
}

export const Card: React.FC<CardProps> = ({ card, isDraggable, isDragging, isSelected, isHinted, isPlayableToFoundation, onDragStart, onDragEnd, onDoubleClick, onClick, className = '', faceDown }) => {
  // Face-down / stock back
  if (!card || faceDown || !card.faceUp) {
    return (
      <div
        className={`w-16 h-24 sm:w-24 sm:h-36 rounded-xl border-2 border-white/15 shadow-md touch-manipulation bg-cover bg-center ${isHinted ? 'ring-4 ring-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.7)]' : ''} ${className}`}
        style={{
          backgroundColor: '#1e3a8a',
          backgroundImage: `url(${import.meta.env.BASE_URL}card-back.jpg)`,
        }}
        aria-label="Face-down card"
      />
    );
  }

  const isRed = card.color === 'red';
  const suitSymbol = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
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
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDoubleClick={onDoubleClick}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      role={onClick ? 'button' : undefined}
      className={`w-16 h-24 sm:w-24 sm:h-36 rounded-xl border border-gray-300 flex flex-col justify-between p-1.5 sm:p-2 shadow-md touch-manipulation relative overflow-hidden bg-cover bg-center ${isDraggable ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-blue-400' : ''} ${isRed ? 'text-red-600' : 'text-gray-900'} ${isPlayableToFoundation && !isDragging && !isSelected && !isHinted ? 'ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.6)]' : ''} ${isHinted && !isSelected ? 'ring-4 ring-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.7)] z-40' : ''} ${isSelected ? 'ring-4 ring-yellow-400 scale-105 shadow-2xl z-50' : ''} ${isDragging ? 'opacity-50' : ''} ${className}`}
      style={faceStyle}
    >
      {/* 左上角 */}
      <div className="flex flex-col items-center w-6 relative z-10">
        <span className="text-xl font-bold leading-none">{card.rank}</span>
        <span className="text-xl leading-none">{suitSymbol}</span>
      </div>
      
      <img
        src={`${import.meta.env.BASE_URL}suits/${card.suit}.jpg`}
        alt=""
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 sm:w-14 sm:h-14 object-contain opacity-50 pointer-events-none"
      />
      
      {/* 右下角（倒轉） */}
      <div className="flex flex-col items-center w-6 self-end rotate-180 relative z-10">
        <span className="text-xl font-bold leading-none">{card.rank}</span>
        <span className="text-xl leading-none">{suitSymbol}</span>
      </div>
    </div>
  );
};

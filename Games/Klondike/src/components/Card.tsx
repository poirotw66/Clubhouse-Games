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
  onDoubleClick?: (el: HTMLElement) => void;
  onClick?: (el: HTMLElement) => void;
  className?: string;
  faceDown?: boolean;
}

export const Card: React.FC<CardProps> = ({ card, isDraggable, isDragging, isSelected, isHinted, isPlayableToFoundation, onDragStart, onDragEnd, onDoubleClick, onClick, className = '', faceDown }) => {
  // Face-down / stock back
  if (!card || faceDown || !card.faceUp) {
    return (
      <div
        className={`kl-card-face w-16 h-24 sm:w-24 sm:h-36 rounded-xl border-2 border-white/15 shadow-md touch-manipulation bg-cover bg-center ${isHinted ? 'ring-4 ring-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.7)]' : ''} ${className}`}
        style={{
          backgroundColor: '#1e3a8a',
          backgroundImage: `url(${import.meta.env.BASE_URL}card-back.jpg)`,
        }}
        aria-label="背面牌"
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
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick?.(e.currentTarget);
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e.currentTarget);
      }}
      role={onClick ? 'button' : undefined}
      className={`kl-card-face w-16 h-24 sm:w-24 sm:h-36 rounded-xl border border-gray-300 flex flex-col justify-between p-[0.35em] shadow-md touch-manipulation relative overflow-hidden bg-cover bg-center ${isDraggable ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-blue-400' : ''} ${isRed ? 'text-red-600' : 'text-gray-900'} ${isPlayableToFoundation && !isDragging && !isSelected && !isHinted ? 'ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.6)]' : ''} ${isHinted && !isSelected ? 'ring-4 ring-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.7)] z-40' : ''} ${isSelected ? 'ring-4 ring-yellow-400 scale-105 shadow-2xl z-50' : ''} ${isDragging ? 'opacity-50' : ''} ${className}`}
      style={faceStyle}
    >
      {/* 左上角 */}
      <div
        data-card-corner="top"
        className="kl-card-corner flex flex-col items-center min-w-[1.2em] relative z-10"
      >
        <span className="font-bold leading-none">{card.rank}</span>
        <span className="leading-none">{suitSymbol}</span>
      </div>
      
      <img
        src={`${import.meta.env.BASE_URL}suits/${card.suit}.jpg`}
        alt=""
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[45%] max-w-14 aspect-square object-contain opacity-50 pointer-events-none"
      />
      
      {/* 右下角（倒轉） */}
      <div
        data-card-corner="bottom"
        className="kl-card-corner flex flex-col items-center min-w-[1.2em] self-end rotate-180 relative z-10"
      >
        <span className="font-bold leading-none">{card.rank}</span>
        <span className="leading-none">{suitSymbol}</span>
      </div>
    </div>
  );
};

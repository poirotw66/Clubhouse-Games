import React from 'react';
import { CardType } from '../types';

interface CardProps {
  card?: CardType;
  isDraggable?: boolean;
  isDragging?: boolean;
  isPlayableToFoundation?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDoubleClick?: () => void;
  className?: string;
  faceDown?: boolean;
}

export const Card: React.FC<CardProps> = ({ card, isDraggable, isDragging, isPlayableToFoundation, onDragStart, onDragEnd, onDoubleClick, className = '', faceDown }) => {
  // 蓋牌狀態
  if (!card || faceDown || !card.faceUp) {
    return (
      <div 
        className={`w-24 h-36 rounded-xl border-2 border-white/10 bg-blue-900 shadow-md flex items-center justify-center ${className}`}
      >
        {/* 簡單的卡背圖案 */}
        <div className="w-20 h-32 rounded-lg border border-white/20 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.1)_10px,rgba(255,255,255,0.1)_20px)]"></div>
      </div>
    );
  }

  const isRed = card.color === 'red';
  const suitSymbol = {
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
    spades: '♠'
  }[card.suit];

  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDoubleClick={onDoubleClick}
      className={`w-24 h-36 rounded-xl border border-gray-300 bg-white flex flex-col justify-between p-2 shadow-md ${isDraggable ? 'cursor-grab active:cursor-grabbing hover:ring-2 hover:ring-blue-400' : ''} ${isRed ? 'text-red-600' : 'text-gray-900'} ${isPlayableToFoundation && !isDragging ? 'ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.6)]' : ''} ${isDragging ? 'opacity-50 ring-4 ring-yellow-400 scale-105 shadow-2xl z-50' : ''} ${className}`}
    >
      {/* 左上角 */}
      <div className="flex flex-col items-center w-6">
        <span className="text-xl font-bold leading-none">{card.rank}</span>
        <span className="text-xl leading-none">{suitSymbol}</span>
      </div>
      
      {/* 中間大圖示 */}
      <div className="text-5xl text-center self-center absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
        {suitSymbol}
      </div>
      
      {/* 右下角（倒轉） */}
      <div className="flex flex-col items-center w-6 self-end rotate-180">
        <span className="text-xl font-bold leading-none">{card.rank}</span>
        <span className="text-xl leading-none">{suitSymbol}</span>
      </div>
    </div>
  );
};

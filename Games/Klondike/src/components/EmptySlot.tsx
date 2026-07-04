import React from 'react';

interface EmptySlotProps {
  className?: string;
  onClick?: () => void;
}

export const EmptySlot: React.FC<EmptySlotProps> = ({ className = '', onClick }) => (
  <div
    role={onClick ? 'button' : undefined}
    onClick={onClick}
    className={`w-16 h-24 sm:w-24 sm:h-36 rounded-xl border-2 border-black/20 bg-black/10 touch-manipulation ${onClick ? 'cursor-pointer hover:bg-black/20' : ''} ${className}`}
  />
);

import React from 'react';

interface EmptySlotProps {
  className?: string;
}

export const EmptySlot: React.FC<EmptySlotProps> = ({ className = '' }) => (
  <div className={`w-24 h-36 rounded-xl border-2 border-black/20 bg-black/10 ${className}`} />
);

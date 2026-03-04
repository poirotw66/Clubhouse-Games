import React from 'react';
import { RotateCcw, Shuffle, Plus, Eye } from 'lucide-react';
import { COST_ADD_BOTTLE, COST_REVEAL, COST_SHUFFLE, COST_UNDO } from '../constants';

interface BottomControlsProps {
  onShuffle: () => void;
  onUndo: () => void;
  onAddBottle: () => void;
  onReveal: () => void;
}

const ControlButton: React.FC<{ 
  onClick: () => void; 
  icon: React.ReactNode; 
  colorClass: string;
  cost: number;
  label: string;
}> = ({ onClick, icon, colorClass, cost, label }) => (
  <div className="flex flex-col items-center gap-1.5 group">
    <button
      onClick={onClick}
      className={`
        relative touch-target w-12 h-12 md:w-14 md:h-14 rounded-xl flex items-center justify-center text-white
        shadow-lg border border-white/20
        transition-all duration-150 ease-in-out touch-active
        active:scale-95 active:shadow-md
        hover:brightness-110
        ${colorClass}
      `}
      aria-label={label}
    >
      <div className="drop-shadow-md">{icon}</div>
      
      {/* Glossy top highlight */}
      <div className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent rounded-t-xl pointer-events-none"></div>
    </button>
    
    {/* Price Tag - Unified Style */}
    <div className="bg-white/10 backdrop-blur-sm px-2 py-0.5 rounded-lg flex items-center gap-1 border border-white/20 group-active:scale-95 transition-transform">
      <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
      <span className="text-[10px] font-bold text-white tabular-nums">{cost}</span>
    </div>
  </div>
);

export const BottomControls: React.FC<BottomControlsProps> = ({ onShuffle, onUndo, onAddBottle, onReveal }) => {
  return (
    <div className="w-full px-3 md:px-4 pb-4 md:pb-6 pt-3 flex justify-between items-center max-w-lg mx-auto safe-bottom safe-left safe-right">
      {/* Unified Container Card */}
      <div className="w-full bg-white/10 backdrop-blur-xl rounded-2xl px-4 py-3 border border-white/20 shadow-lg flex justify-between items-center">
        <ControlButton 
          onClick={onShuffle} 
          icon={<Shuffle size={24} strokeWidth={2.5} />} 
          colorClass="bg-blue-500" 
          cost={COST_SHUFFLE} 
          label="Shuffle"
        />
        <ControlButton 
          onClick={onUndo} 
          icon={<RotateCcw size={24} strokeWidth={2.5} />} 
          colorClass="bg-orange-500" 
          cost={COST_UNDO} 
          label="Undo"
        />
        <ControlButton 
          onClick={onAddBottle} 
          icon={<Plus size={28} strokeWidth={3} />} 
          colorClass="bg-green-500" 
          cost={COST_ADD_BOTTLE} 
          label="Add"
        />
        <ControlButton 
          onClick={onReveal} 
          icon={<Eye size={24} strokeWidth={2.5} />} 
          colorClass="bg-purple-500" 
          cost={COST_REVEAL} 
          label="Reveal"
        />
      </div>
    </div>
  );
};
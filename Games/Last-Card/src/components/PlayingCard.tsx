import { motion } from 'motion/react';
import { CardType } from '../types';
import { Heart, Spade, Diamond, Club } from 'lucide-react';

const suitIcons = {
  hearts: <Heart className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 fill-current" />,
  diamonds: <Diamond className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 fill-current" />,
  spades: <Spade className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900 fill-current" />,
  clubs: <Club className="w-5 h-5 sm:w-6 sm:h-6 text-slate-900 fill-current" />,
};

const suitColors = {
  hearts: 'text-red-500',
  diamonds: 'text-red-500',
  spades: 'text-slate-900',
  clubs: 'text-slate-900',
};

export function PlayingCard({ card, onClick, disabled, faceDown, className = '' }: { card?: CardType, onClick?: () => void, disabled?: boolean, faceDown?: boolean, className?: string }) {
  if (faceDown || !card) {
    return (
      <motion.div
        whileHover={!disabled && onClick ? { y: -10 } : {}}
        onClick={!disabled ? onClick : undefined}
        className={`w-[4.5rem] h-[6.75rem] sm:w-24 sm:h-36 rounded-xl bg-indigo-700 border-2 border-white/20 shadow-lg flex items-center justify-center touch-manipulation ${onClick && !disabled ? 'cursor-pointer active:scale-95' : ''} ${className}`}
      >
        <div className="w-12 h-20 sm:w-20 sm:h-32 rounded-lg border border-indigo-400/30 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,rgba(255,255,255,0.1)_10px,rgba(255,255,255,0.1)_20px)]"></div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={!disabled && onClick ? { y: -10 } : {}}
      onClick={!disabled ? onClick : undefined}
      className={`w-[4.5rem] h-[6.75rem] sm:w-24 sm:h-36 rounded-xl bg-white border border-slate-200 shadow-lg flex flex-col justify-between p-1.5 sm:p-2 select-none touch-manipulation ${onClick && !disabled ? 'cursor-pointer hover:shadow-xl active:scale-95' : ''} ${disabled ? 'opacity-60 grayscale-[0.3]' : ''} ${className}`}
    >
      <div className={`text-base sm:text-xl font-bold leading-none ${suitColors[card.suit]}`}>
        {card.rank}
      </div>
      <div className="flex items-center justify-center flex-1">
        {suitIcons[card.suit]}
      </div>
      <div className={`text-base sm:text-xl font-bold leading-none rotate-180 ${suitColors[card.suit]}`}>
        {card.rank}
      </div>
    </motion.div>
  );
}

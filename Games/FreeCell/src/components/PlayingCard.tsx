import React from "react";
import { Card as CardType } from "../types";
import { cn } from "../utils/cn";
import { motion } from "motion/react";

export interface PlayingCardProps {
  card?: CardType | null;
  isSelected?: boolean;
  isSelectable?: boolean;
  onClick?: () => void;
  onDoubleClick?: () => void;
  className?: string;
  placeholder?: string;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

const SUIT_SYMBOLS = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const RANK_STRINGS: Record<number, string> = {
  1: "A", 2: "2", 3: "3", 4: "4", 5: "5", 6: "6", 7: "7",
  8: "8", 9: "9", 10: "10", 11: "J", 12: "Q", 13: "K",
};

export const PlayingCard: React.FC<PlayingCardProps> = ({
  card,
  isSelected,
  isSelectable,
  onClick,
  onDoubleClick,
  className,
  placeholder,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
}) => {
  if (!card) {
    return (
      <div
        className={cn(
          "w-full aspect-[2/3] rounded-xl border-2 border-dashed border-stone-300 bg-stone-100/50 flex items-center justify-center",
          className,
        )}
        onClick={onClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {placeholder && (
          <span className="text-2xl sm:text-4xl opacity-20 font-serif text-stone-800">{placeholder}</span>
        )}
      </div>
    );
  }

  const isRed = card.color === "red";
  const symbol = SUIT_SYMBOLS[card.suit];
  const rankStr = RANK_STRINGS[card.rank];

  return (
    <motion.div
      layout
      layoutId={card.id}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "relative w-full aspect-[2/3] rounded-xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-stone-200 flex flex-col select-none cursor-pointer overflow-hidden",
        isRed ? "text-rose-600" : "text-stone-800",
        isSelectable && "hover:-translate-y-2 hover:shadow-[0_8px_16px_rgba(0,0,0,0.12)] transition-all duration-200",
        isSelected && "ring-2 ring-stone-800 -translate-y-3 shadow-[0_12px_24px_rgba(0,0,0,0.15)] z-50",
        className,
      )}
    >
      <div className="absolute top-1.5 left-1.5 sm:top-2 sm:left-2 flex flex-col items-center leading-none">
        <span className="text-[11px] sm:text-sm md:text-base font-bold tracking-tighter">{rankStr}</span>
        <span className="text-[11px] sm:text-sm md:text-base">{symbol}</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <span className="text-3xl sm:text-5xl md:text-6xl opacity-10">{symbol}</span>
      </div>
      <div className="absolute bottom-1.5 right-1.5 sm:bottom-2 sm:right-2 flex flex-col items-center leading-none rotate-180">
        <span className="text-[11px] sm:text-sm md:text-base font-bold tracking-tighter">{rankStr}</span>
        <span className="text-[11px] sm:text-sm md:text-base">{symbol}</span>
      </div>
    </motion.div>
  );
};

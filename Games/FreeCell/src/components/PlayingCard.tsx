import React from "react";
import { Card as CardType } from "../types";
import { cn } from "../utils/cn";
import { motion } from "motion/react";

export interface PlayingCardProps {
  card?: CardType | null;
  isSelected?: boolean;
  isSelectable?: boolean;
  isHinted?: boolean;
  onClick?: (e: React.MouseEvent<HTMLElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLElement>) => void;
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
  isHinted,
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
          "fc-card-face w-full aspect-[2/3] rounded-xl border-2 border-dashed border-stone-300 bg-stone-100/50 flex items-center justify-center overflow-hidden bg-cover bg-center",
          isHinted && "ring-4 ring-sky-400 bg-sky-50/80",
          className,
        )}
        style={
          placeholder
            ? undefined
            : {
                backgroundImage: `linear-gradient(rgba(253,252,248,0.55), rgba(253,252,248,0.7)), url(${import.meta.env.BASE_URL}card-back.jpg)`,
              }
        }
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

  const faceStyle = {
    backgroundColor: "#f8fafc",
    backgroundImage: [
      "linear-gradient(rgba(255,255,255,0.72), rgba(255,255,255,0.82))",
      `url(${import.meta.env.BASE_URL}face-plate.jpg)`,
    ].join(", "),
  };

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
      // The card uses native HTML5 drag-and-drop, but motion.div declares its
      // own onDragStart for gesture dragging. Without a `drag` prop set, motion
      // forwards this straight to the DOM, so the runtime behaviour is the
      // native one — only the two type signatures collide.
      onDragStart={onDragStart as unknown as React.ComponentProps<typeof motion.div>['onDragStart']}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "fc-card-face relative w-full aspect-[2/3] rounded-xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] border border-stone-200 flex flex-col select-none cursor-pointer overflow-hidden bg-cover bg-center touch-manipulation",
        isRed ? "text-rose-600" : "text-stone-800",
        isSelectable && "hover:-translate-y-2 hover:shadow-[0_8px_16px_rgba(0,0,0,0.12)] transition-all duration-200",
        isSelected && "ring-2 ring-stone-800 -translate-y-3 shadow-[0_12px_24px_rgba(0,0,0,0.15)] z-50",
        isHinted && !isSelected && "ring-4 ring-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.55)] z-40",
        className,
      )}
      style={faceStyle}
    >
      <div
        data-card-corner="top"
        className="fc-card-corner absolute top-[0.28em] left-[0.28em] flex flex-col items-center leading-none z-10"
      >
        <span className="font-bold tracking-tighter">{rankStr}</span>
        <span>{symbol}</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <img
          src={`${import.meta.env.BASE_URL}suits/${card.suit}.jpg`}
          alt=""
          aria-hidden
          className="w-[45%] max-w-16 aspect-square object-contain opacity-50 pointer-events-none"
        />
      </div>
      <div
        data-card-corner="bottom"
        className="fc-card-corner absolute bottom-[0.28em] right-[0.28em] flex flex-col items-center leading-none rotate-180 z-10"
      >
        <span className="font-bold tracking-tighter">{rankStr}</span>
        <span>{symbol}</span>
      </div>
    </motion.div>
  );
};

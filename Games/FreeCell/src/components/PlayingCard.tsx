import React from "react";
import { Card as CardType } from "../types";
import { cn } from "../utils/cn";
import { motion } from "motion/react";
import type { WorkshopTheme } from "../utils/theme";

export interface PlayingCardProps {
  card?: CardType | null;
  isSelected?: boolean;
  isSelectable?: boolean;
  isHinted?: boolean;
  theme?: WorkshopTheme;
  waveIndex?: number;
  waveTotal?: number;
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
  theme = 'royal-velvet',
  waveIndex,
  waveTotal,
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
    const slotStyles = {
      'royal-velvet': 'border-emerald-600/40 bg-emerald-950/40 text-emerald-300 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)]',
      'obsidian-gold': 'border-amber-500/35 bg-neutral-900/60 text-amber-400 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)]',
      'cyber-neon': 'border-cyan-500/40 bg-slate-950/60 text-cyan-300 shadow-[inset_0_0_12px_rgba(6,182,212,0.2)]',
    }[theme];

    return (
      <div
        className={cn(
          "fc-card-face w-full aspect-[2/3] rounded-xl border-2 border-dashed flex items-center justify-center overflow-hidden bg-cover bg-center transition-colors duration-200",
          slotStyles,
          isHinted && "ring-4 ring-sky-400 bg-sky-900/40",
          className,
        )}
        style={
          placeholder
            ? undefined
            : {
                backgroundImage: `linear-gradient(rgba(10,30,20,0.65), rgba(10,30,20,0.8)), url(${import.meta.env.BASE_URL}card-back.jpg)`,
              }
        }
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={placeholder ? `空牌位 ${placeholder}` : '空牌位'}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            e.stopPropagation();
            if (!e.repeat) e.currentTarget.click();
          }
        }}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {placeholder && (
          <span className="text-2xl sm:text-4xl opacity-30 font-serif">{placeholder}</span>
        )}
      </div>
    );
  }

  const isRed = card.color === "red";
  const symbol = SUIT_SYMBOLS[card.suit];
  const rankStr = RANK_STRINGS[card.rank];

  const faceStyle = {
    backgroundColor: theme === 'obsidian-gold' ? "#fcfbf7" : "#f8fafc",
    backgroundImage: [
      theme === 'royal-velvet'
        ? "linear-gradient(rgba(255,255,255,0.78), rgba(255,253,245,0.86))"
        : theme === 'obsidian-gold'
          ? "linear-gradient(rgba(255,255,255,0.82), rgba(254,249,235,0.88))"
          : "linear-gradient(rgba(255,255,255,0.85), rgba(240,249,255,0.88))",
      `url(${import.meta.env.BASE_URL}face-plate.jpg)`,
    ].join(", "),
  };

  const themeRing = {
    'royal-velvet': 'ring-2 ring-amber-400 shadow-[0_12px_28px_rgba(212,175,55,0.35)]',
    'obsidian-gold': 'ring-2 ring-amber-400 shadow-[0_12px_32px_rgba(245,158,11,0.45)]',
    'cyber-neon': 'ring-2 ring-cyan-400 shadow-[0_0_24px_rgba(6,182,212,0.55)]',
  }[theme];

  // Supermove wave tilt calculation for selected sequences
  const isWave = isSelected && waveTotal != null && waveTotal > 1 && waveIndex != null;
  const waveTilt = isWave ? (waveIndex - (waveTotal - 1) / 2) * 3 : 0;
  const waveY = isWave ? -12 - waveIndex * 2 : isSelected ? -12 : 0;

  return (
    <motion.div
      layout
      layoutId={card.id}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{
        opacity: 1,
        scale: isSelected ? 1.02 : 1,
        y: waveY,
        rotateZ: waveTilt,
      }}
      transition={{ type: "spring", stiffness: 340, damping: 26 }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={`${{ spades: '黑桃', hearts: '紅心', diamonds: '方塊', clubs: '梅花' }[card.suit]} ${rankStr}`}
      aria-pressed={onClick ? Boolean(isSelected) : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          e.stopPropagation();
          if (!e.repeat) e.currentTarget.click();
        }
      }}
      onDoubleClick={onDoubleClick}
      draggable={draggable}
      onDragStart={onDragStart as unknown as React.ComponentProps<typeof motion.div>['onDragStart']}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "focus-visible:outline focus-visible:outline-4 focus-visible:outline-sky-300 fc-card-face relative w-full aspect-[2/3] rounded-xl shadow-[0_3px_10px_rgba(0,0,0,0.18)] border border-stone-200/90 flex flex-col select-none cursor-pointer overflow-hidden bg-cover bg-center touch-manipulation transition-[box-shadow,border-color] duration-200",
        isRed ? "text-rose-600" : "text-stone-900",
        isSelectable && "hover:-translate-y-2 hover:shadow-[0_8px_20px_rgba(0,0,0,0.22)]",
        isSelected && cn("z-50", themeRing),
        isHinted && !isSelected && "ring-4 ring-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.65)] z-40",
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
          className="w-[45%] max-w-16 aspect-square object-contain opacity-60 pointer-events-none"
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

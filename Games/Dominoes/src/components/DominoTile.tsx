import React from 'react';
import type { PlacedTile, Tile } from '../utils/dominoesLogic';

export type TileCraftTheme = 'ivory' | 'obsidian' | 'walnut';
export type PipDisplayMode = 'pips' | 'numerals' | 'both';

export interface DominoTileProps {
  tile: Tile;
  displayLeft?: number;
  displayRight?: number;
  /** Vertical orientation: true = 1:2 (tall); false = 2:1 (wide). */
  vertical?: boolean;
  highlight?: boolean;
  playable?: boolean;
  hint?: boolean;
  onClick?: () => void;
  size?: 'normal' | 'small' | 'mini';
  /** Freshly placed — triggers a drop-in animation. */
  justPlaced?: boolean;
  /** Mark the All Fives spinner hub. */
  spinner?: boolean;
  /** Craft material theme */
  craft?: TileCraftTheme;
  /** Pip display mode */
  pipMode?: PipDisplayMode;
  className?: string;
}

/**
 * Classical domino 3x3 grid coordinates for pips 0 through 6.
 * Coordinates are [row, col] where 0 is top/left, 1 is center, 2 is bottom/right.
 */
function getPipCoordinates(pip: number, isVerticalHalf: boolean): Array<[number, number]> {
  switch (pip) {
    case 1:
      return [[1, 1]];
    case 2:
      return [[0, 0], [2, 2]];
    case 3:
      return [[0, 0], [1, 1], [2, 2]];
    case 4:
      return [
        [0, 0], [0, 2],
        [2, 0], [2, 2],
      ];
    case 5:
      return [
        [0, 0], [0, 2],
        [1, 1],
        [2, 0], [2, 2],
      ];
    case 6:
      return isVerticalHalf
        ? [
            [0, 0], [1, 0], [2, 0],
            [0, 2], [1, 2], [2, 2],
          ]
        : [
            [0, 0], [0, 1], [0, 2],
            [2, 0], [2, 1], [2, 2],
          ];
    default:
      return [];
  }
}

/** Half square component rendering either engraved pips, numerals, or both. */
function DominoHalf({
  value,
  craft,
  pipMode,
  size,
  isVerticalHalf,
}: {
  value: number;
  craft: TileCraftTheme;
  pipMode: PipDisplayMode;
  size: 'normal' | 'small' | 'mini';
  isVerticalHalf: boolean;
}) {
  const pips = getPipCoordinates(value, isVerticalHalf);

  // Pip dot sizing
  const pipDotClass =
    size === 'normal'
      ? 'w-2 h-2 sm:w-2.5 sm:h-2.5'
      : size === 'small'
        ? 'w-1.5 h-1.5 sm:w-2 sm:h-2'
        : 'w-1 h-1';

  // Dot styling per luxury craft
  const dotStyle: React.CSSProperties =
    craft === 'obsidian'
      ? {
          background: 'radial-gradient(circle at 35% 35%, #fef08a 0%, #eab308 60%, #854d0e 100%)',
          boxShadow: 'inset 0.5px 1px 1px rgba(0,0,0,0.8), 0 0 2px rgba(250, 204, 21, 0.5)',
        }
      : craft === 'walnut'
        ? {
            background: 'radial-gradient(circle at 40% 40%, #fef9c3 0%, #d4c5b0 60%, #8c7b69 100%)',
            boxShadow: 'inset 0.6px 1px 1px rgba(0,0,0,0.8), 0 0.5px 0.5px rgba(255, 255, 255, 0.25)',
          }
        : {
            // ivory
            background: '#18181b',
            boxShadow: 'inset 1px 1.5px 2px rgba(0,0,0,0.85), 0 0.5px 0.5px rgba(255,255,255,0.7)',
          };

  const numeralColor =
    craft === 'obsidian'
      ? 'text-amber-300 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]'
      : craft === 'walnut'
        ? 'text-amber-100 drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]'
        : 'text-stone-900';

  const showPips = pipMode === 'pips' || pipMode === 'both';
  const showNumeralsOnly = pipMode === 'numerals';
  const showNumeralBadge = pipMode === 'both';

  const rowPercent = (r: number) => (r === 0 ? '22%' : r === 1 ? '50%' : '78%');
  const colPercent = (c: number) => (c === 0 ? '22%' : c === 1 ? '50%' : '78%');

  return (
    <div className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden select-none">
      {/* Classical Engraved Pips */}
      {showPips &&
        pips.map(([r, c], idx) => (
          <span
            key={idx}
            className={`absolute rounded-full -translate-x-1/2 -translate-y-1/2 transition-all ${pipDotClass}`}
            style={{
              top: rowPercent(r),
              left: colPercent(c),
              ...dotStyle,
            }}
            aria-hidden="true"
          />
        ))}

      {/* Numerals Only Mode */}
      {showNumeralsOnly && (
        <span
          className={`font-black ${
            size === 'normal' ? 'text-lg sm:text-xl' : size === 'small' ? 'text-xs sm:text-sm' : 'text-[10px]'
          } ${numeralColor}`}
        >
          {value}
        </span>
      )}

      {/* Hybrid Badge: Pips + Small Corner Numeral */}
      {showNumeralBadge && (
        <span
          className={`absolute top-0.5 left-1 font-bold text-[9px] opacity-75 pointer-events-none ${numeralColor}`}
        >
          {value}
        </span>
      )}
    </div>
  );
}

/** Brass Spinner Rivet placed in the center dividing trench. */
function SpinnerRivet({
  craft,
  size,
  isSpinnerHub,
}: {
  craft: TileCraftTheme;
  size: 'normal' | 'small' | 'mini';
  isSpinnerHub?: boolean;
}) {
  const rivetSize =
    size === 'normal' ? 'w-2 h-2 sm:w-2.5 sm:h-2.5' : size === 'small' ? 'w-1.5 h-1.5' : 'w-1 h-1';

  const rivetStyle: React.CSSProperties =
    craft === 'obsidian'
      ? {
          background: 'radial-gradient(circle at 35% 35%, #fffbeb 0%, #facc15 50%, #a16207 90%, #451a03 100%)',
          boxShadow: isSpinnerHub
            ? '0 0 6px rgba(250, 204, 21, 0.8), inset 0 1px 1px rgba(255,255,255,0.7)'
            : '0 1px 2px rgba(0,0,0,0.7), inset 0 1px 1px rgba(255,255,255,0.5)',
        }
      : craft === 'walnut'
        ? {
            background: 'radial-gradient(circle at 35% 35%, #fed7aa 0%, #ca8a04 50%, #713f12 90%, #291204 100%)',
            boxShadow: isSpinnerHub
              ? '0 0 6px rgba(245, 158, 11, 0.8), inset 0 1px 1px rgba(255,255,255,0.6)'
              : '0 1px 2px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.4)',
          }
        : {
            // ivory
            background: 'radial-gradient(circle at 35% 35%, #fef08a 0%, #eab308 50%, #854d0e 85%, #3f2203 100%)',
            boxShadow: isSpinnerHub
              ? '0 0 6px rgba(234, 179, 8, 0.9), inset 0 1px 1px rgba(255,255,255,0.8)'
              : '0 1px 2px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.6)',
          };

  return (
    <div
      className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-amber-600/40 z-10 transition-transform ${rivetSize} ${
        isSpinnerHub ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900 animate-pulse scale-110' : ''
      }`}
      style={rivetStyle}
      aria-hidden="true"
    />
  );
}

export function DominoTile({
  tile,
  displayLeft,
  displayRight,
  vertical = false,
  highlight = false,
  playable = false,
  hint = false,
  onClick,
  size = 'normal',
  justPlaced = false,
  spinner = false,
  craft = 'ivory',
  pipMode = 'pips',
  className = '',
}: DominoTileProps) {
  const left = displayLeft ?? tile.left;
  const right = displayRight ?? tile.right;

  // Authentic 1:2 and 2:1 dimensions
  let dimClass = '';
  if (size === 'normal') {
    dimClass = vertical ? 'w-12 sm:w-14 h-24 sm:h-28' : 'w-24 sm:w-28 h-12 sm:h-14';
  } else if (size === 'small') {
    dimClass = vertical ? 'w-7 sm:w-8 h-14 sm:h-16' : 'w-14 sm:w-16 h-7 sm:h-8';
  } else {
    // mini
    dimClass = vertical ? 'w-5 h-10' : 'w-10 h-5';
  }

  // Border & Ring highlights
  const ringStyle = highlight
    ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-900 scale-105 z-20 shadow-xl shadow-amber-500/30'
    : hint
      ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-slate-900 shadow-md shadow-sky-400/30 animate-pulse'
      : playable
        ? 'border-amber-400/80 hover:border-amber-300 hover:ring-2 hover:ring-amber-400/50 hover:ring-offset-1 hover:ring-offset-slate-900 cursor-pointer hover:scale-[1.03]'
        : spinner
          ? 'border-amber-400 ring-2 ring-amber-400/60 ring-offset-1 ring-offset-slate-900'
          : '';

  // Surface Craft Styling
  const surfaceStyle: React.CSSProperties =
    craft === 'obsidian'
      ? {
          background: 'linear-gradient(150deg, #272a33 0%, #17181f 55%, #0d0e12 100%)',
          border: highlight ? '1px solid #f59e0b' : '1px solid #3c4250',
          boxShadow: '0 4px 8px -1px rgba(0,0,0,0.65), inset 0 1px 1px rgba(255,255,255,0.22), inset 0 -1.5px 2px rgba(0,0,0,0.6)',
        }
      : craft === 'walnut'
        ? {
            background: 'linear-gradient(150deg, #442718 0%, #301a10 50%, #20110a 100%)',
            border: highlight ? '1px solid #f59e0b' : '1px solid #583522',
            boxShadow: '0 4px 8px -1px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.18), inset 0 -1.5px 2px rgba(0,0,0,0.5)',
          }
        : {
            // imperial ivory
            background: 'linear-gradient(150deg, #fffdfa 0%, #f6efe4 50%, #ece1ce 100%)',
            border: highlight ? '1px solid #f59e0b' : '1px solid #d4c7b2',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.95), inset 0 -1.5px 2px rgba(110,95,75,0.2)',
          };

  const dividerStyle: React.CSSProperties =
    craft === 'obsidian'
      ? {
          background: '#343a46',
          boxShadow: 'inset 0 0.5px 1px rgba(0,0,0,0.7), 0 0.5px 0.5px rgba(255,255,255,0.15)',
        }
      : craft === 'walnut'
        ? {
            background: '#3f2113',
            boxShadow: 'inset 0 0.5px 1px rgba(0,0,0,0.6), 0 0.5px 0.5px rgba(255,255,255,0.12)',
          }
        : {
            // ivory
            background: '#c4b59f',
            boxShadow: 'inset 0 0.5px 1px rgba(0,0,0,0.4), 0 0.5px 0.5px rgba(255,255,255,0.6)',
          };

  const liftStyle = highlight
    ? '-translate-y-3'
    : hint
      ? '-translate-y-2'
      : playable
        ? '-translate-y-1'
        : '';

  const rootClass = `relative rounded-md flex touch-manipulation transition-all duration-150 ${dimClass} ${ringStyle} ${liftStyle} ${
    onClick ? 'cursor-pointer active:scale-95' : ''
  } ${justPlaced ? 'domino-place-in' : ''} ${className}`;

  return (
    <div
      role={onClick ? 'button' : undefined}
      className={`${rootClass} ${vertical ? 'flex-col' : 'flex-row'}`}
      style={surfaceStyle}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={spinner ? `轉軸 ${left}-${right}` : `${left}-${right}`}
    >
      {/* First Half */}
      <DominoHalf
        value={left}
        craft={craft}
        pipMode={pipMode}
        size={size}
        isVerticalHalf={vertical}
      />

      {/* Sunken Divider Trench */}
      <div
        className={`${vertical ? 'w-full h-[1.5px]' : 'h-full w-[1.5px]'} shrink-0`}
        style={dividerStyle}
        aria-hidden="true"
      />

      {/* Brass Spinner Rivet */}
      <SpinnerRivet craft={craft} size={size} isSpinnerHub={spinner} />

      {/* Second Half */}
      <DominoHalf
        value={right}
        craft={craft}
        pipMode={pipMode}
        size={size}
        isVerticalHalf={vertical}
      />
    </div>
  );
}

/** Board chain tile: transverse double orientation + directional arm alignment. */
export function PlacedDominoTile({
  placed,
  size = 'small',
  justPlaced = false,
  spinner = false,
  vertical,
  armAxis = 'horizontal',
  craft = 'ivory',
  pipMode = 'pips',
}: {
  placed: PlacedTile | { tile: Tile; displayLeft: number; displayRight: number };
  size?: 'normal' | 'small' | 'mini';
  justPlaced?: boolean;
  spinner?: boolean;
  /** Explicit orientation override */
  vertical?: boolean;
  /** Arm axis orientation ('horizontal' for left/right, 'vertical' for up/down) */
  armAxis?: 'horizontal' | 'vertical';
  craft?: TileCraftTheme;
  pipMode?: PipDisplayMode;
}) {
  const displayLeft =
    'displayLeft' in placed ? placed.displayLeft : placed.inward;
  const displayRight =
    'displayRight' in placed ? placed.displayRight : placed.outward;

  const isDoubleTile = placed.tile.left === placed.tile.right;

  // In authentic domino play:
  // Along a horizontal chain, doubles stand vertically (crosswise).
  // Along a vertical arm, doubles lie horizontally (crosswise).
  // Spinner hub stands vertically.
  let isVertical: boolean;
  if (vertical !== undefined) {
    isVertical = vertical;
  } else if (spinner) {
    isVertical = true;
  } else if (armAxis === 'horizontal') {
    isVertical = isDoubleTile;
  } else {
    // vertical arm
    isVertical = !isDoubleTile;
  }

  return (
    <DominoTile
      tile={placed.tile}
      displayLeft={displayLeft}
      displayRight={displayRight}
      vertical={isVertical}
      size={size}
      justPlaced={justPlaced}
      spinner={spinner}
      craft={craft}
      pipMode={pipMode}
    />
  );
}

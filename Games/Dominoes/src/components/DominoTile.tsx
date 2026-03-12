import type { PlacedTile, Tile } from '../utils/dominoesLogic';

interface DominoTileProps {
  tile: Tile;
  /** If set, show these pips (left-to-right along chain) instead of tile.left/right. */
  displayLeft?: number;
  displayRight?: number;
  /** If true, show vertical (narrow) for board; false = horizontal for hand. */
  vertical?: boolean;
  /** Highlight as playable or selected. */
  highlight?: boolean;
  onClick?: () => void;
  /** Smaller for board chain. */
  size?: 'normal' | 'small';
}

export function DominoTile({
  tile,
  displayLeft,
  displayRight,
  vertical = false,
  highlight = false,
  onClick,
  size = 'normal',
}: DominoTileProps) {
  const left = displayLeft ?? tile.left;
  const right = displayRight ?? tile.right;
  const w = size === 'small' ? 'w-8' : 'w-12';
  const h = size === 'small' ? 'h-16' : 'h-24';
  const pipSize = size === 'small' ? 'text-xs' : 'text-lg';
  const root = `rounded border-2 bg-white text-slate-800 flex items-center justify-center gap-0.5 ${w} ${h} ${
    highlight ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-slate-800' : 'border-slate-400'
  } ${onClick ? 'cursor-pointer hover:border-amber-500' : ''}`;
  const half = `flex flex-col items-center justify-center flex-1 min-w-0 ${pipSize} font-bold`;
  if (vertical) {
    return (
      <div
        role={onClick ? 'button' : undefined}
        className={`${root} flex-col`}
        onClick={onClick}
        onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
        tabIndex={onClick ? 0 : undefined}
      >
        <div className={half}>{left}</div>
        <div className="w-full border-t border-slate-300" />
        <div className={half}>{right}</div>
      </div>
    );
  }
  return (
    <div
      role={onClick ? 'button' : undefined}
      className={`${root} flex-row`}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={`${half} border-r border-slate-300`}>{left}</div>
      <div className={half}>{right}</div>
    </div>
  );
}

/** Board chain tile: horizontal, small, with display orientation. */
export function PlacedDominoTile({
  placed,
  size = 'small',
}: {
  placed: PlacedTile;
  size?: 'normal' | 'small';
}) {
  return (
    <DominoTile
      tile={placed.tile}
      displayLeft={placed.displayLeft}
      displayRight={placed.displayRight}
      vertical={false}
      size={size}
    />
  );
}

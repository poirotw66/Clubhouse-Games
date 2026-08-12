import type { PlacedTile, Tile } from '../utils/dominoesLogic';

interface DominoTileProps {
  tile: Tile;
  /** If set, show these pips (left-to-right along chain) instead of tile.left/right. */
  displayLeft?: number;
  displayRight?: number;
  /** If true, show vertical (narrow) for board; false = horizontal for hand. */
  vertical?: boolean;
  /** Tile is currently selected. */
  highlight?: boolean;
  /** Tile can be played but is not yet selected. */
  playable?: boolean;
  /** Hint recommendation highlight (sky), distinct from selection. */
  hint?: boolean;
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
  playable = false,
  hint = false,
  onClick,
  size = 'normal',
}: DominoTileProps) {
  const left = displayLeft ?? tile.left;
  const right = displayRight ?? tile.right;
  const w = size === 'small' ? 'w-8' : 'w-14 sm:w-12';
  const h = size === 'small' ? 'h-16' : 'h-28 sm:h-24';
  const pipSize = size === 'small' ? 'text-xs' : 'text-lg';

  const ringStyle = highlight
    ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-800 border-amber-400'
    : hint
      ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-800 border-sky-400'
      : playable
        ? 'border-amber-500/60 hover:border-amber-400 hover:ring-2 hover:ring-amber-400/40 hover:ring-offset-1 hover:ring-offset-slate-800'
        : 'border-slate-400';

  const root = `rounded border-2 text-slate-900 flex items-center justify-center gap-0.5 touch-manipulation transition-all duration-150 bg-cover bg-center ${w} ${h} ${ringStyle} ${
    onClick ? 'cursor-pointer active:scale-95' : ''
  }`;
  const faceStyle = {
    backgroundColor: '#f8fafc',
    backgroundImage: [
      'linear-gradient(rgba(248,250,252,0.55), rgba(248,250,252,0.7))',
      `url(${import.meta.env.BASE_URL}tile-face.jpg)`,
    ].join(', '),
  };

  // Lift selected tile upward via wrapper translate
  const liftStyle = highlight
    ? '-translate-y-3 drop-shadow-lg'
    : hint
      ? '-translate-y-2'
      : playable
        ? '-translate-y-1'
        : '';

  const half = `flex flex-col items-center justify-center flex-1 min-w-0 ${pipSize} font-bold`;

  const inner = vertical ? (
    <div
      role={onClick ? 'button' : undefined}
      className={`${root} flex-col ${liftStyle}`}
      style={faceStyle}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={half}>{left}</div>
      <div className="w-full border-t border-slate-400/60" />
      <div className={half}>{right}</div>
    </div>
  ) : (
    <div
      role={onClick ? 'button' : undefined}
      className={`${root} flex-row ${liftStyle}`}
      style={faceStyle}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className={`${half} border-r border-slate-400/60`}>{left}</div>
      <div className={half}>{right}</div>
    </div>
  );

  return inner;
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

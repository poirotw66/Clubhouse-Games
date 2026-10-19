import type { PlacedTile, Tile } from '../utils/dominoesLogic';

interface DominoTileProps {
  tile: Tile;
  displayLeft?: number;
  displayRight?: number;
  /** Vertical orientation (spinner hub or up/down arms). */
  vertical?: boolean;
  highlight?: boolean;
  playable?: boolean;
  hint?: boolean;
  onClick?: () => void;
  size?: 'normal' | 'small';
  /** Freshly placed — triggers a short drop-in animation. */
  justPlaced?: boolean;
  /** Mark the All Fives spinner hub. */
  spinner?: boolean;
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
}: DominoTileProps) {
  const left = displayLeft ?? tile.left;
  const right = displayRight ?? tile.right;
  const w = size === 'small' ? (vertical ? 'w-8' : 'w-8') : 'w-14 sm:w-12';
  const h = size === 'small' ? (vertical ? 'h-16' : 'h-16') : 'h-28 sm:h-24';
  const pipSize = size === 'small' ? 'text-xs' : 'text-lg';

  const ringStyle = highlight
    ? 'ring-4 ring-amber-400 ring-offset-2 ring-offset-slate-800 border-amber-400'
    : hint
      ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-slate-800 border-sky-400'
      : playable
        ? 'border-amber-500/60 hover:border-amber-400 hover:ring-2 hover:ring-amber-400/40 hover:ring-offset-1 hover:ring-offset-slate-800'
        : spinner
          ? 'border-emerald-400 ring-2 ring-emerald-400/50'
          : 'border-slate-400';

  const root = `rounded border-2 text-slate-900 flex items-center justify-center gap-0.5 touch-manipulation transition-all duration-150 bg-cover bg-center ${w} ${h} ${ringStyle} ${
    onClick ? 'cursor-pointer active:scale-95' : ''
  } ${justPlaced ? 'domino-place-in' : ''}`;
  const faceStyle = {
    backgroundColor: '#f8fafc',
    backgroundImage: [
      'linear-gradient(rgba(248,250,252,0.55), rgba(248,250,252,0.7))',
      `url(${import.meta.env.BASE_URL}tile-face.jpg)`,
    ].join(', '),
  };

  const liftStyle = highlight
    ? '-translate-y-3 drop-shadow-lg'
    : hint
      ? '-translate-y-2'
      : playable
        ? '-translate-y-1'
        : '';

  const half = `flex flex-col items-center justify-center flex-1 min-w-0 ${pipSize} font-bold`;

  return (
    <div
      role={onClick ? 'button' : undefined}
      className={`${root} ${vertical ? 'flex-col' : 'flex-row'} ${liftStyle}`}
      style={faceStyle}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={spinner ? `轉軸 ${left}-${right}` : `${left}-${right}`}
    >
      <div className={`${half} ${vertical ? '' : 'border-r border-slate-400/60'} ${vertical ? 'border-b border-slate-400/60' : ''}`}>
        {left}
      </div>
      <div className={half}>{right}</div>
    </div>
  );
}

/** Board chain tile: horizontal, small, with display orientation. */
export function PlacedDominoTile({
  placed,
  size = 'small',
  justPlaced = false,
  spinner = false,
  vertical = false,
}: {
  placed: PlacedTile | { tile: Tile; displayLeft: number; displayRight: number };
  size?: 'normal' | 'small';
  justPlaced?: boolean;
  spinner?: boolean;
  vertical?: boolean;
}) {
  const displayLeft =
    'displayLeft' in placed ? placed.displayLeft : placed.inward;
  const displayRight =
    'displayRight' in placed ? placed.displayRight : placed.outward;
  return (
    <DominoTile
      tile={placed.tile}
      displayLeft={displayLeft}
      displayRight={displayRight}
      vertical={vertical || spinner}
      size={size}
      justPlaced={justPlaced}
      spinner={spinner}
    />
  );
}

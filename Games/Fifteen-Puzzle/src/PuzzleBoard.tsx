import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from 'react';
import {
  emptyIndex,
  neighborsOfEmpty,
  slide,
  slideByDirection,
  type Board,
  type BoardSize,
  type SlideDir,
  type VisualStyle,
} from './fifteenLogic.ts';

const SLIDE_MS = 160;
const SWIPE_PX = 28;

type Props = {
  board: Board;
  size: BoardSize;
  style: VisualStyle;
  hintIndex: number | null;
  disabled: boolean;
  onSlide: (next: Board, tileIndex: number) => void;
  pictureUrl: string;
};

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function PuzzleBoard({
  board,
  size,
  style,
  hintIndex,
  disabled,
  onSlide,
  pictureUrl,
}: Props): ReactElement {
  const boardRef = useRef<HTMLDivElement>(null);
  const [animating, setAnimating] = useState(false);
  const pointerStart = useRef<{ x: number; y: number; index: number | null } | null>(null);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = prefersReducedMotion();
  }, []);

  const trySlideTile = useCallback(
    (tileIndex: number) => {
      if (disabled || animating) return;
      const next = slide(board, tileIndex, size);
      if (!next) return;
      if (reduced.current) {
        onSlide(next, tileIndex);
        return;
      }
      setAnimating(true);
      onSlide(next, tileIndex);
      window.setTimeout(() => setAnimating(false), SLIDE_MS);
    },
    [animating, board, disabled, onSlide, size],
  );

  const trySlideDir = useCallback(
    (dir: SlideDir) => {
      if (disabled || animating) return;
      const next = slideByDirection(board, size, dir);
      if (!next) return;
      const e = emptyIndex(board);
      // Tile that moved into empty is the former empty neighbor opposite to dir.
      let tileIndex = -1;
      if (dir === 'up') tileIndex = e + size;
      else if (dir === 'down') tileIndex = e - size;
      else if (dir === 'left') tileIndex = e + 1;
      else tileIndex = e - 1;
      if (reduced.current) {
        onSlide(next, tileIndex);
        return;
      }
      setAnimating(true);
      onSlide(next, tileIndex);
      window.setTimeout(() => setAnimating(false), SLIDE_MS);
    },
    [animating, board, disabled, onSlide, size],
  );

  const onPointerDown = (index: number, e: ReactPointerEvent) => {
    if (disabled) return;
    pointerStart.current = { x: e.clientX, y: e.clientY, index };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onPointerUp = (e: ReactPointerEvent) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || disabled) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX < SWIPE_PX && absY < SWIPE_PX) {
      if (start.index != null) trySlideTile(start.index);
      return;
    }

    // Board-level swipe: move empty opposite to finger (tile slides with finger).
    if (absX > absY) trySlideDir(dx > 0 ? 'right' : 'left');
    else trySlideDir(dy > 0 ? 'down' : 'up');
  };

  const movable = new Set(neighborsOfEmpty(board, size));
  const gap = size >= 5 ? 3 : 6;
  const duration = reduced.current ? '0ms' : `${SLIDE_MS}ms`;

  return (
    <div
      ref={boardRef}
      className="relative w-[min(92vw,380px)] aspect-square rounded-xl p-2 touch-none select-none"
      style={{ background: 'rgba(15,23,42,0.55)' }}
      onPointerDown={(ev) => {
        if (disabled) return;
        // Swipe may start on the empty cell / padding, not only on a tile.
        if (pointerStart.current == null) {
          pointerStart.current = { x: ev.clientX, y: ev.clientY, index: null };
        }
      }}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        pointerStart.current = null;
      }}
      role="grid"
      aria-label={`${size} 乘 ${size} 推盤`}
    >
      {board.map((tile, i) => {
        if (tile === null) return null;
        const row = Math.floor(i / size);
        const col = i % size;
        const goal = tile - 1;
        const gRow = Math.floor(goal / size);
        const gCol = goal % size;
        const cell = `calc((100% - ${(size - 1) * gap}px) / ${size})`;
        const left = `calc(${col} * (${cell} + ${gap}px))`;
        const top = `calc(${row} * (${cell} + ${gap}px))`;
        const isHint = hintIndex === i;
        const canMove = movable.has(i);

        const pictureStyle: CSSProperties =
          style === 'picture'
            ? {
                backgroundImage: `url(${pictureUrl})`,
                backgroundSize: `${size * 100}% ${size * 100}%`,
                backgroundPosition: `${(gCol / (size - 1)) * 100}% ${(gRow / (size - 1)) * 100}%`,
              }
            : {
                backgroundColor: '#cbd5e1',
                backgroundImage: [
                  'linear-gradient(rgba(248,250,252,0.55), rgba(248,250,252,0.7))',
                  `url(${pictureUrl})`,
                ].join(', '),
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              };

        return (
          <button
            key={tile}
            type="button"
            role="gridcell"
            disabled={!canMove || disabled || animating}
            onPointerDown={(ev) => onPointerDown(i, ev)}
            className={`absolute rounded-lg font-bold touch-manipulation border shadow overflow-hidden ${
              size <= 3 ? 'text-2xl sm:text-3xl' : size === 4 ? 'text-xl sm:text-2xl' : 'text-sm sm:text-base'
            } ${isHint ? 'border-amber-300 ring-2 ring-amber-400/80 z-10' : 'border-white/20'} ${
              canMove ? 'hover:brightness-110' : 'opacity-95'
            }`}
            style={{
              width: cell,
              height: cell,
              left,
              top,
              color: style === 'picture' ? '#f8fafc' : '#0f172a',
              transitionProperty: 'left, top',
              transitionDuration: duration,
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              textShadow: style === 'picture' ? '0 1px 2px rgba(0,0,0,0.85)' : undefined,
              ...pictureStyle,
            }}
            aria-label={`第 ${tile} 格${isHint ? '（建議）' : ''}`}
          >
            {style === 'number' ? (
              tile
            ) : (
              <span className="absolute bottom-0.5 right-1 text-[10px] sm:text-xs font-semibold opacity-90">
                {tile}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

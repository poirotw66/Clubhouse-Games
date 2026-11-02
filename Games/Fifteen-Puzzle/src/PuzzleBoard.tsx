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
  canMultiSlide,
  emptyIndex,
  multiSlide,
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
  onSlide: (next: Board, tileIndex: number, movedCount?: number) => void;
  pictureUrl: string;
  showGhost?: boolean;
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
  showGhost = false,
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
      const res = multiSlide(board, tileIndex, size);
      if (!res) return;
      if (reduced.current) {
        onSlide(res.nextBoard, tileIndex, res.movedCount);
        return;
      }
      setAnimating(true);
      onSlide(res.nextBoard, tileIndex, res.movedCount);
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
        onSlide(next, tileIndex, 1);
        return;
      }
      setAnimating(true);
      onSlide(next, tileIndex, 1);
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

  const gap = size >= 5 ? 3 : 6;
  const duration = reduced.current ? '0ms' : `${SLIDE_MS}ms`;
  const cell = `calc((100% - ${(size - 1) * gap}px) / ${size})`;
  const eIdx = emptyIndex(board);
  const eRow = Math.floor(eIdx / size);
  const eCol = eIdx % size;

  return (
    <div
      ref={boardRef}
      className="relative w-[min(92vw,440px)] aspect-square rounded-2xl p-2.5 touch-none select-none shadow-2xl border border-slate-700/60 transition-all"
      style={{
        background: 'linear-gradient(145deg, rgba(15,23,42,0.85), rgba(30,41,59,0.95))',
        boxShadow: '0 20px 40px -15px rgba(0,0,0,0.7), inset 0 1px 1px rgba(255,255,255,0.1)',
      }}
      onPointerDown={(ev) => {
        if (disabled) return;
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
      {/* Background Recessed Slots & Blueprint Overlay */}
      {Array.from({ length: size * size }).map((_, slotIdx) => {
        const sRow = Math.floor(slotIdx / size);
        const sCol = slotIdx % size;
        const sLeft = `calc(${sCol} * (${cell} + ${gap}px))`;
        const sTop = `calc(${sRow} * (${cell} + ${gap}px))`;
        const targetNum = slotIdx + 1;
        const isGoalLast = slotIdx === size * size - 1;

        return (
          <div
            key={`slot-${slotIdx}`}
            className="absolute rounded-xl border border-slate-800/80 bg-slate-950/40 flex items-center justify-center pointer-events-none select-none transition-all"
            style={{
              width: cell,
              height: cell,
              left: sLeft,
              top: sTop,
              boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)',
            }}
          >
            {showGhost && !isGoalLast && (
              <span className="text-emerald-400/25 font-bold font-mono text-xs sm:text-sm tracking-wider">
                #{targetNum}
              </span>
            )}
            {showGhost && isGoalLast && (
              <span className="text-amber-400/30 font-semibold font-mono text-[10px] tracking-widest">
                TARGET
              </span>
            )}
          </div>
        );
      })}

      {/* Tiles */}
      {board.map((tile, i) => {
        if (tile === null) return null;
        const row = Math.floor(i / size);
        const col = i % size;
        const goal = tile - 1;
        const gRow = Math.floor(goal / size);
        const gCol = goal % size;
        const left = `calc(${col} * (${cell} + ${gap}px))`;
        const top = `calc(${row} * (${cell} + ${gap}px))`;
        const isHint = hintIndex === i;
        const canMove = canMultiSlide(board, i, size);
        const isInPlace = tile === i + 1;
        const isMultiPush = canMove && (Math.abs(row - eRow) > 1 || Math.abs(col - eCol) > 1);

        const pictureStyle: CSSProperties =
          style === 'picture'
            ? {
                backgroundImage: `url(${pictureUrl})`,
                backgroundSize: `${size * 100}% ${size * 100}%`,
                backgroundPosition: `${(gCol / Math.max(1, size - 1)) * 100}% ${(gRow / Math.max(1, size - 1)) * 100}%`,
                backgroundRepeat: 'no-repeat',
              }
            : {
                backgroundColor: '#cbd5e1',
                backgroundImage: [
                  'linear-gradient(rgba(248,250,252,0.65), rgba(248,250,252,0.85))',
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
            className={`absolute rounded-xl font-bold touch-manipulation border shadow-md overflow-hidden transition-shadow ${
              size <= 3 ? 'text-2xl sm:text-3xl' : size === 4 ? 'text-xl sm:text-2xl' : 'text-sm sm:text-base'
            } ${
              isHint
                ? 'border-amber-300 ring-4 ring-amber-400/80 z-20 animate-pulse'
                : isInPlace
                  ? 'border-emerald-400/70 ring-1 ring-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                  : 'border-white/25'
            } ${canMove ? 'hover:brightness-110 cursor-pointer active:scale-95' : 'opacity-95'}`}
            style={{
              width: cell,
              height: cell,
              left,
              top,
              color: style === 'picture' ? '#f8fafc' : '#0f172a',
              transitionProperty: 'left, top, transform, box-shadow, filter',
              transitionDuration: duration,
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              textShadow: style === 'picture' ? '0 1px 3px rgba(0,0,0,0.9)' : undefined,
              ...pictureStyle,
            }}
            aria-label={`第 ${tile} 格${isInPlace ? '（已歸位）' : ''}${isHint ? '（建議）' : ''}`}
          >
            {/* Solved In-Place Indicator Dot */}
            {isInPlace && (
              <span
                className="absolute top-1 right-1.5 flex h-2 w-2"
                title="已歸位"
              >
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400 shadow-sm" />
              </span>
            )}

            {/* Multi-slide train indicator on distant tiles */}
            {isMultiPush && canMove && (
              <span className="absolute bottom-1 left-1.5 text-[9px] font-mono text-emerald-800/80 bg-emerald-300/60 rounded px-1 py-0.2 leading-none font-semibold">
                連動
              </span>
            )}

            {style === 'number' ? (
              tile
            ) : (
              <span className="absolute bottom-0.5 right-1 text-[10px] sm:text-xs font-semibold opacity-95 bg-black/40 px-1 rounded">
                {tile}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

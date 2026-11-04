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
  tileManhattan,
  type Board,
  type BoardSize,
  type SlideDir,
  type ThemeId,
  type VisualStyle,
} from './fifteenLogic.ts';

const SLIDE_MS = 170;
const SWIPE_PX = 24;

type SparkParticle = {
  id: string;
  xPct: number;
  yPct: number;
  dx: number;
  dy: number;
  color: string;
};

type Props = {
  board: Board;
  size: BoardSize;
  style: VisualStyle;
  theme?: ThemeId;
  showHeatmap?: boolean;
  highlightedTile?: number | null;
  hintIndex: number | null;
  disabled: boolean;
  onSlide: (next: Board, tileIndex: number, movedCount?: number) => void;
  pictureUrl: string;
  showGhost?: boolean;
  onTileHover?: (tile: number | null) => void;
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
  theme = 'walnut',
  showHeatmap = false,
  highlightedTile = null,
  hintIndex,
  disabled,
  onSlide,
  pictureUrl,
  showGhost = false,
  onTileHover,
}: Props): ReactElement {
  const boardRef = useRef<HTMLDivElement>(null);
  const [animating, setAnimating] = useState(false);
  const pointerStart = useRef<{ x: number; y: number; index: number | null } | null>(null);
  const reduced = useRef(false);

  // Spark burst particles for tile lock
  const [particles, setParticles] = useState<SparkParticle[]>([]);
  const prevBoardRef = useRef<Board>(board);
  const [snappedTiles, setSnappedTiles] = useState<Set<number>>(new Set());

  useEffect(() => {
    reduced.current = prefersReducedMotion();
  }, []);

  // Detect newly in-place tiles to trigger lock particle burst & gear snap animation
  useEffect(() => {
    const prev = prevBoardRef.current;
    prevBoardRef.current = board;
    if (reduced.current) return;

    const newlyLocked: { tile: number; index: number }[] = [];
    for (let i = 0; i < board.length; i++) {
      const tile = board[i];
      if (tile !== null && tile === i + 1) {
        const prevTileAtSlot = prev[i];
        if (prevTileAtSlot !== tile) {
          newlyLocked.push({ tile, index: i });
        }
      }
    }

    if (newlyLocked.length > 0) {
      const newSnapped = new Set<number>();
      const newParticles: SparkParticle[] = [];

      for (const item of newlyLocked) {
        newSnapped.add(item.tile);
        const row = Math.floor(item.index / size);
        const col = item.index % size;
        const xPct = ((col + 0.5) / size) * 100;
        const yPct = ((row + 0.5) / size) * 100;

        // 8 radiating micro spark particles
        for (let p = 0; p < 8; p++) {
          const angle = (p * 45 * Math.PI) / 180;
          const dist = 22 + (p % 2) * 10;
          newParticles.push({
            id: `spark-${item.tile}-${p}-${Date.now()}`,
            xPct,
            yPct,
            dx: Math.round(Math.cos(angle) * dist),
            dy: Math.round(Math.sin(angle) * dist),
            color: theme === 'cyber' ? '#38bdf8' : '#34d399',
          });
        }
      }

      setSnappedTiles(newSnapped);
      setParticles((curr) => [...curr, ...newParticles]);

      const clearTimer = window.setTimeout(() => {
        setSnappedTiles(new Set());
        setParticles((curr) => curr.filter((p) => !newParticles.includes(p)));
      }, 500);

      return () => window.clearTimeout(clearTimer);
    }
  }, [board, size, theme]);

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

    if (absX > absY) trySlideDir(dx > 0 ? 'right' : 'left');
    else trySlideDir(dy > 0 ? 'down' : 'up');
  };

  const gap = size >= 5 ? 4 : 7;
  const duration = reduced.current ? '0ms' : `${SLIDE_MS}ms`;
  const cell = `calc((100% - ${(size - 1) * gap}px) / ${size})`;
  const eIdx = emptyIndex(board);
  const eRow = Math.floor(eIdx / size);
  const eCol = eIdx % size;

  const themeClass =
    theme === 'obsidian'
      ? 'fp-theme-obsidian'
      : theme === 'cyber'
        ? 'fp-theme-cyber'
        : 'fp-theme-walnut';

  const rivetColor =
    theme === 'obsidian'
      ? 'bg-amber-500/40 border-amber-400/50'
      : theme === 'cyber'
        ? 'bg-sky-400/40 border-sky-300/50'
        : 'bg-amber-600/50 border-amber-300/60';

  return (
    <div
      ref={boardRef}
      className={`relative w-[min(92vw,440px)] aspect-square rounded-2xl p-2.5 touch-none select-none transition-all ${themeClass}`}
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
      aria-label={`${size} 乘 ${size} 機械推盤`}
    >
      {/* Decorative Corner Rivets */}
      <span
        aria-hidden="true"
        className={`absolute top-1.5 left-1.5 w-2 h-2 rounded-full border shadow-sm ${rivetColor}`}
      />
      <span
        aria-hidden="true"
        className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full border shadow-sm ${rivetColor}`}
      />
      <span
        aria-hidden="true"
        className={`absolute bottom-1.5 left-1.5 w-2 h-2 rounded-full border shadow-sm ${rivetColor}`}
      />
      <span
        aria-hidden="true"
        className={`absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full border shadow-sm ${rivetColor}`}
      />

      {/* Recessed Slots & Blueprint Ghost Coordinates */}
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
            className="fp-slot absolute rounded-xl flex items-center justify-center pointer-events-none select-none transition-all"
            style={{
              width: cell,
              height: cell,
              left: sLeft,
              top: sTop,
            }}
          >
            {showGhost && !isGoalLast && (
              <span className="text-emerald-400/35 font-bold font-mono text-xs sm:text-sm tracking-wider">
                #{targetNum}
              </span>
            )}
            {showGhost && isGoalLast && (
              <span className="text-amber-400/40 font-semibold font-mono text-[10px] tracking-widest">
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
        const isSpotlight = highlightedTile === tile;
        const dist = tileManhattan(tile, i, size);
        const isSnapped = snappedTiles.has(tile);

        // Heatmap class
        const heatClass = showHeatmap
          ? dist === 0
            ? 'fp-heat-0'
            : dist === 1
              ? 'fp-heat-1'
              : dist === 2
                ? 'fp-heat-2'
                : ''
          : isInPlace
            ? 'fp-heat-0'
            : '';

        const pictureStyle: CSSProperties =
          style === 'picture'
            ? {
                backgroundImage: `url(${pictureUrl})`,
                backgroundSize: `${size * 100}% ${size * 100}%`,
                backgroundPosition: `${(gCol / Math.max(1, size - 1)) * 100}% ${(gRow / Math.max(1, size - 1)) * 100}%`,
                backgroundRepeat: 'no-repeat',
              }
            : {};

        return (
          <button
            key={tile}
            type="button"
            role="gridcell"
            disabled={!canMove || disabled || animating}
            onPointerDown={(ev) => onPointerDown(i, ev)}
            onPointerEnter={() => onTileHover?.(tile)}
            onPointerLeave={() => onTileHover?.(null)}
            className={`absolute rounded-xl font-bold touch-manipulation border overflow-hidden transition-all ${
              style === 'picture' ? 'fp-tile-picture text-white' : 'fp-tile-num'
            } ${
              size <= 3 ? 'text-2xl sm:text-3xl' : size === 4 ? 'text-xl sm:text-2xl' : 'text-sm sm:text-base'
            } ${
              isSpotlight
                ? 'fp-spotlight-active'
                : isHint
                  ? 'border-amber-300 ring-4 ring-amber-400/90 z-20 animate-pulse'
                  : heatClass
            } ${isSnapped ? 'fp-gear-snapped z-20' : ''} ${
              canMove ? 'hover:brightness-110 cursor-pointer active:scale-95' : 'opacity-95'
            }`}
            style={{
              width: cell,
              height: cell,
              left,
              top,
              transitionProperty: 'left, top, transform, box-shadow, filter',
              transitionDuration: duration,
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
              textShadow:
                style === 'picture'
                  ? '0 1px 3px rgba(0,0,0,0.95), 0 0 4px rgba(0,0,0,0.8)'
                  : undefined,
              ...pictureStyle,
            }}
            aria-label={`第 ${tile} 格${isInPlace ? '（已歸位）' : ''}${isHint ? '（建議）' : ''}`}
          >
            {/* Solved Latch Lock / In-Place Indicator */}
            {isInPlace && (
              <span
                className="absolute top-1 right-1.5 flex h-2.5 w-2.5"
                title="已歸位鎖定"
              >
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border border-emerald-200/60 shadow-sm" />
              </span>
            )}

            {/* Heatmap Distance Badge */}
            {showHeatmap && !isInPlace && (
              <span
                className={`absolute top-1 right-1 px-1 py-0.2 rounded text-[9px] font-mono font-bold leading-none ${
                  dist === 1
                    ? 'bg-amber-500/80 text-black'
                    : dist === 2
                      ? 'bg-orange-500/70 text-white'
                      : 'bg-slate-800/80 text-slate-300'
                }`}
                title={`距目標 ${dist} 步`}
              >
                +{dist}
              </span>
            )}

            {/* Multi-slide train indicator on distant tiles */}
            {isMultiPush && canMove && (
              <span className="absolute bottom-1 left-1.5 text-[9px] font-mono text-emerald-950 bg-emerald-300/80 rounded px-1 py-0.2 leading-none font-bold shadow-sm">
                連動
              </span>
            )}

            {/* Tile Number Display */}
            {style === 'number' ? (
              <span className="drop-shadow-sm">{tile}</span>
            ) : (
              <span className="absolute bottom-1 right-1 text-[10px] sm:text-xs font-mono font-bold bg-black/60 px-1 py-0.5 rounded shadow">
                {tile}
              </span>
            )}
          </button>
        );
      })}

      {/* Micro Spark Burst Particles */}
      {particles.map((p) => (
        <span
          key={p.id}
          className="fp-spark-particle absolute pointer-events-none select-none rounded-full w-1.5 h-1.5 shadow"
          style={
            {
              left: `${p.xPct}%`,
              top: `${p.yPct}%`,
              backgroundColor: p.color,
              boxShadow: `0 0 6px ${p.color}`,
              '--dx': `${p.dx}px`,
              '--dy': `${p.dy}px`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

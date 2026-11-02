import type { ActivePiece, Cell, TetrominoType } from '../utils/tetrisLogic';
import {
  BOARD_SIZE,
  TETROMINO_COLOR,
  getCellsForActive,
  movePiece,
  tetrominoBlockUrl,
} from '../utils/tetrisLogic';

interface BoardWellProps {
  board: Cell[][];
  active: ActivePiece | null;
  clearing: number[] | null;
  /** Pixel width of the well; height follows the aspect ratio. */
  widthPx: number;
  showGhost?: boolean;
  className?: string;
  dangerZone?: 'safe' | 'warning' | 'critical';
  showDangerLine?: boolean;
}

function ghostCellsFor(board: Cell[][], active: ActivePiece | null): Set<string> {
  if (!active) return new Set();
  let ghost = active;
  for (;;) {
    const moved = movePiece(board, ghost, 1, 0);
    if (!moved) break;
    ghost = moved;
  }
  return new Set(getCellsForActive(ghost).map((p) => `${p.row},${p.col}`));
}

export function BoardWell({
  board,
  active,
  clearing,
  widthPx,
  showGhost = true,
  className = '',
  dangerZone = 'safe',
  showDangerLine = true,
}: BoardWellProps) {
  const ghostCells = showGhost ? ghostCellsFor(board, active) : new Set<string>();
  const activeCells = active
    ? new Set(getCellsForActive(active).map((p) => `${p.row},${p.col}`))
    : new Set<string>();

  const isCritical = dangerZone === 'critical';
  const isWarning = dangerZone === 'warning';

  const borderClass = isCritical
    ? 'border-rose-500 shadow-[0_0_18px_rgba(244,63,94,0.45)] tetris-danger-glow'
    : isWarning
      ? 'border-amber-500/80 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
      : 'border-slate-800';

  return (
    <div className="relative inline-block select-none">
      <div
        className={`relative grid gap-0.5 rounded-lg p-1 bg-cover bg-center border transition-all duration-300 ${borderClass} ${className}`}
        style={{
          gridTemplateColumns: `repeat(${BOARD_SIZE.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${BOARD_SIZE.rows}, minmax(0, 1fr))`,
          width: widthPx,
          backgroundColor: '#0f172a',
          backgroundImage: [
            'linear-gradient(rgba(15,23,42,0.55), rgba(15,23,42,0.72))',
            `url(${import.meta.env.BASE_URL}well-bg.jpg)`,
          ].join(', '),
        }}
      >
        {/* Danger Line threshold indicator at row 4 (height 16 / 20) */}
        {showDangerLine && (
          <div
            className={`absolute left-0 right-0 top-[20%] pointer-events-none z-10 flex items-center justify-between px-1 border-b transition-opacity duration-300 ${
              isCritical
                ? 'border-rose-500 text-rose-300 opacity-90 tetris-danger-pulse'
                : isWarning
                  ? 'border-amber-400/80 text-amber-200/90 opacity-75'
                  : 'border-rose-500/30 text-rose-400/40 opacity-40 hover:opacity-80'
            }`}
            style={{ transform: 'translateY(-50%)' }}
          >
            <span className="text-[8px] font-mono tracking-wider uppercase bg-slate-950/70 px-1 rounded">
              危險警戒線
            </span>
            <span className="text-[8px] font-mono bg-slate-950/70 px-1 rounded">
              16H
            </span>
          </div>
        )}

        {Array.from({ length: BOARD_SIZE.rows * BOARD_SIZE.cols }, (_, index) => {
          const row = Math.floor(index / BOARD_SIZE.cols);
          const col = index % BOARD_SIZE.cols;
          const cell = board[row][col];
          const isActive = activeCells.has(`${row},${col}`);
          const isGhost = ghostCells.has(`${row},${col}`) && !cell && !isActive;
          const isClearing = clearing?.includes(row) ?? false;
          let bg = 'bg-slate-800/40';
          let tileStyle:
            | { backgroundImage: string; backgroundSize: string; backgroundPosition: string }
            | undefined;
          if (cell === 'G') {
            bg = TETROMINO_COLOR.G;
          } else if (cell || isActive) {
            const type = (cell || active?.type) as TetrominoType;
            bg = TETROMINO_COLOR[type];
            tileStyle = {
              backgroundImage: `url(${tetrominoBlockUrl(type)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            };
          } else if (isGhost) {
            bg = 'bg-slate-500/30';
          }
          return (
            <div
              key={`${row}-${col}`}
              className={`aspect-square rounded-[3px] ${bg} border border-slate-900/80${
                isClearing ? ' tetris-clearing' : ''
              }`}
              style={tileStyle}
            />
          );
        })}
      </div>
    </div>
  );
}

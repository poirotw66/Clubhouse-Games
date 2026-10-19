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
}: BoardWellProps) {
  const ghostCells = showGhost ? ghostCellsFor(board, active) : new Set<string>();
  const activeCells = active
    ? new Set(getCellsForActive(active).map((p) => `${p.row},${p.col}`))
    : new Set<string>();

  return (
    <div
      className={`grid gap-0.5 rounded-lg p-1 bg-cover bg-center ${className}`}
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
  );
}

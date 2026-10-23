import type { CSSProperties, ReactElement, Ref } from 'react';
import type { Board, Cell } from '../utils/reversiLogic';
import { SIZE } from '../utils/reversiLogic';

export interface BoardGridProps {
  board: Board;
  legalSet: Set<string>;
  lastMove: [number, number] | null;
  hintCell: [number, number] | null;
  flipCells: Set<string>;
  teachCells?: Set<string>;
  showLegalHints: boolean;
  humanCanClick: boolean;
  phasePlaying: boolean;
  onCellClick: (r: number, c: number) => void;
  /** Outer board shell — used for shake / particle anchors. */
  shellRef?: Ref<HTMLDivElement>;
}

function pieceStyle(cell: 'black' | 'white'): CSSProperties {
  return {
    backgroundColor: cell === 'black' ? '#1c1917' : '#f8fafc',
    backgroundImage: `url(${import.meta.env.BASE_URL}piece-${cell}.jpg)`,
  };
}

export function BoardGrid({
  board,
  legalSet,
  lastMove,
  hintCell,
  flipCells,
  teachCells,
  showLegalHints,
  humanCanClick,
  phasePlaying,
  onCellClick,
  shellRef,
}: BoardGridProps): ReactElement {
  return (
    <div
      ref={shellRef}
      data-reversi-board
      className="inline-block p-2 rounded-xl bg-emerald-900/80 shadow-lg box-border w-full max-w-[min(92vw,360px)] aspect-square"
    >
      <div
        className="grid gap-0.5 bg-stone-800 rounded-lg p-1 w-full h-full"
        style={{
          gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${SIZE}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: SIZE * SIZE }, (_, i) => {
          const r = Math.floor(i / SIZE);
          const c = i % SIZE;
          const cell: Cell = board[r][c];
          const key = `${r},${c}`;
          const isLegal = legalSet.has(key);
          const isLastMove = lastMove !== null && lastMove[0] === r && lastMove[1] === c;
          const isHint = hintCell !== null && hintCell[0] === r && hintCell[1] === c;
          const isTeach = teachCells?.has(key) ?? false;
          const isFlipping = flipCells.has(key);
          return (
            <button
              key={key}
              type="button"
              data-reversi-cell={`${r},${c}`}
              onClick={() => onCellClick(r, c)}
              disabled={!phasePlaying || !humanCanClick || (humanCanClick && !isLegal)}
              className={`
                w-full aspect-square rounded-md flex items-center justify-center touch-manipulation
                transition-colors duration-150 active:scale-95 bg-cover bg-center
                ${cell ? 'cursor-default' : ''}
                ${showLegalHints && isLegal && !cell ? 'hover:brightness-110' : ''}
                ${!phasePlaying ? 'cursor-default' : ''}
                ${isLastMove ? 'ring-2 ring-yellow-400/70 ring-inset' : ''}
                ${isHint ? 'ring-2 ring-sky-300 ring-inset' : ''}
                ${isTeach && !isHint ? 'ring-2 ring-amber-300/80 ring-inset' : ''}
              `}
              style={{
                backgroundColor: '#065f46',
                backgroundImage: [
                  isHint
                    ? 'linear-gradient(rgba(14,165,233,0.45), rgba(14,165,233,0.5))'
                    : isTeach
                      ? 'linear-gradient(rgba(251,191,36,0.35), rgba(251,191,36,0.4))'
                      : showLegalHints && isLegal && !cell
                        ? 'linear-gradient(rgba(5,150,105,0.45), rgba(5,150,105,0.55))'
                        : 'linear-gradient(rgba(6,95,70,0.35), rgba(6,78,59,0.5))',
                  `url(${import.meta.env.BASE_URL}cell.jpg)`,
                ].join(', '),
              }}
              aria-label={
                cell
                  ? `第 ${r + 1} 列 ${c + 1} 欄 ${cell === 'black' ? '黑' : '白'}`
                  : isHint
                    ? `提示：第 ${r + 1} 列 ${c + 1} 欄`
                    : isLegal
                      ? `可下於第 ${r + 1} 列 ${c + 1} 欄`
                      : `空格第 ${r + 1} 列 ${c + 1} 欄`
              }
            >
              {cell && (
                <span
                  className={`piece-disc w-[85%] h-[85%] rounded-full shadow-inner bg-cover bg-center ${
                    cell === 'black' ? 'ring-2 ring-stone-600' : 'ring-2 ring-stone-400'
                  } ${isLastMove ? 'ring-4 ring-yellow-400/80' : ''} ${
                    isFlipping ? 'piece-flip' : ''
                  }`}
                  style={pieceStyle(cell)}
                />
              )}
              {!cell && showLegalHints && isLegal && !isHint && (
                <span className="w-2 h-2 rounded-full bg-emerald-300/60" aria-hidden />
              )}
              {!cell && isHint && (
                <span className="w-3 h-3 rounded-full bg-sky-200/90" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

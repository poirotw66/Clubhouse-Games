import type { CSSProperties, ReactElement, Ref } from 'react';
import type { Board, Cell } from '../utils/reversiLogic';
import { SIZE } from '../utils/reversiLogic';
import { getCellRiskType, toAlgebraic, type DangerZoneType } from '../utils/tactics';

export interface BoardGridProps {
  board: Board;
  legalSet: Set<string>;
  lastMove: [number, number] | null;
  hintCell: [number, number] | null;
  cursorCell: [number, number] | null;
  flipCells: Set<string>;
  previewFlips?: Set<string>;
  teachCells?: Set<string>;
  showLegalHints: boolean;
  humanCanClick: boolean;
  phasePlaying: boolean;
  tacticalVision: boolean;
  flipsMap?: Map<string, number>;
  onCellClick: (r: number, c: number) => void;
  onCellHover?: (r: number | null, c: number | null) => void;
  /** Outer board shell — used for shake / particle anchors. */
  shellRef?: Ref<HTMLDivElement>;
}

const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const ROW_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8'];

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
  cursorCell,
  flipCells,
  previewFlips = new Set(),
  teachCells,
  showLegalHints,
  humanCanClick,
  phasePlaying,
  tacticalVision,
  flipsMap,
  onCellClick,
  onCellHover,
  shellRef,
}: BoardGridProps): ReactElement {
  return (
    <div
      ref={shellRef}
      data-reversi-board
      className="inline-block p-2.5 sm:p-3.5 rounded-2xl bg-gradient-to-b from-emerald-950 via-emerald-900 to-stone-950 shadow-2xl border-2 border-emerald-700/60 box-border w-full max-w-[min(94vw,420px)] aspect-square"
    >
      <div className="flex flex-col w-full h-full">
        {/* Top coordinate row (A-H) */}
        <div className="grid grid-cols-8 px-4 sm:px-5 pb-1 text-center font-mono text-[10px] sm:text-xs font-semibold text-emerald-300/80 select-none">
          {COL_LABELS.map((col) => (
            <span key={col}>{col}</span>
          ))}
        </div>

        {/* Center row: Left coords, 8x8 Board, Right coords */}
        <div className="flex-1 flex items-stretch">
          {/* Left coordinate column (1-8) */}
          <div className="flex flex-col justify-around pr-1 sm:pr-1.5 text-center font-mono text-[10px] sm:text-xs font-semibold text-emerald-300/80 select-none">
            {ROW_LABELS.map((row) => (
              <span key={row} className="h-full flex items-center justify-center">
                {row}
              </span>
            ))}
          </div>

          {/* 8x8 Grid */}
          <div
            className="flex-1 grid gap-0.5 sm:gap-1 bg-stone-950 rounded-lg p-0.5 sm:p-1 w-full h-full border border-emerald-800/60 shadow-inner"
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
              const isCursor = cursorCell !== null && cursorCell[0] === r && cursorCell[1] === c;
              const isTeach = teachCells?.has(key) ?? false;
              const isFlipping = flipCells.has(key);
              const isPreviewFlip = previewFlips.has(key);

              // Tactical Vision info
              const flipCount = flipsMap?.get(key);
              const riskType: DangerZoneType = tacticalVision ? getCellRiskType(board, r, c) : 'safe';

              return (
                <button
                  key={key}
                  type="button"
                  data-reversi-cell={`${r},${c}`}
                  onClick={() => onCellClick(r, c)}
                  onMouseEnter={() => onCellHover?.(r, c)}
                  onMouseLeave={() => onCellHover?.(null, null)}
                  disabled={!phasePlaying || !humanCanClick || (humanCanClick && !isLegal)}
                  className={`
                    w-full aspect-square rounded sm:rounded-md flex items-center justify-center touch-manipulation
                    relative transition-all duration-150 active:scale-95 bg-cover bg-center select-none overflow-hidden
                    ${cell ? 'cursor-default' : ''}
                    ${showLegalHints && isLegal && !cell ? 'hover:brightness-125 cursor-pointer' : ''}
                    ${!phasePlaying ? 'cursor-default' : ''}
                    ${isLastMove ? 'ring-2 ring-yellow-400 ring-inset' : ''}
                    ${isHint ? 'ring-2 ring-sky-300 ring-inset' : ''}
                    ${isTeach && !isHint ? 'ring-2 ring-amber-300/80 ring-inset' : ''}
                    ${isCursor ? 'ring-2 sm:ring-[3px] ring-emerald-300 ring-offset-1 ring-offset-black z-10' : ''}
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
                      ? `${toAlgebraic(r, c)} ${cell === 'black' ? '黑子' : '白子'}`
                      : isHint
                        ? `提示落子點：${toAlgebraic(r, c)}`
                        : isLegal
                          ? `可下子於 ${toAlgebraic(r, c)}${flipCount ? `（翻轉 ${flipCount} 子）` : ''}`
                          : `空格 ${toAlgebraic(r, c)}`
                  }
                >
                  {/* Placed Piece */}
                  {cell && (
                    <span
                      className={`piece-disc w-[84%] h-[84%] rounded-full shadow-md bg-cover bg-center transition-all duration-150 ${
                        cell === 'black' ? 'ring-2 ring-stone-700' : 'ring-2 ring-stone-300'
                      } ${isLastMove ? 'ring-4 ring-yellow-400/90' : ''} ${
                        isFlipping ? 'piece-flip' : ''
                      } ${
                        isPreviewFlip
                          ? 'ring-4 ring-emerald-400 brightness-125 shadow-[0_0_10px_rgba(52,211,153,0.9)] animate-pulse'
                          : ''
                      }`}
                      style={pieceStyle(cell)}
                    />
                  )}

                  {/* Standard Legal Move Dot */}
                  {!cell && showLegalHints && isLegal && !isHint && !tacticalVision && (
                    <span className="w-2 sm:w-2.5 h-2 sm:h-2.5 rounded-full bg-emerald-300/80 shadow-sm" aria-hidden />
                  )}

                  {/* Hint Cell Ring */}
                  {!cell && isHint && (
                    <span className="w-3 sm:w-3.5 h-3 sm:h-3.5 rounded-full bg-sky-200/95 shadow-md animate-ping" aria-hidden />
                  )}

                  {/* Tactical Vision: Badges & Flip Counts */}
                  {tacticalVision && !cell && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                      {/* Special square risk tags */}
                      {riskType === 'corner' && (
                        <span className="absolute top-0.5 right-0.5 text-[8px] sm:text-[9px] font-black text-amber-300 bg-amber-950/80 px-1 rounded border border-amber-500/60 shadow-sm">
                          ★角
                        </span>
                      )}
                      {riskType === 'x-square' && (
                        <span className="absolute top-0.5 right-0.5 text-[8px] sm:text-[9px] font-black text-rose-300 bg-rose-950/85 px-0.5 rounded border border-rose-500/60 shadow-sm">
                          危X
                        </span>
                      )}
                      {riskType === 'c-square' && (
                        <span className="absolute top-0.5 right-0.5 text-[8px] sm:text-[9px] font-black text-amber-300 bg-amber-950/80 px-0.5 rounded border border-amber-600/60 shadow-sm">
                          慎C
                        </span>
                      )}

                      {/* Flip potential badge on legal squares */}
                      {isLegal && flipCount !== undefined && (
                        <span className="px-1 py-0.2 rounded-full bg-emerald-950/90 border border-emerald-400 text-emerald-200 font-mono text-[9px] sm:text-[10px] font-extrabold shadow-md">
                          +{flipCount}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Keyboard Reticle indicator */}
                  {isCursor && (
                    <span className="absolute inset-0 rounded border-2 border-emerald-300/90 pointer-events-none animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Right coordinate column (1-8) */}
          <div className="flex flex-col justify-around pl-1 sm:pr-1.5 text-center font-mono text-[10px] sm:text-xs font-semibold text-emerald-300/80 select-none">
            {ROW_LABELS.map((row) => (
              <span key={row} className="h-full flex items-center justify-center">
                {row}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom coordinate row (A-H) */}
        <div className="grid grid-cols-8 px-4 sm:px-5 pt-1 text-center font-mono text-[10px] sm:text-xs font-semibold text-emerald-300/80 select-none">
          {COL_LABELS.map((col) => (
            <span key={col}>{col}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

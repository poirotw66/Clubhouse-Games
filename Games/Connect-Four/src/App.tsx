import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playMove, playWin, playLose } from '@clubhouse/shared/synthAudio';
import type { Board, PieceColor, Difficulty } from './utils/connect4Logic';
import {
  createInitialBoard,
  getLegalColumns,
  getDropRow,
  dropPiece,
  hasWonAt,
  isBoardFull,
  getWinningCells,
  COLS,
  ROWS,
} from './utils/connect4Logic';
import { pickBotColumn, DIFFICULTY_LABELS } from './utils/connect4Logic';
import { RefreshCw, BookOpen, Users, Undo2, Lightbulb } from 'lucide-react';

type GamePhase = 'playing' | 'over';
type GameMode = 'two' | 'bot';

interface GameState {
  board: Board;
  currentTurn: PieceColor;
  phase: GamePhase;
  winner: PieceColor | 'draw' | null;
}

const STREAK_KEY = 'clubhouse-connect4-win-streak';

function loadStreak(): number {
  try {
    const n = Number(localStorage.getItem(STREAK_KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

function saveStreak(n: number): void {
  try {
    localStorage.setItem(STREAK_KEY, String(Math.max(0, Math.floor(n))));
  } catch {
    /* ignore quota / private mode */
  }
}

function getInitialState(): GameState {
  return {
    board: createInitialBoard(),
    currentTurn: 'red',
    phase: 'playing',
    winner: null,
  };
}

export default function App() {
  const [gameMode, setGameMode] = useState<GameMode>('two');
  const [playerSide, setPlayerSide] = useState<PieceColor>('red');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [state, setState] = useState<GameState>(getInitialState);
  const [history, setHistory] = useState<GameState[]>([]);
  const [hintCol, setHintCol] = useState<number | null>(null);
  const [winStreak, setWinStreak] = useState(loadStreak);
  const [showRules, setShowRules] = useState(false);
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const botScheduled = useRef(false);
  const prevPhaseRef = useRef<GamePhase>('playing');

  const legalCols = state.phase === 'playing' ? getLegalColumns(state.board) : [];
  const legalSet = new Set(legalCols);

  const isBotTurn =
    gameMode === 'bot' &&
    state.phase === 'playing' &&
    state.currentTurn !== playerSide;

  const humanCanAct =
    state.phase === 'playing' &&
    (gameMode === 'two' || state.currentTurn === playerSide);

  useEffect(() => {
    if (!isBotTurn || botScheduled.current) return;
    botScheduled.current = true;
    const timer = setTimeout(() => {
      const botColor: PieceColor = playerSide === 'red' ? 'yellow' : 'red';
      const col = pickBotColumn(state.board, botColor, difficulty);
      if (col === null) {
        botScheduled.current = false;
        return;
      }
      const dropRow = getDropRow(state.board, col);
      const nextBoard = dropPiece(state.board, col, botColor);
      if (!nextBoard || dropRow === null) {
        botScheduled.current = false;
        return;
      }
      const won = hasWonAt(nextBoard, dropRow, col, botColor);
      const full = isBoardFull(nextBoard);
      const nextTurn: PieceColor = botColor === 'red' ? 'yellow' : 'red';
      playMove();
      setState({
        board: nextBoard,
        currentTurn: nextTurn,
        phase: won || full ? 'over' : 'playing',
        winner: won ? botColor : full ? 'draw' : null,
      });
      botScheduled.current = false;
    }, 500);
    return () => clearTimeout(timer);
  }, [isBotTurn, state.board, playerSide, difficulty]);

  useEffect(() => {
    if (state.phase !== 'over' || prevPhaseRef.current === 'over') {
      prevPhaseRef.current = state.phase;
      return;
    }
    if (gameMode === 'bot' && state.winner) {
      if (state.winner === 'draw') {
        setWinStreak(0);
        saveStreak(0);
        // no win/lose SFX for draws
      } else if (state.winner === playerSide) {
        playWin();
        setWinStreak((prev) => {
          const next = prev + 1;
          saveStreak(next);
          return next;
        });
      } else {
        playLose();
        setWinStreak(0);
        saveStreak(0);
      }
    }
    prevPhaseRef.current = state.phase;
  }, [state.phase, state.winner, gameMode, playerSide]);

  const winningCells = useMemo(
    () => (state.phase === 'over' && state.winner && state.winner !== 'draw' ? getWinningCells(state.board) : null),
    [state.phase, state.winner, state.board]
  );

  const resetBoard = useCallback(() => {
    setState(getInitialState());
    setHistory([]);
    setHintCol(null);
    setHoverCol(null);
    botScheduled.current = false;
  }, []);

  const handleColumnClick = useCallback(
    (col: number) => {
      if (state.phase !== 'playing' || !legalSet.has(col)) return;
      if (gameMode === 'bot' && state.currentTurn !== playerSide) return;
      const dropRow = getDropRow(state.board, col);
      const nextBoard = dropPiece(state.board, col, state.currentTurn);
      if (!nextBoard || dropRow === null) return;
      const won = hasWonAt(nextBoard, dropRow, col, state.currentTurn);
      const full = isBoardFull(nextBoard);
      const nextTurn: PieceColor = state.currentTurn === 'red' ? 'yellow' : 'red';
      // Snapshot before the human drop so one undo also rolls back a following bot reply.
      setHistory((h) => [...h, state]);
      setHintCol(null);
      playMove();
      setState({
        board: nextBoard,
        currentTurn: nextTurn,
        phase: won || full ? 'over' : 'playing',
        winner: won ? state.currentTurn : full ? 'draw' : null,
      });
    },
    [state, legalSet, gameMode, playerSide]
  );

  const canUndo = history.length > 0 && !isBotTurn && state.phase === 'playing';

  const handleUndo = useCallback(() => {
    // ponytail: no undo after game over — streak already written; reversing a loss needs prior streak.
    if (!canUndo) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setState(prev);
    setHintCol(null);
    botScheduled.current = false;
  }, [canUndo, history]);

  const handleHint = useCallback(() => {
    if (!humanCanAct) return;
    const col = pickBotColumn(state.board, state.currentTurn, 'hard');
    setHintCol(col);
  }, [humanCanAct, state.board, state.currentTurn]);

  const handleNewGame = useCallback(() => {
    resetBoard();
  }, [resetBoard]);

  const statusMessage =
    state.phase === 'over'
      ? state.winner === 'draw'
        ? '和局'
        : state.winner === 'red'
          ? '紅方獲勝'
          : '黃方獲勝'
      : gameMode === 'bot'
        ? state.currentTurn === playerSide
          ? '輪到你下子'
          : '電腦思考中…'
        : state.currentTurn === 'red'
          ? '紅方下子'
          : '黃方下子';

  const resultTitle =
    state.phase === 'over' && state.winner
      ? state.winner === 'draw'
        ? '和局'
        : gameMode === 'bot'
          ? state.winner === playerSide
            ? '你贏了！'
            : '電腦獲勝'
          : state.winner === 'red'
            ? '紅方獲勝'
            : '黃方獲勝'
      : '';

  const resultVariant =
    gameMode === 'bot' && state.winner && state.winner !== 'draw'
      ? state.winner === playerSide
        ? 'win'
        : 'lose'
      : 'neutral';

  return (
    <div
      className="min-h-screen text-white flex flex-col items-center p-4 min-w-0 bg-cover bg-center"
      style={{
        backgroundColor: '#0f172a',
        backgroundImage: [
          'linear-gradient(rgba(15,23,42,0.72), rgba(15,23,42,0.88))',
          `url(${import.meta.env.BASE_URL}table-bg.jpg)`,
        ].join(', '),
      }}
    >
      <BackToMenu />
      <header className="w-full max-w-lg flex justify-between items-center mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold tracking-tight">四子棋 Connect Four</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-600">
            {gameMode === 'bot' ? '對戰電腦' : '雙人對戰'}
          </span>
          {gameMode === 'bot' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-200 border border-amber-700/60">
              連勝 {winStreak}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40 disabled:pointer-events-none touch-manipulation"
            title="悔棋"
            aria-label="悔棋"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleHint}
            disabled={!humanCanAct}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40 disabled:pointer-events-none touch-manipulation"
            title="提示"
            aria-label="提示"
          >
            <Lightbulb className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors touch-manipulation"
            title="規則"
            aria-label="規則"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleNewGame}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors touch-manipulation"
            title="新局"
            aria-label="新局"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex items-center justify-center gap-6 mb-4 text-sm">
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            state.phase === 'playing' && state.currentTurn === 'red'
              ? 'bg-red-600/30 ring-2 ring-red-400'
              : 'bg-slate-700/50'
          }`}
        >
          <span
            className="w-4 h-4 rounded-full bg-cover bg-center ring-2 ring-red-400"
            style={{
              backgroundColor: '#ef4444',
              backgroundImage: `url(${import.meta.env.BASE_URL}piece-red.jpg)`,
            }}
          />
          <span>紅</span>
        </div>
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            state.phase === 'playing' && state.currentTurn === 'yellow'
              ? 'bg-yellow-500/30 ring-2 ring-yellow-400'
              : 'bg-slate-700/50'
          }`}
        >
          <span
            className="w-4 h-4 rounded-full bg-cover bg-center ring-2 ring-yellow-300"
            style={{
              backgroundColor: '#facc15',
              backgroundImage: `url(${import.meta.env.BASE_URL}piece-yellow.jpg)`,
            }}
          />
          <span>黃</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
        <button
          type="button"
          onClick={() => {
            setGameMode('two');
            resetBoard();
          }}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full border touch-manipulation ${
            gameMode === 'two'
              ? 'border-sky-400 bg-sky-500/20 text-sky-100'
              : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          <Users className="w-3 h-3" />
          <span>雙人對戰</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setGameMode('bot');
            setPlayerSide('red');
            resetBoard();
          }}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full border touch-manipulation ${
            gameMode === 'bot' && playerSide === 'red'
              ? 'border-amber-400 bg-amber-500/20 text-amber-100'
              : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span>電腦（你執紅）</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setGameMode('bot');
            setPlayerSide('yellow');
            resetBoard();
          }}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full border touch-manipulation ${
            gameMode === 'bot' && playerSide === 'yellow'
              ? 'border-amber-400 bg-amber-500/20 text-amber-100'
              : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span>電腦（你執黃）</span>
        </button>
      </div>

      {gameMode === 'bot' && (
        <div
          className="flex flex-wrap items-center justify-center gap-2 mb-4 text-xs"
          role="group"
          aria-label="電腦難度"
        >
          <span className="text-slate-400">電腦難度</span>
          {(['easy', 'normal', 'hard'] as Difficulty[]).map((id) => {
            const selected = difficulty === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setDifficulty(id);
                  resetBoard();
                }}
                aria-pressed={selected}
                className={`px-3 py-1.5 rounded-full border transition-colors touch-manipulation ${
                  selected
                    ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                    : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {DIFFICULTY_LABELS[id]}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-slate-200 text-sm mb-4">{statusMessage}</p>
      <p className="text-slate-400 text-xs mb-2 md:hidden">點選上方欄位落子</p>

      <div
        className="inline-block p-3 rounded-xl shadow-lg w-full max-w-[min(92vw,360px)] bg-cover bg-center"
        style={{
          backgroundColor: '#1e3a8a',
          backgroundImage: [
            'linear-gradient(rgba(30,58,138,0.55), rgba(30,58,138,0.7))',
            `url(${import.meta.env.BASE_URL}frame.jpg)`,
          ].join(', '),
        }}
      >
        {/* Column headers (drop targets) */}
        <div
          className="grid gap-1 mb-1"
          style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
        >
          {Array.from({ length: COLS }, (_, c) => (
            <button
              key={c}
              type="button"
              onClick={() => handleColumnClick(c)}
              onMouseEnter={() => setHoverCol(c)}
              onMouseLeave={() => setHoverCol(null)}
              disabled={state.phase !== 'playing' || !legalSet.has(c) || isBotTurn}
              className={`
                h-12 min-h-[48px] rounded-t-lg flex items-center justify-center transition-colors touch-manipulation
                ${legalSet.has(c) && !isBotTurn ? 'bg-slate-600 hover:bg-slate-500' : 'bg-slate-800 cursor-not-allowed'}
                ${hoverCol === c && legalSet.has(c) && !isBotTurn ? 'ring-2 ring-white/50' : ''}
                ${hintCol === c ? 'ring-2 ring-emerald-400 bg-emerald-600/40' : ''}
              `}
              aria-label={`Drop in column ${c + 1}`}
            >
              {state.phase === 'playing' && legalSet.has(c) && !isBotTurn && (
                <span
                  className="w-6 h-6 rounded-full bg-cover bg-center opacity-80"
                  style={{
                    backgroundColor: state.currentTurn === 'red' ? '#ef4444' : '#facc15',
                    backgroundImage: `url(${import.meta.env.BASE_URL}piece-${state.currentTurn}.jpg)`,
                  }}
                />
              )}
            </button>
          ))}
        </div>
        {/* Grid: row 0 at top */}
        <div
          className="grid gap-1 rounded-b-lg overflow-hidden p-1 bg-cover bg-center"
          style={{
            gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            gridTemplateRows: `repeat(${ROWS}, 1fr)`,
            aspectRatio: `${COLS}/${ROWS}`,
            backgroundColor: '#1e40af',
            backgroundImage: [
              'linear-gradient(rgba(30,64,175,0.5), rgba(30,64,175,0.65))',
              `url(${import.meta.env.BASE_URL}frame.jpg)`,
            ].join(', '),
          }}
        >
          {Array.from({ length: ROWS * COLS }, (_, i) => {
            const row = Math.floor(i / COLS);
            const col = i % COLS;
            const cell = state.board[row][col];
            const isWinning = winningCells?.has(`${row},${col}`);
            const hintDropRow = hintCol !== null ? getDropRow(state.board, hintCol) : null;
            const isHintCell = hintCol === col && hintDropRow === row;
            return (
              <div
                key={`${row}-${col}`}
                className={`rounded-full bg-slate-800 flex items-center justify-center aspect-square max-w-full ${
                  isWinning ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-blue-800' : ''
                } ${isHintCell ? 'ring-2 ring-emerald-400' : ''}`}
                style={{ minHeight: 0 }}
              >
                {cell && (
                  <span
                    className={`w-[90%] h-[90%] rounded-full bg-cover bg-center ${
                      cell === 'red' ? 'ring-2 ring-red-400' : 'ring-2 ring-yellow-300'
                    } ${isWinning ? 'shadow-[0_0_12px_rgba(251,191,36,0.9)]' : ''}`}
                    style={{
                      backgroundColor: cell === 'red' ? '#ef4444' : '#facc15',
                      backgroundImage: `url(${import.meta.env.BASE_URL}piece-${cell}.jpg)`,
                    }}
                  />
                )}
                {!cell && isHintCell && (
                  <span
                    className="w-[70%] h-[70%] rounded-full opacity-50 bg-cover bg-center"
                    style={{
                      backgroundColor: state.currentTurn === 'red' ? '#ef4444' : '#facc15',
                      backgroundImage: `url(${import.meta.env.BASE_URL}piece-${state.currentTurn}.jpg)`,
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {state.phase === 'over' && (
        <ResultOverlay
          title={resultTitle}
          variant={resultVariant}
          badge={state.winner === 'draw' ? '和局' : undefined}
          stats={[
            {
              label: '模式',
              value: gameMode === 'bot' ? '對戰電腦' : '雙人對戰',
            },
            ...(gameMode === 'bot'
              ? [{ label: '連勝', value: String(winStreak) }]
              : []),
          ]}
          onPrimary={() => {
            handleNewGame();
            prevPhaseRef.current = 'playing';
          }}
        />
      )}

      {showRules && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="connect4-rules-title"
        >
          <div className="bg-slate-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
            <h2 id="connect4-rules-title" className="text-lg font-bold mb-3">規則說明</h2>
            <ul className="text-sm text-slate-200 space-y-2 list-disc pl-4">
              <li>7 列×6 行，輪流選擇一列投入己色棋子，棋子落至該列最低空位。</li>
              <li>先在橫、豎或斜線連成四枚己色者獲勝。</li>
              <li>42 格全部下滿無人連四則和局。</li>
              <li>可悔棋（對戰電腦時一次還原你與電腦的回合）、提示建議落點；對戰電腦連勝會計入本機紀錄。</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="mt-4 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-medium touch-manipulation"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState, useCallback, useEffect, useRef } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playMove, playWin, playLose } from '@clubhouse/shared/synthAudio';
import type { Board, Piece, Difficulty } from './utils/reversiLogic';
import {
  createInitialBoard,
  getLegalMoves,
  applyMove,
  countPieces,
  getWinner,
  getBestMove,
  DIFFICULTY_LABELS,
} from './utils/reversiLogic';
import { RefreshCw, BookOpen, Users, Undo2, Lightbulb } from 'lucide-react';

const SIZE = 8;
const BOT_DELAY_MS = 500;
const STREAK_KEY = 'clubhouse-reversi-win-streak';
const MARGIN_KEY = 'clubhouse-reversi-best-margin';

const DIFFICULTIES: { id: Difficulty; blurb: string }[] = [
  { id: 'easy', blurb: '只看一步，偶爾失誤' },
  { id: 'normal', blurb: '看四步，會搶角' },
  { id: 'hard', blurb: '看六步，殘局全解' },
];

type GamePhase = 'playing' | 'over';
type GameMode = 'two' | 'bot';

interface GameState {
  board: Board;
  currentTurn: Piece;
  phase: GamePhase;
  winner: Piece | 'draw' | null;
  message: string;
}

interface HistoryEntry {
  state: GameState;
  lastMove: [number, number] | null;
}

function readStoredInt(key: string): number {
  const n = Number(localStorage.getItem(key));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function getInitialState(): GameState {
  const board = createInitialBoard();
  const legal = getLegalMoves(board, 'black');
  return {
    board,
    currentTurn: 'black',
    phase: 'playing',
    winner: null,
    message: legal.length > 0 ? '黑方下子' : '黑方無合法手，請按 Pass',
  };
}

function passTurn(state: GameState): GameState {
  const nextTurn: Piece = state.currentTurn === 'black' ? 'white' : 'black';
  const legal = getLegalMoves(state.board, nextTurn);
  if (legal.length > 0) {
    return {
      ...state,
      currentTurn: nextTurn,
      message: nextTurn === 'black' ? '黑方下子' : '白方下子',
    };
  }
  const otherLegal = getLegalMoves(state.board, state.currentTurn);
  if (otherLegal.length === 0) {
    const winner = getWinner(state.board);
    return {
      ...state,
      phase: 'over',
      winner,
      message:
        winner === 'draw'
          ? '和局'
          : winner === 'black'
            ? '黑方勝'
            : '白方勝',
    };
  }
  return passTurn({
    ...state,
    currentTurn: nextTurn,
    message: nextTurn === 'black' ? '黑方無合法手，跳過' : '白方無合法手，跳過',
  });
}

export default function App() {
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [playerSide, setPlayerSide] = useState<Piece>('black');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [state, setState] = useState<GameState>(getInitialState);
  const [showRules, setShowRules] = useState(false);
  const [lastMove, setLastMove] = useState<[number, number] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [hintCell, setHintCell] = useState<[number, number] | null>(null);
  const [winStreak, setWinStreak] = useState(() => readStoredInt(STREAK_KEY));
  const [bestMargin, setBestMargin] = useState(() => readStoredInt(MARGIN_KEY));
  const botScheduled = useRef(false);
  const prevPhaseRef = useRef<GamePhase>('playing');
  const statsRecordedRef = useRef(false);

  const legalMoves = state.phase === 'playing' ? getLegalMoves(state.board, state.currentTurn) : [];
  const legalSet = new Set(legalMoves.map(([r, c]) => `${r},${c}`));
  const { black, white } = countPieces(state.board);
  const isBotTurn =
    gameMode === 'bot' &&
    state.phase === 'playing' &&
    state.currentTurn === (playerSide === 'black' ? 'white' : 'black');

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h, { state, lastMove }]);
  }, [state, lastMove]);

  const applyMoveAndAdvance = useCallback(
    (nextBoard: Board, nextTurn: Piece, nextMessage: string) => {
      const nextLegal = getLegalMoves(nextBoard, nextTurn);
      if (nextLegal.length > 0) {
        setState({
          board: nextBoard,
          currentTurn: nextTurn,
          phase: 'playing',
          winner: null,
          message: nextMessage,
        });
        return;
      }
      const otherTurn: Piece = nextTurn === 'black' ? 'white' : 'black';
      const otherLegal = getLegalMoves(nextBoard, otherTurn);
      if (otherLegal.length === 0) {
        const winner = getWinner(nextBoard);
        setState({
          board: nextBoard,
          currentTurn: nextTurn,
          phase: 'over',
          winner,
          message:
            winner === 'draw' ? '和局' : winner === 'black' ? '黑方勝' : '白方勝',
        });
        return;
      }
      setState({
        board: nextBoard,
        currentTurn: otherTurn,
        phase: 'playing',
        winner: null,
        message:
          nextTurn === 'black'
            ? '黑方無合法手，跳過；白方下子'
            : '白方無合法手，跳過；黑方下子',
      });
    },
    []
  );

  useEffect(() => {
    if (!isBotTurn || botScheduled.current) return;
    botScheduled.current = true;
    const timer = setTimeout(() => {
      const botColor: Piece = playerSide === 'black' ? 'white' : 'black';
      const moves = getLegalMoves(state.board, botColor);
      if (moves.length === 0) {
        setState((s) => passTurn(s));
        botScheduled.current = false;
        return;
      }
      const best = getBestMove(state.board, botColor, difficulty);
      if (!best) {
        setState((s) => passTurn(s));
        botScheduled.current = false;
        return;
      }
      const [r, c] = best;
      const nextBoard = applyMove(state.board, r, c, botColor);
      playMove();
      setLastMove([r, c]);
      const nextTurn: Piece = botColor === 'black' ? 'white' : 'black';
      const nextMessage = nextTurn === 'black' ? '黑方下子' : '白方下子';
      applyMoveAndAdvance(nextBoard, nextTurn, nextMessage);
      botScheduled.current = false;
    }, BOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isBotTurn, state.board, state.currentTurn, playerSide, state.phase, difficulty, applyMoveAndAdvance]);

  useEffect(() => {
    if (state.phase !== 'over' || prevPhaseRef.current === 'over') {
      prevPhaseRef.current = state.phase;
      return;
    }
    if (gameMode === 'bot' && state.winner && state.winner !== 'draw') {
      if (state.winner === playerSide) playWin();
      else playLose();
    }
    // Replay hook: vs-bot endgame margin + win streak.
    if (gameMode === 'bot' && !statsRecordedRef.current) {
      statsRecordedRef.current = true;
      const margin = Math.abs(black - white);
      if (state.winner === playerSide) {
        setWinStreak((s) => {
          const next = s + 1;
          localStorage.setItem(STREAK_KEY, String(next));
          return next;
        });
        setBestMargin((m) => {
          const next = Math.max(m, margin);
          localStorage.setItem(MARGIN_KEY, String(next));
          return next;
        });
      } else {
        setWinStreak(0);
        localStorage.setItem(STREAK_KEY, '0');
      }
    }
    prevPhaseRef.current = state.phase;
  }, [state.phase, state.winner, gameMode, playerSide, black, white]);

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (state.phase !== 'playing' || isBotTurn) return;
      if (gameMode === 'bot' && state.currentTurn !== playerSide) return;
      if (!legalSet.has(`${r},${c}`)) return;
      pushHistory();
      setHintCell(null);
      const nextBoard = applyMove(state.board, r, c, state.currentTurn);
      playMove();
      setLastMove([r, c]);
      const nextTurn: Piece = state.currentTurn === 'black' ? 'white' : 'black';
      const nextMessage =
        gameMode === 'bot'
          ? nextTurn === playerSide
            ? '輪到你下子'
            : '電腦思考中…'
          : nextTurn === 'black'
            ? '黑方下子'
            : '白方下子';
      applyMoveAndAdvance(nextBoard, nextTurn, nextMessage);
    },
    [
      state.phase,
      state.currentTurn,
      state.board,
      isBotTurn,
      gameMode,
      playerSide,
      legalSet,
      applyMoveAndAdvance,
      pushHistory,
    ]
  );

  const handlePass = useCallback(() => {
    if (state.phase !== 'playing' || legalMoves.length > 0) return;
    if (gameMode === 'bot' && state.currentTurn !== playerSide) return;
    pushHistory();
    setHintCell(null);
    setState((s) => passTurn(s));
  }, [state.phase, state.currentTurn, legalMoves.length, gameMode, playerSide, pushHistory]);

  const handleUndo = useCallback(() => {
    if (history.length === 0 || isBotTurn || state.phase === 'over') return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setState(prev.state);
    setLastMove(prev.lastMove);
    setHintCell(null);
    botScheduled.current = false;
  }, [history, isBotTurn, state.phase]);

  const handleHint = useCallback(() => {
    if (state.phase !== 'playing' || isBotTurn) return;
    if (gameMode === 'bot' && state.currentTurn !== playerSide) return;
    if (legalMoves.length === 0) return;
    // Hard tier: zero blunder rate so the hint is a real recommendation.
    const best = getBestMove(state.board, state.currentTurn, 'hard');
    if (best) setHintCell(best);
  }, [state.phase, state.board, state.currentTurn, isBotTurn, gameMode, playerSide, legalMoves.length]);

  const handleNewGame = useCallback(() => {
    setGameMode(null);
    setPlayerSide('black');
    setState(getInitialState());
    setLastMove(null);
    setHistory([]);
    setHintCell(null);
    botScheduled.current = false;
    statsRecordedRef.current = false;
    prevPhaseRef.current = 'playing';
  }, []);

  const startTwoPlayer = useCallback(() => {
    setGameMode('two');
    setState(getInitialState());
    setHistory([]);
    setHintCell(null);
    setLastMove(null);
    statsRecordedRef.current = false;
    prevPhaseRef.current = 'playing';
  }, []);

  const startVsBot = useCallback((side: Piece) => {
    setGameMode('bot');
    setPlayerSide(side);
    setState(getInitialState());
    setHistory([]);
    setHintCell(null);
    setLastMove(null);
    botScheduled.current = false;
    statsRecordedRef.current = false;
    prevPhaseRef.current = 'playing';
  }, []);

  const statsLine = (
    <p className="mt-4 text-stone-400 text-xs">
      連勝 {winStreak} · 最佳勝差 {bestMargin}
    </p>
  );

  if (gameMode === null) {
    return (
      <div className="min-h-screen bg-emerald-950 text-white flex flex-col items-center justify-center p-4 min-w-0">
        <BackToMenu />
        <h1 className="text-2xl font-bold tracking-tight mb-8">黑白棋 Reversi</h1>
        <div className="flex flex-col gap-4 w-full max-w-xs">
          <button
            type="button"
            onClick={startTwoPlayer}
            className="flex items-center justify-center gap-2 w-full py-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 font-medium transition-colors"
          >
            <Users className="w-5 h-5" />
            雙人對戰
          </button>
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-stone-700 hover:bg-stone-600 font-medium transition-colors"
          >
            <BookOpen className="w-5 h-5" />
            規則說明
          </button>
        </div>
        <p className="mt-8 text-stone-400 text-sm">對戰電腦：選擇難度</p>
        <div className="flex gap-2 mt-3 w-full max-w-xs" role="group" aria-label="電腦難度">
          {DIFFICULTIES.map(({ id, blurb }) => {
            const selected = difficulty === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setDifficulty(id)}
                aria-pressed={selected}
                title={blurb}
                className={`flex-1 px-2 py-2.5 rounded-xl border-2 text-sm font-medium transition-colors ${
                  selected
                    ? 'bg-emerald-700 border-emerald-400 text-white'
                    : 'bg-stone-800 border-stone-600 text-stone-300 hover:bg-stone-700'
                }`}
              >
                {DIFFICULTY_LABELS[id]}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-stone-500 text-xs">
          {DIFFICULTIES.find((d) => d.id === difficulty)?.blurb}
        </p>
        <p className="mt-5 text-stone-400 text-sm">選擇執子開始</p>
        <div className="flex gap-4 mt-3">
          <button
            type="button"
            onClick={() => startVsBot('black')}
            className="flex flex-col items-center gap-1 px-6 py-4 rounded-xl bg-stone-800 hover:bg-stone-700 border-2 border-stone-600 transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-stone-900 ring-2 ring-stone-500" />
            <span className="font-medium">執黑</span>
            <span className="text-xs text-stone-400">先手</span>
          </button>
          <button
            type="button"
            onClick={() => startVsBot('white')}
            className="flex flex-col items-center gap-1 px-6 py-4 rounded-xl bg-stone-800 hover:bg-stone-700 border-2 border-stone-600 transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-white ring-2 ring-stone-400" />
            <span className="font-medium">執白</span>
            <span className="text-xs text-stone-400">後手</span>
          </button>
        </div>
        {statsLine}
        {showRules && (
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rules-title"
          >
            <div className="bg-stone-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
              <h2 id="rules-title" className="text-lg font-bold mb-3">規則說明</h2>
              <ul className="text-sm text-stone-200 space-y-2 list-disc pl-4">
                <li>8×8 棋盤，黑方先手。開局中央 2×2 為兩黑兩白（斜線相對）。</li>
                <li>輪到的一方在空格下子，新子須與己方另一子「夾住」至少一條線上的對方子，並將該線上被夾住的對方子全部翻成己色。</li>
                <li>無合法手時須 Pass，改由對方下；若雙方都無合法手則終局。</li>
                <li>終局時己色子數多者勝，相同則和局。</li>
              </ul>
              <button
                type="button"
                onClick={() => setShowRules(false)}
                className="mt-4 w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium"
              >
                關閉
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const statusMessage =
    gameMode === 'bot' && state.phase === 'playing'
      ? isBotTurn
        ? '電腦思考中…'
        : state.currentTurn === playerSide
          ? legalMoves.length > 0
            ? '輪到你下子'
            : '無合法手，請按 Pass'
          : state.message
      : state.message;

  const gameOverMessage =
    gameMode === 'bot' && state.phase === 'over' && state.winner
      ? state.winner === 'draw'
        ? '和局'
        : state.winner === playerSide
          ? '你贏了'
          : '電腦贏了'
      : state.phase === 'over' && state.winner
        ? state.winner === 'draw'
          ? '和局'
          : state.winner === 'black'
            ? '黑方獲勝'
            : '白方獲勝'
        : '';

  const isHumanTurn =
    gameMode === 'two' || (gameMode === 'bot' && state.currentTurn === playerSide);
  const humanCanClick = state.phase === 'playing' && isHumanTurn && !isBotTurn;
  const showLegalHints = humanCanClick;
  const canUndo = history.length > 0 && !isBotTurn && state.phase === 'playing';
  const canHint = humanCanClick && legalMoves.length > 0;

  const resultVariant =
    gameMode === 'bot' && state.winner && state.winner !== 'draw'
      ? state.winner === playerSide
        ? 'win'
        : 'lose'
      : 'neutral';

  const endMargin = Math.abs(black - white);

  return (
    <div className="min-h-screen bg-emerald-950 text-white flex flex-col items-center p-4 min-w-0">
      <BackToMenu />
      <header className="w-full max-w-lg flex justify-between items-center mb-4">
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-xl font-bold tracking-tight">黑白棋 Reversi</h1>
          {gameMode === 'bot' && (
            <span className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-800/60 border border-emerald-600/50 text-xs text-emerald-100">
              電腦・{DIFFICULTY_LABELS[difficulty]}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            title="悔棋"
            aria-label="悔棋"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleHint}
            disabled={!canHint}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            title="提示"
            aria-label="提示"
          >
            <Lightbulb className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="規則"
            aria-label="規則"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleNewGame}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="新對局"
            aria-label="新對局"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex items-center justify-center gap-6 mb-2 text-sm">
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            state.phase === 'playing' && state.currentTurn === 'black'
              ? 'bg-amber-600/30 ring-2 ring-amber-400'
              : 'bg-stone-800/50'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-stone-900 ring-2 ring-stone-600" />
          <span>{gameMode === 'bot' && playerSide === 'black' ? '你' : '黑'} {black}</span>
        </div>
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            state.phase === 'playing' && state.currentTurn === 'white'
              ? 'bg-amber-600/30 ring-2 ring-amber-400'
              : 'bg-stone-800/50'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-white ring-2 ring-stone-400" />
          <span>{gameMode === 'bot' && playerSide === 'white' ? '你' : '白'} {white}</span>
        </div>
        {gameMode === 'bot' && (
          <span className="text-stone-500 text-xs self-center">
            {playerSide === 'black' ? '白＝電腦' : '黑＝電腦'}
          </span>
        )}
      </div>

      {gameMode === 'bot' && (
        <p className="text-stone-500 text-xs mb-2">
          連勝 {winStreak} · 最佳勝差 {bestMargin}
        </p>
      )}

      <p className="text-emerald-200 text-sm mb-4">{statusMessage}</p>
      <p className="text-emerald-200/70 text-xs mb-2 md:hidden">點選合法位置下子</p>

      <div
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
            const cell = state.board[r][c];
            const isLegal = legalSet.has(`${r},${c}`);
            const isLastMove = lastMove !== null && lastMove[0] === r && lastMove[1] === c;
            const isHint = hintCell !== null && hintCell[0] === r && hintCell[1] === c;
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => handleCellClick(r, c)}
                disabled={state.phase !== 'playing' || !humanCanClick || (humanCanClick && !isLegal)}
                className={`
                  w-full aspect-square rounded-md flex items-center justify-center touch-manipulation
                  transition-colors duration-150 active:scale-95
                  ${cell ? 'cursor-default' : ''}
                  ${showLegalHints && isLegal && !cell ? 'bg-emerald-600/40 hover:bg-emerald-500/50' : 'bg-emerald-800/60'}
                  ${showLegalHints && !isLegal && state.phase === 'playing' ? 'hover:bg-emerald-700/70' : ''}
                  ${state.phase !== 'playing' ? 'cursor-default' : ''}
                  ${isLastMove ? 'ring-2 ring-yellow-400/70 ring-inset' : ''}
                  ${isHint ? 'ring-2 ring-sky-300 ring-inset bg-sky-500/40' : ''}
                `}
                aria-label={
                  cell
                    ? `Row ${r + 1} col ${c + 1} ${cell}`
                    : isHint
                      ? `Hint at ${r + 1},${c + 1}`
                      : isLegal
                        ? `Place at ${r + 1},${c + 1}`
                        : `Empty ${r + 1},${c + 1}`
                }
              >
                {cell && (
                  <span
                    className={`w-[85%] h-[85%] rounded-full shadow-inner transition-all duration-150 ${
                      cell === 'black'
                        ? 'bg-stone-900 ring-2 ring-stone-600'
                        : 'bg-white ring-2 ring-stone-400'
                    } ${isLastMove ? 'ring-4 ring-yellow-400/80' : ''}`}
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

      {state.phase === 'playing' && humanCanClick && legalMoves.length === 0 && (
        <button
          type="button"
          onClick={handlePass}
          className="mt-6 px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-medium transition-colors"
        >
          Pass（放棄本回合）
        </button>
      )}

      {state.phase === 'over' && (
        <ResultOverlay
          title={gameOverMessage || '對局結束'}
          variant={resultVariant}
          badge={state.winner === 'draw' ? '和局' : undefined}
          stats={[
            { label: '黑子', value: black },
            { label: '白子', value: white },
            { label: '勝差', value: endMargin },
            ...(gameMode === 'bot'
              ? [
                  { label: '連勝', value: winStreak },
                  { label: '最佳勝差', value: bestMargin },
                ]
              : [
                  {
                    label: '模式',
                    value: '雙人對戰',
                  },
                ]),
          ]}
          onPrimary={() => {
            setState(getInitialState());
            setHistory([]);
            setHintCell(null);
            setLastMove(null);
            botScheduled.current = false;
            statsRecordedRef.current = false;
            prevPhaseRef.current = 'playing';
          }}
        />
      )}

      {showRules && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rules-title"
        >
          <div className="bg-stone-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
            <h2 id="rules-title" className="text-lg font-bold mb-3">規則說明</h2>
            <ul className="text-sm text-stone-200 space-y-2 list-disc pl-4">
              <li>8×8 棋盤，黑方先手。開局中央 2×2 為兩黑兩白（斜線相對）。</li>
              <li>輪到的一方在空格下子，新子須與己方另一子「夾住」至少一條線上的對方子，並將該線上被夾住的對方子全部翻成己色。</li>
              <li>同一手可多方向翻子；至少須翻 1 枚才算合法。</li>
              <li>無合法手時須 Pass，改由對方下；若雙方都無合法手則終局。</li>
              <li>終局時己色子數多者勝，相同則和局。</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="mt-4 w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

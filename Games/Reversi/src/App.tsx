import { useState, useCallback, useEffect, useRef } from 'react';
import type { Board, Piece } from './utils/reversiLogic';
import {
  createInitialBoard,
  getLegalMoves,
  applyMove,
  countPieces,
  getWinner,
  getBestMove,
} from './utils/reversiLogic';
import { RefreshCw, BookOpen, Users } from 'lucide-react';

const SIZE = 8;
const BOT_DELAY_MS = 500;

type GamePhase = 'playing' | 'over';
type GameMode = 'two' | 'bot';

interface GameState {
  board: Board;
  currentTurn: Piece;
  phase: GamePhase;
  winner: Piece | 'draw' | null;
  message: string;
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
  const [state, setState] = useState<GameState>(getInitialState);
  const [showRules, setShowRules] = useState(false);
  const botScheduled = useRef(false);

  const legalMoves = state.phase === 'playing' ? getLegalMoves(state.board, state.currentTurn) : [];
  const legalSet = new Set(legalMoves.map(([r, c]) => `${r},${c}`));
  const { black, white } = countPieces(state.board);
  const isBotTurn =
    gameMode === 'bot' &&
    state.phase === 'playing' &&
    state.currentTurn === (playerSide === 'black' ? 'white' : 'black');

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
      const best = getBestMove(state.board, botColor);
      if (!best) {
        setState((s) => passTurn(s));
        botScheduled.current = false;
        return;
      }
      const [r, c] = best;
      const nextBoard = applyMove(state.board, r, c, botColor);
      const nextTurn: Piece = botColor === 'black' ? 'white' : 'black';
      const nextMessage = nextTurn === 'black' ? '黑方下子' : '白方下子';
      applyMoveAndAdvance(nextBoard, nextTurn, nextMessage);
      botScheduled.current = false;
    }, BOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isBotTurn, state.board, state.currentTurn, playerSide, state.phase, applyMoveAndAdvance]);

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (state.phase !== 'playing' || isBotTurn) return;
      if (gameMode === 'bot' && state.currentTurn !== playerSide) return;
      if (!legalSet.has(`${r},${c}`)) return;
      const nextBoard = applyMove(state.board, r, c, state.currentTurn);
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
    [state.phase, state.currentTurn, state.board, isBotTurn, gameMode, playerSide, legalSet, applyMoveAndAdvance]
  );

  const handlePass = useCallback(() => {
    if (state.phase !== 'playing' || legalMoves.length > 0) return;
    if (gameMode === 'bot' && state.currentTurn !== playerSide) return;
    setState((s) => passTurn(s));
  }, [state.phase, state.currentTurn, legalMoves.length, gameMode, playerSide]);

  const handleNewGame = useCallback(() => {
    setGameMode(null);
    setPlayerSide('black');
    setState(getInitialState());
    botScheduled.current = false;
  }, []);

  const startTwoPlayer = useCallback(() => {
    setGameMode('two');
    setState(getInitialState());
  }, []);

  const startVsBot = useCallback((side: Piece) => {
    setGameMode('bot');
    setPlayerSide(side);
    setState(getInitialState());
    botScheduled.current = false;
  }, []);

  if (gameMode === null) {
    return (
      <div className="min-h-screen bg-emerald-950 text-white flex flex-col items-center justify-center p-4 min-w-0">
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
        <p className="mt-8 text-stone-400 text-sm">對戰電腦：選擇執子</p>
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

  return (
    <div className="min-h-screen bg-emerald-950 text-white flex flex-col items-center p-4 min-w-0">
      <header className="w-full max-w-lg flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold tracking-tight">黑白棋 Reversi</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Rules"
            aria-label="Rules"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleNewGame}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="New game"
            aria-label="New game"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex items-center justify-center gap-6 mb-4 text-sm">
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

      <p className="text-emerald-200 text-sm mb-4">{statusMessage}</p>

      <div
        className="inline-block p-2 rounded-xl bg-emerald-900/80 shadow-lg box-border"
        style={{
          width: 320,
          height: 320,
          minWidth: 280,
          minHeight: 280,
        }}
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
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => handleCellClick(r, c)}
                disabled={state.phase !== 'playing' || !humanCanClick || (humanCanClick && !isLegal)}
                className={`
                  w-full aspect-square rounded-md flex items-center justify-center
                  transition-colors duration-150
                  ${cell ? 'cursor-default' : ''}
                ${showLegalHints && isLegal && !cell ? 'bg-emerald-600/40 hover:bg-emerald-500/50' : 'bg-emerald-800/60'}
                ${showLegalHints && !isLegal && state.phase === 'playing' ? 'hover:bg-emerald-700/70' : ''}
                  ${state.phase !== 'playing' ? 'cursor-default' : ''}
                `}
                aria-label={
                  cell ? `Row ${r + 1} col ${c + 1} ${cell}` : isLegal ? `Place at ${r + 1},${c + 1}` : `Empty ${r + 1},${c + 1}`
                }
              >
                {cell && (
                  <span
                    className={`w-[85%] h-[85%] rounded-full shadow-inner ${
                      cell === 'black'
                        ? 'bg-stone-900 ring-2 ring-stone-600'
                        : 'bg-white ring-2 ring-stone-400'
                    }`}
                  />
                )}
                {!cell && showLegalHints && isLegal && (
                  <span className="w-2 h-2 rounded-full bg-emerald-300/60" aria-hidden />
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
        <div className="mt-6 text-center">
          <p className="text-lg font-medium text-amber-200">{gameOverMessage}</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center mt-3">
            <button
              type="button"
              onClick={() => {
                setState(getInitialState());
                botScheduled.current = false;
              }}
              className="px-6 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium transition-colors"
            >
              再玩一局
            </button>
            <button
              type="button"
              onClick={handleNewGame}
              className="px-6 py-2 rounded-lg bg-stone-600 hover:bg-stone-500 font-medium transition-colors"
            >
              返回主選單
            </button>
          </div>
        </div>
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

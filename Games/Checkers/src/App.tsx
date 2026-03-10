import { useState, useCallback, useEffect, useRef } from 'react';
import type { Board, PieceColor, Move } from './utils/checkersLogic';
import {
  createInitialBoard,
  getLegalMoves,
  getLegalMovesFrom,
  applyMove,
  countPieces,
  getWinner,
  isDarkSquare,
  pickBotMove,
} from './utils/checkersLogic';
import { RefreshCw, BookOpen, Users } from 'lucide-react';

const SIZE = 8;
const BOT_DELAY_MS = 500;

type GamePhase = 'playing' | 'over';
type GameMode = 'two' | 'bot';

interface GameState {
  board: Board;
  currentTurn: PieceColor;
  phase: GamePhase;
  winner: PieceColor | null;
  continuationFrom: [number, number] | null;
}

function getInitialState(): GameState {
  return {
    board: createInitialBoard(),
    currentTurn: 'black',
    phase: 'playing',
    winner: null,
    continuationFrom: null,
  };
}

function getMovesForState(state: GameState): Move[] {
  if (state.continuationFrom) {
    const [r, c] = state.continuationFrom;
    return getLegalMovesFrom(state.board, state.currentTurn, r, c);
  }
  return getLegalMoves(state.board, state.currentTurn);
}

/** Landing squares of current legal moves (for highlighting). */
function getLandingSet(moves: Move[]): Set<string> {
  const set = new Set<string>();
  for (const m of moves) {
    const last = m.path[m.path.length - 1];
    set.add(`${last[0]},${last[1]}`);
  }
  return set;
}

/** Origin squares that have at least one legal move. */
function getOriginSet(moves: Move[]): Set<string> {
  const set = new Set<string>();
  for (const m of moves) set.add(`${m.from[0]},${m.from[1]}`);
  return set;
}

export default function App() {
  const [gameMode, setGameMode] = useState<GameMode>('two');
  const [playerSide, setPlayerSide] = useState<PieceColor>('black');
  const [state, setState] = useState<GameState>(getInitialState);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [showRules, setShowRules] = useState(false);
  const botScheduled = useRef(false);

  const isBotTurn =
    gameMode === 'bot' &&
    state.phase === 'playing' &&
    state.currentTurn === (playerSide === 'black' ? 'white' : 'black');

  const moves = state.phase === 'playing' ? getMovesForState(state) : [];
  const landingSet = getLandingSet(moves);
  const originSet = getOriginSet(moves);
  const movesFromSelected = selected
    ? moves.filter((m) => m.from[0] === selected[0] && m.from[1] === selected[1])
    : [];
  const landingFromSelected = getLandingSet(movesFromSelected);
  const { black, white } = countPieces(state.board);
  const humanCanPlay =
    gameMode === 'two' || (gameMode === 'bot' && state.currentTurn === playerSide);

  useEffect(() => {
    if (!isBotTurn || botScheduled.current) return;
    botScheduled.current = true;
    const timer = setTimeout(() => {
      const botColor: PieceColor = playerSide === 'black' ? 'white' : 'black';
      const move = pickBotMove(state.board, botColor, state.continuationFrom);
      if (!move) {
        botScheduled.current = false;
        return;
      }
      const nextBoard = applyMove(state.board, move);
      const [lastR, lastC] = move.path[move.path.length - 1];
      const moreCaptures = getLegalMovesFrom(nextBoard, botColor, lastR, lastC).filter(
        (m) => m.path.length > 2
      );
      if (moreCaptures.length > 0) {
        setState({
          board: nextBoard,
          currentTurn: botColor,
          phase: 'playing',
          winner: null,
          continuationFrom: [lastR, lastC],
        });
      } else {
        const nextTurn: PieceColor = botColor === 'black' ? 'white' : 'black';
        const winner = getWinner(nextBoard, nextTurn);
        setState({
          board: nextBoard,
          currentTurn: nextTurn,
          phase: winner ? 'over' : 'playing',
          winner,
          continuationFrom: null,
        });
      }
      setSelected(null);
      botScheduled.current = false;
    }, BOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [isBotTurn, state.board, state.currentTurn, state.continuationFrom, playerSide]);

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (state.phase !== 'playing' || !humanCanPlay || isBotTurn) return;
      if (!isDarkSquare(r, c)) return;
      const piece = state.board[r][c];
      const isLanding = landingFromSelected.has(`${r},${c}`);
      if (isLanding && selected) {
        const move = movesFromSelected.find(
          (m) => m.path[m.path.length - 1][0] === r && m.path[m.path.length - 1][1] === c
        );
        if (!move) return;
        const nextBoard = applyMove(state.board, move);
        const [lastR, lastC] = move.path[move.path.length - 1];
        const moreCaptures = getLegalMovesFrom(nextBoard, state.currentTurn, lastR, lastC).filter(
          (m) => m.path.length > 2
        );
        if (moreCaptures.length > 0) {
          setState({
            board: nextBoard,
            currentTurn: state.currentTurn,
            phase: 'playing',
            winner: null,
            continuationFrom: [lastR, lastC],
          });
          setSelected(null);
        } else {
          const nextTurn: PieceColor = state.currentTurn === 'black' ? 'white' : 'black';
          const winner = getWinner(nextBoard, nextTurn);
          setState({
            board: nextBoard,
            currentTurn: nextTurn,
            phase: winner ? 'over' : 'playing',
            winner,
            continuationFrom: null,
          });
          setSelected(null);
        }
        return;
      }
      if (piece && piece.color === state.currentTurn) {
        if (state.continuationFrom && (r !== state.continuationFrom[0] || c !== state.continuationFrom[1]))
          return;
        const hasMoves = originSet.has(`${r},${c}`);
        if (hasMoves) setSelected(selected?.[0] === r && selected?.[1] === c ? null : [r, c]);
        return;
      }
      setSelected(null);
    },
    [
      state.phase,
      state.board,
      state.currentTurn,
      state.continuationFrom,
      selected,
      landingFromSelected,
      movesFromSelected,
      originSet,
    ]
  );

  const handleNewGame = useCallback(() => {
    setState(getInitialState());
    setSelected(null);
    botScheduled.current = false;
  }, []);

  const statusMessage =
    state.phase === 'over'
      ? state.winner === 'black'
        ? '黑方獲勝'
        : '白方獲勝'
      : state.continuationFrom
        ? '請繼續跳吃'
        : gameMode === 'bot'
          ? state.currentTurn === playerSide
            ? '輪到你下子'
            : '電腦思考中…'
          : state.currentTurn === 'black'
            ? '黑方下子'
            : '白方下子';

  return (
    <div className="min-h-screen bg-amber-950 text-white flex flex-col items-center p-4 min-w-0">
      <header className="w-full max-w-lg flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold tracking-tight">西洋跳棋 Checkers</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-stone-900 text-stone-200 border border-stone-600">
            {gameMode === 'bot' ? '對戰電腦' : '雙人對戰'}
          </span>
        </div>
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
          <span className="w-4 h-4 rounded-full bg-stone-800 ring-2 ring-stone-600" />
          <span>黑 {black}</span>
        </div>
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            state.phase === 'playing' && state.currentTurn === 'white'
              ? 'bg-amber-600/30 ring-2 ring-amber-400'
              : 'bg-stone-800/50'
          }`}
        >
          <span className="w-4 h-4 rounded-full bg-amber-100 ring-2 ring-amber-300" />
          <span>白 {white}</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs">
        <button
          type="button"
          onClick={() => {
            setGameMode('two');
            setState(getInitialState());
            setSelected(null);
            botScheduled.current = false;
          }}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full border ${
            gameMode === 'two'
              ? 'border-amber-400 bg-amber-500/20 text-amber-100'
              : 'border-stone-600 bg-stone-900 text-stone-300'
          }`}
        >
          <Users className="w-3 h-3" />
          <span>雙人對戰</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setGameMode('bot');
            setPlayerSide('black');
            setState(getInitialState());
            setSelected(null);
            botScheduled.current = false;
          }}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full border ${
            gameMode === 'bot' && playerSide === 'black'
              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
              : 'border-stone-600 bg-stone-900 text-stone-300'
          }`}
        >
          <span className="w-3 h-3 rounded-full bg-stone-800 ring-2 ring-stone-500" />
          <span>電腦（你執黑）</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setGameMode('bot');
            setPlayerSide('white');
            setState(getInitialState());
            setSelected(null);
            botScheduled.current = false;
          }}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full border ${
            gameMode === 'bot' && playerSide === 'white'
              ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
              : 'border-stone-600 bg-stone-900 text-stone-300'
          }`}
        >
          <span className="w-3 h-3 rounded-full bg-amber-100 ring-2 ring-amber-300" />
          <span>電腦（你執白）</span>
        </button>
      </div>

      <p className="text-amber-200 text-sm mb-4">{statusMessage}</p>

      <div
        className="inline-block p-2 rounded-xl bg-amber-900/80 shadow-lg box-border"
        style={{ width: 320, height: 320, minWidth: 280, minHeight: 280 }}
      >
        <div
          className="grid w-full h-full rounded-lg overflow-hidden"
          style={{
            gridTemplateColumns: `repeat(${SIZE}, 1fr)`,
            gridTemplateRows: `repeat(${SIZE}, 1fr)`,
          }}
        >
          {Array.from({ length: SIZE * SIZE }, (_, i) => {
            const r = Math.floor(i / SIZE);
            const c = i % SIZE;
            const dark = isDarkSquare(r, c);
            const piece = state.board[r][c];
            const isSelected = selected !== null && selected[0] === r && selected[1] === c;
            const isLanding = dark && landingFromSelected.has(`${r},${c}`);
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => handleCellClick(r, c)}
                className={`
                  flex items-center justify-center
                  ${dark ? 'bg-amber-800 hover:bg-amber-700' : 'bg-amber-200'}
                  ${isSelected ? 'ring-2 ring-amber-400 ring-inset' : ''}
                  ${isLanding ? 'bg-amber-500/60 hover:bg-amber-500/80' : ''}
                `}
                style={{ minWidth: 0, minHeight: 0 }}
                aria-label={
                  piece
                    ? `${piece.color} ${piece.king ? 'king' : 'man'} at ${r + 1},${c + 1}`
                    : dark
                      ? `Empty at ${r + 1},${c + 1}`
                      : 'Light square'
                }
              >
                {dark && piece && (
                  <span
                    className={`
                      w-[85%] h-[85%] rounded-full flex items-center justify-center text-xs font-bold
                      ${piece.color === 'black' ? 'bg-stone-800 ring-2 ring-stone-600 text-amber-200' : 'bg-amber-100 ring-2 ring-amber-300 text-stone-800'}
                    `}
                  >
                    {piece.king ? 'K' : ''}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {state.phase === 'over' && (
        <div className="mt-6 text-center">
          <p className="text-lg font-medium text-amber-200">
            {state.winner === 'black' ? '黑方獲勝' : '白方獲勝'}
          </p>
          <button
            type="button"
            onClick={handleNewGame}
            className="mt-3 px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-medium transition-colors"
          >
            再玩一局
          </button>
        </div>
      )}

      {showRules && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkers-rules-title"
        >
          <div className="bg-stone-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
            <h2 id="checkers-rules-title" className="text-lg font-bold mb-3">規則說明（8×8 美式）</h2>
            <ul className="text-sm text-stone-200 space-y-2 list-disc pl-4">
              <li>僅使用深色格；雙方各 12 子，黑方先手。</li>
              <li>兵斜向移動一格至空格；可跳過對方一子至後方空格並吃掉，可連續跳吃且必須跳完。</li>
              <li>兵到達對方底線升為王（K）；王可斜向一格任意方向移動與吃子。</li>
              <li>若可吃子則必須吃；無合法移動的一方輸。</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="mt-4 w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-medium"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

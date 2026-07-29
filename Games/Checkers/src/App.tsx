import { useState, useCallback, useEffect, useRef } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playCapture, playMove, playWin, playLose } from '@clubhouse/shared/synthAudio';
import type { Board, PieceColor, Move, Difficulty } from './utils/checkersLogic';
import {
  createInitialBoard,
  getLegalMoves,
  getLegalMovesFrom,
  applyMove,
  countPieces,
  getWinner,
  isDarkSquare,
  pickBotMove,
  DIFFICULTY_LABELS,
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
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [state, setState] = useState<GameState>(getInitialState);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [showRules, setShowRules] = useState(false);
  const botScheduled = useRef(false);
  const prevPhaseRef = useRef<GamePhase>('playing');

  const isBotTurn =
    gameMode === 'bot' &&
    state.phase === 'playing' &&
    state.currentTurn === (playerSide === 'black' ? 'white' : 'black');

  const moves = state.phase === 'playing' ? getMovesForState(state) : [];
  const originSet = getOriginSet(moves);
  const mustCapture = moves.length > 0 && moves[0].path.length > 2;
  const movesFromSelected = selected
    ? moves.filter((m) => m.from[0] === selected[0] && m.from[1] === selected[1])
    : [];
  // Forced capture: show destinations immediately; after select, narrow to that piece.
  const landingSet =
    selected != null
      ? getLandingSet(movesFromSelected)
      : mustCapture
        ? getLandingSet(moves)
        : new Set<string>();
  const { black, white } = countPieces(state.board);
  const humanCanPlay =
    gameMode === 'two' || (gameMode === 'bot' && state.currentTurn === playerSide);

  const autoSelectKey = state.continuationFrom
    ? `${state.continuationFrom[0]},${state.continuationFrom[1]}`
    : mustCapture && originSet.size === 1
      ? (originSet.values().next().value as string)
      : null;

  // Auto-select the only capturer / the piece mid multi-jump.
  useEffect(() => {
    if (state.phase !== 'playing' || !humanCanPlay || isBotTurn || !autoSelectKey) return;
    const [r, c] = autoSelectKey.split(',').map(Number);
    setSelected((prev) => (prev?.[0] === r && prev?.[1] === c ? prev : [r, c]));
  }, [state.phase, autoSelectKey, humanCanPlay, isBotTurn]);

  useEffect(() => {
    if (!isBotTurn || botScheduled.current) return;
    botScheduled.current = true;
    const timer = setTimeout(() => {
      const botColor: PieceColor = playerSide === 'black' ? 'white' : 'black';
      const move = pickBotMove(state.board, botColor, state.continuationFrom, difficulty);
      if (!move) {
        botScheduled.current = false;
        return;
      }
      const nextBoard = applyMove(state.board, move);
      if (move.path.length > 2) playCapture();
      else playMove();
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
  }, [isBotTurn, state.board, state.currentTurn, state.continuationFrom, playerSide, difficulty]);

  useEffect(() => {
    if (state.phase !== 'over' || prevPhaseRef.current === 'over') {
      prevPhaseRef.current = state.phase;
      return;
    }
    if (gameMode === 'bot' && state.winner) {
      if (state.winner === playerSide) playWin();
      else playLose();
    }
    prevPhaseRef.current = state.phase;
  }, [state.phase, state.winner, gameMode, playerSide]);

  const applyPlayerMove = useCallback(
    (move: Move) => {
      const nextBoard = applyMove(state.board, move);
      if (move.path.length > 2) playCapture();
      else playMove();
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
      }
      setSelected(null);
    },
    [state.board, state.currentTurn]
  );

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (state.phase !== 'playing' || !humanCanPlay || isBotTurn) return;
      if (!isDarkSquare(r, c)) return;
      const piece = state.board[r][c];
      const cellKey = `${r},${c}`;
      const isLanding = landingSet.has(cellKey);
      if (isLanding) {
        const candidates = (selected ? movesFromSelected : moves).filter(
          (m) => m.path[m.path.length - 1][0] === r && m.path[m.path.length - 1][1] === c
        );
        if (candidates.length === 1) {
          applyPlayerMove(candidates[0]);
          return;
        }
        if (candidates.length > 1 && selected) {
          applyPlayerMove(candidates[0]);
          return;
        }
        // Ambiguous landing (multiple pieces can jump here): pick an origin first.
        return;
      }
      if (piece && piece.color === state.currentTurn) {
        if (state.continuationFrom && (r !== state.continuationFrom[0] || c !== state.continuationFrom[1]))
          return;
        const hasMoves = originSet.has(cellKey);
        if (hasMoves) {
          // During forced capture, don't deselect the only capturer by toggling.
          if (mustCapture && selected?.[0] === r && selected?.[1] === c) return;
          setSelected(selected?.[0] === r && selected?.[1] === c ? null : [r, c]);
        }
        return;
      }
      if (!mustCapture) setSelected(null);
    },
    [
      state.phase,
      state.board,
      state.currentTurn,
      state.continuationFrom,
      selected,
      landingSet,
      movesFromSelected,
      moves,
      originSet,
      mustCapture,
      humanCanPlay,
      isBotTurn,
      applyPlayerMove,
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
        ? '請繼續跳吃（亮格為落點）'
        : mustCapture && humanCanPlay && !isBotTurn
          ? '必須吃子 — 亮格為落點'
          : gameMode === 'bot'
            ? state.currentTurn === playerSide
              ? '輪到你下子'
              : '電腦思考中…'
            : state.currentTurn === 'black'
              ? '黑方下子'
              : '白方下子';

  const resultTitle =
    state.phase === 'over' && state.winner
      ? gameMode === 'bot'
        ? state.winner === playerSide
          ? '你贏了！'
          : '電腦獲勝'
        : state.winner === 'black'
          ? '黑方獲勝'
          : '白方獲勝'
      : '';

  const resultVariant =
    gameMode === 'bot' && state.winner
      ? state.winner === playerSide
        ? 'win'
        : 'lose'
      : 'neutral';

  return (
    <div className="min-h-screen bg-amber-950 text-white flex flex-col items-center p-4 min-w-0">
      <BackToMenu />
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

      {gameMode === 'bot' && (
        <div
          className="flex flex-wrap items-center justify-center gap-2 mb-4 text-xs"
          role="group"
          aria-label="電腦難度"
        >
          <span className="text-stone-400">電腦難度</span>
          {(['easy', 'normal', 'hard'] as Difficulty[]).map((id) => {
            const selected = difficulty === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setDifficulty(id);
                  setState(getInitialState());
                  setSelected(null);
                  botScheduled.current = false;
                }}
                aria-pressed={selected}
                className={`px-3 py-1.5 rounded-full border transition-colors ${
                  selected
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                    : 'border-stone-600 bg-stone-900 text-stone-300 hover:bg-stone-800'
                }`}
              >
                {DIFFICULTY_LABELS[id]}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-amber-200 text-sm mb-4">{statusMessage}</p>
      <p className="text-amber-200/70 text-xs mb-2 md:hidden">點選棋子再點目的地移動</p>

      <div
        className="inline-block p-2 rounded-xl bg-amber-900/80 shadow-lg box-border w-full max-w-[min(92vw,360px)] aspect-square"
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
            const cellKey = `${r},${c}`;
            const isSelected = selected !== null && selected[0] === r && selected[1] === c;
            const isLanding = dark && landingSet.has(cellKey);
            const isCapturer = mustCapture && originSet.has(cellKey);
            return (
              <button
                key={`${r}-${c}`}
                type="button"
                onClick={() => handleCellClick(r, c)}
                className={`
                  relative flex items-center justify-center touch-manipulation
                  ${dark ? 'bg-amber-800 hover:bg-amber-700 active:bg-amber-600' : 'bg-amber-200'}
                  ${isSelected ? 'ring-2 ring-amber-400 ring-inset' : ''}
                  ${isLanding ? 'bg-emerald-500/55 hover:bg-emerald-400/70' : ''}
                  ${isCapturer && !isSelected ? 'ring-2 ring-rose-400 ring-inset' : ''}
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
                {isLanding && !piece && (
                  <span
                    className="absolute w-1/3 h-1/3 rounded-full bg-emerald-300/90 pointer-events-none"
                    aria-hidden
                  />
                )}
                {dark && piece && (
                  <span
                    className={`
                      w-[85%] h-[85%] rounded-full flex items-center justify-center text-xs font-bold
                      ${piece.color === 'black' ? 'bg-stone-800 ring-2 ring-stone-600 text-amber-200' : 'bg-amber-100 ring-2 ring-amber-300 text-stone-800'}
                      ${isCapturer ? 'animate-pulse' : ''}
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
        <ResultOverlay
          title={resultTitle}
          variant={resultVariant}
          stats={[
            { label: '黑子', value: black },
            { label: '白子', value: white },
            {
              label: '模式',
              value: gameMode === 'bot' ? '對戰電腦' : '雙人對戰',
            },
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

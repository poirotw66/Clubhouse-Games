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
import { RefreshCw, BookOpen, Users, Bot, ChevronDown, Undo2, Lightbulb } from 'lucide-react';

const SIZE = 8;
const BOT_DELAY_MS = 500;
const COL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const STREAK_KEY = 'clubhouse-checkers-win-streak';
const MARGIN_KEY = 'clubhouse-checkers-best-margin';

type GamePhase = 'playing' | 'over';
type GameMode = 'two' | 'bot';

interface GameState {
  board: Board;
  currentTurn: PieceColor;
  phase: GamePhase;
  winner: PieceColor | null;
  continuationFrom: [number, number] | null;
}

/** Stores the full path of the last completed move for highlighting. */
interface LastMove {
  path: [number, number][];
  captured: number; // how many pieces were taken
}

interface HistoryEntry {
  state: GameState;
  lastMove: LastMove | null;
}

function readStoredInt(key: string): number {
  const n = Number(localStorage.getItem(key));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
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

/** Capture hop when consecutive path squares are two rows apart. */
function isCaptureMove(move: Move): boolean {
  if (move.path.length < 2) return false;
  return Math.abs(move.path[1][0] - move.path[0][0]) === 2;
}

function getMovesForState(state: GameState): Move[] {
  if (state.continuationFrom) {
    const [r, c] = state.continuationFrom;
    return getLegalMovesFrom(state.board, state.currentTurn, r, c);
  }
  return getLegalMoves(state.board, state.currentTurn);
}

function getLandingSet(moves: Move[]): Set<string> {
  const set = new Set<string>();
  for (const m of moves) {
    const last = m.path[m.path.length - 1];
    set.add(`${last[0]},${last[1]}`);
  }
  return set;
}

function getOriginSet(moves: Move[]): Set<string> {
  const set = new Set<string>();
  for (const m of moves) set.add(`${m.from[0]},${m.from[1]}`);
  return set;
}

/** All squares visited by the selected move candidate(s) — for path preview. */
function getPathSet(moves: Move[]): Set<string> {
  const set = new Set<string>();
  for (const m of moves) {
    for (const [r, c] of m.path) set.add(`${r},${c}`);
  }
  return set;
}

// ── Piece component ──────────────────────────────────────────────────────────

interface PieceProps {
  color: PieceColor;
  king: boolean;
  selected: boolean;
  capturer: boolean;
  lastMoveDest: boolean;
}

function Piece({ color, king, selected, capturer, lastMoveDest }: PieceProps) {
  const ring =
    selected
      ? 'ring-4 ring-amber-300 ring-offset-1 ring-offset-transparent'
      : lastMoveDest
        ? 'ring-3 ring-yellow-400/80 ring-offset-1 ring-offset-transparent'
        : capturer
          ? 'ring-3 ring-rose-400 ring-offset-1 ring-offset-transparent'
          : color === 'black'
            ? 'ring-2 ring-stone-500'
            : 'ring-2 ring-amber-400';

  const textColor = color === 'black' ? 'text-amber-200' : 'text-stone-700';

  return (
    <span
      className={`
        w-[80%] h-[80%] rounded-full flex items-center justify-center
        font-bold select-none bg-cover bg-center shadow-inner ${ring} ${textColor}
        ${capturer && !selected ? 'animate-pulse' : ''}
        transition-all duration-150
      `}
      style={{
        fontSize: 'clamp(8px, 2vw, 14px)',
        backgroundColor: color === 'black' ? '#44403c' : '#fef3c7',
        backgroundImage: `url(${import.meta.env.BASE_URL}piece-${color}.jpg)`,
      }}
    >
      {king ? '♔' : ''}
    </span>
  );
}

// ── Captured pieces row ───────────────────────────────────────────────────────

function CapturedRow({ color, count }: { color: PieceColor; count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="w-3 h-3 rounded-full flex-shrink-0 bg-cover bg-center ring-1 ring-black/20"
          style={{
            backgroundColor: color === 'black' ? '#44403c' : '#fef3c7',
            backgroundImage: `url(${import.meta.env.BASE_URL}piece-${color}.jpg)`,
          }}
        />
      ))}
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [gameMode, setGameMode] = useState<GameMode>('two');
  const [playerSide, setPlayerSide] = useState<PieceColor>('black');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [state, setState] = useState<GameState>(getInitialState);
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [hintMove, setHintMove] = useState<Move | null>(null);
  const [winStreak, setWinStreak] = useState(() => readStoredInt(STREAK_KEY));
  const [bestMargin, setBestMargin] = useState(() => readStoredInt(MARGIN_KEY));
  const botScheduled = useRef(false);
  const prevPhaseRef = useRef<GamePhase>('playing');
  const statsRecordedRef = useRef(false);

  // Total pieces each side has captured (= 12 - opponent's remaining)
  const { black, white } = countPieces(state.board);
  const blackCaptured = 12 - white; // black captured white pieces
  const whiteCaptured = 12 - black; // white captured black pieces

  const isBotTurn =
    gameMode === 'bot' &&
    state.phase === 'playing' &&
    state.currentTurn === (playerSide === 'black' ? 'white' : 'black');

  const moves = state.phase === 'playing' ? getMovesForState(state) : [];
  const originSet = getOriginSet(moves);
  const mustCapture = moves.length > 0 && isCaptureMove(moves[0]);
  const movesFromSelected = selected
    ? moves.filter((m) => m.from[0] === selected[0] && m.from[1] === selected[1])
    : [];

  // Landing squares: after select narrow to that piece; for forced capture show all destinations upfront.
  const landingSet =
    selected != null
      ? getLandingSet(movesFromSelected)
      : mustCapture
        ? getLandingSet(moves)
        : new Set<string>();

  // Path preview: all squares visited by the candidate move(s) from the selected piece.
  const pathSet = selected != null ? getPathSet(movesFromSelected) : new Set<string>();

  // Last-move highlight sets
  const lastMovePathSet = lastMove
    ? new Set(lastMove.path.map(([r, c]) => `${r},${c}`))
    : new Set<string>();
  const lastMoveDest = lastMove
    ? `${lastMove.path[lastMove.path.length - 1][0]},${lastMove.path[lastMove.path.length - 1][1]}`
    : null;

  const humanCanPlay =
    gameMode === 'two' || (gameMode === 'bot' && state.currentTurn === playerSide);

  const autoSelectKey = state.continuationFrom
    ? `${state.continuationFrom[0]},${state.continuationFrom[1]}`
    : mustCapture && originSet.size === 1
      ? (originSet.values().next().value as string)
      : null;

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
      if (!move) { botScheduled.current = false; return; }
      const nextBoard = applyMove(state.board, move);
      if (isCaptureMove(move)) playCapture(); else playMove();
      const [lastR, lastC] = move.path[move.path.length - 1];
      const moreCaptures = getLegalMovesFrom(nextBoard, botColor, lastR, lastC).filter(
        (m) => isCaptureMove(m)
      );
      if (moreCaptures.length > 0) {
        setState({ board: nextBoard, currentTurn: botColor, phase: 'playing', winner: null, continuationFrom: [lastR, lastC] });
        // Don't update lastMove during multi-jump continuation; wait for final landing.
      } else {
        const nextTurn: PieceColor = botColor === 'black' ? 'white' : 'black';
        const winner = getWinner(nextBoard, nextTurn);
        setState({ board: nextBoard, currentTurn: nextTurn, phase: winner ? 'over' : 'playing', winner, continuationFrom: null });
        setLastMove({
          path: move.path,
          captured: isCaptureMove(move) ? move.path.length - 1 : 0,
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
      if (state.winner === playerSide) playWin(); else playLose();
    }
    // Replay hook: vs-bot win streak + best piece margin.
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

  const applyPlayerMove = useCallback(
    (move: Move) => {
      // Snapshot only at the start of a turn so one undo rolls back the whole
      // human sequence plus any following bot reply.
      if (!state.continuationFrom) {
        setHistory((h) => [...h, { state, lastMove }]);
      }
      setHintMove(null);
      const nextBoard = applyMove(state.board, move);
      if (isCaptureMove(move)) playCapture(); else playMove();
      const [lastR, lastC] = move.path[move.path.length - 1];
      const moreCaptures = getLegalMovesFrom(nextBoard, state.currentTurn, lastR, lastC).filter(
        (m) => isCaptureMove(m)
      );
      if (moreCaptures.length > 0) {
        setState({ board: nextBoard, currentTurn: state.currentTurn, phase: 'playing', winner: null, continuationFrom: [lastR, lastC] });
        // mid-jump: don't clear lastMove yet
      } else {
        const nextTurn: PieceColor = state.currentTurn === 'black' ? 'white' : 'black';
        const winner = getWinner(nextBoard, nextTurn);
        setState({ board: nextBoard, currentTurn: nextTurn, phase: winner ? 'over' : 'playing', winner, continuationFrom: null });
        setLastMove({
          path: move.path,
          captured: isCaptureMove(move) ? move.path.length - 1 : 0,
        });
      }
      setSelected(null);
    },
    [state, lastMove]
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
        if (candidates.length >= 1 && (candidates.length === 1 || selected)) {
          applyPlayerMove(candidates[0]);
          return;
        }
        return;
      }
      if (piece && piece.color === state.currentTurn) {
        if (state.continuationFrom && (r !== state.continuationFrom[0] || c !== state.continuationFrom[1])) return;
        const hasMoves = originSet.has(cellKey);
        if (hasMoves) {
          if (mustCapture && selected?.[0] === r && selected?.[1] === c) return;
          setHintMove(null);
          setSelected(selected?.[0] === r && selected?.[1] === c ? null : [r, c]);
        }
        return;
      }
      if (!mustCapture) setSelected(null);
    },
    [state.phase, state.board, state.currentTurn, state.continuationFrom, selected,
      landingSet, movesFromSelected, moves, originSet, mustCapture, humanCanPlay, isBotTurn, applyPlayerMove]
  );

  const resetGame = useCallback(() => {
    setState(getInitialState());
    setSelected(null);
    setLastMove(null);
    setHistory([]);
    setHintMove(null);
    botScheduled.current = false;
    statsRecordedRef.current = false;
    prevPhaseRef.current = 'playing';
  }, []);

  const canUndo = history.length > 0 && !isBotTurn && state.phase === 'playing';
  const canHint =
    state.phase === 'playing' &&
    humanCanPlay &&
    !isBotTurn &&
    moves.length > 0;

  const handleUndo = useCallback(() => {
    // ponytail: no undo after game over — streak already written.
    if (!canUndo) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setState(prev.state);
    setLastMove(prev.lastMove);
    setSelected(null);
    setHintMove(null);
    botScheduled.current = false;
  }, [canUndo, history]);

  const handleHint = useCallback(() => {
    if (!canHint) return;
    // Hard tier: zero blunder rate so the hint is a real recommendation.
    const best = pickBotMove(state.board, state.currentTurn, state.continuationFrom, 'hard');
    if (best) setHintMove(best);
  }, [canHint, state.board, state.currentTurn, state.continuationFrom]);

  const hintPathSet = hintMove
    ? new Set(hintMove.path.map(([r, c]) => `${r},${c}`))
    : new Set<string>();
  const hintDest = hintMove
    ? `${hintMove.path[hintMove.path.length - 1][0]},${hintMove.path[hintMove.path.length - 1][1]}`
    : null;

  // ── Status banner ──────────────────────────────────────────────────────────

  const isMyTurn = humanCanPlay && !isBotTurn && state.phase === 'playing';
  const bannerBg =
    state.phase === 'over'
      ? 'bg-stone-700/60 border-stone-600/30'
      : isBotTurn
        ? 'bg-sky-900/50 border-sky-600/40'
        : mustCapture
          ? 'bg-rose-900/50 border-rose-500/40'
          : state.continuationFrom
            ? 'bg-amber-900/60 border-amber-500/40'
            : 'bg-stone-800/60 border-stone-600/30';

  const bannerText =
    state.phase === 'over'
      ? state.winner === 'black' ? '⚫ 黑方獲勝' : '⚪ 白方獲勝'
      : state.continuationFrom
        ? '🔁 繼續跳吃'
        : mustCapture && isMyTurn
          ? '⚠️ 必須吃子'
          : isBotTurn
            ? '🤖 電腦思考中…'
            : gameMode === 'bot'
              ? state.currentTurn === playerSide
                ? '👆 輪到你下子'
                : ''
              : state.currentTurn === 'black'
                ? '⚫ 黑方下子'
                : '⚪ 白方下子';

  const resultTitle =
    state.phase === 'over' && state.winner
      ? gameMode === 'bot'
        ? state.winner === playerSide ? '你贏了！' : '電腦獲勝'
        : state.winner === 'black' ? '黑方獲勝' : '白方獲勝'
      : '';

  const resultVariant =
    gameMode === 'bot' && state.winner
      ? state.winner === playerSide ? 'win' : 'lose'
      : 'neutral';

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen text-white flex flex-col items-center p-3 pb-6 min-w-0 bg-cover bg-center"
      style={{
        backgroundColor: '#451a03',
        backgroundImage: [
          'linear-gradient(rgba(69,26,3,0.78), rgba(41,15,2,0.9))',
          `url(${import.meta.env.BASE_URL}table-bg.jpg)`,
        ].join(', '),
      }}
    >
      <BackToMenu />

      {/* ── Header ── */}
      <header className="w-full max-w-[420px] flex justify-between items-center mb-3 mt-1">
        <h1 className="text-lg font-bold tracking-tight">西洋跳棋</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            title="悔棋"
            aria-label="悔棋"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleHint}
            disabled={!canHint}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40 disabled:hover:bg-transparent"
            title="提示"
            aria-label="提示"
          >
            <Lightbulb className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="規則說明"
          >
            <BookOpen className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={resetGame}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="新遊戲"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Score bar with captured pieces ── */}
      <div className="w-full max-w-[420px] flex items-stretch justify-between gap-2 mb-3 px-1">
        {/* Black side */}
        <div className={`flex-1 flex flex-col gap-1 px-3 py-2 rounded-xl border transition-all duration-200 ${
          state.phase === 'playing' && state.currentTurn === 'black'
            ? 'bg-stone-700/60 border-amber-400/60 shadow-md'
            : 'bg-stone-900/40 border-stone-700/40'
        }`}>
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-stone-600 to-stone-900 ring-2 ring-stone-500 shadow-inner flex-shrink-0" />
            <span className="text-sm font-semibold">黑</span>
            <span className="text-lg font-bold tabular-nums leading-none ml-auto">{black}</span>
          </div>
          {/* Captured white pieces */}
          {blackCaptured > 0 && (
            <div className="mt-0.5">
              <CapturedRow color="white" count={blackCaptured} />
            </div>
          )}
        </div>

        {/* Turn indicator */}
        <div className="flex flex-col items-center justify-center gap-1 px-1">
          <div className={`w-2 h-2 rounded-full transition-all duration-300 ${
            state.phase === 'playing'
              ? state.currentTurn === 'black'
                ? 'bg-stone-300 shadow-[0_0_6px_2px_rgba(255,255,255,0.3)]'
                : 'bg-amber-200 shadow-[0_0_6px_2px_rgba(251,191,36,0.4)]'
              : 'bg-stone-600'
          }`} />
        </div>

        {/* White side */}
        <div className={`flex-1 flex flex-col gap-1 px-3 py-2 rounded-xl border transition-all duration-200 ${
          state.phase === 'playing' && state.currentTurn === 'white'
            ? 'bg-amber-900/40 border-amber-400/60 shadow-md'
            : 'bg-stone-900/40 border-stone-700/40'
        }`}>
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tabular-nums leading-none">{white}</span>
            <span className="text-sm font-semibold ml-auto">白</span>
            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-50 to-amber-200 ring-2 ring-amber-400 shadow-inner flex-shrink-0" />
          </div>
          {/* Captured black pieces */}
          {whiteCaptured > 0 && (
            <div className="mt-0.5 flex justify-end">
              <CapturedRow color="black" count={whiteCaptured} />
            </div>
          )}
        </div>
      </div>

      {gameMode === 'bot' && (
        <p className="w-full max-w-[420px] text-stone-500 text-xs mb-2 px-1">
          連勝 {winStreak} · 最佳勝差 {bestMargin}
        </p>
      )}

      {/* ── Status banner ── */}
      {bannerText && (
        <div className={`w-full max-w-[420px] mb-3 py-2 px-4 rounded-xl border text-sm font-medium text-center transition-all duration-200 ${bannerBg}`}>
          {bannerText}
        </div>
      )}

      {/* ── Board with coordinates ── */}
      <div className="w-full max-w-[420px]">
        {/* Column labels */}
        <div
          className="grid mb-0.5 pl-5 pr-1"
          style={{ gridTemplateColumns: `repeat(${SIZE}, 1fr)` }}
        >
          {COL_LABELS.map((l) => (
            <span key={l} className="text-center text-[9px] text-amber-500/60 font-mono select-none">
              {l}
            </span>
          ))}
        </div>

        <div className="flex">
          {/* Row labels */}
          <div className="flex flex-col justify-around pr-1 w-4 flex-shrink-0">
            {Array.from({ length: SIZE }, (_, r) => (
              <span key={r} className="text-[9px] text-amber-500/60 font-mono select-none text-right leading-none">
                {SIZE - r}
              </span>
            ))}
          </div>

          {/* Board */}
          <div
            className="flex-1 rounded-xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-amber-900/60"
            style={{ aspectRatio: '1' }}
          >
            <div
              className="grid w-full h-full"
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
                const isPath = dark && !isLanding && !isSelected && pathSet.has(cellKey);
                const isLastMovePath = !isSelected && !isLanding && lastMovePathSet.has(cellKey);
                const isPieceDest = lastMoveDest === cellKey;
                const isHintPath = hintPathSet.has(cellKey);
                const isHintDest = hintDest === cellKey;

                // Cell background priority: selected > landing > hint > path > last-move > default
                const tint = isSelected
                  ? 'linear-gradient(rgba(217,119,6,0.7), rgba(217,119,6,0.75))'
                  : isLanding
                    ? 'linear-gradient(rgba(4,120,87,0.7), rgba(5,150,105,0.75))'
                    : isHintDest
                      ? 'linear-gradient(rgba(2,132,199,0.55), rgba(14,165,233,0.6))'
                      : isHintPath
                        ? 'linear-gradient(rgba(7,89,133,0.45), rgba(7,89,133,0.5))'
                        : isPath
                          ? 'linear-gradient(rgba(180,83,9,0.5), rgba(180,83,9,0.55))'
                          : isLastMovePath
                            ? 'linear-gradient(rgba(133,77,14,0.4), rgba(133,77,14,0.45))'
                            : dark
                              ? 'linear-gradient(rgba(146,64,14,0.35), rgba(120,53,15,0.45))'
                              : 'linear-gradient(rgba(255,251,235,0.85), rgba(254,243,199,0.9))';

                return (
                  <button
                    key={cellKey}
                    type="button"
                    onClick={() => handleCellClick(r, c)}
                    className="relative flex items-center justify-center touch-manipulation transition-colors duration-100 bg-cover bg-center"
                    style={{
                      minWidth: 0,
                      minHeight: 0,
                      backgroundColor: dark ? '#92400e' : '#fef3c7',
                      backgroundImage: dark
                        ? [tint, `url(${import.meta.env.BASE_URL}square-dark.jpg)`].join(', ')
                        : [tint, `url(${import.meta.env.BASE_URL}square-light.jpg)`].join(', '),
                    }}
                    aria-label={
                      piece
                        ? `${piece.color} ${piece.king ? 'king' : 'man'} at ${COL_LABELS[c]}${SIZE - r}`
                        : dark ? `Empty ${COL_LABELS[c]}${SIZE - r}` : 'Light square'
                    }
                  >
                    {/* Landing dot (empty target square) */}
                    {isLanding && !piece && (
                      <span
                        className="absolute w-[35%] h-[35%] rounded-full bg-emerald-300/80 pointer-events-none"
                        aria-hidden
                      />
                    )}
                    {/* Path waypoint dot (intermediate squares) */}
                    {isPath && !piece && (
                      <span
                        className="absolute w-[20%] h-[20%] rounded-full bg-amber-300/60 pointer-events-none"
                        aria-hidden
                      />
                    )}
                    {/* Piece */}
                    {dark && piece && (
                      <Piece
                        color={piece.color}
                        king={piece.king}
                        selected={isSelected}
                        capturer={isCapturer && !isSelected}
                        lastMoveDest={isPieceDest && !isSelected}
                      />
                    )}
                    {/* Hint destination ring */}
                    {isHintDest && !isSelected && (
                      <span className="absolute inset-0 ring-2 ring-sky-300 ring-inset pointer-events-none rounded-[1px]" aria-hidden />
                    )}
                    {/* Selected ring overlay */}
                    {isSelected && (
                      <span className="absolute inset-0 ring-2 ring-amber-300 ring-inset pointer-events-none rounded-[1px]" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Settings accordion ── */}
      <div className="w-full max-w-[420px] mt-4">
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-stone-800/60 border border-stone-700/40 text-sm text-stone-300 hover:bg-stone-800/80 transition-colors"
        >
          <span className="flex items-center gap-2">
            {gameMode === 'bot' ? <Bot className="w-4 h-4" /> : <Users className="w-4 h-4" />}
            {gameMode === 'bot'
              ? `對戰電腦 · ${playerSide === 'black' ? '執黑' : '執白'} · ${DIFFICULTY_LABELS[difficulty]}`
              : '雙人對戰'}
          </span>
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`} />
        </button>

        {settingsOpen && (
          <div className="mt-1 p-4 rounded-xl bg-stone-900/70 border border-stone-700/30 space-y-3 text-xs">
            <div>
              <p className="text-stone-400 mb-1.5">對戰模式</p>
              <div className="flex gap-2">
                {(['two', 'bot'] as GameMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => { setGameMode(mode); resetGame(); setSettingsOpen(false); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors ${
                      gameMode === mode
                        ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                        : 'border-stone-600 bg-stone-900 text-stone-300 hover:bg-stone-800'
                    }`}
                  >
                    {mode === 'two' ? <Users className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                    {mode === 'two' ? '雙人對戰' : '對戰電腦'}
                  </button>
                ))}
              </div>
            </div>

            {gameMode === 'bot' && (
              <div>
                <p className="text-stone-400 mb-1.5">執子顏色</p>
                <div className="flex gap-2">
                  {(['black', 'white'] as PieceColor[]).map((side) => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => { setPlayerSide(side); resetGame(); setSettingsOpen(false); }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors ${
                        playerSide === side
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                          : 'border-stone-600 bg-stone-900 text-stone-300 hover:bg-stone-800'
                      }`}
                    >
                      <span className={`w-3 h-3 rounded-full ring-1 ${side === 'black' ? 'bg-stone-800 ring-stone-500' : 'bg-amber-100 ring-amber-400'}`} />
                      {side === 'black' ? '執黑' : '執白'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {gameMode === 'bot' && (
              <div>
                <p className="text-stone-400 mb-1.5">電腦難度</p>
                <div className="flex gap-2">
                  {(['easy', 'normal', 'hard'] as Difficulty[]).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => { setDifficulty(id); resetGame(); setSettingsOpen(false); }}
                      className={`px-3 py-1.5 rounded-full border transition-colors ${
                        difficulty === id
                          ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                          : 'border-stone-600 bg-stone-900 text-stone-300 hover:bg-stone-800'
                      }`}
                    >
                      {DIFFICULTY_LABELS[id]}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-stone-500">
                  連勝 {winStreak} · 最佳勝差 {bestMargin}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Result overlay ── */}
      {state.phase === 'over' && (
        <ResultOverlay
          title={resultTitle}
          variant={resultVariant}
          stats={[
            { label: '黑子剩餘', value: black },
            { label: '白子剩餘', value: white },
            { label: '黑方吃子', value: blackCaptured },
            { label: '白方吃子', value: whiteCaptured },
            ...(gameMode === 'bot'
              ? [
                  { label: '連勝', value: winStreak },
                  { label: '最佳勝差', value: bestMargin },
                ]
              : []),
          ]}
          onPrimary={() => { resetGame(); }}
        />
      )}

      {/* ── Rules modal ── */}
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
              <li>兵到達對方底線升為王（♔）；王可斜向一格任意方向移動與吃子。</li>
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

import { useState, useCallback, useEffect, useRef } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import {
  playCapture,
  playMove,
  playWin,
  playLose,
  playScore,
} from '@clubhouse/shared/synthAudio';
import type { Board, BotStyle, PieceColor, Move, RulesetId } from './utils/checkersLogic';
import {
  createInitialBoard,
  getLegalMoves,
  getLegalMovesFrom,
  applyMove,
  countPieces,
  getWinner,
  isDarkSquare,
  pickBotMove,
  isCaptureMove,
  captureHopCount,
  RULESETS,
  RULESET_IDS,
  colLabels,
} from './utils/checkersLogic';
import { getHint } from './utils/hints';
import {
  PUZZLES,
  puzzleBoard,
  isPuzzleUnlocked,
  ratePuzzleStars,
  formatStars,
  sideToMoveLabel,
  type PuzzleDef,
} from './utils/puzzles';
import {
  OPPONENTS,
  getOpponent,
  isOpponentUnlocked,
  type OpponentId,
} from './utils/opponents';
import {
  createMatch,
  applyGameResult,
  MATCH_LENGTHS,
  MATCH_LENGTH_LABELS,
  type MatchLength,
  type MatchState,
} from './utils/match';
import {
  buildReview,
  REVIEW_TAG_LABELS,
  type PlayedPly,
  type ReviewEntry,
} from './utils/review';
import {
  loadProgress,
  saveProgress,
  recordBotWin,
  recordBotLoss,
  recordPuzzleClear,
  recordSeriesWin,
  type CheckersProgress,
  type PuzzleStar,
} from './utils/storage';
/** Puzzle defense: deep, no blunders — forced-win lines stay honest. */
const PUZZLE_BOT_STYLE: BotStyle = {
  captureGreed: 0.45,
  crownHunger: 0.4,
  caution: 1,
  centerBias: 0.5,
  blunderOverride: 0,
  depthOverride: 6,
};
import {
  RefreshCw,
  BookOpen,
  Users,
  Bot,
  ChevronDown,
  Undo2,
  Lightbulb,
  Puzzle,
  Trophy,
} from 'lucide-react';

const BOT_DELAY_MS = 480;
const ANIM_MS = 260;

type GamePhase = 'playing' | 'over';
type GameMode = 'two' | 'bot' | 'puzzle' | 'series';

interface GameState {
  board: Board;
  currentTurn: PieceColor;
  phase: GamePhase;
  winner: PieceColor | null;
  continuationFrom: [number, number] | null;
}

interface LastMove {
  path: [number, number][];
  captured: number;
}

interface HistoryEntry {
  state: GameState;
  lastMove: LastMove | null;
  plies: PlayedPly[];
  puzzleMoves: number;
}

function getInitialState(ruleset: RulesetId): GameState {
  return {
    board: createInitialBoard(ruleset),
    currentTurn: 'black',
    phase: 'playing',
    winner: null,
    continuationFrom: null,
  };
}

function getMovesForState(state: GameState, ruleset: RulesetId): Move[] {
  if (state.continuationFrom) {
    const [r, c] = state.continuationFrom;
    return getLegalMovesFrom(state.board, state.currentTurn, r, c, ruleset);
  }
  return getLegalMoves(state.board, state.currentTurn, ruleset);
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

function getPathSet(moves: Move[]): Set<string> {
  const set = new Set<string>();
  for (const m of moves) {
    for (const [r, c] of m.path) set.add(`${r},${c}`);
  }
  return set;
}

function sq(r: number, c: number): string {
  return `${r},${c}`;
}

// ── Piece ────────────────────────────────────────────────────────────────────

interface PieceProps {
  color: PieceColor;
  king: boolean;
  selected: boolean;
  capturer: boolean;
  lastMoveDest: boolean;
  hopping: boolean;
}

function Piece({ color, king, selected, capturer, lastMoveDest, hopping }: PieceProps) {
  const ring = selected
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
        ${hopping ? 'checkers-piece-hop' : 'checkers-piece-enter'}
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
  const initialProgress = loadProgress();
  const [progress, setProgress] = useState<CheckersProgress>(initialProgress);
  const [ruleset, setRuleset] = useState<RulesetId>(initialProgress.lastRuleset);
  const [gameMode, setGameMode] = useState<GameMode>('bot');
  const [playerSide, setPlayerSide] = useState<PieceColor>('black');
  const [opponentId, setOpponentId] = useState<OpponentId>('rookie');
  const [puzzleId, setPuzzleId] = useState(PUZZLES[0].id);
  const [matchTarget, setMatchTarget] = useState<MatchLength>(
    initialProgress.lastMatchTarget,
  );
  const [match, setMatch] = useState<MatchState>(() => createMatch(matchTarget));
  const [state, setState] = useState<GameState>(() => getInitialState(ruleset));
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lastMove, setLastMove] = useState<LastMove | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [hintMove, setHintMove] = useState<Move | null>(null);
  const [hintReason, setHintReason] = useState<string | null>(null);
  const [plies, setPlies] = useState<PlayedPly[]>([]);
  const [review, setReview] = useState<ReviewEntry[] | null>(null);
  const [showReview, setShowReview] = useState(false);
  const [captureFx, setCaptureFx] = useState<Set<string>>(new Set());
  const [hopDest, setHopDest] = useState<string | null>(null);
  const [puzzleMoves, setPuzzleMoves] = useState(0);
  const [puzzleHintsUsed, setPuzzleHintsUsed] = useState(0);
  const [puzzleUndosUsed, setPuzzleUndosUsed] = useState(0);
  const [earnedStars, setEarnedStars] = useState<PuzzleStar | null>(null);
  const botScheduled = useRef(false);
  const prevPhaseRef = useRef<GamePhase>('playing');
  const statsRecordedRef = useRef(false);
  const animLock = useRef(false);

  const rules = RULESETS[ruleset];
  const size = rules.size;
  const labels = colLabels(size);
  const piecesPerSide = rules.piecesPerSide;
  const activePuzzle: PuzzleDef =
    PUZZLES.find((p) => p.id === puzzleId) ?? PUZZLES[0];
  const opponent = getOpponent(opponentId);
  const beatenSet = new Set(progress.beatenOpponents);

  const { black, white } = countPieces(state.board);
  const blackCaptured = piecesPerSide - white;
  const whiteCaptured = piecesPerSide - black;

  const isBotTurn =
    state.phase === 'playing' &&
    state.currentTurn !== playerSide &&
    (gameMode === 'bot' || gameMode === 'series' || gameMode === 'puzzle');

  const moves = state.phase === 'playing' ? getMovesForState(state, ruleset) : [];
  const originSet = getOriginSet(moves);
  const mustCapture = moves.length > 0 && isCaptureMove(moves[0]);
  const movesFromSelected = selected
    ? moves.filter((m) => m.from[0] === selected[0] && m.from[1] === selected[1])
    : [];

  const landingSet =
    selected != null
      ? getLandingSet(movesFromSelected)
      : mustCapture
        ? getLandingSet(moves)
        : new Set<string>();

  const pathSet = selected != null ? getPathSet(movesFromSelected) : new Set<string>();

  const lastMovePathSet = lastMove
    ? new Set(lastMove.path.map(([r, c]) => sq(r, c)))
    : new Set<string>();
  const lastMoveDest = lastMove
    ? sq(
        lastMove.path[lastMove.path.length - 1][0],
        lastMove.path[lastMove.path.length - 1][1],
      )
    : null;

  const humanCanPlay =
    gameMode === 'two' ||
    ((gameMode === 'bot' || gameMode === 'series' || gameMode === 'puzzle') &&
      state.currentTurn === playerSide);

  const autoSelectKey = state.continuationFrom
    ? sq(state.continuationFrom[0], state.continuationFrom[1])
    : mustCapture && originSet.size === 1
      ? (originSet.values().next().value as string)
      : null;

  const playMoveJuice = useCallback((move: Move) => {
    const hops = captureHopCount(move);
    if (hops > 0) {
      playCapture();
      if (hops >= 2) playScore();
      const fx = new Set<string>();
      for (let i = 1; i < move.path.length; i++) {
        const [pr, pc] = move.path[i - 1];
        const [r, c] = move.path[i];
        const midR = (pr + r) >> 1;
        const midC = (pc + c) >> 1;
        // For flying kings mid isn't halfway — flash both ends of hop.
        if (Math.abs(r - pr) === 2) fx.add(sq(midR, midC));
        else fx.add(sq(r, c));
      }
      setCaptureFx(fx);
      window.setTimeout(() => setCaptureFx(new Set()), 420);
    } else {
      playMove();
    }
    const [lr, lc] = move.path[move.path.length - 1];
    setHopDest(sq(lr, lc));
    window.setTimeout(() => setHopDest(null), ANIM_MS);
  }, []);

  useEffect(() => {
    if (state.phase !== 'playing' || !humanCanPlay || isBotTurn || !autoSelectKey) return;
    const [r, c] = autoSelectKey.split(',').map(Number);
    setSelected((prev) => (prev?.[0] === r && prev?.[1] === c ? prev : [r, c]));
  }, [state.phase, autoSelectKey, humanCanPlay, isBotTurn]);

  useEffect(() => {
    if (!isBotTurn || botScheduled.current || animLock.current) return;
    botScheduled.current = true;
    const timer = setTimeout(() => {
      const botColor: PieceColor = playerSide === 'black' ? 'white' : 'black';
      const move = pickBotMove(
        state.board,
        botColor,
        state.continuationFrom,
        gameMode === 'puzzle' ? 'hard' : opponent.difficulty,
        ruleset,
        gameMode === 'puzzle' ? PUZZLE_BOT_STYLE : opponent.style,
      );
      if (!move) {
        botScheduled.current = false;
        return;
      }
      const boardBefore = state.board;
      playMoveJuice(move);
      const nextBoard = applyMove(state.board, move, ruleset);
      const [lastR, lastC] = move.path[move.path.length - 1];
      const moreCaptures = getLegalMovesFrom(nextBoard, botColor, lastR, lastC, ruleset).filter(
        (m) => isCaptureMove(m),
      );
      setPlies((p) => [...p, { color: botColor, move, boardBefore }]);
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
        const winner = getWinner(nextBoard, nextTurn, ruleset);
        setState({
          board: nextBoard,
          currentTurn: nextTurn,
          phase: winner ? 'over' : 'playing',
          winner,
          continuationFrom: null,
        });
        setLastMove({
          path: move.path,
          captured: isCaptureMove(move) ? captureHopCount(move) : 0,
        });
      }
      setSelected(null);
      botScheduled.current = false;
    }, BOT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [
    isBotTurn,
    state.board,
    state.currentTurn,
    state.continuationFrom,
    playerSide,
    opponent,
    ruleset,
    playMoveJuice,
    gameMode,
  ]);

  useEffect(() => {
    if (state.phase !== 'over' || prevPhaseRef.current === 'over') {
      prevPhaseRef.current = state.phase;
      return;
    }
    const built = buildReview(plies, ruleset);
    setReview(built);

    if (gameMode === 'puzzle' && state.winner === activePuzzle.sideToMove) {
      if (puzzleMoves <= activePuzzle.winIn) {
        const stars = ratePuzzleStars(puzzleHintsUsed, puzzleUndosUsed);
        setEarnedStars(stars);
        playWin();
        setProgress((p) => recordPuzzleClear(p, activePuzzle.id, stars));
      } else {
        setEarnedStars(null);
        playLose();
      }
    } else if (gameMode === 'puzzle') {
      setEarnedStars(null);
      playLose();
    } else if (
      (gameMode === 'bot' || gameMode === 'series') &&
      state.winner
    ) {
      if (state.winner === playerSide) playWin();
      else playLose();
    } else if (gameMode === 'two' && state.winner) {
      playScore();
    }

    if (!statsRecordedRef.current) {
      statsRecordedRef.current = true;
      const margin = Math.abs(black - white);
      if (gameMode === 'bot' && state.winner) {
        if (state.winner === playerSide) {
          setProgress((p) => recordBotWin(p, margin, opponentId));
        } else {
          setProgress((p) => recordBotLoss(p));
        }
      }
      if (gameMode === 'series' && state.winner) {
        const side: 'a' | 'b' = state.winner === playerSide ? 'a' : 'b';
        setMatch((m) => {
          const next = applyGameResult(m, side);
          if (next.matchOver && next.matchWinner === 'a') {
            setProgress((p) => recordSeriesWin(p));
          }
          return next;
        });
        if (state.winner === playerSide) {
          setProgress((p) => recordBotWin(p, margin, opponentId));
        } else {
          setProgress((p) => recordBotLoss(p));
        }
      }
    }
    prevPhaseRef.current = state.phase;
  }, [
    state.phase,
    state.winner,
    gameMode,
    playerSide,
    black,
    white,
    plies,
    ruleset,
    opponentId,
    activePuzzle,
    puzzleMoves,
    puzzleHintsUsed,
    puzzleUndosUsed,
  ]);

  const applyPlayerMove = useCallback(
    (move: Move) => {
      if (!state.continuationFrom) {
        setHistory((h) => [...h, { state, lastMove, plies, puzzleMoves }]);
      }
      setHintMove(null);
      setHintReason(null);
      const boardBefore = state.board;
      playMoveJuice(move);
      const nextBoard = applyMove(state.board, move, ruleset);
      const [lastR, lastC] = move.path[move.path.length - 1];
      const moreCaptures = getLegalMovesFrom(
        nextBoard,
        state.currentTurn,
        lastR,
        lastC,
        ruleset,
      ).filter((m) => isCaptureMove(m));
      setPlies((p) => [...p, { color: state.currentTurn, move, boardBefore }]);
      if (gameMode === 'puzzle' && state.currentTurn === playerSide && !state.continuationFrom) {
        setPuzzleMoves((n) => n + 1);
      }
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
        const winner = getWinner(nextBoard, nextTurn, ruleset);
        setState({
          board: nextBoard,
          currentTurn: nextTurn,
          phase: winner ? 'over' : 'playing',
          winner,
          continuationFrom: null,
        });
        setLastMove({
          path: move.path,
          captured: isCaptureMove(move) ? captureHopCount(move) : 0,
        });
      }
      setSelected(null);
    },
    [state, lastMove, plies, puzzleMoves, ruleset, playMoveJuice, gameMode, playerSide],
  );

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (state.phase !== 'playing' || !humanCanPlay || isBotTurn) return;
      if (!isDarkSquare(r, c)) return;
      const piece = state.board[r][c];
      const cellKey = sq(r, c);
      const isLanding = landingSet.has(cellKey);
      if (isLanding) {
        const candidates = (selected ? movesFromSelected : moves).filter(
          (m) => m.path[m.path.length - 1][0] === r && m.path[m.path.length - 1][1] === c,
        );
        if (candidates.length >= 1 && (candidates.length === 1 || selected)) {
          applyPlayerMove(candidates[0]);
          return;
        }
        return;
      }
      if (piece && piece.color === state.currentTurn) {
        if (
          state.continuationFrom &&
          (r !== state.continuationFrom[0] || c !== state.continuationFrom[1])
        ) {
          return;
        }
        const hasMoves = originSet.has(cellKey);
        if (hasMoves) {
          if (mustCapture && selected?.[0] === r && selected?.[1] === c) return;
          setHintMove(null);
          setHintReason(null);
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
    ],
  );

  const startPuzzle = useCallback((puzzle: PuzzleDef) => {
    setRuleset(puzzle.ruleset);
    setPuzzleId(puzzle.id);
    setGameMode('puzzle');
    setState({
      board: puzzleBoard(puzzle),
      currentTurn: puzzle.sideToMove,
      phase: 'playing',
      winner: null,
      continuationFrom: null,
    });
    setSelected(null);
    setLastMove(null);
    setHistory([]);
    setHintMove(null);
    setHintReason(null);
    setPlies([]);
    setReview(null);
    setShowReview(false);
    setPuzzleMoves(0);
    setPuzzleHintsUsed(0);
    setPuzzleUndosUsed(0);
    setEarnedStars(null);
    botScheduled.current = false;
    statsRecordedRef.current = false;
    prevPhaseRef.current = 'playing';
    setPlayerSide(puzzle.sideToMove);
  }, []);

  const resetGame = useCallback(() => {
    if (gameMode === 'puzzle') {
      startPuzzle(activePuzzle);
      return;
    }
    setState(getInitialState(ruleset));
    setSelected(null);
    setLastMove(null);
    setHistory([]);
    setHintMove(null);
    setHintReason(null);
    setPlies([]);
    setReview(null);
    setShowReview(false);
    setPuzzleMoves(0);
    setPuzzleHintsUsed(0);
    setPuzzleUndosUsed(0);
    setEarnedStars(null);
    botScheduled.current = false;
    statsRecordedRef.current = false;
    prevPhaseRef.current = 'playing';
  }, [gameMode, ruleset, activePuzzle, startPuzzle]);

  const changeRuleset = useCallback(
    (id: RulesetId) => {
      setRuleset(id);
      const next = { ...progress, lastRuleset: id };
      saveProgress(next);
      setProgress(next);
      setState(getInitialState(id));
      setSelected(null);
      setLastMove(null);
      setHistory([]);
      setHintMove(null);
      setHintReason(null);
      setPlies([]);
      setReview(null);
      setPuzzleMoves(0);
      setPuzzleHintsUsed(0);
      setPuzzleUndosUsed(0);
      setEarnedStars(null);
      botScheduled.current = false;
      statsRecordedRef.current = false;
      prevPhaseRef.current = 'playing';
      if (gameMode === 'puzzle') setGameMode('bot');
    },
    [progress, gameMode],
  );

  const canUndo = history.length > 0 && !isBotTurn && state.phase === 'playing';
  const canHint =
    state.phase === 'playing' && humanCanPlay && !isBotTurn && moves.length > 0;

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setState(prev.state);
    setLastMove(prev.lastMove);
    setPlies(prev.plies);
    setPuzzleMoves(prev.puzzleMoves);
    if (gameMode === 'puzzle') setPuzzleUndosUsed((n) => n + 1);
    setSelected(null);
    setHintMove(null);
    setHintReason(null);
    botScheduled.current = false;
  }, [canUndo, history, gameMode]);

  const handleHint = useCallback(() => {
    if (!canHint) return;
    const hint = getHint(state.board, state.currentTurn, state.continuationFrom, ruleset);
    if (hint) {
      setHintMove(hint.move);
      setHintReason(hint.reason);
      if (gameMode === 'puzzle') setPuzzleHintsUsed((n) => n + 1);
    }
  }, [canHint, state.board, state.currentTurn, state.continuationFrom, ruleset, gameMode]);

  const hintPathSet = hintMove
    ? new Set(hintMove.path.map(([r, c]) => sq(r, c)))
    : new Set<string>();
  const hintDest = hintMove
    ? sq(
        hintMove.path[hintMove.path.length - 1][0],
        hintMove.path[hintMove.path.length - 1][1],
      )
    : null;

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
      ? state.winner === 'black'
        ? '⚫ 黑方獲勝'
        : '⚪ 白方獲勝'
      : state.continuationFrom
        ? '🔁 繼續跳吃'
        : mustCapture && isMyTurn
          ? '⚠️ 必須吃子'
          : isBotTurn
            ? gameMode === 'puzzle'
              ? '🤖 對手應著中…'
              : `🤖 ${opponent.name} 思考中…`
            : gameMode === 'puzzle'
              ? `🧩 ${activePuzzle.name}・${puzzleMoves}/${activePuzzle.winIn} 步`
              : gameMode === 'bot' || gameMode === 'series'
                ? state.currentTurn === playerSide
                  ? '👆 輪到你下子'
                  : ''
                : state.currentTurn === 'black'
                  ? '⚫ 黑方下子'
                  : '⚪ 白方下子';

  const puzzleSuccess =
    gameMode === 'puzzle' &&
    state.winner === activePuzzle.sideToMove &&
    puzzleMoves <= activePuzzle.winIn;

  const resultTitle =
    state.phase === 'over' && state.winner
      ? gameMode === 'puzzle'
        ? puzzleSuccess
          ? earnedStars
            ? `謎題破解！${formatStars(earnedStars)}`
            : '謎題破解！'
          : state.winner === activePuzzle.sideToMove
            ? '超過步數'
            : '挑戰失敗'
        : gameMode === 'bot' || gameMode === 'series'
          ? state.winner === playerSide
            ? '你贏了！'
            : `${opponent.name} 獲勝`
          : state.winner === 'black'
            ? '黑方獲勝'
            : '白方獲勝'
      : '';

  const resultVariant =
    state.phase === 'over' && state.winner
      ? gameMode === 'puzzle'
        ? puzzleSuccess
          ? 'win'
          : 'lose'
        : gameMode === 'bot' || gameMode === 'series'
          ? state.winner === playerSide
            ? 'win'
            : 'lose'
          : 'neutral'
      : 'neutral';

  const modeLabel =
    gameMode === 'two'
      ? '雙人對戰'
      : gameMode === 'puzzle'
        ? `謎題・${activePuzzle.name}`
        : gameMode === 'series'
          ? `系列賽 ${match.scoreA}–${match.scoreB}`
          : `對戰・${opponent.name}`;

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

      <header className="w-full max-w-[480px] flex justify-between items-center mb-3 mt-1">
        <div>
          <h1 className="text-lg font-bold tracking-tight">西洋跳棋</h1>
          <p className="text-[11px] text-amber-200/70">{rules.label} · {modeLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          <TouchButton
            label={<Undo2 className="w-4 h-4" />}
            ariaLabel="悔棋"
            title="悔棋"
            disabled={!canUndo}
            onClick={handleUndo}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center justify-center bg-transparent text-inherit border-0"
          />
          <TouchButton
            label={<Lightbulb className="w-4 h-4" />}
            ariaLabel="提示"
            title="提示"
            disabled={!canHint}
            onClick={handleHint}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center justify-center bg-transparent text-inherit border-0"
          />
          <TouchButton
            label={<BookOpen className="w-4 h-4" />}
            ariaLabel="規則說明"
            onClick={() => setShowRules(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center justify-center bg-transparent text-inherit border-0"
          />
          <TouchButton
            label={<RefreshCw className="w-4 h-4" />}
            ariaLabel="新遊戲"
            onClick={resetGame}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center justify-center bg-transparent text-inherit border-0"
          />
        </div>
      </header>

      {/* Ruleset */}
      <div className="w-full max-w-[480px] flex gap-2 mb-2" role="group" aria-label="規則變體">
        {RULESET_IDS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => changeRuleset(id)}
            aria-pressed={ruleset === id}
            className={`flex-1 px-3 py-2 min-h-[44px] rounded-xl border text-xs touch-manipulation transition-colors ${
              ruleset === id
                ? 'border-amber-400 bg-amber-600/30 text-amber-50'
                : 'border-stone-600 bg-stone-900/50 text-stone-300'
            }`}
          >
            <span className="font-semibold block">{RULESETS[id].label}</span>
            <span className="text-stone-400">{RULESETS[id].blurb}</span>
          </button>
        ))}
      </div>

      {/* Score */}
      <div className="w-full max-w-[480px] flex items-stretch justify-between gap-2 mb-2 px-1">
        <div
          className={`flex-1 flex flex-col gap-1 px-3 py-2 rounded-xl border transition-all duration-200 ${
            state.phase === 'playing' && state.currentTurn === 'black'
              ? 'bg-stone-700/60 border-amber-400/60 shadow-md'
              : 'bg-stone-900/40 border-stone-700/40'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-stone-600 to-stone-900 ring-2 ring-stone-500 shadow-inner flex-shrink-0" />
            <span className="text-sm font-semibold">黑</span>
            <span className="text-lg font-bold tabular-nums leading-none ml-auto">{black}</span>
          </div>
          {blackCaptured > 0 && (
            <div className="mt-0.5">
              <CapturedRow color="white" count={blackCaptured} />
            </div>
          )}
        </div>
        <div className="flex flex-col items-center justify-center gap-1 px-1">
          <div
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              state.phase === 'playing'
                ? state.currentTurn === 'black'
                  ? 'bg-stone-300 shadow-[0_0_6px_2px_rgba(255,255,255,0.3)]'
                  : 'bg-amber-200 shadow-[0_0_6px_2px_rgba(251,191,36,0.4)]'
                : 'bg-stone-600'
            }`}
          />
        </div>
        <div
          className={`flex-1 flex flex-col gap-1 px-3 py-2 rounded-xl border transition-all duration-200 ${
            state.phase === 'playing' && state.currentTurn === 'white'
              ? 'bg-amber-900/40 border-amber-400/60 shadow-md'
              : 'bg-stone-900/40 border-stone-700/40'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tabular-nums leading-none">{white}</span>
            <span className="text-sm font-semibold ml-auto">白</span>
            <span className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-50 to-amber-200 ring-2 ring-amber-400 shadow-inner flex-shrink-0" />
          </div>
          {whiteCaptured > 0 && (
            <div className="mt-0.5 flex justify-end">
              <CapturedRow color="black" count={whiteCaptured} />
            </div>
          )}
        </div>
      </div>

      {(gameMode === 'bot' || gameMode === 'series') && (
        <p className="w-full max-w-[480px] text-stone-500 text-xs mb-1 px-1">
          連勝 {progress.winStreak} · 最佳 {progress.bestStreak} · 勝差 {progress.bestMargin}
          {gameMode === 'series' &&
            ` · 系列 ${match.scoreA}:${match.scoreB}（先達 ${match.target}）`}
        </p>
      )}

      {gameMode === 'puzzle' && (
        <p className="w-full max-w-[480px] text-stone-400 text-xs mb-1 px-1">
          {sideToMoveLabel(activePuzzle.sideToMove)} · {activePuzzle.blurb} · 已解{' '}
          {progress.puzzlesCleared.length}/{PUZZLES.length}
          {progress.puzzleStars[activePuzzle.id]
            ? ` · 最佳 ${formatStars(progress.puzzleStars[activePuzzle.id])}`
            : ''}
        </p>
      )}

      {hintReason && (
        <div className="w-full max-w-[480px] mb-2 py-2 px-3 rounded-xl border border-sky-500/40 bg-sky-950/50 text-sm text-sky-100">
          💡 {hintReason}
        </div>
      )}

      {bannerText && (
        <div
          className={`w-full max-w-[480px] mb-2 py-2 px-4 rounded-xl border text-sm font-medium text-center transition-all duration-200 ${bannerBg}`}
        >
          {bannerText}
        </div>
      )}

      {/* Board */}
      <div className="w-full max-w-[480px]">
        <div
          className="grid mb-0.5 pl-5 pr-1"
          style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
        >
          {labels.map((l) => (
            <span
              key={l}
              className="text-center text-[9px] text-amber-500/60 font-mono select-none"
            >
              {l}
            </span>
          ))}
        </div>
        <div className="flex">
          <div className="flex flex-col justify-around pr-1 w-4 flex-shrink-0">
            {Array.from({ length: size }, (_, r) => (
              <span
                key={r}
                className="text-[9px] text-amber-500/60 font-mono select-none text-right leading-none"
              >
                {size - r}
              </span>
            ))}
          </div>
          <div
            className="flex-1 rounded-xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.5)] border border-amber-900/60"
            style={{ aspectRatio: '1' }}
          >
            <div
              className="grid w-full h-full"
              style={{
                gridTemplateColumns: `repeat(${size}, 1fr)`,
                gridTemplateRows: `repeat(${size}, 1fr)`,
              }}
            >
              {Array.from({ length: size * size }, (_, i) => {
                const r = Math.floor(i / size);
                const c = i % size;
                const dark = isDarkSquare(r, c);
                const piece = state.board[r][c];
                const cellKey = sq(r, c);
                const isSelected = selected !== null && selected[0] === r && selected[1] === c;
                const isLanding = dark && landingSet.has(cellKey);
                const isCapturer = mustCapture && originSet.has(cellKey);
                const isPath = dark && !isLanding && !isSelected && pathSet.has(cellKey);
                const isLastMovePath = !isSelected && !isLanding && lastMovePathSet.has(cellKey);
                const isPieceDest = lastMoveDest === cellKey;
                const isHintPath = hintPathSet.has(cellKey);
                const isHintDest = hintDest === cellKey;
                const showFx = captureFx.has(cellKey);

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
                        ? `${piece.color} ${piece.king ? 'king' : 'man'} at ${labels[c]}${size - r}`
                        : dark
                          ? `Empty ${labels[c]}${size - r}`
                          : 'Light square'
                    }
                  >
                    {isLanding && !piece && (
                      <span
                        className="absolute w-[35%] h-[35%] rounded-full bg-emerald-300/80 pointer-events-none"
                        aria-hidden
                      />
                    )}
                    {isPath && !piece && (
                      <span
                        className="absolute w-[20%] h-[20%] rounded-full bg-amber-300/60 pointer-events-none"
                        aria-hidden
                      />
                    )}
                    {showFx && <span className="checkers-capture-fx" aria-hidden />}
                    {dark && piece && (
                      <Piece
                        color={piece.color}
                        king={piece.king}
                        selected={isSelected}
                        capturer={isCapturer && !isSelected}
                        lastMoveDest={isPieceDest && !isSelected}
                        hopping={hopDest === cellKey}
                      />
                    )}
                    {isHintDest && !isSelected && (
                      <span
                        className="absolute inset-0 ring-2 ring-sky-300 ring-inset pointer-events-none rounded-[1px]"
                        aria-hidden
                      />
                    )}
                    {isSelected && (
                      <span
                        className="absolute inset-0 ring-2 ring-amber-300 ring-inset pointer-events-none rounded-[1px]"
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Settings */}
      <div className="w-full max-w-[480px] mt-4">
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-stone-800/60 border border-stone-700/40 text-sm text-stone-300 hover:bg-stone-800/80 transition-colors"
        >
          <span className="flex items-center gap-2">
            {gameMode === 'two' ? (
              <Users className="w-4 h-4" />
            ) : gameMode === 'puzzle' ? (
              <Puzzle className="w-4 h-4" />
            ) : gameMode === 'series' ? (
              <Trophy className="w-4 h-4" />
            ) : (
              <Bot className="w-4 h-4" />
            )}
            {modeLabel}
          </span>
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${settingsOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {settingsOpen && (
          <div className="mt-1 p-4 rounded-xl bg-stone-900/70 border border-stone-700/30 space-y-3 text-xs">
            <div>
              <p className="text-stone-400 mb-1.5">對戰模式</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ['two', '雙人', Users],
                    ['bot', '電腦', Bot],
                    ['series', '系列賽', Trophy],
                    ['puzzle', '謎題', Puzzle],
                  ] as const
                ).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      if (mode === 'puzzle') {
                        const nextIdx = PUZZLES.findIndex(
                          (pz, i) =>
                            isPuzzleUnlocked(i, progress.puzzlesCleared) &&
                            !progress.puzzlesCleared.includes(pz.id),
                        );
                        const fallbackIdx = PUZZLES.findIndex((_, i) =>
                          isPuzzleUnlocked(i, progress.puzzlesCleared),
                        );
                        const pick =
                          PUZZLES[nextIdx >= 0 ? nextIdx : Math.max(0, fallbackIdx)] ??
                          PUZZLES[0];
                        startPuzzle(pick);
                        // Keep the panel open so the unlock list stays visible.
                        setSettingsOpen(true);
                        return;
                      }
                      setGameMode(mode);
                      if (mode === 'series') {
                        const m = createMatch(matchTarget);
                        setMatch(m);
                      }
                      setState(getInitialState(ruleset));
                      setPlies([]);
                      setReview(null);
                      setHistory([]);
                      setLastMove(null);
                      setSelected(null);
                      statsRecordedRef.current = false;
                      prevPhaseRef.current = 'playing';
                      setSettingsOpen(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-full border transition-colors touch-manipulation ${
                      gameMode === mode
                        ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                        : 'border-stone-600 bg-stone-900 text-stone-300 hover:bg-stone-800'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {(gameMode === 'bot' || gameMode === 'series') && (
              <>
                <div>
                  <p className="text-stone-400 mb-1.5">執子顏色</p>
                  <div className="flex gap-2">
                    {(['black', 'white'] as PieceColor[]).map((side) => (
                      <button
                        key={side}
                        type="button"
                        onClick={() => {
                          setPlayerSide(side);
                          resetGame();
                          setSettingsOpen(false);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] rounded-full border transition-colors touch-manipulation ${
                          playerSide === side
                            ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                            : 'border-stone-600 bg-stone-900 text-stone-300'
                        }`}
                      >
                        {side === 'black' ? '執黑' : '執白'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-stone-400 mb-1.5">對手名冊（打贏解鎖下一位）</p>
                  <div className="flex flex-col gap-1.5">
                    {OPPONENTS.map((opp) => {
                      const unlocked = isOpponentUnlocked(opp.id, beatenSet);
                      const selectedOpp = opponentId === opp.id;
                      const beaten = beatenSet.has(opp.id);
                      return (
                        <button
                          key={opp.id}
                          type="button"
                          disabled={!unlocked}
                          onClick={() => {
                            setOpponentId(opp.id);
                            resetGame();
                            setSettingsOpen(false);
                          }}
                          className={`text-left px-3 py-2 min-h-[44px] rounded-lg border touch-manipulation ${
                            selectedOpp
                              ? 'border-emerald-400 bg-emerald-500/20'
                              : unlocked
                                ? 'border-stone-600 bg-stone-900'
                                : 'border-stone-800 bg-stone-950 opacity-50'
                          }`}
                        >
                          <span className="font-semibold">
                            {unlocked ? opp.name : '🔒 ???'}
                            {beaten ? ' ✓' : ''}
                          </span>
                          {unlocked && (
                            <span className="block text-stone-400">
                              {opp.tagline} ·「{opp.catchphrase.intro}」
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {gameMode === 'series' && (
              <div>
                <p className="text-stone-400 mb-1.5">系列賽長度</p>
                <div className="flex gap-2">
                  {MATCH_LENGTHS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setMatchTarget(t);
                        const nextProg = { ...progress, lastMatchTarget: t };
                        saveProgress(nextProg);
                        setProgress(nextProg);
                        setMatch(createMatch(t));
                        resetGame();
                      }}
                      className={`px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation ${
                        matchTarget === t
                          ? 'border-emerald-400 bg-emerald-500/20'
                          : 'border-stone-600 bg-stone-900'
                      }`}
                    >
                      {MATCH_LENGTH_LABELS[t]}
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-stone-500">系列賽勝場 {progress.seriesWins}</p>
              </div>
            )}

            {gameMode === 'puzzle' && (
              <div>
                <p className="text-stone-400 mb-1.5">殘局謎題（{PUZZLES.length} 題・逐題解鎖）</p>
                <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                  {PUZZLES.map((pz, idx) => {
                    const unlocked = isPuzzleUnlocked(idx, progress.puzzlesCleared);
                    const stars = progress.puzzleStars[pz.id] ?? 0;
                    return (
                      <button
                        key={pz.id}
                        type="button"
                        disabled={!unlocked}
                        onClick={() => {
                          if (!unlocked) return;
                          startPuzzle(pz);
                          setSettingsOpen(false);
                        }}
                        className={`text-left px-3 py-2 min-h-[44px] rounded-lg border touch-manipulation ${
                          !unlocked
                            ? 'border-stone-700 bg-stone-950 text-stone-500 opacity-70'
                            : puzzleId === pz.id
                              ? 'border-sky-400 bg-sky-500/20'
                              : 'border-stone-600 bg-stone-900'
                        }`}
                      >
                        <span className="font-semibold">
                          {unlocked ? `${idx + 1}. ${pz.name}` : `${idx + 1}. 🔒 ???`}
                          {stars > 0 ? ` ${formatStars(stars)}` : ''}
                        </span>
                        {unlocked && (
                          <span className="block text-stone-400">
                            {RULESETS[pz.ruleset].label} · {sideToMoveLabel(pz.sideToMove)} ·{' '}
                            {pz.winIn} 步內必勝 · {pz.blurb}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Result */}
      {state.phase === 'over' && !showReview && (
        <ResultOverlay
          title={resultTitle}
          subtitle={
            gameMode === 'series' && match.matchOver
              ? match.matchWinner === 'a'
                ? '系列賽獲勝！'
                : '系列賽落敗'
              : gameMode === 'bot' || gameMode === 'series'
                ? state.winner === playerSide
                  ? opponent.catchphrase.lose
                  : opponent.catchphrase.win
                : undefined
          }
          variant={resultVariant}
          stats={[
            { label: '黑子剩餘', value: black },
            { label: '白子剩餘', value: white },
            ...(gameMode === 'puzzle'
              ? [
                  { label: '使用步數', value: puzzleMoves },
                  { label: '目標步數', value: activePuzzle.winIn },
                  {
                    label: '星級',
                    value: earnedStars
                      ? formatStars(earnedStars)
                      : progress.puzzleStars[activePuzzle.id]
                        ? formatStars(progress.puzzleStars[activePuzzle.id])
                        : '—',
                  },
                ]
              : [
                  { label: '黑方吃子', value: blackCaptured },
                  { label: '白方吃子', value: whiteCaptured },
                ]),
            ...(gameMode === 'series'
              ? [{ label: '系列比分', value: `${match.scoreA} : ${match.scoreB}` }]
              : []),
            ...(gameMode === 'bot' || gameMode === 'series'
              ? [
                  { label: '連勝', value: progress.winStreak },
                  { label: '最佳連勝', value: progress.bestStreak },
                ]
              : []),
          ]}
          primaryLabel={
            gameMode === 'series' && !match.matchOver ? '下一局' : '再玩一局'
          }
          onPrimary={() => {
            if (gameMode === 'series' && match.matchOver) {
              setMatch(createMatch(matchTarget));
            }
            resetGame();
          }}
          secondaryLabel="覆盤"
          onSecondary={() => setShowReview(true)}
        />
      )}

      {showReview && review && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="對局覆盤"
        >
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-5">
            <h2 className="text-lg font-bold mb-3">對局覆盤</h2>
            {review.length === 0 ? (
              <p className="text-stone-400 text-sm">本局沒有可註解的著法。</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {review.map((entry) => (
                  <li
                    key={entry.ply}
                    className="flex gap-2 rounded-lg bg-slate-800/80 px-3 py-2 border border-white/5"
                  >
                    <span className="text-stone-500 tabular-nums w-6">{entry.ply}.</span>
                    <span className="text-stone-300 w-8">
                      {entry.color === 'black' ? '黑' : '白'}
                    </span>
                    <span
                      className={`font-semibold w-10 ${
                        entry.tag === 'best' || entry.tag === 'good'
                          ? 'text-emerald-300'
                          : entry.tag === 'miss' || entry.tag === 'blunder'
                            ? 'text-rose-300'
                            : 'text-stone-300'
                      }`}
                    >
                      {REVIEW_TAG_LABELS[entry.tag]}
                    </span>
                    <span className="text-stone-200 flex-1">{entry.note}</span>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              onClick={() => {
                setShowReview(false);
                resetGame();
              }}
              className="mt-4 w-full min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 font-semibold"
            >
              再玩一局
            </button>
            <button
              type="button"
              onClick={() => setShowReview(false)}
              className="mt-2 w-full min-h-[44px] rounded-xl bg-slate-700 font-semibold"
            >
              關閉覆盤
            </button>
          </div>
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
            <h2 id="checkers-rules-title" className="text-lg font-bold mb-3">
              規則說明（{rules.label}）
            </h2>
            <ul className="text-sm text-stone-200 space-y-2 list-disc pl-4">
              <li>
                僅使用深色格；雙方各 {piecesPerSide} 子，黑方先手（謎題依題目）。
              </li>
              <li>兵斜向移動一格；可跳吃，可連續跳且必須跳完。</li>
              {ruleset === 'american' ? (
                <>
                  <li>兵僅向前跳吃；王斜向一格任意方向（短王）。</li>
                  <li>若可吃子則必須吃。</li>
                </>
              ) : (
                <>
                  <li>兵可向前或向後跳吃；王為飛王，可沿斜線任意格數移動與遠距跳吃。</li>
                  <li>多種吃法時必須選擇吃子數最多的序列。</li>
                </>
              )}
              <li>無合法移動或無子的一方輸。</li>
              <li>模式：雙人／電腦名冊／系列賽／殘局謎題；提示會說明建議理由。</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="mt-4 w-full py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-medium min-h-[44px]"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

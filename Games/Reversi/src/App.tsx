import { useState, useCallback, useEffect, useRef } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import { playFlip, playLose, playMove, playWin } from '@clubhouse/shared/synthAudio';
import { RefreshCw, BookOpen, Undo2, Lightbulb } from 'lucide-react';
import { BoardGrid } from './components/BoardGrid';
import { MenuScreen, type MenuView } from './components/MenuScreen';
import type { Board, Piece, Difficulty } from './utils/reversiLogic';
import {
  createInitialBoard,
  getLegalMoves,
  applyMove,
  getFlips,
  countPieces,
  getWinner,
  getBestMove,
  DIFFICULTY_LABELS,
  DIFFICULTY_BLURBS,
} from './utils/reversiLogic';
import {
  createSeries,
  applySeriesResult,
  seriesLabel,
  seriesScoreLine,
  type SeriesLength,
  type SeriesMatch,
} from './utils/match';
import { opponentByIndex } from './utils/opponents';
import {
  loadLadder,
  saveLadder,
  applyLadderWin,
  applyLadderLoss,
  applyPuzzleSolve,
  formatStars,
  isPuzzleUnlocked,
  ratePuzzleAttempt,
  type LadderProgress,
  type PuzzleStars,
} from './utils/ladder';
import { PUZZLES, getPuzzle, describePuzzleObjective, type PuzzleRuntime } from './utils/puzzles';
import { isOptimalMove, bestExactReply, solveExact } from './utils/solver';
import { teachingHint } from './utils/teach';
import { appendReviewMove, buildGameReview, type PlacedMove, type GameReview } from './utils/review';
import {
  STREAK_KEY,
  BEST_STREAK_KEY,
  MARGIN_KEY,
  loadSeriesLength,
  readStoredInt,
  saveSeriesLength,
  writeStoredInt,
} from './utils/storage';

const BOT_DELAY_MS = 480;
const FLIP_MS = 380;
const DIFFICULTIES: Difficulty[] = ['easy', 'normal', 'hard'];

type GamePhase = 'playing' | 'over';
type PlayMode = 'two' | 'bot' | 'ladder' | 'puzzle';

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
  reviewLog: PlacedMove[];
  puzzlePlies: number;
}

function getInitialState(board: Board = createInitialBoard(), turn: Piece = 'black'): GameState {
  const legal = getLegalMoves(board, turn);
  const sideLabel = turn === 'black' ? '黑方' : '白方';
  return {
    board,
    currentTurn: turn,
    phase: 'playing',
    winner: null,
    message: legal.length > 0 ? `${sideLabel}下子` : `${sideLabel}無合法手，請按 Pass`,
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
      message: winner === 'draw' ? '和局' : winner === 'black' ? '黑方勝' : '白方勝',
    };
  }
  return passTurn({
    ...state,
    currentTurn: nextTurn,
    message: nextTurn === 'black' ? '黑方無合法手，跳過' : '白方無合法手，跳過',
  });
}

const shellStyle = {
  backgroundColor: '#022c22',
  backgroundImage: [
    'linear-gradient(rgba(2,44,34,0.78), rgba(2,26,18,0.88))',
    `url(${import.meta.env.BASE_URL}table-bg.jpg)`,
  ].join(', '),
};

export default function App() {
  const [menuView, setMenuView] = useState<MenuView>('home');
  const [playMode, setPlayMode] = useState<PlayMode | null>(null);
  const [playerSide, setPlayerSide] = useState<Piece>('black');
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [seriesLength, setSeriesLength] = useState<SeriesLength>(() => loadSeriesLength());
  const setSeriesLengthAndRemember = (n: SeriesLength) => {
    setSeriesLength(n);
    saveSeriesLength(n);
  };
  const [series, setSeries] = useState<SeriesMatch | null>(null);
  const [ladderIndex, setLadderIndex] = useState(0);
  const [ladder, setLadder] = useState<LadderProgress>(() => loadLadder());
  const [puzzle, setPuzzle] = useState<PuzzleRuntime | null>(null);
  const [puzzlePlies, setPuzzlePlies] = useState(0);
  const [puzzleFailed, setPuzzleFailed] = useState(false);
  const [puzzleSolved, setPuzzleSolved] = useState(false);
  const [puzzleUsedHint, setPuzzleUsedHint] = useState(false);
  const [puzzleUsedUndo, setPuzzleUsedUndo] = useState(false);
  const [lastPuzzleStars, setLastPuzzleStars] = useState<PuzzleStars | null>(null);

  const [state, setState] = useState<GameState>(getInitialState);
  const [showRules, setShowRules] = useState(false);
  const [lastMove, setLastMove] = useState<[number, number] | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [hintCell, setHintCell] = useState<[number, number] | null>(null);
  const [flipCells, setFlipCells] = useState<Set<string>>(new Set());
  const [reviewLog, setReviewLog] = useState<PlacedMove[]>([]);
  const [review, setReview] = useState<GameReview | null>(null);

  const [winStreak, setWinStreak] = useState(() => readStoredInt(STREAK_KEY));
  const [bestStreak, setBestStreak] = useState(() => readStoredInt(BEST_STREAK_KEY));
  const [bestMargin, setBestMargin] = useState(() => readStoredInt(MARGIN_KEY));

  const botScheduled = useRef(false);
  const prevPhaseRef = useRef<GamePhase>('playing');
  const statsRecordedRef = useRef(false);
  const flipTimer = useRef<number | null>(null);

  const activeOpponent =
    playMode === 'ladder' ? opponentByIndex(ladderIndex) : undefined;
  const botStyle = activeOpponent?.style;
  const botDifficulty = activeOpponent?.difficulty ?? difficulty;

  const legalMoves = state.phase === 'playing' ? getLegalMoves(state.board, state.currentTurn) : [];
  const legalSet = new Set(legalMoves.map(([r, c]) => `${r},${c}`));
  const { black, white } = countPieces(state.board);

  const cpuColor: Piece = playerSide === 'black' ? 'white' : 'black';
  const puzzleOpp: Piece | null =
    playMode === 'puzzle' && puzzle ? (puzzle.side === 'black' ? 'white' : 'black') : null;
  const isBotTurn =
    (playMode === 'bot' || playMode === 'ladder' || (playMode === 'puzzle' && puzzleOpp !== null)) &&
    state.phase === 'playing' &&
    !puzzleFailed &&
    !puzzleSolved &&
    state.currentTurn === (puzzleOpp ?? cpuColor);

  const teach =
    state.phase === 'playing' && playMode !== 'puzzle'
      ? teachingHint(state.board, state.currentTurn)
      : puzzle
        ? { id: 'puzzle-tip', title: puzzle.title, detail: puzzle.tip, cells: undefined as [number, number][] | undefined }
        : null;
  const teachCells = new Set((teach?.cells ?? []).map(([r, c]) => `${r},${c}`));

  const triggerFlips = useCallback((cells: [number, number][]) => {
    if (cells.length === 0) return;
    const keys = new Set(cells.map(([r, c]) => `${r},${c}`));
    setFlipCells(keys);
    playFlip();
    if (flipTimer.current) window.clearTimeout(flipTimer.current);
    flipTimer.current = window.setTimeout(() => setFlipCells(new Set()), FLIP_MS);
  }, []);

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h, { state, lastMove, reviewLog, puzzlePlies }]);
  }, [state, lastMove, reviewLog, puzzlePlies]);

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
          message: winner === 'draw' ? '和局' : winner === 'black' ? '黑方勝' : '白方勝',
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
    [],
  );

  const finishPuzzleSuccess = useCallback(
    (finalBoard: Board) => {
      const stars = ratePuzzleAttempt({
        usedHint: puzzleUsedHint,
        usedUndo: puzzleUsedUndo,
      });
      setLastPuzzleStars(stars);
      setPuzzleSolved(true);
      setState((s) => ({
        ...s,
        board: finalBoard,
        phase: 'over',
        winner: getWinner(finalBoard),
        message: `謎題完成！${formatStars(stars)}`,
      }));
      playWin();
      if (puzzle) {
        setLadder((prev) => {
          const next = applyPuzzleSolve(prev, puzzle.id, stars);
          saveLadder(next);
          return next;
        });
      }
    },
    [puzzle, puzzleUsedHint, puzzleUsedUndo],
  );

  const failPuzzle = useCallback((msg: string) => {
    setPuzzleFailed(true);
    setState((s) => ({
      ...s,
      phase: 'over',
      winner: null,
      message: msg,
    }));
    playLose();
  }, []);

  // Bot / puzzle reply
  useEffect(() => {
    if (!isBotTurn || botScheduled.current) return;
    botScheduled.current = true;
    const timer = window.setTimeout(() => {
      const botColor: Piece =
        playMode === 'puzzle' && puzzle
          ? puzzle.side === 'black'
            ? 'white'
            : 'black'
          : cpuColor;
      const moves = getLegalMoves(state.board, botColor);
      if (moves.length === 0) {
        setState((s) => passTurn(s));
        botScheduled.current = false;
        return;
      }

      let best: [number, number] | null = null;
      if (playMode === 'puzzle') {
        best = bestExactReply(state.board, botColor);
      } else {
        best = getBestMove(state.board, botColor, botDifficulty, botStyle);
      }
      if (!best) {
        setState((s) => passTurn(s));
        botScheduled.current = false;
        return;
      }
      const [r, c] = best;
      const flips = getFlips(state.board, r, c, botColor);
      const nextBoard = applyMove(state.board, r, c, botColor);
      playMove();
      triggerFlips(flips);
      setLastMove([r, c]);
      setReviewLog((log) => appendReviewMove(log, state.board, botColor, [r, c], false));
      const nextTurn: Piece = botColor === 'black' ? 'white' : 'black';
      const nextMessage =
        playMode === 'puzzle'
          ? '輪到你下子'
          : nextTurn === playerSide
            ? '輪到你下子'
            : '電腦思考中…';
      applyMoveAndAdvance(nextBoard, nextTurn, nextMessage);
      botScheduled.current = false;
    }, BOT_DELAY_MS);
    return () => {
      window.clearTimeout(timer);
      botScheduled.current = false;
    };
  }, [
    isBotTurn,
    state.board,
    state.currentTurn,
    playMode,
    puzzle,
    cpuColor,
    botDifficulty,
    botStyle,
    playerSide,
    applyMoveAndAdvance,
    triggerFlips,
  ]);

  // End-of-game: audio, streaks, ladder, series, review
  useEffect(() => {
    if (state.phase !== 'over' || prevPhaseRef.current === 'over') {
      prevPhaseRef.current = state.phase;
      return;
    }
    prevPhaseRef.current = state.phase;

    if (playMode === 'puzzle') {
      return;
    }

    const vsCpu = playMode === 'bot' || playMode === 'ladder';
    if (vsCpu && state.winner && state.winner !== 'draw') {
      if (state.winner === playerSide) playWin();
      else playLose();
    }

    if (vsCpu && !statsRecordedRef.current) {
      statsRecordedRef.current = true;
      const margin = Math.abs(black - white);
      const playerWon = state.winner === playerSide;
      const drawn = state.winner === 'draw' || state.winner === null;

      if (playerWon) {
        setWinStreak((s) => {
          const next = s + 1;
          writeStoredInt(STREAK_KEY, next);
          setBestStreak((best) => {
            const nb = Math.max(best, next);
            if (nb !== best) writeStoredInt(BEST_STREAK_KEY, nb);
            return nb;
          });
          return next;
        });
        setBestMargin((m) => {
          const next = Math.max(m, margin);
          writeStoredInt(MARGIN_KEY, next);
          return next;
        });
      } else if (!drawn) {
        setWinStreak(0);
        writeStoredInt(STREAK_KEY, 0);
      }

      if (playMode === 'ladder') {
        setLadder((prev) => {
          if (playerWon) {
            const { progress } = applyLadderWin(prev, ladderIndex);
            saveLadder(progress);
            return progress;
          }
          const progress = applyLadderLoss(prev, ladderIndex);
          saveLadder(progress);
          return progress;
        });
      }

      if (series && !series.over) {
        const result = drawn ? 'draw' : playerWon ? 'player' : 'cpu';
        setSeries((s) => (s ? applySeriesResult(s, result) : s));
      }
    }

    if (vsCpu || playMode === 'two') {
      setReview(buildGameReview(reviewLog));
    }
  }, [
    state.phase,
    state.winner,
    playMode,
    playerSide,
    black,
    white,
    ladderIndex,
    series,
    reviewLog,
  ]);

  const handleCellClick = useCallback(
    (r: number, c: number) => {
      if (state.phase !== 'playing' || isBotTurn || puzzleFailed) return;
      if (playMode === 'bot' || playMode === 'ladder') {
        if (state.currentTurn !== playerSide) return;
      }
      if (playMode === 'puzzle' && puzzle) {
        if (state.currentTurn !== puzzle.side) return;
      }
      if (!legalSet.has(`${r},${c}`)) return;

      if (playMode === 'puzzle' && puzzle) {
        const ok = isOptimalMove(state.board, puzzle.side, [r, c], puzzle.goal);
        if (!ok) {
          pushHistory();
          const flips = getFlips(state.board, r, c, puzzle.side);
          const nextBoard = applyMove(state.board, r, c, puzzle.side);
          playMove();
          triggerFlips(flips);
          setLastMove([r, c]);
          failPuzzle('這手無法達成目標。再試一次！');
          setState((s) => ({ ...s, board: nextBoard }));
          return;
        }
      }

      pushHistory();
      setHintCell(null);
      const color = state.currentTurn;
      const flips = getFlips(state.board, r, c, color);
      const nextBoard = applyMove(state.board, r, c, color);
      playMove();
      triggerFlips(flips);
      setLastMove([r, c]);
      setReviewLog((log) => appendReviewMove(log, state.board, color, [r, c], true));

      if (playMode === 'puzzle' && puzzle) {
        const nextPlies = puzzlePlies + 1;
        setPuzzlePlies(nextPlies);

        const playerLegal = getLegalMoves(nextBoard, puzzle.side);
        const opp = puzzle.side === 'black' ? 'white' : 'black';
        const oppLegal = getLegalMoves(nextBoard, opp);
        const terminal = playerLegal.length === 0 && oppLegal.length === 0;

        if (terminal) {
          const winner = getWinner(nextBoard);
          const start = solveExact(puzzle.board, puzzle.side);
          const { black: b, white: w } = countPieces(nextBoard);
          const diff = puzzle.side === 'black' ? b - w : w - b;
          const solved =
            puzzle.goal === 'win'
              ? winner === puzzle.side
              : puzzle.goal === 'draw'
                ? winner === 'draw'
                : diff === start.score;
          if (solved) finishPuzzleSuccess(nextBoard);
          else failPuzzle('終局未達目標。');
          return;
        }

        const nextTurn: Piece = color === 'black' ? 'white' : 'black';
        // Budget exhausted and it would be the player's turn again → fail.
        if (nextPlies >= puzzle.maxPlies && nextTurn === puzzle.side && playerLegal.length > 0) {
          failPuzzle('手數用盡，尚未達成目標。');
          setState((s) => ({ ...s, board: nextBoard, currentTurn: nextTurn }));
          return;
        }

        applyMoveAndAdvance(nextBoard, nextTurn, '電腦應手…');
        return;
      }

      const nextTurn: Piece = color === 'black' ? 'white' : 'black';
      const nextMessage =
        playMode === 'bot' || playMode === 'ladder'
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
      playMode,
      playerSide,
      puzzle,
      puzzlePlies,
      puzzleFailed,
      legalSet,
      applyMoveAndAdvance,
      pushHistory,
      triggerFlips,
      failPuzzle,
      finishPuzzleSuccess,
    ],
  );

  // Puzzle: after game becomes terminal via bot replies, check goal
  useEffect(() => {
    if (playMode !== 'puzzle' || !puzzle || puzzleFailed || puzzleSolved) return;
    if (state.phase !== 'over') return;
    if (puzzleSolved || puzzleFailed) return;
    const winner = state.winner;
    const { black: b, white: w } = countPieces(state.board);
    const diff = puzzle.side === 'black' ? b - w : w - b;
    const start = solveExact(puzzle.board, puzzle.side);
    let ok = false;
    if (puzzle.goal === 'win') ok = winner === puzzle.side;
    else if (puzzle.goal === 'draw') ok = winner === 'draw';
    else ok = diff === start.score;
    if (ok) {
      finishPuzzleSuccess(state.board);
    } else if (!puzzleFailed) {
      failPuzzle('終局未達目標。');
    }
  }, [
    playMode,
    puzzle,
    puzzleFailed,
    puzzleSolved,
    state.phase,
    state.winner,
    state.board,
    failPuzzle,
    finishPuzzleSuccess,
  ]);

  const handlePass = useCallback(() => {
    if (state.phase !== 'playing' || legalMoves.length > 0) return;
    if ((playMode === 'bot' || playMode === 'ladder') && state.currentTurn !== playerSide) return;
    if (playMode === 'puzzle' && puzzle && state.currentTurn !== puzzle.side) return;
    pushHistory();
    setHintCell(null);
    setState((s) => passTurn(s));
  }, [state.phase, state.currentTurn, legalMoves.length, playMode, playerSide, puzzle, pushHistory]);

  const handleUndo = useCallback(() => {
    if (history.length === 0 || isBotTurn || state.phase === 'over') return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setState(prev.state);
    setLastMove(prev.lastMove);
    setReviewLog(prev.reviewLog);
    setPuzzlePlies(prev.puzzlePlies);
    setPuzzleFailed(false);
    setPuzzleSolved(false);
    setLastPuzzleStars(null);
    if (playMode === 'puzzle') setPuzzleUsedUndo(true);
    setHintCell(null);
    setReview(null);
    botScheduled.current = false;
    statsRecordedRef.current = false;
    prevPhaseRef.current = 'playing';
  }, [history, isBotTurn, state.phase, playMode]);

  const handleHint = useCallback(() => {
    if (state.phase !== 'playing' || isBotTurn) return;
    if ((playMode === 'bot' || playMode === 'ladder') && state.currentTurn !== playerSide) return;
    if (playMode === 'puzzle' && puzzle) {
      const solved = solveExact(state.board, puzzle.side);
      if (solved.bestMove) {
        setHintCell(solved.bestMove);
        setPuzzleUsedHint(true);
      }
      return;
    }
    if (legalMoves.length === 0) return;
    const best = getBestMove(state.board, state.currentTurn, 'hard');
    if (best) setHintCell(best);
  }, [state.phase, state.board, state.currentTurn, isBotTurn, playMode, playerSide, puzzle, legalMoves.length]);

  const backToMenu = useCallback(() => {
    setPlayMode(null);
    setMenuView('home');
    setPuzzle(null);
    setSeries(null);
    setState(getInitialState());
    setLastMove(null);
    setHistory([]);
    setHintCell(null);
    setFlipCells(new Set());
    setReviewLog([]);
    setReview(null);
    setPuzzlePlies(0);
    setPuzzleFailed(false);
    setPuzzleSolved(false);
    setPuzzleUsedHint(false);
    setPuzzleUsedUndo(false);
    setLastPuzzleStars(null);
    botScheduled.current = false;
    statsRecordedRef.current = false;
    prevPhaseRef.current = 'playing';
  }, []);

  const startTwoPlayer = useCallback(() => {
    setPlayMode('two');
    setSeries(null);
    setState(getInitialState());
    setHistory([]);
    setHintCell(null);
    setLastMove(null);
    setReviewLog([]);
    setReview(null);
    statsRecordedRef.current = false;
    prevPhaseRef.current = 'playing';
  }, []);

  const startVsBot = useCallback(
    (side: Piece) => {
      setPlayMode('bot');
      setPlayerSide(side);
      setSeries(createSeries(seriesLength));
      setState(getInitialState());
      setHistory([]);
      setHintCell(null);
      setLastMove(null);
      setReviewLog([]);
      setReview(null);
      botScheduled.current = false;
      statsRecordedRef.current = false;
      prevPhaseRef.current = 'playing';
    },
    [seriesLength],
  );

  const startLadder = useCallback(
    (index: number, side: Piece) => {
      setPlayMode('ladder');
      setLadderIndex(index);
      setPlayerSide(side);
      setSeries(createSeries(seriesLength));
      setState(getInitialState());
      setHistory([]);
      setHintCell(null);
      setLastMove(null);
      setReviewLog([]);
      setReview(null);
      botScheduled.current = false;
      statsRecordedRef.current = false;
      prevPhaseRef.current = 'playing';
    },
    [seriesLength],
  );

  const startPuzzle = useCallback(
    (index: number) => {
      const p = getPuzzle(index);
      if (!p) return;
      // Prefer live React state; fall back to storage after a just-saved unlock.
      if (!isPuzzleUnlocked(index, ladder) && !isPuzzleUnlocked(index, loadLadder())) return;
      setPlayMode('puzzle');
      setPuzzle(p);
      setPlayerSide(p.side);
      setSeries(null);
      setPuzzlePlies(0);
      setPuzzleFailed(false);
      setPuzzleSolved(false);
      setPuzzleUsedHint(false);
      setPuzzleUsedUndo(false);
      setLastPuzzleStars(null);
      setState(getInitialState(p.board, p.side));
      setHistory([]);
      setHintCell(null);
      setLastMove(null);
      setReviewLog([]);
      setReview(null);
      botScheduled.current = false;
      statsRecordedRef.current = false;
      prevPhaseRef.current = 'playing';
    },
    [ladder],
  );

  const replaySame = useCallback(() => {
    statsRecordedRef.current = false;
    prevPhaseRef.current = 'playing';
    setReview(null);
    setReviewLog([]);
    setHistory([]);
    setHintCell(null);
    setLastMove(null);
    setFlipCells(new Set());
    botScheduled.current = false;

    if (playMode === 'puzzle' && puzzle) {
      setPuzzlePlies(0);
      setPuzzleFailed(false);
      setPuzzleSolved(false);
      setPuzzleUsedHint(false);
      setPuzzleUsedUndo(false);
      setLastPuzzleStars(null);
      setState(getInitialState(puzzle.board, puzzle.side));
      return;
    }

    if (series && series.over) {
      setSeries(createSeries(series.length));
    }

    setState(getInitialState());
  }, [playMode, puzzle, series]);

  if (playMode === null) {
    return (
      <MenuScreen
        view={menuView}
        setView={setMenuView}
        showRules={showRules}
        setShowRules={setShowRules}
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        seriesLength={seriesLength}
        setSeriesLength={setSeriesLengthAndRemember}
        ladder={ladder}
        puzzles={PUZZLES}
        winStreak={winStreak}
        bestStreak={bestStreak}
        bestMargin={bestMargin}
        onTwoPlayer={startTwoPlayer}
        onStartBot={startVsBot}
        onStartLadder={startLadder}
        onStartPuzzle={startPuzzle}
      />
    );
  }

  const humanSide = playMode === 'puzzle' && puzzle ? puzzle.side : playerSide;
  const isHumanTurn =
    playMode === 'two' ||
    ((playMode === 'bot' || playMode === 'ladder' || playMode === 'puzzle') &&
      state.currentTurn === humanSide);
  const humanCanClick =
    state.phase === 'playing' && isHumanTurn && !isBotTurn && !puzzleFailed;
  const showLegalHints = humanCanClick;
  const canUndo = history.length > 0 && !isBotTurn && state.phase === 'playing';
  const canHint = humanCanClick && legalMoves.length > 0;

  let statusMessage = state.message;
  if (playMode === 'puzzle' && puzzle) {
    if (puzzleFailed) statusMessage = state.message;
    else if (puzzleSolved) statusMessage = '謎題完成！';
    else if (isBotTurn) statusMessage = '對手應手…';
    else statusMessage = `${describePuzzleObjective(puzzle)} · 已用 ${puzzlePlies}/${puzzle.maxPlies} 手`;
  } else if ((playMode === 'bot' || playMode === 'ladder') && state.phase === 'playing') {
    statusMessage = isBotTurn
      ? '電腦思考中…'
      : state.currentTurn === playerSide
        ? legalMoves.length > 0
          ? '輪到你下子'
          : '無合法手，請按 Pass'
        : state.message;
  }

  const gameOverMessage = (() => {
    if (playMode === 'puzzle') {
      if (puzzleSolved) return '謎題完成';
      if (puzzleFailed) return '挑戰失敗';
      return state.message;
    }
    if ((playMode === 'bot' || playMode === 'ladder') && state.winner) {
      if (state.winner === 'draw') return '和局';
      return state.winner === playerSide ? '你贏了' : '電腦贏了';
    }
    if (state.winner === 'draw') return '和局';
    if (state.winner === 'black') return '黑方獲勝';
    if (state.winner === 'white') return '白方獲勝';
    return '對局結束';
  })();

  const resultVariant =
    playMode === 'puzzle'
      ? puzzleSolved
        ? 'win'
        : 'lose'
      : playMode !== 'two' && state.winner && state.winner !== 'draw'
        ? state.winner === playerSide
          ? 'win'
          : 'lose'
        : 'neutral';

  const endMargin = Math.abs(black - white);
  const seriesDone = series?.over ?? false;

  return (
    <div
      className="min-h-screen text-white flex flex-col items-center p-4 min-w-0 bg-cover bg-center"
      style={shellStyle}
    >
      <BackToMenu />
      <header className="w-full max-w-lg flex justify-between items-center mb-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <h1 className="text-xl font-bold tracking-tight">黑白棋</h1>
          {playMode === 'bot' && (
            <span className="shrink-0 px-2 py-0.5 rounded-md bg-emerald-800/60 border border-emerald-600/50 text-xs text-emerald-100">
              電腦・{DIFFICULTY_LABELS[difficulty]}
            </span>
          )}
          {playMode === 'ladder' && activeOpponent && (
            <span
              className="shrink-0 px-2 py-0.5 rounded-md border text-xs"
              style={{ borderColor: activeOpponent.accent, color: activeOpponent.accent }}
            >
              {activeOpponent.name}
            </span>
          )}
          {playMode === 'puzzle' && puzzle && (
            <span className="shrink-0 px-2 py-0.5 rounded-md bg-sky-900/70 border border-sky-500/50 text-xs">
              謎題 {puzzle.index + 1}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <TouchButton
            label={<Undo2 className="w-5 h-5" />}
            ariaLabel="悔棋"
            title="悔棋"
            disabled={!canUndo}
            onClick={handleUndo}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center justify-center bg-transparent text-inherit border-0"
          />
          <TouchButton
            label={<Lightbulb className="w-5 h-5" />}
            ariaLabel="提示"
            title="提示"
            disabled={!canHint}
            onClick={handleHint}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center justify-center bg-transparent text-inherit border-0"
          />
          <TouchButton
            label={<BookOpen className="w-5 h-5" />}
            ariaLabel="規則"
            title="規則"
            onClick={() => setShowRules(true)}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center justify-center bg-transparent text-inherit border-0"
          />
          <TouchButton
            label={<RefreshCw className="w-5 h-5" />}
            ariaLabel="新對局"
            title="新對局"
            onClick={backToMenu}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors inline-flex items-center justify-center bg-transparent text-inherit border-0"
          />
        </div>
      </header>

      {playMode === 'bot' && (
        <div className="flex flex-wrap items-center justify-center gap-2 mb-2 text-xs" role="group" aria-label="電腦難度">
          <span className="text-stone-400">難度</span>
          {DIFFICULTIES.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setDifficulty(id)}
              aria-pressed={difficulty === id}
              title={DIFFICULTY_BLURBS[id]}
              className={`px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation transition-colors ${
                difficulty === id
                  ? 'border-emerald-400 bg-emerald-700/40 text-emerald-100'
                  : 'border-stone-600 bg-stone-800 text-stone-300 hover:bg-stone-700'
              }`}
            >
              {DIFFICULTY_LABELS[id]}
            </button>
          ))}
        </div>
      )}

      {playMode === 'ladder' && activeOpponent && (
        <p className="text-xs text-stone-400 mb-2 text-center max-w-sm">
          「{activeOpponent.catchphrases.intro}」· {activeOpponent.blurb}
        </p>
      )}

      {series && series.length > 1 && (
        <p className="text-amber-200/90 text-xs mb-2">
          {seriesLabel(series.length)} · {seriesScoreLine(series)}
          {seriesDone
            ? series.winner === 'player'
              ? ' · 你拿下系列賽！'
              : series.winner === 'cpu'
                ? ' · 系列賽敗北'
                : ' · 系列賽結束'
            : ` · 第 ${series.gameIndex + 1} 局`}
        </p>
      )}

      <div className="flex items-center justify-center gap-6 mb-2 text-sm">
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            state.phase === 'playing' && state.currentTurn === 'black'
              ? 'bg-amber-600/30 ring-2 ring-amber-400'
              : 'bg-stone-800/50'
          }`}
        >
          <span
            className="w-4 h-4 rounded-full bg-cover bg-center ring-2 ring-stone-600"
            style={{
              backgroundColor: '#1c1917',
              backgroundImage: `url(${import.meta.env.BASE_URL}piece-black.jpg)`,
            }}
          />
          <span>
            {playMode !== 'two' && humanSide === 'black' ? '你' : '黑'} {black}
          </span>
        </div>
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
            state.phase === 'playing' && state.currentTurn === 'white'
              ? 'bg-amber-600/30 ring-2 ring-amber-400'
              : 'bg-stone-800/50'
          }`}
        >
          <span
            className="w-4 h-4 rounded-full bg-cover bg-center ring-2 ring-stone-400"
            style={{
              backgroundColor: '#f8fafc',
              backgroundImage: `url(${import.meta.env.BASE_URL}piece-white.jpg)`,
            }}
          />
          <span>
            {playMode !== 'two' && humanSide === 'white' ? '你' : '白'} {white}
          </span>
        </div>
      </div>

      {playMode !== 'two' && playMode !== 'puzzle' && (
        <p className="text-stone-500 text-xs mb-1">
          連勝 {winStreak} · 最佳連勝 {bestStreak} · 最佳勝差 {bestMargin}
        </p>
      )}

      {teach && state.phase === 'playing' && (
        <div className="teach-banner max-w-sm mb-2 rounded-lg border border-amber-500/40 bg-amber-950/40 px-3 py-2 text-center">
          <p className="text-amber-200 text-xs font-semibold">{teach.title}</p>
          <p className="text-amber-100/80 text-xs">{teach.detail}</p>
        </div>
      )}

      <p className="text-emerald-200 text-sm mb-3">{statusMessage}</p>

      <BoardGrid
        board={state.board}
        legalSet={legalSet}
        lastMove={lastMove}
        hintCell={hintCell}
        flipCells={flipCells}
        teachCells={teachCells}
        showLegalHints={showLegalHints}
        humanCanClick={humanCanClick}
        phasePlaying={state.phase === 'playing'}
        onCellClick={handleCellClick}
      />

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
          title={gameOverMessage}
          variant={resultVariant}
          badge={
            playMode === 'puzzle'
              ? puzzleSolved
                ? lastPuzzleStars
                  ? formatStars(lastPuzzleStars)
                  : '過關'
                : '失敗'
              : state.winner === 'draw'
                ? '和局'
                : seriesDone
                  ? '系列賽'
                  : undefined
          }
          subtitle={
            review
              ? review.summary
              : playMode === 'puzzle' && puzzle
                ? puzzleSolved
                  ? `${puzzle.tip}（無提示／無悔棋可拿滿星）`
                  : puzzle.tip
                : activeOpponent
                  ? state.winner === playerSide
                    ? activeOpponent.catchphrases.lose
                    : activeOpponent.catchphrases.win
                  : undefined
          }
          stats={[
            { label: '黑子', value: black },
            { label: '白子', value: white },
            { label: '勝差', value: endMargin },
            ...(playMode === 'puzzle' && puzzleSolved && lastPuzzleStars
              ? [{ label: '星級', value: formatStars(lastPuzzleStars) }]
              : []),
            ...(series && series.length > 1
              ? [{ label: '系列賽', value: seriesScoreLine(series) }]
              : []),
            ...(review?.mistakes.length
              ? [{ label: '關鍵失誤', value: review.mistakes.length }]
              : []),
            ...(playMode === 'bot' || playMode === 'ladder'
              ? [
                  { label: '連勝', value: winStreak },
                  { label: '最佳連勝', value: bestStreak },
                ]
              : []),
          ]}
          primaryLabel={
            playMode === 'puzzle'
              ? puzzleSolved && puzzle && puzzle.index < PUZZLES.length - 1
                ? '下一題'
                : '再試一次'
              : series && !series.over
                ? '下一局'
                : '再玩一局'
          }
          onPrimary={() => {
            if (playMode === 'puzzle' && puzzleSolved && puzzle && puzzle.index < PUZZLES.length - 1) {
              startPuzzle(puzzle.index + 1);
              return;
            }
            replaySame();
          }}
          onSecondary={backToMenu}
          secondaryLabel="回選單"
        />
      )}

      {state.phase === 'over' && review && review.lessons.length > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(92vw,24rem)] pointer-events-none">
          <div className="rounded-xl border border-stone-600 bg-stone-950/90 p-3 text-left text-xs text-stone-300 shadow-lg pointer-events-auto">
            <p className="font-semibold text-emerald-300 mb-1">對局複盤</p>
            {review.mistakes.slice(0, 2).map((m) => (
              <p key={`${m.ply}-${m.move.join(',')}`} className="mb-1">
                · {m.reason}
              </p>
            ))}
            {review.lessons.slice(0, 2).map((l) => (
              <p key={l.title} className="text-stone-400">
                <span className="text-amber-200">{l.title}</span> — {l.detail}
              </p>
            ))}
          </div>
        </div>
      )}

      {showRules && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rules-title"
        >
          <div className="bg-stone-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
            <h2 id="rules-title" className="text-lg font-bold mb-3">規則說明</h2>
            <ul className="text-sm text-stone-200 space-y-2 list-disc pl-4">
              <li>8×8 棋盤，黑方先手。開局中央 2×2 為兩黑兩白（斜線相對）。</li>
              <li>同一手可多方向翻子；至少須翻 1 枚才算合法。</li>
              <li>無合法手時須 Pass；雙方都無法下則終局，子多者勝。</li>
              <li>角地、機動、奇偶是中盤與殘局的核心概念——見「戰略要點」。</li>
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

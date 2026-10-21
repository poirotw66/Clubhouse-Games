import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import {
  playMove,
  playCapture,
  playWin,
  playLose,
  playScore,
} from '@clubhouse/shared/synthAudio';
import type {
  Board,
  BoardPresetId,
  Difficulty,
  GameMode,
  Move,
  PersonalityId,
  PieceColor,
  RulesConfig,
  RuleVariantId,
  SeriesTarget,
} from './utils/types';
import {
  BOARD_PRESETS,
  DEFAULT_SERIES_TARGET,
  RULE_VARIANTS,
  SERIES_TARGETS,
  buildRules,
} from './utils/types';
import {
  PERSONALITIES,
  PERSONALITY_IDS,
  DIFFICULTY_LABELS,
  DIFFICULTY_BLURBS,
  applyMove,
  createInitialBoard,
  getDropRow,
  getLegalDropColumns,
  getPopOutColumns,
  getWinningCells,
  isBoardFull,
  pickBotMove,
  resolveWinnerAfterMove,
} from './utils/connect4Logic';
import {
  applyGameToSeries,
  createSeriesState,
  seriesProgressLabel,
  type SeriesState,
} from './utils/match';
import {
  PUZZLES,
  loadPuzzleBoard,
  puzzleRules,
  type PuzzleDef,
} from './utils/puzzles';
import {
  clearSeries,
  countSolvedPuzzles,
  getModeStats,
  loadPuzzleProgress,
  loadSeries,
  loadStats,
  markPuzzleSolved,
  modeStatsLabel,
  recordGameResult,
  recordSeriesResult,
  savePuzzleProgress,
  saveSeries,
  saveStats,
  type ConnectFourStats,
  type PuzzleProgress,
} from './utils/storage';
import {
  RefreshCw,
  BookOpen,
  Users,
  Undo2,
  Lightbulb,
  Bot,
  Puzzle,
} from 'lucide-react';

type GamePhase = 'playing' | 'over';

interface GameState {
  board: Board;
  currentTurn: PieceColor;
  phase: GamePhase;
  winner: PieceColor | 'draw' | null;
}

interface DropFx {
  row: number;
  col: number;
  key: number;
}

function persistSeriesSnapshot(opts: {
  series: SeriesState;
  variant: RuleVariantId;
  preset: BoardPresetId;
  difficulty: Difficulty;
  personality: PersonalityId;
  gameMode: 'two' | 'bot';
  playerSide: PieceColor;
}): void {
  if (opts.series.seriesOver) {
    clearSeries();
    return;
  }
  saveSeries({
    scores: opts.series.scores,
    target: opts.series.target,
    gamesPlayed: opts.series.gamesPlayed,
    variant: opts.variant,
    preset: opts.preset,
    difficulty: opts.difficulty,
    personality: opts.personality,
    gameMode: opts.gameMode,
    playerSide: opts.playerSide,
  });
}

function freshGame(rules: RulesConfig): GameState {
  return {
    board: createInitialBoard(rules),
    currentTurn: 'red',
    phase: 'playing',
    winner: null,
  };
}

export default function App() {
  const saved = loadSeries();
  const initialStats = loadStats();

  const [screen, setScreen] = useState<'play' | 'puzzles'>('play');
  const [gameMode, setGameMode] = useState<GameMode>(saved?.gameMode ?? 'bot');
  const [playerSide, setPlayerSide] = useState<PieceColor>(
    saved?.playerSide ?? 'red',
  );
  const [difficulty, setDifficulty] = useState<Difficulty>(
    saved?.difficulty ?? initialStats.lastDifficulty,
  );
  const [personality, setPersonality] = useState<PersonalityId>(
    saved?.personality ?? initialStats.lastPersonality,
  );
  const [variant, setVariant] = useState<RuleVariantId>(
    saved?.variant ?? initialStats.lastVariant,
  );
  const [preset, setPreset] = useState<BoardPresetId>(
    saved?.preset ?? initialStats.lastPreset,
  );
  const [seriesTarget, setSeriesTarget] = useState<SeriesTarget>(
    saved?.target ?? initialStats.lastSeriesTarget ?? DEFAULT_SERIES_TARGET,
  );
  const [series, setSeries] = useState<SeriesState>(() => {
    if (saved) {
      return {
        scores: saved.scores,
        target: saved.target,
        gamesPlayed: saved.gamesPlayed,
        seriesOver: false,
        seriesWinner: null,
      };
    }
    return createSeriesState(seriesTarget);
  });

  const rules = useMemo(() => buildRules(variant, preset), [variant, preset]);

  const [state, setState] = useState<GameState>(() => freshGame(rules));
  const [history, setHistory] = useState<GameState[]>([]);
  const [hintMove, setHintMove] = useState<Move | null>(null);
  const [actionMode, setActionMode] = useState<'drop' | 'pop'>('drop');
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const [dropFx, setDropFx] = useState<DropFx | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [stats, setStats] = useState<ConnectFourStats>(initialStats);
  const [puzzleProgress, setPuzzleProgress] = useState<PuzzleProgress>(
    loadPuzzleProgress,
  );
  const [activePuzzle, setActivePuzzle] = useState<PuzzleDef | null>(null);
  const [puzzlePlies, setPuzzlePlies] = useState(0);
  const [puzzleStatus, setPuzzleStatus] = useState<
    'playing' | 'won' | 'failed'
  >('playing');

  const botScheduled = useRef(false);
  const prevPhaseRef = useRef<GamePhase>('playing');
  const seriesRecordedRef = useRef(false);
  const gameRecordedRef = useRef(false);

  const legalDrops =
    state.phase === 'playing' ? getLegalDropColumns(state.board, rules) : [];
  const legalDropSet = new Set(legalDrops);
  const popCols =
    state.phase === 'playing' && rules.allowPopOut
      ? getPopOutColumns(state.board, state.currentTurn, rules)
      : [];
  const popSet = new Set(popCols);

  const isBotTurn =
    screen === 'play' &&
    gameMode === 'bot' &&
    state.phase === 'playing' &&
    state.currentTurn !== playerSide;

  const humanCanAct =
    state.phase === 'playing' &&
    !isBotTurn &&
    (screen === 'puzzles'
      ? puzzleStatus === 'playing'
      : gameMode === 'two' || state.currentTurn === playerSide);

  const resetBoard = useCallback(
    (nextRules: RulesConfig = rules) => {
      setState(freshGame(nextRules));
      setHistory([]);
      setHintMove(null);
      setHoverCol(null);
      setDropFx(null);
      setActionMode('drop');
      botScheduled.current = false;
      prevPhaseRef.current = 'playing';
      gameRecordedRef.current = false;
    },
    [rules],
  );

  const startNewSeries = useCallback(
    (target: SeriesTarget = seriesTarget) => {
      const next = createSeriesState(target);
      setSeries(next);
      seriesRecordedRef.current = false;
      clearSeries();
      resetBoard();
    },
    [seriesTarget, resetBoard],
  );

  const playMoveFx = useCallback(
    (board: Board, move: Move, _color: PieceColor) => {
      if (move.kind === 'drop') {
        // After apply, the new piece is the topmost filled cell in that column.
        let dropRow = 0;
        for (let r = 0; r < rules.rows; r++) {
          if (board[r][move.col] !== null) {
            dropRow = r;
            break;
          }
        }
        setDropFx({ row: dropRow, col: move.col, key: Date.now() });
        playMove();
      } else {
        playCapture();
        setDropFx(null);
      }
    },
    [rules],
  );

  const commitMove = useCallback(
    (move: Move, fromHuman: boolean) => {
      if (state.phase !== 'playing') return;
      const color = state.currentTurn;
      if (move.kind === 'drop' && !legalDropSet.has(move.col)) return;
      if (move.kind === 'pop' && !popSet.has(move.col)) return;

      const dropRow =
        move.kind === 'drop' ? getDropRow(state.board, move.col, rules) : null;
      const nextBoard = applyMove(state.board, move, color, rules);
      if (!nextBoard) return;

      const winner = resolveWinnerAfterMove(
        nextBoard,
        color,
        move,
        dropRow,
        rules,
      );
      const full = !winner && isBoardFull(nextBoard, rules);
      const nextTurn: PieceColor = color === 'red' ? 'yellow' : 'red';

      if (fromHuman) {
        setHistory((h) => [...h, state]);
      }
      setHintMove(null);
      playMoveFx(nextBoard, move, color);

      const nextState: GameState = {
        board: nextBoard,
        currentTurn: nextTurn,
        phase: winner || full ? 'over' : 'playing',
        winner: winner ?? (full ? 'draw' : null),
      };
      setState(nextState);

      if (screen === 'puzzles' && activePuzzle && fromHuman) {
        const plies = puzzlePlies + 1;
        setPuzzlePlies(plies);
        if (winner === activePuzzle.sideToMove) {
          setPuzzleStatus('won');
          playWin();
          const progress = markPuzzleSolved(puzzleProgress, activePuzzle.id, plies);
          setPuzzleProgress(progress);
          savePuzzleProgress(progress);
          const solved = countSolvedPuzzles(progress);
          setStats((s) => {
            const next = { ...s, puzzlesSolved: solved };
            saveStats(next);
            return next;
          });
        } else if (winner || plies >= activePuzzle.maxMoves) {
          setPuzzleStatus('failed');
          playLose();
        }
      }
    },
    [
      state,
      legalDropSet,
      popSet,
      rules,
      playMoveFx,
      screen,
      activePuzzle,
      puzzlePlies,
      puzzleProgress,
    ],
  );

  useEffect(() => {
    if (!isBotTurn || botScheduled.current) return;
    botScheduled.current = true;
    const timer = setTimeout(() => {
      const botColor: PieceColor = playerSide === 'red' ? 'yellow' : 'red';
      const move = pickBotMove(
        state.board,
        botColor,
        difficulty,
        personality,
        rules,
      );
      botScheduled.current = false;
      if (!move) return;
      // Inline bot commit to avoid stale closure on commitMove deps.
      const dropRow =
        move.kind === 'drop' ? getDropRow(state.board, move.col, rules) : null;
      const nextBoard = applyMove(state.board, move, botColor, rules);
      if (!nextBoard) return;
      const winner = resolveWinnerAfterMove(
        nextBoard,
        botColor,
        move,
        dropRow,
        rules,
      );
      const full = !winner && isBoardFull(nextBoard, rules);
      playMoveFx(nextBoard, move, botColor);
      setState({
        board: nextBoard,
        currentTurn: botColor === 'red' ? 'yellow' : 'red',
        phase: winner || full ? 'over' : 'playing',
        winner: winner ?? (full ? 'draw' : null),
      });
    }, 480);
    return () => {
      clearTimeout(timer);
      botScheduled.current = false;
    };
  }, [
    isBotTurn,
    state.board,
    playerSide,
    difficulty,
    personality,
    rules,
    playMoveFx,
  ]);

  // Game over → series + stats (play screen only).
  useEffect(() => {
    if (screen !== 'play') return;
    if (state.phase !== 'over' || prevPhaseRef.current === 'over') {
      prevPhaseRef.current = state.phase;
      return;
    }
    prevPhaseRef.current = state.phase;
    if (!state.winner || gameRecordedRef.current) return;
    gameRecordedRef.current = true;

    if (gameMode === 'bot') {
      if (state.winner === 'draw') {
        // no SFX
      } else if (state.winner === playerSide) {
        playWin();
      } else {
        playLose();
      }
      setStats((prev) => {
        const outcome =
          state.winner === 'draw'
            ? 'draw'
            : state.winner === playerSide
              ? 'win'
              : 'lose';
        const next = recordGameResult(prev, outcome, {
          difficulty,
          personality,
          variant,
          preset,
          seriesTarget,
        });
        saveStats(next);
        return next;
      });
    } else if (state.winner !== 'draw') {
      playScore();
    }

    setSeries((prev) => {
      const next = applyGameToSeries(prev, state.winner!);
      persistSeriesSnapshot({
        series: next,
        variant,
        preset,
        difficulty,
        personality,
        gameMode: gameMode === 'puzzle' ? 'bot' : gameMode,
        playerSide,
      });
      if (
        next.seriesOver &&
        next.seriesWinner &&
        gameMode === 'bot' &&
        !seriesRecordedRef.current
      ) {
        seriesRecordedRef.current = true;
        const humanWon =
          (playerSide === 'red' && next.seriesWinner === 'red') ||
          (playerSide === 'yellow' && next.seriesWinner === 'yellow');
        setStats((s) => {
          const updated = recordSeriesResult(s, humanWon, {
            difficulty,
            variant,
            preset,
          });
          saveStats(updated);
          return updated;
        });
        if (humanWon) playWin();
        else playLose();
      }
      return next;
    });
  }, [
    state.phase,
    state.winner,
    gameMode,
    playerSide,
    difficulty,
    personality,
    variant,
    preset,
    seriesTarget,
    screen,
  ]);

  const winningCells = useMemo(
    () =>
      state.phase === 'over' && state.winner && state.winner !== 'draw'
        ? getWinningCells(state.board, rules)
        : null,
    [state.phase, state.winner, state.board, rules],
  );

  const canUndo =
    history.length > 0 &&
    !isBotTurn &&
    state.phase === 'playing' &&
    (screen !== 'puzzles' || puzzleStatus === 'playing');

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setState(prev);
    setHintMove(null);
    setDropFx(null);
    botScheduled.current = false;
    if (screen === 'puzzles') {
      setPuzzlePlies((n) => Math.max(0, n - 1));
      setPuzzleStatus('playing');
    }
  }, [canUndo, history, screen]);

  const handleHint = useCallback(() => {
    if (!humanCanAct) return;
    const move = pickBotMove(
      state.board,
      state.currentTurn,
      'hard',
      'architect',
      rules,
    );
    setHintMove(move);
  }, [humanCanAct, state.board, state.currentTurn, rules]);

  const handleColumnClick = useCallback(
    (col: number) => {
      if (!humanCanAct) return;
      if (actionMode === 'pop' && rules.allowPopOut) {
        if (!popSet.has(col)) return;
        commitMove({ kind: 'pop', col }, true);
        return;
      }
      if (!legalDropSet.has(col)) return;
      commitMove({ kind: 'drop', col }, true);
    },
    [humanCanAct, actionMode, rules.allowPopOut, popSet, legalDropSet, commitMove],
  );

  const openPuzzle = useCallback((puzzle: PuzzleDef) => {
    const r = puzzleRules(puzzle);
    setActivePuzzle(puzzle);
    setScreen('puzzles');
    setGameMode('puzzle');
    setVariant(puzzle.variant);
    setPreset(puzzle.preset);
    setState({
      board: loadPuzzleBoard(puzzle),
      currentTurn: puzzle.sideToMove,
      phase: 'playing',
      winner: null,
    });
    setHistory([]);
    setHintMove(null);
    setPuzzlePlies(0);
    setPuzzleStatus('playing');
    setDropFx(null);
    setActionMode('drop');
    botScheduled.current = false;
    // Keep rules in sync via variant/preset — board already loaded.
    void r;
  }, []);

  const statusMessage =
    screen === 'puzzles' && activePuzzle
      ? puzzleStatus === 'won'
        ? '謎題破解！'
        : puzzleStatus === 'failed'
          ? '未在步數內取勝'
          : `紅方 · ${activePuzzle.maxMoves} 步內取勝（已用 ${puzzlePlies}）`
      : state.phase === 'over'
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

  const resultTitle = (() => {
    if (screen === 'puzzles') {
      if (puzzleStatus === 'won') return '謎題完成！';
      if (puzzleStatus === 'failed') return '再試一次';
      return '';
    }
    if (state.phase !== 'over' || !state.winner) return '';
    if (series.seriesOver && series.seriesWinner) {
      if (gameMode === 'bot') {
        return series.seriesWinner === playerSide ? '系列賽勝利！' : '系列賽落敗';
      }
      return series.seriesWinner === 'red' ? '紅方系列賽勝' : '黃方系列賽勝';
    }
    if (state.winner === 'draw') return '和局';
    if (gameMode === 'bot') {
      return state.winner === playerSide ? '你贏了！' : '電腦獲勝';
    }
    return state.winner === 'red' ? '紅方獲勝' : '黃方獲勝';
  })();

  const showOverlay =
    (screen === 'play' && state.phase === 'over') ||
    (screen === 'puzzles' &&
      (puzzleStatus === 'won' || puzzleStatus === 'failed'));

  const resultVariant =
    screen === 'puzzles'
      ? puzzleStatus === 'won'
        ? 'win'
        : 'lose'
      : gameMode === 'bot' && state.winner && state.winner !== 'draw'
        ? state.winner === playerSide
          ? 'win'
          : 'lose'
        : series.seriesOver && series.seriesWinner && gameMode === 'bot'
          ? series.seriesWinner === playerSide
            ? 'win'
            : 'lose'
          : 'neutral';

  const boardMaxWidth =
    rules.cols >= 9 ? 'min(96vw, 420px)' : rules.cols >= 8 ? 'min(94vw, 390px)' : 'min(92vw, 360px)';

  const modeStats = getModeStats(stats, variant, preset, difficulty);
  const modeLabel = modeStatsLabel(variant, preset, difficulty);

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
      <header className="w-full max-w-lg flex justify-between items-center mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-xl font-bold tracking-tight">四子棋</h1>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-600">
            {screen === 'puzzles'
              ? '謎題'
              : gameMode === 'bot'
                ? '對戰電腦'
                : '雙人對戰'}
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-sky-200 border border-sky-700/60">
            {RULE_VARIANTS[variant].label} · {BOARD_PRESETS[preset].label}
          </span>
          {screen === 'play' && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-200 border border-amber-700/60">
              {seriesProgressLabel(series)}
            </span>
          )}
          {gameMode === 'bot' && screen === 'play' && (
            <span
              className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-emerald-200 border border-emerald-700/60"
              title={`${modeLabel} 戰績 ${modeStats.wins}勝 ${modeStats.losses}敗 ${modeStats.draws}和`}
            >
              連勝 {modeStats.streak} · 最佳 {modeStats.bestStreak}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40 disabled:pointer-events-none touch-manipulation inline-flex items-center justify-center"
            title="悔棋"
            aria-label="悔棋"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleHint}
            disabled={!humanCanAct}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40 disabled:pointer-events-none touch-manipulation inline-flex items-center justify-center"
            title="提示"
            aria-label="提示"
          >
            <Lightbulb className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-white/10 transition-colors touch-manipulation inline-flex items-center justify-center"
            title="規則"
            aria-label="規則"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (screen === 'puzzles' && activePuzzle) openPuzzle(activePuzzle);
              else if (series.seriesOver) startNewSeries();
              else resetBoard();
            }}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-white/10 transition-colors touch-manipulation inline-flex items-center justify-center"
            title="新局"
            aria-label="新局"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Mode tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-3 text-xs w-full max-w-lg justify-center">
        <button
          type="button"
          onClick={() => {
            setScreen('play');
            setActivePuzzle(null);
            setGameMode('two');
            resetBoard();
          }}
          className={`flex items-center gap-1 px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation ${
            screen === 'play' && gameMode === 'two'
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
            setScreen('play');
            setActivePuzzle(null);
            setGameMode('bot');
            setPlayerSide('red');
            resetBoard();
          }}
          className={`flex items-center gap-1 px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation ${
            screen === 'play' && gameMode === 'bot' && playerSide === 'red'
              ? 'border-amber-400 bg-amber-500/20 text-amber-100'
              : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          <Bot className="w-3 h-3" />
          <span>電腦（你執紅）</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setScreen('play');
            setActivePuzzle(null);
            setGameMode('bot');
            setPlayerSide('yellow');
            resetBoard();
          }}
          className={`flex items-center gap-1 px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation ${
            screen === 'play' && gameMode === 'bot' && playerSide === 'yellow'
              ? 'border-amber-400 bg-amber-500/20 text-amber-100'
              : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          <span className="w-3 h-3 rounded-full bg-yellow-400" />
          <span>電腦（你執黃）</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setScreen('puzzles');
            setGameMode('puzzle');
            setActivePuzzle(null);
          }}
          className={`flex items-center gap-1 px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation ${
            screen === 'puzzles'
              ? 'border-violet-400 bg-violet-500/20 text-violet-100'
              : 'border-slate-600 bg-slate-800 text-slate-300'
          }`}
        >
          <Puzzle className="w-3 h-3" />
          <span>
            謎題 {countSolvedPuzzles(puzzleProgress)}/{PUZZLES.length}
          </span>
        </button>
      </div>

      {screen === 'puzzles' && !activePuzzle && (
        <div className="w-full max-w-lg grid gap-2 mb-4">
          <p className="text-sm text-slate-300 text-center">
            在限定步數內取勝 · 已破解 {countSolvedPuzzles(puzzleProgress)} /{' '}
            {PUZZLES.length}
          </p>
          {PUZZLES.map((puzzle, index) => {
            const solved = puzzleProgress[puzzle.id]?.solved;
            return (
              <button
                key={puzzle.id}
                type="button"
                onClick={() => openPuzzle(puzzle)}
                className="text-left px-4 py-3 min-h-[44px] rounded-xl border border-slate-600 bg-slate-800/80 hover:bg-slate-700 touch-manipulation"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-medium">
                    {index + 1}. {puzzle.name}
                    {solved ? ' ✓' : ''}
                  </span>
                  <span className="text-xs text-slate-400">
                    {puzzle.maxMoves} 步 · {RULE_VARIANTS[puzzle.variant].label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{puzzle.blurb}</p>
              </button>
            );
          })}
        </div>
      )}

      {screen === 'play' && (
        <>
          <div className="flex flex-col items-center gap-2 mb-3 text-xs w-full max-w-lg">
            <div
              className="flex flex-wrap items-center justify-center gap-2"
              role="group"
              aria-label="規則變體"
            >
              <span className="text-slate-400">變體</span>
              {(Object.keys(RULE_VARIANTS) as RuleVariantId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setVariant(id);
                    const nextPreset = RULE_VARIANTS[id].defaultPreset;
                    setPreset(nextPreset);
                    const nextRules = buildRules(id, nextPreset);
                    startNewSeries(seriesTarget);
                    resetBoard(nextRules);
                  }}
                  aria-pressed={variant === id}
                  title={RULE_VARIANTS[id].blurb}
                  className={`px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation ${
                    variant === id
                      ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                      : 'border-slate-600 bg-slate-800 text-slate-300'
                  }`}
                >
                  {RULE_VARIANTS[id].label}
                </button>
              ))}
            </div>
            <div
              className="flex flex-wrap items-center justify-center gap-2"
              role="group"
              aria-label="棋盤大小"
            >
              <span className="text-slate-400">棋盤</span>
              {(Object.keys(BOARD_PRESETS) as BoardPresetId[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setPreset(id);
                    const nextRules = buildRules(variant, id);
                    startNewSeries(seriesTarget);
                    resetBoard(nextRules);
                  }}
                  aria-pressed={preset === id}
                  title={BOARD_PRESETS[id].blurb}
                  className={`px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation ${
                    preset === id
                      ? 'border-sky-400 bg-sky-500/20 text-sky-100'
                      : 'border-slate-600 bg-slate-800 text-slate-300'
                  }`}
                >
                  {BOARD_PRESETS[id].label}
                </button>
              ))}
            </div>
            <div
              className="flex flex-wrap items-center justify-center gap-2"
              role="group"
              aria-label="系列賽目標"
            >
              <span className="text-slate-400">先取勝場</span>
              {SERIES_TARGETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => {
                    setSeriesTarget(n);
                    startNewSeries(n);
                  }}
                  aria-pressed={seriesTarget === n}
                  className={`px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation ${
                    seriesTarget === n
                      ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                      : 'border-slate-600 bg-slate-800 text-slate-300'
                  }`}
                >
                  {n} 勝
                </button>
              ))}
            </div>
          </div>

          {gameMode === 'bot' && (
            <div className="flex flex-col items-center gap-2 mb-3 text-xs w-full max-w-lg">
              <div
                className="flex flex-wrap items-center justify-center gap-2"
                role="group"
                aria-label="電腦難度"
              >
                <span className="text-slate-400">難度</span>
                {(['easy', 'normal', 'hard'] as Difficulty[]).map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setDifficulty(id);
                      resetBoard();
                    }}
                    aria-pressed={difficulty === id}
                    title={DIFFICULTY_BLURBS[id]}
                    className={`px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation ${
                      difficulty === id
                        ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                        : 'border-slate-600 bg-slate-800 text-slate-300'
                    }`}
                  >
                    {DIFFICULTY_LABELS[id]}
                  </button>
                ))}
              </div>
              <div
                className="flex flex-wrap items-center justify-center gap-2"
                role="group"
                aria-label="對手個性"
              >
                <span className="text-slate-400">個性</span>
                {PERSONALITY_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setPersonality(id);
                      resetBoard();
                    }}
                    aria-pressed={personality === id}
                    title={PERSONALITIES[id].blurb}
                    className={`px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation ${
                      personality === id
                        ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-100'
                        : 'border-slate-600 bg-slate-800 text-slate-300'
                    }`}
                  >
                    {PERSONALITIES[id].name}
                  </button>
                ))}
              </div>
              <p className="text-slate-500 text-center">
                {DIFFICULTY_BLURBS[difficulty]} · {PERSONALITIES[personality].blurb}
              </p>
            </div>
          )}
        </>
      )}

      {(screen === 'play' || activePuzzle) && (
        <>
          <div className="flex items-center justify-center gap-6 mb-2 text-sm">
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

          <p className="text-slate-200 text-sm mb-2">{statusMessage}</p>
          {rules.allowPopOut && humanCanAct && (
            <div
              className="flex items-center gap-2 mb-2 text-xs"
              role="group"
              aria-label="行動模式"
            >
              <button
                type="button"
                onClick={() => setActionMode('drop')}
                aria-pressed={actionMode === 'drop'}
                className={`px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation ${
                  actionMode === 'drop'
                    ? 'border-emerald-400 bg-emerald-500/20'
                    : 'border-slate-600 bg-slate-800'
                }`}
              >
                投下
              </button>
              <button
                type="button"
                onClick={() => setActionMode('pop')}
                aria-pressed={actionMode === 'pop'}
                disabled={popCols.length === 0}
                className={`px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation disabled:opacity-40 ${
                  actionMode === 'pop'
                    ? 'border-rose-400 bg-rose-500/20'
                    : 'border-slate-600 bg-slate-800'
                }`}
              >
                PopOut 取出
              </button>
            </div>
          )}
          <p className="text-slate-400 text-xs mb-2 md:hidden">
            {actionMode === 'pop' ? '點選底格己子欄位取出' : '點選上方欄位落子'}
          </p>

          <div
            className="inline-block p-3 rounded-xl shadow-lg w-full bg-cover bg-center"
            style={{
              maxWidth: boardMaxWidth,
              backgroundColor: '#1e3a8a',
              backgroundImage: [
                'linear-gradient(rgba(30,58,138,0.55), rgba(30,58,138,0.7))',
                `url(${import.meta.env.BASE_URL}frame.jpg)`,
              ].join(', '),
            }}
          >
            <div
              className="grid gap-1 mb-1"
              style={{ gridTemplateColumns: `repeat(${rules.cols}, 1fr)` }}
            >
              {Array.from({ length: rules.cols }, (_, c) => {
                const dropOk = legalDropSet.has(c) && actionMode === 'drop';
                const popOk = popSet.has(c) && actionMode === 'pop';
                const enabled = humanCanAct && (dropOk || popOk);
                const isHint = hintMove?.col === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleColumnClick(c)}
                    onMouseEnter={() => setHoverCol(c)}
                    onMouseLeave={() => setHoverCol(null)}
                    disabled={!enabled}
                    className={`
                      h-12 min-h-[48px] rounded-t-lg flex items-center justify-center transition-colors touch-manipulation
                      ${enabled ? 'bg-slate-600 hover:bg-slate-500' : 'bg-slate-800 cursor-not-allowed'}
                      ${hoverCol === c && enabled ? 'ring-2 ring-white/50' : ''}
                      ${isHint ? 'ring-2 ring-emerald-400 bg-emerald-600/40' : ''}
                      ${popOk ? 'ring-1 ring-rose-300/50' : ''}
                    `}
                    aria-label={
                      actionMode === 'pop'
                        ? `取出第 ${c + 1} 欄底子`
                        : `投入第 ${c + 1} 欄`
                    }
                  >
                    {enabled && actionMode === 'drop' && (
                      <span
                        className="w-6 h-6 rounded-full bg-cover bg-center opacity-80"
                        style={{
                          backgroundColor:
                            state.currentTurn === 'red' ? '#ef4444' : '#facc15',
                          backgroundImage: `url(${import.meta.env.BASE_URL}piece-${state.currentTurn}.jpg)`,
                        }}
                      />
                    )}
                    {enabled && actionMode === 'pop' && (
                      <span className="text-[10px] text-rose-200">取出</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div
              className="grid gap-1 rounded-b-lg overflow-hidden p-1 bg-cover bg-center"
              style={{
                gridTemplateColumns: `repeat(${rules.cols}, 1fr)`,
                gridTemplateRows: `repeat(${rules.rows}, 1fr)`,
                aspectRatio: `${rules.cols}/${rules.rows}`,
                backgroundColor: '#1e40af',
                backgroundImage: [
                  'linear-gradient(rgba(30,64,175,0.5), rgba(30,64,175,0.65))',
                  `url(${import.meta.env.BASE_URL}frame.jpg)`,
                ].join(', '),
              }}
            >
              {Array.from({ length: rules.rows * rules.cols }, (_, i) => {
                const row = Math.floor(i / rules.cols);
                const col = i % rules.cols;
                const cell = state.board[row][col];
                const isWinning = winningCells?.has(`${row},${col}`);
                const hintDropRow =
                  hintMove?.kind === 'drop'
                    ? getDropRow(state.board, hintMove.col, rules)
                    : null;
                const isHintCell =
                  hintMove?.kind === 'drop' &&
                  hintMove.col === col &&
                  hintDropRow === row;
                const isDropAnim =
                  dropFx && dropFx.row === row && dropFx.col === col;
                const dropFrom = isDropAnim
                  ? `-${(row + 1) * 100}%`
                  : undefined;
                return (
                  <div
                    key={`${row}-${col}`}
                    className={`rounded-full bg-slate-800 flex items-center justify-center aspect-square max-w-full ${
                      isWinning
                        ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-blue-800'
                        : ''
                    } ${isHintCell ? 'ring-2 ring-emerald-400' : ''}`}
                    style={{ minHeight: 0 }}
                  >
                    {cell && (
                      <span
                        key={isDropAnim ? dropFx.key : `${row}-${col}-${cell}`}
                        className={`w-[90%] h-[90%] rounded-full bg-cover bg-center ${
                          cell === 'red' ? 'ring-2 ring-red-400' : 'ring-2 ring-yellow-300'
                        } ${isWinning ? 'c4-win-glow' : ''} ${
                          isDropAnim ? 'c4-piece-drop' : ''
                        }`}
                        style={{
                          backgroundColor: cell === 'red' ? '#ef4444' : '#facc15',
                          backgroundImage: `url(${import.meta.env.BASE_URL}piece-${cell}.jpg)`,
                          ...(dropFrom ? { ['--c4-drop-from']: dropFrom } : {}),
                        }}
                      />
                    )}
                    {!cell && isHintCell && (
                      <span
                        className="w-[70%] h-[70%] rounded-full opacity-50 bg-cover bg-center"
                        style={{
                          backgroundColor:
                            state.currentTurn === 'red' ? '#ef4444' : '#facc15',
                          backgroundImage: `url(${import.meta.env.BASE_URL}piece-${state.currentTurn}.jpg)`,
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {showOverlay && (
        <ResultOverlay
          title={resultTitle}
          variant={resultVariant}
          badge={
            screen === 'puzzles'
              ? puzzleStatus === 'won'
                ? '破解'
                : '失敗'
              : state.winner === 'draw'
                ? '和局'
                : series.seriesOver
                  ? '系列賽'
                  : undefined
          }
          stats={
            screen === 'puzzles' && activePuzzle
              ? [
                  { label: '謎題', value: activePuzzle.name },
                  { label: '使用步數', value: String(puzzlePlies) },
                  {
                    label: '進度',
                    value: `${countSolvedPuzzles(puzzleProgress)}/${PUZZLES.length}`,
                  },
                ]
              : [
                  {
                    label: '模式',
                    value:
                      gameMode === 'bot'
                        ? `電腦 · ${PERSONALITIES[personality].name}`
                        : '雙人對戰',
                  },
                  {
                    label: '系列賽',
                    value: `${series.scores[0]}–${series.scores[1]} / ${series.target}`,
                  },
                  ...(gameMode === 'bot'
                    ? [
                        { label: '本模式', value: modeLabel },
                        {
                          label: '戰績',
                          value: `${modeStats.wins}勝 ${modeStats.losses}敗 ${modeStats.draws}和`,
                        },
                        { label: '連勝', value: String(modeStats.streak) },
                        { label: '最佳連勝', value: String(modeStats.bestStreak) },
                      ]
                    : []),
                ]
          }
          onPrimary={() => {
            if (screen === 'puzzles' && activePuzzle) {
              if (puzzleStatus === 'won') {
                const idx = PUZZLES.findIndex((p) => p.id === activePuzzle.id);
                const next = PUZZLES[idx + 1];
                if (next) openPuzzle(next);
                else {
                  setActivePuzzle(null);
                }
              } else {
                openPuzzle(activePuzzle);
              }
              return;
            }
            if (series.seriesOver) {
              startNewSeries();
            } else {
              resetBoard();
            }
            prevPhaseRef.current = 'playing';
          }}
          primaryLabel={
            screen === 'puzzles'
              ? puzzleStatus === 'won'
                ? '下一題'
                : '再試一次'
              : series.seriesOver
                ? '新系列賽'
                : '再玩一局'
          }
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
            <h2 id="connect4-rules-title" className="text-lg font-bold mb-3">
              規則說明
            </h2>
            <ul className="text-sm text-slate-200 space-y-2 list-disc pl-4">
              <li>
                經典：輪流選欄投下己色棋子，先連成 {rules.connectN}{' '}
                枚（橫／豎／斜）者勝。
              </li>
              <li>
                棋盤可選 7×6、8×7、9×7；五子勝改為先連五，預設 9×7。
              </li>
              <li>
                PopOut：回合可改為取出底格己子，該欄上方棋子下墜；重力後連線亦算勝。
              </li>
              <li>
                系列賽：先取得 N 場單局勝利者勝出（和局不計分）。
              </li>
              <li>
                電腦對手有三種個性（衝刺手／鐵壁／佈局師），風格與難度深度分開。
              </li>
              <li>謎題模式：在限定步數內取勝，進度存於本機。</li>
              <li>
                可悔棋、提示；對戰電腦的連勝與戰績依「變體 × 棋盤 ×
                難度」分開記錄。
              </li>
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

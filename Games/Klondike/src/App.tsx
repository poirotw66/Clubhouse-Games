import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { ScoreFlash } from '@clubhouse/shared/ScoreFlash';
import {
  playCard,
  playError,
  playGoal,
  playMove,
  playScore,
  playWin,
} from '@clubhouse/shared/synthAudio';
import { Card } from './components/Card';
import { EmptySlot } from './components/EmptySlot';
import { RulesModal } from './components/RulesModal';
import { StatsPanel } from './components/StatsPanel';
import { CardFlyLayer, type FlyCard } from './components/CardFlyLayer';
import { WinCascade } from './components/WinCascade';
import { GameState, DragSource, CardType } from './types';
import { dealDailySolvable, dealGame, dealSolvableGame, shuffleDeck } from './utils/deck';
import {
  canMoveToTableau,
  canMoveToFoundation,
  applyDraw,
  canAutoComplete,
  findFoundationAutoMove,
  findHint,
  isValidTableauStack,
  DrawCount,
  HintMove,
} from './utils/gameLogic';
import {
  canRecycle,
  initialScore,
  pointsFromFoundation,
  pointsRecycle,
  pointsReveal,
  pointsToFoundation,
  pointsWasteToTableau,
  scoreLabel,
  standardTimePenaltyTicks,
  standardWinBonus,
  type ScoreMode,
} from './utils/scoring';
import { computeStreak, dateKey, dailyBaseSeed } from './utils/daily';
import { CHALLENGES, evaluateChallenges, type ChallengeId } from './utils/challenges';
import {
  loadDaily,
  loadSettings,
  loadStats,
  recordDaily,
  recordGameResult,
  saveSettings,
  winRate,
  type KlondikeSettings,
  type KlondikeStats,
} from './utils/storage';
import {
  RotateCcw,
  Undo2,
  Bot,
  Square,
  Lightbulb,
  Info,
  BarChart3,
  Calendar,
} from 'lucide-react';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function clonePiles(state: GameState): Omit<GameState, 'history'> {
  return {
    tableau: state.tableau.map((col) => col.map((c) => ({ ...c }))),
    foundation: state.foundation.map((pile) => pile.map((c) => ({ ...c }))),
    waste: state.waste.map((c) => ({ ...c })),
    stock: state.stock.map((c) => ({ ...c })),
    seed: state.seed,
  };
}

function dealForSettings(settings: KlondikeSettings): GameState {
  if (settings.playDaily) {
    const seed = dailyBaseSeed(dateKey());
    return dealDailySolvable(seed, settings.drawCount);
  }
  if (settings.solvableOnly) {
    return dealSolvableGame(settings.drawCount);
  }
  return dealGame();
}

export default function App() {
  const [settings, setSettings] = useState<KlondikeSettings>(loadSettings);
  const [gameState, setGameState] = useState<GameState>(() => dealForSettings(loadSettings()));
  const [stats, setStats] = useState<KlondikeStats>(loadStats);
  const [dailyRecords, setDailyRecords] = useState(loadDaily);
  const [score, setScore] = useState(() => initialScore(loadSettings().scoreMode));
  const [moveCount, setMoveCount] = useState(0);
  const [recycleCount, setRecycleCount] = useState(0);
  const [usedUndo, setUsedUndo] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [timePenaltyThrough, setTimePenaltyThrough] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);
  const [isGameOverNoMoves, setIsGameOverNoMoves] = useState(false);
  const [draggingSource, setDraggingSource] = useState<DragSource | null>(null);
  const [selectedSource, setSelectedSource] = useState<DragSource | null>(null);
  const [hint, setHint] = useState<HintMove | null>(null);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [seedDraft, setSeedDraft] = useState(() => String(dealForSettings(loadSettings()).seed));
  const [flash, setFlash] = useState<{ text: string; tone: 'good' | 'bad' | 'neutral'; key: number } | null>(
    null,
  );
  const [flights, setFlights] = useState<FlyCard[]>([]);
  const [clearedThisWin, setClearedThisWin] = useState<ChallengeId[]>([]);
  const [resultRecorded, setResultRecorded] = useState(false);

  const noProgressCount = useRef(0);
  const autoCompleteIdle = useRef(0);
  const prevWonRef = useRef(false);
  const prevNoMovesRef = useRef(false);
  const timerActiveRef = useRef(true);
  const foundationRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scoreRef = useRef(score);
  const moveRef = useRef(moveCount);
  const recycleRef = useRef(recycleCount);
  const metaHistory = useRef<{ score: number; moves: number; recycles: number }[]>([]);

  const drawCount = settings.drawCount;
  const scoreMode = settings.scoreMode;
  const isBusy = isAutoPlaying || isAutoCompleting;
  const isGameWon = gameState.foundation.every((pile) => pile.length === 13);
  const dailyStreak = computeStreak(dailyRecords, dateKey());

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    moveRef.current = moveCount;
  }, [moveCount]);
  useEffect(() => {
    recycleRef.current = recycleCount;
  }, [recycleCount]);

  const bumpScore = useCallback((delta: number) => {
    if (delta === 0) return;
    setScore((s) => s + delta);
    setFlash({
      text: delta > 0 ? `+${delta}` : String(delta),
      tone: delta > 0 ? 'good' : 'bad',
      key: Date.now(),
    });
  }, []);

  const clearHint = () => setHint(null);

  const resetRuntime = (next: GameState, mode: ScoreMode = scoreMode) => {
    setGameState(next);
    setSeedDraft(String(next.seed));
    setScore(initialScore(mode));
    setMoveCount(0);
    setRecycleCount(0);
    setUsedUndo(false);
    setElapsedSec(0);
    setTimePenaltyThrough(0);
    setIsAutoPlaying(false);
    setIsAutoCompleting(false);
    setIsGameOverNoMoves(false);
    setSelectedSource(null);
    setHint(null);
    setClearedThisWin([]);
    setResultRecorded(false);
    setFlights([]);
    metaHistory.current = [];
    noProgressCount.current = 0;
    autoCompleteIdle.current = 0;
    timerActiveRef.current = true;
    prevWonRef.current = false;
  };

  const persistSettings = (next: KlondikeSettings) => {
    setSettings(next);
    saveSettings(next);
  };

  const startNewGame = useCallback(() => {
    resetRuntime(dealForSettings(settings), settings.scoreMode);
  }, [settings]);

  const redealSame = () => {
    if (settings.solvableOnly || settings.playDaily) {
      resetRuntime(
        settings.playDaily
          ? dealDailySolvable(dailyBaseSeed(dateKey()), drawCount)
          : dealSolvableGame(drawCount, gameState.seed),
        scoreMode,
      );
      return;
    }
    resetRuntime(dealGame(gameState.seed), scoreMode);
  };

  const dealSeedInput = () => {
    const n = Number(seedDraft.trim());
    if (!Number.isFinite(n)) return;
    const next = { ...settings, playDaily: false };
    persistSettings(next);
    if (next.solvableOnly) {
      resetRuntime(dealSolvableGame(drawCount, n >>> 0), next.scoreMode);
    } else {
      resetRuntime(dealGame(n >>> 0), next.scoreMode);
    }
  };

  const changeDrawCount = (n: DrawCount) => {
    if (n === drawCount) return;
    const next = { ...settings, drawCount: n };
    persistSettings(next);
    resetRuntime(dealForSettings(next), next.scoreMode);
  };

  const changeScoreMode = (mode: ScoreMode) => {
    if (mode === scoreMode) return;
    const next = { ...settings, scoreMode: mode };
    persistSettings(next);
    resetRuntime(dealForSettings(next), mode);
  };

  const toggleSolvable = () => {
    const next = { ...settings, solvableOnly: !settings.solvableOnly, playDaily: false };
    persistSettings(next);
    resetRuntime(dealForSettings(next), next.scoreMode);
  };

  const toggleDaily = () => {
    const next = {
      ...settings,
      playDaily: !settings.playDaily,
      solvableOnly: !settings.playDaily ? true : settings.solvableOnly,
    };
    persistSettings(next);
    resetRuntime(dealForSettings(next), next.scoreMode);
  };

  const sourcesEqual = (a: DragSource, b: DragSource): boolean => {
    if (a.type !== b.type) return false;
    if (a.type === 'tableau' && b.type === 'tableau') {
      return a.colIndex === b.colIndex && a.cardIndex === b.cardIndex;
    }
    if (a.type === 'foundation' && b.type === 'foundation') {
      return a.pileIndex === b.pileIndex;
    }
    return a.type === 'waste' && b.type === 'waste';
  };

  const canSelectSource = (source: DragSource): boolean => {
    const state = gameState;
    if (source.type === 'waste') return state.waste.length > 0;
    if (source.type === 'foundation') return state.foundation[source.pileIndex].length > 0;
    const col = state.tableau[source.colIndex];
    return col.length > 0 && col[source.cardIndex].faceUp && isValidTableauStack(col, source.cardIndex);
  };

  const spawnFlyToFoundation = (card: CardType, foundationIndex: number, sourceEl?: Element | null) => {
    const destEl = foundationRefs.current[foundationIndex];
    if (!sourceEl || !destEl) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const from = sourceEl.getBoundingClientRect();
    const to = destEl.getBoundingClientRect();
    const id = `${card.id}-${Date.now()}`;
    setFlights((prev) => [
      ...prev,
      {
        id,
        card,
        from: { x: from.left, y: from.top, w: from.width, h: from.height },
        to: { x: to.left, y: to.top, w: to.width, h: to.height },
      },
    ]);
  };

  const executeMove = (
    source: DragSource,
    target: { type: 'tableau' | 'foundation'; index: number },
    cardsToMove: CardType[],
    sourceEl?: Element | null,
  ) => {
    clearHint();
    let moveBonus = 0;
    if (target.type === 'foundation') {
      moveBonus += pointsToFoundation(scoreMode);
      if (sourceEl) spawnFlyToFoundation(cardsToMove[0]!, target.index, sourceEl);
    } else if (source.type === 'waste') {
      moveBonus += pointsWasteToTableau(scoreMode);
    } else if (source.type === 'foundation') {
      moveBonus += pointsFromFoundation(scoreMode);
    }

    let revealBonus = 0;
    if (source.type === 'tableau') {
      const col = gameState.tableau[source.colIndex];
      const beneath = source.cardIndex > 0 ? col[source.cardIndex - 1] : undefined;
      if (beneath && !beneath.faceUp) revealBonus = pointsReveal(scoreMode);
    }

    setGameState((prevState) => {
      const nextState = {
        ...prevState,
        tableau: prevState.tableau.map((col) => [...col]),
        foundation: prevState.foundation.map((pile) => [...pile]),
        waste: [...prevState.waste],
        stock: [...prevState.stock],
        history: [...prevState.history, clonePiles(prevState)],
      };

      if (source.type === 'tableau') {
        nextState.tableau[source.colIndex].splice(source.cardIndex);
        const col = nextState.tableau[source.colIndex];
        if (col.length > 0 && !col[col.length - 1].faceUp) {
          col[col.length - 1] = { ...col[col.length - 1], faceUp: true };
        }
      } else if (source.type === 'waste') {
        nextState.waste.pop();
      } else if (source.type === 'foundation') {
        nextState.foundation[source.pileIndex].pop();
      }

      if (target.type === 'tableau') {
        nextState.tableau[target.index].push(...cardsToMove);
      } else if (target.type === 'foundation') {
        nextState.foundation[target.index].push(...cardsToMove);
      }

      return nextState;
    });

    metaHistory.current.push({
      score: scoreRef.current,
      moves: moveRef.current,
      recycles: recycleRef.current,
    });
    setMoveCount((m) => m + 1);
    bumpScore(moveBonus + revealBonus);
    if (target.type === 'foundation') playScore();
    else playMove();
  };

  const attemptMove = (
    source: DragSource,
    target: { type: 'tableau' | 'foundation'; index: number },
    sourceEl?: Element | null,
  ) => {
    const state = gameState;
    let cardsToMove: CardType[] = [];

    if (source.type === 'tableau') {
      cardsToMove = state.tableau[source.colIndex].slice(source.cardIndex);
    } else if (source.type === 'waste') {
      if (state.waste.length === 0) return;
      cardsToMove = [state.waste[state.waste.length - 1]];
    } else if (source.type === 'foundation') {
      if (state.foundation[source.pileIndex].length === 0) return;
      cardsToMove = [
        state.foundation[source.pileIndex][state.foundation[source.pileIndex].length - 1],
      ];
    }

    if (cardsToMove.length === 0) return;
    const movingCard = cardsToMove[0];

    if (target.type === 'tableau') {
      const targetCol = state.tableau[target.index];
      const targetTopCard = targetCol.length > 0 ? targetCol[targetCol.length - 1] : undefined;
      if (canMoveToTableau(movingCard, targetTopCard)) {
        executeMove(source, target, cardsToMove, sourceEl);
      }
    } else if (target.type === 'foundation') {
      if (cardsToMove.length > 1) return;
      const targetPile = state.foundation[target.index];
      const targetTopCard = targetPile.length > 0 ? targetPile[targetPile.length - 1] : undefined;
      if (canMoveToFoundation(movingCard, targetTopCard)) {
        executeMove(source, target, cardsToMove, sourceEl);
      }
    }
  };

  const handleCardTap = (source: DragSource, el?: HTMLElement | null) => {
    if (isBusy) return;
    clearHint();
    if (selectedSource) {
      if (sourcesEqual(selectedSource, source)) {
        setSelectedSource(null);
        return;
      }
      if (source.type === 'tableau') {
        attemptMove(selectedSource, { type: 'tableau', index: source.colIndex }, el);
      } else if (source.type === 'foundation') {
        attemptMove(selectedSource, { type: 'foundation', index: source.pileIndex }, el);
      }
      setSelectedSource(null);
      return;
    }
    if (canSelectSource(source)) setSelectedSource(source);
  };

  const handleFoundationZoneTap = (pileIndex: number) => {
    if (isBusy || !selectedSource) return;
    clearHint();
    attemptMove(selectedSource, { type: 'foundation', index: pileIndex });
    setSelectedSource(null);
  };

  const handleTableauZoneTap = (colIndex: number) => {
    if (isBusy || !selectedSource) return;
    clearHint();
    attemptMove(selectedSource, { type: 'tableau', index: colIndex });
    setSelectedSource(null);
  };

  const handleDragStart = (e: React.DragEvent, source: DragSource) => {
    e.dataTransfer.setData('application/json', JSON.stringify(source));
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => setDraggingSource(source), 0);
  };

  const handleDragEnd = () => setDraggingSource(null);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropOnTableau = (e: React.DragEvent, colIndex: number) => {
    e.preventDefault();
    try {
      const source: DragSource = JSON.parse(e.dataTransfer.getData('application/json'));
      attemptMove(source, { type: 'tableau', index: colIndex });
    } catch {
      /* ignore */
    }
  };

  const handleDropOnFoundation = (e: React.DragEvent, pileIndex: number) => {
    e.preventDefault();
    try {
      const source: DragSource = JSON.parse(e.dataTransfer.getData('application/json'));
      attemptMove(source, { type: 'foundation', index: pileIndex }, e.currentTarget);
    } catch {
      /* ignore */
    }
  };

  const handleDoubleClick = (source: DragSource, el?: HTMLElement | null) => {
    if (isBusy) return;
    const state = gameState;
    let card: CardType | undefined;
    if (source.type === 'tableau') {
      const col = state.tableau[source.colIndex];
      if (source.cardIndex === col.length - 1) card = col[source.cardIndex];
    } else if (source.type === 'waste') {
      card = state.waste[state.waste.length - 1];
    }
    if (!card) return;
    for (let i = 0; i < 4; i++) {
      const pile = state.foundation[i];
      const topCard = pile.length > 0 ? pile[pile.length - 1] : undefined;
      if (canMoveToFoundation(card, topCard)) {
        executeMove(source, { type: 'foundation', index: i }, [card], el);
        return;
      }
    }
  };

  const drawCard = () => {
    clearHint();
    setGameState((prevState) => {
      if (prevState.stock.length === 0) return prevState;
      const drawn = applyDraw(prevState.stock, prevState.waste, drawCount);
      return {
        ...prevState,
        stock: drawn.stock,
        waste: drawn.waste,
        history: [...prevState.history, clonePiles(prevState)],
      };
    });
    metaHistory.current.push({
      score: scoreRef.current,
      moves: moveRef.current,
      recycles: recycleRef.current,
    });
    setMoveCount((m) => m + 1);
    playCard();
  };

  const recycleWaste = () => {
    if (!canRecycle(scoreMode, drawCount, recycleCount)) {
      playError();
      setFlash({ text: '無法再循環', tone: 'bad', key: Date.now() });
      return;
    }
    clearHint();
    const penalty = pointsRecycle(scoreMode, drawCount);
    setGameState((prevState) => {
      if (prevState.stock.length > 0 || prevState.waste.length === 0) return prevState;
      return {
        ...prevState,
        stock: [...prevState.waste].reverse().map((c) => ({ ...c, faceUp: false })),
        waste: [],
        history: [...prevState.history, clonePiles(prevState)],
      };
    });
    metaHistory.current.push({
      score: scoreRef.current,
      moves: moveRef.current,
      recycles: recycleRef.current,
    });
    setRecycleCount((c) => c + 1);
    setMoveCount((m) => m + 1);
    bumpScore(penalty);
    playCard();
  };

  const undo = () => {
    if (isBusy) return;
    clearHint();
    setGameState((prevState) => {
      if (prevState.history.length === 0) return prevState;
      const previous = prevState.history[prevState.history.length - 1];
      return { ...previous, history: prevState.history.slice(0, -1) };
    });
    const meta = metaHistory.current.pop();
    if (meta) {
      setScore(meta.score);
      setMoveCount(meta.moves);
      setRecycleCount(meta.recycles);
    }
    setUsedUndo(true);
  };

  const showHint = () => {
    if (isBusy || isGameWon) return;
    const move = findHint(gameState);
    setHint(move);
    if (!move) playError();
    else playGoal();
  };

  const isSourceHinted = (source: DragSource): boolean => {
    if (!hint || hint.kind !== 'move') return false;
    if (hint.source.type !== source.type) return false;
    if (source.type === 'waste') return true;
    if (source.type === 'foundation' && hint.source.type === 'foundation') {
      return hint.source.pileIndex === source.pileIndex;
    }
    if (source.type === 'tableau' && hint.source.type === 'tableau') {
      return (
        hint.source.colIndex === source.colIndex && source.cardIndex >= hint.source.cardIndex
      );
    }
    return false;
  };

  const isTargetHinted = (type: 'tableau' | 'foundation', index: number): boolean =>
    hint?.kind === 'move' && hint.target.type === type && hint.target.index === index;

  const checkCanMoveToFoundation = (card: CardType) => {
    for (let i = 0; i < 4; i++) {
      const pile = gameState.foundation[i];
      const topCard = pile.length > 0 ? pile[pile.length - 1] : undefined;
      if (canMoveToFoundation(card, topCard)) return true;
    }
    return false;
  };

  const checkHasMoves = (state: GameState): boolean => {
    if (findHint(state)) return true;
    if (state.stock.length > 0) return true;
    if (
      state.waste.length > 0 &&
      canRecycle(scoreMode, drawCount, recycleRef.current)
    ) {
      return true;
    }
    if (state.waste.length > 0 && state.stock.length === 0) {
      // Waste may still have tableau/foundation plays even if findHint missed edge cases.
      return Boolean(findHint(state));
    }
    return false;
  };

  useEffect(() => {
    if (!timerActiveRef.current || isGameWon || isGameOverNoMoves) return;
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [isGameWon, isGameOverNoMoves]);

  useEffect(() => {
    if (scoreMode !== 'standard' || isGameWon || isGameOverNoMoves) return;
    const { penalty, appliedThroughSec } = standardTimePenaltyTicks(elapsedSec, timePenaltyThrough);
    if (penalty !== 0) {
      setTimePenaltyThrough(appliedThroughSec);
      setScore((s) => s + penalty);
    }
  }, [elapsedSec, scoreMode, isGameWon, isGameOverNoMoves, timePenaltyThrough]);

  useEffect(() => {
    if (isGameWon) return;
    if (isAutoCompleting) {
      setIsGameOverNoMoves(false);
      return;
    }
    if (!checkHasMoves(gameState)) {
      setIsGameOverNoMoves(true);
      setIsAutoPlaying(false);
    } else {
      setIsGameOverNoMoves(false);
    }
  }, [gameState, isGameWon, isAutoCompleting, scoreMode, drawCount]);

  useEffect(() => {
    if (!isGameWon || prevWonRef.current || resultRecorded) {
      prevWonRef.current = isGameWon;
      return;
    }
    prevWonRef.current = true;
    playWin();
    timerActiveRef.current = false;
    setIsAutoCompleting(false);
    setIsAutoPlaying(false);

    let finalScore = scoreRef.current;
    if (scoreMode === 'standard') {
      const bonus = standardWinBonus(elapsedSec);
      if (bonus > 0) {
        finalScore += bonus;
        setScore(finalScore);
        setFlash({ text: `通關 +${bonus}`, tone: 'good', key: Date.now() });
      }
    }

    const cleared = evaluateChallenges({
      won: true,
      usedUndo,
      moves: moveRef.current,
      elapsedSec,
      score: finalScore,
      scoreMode,
    });
    setClearedThisWin(cleared);

    setStats((prev) =>
      recordGameResult(prev, {
        won: true,
        drawCount,
        scoreMode,
        score: finalScore,
        elapsedSec,
        moves: moveRef.current,
        clearedChallenges: cleared,
      }),
    );

    if (settings.playDaily) {
      setDailyRecords(
        recordDaily({
          date: dateKey(),
          won: true,
          score: finalScore,
          elapsedSec,
          moves: moveRef.current,
          drawCount,
          scoreMode,
        }),
      );
    }
    setResultRecorded(true);
  }, [
    isGameWon,
    resultRecorded,
    elapsedSec,
    scoreMode,
    drawCount,
    usedUndo,
    settings.playDaily,
  ]);

  useEffect(() => {
    if (!isGameOverNoMoves || isGameWon || resultRecorded) {
      prevNoMovesRef.current = isGameOverNoMoves;
      return;
    }
    if (isGameOverNoMoves && !prevNoMovesRef.current) {
      playError();
      setStats((prev) =>
        recordGameResult(prev, {
          won: false,
          drawCount,
          scoreMode,
          score: scoreRef.current,
          elapsedSec,
          moves: moveRef.current,
          clearedChallenges: [],
        }),
      );
      if (settings.playDaily) {
        setDailyRecords(
          recordDaily({
            date: dateKey(),
            won: false,
            score: scoreRef.current,
            elapsedSec,
            moves: moveRef.current,
            drawCount,
            scoreMode,
          }),
        );
      }
      setResultRecorded(true);
    }
    prevNoMovesRef.current = isGameOverNoMoves;
  }, [
    isGameOverNoMoves,
    isGameWon,
    resultRecorded,
    drawCount,
    scoreMode,
    elapsedSec,
    settings.playDaily,
  ]);

  useEffect(() => {
    if (isGameWon || isAutoPlaying || isGameOverNoMoves || isAutoCompleting) return;
    if (!canAutoComplete(gameState.tableau)) return;
    const offFoundation =
      gameState.tableau.some((col) => col.length > 0) ||
      gameState.stock.length > 0 ||
      gameState.waste.length > 0;
    if (offFoundation) {
      autoCompleteIdle.current = 0;
      setIsAutoCompleting(true);
    }
  }, [gameState, isGameWon, isAutoPlaying, isGameOverNoMoves, isAutoCompleting]);

  useEffect(() => {
    if (!isAutoCompleting || isGameWon) return;
    const timer = window.setTimeout(() => {
      const move = findFoundationAutoMove(gameState);
      if (move) {
        autoCompleteIdle.current = 0;
        executeMove(move.source, { type: 'foundation', index: move.foundationIndex }, move.cards);
        return;
      }
      if (gameState.stock.length > 0) {
        autoCompleteIdle.current += 1;
        if (autoCompleteIdle.current > 60) {
          setIsAutoCompleting(false);
          return;
        }
        drawCard();
        return;
      }
      if (gameState.waste.length > 0 && canRecycle(scoreMode, drawCount, recycleCount)) {
        autoCompleteIdle.current += 1;
        if (autoCompleteIdle.current > 60) {
          setIsAutoCompleting(false);
          return;
        }
        recycleWaste();
        return;
      }
      setIsAutoCompleting(false);
    }, 140);
    return () => window.clearTimeout(timer);
  }, [isAutoCompleting, gameState, isGameWon, scoreMode, drawCount, recycleCount]);

  const reshuffleBoard = () => {
    setGameState((prevState) => {
      const cardsToCollect: CardType[] = [];
      prevState.tableau.forEach((col) => cardsToCollect.push(...col));
      cardsToCollect.push(...prevState.stock);
      cardsToCollect.push(...prevState.waste);
      const shuffled = shuffleDeck(
        cardsToCollect.map((c) => ({ ...c, faceUp: false })),
        (prevState.seed + moveCount + 1) >>> 0,
      );
      const newTableau: CardType[][] = Array.from({ length: 7 }, () => []);
      let cardIndex = 0;
      for (let i = 0; i < 7; i++) {
        for (let j = i; j < 7; j++) {
          if (cardIndex < shuffled.length) {
            newTableau[j].push(shuffled[cardIndex]);
            cardIndex++;
          }
        }
      }
      for (let i = 0; i < 7; i++) {
        if (newTableau[i].length > 0) {
          newTableau[i][newTableau[i].length - 1].faceUp = true;
        }
      }
      return {
        ...prevState,
        tableau: newTableau,
        stock: shuffled.slice(cardIndex),
        waste: [],
        history: [...prevState.history, clonePiles(prevState)],
      };
    });
    setIsGameOverNoMoves(false);
    setIsAutoCompleting(false);
    setResultRecorded(false);
    clearHint();
  };

  const makeAutoMove = () => {
    const state = gameState;
    const doMove = (action: () => void, isProgress: boolean) => {
      if (isProgress) noProgressCount.current = 0;
      else noProgressCount.current += 1;
      action();
    };

    for (let c = 0; c < 7; c++) {
      const col = state.tableau[c];
      if (col.length === 0) continue;
      const card = col[col.length - 1];
      for (let f = 0; f < 4; f++) {
        const pile = state.foundation[f];
        const topF = pile.length > 0 ? pile[pile.length - 1] : undefined;
        if (canMoveToFoundation(card, topF)) {
          doMove(
            () =>
              executeMove(
                { type: 'tableau', colIndex: c, cardIndex: col.length - 1 },
                { type: 'foundation', index: f },
                [card],
              ),
            true,
          );
          return;
        }
      }
    }

    if (state.waste.length > 0) {
      const card = state.waste[state.waste.length - 1];
      for (let f = 0; f < 4; f++) {
        const topF =
          state.foundation[f].length > 0
            ? state.foundation[f][state.foundation[f].length - 1]
            : undefined;
        if (canMoveToFoundation(card, topF)) {
          doMove(() => executeMove({ type: 'waste' }, { type: 'foundation', index: f }, [card]), true);
          return;
        }
      }
      for (let c = 0; c < 7; c++) {
        const topT =
          state.tableau[c].length > 0
            ? state.tableau[c][state.tableau[c].length - 1]
            : undefined;
        if (canMoveToTableau(card, topT)) {
          doMove(() => executeMove({ type: 'waste' }, { type: 'tableau', index: c }, [card]), true);
          return;
        }
      }
    }

    for (let srcC = 0; srcC < 7; srcC++) {
      const srcCol = state.tableau[srcC];
      for (let cardIdx = 0; cardIdx < srcCol.length; cardIdx++) {
        const card = srcCol[cardIdx];
        if (!card.faceUp) continue;
        const isRevealing = cardIdx > 0 && !srcCol[cardIdx - 1].faceUp;
        const isKingToEmpty = card.rank === 'K' && cardIdx > 0;
        if (!isRevealing && !isKingToEmpty) continue;
        for (let tgtC = 0; tgtC < 7; tgtC++) {
          if (srcC === tgtC) continue;
          const topT =
            state.tableau[tgtC].length > 0
              ? state.tableau[tgtC][state.tableau[tgtC].length - 1]
              : undefined;
          if (canMoveToTableau(card, topT)) {
            const cardsToMove = srcCol.slice(cardIdx);
            doMove(
              () =>
                executeMove(
                  { type: 'tableau', colIndex: srcC, cardIndex: cardIdx },
                  { type: 'tableau', index: tgtC },
                  cardsToMove,
                ),
              true,
            );
            return;
          }
        }
      }
    }

    if (state.stock.length > 0) {
      doMove(() => drawCard(), false);
      return;
    }
    if (state.waste.length > 0 && canRecycle(scoreMode, drawCount, recycleCount)) {
      doMove(() => recycleWaste(), false);
      return;
    }
    setIsAutoPlaying(false);
  };

  useEffect(() => {
    if (!isAutoPlaying || isGameWon || isAutoCompleting) return;
    if (noProgressCount.current > 100) {
      setIsAutoPlaying(false);
      noProgressCount.current = 0;
      return;
    }
    const timer = setTimeout(() => makeAutoMove(), 150);
    return () => clearTimeout(timer);
  }, [isAutoPlaying, gameState, isGameWon, isAutoCompleting]);

  const modeBest = stats.byMode[`${drawCount}-${scoreMode}`];

  return (
    <div
      className="min-h-screen text-white p-4 md:p-8 font-sans select-none bg-cover bg-center"
      style={{
        backgroundColor: '#065f46',
        backgroundImage: [
          'linear-gradient(rgba(6,95,70,0.55), rgba(6,78,59,0.75))',
          `url(${import.meta.env.BASE_URL}felt.jpg)`,
        ].join(', '),
      }}
    >
      <BackToMenu />
      <div className="max-w-5xl mx-auto relative">
        {flash && (
          <div className="absolute left-1/2 top-24 -translate-x-1/2 z-30 w-40 h-20">
            <ScoreFlash
              text={flash.text}
              tone={flash.tone}
              flashKey={flash.key}
              onDone={() => setFlash(null)}
            />
          </div>
        )}

        <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">接龍</h1>
            <p className="text-sm text-white/70 mt-1 tabular-nums">
              {scoreLabel(scoreMode)} {score}
              {scoreMode === 'vegas' ? ` · 籌碼 ${stats.vegasBankroll}` : ''}
              {' · '}
              時間 {formatTime(elapsedSec)}
              {' · '}
              步數 {moveCount}
              {' · '}
              勝率 {Math.round(winRate(stats) * 100)}%
              {settings.playDaily ? ` · 每日連勝 ${dailyStreak}` : ''}
            </p>
            <p className="text-xs text-white/50 mt-0.5 tabular-nums">
              最佳分 {modeBest?.bestScore ?? '—'}
              {' · '}
              最佳時間{' '}
              {modeBest?.bestTimeSec == null ? '—' : formatTime(modeBest.bestTimeSec)}
              {' · '}
              連勝 {stats.currentStreak}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
            <div className="flex rounded-lg overflow-hidden border border-white/20">
              <button
                type="button"
                onClick={() => changeDrawCount(1)}
                disabled={isBusy}
                className={`min-h-[44px] min-w-[44px] px-3 py-2 text-sm touch-manipulation ${drawCount === 1 ? 'bg-white text-emerald-900 font-semibold' : 'bg-black/20 hover:bg-black/30'}`}
              >
                翻 1
              </button>
              <button
                type="button"
                onClick={() => changeDrawCount(3)}
                disabled={isBusy}
                className={`min-h-[44px] min-w-[44px] px-3 py-2 text-sm touch-manipulation ${drawCount === 3 ? 'bg-white text-emerald-900 font-semibold' : 'bg-black/20 hover:bg-black/30'}`}
              >
                翻 3
              </button>
            </div>
            <div className="flex rounded-lg overflow-hidden border border-white/20">
              <button
                type="button"
                onClick={() => changeScoreMode('standard')}
                disabled={isBusy}
                className={`min-h-[44px] px-3 py-2 text-sm touch-manipulation ${scoreMode === 'standard' ? 'bg-white text-emerald-900 font-semibold' : 'bg-black/20'}`}
              >
                標準
              </button>
              <button
                type="button"
                onClick={() => changeScoreMode('vegas')}
                disabled={isBusy}
                className={`min-h-[44px] px-3 py-2 text-sm touch-manipulation ${scoreMode === 'vegas' ? 'bg-white text-emerald-900 font-semibold' : 'bg-black/20'}`}
              >
                維加斯
              </button>
            </div>
            <button
              type="button"
              onClick={toggleSolvable}
              disabled={isBusy || settings.playDaily}
              className={`min-h-[44px] px-3 py-2 rounded-lg text-sm touch-manipulation ${settings.solvableOnly ? 'bg-amber-400/90 text-emerald-950 font-semibold' : 'bg-black/20'}`}
              title="保證可解發牌"
            >
              可解局
            </button>
            <button
              type="button"
              onClick={toggleDaily}
              disabled={isBusy}
              id="klondike-daily"
              className={`flex items-center gap-1 min-h-[44px] px-3 py-2 rounded-lg text-sm touch-manipulation ${settings.playDaily ? 'bg-sky-400/90 text-emerald-950 font-semibold' : 'bg-black/20'}`}
            >
              <Calendar size={18} /> 每日
            </button>
            <button
              type="button"
              onClick={() => setIsStatsOpen(true)}
              className="flex items-center gap-1 min-h-[44px] px-3 py-2 bg-black/20 rounded-lg touch-manipulation"
              aria-label="戰績"
            >
              <BarChart3 size={18} />
              <span className="hidden sm:inline">戰績</span>
            </button>
            <button
              type="button"
              onClick={() => setIsRulesOpen(true)}
              className="flex items-center gap-1 min-h-[44px] px-3 py-2 bg-black/20 rounded-lg touch-manipulation"
              aria-label="規則"
            >
              <Info size={18} />
              <span className="hidden sm:inline">規則</span>
            </button>
            <button
              type="button"
              onClick={showHint}
              disabled={isBusy || isGameWon}
              className="flex items-center gap-1 min-h-[44px] px-3 py-2 bg-black/20 rounded-lg disabled:opacity-50 touch-manipulation"
              aria-label="提示"
            >
              <Lightbulb size={18} />
              <span className="hidden sm:inline">提示</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAutoPlaying(!isAutoPlaying);
                setIsAutoCompleting(false);
                noProgressCount.current = 0;
                clearHint();
              }}
              className={`flex items-center gap-1 min-h-[44px] px-3 py-2 rounded-lg touch-manipulation ${isAutoPlaying ? 'bg-red-500/80' : 'bg-blue-500/80'}`}
              aria-label={isAutoPlaying ? '停止自動' : '自動玩'}
            >
              {isAutoPlaying ? <Square size={18} /> : <Bot size={18} />}
              <span className="hidden sm:inline">{isAutoPlaying ? '停止' : '自動'}</span>
            </button>
            <button
              type="button"
              onClick={undo}
              disabled={gameState.history.length === 0 || isBusy}
              className="flex items-center gap-1 min-h-[44px] px-3 py-2 bg-black/20 rounded-lg disabled:opacity-50 touch-manipulation"
              aria-label="復原"
            >
              <Undo2 size={18} />
              <span className="hidden sm:inline">復原</span>
            </button>
            <button
              type="button"
              onClick={startNewGame}
              className="flex items-center gap-1 min-h-[44px] px-3 py-2 bg-black/20 rounded-lg touch-manipulation"
              aria-label="新局"
            >
              <RotateCcw size={18} />
              <span className="hidden sm:inline">新局</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
          <label className="sr-only" htmlFor="klondike-seed">
            局號
          </label>
          <input
            id="klondike-seed"
            type="text"
            inputMode="numeric"
            value={seedDraft}
            onChange={(e) => setSeedDraft(e.target.value)}
            disabled={settings.playDaily || isBusy}
            className="min-h-[44px] w-28 px-3 rounded-lg bg-black/30 border border-white/20 tabular-nums"
          />
          <button
            type="button"
            onClick={dealSeedInput}
            disabled={settings.playDaily || isBusy}
            className="min-h-[44px] px-3 rounded-lg bg-black/20 touch-manipulation disabled:opacity-50"
          >
            發此局
          </button>
          <button
            type="button"
            onClick={redealSame}
            disabled={isBusy}
            className="min-h-[44px] px-3 rounded-lg bg-black/20 touch-manipulation"
          >
            重新發同局
          </button>
          {settings.playDaily && (
            <span className="text-sky-200/90">今日挑戰（台北時間）· {dateKey()}</span>
          )}
        </div>

        {isAutoCompleting && !isGameWon && (
          <p className="mb-4 text-sm text-emerald-200/90">自動完成中…</p>
        )}

        <div className="flex justify-between mb-12 gap-4 overflow-x-auto pb-4">
          <div className="flex gap-4 shrink-0">
            <div
              onClick={() => {
                if (isBusy) return;
                if (gameState.stock.length > 0) drawCard();
                else recycleWaste();
              }}
              className={`cursor-pointer shrink-0 ${hint?.kind === 'draw' || hint?.kind === 'recycle' ? 'ring-4 ring-sky-400 rounded-xl' : ''}`}
            >
              {gameState.stock.length > 0 ? (
                <Card faceDown isHinted={hint?.kind === 'draw'} />
              ) : (
                <div className="w-16 h-24 sm:w-24 sm:h-36 rounded-xl border-2 border-black/20 flex items-center justify-center hover:bg-black/10 touch-manipulation">
                  <RotateCcw className="text-black/30" size={32} />
                </div>
              )}
            </div>

            <div className="relative w-16 h-24 sm:w-24 sm:h-36 shrink-0">
              {gameState.waste.length === 0 ? (
                <EmptySlot />
              ) : (
                gameState.waste.map((card, index) => {
                  if (index < gameState.waste.length - 3) return null;
                  const displayIndex = index - Math.max(0, gameState.waste.length - 3);
                  const isTop = index === gameState.waste.length - 1;
                  const wasteSource: DragSource = { type: 'waste' };
                  return (
                    <div
                      key={card.id}
                      className="absolute top-0 left-0"
                      style={{ transform: `translateX(${displayIndex * 12}px)` }}
                    >
                      <Card
                        card={card}
                        isDraggable={isTop && !isBusy}
                        isDragging={draggingSource?.type === 'waste' && isTop}
                        isSelected={selectedSource?.type === 'waste' && isTop}
                        isHinted={isTop && isSourceHinted(wasteSource)}
                        isPlayableToFoundation={isTop && checkCanMoveToFoundation(card)}
                        onDragStart={(e) => isTop && !isBusy && handleDragStart(e, wasteSource)}
                        onDragEnd={handleDragEnd}
                        onClick={(el) => isTop && handleCardTap(wasteSource, el)}
                        onDoubleClick={(el) => isTop && handleDoubleClick(wasteSource, el)}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="flex gap-4 shrink-0 ml-auto">
            {gameState.foundation.map((pile, index) => (
              <div
                key={`foundation-${index}`}
                ref={(el) => {
                  foundationRefs.current[index] = el;
                }}
                className={`relative w-16 h-24 sm:w-24 sm:h-36 shrink-0 ${isTargetHinted('foundation', index) ? 'ring-4 ring-sky-400 rounded-xl' : ''}`}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnFoundation(e, index)}
                onClick={() => handleFoundationZoneTap(index)}
              >
                <EmptySlot />
                {pile.map((card, cardIndex) => {
                  const isTop = cardIndex === pile.length - 1;
                  const foundationSource: DragSource = { type: 'foundation', pileIndex: index };
                  return (
                    <div key={card.id} className="absolute top-0 left-0">
                      <Card
                        card={card}
                        isDraggable={isTop && !isBusy}
                        isDragging={
                          draggingSource?.type === 'foundation' &&
                          draggingSource.pileIndex === index &&
                          isTop
                        }
                        isSelected={
                          selectedSource?.type === 'foundation' &&
                          selectedSource.pileIndex === index &&
                          isTop
                        }
                        onDragStart={(e) => handleDragStart(e, foundationSource)}
                        onDragEnd={handleDragEnd}
                        onClick={() => isTop && handleCardTap(foundationSource)}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-between gap-2 sm:gap-4 overflow-x-auto pb-8">
          {gameState.tableau.map((col, colIndex) => (
            <div
              key={`tableau-${colIndex}`}
              className={`relative w-16 sm:w-24 min-h-[50vh] shrink-0 ${isTargetHinted('tableau', colIndex) ? 'ring-4 ring-sky-400/80 rounded-xl' : ''}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropOnTableau(e, colIndex)}
              onClick={() => col.length === 0 && handleTableauZoneTap(colIndex)}
            >
              {col.length === 0 && <EmptySlot onClick={() => handleTableauZoneTap(colIndex)} />}
              {col.map((card, cardIndex) => {
                const isBottom = cardIndex === col.length - 1;
                const tableauSource: DragSource = { type: 'tableau', colIndex, cardIndex };
                const isSelected =
                  selectedSource?.type === 'tableau' &&
                  selectedSource.colIndex === colIndex &&
                  cardIndex >= selectedSource.cardIndex;
                return (
                  <div
                    key={card.id}
                    className="absolute top-0 left-0"
                    style={{
                      top: `${col.slice(0, cardIndex).reduce((acc, c) => acc + (c.faceUp ? 20 : 10), 0)}px`,
                    }}
                  >
                    <Card
                      card={card}
                      isDraggable={card.faceUp && !isBusy}
                      isDragging={
                        draggingSource?.type === 'tableau' &&
                        draggingSource.colIndex === colIndex &&
                        cardIndex >= draggingSource.cardIndex
                      }
                      isSelected={isSelected}
                      isHinted={isSourceHinted(tableauSource)}
                      isPlayableToFoundation={isBottom && checkCanMoveToFoundation(card)}
                      onDragStart={(e) => card.faceUp && handleDragStart(e, tableauSource)}
                      onDragEnd={handleDragEnd}
                      onClick={(el) => card.faceUp && handleCardTap(tableauSource, el)}
                      onDoubleClick={(el) => card.faceUp && handleDoubleClick(tableauSource, el)}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <CardFlyLayer
        flights={flights}
        onFlightDone={(id) => setFlights((prev) => prev.filter((f) => f.id !== id))}
      />
      <WinCascade active={isGameWon} foundations={gameState.foundation} />

      {isGameWon && (
        <ResultOverlay
          title="你贏了！"
          variant="win"
          subtitle={
            clearedThisWin.length > 0
              ? `挑戰達成：${clearedThisWin
                  .map((id) => CHALLENGES.find((c) => c.id === id)?.name)
                  .filter(Boolean)
                  .join('、')}`
              : settings.playDaily
                ? `每日挑戰完成 · 連續 ${computeStreak(dailyRecords, dateKey())} 天`
                : '恭喜完成接龍'
          }
          stats={[
            { label: '分數', value: score },
            { label: '本局時間', value: formatTime(elapsedSec) },
            { label: '步數', value: moveCount },
            { label: '勝率', value: `${Math.round(winRate(stats) * 100)}%` },
            {
              label: scoreMode === 'vegas' ? '累計籌碼' : '連勝',
              value: scoreMode === 'vegas' ? stats.vegasBankroll : stats.currentStreak,
            },
          ]}
          onPrimary={startNewGame}
          secondaryLabel="重新發同局"
          onSecondary={redealSame}
        />
      )}

      {isGameOverNoMoves && !isGameWon && (
        <ResultOverlay
          title="無法再移動"
          variant="lose"
          subtitle={
            scoreMode === 'vegas'
              ? `本局 ${score} · 累計籌碼 ${stats.vegasBankroll}`
              : '也可從上方工具列開新局或復原'
          }
          stats={[
            { label: '分數', value: score },
            { label: '步數', value: moveCount },
          ]}
          primaryLabel="重新洗牌"
          onPrimary={reshuffleBoard}
          secondaryLabel="新局"
          onSecondary={startNewGame}
        />
      )}

      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
      <StatsPanel
        open={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        stats={stats}
        daily={dailyRecords}
        drawCount={drawCount}
        scoreMode={scoreMode}
      />
    </div>
  );
}

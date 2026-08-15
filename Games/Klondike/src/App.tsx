import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playCard, playError, playMove, playScore, playWin } from '@clubhouse/shared/synthAudio';
import { Card } from './components/Card';
import { EmptySlot } from './components/EmptySlot';
import { GameState, DragSource, CardType } from './types';
import { dealGame, shuffleDeck } from './utils/deck';
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
import { RotateCcw, Undo2, Bot, Square, Lightbulb, Info } from 'lucide-react';
import { RulesModal } from './components/RulesModal';

const STATS_KEY = 'clubhouse-klondike-stats';
const DRAW_KEY = 'clubhouse-klondike-draw';

interface Stats {
  wins: number;
  /** Best clear time (seconds) keyed by draw mode. */
  bestByDraw: { '1': number | null; '3': number | null };
}

function emptyBests(): Stats['bestByDraw'] {
  return { '1': null, '3': null };
}

function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { wins: 0, bestByDraw: emptyBests() };
    const parsed = JSON.parse(raw) as Partial<Stats> & { bestTimeSec?: number | null };
    const bestByDraw = emptyBests();
    if (parsed.bestByDraw && typeof parsed.bestByDraw === 'object') {
      const b = parsed.bestByDraw as Record<string, unknown>;
      for (const key of ['1', '3'] as const) {
        const v = b[key];
        bestByDraw[key] = v == null || !Number.isFinite(Number(v)) ? null : Number(v);
      }
    } else if (parsed.bestTimeSec != null && Number.isFinite(Number(parsed.bestTimeSec))) {
      // Legacy single best → attribute to draw-1.
      bestByDraw['1'] = Number(parsed.bestTimeSec);
    }
    return {
      wins: Number(parsed.wins) || 0,
      bestByDraw,
    };
  } catch {
    return { wins: 0, bestByDraw: emptyBests() };
  }
}

function loadDrawCount(): DrawCount {
  const raw = localStorage.getItem(DRAW_KEY);
  return raw === '3' ? 3 : 1;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function bestForDraw(stats: Stats, draw: DrawCount): number | null {
  return stats.bestByDraw[String(draw) as '1' | '3'];
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>(dealGame());
  const [drawCount, setDrawCount] = useState<DrawCount>(loadDrawCount);
  const [stats, setStats] = useState<Stats>(loadStats);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isAutoCompleting, setIsAutoCompleting] = useState(false);
  const [isGameOverNoMoves, setIsGameOverNoMoves] = useState(false);
  const [draggingSource, setDraggingSource] = useState<DragSource | null>(null);
  const [selectedSource, setSelectedSource] = useState<DragSource | null>(null);
  const [hint, setHint] = useState<HintMove | null>(null);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const noProgressCount = useRef(0);
  const autoCompleteIdle = useRef(0);
  const prevWonRef = useRef(false);
  const prevNoMovesRef = useRef(false);
  const timerActiveRef = useRef(true);

  const isBusy = isAutoPlaying || isAutoCompleting;
  const isGameWon = gameState.foundation.every((pile) => pile.length === 13);

  const clearHint = () => setHint(null);

  const startNewGame = useCallback(() => {
    setGameState(dealGame());
    setIsAutoPlaying(false);
    setIsAutoCompleting(false);
    setIsGameOverNoMoves(false);
    setSelectedSource(null);
    setHint(null);
    setElapsedSec(0);
    noProgressCount.current = 0;
    autoCompleteIdle.current = 0;
    timerActiveRef.current = true;
  }, []);

  const changeDrawCount = (n: DrawCount) => {
    if (n === drawCount) return;
    setDrawCount(n);
    localStorage.setItem(DRAW_KEY, String(n));
    clearHint();
    // Restart so the timer matches the selected draw mode.
    startNewGame();
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
    if (source.type === 'waste') {
      return state.waste.length > 0;
    }
    if (source.type === 'foundation') {
      return state.foundation[source.pileIndex].length > 0;
    }
    const col = state.tableau[source.colIndex];
    return col.length > 0 && col[source.cardIndex].faceUp && isValidTableauStack(col, source.cardIndex);
  };

  const handleCardTap = (source: DragSource) => {
    if (isBusy) return;
    clearHint();

    if (selectedSource) {
      if (sourcesEqual(selectedSource, source)) {
        setSelectedSource(null);
        return;
      }
      if (source.type === 'tableau') {
        attemptMove(selectedSource, { type: 'tableau', index: source.colIndex });
      } else if (source.type === 'foundation') {
        attemptMove(selectedSource, { type: 'foundation', index: source.pileIndex });
      }
      setSelectedSource(null);
      return;
    }

    if (canSelectSource(source)) {
      setSelectedSource(source);
    }
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

  const saveHistory = (state: GameState) => {
    return {
      tableau: state.tableau.map((col) => col.map((c) => ({ ...c }))),
      foundation: state.foundation.map((pile) => pile.map((c) => ({ ...c }))),
      waste: state.waste.map((c) => ({ ...c })),
      stock: state.stock.map((c) => ({ ...c })),
    };
  };

  const executeMove = (
    source: DragSource,
    target: { type: 'tableau' | 'foundation'; index: number },
    cardsToMove: CardType[],
  ) => {
    clearHint();
    setGameState((prevState) => {
      const nextState = {
        ...prevState,
        tableau: prevState.tableau.map((col) => [...col]),
        foundation: prevState.foundation.map((pile) => [...pile]),
        waste: [...prevState.waste],
        stock: [...prevState.stock],
        history: [...prevState.history, saveHistory(prevState)],
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
    if (target.type === 'foundation') playScore();
    else playMove();
  };

  const attemptMove = (source: DragSource, target: { type: 'tableau' | 'foundation'; index: number }) => {
    const state = gameState;
    let cardsToMove: CardType[] = [];

    if (source.type === 'tableau') {
      cardsToMove = state.tableau[source.colIndex].slice(source.cardIndex);
    } else if (source.type === 'waste') {
      if (state.waste.length === 0) return;
      cardsToMove = [state.waste[state.waste.length - 1]];
    } else if (source.type === 'foundation') {
      if (state.foundation[source.pileIndex].length === 0) return;
      cardsToMove = [state.foundation[source.pileIndex][state.foundation[source.pileIndex].length - 1]];
    }

    if (cardsToMove.length === 0) return;

    const movingCard = cardsToMove[0];

    if (target.type === 'tableau') {
      const targetCol = state.tableau[target.index];
      const targetTopCard = targetCol.length > 0 ? targetCol[targetCol.length - 1] : undefined;
      if (canMoveToTableau(movingCard, targetTopCard)) {
        executeMove(source, target, cardsToMove);
      }
    } else if (target.type === 'foundation') {
      if (cardsToMove.length > 1) return;
      const targetPile = state.foundation[target.index];
      const targetTopCard = targetPile.length > 0 ? targetPile[targetPile.length - 1] : undefined;
      if (canMoveToFoundation(movingCard, targetTopCard)) {
        executeMove(source, target, cardsToMove);
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, source: DragSource) => {
    e.dataTransfer.setData('application/json', JSON.stringify(source));
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => setDraggingSource(source), 0);
  };

  const handleDragEnd = () => {
    setDraggingSource(null);
  };

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
      // ignore invalid drops
    }
  };

  const handleDropOnFoundation = (e: React.DragEvent, pileIndex: number) => {
    e.preventDefault();
    try {
      const source: DragSource = JSON.parse(e.dataTransfer.getData('application/json'));
      attemptMove(source, { type: 'foundation', index: pileIndex });
    } catch {
      // ignore invalid drops
    }
  };

  const handleDoubleClick = (source: DragSource) => {
    if (isBusy) return;
    const state = gameState;
    let card: CardType | undefined;

    if (source.type === 'tableau') {
      const col = state.tableau[source.colIndex];
      if (source.cardIndex === col.length - 1) {
        card = col[source.cardIndex];
      }
    } else if (source.type === 'waste') {
      card = state.waste[state.waste.length - 1];
    }

    if (!card) return;

    for (let i = 0; i < 4; i++) {
      const pile = state.foundation[i];
      const topCard = pile.length > 0 ? pile[pile.length - 1] : undefined;
      if (canMoveToFoundation(card, topCard)) {
        executeMove(source, { type: 'foundation', index: i }, [card]);
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
        history: [...prevState.history, saveHistory(prevState)],
      };
    });
    playCard();
  };

  const recycleWaste = () => {
    clearHint();
    setGameState((prevState) => {
      if (prevState.stock.length > 0 || prevState.waste.length === 0) return prevState;

      return {
        ...prevState,
        stock: [...prevState.waste].reverse().map((c) => ({ ...c, faceUp: false })),
        waste: [],
        history: [...prevState.history, saveHistory(prevState)],
      };
    });
    playCard();
  };

  const undo = () => {
    if (isBusy) return;
    clearHint();
    setGameState((prevState) => {
      if (prevState.history.length === 0) return prevState;
      const previous = prevState.history[prevState.history.length - 1];
      return {
        ...previous,
        history: prevState.history.slice(0, -1),
      };
    });
  };

  const showHint = () => {
    if (isBusy || isGameWon) return;
    const move = findHint(gameState);
    setHint(move);
    if (!move) playError();
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

  const isTargetHinted = (type: 'tableau' | 'foundation', index: number): boolean => {
    return hint?.kind === 'move' && hint.target.type === type && hint.target.index === index;
  };

  const checkCanMoveToFoundation = (card: CardType) => {
    for (let i = 0; i < 4; i++) {
      const pile = gameState.foundation[i];
      const topCard = pile.length > 0 ? pile[pile.length - 1] : undefined;
      if (canMoveToFoundation(card, topCard)) {
        return true;
      }
    }
    return false;
  };

  const checkHasMoves = (state: GameState): boolean => {
    if (findHint(state)) return true;

    // Face-down stock / buried waste cards may become playable after draws.
    if (state.stock.length > 0 || state.waste.length > 0) return true;

    for (let c = 0; c < 7; c++) {
      const col = state.tableau[c];
      if (col.length === 0) continue;

      const topCard = col[col.length - 1];
      for (let f = 0; f < 4; f++) {
        const pile = state.foundation[f];
        const topF = pile.length > 0 ? pile[pile.length - 1] : undefined;
        if (canMoveToFoundation(topCard, topF)) return true;
      }

      for (let cardIdx = 0; cardIdx < col.length; cardIdx++) {
        const card = col[cardIdx];
        if (!card.faceUp) continue;

        for (let tgtC = 0; tgtC < 7; tgtC++) {
          if (c === tgtC) continue;
          const tgtCol = state.tableau[tgtC];
          const topT = tgtCol.length > 0 ? tgtCol[tgtCol.length - 1] : undefined;

          if (canMoveToTableau(card, topT)) {
            if (cardIdx > 0 && !col[cardIdx - 1].faceUp) return true;
            if (card.rank === 'K' && cardIdx > 0 && tgtCol.length === 0) return true;
            if (cardIdx > 0 && col[cardIdx - 1].faceUp) {
              const exposedCard = col[cardIdx - 1];
              for (let f = 0; f < 4; f++) {
                const pile = state.foundation[f];
                const topF = pile.length > 0 ? pile[pile.length - 1] : undefined;
                if (canMoveToFoundation(exposedCard, topF)) return true;
              }
            }
          }
        }
      }
    }
    return false;
  };

  useEffect(() => {
    if (!timerActiveRef.current || isGameWon || isGameOverNoMoves) return;
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [isGameWon, isGameOverNoMoves]);

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
  }, [gameState, isGameWon, isAutoCompleting]);

  useEffect(() => {
    if (isGameWon && !prevWonRef.current) {
      playWin();
      timerActiveRef.current = false;
      setIsAutoCompleting(false);
      setIsAutoPlaying(false);
      setStats((prev) => {
        const key = String(drawCount) as '1' | '3';
        const prevBest = prev.bestByDraw[key];
        const next: Stats = {
          wins: prev.wins + 1,
          bestByDraw: {
            ...prev.bestByDraw,
            [key]: prevBest == null ? elapsedSec : Math.min(prevBest, elapsedSec),
          },
        };
        localStorage.setItem(STATS_KEY, JSON.stringify(next));
        return next;
      });
    }
    prevWonRef.current = isGameWon;
  }, [isGameWon, elapsedSec, drawCount]);

  useEffect(() => {
    if (isGameOverNoMoves && !prevNoMovesRef.current) playError();
    prevNoMovesRef.current = isGameOverNoMoves;
  }, [isGameOverNoMoves]);

  // Auto-complete when all tableau cards are face-up.
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
      // Draw through stock/waste looking for foundation plays; bail if no progress.
      if (gameState.stock.length > 0) {
        autoCompleteIdle.current += 1;
        if (autoCompleteIdle.current > 60) {
          setIsAutoCompleting(false);
          return;
        }
        drawCard();
        return;
      }
      if (gameState.waste.length > 0) {
        autoCompleteIdle.current += 1;
        if (autoCompleteIdle.current > 60) {
          setIsAutoCompleting(false);
          return;
        }
        recycleWaste();
        return;
      }
      setIsAutoCompleting(false);
    }, 120);

    return () => window.clearTimeout(timer);
  }, [isAutoCompleting, gameState, isGameWon]);

  const reshuffleBoard = () => {
    setGameState((prevState) => {
      const cardsToCollect: CardType[] = [];
      prevState.tableau.forEach((col) => cardsToCollect.push(...col));
      cardsToCollect.push(...prevState.stock);
      cardsToCollect.push(...prevState.waste);

      const cardsToShuffle = cardsToCollect.map((c) => ({ ...c, faceUp: false }));
      const shuffled = shuffleDeck(cardsToShuffle);

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

      const newStock = shuffled.slice(cardIndex);

      return {
        ...prevState,
        tableau: newTableau,
        stock: newStock,
        waste: [],
        history: [...prevState.history, saveHistory(prevState)],
      };
    });
    setIsGameOverNoMoves(false);
    setIsAutoCompleting(false);
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
        const pile = state.foundation[f];
        const topF = pile.length > 0 ? pile[pile.length - 1] : undefined;
        if (canMoveToFoundation(card, topF)) {
          doMove(() => executeMove({ type: 'waste' }, { type: 'foundation', index: f }, [card]), true);
          return;
        }
      }
    }

    if (state.waste.length > 0) {
      const card = state.waste[state.waste.length - 1];
      for (let c = 0; c < 7; c++) {
        const col = state.tableau[c];
        const topT = col.length > 0 ? col[col.length - 1] : undefined;
        if (canMoveToTableau(card, topT)) {
          doMove(() => executeMove({ type: 'waste' }, { type: 'tableau', index: c }, [card]), true);
          return;
        }
      }
    }

    for (let srcC = 0; srcC < 7; srcC++) {
      const srcCol = state.tableau[srcC];
      if (srcCol.length === 0) continue;

      for (let cardIdx = 0; cardIdx < srcCol.length; cardIdx++) {
        const card = srcCol[cardIdx];
        if (!card.faceUp) continue;

        const isRevealing = cardIdx > 0 && !srcCol[cardIdx - 1].faceUp;
        const isKingToEmpty = card.rank === 'K' && cardIdx > 0;

        if (!isRevealing && !isKingToEmpty) continue;

        for (let tgtC = 0; tgtC < 7; tgtC++) {
          if (srcC === tgtC) continue;
          const tgtCol = state.tableau[tgtC];
          const topT = tgtCol.length > 0 ? tgtCol[tgtCol.length - 1] : undefined;

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

    if (state.waste.length > 0) {
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

    const timer = setTimeout(() => {
      makeAutoMove();
    }, 150);

    return () => clearTimeout(timer);
  }, [isAutoPlaying, gameState, isGameWon, isAutoCompleting]);

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
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-wrap justify-between items-center gap-3 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">接龍</h1>
            <p className="text-sm text-white/70 mt-1 tabular-nums">
              時間 {formatTime(elapsedSec)}
              {' · '}
              勝場 {stats.wins}
              {' · '}
              最佳（翻 {drawCount}）{' '}
              {bestForDraw(stats, drawCount) == null
                ? '—'
                : formatTime(bestForDraw(stats, drawCount)!)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
            <div className="flex rounded-lg overflow-hidden border border-white/20">
              <button
                type="button"
                onClick={() => changeDrawCount(1)}
                disabled={isBusy}
                className={`px-3 py-2 text-sm transition-colors ${drawCount === 1 ? 'bg-white text-emerald-900 font-semibold' : 'bg-black/20 hover:bg-black/30'}`}
              >
                翻 1
              </button>
              <button
                type="button"
                onClick={() => changeDrawCount(3)}
                disabled={isBusy}
                className={`px-3 py-2 text-sm transition-colors ${drawCount === 3 ? 'bg-white text-emerald-900 font-semibold' : 'bg-black/20 hover:bg-black/30'}`}
              >
                翻 3
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsRulesOpen(true)}
              className="flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-3 sm:px-4 py-2 bg-black/20 rounded-lg hover:bg-black/30 transition-colors touch-manipulation"
              title="規則"
              aria-label="規則"
            >
              <Info size={20} />
              <span className="hidden sm:inline">規則</span>
            </button>
            <button
              type="button"
              onClick={showHint}
              disabled={isBusy || isGameWon}
              className="flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-3 sm:px-4 py-2 bg-black/20 rounded-lg hover:bg-black/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
              aria-label="提示"
            >
              <Lightbulb size={20} />
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
              className={`flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-3 sm:px-4 py-2 rounded-lg transition-colors touch-manipulation ${isAutoPlaying ? 'bg-red-500/80 hover:bg-red-500' : 'bg-blue-500/80 hover:bg-blue-500'}`}
              aria-label={isAutoPlaying ? '停止自動' : '自動玩'}
            >
              {isAutoPlaying ? <Square size={20} /> : <Bot size={20} />}
              <span className="hidden sm:inline">{isAutoPlaying ? '停止' : '自動'}</span>
            </button>
            <button
              type="button"
              onClick={undo}
              disabled={gameState.history.length === 0 || isBusy}
              className="flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-3 sm:px-4 py-2 bg-black/20 rounded-lg hover:bg-black/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
              aria-label="復原"
            >
              <Undo2 size={20} /> <span className="hidden sm:inline">復原</span>
            </button>
            <button
              type="button"
              onClick={startNewGame}
              className="flex items-center justify-center gap-2 min-h-[44px] min-w-[44px] px-3 sm:px-4 py-2 bg-black/20 rounded-lg hover:bg-black/30 transition-colors touch-manipulation"
              aria-label="新局"
            >
              <RotateCcw size={20} /> <span className="hidden sm:inline">新局</span>
            </button>
          </div>
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
                <div className="w-16 h-24 sm:w-24 sm:h-36 rounded-xl border-2 border-black/20 flex items-center justify-center hover:bg-black/10 transition-colors touch-manipulation">
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
                  const playableToFoundation = isTop && checkCanMoveToFoundation(card);
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
                        isPlayableToFoundation={playableToFoundation}
                        onDragStart={(e) => isTop && !isBusy && handleDragStart(e, wasteSource)}
                        onDragEnd={handleDragEnd}
                        onClick={() => isTop && handleCardTap(wasteSource)}
                        onDoubleClick={() => isTop && handleDoubleClick(wasteSource)}
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
                const playableToFoundation = isBottom && checkCanMoveToFoundation(card);
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
                      isPlayableToFoundation={playableToFoundation}
                      onDragStart={(e) => card.faceUp && handleDragStart(e, tableauSource)}
                      onDragEnd={handleDragEnd}
                      onClick={() => card.faceUp && handleCardTap(tableauSource)}
                      onDoubleClick={() => card.faceUp && handleDoubleClick(tableauSource)}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {isGameWon && (
        <ResultOverlay
          title="你贏了！"
          variant="win"
          subtitle="恭喜完成接龍"
          stats={[
            { label: '本局時間', value: formatTime(elapsedSec) },
            { label: '勝場', value: stats.wins },
            {
              label: `最佳時間（翻 ${drawCount}）`,
              value:
                bestForDraw(stats, drawCount) == null
                  ? '—'
                  : formatTime(bestForDraw(stats, drawCount)!),
            },
          ]}
          onPrimary={startNewGame}
        />
      )}

      {isGameOverNoMoves && !isGameWon && (
        <ResultOverlay
          title="無法再移動"
          variant="lose"
          subtitle="也可從上方工具列開新局或復原"
          primaryLabel="重新洗牌"
          onPrimary={reshuffleBoard}
        />
      )}

      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
    </div>
  );
}

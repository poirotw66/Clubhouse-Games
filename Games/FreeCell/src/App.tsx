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
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart3,
  Bot,
  Calendar,
  Info,
  Keyboard,
  Lightbulb,
  Loader2,
  Palette,
  RefreshCw,
  RotateCcw,
  Undo2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { PlayingCard } from './components/PlayingCard';
import { RulesModal } from './components/RulesModal';
import { StatsPanel } from './components/StatsPanel';
import { CardFlyLayer, type FlyCard } from './components/CardFlyLayer';
import { WinCascade } from './components/WinCascade';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { TacticalLeftWing } from './components/TacticalLeftWing';
import { TacticalRightWing } from './components/TacticalRightWing';
import { TacticalMobileBar } from './components/TacticalMobileBar';
import { SupermoveWaveBanner } from './components/SupermoveWaveBanner';
import { WORKSHOP_THEMES, getNextTheme, type WorkshopTheme } from './utils/theme';
import {
  playCardGlide,
  playCardSnap,
  playFoundationBell,
  playRadarPulse,
  playSupermoveWave,
  playUndoSound,
  playVictoryFanfare,
  setSoundEnabled as setSoundEffectsEnabled,
} from './utils/soundEffects';
import type { Card, GameState, Position, Suit } from './types';
import { dealDaily, dealForDifficulty, dealGame, rateDeal, SUITS } from './utils/deck';
import {
  canMove,
  checkLoss,
  checkWin,
  executeMove,
  getHintMove,
  getSafeFoundationMoves,
  isValidSequence,
} from './utils/gameLogic';
import { computeStreak, dailyBaseSeed, dateKey } from './utils/daily';
import { CHALLENGES, evaluateChallenges, type ChallengeId } from './utils/challenges';
import {
  classicTimeBonus,
  finishMoveDelta,
  initialScore,
  pointsToFoundation,
  pointsUndo,
  scoreSummaryLabel,
  type PlayMode,
} from './utils/scoring';
import {
  loadDaily,
  loadSettings,
  loadStats,
  recordDaily,
  recordGameResult,
  saveSettings,
  winRate,
  type Difficulty,
  type FreeCellSettings,
  type FreeCellSlots,
  type FreeCellStats,
} from './utils/storage';
import { difficultyLabel, solveGame } from './utils/solver';

const TIMED_LIMIT_SEC = 300;

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function lockedCell(index: number): Card {
  return {
    id: `locked-${index}`,
    suit: 'spades',
    rank: 13,
    color: 'black',
  };
}

function emptyGame(tableaus: Card[][], freeCellSlots: FreeCellSlots): GameState {
  // Locked placeholders occupy unused free cells so supermove caps stay correct.
  const freeCells: (Card | null)[] =
    freeCellSlots === 2
      ? [null, null, lockedCell(2), lockedCell(3)]
      : [null, null, null, null];
  return {
    freeCells,
    foundations: { spades: 0, hearts: 0, diamonds: 0, clubs: 0 },
    tableaus,
    history: [],
  };
}

function positionsEqual(a: Position, b: Position): boolean {
  return a.zone === b.zone && a.index === b.index && a.cardIndex === b.cardIndex;
}

function activeFreeCellIndices(slots: FreeCellSlots): number[] {
  return slots === 2 ? [0, 1] : [0, 1, 2, 3];
}

type DealBundle = {
  tableaus: Card[][];
  seed: number;
  parMoves: number | null;
  difficulty: Difficulty;
};

function dealForSettings(settings: FreeCellSettings): DealBundle {
  if (settings.playDaily) {
    return dealDaily(dailyBaseSeed(dateKey()));
  }
  return dealForDifficulty(settings.difficulty);
}

export default function App() {
  const [settings, setSettings] = useState<FreeCellSettings>(loadSettings);
  const [initial] = useState(() => dealForSettings(loadSettings()));
  const [gameState, setGameState] = useState<GameState>(() =>
    emptyGame(initial.tableaus, loadSettings().freeCellSlots),
  );
  const [dealSeed, setDealSeed] = useState(initial.seed);
  const [parMoves, setParMoves] = useState<number | null>(initial.parMoves);
  const [dealDifficulty, setDealDifficulty] = useState<Difficulty>(initial.difficulty);
  const [seedDraft, setSeedDraft] = useState(String(initial.seed));
  const [stats, setStats] = useState<FreeCellStats>(loadStats);
  const [dailyRecords, setDailyRecords] = useState(loadDaily);
  const [score, setScore] = useState(initialScore);
  const [moveCount, setMoveCount] = useState(0);
  const [undoCount, setUndoCount] = useState(0);
  const [usedUndo, setUsedUndo] = useState(false);
  const [usedFreeCell, setUsedFreeCell] = useState(false);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [hint, setHint] = useState<{ source: Position; dest: Position } | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [hasWon, setHasWon] = useState(false);
  const [hasLost, setHasLost] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isStatsOpen, setIsStatsOpen] = useState(false);
  const [isKeyboardHelpOpen, setIsKeyboardHelpOpen] = useState(false);
  const [showKeyboardBadges, setShowKeyboardBadges] = useState(true);
  const [isBotPlaying, setIsBotPlaying] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [solutionPath, setSolutionPath] = useState<{ source: Position; dest: Position }[] | null>(
    null,
  );
  const [flash, setFlash] = useState<{ text: string; tone: 'good' | 'bad' | 'neutral'; key: number } | null>(
    null,
  );
  const [flights, setFlights] = useState<FlyCard[]>([]);
  const [supermoveWaveCount, setSupermoveWaveCount] = useState<number | null>(null);
  const [clearedThisWin, setClearedThisWin] = useState<ChallengeId[]>([]);
  const [resultRecorded, setResultRecorded] = useState(false);

  const prevWonRef = useRef(false);
  const prevLostRef = useRef(false);
  const timerActiveRef = useRef(true);
  const scoreRef = useRef(score);
  const moveRef = useRef(moveCount);
  const undoRef = useRef(undoCount);
  const usedFreeCellRef = useRef(false);
  const metaHistory = useRef<{ score: number; moves: number; undos: number; usedFreeCell: boolean }[]>(
    [],
  );
  const foundationRefs = useRef<(HTMLDivElement | null)[]>([]);
  const freeCellRefs = useRef<(HTMLDivElement | null)[]>([]);

  const playMode = settings.playMode;
  const autoMove = settings.autoMove;
  const freeCellSlots = settings.freeCellSlots;
  const dailyStreak = computeStreak(dailyRecords, dateKey());
  const inputLocked = hasWon || timedOut || isBotPlaying || isSolving;
  const showLoss = (hasLost || timedOut) && !hasWon;
  const modeBest = stats.byMode[`${playMode}-${freeCellSlots}`];

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);
  useEffect(() => {
    moveRef.current = moveCount;
  }, [moveCount]);
  useEffect(() => {
    undoRef.current = undoCount;
  }, [undoCount]);
  useEffect(() => {
    usedFreeCellRef.current = usedFreeCell;
  }, [usedFreeCell]);

  // Rate par off the click path so deals stay snappy (CI smoke + touch).
  useEffect(() => {
    let cancelled = false;
    const tableaus = gameState.tableaus.map((col) => col.map((c) => ({ ...c })));
    const timer = window.setTimeout(() => {
      const rated = rateDeal(tableaus);
      if (cancelled) return;
      setParMoves(rated.parMoves);
      setDealDifficulty(rated.difficulty);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Intentionally keyed only on dealSeed — rate the layout that was just dealt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealSeed]);

  useEffect(() => {
    setSoundEffectsEnabled(settings.soundEnabled);
  }, [settings.soundEnabled]);

  const handleCycleTheme = useCallback(() => {
    setSettings((prev) => {
      const nextTheme = getNextTheme(prev.theme);
      const updated = { ...prev, theme: nextTheme };
      saveSettings(updated);
      setFlash({
        text: WORKSHOP_THEMES[nextTheme].name,
        tone: 'good',
        key: Date.now(),
      });
      return updated;
    });
  }, []);

  const handleToggleSound = useCallback(() => {
    setSettings((prev) => {
      const nextSound = !prev.soundEnabled;
      const updated = { ...prev, soundEnabled: nextSound };
      saveSettings(updated);
      setSoundEffectsEnabled(nextSound);
      setFlash({
        text: nextSound ? '音效已開啟' : '音效已靜音',
        tone: nextSound ? 'good' : 'bad',
        key: Date.now(),
      });
      return updated;
    });
  }, []);

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

  const persistSettings = (next: FreeCellSettings) => {
    setSettings(next);
    saveSettings(next);
  };

  const resetBoard = (bundle: DealBundle, nextSettings: FreeCellSettings = settings) => {
    setGameState(emptyGame(bundle.tableaus, nextSettings.freeCellSlots));
    setDealSeed(bundle.seed);
    setParMoves(bundle.parMoves);
    setDealDifficulty(bundle.difficulty);
    setSeedDraft(String(bundle.seed));
    setSelectedPos(null);
    setHint(null);
    setHasWon(false);
    setHasLost(false);
    setTimedOut(false);
    setIsBotPlaying(false);
    setSolutionPath(null);
    setElapsedSec(0);
    setScore(initialScore());
    setMoveCount(0);
    setUndoCount(0);
    setUsedUndo(false);
    setUsedFreeCell(false);
    setClearedThisWin([]);
    setResultRecorded(false);
    setFlights([]);
    metaHistory.current = [];
    timerActiveRef.current = true;
    prevWonRef.current = false;
    prevLostRef.current = false;
  };

  const startNewGame = useCallback(() => {
    resetBoard(dealForSettings(settings), settings);
  }, [settings]);

  const redealSame = () => {
    if (settings.playDaily) {
      resetBoard(dealDaily(dailyBaseSeed(dateKey())));
      return;
    }
    const deal = dealGame(dealSeed);
    resetBoard({ ...deal, parMoves: null, difficulty: 'any' });
  };

  const dealFromSeedDraft = () => {
    if (settings.playDaily) return;
    const n = Number(seedDraft.trim());
    if (!Number.isInteger(n) || n < 1) return;
    const deal = dealGame(n);
    resetBoard({ ...deal, parMoves: null, difficulty: 'any' });
    if (settings.difficulty !== 'any') {
      persistSettings({ ...settings, difficulty: 'any' });
    }
  };

  const changePlayMode = (mode: PlayMode) => {
    if (mode === playMode) return;
    const next = { ...settings, playMode: mode };
    persistSettings(next);
    resetBoard(dealForSettings(next), next);
  };

  const changeDifficulty = (difficulty: Difficulty) => {
    if (settings.playDaily || difficulty === settings.difficulty) return;
    const next = { ...settings, difficulty, playDaily: false };
    persistSettings(next);
    resetBoard(dealForDifficulty(difficulty), next);
  };

  const changeFreeCellSlots = (slots: FreeCellSlots) => {
    if (slots === freeCellSlots) return;
    const next = { ...settings, freeCellSlots: slots };
    persistSettings(next);
    // Keep the same deal seed — only the free-cell count changes. Re-running the
    // solvability search here made Playwright / CI flaky (multi-second main-thread stalls).
    const deal = dealGame(dealSeed);
    resetBoard(
      {
        tableaus: deal.tableaus,
        seed: deal.seed,
        parMoves,
        difficulty: dealDifficulty,
      },
      next,
    );
  };

  const toggleDaily = () => {
    const next = {
      ...settings,
      playDaily: !settings.playDaily,
      difficulty: !settings.playDaily ? ('any' as Difficulty) : settings.difficulty,
    };
    persistSettings(next);
    resetBoard(dealForSettings(next), next);
  };

  const changeAutoMove = (enabled: boolean) => {
    persistSettings({ ...settings, autoMove: enabled });
  };

  const isFreeCellLocked = (index: number): boolean => {
    return freeCellSlots === 2 && index >= 2;
  };

  const spawnFlyToFoundation = (card: Card, foundationIndex: number, sourceEl?: Element | null) => {
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

  const resolveCardAt = (state: GameState, source: Position): Card | null => {
    if (source.zone === 'freeCell') return state.freeCells[source.index] ?? null;
    if (source.zone === 'tableau') {
      const col = state.tableaus[source.index];
      if (source.cardIndex == null) return null;
      return col[source.cardIndex] ?? null;
    }
    return null;
  };

  const handleMove = (source: Position, dest: Position, sourceEl?: Element | null) => {
    clearHint();
    if (dest.zone === 'freeCell' && isFreeCellLocked(dest.index)) return;
    if (!canMove(gameState, source, dest)) return;
    // With 2 free cells, also block moves into locked indices via canMove already
    // (empty locked cells look empty — enforce here).
    if (dest.zone === 'freeCell' && isFreeCellLocked(dest.index)) return;

    const movingToFree = dest.zone === 'freeCell';
    const toFoundation = dest.zone === 'foundation';
    const card = resolveCardAt(gameState, source);

    const movingCards =
      source.zone === 'tableau' && source.cardIndex != null
        ? gameState.tableaus[source.index].slice(source.cardIndex)
        : [];
    const isSupermove = movingCards.length >= 2;

    if (toFoundation && card && sourceEl) {
      const suitIndex = SUITS.indexOf(card.suit);
      if (suitIndex >= 0) spawnFlyToFoundation(card, suitIndex, sourceEl);
    }

    metaHistory.current.push({
      score: scoreRef.current,
      moves: moveRef.current,
      undos: undoRef.current,
      usedFreeCell: usedFreeCellRef.current,
    });

    setGameState((prev) => {
      const nextState = executeMove(prev, source, dest);
      return {
        ...nextState,
        history: [...prev.history, prev],
      };
    });

    setMoveCount((m) => m + 1);
    if (movingToFree) setUsedFreeCell(true);
    if (toFoundation) {
      bumpScore(pointsToFoundation());
      playScore();
      if (card) playFoundationBell(card.rank);
    } else if (isSupermove) {
      setSupermoveWaveCount(movingCards.length);
      playSupermoveWave(movingCards.length);
    } else {
      playCardGlide();
      playCardSnap();
      playCard();
      playMove();
    }
  };

  const undo = () => {
    if (inputLocked) return;
    playUndoSound();
    clearHint();
    setGameState((prev) => {
      if (prev.history.length === 0) return prev;
      const prevState = prev.history[prev.history.length - 1]!;
      return {
        ...prevState,
        history: prev.history.slice(0, -1),
      };
    });
    const meta = metaHistory.current.pop();
    if (meta) {
      setMoveCount(meta.moves);
      setUsedFreeCell(meta.usedFreeCell);
      // Apply undo tax on top of restored pre-move score.
      const taxed = meta.score + pointsUndo();
      setScore(taxed);
      setFlash({ text: String(pointsUndo()), tone: 'bad', key: Date.now() });
    } else {
      bumpScore(pointsUndo());
    }
    setUndoCount((c) => c + 1);
    setUsedUndo(true);
    setSelectedPos(null);
    setSolutionPath(null);
    setIsBotPlaying(false);
    setHasWon(false);
    setHasLost(false);
    timerActiveRef.current = true;
  };

  const showHint = () => {
    if (inputLocked) return;
    const move = getHintMove(gameState);
    // Filter hints that target locked free cells.
    if (move && move.dest.zone === 'freeCell' && isFreeCellLocked(move.dest.index)) {
      setHint(null);
      playError();
      return;
    }
    setHint(move);
    if (!move) playError();
    else playGoal();
  };

  const triggerSafeAutoMove = useCallback(() => {
    if (inputLocked) return;
    const safeMove = getSafeFoundationMoves(gameState);
    if (safeMove) {
      playRadarPulse();
      const card = resolveCardAt(gameState, safeMove.source);
      if (card) {
        const suitIdx = SUITS.indexOf(card.suit);
        if (suitIdx >= 0) {
          const sourceEl =
            safeMove.source.zone === 'freeCell'
              ? freeCellRefs.current[safeMove.source.index]
              : null;
          spawnFlyToFoundation(card, suitIdx, sourceEl);
        }
      }
      handleMove(safeMove.source, safeMove.dest);
      clearBotState();
    } else {
      playError();
      setFlash({ text: '暫無安全收牌', tone: 'neutral', key: Date.now() });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputLocked, gameState]);

  const handleSelectDeal = useCallback(
    (seed: number) => {
      if (settings.playDaily) {
        persistSettings({ ...settings, playDaily: false, difficulty: 'any' });
      }
      const deal = dealGame(seed);
      resetBoard({ ...deal, parMoves: null, difficulty: 'any' });
      setSeedDraft(String(seed));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings],
  );

  const isSourceHinted = (pos: Position, cardIndex?: number): boolean => {
    if (!hint) return false;
    const src = hint.source;
    if (src.zone !== pos.zone || src.index !== pos.index) return false;
    if (src.zone === 'tableau') {
      const idx = cardIndex ?? pos.cardIndex ?? 0;
      return idx >= (src.cardIndex ?? 0);
    }
    return true;
  };

  const isDestHinted = (pos: Position): boolean => {
    if (!hint) return false;
    return hint.dest.zone === pos.zone && hint.dest.index === pos.index;
  };

  const toggleBot = async () => {
    if (isBotPlaying) {
      setIsBotPlaying(false);
      setSolutionPath(null);
    } else {
      clearHint();
      setIsBotPlaying(true);
      if (!solutionPath || solutionPath.length === 0) {
        setIsSolving(true);
        setTimeout(async () => {
          const path = await solveGame(gameState, () => {});
          setIsSolving(false);
          if (path) {
            setSolutionPath(path);
          } else {
            setIsBotPlaying(false);
            playError();
            setFlash({ text: '找不到解', tone: 'bad', key: Date.now() });
          }
        }, 50);
      }
    }
  };

  const clearBotState = () => {
    setIsBotPlaying(false);
    setSolutionPath(null);
  };

  const canMoveRespectingSlots = (source: Position, dest: Position): boolean => {
    if (dest.zone === 'freeCell' && isFreeCellLocked(dest.index)) return false;
    return canMove(gameState, source, dest);
  };

  const handleCardClick = (pos: Position, hasCard: boolean, el?: HTMLElement | null) => {
    if (inputLocked) return;
    clearHint();

    if (selectedPos) {
      if (positionsEqual(selectedPos, pos)) {
        setSelectedPos(null);
        return;
      }

      if (pos.zone === 'foundation') {
        if (canMoveRespectingSlots(selectedPos, pos)) {
          handleMove(selectedPos, pos, el);
          setSelectedPos(null);
          clearBotState();
          return;
        }
      }

      if (pos.zone === 'freeCell' && !hasCard && !isFreeCellLocked(pos.index)) {
        if (canMoveRespectingSlots(selectedPos, pos)) {
          handleMove(selectedPos, pos, el);
          setSelectedPos(null);
          clearBotState();
          return;
        }
      }

      if (pos.zone === 'tableau') {
        const col = gameState.tableaus[pos.index]!;
        const isBottomOrEmpty = !hasCard || pos.cardIndex === col.length - 1;
        if (isBottomOrEmpty && canMoveRespectingSlots(selectedPos, pos)) {
          handleMove(selectedPos, pos, el);
          setSelectedPos(null);
          clearBotState();
          return;
        }
      }
    }

    if (hasCard && pos.zone !== 'foundation') {
      if (pos.zone === 'freeCell' && isFreeCellLocked(pos.index)) return;
      if (pos.zone === 'tableau') {
        const col = gameState.tableaus[pos.index]!;
        const cardsToMove = col.slice(pos.cardIndex);
        if (isValidSequence(cardsToMove)) setSelectedPos(pos);
      } else {
        setSelectedPos(pos);
      }
    } else {
      setSelectedPos(null);
    }
  };

  const handleDoubleClick = (pos: Position, el?: HTMLElement | null) => {
    if (inputLocked) return;
    clearHint();

    if (canMoveRespectingSlots(pos, { zone: 'foundation', index: 0 })) {
      handleMove(pos, { zone: 'foundation', index: 0 }, el);
      setSelectedPos(null);
      clearBotState();
      return;
    }

    for (const i of activeFreeCellIndices(freeCellSlots)) {
      if (gameState.freeCells[i] === null && canMoveRespectingSlots(pos, { zone: 'freeCell', index: i })) {
        handleMove(pos, { zone: 'freeCell', index: i }, el);
        setSelectedPos(null);
        clearBotState();
        return;
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, pos: Position) => {
    if (inputLocked) {
      e.preventDefault();
      return;
    }
    if (pos.zone === 'tableau') {
      const col = gameState.tableaus[pos.index]!;
      const cardsToMove = col.slice(pos.cardIndex);
      if (!isValidSequence(cardsToMove)) {
        e.preventDefault();
        return;
      }
    }
    clearHint();
    setSelectedPos(pos);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify(pos));
  };

  const handleDragOver = (e: React.DragEvent, _pos: Position) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, destPos: Position) => {
    e.preventDefault();
    if (inputLocked || !selectedPos) return;
    if (
      selectedPos.zone === destPos.zone &&
      selectedPos.index === destPos.index &&
      selectedPos.cardIndex === destPos.cardIndex
    ) {
      setSelectedPos(null);
      return;
    }
    let actualDest = destPos;
    if (destPos.zone === 'tableau') {
      actualDest = { zone: 'tableau', index: destPos.index };
    }
    if (canMoveRespectingSlots(selectedPos, actualDest)) {
      handleMove(selectedPos, actualDest, e.currentTarget as HTMLElement);
      clearBotState();
    }
    setSelectedPos(null);
  };

  useEffect(() => {
    if (hasWon && !prevWonRef.current) {
      playWin();
      playVictoryFanfare();
    }
    if ((hasLost || timedOut) && !prevLostRef.current && !hasWon) playError();
    prevWonRef.current = hasWon;
    prevLostRef.current = hasLost || timedOut;
  }, [hasWon, hasLost, timedOut]);

  useEffect(() => {
    if (checkWin(gameState)) {
      setHasWon(true);
      setHasLost(false);
      setTimedOut(false);
      setIsBotPlaying(false);
    } else {
      setHasWon(false);
      const lost = checkLoss(gameState);
      setHasLost(lost);
      if (lost) setIsBotPlaying(false);
    }
  }, [gameState]);

  useEffect(() => {
    if (!timerActiveRef.current || hasWon || hasLost || timedOut) return;
    const id = window.setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [hasWon, hasLost, timedOut, dealSeed]);

  useEffect(() => {
    if (playMode !== 'timed' || hasWon || hasLost || timedOut) return;
    if (elapsedSec >= TIMED_LIMIT_SEC) {
      setTimedOut(true);
      setIsBotPlaying(false);
      timerActiveRef.current = false;
    }
  }, [elapsedSec, playMode, hasWon, hasLost, timedOut]);

  useEffect(() => {
    if (!hasWon || resultRecorded) return;
    timerActiveRef.current = false;

    let finalScore = scoreRef.current;
    const moveDelta = finishMoveDelta(moveRef.current, parMoves);
    if (moveDelta !== 0) {
      finalScore += moveDelta;
      setFlash({
        text: moveDelta > 0 ? `破標準 +${moveDelta}` : `超標準 ${moveDelta}`,
        tone: moveDelta > 0 ? 'good' : 'bad',
        key: Date.now(),
      });
    }
    if (playMode === 'classic') {
      const bonus = classicTimeBonus(elapsedSec);
      if (bonus > 0) {
        finalScore += bonus;
      }
    }
    setScore(finalScore);

    const cleared = evaluateChallenges({
      won: true,
      usedUndo,
      usedFreeCell: usedFreeCellRef.current,
      freeCellSlots,
      moves: moveRef.current,
      parMoves,
      elapsedSec,
    });
    setClearedThisWin(cleared);

    setStats((prev) =>
      recordGameResult(prev, {
        won: true,
        playMode,
        freeCellSlots,
        seed: dealSeed,
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
          playMode,
          freeCellSlots,
        }),
      );
    }
    setResultRecorded(true);
  }, [
    hasWon,
    resultRecorded,
    elapsedSec,
    playMode,
    freeCellSlots,
    usedUndo,
    parMoves,
    dealSeed,
    settings.playDaily,
  ]);

  useEffect(() => {
    if ((!hasLost && !timedOut) || hasWon || resultRecorded) return;
    timerActiveRef.current = false;
    setStats((prev) =>
      recordGameResult(prev, {
        won: false,
        playMode,
        freeCellSlots,
        seed: dealSeed,
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
          playMode,
          freeCellSlots,
        }),
      );
    }
    setResultRecorded(true);
  }, [
    hasLost,
    timedOut,
    hasWon,
    resultRecorded,
    playMode,
    freeCellSlots,
    dealSeed,
    elapsedSec,
    settings.playDaily,
  ]);

  useEffect(() => {
    if (hasWon || hasLost || timedOut || isSolving) return;

    if (autoMove && !isBotPlaying) {
      const safeMove = getSafeFoundationMoves(gameState);
      if (safeMove && !selectedPos) {
        const timer = setTimeout(() => {
          handleMove(safeMove.source, safeMove.dest);
        }, 150);
        return () => clearTimeout(timer);
      }
    }

    if (isBotPlaying && solutionPath && solutionPath.length > 0) {
      const timer = setTimeout(() => {
        const move = solutionPath[0]!;
        if (move.dest.zone === 'freeCell' && isFreeCellLocked(move.dest.index)) {
          setIsBotPlaying(false);
          setSolutionPath(null);
          return;
        }
        handleMove(move.source, move.dest);
        setSolutionPath((prev) => (prev ? prev.slice(1) : null));
      }, 300);
      return () => clearTimeout(timer);
    } else if (isBotPlaying && solutionPath && solutionPath.length === 0) {
      setIsBotPlaying(false);
    }
  }, [
    gameState,
    selectedPos,
    autoMove,
    hasWon,
    hasLost,
    timedOut,
    isBotPlaying,
    isSolving,
    solutionPath,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.key === 'Escape') {
        if (isKeyboardHelpOpen) {
          setIsKeyboardHelpOpen(false);
          return;
        }
        if (isRulesOpen) {
          setIsRulesOpen(false);
          return;
        }
        if (isStatsOpen) {
          setIsStatsOpen(false);
          return;
        }
        if (selectedPos) {
          setSelectedPos(null);
          return;
        }
      }

      if (inputLocked) return;

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setIsKeyboardHelpOpen((prev) => !prev);
        return;
      }

      // 1 to 8: Tableau columns
      if (e.key >= '1' && e.key <= '8') {
        e.preventDefault();
        const colIdx = parseInt(e.key, 10) - 1;
        const col = gameState.tableaus[colIdx];

        if (!selectedPos) {
          if (col && col.length > 0) {
            let startIdx = col.length - 1;
            while (startIdx > 0) {
              const candidate = col.slice(startIdx - 1);
              if (isValidSequence(candidate)) {
                startIdx--;
              } else {
                break;
              }
            }
            setSelectedPos({ zone: 'tableau', index: colIdx, cardIndex: startIdx });
            playCard();
          }
        } else {
          if (selectedPos.zone === 'tableau' && selectedPos.index === colIdx) {
            setSelectedPos(null);
          } else {
            const dest: Position = { zone: 'tableau', index: colIdx };
            if (canMoveRespectingSlots(selectedPos, dest)) {
              handleMove(selectedPos, dest);
              setSelectedPos(null);
              clearBotState();
            } else {
              if (col && col.length > 0) {
                let startIdx = col.length - 1;
                while (startIdx > 0) {
                  const candidate = col.slice(startIdx - 1);
                  if (isValidSequence(candidate)) {
                    startIdx--;
                  } else {
                    break;
                  }
                }
                setSelectedPos({ zone: 'tableau', index: colIdx, cardIndex: startIdx });
                playCard();
              } else {
                playError();
              }
            }
          }
        }
        return;
      }

      // Q, W, E, R: FreeCells
      const keyLower = e.key.toLowerCase();
      const fcMap: Record<string, number> = { q: 0, w: 1, e: 2, r: 3 };
      if (keyLower in fcMap) {
        e.preventDefault();
        const fcIdx = fcMap[keyLower]!;
        if (isFreeCellLocked(fcIdx)) {
          playError();
          return;
        }

        if (!selectedPos) {
          if (gameState.freeCells[fcIdx]) {
            setSelectedPos({ zone: 'freeCell', index: fcIdx });
            playCard();
          }
        } else {
          if (selectedPos.zone === 'freeCell' && selectedPos.index === fcIdx) {
            setSelectedPos(null);
          } else {
            const dest: Position = { zone: 'freeCell', index: fcIdx };
            if (canMoveRespectingSlots(selectedPos, dest)) {
              handleMove(selectedPos, dest);
              setSelectedPos(null);
              clearBotState();
            } else {
              if (gameState.freeCells[fcIdx]) {
                setSelectedPos(dest);
                playCard();
              } else {
                playError();
              }
            }
          }
        }
        return;
      }

      if (keyLower === 'a') {
        e.preventDefault();
        triggerSafeAutoMove();
        return;
      }

      if (keyLower === 'h') {
        e.preventDefault();
        showHint();
        return;
      }

      if (keyLower === 'z' || keyLower === 'u') {
        e.preventDefault();
        undo();
        return;
      }

      if (keyLower === 't') {
        e.preventDefault();
        handleCycleTheme();
        return;
      }

      if (keyLower === 'm') {
        e.preventDefault();
        handleToggleSound();
        return;
      }

      if (keyLower === 'n') {
        e.preventDefault();
        startNewGame();
        return;
      }

      if (keyLower === 'd') {
        e.preventDefault();
        redealSame();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    gameState,
    selectedPos,
    inputLocked,
    isKeyboardHelpOpen,
    isRulesOpen,
    isStatsOpen,
    freeCellSlots,
    triggerSafeAutoMove,
    handleCycleTheme,
    handleToggleSound,
    startNewGame,
  ]);

  const suitSymbols: Record<Suit, string> = {
    spades: '♠',
    hearts: '♥',
    diamonds: '♦',
    clubs: '♣',
  };

  const activeTheme = WORKSHOP_THEMES[settings.theme] ?? WORKSHOP_THEMES['royal-velvet'];

  return (
    <div
      className={`min-h-screen p-2 pt-14 sm:p-4 sm:pt-16 md:p-8 md:pt-14 font-sans select-none overflow-x-hidden bg-cover bg-center transition-colors duration-300 ${activeTheme.bgClass}`}
      style={activeTheme.feltStyle}
    >
      <BackToMenu />
      <div className="max-w-[1720px] mx-auto relative">
        {flash && (
          <div className="absolute left-1/2 top-20 -translate-x-1/2 z-30 w-40 h-20">
            <ScoreFlash
              text={flash.text}
              tone={flash.tone}
              flashKey={flash.key}
              onDone={() => setFlash(null)}
            />
          </div>
        )}

        {supermoveWaveCount !== null && (
          <SupermoveWaveBanner
            waveCount={supermoveWaveCount}
            theme={settings.theme}
            onDismiss={() => setSupermoveWaveCount(null)}
          />
        )}

        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold tracking-tight">
                空當接龍
              </h1>
              <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border backdrop-blur-md opacity-90 border-white/20 bg-white/10">
                {activeTheme.name}
              </span>
            </div>
            <p className="text-sm mt-1 tabular-nums opacity-80">
              分數 {score}
              {' · '}
              {scoreSummaryLabel(parMoves, moveCount)}
              {' · '}
              悔棋 {undoCount}
              {' · '}
              {playMode === 'timed'
                ? `剩餘 ${formatTime(Math.max(0, TIMED_LIMIT_SEC - elapsedSec))}`
                : `時間 ${formatTime(elapsedSec)}`}
            </p>
            <p className="text-xs mt-0.5 tabular-nums opacity-65">
              局號 {dealSeed}
              {' · '}
              {difficultyLabel(dealDifficulty)}
              {' · '}
              勝率 {Math.round(winRate(stats) * 100)}%
              {' · '}
              連勝 {stats.currentStreak}
              {settings.playDaily ? ` · 每日連勝 ${dailyStreak}` : ''}
              {modeBest?.bestMoves != null ? ` · 模式最少 ${modeBest.bestMoves} 步` : ''}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 items-center">
            {/* Luxury Workshop Theme & Audio Switcher */}
            <div className="flex rounded-full overflow-hidden border border-white/20 bg-black/30 backdrop-blur-md shadow-sm">
              <button
                type="button"
                onClick={handleCycleTheme}
                className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-semibold transition-colors hover:bg-white/15 touch-manipulation cursor-pointer text-amber-300"
                title="循環切換三大奢華工坊主題（快捷鍵 T）"
              >
                <Palette size={15} className="text-amber-400" />
                <span>{activeTheme.name}</span>
                <kbd className="hidden md:inline px-1.5 py-0.2 rounded bg-white/10 text-[10px] font-mono text-white/70">T</kbd>
              </button>
              <button
                type="button"
                onClick={handleToggleSound}
                className="flex items-center gap-1 px-3 py-2 text-xs sm:text-sm font-semibold transition-colors hover:bg-white/15 border-l border-white/15 touch-manipulation cursor-pointer text-white"
                title={settings.soundEnabled ? '音效已開啟（快捷鍵 M 靜音）' : '已靜音（快捷鍵 M 開啟）'}
              >
                {settings.soundEnabled ? (
                  <Volume2 size={15} className="text-emerald-400" />
                ) : (
                  <VolumeX size={15} className="opacity-40" />
                )}
                <span className="hidden sm:inline">{settings.soundEnabled ? '音效' : '靜音'}</span>
                <kbd className="hidden md:inline px-1.5 py-0.2 rounded bg-white/10 text-[10px] font-mono text-white/70">M</kbd>
              </button>
            </div>
            <div className="flex rounded-full overflow-hidden border border-stone-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => changePlayMode('classic')}
                className={`px-3 py-2 text-sm font-medium transition-colors touch-manipulation ${
                  playMode === 'classic' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                經典
              </button>
              <button
                type="button"
                onClick={() => changePlayMode('timed')}
                className={`px-3 py-2 text-sm font-medium transition-colors touch-manipulation ${
                  playMode === 'timed' ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                限時 5 分
              </button>
            </div>

            <div className="flex rounded-full overflow-hidden border border-stone-200 bg-white shadow-sm">
              {(['any', 'easy', 'medium', 'hard'] as Difficulty[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  id={d === 'easy' ? 'freecell-difficulty' : undefined}
                  onClick={() => changeDifficulty(d)}
                  disabled={settings.playDaily || isSolving}
                  className={`px-2.5 py-2 text-xs sm:text-sm font-medium transition-colors touch-manipulation disabled:opacity-40 ${
                    settings.difficulty === d && !settings.playDaily
                      ? 'bg-amber-500 text-white'
                      : 'text-stone-600 hover:bg-stone-50'
                  }`}
                >
                  {difficultyLabel(d)}
                </button>
              ))}
            </div>

            <div className="flex rounded-full overflow-hidden border border-stone-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => changeFreeCellSlots(4)}
                disabled={isSolving}
                className={`px-3 py-2 text-sm font-medium touch-manipulation ${
                  freeCellSlots === 4 ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                4 格
              </button>
              <button
                type="button"
                onClick={() => changeFreeCellSlots(2)}
                disabled={isSolving}
                className={`px-3 py-2 text-sm font-medium touch-manipulation ${
                  freeCellSlots === 2 ? 'bg-stone-900 text-white' : 'text-stone-600 hover:bg-stone-50'
                }`}
                title="雙格挑戰：僅兩個暫存格"
              >
                2 格
              </button>
            </div>

            <button
              type="button"
              id="freecell-daily"
              onClick={toggleDaily}
              disabled={isSolving}
              className={`flex items-center gap-1 min-h-[44px] px-3 py-2 rounded-full text-sm font-medium border shadow-sm touch-manipulation ${
                settings.playDaily
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              <Calendar size={16} /> 每日
            </button>

            <form
              className="flex items-center gap-1"
              onSubmit={(e) => {
                e.preventDefault();
                dealFromSeedDraft();
              }}
            >
              <label className="sr-only" htmlFor="freecell-seed">
                局號
              </label>
              <input
                id="freecell-seed"
                type="text"
                inputMode="numeric"
                value={seedDraft}
                onChange={(e) => setSeedDraft(e.target.value)}
                className="w-24 px-2 py-2 text-sm rounded-full border border-stone-200 bg-white tabular-nums"
                disabled={isSolving || settings.playDaily}
              />
              <button
                type="submit"
                disabled={isSolving || settings.playDaily}
                className="px-3 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 shadow-sm touch-manipulation"
              >
                發此局
              </button>
            </form>

            <label className="hidden sm:flex items-center gap-2 text-sm font-medium text-stone-500 cursor-pointer hover:text-stone-800 transition-colors px-2">
              <input
                type="checkbox"
                checked={autoMove}
                onChange={(e) => changeAutoMove(e.target.checked)}
                className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
              />
              自動收牌
            </label>

            <button
              type="button"
              onClick={() => setIsStatsOpen(true)}
              className="min-h-[44px] min-w-[44px] px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 shadow-sm flex items-center justify-center gap-2 touch-manipulation"
              aria-label="戰績"
            >
              <BarChart3 size={16} />
              <span className="hidden sm:inline">戰績</span>
            </button>
            <button
              type="button"
              onClick={() => setIsRulesOpen(true)}
              className="min-h-[44px] min-w-[44px] px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 shadow-sm flex items-center justify-center gap-2 touch-manipulation"
              aria-label="規則"
            >
              <Info size={16} />
              <span className="hidden sm:inline">規則</span>
            </button>
            <button
              type="button"
              onClick={() => setIsKeyboardHelpOpen(true)}
              className="min-h-[44px] min-w-[44px] px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 shadow-sm flex items-center justify-center gap-2 touch-manipulation"
              aria-label="快捷鍵"
              title="實體鍵盤極速操控指南（?）"
            >
              <Keyboard size={16} />
              <span className="hidden sm:inline">快捷鍵</span>
            </button>
            <button
              type="button"
              onClick={showHint}
              disabled={inputLocked}
              className="min-h-[44px] min-w-[44px] px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 shadow-sm flex items-center justify-center gap-2 touch-manipulation"
              aria-label="提示"
            >
              <Lightbulb size={16} />
              <span className="hidden sm:inline">提示</span>
            </button>
            <button
              type="button"
              onClick={toggleBot}
              disabled={isSolving}
              className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center justify-center gap-2 shadow-sm touch-manipulation ${
                isSolving
                  ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                  : isBotPlaying
                    ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200'
                    : 'bg-stone-900 text-white hover:bg-stone-800'
              }`}
              aria-label={isSolving ? '思考中' : isBotPlaying ? '停止解答' : '自動解答'}
            >
              {isSolving ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
              <span className="hidden sm:inline">
                {isSolving ? '思考中…' : isBotPlaying ? '停止' : '解答'}
              </span>
            </button>
            <button
              type="button"
              onClick={undo}
              disabled={gameState.history.length === 0 || isBotPlaying || isSolving}
              className="min-h-[44px] min-w-[44px] px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 shadow-sm flex items-center justify-center gap-2 touch-manipulation"
              aria-label="復原"
              title={`復原（本局 ${undoCount} 次，每次 ${pointsUndo()} 分）`}
            >
              <Undo2 size={16} />
              <span className="hidden sm:inline">復原{undoCount > 0 ? ` ${undoCount}` : ''}</span>
            </button>
            <button
              type="button"
              onClick={redealSame}
              disabled={isSolving}
              className="min-h-[44px] min-w-[44px] px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 shadow-sm flex items-center justify-center gap-2 touch-manipulation"
              aria-label="重新發同局"
            >
              <RefreshCw size={16} />
              <span className="hidden sm:inline">同局重發</span>
            </button>
            <button
              type="button"
              onClick={startNewGame}
              disabled={isSolving}
              className="min-h-[44px] min-w-[44px] px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 shadow-sm flex items-center justify-center gap-2 touch-manipulation"
              aria-label="新遊戲"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">新遊戲</span>
            </button>
          </div>
        </div>

        {settings.playDaily && (
          <p className="mb-4 text-sm text-sky-700">
            今日挑戰（台北時間）· {dateKey()}
            {parMoves != null ? ` · 標準 ${parMoves} 步` : ''}
          </p>
        )}

        {hasWon && (
          <ResultOverlay
            title="過關！"
            variant="win"
            subtitle={
              clearedThisWin.length > 0
                ? `挑戰達成：${clearedThisWin
                    .map((id) => CHALLENGES.find((c) => c.id === id)?.name)
                    .filter(Boolean)
                    .join('、')}`
                : settings.playDaily
                  ? `每日挑戰完成 · 連續 ${computeStreak(dailyRecords, dateKey())} 天`
                  : playMode === 'timed'
                    ? '限時模式過關'
                    : '你成功解開這局空當接龍'
            }
            stats={[
              { label: '分數', value: score },
              { label: '本局時間', value: formatTime(elapsedSec) },
              { label: '步數', value: scoreSummaryLabel(parMoves, moveCount) },
              { label: '悔棋', value: undoCount },
              { label: '勝率', value: `${Math.round(winRate(stats) * 100)}%` },
            ]}
            primaryLabel="新遊戲"
            onPrimary={startNewGame}
          />
        )}

        {showLoss && (
          <ResultOverlay
            title={timedOut ? '時間到' : '無法再移動'}
            variant="lose"
            subtitle={
              timedOut
                ? '限時 5 分鐘已用完，試試同局重發或開新局'
                : '沒有合法步數了，試試復原、同局重發或開新局'
            }
            stats={[
              { label: '分數', value: score },
              { label: '步數', value: moveCount },
              { label: '悔棋', value: undoCount },
            ]}
            primaryLabel="新遊戲"
            onPrimary={startNewGame}
          />
        )}

        <TacticalMobileBar
          gameState={gameState}
          freeCellSlots={freeCellSlots}
          theme={settings.theme}
          soundEnabled={settings.soundEnabled}
          onToggleTheme={handleCycleTheme}
          onToggleSound={handleToggleSound}
          currentSeed={dealSeed}
          onSelectDeal={handleSelectDeal}
          onSafeAutoMove={triggerSafeAutoMove}
          onOpenKeyboardGuide={() => setIsKeyboardHelpOpen(true)}
          disabled={inputLocked}
        />

        <div className="flex flex-col xl:flex-row gap-5 items-start justify-center">
          {/* Left Wing on Desktop */}
          <div className="hidden xl:block w-72 shrink-0 sticky top-4">
            <TacticalLeftWing
              gameState={gameState}
              freeCellSlots={freeCellSlots}
              theme={settings.theme}
              onSafeAutoMove={triggerSafeAutoMove}
              disabled={inputLocked}
            />
          </div>

          {/* Center Arena */}
          <div className="flex-1 min-w-0 max-w-5xl w-full">
            <div className="flex justify-between mb-8">
              <div className="flex gap-1 sm:gap-2 md:gap-4 w-[48%]">
                {gameState.freeCells.map((card, i) => {
                  const locked = isFreeCellLocked(i);
                  const pos: Position = { zone: 'freeCell', index: i };
                  const keyLetter = ['Q', 'W', 'E', 'R'][i];
                  return (
                    <div
                      key={`fc-${i}`}
                      className={`flex-1 flex flex-col ${locked ? 'opacity-35' : ''}`}
                      ref={(el) => {
                        freeCellRefs.current[i] = el;
                      }}
                    >
                      <div className="flex items-center justify-between px-1 mb-1 text-[10px] sm:text-[11px] font-mono text-stone-400">
                        <span className="hidden sm:inline">暫存{i + 1}</span>
                        {showKeyboardBadges && !locked && (
                          <kbd className="px-1.5 py-0.2 rounded bg-stone-100 text-stone-600 font-bold border border-stone-200 shadow-sm text-[10px]">
                            {keyLetter}
                          </kbd>
                        )}
                      </div>
                      <PlayingCard
                        card={locked ? null : card}
                        placeholder={locked ? '鎖' : undefined}
                        theme={settings.theme}
                        isSelected={!locked && selectedPos?.zone === 'freeCell' && selectedPos.index === i}
                        isSelectable={!locked && !!card}
                        isHinted={
                          !locked && (isSourceHinted(pos) || (!card && isDestHinted(pos)))
                        }
                        onClick={() =>
                          !locked &&
                          handleCardClick(pos, !!card, freeCellRefs.current[i] ?? undefined)
                        }
                        onDoubleClick={() =>
                          !locked &&
                          card &&
                          handleDoubleClick(pos, freeCellRefs.current[i] ?? undefined)
                        }
                        draggable={false}
                        onDragStart={(e) => !locked && handleDragStart(e, pos)}
                        onDragOver={(e) => !locked && handleDragOver(e, pos)}
                        onDrop={(e) => !locked && handleDrop(e, pos)}
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex gap-1 sm:gap-2 md:gap-4 w-[48%] justify-end">
                {SUITS.map((suit, i) => {
                  const rank = gameState.foundations[suit];
                  const card =
                    rank > 0
                      ? ({
                          id: `f-${suit}-${rank}`,
                          suit,
                          rank,
                          color: suit === 'hearts' || suit === 'diamonds' ? 'red' : 'black',
                        } as Card)
                      : null;
                  const pos: Position = { zone: 'foundation', index: i };
                  return (
                    <div
                      key={`fd-${suit}`}
                      className="flex-1 flex flex-col"
                      ref={(el) => {
                        foundationRefs.current[i] = el;
                      }}
                    >
                      <div className="flex items-center justify-between px-1 mb-1 text-[10px] sm:text-[11px] font-mono text-stone-400">
                        <span className="hidden sm:inline">{['黑桃', '紅心', '方塊', '梅花'][i]}</span>
                        <span className="tabular-nums font-bold text-stone-600 text-[10px]">
                          {rank}/13
                        </span>
                      </div>
                      <PlayingCard
                        card={card}
                        placeholder={suitSymbols[suit]}
                        theme={settings.theme}
                        isHinted={isDestHinted(pos)}
                        onClick={() =>
                          handleCardClick(pos, false, foundationRefs.current[i] ?? undefined)
                        }
                        onDragOver={(e) => handleDragOver(e, pos)}
                        onDrop={(e) => handleDrop(e, pos)}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-8 gap-1 sm:gap-2 md:gap-4">
              {gameState.tableaus.map((col, colIndex) => (
                <div
                  key={`tab-${colIndex}`}
                  className="fc-tableau-col flex flex-col"
                  data-tableau-col={colIndex}
                >
                  <div className="flex items-center justify-between px-1 mb-1 text-[10px] sm:text-[11px] font-mono">
                    <span className="text-stone-400 hidden sm:inline">列{colIndex + 1}</span>
                    {showKeyboardBadges && (
                      <kbd className="px-1.5 py-0.2 rounded bg-stone-100 text-stone-700 font-bold border border-stone-200 shadow-sm text-[10px]">
                        {colIndex + 1}
                      </kbd>
                    )}
                  </div>
                  {col.length === 0 ? (
                    <PlayingCard
                      card={null}
                      theme={settings.theme}
                      isHinted={isDestHinted({ zone: 'tableau', index: colIndex })}
                      onClick={() =>
                        handleCardClick({ zone: 'tableau', index: colIndex, cardIndex: 0 }, false)
                      }
                      onDragOver={(e) =>
                        handleDragOver(e, { zone: 'tableau', index: colIndex, cardIndex: 0 })
                      }
                      onDrop={(e) =>
                        handleDrop(e, { zone: 'tableau', index: colIndex, cardIndex: 0 })
                      }
                    />
                  ) : (
                    col.map((card, cardIndex) => {
                      const isSelected =
                        selectedPos?.zone === 'tableau' &&
                        selectedPos.index === colIndex &&
                        cardIndex >= selectedPos.cardIndex!;
                      const isSelectable = isValidSequence(col.slice(cardIndex));
                      const pos: Position = {
                        zone: 'tableau',
                        index: colIndex,
                        cardIndex,
                      };
                      const isLast = cardIndex === col.length - 1;
                      const seqLength = isSelected && selectedPos?.cardIndex != null ? col.length - selectedPos.cardIndex : 1;
                      const waveIndex = isSelected && selectedPos?.cardIndex != null ? cardIndex - selectedPos.cardIndex : undefined;
                      const waveTotal = isSelected && seqLength > 1 ? seqLength : undefined;

                      return (
                        <div
                          key={card.id}
                          data-tableau-slot={cardIndex}
                          className={[
                            'relative',
                            cardIndex > 0 ? 'fc-tableau-slot--stacked' : '',
                            !isLast ? 'fc-tableau-slot--covered' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                          style={{ zIndex: cardIndex }}
                        >
                          <PlayingCard
                            card={card}
                            isSelected={isSelected}
                            isSelectable={isSelectable}
                            theme={settings.theme}
                            waveIndex={waveIndex}
                            waveTotal={waveTotal}
                            isHinted={
                              isSourceHinted(pos, cardIndex) ||
                              (isLast && isDestHinted({ zone: 'tableau', index: colIndex }))
                            }
                            onClick={(e) =>
                              handleCardClick(pos, true, e.currentTarget as HTMLElement)
                            }
                            onDoubleClick={(e) =>
                              handleDoubleClick(pos, e.currentTarget as HTMLElement)
                            }
                            draggable={false}
                            onDragStart={(e) => handleDragStart(e, pos)}
                            onDragOver={(e) => handleDragOver(e, pos)}
                            onDrop={(e) => handleDrop(e, pos)}
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Wing on Desktop */}
          <div className="hidden xl:block w-72 shrink-0 sticky top-4">
            <TacticalRightWing
              currentSeed={dealSeed}
              theme={settings.theme}
              onSelectDeal={handleSelectDeal}
              disabled={inputLocked}
            />
          </div>
        </div>
      </div>

      <CardFlyLayer
        flights={flights}
        onFlightDone={(id) => setFlights((prev) => prev.filter((f) => f.id !== id))}
      />
      <WinCascade active={hasWon} foundations={gameState.foundations} />

      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
      <KeyboardShortcutsModal
        isOpen={isKeyboardHelpOpen}
        onClose={() => setIsKeyboardHelpOpen(false)}
      />
      <StatsPanel
        open={isStatsOpen}
        onClose={() => setIsStatsOpen(false)}
        stats={stats}
        daily={dailyRecords}
        playMode={playMode}
        freeCellSlots={freeCellSlots}
        currentSeed={dealSeed}
      />
    </div>
  );
}

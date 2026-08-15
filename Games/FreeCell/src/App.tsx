import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playCard, playError, playScore, playWin } from '@clubhouse/shared/synthAudio';
import React, { useState, useEffect, useRef } from "react";
import { GameState, Position, Card, Suit } from "./types";
import { dealGame, SUITS } from "./utils/deck";
import {
  canMove,
  executeMove,
  getSafeFoundationMoves,
  checkWin,
  checkLoss,
  isValidSequence,
  getHintMove,
} from "./utils/gameLogic";
import { solveGame } from "./utils/solver";
import { PlayingCard } from "./components/PlayingCard";
import { RulesModal } from "./components/RulesModal";
import { Undo2, RotateCcw, Info, Bot, Loader2, Lightbulb, RefreshCw } from "lucide-react";

const STATS_KEY = "clubhouse-freecell-stats";
const AUTO_MOVE_KEY = "clubhouse-freecell-auto-move";
const MODE_KEY = "clubhouse-freecell-mode";
const TIMED_LIMIT_SEC = 300;

type PlayMode = "classic" | "timed";

interface Stats {
  wins: number;
  bestByMode: { classic: number | null; timed: number | null };
}

function emptyBests(): Stats["bestByMode"] {
  return { classic: null, timed: null };
}

function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return { wins: 0, bestByMode: emptyBests() };
    const parsed = JSON.parse(raw) as Partial<Stats> & { bestTimeSec?: number | null };
    const bestByMode = emptyBests();
    if (parsed.bestByMode && typeof parsed.bestByMode === "object") {
      const b = parsed.bestByMode as Record<string, unknown>;
      for (const key of ["classic", "timed"] as const) {
        const v = b[key];
        bestByMode[key] = v == null || !Number.isFinite(Number(v)) ? null : Number(v);
      }
    } else if (parsed.bestTimeSec != null && Number.isFinite(Number(parsed.bestTimeSec))) {
      bestByMode.classic = Number(parsed.bestTimeSec);
    }
    return {
      wins: Number(parsed.wins) || 0,
      bestByMode,
    };
  } catch {
    return { wins: 0, bestByMode: emptyBests() };
  }
}

function loadPlayMode(): PlayMode {
  return localStorage.getItem(MODE_KEY) === "timed" ? "timed" : "classic";
}

function loadAutoMove(): boolean {
  const raw = localStorage.getItem(AUTO_MOVE_KEY);
  if (raw === null) return true;
  return raw === "1";
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function emptyGame(tableaus: Card[][]): GameState {
  return {
    freeCells: [null, null, null, null],
    foundations: { spades: 0, hearts: 0, diamonds: 0, clubs: 0 },
    tableaus,
    history: [],
  };
}

function positionsEqual(a: Position, b: Position): boolean {
  return a.zone === b.zone && a.index === b.index && a.cardIndex === b.cardIndex;
}

export default function App() {
  const initialDeal = dealGame();
  const [gameState, setGameState] = useState<GameState>(() => emptyGame(initialDeal.tableaus));
  const [dealSeed, setDealSeed] = useState(initialDeal.seed);
  const [seedDraft, setSeedDraft] = useState(String(initialDeal.seed));
  const [playMode, setPlayMode] = useState<PlayMode>(loadPlayMode);
  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [hint, setHint] = useState<{ source: Position; dest: Position } | null>(null);
  const [autoMove, setAutoMove] = useState(loadAutoMove);
  const [stats, setStats] = useState<Stats>(loadStats);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [hasWon, setHasWon] = useState(false);
  const [hasLost, setHasLost] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  const [isBotPlaying, setIsBotPlaying] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [solutionPath, setSolutionPath] = useState<{ source: Position; dest: Position }[] | null>(null);
  const prevWonRef = useRef(false);
  const prevLostRef = useRef(false);
  const timerActiveRef = useRef(true);
  const statsRecordedRef = useRef(false);

  const clearHint = () => setHint(null);

  const changeAutoMove = (enabled: boolean) => {
    setAutoMove(enabled);
    localStorage.setItem(AUTO_MOVE_KEY, enabled ? "1" : "0");
  };

  useEffect(() => {
    if (hasWon && !prevWonRef.current) playWin();
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
    if (playMode !== "timed" || hasWon || hasLost || timedOut) return;
    if (elapsedSec >= TIMED_LIMIT_SEC) {
      setTimedOut(true);
      setIsBotPlaying(false);
      timerActiveRef.current = false;
    }
  }, [elapsedSec, playMode, hasWon, hasLost, timedOut]);

  useEffect(() => {
    if (!hasWon || statsRecordedRef.current) return;
    statsRecordedRef.current = true;
    timerActiveRef.current = false;
    setStats((prev) => {
      const prevBest = prev.bestByMode[playMode];
      const next: Stats = {
        wins: prev.wins + 1,
        bestByMode: {
          ...prev.bestByMode,
          [playMode]: prevBest == null ? elapsedSec : Math.min(prevBest, elapsedSec),
        },
      };
      localStorage.setItem(STATS_KEY, JSON.stringify(next));
      return next;
    });
  }, [hasWon, elapsedSec, playMode]);

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
        const move = solutionPath[0];
        handleMove(move.source, move.dest);
        setSolutionPath((prev) => (prev ? prev.slice(1) : null));
      }, 300);
      return () => clearTimeout(timer);
    } else if (isBotPlaying && solutionPath && solutionPath.length === 0) {
      setIsBotPlaying(false);
    }
  }, [gameState, selectedPos, autoMove, hasWon, hasLost, timedOut, isBotPlaying, isSolving, solutionPath]);

  const handleMove = (source: Position, dest: Position) => {
    clearHint();
    if (dest.zone === "foundation") playScore();
    else playCard();
    setGameState((prev) => {
      const nextState = executeMove(prev, source, dest);
      return {
        ...nextState,
        history: [...prev.history, prev],
      };
    });
  };

  const undo = () => {
    clearHint();
    setGameState((prev) => {
      if (prev.history.length === 0) return prev;
      const prevState = prev.history[prev.history.length - 1];
      return {
        ...prevState,
        history: prev.history.slice(0, -1),
      };
    });
    setSelectedPos(null);
    setSolutionPath(null);
    setIsBotPlaying(false);
    setHasWon(false);
    setHasLost(false);
    timerActiveRef.current = true;
    statsRecordedRef.current = false;
  };

  const resetBoard = (tableaus: Card[][], seed: number) => {
    setGameState(emptyGame(tableaus));
    setDealSeed(seed);
    setSeedDraft(String(seed));
    setSelectedPos(null);
    setHint(null);
    setHasWon(false);
    setHasLost(false);
    setTimedOut(false);
    setIsBotPlaying(false);
    setSolutionPath(null);
    setElapsedSec(0);
    timerActiveRef.current = true;
    statsRecordedRef.current = false;
  };

  const startNewGame = () => {
    const deal = dealGame();
    resetBoard(deal.tableaus, deal.seed);
  };

  const redealSame = () => {
    const deal = dealGame(dealSeed);
    resetBoard(deal.tableaus, deal.seed);
  };

  const dealFromSeedDraft = () => {
    const n = Number(seedDraft.trim());
    if (!Number.isInteger(n) || n < 1) return;
    const deal = dealGame(n);
    resetBoard(deal.tableaus, deal.seed);
  };

  const changePlayMode = (mode: PlayMode) => {
    if (mode === playMode) return;
    setPlayMode(mode);
    localStorage.setItem(MODE_KEY, mode);
    startNewGame();
  };

  const modeBest = stats.bestByMode[playMode];
  const showLoss = (hasLost || timedOut) && !hasWon;
  const inputLocked = hasWon || timedOut || isBotPlaying || isSolving;

  const showHint = () => {
    if (inputLocked) return;
    const move = getHintMove(gameState);
    setHint(move);
    if (!move) playError();
  };

  const isSourceHinted = (pos: Position, cardIndex?: number): boolean => {
    if (!hint) return false;
    const src = hint.source;
    if (src.zone !== pos.zone || src.index !== pos.index) return false;
    if (src.zone === "tableau") {
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
            alert("無法找到解答 (No solution found within limit). The bot might be stuck or the game is unsolvable from here.");
          }
        }, 50);
      }
    }
  };

  const clearBotState = () => {
    setIsBotPlaying(false);
    setSolutionPath(null);
  };

  const handleCardClick = (pos: Position, hasCard: boolean) => {
    if (inputLocked) return;
    clearHint();

    if (selectedPos) {
      if (positionsEqual(selectedPos, pos)) {
        setSelectedPos(null);
        return;
      }

      if (pos.zone === "foundation") {
        if (canMove(gameState, selectedPos, pos)) {
          handleMove(selectedPos, pos);
          setSelectedPos(null);
          clearBotState();
          return;
        }
      }

      if (pos.zone === "freeCell" && !hasCard) {
        if (canMove(gameState, selectedPos, pos)) {
          handleMove(selectedPos, pos);
          setSelectedPos(null);
          clearBotState();
          return;
        }
      }

      if (pos.zone === "tableau") {
        const col = gameState.tableaus[pos.index];
        const isBottomOrEmpty = !hasCard || pos.cardIndex === col.length - 1;

        if (isBottomOrEmpty && canMove(gameState, selectedPos, pos)) {
          handleMove(selectedPos, pos);
          setSelectedPos(null);
          clearBotState();
          return;
        }
      }
    }

    if (hasCard && pos.zone !== "foundation") {
      if (pos.zone === "tableau") {
        const col = gameState.tableaus[pos.index];
        const cardsToMove = col.slice(pos.cardIndex);
        if (isValidSequence(cardsToMove)) {
          setSelectedPos(pos);
        }
      } else {
        setSelectedPos(pos);
      }
    } else {
      setSelectedPos(null);
    }
  };

  const handleDoubleClick = (pos: Position) => {
    if (inputLocked) return;
    clearHint();

    if (canMove(gameState, pos, { zone: "foundation", index: 0 })) {
      handleMove(pos, { zone: "foundation", index: 0 });
      setSelectedPos(null);
      clearBotState();
      return;
    }

    const emptyFreeCellIndex = gameState.freeCells.findIndex((c) => c === null);
    if (emptyFreeCellIndex !== -1) {
      if (canMove(gameState, pos, { zone: "freeCell", index: emptyFreeCellIndex })) {
        handleMove(pos, { zone: "freeCell", index: emptyFreeCellIndex });
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

    if (pos.zone === "tableau") {
      const col = gameState.tableaus[pos.index];
      const cardsToMove = col.slice(pos.cardIndex);
      if (!isValidSequence(cardsToMove)) {
        e.preventDefault();
        return;
      }
    }

    clearHint();
    setSelectedPos(pos);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(pos));
  };

  const handleDragOver = (e: React.DragEvent, _pos: Position) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
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
    if (destPos.zone === "tableau") {
      actualDest = { zone: "tableau", index: destPos.index };
    }

    if (canMove(gameState, selectedPos, actualDest)) {
      handleMove(selectedPos, actualDest);
      clearBotState();
    }

    setSelectedPos(null);
  };

  return (
    <div
      className="min-h-screen text-stone-800 p-2 pt-14 sm:p-4 sm:pt-16 md:p-8 md:pt-14 font-sans select-none overflow-x-hidden bg-cover bg-center"
      style={{
        backgroundColor: '#FDFCF8',
        backgroundImage: [
          'linear-gradient(rgba(253,252,248,0.88), rgba(253,252,248,0.94))',
          `url(${import.meta.env.BASE_URL}table-bg.jpg)`,
        ].join(', '),
      }}
    >
      <BackToMenu />
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold tracking-tight text-stone-900">
              FreeCell
            </h1>
            <p className="text-sm text-stone-500 mt-1 tabular-nums">
              局號 {dealSeed}
              {" · "}
              {playMode === "timed"
                ? `剩餘 ${formatTime(Math.max(0, TIMED_LIMIT_SEC - elapsedSec))}`
                : `時間 ${formatTime(elapsedSec)}`}
              {" · "}
              勝場 {stats.wins}
              {" · "}
              最佳 {modeBest == null ? "—" : formatTime(modeBest)}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 items-center">
            <div className="flex rounded-full overflow-hidden border border-stone-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => changePlayMode("classic")}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  playMode === "classic" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-50"
                }`}
              >
                經典
              </button>
              <button
                type="button"
                onClick={() => changePlayMode("timed")}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  playMode === "timed" ? "bg-stone-900 text-white" : "text-stone-600 hover:bg-stone-50"
                }`}
              >
                限時 5 分
              </button>
            </div>
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
                disabled={isSolving}
              />
              <button
                type="submit"
                disabled={isSolving}
                className="px-3 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 shadow-sm"
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
              onClick={() => setIsRulesOpen(true)}
              className="min-h-[44px] min-w-[44px] px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors shadow-sm flex items-center justify-center gap-2 touch-manipulation"
              title="規則"
              aria-label="規則"
            >
              <Info size={16} />
              <span className="hidden sm:inline">規則</span>
            </button>
            <button
              type="button"
              onClick={showHint}
              disabled={inputLocked}
              className="min-h-[44px] min-w-[44px] px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 disabled:opacity-40 transition-colors shadow-sm flex items-center justify-center gap-2 touch-manipulation"
              title="提示"
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
                  ? "bg-stone-200 text-stone-500 cursor-not-allowed"
                  : isBotPlaying
                    ? "bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200"
                    : "bg-stone-900 text-white hover:bg-stone-800"
              }`}
              title="自動解答"
              aria-label={isSolving ? "思考中" : isBotPlaying ? "停止解答" : "自動解答"}
            >
              {isSolving ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
              <span className="hidden sm:inline">
                {isSolving ? "思考中…" : isBotPlaying ? "停止" : "解答"}
              </span>
            </button>
            <button
              type="button"
              onClick={undo}
              disabled={gameState.history.length === 0 || isBotPlaying || isSolving}
              className="min-h-[44px] min-w-[44px] px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 disabled:opacity-40 transition-colors shadow-sm flex items-center justify-center gap-2 touch-manipulation"
              title="復原"
              aria-label="復原"
            >
              <Undo2 size={16} />
              <span className="hidden sm:inline">復原</span>
            </button>
            <button
              type="button"
              onClick={redealSame}
              disabled={isSolving}
              className="min-h-[44px] min-w-[44px] px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 disabled:opacity-40 transition-colors shadow-sm flex items-center justify-center gap-2 touch-manipulation"
              title="重新發同局"
              aria-label="重新發同局"
            >
              <RefreshCw size={16} />
              <span className="hidden sm:inline">同局重發</span>
            </button>
            <button
              type="button"
              onClick={startNewGame}
              disabled={isSolving}
              className="min-h-[44px] min-w-[44px] px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 disabled:opacity-40 transition-colors shadow-sm flex items-center justify-center gap-2 touch-manipulation"
              title="新遊戲"
              aria-label="新遊戲"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">新遊戲</span>
            </button>
          </div>
        </div>

        {hasWon && (
          <ResultOverlay
            title="過關！"
            variant="win"
            subtitle={playMode === "timed" ? "限時模式過關" : "你成功解開這局 FreeCell"}
            stats={[
              { label: "本局時間", value: formatTime(elapsedSec) },
              { label: "步數", value: gameState.history.length },
              { label: "勝場", value: stats.wins },
              {
                label: playMode === "timed" ? "最佳時間（限時）" : "最佳時間（經典）",
                value: modeBest == null ? "—" : formatTime(modeBest),
              },
            ]}
            primaryLabel="新遊戲"
            onPrimary={startNewGame}
          />
        )}

        {showLoss && (
          <ResultOverlay
            title={timedOut ? "時間到" : "無法再移動"}
            variant="lose"
            subtitle={
              timedOut
                ? "限時 5 分鐘已用完，試試同局重發或開新局"
                : "沒有合法步數了，試試復原、同局重發或開新局"
            }
            primaryLabel="新遊戲"
            onPrimary={startNewGame}
          />
        )}

        <div className="flex justify-between mb-8">
          <div className="flex gap-1 sm:gap-2 md:gap-4 w-[48%]">
            {gameState.freeCells.map((card, i) => {
              const pos: Position = { zone: "freeCell", index: i };
              return (
                <div key={`fc-${i}`} className="flex-1">
                  <PlayingCard
                    card={card}
                    isSelected={selectedPos?.zone === "freeCell" && selectedPos.index === i}
                    isSelectable={!!card}
                    isHinted={isSourceHinted(pos) || (!card && isDestHinted(pos))}
                    onClick={() => handleCardClick(pos, !!card)}
                    onDoubleClick={() => card && handleDoubleClick(pos)}
                    draggable={false}
                    onDragStart={(e) => handleDragStart(e, pos)}
                    onDragOver={(e) => handleDragOver(e, pos)}
                    onDrop={(e) => handleDrop(e, pos)}
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
                      color:
                        suit === "hearts" || suit === "diamonds" ? "red" : "black",
                    } as Card)
                  : null;

              const suitSymbols: Record<Suit, string> = {
                spades: "♠",
                hearts: "♥",
                diamonds: "♦",
                clubs: "♣",
              };

              const pos: Position = { zone: "foundation", index: i };

              return (
                <div key={`fd-${suit}`} className="flex-1">
                  <PlayingCard
                    card={card}
                    placeholder={suitSymbols[suit]}
                    isHinted={isDestHinted(pos)}
                    onClick={() => handleCardClick(pos, false)}
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
            <div key={`tab-${colIndex}`} className="flex flex-col">
              {col.length === 0 ? (
                <PlayingCard
                  card={null}
                  isHinted={isDestHinted({ zone: "tableau", index: colIndex })}
                  onClick={() =>
                    handleCardClick({ zone: "tableau", index: colIndex, cardIndex: 0 }, false)
                  }
                  onDragOver={(e) =>
                    handleDragOver(e, { zone: "tableau", index: colIndex, cardIndex: 0 })
                  }
                  onDrop={(e) =>
                    handleDrop(e, { zone: "tableau", index: colIndex, cardIndex: 0 })
                  }
                />
              ) : (
                col.map((card, cardIndex) => {
                  const isSelected =
                    selectedPos?.zone === "tableau" &&
                    selectedPos.index === colIndex &&
                    cardIndex >= selectedPos.cardIndex!;

                  const isSelectable = isValidSequence(col.slice(cardIndex));
                  const pos: Position = {
                    zone: "tableau",
                    index: colIndex,
                    cardIndex,
                  };
                  const isLast = cardIndex === col.length - 1;

                  return (
                    <div
                      key={card.id}
                      className={cardIndex > 0 ? "-mt-[115%] relative" : "relative"}
                      style={{ zIndex: cardIndex }}
                    >
                      <PlayingCard
                        card={card}
                        isSelected={isSelected}
                        isSelectable={isSelectable}
                        isHinted={
                          isSourceHinted(pos, cardIndex) ||
                          (isLast && isDestHinted({ zone: "tableau", index: colIndex }))
                        }
                        onClick={() => handleCardClick(pos, true)}
                        onDoubleClick={() => handleDoubleClick(pos)}
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

      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
    </div>
  );
}

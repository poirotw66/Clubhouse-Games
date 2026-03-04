import React, { useState, useEffect } from "react";
import { GameState, Position, Card, Suit } from "./types";
import { dealGame, SUITS } from "./utils/deck";
import {
  canMove,
  executeMove,
  getSafeFoundationMoves,
  checkWin,
  checkLoss,
  isValidSequence,
} from "./utils/gameLogic";
import { solveGame } from "./utils/solver";
import { PlayingCard } from "./components/PlayingCard";
import { RulesModal } from "./components/RulesModal";
import { Undo2, RotateCcw, Info, Bot, Loader2 } from "lucide-react";

export default function App() {
  const [gameState, setGameState] = useState<GameState>(() => {
    const { tableaus } = dealGame();
    return {
      freeCells: [null, null, null, null],
      foundations: { spades: 0, hearts: 0, diamonds: 0, clubs: 0 },
      tableaus,
      history: [],
    };
  });

  const [selectedPos, setSelectedPos] = useState<Position | null>(null);
  const [autoMove, setAutoMove] = useState(true);
  const [hasWon, setHasWon] = useState(false);
  const [hasLost, setHasLost] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  
  // Bot states
  const [isBotPlaying, setIsBotPlaying] = useState(false);
  const [isSolving, setIsSolving] = useState(false);
  const [solutionPath, setSolutionPath] = useState<{ source: Position, dest: Position }[] | null>(null);

  useEffect(() => {
    if (checkWin(gameState)) {
      setHasWon(true);
      setHasLost(false);
      setIsBotPlaying(false);
    } else {
      setHasWon(false);
      const lost = checkLoss(gameState);
      setHasLost(lost);
      if (lost) setIsBotPlaying(false);
    }
  }, [gameState]);

  useEffect(() => {
    if (hasWon || hasLost || isSolving) return;
    
    // Priority 1: Safe auto-move to foundation (if enabled)
    if (autoMove && !isBotPlaying) {
      const safeMove = getSafeFoundationMoves(gameState);
      if (safeMove && !selectedPos) {
        const timer = setTimeout(() => {
          handleMove(safeMove.source, safeMove.dest);
        }, 150);
        return () => clearTimeout(timer);
      }
    }

    // Priority 2: Bot playing from solution path
    if (isBotPlaying && solutionPath && solutionPath.length > 0) {
      const timer = setTimeout(() => {
        const move = solutionPath[0];
        handleMove(move.source, move.dest);
        setSolutionPath(prev => prev ? prev.slice(1) : null);
      }, 300); // 300ms delay between bot moves
      return () => clearTimeout(timer);
    } else if (isBotPlaying && solutionPath && solutionPath.length === 0) {
      setIsBotPlaying(false);
    }
  }, [gameState, selectedPos, autoMove, hasWon, hasLost, isBotPlaying, isSolving, solutionPath]);

  const handleMove = (source: Position, dest: Position) => {
    setGameState((prev) => {
      const nextState = executeMove(prev, source, dest);
      return {
        ...nextState,
        history: [...prev.history, prev],
      };
    });
  };

  const undo = () => {
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
  };

  const startNewGame = () => {
    const { tableaus } = dealGame();
    setGameState({
      freeCells: [null, null, null, null],
      foundations: { spades: 0, hearts: 0, diamonds: 0, clubs: 0 },
      tableaus,
      history: [],
    });
    setSelectedPos(null);
    setHasWon(false);
    setHasLost(false);
    setIsBotPlaying(false);
    setSolutionPath(null);
  };

  const toggleBot = async () => {
    if (isBotPlaying) {
      setIsBotPlaying(false);
      setSolutionPath(null);
    } else {
      setIsBotPlaying(true);
      if (!solutionPath || solutionPath.length === 0) {
        setIsSolving(true);
        // Add a small delay so UI can render the "Thinking..." state
        setTimeout(async () => {
          const path = await solveGame(gameState, (nodes) => {
            // Optional: could update a progress bar here
          });
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
    if (hasWon || isBotPlaying || isSolving) return;

    if (selectedPos) {
      if (
        selectedPos.zone === pos.zone &&
        selectedPos.index === pos.index &&
        selectedPos.cardIndex === pos.cardIndex
      ) {
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
    if (hasWon || isBotPlaying || isSolving) return;

    if (canMove(gameState, pos, { zone: "foundation", index: 0 })) {
      handleMove(pos, { zone: "foundation", index: 0 });
      setSelectedPos(null);
      clearBotState();
      return;
    }

    const emptyFreeCellIndex = gameState.freeCells.findIndex((c) => c === null);
    if (emptyFreeCellIndex !== -1) {
      if (
        canMove(gameState, pos, { zone: "freeCell", index: emptyFreeCellIndex })
      ) {
        handleMove(pos, { zone: "freeCell", index: emptyFreeCellIndex });
        setSelectedPos(null);
        clearBotState();
        return;
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, pos: Position) => {
    if (hasWon || isBotPlaying || isSolving) {
      e.preventDefault();
      return;
    }
    
    // Only allow dragging if it's a valid sequence
    if (pos.zone === "tableau") {
      const col = gameState.tableaus[pos.index];
      const cardsToMove = col.slice(pos.cardIndex);
      if (!isValidSequence(cardsToMove)) {
        e.preventDefault();
        return;
      }
    }
    
    setSelectedPos(pos);
    e.dataTransfer.effectAllowed = "move";
    // We need to set some data for drag and drop to work in Firefox
    e.dataTransfer.setData("text/plain", JSON.stringify(pos));
  };

  const handleDragOver = (e: React.DragEvent, pos: Position) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = (e: React.DragEvent, destPos: Position) => {
    e.preventDefault();
    if (hasWon || !selectedPos || isBotPlaying || isSolving) return;

    // Don't drop on itself
    if (
      selectedPos.zone === destPos.zone &&
      selectedPos.index === destPos.index &&
      selectedPos.cardIndex === destPos.cardIndex
    ) {
      setSelectedPos(null);
      return;
    }

    // Adjust destination for tableau drops (always drop on the column)
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
    <div className="min-h-screen bg-[#FDFCF8] text-stone-800 p-2 sm:p-4 md:p-8 font-sans select-none overflow-x-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold tracking-tight text-stone-900">
            FreeCell
          </h1>
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 items-center">
            <label className="hidden sm:flex items-center gap-2 text-sm font-medium text-stone-500 cursor-pointer hover:text-stone-800 transition-colors px-2">
              <input
                type="checkbox"
                checked={autoMove}
                onChange={(e) => setAutoMove(e.target.checked)}
                className="rounded border-stone-300 text-stone-900 focus:ring-stone-900"
              />
              Auto-move
            </label>
            <button
              onClick={() => setIsRulesOpen(true)}
              className="px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors shadow-sm flex items-center gap-2"
              title="Rules"
            >
              <Info size={16} />
              <span className="hidden sm:inline">Rules</span>
            </button>
            <button
              onClick={toggleBot}
              disabled={isSolving}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 shadow-sm ${
                isSolving 
                  ? 'bg-stone-200 text-stone-500 cursor-not-allowed'
                  : isBotPlaying 
                    ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200' 
                    : 'bg-stone-900 text-white hover:bg-stone-800'
              }`}
              title="Auto Play (Solve)"
            >
              {isSolving ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
              <span className="hidden sm:inline">
                {isSolving ? 'Thinking...' : isBotPlaying ? 'Stop Bot' : 'Solve Game'}
              </span>
            </button>
            <button
              onClick={undo}
              disabled={gameState.history.length === 0 || isBotPlaying || isSolving}
              className="px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 disabled:opacity-40 transition-colors shadow-sm flex items-center gap-2"
              title="Undo"
            >
              <Undo2 size={16} />
              <span className="hidden sm:inline">Undo</span>
            </button>
            <button
              onClick={startNewGame}
              disabled={isSolving}
              className="px-4 py-2 bg-white border border-stone-200 rounded-full text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 disabled:opacity-40 transition-colors shadow-sm flex items-center gap-2"
              title="New Game"
            >
              <RotateCcw size={16} />
              <span className="hidden sm:inline">New Game</span>
            </button>
          </div>
        </div>

        {hasWon && (
          <div className="mb-8 p-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center animate-in fade-in slide-in-from-top-4">
            <h2 className="text-2xl font-serif font-bold text-emerald-900 mb-2">
              Victory
            </h2>
            <p className="text-emerald-700 mb-4">
              You have successfully solved this game.
            </p>
            <button
              onClick={startNewGame}
              className="px-6 py-2 bg-emerald-600 text-white font-medium rounded-full hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Play Again
            </button>
          </div>
        )}

        {hasLost && !hasWon && (
          <div className="mb-8 p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center animate-in fade-in slide-in-from-top-4">
            <h2 className="text-2xl font-serif font-bold text-rose-900 mb-2">
              No More Moves
            </h2>
            <p className="text-rose-700 mb-4">
              There are no valid moves left. Try undoing or start a new game.
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={undo}
                disabled={gameState.history.length === 0}
                className="px-6 py-2 bg-white border border-rose-200 text-rose-700 font-medium rounded-full hover:bg-rose-50 transition-colors disabled:opacity-50 shadow-sm"
              >
                Undo Move
              </button>
              <button
                onClick={startNewGame}
                className="px-6 py-2 bg-rose-600 text-white font-medium rounded-full hover:bg-rose-700 transition-colors shadow-sm"
              >
                New Game
              </button>
            </div>
          </div>
        )}

        {/* Top Row: Free Cells & Foundations */}
        <div className="flex justify-between mb-8">
          {/* Free Cells */}
          <div className="flex gap-1 sm:gap-2 md:gap-4 w-[48%]">
            {gameState.freeCells.map((card, i) => (
              <div key={`fc-${i}`} className="flex-1">
                <PlayingCard
                  card={card}
                  isSelected={
                    selectedPos?.zone === "freeCell" && selectedPos.index === i
                  }
                  isSelectable={!!card}
                  onClick={() =>
                    handleCardClick({ zone: "freeCell", index: i }, !!card)
                  }
                  onDoubleClick={() =>
                    card && handleDoubleClick({ zone: "freeCell", index: i })
                  }
                  draggable={!!card}
                  onDragStart={(e) => handleDragStart(e, { zone: "freeCell", index: i })}
                  onDragOver={(e) => handleDragOver(e, { zone: "freeCell", index: i })}
                  onDrop={(e) => handleDrop(e, { zone: "freeCell", index: i })}
                />
              </div>
            ))}
          </div>

          {/* Foundations */}
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
                        suit === "hearts" || suit === "diamonds"
                          ? "red"
                          : "black",
                    } as Card)
                  : null;

              const suitSymbols = {
                spades: "♠",
                hearts: "♥",
                diamonds: "♦",
                clubs: "♣",
              };

              return (
                <div key={`fd-${suit}`} className="flex-1">
                  <PlayingCard
                    card={card}
                    placeholder={suitSymbols[suit]}
                    onClick={() =>
                      handleCardClick({ zone: "foundation", index: i }, false)
                    }
                    onDragOver={(e) => handleDragOver(e, { zone: "foundation", index: i })}
                    onDrop={(e) => handleDrop(e, { zone: "foundation", index: i })}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Tableaus */}
        <div className="grid grid-cols-8 gap-1 sm:gap-2 md:gap-4">
          {gameState.tableaus.map((col, colIndex) => (
            <div key={`tab-${colIndex}`} className="flex flex-col">
              {col.length === 0 ? (
                <PlayingCard
                  card={null}
                  onClick={() =>
                    handleCardClick(
                      { zone: "tableau", index: colIndex, cardIndex: 0 },
                      false,
                    )
                  }
                  onDragOver={(e) => handleDragOver(e, { zone: "tableau", index: colIndex, cardIndex: 0 })}
                  onDrop={(e) => handleDrop(e, { zone: "tableau", index: colIndex, cardIndex: 0 })}
                />
              ) : (
                col.map((card, cardIndex) => {
                  const isSelected =
                    selectedPos?.zone === "tableau" &&
                    selectedPos.index === colIndex &&
                    cardIndex >= selectedPos.cardIndex!;

                  // Check if this card is part of a valid sequence from here to the bottom
                  const isSelectable = isValidSequence(col.slice(cardIndex));

                  return (
                    <div
                      key={card.id}
                      className={
                        cardIndex > 0 ? "-mt-[115%] relative" : "relative"
                      }
                      style={{ zIndex: cardIndex }}
                    >
                      <PlayingCard
                        card={card}
                        isSelected={isSelected}
                        isSelectable={isSelectable}
                        onClick={() =>
                          handleCardClick(
                            { zone: "tableau", index: colIndex, cardIndex },
                            true,
                          )
                        }
                        onDoubleClick={() =>
                          handleDoubleClick({
                            zone: "tableau",
                            index: colIndex,
                            cardIndex,
                          })
                        }
                        draggable={isSelectable}
                        onDragStart={(e) => handleDragStart(e, { zone: "tableau", index: colIndex, cardIndex })}
                        onDragOver={(e) => handleDragOver(e, { zone: "tableau", index: colIndex, cardIndex })}
                        onDrop={(e) => handleDrop(e, { zone: "tableau", index: colIndex, cardIndex })}
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

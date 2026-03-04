import React, { useState, useEffect, useRef } from 'react';
import { Card } from './components/Card';
import { EmptySlot } from './components/EmptySlot';
import { GameState, DragSource, CardType } from './types';
import { dealGame, shuffleDeck } from './utils/deck';
import { canMoveToTableau, canMoveToFoundation } from './utils/gameLogic';
import { RotateCcw, Undo2, Bot, Square } from 'lucide-react';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(dealGame());
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [isGameOverNoMoves, setIsGameOverNoMoves] = useState(false);
  const [draggingSource, setDraggingSource] = useState<DragSource | null>(null);
  const noProgressCount = useRef(0);

  const saveHistory = (state: GameState) => {
    return {
      tableau: state.tableau.map(col => col.map(c => ({ ...c }))),
      foundation: state.foundation.map(pile => pile.map(c => ({ ...c }))),
      waste: state.waste.map(c => ({ ...c })),
      stock: state.stock.map(c => ({ ...c })),
    };
  };

  const executeMove = (source: DragSource, target: { type: 'tableau' | 'foundation', index: number }, cardsToMove: CardType[]) => {
    setGameState(prevState => {
      const nextState = {
        ...prevState,
        tableau: prevState.tableau.map(col => [...col]),
        foundation: prevState.foundation.map(pile => [...pile]),
        waste: [...prevState.waste],
        stock: [...prevState.stock],
        history: [...prevState.history, saveHistory(prevState)]
      };

      // Remove from source
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

      // Add to target
      if (target.type === 'tableau') {
        nextState.tableau[target.index].push(...cardsToMove);
      } else if (target.type === 'foundation') {
        nextState.foundation[target.index].push(...cardsToMove);
      }

      return nextState;
    });
  };

  const attemptMove = (source: DragSource, target: { type: 'tableau' | 'foundation', index: number }) => {
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
      if (cardsToMove.length > 1) return; // Can only move 1 card to foundation
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
    } catch (err) {
      // ignore invalid drops
    }
  };

  const handleDropOnFoundation = (e: React.DragEvent, pileIndex: number) => {
    e.preventDefault();
    try {
      const source: DragSource = JSON.parse(e.dataTransfer.getData('application/json'));
      attemptMove(source, { type: 'foundation', index: pileIndex });
    } catch (err) {
      // ignore invalid drops
    }
  };

  const handleDoubleClick = (source: DragSource) => {
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
    setGameState(prevState => {
      if (prevState.stock.length === 0) return prevState;
      
      const nextState = {
        ...prevState,
        stock: [...prevState.stock],
        waste: [...prevState.waste],
        history: [...prevState.history, saveHistory(prevState)]
      };

      const card = nextState.stock.pop()!;
      card.faceUp = true;
      nextState.waste.push(card);

      return nextState;
    });
  };

  const recycleWaste = () => {
    setGameState(prevState => {
      if (prevState.stock.length > 0 || prevState.waste.length === 0) return prevState;

      const nextState = {
        ...prevState,
        stock: [...prevState.waste].reverse().map(c => ({ ...c, faceUp: false })),
        waste: [],
        history: [...prevState.history, saveHistory(prevState)]
      };

      return nextState;
    });
  };

  const undo = () => {
    setGameState(prevState => {
      if (prevState.history.length === 0) return prevState;
      const previous = prevState.history[prevState.history.length - 1];
      return {
        ...previous,
        history: prevState.history.slice(0, -1)
      };
    });
  };

  const isGameWon = gameState.foundation.every(pile => pile.length === 13);

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
    const availableCards = [...state.waste, ...state.stock];
    for (const card of availableCards) {
      for (let f = 0; f < 4; f++) {
        const pile = state.foundation[f];
        const topF = pile.length > 0 ? pile[pile.length - 1] : undefined;
        if (canMoveToFoundation(card, topF)) return true;
      }
      for (let c = 0; c < 7; c++) {
        const col = state.tableau[c];
        const topT = col.length > 0 ? col[col.length - 1] : undefined;
        if (canMoveToTableau(card, topT)) return true;
      }
    }

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
    if (isGameWon) return;
    if (!checkHasMoves(gameState)) {
      setIsGameOverNoMoves(true);
      setIsAutoPlaying(false);
    } else {
      setIsGameOverNoMoves(false);
    }
  }, [gameState, isGameWon]);

  const reshuffleBoard = () => {
    setGameState(prevState => {
      const cardsToCollect: CardType[] = [];
      prevState.tableau.forEach(col => cardsToCollect.push(...col));
      cardsToCollect.push(...prevState.stock);
      cardsToCollect.push(...prevState.waste);
      
      const cardsToShuffle = cardsToCollect.map(c => ({ ...c, faceUp: false }));
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
        history: [...prevState.history, saveHistory(prevState)]
      };
    });
    setIsGameOverNoMoves(false);
  };

  const makeAutoMove = () => {
    const state = gameState;

    const doMove = (action: () => void, isProgress: boolean) => {
      if (isProgress) noProgressCount.current = 0;
      else noProgressCount.current += 1;
      action();
    };

    // 1. Tableau to Foundation
    for (let c = 0; c < 7; c++) {
      const col = state.tableau[c];
      if (col.length === 0) continue;
      const card = col[col.length - 1];
      for (let f = 0; f < 4; f++) {
        const pile = state.foundation[f];
        const topF = pile.length > 0 ? pile[pile.length - 1] : undefined;
        if (canMoveToFoundation(card, topF)) {
          doMove(() => executeMove({ type: 'tableau', colIndex: c, cardIndex: col.length - 1 }, { type: 'foundation', index: f }, [card]), true);
          return;
        }
      }
    }

    // 2. Waste to Foundation
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

    // 3. Waste to Tableau
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

    // 4. Tableau to Tableau
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
            doMove(() => executeMove({ type: 'tableau', colIndex: srcC, cardIndex: cardIdx }, { type: 'tableau', index: tgtC }, cardsToMove), true);
            return;
          }
        }
      }
    }

    // 5. Draw from Stock
    if (state.stock.length > 0) {
      doMove(() => drawCard(), false);
      return;
    }

    // 6. Recycle Waste
    if (state.waste.length > 0) {
      doMove(() => recycleWaste(), false);
      return;
    }

    // 7. No moves possible at all
    setIsAutoPlaying(false);
  };

  useEffect(() => {
    if (!isAutoPlaying || isGameWon) return;

    if (noProgressCount.current > 100) {
      setIsAutoPlaying(false);
      noProgressCount.current = 0;
      return;
    }

    const timer = setTimeout(() => {
      makeAutoMove();
    }, 150);

    return () => clearTimeout(timer);
  }, [isAutoPlaying, gameState, isGameWon]);

  return (
    <div className="min-h-screen bg-emerald-800 text-white p-4 md:p-8 font-sans select-none">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Klondike Solitaire</h1>
          <div className="flex gap-2 sm:gap-4">
            <button 
              onClick={() => {
                setIsAutoPlaying(!isAutoPlaying);
                noProgressCount.current = 0;
              }} 
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg transition-colors ${isAutoPlaying ? 'bg-red-500/80 hover:bg-red-500' : 'bg-blue-500/80 hover:bg-blue-500'}`}
            >
              {isAutoPlaying ? <Square size={20} /> : <Bot size={20} />} 
              <span className="hidden sm:inline">{isAutoPlaying ? 'Stop Auto' : 'Auto Play'}</span>
            </button>
            <button 
              onClick={undo} 
              disabled={gameState.history.length === 0 || isAutoPlaying} 
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-black/20 rounded-lg hover:bg-black/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Undo2 size={20} /> <span className="hidden sm:inline">Undo</span>
            </button>
            <button 
              onClick={() => {
                setGameState(dealGame());
                setIsAutoPlaying(false);
                noProgressCount.current = 0;
              }} 
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-black/20 rounded-lg hover:bg-black/30 transition-colors"
            >
              <RotateCcw size={20} /> <span className="hidden sm:inline">New Game</span>
            </button>
          </div>
        </div>

        {/* Top Row: Stock, Waste, Foundations */}
        <div className="flex justify-between mb-12 gap-4 overflow-x-auto pb-4">
          <div className="flex gap-4 shrink-0">
            {/* Stock */}
            <div onClick={gameState.stock.length > 0 ? drawCard : recycleWaste} className="cursor-pointer shrink-0">
              {gameState.stock.length > 0 ? (
                <Card faceDown />
              ) : (
                <div className="w-24 h-36 rounded-xl border-2 border-black/20 flex items-center justify-center hover:bg-black/10 transition-colors">
                  <RotateCcw className="text-black/30" size={32} />
                </div>
              )}
            </div>
            
            {/* Waste */}
            <div className="relative w-24 h-36 shrink-0">
              {gameState.waste.length === 0 ? (
                <EmptySlot />
              ) : (
                gameState.waste.map((card, index) => {
                  if (index < gameState.waste.length - 3) return null;
                  const displayIndex = index - Math.max(0, gameState.waste.length - 3);
                  const isTop = index === gameState.waste.length - 1;
                  const playableToFoundation = isTop && checkCanMoveToFoundation(card);
                  return (
                    <div 
                      key={card.id} 
                      className="absolute top-0 left-0"
                      style={{ transform: `translateX(${displayIndex * 20}px)` }}
                    >
                      <Card 
                        card={card} 
                        isDraggable={isTop}
                        isDragging={draggingSource?.type === 'waste' && isTop}
                        isPlayableToFoundation={playableToFoundation}
                        onDragStart={(e) => isTop && handleDragStart(e, { type: 'waste' })}
                        onDragEnd={handleDragEnd}
                        onDoubleClick={() => isTop && handleDoubleClick({ type: 'waste' })}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Foundations */}
          <div className="flex gap-4 shrink-0 ml-auto">
            {gameState.foundation.map((pile, index) => (
              <div 
                key={`foundation-${index}`}
                className="relative w-24 h-36 shrink-0"
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnFoundation(e, index)}
              >
                <EmptySlot />
                {pile.map((card, cardIndex) => (
                  <div key={card.id} className="absolute top-0 left-0">
                    <Card 
                      card={card}
                      isDraggable={cardIndex === pile.length - 1}
                      isDragging={draggingSource?.type === 'foundation' && draggingSource.pileIndex === index && cardIndex === pile.length - 1}
                      onDragStart={(e) => handleDragStart(e, { type: 'foundation', pileIndex: index })}
                      onDragEnd={handleDragEnd}
                    />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Row: Tableau */}
        <div className="flex justify-between gap-2 sm:gap-4 overflow-x-auto pb-8">
          {gameState.tableau.map((col, colIndex) => (
            <div 
              key={`tableau-${colIndex}`}
              className="relative w-24 min-h-[60vh] shrink-0"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDropOnTableau(e, colIndex)}
            >
              <EmptySlot />
              {col.map((card, cardIndex) => {
                const isBottom = cardIndex === col.length - 1;
                const playableToFoundation = isBottom && checkCanMoveToFoundation(card);
                return (
                  <div 
                    key={card.id} 
                    className="absolute top-0 left-0"
                    style={{ top: `${col.slice(0, cardIndex).reduce((acc, c) => acc + (c.faceUp ? 28 : 12), 0)}px` }}
                  >
                    <Card 
                      card={card}
                      isDraggable={card.faceUp}
                      isDragging={draggingSource?.type === 'tableau' && draggingSource.colIndex === colIndex && cardIndex >= draggingSource.cardIndex}
                      isPlayableToFoundation={playableToFoundation}
                      onDragStart={(e) => card.faceUp && handleDragStart(e, { type: 'tableau', colIndex, cardIndex })}
                      onDragEnd={handleDragEnd}
                      onDoubleClick={() => card.faceUp && handleDoubleClick({ type: 'tableau', colIndex, cardIndex })}
                    />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      
      {/* Win Modal */}
      {isGameWon && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white text-gray-900 p-8 rounded-2xl text-center shadow-2xl">
            <h2 className="text-4xl font-bold mb-4">You Won!</h2>
            <p className="text-lg mb-8">Congratulations on completing the game.</p>
            <button onClick={() => setGameState(dealGame())} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors">
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* No Moves Modal */}
      {isGameOverNoMoves && !isGameWon && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white text-gray-900 p-8 rounded-2xl text-center shadow-2xl max-w-md w-full mx-4">
            <h2 className="text-3xl font-bold mb-4 text-red-600">No More Moves!</h2>
            <p className="text-lg mb-8 text-gray-600">It looks like there are no valid moves left. What would you like to do?</p>
            <div className="flex flex-col gap-3">
              <button onClick={reshuffleBoard} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors w-full">
                Reshuffle Board
              </button>
              <button onClick={() => { setGameState(dealGame()); setIsGameOverNoMoves(false); }} className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors w-full">
                New Game
              </button>
              <button onClick={() => { undo(); setIsGameOverNoMoves(false); }} disabled={gameState.history.length === 0} className="px-6 py-3 bg-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-300 transition-colors w-full disabled:opacity-50">
                Undo Last Move
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

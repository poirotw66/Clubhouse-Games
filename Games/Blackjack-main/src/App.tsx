import React, { useState, useEffect } from 'react';
import { Card as CardType, GameState, PlayerHand } from './types';
import { createDeck, calculateScore, isBlackjack } from './utils/deck';
import { Card } from './components/Card';
import { motion, AnimatePresence } from 'motion/react';
import { Coins, RotateCcw, Play } from 'lucide-react';

export default function App() {
  const [deck, setDeck] = useState<CardType[]>([]);
  const [balance, setBalance] = useState(1000);
  const [currentBet, setCurrentBet] = useState(10);
  const [gameState, setGameState] = useState<GameState>('betting');
  const [dealerCards, setDealerCards] = useState<CardType[]>([]);
  const [playerHands, setPlayerHands] = useState<PlayerHand[]>([]);
  const [activeHandIndex, setActiveHandIndex] = useState(0);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setDeck(createDeck(6));
  }, []);

  const placeBet = (amount: number) => {
    if (gameState !== 'betting') return;
    if (currentBet + amount > balance) return;
    setCurrentBet(prev => prev + amount);
  };

  const clearBet = () => {
    if (gameState !== 'betting') return;
    setCurrentBet(0);
  };

  const deal = () => {
    if (currentBet === 0 || currentBet > balance) return;
    
    let currentDeck = [...deck];
    if (currentDeck.length < 20) {
      currentDeck = createDeck(6);
    }

    setBalance(prev => prev - currentBet);

    const pCard1 = currentDeck.pop()!;
    const dCard1 = currentDeck.pop()!;
    const pCard2 = currentDeck.pop()!;
    const dCard2 = { ...currentDeck.pop()!, isHidden: true };

    setDeck(currentDeck);
    
    const initialPlayerCards = [pCard1, pCard2];
    const initialDealerCards = [dCard1, dCard2];
    
    setDealerCards(initialDealerCards);
    
    const isPlayerBJ = isBlackjack(initialPlayerCards);
    const dealerPeeks = dCard1.rank === 'A' || ['10', 'J', 'Q', 'K'].includes(dCard1.rank);
    let isDealerBJ = false;
    
    if (dealerPeeks) {
      isDealerBJ = isBlackjack([{...dCard1, isHidden: false}, {...dCard2, isHidden: false}]);
    }

    if (isPlayerBJ && isDealerBJ) {
      setPlayerHands([{ id: '1', cards: initialPlayerCards, bet: currentBet, status: 'push' }]);
      setDealerCards([{...dCard1}, {...dCard2, isHidden: false}]);
      setBalance(prev => prev + currentBet);
      setMessage('Push! Both have Blackjack.');
      setGameState('gameOver');
    } else if (isPlayerBJ) {
      const winAmount = currentBet * 2.5;
      setPlayerHands([{ id: '1', cards: initialPlayerCards, bet: currentBet, status: 'blackjack' }]);
      setDealerCards([{...dCard1}, {...dCard2, isHidden: false}]);
      setBalance(prev => prev + winAmount);
      setMessage('Blackjack! You win 3:2.');
      setGameState('gameOver');
    } else if (isDealerBJ) {
      setPlayerHands([{ id: '1', cards: initialPlayerCards, bet: currentBet, status: 'lost' }]);
      setDealerCards([{...dCard1}, {...dCard2, isHidden: false}]);
      setMessage('Dealer has Blackjack.');
      setGameState('gameOver');
    } else {
      setPlayerHands([{ id: '1', cards: initialPlayerCards, bet: currentBet, status: 'playing' }]);
      setGameState('playing');
      setActiveHandIndex(0);
      setMessage('');
    }
  };

  const advanceHand = (hands: PlayerHand[]) => {
    setPlayerHands(hands);
    if (activeHandIndex < hands.length - 1) {
      setActiveHandIndex(prev => prev + 1);
    } else {
      setGameState('dealerTurn');
    }
  };

  const hit = () => {
    if (gameState !== 'playing') return;
    
    const currentDeck = [...deck];
    const card = currentDeck.pop()!;
    setDeck(currentDeck);
    
    const newHands = [...playerHands];
    const activeHand = newHands[activeHandIndex];
    activeHand.cards.push(card);
    
    const score = calculateScore(activeHand.cards);
    if (score > 21) {
      activeHand.status = 'busted';
      advanceHand(newHands);
    } else {
      setPlayerHands(newHands);
    }
  };

  const stand = () => {
    if (gameState !== 'playing') return;
    const newHands = [...playerHands];
    newHands[activeHandIndex].status = 'stood';
    advanceHand(newHands);
  };

  const doubleDown = () => {
    if (gameState !== 'playing') return;
    const activeHand = playerHands[activeHandIndex];
    if (activeHand.cards.length !== 2) return;
    if (balance < activeHand.bet) return;
    
    setBalance(prev => prev - activeHand.bet);
    
    const currentDeck = [...deck];
    const card = currentDeck.pop()!;
    setDeck(currentDeck);
    
    const newHands = [...playerHands];
    newHands[activeHandIndex].bet *= 2;
    newHands[activeHandIndex].cards.push(card);
    
    const score = calculateScore(newHands[activeHandIndex].cards);
    if (score > 21) {
      newHands[activeHandIndex].status = 'busted';
    } else {
      newHands[activeHandIndex].status = 'stood';
    }
    
    advanceHand(newHands);
  };

  const canSplit = () => {
    if (gameState !== 'playing') return false;
    const hand = playerHands[activeHandIndex];
    if (hand.cards.length !== 2) return false;
    if (balance < hand.bet) return false;
    
    const val1 = ['J', 'Q', 'K'].includes(hand.cards[0].rank) ? '10' : hand.cards[0].rank;
    const val2 = ['J', 'Q', 'K'].includes(hand.cards[1].rank) ? '10' : hand.cards[1].rank;
    return val1 === val2;
  };

  const split = () => {
    if (!canSplit()) return;
    
    const currentDeck = [...deck];
    const hand = playerHands[activeHandIndex];
    
    setBalance(prev => prev - hand.bet);
    
    const card1 = hand.cards[0];
    const card2 = hand.cards[1];
    
    const newCard1 = currentDeck.pop()!;
    const newCard2 = currentDeck.pop()!;
    
    setDeck(currentDeck);
    
    const newHand1: PlayerHand = {
      id: hand.id + '-1',
      cards: [card1, newCard1],
      bet: hand.bet,
      status: 'playing'
    };
    
    const newHand2: PlayerHand = {
      id: hand.id + '-2',
      cards: [card2, newCard2],
      bet: hand.bet,
      status: 'playing'
    };
    
    const newHands = [...playerHands];
    newHands.splice(activeHandIndex, 1, newHand1, newHand2);
    
    setPlayerHands(newHands);
  };

  useEffect(() => {
    if (gameState === 'dealerTurn') {
      const playDealer = async () => {
        let currentDealerCards = [...dealerCards];
        currentDealerCards[1].isHidden = false;
        setDealerCards([...currentDealerCards]);
        
        const allBusted = playerHands.every(h => h.status === 'busted');
        
        if (!allBusted) {
          let currentDeck = [...deck];
          let dScore = calculateScore(currentDealerCards);
          
          while (dScore < 17) {
            await new Promise(r => setTimeout(r, 800));
            const card = currentDeck.pop()!;
            currentDealerCards.push(card);
            setDealerCards([...currentDealerCards]);
            dScore = calculateScore(currentDealerCards);
          }
          setDeck(currentDeck);
        }
        
        settleBets(currentDealerCards);
      };
      
      playDealer();
    }
  }, [gameState]);

  const settleBets = (finalDealerCards: CardType[]) => {
    const dScore = calculateScore(finalDealerCards);
    const dBusted = dScore > 21;
    
    let totalWinnings = 0;
    const newHands = [...playerHands];
    
    newHands.forEach(hand => {
      if (hand.status === 'busted') return;
      
      const pScore = calculateScore(hand.cards);
      
      if (dBusted || pScore > dScore) {
        hand.status = 'won';
        totalWinnings += hand.bet * 2;
      } else if (pScore < dScore) {
        hand.status = 'lost';
      } else {
        hand.status = 'push';
        totalWinnings += hand.bet;
      }
    });
    
    setPlayerHands(newHands);
    if (totalWinnings > 0) {
      setBalance(prev => prev + totalWinnings);
    }
    setGameState('gameOver');
    
    if (dBusted) {
      setMessage('Dealer busted! You win.');
    } else {
      const wins = newHands.filter(h => h.status === 'won').length;
      const losses = newHands.filter(h => h.status === 'lost' || h.status === 'busted').length;
      const pushes = newHands.filter(h => h.status === 'push').length;
      
      if (wins > 0 && losses === 0) setMessage('You win!');
      else if (losses > 0 && wins === 0) setMessage('Dealer wins.');
      else if (pushes > 0) setMessage('Push.');
      else setMessage('Game Over.');
    }
  };

  const isBankrupt = balance === 0 && (gameState === 'gameOver' || gameState === 'betting');
  const resetAndPlayAgain = () => {
    setBalance(1000);
    setCurrentBet(0);
    setGameState('betting');
    setPlayerHands([]);
    setDealerCards([]);
    setMessage('');
  };

  return (
    <div className="min-h-screen h-screen max-h-screen bg-emerald-900 flex flex-col items-center justify-between p-2 sm:p-3 md:p-4 font-sans text-white overflow-hidden relative">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-800/50 blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-950/50 blur-3xl"></div>
      </div>

      <div className="w-full max-w-xl flex justify-between items-center bg-black/40 p-2 sm:p-3 rounded-xl backdrop-blur-md border border-white/10 shadow-lg z-10 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-500/20 rounded-lg border border-emerald-500/30">
            <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
          </div>
          <div>
            <div className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wider font-bold">Balance</div>
            <div className="text-base sm:text-lg font-bold text-emerald-400">${balance}</div>
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-sm sm:text-base font-black tracking-widest uppercase text-white/90">Blackjack</h1>
          <div className="text-[10px] text-white/40 tracking-wider">3 : 2</div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wider font-bold">Bet</div>
            <div className="text-base sm:text-lg font-bold text-amber-400">${currentBet}</div>
          </div>
          <div className="p-1.5 bg-amber-500/20 rounded-lg border border-amber-500/30">
            <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full max-w-xl flex flex-col items-center justify-center gap-3 sm:gap-4 py-2 relative z-10 overflow-hidden">
        <div className="flex flex-col items-center gap-1 sm:gap-2 shrink-0 min-h-0">
          <div className="text-white/40 uppercase tracking-widest text-xs font-bold bg-black/20 px-2 py-0.5 rounded-full border border-white/5">Dealer</div>
          <div className="flex -space-x-4 sm:-space-x-5 md:-space-x-6">
            <AnimatePresence>
              {dealerCards.map((card, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: -30, x: 30, rotate: 8 }}
                  animate={{ opacity: 1, y: 0, x: 0, rotate: 0 }}
                  transition={{ duration: 0.3, delay: i * 0.15 }}
                >
                  <Card card={card} />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
          {gameState !== 'betting' && dealerCards.length > 0 && !dealerCards[1]?.isHidden && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-black/60 px-2.5 py-1 rounded-full text-xs font-bold border border-white/10"
            >
              {calculateScore(dealerCards)}
            </motion.div>
          )}
        </div>

        <div className="h-8 sm:h-10 flex items-center justify-center shrink-0">
          <AnimatePresence mode="wait">
            {message && (
              <motion.div
                key={message}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="text-base sm:text-xl md:text-2xl font-black text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)] tracking-wide text-center"
              >
                {message}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex flex-col items-center gap-1 sm:gap-2 min-h-0 w-full overflow-x-auto overflow-y-hidden pb-1">
          <div className="flex gap-3 sm:gap-6 justify-center min-w-max px-2">
            <AnimatePresence>
              {playerHands.map((hand, i) => (
                <motion.div
                  key={hand.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col items-center gap-1 sm:gap-2 transition-all duration-300 ${activeHandIndex === i && gameState === 'playing' ? 'scale-105' : 'opacity-90'}`}
                >
                  <div className="text-white/40 uppercase tracking-widest text-xs font-bold bg-black/20 px-2 py-0.5 rounded-full border border-white/5">
                    Player {playerHands.length > 1 ? i + 1 : ''}
                  </div>
                  <div className="relative">
                    {activeHandIndex === i && gameState === 'playing' && (
                      <div className="absolute -inset-2 border-2 border-amber-400/50 rounded-xl animate-pulse"></div>
                    )}
                    <div className="flex -space-x-4 sm:-space-x-5 md:-space-x-6 relative z-10">
                      {hand.cards.map((card, j) => (
                        <motion.div
                          key={j}
                          initial={{ opacity: 0, y: -30, x: -30, rotate: -8 }}
                          animate={{ opacity: 1, y: 0, x: 0, rotate: 0 }}
                          transition={{ duration: 0.3, delay: j * 0.15 }}
                        >
                          <Card card={card} />
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap justify-center items-center gap-1.5 mt-0.5">
                    <div className="bg-black/60 px-2 py-1 rounded-full text-xs font-bold border border-white/10">
                      {calculateScore(hand.cards)}
                    </div>
                    <div className="bg-amber-500/10 text-amber-400 px-2 py-1 rounded-full text-xs font-bold border border-amber-500/30">
                      ${hand.bet}
                    </div>
                    {hand.status !== 'playing' && (
                      <div className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        hand.status === 'won' || hand.status === 'blackjack' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' :
                        hand.status === 'lost' || hand.status === 'busted' ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
                        'bg-gray-500/20 text-gray-300 border border-gray-500/50'
                      }`}>
                        {hand.status}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="w-full max-w-xl bg-black/40 p-3 sm:p-4 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg z-10 shrink-0">
        {isBankrupt ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <p className="text-lg sm:text-xl font-bold text-amber-400 text-center">No chips left. Game Over.</p>
            <button
              onClick={resetAndPlayAgain}
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-base tracking-widest shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              Play Again
            </button>
          </div>
        ) : gameState === 'betting' ? (
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <div className="text-white/50 text-xs font-bold uppercase tracking-widest">Place Your Bet</div>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {[10, 25, 50, 100, 500].map(amount => (
                <button
                  key={amount}
                  onClick={() => placeBet(amount)}
                  disabled={currentBet + amount > balance}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-b from-amber-300 to-amber-600 border-2 border-amber-200 shadow-lg text-amber-950 font-black text-sm flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  ${amount}
                </button>
              ))}
            </div>
            <div className="flex justify-center gap-2 w-full max-w-sm mt-1">
              <button
                onClick={clearBet}
                className="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 font-bold text-sm tracking-wider transition-colors flex items-center justify-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                CLEAR
              </button>
              <button
                onClick={deal}
                disabled={currentBet === 0 || currentBet > balance}
                className="flex-[2] py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-base tracking-widest shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-1.5"
              >
                <Play className="w-5 h-5 fill-current" />
                DEAL
              </button>
            </div>
          </div>
        ) : gameState === 'playing' ? (
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            <button onClick={hit} className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all">
              HIT
            </button>
            <button onClick={stand} className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all">
              STAND
            </button>
            <button
              onClick={doubleDown}
              disabled={playerHands[activeHandIndex].cards.length !== 2 || balance < playerHands[activeHandIndex].bet}
              className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-sm sm:text-base tracking-widest shadow disabled:opacity-30 hover:-translate-y-0.5 active:translate-y-0 transition-all"
            >
              DOUBLE
            </button>
            {canSplit() && (
              <button
                onClick={split}
                className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all"
              >
                SPLIT
              </button>
            )}
          </div>
        ) : gameState === 'gameOver' ? (
          <div className="flex justify-center">
            <button
              onClick={() => {
                setGameState('betting');
                setPlayerHands([]);
                setDealerCards([]);
                setMessage('');
              }}
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-base tracking-widest shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              NEW GAME
            </button>
          </div>
        ) : (
          <div className="flex justify-center items-center h-12">
            <div className="flex items-center gap-2 text-white/60 font-bold tracking-widest uppercase text-sm">
              <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              <span className="ml-1">Dealer&apos;s Turn</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playCard, playLose, playWin } from '@clubhouse/shared/synthAudio';
import { Card as CardType, GameState, PlayerHand } from './types';
import { createDeck } from './utils/deck';
import {
  calculateScore,
  isBlackjack,
  dealerShouldHit,
  resolveInsurancePayout,
  surrenderRefund,
  evenMoneyPayout,
  blackjackPayout,
  formatHandTotal,
  loadBalance,
  saveBalance,
  loadDealerRule,
  saveDealerRule,
  DEFAULT_BALANCE,
  type DealerRule,
} from './utils/rules';
import { Card } from './components/Card';
import { motion, AnimatePresence } from 'motion/react';
import { Coins, RotateCcw, Play } from 'lucide-react';

const isTenValue = (rank: string): boolean =>
  ['10', 'J', 'Q', 'K'].includes(rank);

export default function App() {
  const [deck, setDeck] = useState<CardType[]>([]);
  const [balance, setBalance] = useState(() => loadBalance());
  const [currentBet, setCurrentBet] = useState(10);
  const [gameState, setGameState] = useState<GameState>('betting');
  const [dealerCards, setDealerCards] = useState<CardType[]>([]);
  const [playerHands, setPlayerHands] = useState<PlayerHand[]>([]);
  const [activeHandIndex, setActiveHandIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [dealerRule, setDealerRule] = useState<DealerRule>(() => loadDealerRule());
  const [insuranceBet, setInsuranceBet] = useState(0);
  const [peekPending, setPeekPending] = useState(false);
  const prevGameStateRef = useRef<GameState>('betting');

  useEffect(() => {
    setDeck(createDeck(6));
  }, []);

  useEffect(() => {
    saveBalance(balance);
  }, [balance]);

  useEffect(() => {
    saveDealerRule(dealerRule);
  }, [dealerRule]);

  const placeBet = (amount: number) => {
    if (gameState !== 'betting') return;
    if (currentBet + amount > balance) return;
    setCurrentBet(prev => prev + amount);
  };

  const clearBet = () => {
    if (gameState !== 'betting') return;
    setCurrentBet(0);
  };

  const revealDealer = (cards: CardType[]): CardType[] =>
    cards.map((c, i) => (i === 1 ? { ...c, isHidden: false } : c));

  /** Peek hole card when Ace/10 up. Returns false if round ended on dealer BJ. */
  const resolveDealerPeek = (
    cards: CardType[],
    hands: PlayerHand[],
    insured: number,
  ): boolean => {
    const revealed = revealDealer(cards);
    setDealerCards(revealed);
    setPeekPending(false);

    if (!isBlackjack(revealed)) {
      const payout = resolveInsurancePayout(insured, false);
      if (payout > 0) setBalance(prev => prev + payout);
      setInsuranceBet(0);
      return true;
    }

    const payout = resolveInsurancePayout(insured, true);
    if (payout > 0) setBalance(prev => prev + payout);
    setInsuranceBet(0);

    const lostHands = hands.map(h =>
      h.status === 'playing' || h.status === 'stood' ? { ...h, status: 'lost' as const } : h,
    );
    setPlayerHands(lostHands);
    setMessage(
      insured > 0
        ? '莊家 Blackjack。保險賠付 2:1。'
        : '莊家 Blackjack。',
    );
    setGameState('gameOver');
    return false;
  };

  const deal = () => {
    if (currentBet === 0 || currentBet > balance) return;

    let currentDeck = [...deck];
    if (currentDeck.length < 20) {
      currentDeck = createDeck(6);
    }

    setBalance(prev => prev - currentBet);
    setInsuranceBet(0);

    const pCard1 = currentDeck.pop()!;
    const dCard1 = currentDeck.pop()!;
    const pCard2 = currentDeck.pop()!;
    const dCard2 = { ...currentDeck.pop()!, isHidden: true };

    setDeck(currentDeck);

    const initialPlayerCards = [pCard1, pCard2];
    const initialDealerCards = [dCard1, dCard2];
    setDealerCards(initialDealerCards);

    const isPlayerBJ = isBlackjack(initialPlayerCards);
    const upIsAce = dCard1.rank === 'A';
    const upIsTen = isTenValue(dCard1.rank);
    const dealerPeeks = upIsAce || upIsTen;

    // Player BJ vs dealer Ace: offer even money before peek.
    if (isPlayerBJ) {
      setPlayerHands([{ id: '1', cards: initialPlayerCards, bet: currentBet, status: 'playing' }]);
      setActiveHandIndex(0);
      setPeekPending(false);
      playCard();

      if (upIsAce) {
        setGameState('evenMoney');
        setMessage('Blackjack — 接受均分（1:1）或繼續比牌？');
        return;
      }

      const revealed = revealDealer(initialDealerCards);
      const isDealerBJ = isBlackjack(revealed);
      setDealerCards(revealed);

      if (isDealerBJ) {
        setPlayerHands([{ id: '1', cards: initialPlayerCards, bet: currentBet, status: 'push' }]);
        setBalance(prev => prev + currentBet);
        setMessage('和局！雙方皆 Blackjack。');
      } else {
        setPlayerHands([{ id: '1', cards: initialPlayerCards, bet: currentBet, status: 'blackjack' }]);
        setBalance(prev => prev + blackjackPayout(currentBet));
        setMessage('Blackjack！贏得 3:2。');
      }
      setGameState('gameOver');
      return;
    }

    const hand: PlayerHand = {
      id: '1',
      cards: initialPlayerCards,
      bet: currentBet,
      status: 'playing',
    };
    setPlayerHands([hand]);
    setActiveHandIndex(0);
    setMessage('');

    if (upIsAce) {
      setPeekPending(true);
      setGameState('insurance');
      setMessage('莊家 Ace — 是否買保險？');
    } else if (dealerPeeks) {
      setPeekPending(true);
      setGameState('playing');
    } else {
      setPeekPending(false);
      setGameState('playing');
    }
    playCard();
  };

  const takeEvenMoney = () => {
    if (gameState !== 'evenMoney') return;
    const hand = playerHands[0];
    if (!hand) return;
    const payout = evenMoneyPayout(hand.bet);
    setPlayerHands([{ ...hand, status: 'blackjack' }]);
    setBalance(prev => prev + payout);
    setDealerCards(revealDealer(dealerCards));
    setMessage(`均分 1:1 — 贏得 $${hand.bet}`);
    setGameState('gameOver');
  };

  const declineEvenMoney = () => {
    if (gameState !== 'evenMoney') return;
    const hand = playerHands[0];
    if (!hand) return;
    const revealed = revealDealer(dealerCards);
    setDealerCards(revealed);
    if (isBlackjack(revealed)) {
      setPlayerHands([{ ...hand, status: 'push' }]);
      setBalance(prev => prev + hand.bet);
      setMessage('和局！雙方皆 Blackjack。');
    } else {
      setPlayerHands([{ ...hand, status: 'blackjack' }]);
      setBalance(prev => prev + blackjackPayout(hand.bet));
      setMessage('Blackjack！贏得 3:2。');
    }
    setGameState('gameOver');
  };

  const takeInsurance = () => {
    if (gameState !== 'insurance') return;
    const hand = playerHands[0];
    if (!hand) return;
    const cost = Math.floor(hand.bet / 2);
    if (balance < cost) return;

    setBalance(prev => prev - cost);
    setInsuranceBet(cost);
    setMessage('');

    if (!resolveDealerPeek(dealerCards, playerHands, cost)) return;
    setGameState('playing');
  };

  const declineInsurance = () => {
    if (gameState !== 'insurance') return;
    setMessage('');
    if (!resolveDealerPeek(dealerCards, playerHands, 0)) return;
    setGameState('playing');
  };

  const surrender = () => {
    if (gameState !== 'playing' && gameState !== 'insurance') return;
    const hand = playerHands[activeHandIndex];
    if (!hand || hand.cards.length !== 2) return;
    if (hand.status !== 'playing') return;

    // Early surrender: before dealer peek when Ace/10 showing.
    const refund = surrenderRefund(hand.bet);
    const newHands = [...playerHands];
    newHands[activeHandIndex] = { ...hand, status: 'surrendered' };
    setPlayerHands(newHands);
    setBalance(prev => prev + refund);
    setInsuranceBet(0);
    setPeekPending(false);
    setDealerCards(revealDealer(dealerCards));
    setMessage(`投降 — 取回半注 $${refund}`);
    setGameState('gameOver');
  };

  const canSurrender = (): boolean => {
    if (gameState !== 'playing' && gameState !== 'insurance') return false;
    const hand = playerHands[activeHandIndex];
    return !!hand && hand.status === 'playing' && hand.cards.length === 2;
  };

  /** Run pending peek before first play action. */
  const ensurePeeked = (): boolean => {
    if (!peekPending) return true;
    return resolveDealerPeek(dealerCards, playerHands, insuranceBet);
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
    if (!ensurePeeked()) return;

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
    playCard();
  };

  const stand = () => {
    if (gameState !== 'playing') return;
    if (!ensurePeeked()) return;
    const newHands = [...playerHands];
    newHands[activeHandIndex].status = 'stood';
    advanceHand(newHands);
  };

  const doubleDown = () => {
    if (gameState !== 'playing') return;
    if (!ensurePeeked()) return;
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
    if (!ensurePeeked()) return;

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
      status: 'playing',
    };

    const newHand2: PlayerHand = {
      id: hand.id + '-2',
      cards: [card2, newCard2],
      bet: hand.bet,
      status: 'playing',
    };

    const newHands = [...playerHands];
    newHands.splice(activeHandIndex, 1, newHand1, newHand2);

    setPlayerHands(newHands);
  };

  useEffect(() => {
    if (gameState !== 'dealerTurn') return;

    const playDealer = async () => {
      let currentDealerCards = [...dealerCards];
      currentDealerCards = revealDealer(currentDealerCards);
      setDealerCards([...currentDealerCards]);

      const needsDealerPlay = playerHands.some(
        h => h.status === 'stood' || h.status === 'playing',
      );

      if (needsDealerPlay) {
        let currentDeck = [...deck];
        const hitSoft17 = dealerRule === 'H17';

        while (dealerShouldHit(currentDealerCards, hitSoft17)) {
          await new Promise(r => setTimeout(r, 800));
          const card = currentDeck.pop()!;
          currentDealerCards.push(card);
          setDealerCards([...currentDealerCards]);
        }
        setDeck(currentDeck);
      }

      settleBets(currentDealerCards);
    };

    playDealer();
    // ponytail: only re-run when entering dealerTurn
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  const settleBets = (finalDealerCards: CardType[]) => {
    const dScore = calculateScore(finalDealerCards);
    const dBusted = dScore > 21;

    let totalWinnings = 0;
    const newHands = playerHands.map(hand => ({ ...hand }));

    newHands.forEach(hand => {
      if (hand.status === 'busted' || hand.status === 'surrendered') return;

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
      setMessage('莊家爆牌！你贏了。');
    } else {
      const wins = newHands.filter(h => h.status === 'won').length;
      const losses = newHands.filter(
        h => h.status === 'lost' || h.status === 'busted' || h.status === 'surrendered',
      ).length;
      const pushes = newHands.filter(h => h.status === 'push').length;

      if (wins > 0 && losses === 0) setMessage('你贏了！');
      else if (losses > 0 && wins === 0) setMessage('莊家贏了。');
      else if (pushes > 0) setMessage('和局。');
      else setMessage('本局結束。');
    }
  };

  const resultPrompt = useMemo((): 'win' | 'lose' | 'push' | null => {
    if (gameState !== 'gameOver' || playerHands.length === 0) return null;
    const hasWon = playerHands.some(h => h.status === 'won' || h.status === 'blackjack');
    const hasLost = playerHands.some(
      h => h.status === 'lost' || h.status === 'busted' || h.status === 'surrendered',
    );
    const hasPush = playerHands.some(h => h.status === 'push');
    if (hasWon && !hasLost) return 'win';
    if (hasLost && !hasWon) return 'lose';
    if (hasPush && !hasWon && !hasLost) return 'push';
    if (hasWon && hasLost) return 'push';
    return hasWon ? 'win' : hasLost ? 'lose' : 'push';
  }, [gameState, playerHands]);

  useEffect(() => {
    if (gameState === 'gameOver' && prevGameStateRef.current !== 'gameOver') {
      if (resultPrompt === 'win') playWin();
      else if (resultPrompt === 'lose') playLose();
    }
    prevGameStateRef.current = gameState;
  }, [gameState, resultPrompt]);

  const isBankrupt = balance === 0 && currentBet === 0 && gameState === 'betting';
  const resetAndPlayAgain = () => {
    setBalance(DEFAULT_BALANCE);
    setCurrentBet(0);
    setGameState('betting');
    setPlayerHands([]);
    setDealerCards([]);
    setMessage('');
    setInsuranceBet(0);
    setPeekPending(false);
  };

  const toggleDealerRule = () => {
    if (gameState !== 'betting') return;
    setDealerRule(prev => (prev === 'H17' ? 'S17' : 'H17'));
  };

  const insuranceCost = playerHands[0] ? Math.floor(playerHands[0].bet / 2) : 0;

  return (
    <div
      className="min-h-screen h-screen max-h-screen flex flex-col items-center justify-between p-2 sm:p-3 md:p-4 font-sans text-white overflow-hidden relative bg-cover bg-center"
      style={{
        backgroundColor: '#064e3b',
        backgroundImage: [
          'linear-gradient(rgba(6,78,59,0.55), rgba(2,44,34,0.72))',
          `url(${import.meta.env.BASE_URL}felt.jpg)`,
        ].join(', '),
      }}
    >
      <BackToMenu />
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
            <div className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wider font-bold">餘額</div>
            <div className="text-base sm:text-lg font-bold text-emerald-400">${balance}</div>
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-sm sm:text-base font-black tracking-widest uppercase text-white/90">Blackjack</h1>
          <button
            type="button"
            onClick={toggleDealerRule}
            disabled={gameState !== 'betting'}
            className="text-[10px] text-white/50 tracking-wider hover:text-amber-300 disabled:opacity-40 disabled:hover:text-white/50 transition-colors"
            title="下注階段可切換莊家軟 17 規則"
          >
            {dealerRule === 'H17' ? '莊家 H17（軟17要牌）' : '莊家 S17（軟17停牌）'}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wider font-bold">下注</div>
            <div className="text-base sm:text-lg font-bold text-amber-400">${currentBet}</div>
          </div>
          <div className="p-1.5 bg-amber-500/20 rounded-lg border border-amber-500/30">
            <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 w-full max-w-xl flex flex-col items-center justify-center gap-3 sm:gap-4 py-2 relative z-10 overflow-hidden">
        <div className="flex flex-col items-center gap-1 sm:gap-2 shrink-0 min-h-0">
          <div className="text-white/40 uppercase tracking-widest text-xs font-bold bg-black/20 px-2 py-0.5 rounded-full border border-white/5">莊家</div>
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
              {formatHandTotal(dealerCards)}
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
                    玩家 {playerHands.length > 1 ? i + 1 : ''}
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
                      {formatHandTotal(hand.cards)}
                    </div>
                    <div className="bg-amber-500/10 text-amber-400 px-2 py-1 rounded-full text-xs font-bold border border-amber-500/30">
                      ${hand.bet}
                    </div>
                    {hand.status !== 'playing' && (
                      <div className={`px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                        hand.status === 'won' || hand.status === 'blackjack' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' :
                        hand.status === 'lost' || hand.status === 'busted' || hand.status === 'surrendered' ? 'bg-red-500/20 text-red-400 border border-red-500/50' :
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
            <p className="text-red-400 font-bold tracking-widest uppercase text-sm">籌碼用盡</p>
            <p className="text-white/50 text-xs">你已經沒有籌碼了</p>
            <button
              type="button"
              onClick={resetAndPlayAgain}
              className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-base tracking-widest shadow-lg transition-all flex items-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              重新開始（$1000）
            </button>
          </div>
        ) : gameState === 'betting' ? (
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <div className="text-white/50 text-xs font-bold tracking-widest">下注金額</div>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {[10, 25, 50, 100, 500].map(amount => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => placeBet(amount)}
                  disabled={currentBet + amount > balance}
                  className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-b from-amber-300 to-amber-600 border-2 border-amber-200 shadow-lg text-amber-950 font-black text-sm flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-30 disabled:cursor-not-allowed transition-all touch-manipulation"
                >
                  ${amount}
                </button>
              ))}
            </div>
            <div className="flex justify-center gap-2 w-full max-w-sm mt-1">
              <button
                type="button"
                onClick={clearBet}
                className="flex-1 py-2.5 min-h-[44px] rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 font-bold text-sm tracking-wider transition-colors flex items-center justify-center gap-1.5 touch-manipulation"
              >
                <RotateCcw className="w-4 h-4" />
                清除
              </button>
              <button
                type="button"
                onClick={deal}
                disabled={currentBet === 0 || currentBet > balance}
                className="flex-[2] py-2.5 min-h-[44px] rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-base tracking-widest shadow-lg disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 touch-manipulation"
              >
                <Play className="w-5 h-5 fill-current" />
                發牌
              </button>
            </div>
          </div>
        ) : gameState === 'evenMoney' ? (
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={takeEvenMoney}
              className="px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation"
            >
              均分 1:1
            </button>
            <button
              type="button"
              onClick={declineEvenMoney}
              className="px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-white/10 hover:bg-white/20 text-white font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation"
            >
              繼續比牌
            </button>
          </div>
        ) : gameState === 'insurance' ? (
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={takeInsurance}
              disabled={balance < insuranceCost}
              className="px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-sm sm:text-base tracking-widest shadow disabled:opacity-30 hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation"
            >
              保險 ${insuranceCost}
            </button>
            <button
              type="button"
              onClick={declineInsurance}
              className="px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-white/10 hover:bg-white/20 text-white font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation"
            >
              不保險
            </button>
            {canSurrender() && (
              <button
                type="button"
                onClick={surrender}
                className="px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation"
              >
                投降
              </button>
            )}
          </div>
        ) : gameState === 'playing' ? (
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            <button type="button" onClick={hit} className="px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation">
              要牌
            </button>
            <button type="button" onClick={stand} className="px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation">
              停牌
            </button>
            <button
              type="button"
              onClick={doubleDown}
              disabled={playerHands[activeHandIndex].cards.length !== 2 || balance < playerHands[activeHandIndex].bet}
              className="px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-sm sm:text-base tracking-widest shadow disabled:opacity-30 hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation"
            >
              加倍
            </button>
            {canSplit() && (
              <button
                type="button"
                onClick={split}
                className="px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation"
              >
                分牌
              </button>
            )}
            {canSurrender() && (
              <button
                type="button"
                onClick={surrender}
                className="px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation"
              >
                投降
              </button>
            )}
          </div>
        ) : gameState === 'gameOver' ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => {
                setGameState('betting');
                setPlayerHands([]);
                setDealerCards([]);
                setMessage('');
                setInsuranceBet(0);
                setPeekPending(false);
              }}
              className="px-6 py-3 min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-base tracking-widest shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center gap-2 touch-manipulation"
            >
              <RotateCcw className="w-5 h-5" />
              再下一局
            </button>
          </div>
        ) : (
          <div className="flex justify-center items-center h-12">
            <div className="flex items-center gap-2 text-white/60 font-bold tracking-widest text-sm">
              <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-1.5 h-1.5 bg-white/60 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              <span className="ml-1">莊家回合</span>
            </div>
          </div>
        )}
      </div>

      {gameState === 'gameOver' && resultPrompt && (
        <ResultOverlay
          title={
            resultPrompt === 'win' ? '你贏了！' : resultPrompt === 'lose' ? '你輸了' : '和局'
          }
          subtitle={message || undefined}
          variant={resultPrompt === 'win' ? 'win' : resultPrompt === 'lose' ? 'lose' : 'neutral'}
          stats={[
            { label: '餘額', value: `$${balance}` },
            { label: '本局下注', value: `$${currentBet}` },
          ]}
          primaryLabel={balance === 0 ? '重新開始（$1000）' : '下一局'}
          onPrimary={() => {
            if (balance === 0) {
              resetAndPlayAgain();
            } else {
              setGameState('betting');
              setPlayerHands([]);
              setDealerCards([]);
              setMessage('');
              setInsuranceBet(0);
              setPeekPending(false);
            }
          }}
        />
      )}
    </div>
  );
}

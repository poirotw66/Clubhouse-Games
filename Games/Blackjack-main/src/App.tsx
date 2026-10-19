import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playLose, playWin } from '@clubhouse/shared/synthAudio';
import { Card as CardType, GameState, PlayerHand } from './types';
import {
  calculateScore,
  isBlackjack,
  dealerShouldHit,
  resolveInsurancePayout,
  surrenderRefund,
  evenMoneyPayout,
  blackjackPayout,
  blackjackPayoutLabel,
  formatHandTotal,
  isPairHand,
  isAcePair,
  DEFAULT_BALANCE,
} from './utils/rules';
import {
  createShoe,
  drawCard,
  drawCards,
  maybeReshuffle,
  cardsRemaining,
  type ShoeState,
} from './utils/shoe';
import {
  loadBalance,
  saveBalance,
  loadStats,
  saveStats,
  loadSettings,
  saveSettings,
  recordHandResult,
  applyRecovery,
  hardResetProgression,
  MAX_RECOVERIES,
  type BlackjackStats,
  type BlackjackSettings,
  type HandOutcome,
} from './utils/storage';
import { TABLES, getTable, isTableUnlocked, unlockedTables } from './utils/tables';
import { recommendAction, STRATEGY_LABELS } from './utils/basicStrategy';
import {
  evaluateDecision,
  summarizeHandFeedback,
  asStrategyAction,
  type DecisionRecord,
  type DecisionVerdict,
} from './utils/feedback';
import { runningCountDelta, trueCount } from './utils/hiLo';
import { playChip, playDealCard, playBetClear } from './utils/audio';
import { Card } from './components/Card';
import { ShoeMeter } from './components/ShoeMeter';
import { RulesPanel } from './components/RulesPanel';
import { motion, AnimatePresence } from 'motion/react';
import { Coins, RotateCcw, Play, Undo2, Lightbulb, Settings2, BarChart3 } from 'lucide-react';

const isTenValue = (rank: string): boolean =>
  ['10', 'J', 'Q', 'K'].includes(rank);

function cloneHands(hands: PlayerHand[]): PlayerHand[] {
  return hands.map(h => ({ ...h, cards: h.cards.map(c => ({ ...c })) }));
}

function cloneCards(cards: CardType[]): CardType[] {
  return cards.map(c => ({ ...c }));
}

/** Bet-rail undo only — never snapshots the shoe (blocks card-peek exploit). */
interface BetSnapshot {
  currentBet: number;
}

export default function App() {
  const [settings, setSettings] = useState<BlackjackSettings>(() => loadSettings());
  const [stats, setStats] = useState<BlackjackStats>(() => loadStats());
  const [shoe, setShoe] = useState<ShoeState>(() =>
    createShoe(loadSettings().rules.deckCount, loadSettings().rules.penetration),
  );
  const [balance, setBalance] = useState(() => loadBalance());
  const [currentBet, setCurrentBet] = useState(0);
  const [gameState, setGameState] = useState<GameState>('betting');
  const [dealerCards, setDealerCards] = useState<CardType[]>([]);
  const [playerHands, setPlayerHands] = useState<PlayerHand[]>([]);
  const [activeHandIndex, setActiveHandIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [insuranceBet, setInsuranceBet] = useState(0);
  const [peekPending, setPeekPending] = useState(false);
  const [peekResolved, setPeekResolved] = useState(false);
  const [betHistory, setBetHistory] = useState<BetSnapshot[]>([]);
  const [hintLabel, setHintLabel] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [handVerdicts, setHandVerdicts] = useState<DecisionVerdict[]>([]);
  const [runningHiLo, setRunningHiLo] = useState(0);
  const [dealKey, setDealKey] = useState(0);
  const [sessionStartBalance, setSessionStartBalance] = useState(() => loadBalance());
  const prevGameStateRef = useRef<GameState>('betting');
  const handStartBalanceRef = useRef(0);
  const handDecisionsRef = useRef<DecisionRecord[]>([]);
  const statsRecordedRef = useRef(false);
  const balanceRef = useRef(balance);

  const rules = settings.rules;
  const table = getTable(stats.tableId);
  const clearHint = () => setHintLabel(null);

  const setBalanceTracked = (updater: number | ((prev: number) => number)) => {
    const next =
      typeof updater === 'function'
        ? (updater as (prev: number) => number)(balanceRef.current)
        : updater;
    balanceRef.current = next;
    setBalance(next);
  };

  useEffect(() => {
    saveBalance(balance);
  }, [balance]);

  useEffect(() => {
    saveStats(stats);
  }, [stats]);

  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  useEffect(() => {
    setStats(prev => ({
      ...prev,
      peakBankroll: Math.max(prev.peakBankroll, balance),
    }));
  }, [balance]);

  const pushBetHistory = () => {
    setBetHistory(prev => [...prev, { currentBet }]);
  };

  const placeBet = (amount: number) => {
    if (gameState !== 'betting') return;
    const next = currentBet + amount;
    if (next > balance || next > table.maxBet) return;
    pushBetHistory();
    setCurrentBet(next);
    playChip();
  };

  const clearBet = () => {
    if (gameState !== 'betting') return;
    if (currentBet === 0) return;
    pushBetHistory();
    setCurrentBet(0);
    playBetClear();
  };

  const setMinBet = () => {
    if (gameState !== 'betting') return;
    if (balance < table.minBet) return;
    pushBetHistory();
    setCurrentBet(table.minBet);
    playChip();
  };

  const canUndoBet = gameState === 'betting' && betHistory.length > 0;

  const handleUndo = () => {
    if (!canUndoBet) return;
    const prev = betHistory[betHistory.length - 1];
    setBetHistory(h => h.slice(0, -1));
    setCurrentBet(prev.currentBet);
    playBetClear();
  };

  const revealDealer = (cards: CardType[]): CardType[] =>
    cards.map((c, i) => (i === 1 ? { ...c, isHidden: false } : c));

  const noteSeenCards = useCallback((cards: CardType[]) => {
    setRunningHiLo(prev => prev + runningCountDelta(cards));
  }, []);

  const recordDecision = (
    taken: DecisionRecord['taken'],
    phase: DecisionRecord['phase'],
    hand: PlayerHand,
    extras?: Partial<Pick<DecisionRecord, 'canDouble' | 'canSplit' | 'canSurrender'>>,
  ) => {
    const upcard = dealerCards[0];
    if (!upcard) return;
    handDecisionsRef.current = [
      ...handDecisionsRef.current,
      {
        phase,
        playerCards: cloneCards(hand.cards),
        dealerUpcard: { ...upcard },
        canDouble: extras?.canDouble ?? false,
        canSplit: extras?.canSplit ?? false,
        canSurrender: extras?.canSurrender ?? false,
        taken,
      },
    ];
  };

  const finalizeHandStats = (hands: PlayerHand[], balanceAfter: number) => {
    if (statsRecordedRef.current) return;
    statsRecordedRef.current = true;

    const decisions = handDecisionsRef.current;
    let feedback = { correct: 0, total: 0 };
    if (settings.feedbackEnabled && decisions.length > 0) {
      const verdicts = decisions.map(evaluateDecision);
      setHandVerdicts(verdicts);
      feedback = summarizeHandFeedback(verdicts);
    } else {
      setHandVerdicts([]);
    }

    const hasBJ = hands.some(h => h.status === 'blackjack');
    const hasWon = hands.some(h => h.status === 'won' || h.status === 'blackjack');
    const hasLost = hands.some(
      h => h.status === 'lost' || h.status === 'busted' || h.status === 'surrendered',
    );
    let outcome: HandOutcome = 'push';
    if (hasBJ && !hasLost) outcome = 'blackjack';
    else if (hasWon && !hasLost) outcome = 'win';
    else if (hasLost && !hasWon) outcome = 'lose';
    else if (hasWon && hasLost) outcome = 'push';
    else if (hasLost) outcome = 'lose';
    else if (hasWon) outcome = 'win';

    const profitDelta = balanceAfter - handStartBalanceRef.current;
    setStats(prev =>
      recordHandResult(prev, outcome, balanceAfter, profitDelta, feedback.correct, feedback.total),
    );
  };

  /** Peek hole card when Ace/10 up. Returns false if round ended on dealer BJ. */
  const resolveDealerPeek = (
    cards: CardType[],
    hands: PlayerHand[],
    insured: number,
  ): boolean => {
    const revealed = revealDealer(cards);
    setDealerCards(revealed);
    setPeekPending(false);
    setPeekResolved(true);
    if (cards[1]?.isHidden && revealed[1]) {
      noteSeenCards([{ ...revealed[1], isHidden: false }]);
    }

    if (!isBlackjack(revealed)) {
      const payout = resolveInsurancePayout(insured, false);
      if (payout > 0) setBalanceTracked(prev => prev + payout);
      setInsuranceBet(0);
      return true;
    }

    const payout = resolveInsurancePayout(insured, true);
    if (payout > 0) setBalanceTracked(prev => prev + payout);
    setInsuranceBet(0);

    const lostHands = hands.map(h =>
      h.status === 'playing' || h.status === 'stood' ? { ...h, status: 'lost' as const } : h,
    );
    setPlayerHands(lostHands);
    setMessage(
      insured > 0 ? '莊家 Blackjack。保險賠付 2:1。' : '莊家 Blackjack。',
    );
    setGameState('gameOver');
    finalizeHandStats(lostHands, balanceRef.current);
    return false;
  };

  const switchTable = (tableId: string) => {
    if (gameState !== 'betting') return;
    if (!isTableUnlocked(tableId, stats.peakBankroll)) return;
    setStats(prev => ({ ...prev, tableId }));
    setCurrentBet(0);
    setBetHistory([]);
  };

  const applySettings = (next: BlackjackSettings) => {
    const deckChanged =
      next.rules.deckCount !== settings.rules.deckCount ||
      next.rules.penetration !== settings.rules.penetration;
    setSettings(next);
    if (deckChanged && gameState === 'betting') {
      setShoe(createShoe(next.rules.deckCount, next.rules.penetration));
      setRunningHiLo(0);
    }
  };

  const deal = () => {
    if (currentBet < table.minBet || currentBet > balance || currentBet > table.maxBet) return;

    let currentShoe = maybeReshuffle(shoe);
    if (currentShoe !== shoe) {
      setRunningHiLo(0);
      setMessage('牌靴已洗切。');
    }

    setBetHistory([]);
    clearHint();
    handDecisionsRef.current = [];
    statsRecordedRef.current = false;
    setHandVerdicts([]);
    setPeekResolved(false);
    handStartBalanceRef.current = balance;
    setBalanceTracked(prev => prev - currentBet);
    setInsuranceBet(0);
    setDealKey(k => k + 1);

    const drawn = drawCards(currentShoe, 4);
    currentShoe = drawn.shoe;
    const [pCard1, dCard1, pCard2, dHole] = drawn.cards;
    const dCard2 = { ...dHole, isHidden: true };

    setShoe(currentShoe);
    noteSeenCards([pCard1, dCard1, pCard2]);

    const initialPlayerCards = [pCard1, pCard2];
    const initialDealerCards = [dCard1, dCard2];
    setDealerCards(initialDealerCards);

    const isPlayerBJ = isBlackjack(initialPlayerCards);
    const upIsAce = dCard1.rank === 'A';
    const upIsTen = isTenValue(dCard1.rank);
    const dealerPeeks = upIsAce || upIsTen;

    playDealCard();

    if (isPlayerBJ) {
      setPlayerHands([{ id: '1', cards: initialPlayerCards, bet: currentBet, status: 'playing' }]);
      setActiveHandIndex(0);
      setPeekPending(false);

      if (upIsAce) {
        setGameState('evenMoney');
        setMessage('Blackjack — 接受均分（1:1）或繼續比牌？');
        return;
      }

      const revealed = revealDealer(initialDealerCards);
      const isDealerBJ = isBlackjack(revealed);
      setDealerCards(revealed);
      if (dCard2.isHidden) noteSeenCards([{ ...revealed[1], isHidden: false }]);

      if (isDealerBJ) {
        const nextHands: PlayerHand[] = [
          { id: '1', cards: initialPlayerCards, bet: currentBet, status: 'push' },
        ];
        setPlayerHands(nextHands);
        setBalanceTracked(prev => prev + currentBet);
        setMessage('和局！雙方皆 Blackjack。');
        setGameState('gameOver');
        finalizeHandStats(nextHands, balanceRef.current);
      } else {
        const nextHands: PlayerHand[] = [
          { id: '1', cards: initialPlayerCards, bet: currentBet, status: 'blackjack' },
        ];
        setPlayerHands(nextHands);
        setBalanceTracked(prev => prev + blackjackPayout(currentBet, rules.bjPayout));
        setMessage(`Blackjack！贏得 ${blackjackPayoutLabel(rules.bjPayout)}。`);
        setGameState('gameOver');
        finalizeHandStats(nextHands, balanceRef.current);
      }
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
      setPeekResolved(true);
      setGameState('playing');
    }
  };

  const takeEvenMoney = () => {
    if (gameState !== 'evenMoney') return;
    const hand = playerHands[0];
    if (!hand) return;
    clearHint();
    recordDecision(asStrategyAction('takeEvenMoney'), 'evenMoney', hand);
    const payout = evenMoneyPayout(hand.bet);
    setPlayerHands([{ ...hand, status: 'blackjack' }]);
    setBalanceTracked(prev => prev + payout);
    const revealed = revealDealer(dealerCards);
    setDealerCards(revealed);
    if (dealerCards[1]?.isHidden) noteSeenCards([{ ...revealed[1], isHidden: false }]);
    setMessage(`均分 1:1 — 贏得 $${hand.bet}`);
    const nextHands: PlayerHand[] = [{ ...hand, status: 'blackjack' }];
    setGameState('gameOver');
    finalizeHandStats(nextHands, balanceRef.current);
  };

  const declineEvenMoney = () => {
    if (gameState !== 'evenMoney') return;
    const hand = playerHands[0];
    if (!hand) return;
    clearHint();
    recordDecision(asStrategyAction('declineEvenMoney'), 'evenMoney', hand);
    const revealed = revealDealer(dealerCards);
    setDealerCards(revealed);
    if (dealerCards[1]?.isHidden) noteSeenCards([{ ...revealed[1], isHidden: false }]);
    if (isBlackjack(revealed)) {
      const nextHands: PlayerHand[] = [{ ...hand, status: 'push' }];
      setPlayerHands(nextHands);
      setBalanceTracked(prev => prev + hand.bet);
      setMessage('和局！雙方皆 Blackjack。');
      setGameState('gameOver');
      finalizeHandStats(nextHands, balanceRef.current);
    } else {
      const payout = blackjackPayout(hand.bet, rules.bjPayout);
      const nextHands: PlayerHand[] = [{ ...hand, status: 'blackjack' }];
      setPlayerHands(nextHands);
      setBalanceTracked(prev => prev + payout);
      setMessage(`Blackjack！贏得 ${blackjackPayoutLabel(rules.bjPayout)}。`);
      setGameState('gameOver');
      finalizeHandStats(nextHands, balanceRef.current);
    }
  };

  const takeInsurance = () => {
    if (gameState !== 'insurance') return;
    const hand = playerHands[0];
    if (!hand) return;
    const cost = Math.floor(hand.bet / 2);
    if (balance < cost) return;

    clearHint();
    recordDecision(asStrategyAction('takeInsurance'), 'insurance', hand, {
      canSurrender: canSurrenderNow(),
    });
    setBalanceTracked(prev => prev - cost);
    setInsuranceBet(cost);
    setMessage('');

    if (!resolveDealerPeek(dealerCards, playerHands, cost)) return;
    setGameState('playing');
  };

  const declineInsurance = () => {
    if (gameState !== 'insurance') return;
    const hand = playerHands[0];
    clearHint();
    if (hand) {
      recordDecision(asStrategyAction('declineInsurance'), 'insurance', hand, {
        canSurrender: canSurrenderNow(),
      });
    }
    setMessage('');
    if (!resolveDealerPeek(dealerCards, playerHands, 0)) return;
    setGameState('playing');
  };

  const canSurrenderNow = (): boolean => {
    if (rules.surrender === 'none') return false;
    if (gameState !== 'playing' && gameState !== 'insurance') return false;
    const hand = playerHands[activeHandIndex];
    if (!hand || hand.status !== 'playing' || hand.cards.length !== 2) return false;
    if (hand.fromSplit) return false;
    if (rules.surrender === 'early') {
      // Before dealer has confirmed no BJ (peek pending or insurance phase).
      return peekPending || gameState === 'insurance' || !peekResolved;
    }
    // Late: only after peek confirms no dealer BJ.
    return peekResolved && !peekPending;
  };

  const surrender = () => {
    if (!canSurrenderNow()) return;
    const hand = playerHands[activeHandIndex];
    if (!hand) return;

    clearHint();
    recordDecision(asStrategyAction('surrender'), gameState === 'insurance' ? 'insurance' : 'playing', hand, {
      canDouble: false,
      canSplit: false,
      canSurrender: true,
    });
    const refund = surrenderRefund(hand.bet);
    const newHands = [...playerHands];
    newHands[activeHandIndex] = { ...hand, status: 'surrendered' };
    setPlayerHands(newHands);
    setBalanceTracked(prev => prev + refund);
    setInsuranceBet(0);
    setPeekPending(false);
    const revealed = revealDealer(dealerCards);
    setDealerCards(revealed);
    if (dealerCards[1]?.isHidden) noteSeenCards([{ ...revealed[1], isHidden: false }]);
    setMessage(`投降 — 取回半注 $${refund}`);
    setGameState('gameOver');
    finalizeHandStats(newHands, balanceRef.current);
  };

  const ensurePeeked = (): boolean => {
    if (!peekPending) return true;
    return resolveDealerPeek(dealerCards, playerHands, insuranceBet);
  };

  const canDoubleActive = (): boolean => {
    if (gameState !== 'playing') return false;
    const hand = playerHands[activeHandIndex];
    if (!hand || hand.status !== 'playing' || hand.cards.length !== 2) return false;
    if (hand.fromSplitAces) return false;
    if (hand.fromSplit && !rules.doubleAfterSplit) return false;
    return balance >= hand.bet;
  };

  const canSplitActive = (): boolean => {
    if (gameState !== 'playing') return false;
    const hand = playerHands[activeHandIndex];
    if (!hand || hand.status !== 'playing') return false;
    if (!isPairHand(hand.cards)) return false;
    if (balance < hand.bet) return false;
    if (playerHands.length >= rules.maxSplitHands) return false;
    if (hand.fromSplitAces && !rules.resplitAces) return false;
    if (isAcePair(hand.cards) && hand.fromSplit && !rules.resplitAces) return false;
    return true;
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
    const activeHand = playerHands[activeHandIndex];
    if (!activeHand || activeHand.status !== 'playing') return;
    if (activeHand.fromSplitAces) return;

    clearHint();
    recordDecision(asStrategyAction('hit'), 'playing', activeHand, {
      canDouble: canDoubleActive(),
      canSplit: canSplitActive(),
      canSurrender: canSurrenderNow(),
    });

    const { card, shoe: nextShoe } = drawCard(shoe);
    setShoe(nextShoe);
    noteSeenCards([card]);

    const newHands = cloneHands(playerHands);
    newHands[activeHandIndex].cards.push(card);

    const score = calculateScore(newHands[activeHandIndex].cards);
    if (score > 21) {
      newHands[activeHandIndex].status = 'busted';
      advanceHand(newHands);
    } else {
      setPlayerHands(newHands);
    }
    playDealCard();
  };

  const stand = () => {
    if (gameState !== 'playing') return;
    if (!ensurePeeked()) return;
    const activeHand = playerHands[activeHandIndex];
    if (!activeHand || activeHand.status !== 'playing') return;

    clearHint();
    recordDecision(asStrategyAction('stand'), 'playing', activeHand, {
      canDouble: canDoubleActive(),
      canSplit: canSplitActive(),
      canSurrender: canSurrenderNow(),
    });
    const newHands = cloneHands(playerHands);
    newHands[activeHandIndex].status = 'stood';
    advanceHand(newHands);
  };

  const doubleDown = () => {
    if (!canDoubleActive()) return;
    if (!ensurePeeked()) return;
    const activeHand = playerHands[activeHandIndex];

    clearHint();
    recordDecision(asStrategyAction('double'), 'playing', activeHand, {
      canDouble: true,
      canSplit: canSplitActive(),
      canSurrender: canSurrenderNow(),
    });
    setBalanceTracked(prev => prev - activeHand.bet);
    playChip();

    const { card, shoe: nextShoe } = drawCard(shoe);
    setShoe(nextShoe);
    noteSeenCards([card]);

    const newHands = cloneHands(playerHands);
    newHands[activeHandIndex].bet *= 2;
    newHands[activeHandIndex].cards.push(card);

    const score = calculateScore(newHands[activeHandIndex].cards);
    newHands[activeHandIndex].status = score > 21 ? 'busted' : 'stood';
    advanceHand(newHands);
    playDealCard();
  };

  const split = () => {
    if (!canSplitActive()) return;
    if (!ensurePeeked()) return;
    const hand = playerHands[activeHandIndex];

    clearHint();
    recordDecision(asStrategyAction('split'), 'playing', hand, {
      canDouble: canDoubleActive(),
      canSplit: true,
      canSurrender: canSurrenderNow(),
    });

    setBalanceTracked(prev => prev - hand.bet);
    playChip();

    const drawn = drawCards(shoe, 2);
    setShoe(drawn.shoe);
    noteSeenCards(drawn.cards);

    const card1 = hand.cards[0];
    const card2 = hand.cards[1];
    const splittingAces = isAcePair(hand.cards);

    const newHand1: PlayerHand = {
      id: hand.id + '-a',
      cards: [card1, drawn.cards[0]],
      bet: hand.bet,
      status: 'playing',
      fromSplit: true,
      fromSplitAces: splittingAces,
    };
    const newHand2: PlayerHand = {
      id: hand.id + '-b',
      cards: [card2, drawn.cards[1]],
      bet: hand.bet,
      status: 'playing',
      fromSplit: true,
      fromSplitAces: splittingAces,
    };

    // Split aces: one card each, then stand (unless resplit allowed and pair again — handled next turn).
    if (splittingAces && !rules.resplitAces) {
      newHand1.status = 'stood';
      newHand2.status = 'stood';
    }

    const newHands = cloneHands(playerHands);
    newHands.splice(activeHandIndex, 1, newHand1, newHand2);
    setPlayerHands(newHands);

    if (splittingAces && !rules.resplitAces) {
      // If this was the last action across all hands, go to dealer.
      const allDone = newHands.every(h => h.status !== 'playing');
      if (allDone) setGameState('dealerTurn');
      else {
        const nextIdx = newHands.findIndex(h => h.status === 'playing');
        setActiveHandIndex(nextIdx >= 0 ? nextIdx : activeHandIndex);
      }
    }
    playDealCard();
  };

  useEffect(() => {
    if (gameState !== 'dealerTurn') return;

    const playDealer = async () => {
      let currentDealerCards = [...dealerCards];
      const holeWasHidden = currentDealerCards[1]?.isHidden;
      currentDealerCards = revealDealer(currentDealerCards);
      setDealerCards([...currentDealerCards]);
      if (holeWasHidden && currentDealerCards[1]) {
        noteSeenCards([{ ...currentDealerCards[1], isHidden: false }]);
      }

      const needsDealerPlay = playerHands.some(
        h => h.status === 'stood' || h.status === 'playing',
      );

      if (needsDealerPlay) {
        let currentShoe = shoe;
        const hitSoft17 = rules.dealerRule === 'H17';

        while (dealerShouldHit(currentDealerCards, hitSoft17)) {
          await new Promise(r => setTimeout(r, 550));
          const result = drawCard(currentShoe);
          currentShoe = result.shoe;
          currentDealerCards.push(result.card);
          setDealerCards([...currentDealerCards]);
          noteSeenCards([result.card]);
          playDealCard();
        }
        setShoe(currentShoe);
      }

      settleBets(currentDealerCards);
    };

    void playDealer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  const settleBets = (finalDealerCards: CardType[]) => {
    const dScore = calculateScore(finalDealerCards);
    const dBusted = dScore > 21;
    const dBJ = isBlackjack(finalDealerCards);

    let totalWinnings = 0;
    const newHands = cloneHands(playerHands);

    newHands.forEach(hand => {
      if (hand.status === 'busted' || hand.status === 'surrendered') return;
      if (hand.status === 'blackjack') return;

      const pScore = calculateScore(hand.cards);
      const pBJ = !hand.fromSplit && isBlackjack(hand.cards);

      if (pBJ && !dBJ) {
        hand.status = 'blackjack';
        totalWinnings += blackjackPayout(hand.bet, rules.bjPayout);
      } else if (dBusted || pScore > dScore) {
        hand.status = 'won';
        totalWinnings += hand.bet * 2;
      } else if (pScore < dScore || (dBJ && !pBJ)) {
        hand.status = 'lost';
      } else {
        hand.status = 'push';
        totalWinnings += hand.bet;
      }
    });

    setPlayerHands(newHands);
    if (totalWinnings > 0) {
      setBalanceTracked(prev => prev + totalWinnings);
    }
    setGameState('gameOver');
    finalizeHandStats(newHands, balanceRef.current);

    if (dBusted) {
      setMessage('莊家爆牌！你贏了。');
    } else {
      const wins = newHands.filter(h => h.status === 'won' || h.status === 'blackjack').length;
      const losses = newHands.filter(
        h => h.status === 'lost' || h.status === 'busted' || h.status === 'surrendered',
      ).length;
      const pushes = newHands.filter(h => h.status === 'push').length;

      if (wins > 0 && losses === 0) setMessage('你贏了！');
      else if (losses > 0 && wins === 0) setMessage('莊家贏了。');
      else if (pushes > 0 && wins === 0 && losses === 0) setMessage('和局。');
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

  const isBankrupt = balance < table.minBet && gameState === 'betting';

  const tryRecovery = () => {
    const result = applyRecovery(stats, stats.tableId);
    if (!result) return;
    setStats(result.stats);
    setBalanceTracked(result.balance);
    setCurrentBet(0);
    setBetHistory([]);
    setSessionStartBalance(result.balance);
    setMessage(`破產救濟：獲得 $${result.balance}（剩餘 ${MAX_RECOVERIES - result.stats.recoveriesUsed} 次）`);
  };

  const doHardReset = () => {
    const reset = hardResetProgression();
    setStats(reset.stats);
    setSettings(reset.settings);
    setBalanceTracked(reset.balance);
    setCurrentBet(0);
    setBetHistory([]);
    setShoe(createShoe(reset.settings.rules.deckCount, reset.settings.rules.penetration));
    setRunningHiLo(0);
    setSessionStartBalance(reset.balance);
    setMessage('已重置籌碼與桌級進度。');
  };

  const resetRoundToBetting = () => {
    setGameState('betting');
    setPlayerHands([]);
    setDealerCards([]);
    setMessage(shoe.needsReshuffle ? '牌靴將於下局洗切。' : '');
    setInsuranceBet(0);
    setPeekPending(false);
    setPeekResolved(false);
    setBetHistory([]);
    clearHint();
    // Keep handVerdicts visible until next deal.
  };

  const playerDecisionPhase =
    gameState === 'playing' || gameState === 'insurance' || gameState === 'evenMoney';

  const canHint =
    settings.hintsEnabled &&
    playerDecisionPhase &&
    playerHands[activeHandIndex]?.status === 'playing';

  const handleHint = () => {
    if (!canHint) return;
    const hand = playerHands[activeHandIndex];
    const upcard = dealerCards[0];
    if (!hand || !upcard) return;

    const phase =
      gameState === 'evenMoney'
        ? 'evenMoney'
        : gameState === 'insurance'
          ? 'insurance'
          : 'playing';

    const action = recommendAction({
      phase,
      playerCards: hand.cards,
      dealerUpcard: upcard,
      canDouble: phase === 'playing' && canDoubleActive(),
      canSplit: phase === 'playing' && canSplitActive(),
      canSurrender: canSurrenderNow(),
    });
    setHintLabel(STRATEGY_LABELS[action]);
    setMessage(`提示：${STRATEGY_LABELS[action]}`);
  };

  const insuranceCost = playerHands[0] ? Math.floor(playerHands[0].bet / 2) : 0;
  const feedbackSummary = summarizeHandFeedback(handVerdicts);
  const decksLeftApprox = cardsRemaining(shoe) / 52;
  const tc = trueCount(runningHiLo, cardsRemaining(shoe));
  const strategyRate =
    stats.strategyTotal > 0
      ? Math.round((stats.strategyCorrect / stats.strategyTotal) * 100)
      : null;

  const statusLabel = (status: PlayerHand['status']): string => {
    const map: Record<PlayerHand['status'], string> = {
      playing: '進行中',
      busted: '爆牌',
      stood: '停牌',
      won: '贏',
      lost: '輸',
      push: '和',
      blackjack: 'Blackjack',
      surrendered: '投降',
    };
    return map[status];
  };

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

      {/* Header */}
      <div className="w-full max-w-xl flex flex-col gap-1.5 z-10 shrink-0">
        <div className="flex justify-between items-center bg-black/40 p-2 sm:p-3 rounded-xl backdrop-blur-md border border-white/10 shadow-lg">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 bg-emerald-500/20 rounded-lg border border-emerald-500/30 shrink-0">
              <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wider font-bold">
                餘額 · {table.name}
              </div>
              <div className="text-base sm:text-lg font-bold text-emerald-400 truncate">${balance}</div>
            </div>
          </div>
          <div className="text-center px-1">
            <h1 className="text-sm sm:text-base font-black tracking-widest text-white/90">二十一點</h1>
            <div className="text-[9px] sm:text-[10px] text-white/45 tracking-wider">
              {rules.dealerRule} · {rules.deckCount}副 · BJ {blackjackPayoutLabel(rules.bjPayout)}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!canUndoBet}
              className="min-h-[44px] min-w-[44px] px-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 touch-manipulation flex flex-col items-center justify-center gap-0.5"
              title="復原下注（僅下注階段）"
              aria-label="復原下注"
            >
              <Undo2 className="w-4 h-4" />
              <span className="text-[8px] font-bold tracking-wider">復原</span>
            </button>
            <button
              type="button"
              onClick={handleHint}
              disabled={!canHint}
              className="min-h-[44px] min-w-[44px] px-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-40 touch-manipulation flex flex-col items-center justify-center gap-0.5"
              title="基本策略提示"
              aria-label="提示"
            >
              <Lightbulb className={`w-4 h-4 ${hintLabel ? 'text-amber-300' : ''}`} />
              <span className="text-[8px] font-bold tracking-wider">提示</span>
            </button>
            <button
              type="button"
              onClick={() => setShowStats(true)}
              className="min-h-[44px] min-w-[44px] px-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 touch-manipulation flex flex-col items-center justify-center gap-0.5"
              title="戰績"
              aria-label="戰績"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="text-[8px] font-bold tracking-wider">戰績</span>
            </button>
            <button
              type="button"
              onClick={() => setShowRules(true)}
              className="min-h-[44px] min-w-[44px] px-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 touch-manipulation flex flex-col items-center justify-center gap-0.5"
              title="規則"
              aria-label="規則"
            >
              <Settings2 className="w-4 h-4" />
              <span className="text-[8px] font-bold tracking-wider">規則</span>
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 px-1">
          <ShoeMeter shoe={shoe} />
          <div className="text-right text-[10px] text-white/50 font-bold space-y-0.5">
            <div>
              下注 <span className="text-amber-400">${currentBet}</span>
              <span className="text-white/35"> · 下限 ${table.minBet}</span>
            </div>
            {settings.mode === 'counting' && settings.showCount && (
              <div className="text-sky-300/90">
                RC {runningHiLo >= 0 ? `+${runningHiLo}` : runningHiLo} · TC{' '}
                {tc >= 0 ? `+${tc}` : tc} · ~{decksLeftApprox.toFixed(1)}副
              </div>
            )}
            {settings.mode === 'counting' && !settings.showCount && (
              <div className="text-sky-300/70">算牌練習（計數已隱藏）</div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 w-full max-w-xl flex flex-col items-center justify-center gap-2 sm:gap-3 py-1 relative z-10 overflow-hidden">
        <div className="flex flex-col items-center gap-1 shrink-0 min-h-0">
          <div className="text-white/40 uppercase tracking-widest text-xs font-bold bg-black/20 px-2 py-0.5 rounded-full border border-white/5">
            莊家
          </div>
          <div className="flex -space-x-4 sm:-space-x-5 md:-space-x-6">
            <AnimatePresence>
              {dealerCards.map((card, i) => (
                <motion.div
                  key={`${dealKey}-d-${i}-${card.rank}-${card.suit}`}
                  initial={{ opacity: 0, y: -48, x: 40, rotate: 12, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22, delay: i * 0.12 }}
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

        <div className="min-h-8 sm:min-h-10 flex flex-col items-center justify-center shrink-0 px-2">
          <AnimatePresence mode="wait">
            {message && (
              <motion.div
                key={message}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -10, scale: 0.95 }}
                className="text-sm sm:text-xl md:text-2xl font-black text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.5)] tracking-wide text-center"
              >
                {message}
              </motion.div>
            )}
          </AnimatePresence>
          {gameState === 'gameOver' && settings.feedbackEnabled && handVerdicts.length > 0 && (
            <div
              className={`mt-1 text-[11px] sm:text-xs font-bold text-center ${
                feedbackSummary.correct === feedbackSummary.total
                  ? 'text-emerald-300'
                  : 'text-sky-200/90'
              }`}
            >
              {feedbackSummary.headline}
              {feedbackSummary.lines.length === 1 ? ` — ${feedbackSummary.lines[0]}` : null}
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1 min-h-0 w-full overflow-x-auto overflow-y-hidden pb-1">
          <div className="flex gap-3 sm:gap-6 justify-center min-w-max px-2">
            <AnimatePresence>
              {playerHands.map((hand, i) => (
                <motion.div
                  key={hand.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col items-center gap-1 transition-all duration-300 ${
                    activeHandIndex === i && gameState === 'playing' ? 'scale-105' : 'opacity-90'
                  }`}
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
                          key={`${dealKey}-${hand.id}-${j}-${card.rank}`}
                          initial={{ opacity: 0, y: -40, x: -36, rotate: -10, scale: 0.85 }}
                          animate={{ opacity: 1, y: 0, x: 0, rotate: 0, scale: 1 }}
                          transition={{
                            type: 'spring',
                            stiffness: 320,
                            damping: 22,
                            delay: j * 0.1,
                          }}
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
                      <div
                        className={`px-2 py-1 rounded-full text-xs font-bold tracking-wider ${
                          hand.status === 'won' || hand.status === 'blackjack'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50'
                            : hand.status === 'lost' ||
                                hand.status === 'busted' ||
                                hand.status === 'surrendered'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/50'
                              : 'bg-gray-500/20 text-gray-300 border border-gray-500/50'
                        }`}
                      >
                        {statusLabel(hand.status)}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="w-full max-w-xl bg-black/40 p-3 sm:p-4 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg z-10 shrink-0">
        {isBankrupt ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <p className="text-red-400 font-bold tracking-widest text-sm">籌碼不足（破產）</p>
            <p className="text-white/50 text-xs text-center">
              {table.name}下限 ${table.minBet}。已用救濟 {stats.recoveriesUsed}/{MAX_RECOVERIES} 次。
            </p>
            {stats.recoveriesUsed < MAX_RECOVERIES ? (
              <button
                type="button"
                onClick={tryRecovery}
                className="px-6 py-3 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-base tracking-widest shadow-lg transition-all flex items-center gap-2 touch-manipulation"
              >
                <Coins className="w-5 h-5" />
                領取救濟籌碼
              </button>
            ) : (
              <button
                type="button"
                onClick={doHardReset}
                className="px-6 py-3 min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-base tracking-widest shadow-lg transition-all flex items-center gap-2 touch-manipulation"
              >
                <RotateCcw className="w-5 h-5" />
                重置進度（${DEFAULT_BALANCE}）
              </button>
            )}
          </div>
        ) : gameState === 'betting' ? (
          <div className="flex flex-col items-center gap-2 sm:gap-3">
            <div className="w-full flex gap-1.5 overflow-x-auto pb-1">
              {TABLES.map(t => {
                const unlocked = isTableUnlocked(t.id, stats.peakBankroll);
                const active = t.id === stats.tableId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => switchTable(t.id)}
                    className={`shrink-0 px-2.5 py-2 min-h-[40px] rounded-lg text-[11px] font-bold border touch-manipulation ${
                      active
                        ? 'bg-amber-500/25 border-amber-400/60 text-amber-200'
                        : unlocked
                          ? 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                          : 'bg-black/30 border-white/5 text-white/25 cursor-not-allowed'
                    }`}
                    title={
                      unlocked ? `下限 $${t.minBet}` : `峰值籌碼達 $${t.unlockPeak} 解鎖`
                    }
                  >
                    {t.name}
                    {!unlocked && ' 🔒'}
                  </button>
                );
              })}
            </div>
            <div className="text-white/50 text-xs font-bold tracking-widest">
              下注（下限 ${table.minBet}）
            </div>
            <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
              {table.chipValues.map(amount => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => placeBet(amount)}
                  disabled={currentBet + amount > balance || currentBet + amount > table.maxBet}
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
                onClick={setMinBet}
                className="flex-1 py-2.5 min-h-[44px] rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 font-bold text-sm tracking-wider transition-colors touch-manipulation"
              >
                下限
              </button>
              <button
                type="button"
                onClick={deal}
                disabled={currentBet < table.minBet || currentBet > balance}
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
              className={`px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation ${hintLabel === '均分 1:1' ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-black/40' : ''}`}
            >
              均分 1:1
            </button>
            <button
              type="button"
              onClick={declineEvenMoney}
              className={`px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-white/10 hover:bg-white/20 text-white font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation ${hintLabel === '繼續比牌' ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-black/40' : ''}`}
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
              className={`px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-sm sm:text-base tracking-widest shadow disabled:opacity-30 hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation ${hintLabel === '買保險' ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-black/40' : ''}`}
            >
              保險 ${insuranceCost}
            </button>
            <button
              type="button"
              onClick={declineInsurance}
              className={`px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-white/10 hover:bg-white/20 text-white font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation ${hintLabel === '不保險' ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-black/40' : ''}`}
            >
              不保險
            </button>
            {canSurrenderNow() && (
              <button
                type="button"
                onClick={surrender}
                className={`px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation ${hintLabel === '投降' ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-black/40' : ''}`}
              >
                投降
              </button>
            )}
          </div>
        ) : gameState === 'playing' ? (
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={hit}
              disabled={!!playerHands[activeHandIndex]?.fromSplitAces}
              className={`px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation disabled:opacity-30 ${hintLabel === '要牌' ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-black/40' : ''}`}
            >
              要牌
            </button>
            <button
              type="button"
              onClick={stand}
              className={`px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation ${hintLabel === '停牌' ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-black/40' : ''}`}
            >
              停牌
            </button>
            <button
              type="button"
              onClick={doubleDown}
              disabled={!canDoubleActive()}
              className={`px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-sm sm:text-base tracking-widest shadow disabled:opacity-30 hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation ${hintLabel === '加倍' ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-black/40' : ''}`}
            >
              加倍
            </button>
            {canSplitActive() && (
              <button
                type="button"
                onClick={split}
                className={`px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation ${hintLabel === '分牌' ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-black/40' : ''}`}
              >
                分牌
              </button>
            )}
            {canSurrenderNow() && (
              <button
                type="button"
                onClick={surrender}
                className={`px-4 py-2.5 sm:px-5 sm:py-3 min-h-[44px] rounded-lg bg-slate-600 hover:bg-slate-500 text-white font-black text-sm sm:text-base tracking-widest shadow hover:-translate-y-0.5 active:translate-y-0 transition-all touch-manipulation ${hintLabel === '投降' ? 'ring-2 ring-sky-400 ring-offset-2 ring-offset-black/40' : ''}`}
              >
                投降
              </button>
            )}
          </div>
        ) : gameState === 'gameOver' ? (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={resetRoundToBetting}
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
          subtitle={
            settings.feedbackEnabled && feedbackSummary.total > 0
              ? `${message} · ${feedbackSummary.headline}`
              : message || undefined
          }
          variant={resultPrompt === 'win' ? 'win' : resultPrompt === 'lose' ? 'lose' : 'neutral'}
          stats={[
            { label: '餘額', value: `$${balance}` },
            { label: '本局', value: `$${currentBet}` },
            { label: '連勝', value: String(stats.streak) },
            ...(strategyRate != null
              ? [{ label: '策略命中', value: `${strategyRate}%` }]
              : []),
          ]}
          primaryLabel={balance < table.minBet ? '處理破產' : '下一局'}
          onPrimary={() => {
            resetRoundToBetting();
          }}
        />
      )}

      {showRules && (
        <RulesPanel
          settings={settings}
          disabled={gameState !== 'betting'}
          onChange={applySettings}
          onClose={() => setShowRules(false)}
        />
      )}

      {showStats && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3">
          <div className="w-full max-w-md rounded-2xl bg-emerald-950 border border-white/15 shadow-2xl p-4 text-white">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-black tracking-wider">戰績</h2>
              <button
                type="button"
                onClick={() => setShowStats(false)}
                className="min-h-[44px] min-w-[44px] rounded-lg bg-white/10 font-bold touch-manipulation"
                aria-label="關閉"
              >
                ✕
              </button>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              {[
                ['局數', stats.hands],
                ['勝', stats.wins],
                ['負', stats.losses],
                ['和', stats.pushes],
                ['Blackjack', stats.blackjacks],
                ['連勝', `${stats.streak}（最佳 ${stats.bestStreak}）`],
                ['峰值籌碼', `$${stats.peakBankroll}`],
                ['淨利', `$${stats.netProfit}`],
                ['破產次數', stats.bustOuts],
                ['救濟已用', `${stats.recoveriesUsed}/${MAX_RECOVERIES}`],
                [
                  '策略命中',
                  stats.strategyTotal
                    ? `${stats.strategyCorrect}/${stats.strategyTotal}（${strategyRate}%）`
                    : '—',
                ],
                ['已解鎖桌', unlockedTables(stats.peakBankroll).length],
              ].map(([label, value]) => (
                <div key={String(label)} className="bg-black/30 rounded-lg px-3 py-2 border border-white/10">
                  <dt className="text-[10px] text-white/45 font-bold tracking-wider">{label}</dt>
                  <dd className="font-black text-emerald-300">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-[11px] text-white/40">
              本 session 起始餘額 ${sessionStartBalance}。桌級以峰值籌碼解鎖，破產不會再白送 $1000。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

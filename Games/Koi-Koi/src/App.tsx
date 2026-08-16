import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Volume2, VolumeX, HelpCircle, Lightbulb } from 'lucide-react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { Card as CardComponent } from './components/Card';
import { CharacterSelect } from './components/CharacterSelect';
import { MatchScoreboard } from './components/MatchScoreboard';
import { CapturedPanel } from './components/CapturedPanel';
import { PlayerAvatar } from './components/PlayerAvatar';
import { RulesModal } from './components/RulesModal';
import { getCharacterImageUrl } from './characters';
import { useBgm } from './hooks/useBgm';
import { useCharacterSelection } from './hooks/useCharacterSelection';
import { useSfx } from './hooks/useSfx';
import { Card, GameState, Phase } from './types';
import { deal, calculateYaku, getMatchingCards, resolveRoundScores, WIN_SCORE_OPTIONS, WIN_SCORE_LABELS, type WinScore } from './utils/gameLogic';
import {
  Difficulty,
  DIFFICULTY_LABELS,
  getPlayerHint,
  pickBotFieldMatch,
  pickBotHandPlay,
  shouldBotKoiKoi,
  type HintChoice,
} from './utils/botAi';
import {
  loadStats,
  recordResult,
  saveStats,
  withDifficulty,
  withWinScore,
  type MatchStats,
} from './utils/stats';
import { motion, AnimatePresence } from 'motion/react';

const initialState: GameState = {
  deck: [],
  field: [],
  playerHand: [],
  botHand: [],
  playerCaptured: [],
  botCaptured: [],
  playerYaku: [],
  botYaku: [],
  playerPoints: 0,
  botPoints: 0,
  phase: 'idle',
  selectedHandCard: null,
  drawnCard: null,
  matchingFieldCards: [],
  message: '歡迎來到花牌 (Koi-Koi)！點擊開始遊戲。',
  playerScore: 0,
  botScore: 0,
  round: 1,
  dealer: 'player',
  koiKoiCount: { player: 0, bot: 0 },
  winner: null,
};

export default function App() {
  const [state, setState] = useState<GameState>(initialState);
  const [showRules, setShowRules] = useState(false);
  const [stats, setStats] = useState<MatchStats>(() => loadStats());
  const [difficulty, setDifficulty] = useState<Difficulty>(() => loadStats().lastDifficulty);
  const [winScore, setWinScore] = useState<WinScore>(() => loadStats().lastWinScore);
  const [hint, setHint] = useState<HintChoice | null>(null);
  const lockRef = useRef(false);
  const statsRecordedRef = useRef(false);
  const difficultyRef = useRef(difficulty);
  difficultyRef.current = difficulty;
  const winScoreRef = useRef(winScore);
  winScoreRef.current = winScore;
  const { character, characterId, setCharacterId } = useCharacterSelection();
  const { muted, toggleMute, unlock, currentTitle } = useBgm();
  const { play: playSfx } = useSfx();
  const playerAvatarUrl = getCharacterImageUrl(character);

  // The setup screen and the table replace each other in the same document, so
  // the window keeps whatever scroll position the other one left behind — and
  // 開始對局 sits at the bottom of a tall setup screen. Keyed on the *screen*
  // rather than on `phase`, because phase also changes on every turn and
  // yanking the page mid-hand would be worse than the bug.
  const onSetupScreen = state.phase === 'idle';
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [onSetupScreen]);

  const applyDifficulty = useCallback((next: Difficulty) => {
    setDifficulty(next);
    setStats(prev => {
      const updated = withDifficulty(prev, next);
      saveStats(updated);
      return updated;
    });
  }, []);

  const applyWinScore = useCallback((next: WinScore) => {
    setWinScore(next);
    setStats(prev => {
      const updated = withWinScore(prev, next);
      saveStats(updated);
      return updated;
    });
  }, []);

  useEffect(() => {
    const handler = () => unlock();
    document.addEventListener('pointerdown', handler, { once: true });
    return () => document.removeEventListener('pointerdown', handler);
  }, [unlock]);

  useEffect(() => {
    if (['player_turn_hand', 'player_turn_hand_match', 'player_turn_draw_match', 'player_koi_koi', 'idle', 'round_end', 'game_over'].includes(state.phase)) {
      lockRef.current = false;
    }
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== 'game_over' || !state.winner || statsRecordedRef.current) return;
    statsRecordedRef.current = true;
    setStats(prev => {
      const updated = recordResult(prev, state.winner === 'player' ? 'win' : 'loss');
      saveStats(updated);
      return updated;
    });
  }, [state.phase, state.winner]);

  const startGame = (isNextRound = false, resetMatch = false) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setHint(null);
    if (resetMatch || !isNextRound) statsRecordedRef.current = false;
    const { deck, playerHand, botHand, field } = deal();
    setState(s => {
      const dealer = resetMatch ? 'player' : s.dealer;
      return {
        ...initialState,
        deck,
        playerHand,
        botHand,
        field,
        phase: dealer === 'player' ? 'player_turn_hand' : 'bot_turn',
        message: dealer === 'player' ? '你的回合：請從手牌選擇一張牌。' : '對手的回合...',
        playerScore: resetMatch ? 0 : s.playerScore,
        botScore: resetMatch ? 0 : s.botScore,
        round: resetMatch ? 1 : (isNextRound ? s.round + 1 : s.round),
        dealer,
        winner: null,
      };
    });
  };

  const endTurn = (nextPlayer: 'player' | 'bot') => {
    setHint(null);
    setState(s => {
      // Check if hands are empty (round over, draw)
      if (s.playerHand.length === 0 && s.botHand.length === 0) {
        const playerGain = s.dealer === 'player' ? 1 : 0;
        const botGain = s.dealer === 'bot' ? 1 : 0;
        const resolved = resolveRoundScores(
          s.playerScore,
          s.botScore,
          playerGain,
          botGain,
          winScoreRef.current,
        );
        playSfx(resolved.winner ? 'win' : 'draw');
        return {
          ...s,
          phase: resolved.phase,
          winner: resolved.winner,
          playerScore: resolved.playerScore,
          botScore: resolved.botScore,
          message: resolved.winner
            ? `流局！莊家獲得 1 分親權。${resolved.winner === 'player' ? '你先達 ' + winScoreRef.current + ' 分獲勝！' : '師匠先達 ' + winScoreRef.current + ' 分獲勝！'}`
            : '流局！莊家獲得 1 分親權。',
        };
      }

      return {
        ...s,
        phase: nextPlayer === 'player' ? 'player_turn_hand' : 'bot_turn',
        message: nextPlayer === 'player' ? '你的回合：請從手牌選擇一張牌。' : '對手的回合...',
        selectedHandCard: null,
        drawnCard: null,
        matchingFieldCards: [],
      };
    });
  };

  const handleYakuCheck = (player: 'player' | 'bot', newState: GameState) => {
    const captured = player === 'player' ? newState.playerCaptured : newState.botCaptured;
    const currentPoints = player === 'player' ? newState.playerPoints : newState.botPoints;
    
    const { yaku, totalPoints } = calculateYaku(captured);
    
    if (totalPoints > currentPoints) {
      playSfx('yaku');
      // New Yaku formed!
      if (player === 'player') {
        setState({
          ...newState,
          playerYaku: yaku,
          playerPoints: totalPoints,
          phase: 'player_koi_koi',
          message: `你組成了役！獲得 ${totalPoints} 分。要喊 Koi-Koi 繼續嗎？`,
        });
      } else {
        const shouldContinue = shouldBotKoiKoi({
          totalPoints,
          botHandLength: newState.botHand.length,
          botScore: newState.botScore,
          playerScore: newState.playerScore,
          playerKoiKoiCount: newState.koiKoiCount.player,
          difficulty: difficultyRef.current,
          winScore: winScoreRef.current,
        });
        if (shouldContinue) {
          setState({
            ...newState,
            botYaku: yaku,
            botPoints: totalPoints,
            koiKoiCount: { ...newState.koiKoiCount, bot: newState.koiKoiCount.bot + 1 },
            message: `對手組成了役 (${totalPoints} 分) 並喊了 Koi-Koi！`,
          });
          setTimeout(() => endTurn('player'), 2000);
        } else {
          let finalPoints = totalPoints;
          if (newState.koiKoiCount.player > 0) finalPoints *= 2;

          const resolved = resolveRoundScores(
            newState.playerScore,
            newState.botScore,
            0,
            finalPoints,
            winScoreRef.current,
          );
          if (resolved.winner) playSfx('win');

          setState({
            ...newState,
            botYaku: yaku,
            botPoints: totalPoints,
            playerScore: resolved.playerScore,
            botScore: resolved.botScore,
            phase: resolved.phase,
            winner: resolved.winner,
            message: resolved.winner === 'bot'
              ? `對手結束了遊戲！獲得 ${finalPoints} 分，先達 ${winScoreRef.current} 分獲勝！`
              : `對手結束了遊戲！獲得 ${finalPoints} 分。`,
            dealer: 'bot',
          });
        }
      }
    } else {
      // No new Yaku, next turn
      endTurn(player === 'player' ? 'bot' : 'player');
    }
  };

  const executeDrawPhase = (currentState: GameState, player: 'player' | 'bot') => {
    const deck = [...currentState.deck];
    const drawnCard = deck.pop();
    
    if (!drawnCard) {
      endTurn(player === 'player' ? 'bot' : 'player');
      return;
    }

    const matches = getMatchingCards(drawnCard, currentState.field);
    
    let nextState = { ...currentState, deck, drawnCard };

    if (matches.length === 0) {
      nextState.field = [...nextState.field, drawnCard];
      nextState.message = `${player === 'player' ? '你' : '對手'}翻開了 ${drawnCard.name}，沒有配對。`;
      setState(nextState);
      setTimeout(() => handleYakuCheck(player, nextState), 1500);
    } else if (matches.length === 1) {
      playSfx('match');
      nextState.field = nextState.field.filter(c => c.id !== matches[0].id);
      const captured = player === 'player' ? nextState.playerCaptured : nextState.botCaptured;
      if (player === 'player') {
        nextState.playerCaptured = [...captured, drawnCard, matches[0]];
      } else {
        nextState.botCaptured = [...captured, drawnCard, matches[0]];
      }
      nextState.message = `${player === 'player' ? '你' : '對手'}翻開了 ${drawnCard.name} 並配對成功！`;
      setState(nextState);
      setTimeout(() => handleYakuCheck(player, nextState), 1500);
    } else if (matches.length === 2) {
      if (player === 'player') {
        nextState.phase = 'player_turn_draw_match';
        nextState.matchingFieldCards = matches;
        nextState.message = `翻開了 ${drawnCard.name}，場上有兩張可配對，請選擇一張。`;
        setState(nextState);
      } else {
        const bestMatch = pickBotFieldMatch(
          drawnCard,
          matches,
          nextState.botCaptured,
          difficultyRef.current,
        );
        nextState.field = nextState.field.filter(c => c.id !== bestMatch.id);
        nextState.botCaptured = [...nextState.botCaptured, drawnCard, bestMatch];
        nextState.message = `對手翻開了 ${drawnCard.name} 並配對成功！`;
        setState(nextState);
        setTimeout(() => handleYakuCheck('bot', nextState), 1500);
      }
    } else if (matches.length === 3) {
      playSfx('match');
      nextState.field = nextState.field.filter(c => c.month !== drawnCard.month);
      const captured = player === 'player' ? nextState.playerCaptured : nextState.botCaptured;
      if (player === 'player') {
        nextState.playerCaptured = [...captured, drawnCard, ...matches];
      } else {
        nextState.botCaptured = [...captured, drawnCard, ...matches];
      }
      nextState.message = `${player === 'player' ? '你' : '對手'}翻開了 ${drawnCard.name} 並收走了場上三張！`;
      setState(nextState);
      setTimeout(() => handleYakuCheck(player, nextState), 1500);
    }
  };

  const handleHandCardClick = (card: Card) => {
    if (state.phase !== 'player_turn_hand' || lockRef.current) return;
    lockRef.current = true;
    setHint(null);

    const matches = getMatchingCards(card, state.field);
    const newHand = state.playerHand.filter(c => c.id !== card.id);

    if (matches.length === 0) {
      setState(s => ({
        ...s,
        playerHand: newHand,
        field: [...s.field, card],
        phase: 'player_turn_draw',
        message: '沒有配對，牌放到場上。準備翻牌...',
      }));
      setTimeout(() => executeDrawPhase({ ...state, playerHand: newHand, field: [...state.field, card] }, 'player'), 1000);
    } else if (matches.length === 1) {
      playSfx('match');
      setState(s => ({
        ...s,
        playerHand: newHand,
        field: s.field.filter(c => c.id !== matches[0].id),
        playerCaptured: [...s.playerCaptured, card, matches[0]],
        phase: 'player_turn_draw',
        message: '配對成功！準備翻牌...',
      }));
      setTimeout(() => executeDrawPhase({
        ...state,
        playerHand: newHand,
        field: state.field.filter(c => c.id !== matches[0].id),
        playerCaptured: [...state.playerCaptured, card, matches[0]]
      }, 'player'), 1000);
    } else if (matches.length === 2) {
      setState(s => ({
        ...s,
        playerHand: newHand,
        selectedHandCard: card,
        matchingFieldCards: matches,
        phase: 'player_turn_hand_match',
        message: '場上有兩張可配對，請選擇一張。',
      }));
    } else if (matches.length === 3) {
      playSfx('match');
      setState(s => ({
        ...s,
        playerHand: newHand,
        field: s.field.filter(c => c.month !== card.month),
        playerCaptured: [...s.playerCaptured, card, ...matches],
        phase: 'player_turn_draw',
        message: '配對成功，收走場上三張！準備翻牌...',
      }));
      setTimeout(() => executeDrawPhase({
        ...state,
        playerHand: newHand,
        field: state.field.filter(c => c.month !== card.month),
        playerCaptured: [...state.playerCaptured, card, ...matches]
      }, 'player'), 1000);
    }
  };

  const handleFieldCardClick = (card: Card) => {
    if (lockRef.current) return;

    if (state.phase === 'player_turn_hand_match' && state.selectedHandCard) {
      if (!state.matchingFieldCards.find(c => c.id === card.id)) return;
      lockRef.current = true;
      setHint(null);
      playSfx('match');

      const nextState = {
        ...state,
        field: state.field.filter(c => c.id !== card.id),
        playerCaptured: [...state.playerCaptured, state.selectedHandCard, card],
        selectedHandCard: null,
        matchingFieldCards: [],
        phase: 'player_turn_draw' as Phase,
        message: '配對成功！準備翻牌...',
      };
      setState(nextState);
      setTimeout(() => executeDrawPhase(nextState, 'player'), 1000);
    } else if (state.phase === 'player_turn_draw_match' && state.drawnCard) {
      if (!state.matchingFieldCards.find(c => c.id === card.id)) return;
      lockRef.current = true;
      setHint(null);
      playSfx('match');

      const nextState = {
        ...state,
        field: state.field.filter(c => c.id !== card.id),
        playerCaptured: [...state.playerCaptured, state.drawnCard, card],
        drawnCard: null,
        matchingFieldCards: [],
        message: '配對成功！檢查役...',
      };
      setState(nextState);
      setTimeout(() => handleYakuCheck('player', nextState), 1000);
    }
  };

  const handleKoiKoi = () => {
    if (lockRef.current) return;
    lockRef.current = true;
    setHint(null);
    setState(s => ({
      ...s,
      koiKoiCount: { ...s.koiKoiCount, player: s.koiKoiCount.player + 1 },
      message: '你喊了 Koi-Koi！遊戲繼續。',
    }));
    setTimeout(() => endTurn('bot'), 1500);
  };

  const handleAgari = () => {
    if (lockRef.current) return;
    lockRef.current = true;
    setHint(null);
    let finalPoints = state.playerPoints;
    if (state.koiKoiCount.bot > 0) finalPoints *= 2;

    const resolved = resolveRoundScores(
      state.playerScore,
      state.botScore,
      finalPoints,
      0,
      winScoreRef.current,
    );
    if (resolved.winner) playSfx('win');

    setState(s => ({
      ...s,
      playerScore: resolved.playerScore,
      botScore: resolved.botScore,
      phase: resolved.phase,
      winner: resolved.winner,
      message: resolved.winner === 'player'
        ? `你結束了遊戲！獲得 ${finalPoints} 分，先達 ${winScoreRef.current} 分獲勝！`
        : `你結束了遊戲！獲得 ${finalPoints} 分。`,
      dealer: 'player',
    }));
  };

  const handleHint = () => {
    if (state.phase === 'player_turn_hand') {
      const next = getPlayerHint(state.playerHand, state.field, state.playerCaptured);
      setHint(next);
      return;
    }
    if (
      (state.phase === 'player_turn_hand_match' || state.phase === 'player_turn_draw_match') &&
      state.matchingFieldCards.length > 0
    ) {
      const played = state.selectedHandCard ?? state.drawnCard;
      if (!played) return;
      const best = pickBotFieldMatch(
        played,
        state.matchingFieldCards,
        state.playerCaptured,
        'hard',
        () => 0,
      );
      setHint({
        handCardId: state.selectedHandCard?.id ?? '',
        fieldCardId: best.id,
      });
    }
  };

  // Bot Logic
  useEffect(() => {
    if (state.phase === 'bot_turn') {
      const playBotTurn = async () => {
        await new Promise(resolve => setTimeout(resolve, 1500));

        const choice = pickBotHandPlay(
          state.botHand,
          state.field,
          state.botCaptured,
          difficultyRef.current,
        );
        if (!choice) {
          endTurn('player');
          return;
        }

        const selectedCard = choice.handCard;
        const matches = choice.matches;
        const bestMatch = choice.fieldMatch;
        const newHand = state.botHand.filter(c => c.id !== selectedCard.id);
        let nextState = { ...state, botHand: newHand };

        if (matches.length === 0) {
          nextState.field = [...nextState.field, selectedCard];
          nextState.message = `對手打出了 ${selectedCard.name}，沒有配對。`;
        } else if (matches.length === 1 || matches.length === 2) {
          playSfx('match');
          nextState.field = nextState.field.filter(c => c.id !== bestMatch!.id);
          nextState.botCaptured = [...nextState.botCaptured, selectedCard, bestMatch!];
          nextState.message = `對手配對了 ${selectedCard.name}！`;
        } else if (matches.length === 3) {
          playSfx('match');
          nextState.field = nextState.field.filter(c => c.month !== selectedCard.month);
          nextState.botCaptured = [...nextState.botCaptured, selectedCard, ...matches];
          nextState.message = `對手收走了場上三張 ${selectedCard.month}月牌！`;
        }

        setState(nextState);

        setTimeout(() => executeDrawPhase(nextState, 'bot'), 1500);
      };

      playBotTurn();
    }
  }, [state.phase]);

  const canHint =
    state.phase === 'player_turn_hand' ||
    state.phase === 'player_turn_hand_match' ||
    state.phase === 'player_turn_draw_match';

  const isPlayerActive = [
    'player_turn_hand',
    'player_turn_hand_match',
    'player_turn_draw',
    'player_turn_draw_match',
    'player_koi_koi',
  ].includes(state.phase);
  const isBotActive = state.phase === 'bot_turn';

  return (
    <div
      className="min-h-screen flex flex-col items-center py-4 px-2 sm:px-6 pb-8 bg-cover bg-center"
      style={{
        backgroundColor: '#0f1828',
        backgroundImage: [
          'linear-gradient(rgba(15,24,40,0.72), rgba(15,24,40,0.88))',
          `url(${import.meta.env.BASE_URL}textures/room-bg.jpg)`,
        ].join(', '),
      }}
    >
      <BackToMenu />
      {/* Header */}
      <header className="w-full max-w-6xl mb-4">
        <div className="wafu-panel rounded-2xl px-4 sm:px-6 py-4 relative overflow-hidden">
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="absolute top-3 right-14 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-cream/60 hover:text-gold hover:bg-gold/10 transition-colors touch-manipulation"
            aria-label="遊戲規則"
            title="遊戲規則"
          >
            <HelpCircle size={18} />
          </button>
          <button
            type="button"
            onClick={toggleMute}
            className="absolute top-3 right-3 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-cream/60 hover:text-gold hover:bg-gold/10 transition-colors touch-manipulation"
            aria-label={muted ? '開啟背景音樂' : '關閉背景音樂'}
            title={muted ? '開啟 BGM' : `BGM：${currentTitle}`}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <div className="absolute top-2 right-12 text-vermillion/20 text-4xl select-none pointer-events-none sakura-petal">✿</div>
          <div className="absolute bottom-2 left-4 text-gold/20 text-3xl select-none pointer-events-none sakura-petal">❀</div>
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 relative z-10">
            <div className="text-center sm:text-left">
              <p className="text-gold/80 text-xs tracking-[0.3em] mb-1">花札</p>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-gold tracking-wide">花牌</h1>
              <p className="text-sm text-cream/70 mt-1">
                第 {state.round} 局 · 莊家：{state.dealer === 'player' ? character.name : '師匠'}
                {state.phase !== 'idle' ? ` · ${DIFFICULTY_LABELS[difficulty]} · ${WIN_SCORE_LABELS[winScore]}` : ''}
              </p>
            </div>
            <div className="flex flex-col items-center gap-3 w-full sm:w-auto">
              <div className="flex gap-6 sm:gap-10">
                <div className="text-center">
                  <p className="text-xs text-cream/60 mb-1">師匠</p>
                  <p className="font-display text-2xl sm:text-3xl font-bold text-gold">{state.botScore}</p>
                </div>
                <div className="h-10 w-px bg-gold/30 self-center hidden sm:block" />
                <div className="text-center">
                  <p className="text-xs text-cream/60 mb-1">{character.name}</p>
                  <p className="font-display text-2xl sm:text-3xl font-bold text-vermillion-light">{state.playerScore}</p>
                </div>
              </div>
              {state.phase !== 'idle' && (
                <MatchScoreboard
                  playerLabel={character.name}
                  botLabel="師匠"
                  playerScore={state.playerScore}
                  botScore={state.botScore}
                  winScore={winScore}
                  wins={stats.wins}
                  losses={stats.losses}
                  winStreak={stats.winStreak}
                />
              )}
            </div>
          </div>
          <div className="sakura-divider mt-4" />
        </div>
      </header>

      {/* Idle screen */}
      {state.phase === 'idle' && (
        <div className="flex-1 flex flex-col items-center w-full max-w-4xl mt-4 gap-6">
          <div className="wafu-panel rounded-3xl p-6 sm:p-10 text-center relative w-full">
            <div className="corner-ornament corner-ornament-tl" />
            <div className="corner-ornament corner-ornament-tr" />
            <div className="corner-ornament corner-ornament-bl" />
            <div className="corner-ornament corner-ornament-br" />
            <div className="flex justify-center items-end gap-8 sm:gap-16 mb-6">
              <PlayerAvatar
                role="bot"
                name="花札師匠"
                score={state.botScore}
                roundPoints={0}
                isActive={false}
                isDealer={state.dealer === 'bot'}
                koiKoi={false}
                size="lg"
              />
              <div className="font-display text-gold/50 text-2xl pb-8">VS</div>
              <PlayerAvatar
                role="player"
                name={character.name}
                score={state.playerScore}
                roundPoints={0}
                isActive={false}
                isDealer={state.dealer === 'player'}
                koiKoi={false}
                size="lg"
                avatarSrc={playerAvatarUrl}
              />
            </div>
            <p className="text-cream/80 mb-1 font-display text-lg">歡迎來到花牌對局</p>
            <p className="text-cream/50 text-sm mb-4 max-w-md mx-auto">
              扮演「{character.name}」與師匠一決高下，湊齊光牌、短冊與動物牌組成役。
            </p>
            <p className="text-xs text-gold/70 mb-6">
              戰績 {stats.wins}勝 {stats.losses}敗
              {stats.winStreak > 0 ? ` · 連勝 ${stats.winStreak}` : ''}
            </p>
          </div>

          <div className="wafu-panel rounded-2xl p-4 sm:p-6 w-full">
            <p className="text-xs text-cream/60 mb-3 text-center tracking-wide">難度</p>
            <div className="flex justify-center gap-2 mb-2">
              {(['easy', 'normal', 'hard'] as Difficulty[]).map(id => (
                <button
                  key={id}
                  type="button"
                  onClick={() => applyDifficulty(id)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    difficulty === id
                      ? 'bg-gold/20 text-gold border border-gold/50'
                      : 'text-cream/60 border border-gold/20 hover:border-gold/40 hover:text-cream'
                  }`}
                >
                  {DIFFICULTY_LABELS[id]}
                </button>
              ))}
            </div>
            <p className="text-xs text-cream/60 mb-3 mt-4 text-center tracking-wide">對局長度</p>
            <div className="flex justify-center gap-2 mb-2">
              {WIN_SCORE_OPTIONS.map(target => (
                <button
                  key={target}
                  type="button"
                  onClick={() => applyWinScore(target)}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    winScore === target
                      ? 'bg-gold/20 text-gold border border-gold/50'
                      : 'text-cream/60 border border-gold/20 hover:border-gold/40 hover:text-cream'
                  }`}
                >
                  {WIN_SCORE_LABELS[target]}
                </button>
              ))}
            </div>
          </div>

          <div className="wafu-panel rounded-2xl p-4 sm:p-6 w-full">
            <CharacterSelect selectedId={characterId} onSelect={setCharacterId} />
          </div>

          <button
            onClick={() => startGame(false)}
            className="wafu-btn-primary px-10 py-4 rounded-xl text-lg"
          >
            開始對局
          </button>
        </div>
      )}

      {/* Game board */}
      {state.phase !== 'idle' && (
        <div className="w-full max-w-6xl flex flex-col gap-3 flex-1">
          {/* Opponent */}
          <div className="wafu-panel rounded-2xl p-3 sm:p-4">
            <div className="flex gap-3 sm:gap-4 items-start">
              <div className="hidden sm:block shrink-0 pt-1">
                <PlayerAvatar
                  role="bot"
                  name="花札師匠"
                  score={state.botScore}
                  roundPoints={state.botPoints}
                  isActive={isBotActive}
                  isDealer={state.dealer === 'bot'}
                  koiKoi={state.koiKoiCount.bot > 0}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-cream/50 mb-2 sm:hidden">師匠 · 手牌 {state.botHand.length}</p>
                <p className="text-xs text-gold/70 mb-2 hidden sm:block">手牌 ({state.botHand.length})</p>
                <div className="flex gap-1 sm:gap-2 flex-wrap">
                  {state.botHand.map(c => (
                    <CardComponent key={c.id} card={c} hidden />
                  ))}
                </div>
              </div>
              <div className="w-36 sm:w-52 shrink-0 pl-3 border-l border-gold/20">
                <CapturedPanel captured={state.botCaptured} />
              </div>
            </div>
          </div>

          {/* Field */}
          <div
            className="tatami-table rounded-2xl flex-1 flex flex-col items-center justify-center relative py-10 sm:py-12 min-h-[200px]"
            style={{
              backgroundImage: [
                'linear-gradient(rgba(45,66,40,0.82), rgba(35,52,32,0.9))',
                `url(${import.meta.env.BASE_URL}textures/tatami.jpg)`,
              ].join(', '),
            }}
          >
            <div className="corner-ornament corner-ornament-tl" />
            <div className="corner-ornament corner-ornament-tr" />
            <div className="corner-ornament corner-ornament-bl" />
            <div className="corner-ornament corner-ornament-br" />

            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[92%] max-w-lg z-20">
              <div className="speech-bubble rounded-xl px-4 py-2.5 text-center">
                <p className="font-display text-sm sm:text-base font-semibold text-indigo-deep leading-snug">
                  {state.message}
                </p>
              </div>
            </div>

            <AnimatePresence>
              {state.drawnCard && (
                <motion.div
                  initial={{ opacity: 0, y: -50, scale: 0.5 }}
                  animate={{ opacity: 1, y: 0, scale: 1.15 }}
                  exit={{ opacity: 0, scale: 0.5 }}
                  className="absolute z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                  <p className="text-center mb-2 font-display text-sm font-bold text-gold drop-shadow-md">山札</p>
                  <CardComponent card={state.drawnCard} className="shadow-2xl ring-2 ring-gold" />
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-wrap justify-center gap-2 sm:gap-3 max-w-4xl mt-10 px-2">
              {state.field.map(c => (
                <CardComponent
                  key={c.id}
                  card={c}
                  onClick={() => handleFieldCardClick(c)}
                  highlighted={state.matchingFieldCards.some(mc => mc.id === c.id)}
                  hint={hint?.fieldCardId === c.id}
                />
              ))}
            </div>
          </div>

          {/* Player */}
          <div className="wafu-panel rounded-2xl p-3 sm:p-4">
            <div className="flex gap-3 sm:gap-4 items-end">
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs text-gold/70">你的手牌</p>
                  {canHint && (
                    <button
                      type="button"
                      onClick={handleHint}
                      className="inline-flex items-center gap-1 text-xs text-cream/60 hover:text-gold px-2 py-1 rounded-lg hover:bg-gold/10 transition-colors"
                      aria-label="提示"
                      title="提示"
                    >
                      <Lightbulb size={14} />
                      提示
                    </button>
                  )}
                </div>
                <div className="flex gap-1 sm:gap-2 flex-wrap">
                  {state.playerHand.map(c => (
                    <CardComponent
                      key={c.id}
                      card={c}
                      onClick={() => handleHandCardClick(c)}
                      selected={state.selectedHandCard?.id === c.id}
                      hint={hint?.handCardId === c.id}
                      className={state.phase === 'player_turn_hand' ? 'hover:-translate-y-2' : ''}
                    />
                  ))}
                </div>
              </div>
              <div className="w-36 sm:w-52 shrink-0 pl-3 border-l border-gold/20">
                <CapturedPanel captured={state.playerCaptured} />
              </div>
              <div className="hidden sm:block shrink-0 pb-1">
                <PlayerAvatar
                  role="player"
                  name={character.name}
                  score={state.playerScore}
                  roundPoints={state.playerPoints}
                  isActive={isPlayerActive}
                  isDealer={state.dealer === 'player'}
                  koiKoi={state.koiKoiCount.player > 0}
                  avatarSrc={playerAvatarUrl}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Koi-Koi modal */}
      {state.phase === 'player_koi_koi' && (
        <div className="fixed inset-0 bg-indigo-deep/90 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="wafu-modal rounded-2xl p-8 text-center max-w-md w-full relative"
          >
            <div className="corner-ornament corner-ornament-tl" />
            <div className="corner-ornament corner-ornament-tr" />
            <div className="corner-ornament corner-ornament-bl" />
            <div className="corner-ornament corner-ornament-br" />
            <div className="flex justify-center mb-4">
              <PlayerAvatar
                role="player"
                name={character.name}
                score={state.playerScore}
                roundPoints={state.playerPoints}
                isActive
                isDealer={state.dealer === 'player'}
                koiKoi={false}
                size="lg"
                avatarSrc={playerAvatarUrl}
              />
            </div>
            <h2 className="font-display text-3xl font-bold text-gold mb-2">組成役！</h2>
            <p className="text-xl text-cream mb-2">目前獲得 {state.playerPoints} 分</p>
            <p className="text-sm text-cream/60 mb-8">
              {state.playerYaku.map(y => `${y.name}（${y.points}分）`).join(' ＋ ')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={handleAgari} className="wafu-btn-secondary px-6 py-3 rounded-xl">
                勝負（結算）
              </button>
              <button onClick={handleKoiKoi} className="wafu-btn-gold px-6 py-3 rounded-xl">
                Koi-Koi（繼續）
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Round end modal */}
      {state.phase === 'round_end' && (
        <div
          className="fixed inset-0 bg-indigo-deep/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="koi-koi-round-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="wafu-modal rounded-2xl p-8 text-center max-w-md w-full relative"
          >
            <div className="corner-ornament corner-ornament-tl" />
            <div className="corner-ornament corner-ornament-tr" />
            <div className="corner-ornament corner-ornament-bl" />
            <div className="corner-ornament corner-ornament-br" />
            <h2 id="koi-koi-round-title" className="font-display text-3xl font-bold text-gold mb-4">回合結束</h2>
            <p className="text-lg text-cream mb-6">{state.message}</p>
            <div className="mb-6">
              <CharacterSelect selectedId={characterId} onSelect={setCharacterId} compact />
            </div>
            <button
              type="button"
              onClick={() => startGame(true)}
              className="wafu-btn-gold px-8 py-4 min-h-[44px] rounded-xl text-lg touch-manipulation"
            >
              下一局
            </button>
          </motion.div>
        </div>
      )}

      {/* Game over modal */}
      {state.phase === 'game_over' && (
        <div
          className="fixed inset-0 bg-indigo-deep/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="koi-koi-over-title"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="wafu-modal rounded-2xl p-8 text-center max-w-md w-full relative"
          >
            <div className="corner-ornament corner-ornament-tl" />
            <div className="corner-ornament corner-ornament-tr" />
            <div className="corner-ornament corner-ornament-bl" />
            <div className="corner-ornament corner-ornament-br" />
            <h2 id="koi-koi-over-title" className="font-display text-3xl font-bold text-gold mb-2">
              {state.winner === 'player' ? '恭喜獲勝！' : '師匠獲勝'}
            </h2>
            <p className="text-lg text-cream mb-4">{state.message}</p>
            <div className="mb-4 flex justify-center">
              <MatchScoreboard
                playerLabel={character.name}
                botLabel="師匠"
                playerScore={state.playerScore}
                botScore={state.botScore}
                winScore={winScore}
                wins={stats.wins}
                losses={stats.losses}
                winStreak={stats.winStreak}
              />
            </div>
            <p className="text-xs text-cream/50 mb-6">
              難度：{DIFFICULTY_LABELS[difficulty]} · {WIN_SCORE_LABELS[winScore]}
            </p>
            <div className="mb-6">
              <CharacterSelect selectedId={characterId} onSelect={setCharacterId} compact />
            </div>
            <button
              type="button"
              onClick={() => startGame(false, true)}
              className="wafu-btn-gold px-8 py-4 min-h-[44px] rounded-xl text-lg touch-manipulation"
            >
              再來一局
            </button>
          </motion.div>
        </div>
      )}

      {showRules && <RulesModal winScore={winScore} onClose={() => setShowRules(false)} />}

      <footer className="mt-6 max-w-6xl text-center text-[10px] text-cream/40 px-4">
        牌面圖素材：Louie Mantia ·{' '}
        <a
          href="https://commons.wikimedia.org/wiki/Category:SVG_Hanafuda_with_traditional_colors_(black_border)"
          className="underline hover:text-gold/70"
          target="_blank"
          rel="noreferrer"
        >
          Wikimedia Commons
        </a>
        {' '}· CC BY-SA 4.0
      </footer>
    </div>
  );
}

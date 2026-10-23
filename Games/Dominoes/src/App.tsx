import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { JuiceSettingsPanel } from '@clubhouse/shared/JuiceSettings';
import { haptic, particles, shake } from '@clubhouse/shared/juice';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { ScoreFlash } from '@clubhouse/shared/ScoreFlash';
import { playMove, playScore, playWin, playLose } from '@clubhouse/shared/synthAudio';
import type {
  DominoesState,
  EndId,
  MatchState,
  SeatId,
  Difficulty,
  RuleVariant,
  MatchTarget,
  PlayerCount,
} from './utils/dominoesLogic';
import {
  createInitialState,
  createMatchState,
  applyRoundToMatch,
  advanceMatchRound,
  playTile,
  drawTiles,
  pass,
  getChainEnds,
  getEndPip,
  getPlayableEnds,
  getPlayableTiles,
  getValidMoves,
  pickBotMove,
  sumOpenEnds,
  boardToChain,
  teamHandScores,
  mergeLackLists,
  partnerOf,
  teamOf,
  DIFFICULTY_LABELS,
  DIFFICULTY_BLURBS,
  RULE_LABELS,
  RULE_BLURBS,
  MATCH_TARGETS,
  DEFAULT_MATCH_TARGET,
} from './utils/dominoesLogic';
import {
  loadStats,
  saveStats,
  recordMatchResult,
  loadMatch,
  saveMatch,
  clearMatch,
  type DominoesStats,
  type GameMode,
} from './utils/storage';
import {
  DAILY_MATCH_TARGET,
  dailyDealSeed,
  dailyStreak,
  formatDailyShareText,
  loadDailyProgress,
  recordDailyMatch,
  saveDailyProgress,
  todayKeyTaipei,
  todayRecord,
  type DailyProgress,
} from './utils/daily';
import { DominoTile, PlacedDominoTile } from './components/DominoTile';
import {
  FirstRunGuide,
  hasSeenFirstRunGuide,
} from './components/FirstRunGuide';
import {
  RefreshCw,
  BookOpen,
  Users,
  Bot,
  Undo2,
  Lightbulb,
  CalendarDays,
  UserRound,
} from 'lucide-react';

function playerCountFor(mode: GameMode): PlayerCount {
  return mode === 'partners' ? 4 : 2;
}

function persistMatchSnapshot(opts: {
  match: MatchState;
  ruleVariant: RuleVariant;
  difficulty: Difficulty;
  gameMode: GameMode;
}): void {
  if (opts.match.matchOver || opts.gameMode === 'daily') {
    if (opts.match.matchOver) clearMatch();
    return;
  }
  saveMatch({
    scores: opts.match.scores,
    target: opts.match.target as MatchTarget,
    round: opts.match.round,
    ruleVariant: opts.ruleVariant,
    difficulty: opts.difficulty,
    gameMode: opts.gameMode,
    playerCount: opts.match.playerCount,
  });
}

function seatLabel(
  seat: SeatId,
  mode: GameMode,
): string {
  if (mode === 'partners') {
    if (seat === 0) return '你';
    if (seat === 2) return '搭檔';
    if (seat === 1) return '對手 A';
    return '對手 B';
  }
  if (mode === 'bot' || mode === 'daily') {
    return seat === 0 ? '你' : '電腦';
  }
  return `玩家 ${seat + 1}`;
}

export default function App() {
  const saved = loadMatch();
  const initialStats = loadStats();
  const todayKey = todayKeyTaipei();
  const [dailyProgress, setDailyProgress] = useState<DailyProgress>(() =>
    loadDailyProgress(),
  );
  const [shareCopied, setShareCopied] = useState(false);

  const [gameMode, setGameMode] = useState<GameMode>(saved?.gameMode ?? 'bot');
  const [difficulty, setDifficulty] = useState<Difficulty>(
    saved?.difficulty ?? initialStats.lastDifficulty,
  );
  const [ruleVariant, setRuleVariant] = useState<RuleVariant>(
    saved?.ruleVariant ?? initialStats.lastRule ?? 'fives',
  );
  const [matchTarget, setMatchTarget] = useState<MatchTarget>(
    saved?.target ?? initialStats.lastTarget ?? DEFAULT_MATCH_TARGET,
  );
  const [match, setMatch] = useState<MatchState>(() => {
    if (saved) {
      return {
        scores: saved.scores,
        target: saved.target,
        round: saved.round,
        matchOver: false,
        matchWinner: null,
        playerCount: saved.playerCount,
      };
    }
    return createMatchState(matchTarget, 2);
  });
  const [state, setState] = useState<DominoesState>(() =>
    createInitialState(saved?.ruleVariant ?? 'fives', {
      playerCount: saved?.playerCount ?? 2,
    }),
  );
  const [history, setHistory] = useState<DominoesState[]>([]);
  const [hintMove, setHintMove] = useState<{ tileId: number; end: EndId } | null>(
    null,
  );
  const [stats, setStats] = useState<DominoesStats>(initialStats);
  const [showRules, setShowRules] = useState(false);
  const [showFirstRun, setShowFirstRun] = useState(() => !hasSeenFirstRunGuide());
  const [selectedTileId, setSelectedTileId] = useState<number | null>(null);
  const [lastPlacedId, setLastPlacedId] = useState<number | null>(null);
  const [scoreFlash, setScoreFlash] = useState<{ text: string; key: number } | null>(
    null,
  );
  const [roundBanner, setRoundBanner] = useState(false);
  const botScheduled = useRef(false);
  const prevPhaseRef = useRef(state.phase);
  const matchRecordedRef = useRef(false);
  const boardShellRef = useRef<HTMLDivElement | null>(null);

  const placeTileFx = useCallback(() => {
    haptic('place');
    particles('dust', { el: boardShellRef.current });
  }, []);

  const isPartners = gameMode === 'partners';
  const isDaily = gameMode === 'daily';
  const humanSeat: SeatId = 0;

  const currentHand = state.hands[state.currentPlayer] ?? [];
  const playable = getPlayableTiles(currentHand, state.board);
  const ends = getChainEnds(state.board);
  const canPlayAny = playable.length > 0;
  const playableEndIds = getPlayableEnds(state.board);
  const openSum = sumOpenEnds(state.board);
  const chain = boardToChain(state.board);
  const showSpinnerCross =
    ruleVariant === 'fives' && state.board.spinnerActive;

  const isCpuSeat = useCallback(
    (seat: SeatId): boolean => {
      if (gameMode === 'two') return false;
      if (gameMode === 'bot' || gameMode === 'daily') return seat === 1;
      // partners: seats 1,2,3 are CPU (2 is ally)
      return seat !== 0;
    },
    [gameMode],
  );

  const isBotTurn =
    state.phase === 'playing' && isCpuSeat(state.currentPlayer);

  const humanCanAct =
    state.phase === 'playing' &&
    (gameMode === 'two' || state.currentPlayer === humanSeat);

  const flashScore = useCallback((points: number) => {
    if (points <= 0) return;
    playScore();
    haptic('success');
    particles('sparkle', { el: boardShellRef.current, strength: 0.85 });
    setScoreFlash({ text: `+${points}`, key: Date.now() });
  }, []);

  const effectiveDifficulty: Difficulty = isDaily ? 'hard' : difficulty;

  useEffect(() => {
    if (!isBotTurn || botScheduled.current) return;
    botScheduled.current = true;
    const seat = state.currentPlayer;
    const timer = setTimeout(() => {
      const hand = state.hands[seat];
      const oppSeats = state.hands
        .map((_, i) => i as SeatId)
        .filter((s) => teamOf(s, state.playerCount) !== teamOf(seat, state.playerCount));
      const partner =
        state.playerCount === 4 ? partnerOf(seat) : null;
      const opponentLack = mergeLackLists(
        oppSeats.map((s) => state.suspectedLack[s] ?? []),
      );
      const partnerLack =
        partner !== null ? (state.suspectedLack[partner] ?? []) : [];
      let oppHandSize = 0;
      for (const s of oppSeats) oppHandSize += state.hands[s].length;

      if (canPlayHand(hand, state.board)) {
        const move = pickBotMove(hand, state.board, oppHandSize, effectiveDifficulty, {
          ruleVariant: state.ruleVariant,
          opponentLack,
          partnerLack,
          cooperative: isPartners && seat === 2,
          deterministic: isDaily,
        });
        if (move) {
          const next = playTile(state, seat, move.tileId, move.end);
          if (next) {
            playMove();
            placeTileFx();
            setLastPlacedId(move.tileId);
            if (next.lastPlayScore > 0 && next.phase === 'playing') {
              flashScore(next.lastPlayScore);
            }
            setState(next);
          }
        }
      } else if (state.ruleVariant === 'block') {
        const next = pass(state, seat);
        if (next) setState(next);
      } else {
        setState(drawTiles(state, seat));
      }
      botScheduled.current = false;
    }, isPartners ? 420 : 600);
    return () => {
      clearTimeout(timer);
      botScheduled.current = false;
    };
  }, [
    isBotTurn,
    state,
    effectiveDifficulty,
    flashScore,
    placeTileFx,
    isPartners,
    isDaily,
  ]);

  useEffect(() => {
    if (state.phase === 'playing') {
      prevPhaseRef.current = 'playing';
      return;
    }
    if (prevPhaseRef.current !== 'playing') return;
    prevPhaseRef.current = state.phase;

    if (state.lastPlayScore > 0) {
      flashScore(state.lastPlayScore);
    }

    setMatch((prev) => {
      const next = applyRoundToMatch(prev, state.handScores);
      persistMatchSnapshot({
        match: next,
        ruleVariant,
        difficulty: effectiveDifficulty,
        gameMode,
      });
      return next;
    });
    setRoundBanner(true);
  }, [
    state.phase,
    state.handScores,
    state.lastPlayScore,
    ruleVariant,
    effectiveDifficulty,
    gameMode,
    flashScore,
  ]);

  useEffect(() => {
    if (!match.matchOver || matchRecordedRef.current) return;
    matchRecordedRef.current = true;
    clearMatch();
    haptic('win');
    particles('confetti', { el: boardShellRef.current, strength: 1.1 });
    shake(boardShellRef.current, 0.95);
    const humanWon = match.matchWinner === 0;
    if (gameMode === 'bot' || gameMode === 'partners' || gameMode === 'daily') {
      if (humanWon) playWin();
      else playLose();
    }
    if (gameMode === 'bot' || gameMode === 'partners') {
      setStats((prev) => {
        const next = recordMatchResult(prev, humanWon, {
          rule: ruleVariant,
          difficulty: effectiveDifficulty,
          target: matchTarget,
          mode: gameMode,
        });
        saveStats(next);
        return next;
      });
    }
    if (gameMode === 'daily') {
      setDailyProgress((prev) => {
        const next = recordDailyMatch(
          prev,
          todayKey,
          match.scores[0],
          humanWon,
        );
        saveDailyProgress(next);
        return next;
      });
    }
  }, [
    match.matchOver,
    match.matchWinner,
    match.scores,
    gameMode,
    ruleVariant,
    effectiveDifficulty,
    matchTarget,
    todayKey,
  ]);

  const pushHistory = useCallback(() => {
    setHistory((h) => [...h, state]);
  }, [state]);

  const handlePlayAt = useCallback(
    (end: EndId) => {
      if (state.phase !== 'playing' || !selectedTileId) return;
      if (gameMode !== 'two' && state.currentPlayer !== humanSeat) return;
      const actor = state.currentPlayer;
      const next = playTile(state, actor, selectedTileId, end);
      if (next) {
        pushHistory();
        playMove();
        placeTileFx();
        setLastPlacedId(selectedTileId);
        if (next.lastPlayScore > 0 && next.phase === 'playing') {
          flashScore(next.lastPlayScore);
        }
        setState(next);
        setSelectedTileId(null);
        setHintMove(null);
      }
    },
    [state, selectedTileId, gameMode, pushHistory, flashScore, placeTileFx],
  );

  const handleDraw = useCallback(() => {
    if (state.phase !== 'playing' || canPlayAny) return;
    if (state.ruleVariant === 'block' || state.boneyard.length <= 2) return;
    if (gameMode !== 'two' && state.currentPlayer !== humanSeat) return;
    pushHistory();
    setHintMove(null);
    setState(drawTiles(state, state.currentPlayer));
  }, [state, canPlayAny, gameMode, pushHistory]);

  const handlePass = useCallback(() => {
    if (state.phase !== 'playing' || canPlayAny) return;
    if (gameMode !== 'two' && state.currentPlayer !== humanSeat) return;
    const next = pass(state, state.currentPlayer);
    if (!next) return;
    pushHistory();
    setHintMove(null);
    setState(next);
  }, [state, canPlayAny, gameMode, pushHistory]);

  const canUndo =
    history.length > 0 && !isBotTurn && state.phase === 'playing';

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setState(prev);
    setSelectedTileId(null);
    setHintMove(null);
    botScheduled.current = false;
  }, [canUndo, history]);

  const handleHint = useCallback(() => {
    if (!humanCanAct || !canPlayAny) return;
    const oppSeats = state.hands
      .map((_, i) => i as SeatId)
      .filter((s) => teamOf(s, state.playerCount) !== 0);
    const partner = state.playerCount === 4 ? partnerOf(0) : null;
    let oppHandSize = 0;
    for (const s of oppSeats) oppHandSize += state.hands[s].length;
    const move = pickBotMove(
      state.hands[0],
      state.board,
      oppHandSize,
      'hard',
      {
        ruleVariant: state.ruleVariant,
        opponentLack: mergeLackLists(
          oppSeats.map((s) => state.suspectedLack[s] ?? []),
        ),
        partnerLack: partner !== null ? state.suspectedLack[partner] : [],
        cooperative: isPartners,
        deterministic: true,
      },
    );
    if (move) {
      setHintMove(move);
      setSelectedTileId(move.tileId);
    }
  }, [humanCanAct, canPlayAny, state, isPartners]);

  const startFreshMatch = useCallback(
    (opts?: {
      variant?: RuleVariant;
      target?: MatchTarget;
      mode?: GameMode;
      diff?: Difficulty;
    }) => {
      const mode = opts?.mode ?? gameMode;
      const count = playerCountFor(mode);
      let variant = opts?.variant ?? ruleVariant;
      let target = opts?.target ?? matchTarget;
      let diff = opts?.diff ?? difficulty;

      if (mode === 'daily') {
        variant = 'fives';
        target = DAILY_MATCH_TARGET;
        diff = 'hard';
      } else if (mode === 'partners') {
        // Partners: All Fives / block (draw also works but default fives).
        if (variant === 'draw') variant = 'fives';
      }

      setRuleVariant(variant);
      setMatchTarget(target);
      setGameMode(mode);
      setDifficulty(diff);
      const nextMatch = createMatchState(target, count);
      setMatch(nextMatch);
      setState(
        createInitialState(variant, {
          playerCount: count,
          seed: mode === 'daily' ? dailyDealSeed(todayKey) : undefined,
        }),
      );
      setHistory([]);
      setSelectedTileId(null);
      setHintMove(null);
      setLastPlacedId(null);
      setRoundBanner(false);
      setScoreFlash(null);
      setShareCopied(false);
      botScheduled.current = false;
      prevPhaseRef.current = 'playing';
      matchRecordedRef.current = false;
      persistMatchSnapshot({
        match: nextMatch,
        ruleVariant: variant,
        difficulty: diff,
        gameMode: mode,
      });
    },
    [ruleVariant, matchTarget, gameMode, difficulty, todayKey],
  );

  const handleNextRound = useCallback(() => {
    if (match.matchOver) {
      startFreshMatch();
      return;
    }
    setMatch((prev) => {
      const next = advanceMatchRound(prev);
      persistMatchSnapshot({
        match: next,
        ruleVariant,
        difficulty: effectiveDifficulty,
        gameMode,
      });
      return next;
    });
    setState(
      createInitialState(ruleVariant, {
        playerCount: match.playerCount,
        seed:
          gameMode === 'daily'
            ? `${dailyDealSeed(todayKey)}:r${match.round + 1}`
            : undefined,
      }),
    );
    setHistory([]);
    setSelectedTileId(null);
    setHintMove(null);
    setLastPlacedId(null);
    setRoundBanner(false);
    botScheduled.current = false;
    prevPhaseRef.current = 'playing';
  }, [
    match.matchOver,
    match.playerCount,
    match.round,
    ruleVariant,
    effectiveDifficulty,
    gameMode,
    startFreshMatch,
    todayKey,
  ]);

  const handleCopyShare = useCallback(async () => {
    const rec = todayRecord(dailyProgress, todayKey);
    const streak = dailyStreak(dailyProgress, todayKey);
    const text = formatDailyShareText({
      dateKey: todayKey,
      bestScore: rec?.bestScore ?? match.scores[0],
      streak,
      won: rec?.won ?? match.matchWinner === 0,
      target: DAILY_MATCH_TARGET,
    });
    try {
      await navigator.clipboard.writeText(text);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }, [dailyProgress, todayKey, match.scores, match.matchWinner]);

  const isValidEnd = useCallback(
    (tileId: number, end: EndId) => {
      const moves = getValidMoves(
        state.hands[state.currentPlayer],
        state.board,
        state.ruleVariant,
      );
      return moves.some((m) => m.tileId === tileId && m.end === end);
    },
    [state.hands, state.currentPlayer, state.board, state.ruleVariant],
  );

  const roundTeams = useMemo(
    () => teamHandScores(state.handScores, state.playerCount),
    [state.handScores, state.playerCount],
  );

  const dailyRec = todayRecord(dailyProgress, todayKey);
  const streak = dailyStreak(dailyProgress, todayKey);

  const statusMessage =
    state.phase === 'roundOver'
      ? state.roundEndReason === 'domino'
        ? `${seatLabel(state.winner!, gameMode)} 出完 · 本局隊伍 +${
            roundTeams[state.winningTeam ?? 0]
          }`
        : `阻塞：${
            state.winningTeam === 0 ? '我方' : '對方'
          } 點數較少 · 本局 +${roundTeams[state.winningTeam ?? 0]}`
      : isBotTurn
        ? `${seatLabel(state.currentPlayer, gameMode)} 思考中…`
        : gameMode === 'two'
          ? `玩家 ${state.currentPlayer + 1} 的回合`
          : '輪到你';

  const endHintClass = (end: EndId) =>
    hintMove && selectedTileId === hintMove.tileId && hintMove.end === end
      ? 'border-sky-400 bg-sky-500/20 text-sky-200'
      : 'border-slate-500 bg-slate-800/50 text-slate-400';

  const endButton = (end: EndId, label: string) => {
    if (!playableEndIds.includes(end)) return null;
    const pip = getEndPip(state.board, end);
    if (pip === null) return null;
    return (
      <button
        type="button"
        key={end}
        onClick={() => handlePlayAt(end)}
        disabled={
          state.phase !== 'playing' ||
          !selectedTileId ||
          !humanCanAct ||
          !isValidEnd(selectedTileId, end)
        }
        className={`flex flex-col items-center justify-center w-9 h-16 sm:w-10 sm:h-20 rounded border-2 border-dashed disabled:opacity-40 disabled:cursor-not-allowed hover:border-amber-500 hover:bg-slate-700/50 hover:text-amber-400 transition-colors touch-manipulation ${endHintClass(end)}`}
        title={`出在${label}`}
        aria-label={`出在${label}（${pip}）`}
      >
        <span className="text-base sm:text-lg font-bold">{pip}</span>
        <span className="text-[10px] sm:text-xs">{label}</span>
      </button>
    );
  };

  const modeBadge =
    gameMode === 'bot'
      ? '對戰電腦'
      : gameMode === 'two'
        ? '雙人'
        : gameMode === 'partners'
          ? '四人搭檔'
          : '每日挑戰';

  const p1Label = isPartners ? '我方' : seatLabel(0, gameMode);
  const p2Label = isPartners ? '對方' : seatLabel(1, gameMode);

  const allowedRules: RuleVariant[] =
    gameMode === 'daily'
      ? ['fives']
      : gameMode === 'partners'
        ? ['fives', 'block']
        : ['fives', 'draw', 'block'];

  return (
    <div
      className="min-h-screen text-white flex flex-col items-center p-3 sm:p-4 min-w-0 bg-cover bg-center relative"
      style={{
        backgroundColor: '#0f172a',
        backgroundImage: [
          'linear-gradient(rgba(15,23,42,0.78), rgba(15,23,42,0.9))',
          `url(${import.meta.env.BASE_URL}table-bg.jpg)`,
        ].join(', '),
      }}
    >
      <BackToMenu />
      {showFirstRun && <FirstRunGuide onClose={() => setShowFirstRun(false)} />}
      {scoreFlash && (
        <ScoreFlash
          text={scoreFlash.text}
          tone="good"
          flashKey={scoreFlash.key}
          onDone={() => setScoreFlash(null)}
        />
      )}

      <header className="w-full max-w-2xl flex justify-between items-center mb-2 sm:mb-3 gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">西洋骨牌</h1>
          <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-600">
            {modeBadge}
          </span>
          <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-600">
            {RULE_LABELS[ruleVariant]}
          </span>
          {(gameMode === 'bot' || gameMode === 'partners') && (
            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-200 border border-amber-700/60">
              連勝 {stats.streak}
            </span>
          )}
          {isDaily && (
            <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-slate-800 text-emerald-200 border border-emerald-700/60">
              {todayKey} · 連續 {streak} 天
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={handleUndo}
            disabled={!canUndo}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40 disabled:pointer-events-none touch-manipulation inline-flex items-center justify-center"
            title="悔棋"
            aria-label="悔棋"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleHint}
            disabled={!humanCanAct || !canPlayAny}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40 disabled:pointer-events-none touch-manipulation inline-flex items-center justify-center"
            title="提示"
            aria-label="提示"
          >
            <Lightbulb className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setShowRules(true)}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-white/10 transition-colors touch-manipulation inline-flex items-center justify-center"
            title="規則"
            aria-label="規則"
          >
            <BookOpen className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => startFreshMatch()}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg hover:bg-white/10 transition-colors touch-manipulation inline-flex items-center justify-center"
            title="新比賽"
            aria-label="新比賽"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="w-full max-w-md mb-2 sm:mb-3 rounded-xl border border-white/10 bg-slate-900/70 px-3 sm:px-4 py-2.5 sm:py-3">
        <div className="flex justify-between text-[10px] sm:text-xs text-slate-400 mb-1">
          <span>
            {match.target === 1
              ? `單局 · 第 ${match.round} 回合`
              : `第 ${match.round} 局 · 先達 ${match.target} 分`}
          </span>
          <span>
            本局 {roundTeams[0]}–{roundTeams[1]}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <ScoreBar label={p1Label} score={match.scores[0]} target={match.target} accent="sky" />
          <ScoreBar label={p2Label} score={match.scores[1]} target={match.target} accent="amber" />
        </div>
        {(gameMode === 'bot' || gameMode === 'partners') && (
          <p className="mt-1.5 text-center text-[10px] text-slate-500">
            戰績 {stats.wins}勝 {stats.losses}敗
            {stats.bestStreak > 0 ? ` · 最佳連勝 ${stats.bestStreak}` : ''}
          </p>
        )}
        {isDaily && (
          <p className="mt-1.5 text-center text-[10px] text-emerald-400/90">
            今日最佳 {dailyRec?.bestScore ?? '—'}
            {dailyRec?.won ? ' · 已獲勝' : dailyRec?.completed ? ' · 已完賽' : ' · 尚未完賽'}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 mb-2 text-sm">
        <ModeButton
          active={gameMode === 'two'}
          onClick={() => startFreshMatch({ mode: 'two' })}
          icon={<Users className="w-4 h-4" />}
          label="雙人"
        />
        <ModeButton
          active={gameMode === 'bot'}
          onClick={() => startFreshMatch({ mode: 'bot' })}
          icon={<Bot className="w-4 h-4" />}
          label="對戰電腦"
        />
        <ModeButton
          active={gameMode === 'partners'}
          onClick={() => startFreshMatch({ mode: 'partners', variant: 'fives' })}
          icon={<UserRound className="w-4 h-4" />}
          label="四人搭檔"
          accent="emerald"
        />
        <ModeButton
          active={gameMode === 'daily'}
          onClick={() => startFreshMatch({ mode: 'daily' })}
          icon={<CalendarDays className="w-4 h-4" />}
          label="每日"
          accent="violet"
        />
      </div>

      {!isDaily && (
        <div
          className="flex flex-wrap items-center justify-center gap-2 mb-2 text-xs"
          role="group"
          aria-label="規則變體"
        >
          <span className="text-slate-400">規則</span>
          {allowedRules.map((id) => {
            const selected = ruleVariant === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => startFreshMatch({ variant: id })}
                aria-pressed={selected}
                title={RULE_BLURBS[id]}
                className={`px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation transition-colors ${
                  selected
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
                    : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {RULE_LABELS[id]}
              </button>
            );
          })}
        </div>
      )}

      {!isDaily && (
        <details
          className="dm-more-modes w-full max-w-md mb-2 rounded-xl border border-slate-700/80 bg-slate-900/40 px-3 py-2 text-xs"
          open={matchTarget !== 1}
        >
          <summary className="min-h-[44px] cursor-pointer list-none touch-manipulation flex items-center justify-between gap-2 text-slate-300 font-semibold">
            <span>更多賽制</span>
            <span className="font-normal text-slate-500">
              {matchTarget === 1 ? '目前：單局' : `目前：先達 ${matchTarget} 分`}
            </span>
          </summary>
          <div
            className="mt-2 flex flex-wrap items-center justify-center gap-2"
            role="group"
            aria-label="比賽目標分"
          >
            <span className="text-slate-400">目標</span>
            {MATCH_TARGETS.map((t) => {
              const selected = matchTarget === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => startFreshMatch({ target: t })}
                  aria-pressed={selected}
                  className={`px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation transition-colors ${
                    selected
                      ? 'border-violet-400 bg-violet-500/20 text-violet-100'
                      : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {t === 1 ? '單局' : `${t} 分`}
                </button>
              );
            })}
          </div>
        </details>
      )}

      {(gameMode === 'bot' || gameMode === 'partners') && (
        <div className="flex flex-col items-center gap-1 mb-2 sm:mb-3 text-xs">
          <div
            className="flex flex-wrap items-center justify-center gap-2"
            role="group"
            aria-label="電腦難度"
          >
            <span className="text-slate-400">電腦難度</span>
            {(['easy', 'normal', 'hard'] as Difficulty[]).map((id) => {
              const selected = difficulty === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => startFreshMatch({ diff: id })}
                  aria-pressed={selected}
                  title={DIFFICULTY_BLURBS[id]}
                  className={`px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation transition-colors ${
                    selected
                      ? 'border-amber-400 bg-amber-500/20 text-amber-100'
                      : 'border-slate-600 bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {DIFFICULTY_LABELS[id]}
                </button>
              );
            })}
          </div>
          <p className="text-slate-500">{DIFFICULTY_BLURBS[difficulty]}</p>
        </div>
      )}

      {isDaily && (
        <p className="text-violet-200/90 text-xs mb-2 text-center px-2">
          今日固定發牌（台北日曆）· 困難 AI · 目標 {DAILY_MATCH_TARGET} 分
        </p>
      )}

      <p className="text-slate-200 text-sm mb-1 sm:mb-2">{statusMessage}</p>

      {ruleVariant === 'fives' && (
        <p className="text-emerald-300/90 text-xs mb-2 tabular-nums">
          開放端點和：{openSum}
          {openSum > 0 && openSum % 5 === 0 ? ' · 可得分！' : ''}
        </p>
      )}

      {/* Partners table chrome — compact for phones */}
      {isPartners && (
        <div className="w-full max-w-md mb-2 grid grid-cols-3 gap-1 text-[10px] sm:text-xs text-center">
          <div />
          <SeatChip
            label={seatLabel(2, gameMode)}
            count={state.hands[2]?.length ?? 0}
            active={state.currentPlayer === 2}
            ally
          />
          <div />
          <SeatChip
            label={seatLabel(3, gameMode)}
            count={state.hands[3]?.length ?? 0}
            active={state.currentPlayer === 3}
          />
          <div className="flex items-center justify-center text-slate-500">桌面</div>
          <SeatChip
            label={seatLabel(1, gameMode)}
            count={state.hands[1]?.length ?? 0}
            active={state.currentPlayer === 1}
          />
        </div>
      )}

      <div
        ref={boardShellRef}
        data-dominoes-board="1"
        className="w-full max-w-2xl overflow-x-auto py-2 sm:py-3 relative"
      >
        {showSpinnerCross ? (
          <div className="flex flex-col items-center gap-1 min-h-[7rem] sm:min-h-[8rem]">
            <div className="flex items-center gap-1">
              {endButton('up', '上')}
              <div className="flex flex-col items-center gap-0.5">
                {[...state.board.arms.up].reverse().map((p) => (
                  <PlacedDominoTile
                    key={p.tile.id}
                    placed={{
                      tile: p.tile,
                      displayLeft: p.outward,
                      displayRight: p.inward,
                    }}
                    vertical
                    justPlaced={p.tile.id === lastPlacedId}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {ends && endButton('left', '左')}
              <div className="flex items-center gap-0.5">
                {[...state.board.arms.left].reverse().map((p) => (
                  <PlacedDominoTile
                    key={p.tile.id}
                    placed={{
                      tile: p.tile,
                      displayLeft: p.outward,
                      displayRight: p.inward,
                    }}
                    justPlaced={p.tile.id === lastPlacedId}
                  />
                ))}
                {state.board.hub && (
                  <PlacedDominoTile
                    placed={state.board.hub}
                    spinner
                    justPlaced={state.board.hub.tile.id === lastPlacedId}
                  />
                )}
                {state.board.arms.right.map((p) => (
                  <PlacedDominoTile
                    key={p.tile.id}
                    placed={{
                      tile: p.tile,
                      displayLeft: p.inward,
                      displayRight: p.outward,
                    }}
                    justPlaced={p.tile.id === lastPlacedId}
                  />
                ))}
              </div>
              {ends && endButton('right', '右')}
            </div>
            <div className="flex items-center gap-1">
              <div className="flex flex-col items-center gap-0.5">
                {state.board.arms.down.map((p) => (
                  <PlacedDominoTile
                    key={p.tile.id}
                    placed={{
                      tile: p.tile,
                      displayLeft: p.inward,
                      displayRight: p.outward,
                    }}
                    vertical
                    justPlaced={p.tile.id === lastPlacedId}
                  />
                ))}
              </div>
              {endButton('down', '下')}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-0 min-h-[4.5rem] sm:min-h-[5rem]">
            {ends && endButton('left', '左')}
            <div className="flex items-center gap-0.5 flex-nowrap relative">
              {chain.map((placed) => (
                <PlacedDominoTile
                  key={placed.tile.id}
                  placed={placed}
                  justPlaced={placed.tile.id === lastPlacedId}
                  spinner={
                    state.board.spinnerActive &&
                    state.board.hub?.tile.id === placed.tile.id
                  }
                />
              ))}
              {scoreFlash && (
                <span
                  className="domino-score-callout absolute left-1/2 top-0 z-10 pointer-events-none font-black text-2xl text-emerald-300"
                  aria-hidden
                >
                  {scoreFlash.text}
                </span>
              )}
            </div>
            {ends && endButton('right', '右')}
          </div>
        )}
      </div>

      <p className="text-slate-400 text-xs mb-2">
        牌堆：{state.boneyard.length} 張
        {!isPartners && (gameMode === 'bot' || gameMode === 'daily') && (
          <span className="ml-3">電腦手牌：{state.hands[1]?.length ?? 0}</span>
        )}
      </p>

      <div className="w-full max-w-2xl">
        <p className="text-slate-300 text-sm mb-2">
          {gameMode === 'two'
            ? `${seatLabel(state.currentPlayer as SeatId, gameMode)} 手牌`
            : '你的手牌'}
          {humanCanAct && (
            <span className="ml-2 text-amber-400">
              {canPlayAny
                ? '選一張牌再點端點出牌'
                : ruleVariant === 'block'
                  ? '無法出牌，請跳過'
                  : '無法出牌，請抽牌'}
            </span>
          )}
          {isBotTurn && (
            <span className="ml-2 text-slate-500">
              {seatLabel(state.currentPlayer, gameMode)} 出牌中…
            </span>
          )}
        </p>
        {state.phase === 'playing' && (
          <div className="flex gap-1.5 sm:gap-2 flex-wrap justify-center items-end pb-4">
            {(gameMode === 'two' ? currentHand : state.hands[0]).map((t) => {
              const hand = gameMode === 'two' ? currentHand : state.hands[0];
              const ids = new Set(
                getPlayableTiles(hand, state.board).map((x) => x.id),
              );
              const selectable = humanCanAct && ids.has(t.id);
              return (
                <DominoTile
                  key={t.id}
                  tile={t}
                  vertical={false}
                  highlight={selectable && selectedTileId === t.id}
                  hint={
                    humanCanAct &&
                    hintMove?.tileId === t.id &&
                    selectedTileId !== t.id
                  }
                  playable={
                    selectable &&
                    selectedTileId !== t.id &&
                    hintMove?.tileId !== t.id
                  }
                  size="normal"
                  onClick={() => {
                    if (!selectable) return;
                    setSelectedTileId(selectedTileId === t.id ? null : t.id);
                    if (hintMove && hintMove.tileId !== t.id) setHintMove(null);
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {state.phase === 'playing' &&
        !canPlayAny &&
        humanCanAct &&
        ruleVariant !== 'block' &&
        state.boneyard.length > 2 && (
          <button
            type="button"
            onClick={handleDraw}
            className="mt-3 px-6 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 font-medium transition-colors touch-manipulation min-h-[44px]"
          >
            抽牌
          </button>
        )}

      {state.phase === 'playing' &&
        !canPlayAny &&
        humanCanAct &&
        (ruleVariant === 'block' || state.boneyard.length <= 2) && (
          <button
            type="button"
            onClick={handlePass}
            className="mt-3 px-6 py-2 rounded-lg bg-slate-600 hover:bg-slate-500 font-medium transition-colors touch-manipulation min-h-[44px]"
          >
            跳過
          </button>
        )}

      {roundBanner && state.phase === 'roundOver' && !match.matchOver && (
        <ResultOverlay
          title={
            gameMode === 'two'
              ? `玩家 ${(state.winner as SeatId) + 1} 拿下本局`
              : state.winningTeam === 0
                ? '本局獲勝'
                : '本局落敗'
          }
          subtitle={`${p1Label} ${match.scores[0]} — ${match.scores[1]} ${p2Label}${match.target === 1 ? ' · 單局' : ` · 目標 ${match.target}`}`}
          badge={state.roundEndReason === 'blocked' ? '阻塞結算' : '出完手牌'}
          variant={
            gameMode === 'two'
              ? 'neutral'
              : state.winningTeam === 0
                ? 'win'
                : 'lose'
          }
          stats={[
            { label: `${p1Label} 本局`, value: roundTeams[0] },
            { label: `${p2Label} 本局`, value: roundTeams[1] },
            { label: '規則', value: RULE_LABELS[ruleVariant] },
          ]}
          primaryLabel="下一局"
          onPrimary={handleNextRound}
        />
      )}

      {match.matchOver && (
        <ResultOverlay
          title={
            gameMode === 'two'
              ? `玩家 ${(match.matchWinner as number) + 1} 贏得比賽`
              : match.matchWinner === 0
                ? isDaily
                  ? '今日挑戰勝利！'
                  : '比賽勝利！'
                : isDaily
                  ? '今日挑戰敗北'
                  : '比賽敗北'
          }
          subtitle={
            match.target === 1
              ? `終場 ${match.scores[0]} — ${match.scores[1]}（單局）`
              : `終場 ${match.scores[0]} — ${match.scores[1]}（先達 ${match.target}）`
          }
          badge={isDaily ? '每日挑戰' : match.target === 1 ? '單局結束' : '比賽結束'}
          variant={
            gameMode === 'two'
              ? 'neutral'
              : match.matchWinner === 0
                ? 'win'
                : 'lose'
          }
          stats={[
            { label: `${p1Label} 總分`, value: match.scores[0] },
            { label: `${p2Label} 總分`, value: match.scores[1] },
            { label: '局數', value: match.round },
            { label: '規則', value: RULE_LABELS[ruleVariant] },
            ...(isDaily
              ? [
                  { label: '連續天數', value: String(streak) },
                  {
                    label: '今日最佳',
                    value: String(
                      Math.max(dailyRec?.bestScore ?? 0, match.scores[0]),
                    ),
                  },
                ]
              : gameMode !== 'two'
                ? [
                    { label: '連勝', value: String(stats.streak) },
                    { label: '生涯勝場', value: String(stats.wins) },
                  ]
                : []),
          ]}
          primaryLabel={isDaily ? '再挑戰今日' : '再打一場'}
          onPrimary={() => startFreshMatch()}
          secondaryLabel={isDaily ? (shareCopied ? '已複製' : '複製分享結果') : undefined}
          onSecondary={isDaily ? handleCopyShare : undefined}
        />
      )}

      {showRules && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dominoes-rules-title"
        >
          <div className="bg-slate-800 rounded-xl max-w-md max-h-[85vh] overflow-y-auto p-6 text-left">
            <h2 id="dominoes-rules-title" className="text-lg font-bold mb-3">
              規則說明（{RULE_LABELS[ruleVariant]}）
            </h2>
            <ul className="text-sm text-slate-200 space-y-2 list-disc pl-4">
              <li>
                雙六組 28 張牌
                {isPartners
                  ? '，四人各 5 張，其餘為牌堆；對家為搭檔，團隊計分。'
                  : '，每人 7 張，其餘為牌堆。'}
              </li>
              <li>輪流出牌：選一張手牌與開放端點點數相同的一邊相接。</li>
              {isPartners && (
                <li>
                  搭檔模式：你與對家 CPU 為一隊，兩側為對手；搭檔會避免堵你需要的點數。
                </li>
              )}
              {isDaily && (
                <li>
                  每日挑戰：以台北日期固定發牌，困難 AI，目標 {DAILY_MATCH_TARGET}{' '}
                  分；可記錄最佳分與連續天數並複製分享。
                </li>
              )}
              {ruleVariant === 'fives' ? (
                <>
                  <li>
                    五倍數（All Fives）：出牌後若所有開放端點點數和為 5
                    的倍數，立即得該和為分。雙張在端點時計兩倍；第一張雙張為轉軸，四邊可接。
                  </li>
                  <li>
                    一手結束：出完方隊伍得對手手牌點數和（四捨五入到
                    5）；阻塞時點數較少隊伍得分。
                  </li>
                  <li>整場先累積到 {match.target} 分者勝。</li>
                </>
              ) : (
                <>
                  <li>
                    {ruleVariant === 'draw'
                      ? '摸牌制：無法出牌時從牌堆抽牌，直到能出或牌堆剩 2 張；之後才能跳過。'
                      : '封鎖制：無法出牌時直接跳過（不摸牌）；全員都無法出牌即阻塞結算。'}
                  </li>
                  <li>
                    出完者隊伍得對手手牌點數和；阻塞時點數較少隊伍得分。整場先達{' '}
                    {match.target} 分勝。
                  </li>
                </>
              )}
            </ul>
            <p className="mt-3 text-xs text-slate-400">{RULE_BLURBS[ruleVariant]}</p>
            <div className="mt-4">
              <JuiceSettingsPanel />
            </div>
            <button
              type="button"
              onClick={() => setShowRules(false)}
              className="mt-4 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 font-medium touch-manipulation min-h-[44px]"
            >
              關閉
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  icon,
  label,
  accent = 'amber',
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactElement;
  label: string;
  accent?: 'amber' | 'emerald' | 'violet' | 'sky';
}) {
  const on =
    accent === 'emerald'
      ? 'border-emerald-400 bg-emerald-500/20 text-emerald-100'
      : accent === 'violet'
        ? 'border-violet-400 bg-violet-500/20 text-violet-100'
        : accent === 'sky'
          ? 'border-sky-400 bg-sky-500/20 text-sky-100'
          : 'border-amber-400 bg-amber-500/20 text-amber-100';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[44px] rounded-full border touch-manipulation text-xs sm:text-sm ${
        active ? on : 'border-slate-600 bg-slate-800 text-slate-300'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SeatChip({
  label,
  count,
  active,
  ally = false,
}: {
  label: string;
  count: number;
  active: boolean;
  ally?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-1.5 py-1 ${
        active
          ? 'border-amber-400 bg-amber-500/15 text-amber-100'
          : ally
            ? 'border-sky-700/60 bg-sky-950/40 text-sky-200'
            : 'border-slate-700 bg-slate-900/50 text-slate-300'
      }`}
    >
      <div className="font-medium truncate">{label}</div>
      <div className="tabular-nums text-slate-400">{count} 張</div>
    </div>
  );
}

function ScoreBar({
  label,
  score,
  target,
  accent,
}: {
  label: string;
  score: number;
  target: number;
  accent: 'sky' | 'amber';
}) {
  const pct = Math.min(100, (score / target) * 100);
  const bar = accent === 'sky' ? 'bg-sky-400' : 'bg-amber-400';
  return (
    <div>
      <div className="flex justify-between text-[11px] text-slate-300 mb-1">
        <span>{label}</span>
        <span className="tabular-nums">
          {target === 1 ? score : `${score} / ${target}`}
        </span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden border border-white/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ${bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function canPlayHand(
  hand: DominoesState['hands'][0],
  board: DominoesState['board'],
): boolean {
  return getPlayableTiles(hand, board).length > 0;
}

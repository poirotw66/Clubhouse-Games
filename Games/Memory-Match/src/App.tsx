import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { JuiceSettingsPanel } from '@clubhouse/shared/JuiceSettings';
import { OriginLoreModal } from '@clubhouse/shared/OriginLoreModal';
import { MEMORY_MATCH_LORE } from '@clubhouse/shared/lore/puzzleStrategy';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { ScoreFlash } from '@clubhouse/shared/ScoreFlash';
import {
  haptic,
  loadJuiceSettings,
  particles,
  shake,
  subscribeJuiceSettings,
} from '@clubhouse/shared/juice';
import {
  playCapture,
  playCard,
  playError,
  playLose,
  playMove,
  playScore,
  playWin,
} from '@clubhouse/shared/synthAudio';
import {
  CAMPAIGN_STAGES,
  CHAPTER_STAR_GATES,
  clearStageAndPersist,
  continueStageIndex,
  copiesPerFace,
  flipTarget as stageFlipTarget,
  isChapterUnlocked,
  isStageUnlocked,
  loadCampaignProgress,
  stageSeed,
  starsEarned,
  totalStarsInChapter,
  type CampaignProgress,
  type CampaignStage,
} from './campaign';
import {
  emptyCpuMemory,
  pickCpuMove,
  rememberRevealed,
  styleFromOpponent,
  type CpuMemory,
} from './cpuAi';
import {
  buildDailyShareText,
  computeStreak,
  copyText,
  dailyConfig,
  dailySeedNumber,
  dateKey,
} from './daily';
import {
  PAIR_OPTIONS,
  THEME_OPTIONS,
  allMatched,
  analyzeMemoryState,
  buildDeck,
  clampPairCount,
  cpuCapacityFor,
  defaultAssistForMode,
  gridColsClass,
  gridGapClass,
  hintPairIndices,
  invalidateSwappedMemory,
  isMatchGroup,
  loadBestMoves,
  loadBestScore,
  loadBestSprintSec,
  loadBestTimeSec,
  loadVersusWins,
  nextCombo,
  saveBestMoves,
  saveBestScore,
  saveBestSprintSec,
  saveBestTimeSec,
  saveVersusWin,
  scoreForMatch,
  sprintLimitSec,
  swapTwoHiddenCardsWithMeta,
  versusPenaltyForMiss,
  versusPointsForMatch,
  type CpuDifficulty,
  type MemoryCard,
  type PairCount,
  type PlayMode,
  type ThemeId,
} from './memoryLogic';
import {
  OPPONENTS,
  isOpponentUnlocked,
  opponentById,
  type OpponentId,
} from './opponents';
import { createRng } from './rng';
import {
  loadDaily,
  loadRosterProgress,
  recordDaily,
  recordRosterWin,
  type DailyRecord,
  type RosterProgress,
} from './storage';
import {
  computeCognitiveRank,
  computeFeverState,
  computePhosphorCells,
  computeReactionStats,
  computeWorkingMemoryRetention,
  getBoardCols,
} from './brainTelemetry';
import { BrainTelemetryWing } from './BrainTelemetryWing';
import { FeverBanner } from './FeverBanner';
import { playFeverChord, playTactileFlip } from './feverAudio';
import { TactileCard } from './TactileCard';

const HINT_PEEK_MS = 900;
const INSIGHT_PEEK_MS = 1200;
const FLIP_RESOLVE_MATCH_MS = 480;
const FLIP_RESOLVE_MISS_MS = 780;
/** Delay after CPU thinks before revealing the first card. */
const CPU_THINK_MS: Record<CpuDifficulty, number> = {
  easy: 650,
  normal: 850,
  hard: 1050,
};
/** Gap between CPU's first and second flip so the turn is readable (not both-at-once). */
const CPU_SECOND_FLIP_MS = 420;
const TIPS_KEY = 'clubhouse-memory-match-tips';

type TurnOwner = 'player' | 'cpu';
type Screen = 'play' | 'campaign' | 'roster';

function loadTipsDismissed(): boolean {
  try {
    return localStorage.getItem(TIPS_KEY) === '1';
  } catch {
    return false;
  }
}

function saveTipsDismissed(): void {
  try {
    localStorage.setItem(TIPS_KEY, '1');
  } catch {
    /* ignore */
  }
}

function modeLabel(mode: PlayMode, sprintLimit: number): string {
  switch (mode) {
    case 'classic':
      return '經典';
    case 'sprint':
      return `衝刺 ${sprintLimit}s`;
    case 'versus':
      return '對戰';
    case 'special':
      return '洞察特牌';
    case 'deduction':
      return '邏輯推演';
    case 'daily':
      return '每日盤';
    case 'campaign':
      return '戰役';
    default:
      return mode;
  }
}

function HudCell({
  label,
  value,
  tone,
  span,
}: {
  label: string;
  value: ReactNode;
  tone?: 'hot' | 'good';
  span?: boolean;
}) {
  return (
    <div className={`mm-hud__cell${span ? ' mm-hud__span' : ''}`}>
      <span className="mm-hud__label">{label}</span>
      <span className={`mm-hud__value${tone === 'hot' ? ' is-hot' : ''}${tone === 'good' ? ' is-good' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function starGlyphs(n: number): string {
  return '★'.repeat(Math.max(0, Math.min(3, n))) + '☆'.repeat(Math.max(0, 3 - n));
}

function syncJuiceFxAttr(fx: 'off' | 'low' | 'full'): void {
  try {
    document.documentElement.setAttribute('data-juice-fx', fx);
  } catch {
    /* ignore */
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('play');
  const [themeId, setThemeId] = useState<ThemeId>('classic');
  const [pairCount, setPairCount] = useState<PairCount>(12);
  const [mode, setMode] = useState<PlayMode>('classic');
  const [cpuDifficulty, setCpuDifficulty] = useState<CpuDifficulty>('normal');
  const [opponentId, setOpponentId] = useState<OpponentId>('scatter');
  const [stageIndex, setStageIndex] = useState<number | null>(null);
  const [cards, setCards] = useState<MemoryCard[]>(() => buildDeck(12, 'classic'));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [locks, setLocks] = useState(false);
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [bestMoves, setBestMoves] = useState<number | null>(() => loadBestMoves(12, 'classic'));
  const [bestSprint, setBestSprint] = useState<number | null>(() => loadBestSprintSec(12, 'classic'));
  const [bestTime, setBestTime] = useState<number | null>(() => loadBestTimeSec(12, 'classic'));
  const [bestScore, setBestScore] = useState<number | null>(() =>
    loadBestScore('classic', 12, 'classic'),
  );
  const [versusWins, setVersusWins] = useState(() => loadVersusWins(12, 'classic', 'normal'));
  const [newRecord, setNewRecord] = useState(false);
  const [hintFlash, setHintFlash] = useState<number[]>([]);
  const [peekFlash, setPeekFlash] = useState<number[]>([]);
  const [peekCharges, setPeekCharges] = useState(0);
  const [peekArmed, setPeekArmed] = useState(false);
  const [scanCharges, setScanCharges] = useState(0);
  const [scanArmed, setScanArmed] = useState(false);
  const [shieldActive, setShieldActive] = useState(false);
  const [missPulse, setMissPulse] = useState<number[]>([]);
  const [matchPulse, setMatchPulse] = useState<number[]>([]);
  const [flashText, setFlashText] = useState('');
  const [flashKey, setFlashKey] = useState(0);
  const [flashTone, setFlashTone] = useState<'good' | 'bad' | 'neutral'>('good');
  const [turnOwner, setTurnOwner] = useState<TurnOwner>('player');
  const [playerPairs, setPlayerPairs] = useState(0);
  const [cpuPairs, setCpuPairs] = useState(0);
  const [playerVersusScore, setPlayerVersusScore] = useState(0);
  const [cpuVersusScore, setCpuVersusScore] = useState(0);
  const [playerVersusStreak, setPlayerVersusStreak] = useState(0);
  const [cpuVersusStreak, setCpuVersusStreak] = useState(0);
  const [versusGamble, setVersusGamble] = useState(false);
  const [versusOutcome, setVersusOutcome] = useState<'win' | 'lose' | 'draw' | null>(null);
  const [assistMode, setAssistMode] = useState<boolean>(() => defaultAssistForMode('classic'));
  const [runAssisted, setRunAssisted] = useState(false);
  const [cpuMemory, setCpuMemory] = useState<CpuMemory>(() => emptyCpuMemory());
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [showTip, setShowTip] = useState(() => !loadTipsDismissed());
  const [dailyRecords, setDailyRecords] = useState<DailyRecord[]>(() => loadDaily());
  const [campaign, setCampaign] = useState<CampaignProgress>(() => loadCampaignProgress());
  const [roster, setRoster] = useState<RosterProgress>(() => loadRosterProgress());
  const [lastStars, setLastStars] = useState<1 | 2 | 3 | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [flipNeed, setFlipNeed] = useState(2);
  const [timeLimitSec, setTimeLimitSec] = useState<number | null>(null);
  const [swapEverySec, setSwapEverySec] = useState<number | null>(null);
  const [bombPenaltySec, setBombPenaltySec] = useState(0);
  const [seenIndices, setSeenIndices] = useState<Set<number>>(() => new Set());
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [sightings, setSightings] = useState<Map<number, number>>(() => new Map());
  const [reactionSamples, setReactionSamples] = useState<number[]>([]);
  const [showMobileTelemetry, setShowMobileTelemetry] = useState(false);
  const [showLore, setShowLore] = useState(false);
  const lastActionTimeRef = useRef<number>(Date.now());

  const gridRef = useRef<HTMLDivElement | null>(null);
  const turnRef = useRef(0);
  const resolvingRef = useRef(false);
  const cpuScheduledRef = useRef(false);
  const cpuSecondFlipRef = useRef<number | null>(null);
  const playerPairsRef = useRef(0);
  const cpuPairsRef = useRef(0);
  const playerVersusScoreRef = useRef(0);
  const cpuVersusScoreRef = useRef(0);
  const playerVersusStreakRef = useRef(0);
  const cpuVersusStreakRef = useRef(0);
  const versusGambleRef = useRef(false);
  const runAssistedRef = useRef(false);
  const comboRef = useRef(0);
  const scoreRef = useRef(0);
  const movesRef = useRef(0);
  const endedRef = useRef(false);
  const elapsedRef = useRef(0);
  const pairCountRef = useRef(pairCount);
  pairCountRef.current = pairCount;
  const cardsRef = useRef(cards);
  cardsRef.current = cards;
  const flippedRef = useRef(flipped);
  flippedRef.current = flipped;

  const radar = useMemo(
    () => analyzeMemoryState(cards, seenIndices, moves, combo, flipNeed),
    [cards, seenIndices, moves, combo, flipNeed],
  );

  const feverState = useMemo(() => computeFeverState(combo), [combo]);
  const cols = useMemo(() => getBoardCols(cards.length), [cards.length]);

  const phosphorCells = useMemo(
    () =>
      computePhosphorCells(
        cards,
        sightings,
        turnRef.current,
        radar.knownReadyIndices,
        cols,
      ),
    [cards, sightings, radar.knownReadyIndices, cols],
  );

  const retentionPct = useMemo(
    () => computeWorkingMemoryRetention(phosphorCells),
    [phosphorCells],
  );

  const reactionStats = useMemo(
    () => computeReactionStats(reactionSamples),
    [reactionSamples],
  );

  const cognitiveRank = useMemo(
    () =>
      computeCognitiveRank(
        radar.accuracyPct,
        radar.comboLevel,
        retentionPct,
        radar.explorationPct,
      ),
    [radar.accuracyPct, radar.comboLevel, retentionPct, radar.explorationPct],
  );

  const today = dateKey();
  const streak = computeStreak(dailyRecords, today);
  const todayRecord = dailyRecords.find((r) => r.date === today) ?? null;
  const activeStage: CampaignStage | null =
    mode === 'campaign' && stageIndex != null ? CAMPAIGN_STAGES[stageIndex] ?? null : null;
  const activeOpponent = opponentById(opponentId);

  const showFlash = useCallback((text: string, tone: 'good' | 'bad' | 'neutral' = 'good') => {
    setFlashText(text);
    setFlashTone(tone);
    setFlashKey((k) => k + 1);
  }, []);

  const toggleAssistMode = useCallback(() => {
    setAssistMode((prev) => {
      const next = !prev;
      if (next) {
        runAssistedRef.current = true;
        setRunAssisted(true);
        showFlash('已開啟輔助提示（標記為輔助局）', 'neutral');
      } else {
        showFlash('已關閉輔助提示', 'neutral');
      }
      return next;
    });
  }, [showFlash]);

  const resetTransient = useCallback(() => {
    setFlipped([]);
    setLocks(false);
    setMoves(0);
    setElapsed(0);
    setWon(false);
    setLost(false);
    setCombo(0);
    setScore(0);
    setNewRecord(false);
    setHintFlash([]);
    setPeekFlash([]);
    setPeekCharges(0);
    setPeekArmed(false);
    setScanCharges(0);
    setScanArmed(false);
    setShieldActive(false);
    setMissPulse([]);
    setMatchPulse([]);
    setFlashText('');
    setTurnOwner('player');
    setPlayerPairs(0);
    setCpuPairs(0);
    setPlayerVersusScore(0);
    setCpuVersusScore(0);
    setPlayerVersusStreak(0);
    setCpuVersusStreak(0);
    setVersusGamble(false);
    setVersusOutcome(null);
    setCpuMemory(emptyCpuMemory());
    setLastStars(null);
    setShareCopied(false);
    setSeenIndices(new Set());
    setSightings(new Map());
    setReactionSamples([]);
    setShowMobileTelemetry(false);
    lastActionTimeRef.current = performance.now();
    setFocusedIndex(null);
    turnRef.current = 0;
    resolvingRef.current = false;
    cpuScheduledRef.current = false;
    if (cpuSecondFlipRef.current != null) {
      window.clearTimeout(cpuSecondFlipRef.current);
      cpuSecondFlipRef.current = null;
    }
    playerPairsRef.current = 0;
    cpuPairsRef.current = 0;
    playerVersusScoreRef.current = 0;
    cpuVersusScoreRef.current = 0;
    playerVersusStreakRef.current = 0;
    cpuVersusStreakRef.current = 0;
    versusGambleRef.current = false;
    comboRef.current = 0;
    scoreRef.current = 0;
    movesRef.current = 0;
    endedRef.current = false;
    elapsedRef.current = 0;
  }, []);

  const beginBoard = useCallback(
    (opts: {
      nextMode: PlayMode;
      nextTheme: ThemeId;
      faceCount: number;
      nextCpu?: CpuDifficulty;
      nextOpponent?: OpponentId;
      nextStageIndex?: number | null;
      rand?: () => number;
      deckOptions?: Parameters<typeof buildDeck>[3];
      timeLimit?: number | null;
      swapEvery?: number | null;
      bombPenalty?: number;
      flips?: number;
    }) => {
      const nextCpu = opts.nextCpu ?? cpuDifficulty;
      const nextOpp = opts.nextOpponent ?? opponentId;
      const opp = opponentById(nextOpp);
      const displayCount = clampPairCount(
        opts.nextTheme,
        nearestPairCount(opts.faceCount),
      );

      setScreen('play');
      setThemeId(opts.nextTheme);
      setPairCount(displayCount);
      setMode(opts.nextMode);
      setCpuDifficulty(opts.nextMode === 'versus' ? opp.difficulty : nextCpu);
      setOpponentId(nextOpp);
      setStageIndex(opts.nextStageIndex ?? null);
      setFlipNeed(opts.flips ?? 2);
      setTimeLimitSec(opts.timeLimit ?? null);
      setSwapEverySec(opts.swapEvery ?? null);
      setBombPenaltySec(opts.bombPenalty ?? 0);
      setCards(
        buildDeck(opts.faceCount, opts.nextTheme, opts.rand ?? Math.random, opts.deckOptions ?? {}),
      );
      const nextAssist = defaultAssistForMode(opts.nextMode);
      setAssistMode(nextAssist);
      setRunAssisted(nextAssist);
      runAssistedRef.current = nextAssist;
      resetTransient();
      const freeMode: PlayMode =
        opts.nextMode === 'special'
          ? 'special'
          : opts.nextMode === 'deduction'
            ? 'deduction'
            : opts.nextMode === 'sprint'
              ? 'sprint'
              : 'classic';
      setBestMoves(
        loadBestMoves(displayCount, opts.nextTheme, freeMode === 'special' ? 'special' : 'classic'),
      );
      setBestSprint(loadBestSprintSec(displayCount, opts.nextTheme));
      setBestTime(
        loadBestTimeSec(displayCount, opts.nextTheme, freeMode === 'special' ? 'special' : 'classic'),
      );
      setBestScore(
        loadBestScore(opts.nextMode === 'versus' ? 'classic' : freeMode, displayCount, opts.nextTheme),
      );
      setVersusWins(loadVersusWins(displayCount, opts.nextTheme, opp.difficulty));
    },
    [cpuDifficulty, opponentId, resetTransient],
  );

  const restart = useCallback(
    (
      count: PairCount = pairCount,
      nextMode: PlayMode = mode,
      nextTheme: ThemeId = themeId,
      nextCpu: CpuDifficulty = cpuDifficulty,
    ) => {
      if (nextMode === 'daily') {
        const cfg = dailyConfig(today);
        beginBoard({
          nextMode: 'daily',
          nextTheme: cfg.themeId,
          faceCount: cfg.pairCount,
          rand: createRng(dailySeedNumber(today)),
          timeLimit: null,
          flips: 2,
        });
        return;
      }
      if (nextMode === 'campaign' && stageIndex != null) {
        const stage = CAMPAIGN_STAGES[stageIndex];
        if (stage) {
          beginBoard({
            nextMode: 'campaign',
            nextTheme: stage.themeId,
            faceCount: stage.faceCount,
            nextStageIndex: stageIndex,
            rand: createRng(stageSeed(stage)),
            deckOptions: {
              copiesPerFace: copiesPerFace(stage),
              bombPair: stage.mechanic === 'bomb',
            },
            timeLimit: stage.timeLimitSec,
            swapEvery: stage.mechanic === 'swap' ? (stage.swapEverySec ?? 9) : null,
            bombPenalty: stage.bombPenaltySec ?? 0,
            flips: stageFlipTarget(stage),
          });
          return;
        }
      }
      beginBoard({
        nextMode,
        nextTheme,
        faceCount: count,
        nextCpu,
        deckOptions: {
          specialTactical: nextMode === 'special',
          specialInsight: nextMode === 'special',
          deductionMode: nextMode === 'deduction',
        },
        timeLimit: nextMode === 'sprint' ? sprintLimitSec(count) : null,
        flips: 2,
      });
    },
    [pairCount, mode, themeId, cpuDifficulty, stageIndex, today, beginBoard],
  );

  const startDaily = useCallback(() => {
    const cfg = dailyConfig(today);
    beginBoard({
      nextMode: 'daily',
      nextTheme: cfg.themeId,
      faceCount: cfg.pairCount,
      rand: createRng(dailySeedNumber(today)),
      flips: 2,
    });
  }, [today, beginBoard]);

  const startCampaignStage = useCallback(
    (index: number) => {
      const stage = CAMPAIGN_STAGES[index];
      if (!stage || !isStageUnlocked(index, campaign)) return;
      beginBoard({
        nextMode: 'campaign',
        nextTheme: stage.themeId,
        faceCount: stage.faceCount,
        nextStageIndex: index,
        rand: createRng(stageSeed(stage)),
        deckOptions: {
          copiesPerFace: copiesPerFace(stage),
          bombPair: stage.mechanic === 'bomb',
        },
        timeLimit: stage.timeLimitSec,
        swapEvery: stage.mechanic === 'swap' ? (stage.swapEverySec ?? 9) : null,
        bombPenalty: stage.bombPenaltySec ?? 0,
        flips: stageFlipTarget(stage),
      });
    },
    [campaign, beginBoard],
  );

  const startVersusOpponent = useCallback(
    (id: OpponentId) => {
      const index = OPPONENTS.findIndex((o) => o.id === id);
      if (!isOpponentUnlocked(index, roster.unlockedIndex)) return;
      const opp = opponentById(id);
      beginBoard({
        nextMode: 'versus',
        nextTheme: themeId,
        faceCount: pairCount,
        nextOpponent: id,
        nextCpu: opp.difficulty,
        flips: 2,
      });
    },
    [roster.unlockedIndex, themeId, pairCount, beginBoard],
  );

  useEffect(() => {
    syncJuiceFxAttr(loadJuiceSettings().fx);
    return subscribeJuiceSettings((settings) => syncJuiceFxAttr(settings.fx));
  }, []);

  useEffect(() => {
    if (won || lost || versusOutcome) return;
    const id = window.setInterval(() => {
      elapsedRef.current += 1;
      setElapsed(elapsedRef.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [won, lost, versusOutcome, cards]);

  useEffect(() => {
    if (won || lost || versusOutcome) return;
    const limit =
      timeLimitSec != null
        ? timeLimitSec
        : mode === 'sprint'
          ? sprintLimitSec(pairCount)
          : null;
    if (limit != null && elapsed >= limit) {
      setLost(true);
      playLose();
    }
  }, [elapsed, mode, pairCount, won, lost, versusOutcome, timeLimitSec]);

  // Campaign swap mechanic — periodically swap two face-down cards and invalidate stale memory sightings.
  useEffect(() => {
    if (mode !== 'campaign' || swapEverySec == null) return;
    if (won || lost) return;
    const id = window.setInterval(() => {
      if (endedRef.current || resolvingRef.current) return;
      if (flippedRef.current.length > 0) return;
      const { cards: nextCards, swapped } = swapTwoHiddenCardsWithMeta(
        cardsRef.current,
        flippedRef.current,
        Math.random,
      );
      if (!swapped) return;
      setCards(nextCards);
      setSeenIndices((prev) => invalidateSwappedMemory(prev, new Map(), swapped).seenIndices);
      setSightings((prev) => invalidateSwappedMemory(new Set(), prev, swapped).sightings);
      showFlash('牌位互換！', 'neutral');
    }, swapEverySec * 1000);
    return () => window.clearInterval(id);
  }, [mode, swapEverySec, won, lost, showFlash]);

  useEffect(() => {
    if ((flipped.length > 0 || moves > 0) && settingsOpen) setSettingsOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- collapse on first interaction only
  }, [flipped.length, moves]);

  useEffect(() => {
    if (hintFlash.length === 0) return;
    const t = window.setTimeout(() => setHintFlash([]), HINT_PEEK_MS);
    return () => window.clearTimeout(t);
  }, [hintFlash]);

  useEffect(() => {
    if (peekFlash.length === 0) return;
    const t = window.setTimeout(() => setPeekFlash([]), INSIGHT_PEEK_MS);
    return () => window.clearTimeout(t);
  }, [peekFlash]);

  useEffect(() => {
    if (missPulse.length === 0) return;
    const t = window.setTimeout(() => setMissPulse([]), 450);
    return () => window.clearTimeout(t);
  }, [missPulse]);

  useEffect(() => {
    if (matchPulse.length === 0) return;
    const t = window.setTimeout(() => setMatchPulse([]), 520);
    return () => window.clearTimeout(t);
  }, [matchPulse]);

  const finishSoloWin = useCallback(
    (finalMoves: number, finalScore: number, finalElapsed: number) => {
      setWon(true);
      playWin();
      const assisted = runAssistedRef.current;
      let record = false;

      if (mode === 'daily') {
        const next = recordDaily({
          date: today,
          moves: finalMoves,
          elapsedSec: finalElapsed,
          score: finalScore,
          pairCount,
          assisted,
        });
        setDailyRecords(next);
        const prev = todayRecord;
        record =
          !assisted &&
          (!prev ||
            Boolean(prev.assisted) ||
            finalMoves < prev.moves ||
            (finalMoves === prev.moves && finalElapsed < prev.elapsedSec));
        setNewRecord(record);
        return;
      }

      if (mode === 'campaign' && stageIndex != null) {
        const stage = CAMPAIGN_STAGES[stageIndex];
        const earned = stage ? starsEarned(stage, finalMoves, finalElapsed) : 1;
        setLastStars(earned);
        if (!assisted) {
          const next = clearStageAndPersist(stageIndex, finalMoves, finalElapsed);
          setCampaign(next);
          setNewRecord(earned >= (campaign.stars[stage?.id ?? ''] ?? 0));
        } else {
          setNewRecord(false);
        }
        return;
      }

      if (assisted) {
        setNewRecord(false);
        return;
      }

      if (mode === 'sprint') {
        const saved = saveBestSprintSec(pairCount, finalElapsed, themeId);
        setBestSprint(saved);
        record = saved === finalElapsed;
      } else {
        const movesMode: PlayMode = mode === 'special' ? 'special' : mode === 'deduction' ? 'deduction' : 'classic';
        const savedMoves = saveBestMoves(pairCount, finalMoves, themeId, movesMode);
        setBestMoves(savedMoves);
        if (savedMoves === finalMoves) record = true;
        const savedTime = saveBestTimeSec(pairCount, finalElapsed, themeId, movesMode);
        setBestTime(savedTime);
        if (savedTime === finalElapsed) record = true;
      }
      const scoreMode: PlayMode =
        mode === 'versus' || mode === 'campaign'
          ? 'classic'
          : mode === 'special'
            ? 'special'
            : mode === 'deduction'
              ? 'deduction'
              : mode === 'sprint'
                ? 'sprint'
                : 'classic';
      const savedScore = saveBestScore(scoreMode, pairCount, finalScore, themeId);
      setBestScore(savedScore);
      if (savedScore === finalScore) record = true;
      setNewRecord(record);
    },
    [mode, pairCount, themeId, today, todayRecord, stageIndex, campaign.stars],
  );

  const finishVersus = useCallback(
    (pPairs: number, cPairs: number, pScore: number, cScore: number) => {
      let outcome: 'win' | 'lose' | 'draw';
      if (pScore !== cScore) outcome = pScore > cScore ? 'win' : 'lose';
      else if (pPairs !== cPairs) outcome = pPairs > cPairs ? 'win' : 'lose';
      else outcome = 'draw';
      setVersusOutcome(outcome);
      const assisted = runAssistedRef.current;
      if (outcome === 'win') {
        playWin();
        if (!assisted) {
          const wins = saveVersusWin(pairCount, themeId, cpuDifficulty);
          setVersusWins(wins);
          const oppIndex = OPPONENTS.findIndex((o) => o.id === opponentId);
          const nextRoster = recordRosterWin(opponentId, Math.max(0, oppIndex));
          setRoster(nextRoster);
          setNewRecord(true);
        } else {
          setNewRecord(false);
        }
      } else if (outcome === 'lose') {
        playLose();
      } else {
        playMove();
      }
    },
    [pairCount, themeId, cpuDifficulty, opponentId],
  );

  // Resolve a completed flip group (pair or triple).
  useEffect(() => {
    if (flipped.length !== flipNeed || resolvingRef.current) return;
    resolvingRef.current = true;
    const indices = flipped.slice();
    const match = isMatchGroup(cards, indices);
    const actor = mode === 'versus' ? turnOwner : 'player';
    setLocks(true);
    movesRef.current += 1;
    setMoves(movesRef.current);
    turnRef.current += 1;
    const turn = turnRef.current;

    setCpuMemory((mem) =>
      rememberRevealed(mem, cards, indices, turn, cpuDifficulty, pairCountRef.current),
    );

    const delay = match ? FLIP_RESOLVE_MATCH_MS : FLIP_RESOLVE_MISS_MS;
    const t = window.setTimeout(() => {
      let nextCards = cards;
      if (match) {
        playScore();
        const newCombo = nextCombo(comboRef.current, true);
        if (newCombo >= 2) {
          playCapture();
          playFeverChord(newCombo);
        }
        // Juice: match → success+sparkle; combo match → combo+sparkle
        haptic(newCombo >= 2 ? 'combo' : 'success');
        particles(newCombo >= 3 ? 'confetti' : 'sparkle', {
          el: gridRef.current,
          strength: newCombo >= 3 ? 1.2 : 0.8,
        });
        shake(gridRef.current, newCombo >= 3 ? 0.45 : 0.25);
        setMatchPulse(indices);
        const gained = scoreForMatch(newCombo);
        comboRef.current = newCombo;
        scoreRef.current += gained;
        setCombo(newCombo);
        setScore(scoreRef.current);
        if (newCombo >= 3) showFlash(`🔥 狂熱超頻 ×${newCombo}！+${gained}`, 'good');
        else if (newCombo === 2) showFlash(`⚡ 突觸共振 ×2！+${gained}`, 'good');
        else showFlash(`配對 +${gained}`, 'good');

        const matchedSet = new Set(indices);
        nextCards = cards.map((c, i) => (matchedSet.has(i) ? { ...c, matched: true } : c));
        setCards(nextCards);

        if (mode === 'versus') {
          if (actor === 'player') {
            playerPairsRef.current += 1;
            setPlayerPairs(playerPairsRef.current);
            playerVersusStreakRef.current += 1;
            setPlayerVersusStreak(playerVersusStreakRef.current);
            const gambled = versusGambleRef.current;
            versusGambleRef.current = false;
            setVersusGamble(false);
            const vs = versusPointsForMatch(playerVersusStreakRef.current, gambled);
            playerVersusScoreRef.current += vs.points;
            setPlayerVersusScore(playerVersusScoreRef.current);
            if (vs.doubled) {
              showFlash(`🎲 豪賭命中！+${vs.points} 對戰分`, 'good');
            } else if (vs.streakBonus > 0) {
              showFlash(`⚡ 連擊奪分 +${vs.points}（含連擊 +1）`, 'good');
            }
          } else {
            cpuPairsRef.current += 1;
            setCpuPairs(cpuPairsRef.current);
            cpuVersusStreakRef.current += 1;
            setCpuVersusStreak(cpuVersusStreakRef.current);
            const vs = versusPointsForMatch(cpuVersusStreakRef.current, false);
            cpuVersusScoreRef.current += vs.points;
            setCpuVersusScore(cpuVersusScoreRef.current);
          }
        } else if (mode === 'special') {
          const kind = cards[indices[0]]?.kind;
          if (kind === 'insight') {
            setPeekCharges((c) => c + 1);
            showFlash('獲得洞察！', 'neutral');
          } else if (kind === 'scan') {
            setScanCharges((c) => c + 1);
            showFlash('獲得橫列掃描！', 'good');
          } else if (kind === 'shield') {
            setShieldActive(true);
            showFlash('獲得防護盾！抵擋下次失誤懲罰', 'good');
          }
        }
      } else {
        playError();
        // Juice: miss → error haptic; soft shake only (cards already CSS-pulse)
        haptic('error');
        shake(gridRef.current, 0.28);
        setMissPulse(indices);
        let versusMissFlashed = false;
        if (shieldActive && actor === 'player') {
          setShieldActive(false);
          showFlash('🛡️ 防護盾吸收了失誤懲罰！', 'good');
          versusMissFlashed = true;
          if (mode === 'versus') {
            versusGambleRef.current = false;
            setVersusGamble(false);
            setTurnOwner('cpu');
          }
        } else {
          comboRef.current = 0;
          setCombo(0);
          const hitBomb = indices.some((i) => cards[i].kind === 'bomb');
          if (mode === 'versus') {
            if (actor === 'player') {
              playerVersusStreakRef.current = 0;
              setPlayerVersusStreak(0);
              const gambled = versusGambleRef.current;
              versusGambleRef.current = false;
              setVersusGamble(false);
              const penalty = versusPenaltyForMiss(gambled);
              if (penalty > 0) {
                cpuVersusScoreRef.current += penalty;
                setCpuVersusScore(cpuVersusScoreRef.current);
                showFlash(`🎲 豪賭失手！對手 +${penalty} 分`, 'bad');
                versusMissFlashed = true;
              }
            } else {
              cpuVersusStreakRef.current = 0;
              setCpuVersusStreak(0);
            }
            setTurnOwner(actor === 'player' ? 'cpu' : 'player');
          }
          if (!versusMissFlashed) {
            if (hitBomb && bombPenaltySec > 0) {
              elapsedRef.current += bombPenaltySec;
              setElapsed(elapsedRef.current);
              showFlash(`炸彈罰時 +${bombPenaltySec}s`, 'bad');
            } else {
              showFlash('未中', 'bad');
            }
          }
        }
      }
      setFlipped([]);
      setLocks(false);
      lastActionTimeRef.current = performance.now();
      resolvingRef.current = false;
      cpuScheduledRef.current = false;

      if (!endedRef.current && allMatched(nextCards)) {
        endedRef.current = true;
        // Juice: clear board → confetti + shake grid
        particles('confetti', { el: gridRef.current, strength: 1.1 });
        shake(gridRef.current, 0.95);
        if (mode === 'versus') {
          finishVersus(
            playerPairsRef.current,
            cpuPairsRef.current,
            playerVersusScoreRef.current,
            cpuVersusScoreRef.current,
          );
        } else {
          finishSoloWin(movesRef.current, scoreRef.current, elapsedRef.current);
        }
      }
    }, delay);

    return () => {
      window.clearTimeout(t);
      resolvingRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolve once per flip group
  }, [flipped, flipNeed]);

  // CPU turn scheduler — flips one card, then the second, so the turn is human-readable.
  useEffect(() => {
    if (mode !== 'versus') return;
    if (versusOutcome || won || lost) return;
    if (turnOwner !== 'cpu') return;
    if (locks || flipped.length > 0) return;
    if (allMatched(cards)) return;
    if (cpuScheduledRef.current) return;
    cpuScheduledRef.current = true;

    const preferStall = playerPairs >= cpuPairs + 2;
    const styleOpts = styleFromOpponent(activeOpponent);
    const think = window.setTimeout(() => {
      try {
        const [i, j] = pickCpuMove({
          cards,
          memory: cpuMemory,
          turn: turnRef.current,
          preferStall,
          ...styleOpts,
        });
        playCard();
        playTactileFlip();
        haptic('tap');
        setFlipped([i]);
        setSeenIndices((prev) => {
          const next = new Set(prev);
          next.add(i);
          return next;
        });
        setSightings((prev) => {
          const next = new Map(prev);
          next.set(i, turnRef.current);
          return next;
        });
        if (cpuSecondFlipRef.current != null) {
          window.clearTimeout(cpuSecondFlipRef.current);
        }
        cpuSecondFlipRef.current = window.setTimeout(() => {
          cpuSecondFlipRef.current = null;
          playCard();
          playTactileFlip();
          haptic('tap');
          setFlipped([i, j]);
          setSeenIndices((prev) => {
            const next = new Set(prev);
            next.add(j);
            return next;
          });
          setSightings((prev) => {
            const next = new Map(prev);
            next.set(j, turnRef.current);
            return next;
          });
        }, CPU_SECOND_FLIP_MS);
      } catch {
        cpuScheduledRef.current = false;
        setTurnOwner('player');
      }
    }, CPU_THINK_MS[styleOpts.difficulty]);

    return () => {
      window.clearTimeout(think);
    };
  }, [
    mode,
    turnOwner,
    locks,
    flipped.length,
    cards,
    cpuMemory,
    playerPairs,
    cpuPairs,
    versusOutcome,
    won,
    lost,
    activeOpponent,
  ]);

  const onCard = (index: number) => {
    if (locks || won || lost || versusOutcome) return;
    if (hintFlash.length > 0 || peekFlash.length > 0) return;
    if (mode === 'versus' && turnOwner !== 'player') return;

    // Track decision reaction time for human player
    const now = performance.now();
    if (lastActionTimeRef.current > 0) {
      const delta = Math.round(now - lastActionTimeRef.current);
      if (delta >= 120 && delta <= 30000) {
        setReactionSamples((prev) => [...prev.slice(-15), delta]);
      }
    }
    lastActionTimeRef.current = now;

    if (scanArmed && mode === 'special') {
      const card = cards[index];
      if (card.matched) return;
      setScanArmed(false);
      setScanCharges((c) => Math.max(0, c - 1));
      const cols = getBoardCols(cards.length);
      const row = Math.floor(index / cols);
      const rowIndices: number[] = [];
      for (let c = 0; c < cols; c++) {
        const idx = row * cols + c;
        if (idx < cards.length && !cards[idx].matched) rowIndices.push(idx);
      }
      setPeekFlash(rowIndices);
      setSeenIndices((prev) => {
        const next = new Set(prev);
        for (const idx of rowIndices) next.add(idx);
        return next;
      });
      setSightings((prev) => {
        const next = new Map(prev);
        for (const idx of rowIndices) next.set(idx, turnRef.current);
        return next;
      });
      setCpuMemory((mem) =>
        rememberRevealed(mem, cards, rowIndices, turnRef.current, cpuDifficulty, pairCount),
      );
      playMove();
      showFlash('橫列掃描完畢！', 'good');
      return;
    }

    if (peekArmed && mode === 'special') {
      const card = cards[index];
      if (card.matched) return;
      setPeekArmed(false);
      setPeekCharges((c) => Math.max(0, c - 1));
      setPeekFlash([index]);
      setSeenIndices((prev) => {
        const next = new Set(prev);
        next.add(index);
        return next;
      });
      setSightings((prev) => {
        const next = new Map(prev);
        next.set(index, turnRef.current);
        return next;
      });
      setCpuMemory((mem) =>
        rememberRevealed(mem, cards, [index], turnRef.current, cpuDifficulty, pairCount),
      );
      playMove();
      showFlash('洞察窺視', 'neutral');
      return;
    }

    const card = cards[index];
    if (card.matched || flipped.includes(index)) return;
    if (flipped.length >= flipNeed) return;
    playCard();
    playTactileFlip();
    haptic('tap');
    setFlipped((f) => [...f, index]);
    setSeenIndices((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    setSightings((prev) => {
      const next = new Map(prev);
      next.set(index, turnRef.current);
      return next;
    });
  };

  const handleHint = () => {
    if (mode === 'versus') return;
    if (locks || won || lost || flipped.length > 0 || hintFlash.length > 0) return;
    const group = hintPairIndices(cards, flipNeed);
    if (!group) return;
    setHintFlash(group);
    setSeenIndices((prev) => {
      const next = new Set(prev);
      for (const g of group) next.add(g);
      return next;
    });
    setSightings((prev) => {
      const next = new Map(prev);
      for (const g of group) next.set(g, turnRef.current);
      return next;
    });
    setCpuMemory((mem) =>
      rememberRevealed(mem, cards, group, turnRef.current, cpuDifficulty, pairCount),
    );
    playMove();
  };

  const armPeek = () => {
    if (mode !== 'special' || peekCharges <= 0 || peekArmed) return;
    if (locks || won || lost || flipped.length > 0) return;
    setPeekArmed(true);
    setScanArmed(false);
    playMove();
    showFlash('點選一張牌窺視', 'neutral');
  };

  const armScan = () => {
    if (mode !== 'special' || scanCharges <= 0 || scanArmed) return;
    if (locks || won || lost || flipped.length > 0) return;
    setScanArmed(true);
    setPeekArmed(false);
    playMove();
    showFlash('點選任意牌以掃描整列', 'neutral');
  };

  const handleShareDaily = async () => {
    const rec = dailyRecords.find((r) => r.date === today);
    if (!rec) return;
    const themeLabel = THEME_OPTIONS.find((t) => t.id === dailyConfig(today).themeId)?.label ?? '';
    const text = buildDailyShareText({
      date: today,
      moves: rec.moves,
      elapsedSec: rec.elapsedSec,
      streak: computeStreak(dailyRecords, today),
      pairCount: rec.pairCount,
      themeLabel,
      assisted: rec.assisted,
    });
    const ok = await copyText(text);
    setShareCopied(ok);
    showFlash(ok ? '已複製分享文案' : '複製失敗', ok ? 'good' : 'bad');
  };

  const themeMax = THEME_OPTIONS.find((t) => t.id === themeId)?.faces.length ?? 24;
  const pairChoices = PAIR_OPTIONS.filter(({ count }) => count <= themeMax);
  const sprintLimit = sprintLimitSec(pairCount);
  const effectiveLimit =
    timeLimitSec != null ? timeLimitSec : mode === 'sprint' ? sprintLimit : null;
  const remain = effectiveLimit != null ? Math.max(0, effectiveLimit - elapsed) : null;
  const canHint =
    mode !== 'versus' &&
    !locks &&
    !won &&
    !lost &&
    flipped.length === 0 &&
    hintFlash.length === 0;
  const themeLabel = THEME_OPTIONS.find((t) => t.id === themeId)?.label ?? themeId;
  const faceLike = Math.ceil(cards.length / flipNeed);
  const boardWide =
    faceLike >= 18
      ? 'w-[min(96vw,720px)]'
      : faceLike >= 12
        ? 'w-[min(94vw,560px)]'
        : 'w-[min(94vw,440px)]';

  const overlayOpen = won || lost || versusOutcome !== null;

  const dismissTip = () => {
    setShowTip(false);
    saveTipsDismissed();
  };

  const settingsSummary = [
    themeLabel,
    mode === 'campaign' && activeStage
      ? activeStage.name
      : mode === 'daily'
        ? `每日 ${today}`
        : `${faceLike} ${flipNeed === 3 ? '組' : '對'}`,
    modeLabel(mode, sprintLimit),
    mode === 'versus' ? activeOpponent.name : '',
  ]
    .filter(Boolean)
    .join(' · ');

  useEffect(() => {
    if (screen !== 'play') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      // Preserve browser shortcuts and native form/button keyboard controls.
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.defaultPrevented) return;
      const target = e.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if ((e.key === 'Enter' || e.key === ' ') && target?.closest('button, a, [role="button"]')) return;
      const key = e.key;

      if ((overlayOpen && (won || lost)) || versusOutcome) {
        if (key === ' ' || key === 'Enter' || key === 'r' || key === 'R') {
          e.preventDefault();
          if (versusOutcome) {
            if (versusOutcome === 'win') {
              const idx = OPPONENTS.findIndex((o) => o.id === opponentId);
              const next = OPPONENTS[idx + 1];
              if (next && isOpponentUnlocked(idx + 1, roster.unlockedIndex)) {
                startVersusOpponent(next.id);
                return;
              }
            }
            restart();
            return;
          }
          if (mode === 'campaign' && stageIndex != null && won) {
            const next = stageIndex + 1;
            if (next < CAMPAIGN_STAGES.length && isStageUnlocked(next, campaign)) {
              startCampaignStage(next);
              return;
            }
            setScreen('campaign');
            return;
          }
          restart();
          return;
        }
      }

      if (key === 'h' || key === 'H') {
        if (canHint) {
          e.preventDefault();
          handleHint();
        }
        return;
      }
      if (key === 'p' || key === 'P') {
        if (mode === 'special' && peekCharges > 0 && !peekArmed) {
          e.preventDefault();
          armPeek();
        }
        return;
      }
      if (key === 's' || key === 'S') {
        if (mode === 'special' && scanCharges > 0 && !scanArmed) {
          e.preventDefault();
          armScan();
        }
        return;
      }
      if (key === 'r' || key === 'R') {
        e.preventDefault();
        restart();
        return;
      }

      if (mode !== 'daily' && mode !== 'campaign') {
        if (key === '1') {
          e.preventDefault();
          restart(6, mode, themeId, cpuDifficulty);
          return;
        }
        if (key === '2') {
          e.preventDefault();
          restart(12, mode, themeId, cpuDifficulty);
          return;
        }
        if (key === '3') {
          e.preventDefault();
          restart(18, mode, themeId, cpuDifficulty);
          return;
        }
        if (key === '4') {
          e.preventDefault();
          restart(24, mode, themeId, cpuDifficulty);
          return;
        }
      }

      const total = cards.length;
      if (total === 0) return;

      let cols = 4;
      if (gridRef.current) {
        const gridComputed = window.getComputedStyle(gridRef.current);
        const colTemplate = gridComputed.getPropertyValue('grid-template-columns');
        const countCols = colTemplate.split(' ').filter(Boolean).length;
        if (countCols > 0) cols = countCols;
      }

      let nextIndex = focusedIndex ?? 0;
      if (key === 'ArrowLeft' || key === 'a' || key === 'A') {
        e.preventDefault();
        nextIndex = (nextIndex - 1 + total) % total;
        setFocusedIndex(nextIndex);
      } else if (key === 'ArrowRight' || key === 'd' || key === 'D') {
        e.preventDefault();
        nextIndex = (nextIndex + 1) % total;
        setFocusedIndex(nextIndex);
      } else if (key === 'ArrowUp' || key === 'w' || key === 'W') {
        e.preventDefault();
        nextIndex = (nextIndex - cols + total) % total;
        setFocusedIndex(nextIndex);
      } else if (key === 'ArrowDown' || key === 's' || key === 'S') {
        e.preventDefault();
        nextIndex = (nextIndex + cols) % total;
        setFocusedIndex(nextIndex);
      } else if (key === 'Enter' || key === ' ') {
        e.preventDefault();
        if (focusedIndex !== null && focusedIndex >= 0 && focusedIndex < total) {
          onCard(focusedIndex);
        } else if (total > 0) {
          setFocusedIndex(0);
          onCard(0);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    screen,
    cards.length,
    focusedIndex,
    canHint,
    mode,
    peekCharges,
    peekArmed,
    locks,
    won,
    lost,
    restart,
    themeId,
    cpuDifficulty,
    overlayOpen,
    versusOutcome,
    opponentId,
    roster,
    stageIndex,
    campaign,
    startCampaignStage,
    startVersusOpponent,
  ]);

  if (screen === 'campaign') {
    return (
      <div
        className="mm-shell flex flex-col items-center p-3 sm:p-4 gap-3"
        style={shellBg()}
      >
        <BackToMenu onBackToTitle={() => setScreen('play')} />
        <h1 className="mm-title">短戰役</h1>
        <p className="mm-title-sub">Campaign</p>
        <p className="mm-meta max-w-md text-sm !text-slate-300">
          逐關解鎖機制；星數開啟下一章（第二章需 {CHAPTER_STAR_GATES[2]} 星，第三章需{' '}
          {CHAPTER_STAR_GATES[3]} 星）。
        </p>
        {([1, 2, 3] as const).map((chapter) => {
          const unlocked = isChapterUnlocked(chapter, campaign);
          const chStars = totalStarsInChapter(campaign, chapter);
          return (
            <section key={chapter} className="w-full max-w-xl flex flex-col gap-2">
              <h2 className="text-base font-bold tracking-wide text-cyan-100">
                第 {chapter} 章
                {!unlocked ? ' · 未解鎖' : ` · ${chStars} 星`}
              </h2>
              <div className="flex flex-col gap-2">
                {CAMPAIGN_STAGES.map((stage, i) => {
                  if (stage.chapter !== chapter) return null;
                  const open = isStageUnlocked(i, campaign);
                  const stars = campaign.stars[stage.id] ?? 0;
                  return (
                    <button
                      key={stage.id}
                      type="button"
                      disabled={!open}
                      onClick={() => startCampaignStage(i)}
                      className="mm-list-card"
                    >
                      <div className="flex justify-between gap-2 items-baseline">
                        <span className="font-bold text-cyan-50">
                          {stage.name}
                        </span>
                        <span className="text-amber-300 text-sm tracking-widest" aria-label={`${stars} 星`}>
                          {starGlyphs(stars)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{stage.blurb}</p>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        <div className="mm-actions">
          <button
            type="button"
            onClick={() => startCampaignStage(continueStageIndex(campaign))}
            className="mm-btn mm-btn--primary"
          >
            繼續挑戰
          </button>
          <button type="button" onClick={() => setScreen('play')} className="mm-btn mm-btn--ghost">
            返回
          </button>
        </div>
        {showLore && (
          <OriginLoreModal dossier={MEMORY_MATCH_LORE} onClose={() => setShowLore(false)} />
        )}
      </div>
    );
  }

  if (screen === 'roster') {
    return (
      <div
        className="mm-shell flex flex-col items-center p-3 sm:p-4 gap-3"
        style={shellBg()}
      >
        <BackToMenu onBackToTitle={() => setScreen('play')} />
        <h1 className="mm-title">CPU 名冊</h1>
        <p className="mm-title-sub">Roster</p>
        <p className="mm-meta max-w-md text-sm !text-slate-300">
          每位對手打法不同。打贏可解鎖下一位。
        </p>
        <div className="w-full max-w-xl flex flex-col gap-2">
          {OPPONENTS.map((opp, i) => {
            const open = isOpponentUnlocked(i, roster.unlockedIndex);
            const wins = roster.wins[opp.id] ?? 0;
            return (
              <button
                key={opp.id}
                type="button"
                disabled={!open}
                onClick={() => startVersusOpponent(opp.id)}
                className="mm-list-card is-roster"
              >
                <div className="flex justify-between gap-2">
                  <span className="font-bold text-cyan-50">
                    {opp.name}
                    {!open ? ' · 未解鎖' : ''}
                  </span>
                  <span className="text-xs text-slate-400">{opp.tagline}</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">{opp.blurb}</p>
                {wins > 0 && <p className="text-xs text-teal-300 mt-1">勝場 {wins}</p>}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => setScreen('play')} className="mm-btn mm-btn--ghost">
          返回
        </button>
      </div>
    );
  }

  const hudCells = (() => {
    if (mode === 'versus') {
      return (
        <>
          <HudCell label="牌組" value={themeLabel} span />
          <HudCell label="你" value={`${playerVersusScore}分 (${playerPairs}對)`} tone="good" />
          <HudCell
            label={activeOpponent.name}
            value={`${cpuVersusScore}分 (${cpuPairs}對)`}
            tone="hot"
          />
          <HudCell
            label="回合"
            value={
              turnOwner === 'player'
                ? playerVersusStreak > 0
                  ? `你的回合 · 連擊 ${playerVersusStreak}`
                  : '你的回合'
                : cpuVersusStreak > 0
                  ? `${activeOpponent.name}… · 連擊 ${cpuVersusStreak}`
                  : `${activeOpponent.name}…`
            }
            tone={turnOwner === 'cpu' ? 'hot' : 'good'}
          />
          {runAssisted ? (
            <HudCell label="模式" value="輔助局" tone="hot" />
          ) : versusWins > 0 ? (
            <HudCell label="勝場" value={versusWins} />
          ) : null}
        </>
      );
    }
    return (
      <>
        <HudCell
          label="盤面"
          value={`${themeLabel} · ${faceLike}${flipNeed === 3 ? '組×3' : '對'}`}
          span
        />
        <HudCell label="翻牌" value={moves} />
        <HudCell label="連擊" value={combo} tone={combo > 0 ? 'good' : undefined} />
        <HudCell label="分數" value={score} tone="good" />
        <HudCell label={remain != null ? '剩餘' : '時間'} value={remain != null ? `${remain}s` : `${elapsed}s`} />
        {mode === 'classic' && bestMoves != null ? (
          <HudCell label="最佳翻" value={bestMoves} />
        ) : null}
        {mode === 'classic' && bestTime != null ? (
          <HudCell label="最佳時" value={`${bestTime}s`} />
        ) : null}
        {mode === 'sprint' && bestSprint != null ? (
          <HudCell label="最佳" value={`${bestSprint}s`} />
        ) : null}
        {mode === 'daily' && todayRecord ? (
          <HudCell label="今日最佳" value={`${todayRecord.moves}/${todayRecord.elapsedSec}s`} />
        ) : null}
        {mode === 'daily' && streak > 0 ? <HudCell label="連續" value={`${streak} 天`} /> : null}
        {bestScore != null && mode !== 'daily' && mode !== 'campaign' ? (
          <HudCell label="最高分" value={bestScore} />
        ) : null}
        {mode === 'special' ? (
          <>
            <HudCell label="洞察" value={`×${peekCharges}`} />
            <HudCell label="掃描" value={`×${scanCharges}`} />
            <HudCell label="護盾" value={shieldActive ? '已啟動' : '無'} tone={shieldActive ? 'good' : undefined} />
          </>
        ) : null}
        {mode === 'deduction' ? <HudCell label="模式" value="邏輯推演" tone="good" /> : null}
        {activeStage?.mechanic === 'swap' ? <HudCell label="機制" value="互換" /> : null}
        {activeStage?.mechanic === 'bomb' ? <HudCell label="機制" value="炸彈" tone="hot" /> : null}
        {runAssisted ? <HudCell label="提示" value="輔助局" tone="hot" /> : null}
      </>
    );
  })();

  return (
    <div
      className="mm-shell flex flex-col items-center justify-start p-3 sm:p-4 gap-2 sm:gap-3"
      style={shellBg()}
      data-fever={feverState.tier > 1 ? feverState.tier : undefined}
    >
      <BackToMenu onBackToTitle={screen !== 'play' || mode !== 'classic' ? () => { setScreen('play'); setMode('classic'); restart(pairCount, 'classic'); } : undefined} />
      <h1 className="mm-title">記憶配對</h1>
      <p className="mm-title-sub">Memory Match</p>
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setShowLore(true)}
          className="min-h-[44px] px-4 py-1.5 rounded-xl border border-cyan-400/50 bg-cyan-950/60 hover:bg-cyan-900/70 text-cyan-200 text-xs font-bold inline-flex items-center gap-1.5 transition-colors touch-manipulation shadow-sm"
          aria-label="由來與決策心法"
        >
          <span>📜</span>
          <span>由來與決策心法</span>
        </button>
      </div>

      <div className="mm-cockpit-shell">
        {/* Left Wing: Brain Telemetry Radar Cockpit */}
        <BrainTelemetryWing
          accuracyPct={radar.accuracyPct}
          explorationPct={radar.explorationPct}
          retentionPct={retentionPct}
          reactionStats={reactionStats}
          cognitiveRank={cognitiveRank}
          phosphorCells={phosphorCells}
          cols={cols}
          comboLevel={radar.comboLevel}
          feverMultiplier={feverState.multiplier}
          feverLabel={feverState.label}
          knownReadyPairs={radar.knownReadyPairs}
          focusedIndex={focusedIndex}
          assistMode={assistMode}
          onToggleAssist={toggleAssistMode}
          onSelectCell={(idx) => {
            if (!assistMode) return;
            setFocusedIndex(idx);
            onCard(idx);
          }}
        />

        {/* Center Stage: Grid Board & Controls */}
        <main className="mm-board-center">
          {showTip && (
            <div className="mm-tip" role="note">
              <p className="flex-1 leading-snug">
                點牌翻開配對。可玩每日盤（同日同局）、短戰役（星數解鎖章節），或挑戰有個性的 CPU
                名冊。大盤面可先收合設定。
              </p>
              <button type="button" onClick={dismissTip} aria-label="關閉提示">
                知道了
              </button>
            </div>
          )}

      <div className="w-full max-w-xl flex flex-col gap-2 items-center">
        <button
          type="button"
          onClick={() => setSettingsOpen((o) => !o)}
          className="mm-settings-toggle"
          aria-expanded={settingsOpen}
          aria-controls="mm-settings"
        >
          {settingsOpen ? '收合設定 ▲' : `設定 · ${settingsSummary} ▼`}
        </button>

        {settingsOpen && (
          <div id="mm-settings" className="mm-settings-panel">
            <JuiceSettingsPanel className="w-full max-w-md text-slate-200" />
            <div className="mm-chip-row" role="group" aria-label="模式">
              {(
                [
                  { id: 'classic' as const, label: '經典' },
                  { id: 'sprint' as const, label: `衝刺 ${sprintLimit}s` },
                  { id: 'versus' as const, label: '對戰 CPU' },
                  { id: 'special' as const, label: '洞察特牌' },
                  { id: 'deduction' as const, label: '邏輯推演' },
                  { id: 'daily' as const, label: '每日盤' },
                  { id: 'campaign' as const, label: '短戰役' },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    if (id === 'daily') startDaily();
                    else if (id === 'campaign') setScreen('campaign');
                    else if (id === 'versus') setScreen('roster');
                    else restart(pairCount, id, themeId, cpuDifficulty);
                  }}
                  className={`mm-chip${mode === id ? ' is-mode' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode !== 'daily' && mode !== 'campaign' && (
              <>
                <div className="mm-chip-row" role="group" aria-label="牌組">
                  {THEME_OPTIONS.map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => restart(pairCount, mode, id, cpuDifficulty)}
                      className={`mm-chip${themeId === id ? ' is-theme' : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="mm-chip-row" role="group" aria-label="盤面大小">
                  {pairChoices.map(({ count, label }) => (
                    <button
                      key={count}
                      type="button"
                      onClick={() => restart(count, mode, themeId, cpuDifficulty)}
                      className={`mm-chip${pairCount === count ? ' is-size' : ''}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </>
            )}

            {mode === 'versus' && (
              <button type="button" onClick={() => setScreen('roster')} className="mm-chip is-versus">
                對手：{activeOpponent.name} · 換人
              </button>
            )}

            {mode === 'daily' && (
              <p className="mm-meta">
                今日 {today}
                {streak > 0 ? ` · 連續 ${streak} 天` : ''}
                {todayRecord
                  ? ` · 最佳 ${todayRecord.moves} 翻／${todayRecord.elapsedSec}s`
                  : ' · 尚未通關'}
              </p>
            )}

            {mode === 'campaign' && activeStage && (
              <button type="button" onClick={() => setScreen('campaign')} className="mm-chip is-campaign">
                關卡選單 · {activeStage.name}
              </button>
            )}

            <div className="mm-chip-row" role="group" aria-label="輔助提示">
              <button
                type="button"
                onClick={toggleAssistMode}
                aria-pressed={assistMode}
                className={`mm-chip${assistMode ? ' is-mode' : ''}`}
              >
                輔助提示：{assistMode ? '開啟（標記輔助局）' : '關閉（純記憶）'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mm-hud" aria-live="polite">
        {hudCells}
      </div>

      {/* Dynamic Combo Fever Overdrive Banner */}
      <FeverBanner
        combo={radar.comboLevel}
        multiplier={feverState.multiplier}
        label={feverState.label}
      />

      {/* Mobile tactical summary bar with Brain Telemetry launcher */}
      <div className="mm-mobile-tactical" role="status" aria-label="記憶雷達概況">
        <span className="font-bold text-teal-300">精準 {radar.accuracyPct}%</span>
        <span className="text-slate-400">·</span>
        <span className="text-sky-300 font-bold">留存 {retentionPct}%</span>
        <span className="text-slate-400">·</span>
        <span
          className={
            assistMode && radar.knownReadyPairs > 0
              ? 'text-amber-300 font-bold animate-pulse'
              : 'text-slate-300'
          }
        >
          {assistMode && radar.knownReadyPairs > 0
            ? `⚡ 鎖定 ${radar.knownReadyPairs} 組`
            : `探勘 ${radar.explorationPct}%`}
        </span>
        <span className="text-slate-400">·</span>
        <button
          type="button"
          onClick={() => setShowMobileTelemetry(true)}
          className="px-2 py-0.5 rounded bg-teal-500/25 border border-teal-400/50 text-teal-200 text-xs font-bold active:scale-95"
        >
          腦波儀 📊
        </button>
      </div>

      {/* Mobile Telemetry Modal Sheet */}
      {showMobileTelemetry && (
        <div
          className="mm-telemetry-sheet-backdrop"
          onClick={() => setShowMobileTelemetry(false)}
        >
          <div
            className="mm-telemetry-sheet"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-700">
              <span className="font-bold text-base text-teal-300">🧠 大腦神經遙測與記憶殿堂</span>
              <button
                type="button"
                onClick={() => setShowMobileTelemetry(false)}
                className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs font-bold"
              >
                關閉 ✕
              </button>
            </div>
            <BrainTelemetryWing
              accuracyPct={radar.accuracyPct}
              explorationPct={radar.explorationPct}
              retentionPct={retentionPct}
              reactionStats={reactionStats}
              cognitiveRank={cognitiveRank}
              phosphorCells={phosphorCells}
              cols={cols}
              comboLevel={radar.comboLevel}
              feverMultiplier={feverState.multiplier}
              feverLabel={feverState.label}
              knownReadyPairs={radar.knownReadyPairs}
              focusedIndex={focusedIndex}
              assistMode={assistMode}
              onToggleAssist={toggleAssistMode}
              onSelectCell={(idx) => {
                if (!assistMode) return;
                setFocusedIndex(idx);
                setShowMobileTelemetry(false);
                onCard(idx);
              }}
            />
          </div>
        </div>
      )}

      <div className={`mm-board-stage ${boardWide}${feverState.tier >= 2 ? ' is-fever' : ''}`}>
        <div
          ref={gridRef}
          data-mm-grid="1"
          className={`relative grid ${gridColsClass(faceLike)} ${gridGapClass(faceLike)} w-full`}
        >
          {flashText && (
            <ScoreFlash text={flashText} tone={flashTone} flashKey={flashKey} onDone={() => setFlashText('')} />
          )}
          {cards.map((card, i) => {
            const show =
              card.matched ||
              flipped.includes(i) ||
              hintFlash.includes(i) ||
              peekFlash.includes(i);
            const cell = phosphorCells[i];
            return (
              <TactileCard
                key={card.id}
                card={card}
                index={i}
                show={show}
                hinted={hintFlash.includes(i) || peekFlash.includes(i)}
                missPulse={missPulse.includes(i)}
                matchPulse={matchPulse.includes(i)}
                dense={faceLike >= 18 || cards.length >= 30}
                focused={focusedIndex === i}
                coordinate={cell?.coordinate ?? `C${i + 1}`}
                phosphorLevel={assistMode ? (cell?.level ?? 0) : 0}
                echoReady={assistMode && radar.knownReadyIndices.includes(i)}
                disabled={
                  locks ||
                  hintFlash.length > 0 ||
                  (mode === 'versus' && turnOwner !== 'player') ||
                  (!peekArmed && peekFlash.length > 0)
                }
                onClick={() => {
                  setFocusedIndex(i);
                  onCard(i);
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="mm-actions">
        {mode !== 'versus' && (
          <button type="button" onClick={handleHint} disabled={!canHint} className="mm-btn mm-btn--hint">
            提示
          </button>
        )}
        {mode === 'versus' && (
          <button
            type="button"
            onClick={() => {
              if (turnOwner !== 'player' || locks || flipped.length > 0 || versusOutcome) return;
              setVersusGamble((prev) => {
                const next = !prev;
                versusGambleRef.current = next;
                playMove();
                return next;
              });
            }}
            disabled={turnOwner !== 'player' || locks || flipped.length > 0 || Boolean(versusOutcome)}
            aria-pressed={versusGamble}
            className={`mm-btn${versusGamble ? ' mm-btn--peek is-armed' : ''}`}
            title="本回合配對成功可獲雙倍對戰分；失手則對手加 1 分"
          >
            {versusGamble ? '🎲 豪賭加倍中 (×2)' : '🎲 豪賭加倍'}
          </button>
        )}
        <button
          type="button"
          onClick={toggleAssistMode}
          aria-pressed={assistMode}
          className={`mm-btn${assistMode ? ' mm-btn--peek is-armed' : ''}`}
          title="開啟後顯示牌背記憶餘暉、雙牌光環與點擊矩陣提示（會標記為輔助局）"
        >
          {assistMode ? '輔助提示：開' : '輔助提示：關'}
        </button>
        {mode === 'special' && (
          <>
            <button
              type="button"
              onClick={armPeek}
              disabled={peekCharges <= 0 || peekArmed || locks || won || lost || flipped.length > 0}
              className={`mm-btn mm-btn--peek${peekArmed ? ' is-armed' : ''}`}
              title="窺視單張背面牌 [P]"
            >
              {peekArmed ? '點牌窺視中' : `使用洞察 (${peekCharges})`}
            </button>
            <button
              type="button"
              onClick={armScan}
              disabled={scanCharges <= 0 || scanArmed || locks || won || lost || flipped.length > 0}
              className={`mm-btn mm-btn--peek${scanArmed ? ' is-armed' : ''}`}
              title="掃描整列背面牌 [S]"
            >
              {scanArmed ? '點牌掃描中' : `橫列掃描 (${scanCharges})`}
            </button>
          </>
        )}
        {mode === 'daily' && todayRecord && (
          <button type="button" onClick={() => void handleShareDaily()} className="mm-btn mm-btn--share">
            {shareCopied ? '已複製' : '複製分享'}
          </button>
        )}
        <button type="button" onClick={() => restart()} className="mm-btn">
          重開一局
        </button>
      </div>

      {mode === 'special' && (
        <p className="mm-meta">
          金色「洞察」可窺視單牌、藍色「掃描」可掃描整列背面牌、綠色「護盾」可防禦失誤懲罰！
        </p>
      )}
      {mode === 'deduction' && (
        <p className="mm-meta">
          邏輯推演模式：牌背標註領域與「算式 / 數值」屬性，翻牌後可透過數學方程式與數值結果進行邏輯反推，免除首回合盲猜！
        </p>
      )}
      {mode === 'versus' && (
        <p className="mm-meta">
          對上 {activeOpponent.name}：{activeOpponent.blurb}（連擊 +1 分，或啟用豪賭 ×2／失手對手 +1 分）
        </p>
      )}
      {mode === 'campaign' && activeStage && <p className="mm-meta">{activeStage.blurb}</p>}
      {mode === 'daily' && (
        <p className="mm-meta">每日盤以日期為種子，全站同日同局。通關後可複製分享文字。</p>
      )}
    </main>

    {/* Right Wing: Opponent Archive & Vault */}
    <aside className="mm-wing mm-wing--right" aria-label="戰情檔案與榮譽智庫">
      <div className="mm-wing__title">
        <span className="text-pink-400">🏆</span>
        <span>戰情檔案與榮譽智庫</span>
      </div>

      <div className="mm-wing__card">
        <span className="text-xs font-bold text-pink-300">當前模式戰況</span>
        {mode === 'versus' ? (
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="mm-wing__row">
              <span className="mm-wing__label">對手</span>
              <span className="mm-wing__value text-pink-200">{activeOpponent.name}</span>
            </div>
            <div className="mm-wing__row text-xs text-slate-400">
              <span>風格</span>
              <span>{activeOpponent.tagline}</span>
            </div>
            <div className="mm-wing__row">
              <span className="mm-wing__label">對戰積分</span>
              <span className="mm-wing__value text-amber-300 font-bold">
                {playerVersusScore} : {cpuVersusScore}
              </span>
            </div>
            <div className="mm-wing__row text-xs text-slate-400">
              <span>已配對數</span>
              <span>
                {playerPairs} : {cpuPairs}
              </span>
            </div>
            <div className="mm-wing__row text-xs text-slate-400">
              <span>AI 記性容量</span>
              <span>{cpuCapacityFor(activeOpponent.difficulty, pairCount)} 格</span>
            </div>
          </div>
        ) : mode === 'campaign' ? (
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="mm-wing__row">
              <span className="mm-wing__label">關卡</span>
              <span className="mm-wing__value text-pink-200">
                {activeStage?.name ?? '戰役中'}
              </span>
            </div>
            <div className="mm-wing__row text-xs text-slate-400">
              <span>目標</span>
              <span>3★ ≤ {activeStage?.starMoves[0] ?? 10} 步</span>
            </div>
            {activeStage?.timeLimitSec ? (
              <div className="mm-wing__row text-xs text-slate-400">
                <span>時限</span>
                <span>{activeStage.timeLimitSec}s</span>
              </div>
            ) : null}
          </div>
        ) : mode === 'sprint' ? (
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="mm-wing__row">
              <span className="mm-wing__label">衝刺時限</span>
              <span className="mm-wing__value text-amber-300">{sprintLimit} 秒</span>
            </div>
            <div className="mm-wing__row text-xs text-slate-400">
              <span>剩餘倒數</span>
              <span className="font-bold text-rose-300">
                {remain != null ? `${remain}s` : '--'}
              </span>
            </div>
          </div>
        ) : mode === 'daily' ? (
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="mm-wing__row">
              <span className="mm-wing__label">今日日期</span>
              <span className="mm-wing__value text-sky-200">{today}</span>
            </div>
            <div className="mm-wing__row text-xs text-slate-400">
              <span>連續紀錄</span>
              <span>{streak > 0 ? `連續 ${streak} 天` : '今日開局'}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 mt-1">
            <div className="mm-wing__row">
              <span className="mm-wing__label">主題盤面</span>
              <span className="mm-wing__value text-teal-200">
                {themeLabel} · {pairCount} 對
              </span>
            </div>
            <div className="mm-wing__row text-xs text-slate-400">
              <span>挑戰目的</span>
              <span>極少步數完成配對</span>
            </div>
          </div>
        )}
      </div>

      <div className="mm-wing__card">
        <span className="text-xs font-bold text-slate-300 tracking-wider">個人殿堂紀錄</span>
        <div className="flex flex-col gap-1 mt-1 text-xs">
          <div className="mm-wing__row">
            <span className="mm-wing__label">經典最佳步數</span>
            <span className="mm-wing__value">
              {bestMoves != null ? `${bestMoves} 步` : '未記錄'}
            </span>
          </div>
          <div className="mm-wing__row">
            <span className="mm-wing__label">最佳秒數</span>
            <span className="mm-wing__value">
              {bestTime != null ? `${bestTime}s` : '未記錄'}
            </span>
          </div>
          <div className="mm-wing__row">
            <span className="mm-wing__label">衝刺最佳</span>
            <span className="mm-wing__value">
              {bestSprint != null ? `${bestSprint}s` : '未記錄'}
            </span>
          </div>
          <div className="mm-wing__row">
            <span className="mm-wing__label">最高分數</span>
            <span className="mm-wing__value text-amber-300">
              {bestScore != null ? `${bestScore} 分` : '未記錄'}
            </span>
          </div>
          {versusWins > 0 && (
            <div className="mm-wing__row">
              <span className="mm-wing__label">對戰勝場</span>
              <span className="mm-wing__value text-emerald-300">{versusWins} 勝</span>
            </div>
          )}
        </div>
      </div>

      <div className="mm-wing__card">
        <span className="text-xs font-bold text-cyan-300 tracking-wider">大師記憶心法</span>
        <div className="flex flex-col gap-2 mt-1 text-[11px] leading-relaxed text-slate-300">
          <div>
            <strong className="text-cyan-200">📐 四角錨定術：</strong>
            優先翻開邊角牌建立空間坐標系。
          </div>
          <div>
            <strong className="text-teal-200">🧭 區域網格掃描：</strong>
            橫向逐排翻開，未記牢前不盲動。
          </div>
          <div>
            <strong className="text-amber-200">🎯 先探後收法則：</strong>
            遇新牌留印象，已知雙子一口氣連擊！
          </div>
        </div>
      </div>
    </aside>
  </div>

      {overlayOpen && mode !== 'versus' && won && (
        <ResultOverlay
          title={mode === 'campaign' ? '關卡通過！' : mode === 'daily' ? '每日通關！' : '全部配對！'}
          variant="win"
          badge={
            runAssisted
              ? '輔助局'
              : mode === 'campaign' && lastStars
                ? starGlyphs(lastStars)
                : newRecord
                  ? '新紀錄'
                  : undefined
          }
          stats={[
            { label: '牌組', value: themeLabel },
            { label: '翻牌次數', value: moves },
            { label: '用時', value: `${elapsed}s` },
            { label: '連擊分數', value: score },
            { label: '記憶模式', value: runAssisted ? '輔助提示（不計紀錄）' : '純記憶' },
            ...(mode === 'campaign' && lastStars
              ? [{ label: '星數', value: starGlyphs(lastStars) }]
              : []),
            ...(mode === 'daily'
              ? [{ label: '連續天數', value: computeStreak(dailyRecords, today) }]
              : []),
            ...(mode !== 'daily' && mode !== 'campaign'
              ? [
                  {
                    label: mode === 'sprint' ? '最佳衝刺' : '最佳翻牌',
                    value:
                      mode === 'sprint' ? `${bestSprint ?? elapsed}s` : (bestMoves ?? moves),
                  },
                ]
              : []),
          ]}
          onPrimary={() => {
            if (mode === 'campaign' && stageIndex != null) {
              const next = stageIndex + 1;
              if (next < CAMPAIGN_STAGES.length && isStageUnlocked(next, campaign)) {
                startCampaignStage(next);
                return;
              }
              setScreen('campaign');
              return;
            }
            restart();
          }}
          primaryLabel={
            mode === 'campaign'
              ? stageIndex != null &&
                stageIndex + 1 < CAMPAIGN_STAGES.length &&
                isStageUnlocked(stageIndex + 1, campaign)
                ? '下一關 (Space / Enter / R)'
                : '關卡選單 (Space / Enter / R)'
              : '再玩一局 (Space / Enter / R)'
          }
          secondaryLabel="回到主選單"
          onSecondary={() => {
            setScreen('play');
            setMode('classic');
            restart(pairCount, 'classic');
          }}
        />
      )}
      {overlayOpen && mode !== 'versus' && lost && (
        <ResultOverlay
          title="時間到"
          variant="lose"
          subtitle={
            effectiveLimit != null
              ? `限時 ${effectiveLimit} 秒 · ${themeLabel}`
              : themeLabel
          }
          stats={[
            { label: '翻牌次數', value: moves },
            {
              label: '已配對',
              value: Math.floor(cards.filter((c) => c.matched).length / flipNeed),
            },
            { label: '分數', value: score },
          ]}
          primaryLabel="再玩一局 (Space / Enter / R)"
          onPrimary={() => restart()}
          secondaryLabel="回到主選單"
          onSecondary={() => {
            setScreen('play');
            setMode('classic');
            restart(pairCount, 'classic');
          }}
        />
      )}
      {versusOutcome && (
        <ResultOverlay
          title={
            versusOutcome === 'win'
              ? `贏了 ${activeOpponent.name}！`
              : versusOutcome === 'lose'
                ? `${activeOpponent.name} 獲勝`
                : '平手'
          }
          variant={versusOutcome === 'win' ? 'win' : versusOutcome === 'lose' ? 'lose' : 'neutral'}
          badge={
            versusOutcome === 'win'
              ? runAssisted
                ? '輔助練習勝（純記憶才解鎖）'
                : newRecord
                  ? roster.unlockedIndex > OPPONENTS.findIndex((o) => o.id === opponentId)
                    ? '解鎖下一位'
                    : '勝場 +1'
                  : undefined
              : runAssisted
                ? '輔助局'
                : undefined
          }
          stats={[
            { label: '對戰積分', value: `${playerVersusScore} : ${cpuVersusScore}` },
            { label: '配對比數', value: `${playerPairs} : ${cpuPairs}` },
            { label: '對手', value: activeOpponent.name },
            { label: '盤面', value: `${themeLabel} · ${pairCount} 對` },
            { label: '翻牌次數', value: moves },
            { label: '記憶模式', value: runAssisted ? '輔助提示（不計勝場）' : '純記憶' },
            { label: '累計勝場', value: versusWins },
          ]}
          onPrimary={() => {
            if (versusOutcome === 'win') {
              const idx = OPPONENTS.findIndex((o) => o.id === opponentId);
              const next = OPPONENTS[idx + 1];
              if (next && isOpponentUnlocked(idx + 1, roster.unlockedIndex)) {
                startVersusOpponent(next.id);
                return;
              }
            }
            restart();
          }}
          primaryLabel={
            versusOutcome === 'win' &&
            (() => {
              const idx = OPPONENTS.findIndex((o) => o.id === opponentId);
              return (
                idx + 1 < OPPONENTS.length &&
                isOpponentUnlocked(idx + 1, roster.unlockedIndex)
              );
            })()
              ? '挑戰下一位 (Space / Enter / R)'
              : '再戰一局 (Space / Enter / R)'
          }
          secondaryLabel="回到主選單"
          onSecondary={() => {
            setVersusOutcome(null);
            setScreen('play');
            setMode('classic');
            restart(pairCount, 'classic');
          }}
        />
      )}
      {showLore && (
        <OriginLoreModal dossier={MEMORY_MATCH_LORE} onClose={() => setShowLore(false)} />
      )}
    </div>
  );
}

function nearestPairCount(faceCount: number): PairCount {
  if (faceCount <= 6) return 6;
  if (faceCount <= 12) return 12;
  if (faceCount <= 18) return 18;
  return 24;
}

function shellBg(): CSSProperties {
  return {
    ['--mm-table-image' as string]: `url(${import.meta.env.BASE_URL}table-bg.jpg)`,
  };
}

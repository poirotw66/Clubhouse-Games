import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { JuiceSettingsPanel } from '@clubhouse/shared/JuiceSettings';
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
  FACE_EMOJI,
  FACE_TINT,
  PAIR_OPTIONS,
  THEME_OPTIONS,
  allMatched,
  buildDeck,
  clampPairCount,
  faceUsesPhoto,
  gridColsClass,
  gridGapClass,
  hintPairIndices,
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
  swapTwoHiddenCards,
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

function cardFaceStyle(face: MemoryCard['face'], kind: MemoryCard['kind']): CSSProperties {
  if (faceUsesPhoto(face)) {
    return {
      backgroundColor: '#f8fafc',
      backgroundImage: [
        'linear-gradient(rgba(255,255,255,0.12), rgba(255,255,255,0.22))',
        `url(${import.meta.env.BASE_URL}faces/${face}.jpg)`,
      ].join(', '),
    };
  }
  return {
    backgroundColor:
      kind === 'insight' ? '#fff7ed' : kind === 'bomb' ? '#fee2e2' : FACE_TINT[face] ?? '#f8fafc',
  };
}

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
    case 'daily':
      return '每日盤';
    case 'campaign':
      return '戰役';
    default:
      return mode;
  }
}

function FlipCard({
  card,
  show,
  hinted,
  missPulse,
  matchPulse,
  disabled,
  dense,
  onClick,
}: {
  card: MemoryCard;
  show: boolean;
  hinted: boolean;
  missPulse: boolean;
  matchPulse: boolean;
  disabled: boolean;
  /** Large boards use squarer cards on phones to cut scroll height. */
  dense?: boolean;
  onClick: () => void;
}) {
  const classNames = [
    'mm-card',
    show || card.matched ? 'is-flipped' : '',
    card.matched ? 'is-matched' : '',
    missPulse ? 'is-miss' : '',
    matchPulse ? 'is-match-pop' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={`mm-scene ${dense ? 'aspect-square sm:aspect-[3/4]' : 'aspect-[3/4]'}`}>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || card.matched}
        className={`${classNames} w-full h-full touch-manipulation active:scale-[0.98] disabled:cursor-default`}
        aria-label={show || card.matched ? card.face : '背面牌'}
      >
        <span
          className="mm-face mm-face-back"
          style={{ backgroundImage: `url(${import.meta.env.BASE_URL}card-back.jpg)` }}
        />
        <span
          className={`mm-face mm-face-front ${card.kind === 'insight' ? 'is-insight' : ''} ${
            card.kind === 'bomb' ? 'is-bomb' : ''
          } ${hinted ? 'mm-face--hint' : ''}`}
          style={cardFaceStyle(card.face, card.kind)}
        >
          {!faceUsesPhoto(card.face) && (
            <span className="mm-emoji" aria-hidden>
              {FACE_EMOJI[card.face]}
            </span>
          )}
          {card.kind === 'insight' && (
            <span className="absolute bottom-0.5 right-0.5 rounded-[0.3rem] bg-amber-400 px-1 text-[9px] sm:text-[10px] font-bold text-amber-950 shadow-[0_0_10px_rgba(251,191,36,0.55)]">
              洞察
            </span>
          )}
          {card.kind === 'bomb' && (
            <span className="absolute bottom-0.5 right-0.5 rounded-[0.3rem] bg-rose-500 px-1 text-[9px] sm:text-[10px] font-bold text-rose-50 shadow-[0_0_10px_rgba(244,63,94,0.55)]">
              炸彈
            </span>
          )}
        </span>
        {matchPulse && <span className="mm-burst" aria-hidden />}
      </button>
    </div>
  );
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
  const [missPulse, setMissPulse] = useState<number[]>([]);
  const [matchPulse, setMatchPulse] = useState<number[]>([]);
  const [flashText, setFlashText] = useState('');
  const [flashKey, setFlashKey] = useState(0);
  const [flashTone, setFlashTone] = useState<'good' | 'bad' | 'neutral'>('good');
  const [turnOwner, setTurnOwner] = useState<TurnOwner>('player');
  const [playerPairs, setPlayerPairs] = useState(0);
  const [cpuPairs, setCpuPairs] = useState(0);
  const [versusOutcome, setVersusOutcome] = useState<'win' | 'lose' | 'draw' | null>(null);
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

  const gridRef = useRef<HTMLDivElement | null>(null);
  const turnRef = useRef(0);
  const resolvingRef = useRef(false);
  const cpuScheduledRef = useRef(false);
  const cpuSecondFlipRef = useRef<number | null>(null);
  const playerPairsRef = useRef(0);
  const cpuPairsRef = useRef(0);
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
    setMissPulse([]);
    setMatchPulse([]);
    setFlashText('');
    setTurnOwner('player');
    setPlayerPairs(0);
    setCpuPairs(0);
    setVersusOutcome(null);
    setCpuMemory(emptyCpuMemory());
    setLastStars(null);
    setShareCopied(false);
    turnRef.current = 0;
    resolvingRef.current = false;
    cpuScheduledRef.current = false;
    if (cpuSecondFlipRef.current != null) {
      window.clearTimeout(cpuSecondFlipRef.current);
      cpuSecondFlipRef.current = null;
    }
    playerPairsRef.current = 0;
    cpuPairsRef.current = 0;
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
      resetTransient();
      const freeMode: PlayMode =
        opts.nextMode === 'special'
          ? 'special'
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
        deckOptions: { specialInsight: nextMode === 'special' },
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

  // Campaign swap mechanic — periodically swap two face-down cards.
  useEffect(() => {
    if (mode !== 'campaign' || swapEverySec == null) return;
    if (won || lost) return;
    const id = window.setInterval(() => {
      if (endedRef.current || resolvingRef.current) return;
      if (flippedRef.current.length > 0) return;
      setCards((prev) => swapTwoHiddenCards(prev, flippedRef.current, Math.random));
      showFlash('牌位互換！', 'neutral');
    }, swapEverySec * 1000);
    return () => window.clearInterval(id);
  }, [mode, swapEverySec, won, lost, cards, showFlash]);

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
      let record = false;

      if (mode === 'daily') {
        const next = recordDaily({
          date: today,
          moves: finalMoves,
          elapsedSec: finalElapsed,
          score: finalScore,
          pairCount,
        });
        setDailyRecords(next);
        const prev = todayRecord;
        record =
          !prev ||
          finalMoves < prev.moves ||
          (finalMoves === prev.moves && finalElapsed < prev.elapsedSec);
        setNewRecord(record);
        return;
      }

      if (mode === 'campaign' && stageIndex != null) {
        const stage = CAMPAIGN_STAGES[stageIndex];
        const earned = stage ? starsEarned(stage, finalMoves, finalElapsed) : 1;
        setLastStars(earned);
        const next = clearStageAndPersist(stageIndex, finalMoves, finalElapsed);
        setCampaign(next);
        setNewRecord(earned >= (campaign.stars[stage?.id ?? ''] ?? 0));
        return;
      }

      if (mode === 'sprint') {
        const saved = saveBestSprintSec(pairCount, finalElapsed, themeId);
        setBestSprint(saved);
        record = saved === finalElapsed;
      } else {
        const movesMode: PlayMode = mode === 'special' ? 'special' : 'classic';
        const savedMoves = saveBestMoves(pairCount, finalMoves, themeId, movesMode);
        setBestMoves(savedMoves);
        if (savedMoves === finalMoves) record = true;
        const savedTime = saveBestTimeSec(pairCount, finalElapsed, themeId, movesMode);
        setBestTime(savedTime);
        if (savedTime === finalElapsed) record = true;
      }
      const scoreMode: PlayMode =
        mode === 'versus' || mode === 'campaign' ? 'classic' : mode === 'special' ? 'special' : mode === 'sprint' ? 'sprint' : 'classic';
      const savedScore = saveBestScore(scoreMode, pairCount, finalScore, themeId);
      setBestScore(savedScore);
      if (savedScore === finalScore) record = true;
      setNewRecord(record);
    },
    [mode, pairCount, themeId, today, todayRecord, stageIndex, campaign.stars],
  );

  const finishVersus = useCallback(
    (pPairs: number, cPairs: number) => {
      let outcome: 'win' | 'lose' | 'draw';
      if (pPairs > cPairs) outcome = 'win';
      else if (pPairs < cPairs) outcome = 'lose';
      else outcome = 'draw';
      setVersusOutcome(outcome);
      if (outcome === 'win') {
        playWin();
        const wins = saveVersusWin(pairCount, themeId, cpuDifficulty);
        setVersusWins(wins);
        const oppIndex = OPPONENTS.findIndex((o) => o.id === opponentId);
        const nextRoster = recordRosterWin(opponentId, Math.max(0, oppIndex));
        setRoster(nextRoster);
        setNewRecord(true);
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
        if (newCombo >= 2) playCapture();
        // Juice: match → success+sparkle; combo match → combo+sparkle
        haptic(newCombo >= 2 ? 'combo' : 'success');
        particles('sparkle', { el: gridRef.current });
        setMatchPulse(indices);
        const gained = scoreForMatch(newCombo);
        comboRef.current = newCombo;
        scoreRef.current += gained;
        setCombo(newCombo);
        setScore(scoreRef.current);
        if (newCombo >= 2) showFlash(`${newCombo} 連擊！+${gained}`, 'good');
        else showFlash(`配對 +${gained}`, 'good');

        const insightBonus = indices.some((i) => cards[i].kind === 'insight');
        const matchedSet = new Set(indices);
        nextCards = cards.map((c, i) => (matchedSet.has(i) ? { ...c, matched: true } : c));
        setCards(nextCards);

        if (mode === 'versus') {
          if (actor === 'player') {
            playerPairsRef.current += 1;
            setPlayerPairs(playerPairsRef.current);
          } else {
            cpuPairsRef.current += 1;
            setCpuPairs(cpuPairsRef.current);
          }
        } else if (insightBonus && mode === 'special') {
          setPeekCharges((c) => c + 1);
          showFlash('獲得洞察！', 'neutral');
        }
      } else {
        playError();
        // Juice: miss → error haptic; soft shake only (cards already CSS-pulse)
        haptic('error');
        shake(gridRef.current, 0.28);
        setMissPulse(indices);
        comboRef.current = 0;
        setCombo(0);
        const hitBomb = indices.some((i) => cards[i].kind === 'bomb');
        if (hitBomb && bombPenaltySec > 0) {
          elapsedRef.current += bombPenaltySec;
          setElapsed(elapsedRef.current);
          showFlash(`炸彈罰時 +${bombPenaltySec}s`, 'bad');
        } else {
          showFlash('未中', 'bad');
        }
        if (mode === 'versus') {
          setTurnOwner(actor === 'player' ? 'cpu' : 'player');
        }
      }
      setFlipped([]);
      setLocks(false);
      resolvingRef.current = false;
      cpuScheduledRef.current = false;

      if (!endedRef.current && allMatched(nextCards)) {
        endedRef.current = true;
        // Juice: clear board → confetti + shake grid
        particles('confetti', { el: gridRef.current, strength: 1.1 });
        shake(gridRef.current, 0.95);
        if (mode === 'versus') {
          finishVersus(playerPairsRef.current, cpuPairsRef.current);
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
        haptic('tap');
        setFlipped([i]);
        if (cpuSecondFlipRef.current != null) {
          window.clearTimeout(cpuSecondFlipRef.current);
        }
        cpuSecondFlipRef.current = window.setTimeout(() => {
          cpuSecondFlipRef.current = null;
          playCard();
          haptic('tap');
          setFlipped([i, j]);
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

    if (peekArmed && mode === 'special') {
      const card = cards[index];
      if (card.matched) return;
      setPeekArmed(false);
      setPeekCharges((c) => Math.max(0, c - 1));
      setPeekFlash([index]);
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
    haptic('tap');
    setFlipped((f) => [...f, index]);
  };

  const handleHint = () => {
    if (mode === 'versus') return;
    if (locks || won || lost || flipped.length > 0 || hintFlash.length > 0) return;
    const group = hintPairIndices(cards, flipNeed);
    if (!group) return;
    setHintFlash(group);
    setCpuMemory((mem) =>
      rememberRevealed(mem, cards, group, turnRef.current, cpuDifficulty, pairCount),
    );
    playMove();
  };

  const armPeek = () => {
    if (mode !== 'special' || peekCharges <= 0 || peekArmed) return;
    if (locks || won || lost || flipped.length > 0) return;
    setPeekArmed(true);
    playMove();
    showFlash('點選一張牌窺視', 'neutral');
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

  if (screen === 'campaign') {
    return (
      <div
        className="mm-shell flex flex-col items-center p-3 sm:p-4 gap-3"
        style={shellBg()}
      >
        <BackToMenu />
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
      </div>
    );
  }

  if (screen === 'roster') {
    return (
      <div
        className="mm-shell flex flex-col items-center p-3 sm:p-4 gap-3"
        style={shellBg()}
      >
        <BackToMenu />
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
          <HudCell label="你" value={playerPairs} tone="good" />
          <HudCell label={activeOpponent.name} value={cpuPairs} tone="hot" />
          <HudCell
            label="回合"
            value={turnOwner === 'player' ? '你的回合' : `${activeOpponent.name}…`}
            tone={turnOwner === 'cpu' ? 'hot' : 'good'}
          />
          {versusWins > 0 ? <HudCell label="勝場" value={versusWins} /> : null}
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
        {mode === 'special' ? <HudCell label="洞察" value={`×${peekCharges}`} /> : null}
        {activeStage?.mechanic === 'swap' ? <HudCell label="機制" value="互換" /> : null}
        {activeStage?.mechanic === 'bomb' ? <HudCell label="機制" value="炸彈" tone="hot" /> : null}
      </>
    );
  })();

  return (
    <div
      className="mm-shell flex flex-col items-center justify-start sm:justify-center p-3 sm:p-4 gap-2 sm:gap-3"
      style={shellBg()}
    >
      <BackToMenu />
      <h1 className="mm-title">記憶配對</h1>
      <p className="mm-title-sub">Memory Match</p>

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
          </div>
        )}
      </div>

      <div className="mm-hud" aria-live="polite">
        {hudCells}
      </div>

      <div className={`mm-board-stage ${boardWide}`}>
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
            return (
              <FlipCard
                key={card.id}
                card={card}
                show={show}
                hinted={hintFlash.includes(i) || peekFlash.includes(i)}
                missPulse={missPulse.includes(i)}
                matchPulse={matchPulse.includes(i)}
                dense={faceLike >= 18 || cards.length >= 30}
                disabled={
                  locks ||
                  hintFlash.length > 0 ||
                  (mode === 'versus' && turnOwner !== 'player') ||
                  (!peekArmed && peekFlash.length > 0)
                }
                onClick={() => onCard(i)}
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
        {mode === 'special' && (
          <button
            type="button"
            onClick={armPeek}
            disabled={peekCharges <= 0 || peekArmed || locks || won || lost || flipped.length > 0}
            className={`mm-btn mm-btn--peek${peekArmed ? ' is-armed' : ''}`}
          >
            {peekArmed ? '點牌窺視中' : `使用洞察 (${peekCharges})`}
          </button>
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
          金色「洞察」對配對成功後可窺視任一張背面牌——何時用掉是關鍵決策。
        </p>
      )}
      {mode === 'versus' && (
        <p className="mm-meta">
          對上 {activeOpponent.name}：{activeOpponent.blurb}
        </p>
      )}
      {mode === 'campaign' && activeStage && <p className="mm-meta">{activeStage.blurb}</p>}
      {mode === 'daily' && (
        <p className="mm-meta">每日盤以日期為種子，全站同日同局。通關後可複製分享文字。</p>
      )}

      {overlayOpen && mode !== 'versus' && won && (
        <ResultOverlay
          title={mode === 'campaign' ? '關卡通過！' : mode === 'daily' ? '每日通關！' : '全部配對！'}
          variant="win"
          badge={
            mode === 'campaign' && lastStars
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
                ? '下一關'
                : '關卡選單'
              : '再玩一局'
          }
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
          onPrimary={() => restart()}
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
            versusOutcome === 'win' && newRecord
              ? roster.unlockedIndex > OPPONENTS.findIndex((o) => o.id === opponentId)
                ? '解鎖下一位'
                : '勝場 +1'
              : undefined
          }
          stats={[
            { label: '比數', value: `${playerPairs} : ${cpuPairs}` },
            { label: '對手', value: activeOpponent.name },
            { label: '盤面', value: `${themeLabel} · ${pairCount} 對` },
            { label: '翻牌次數', value: moves },
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
              ? '挑戰下一位'
              : '再戰一局'
          }
        />
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

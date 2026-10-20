import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { ScoreFlash } from '@clubhouse/shared/ScoreFlash';
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
  emptyCpuMemory,
  pickCpuMove,
  rememberRevealed,
  type CpuMemory,
} from './cpuAi';
import {
  CPU_DIFFICULTY_OPTIONS,
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
  loadBestMoves,
  loadBestScore,
  loadBestSprintSec,
  loadBestTimeSec,
  loadVersusWins,
  maxPairsForTheme,
  nextCombo,
  saveBestMoves,
  saveBestScore,
  saveBestSprintSec,
  saveBestTimeSec,
  saveVersusWin,
  scoreForMatch,
  sprintLimitSec,
  type CpuDifficulty,
  type MemoryCard,
  type PairCount,
  type PlayMode,
  type ThemeId,
} from './memoryLogic';

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
    backgroundColor: kind === 'insight' ? '#fff7ed' : FACE_TINT[face] ?? '#f8fafc',
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

function FlipCard({
  card,
  show,
  hinted,
  missPulse,
  matchPulse,
  disabled,
  onClick,
}: {
  card: MemoryCard;
  show: boolean;
  hinted: boolean;
  missPulse: boolean;
  matchPulse: boolean;
  disabled: boolean;
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
    <div className="mm-scene aspect-[3/4]">
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
            hinted ? 'ring-2 ring-amber-400' : ''
          }`}
          style={cardFaceStyle(card.face, card.kind)}
        >
          {!faceUsesPhoto(card.face) && (
            <span className="mm-emoji" aria-hidden>
              {FACE_EMOJI[card.face]}
            </span>
          )}
          {card.kind === 'insight' && (
            <span className="absolute bottom-0.5 right-0.5 rounded bg-amber-500/90 px-1 text-[9px] sm:text-[10px] font-bold text-amber-950">
              洞察
            </span>
          )}
        </span>
        {matchPulse && <span className="mm-burst" aria-hidden />}
      </button>
    </div>
  );
}

export default function App() {
  const [themeId, setThemeId] = useState<ThemeId>('classic');
  const [pairCount, setPairCount] = useState<PairCount>(12);
  const [mode, setMode] = useState<PlayMode>('classic');
  const [cpuDifficulty, setCpuDifficulty] = useState<CpuDifficulty>('normal');
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

  const showFlash = useCallback((text: string, tone: 'good' | 'bad' | 'neutral' = 'good') => {
    setFlashText(text);
    setFlashTone(tone);
    setFlashKey((k) => k + 1);
  }, []);

  const restart = useCallback(
    (
      count: PairCount = pairCount,
      nextMode: PlayMode = mode,
      nextTheme: ThemeId = themeId,
      nextCpu: CpuDifficulty = cpuDifficulty,
    ) => {
      const clamped = clampPairCount(nextTheme, count);
      setThemeId(nextTheme);
      setPairCount(clamped);
      setMode(nextMode);
      setCpuDifficulty(nextCpu);
      setCards(
        buildDeck(clamped, nextTheme, Math.random, {
          specialInsight: nextMode === 'special',
        }),
      );
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
      setBestMoves(loadBestMoves(clamped, nextTheme, nextMode === 'special' ? 'special' : 'classic'));
      setBestSprint(loadBestSprintSec(clamped, nextTheme));
      setBestTime(loadBestTimeSec(clamped, nextTheme, nextMode === 'special' ? 'special' : 'classic'));
      setBestScore(loadBestScore(nextMode === 'versus' ? 'classic' : nextMode, clamped, nextTheme));
      setVersusWins(loadVersusWins(clamped, nextTheme, nextCpu));
    },
    [pairCount, mode, themeId, cpuDifficulty],
  );

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
    if (mode === 'sprint' && elapsed >= sprintLimitSec(pairCount)) {
      setLost(true);
      playLose();
    }
  }, [elapsed, mode, pairCount, won, lost, versusOutcome]);

  // Collapse settings after the first flip so the board gets vertical space on phones.
  useEffect(() => {
    if (moves > 0 && settingsOpen) setSettingsOpen(false);
    // Only auto-collapse once per deal when play starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot on first move
  }, [moves]);

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
      const savedScore = saveBestScore(mode === 'versus' ? 'classic' : mode, pairCount, finalScore, themeId);
      setBestScore(savedScore);
      if (savedScore === finalScore) record = true;
      setNewRecord(record);
    },
    [mode, pairCount, themeId],
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
        setNewRecord(true);
      } else if (outcome === 'lose') {
        playLose();
      } else {
        playMove();
      }
    },
    [pairCount, themeId, cpuDifficulty],
  );

  // Resolve a completed two-card flip.
  useEffect(() => {
    if (flipped.length !== 2 || resolvingRef.current) return;
    resolvingRef.current = true;
    const [a, b] = flipped;
    const match = cards[a].face === cards[b].face;
    const actor = mode === 'versus' ? turnOwner : 'player';
    setLocks(true);
    movesRef.current += 1;
    setMoves(movesRef.current);
    turnRef.current += 1;
    const turn = turnRef.current;

    setCpuMemory((mem) =>
      rememberRevealed(mem, cards, [a, b], turn, cpuDifficulty, pairCountRef.current),
    );

    const delay = match ? FLIP_RESOLVE_MATCH_MS : FLIP_RESOLVE_MISS_MS;
    const t = window.setTimeout(() => {
      let nextCards = cards;
      if (match) {
        playScore();
        const newCombo = nextCombo(comboRef.current, true);
        if (newCombo >= 2) playCapture();
        setMatchPulse([a, b]);
        const gained = scoreForMatch(newCombo);
        comboRef.current = newCombo;
        scoreRef.current += gained;
        setCombo(newCombo);
        setScore(scoreRef.current);
        if (newCombo >= 2) showFlash(`${newCombo} 連擊！+${gained}`, 'good');
        else showFlash(`配對 +${gained}`, 'good');

        const insightBonus = cards[a].kind === 'insight';
        nextCards = cards.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c));
        setCards(nextCards);

        if (mode === 'versus') {
          if (actor === 'player') {
            playerPairsRef.current += 1;
            setPlayerPairs(playerPairsRef.current);
          } else {
            cpuPairsRef.current += 1;
            setCpuPairs(cpuPairsRef.current);
          }
          // Match grants another turn — stay on actor.
        } else if (insightBonus && mode === 'special') {
          setPeekCharges((c) => c + 1);
          showFlash('獲得洞察！', 'neutral');
        }
      } else {
        playError();
        setMissPulse([a, b]);
        comboRef.current = 0;
        setCombo(0);
        showFlash('未中', 'bad');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resolve once per flip pair
  }, [flipped]);

  // CPU turn scheduler — flips one card, then the second, so the turn is human-readable.
  useEffect(() => {
    if (mode !== 'versus') return;
    if (versusOutcome || won || lost) return;
    if (turnOwner !== 'cpu') return;
    if (locks || flipped.length > 0) return;
    if (allMatched(cards)) return;
    if (cpuScheduledRef.current) return;
    cpuScheduledRef.current = true;

    // Stall only when clearly behind so it doesn't feel like constant cheating.
    const preferStall = playerPairs >= cpuPairs + 2;
    const think = window.setTimeout(() => {
      try {
        const [i, j] = pickCpuMove({
          cards,
          memory: cpuMemory,
          turn: turnRef.current,
          difficulty: cpuDifficulty,
          preferStall,
        });
        playCard();
        setFlipped([i]);
        // Second flip lives outside this effect's cleanup: when flipped.length
        // becomes 1 the effect re-runs, and clearing here would abort the reveal.
        if (cpuSecondFlipRef.current != null) {
          window.clearTimeout(cpuSecondFlipRef.current);
        }
        cpuSecondFlipRef.current = window.setTimeout(() => {
          cpuSecondFlipRef.current = null;
          playCard();
          setFlipped([i, j]);
        }, CPU_SECOND_FLIP_MS);
      } catch {
        cpuScheduledRef.current = false;
        setTurnOwner('player');
      }
    }, CPU_THINK_MS[cpuDifficulty]);

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
    cpuDifficulty,
    playerPairs,
    cpuPairs,
    versusOutcome,
    won,
    lost,
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
    if (flipped.length >= 2) return;
    playCard();
    setFlipped((f) => [...f, index]);
  };

  const handleHint = () => {
    if (mode === 'versus') return;
    if (locks || won || lost || flipped.length > 0 || hintFlash.length > 0) return;
    const pair = hintPairIndices(cards);
    if (!pair) return;
    setHintFlash(pair);
    setCpuMemory((mem) =>
      rememberRevealed(mem, cards, pair, turnRef.current, cpuDifficulty, pairCount),
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

  const themeMax = maxPairsForTheme(themeId);
  const pairChoices = PAIR_OPTIONS.filter(({ count }) => count <= themeMax);
  const sprintLimit = sprintLimitSec(pairCount);
  const remain = Math.max(0, sprintLimit - elapsed);
  const canHint =
    mode !== 'versus' &&
    !locks &&
    !won &&
    !lost &&
    flipped.length === 0 &&
    hintFlash.length === 0;
  const themeLabel = THEME_OPTIONS.find((t) => t.id === themeId)?.label ?? themeId;
  const boardWide =
    pairCount >= 18
      ? 'w-[min(96vw,720px)]'
      : pairCount >= 12
        ? 'w-[min(94vw,560px)]'
        : 'w-[min(94vw,440px)]';

  const overlayOpen = won || lost || versusOutcome !== null;

  const dismissTip = () => {
    setShowTip(false);
    saveTipsDismissed();
  };

  const settingsSummary = [
    themeLabel,
    `${pairCount} 對`,
    mode === 'classic'
      ? '經典'
      : mode === 'sprint'
        ? `衝刺 ${sprintLimit}s`
        : mode === 'versus'
          ? `對戰 · ${CPU_DIFFICULTY_OPTIONS.find((d) => d.id === cpuDifficulty)?.label ?? ''}`
          : '洞察特牌',
  ].join(' · ');

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start sm:justify-center p-3 sm:p-4 gap-2 sm:gap-3 relative"
      style={{
        backgroundColor: '#1e293b',
        backgroundImage: [
          'linear-gradient(rgba(15,23,42,0.5), rgba(15,23,42,0.72))',
          `url(${import.meta.env.BASE_URL}table-bg.jpg)`,
        ].join(', '),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <BackToMenu />
      <h1 className="text-xl sm:text-2xl font-bold tracking-wide mt-1">記憶配對</h1>

      {showTip && (
        <div
          className="w-full max-w-xl rounded-xl border border-sky-500/40 bg-slate-900/85 px-3 py-2 text-sm text-slate-200 flex gap-2 items-start"
          role="note"
        >
          <p className="flex-1 leading-snug">
            點兩張牌翻開；圖案相同即配對留下。對戰時輪流翻，配對成功可再翻一次。大盤面可先收合設定騰出空間。
          </p>
          <button
            type="button"
            onClick={dismissTip}
            className="shrink-0 min-h-[36px] px-3 rounded-lg border border-slate-500 text-slate-200 touch-manipulation"
            aria-label="關閉提示"
          >
            知道了
          </button>
        </div>
      )}

      <div className="w-full max-w-xl flex flex-col gap-2 items-center">
        <button
          type="button"
          onClick={() => setSettingsOpen((o) => !o)}
          className="min-h-[40px] px-4 rounded-xl border border-slate-500/70 bg-slate-800/80 text-slate-200 text-sm touch-manipulation w-full sm:w-auto"
          aria-expanded={settingsOpen}
          aria-controls="mm-settings"
        >
          {settingsOpen ? '收合設定 ▲' : `設定 · ${settingsSummary} ▼`}
        </button>

        {settingsOpen && (
          <div id="mm-settings" className="w-full flex flex-col gap-2 items-center">
            <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="模式">
              {(
                [
                  { id: 'classic' as const, label: '經典' },
                  { id: 'sprint' as const, label: `衝刺 ${sprintLimit}s` },
                  { id: 'versus' as const, label: '對戰 CPU' },
                  { id: 'special' as const, label: '洞察特牌' },
                ] as const
              ).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => restart(pairCount, id, themeId, cpuDifficulty)}
                  className={`min-h-[44px] px-4 rounded-full border touch-manipulation text-sm ${
                    mode === id
                      ? 'border-emerald-400 bg-emerald-500/25 text-emerald-100'
                      : 'border-slate-600 bg-slate-800/80 text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="牌組">
              {THEME_OPTIONS.map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => restart(pairCount, mode, id, cpuDifficulty)}
                  className={`min-h-[44px] px-4 rounded-full border touch-manipulation text-sm ${
                    themeId === id
                      ? 'border-violet-400 bg-violet-500/25 text-violet-100'
                      : 'border-slate-600 bg-slate-800/80 text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="盤面大小">
              {pairChoices.map(({ count, label }) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => restart(count, mode, themeId, cpuDifficulty)}
                  className={`min-h-[44px] px-4 rounded-full border touch-manipulation text-sm ${
                    pairCount === count
                      ? 'border-sky-400 bg-sky-500/25 text-sky-100'
                      : 'border-slate-600 bg-slate-800/80 text-slate-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === 'versus' && (
              <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="CPU 難度">
                {CPU_DIFFICULTY_OPTIONS.map(({ id, label, blurb }) => (
                  <button
                    key={id}
                    type="button"
                    title={blurb}
                    onClick={() => restart(pairCount, mode, themeId, id)}
                    className={`min-h-[44px] px-4 rounded-full border touch-manipulation text-sm ${
                      cpuDifficulty === id
                        ? 'border-rose-400 bg-rose-500/25 text-rose-100'
                        : 'border-slate-600 bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    CPU · {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-sm text-slate-300 text-center max-w-xl px-1">
        {themeLabel} · {pairCount} 對
        {mode === 'versus' ? (
          <>
            {' '}
            · 你 {playerPairs} : {cpuPairs} CPU
            {' · '}
            <span className={turnOwner === 'cpu' ? 'text-rose-300 font-medium' : 'text-emerald-300 font-medium'}>
              {turnOwner === 'player' ? '你的回合' : 'CPU 思考中…'}
            </span>
            {versusWins > 0 ? ` · 勝場 ${versusWins}` : ''}
          </>
        ) : (
          <>
            {' · '}翻牌 {moves}
            {' · '}連擊 {combo}
            {' · '}分數 {score}
            {mode === 'sprint' ? ` · 剩餘 ${remain}s` : ` · ${elapsed}s`}
            {mode === 'classic' && bestMoves != null ? ` · 最佳翻牌 ${bestMoves}` : ''}
            {mode === 'classic' && bestTime != null ? ` · 最佳時間 ${bestTime}s` : ''}
            {mode === 'sprint' && bestSprint != null ? ` · 最佳 ${bestSprint}s` : ''}
            {bestScore != null ? ` · 最高分 ${bestScore}` : ''}
            {mode === 'special' ? ` · 洞察×${peekCharges}` : ''}
          </>
        )}
      </p>

      <div
        className={`relative grid ${gridColsClass(pairCount)} ${gridGapClass(pairCount)} ${boardWide}`}
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

      <div className="flex flex-wrap justify-center gap-2">
        {mode !== 'versus' && (
          <button
            type="button"
            onClick={handleHint}
            disabled={!canHint}
            className="min-h-[44px] px-5 rounded-xl border border-amber-500/50 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25 disabled:opacity-40 font-medium touch-manipulation"
          >
            提示
          </button>
        )}
        {mode === 'special' && (
          <button
            type="button"
            onClick={armPeek}
            disabled={peekCharges <= 0 || peekArmed || locks || won || lost || flipped.length > 0}
            className={`min-h-[44px] px-5 rounded-xl border font-medium touch-manipulation disabled:opacity-40 ${
              peekArmed
                ? 'border-amber-300 bg-amber-400/30 text-amber-50'
                : 'border-amber-500/50 bg-amber-500/15 text-amber-100'
            }`}
          >
            {peekArmed ? '點牌窺視中' : `使用洞察 (${peekCharges})`}
          </button>
        )}
        <button
          type="button"
          onClick={() => restart()}
          className="min-h-[44px] px-5 rounded-xl bg-slate-700 hover:bg-slate-600 font-medium touch-manipulation"
        >
          重開一局
        </button>
      </div>

      {mode === 'special' && (
        <p className="text-xs text-slate-400 text-center max-w-md">
          金色「洞察」對配對成功後可窺視任一張背面牌——何時用掉是關鍵決策。
        </p>
      )}
      {mode === 'versus' && (
        <p className="text-xs text-slate-400 text-center max-w-md">
          輪流翻牌；配對成功可再翻一次。CPU 記性會隨時間衰退，難度越高記得越牢。
        </p>
      )}

      {overlayOpen && mode !== 'versus' && won && (
        <ResultOverlay
          title="全部配對！"
          variant="win"
          badge={newRecord ? '新紀錄' : undefined}
          stats={[
            { label: '牌組', value: themeLabel },
            { label: '翻牌次數', value: moves },
            { label: '用時', value: `${elapsed}s` },
            { label: '連擊分數', value: score },
            { label: '配對數', value: pairCount },
            {
              label: mode === 'sprint' ? '最佳衝刺' : '最佳翻牌',
              value:
                mode === 'sprint'
                  ? `${bestSprint ?? elapsed}s`
                  : (bestMoves ?? moves),
            },
          ]}
          onPrimary={() => restart()}
        />
      )}
      {overlayOpen && mode !== 'versus' && lost && (
        <ResultOverlay
          title="時間到"
          variant="lose"
          subtitle={`衝刺限時 ${sprintLimit} 秒 · ${themeLabel}`}
          stats={[
            { label: '翻牌次數', value: moves },
            { label: '已配對', value: cards.filter((c) => c.matched).length / 2 },
            { label: '分數', value: score },
          ]}
          onPrimary={() => restart()}
        />
      )}
      {versusOutcome && (
        <ResultOverlay
          title={
            versusOutcome === 'win' ? '你贏了！' : versusOutcome === 'lose' ? 'CPU 獲勝' : '平手'
          }
          variant={versusOutcome === 'win' ? 'win' : versusOutcome === 'lose' ? 'lose' : 'neutral'}
          badge={versusOutcome === 'win' && newRecord ? '勝場 +1' : undefined}
          stats={[
            { label: '比數', value: `${playerPairs} : ${cpuPairs}` },
            { label: 'CPU', value: CPU_DIFFICULTY_OPTIONS.find((d) => d.id === cpuDifficulty)?.label ?? '' },
            { label: '盤面', value: `${themeLabel} · ${pairCount} 對` },
            { label: '翻牌次數', value: moves },
            { label: '累計勝場', value: versusWins },
          ]}
          onPrimary={() => restart()}
        />
      )}
    </div>
  );
}

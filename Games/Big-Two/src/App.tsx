import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ScoreFlash } from '@clubhouse/shared/ScoreFlash';
import {
  playCard,
  playCapture,
  playGoal,
  playLose,
  playMove,
  playScore,
  playWin,
} from '@clubhouse/shared/synthAudio';
import { CardView } from './components/CardView';
import {
  FirstRunGuide,
  hasSeenFirstRunGuide,
} from './components/FirstRunGuide';
import { HandReviewPanel } from './components/HandReviewPanel';
import { MatchScoreboard } from './components/MatchScoreboard';
import { LOWEST_CARD_ID } from './game/cards';
import {
  DIFFICULTIES,
  chooseMove,
  personalityForSeat,
} from './game/cpu';
import {
  buildDailyShareText,
  computeDailyStreak,
  copyText,
  dailyMatchConfig,
  taipeiDateKey,
  todayDailyRecord,
} from './game/daily';
import {
  canPass,
  isOpeningPlay,
  outcome,
  pass,
  play,
  playsFor,
} from './game/engine';
import { advise } from './game/hints';
import {
  FORMAT_LABELS,
  MATCH_LENGTHS,
  MATCH_MODE_LABELS,
  TARGET_SCORES,
  advanceToNextHand,
  applyHandResult,
  createMatch,
  dealHand,
  defaultMatchConfig,
  isSeriesMode,
  matchProgressLabel,
} from './game/match';
import {
  MEMORY_STYLE_LABEL,
  NAMED_OPPONENTS,
  isOpponentUnlocked,
  ladderDifficulty,
  opponentById,
  opponentByIndex,
} from './game/opponents';
import { TYPE_LABEL, detectPlay } from './game/plays';
import { normalizeSeedCode, randomSeedCode } from './game/rng';
import { buildHandReview, isFlashyPlay } from './game/review';
import type { HandReview } from './game/review';
import {
  EMPTY_DAILY,
  EMPTY_LADDER,
  EMPTY_STATS,
  applyLadderResult,
  clearSavedMatch,
  loadDailyProgress,
  loadLadder,
  loadMatch,
  loadStats,
  recordDailyResult,
  recordHandResult,
  recordMatchResult,
  rememberSetup,
  saveDailyProgress,
  saveLadder,
  saveMatch,
  saveStats,
} from './game/storage';
import type { FormatRecords, LadderProgress } from './game/storage';
import { HAND_SIZE, HUMAN, SEATS } from './game/types';
import type {
  Card,
  DifficultyId,
  FormatKey,
  GameState,
  HouseRules,
  MatchConfig,
  MatchLength,
  MatchMode,
  MatchState,
  NamedOpponentId,
  Play,
  StraightRule,
  TargetScore,
} from './game/types';
import { feltBackgroundStyle, titleBackgroundStyle } from './artBackground';

type Screen = 'setup' | 'game';
type SetupTab = 'play' | 'ladder';

const CPU_DELAY = 700;
const SEAT_NAMES = ['你', '下家', '對家', '上家'];

export default function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('setup');
  const [setupTab, setSetupTab] = useState<SetupTab>('play');
  const [stats, setStats] = useState(EMPTY_STATS);
  const [config, setConfig] = useState<MatchConfig>(() => defaultMatchConfig());
  const [seedInput, setSeedInput] = useState('');
  const [match, setMatch] = useState<MatchState | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [history, setHistory] = useState<GameState[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [hintReason, setHintReason] = useState<string | null>(null);
  const [hintPass, setHintPass] = useState(false);
  const [hintCards, setHintCards] = useState<string[]>([]);
  const [review, setReview] = useState<HandReview | null>(null);
  const [callout, setCallout] = useState<{ text: string; key: number } | null>(null);
  const [showFirstRun, setShowFirstRun] = useState(() => !hasSeenFirstRunGuide());
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [ladder, setLadder] = useState<LadderProgress>(EMPTY_LADDER);
  const [dailyProgress, setDailyProgress] = useState(EMPTY_DAILY);
  const [shareCopied, setShareCopied] = useState(false);
  const [dailyDate] = useState(() => taipeiDateKey());
  const handRecorded = useRef(false);
  const matchRecorded = useRef(false);
  const resultSoundPlayed = useRef(false);
  const prevTableRef = useRef<string | null>(null);

  useEffect(() => {
    const saved = loadStats();
    setStats(saved);
    setConfig({
      ...defaultMatchConfig(saved.lastDifficulty, {
        straights: saved.lastStraights,
        sizeLadder: saved.lastSizeLadder,
        deuceDouble: saved.lastDeuceDouble,
      }),
      mode: saved.lastMatchMode === 'daily' ? 'hands' : saved.lastMatchMode,
      hands: saved.lastMatchHands,
      target: saved.lastMatchTarget,
    });
    const pending = loadMatch();
    setResumeAvailable(Boolean(pending && pending.phase !== 'matchOver'));
    setLadder(loadLadder());
    setDailyProgress(loadDailyProgress());

    // Playtest-only: `?demo=mvp` mounts a finished series; `?demo=single`
    // mounts a compact single-hand settlement for screenshots.
    if (typeof window !== 'undefined') {
      const demo = new URLSearchParams(window.location.search).get('demo');
      if (demo === 'mvp') {
        const demoMatch = buildMvpDemoMatch();
        setMatch(demoMatch);
        setConfig(demoMatch.config);
        setReview(buildMvpDemoReview());
        setScreen('game');
        setState(null);
      } else if (demo === 'single') {
        const demoMatch = buildSingleDemoMatch();
        setMatch(demoMatch);
        setConfig(demoMatch.config);
        setReview(buildSingleDemoReview());
        setScreen('game');
        setState(null);
      }
    }
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen, setupTab]);

  const beginHand = useCallback((nextMatch: MatchState) => {
    const dealt = dealHand(nextMatch);
    setMatch(nextMatch);
    setState(dealt);
    setHistory([]);
    setSelected([]);
    setHintReason(null);
    setHintPass(false);
    setHintCards([]);
    setReview(null);
    handRecorded.current = false;
    resultSoundPlayed.current = false;
    prevTableRef.current = null;
    saveMatch(nextMatch);
  }, []);

  const startMatch = useCallback(
    (nextConfig: MatchConfig) => {
      const seeded: MatchConfig = {
        ...nextConfig,
        seedCode: normalizeSeedCode(nextConfig.seedCode || seedInput || randomSeedCode()),
        rules: { ...nextConfig.rules },
        ladderOpponentId: nextConfig.ladderOpponentId ?? null,
      };
      const created = createMatch(seeded);
      matchRecorded.current = false;
      setShareCopied(false);
      setStats((prev) => {
        const next = rememberSetup(prev, seeded);
        saveStats(next);
        return next;
      });
      setConfig(seeded);
      setScreen('game');
      setResumeAvailable(false);
      beginHand(created);
    },
    [beginHand, seedInput],
  );

  const startDaily = useCallback(() => {
    startMatch(dailyMatchConfig(dailyDate));
  }, [startMatch, dailyDate]);

  const startLadder = useCallback(
    (index: number) => {
      const opponent = opponentByIndex(index);
      if (!opponent || !isOpponentUnlocked(index, ladder.clearedCount)) return;
      startMatch({
        mode: 'single',
        hands: 4,
        target: 100,
        difficulty: ladderDifficulty(opponent),
        rules: { ...defaultMatchConfig().rules },
        seedCode: randomSeedCode(),
        ladderOpponentId: opponent.id,
      });
    },
    [startMatch, ladder.clearedCount],
  );

  const resumeMatch = useCallback(() => {
    const pending = loadMatch();
    if (!pending || pending.phase === 'matchOver') return;
    matchRecorded.current = false;
    setConfig(pending.config);
    setScreen('game');
    if (pending.phase === 'handOver') {
      setMatch(pending);
      setState(null);
      setReview(null);
      const advanced = advanceToNextHand(pending);
      beginHand(advanced);
      return;
    }
    beginHand(pending);
  }, [beginHand]);

  // CPU seats act on a delay so the table is readable.
  useEffect(() => {
    if (!state || state.phase !== 'playing' || state.turn === HUMAN) return;
    const timer = setTimeout(() => {
      setState((current) => {
        if (!current || current.phase !== 'playing' || current.turn === HUMAN) return current;
        const move = chooseMove(current);
        return move === null ? pass(current) : play(current, move.cards);
      });
    }, CPU_DELAY);
    return () => clearTimeout(timer);
  }, [state]);

  // Juice: animate / announce whenever the table play changes.
  useEffect(() => {
    if (!state?.table) {
      prevTableRef.current = null;
      return;
    }
    const key = `${state.tableOwner}:${state.table.cards.map((c) => c.id).join(',')}`;
    if (key === prevTableRef.current) return;
    prevTableRef.current = key;
    playCard();
    if (isFlashyPlay(state.table)) {
      const label = TYPE_LABEL[state.table.type];
      setCallout({ text: label, key: Date.now() });
      if (state.table.type === 'straightFlush' || state.table.type === 'quads') playGoal();
      else if (state.table.type === 'fullHouse') playCapture();
      else playScore();
    }
  }, [state]);

  const result = useMemo(() => (state ? outcome(state) : null), [state]);

  // Hand finished → update match balances, stats, show review.
  useEffect(() => {
    if (!result || !state || !match || handRecorded.current) return;
    if (match.phase !== 'playing') return;
    handRecorded.current = true;

    const won = result.winner === HUMAN;
    if (!resultSoundPlayed.current) {
      resultSoundPlayed.current = true;
      if (won) playWin();
      else playLose();
    }

    const delta = won ? result.pot : -result.scores[HUMAN].penalty;
    const nextMatch = applyHandResult(match, result, state.seedCode, state);
    setMatch(nextMatch);
    saveMatch(nextMatch);
    setReview(buildHandReview(state, result));

    setStats((prev) => {
      let next = recordHandResult(prev, won, delta);
      if (nextMatch.phase === 'matchOver' && !matchRecorded.current) {
        matchRecorded.current = true;
        const matchWon = nextMatch.winner === HUMAN;
        next = recordMatchResult(
          next,
          matchWon,
          nextMatch.balances[HUMAN],
          nextMatch.config,
        );
        clearSavedMatch();

        if (nextMatch.config.mode === 'daily') {
          setDailyProgress((dailyPrev) => {
            const updated = recordDailyResult(
              dailyPrev,
              dailyDate,
              nextMatch.balances[HUMAN],
              true,
            );
            saveDailyProgress(updated);
            return updated;
          });
        }

        if (nextMatch.config.ladderOpponentId) {
          const opp = opponentById(nextMatch.config.ladderOpponentId);
          if (opp) {
            const index = NAMED_OPPONENTS.findIndex((o) => o.id === opp.id);
            setLadder((ladderPrev) => {
              const updated = applyLadderResult(
                ladderPrev,
                index,
                matchWon,
                opp.id as NamedOpponentId,
              );
              saveLadder(updated);
              return updated;
            });
          }
        }
      }
      saveStats(next);
      return next;
    });
  }, [result, state, match, dailyDate]);

  const myTurn = state?.phase === 'playing' && state.turn === HUMAN;

  const selectedCards = useMemo(
    () => (state ? state.hands[HUMAN].filter((card) => selected.includes(card.id)) : []),
    [state, selected],
  );

  const candidate = useMemo(
    () => (state && selectedCards.length ? detectPlay(selectedCards, state.rules.straights) : null),
    [state, selectedCards],
  );

  const playable = useMemo(() => {
    if (!state || !myTurn || !candidate) return false;
    return playsFor(state).some(
      (option) =>
        option.cards.length === candidate.cards.length &&
        option.cards.every((card) => selected.includes(card.id)),
    );
  }, [state, myTurn, candidate, selected]);

  const toggle = useCallback(
    (card: Card) => {
      if (!myTurn) return;
      setHintReason(null);
      setHintPass(false);
      setHintCards([]);
      setSelected((prev) =>
        prev.includes(card.id) ? prev.filter((id) => id !== card.id) : [...prev, card.id],
      );
    },
    [myTurn],
  );

  const submit = useCallback(() => {
    if (!state || !playable) return;
    setHistory((h) => [...h, state]);
    setState(play(state, selectedCards));
    setSelected([]);
    setHintReason(null);
    setHintPass(false);
    setHintCards([]);
  }, [state, playable, selectedCards]);

  const doPass = useCallback(() => {
    if (!state || !canPass(state) || !myTurn) return;
    setHistory((h) => [...h, state]);
    setState(pass(state));
    playMove();
    setSelected([]);
    setHintReason(null);
    setHintPass(false);
    setHintCards([]);
  }, [state, myTurn]);

  const canUndo = Boolean(state) && history.length > 0 && myTurn && state!.phase === 'playing';

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setState(prev);
    setSelected([]);
    setHintReason(null);
    setHintPass(false);
    setHintCards([]);
  }, [canUndo, history]);

  const showHint = useCallback(() => {
    if (!state || !myTurn) return;
    const advice = advise(state);
    setHintReason(advice.reason);
    if (advice.play === null) {
      setHintPass(true);
      setHintCards([]);
      setSelected([]);
      return;
    }
    setHintPass(false);
    setHintCards(advice.play.cards.map((card) => card.id));
    setSelected(advice.play.cards.map((card) => card.id));
  }, [state, myTurn]);

  const continueAfterReview = useCallback(() => {
    if (!match) return;
    if (match.phase === 'matchOver') {
      if (match.config.mode === 'daily') {
        startDaily();
        return;
      }
      if (match.config.ladderOpponentId) {
        const index = NAMED_OPPONENTS.findIndex((o) => o.id === match.config.ladderOpponentId);
        if (index >= 0) startLadder(index);
        return;
      }
      startMatch({
        ...match.config,
        seedCode: randomSeedCode(),
      });
      return;
    }
    const advanced = advanceToNextHand(match);
    beginHand(advanced);
  }, [match, beginHand, startMatch, startDaily, startLadder]);

  const handleDailyShare = useCallback(async () => {
    const today = todayDailyRecord(dailyProgress.records, dailyDate);
    const chips = match?.balances[HUMAN] ?? today?.bestChips ?? 0;
    const text = buildDailyShareText({
      date: dailyDate,
      seedCode: dailyMatchConfig(dailyDate).seedCode,
      chips,
      bestChips: today?.bestChips ?? chips,
      streak: computeDailyStreak(dailyProgress.records, dailyDate),
      completed: Boolean(today?.completed) || match?.phase === 'matchOver',
    });
    const ok = await copyText(text);
    setShareCopied(ok);
  }, [dailyProgress, dailyDate, match]);

  const seatLabel = useCallback(
    (seat: number): string => {
      if (seat === 0) return SEAT_NAMES[0];
      if (match?.config.ladderOpponentId && seat === 1) {
        const opp = opponentById(match.config.ladderOpponentId);
        if (opp) return opp.name;
      }
      const person = state
        ? personalityForSeat(seat, state.seatPersonalities)
        : personalityForSeat(seat);
      return person ? `${SEAT_NAMES[seat]}` : SEAT_NAMES[seat];
    },
    [match, state],
  );

  if (screen === 'setup') {
    return (
      <>
        {showFirstRun && <FirstRunGuide onClose={() => setShowFirstRun(false)} />}
        <Setup
          config={config}
          setConfig={setConfig}
          seedInput={seedInput}
          setSeedInput={setSeedInput}
          stats={stats}
          resumeAvailable={resumeAvailable}
          setupTab={setupTab}
          setSetupTab={setSetupTab}
          ladder={ladder}
          dailyDate={dailyDate}
          dailyProgress={dailyProgress}
          shareCopied={shareCopied}
          onShareDaily={handleDailyShare}
          onStart={() => startMatch({ ...config, seedCode: seedInput, ladderOpponentId: null })}
          onStartDaily={startDaily}
          onStartLadder={startLadder}
          onResume={resumeMatch}
        />
      </>
    );
  }

  if (!match) return <div />;

  const opening = state ? isOpeningPlay(state) : false;
  const showReview = Boolean(review && match.phase !== 'playing');
  const ladderOpp = match.config.ladderOpponentId
    ? opponentById(match.config.ladderOpponentId)
    : null;

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pb-4 pt-14 sm:pt-4">
      <BackToMenu />

      <div className="relative w-full max-w-2xl flex flex-col gap-3">
        <MatchScoreboard match={match} progress={matchProgressLabel(match)} />

        {ladderOpp && (
          <p className="text-center text-xs text-amber-200/70">
            挑戰 {ladderOpp.name} · {MEMORY_STYLE_LABEL[ladderOpp.style]}
          </p>
        )}

        {state && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((seat) => {
                const person = personalityForSeat(seat, state.seatPersonalities);
                const name =
                  ladderOpp && seat === 1 ? ladderOpp.name : SEAT_NAMES[seat];
                return (
                  <Opponent
                    key={seat}
                    name={name}
                    personality={person?.name ?? ''}
                    count={state.hands[seat].length}
                    active={state.turn === seat && state.phase === 'playing'}
                    passed={state.passed.includes(seat)}
                  />
                );
              })}
            </div>

            <Table state={state} seatLabel={seatLabel} />

            {callout && (
              <ScoreFlash
                text={callout.text}
                tone="good"
                flashKey={callout.key}
                onDone={() => setCallout(null)}
              />
            )}

            <Status
              state={state}
              candidate={candidate}
              playable={playable}
              opening={opening}
              hintReason={hintReason}
              seatLabel={seatLabel}
            />

            <section aria-label="你的手牌">
              <div className="bt-hand flex justify-center px-2 pt-3">
                {state.hands[HUMAN].map((card) => (
                  <CardView
                    key={card.id}
                    card={card}
                    selected={selected.includes(card.id)}
                    hinted={hintCards.includes(card.id)}
                    onClick={myTurn ? () => toggle(card) : undefined}
                  />
                ))}
              </div>
            </section>

            <div className="flex gap-2 justify-center">
              <button
                type="button"
                onClick={submit}
                disabled={!playable}
                className="flex-1 min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 font-black touch-manipulation"
              >
                出牌
              </button>
              <button
                type="button"
                onClick={doPass}
                disabled={!myTurn || !canPass(state)}
                className={`min-h-[48px] px-5 rounded-xl border font-bold disabled:opacity-40 touch-manipulation ${
                  hintPass
                    ? 'border-sky-400 bg-sky-500/15 text-sky-200'
                    : 'border-slate-600 hover:bg-slate-800'
                }`}
              >
                Pass
              </button>
              <button
                type="button"
                onClick={handleUndo}
                disabled={!canUndo}
                className="min-h-[48px] px-3 rounded-xl border border-slate-700 hover:bg-slate-800 disabled:opacity-40 text-sm touch-manipulation"
                title="復原"
              >
                復原
              </button>
              <button
                type="button"
                onClick={showHint}
                disabled={!myTurn}
                className="min-h-[48px] px-4 rounded-xl border border-slate-700 hover:bg-slate-800 disabled:opacity-40 text-sm touch-manipulation"
              >
                提示
              </button>
            </div>

            {selected.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelected([]);
                  setHintReason(null);
                  setHintPass(false);
                  setHintCards([]);
                }}
                className="mx-auto text-xs text-slate-400 underline min-h-[44px] touch-manipulation"
              >
                清除選取
              </button>
            )}
          </>
        )}
      </div>

      {showReview && review && (
        <HandReviewPanel
          review={review}
          match={match}
          matchOver={match.phase === 'matchOver'}
          onContinue={continueAfterReview}
          onSetup={() => {
            clearSavedMatch();
            setScreen('setup');
            setMatch(null);
            setState(null);
            setReview(null);
          }}
          shareLabel={
            match.config.mode === 'daily'
              ? shareCopied
                ? '已複製分享文案'
                : '複製分享'
              : null
          }
          onShare={match.config.mode === 'daily' ? handleDailyShare : null}
        />
      )}
    </div>
  );
}

function Opponent({
  name,
  personality,
  count,
  active,
  passed,
}: {
  name: string;
  personality: string;
  count: number;
  active: boolean;
  passed: boolean;
}): React.ReactElement {
  return (
    <div
      className={`rounded-xl px-2 py-2 text-center text-xs transition-transform duration-200 ${
        active
          ? 'bg-indigo-500/15 ring-1 ring-indigo-400/50 scale-[1.02]'
          : 'bg-slate-900/50'
      } ${count <= 3 && count > 0 ? 'bt-threat' : ''}`}
    >
      <div className="font-bold">
        {name}
        {passed && <span className="text-slate-500 font-normal"> · pass</span>}
      </div>
      {personality && (
        <div className="text-[10px] text-indigo-200/50 truncate">{personality}</div>
      )}
      <div className={`tabular-nums ${count <= 3 ? 'text-amber-300 font-black' : 'text-slate-400'}`}>
        {count} 張
      </div>
    </div>
  );
}

function Table({
  state,
  seatLabel,
}: {
  state: GameState;
  seatLabel: (seat: number) => string;
}): React.ReactElement {
  const tableKey = state.table
    ? `${state.tableOwner}-${state.table.cards.map((c) => c.id).join(',')}`
    : 'empty';

  return (
    <section
      className="bt-felt relative rounded-2xl p-4 min-h-[7rem] flex flex-col items-center justify-center gap-2 overflow-hidden"
      style={feltBackgroundStyle()}
      aria-label="檯面"
    >
      {state.table ? (
        <>
          <div key={tableKey} className="flex gap-1 bt-played">
            {state.table.cards.map((card) => (
              <CardView key={card.id} card={card} />
            ))}
          </div>
          <p className="text-xs text-indigo-200/70">
            {seatLabel(state.tableOwner ?? 0)} 的 {TYPE_LABEL[state.table.type]}
          </p>
        </>
      ) : (
        <p className="text-indigo-200/50 text-sm">
          {isOpeningPlay(state) ? '開局：持 ♣3 者先出，且必須包含 ♣3' : '新的一輪，任意出牌'}
        </p>
      )}
    </section>
  );
}

function Status({
  state,
  candidate,
  playable,
  opening,
  hintReason,
  seatLabel,
}: {
  state: GameState;
  candidate: Play | null;
  playable: boolean;
  opening: boolean;
  hintReason: string | null;
  seatLabel: (seat: number) => string;
}): React.ReactElement {
  let message: string;
  let tone = 'text-indigo-200';

  if (hintReason) {
    message = hintReason;
    tone = 'text-sky-300';
  } else if (state.phase === 'over') {
    message = '牌局結束';
  } else if (state.turn !== HUMAN) {
    const person = personalityForSeat(state.turn, state.seatPersonalities);
    message = person
      ? `${seatLabel(state.turn)}（${person.name}）思考中…`
      : `${seatLabel(state.turn)}思考中…`;
  } else if (!candidate) {
    message = state.table
      ? `選出牌壓過 ${TYPE_LABEL[state.table.type]}，或 Pass`
      : '你領出，選一手牌';
  } else if (playable) {
    message = `${TYPE_LABEL[candidate.type]} — 可以出`;
    tone = 'text-emerald-300';
  } else if (opening && !candidate.cards.some((c) => c.id === LOWEST_CARD_ID)) {
    message = '開局第一手必須包含 ♣3';
    tone = 'text-amber-300';
  } else if (state.table && candidate.cards.length !== state.table.cards.length) {
    message = `張數要跟檯面一樣（${state.table.cards.length} 張）`;
    tone = 'text-amber-300';
  } else {
    message = `${TYPE_LABEL[candidate.type]} — 壓不過`;
    tone = 'text-amber-300';
  }

  return (
    <p className={`text-center text-sm font-bold min-h-[1.5rem] px-1 ${tone}`}>{message}</p>
  );
}

function Setup({
  config,
  setConfig,
  seedInput,
  setSeedInput,
  stats,
  resumeAvailable,
  setupTab,
  setSetupTab,
  ladder,
  dailyDate,
  dailyProgress,
  shareCopied,
  onShareDaily,
  onStart,
  onStartDaily,
  onStartLadder,
  onResume,
}: {
  config: MatchConfig;
  setConfig: React.Dispatch<React.SetStateAction<MatchConfig>>;
  seedInput: string;
  setSeedInput: (value: string) => void;
  stats: ReturnType<typeof loadStats>;
  resumeAvailable: boolean;
  setupTab: SetupTab;
  setSetupTab: (tab: SetupTab) => void;
  ladder: LadderProgress;
  dailyDate: string;
  dailyProgress: ReturnType<typeof loadDailyProgress>;
  shareCopied: boolean;
  onShareDaily: () => void;
  onStart: () => void;
  onStartDaily: () => void;
  onStartLadder: (index: number) => void;
  onResume: () => void;
}): React.ReactElement {
  const setDifficulty = (id: DifficultyId) =>
    setConfig((prev) => ({ ...prev, difficulty: id }));
  const setStraights = (rule: StraightRule) =>
    setConfig((prev) => ({ ...prev, rules: { ...prev.rules, straights: rule } }));
  const setMode = (mode: MatchMode) =>
    setConfig((prev) => ({ ...prev, mode, ladderOpponentId: null }));
  const setHands = (hands: MatchLength) => setConfig((prev) => ({ ...prev, hands }));
  const setTarget = (target: TargetScore) => setConfig((prev) => ({ ...prev, target }));
  const toggleRule = (key: keyof Pick<HouseRules, 'sizeLadder' | 'deuceDouble'>) =>
    setConfig((prev) => ({
      ...prev,
      rules: { ...prev.rules, [key]: !prev.rules[key] },
    }));

  const today = todayDailyRecord(dailyProgress.records, dailyDate);
  const streak = computeDailyStreak(dailyProgress.records, dailyDate);
  const dailySeed = dailyMatchConfig(dailyDate).seedCode;
  const playModes: MatchMode[] = ['single', 'hands', 'target'];

  return (
    <div
      className="bt-title-shell min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={titleBackgroundStyle()}
    >
      <BackToMenu />

      <div className="w-full max-w-md flex flex-col gap-5">
        <header className="bt-title-hero text-center">
          <h1 className="text-4xl font-black tracking-tight">大老二</h1>
          <p className="text-indigo-200/60 text-sm mt-1">
            單局・系列賽・每日牌桌 · 四人各 {HAND_SIZE} 張 · 2 最大
          </p>
        </header>

        <div className="flex gap-2" role="tablist" aria-label="選單">
          {(
            [
              ['play', '開打'],
              ['ladder', '對手梯'],
            ] as [SetupTab, string][]
          ).map(([tab, label]) => (
            <button
              key={tab}
              type="button"
              role="tab"
              aria-selected={setupTab === tab}
              onClick={() => setSetupTab(tab)}
              className={`flex-1 min-h-[44px] rounded-xl border font-bold touch-manipulation ${
                setupTab === tab
                  ? 'border-indigo-400 bg-indigo-500/15'
                  : 'border-slate-700 hover:bg-slate-800/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {setupTab === 'ladder' ? (
          <section aria-label="具名對手解鎖梯" className="flex flex-col gap-3">
            <p className="text-sm text-indigo-100/70 leading-relaxed">
              贏過前一位才解鎖下一位。每位對手有不同出牌記憶風格。
            </p>
            <ul className="flex flex-col gap-2">
              {NAMED_OPPONENTS.map((op, index) => {
                const unlocked = isOpponentUnlocked(index, ladder.clearedCount);
                const cleared = Boolean(ladder.cleared[op.id]);
                return (
                  <li key={op.id}>
                    <button
                      type="button"
                      disabled={!unlocked}
                      onClick={() => unlocked && onStartLadder(index)}
                      className={`w-full text-left min-h-[56px] rounded-xl px-4 py-3 border touch-manipulation ${
                        unlocked
                          ? 'border-indigo-400/50 bg-indigo-500/10 hover:bg-indigo-500/20'
                          : 'border-slate-800 bg-slate-900/40 opacity-60'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-bold">
                          {unlocked ? op.name : '？？？'}
                          {cleared && (
                            <span className="ml-2 text-[10px] font-normal text-emerald-300">
                              已擊敗
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] text-indigo-200/60">
                          {unlocked ? MEMORY_STYLE_LABEL[op.style] : '未解鎖'}
                        </span>
                      </div>
                      {unlocked && (
                        <p className="mt-1 text-xs text-indigo-100/55 leading-relaxed">
                          {op.blurb}
                        </p>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : (
          <>
            <section
              className="bt-felt rounded-2xl p-4 text-sm"
              style={feltBackgroundStyle()}
              aria-label="每日牌桌"
            >
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-bold text-indigo-200">每日牌桌</h2>
                <span className="text-[11px] text-indigo-100/50">{dailyDate} · 台北</span>
              </div>
              <p className="mt-1 text-indigo-100/65 text-xs leading-relaxed">
                固定 5 局比總分；種子與對手全天相同。連續 {streak} 天
                {today
                  ? ` · 今日最佳 ${today.bestChips >= 0 ? '+' : ''}${today.bestChips}`
                  : ' · 尚未挑戰'}
              </p>
              <p className="mt-1 text-[11px] font-mono text-indigo-100/40">種子 {dailySeed}</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={onStartDaily}
                  className="flex-1 min-h-[48px] rounded-xl bg-amber-600 hover:bg-amber-500 font-black touch-manipulation"
                >
                  挑戰今日
                </button>
                <button
                  type="button"
                  onClick={onShareDaily}
                  disabled={!today}
                  className="min-h-[48px] px-4 rounded-xl border border-amber-400/40 text-amber-100 text-sm font-bold disabled:opacity-40 touch-manipulation"
                >
                  {shareCopied ? '已複製' : '複製分享'}
                </button>
              </div>
            </section>

            <section className="bt-felt rounded-2xl p-4 text-sm" style={feltBackgroundStyle()}>
              <h2 className="font-bold mb-2 text-indigo-200">三件事就會玩</h2>
              <ul className="text-indigo-100/70 leading-relaxed list-disc pl-4 space-y-1">
                <li>
                  大小：<strong className="text-indigo-300">2 &gt; A &gt; K &gt; … &gt; 3</strong>，
                  同點數再比花色 <strong className="text-indigo-300">♠ &gt; ♥ &gt; ♦ &gt; ♣</strong>
                </li>
                <li>
                  只出 1、2、5 張。<strong className="text-indigo-300">張數要跟檯面一樣</strong>
                </li>
                <li>單局／系列賽／每日分開記戰績；局末有 MVP</li>
              </ul>
            </section>

            <details
              className="bt-more-modes rounded-2xl border border-slate-700/80 bg-slate-900/40 px-4 py-3"
              open={isSeriesMode(config.mode)}
            >
              <summary className="min-h-[44px] cursor-pointer list-none touch-manipulation flex items-center justify-between gap-2 text-sm text-indigo-200 font-bold">
                <span>更多賽制</span>
                <span className="text-[11px] font-normal text-indigo-100/55">
                  {config.mode === 'single'
                    ? '目前：單局'
                    : config.mode === 'hands'
                      ? `目前：${config.hands} 局`
                      : `目前：先達 ${config.target}`}
                </span>
              </summary>
              <div className="mt-3 flex flex-col gap-2" role="group" aria-label="賽制">
                {playModes.map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setMode(mode)}
                    className={`text-left min-h-[44px] rounded-xl px-4 py-2 border transition-colors touch-manipulation ${
                      config.mode === mode
                        ? 'border-indigo-400 bg-indigo-500/15'
                        : 'border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="font-bold">{MATCH_MODE_LABELS[mode]}</span>
                    <span className="block text-xs text-indigo-100/55">
                      {mode === 'single'
                        ? '打完一局就結算'
                        : mode === 'hands'
                          ? '打完指定局數，比累計籌碼'
                          : '有人先累積到目標分就結束'}
                    </span>
                  </button>
                ))}
              </div>
              {config.mode === 'hands' && (
                <div className="mt-2 flex gap-2" role="group" aria-label="局數">
                  {MATCH_LENGTHS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setHands(n)}
                      className={`flex-1 min-h-[44px] rounded-xl border font-bold touch-manipulation ${
                        config.hands === n
                          ? 'border-indigo-400 bg-indigo-500/15'
                          : 'border-slate-700'
                      }`}
                    >
                      {n} 局
                    </button>
                  ))}
                </div>
              )}
              {config.mode === 'target' && (
                <div className="mt-2 flex gap-2" role="group" aria-label="目標分">
                  {TARGET_SCORES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setTarget(n)}
                      className={`flex-1 min-h-[44px] rounded-xl border font-bold touch-manipulation ${
                        config.target === n
                          ? 'border-indigo-400 bg-indigo-500/15'
                          : 'border-slate-700'
                      }`}
                    >
                      {n} 分
                    </button>
                  ))}
                </div>
              )}
            </details>

            <section>
              <h2 className="font-bold mb-2 text-sm text-indigo-200">難度</h2>
              <div className="flex flex-col gap-2">
                {DIFFICULTIES.map((info) => (
                  <button
                    key={info.id}
                    type="button"
                    onClick={() => setDifficulty(info.id)}
                    className={`text-left min-h-[44px] rounded-xl px-4 py-2 border transition-colors touch-manipulation ${
                      config.difficulty === info.id
                        ? 'border-indigo-400 bg-indigo-500/15'
                        : 'border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="font-bold">{info.label}</span>
                    <span className="block text-xs text-indigo-100/55">{info.blurb}</span>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-center text-xs text-indigo-100/60">
                三位對手各有個性：衝刺俠／控場手／記牌師
              </p>
            </section>

            <section>
              <h2 className="font-bold mb-1 text-sm text-indigo-200">家規</h2>
              <p className="text-[11px] text-indigo-100/50 mb-2">
                台灣常見計分預設全開；可依桌規關閉。
              </p>
              <div className="flex flex-col gap-2">
                {(
                  [
                    ['topCard', '順子比最大張（坊間常見）', 'A2345 最小、23456 最大'],
                    ['sequence', '順子照序列排（線上常見）', 'A2345 最小、10JQKA 最大'],
                  ] as [StraightRule, string, string][]
                ).map(([rule, label, detail]) => (
                  <button
                    key={rule}
                    type="button"
                    onClick={() => setStraights(rule)}
                    className={`text-left min-h-[44px] rounded-xl px-4 py-2 border transition-colors touch-manipulation ${
                      config.rules.straights === rule
                        ? 'border-indigo-400 bg-indigo-500/15'
                        : 'border-slate-700 hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="font-bold text-sm">{label}</span>
                    <span className="block text-xs text-indigo-100/60">{detail}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => toggleRule('sizeLadder')}
                  className={`text-left min-h-[44px] rounded-xl px-4 py-2 border transition-colors touch-manipulation ${
                    config.rules.sizeLadder
                      ? 'border-indigo-400 bg-indigo-500/15'
                      : 'border-slate-700 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="font-bold text-sm">
                    剩牌倍數 {config.rules.sizeLadder ? '開' : '關'}
                  </span>
                  <span className="block text-xs text-indigo-100/60">
                    剩 8／10／13 張分別 ×2／×3／×4
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => toggleRule('deuceDouble')}
                  className={`text-left min-h-[44px] rounded-xl px-4 py-2 border transition-colors touch-manipulation ${
                    config.rules.deuceDouble
                      ? 'border-indigo-400 bg-indigo-500/15'
                      : 'border-slate-700 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="font-bold text-sm">
                    留 2 加倍 {config.rules.deuceDouble ? '開' : '關'}
                  </span>
                  <span className="block text-xs text-indigo-100/60">
                    每留一張 2，牌分再乘 2
                  </span>
                </button>
              </div>
            </section>

            <label className="text-sm">
              <span className="font-bold text-indigo-200">種子碼</span>
              <span className="text-indigo-100/50 text-xs"> — 留空隨機；整場系列賽共用</span>
              <input
                value={seedInput}
                onChange={(event) => setSeedInput(event.target.value)}
                placeholder="例如 64aa2bl7"
                className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 px-3 focus:border-indigo-400 outline-none"
              />
            </label>

            {resumeAvailable && (
              <button
                type="button"
                onClick={onResume}
                className="min-h-[48px] rounded-2xl border border-amber-400/40 bg-amber-500/10 text-amber-100 font-bold touch-manipulation hover:bg-amber-500/20"
              >
                繼續未完的對局
              </button>
            )}

            <button
              type="button"
              onClick={onStart}
              className="min-h-[52px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-lg font-black touch-manipulation"
            >
              {isSeriesMode(config.mode) ? '開始系列賽' : '開始單局'}
            </button>

            {(stats.games > 0 || Object.values(stats.formats).some((f) => f.played > 0)) && (
              <div className="text-center text-xs text-indigo-100/50 leading-relaxed">
                {stats.games > 0 && (
                  <p>
                    {stats.games} 局 {stats.wins} 勝（
                    {((stats.wins / stats.games) * 100).toFixed(0)}%）．累計{' '}
                    {stats.chips >= 0 ? '+' : ''}
                    {stats.chips} 分
                  </p>
                )}
                {stats.matches > 0 && (
                  <p>
                    系列賽 {stats.matches} 場 {stats.matchWins} 勝
                    {stats.bestMatchStreak > 1 && `．最長連勝 ${stats.bestMatchStreak}`}
                    {stats.bestMatchChips !== 0 &&
                      `．單場最佳 ${stats.bestMatchChips >= 0 ? '+' : ''}${stats.bestMatchChips}`}
                  </p>
                )}
                <FormatRecordLine formats={stats.formats} />
              </div>
            )}
            <p className="text-center text-[11px] text-slate-600">
              四人局，單局平均勝率基準 {(100 / SEATS).toFixed(0)}%
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function FormatRecordLine({ formats }: { formats: FormatRecords }): React.ReactElement | null {
  const entries = (Object.keys(FORMAT_LABELS) as FormatKey[])
    .map((key) => ({ key, ...formats[key] }))
    .filter((entry) => entry.played > 0);
  if (entries.length === 0) return null;
  return (
    <p aria-label="賽制戰績" className="mt-1">
      賽制戰績{' '}
      {entries
        .map((entry) => `${FORMAT_LABELS[entry.key]} ${entry.wins}/${entry.played}`)
        .join(' · ')}
    </p>
  );
}

/** Synthetic finished series for `?demo=mvp` playtest screenshots. */
function buildMvpDemoMatch(): MatchState {
  const score = (seat: number, penalty: number) => ({
    seat,
    remaining: penalty,
    base: penalty,
    deuces: 0,
    penalty,
  });
  const hand = (
    handIndex: number,
    winner: number,
    deltas: number[],
    bombs: number[],
    winnerPlayCount: number,
  ): MatchState['history'][number] => ({
    handIndex,
    seedCode: `demo-${handIndex}`,
    winner,
    scores: deltas.map((d, seat) => score(seat, d < 0 ? -d : 0)),
    pot: Math.max(...deltas),
    deltas,
    bombs,
    winnerPlayCount,
  });
  return {
    config: {
      mode: 'hands',
      hands: 4,
      target: 100,
      difficulty: 'normal',
      rules: {
        straights: 'topCard',
        sizeLadder: true,
        deuceDouble: true,
      },
      seedCode: 'demo-mvp',
      ladderOpponentId: null,
    },
    handIndex: 4,
    balances: [42, -8, -20, -14],
    history: [
      hand(0, 1, [-18, 36, -10, -8], [0, 2, 0, 0], 7),
      hand(1, 0, [40, -12, -14, -14], [1, 0, 0, 0], 4),
      hand(2, 0, [20, -16, -2, -2], [0, 0, 1, 0], 5),
      hand(3, 2, [0, -16, 28, -12], [0, 0, 0, 1], 6),
    ],
    phase: 'matchOver',
    winner: 0,
  };
}

function buildMvpDemoReview(): HandReview {
  return {
    winner: 0,
    pot: 42,
    scores: [
      { seat: 0, remaining: 0, base: 0, deuces: 0, penalty: 0 },
      { seat: 1, remaining: 8, base: 8, deuces: 0, penalty: 16 },
      { seat: 2, remaining: 5, base: 5, deuces: 0, penalty: 5 },
      { seat: 3, remaining: 6, base: 6, deuces: 0, penalty: 6 },
    ],
    highlight: '+42',
    lessons: [
      {
        title: '系列賽籌碼結算',
        detail: '四局累計後你以 +42 籌碼勝出；局末 MVP 標出最快出完、炸彈與翻盤。',
      },
    ],
  };
}

/** Synthetic finished single hand for `?demo=single` playtest screenshots. */
function buildSingleDemoMatch(): MatchState {
  return {
    config: {
      mode: 'single',
      hands: 4,
      target: 100,
      difficulty: 'normal',
      rules: {
        straights: 'topCard',
        sizeLadder: true,
        deuceDouble: true,
      },
      seedCode: 'demo-single',
      ladderOpponentId: null,
    },
    handIndex: 1,
    balances: [27, -16, -5, -6],
    history: [
      {
        handIndex: 0,
        seedCode: 'demo-single',
        winner: 0,
        scores: [
          { seat: 0, remaining: 0, base: 0, deuces: 0, penalty: 0 },
          { seat: 1, remaining: 8, base: 8, deuces: 0, penalty: 16 },
          { seat: 2, remaining: 5, base: 5, deuces: 0, penalty: 5 },
          { seat: 3, remaining: 6, base: 6, deuces: 0, penalty: 6 },
        ],
        pot: 27,
        deltas: [27, -16, -5, -6],
        bombs: [0, 0, 0, 0],
        winnerPlayCount: 5,
      },
    ],
    phase: 'matchOver',
    winner: 0,
  };
}

function buildSingleDemoReview(): HandReview {
  return {
    winner: 0,
    pot: 27,
    scores: [
      { seat: 0, remaining: 0, base: 0, deuces: 0, penalty: 0 },
      { seat: 1, remaining: 8, base: 8, deuces: 0, penalty: 16 },
      { seat: 2, remaining: 5, base: 5, deuces: 0, penalty: 5 },
      { seat: 3, remaining: 6, base: 6, deuces: 0, penalty: 6 },
    ],
    highlight: '+27',
    lessons: [
      {
        title: '單局結算',
        detail: '打完一局就結束；籌碼與戰績記入單局，不含系列賽累計。',
      },
    ],
  };
}

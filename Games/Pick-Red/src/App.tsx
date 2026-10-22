import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import {
  playCapture,
  playCard,
  playCombo,
  playGoal,
  playImpact,
  playLose,
  playScore,
  playWin,
} from '@clubhouse/shared/synthAudio';
import { CardBack, CardView } from './components/CardView';
import { HandReviewPanel } from './components/HandReviewPanel';
import { MatchScoreboard } from './components/MatchScoreboard';
import { feltBackgroundStyle, titleBackgroundStyle } from './artBackground';
import {
  BLACK_ACE_POINTS,
  TOTAL_POINTS,
  capturableBy,
  cardLabel,
  isRed,
  parScore,
  sumPoints,
} from './game/cards';
import {
  DIFFICULTIES,
  PERSONALITIES,
  chooseCaptureTarget,
  chooseMove,
  difficultyInfo,
  isFlashyCapture,
  isFlashyDiscard,
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
import { applyPlay, choosePick, flip, handSize, outcome, playCard as playHandCard, score } from './game/engine';
import { advise, seatHintBlurb } from './game/hints';
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
  NAMED_OPPONENTS,
  PLAY_STYLE_LABEL,
  isOpponentUnlocked,
  ladderDifficulty,
  opponentById,
} from './game/opponents';
import { normalizeSeedCode, randomSeedCode } from './game/rng';
import { buildHandReview } from './game/review';
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
import type { LadderProgress } from './game/storage';
import type { FormatKey, NamedOpponentId } from './game/types';
import { HUMAN } from './game/types';
import type {
  Card,
  DifficultyId,
  GameState,
  HouseRules,
  MatchConfig,
  MatchLength,
  MatchMode,
  MatchState,
  PlayerCount,
  TargetScore,
} from './game/types';

type Screen = 'setup' | 'game';
type SetupTab = 'play' | 'ladder';

interface HintHighlight {
  handId: string | null;
  tableId: string | null;
  reason: string | null;
}

const FLIP_DELAY = 800;
const CPU_DELAY = 650;

const SEAT_NAMES = ['你', '對家甲', '對家乙', '對家丙'];

export default function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('setup');
  const [stats, setStats] = useState(EMPTY_STATS);
  const [config, setConfig] = useState<MatchConfig>(() => defaultMatchConfig());
  const [seedInput, setSeedInput] = useState('');
  const [match, setMatch] = useState<MatchState | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [history, setHistory] = useState<GameState[]>([]);
  const [selected, setSelected] = useState<Card | null>(null);
  const [hint, setHint] = useState<HintHighlight | null>(null);
  const [review, setReview] = useState<HandReview | null>(null);
  const [callout, setCallout] = useState<{ text: string; key: number } | null>(null);
  const [combo, setCombo] = useState(0);
  const [resumeAvailable, setResumeAvailable] = useState(false);
  const [captureBurst, setCaptureBurst] = useState(0);
  const [setupTab, setSetupTab] = useState<SetupTab>('play');
  const [ladder, setLadder] = useState<LadderProgress>(EMPTY_LADDER);
  const [dailyProgress, setDailyProgress] = useState(EMPTY_DAILY);
  const [shareCopied, setShareCopied] = useState(false);
  const [dailyDate] = useState(() => taipeiDateKey());
  const handRecorded = useRef(false);
  const matchRecorded = useRef(false);
  const resultSoundPlayed = useRef(false);
  const prevLogLen = useRef(0);

  useEffect(() => {
    const saved = loadStats();
    setStats(saved);
    setLadder(loadLadder());
    setDailyProgress(loadDailyProgress());
    setConfig({
      ...defaultMatchConfig(saved.lastDifficulty, {
        players: saved.lastPlayers,
        blackAces: saved.lastBlackAces,
        doubleRedFive: saved.lastDoubleRedFive,
        zeroScoreBonus: saved.lastZeroScoreBonus,
        rotateLeader: saved.lastRotateLeader,
      }),
      mode: saved.lastMatchMode === 'daily' ? 'hands' : saved.lastMatchMode,
      hands: saved.lastMatchHands,
      target: saved.lastMatchTarget,
      ladderOpponentId: null,
    });
    const pending = loadMatch();
    setResumeAvailable(Boolean(pending && pending.phase !== 'matchOver'));

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
  }, [screen]);

  const beginHand = useCallback((nextMatch: MatchState) => {
    const dealt = dealHand(nextMatch);
    setMatch(nextMatch);
    setState(dealt);
    setHistory([]);
    setSelected(null);
    setHint(null);
    setReview(null);
    setCombo(0);
    setCallout(null);
    handRecorded.current = false;
    resultSoundPlayed.current = false;
    prevLogLen.current = 0;
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
      const opponent = NAMED_OPPONENTS[index];
      if (!opponent || !isOpponentUnlocked(index, ladder.clearedCount)) return;
      startMatch({
        mode: 'single',
        hands: 4,
        target: 100,
        difficulty: ladderDifficulty(opponent),
        rules: {
          players: 2,
          blackAces: false,
          doubleRedFive: true,
          zeroScoreBonus: true,
          rotateLeader: false,
        },
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

  const humanTurn = state ? state.turn === HUMAN : false;
  const waitingOnHuman =
    humanTurn && (state?.phase === 'play' || state?.phase === 'pick_play' || state?.phase === 'pick_flip');

  useEffect(() => {
    if (state?.phase !== 'flip') return;
    const timer = setTimeout(() => setState((current) => (current ? flip(current) : current)), FLIP_DELAY);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (!state || state.turn === HUMAN || state.phase === 'over' || state.phase === 'flip') return;
    const timer = setTimeout(() => {
      setState((current) => {
        if (!current || current.turn === HUMAN) return current;
        const info = difficultyInfo(current.difficulty);
        const person = personalityForSeat(current.turn, current.seatPersonalities)?.id ?? null;

        if (current.phase === 'pick_play' || current.phase === 'pick_flip') {
          const options = capturableBy(current.pending!, current.table);
          const picked = chooseCaptureTarget(
            current,
            current.pending!,
            options,
            info.captureBlunderRate,
            person,
          );
          return choosePick(current, picked.id);
        }

        const move = chooseMove(current, info.brain, info.captureBlunderRate, person);
        return applyPlay(current, move.card, move.taken);
      });
    }, CPU_DELAY);
    return () => clearTimeout(timer);
  }, [state]);

  // Juice: react to new log entries with capture anim / combo callouts.
  useEffect(() => {
    if (!state) return;
    if (state.log.length <= prevLogLen.current) {
      prevLogLen.current = state.log.length;
      return;
    }
    const last = state.log[state.log.length - 1];
    prevLogLen.current = state.log.length;
    if (!last) return;

    if (last.taken) {
      setCaptureBurst((n) => n + 1);
      const pts = last.points;
      if (isFlashyCapture(last.played, last.taken, state.rules.blackAces)) {
        const label =
          last.played.rank === 1 || last.taken.rank === 1
            ? '搶 A！'
            : pts >= 30
              ? `大獲 +${pts}`
              : `連撿 +${pts}`;
        setCallout({ text: label, key: Date.now() });
        playImpact(Math.min(1, pts / 40));
        if (pts >= 20) playGoal();
        else playCapture();
      } else {
        playCapture();
      }
      setCombo((c) => {
        const next = c + 1;
        if (next >= 2) {
          playCombo(next);
          if (next >= 3) setCallout({ text: `${next} 連撿！`, key: Date.now() });
        }
        return next;
      });
      playScore();
    } else {
      setCombo(0);
      if (isFlashyDiscard(last.played, null, state.rules.blackAces)) {
        setCallout({ text: `丟出 ${cardLabel(last.played)}`, key: Date.now() });
      }
      playCard();
    }
  }, [state]);

  const result = useMemo(() => (state?.phase === 'over' ? outcome(state) : null), [state]);

  useEffect(() => {
    if (!result || !state || !match || handRecorded.current) return;
    if (match.phase !== 'playing') return;
    handRecorded.current = true;

    if (!resultSoundPlayed.current) {
      resultSoundPlayed.current = true;
      if (result.result === 'win') playWin();
      else if (result.result === 'loss') playLose();
    }

    const nextMatch = applyHandResult(match, result, state.seedCode);
    setMatch(nextMatch);
    saveMatch(nextMatch);
    setReview(buildHandReview(state, result));

    setStats((prev) => {
      let next = recordHandResult(
        prev,
        result.result,
        result.scores[HUMAN],
        result.deltas[HUMAN],
        result.qualified.includes(HUMAN),
        result.doubleRedFiveSeat === HUMAN,
        result.zeroScoreSeat === HUMAN,
      );
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

  const pickPending = state?.phase === 'pick_play' || state?.phase === 'pick_flip';
  const targets = useMemo(() => {
    if (!state) return [];
    if (pickPending && humanTurn) return capturableBy(state.pending!, state.table);
    return selected ? capturableBy(selected, state.table) : [];
  }, [state, selected, pickPending, humanTurn]);

  const pushHistory = useCallback((snapshot: GameState) => {
    setHistory((prev) => [...prev, snapshot]);
  }, []);

  const commit = useCallback(
    (card: Card, target?: Card) => {
      setState((current) => {
        if (!current) return current;
        pushHistory(current);
        const played = playHandCard(current, card.id);
        if (played.phase === 'pick_play' && target) return choosePick(played, target.id);
        return played;
      });
      setSelected(null);
      setHint(null);
    },
    [pushHistory],
  );

  const onHandCard = useCallback(
    (card: Card) => {
      if (!state || state.phase !== 'play' || !humanTurn) return;
      const options = capturableBy(card, state.table);
      setHint(null);

      if (selected?.id === card.id) {
        if (options.length > 1) return;
        commit(card, options[0]);
        return;
      }
      setSelected(card);
    },
    [commit, humanTurn, selected, state],
  );

  const onTableCard = useCallback(
    (card: Card) => {
      if (!state || !humanTurn) return;
      if (!targets.some((t) => t.id === card.id)) return;
      if (pickPending) {
        pushHistory(state);
        setState((current) => (current ? choosePick(current, card.id) : current));
        setSelected(null);
        setHint(null);
        return;
      }
      if (selected) commit(selected, card);
    },
    [commit, humanTurn, pickPending, pushHistory, selected, state, targets],
  );

  const canUndo =
    Boolean(state) &&
    history.length > 0 &&
    waitingOnHuman &&
    state!.phase !== 'over' &&
    state!.phase !== 'flip';

  const handleUndo = useCallback(() => {
    if (!canUndo) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setState(prev);
    setSelected(null);
    setHint(null);
    prevLogLen.current = prev.log.length;
  }, [canUndo, history]);

  const handleHint = useCallback(() => {
    if (!state || !waitingOnHuman) return;
    const advice = advise(state);
    if (pickPending) {
      setHint({ handId: null, tableId: advice.taken?.id ?? null, reason: advice.reason });
      return;
    }
    if (advice.card) setSelected(advice.card);
    setHint({
      handId: advice.card?.id ?? null,
      tableId: advice.taken?.id ?? null,
      reason: advice.reason,
    });
  }, [pickPending, state, waitingOnHuman]);

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
        ladderOpponentId: null,
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

  const seatNames = useMemo(() => {
    const names = [...SEAT_NAMES];
    if (match?.config.ladderOpponentId) {
      const opp = opponentById(match.config.ladderOpponentId);
      if (opp) names[1] = opp.name;
    }
    return names;
  }, [match]);

  useEffect(() => {
    if (!callout) return;
    const timer = setTimeout(() => setCallout(null), 1200);
    return () => clearTimeout(timer);
  }, [callout]);

  if (screen === 'setup') {
    return (
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
    );
  }

  if (!match) return <div />;

  const showReview = Boolean(review && match.phase !== 'playing');
  const info = state ? difficultyInfo(state.difficulty) : difficultyInfo(match.config.difficulty);
  const par = state
    ? parScore(state.rules.players, state.rules.blackAces)
    : parScore(match.config.rules.players, match.config.rules.blackAces);
  const deckTotal =
    TOTAL_POINTS + (match.config.rules.blackAces ? BLACK_ACE_POINTS : 0);
  const ladderOpp = match.config.ladderOpponentId
    ? opponentById(match.config.ladderOpponentId)
    : null;

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pb-6 pt-14 sm:pt-4">
      <BackToMenu />

      <div className="w-full max-w-2xl flex flex-col gap-3">
        {ladderOpp && (
          <p className="text-center text-xs text-emerald-200/70">
            挑戰 {ladderOpp.name} · {PLAY_STYLE_LABEL[ladderOpp.style]}
          </p>
        )}
        <MatchScoreboard match={match} progress={matchProgressLabel(match)} />

        {state && (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <ScoreBar state={state} par={par} deckTotal={deckTotal} seatNames={seatNames} />
              </div>
              <div className="flex gap-1 shrink-0 pt-0.5">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={!canUndo}
                  className="min-h-[44px] min-w-[44px] px-2 rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-40 touch-manipulation text-sm font-bold"
                  title="復原"
                >
                  復原
                </button>
                <button
                  type="button"
                  onClick={handleHint}
                  disabled={!waitingOnHuman}
                  className="min-h-[44px] min-w-[44px] px-2 rounded-lg border border-slate-700 hover:bg-slate-800 disabled:opacity-40 touch-manipulation text-sm font-bold"
                  title="提示"
                >
                  提示
                </button>
              </div>
            </div>

            {state.hands.map((_, seat) =>
              seat === HUMAN ? null : (
                <Pile
                  key={seat}
                  name={seatNames[seat] ?? SEAT_NAMES[seat]}
                  personality={
                    ladderOpp && seat === 1
                      ? ladderOpp.tagline
                      : seatHintBlurb(state, seat)
                  }
                  cards={state.captured[seat]}
                  count={state.hands[seat].length}
                  blackAces={state.rules.blackAces}
                  active={state.turn === seat && state.phase !== 'over'}
                />
              ),
            )}

            <section
              className={`pr-felt rounded-2xl p-3 sm:p-4 relative ${captureBurst ? 'pr-felt-flash' : ''}`}
              style={feltBackgroundStyle()}
              aria-label="桌面"
              key={`felt-${captureBurst}`}
            >
              {callout && (
                <div key={callout.key} className="pr-callout pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
                  <span className="rounded-full bg-amber-400/95 px-4 py-1 text-sm font-black text-slate-900 shadow-lg">
                    {callout.text}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between mb-2 text-xs text-emerald-200/70">
                <span>桌面 {state.table.length} 張</span>
                <span className="flex items-center gap-2">
                  牌庫 {state.pile.length}
                  <CardBack size="sm" />
                </span>
              </div>

              <div className="flex flex-wrap gap-2 justify-center min-h-[5rem]">
                {state.table.length === 0 && (
                  <p className="text-emerald-200/40 text-sm self-center py-6">桌面已清空</p>
                )}
                {state.table.map((card) => {
                  const isTarget = humanTurn && targets.some((t) => t.id === card.id);
                  const isHinted = hint?.tableId === card.id;
                  return (
                    <CardView
                      key={card.id}
                      card={card}
                      blackAces={state.rules.blackAces}
                      target={isTarget}
                      hinted={isHinted}
                      landed={state.spotlight.includes(card.id)}
                      dimmed={(Boolean(selected) || pickPending) && !isTarget}
                      onClick={isTarget ? () => onTableCard(card) : undefined}
                    />
                  );
                })}
              </div>
            </section>

            <Status
              state={state}
              selected={selected}
              targets={targets}
              last={state.log[state.log.length - 1]}
              humanTurn={humanTurn}
              hintReason={hint?.reason ?? null}
              difficultyLabel={info.label}
              seatNames={seatNames}
            />

            <section aria-label="你的手牌">
              <div className="flex flex-wrap gap-1.5 justify-center">
                {state.hands[HUMAN].map((card) => (
                  <CardView
                    key={card.id}
                    card={card}
                    blackAces={state.rules.blackAces}
                    selected={selected?.id === card.id}
                    hinted={hint?.handId === card.id}
                    dimmed={pickPending}
                    onClick={waitingOnHuman && !pickPending ? () => onHandCard(card) : undefined}
                  />
                ))}
              </div>
            </section>

            {selected && targets.length === 0 && humanTurn && state.phase === 'play' && (
              <button
                type="button"
                onClick={() => commit(selected)}
                className="mx-auto min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 px-5 font-bold"
              >
                打出 {cardLabel(selected)}（撿不到，留在桌上）
              </button>
            )}

            <Pile
              name={seatNames[HUMAN]}
              personality=""
              cards={state.captured[HUMAN]}
              count={state.hands[HUMAN].length}
              blackAces={state.rules.blackAces}
              active={humanTurn && state.phase !== 'over'}
            />
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
            setScreen('setup');
            setResumeAvailable(Boolean(loadMatch() && loadMatch()?.phase !== 'matchOver'));
          }}
          shareLabel={
            match.config.mode === 'daily'
              ? shareCopied
                ? '已複製分享文案'
                : '複製分享'
              : null
          }
          onShare={match.config.mode === 'daily' ? handleDailyShare : null}
          seatNames={seatNames}
        />
      )}
    </div>
  );
}

function ScoreBar({
  state,
  par,
  deckTotal,
  seatNames = SEAT_NAMES,
}: {
  state: GameState;
  par: number;
  deckTotal: number;
  seatNames?: string[];
}): React.ReactElement {
  const scores = state.hands.map((_, seat) => score(state, seat));
  return (
    <div>
      <div className="flex justify-between items-baseline text-sm font-bold mb-1 gap-2">
        {scores.map((points, seat) => (
          <span key={seat} className={seat === HUMAN ? 'text-emerald-300' : 'text-rose-300'}>
            {seatNames[seat] ?? SEAT_NAMES[seat]} {points}
            {points > par && ' ✓'}
          </span>
        ))}
      </div>
      <div className="text-center text-[11px] text-emerald-200/50 mb-1">
        標準分 {par}（全場 {deckTotal} 分均分）
      </div>
      <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden flex gap-px">
        {scores.map((points, seat) => (
          <div
            key={seat}
            className={`h-full transition-all ${seat === HUMAN ? 'bg-emerald-500' : 'bg-rose-500'}`}
            style={{ width: `${(points / deckTotal) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function Pile({
  name,
  personality,
  cards,
  count,
  blackAces,
  active,
}: {
  name: string;
  personality: string;
  cards: Card[];
  count: number;
  blackAces: boolean;
  active: boolean;
}): React.ReactElement {
  const scoring = cards.filter((card) => isRed(card) || (blackAces && card.rank === 1));
  return (
    <div
      className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 ${
        active ? 'bg-emerald-500/10 ring-1 ring-emerald-400/40' : 'bg-slate-900/40'
      }`}
    >
      <div className="w-16 shrink-0">
        <span className="font-bold block">{name}</span>
        {personality && (
          <span className="text-[10px] text-emerald-200/45 truncate block">{personality}</span>
        )}
      </div>
      <span className="text-emerald-200/60 shrink-0">手牌 {count}</span>
      <div className="flex flex-wrap gap-0.5 justify-end flex-1">
        {scoring.length === 0 && <span className="text-emerald-200/30">尚未撿到分數</span>}
        {scoring.map((card) => (
          <CardView key={card.id} card={card} size="sm" blackAces={blackAces} />
        ))}
      </div>
      <span className="font-black tabular-nums shrink-0">{sumPoints(cards, blackAces)}</span>
    </div>
  );
}

function Status({
  state,
  selected,
  targets,
  last,
  humanTurn,
  hintReason,
  difficultyLabel,
  seatNames = SEAT_NAMES,
}: {
  state: GameState;
  selected: Card | null;
  targets: Card[];
  last: GameState['log'][number] | undefined;
  humanTurn: boolean;
  hintReason: string | null;
  difficultyLabel: string;
  seatNames?: string[];
}): React.ReactElement {
  let message: string;
  const nameOf = (seat: number) => seatNames[seat] ?? SEAT_NAMES[seat];

  if (state.phase === 'over') message = '牌局結束';
  else if (state.phase === 'flip') message = '翻牌中…';
  else if ((state.phase === 'pick_play' || state.phase === 'pick_flip') && humanTurn) {
    message =
      state.phase === 'pick_flip'
        ? `翻到 ${cardLabel(state.pending!)}，選一張要撿走的`
        : `選一張要撿走的（${targets.length} 張可撿）`;
  } else if (!humanTurn) {
    const person = personalityForSeat(state.turn, state.seatPersonalities);
    message = person
      ? `${nameOf(state.turn)}（${person.name}）思考中…`
      : `${nameOf(state.turn)}思考中…`;
  } else if (selected && targets.length > 1)
    message = `${cardLabel(selected)} 可以撿 ${targets.length} 張，選一張`;
  else if (selected && targets.length === 1)
    message = `再點一次 ${cardLabel(selected)} 撿走 ${cardLabel(targets[0])}`;
  else if (selected) message = `${cardLabel(selected)} 撿不到任何牌`;
  else message = '點一張手牌';

  return (
    <div className="text-center text-sm min-h-[2.5rem] flex flex-col justify-center">
      <p className="font-bold text-emerald-200">{message}</p>
      {hintReason && (
        <p className="text-xs text-sky-300/90 mt-0.5 px-2">{hintReason}</p>
      )}
      {last && (
        <p className="text-xs text-emerald-200/50">
          {nameOf(last.by)}
          {last.source === 'pile' ? '翻到' : '打出'} {cardLabel(last.played)}
          {last.taken ? ` → 撿走 ${cardLabel(last.taken)}（+${last.points}）` : '，留在桌上'}
          <span className="text-emerald-200/30"> · {difficultyLabel}</span>
        </p>
      )}
    </div>
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
  const { rules } = config;
  const patchRules = (patch: Partial<HouseRules>) =>
    setConfig((prev) => ({ ...prev, rules: { ...prev.rules, ...patch } }));
  const setMode = (mode: MatchMode) =>
    setConfig((prev) => ({
      ...prev,
      mode,
      ladderOpponentId: null,
      rules: {
        ...prev.rules,
        rotateLeader: mode === 'single' ? prev.rules.rotateLeader : true,
      },
    }));

  const today = todayDailyRecord(dailyProgress.records, dailyDate);
  const streak = computeDailyStreak(dailyProgress.records, dailyDate);
  const dailySeed = dailyMatchConfig(dailyDate).seedCode;
  const playModes: MatchMode[] = ['single', 'hands', 'target'];

  return (
    <div
      className="pr-title-shell min-h-screen flex flex-col items-center justify-center px-4 py-16"
      style={titleBackgroundStyle()}
    >
      <BackToMenu />

      <div className="w-full max-w-md flex flex-col gap-5">
        <header className="pr-title-hero text-center">
          <h1 className="text-4xl font-black tracking-tight">撿紅點</h1>
          <p className="text-emerald-200/60 text-sm mt-1">
            單局・系列賽・每日牌桌 · 湊十撿牌，只有紅牌算分
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
                  ? 'border-emerald-400 bg-emerald-500/15'
                  : 'border-slate-700 hover:bg-slate-800/60'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {setupTab === 'ladder' ? (
          <section aria-label="具名對手解鎖梯" className="flex flex-col gap-3">
            <p className="text-sm text-emerald-100/70 leading-relaxed">
              贏過前一位才解鎖下一位。每位對手有不同出牌風格。
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
                          ? 'border-emerald-400/50 bg-emerald-500/10 hover:bg-emerald-500/20'
                          : 'border-slate-800 bg-slate-900/40 opacity-60'
                      }`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-bold">
                          {unlocked ? op.name : '？？？'}
                          {cleared && (
                            <span className="ml-2 text-[10px] font-normal text-amber-300">
                              已擊敗
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] text-emerald-200/60">
                          {unlocked ? PLAY_STYLE_LABEL[op.style] : '未解鎖'}
                        </span>
                      </div>
                      {unlocked && (
                        <p className="mt-1 text-xs text-emerald-100/55 leading-relaxed">
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
          className="pr-felt rounded-2xl p-4 text-sm"
          style={feltBackgroundStyle()}
          aria-label="每日牌桌"
        >
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-bold text-emerald-200">每日牌桌</h2>
            <span className="text-[11px] text-emerald-100/50">{dailyDate} · 台北</span>
          </div>
          <p className="mt-1 text-emerald-100/65 text-xs leading-relaxed">
            固定 4 圈比總分；種子全天相同。連續 {streak} 天
            {today
              ? ` · 今日最佳 ${today.bestChips >= 0 ? '+' : ''}${today.bestChips}`
              : ' · 尚未挑戰'}
          </p>
          <p className="mt-1 text-[11px] font-mono text-emerald-100/40">種子 {dailySeed}</p>
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

        <section className="pr-felt rounded-2xl p-4 text-sm" style={feltBackgroundStyle()}>
          <h2 className="font-bold mb-2 text-emerald-200">怎麼配對</h2>
          <p className="text-emerald-100/70 leading-relaxed">
            <strong className="text-emerald-300">A～9 相加等於 10</strong>
            （A+9、2+8、3+7、4+6、5+5），
            <strong className="text-emerald-300">10、J、Q、K 則要同點數</strong>
            。分界就在 10：十以下用加的，十以上用對的。
          </p>
          <p className="text-emerald-100/50 text-xs mt-2">
            計分：紅 A 二十分，紅 9、10、J、Q、K 各十分，紅 2～8 依牌面。籌碼＝（得分−標準分）。
            單局／系列賽／每日分開記戰績。
          </p>
        </section>

        <details
          className="pr-more-modes rounded-2xl border border-slate-700/80 bg-slate-900/40 px-4 py-3"
          open={isSeriesMode(config.mode)}
        >
          <summary className="min-h-[44px] cursor-pointer list-none touch-manipulation flex items-center justify-between gap-2 text-sm text-emerald-200 font-bold">
            <span>更多賽制</span>
            <span className="text-[11px] font-normal text-emerald-100/55">
              {config.mode === 'single'
                ? '目前：單局'
                : config.mode === 'hands'
                  ? `目前：${config.hands} 圈`
                  : `目前：先達 ${config.target}`}
            </span>
          </summary>
          <div className="mt-3 flex flex-col gap-2" role="group" aria-label="賽制">
            {playModes.map((mode) => (
              <div key={mode} className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => setMode(mode)}
                  className={`text-left min-h-[44px] rounded-xl border px-4 py-2 text-sm transition-colors touch-manipulation ${
                    config.mode === mode
                      ? 'border-emerald-400 bg-emerald-500/15'
                      : 'border-slate-700 hover:bg-slate-800/60'
                  }`}
                >
                  <span className="font-bold">{MATCH_MODE_LABELS[mode]}</span>
                  <span className="block text-[11px] text-emerald-100/55">
                    {mode === 'single'
                      ? '打完一局就結算，計入單局戰績'
                      : mode === 'hands'
                        ? '固定圈數累計籌碼；預設每局輪莊'
                        : '先累積到目標籌碼者拿下系列賽'}
                  </span>
                </button>
                {mode === 'hands' && config.mode === 'hands' && (
                  <div className="ml-3 flex gap-2" role="group" aria-label="圈數">
                    {MATCH_LENGTHS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, hands: n as MatchLength }))}
                        className={`flex-1 min-h-[40px] rounded-xl border text-sm touch-manipulation ${
                          config.hands === n
                            ? 'border-emerald-400 bg-emerald-500/15 font-bold'
                            : 'border-slate-700'
                        }`}
                      >
                        {n} 圈
                      </button>
                    ))}
                  </div>
                )}
                {mode === 'target' && config.mode === 'target' && (
                  <div className="ml-3 flex gap-2" role="group" aria-label="目標分">
                    {TARGET_SCORES.map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setConfig((prev) => ({ ...prev, target: n as TargetScore }))}
                        className={`flex-1 min-h-[40px] rounded-xl border text-sm touch-manipulation ${
                          config.target === n
                            ? 'border-emerald-400 bg-emerald-500/15 font-bold'
                            : 'border-slate-700'
                        }`}
                      >
                        {n} 分
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </details>

        <section>
          <h2 className="font-bold mb-2 text-sm text-emerald-200">人數</h2>
          <div className="flex gap-2">
            {([2, 3, 4] as PlayerCount[]).map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => patchRules({ players: count })}
                className={`flex-1 min-h-[44px] rounded-xl border transition-colors ${
                  rules.players === count
                    ? 'border-emerald-400 bg-emerald-500/15'
                    : 'border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <span className="font-bold">{count} 人</span>
                <span className="block text-[11px] text-emerald-100/50">
                  各 {handSize(count)} 張．標準分 {parScore(count, rules.blackAces)}
                </span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-bold mb-2 text-sm text-emerald-200">難度</h2>
          <div className="flex flex-col gap-2">
            {DIFFICULTIES.map((info) => (
              <button
                key={info.id}
                type="button"
                onClick={() =>
                  setConfig((prev) => ({ ...prev, difficulty: info.id as DifficultyId }))
                }
                className={`text-left min-h-[44px] rounded-xl px-4 py-2 border transition-colors ${
                  config.difficulty === info.id
                    ? 'border-emerald-400 bg-emerald-500/15'
                    : 'border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <span className="font-bold">{info.label}</span>
                <span className="block text-xs text-emerald-100/60">{info.blurb}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-emerald-100/45 leading-relaxed">
            對手個性：
            {PERSONALITIES.map((p) => `${p.name}（${p.blurb}）`).join('；')}
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2 text-sm text-emerald-200">台灣家規</h2>
          <div className="flex flex-col gap-2">
            <Toggle
              on={rules.blackAces}
              onClick={() => patchRules({ blackAces: !rules.blackAces })}
              title={`黑A 也算分${rules.blackAces ? '（開）' : '（關）'}`}
              detail={`黑桃 A 三十分、梅花 A 四十分，全場變 ${TOTAL_POINTS + BLACK_ACE_POINTS} 分。`}
            />
            <Toggle
              on={rules.doubleRedFive}
              onClick={() => patchRules({ doubleRedFive: !rules.doubleRedFive })}
              title={`過紅五${rules.doubleRedFive ? '（開）' : '（關）'}`}
              detail="同一回合吃到兩張紅 5，其餘各家各付 20 籌碼。"
            />
            <Toggle
              on={rules.zeroScoreBonus}
              onClick={() => patchRules({ zeroScoreBonus: !rules.zeroScoreBonus })}
              title={`拼零分${rules.zeroScoreBonus ? '（開）' : '（關）'}`}
              detail="整局一分未得，向其餘各家各收標準分籌碼。"
            />
            {isSeriesMode(config.mode) && (
              <Toggle
                on={rules.rotateLeader}
                onClick={() => patchRules({ rotateLeader: !rules.rotateLeader })}
                title={`每局輪莊${rules.rotateLeader ? '（開）' : '（關）'}`}
                detail="系列賽內頭家輪轉，座位優勢不會整場合綁在難度上。"
              />
            )}
          </div>
        </section>

        <label className="text-sm">
          <span className="font-bold text-emerald-200">種子碼</span>
          <span className="text-emerald-100/50 text-xs"> — 留空隨機；相同種子碼是同一副牌</span>
          <input
            value={seedInput}
            onChange={(event) => setSeedInput(event.target.value)}
            placeholder="例如 64aa2bl7"
            className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 px-3 focus:border-emerald-400 outline-none"
          />
        </label>

        {resumeAvailable && (
          <button
            type="button"
            onClick={onResume}
            className="min-h-[48px] rounded-2xl border border-amber-400/50 bg-amber-500/15 text-amber-100 font-bold touch-manipulation hover:bg-amber-500/25"
          >
            繼續未完成的對局
          </button>
        )}

        <button
          type="button"
          onClick={onStart}
          className="min-h-[52px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-lg font-black"
        >
          {isSeriesMode(config.mode) ? '開始系列賽' : '開始單局'}
        </button>

        {(stats.wins + stats.losses + stats.draws > 0 || stats.matches > 0) && (
          <div className="text-center text-xs text-emerald-100/50 leading-relaxed space-y-1">
            <p>
              單局 {stats.wins} 勝 {stats.losses} 敗 {stats.draws} 和．最高 {stats.best} 分
              {stats.bestStreak > 1 && `．最長連勝 ${stats.bestStreak}`}
              {stats.qualified > 0 && `．合格 ${stats.qualified} 次`}
            </p>
            {stats.matches > 0 && (
              <p>
                系列賽 {stats.matches} 場 {stats.matchWins} 勝
                {stats.bestMatchChips !== 0 &&
                  `．最佳籌碼 ${stats.bestMatchChips >= 0 ? '+' : ''}${stats.bestMatchChips}`}
                {stats.chips !== 0 &&
                  `．累計籌碼 ${stats.chips >= 0 ? '+' : ''}${stats.chips}`}
              </p>
            )}
            <FormatRecordLine formats={stats.formats} />
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}

function FormatRecordLine({
  formats,
}: {
  formats: ReturnType<typeof loadStats>['formats'];
}): React.ReactElement | null {
  const entries = (Object.keys(FORMAT_LABELS) as FormatKey[])
    .map((key) => ({ key, ...formats[key] }))
    .filter((entry) => entry.played > 0);
  if (entries.length === 0) return null;
  return (
    <p aria-label="賽制戰績">
      賽制戰績{' '}
      {entries
        .map((entry) => `${FORMAT_LABELS[entry.key]} ${entry.wins}/${entry.played}`)
        .join(' · ')}
    </p>
  );
}

/** Synthetic finished series for `?demo=mvp` playtest screenshots. */
function buildMvpDemoMatch(): MatchState {
  const hand = (
    handIndex: number,
    scores: number[],
    deltas: number[],
  ): MatchState['history'][number] => ({
    handIndex,
    seedCode: `demo-${handIndex}`,
    winner: scores[0] >= scores[1] ? 0 : 1,
    scores,
    deltas,
    qualified: scores.flatMap((points, seat) => (points > 105 ? [seat] : [])),
    doubleRedFiveSeat: null,
    zeroScoreSeat: null,
  });
  return {
    config: {
      mode: 'hands',
      hands: 4,
      target: 100,
      difficulty: 'normal',
      rules: {
        players: 2,
        blackAces: false,
        doubleRedFive: true,
        zeroScoreBonus: true,
        rotateLeader: true,
      },
      seedCode: 'demo-mvp',
    },
    handIndex: 4,
    balances: [28, -28],
    history: [
      hand(0, [118, 92], [13, -13]),
      hand(1, [88, 122], [-17, 17]),
      hand(2, [112, 98], [7, -7]),
      hand(3, [105, 105], [0, 0]),
    ],
    phase: 'matchOver',
    winner: 0,
  };
}

function buildMvpDemoReview(): HandReview {
  return {
    winners: [0],
    scores: [105, 105],
    par: 105,
    deltas: [0, 0],
    highlight: '+28',
    lessons: [
      {
        title: '系列賽籌碼結算',
        detail: '四圈累計後你以 +28 籌碼勝出；合格分每一圈都在加減籌碼。',
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
        players: 2,
        blackAces: false,
        doubleRedFive: true,
        zeroScoreBonus: true,
        rotateLeader: true,
      },
      seedCode: 'demo-single',
    },
    handIndex: 1,
    balances: [13, -13],
    history: [
      {
        handIndex: 0,
        seedCode: 'demo-single',
        winner: 0,
        scores: [118, 92],
        deltas: [13, -13],
        qualified: [0],
        doubleRedFiveSeat: null,
        zeroScoreSeat: null,
      },
    ],
    phase: 'matchOver',
    winner: 0,
  };
}

function buildSingleDemoReview(): HandReview {
  return {
    winners: [0],
    scores: [118, 92],
    par: 105,
    deltas: [13, -13],
    highlight: '+13',
    lessons: [
      {
        title: '單局結算',
        detail: '打完一局就結束；籌碼與戰績記入單局，不含系列賽累計。',
      },
    ],
  };
}

function Toggle({
  on,
  onClick,
  title,
  detail,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  detail: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`text-left min-h-[44px] rounded-xl px-4 py-2 border transition-colors ${
        on ? 'border-amber-400 bg-amber-500/15' : 'border-slate-700 hover:bg-slate-800/60'
      }`}
    >
      <span className="font-bold text-sm">{title}</span>
      <span className="block text-xs text-emerald-100/60">{detail}</span>
    </button>
  );
}

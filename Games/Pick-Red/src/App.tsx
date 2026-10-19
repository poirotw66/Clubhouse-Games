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
import { applyPlay, choosePick, flip, handSize, outcome, playCard as playHandCard, score } from './game/engine';
import { advise, seatHintBlurb } from './game/hints';
import {
  MATCH_LENGTHS,
  MATCH_MODE_LABELS,
  TARGET_SCORES,
  advanceToNextHand,
  applyHandResult,
  createMatch,
  dealHand,
  defaultMatchConfig,
  matchProgressLabel,
} from './game/match';
import { normalizeSeedCode, randomSeedCode } from './game/rng';
import { buildHandReview } from './game/review';
import type { HandReview } from './game/review';
import {
  EMPTY_STATS,
  clearSavedMatch,
  loadMatch,
  loadStats,
  recordHandResult,
  recordMatchResult,
  rememberSetup,
  saveMatch,
  saveStats,
} from './game/storage';
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
  const handRecorded = useRef(false);
  const matchRecorded = useRef(false);
  const resultSoundPlayed = useRef(false);
  const prevLogLen = useRef(0);

  useEffect(() => {
    const saved = loadStats();
    setStats(saved);
    setConfig({
      ...defaultMatchConfig(saved.lastDifficulty, {
        players: saved.lastPlayers,
        blackAces: saved.lastBlackAces,
        doubleRedFive: saved.lastDoubleRedFive,
        zeroScoreBonus: saved.lastZeroScoreBonus,
        rotateLeader: saved.lastRotateLeader,
      }),
      mode: saved.lastMatchMode,
      hands: saved.lastMatchHands,
      target: saved.lastMatchTarget,
    });
    const pending = loadMatch();
    setResumeAvailable(Boolean(pending && pending.phase !== 'matchOver'));
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
      };
      const created = createMatch(seeded);
      matchRecorded.current = false;
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
        const person = personalityForSeat(current.turn)?.id ?? null;

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
        next = recordMatchResult(
          next,
          nextMatch.winner === HUMAN,
          nextMatch.balances[HUMAN],
        );
        clearSavedMatch();
      }
      saveStats(next);
      return next;
    });
  }, [result, state, match]);

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
      startMatch({
        ...match.config,
        seedCode: randomSeedCode(),
      });
      return;
    }
    const advanced = advanceToNextHand(match);
    beginHand(advanced);
  }, [match, beginHand, startMatch]);

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
        onStart={() => startMatch({ ...config, seedCode: seedInput })}
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

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pb-6 pt-14 sm:pt-4">
      <BackToMenu />

      <div className="w-full max-w-2xl flex flex-col gap-3">
        <MatchScoreboard match={match} progress={matchProgressLabel(match)} />

        {state && (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <ScoreBar state={state} par={par} deckTotal={deckTotal} />
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
                  name={SEAT_NAMES[seat]}
                  personality={seatHintBlurb(state, seat)}
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
              name={SEAT_NAMES[HUMAN]}
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
        />
      )}
    </div>
  );
}

function ScoreBar({
  state,
  par,
  deckTotal,
}: {
  state: GameState;
  par: number;
  deckTotal: number;
}): React.ReactElement {
  const scores = state.hands.map((_, seat) => score(state, seat));
  return (
    <div>
      <div className="flex justify-between items-baseline text-sm font-bold mb-1 gap-2">
        {scores.map((points, seat) => (
          <span key={seat} className={seat === HUMAN ? 'text-emerald-300' : 'text-rose-300'}>
            {SEAT_NAMES[seat]} {points}
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
}: {
  state: GameState;
  selected: Card | null;
  targets: Card[];
  last: GameState['log'][number] | undefined;
  humanTurn: boolean;
  hintReason: string | null;
  difficultyLabel: string;
}): React.ReactElement {
  let message: string;

  if (state.phase === 'over') message = '牌局結束';
  else if (state.phase === 'flip') message = '翻牌中…';
  else if ((state.phase === 'pick_play' || state.phase === 'pick_flip') && humanTurn) {
    message =
      state.phase === 'pick_flip'
        ? `翻到 ${cardLabel(state.pending!)}，選一張要撿走的`
        : `選一張要撿走的（${targets.length} 張可撿）`;
  } else if (!humanTurn) {
    const person = personalityForSeat(state.turn);
    message = person
      ? `${SEAT_NAMES[state.turn]}（${person.name}）思考中…`
      : `${SEAT_NAMES[state.turn]}思考中…`;
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
          {SEAT_NAMES[last.by]}
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
  onStart,
  onResume,
}: {
  config: MatchConfig;
  setConfig: React.Dispatch<React.SetStateAction<MatchConfig>>;
  seedInput: string;
  setSeedInput: (value: string) => void;
  stats: ReturnType<typeof loadStats>;
  resumeAvailable: boolean;
  onStart: () => void;
  onResume: () => void;
}): React.ReactElement {
  const { rules } = config;
  const patchRules = (patch: Partial<HouseRules>) =>
    setConfig((prev) => ({ ...prev, rules: { ...prev.rules, ...patch } }));

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
            湊十撿牌，只有紅牌算分．系列賽累計合格分籌碼
          </p>
        </header>

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
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2 text-sm text-emerald-200">系列賽</h2>
          <div className="flex gap-2 mb-2">
            {(Object.keys(MATCH_MODE_LABELS) as MatchMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, mode }))}
                className={`flex-1 min-h-[44px] rounded-xl border text-sm font-bold transition-colors ${
                  config.mode === mode
                    ? 'border-emerald-400 bg-emerald-500/15'
                    : 'border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                {MATCH_MODE_LABELS[mode]}
              </button>
            ))}
          </div>
          {config.mode === 'hands' ? (
            <div className="flex gap-2">
              {MATCH_LENGTHS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, hands: n as MatchLength }))}
                  className={`flex-1 min-h-[40px] rounded-xl border text-sm ${
                    config.hands === n
                      ? 'border-emerald-400 bg-emerald-500/15 font-bold'
                      : 'border-slate-700'
                  }`}
                >
                  {n} 局
                </button>
              ))}
            </div>
          ) : (
            <div className="flex gap-2">
              {TARGET_SCORES.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setConfig((prev) => ({ ...prev, target: n as TargetScore }))}
                  className={`flex-1 min-h-[40px] rounded-xl border text-sm ${
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
        </section>

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
            <Toggle
              on={rules.rotateLeader}
              onClick={() => patchRules({ rotateLeader: !rules.rotateLeader })}
              title={`每局輪莊${rules.rotateLeader ? '（開）' : '（關）'}`}
              detail="系列賽內頭家輪轉，座位優勢不會整場合綁在難度上。"
            />
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
            繼續未完成的系列賽
          </button>
        )}

        <button
          type="button"
          onClick={onStart}
          className="min-h-[52px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-lg font-black"
        >
          開始系列賽
        </button>

        {(stats.wins + stats.losses + stats.draws > 0 || stats.matches > 0) && (
          <p className="text-center text-xs text-emerald-100/50 leading-relaxed">
            {stats.wins} 勝 {stats.losses} 敗 {stats.draws} 和．最高 {stats.best} 分
            {stats.bestStreak > 1 && `．最長連勝 ${stats.bestStreak}`}
            {stats.qualified > 0 && `．合格 ${stats.qualified} 次`}
            {stats.matches > 0 && (
              <>
                <br />
                系列賽 {stats.matches} 場 {stats.matchWins} 勝
                {stats.bestMatchChips !== 0 && `．最佳籌碼 ${stats.bestMatchChips >= 0 ? '+' : ''}${stats.bestMatchChips}`}
                {stats.chips !== 0 && `．累計籌碼 ${stats.chips >= 0 ? '+' : ''}${stats.chips}`}
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
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

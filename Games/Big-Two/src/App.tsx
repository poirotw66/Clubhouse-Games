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
  difficultyInfo,
  personalityForSeat,
} from './game/cpu';
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
import { TYPE_LABEL, detectPlay } from './game/plays';
import { normalizeSeedCode, randomSeedCode } from './game/rng';
import { buildHandReview, isFlashyPlay } from './game/review';
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
import { HAND_SIZE, HUMAN, SEATS } from './game/types';
import type {
  Card,
  DifficultyId,
  GameState,
  HouseRules,
  MatchConfig,
  MatchLength,
  MatchMode,
  MatchState,
  Play,
  StraightRule,
  TargetScore,
} from './game/types';
import { feltBackgroundStyle, titleBackgroundStyle } from './artBackground';

type Screen = 'setup' | 'game';

const CPU_DELAY = 700;
const SEAT_NAMES = ['你', '下家', '對家', '上家'];

export default function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('setup');
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
      // Re-enter from the hand-over gate: advance into the next deal.
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
    const nextMatch = applyHandResult(match, result, state.seedCode);
    setMatch(nextMatch);
    saveMatch(nextMatch);
    setReview(buildHandReview(state, result));

    setStats((prev) => {
      let next = recordHandResult(prev, won, delta);
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
      startMatch({
        ...match.config,
        seedCode: randomSeedCode(),
      });
      return;
    }
    const advanced = advanceToNextHand(match);
    beginHand(advanced);
  }, [match, beginHand, startMatch]);

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
          onStart={() => startMatch({ ...config, seedCode: seedInput })}
          onResume={resumeMatch}
        />
      </>
    );
  }

  if (!match) return <div />;

  const opening = state ? isOpeningPlay(state) : false;
  const showReview = Boolean(review && match.phase !== 'playing');

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pb-4 pt-14 sm:pt-4">
      <BackToMenu />

      <div className="relative w-full max-w-2xl flex flex-col gap-3">
        <MatchScoreboard match={match} progress={matchProgressLabel(match)} />

        {state && (
          <>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((seat) => (
                <Opponent
                  key={seat}
                  name={SEAT_NAMES[seat]}
                  personality={personalityForSeat(seat)?.name ?? ''}
                  count={state.hands[seat].length}
                  active={state.turn === seat && state.phase === 'playing'}
                  passed={state.passed.includes(seat)}
                />
              ))}
            </div>

            <Table state={state} />

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

function Table({ state }: { state: GameState }): React.ReactElement {
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
            {SEAT_NAMES[state.tableOwner ?? 0]} 的 {TYPE_LABEL[state.table.type]}
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
}: {
  state: GameState;
  candidate: Play | null;
  playable: boolean;
  opening: boolean;
  hintReason: string | null;
}): React.ReactElement {
  let message: string;
  let tone = 'text-indigo-200';

  if (hintReason) {
    message = hintReason;
    tone = 'text-sky-300';
  } else if (state.phase === 'over') {
    message = '牌局結束';
  } else if (state.turn !== HUMAN) {
    const person = personalityForSeat(state.turn);
    message = person
      ? `${SEAT_NAMES[state.turn]}（${person.name}）思考中…`
      : `${SEAT_NAMES[state.turn]}思考中…`;
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
  const setDifficulty = (id: DifficultyId) =>
    setConfig((prev) => ({ ...prev, difficulty: id }));
  const setStraights = (rule: StraightRule) =>
    setConfig((prev) => ({ ...prev, rules: { ...prev.rules, straights: rule } }));
  const setMode = (mode: MatchMode) => setConfig((prev) => ({ ...prev, mode }));
  const setHands = (hands: MatchLength) => setConfig((prev) => ({ ...prev, hands }));
  const setTarget = (target: TargetScore) => setConfig((prev) => ({ ...prev, target }));
  const toggleRule = (key: keyof Pick<HouseRules, 'sizeLadder' | 'deuceDouble'>) =>
    setConfig((prev) => ({
      ...prev,
      rules: { ...prev.rules, [key]: !prev.rules[key] },
    }));

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
            系列賽累計牌分 · 四人各 {HAND_SIZE} 張 · 2 最大
          </p>
        </header>

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
            <li>系列賽把每局牌分累加 —— 留 2、剩很多張會讓整場翻船</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold mb-2 text-sm text-indigo-200">系列賽制</h2>
          <div className="flex flex-col gap-2">
            {(['hands', 'target'] as MatchMode[]).map((mode) => (
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
                  {mode === 'hands'
                    ? '打完指定局數，比累計籌碼'
                    : '有人先累積到目標分就結束'}
                </span>
              </button>
            ))}
          </div>
          {config.mode === 'hands' ? (
            <div className="mt-2 flex gap-2">
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
          ) : (
            <div className="mt-2 flex gap-2">
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
        </section>

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
            繼續未完的系列賽
          </button>
        )}

        <button
          type="button"
          onClick={onStart}
          className="min-h-[52px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-lg font-black touch-manipulation"
        >
          開始系列賽
        </button>

        {stats.games > 0 && (
          <p className="text-center text-xs text-indigo-100/50 leading-relaxed">
            {stats.games} 局 {stats.wins} 勝（
            {((stats.wins / stats.games) * 100).toFixed(0)}%）．累計{' '}
            {stats.chips >= 0 ? '+' : ''}
            {stats.chips} 分
            {stats.matches > 0 && (
              <>
                <br />
                系列賽 {stats.matches} 場 {stats.matchWins} 勝
                {stats.bestMatchStreak > 1 && `．最長連勝 ${stats.bestMatchStreak}`}
                {stats.bestMatchChips !== 0 &&
                  `．單場最佳 ${stats.bestMatchChips >= 0 ? '+' : ''}${stats.bestMatchChips}`}
              </>
            )}
          </p>
        )}
        <p className="text-center text-[11px] text-slate-600">
          四人局，單局平均勝率基準 {(100 / SEATS).toFixed(0)}%
        </p>
      </div>
    </div>
  );
}

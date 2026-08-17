import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { CardBack, CardView } from './components/CardView';
import { LOWEST_CARD_ID, cardLabel } from './game/cards';
import { TYPE_LABEL, detectPlay } from './game/plays';
import {
  canPass,
  deal,
  isOpeningPlay,
  outcome,
  pass,
  play,
  playsFor,
  sizeMultiplier,
} from './game/engine';
import { DIFFICULTIES, chooseMove } from './game/cpu';
import { normalizeSeedCode, randomSeedCode } from './game/rng';
import { EMPTY_STATS, loadStats, recordResult, saveStats } from './game/storage';
import { HAND_SIZE, HUMAN, SEATS } from './game/types';
import type { Card, DifficultyId, GameState, Play, Seat, StraightRule } from './game/types';

type Screen = 'setup' | 'game';

const CPU_DELAY = 700;
const SEAT_NAMES = ['你', '下家', '對家', '上家'];

export default function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('setup');
  const [stats, setStats] = useState(EMPTY_STATS);
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [straights, setStraights] = useState<StraightRule>('topCard');
  const [seedInput, setSeedInput] = useState('');
  const [state, setState] = useState<GameState | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [hint, setHint] = useState<Play | null>(null);
  const [recorded, setRecorded] = useState(false);

  useEffect(() => {
    const saved = loadStats();
    setStats(saved);
    setDifficulty(saved.lastDifficulty);
    setStraights(saved.lastStraights);
  }, []);

  // The setup screen and the table swap in place, so the window would otherwise
  // keep whatever scroll position the other one left behind.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const startGame = useCallback((id: DifficultyId, rule: StraightRule, seed: string) => {
    setState(deal(normalizeSeedCode(seed), id, { straights: rule }));
    setSelected([]);
    setHint(null);
    setRecorded(false);
    setScreen('game');
    setStats((prev) => {
      const next = { ...prev, lastDifficulty: id, lastStraights: rule };
      saveStats(next);
      return next;
    });
  }, []);

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

  const result = useMemo(() => (state ? outcome(state) : null), [state]);

  useEffect(() => {
    if (!result || recorded) return;
    setRecorded(true);
    const won = result.winner === HUMAN;
    const delta = won ? result.pot : -result.scores[HUMAN].penalty;
    setStats((prev) => {
      const next = recordResult(prev, won, delta);
      saveStats(next);
      return next;
    });
  }, [result, recorded]);

  const myTurn = state?.phase === 'playing' && state.turn === HUMAN;

  const selectedCards = useMemo(
    () => (state ? state.hands[HUMAN].filter((card) => selected.includes(card.id)) : []),
    [state, selected],
  );

  // What the current selection forms, and whether it is actually playable.
  // Showing this is the difference between learning the game and guessing at it
  // — but it reports on a choice already made rather than making it.
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
      setHint(null);
      setSelected((prev) =>
        prev.includes(card.id) ? prev.filter((id) => id !== card.id) : [...prev, card.id],
      );
    },
    [myTurn],
  );

  const submit = useCallback(() => {
    if (!state || !playable) return;
    setState(play(state, selectedCards));
    setSelected([]);
    setHint(null);
  }, [state, playable, selectedCards]);

  const doPass = useCallback(() => {
    if (!state || !canPass(state) || !myTurn) return;
    setState(pass(state));
    setSelected([]);
    setHint(null);
  }, [state, myTurn]);

  const showHint = useCallback(() => {
    if (!state || !myTurn) return;
    const options = playsFor(state);
    if (options.length === 0) return;
    const suggestion = options[0];
    setHint(suggestion);
    setSelected(suggestion.cards.map((card) => card.id));
  }, [state, myTurn]);

  if (screen === 'setup') {
    return (
      <Setup
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        straights={straights}
        setStraights={setStraights}
        seedInput={seedInput}
        setSeedInput={setSeedInput}
        stats={stats}
        onStart={() => startGame(difficulty, straights, seedInput || randomSeedCode())}
      />
    );
  }

  if (!state) return <div />;

  const opening = isOpeningPlay(state);

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pb-4 pt-14 sm:pt-4">
      <BackToMenu />

      <div className="w-full max-w-2xl flex flex-col gap-3">
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map((seat) => (
            <Opponent
              key={seat}
              name={SEAT_NAMES[seat]}
              count={state.hands[seat].length}
              active={state.turn === seat && state.phase === 'playing'}
              passed={state.passed.includes(seat)}
            />
          ))}
        </div>

        <Table state={state} />

        <Status state={state} candidate={candidate} playable={playable} opening={opening} />

        <section aria-label="你的手牌">
          <div className="bt-hand flex justify-center px-2 pt-3">
            {state.hands[HUMAN].map((card) => (
              <CardView
                key={card.id}
                card={card}
                selected={selected.includes(card.id)}
                hinted={hint?.cards.some((c) => c.id === card.id)}
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
            className="flex-1 min-h-[48px] rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 font-black"
          >
            出牌
          </button>
          <button
            type="button"
            onClick={doPass}
            disabled={!myTurn || !canPass(state)}
            className="min-h-[48px] px-5 rounded-xl border border-slate-600 hover:bg-slate-800 disabled:opacity-40 font-bold"
          >
            Pass
          </button>
          <button
            type="button"
            onClick={showHint}
            disabled={!myTurn}
            className="min-h-[48px] px-4 rounded-xl border border-slate-700 hover:bg-slate-800 disabled:opacity-40 text-sm"
          >
            提示
          </button>
        </div>

        {selected.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setSelected([]);
              setHint(null);
            }}
            className="mx-auto text-xs text-slate-400 underline min-h-[44px]"
          >
            清除選取
          </button>
        )}
      </div>

      {result && (
        <Result
          result={result}
          seedCode={state.seedCode}
          onAgain={() => startGame(state.difficulty, state.rules.straights, randomSeedCode())}
          onMenu={() => setScreen('setup')}
        />
      )}
    </div>
  );
}

function Opponent({
  name,
  count,
  active,
  passed,
}: {
  name: string;
  count: number;
  active: boolean;
  passed: boolean;
}): React.ReactElement {
  return (
    <div
      className={`rounded-xl px-2 py-2 text-center text-xs ${
        active ? 'bg-indigo-500/15 ring-1 ring-indigo-400/50' : 'bg-slate-900/50'
      }`}
    >
      <div className="font-bold">
        {name}
        {passed && <span className="text-slate-500 font-normal"> · pass</span>}
      </div>
      <div className={`tabular-nums ${count <= 3 ? 'text-amber-300 font-black' : 'text-slate-400'}`}>
        {count} 張
      </div>
    </div>
  );
}

function Table({ state }: { state: GameState }): React.ReactElement {
  return (
    <section className="bt-felt rounded-2xl p-4 min-h-[7rem] flex flex-col items-center justify-center gap-2" aria-label="檯面">
      {state.table ? (
        <>
          <div className="flex gap-1 bt-played">
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
}: {
  state: GameState;
  candidate: Play | null;
  playable: boolean;
  opening: boolean;
}): React.ReactElement {
  let message: string;
  let tone = 'text-indigo-200';

  if (state.phase === 'over') {
    message = '牌局結束';
  } else if (state.turn !== HUMAN) {
    message = `${SEAT_NAMES[state.turn]}思考中…`;
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
    <p className={`text-center text-sm font-bold min-h-[1.5rem] ${tone}`}>{message}</p>
  );
}

function Result({
  result,
  seedCode,
  onAgain,
  onMenu,
}: {
  result: NonNullable<ReturnType<typeof outcome>>;
  seedCode: string;
  onAgain: () => void;
  onMenu: () => void;
}): React.ReactElement {
  const won = result.winner === HUMAN;

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bt-result"
    >
      <div className="bg-slate-900 rounded-2xl p-6 max-w-sm w-full border border-indigo-500/30">
        <h2 id="bt-result" className="text-3xl font-black mb-1 text-center">
          {won ? '你贏了' : `${SEAT_NAMES[result.winner]}贏了`}
        </h2>
        <p className="text-center text-sm text-slate-400 mb-4">
          {won ? `收 ${result.pot} 分` : `你賠 ${result.scores[HUMAN].penalty} 分`}
        </p>

        <table className="w-full text-sm mb-4">
          <thead>
            <tr className="text-[11px] text-slate-500">
              <th className="text-left font-normal">座位</th>
              <th className="text-right font-normal">剩牌</th>
              <th className="text-right font-normal">倍率</th>
              <th className="text-right font-normal">2</th>
              <th className="text-right font-normal">牌分</th>
            </tr>
          </thead>
          <tbody>
            {result.scores.map((entry) => (
              <tr key={entry.seat} className={entry.seat === HUMAN ? 'text-indigo-300 font-bold' : ''}>
                <td className="text-left">
                  {SEAT_NAMES[entry.seat]}
                  {entry.seat === result.winner && ' 🏆'}
                </td>
                <td className="text-right tabular-nums">{entry.remaining}</td>
                <td className="text-right tabular-nums text-slate-500">
                  ×{sizeMultiplier(entry.remaining)}
                </td>
                <td className="text-right tabular-nums text-slate-500">
                  {entry.deuces > 0 ? `×${2 ** entry.deuces}` : '—'}
                </td>
                <td className="text-right tabular-nums font-black">{entry.penalty}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="text-[11px] text-slate-500 mb-4 text-center">種子碼 {seedCode}</p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAgain}
            className="flex-1 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-500 font-bold"
          >
            再來一局
          </button>
          <button
            type="button"
            onClick={onMenu}
            className="flex-1 min-h-[44px] rounded-xl border border-slate-600 hover:bg-slate-800"
          >
            設定
          </button>
        </div>
      </div>
    </div>
  );
}

function Setup({
  difficulty,
  setDifficulty,
  straights,
  setStraights,
  seedInput,
  setSeedInput,
  stats,
  onStart,
}: {
  difficulty: DifficultyId;
  setDifficulty: (id: DifficultyId) => void;
  straights: StraightRule;
  setStraights: (rule: StraightRule) => void;
  seedInput: string;
  setSeedInput: (value: string) => void;
  stats: ReturnType<typeof loadStats>;
  onStart: () => void;
}): React.ReactElement {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <BackToMenu />

      <div className="w-full max-w-md flex flex-col gap-5">
        <header className="text-center">
          <h1 className="text-4xl font-black tracking-tight">大老二</h1>
          <p className="text-indigo-200/60 text-sm mt-1">
            四人各 {HAND_SIZE} 張，先出完的贏．2 最大，3 最小
          </p>
        </header>

        <section className="bt-felt rounded-2xl p-4 text-sm">
          <h2 className="font-bold mb-2 text-indigo-200">三件事就會玩</h2>
          <ul className="text-indigo-100/70 leading-relaxed list-disc pl-4 space-y-1">
            <li>
              大小：<strong className="text-indigo-300">2 &gt; A &gt; K &gt; … &gt; 3</strong>，
              同點數再比花色 <strong className="text-indigo-300">♠ &gt; ♥ &gt; ♦ &gt; ♣</strong>
            </li>
            <li>只出 1、2、5 張。<strong className="text-indigo-300">張數要跟檯面一樣</strong>——五張壓不了單張</li>
            <li>連三家 Pass，最後出牌的人重新領出</li>
          </ul>
        </section>

        <section>
          <h2 className="font-bold mb-2 text-sm text-indigo-200">難度</h2>
          <div className="flex flex-col gap-2">
            {DIFFICULTIES.map((info) => (
              <button
                key={info.id}
                type="button"
                onClick={() => setDifficulty(info.id)}
                className={`text-left min-h-[44px] rounded-xl px-4 py-2 border transition-colors ${
                  difficulty === info.id
                    ? 'border-indigo-400 bg-indigo-500/15'
                    : 'border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <span className="font-bold">{info.label}</span>
                <span className="block text-xs text-indigo-100/60">{info.blurb}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-bold mb-1 text-sm text-indigo-200">順子大小</h2>
          <p className="text-[11px] text-indigo-100/50 mb-2">
            這是大老二唯一真的有爭議的規則，兩種都有人玩。
          </p>
          <div className="flex flex-col gap-2">
            {(
              [
                ['topCard', '比自己的最大張（坊間常見）', 'A2345 最小、23456 最大'],
                ['sequence', '照序列排（線上常見）', 'A2345 最小、10JQKA 最大'],
              ] as [StraightRule, string, string][]
            ).map(([rule, label, detail]) => (
              <button
                key={rule}
                type="button"
                onClick={() => setStraights(rule)}
                className={`text-left min-h-[44px] rounded-xl px-4 py-2 border transition-colors ${
                  straights === rule
                    ? 'border-indigo-400 bg-indigo-500/15'
                    : 'border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <span className="font-bold text-sm">{label}</span>
                <span className="block text-xs text-indigo-100/60">{detail}</span>
              </button>
            ))}
          </div>
        </section>

        <label className="text-sm">
          <span className="font-bold text-indigo-200">種子碼</span>
          <span className="text-indigo-100/50 text-xs"> — 留空隨機；相同種子碼是同一副牌</span>
          <input
            value={seedInput}
            onChange={(event) => setSeedInput(event.target.value)}
            placeholder="例如 64aa2bl7"
            className="mt-1 w-full min-h-[44px] rounded-xl bg-slate-900 border border-slate-700 px-3 focus:border-indigo-400 outline-none"
          />
        </label>

        <button
          type="button"
          onClick={onStart}
          className="min-h-[52px] rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-lg font-black"
        >
          開始牌局
        </button>

        {stats.games > 0 && (
          <p className="text-center text-xs text-indigo-100/50">
            {stats.games} 局 {stats.wins} 勝（{((stats.wins / stats.games) * 100).toFixed(0)}%）．
            累計 {stats.chips >= 0 ? '+' : ''}
            {stats.chips} 分
            {stats.bestStreak > 1 && `．最長連勝 ${stats.bestStreak}`}
          </p>
        )}
        <p className="text-center text-[11px] text-slate-600">四人局，平均勝率基準 {(100 / SEATS).toFixed(0)}%</p>
      </div>
    </div>
  );
}

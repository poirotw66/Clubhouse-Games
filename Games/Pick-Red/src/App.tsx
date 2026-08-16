import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { CardBack, CardView } from './components/CardView';
import {
  TOTAL_POINTS,
  WINNING_POINTS,
  capturableBy,
  cardLabel,
  isRed,
  sumPoints,
} from './game/cards';
import { DIFFICULTIES, chooseMove, difficultyInfo } from './game/cpu';
import { applyCpuPlay, choosePick, deal, flip, outcome, playCard, score } from './game/engine';
import { normalizeSeedCode, randomSeedCode } from './game/rng';
import { EMPTY_STATS, loadStats, recordResult, saveStats } from './game/storage';
import type { Card, DifficultyId, GameState } from './game/types';

type Screen = 'setup' | 'game';

const FLIP_DELAY = 850;
const CPU_DELAY = 700;

export default function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('setup');
  const [stats, setStats] = useState(EMPTY_STATS);
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [seedInput, setSeedInput] = useState('');
  const [state, setState] = useState<GameState | null>(null);
  const [selected, setSelected] = useState<Card | null>(null);
  const [recorded, setRecorded] = useState(false);

  useEffect(() => {
    const saved = loadStats();
    setStats(saved);
    setDifficulty(saved.lastDifficulty);
  }, []);

  // The setup screen and the table swap in place, so the window would otherwise
  // keep whatever scroll position the other one left behind.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const startGame = useCallback(
    (id: DifficultyId, seed: string) => {
      const info = difficultyInfo(id);
      const code = normalizeSeedCode(seed);
      setState(deal(code, id, info.leader));
      setSelected(null);
      setRecorded(false);
      setScreen('game');
      const next = { ...stats, lastDifficulty: id };
      setStats(next);
      saveStats(next);
    },
    [stats],
  );

  // The flip is on a timer rather than a button: it is the half of the turn the
  // player has no say in, and asking them to press a key to confirm that would
  // dress up a coin toss as a decision.
  useEffect(() => {
    if (state?.phase !== 'flip') return;
    const timer = setTimeout(() => setState((current) => (current ? flip(current) : current)), FLIP_DELAY);
    return () => clearTimeout(timer);
  }, [state]);

  useEffect(() => {
    if (state?.phase !== 'cpu_play') return;
    const timer = setTimeout(() => {
      setState((current) => {
        if (!current || current.phase !== 'cpu_play') return current;
        const move = chooseMove(current, difficultyInfo(current.difficulty).brain);
        return applyCpuPlay(current, move.card, move.taken);
      });
    }, CPU_DELAY);
    return () => clearTimeout(timer);
  }, [state]);

  const result = useMemo(() => (state?.phase === 'over' ? outcome(state) : null), [state]);

  useEffect(() => {
    if (!result || recorded) return;
    setRecorded(true);
    setStats((prev) => {
      const next = recordResult(prev, result.result, result.playerPoints);
      saveStats(next);
      return next;
    });
  }, [result, recorded]);

  const targets = useMemo(
    () => (state && selected ? capturableBy(selected, state.table) : []),
    [state, selected],
  );

  const myTurn = state?.phase === 'player_play';

  const commit = useCallback(
    (card: Card, target?: Card) => {
      setState((current) => {
        if (!current) return current;
        const played = playCard(current, card.id);
        // playCard parks in 'player_pick' only when several table cards match.
        if (played.phase === 'player_pick' && target) return choosePick(played, target.id);
        return played;
      });
      setSelected(null);
    },
    [],
  );

  const onHandCard = useCallback(
    (card: Card) => {
      if (!myTurn || !state) return;
      const options = capturableBy(card, state.table);

      // Tapping the same card again confirms. With one target that is the whole
      // interaction; with several the player has to name the one they want.
      if (selected?.id === card.id) {
        if (options.length > 1) return;
        commit(card, options[0]);
        return;
      }
      setSelected(card);
    },
    [commit, myTurn, selected, state],
  );

  const onTableCard = useCallback(
    (card: Card) => {
      if (!myTurn || !selected) return;
      if (!targets.some((t) => t.id === card.id)) return;
      commit(selected, card);
    },
    [commit, myTurn, selected, targets],
  );

  if (screen === 'setup') {
    return (
      <Setup
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        seedInput={seedInput}
        setSeedInput={setSeedInput}
        stats={stats}
        onStart={() => startGame(difficulty, seedInput || randomSeedCode())}
      />
    );
  }

  if (!state) return <div />;

  const playerPoints = score(state, 'player');
  const cpuPoints = score(state, 'cpu');
  const last = state.log[state.log.length - 1];
  const info = difficultyInfo(state.difficulty);

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pb-6 pt-14 sm:pt-4">
      <BackToMenu />

      <div className="w-full max-w-2xl flex flex-col gap-3">
        <ScoreBar playerPoints={playerPoints} cpuPoints={cpuPoints} />

        <Pile
          side="對手"
          cards={state.captured.cpu}
          count={state.hands.cpu.length}
          active={state.turn === 'cpu' && state.phase !== 'over'}
        />

        <section className="pr-felt rounded-2xl p-3 sm:p-4" aria-label="桌面">
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
              const isTarget = targets.some((t) => t.id === card.id);
              return (
                <CardView
                  key={card.id}
                  card={card}
                  target={isTarget}
                  landed={state.spotlight.includes(card.id)}
                  dimmed={Boolean(selected) && !isTarget}
                  onClick={isTarget ? () => onTableCard(card) : undefined}
                  label={isTarget ? `用 ${cardLabel(selected!)} 撿走 ${cardLabel(card)}` : undefined}
                />
              );
            })}
          </div>
        </section>

        <Status state={state} selected={selected} targets={targets} last={last} />

        <section aria-label="你的手牌">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {state.hands.player.map((card) => (
              <CardView
                key={card.id}
                card={card}
                selected={selected?.id === card.id}
                onClick={myTurn ? () => onHandCard(card) : undefined}
              />
            ))}
          </div>
        </section>

        {selected && targets.length === 0 && myTurn && (
          <button
            type="button"
            onClick={() => commit(selected)}
            className="mx-auto min-h-[44px] rounded-xl bg-amber-600 hover:bg-amber-500 px-5 font-bold"
          >
            打出 {cardLabel(selected)}（撿不到，留在桌上）
          </button>
        )}

        <Pile
          side="你"
          cards={state.captured.player}
          count={state.hands.player.length}
          active={myTurn}
        />
      </div>

      {result && (
        <Result
          result={result}
          seedCode={state.seedCode}
          difficultyLabel={info.label}
          onAgain={() => startGame(state.difficulty, randomSeedCode())}
          onMenu={() => setScreen('setup')}
        />
      )}
    </div>
  );
}

function ScoreBar({
  playerPoints,
  cpuPoints,
}: {
  playerPoints: number;
  cpuPoints: number;
}): React.ReactElement {
  const decided = Math.max(playerPoints, cpuPoints) >= WINNING_POINTS;
  return (
    <div>
      <div className="flex justify-between text-sm font-bold mb-1">
        <span className="text-emerald-300">
          你 {playerPoints}
          {playerPoints >= WINNING_POINTS && ' 🏆'}
        </span>
        <span className="text-emerald-200/50 text-xs self-center">
          {decided ? '已過半' : `過 ${WINNING_POINTS} 分獲勝`}
        </span>
        <span className="text-rose-300">
          {cpuPoints} 對手
          {cpuPoints >= WINNING_POINTS && ' 🏆'}
        </span>
      </div>
      {/* Both bars are drawn against the full 208, so the gap between them is
          the real margin rather than a share of the points banked so far. */}
      <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden flex">
        <div
          className="bg-emerald-500 h-full transition-all"
          style={{ width: `${(playerPoints / TOTAL_POINTS) * 100}%` }}
        />
        <div className="flex-1" />
        <div
          className="bg-rose-500 h-full transition-all"
          style={{ width: `${(cpuPoints / TOTAL_POINTS) * 100}%` }}
        />
      </div>
    </div>
  );
}

function Pile({
  side,
  cards,
  count,
  active,
}: {
  side: string;
  cards: Card[];
  count: number;
  active: boolean;
}): React.ReactElement {
  const reds = cards.filter(isRed);
  return (
    <div
      className={`flex items-center gap-2 text-xs rounded-xl px-3 py-2 ${
        active ? 'bg-emerald-500/10 ring-1 ring-emerald-400/40' : 'bg-slate-900/40'
      }`}
    >
      <span className="font-bold w-10 shrink-0">{side}</span>
      <span className="text-emerald-200/60 shrink-0">手牌 {count}</span>
      <div className="flex flex-wrap gap-0.5 justify-end flex-1">
        {reds.length === 0 && <span className="text-emerald-200/30">尚未撿到紅牌</span>}
        {reds.map((card) => (
          <CardView key={card.id} card={card} size="sm" />
        ))}
      </div>
      <span className="font-black tabular-nums shrink-0">{sumPoints(cards)}</span>
    </div>
  );
}

function Status({
  state,
  selected,
  targets,
  last,
}: {
  state: GameState;
  selected: Card | null;
  targets: Card[];
  last: GameState['log'][number] | undefined;
}): React.ReactElement {
  let message: string;

  if (state.phase === 'over') message = '牌局結束';
  else if (state.phase === 'flip') message = '翻牌中…';
  else if (state.phase === 'cpu_play') message = '對手思考中…';
  else if (selected && targets.length > 1) message = `選一張要撿走的（${targets.length} 張可撿）`;
  else if (selected && targets.length === 1) message = `再點一次 ${cardLabel(selected)} 撿走 ${cardLabel(targets[0])}`;
  else if (selected) message = `${cardLabel(selected)} 撿不到任何牌`;
  else message = '點一張手牌';

  return (
    <div className="text-center text-sm min-h-[2.5rem] flex flex-col justify-center">
      <p className="font-bold text-emerald-200">{message}</p>
      {last && (
        <p className="text-xs text-emerald-200/50">
          {last.by === 'player' ? '你' : '對手'}
          {last.source === 'pile' ? '翻到' : '打出'} {cardLabel(last.played)}
          {last.taken ? ` → 撿走 ${cardLabel(last.taken)}（+${last.points}）` : '，留在桌上'}
        </p>
      )}
    </div>
  );
}

function Result({
  result,
  seedCode,
  difficultyLabel,
  onAgain,
  onMenu,
}: {
  result: ReturnType<typeof outcome>;
  seedCode: string;
  difficultyLabel: string;
  onAgain: () => void;
  onMenu: () => void;
}): React.ReactElement {
  const title =
    result.result === 'win' ? '你贏了' : result.result === 'loss' ? '你輸了' : '和局';

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pr-result"
    >
      <div className="bg-slate-900 rounded-2xl p-6 max-w-sm w-full text-center border border-emerald-500/30">
        <h2 id="pr-result" className="text-3xl font-black mb-3">
          {title}
        </h2>
        <p className="text-4xl font-black tabular-nums mb-1">
          <span className="text-emerald-400">{result.playerPoints}</span>
          <span className="text-slate-500 mx-2">:</span>
          <span className="text-rose-400">{result.cpuPoints}</span>
        </p>
        {result.wastedPoints > 0 && (
          <p className="text-xs text-amber-300/80 mb-2">
            桌上作廢 {result.wastedPoints} 分（不算任何人）
          </p>
        )}
        <p className="text-xs text-slate-400 mb-5">
            {difficultyLabel}．種子碼 {seedCode}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onAgain}
            className="flex-1 min-h-[44px] rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold"
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
  seedInput,
  setSeedInput,
  stats,
  onStart,
}: {
  difficulty: DifficultyId;
  setDifficulty: (id: DifficultyId) => void;
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
          <h1 className="text-4xl font-black tracking-tight">撿紅點</h1>
          <p className="text-emerald-200/60 text-sm mt-1">
            湊十撿牌，只有紅牌算分．全場 {TOTAL_POINTS} 分，過 {WINNING_POINTS} 分獲勝
          </p>
        </header>

        <section className="pr-felt rounded-2xl p-4 text-sm">
          <h2 className="font-bold mb-2 text-emerald-200">怎麼配對</h2>
          <p className="text-emerald-100/70 leading-relaxed">
            <strong className="text-emerald-300">A～9 相加等於 10</strong>
            （A+9、2+8、3+7、4+6、5+5），
            <strong className="text-emerald-300">10、J、Q、K 則要同點數</strong>
            。分界就在 10：十以下用加的，十以上用對的。
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2 text-sm text-emerald-200">難度</h2>
          <div className="flex flex-col gap-2">
            {DIFFICULTIES.map((info) => (
              <button
                key={info.id}
                type="button"
                onClick={() => setDifficulty(info.id)}
                className={`text-left min-h-[44px] rounded-xl px-4 py-2 border transition-colors ${
                  difficulty === info.id
                    ? 'border-emerald-400 bg-emerald-500/15'
                    : 'border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <span className="font-bold">{info.label}</span>
                <span className="block text-xs text-emerald-100/60">{info.blurb}</span>
              </button>
            ))}
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

        <button
          type="button"
          onClick={onStart}
          className="min-h-[52px] rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-lg font-black"
        >
          開始牌局
        </button>

        {stats.wins + stats.losses + stats.draws > 0 && (
          <p className="text-center text-xs text-emerald-100/50">
            {stats.wins} 勝 {stats.losses} 敗 {stats.draws} 和．最高 {stats.best} 分
            {stats.bestStreak > 1 && `．最長連勝 ${stats.bestStreak}`}
          </p>
        )}
      </div>
    </div>
  );
}

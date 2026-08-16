import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { CardBack, CardView } from './components/CardView';
import { BLACK_ACE_POINTS, TOTAL_POINTS, capturableBy, cardLabel, isRed, parScore, sumPoints } from './game/cards';
import { DIFFICULTIES, chooseMove, difficultyInfo, leaderFor } from './game/cpu';
import { applyPlay, choosePick, deal, flip, handSize, outcome, playCard, score } from './game/engine';
import { normalizeSeedCode, randomSeedCode } from './game/rng';
import { EMPTY_STATS, loadStats, recordResult, saveStats } from './game/storage';
import { HUMAN } from './game/types';
import type { Card, DifficultyId, GameState, PlayerCount, Seat } from './game/types';

type Screen = 'setup' | 'game';

const FLIP_DELAY = 800;
const CPU_DELAY = 650;

const SEAT_NAMES = ['你', '對家甲', '對家乙', '對家丙'];

export default function App(): React.ReactElement {
  const [screen, setScreen] = useState<Screen>('setup');
  const [stats, setStats] = useState(EMPTY_STATS);
  const [difficulty, setDifficulty] = useState<DifficultyId>('normal');
  const [players, setPlayers] = useState<PlayerCount>(2);
  const [blackAces, setBlackAces] = useState(false);
  const [seedInput, setSeedInput] = useState('');
  const [state, setState] = useState<GameState | null>(null);
  const [selected, setSelected] = useState<Card | null>(null);
  const [recorded, setRecorded] = useState(false);

  useEffect(() => {
    const saved = loadStats();
    setStats(saved);
    setDifficulty(saved.lastDifficulty);
    setPlayers(saved.lastPlayers);
    setBlackAces(saved.lastBlackAces);
  }, []);

  // The setup screen and the table swap in place, so the window would otherwise
  // keep whatever scroll position the other one left behind.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  const startGame = useCallback(
    (id: DifficultyId, count: PlayerCount, aces: boolean, seed: string) => {
      setState(deal(normalizeSeedCode(seed), id, { players: count, blackAces: aces }, leaderFor(id, count)));
      setSelected(null);
      setRecorded(false);
      setScreen('game');
      setStats((prev) => {
        const next = { ...prev, lastDifficulty: id, lastPlayers: count, lastBlackAces: aces };
        saveStats(next);
        return next;
      });
    },
    [],
  );

  const humanTurn = state ? state.turn === HUMAN : false;
  const waitingOnHuman =
    humanTurn && (state?.phase === 'play' || state?.phase === 'pick_play' || state?.phase === 'pick_flip');

  // The flip runs on a timer rather than a button. It is the half of the turn
  // nobody has a say in, and asking for a keypress to confirm it would dress up
  // a coin toss as a decision — but it still stops if it lands on a choice.
  useEffect(() => {
    if (state?.phase !== 'flip') return;
    const timer = setTimeout(() => setState((current) => (current ? flip(current) : current)), FLIP_DELAY);
    return () => clearTimeout(timer);
  }, [state]);

  // CPU seats act on a delay, for both their play and any pick it lands on.
  useEffect(() => {
    if (!state || state.turn === HUMAN || state.phase === 'over' || state.phase === 'flip') return;
    const timer = setTimeout(() => {
      setState((current) => {
        if (!current || current.turn === HUMAN) return current;
        const brain = difficultyInfo(current.difficulty).brain;

        if (current.phase === 'pick_play' || current.phase === 'pick_flip') {
          const options = capturableBy(current.pending!, current.table);
          const best = [...options].sort(
            (a, b) => sumPoints([b], current.rules.blackAces) - sumPoints([a], current.rules.blackAces),
          )[0];
          return choosePick(current, best.id);
        }

        const move = chooseMove(current, brain);
        return applyPlay(current, move.card, move.taken);
      });
    }, CPU_DELAY);
    return () => clearTimeout(timer);
  }, [state]);

  const result = useMemo(() => (state?.phase === 'over' ? outcome(state) : null), [state]);

  useEffect(() => {
    if (!result || recorded) return;
    setRecorded(true);
    setStats((prev) => {
      const next = recordResult(prev, result.result, result.scores[HUMAN]);
      saveStats(next);
      return next;
    });
  }, [result, recorded]);

  // While a pick is outstanding the targets come from the parked card, not from
  // whatever hand card happens to be selected.
  const pickPending = state?.phase === 'pick_play' || state?.phase === 'pick_flip';
  const targets = useMemo(() => {
    if (!state) return [];
    if (pickPending && humanTurn) return capturableBy(state.pending!, state.table);
    return selected ? capturableBy(selected, state.table) : [];
  }, [state, selected, pickPending, humanTurn]);

  const commit = useCallback((card: Card, target?: Card) => {
    setState((current) => {
      if (!current) return current;
      const played = playCard(current, card.id);
      if (played.phase === 'pick_play' && target) return choosePick(played, target.id);
      return played;
    });
    setSelected(null);
  }, []);

  const onHandCard = useCallback(
    (card: Card) => {
      if (!state || state.phase !== 'play' || !humanTurn) return;
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
    [commit, humanTurn, selected, state],
  );

  const onTableCard = useCallback(
    (card: Card) => {
      if (!state || !humanTurn) return;
      if (!targets.some((t) => t.id === card.id)) return;
      if (pickPending) {
        setState((current) => (current ? choosePick(current, card.id) : current));
        setSelected(null);
        return;
      }
      if (selected) commit(selected, card);
    },
    [commit, humanTurn, pickPending, selected, state, targets],
  );

  if (screen === 'setup') {
    return (
      <Setup
        difficulty={difficulty}
        setDifficulty={setDifficulty}
        players={players}
        setPlayers={setPlayers}
        blackAces={blackAces}
        setBlackAces={setBlackAces}
        seedInput={seedInput}
        setSeedInput={setSeedInput}
        stats={stats}
        onStart={() => startGame(difficulty, players, blackAces, seedInput || randomSeedCode())}
      />
    );
  }

  if (!state) return <div />;

  const last = state.log[state.log.length - 1];
  const info = difficultyInfo(state.difficulty);
  const par = parScore(state.rules.players, state.rules.blackAces);
  const deckTotal = TOTAL_POINTS + (state.rules.blackAces ? BLACK_ACE_POINTS : 0);

  return (
    <div className="min-h-screen flex flex-col items-center px-3 pb-6 pt-14 sm:pt-4">
      <BackToMenu />

      <div className="w-full max-w-2xl flex flex-col gap-3">
        <ScoreBar state={state} par={par} deckTotal={deckTotal} />

        {state.hands.map((_, seat) =>
          seat === HUMAN ? null : (
            <Pile
              key={seat}
              name={SEAT_NAMES[seat]}
              cards={state.captured[seat]}
              count={state.hands[seat].length}
              blackAces={state.rules.blackAces}
              active={state.turn === seat && state.phase !== 'over'}
            />
          ),
        )}

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
              const isTarget = humanTurn && targets.some((t) => t.id === card.id);
              return (
                <CardView
                  key={card.id}
                  card={card}
                  blackAces={state.rules.blackAces}
                  target={isTarget}
                  landed={state.spotlight.includes(card.id)}
                  dimmed={(Boolean(selected) || pickPending) && !isTarget}
                  onClick={isTarget ? () => onTableCard(card) : undefined}
                />
              );
            })}
          </div>
        </section>

        <Status state={state} selected={selected} targets={targets} last={last} humanTurn={humanTurn} />

        <section aria-label="你的手牌">
          <div className="flex flex-wrap gap-1.5 justify-center">
            {state.hands[HUMAN].map((card) => (
              <CardView
                key={card.id}
                card={card}
                blackAces={state.rules.blackAces}
                selected={selected?.id === card.id}
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
          cards={state.captured[HUMAN]}
          count={state.hands[HUMAN].length}
          blackAces={state.rules.blackAces}
          active={humanTurn && state.phase !== 'over'}
        />
      </div>

      {result && (
        <Result
          result={result}
          seedCode={state.seedCode}
          summary={`${info.label}．${state.rules.players} 人${state.rules.blackAces ? '．含黑A' : ''}`}
          onAgain={() =>
            startGame(state.difficulty, state.rules.players, state.rules.blackAces, randomSeedCode())
          }
          onMenu={() => setScreen('setup')}
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
      {/* Drawn against the whole deck, so the bars show the real margin rather
          than a share of whatever has been banked so far. */}
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
  cards,
  count,
  blackAces,
  active,
}: {
  name: string;
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
      <span className="font-bold w-14 shrink-0">{name}</span>
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
}: {
  state: GameState;
  selected: Card | null;
  targets: Card[];
  last: GameState['log'][number] | undefined;
  humanTurn: boolean;
}): React.ReactElement {
  let message: string;

  if (state.phase === 'over') message = '牌局結束';
  else if (state.phase === 'flip') message = '翻牌中…';
  else if ((state.phase === 'pick_play' || state.phase === 'pick_flip') && humanTurn) {
    message =
      state.phase === 'pick_flip'
        ? `翻到 ${cardLabel(state.pending!)}，選一張要撿走的`
        : `選一張要撿走的（${targets.length} 張可撿）`;
  } else if (!humanTurn) message = `${SEAT_NAMES[state.turn]}思考中…`;
  // Order matters here: the many-targets case has to be tested before the
  // catch-all, or picking between two captures reads as "can't capture".
  else if (selected && targets.length > 1)
    message = `${cardLabel(selected)} 可以撿 ${targets.length} 張，選一張`;
  else if (selected && targets.length === 1)
    message = `再點一次 ${cardLabel(selected)} 撿走 ${cardLabel(targets[0])}`;
  else if (selected) message = `${cardLabel(selected)} 撿不到任何牌`;
  else message = '點一張手牌';

  return (
    <div className="text-center text-sm min-h-[2.5rem] flex flex-col justify-center">
      <p className="font-bold text-emerald-200">{message}</p>
      {last && (
        <p className="text-xs text-emerald-200/50">
          {SEAT_NAMES[last.by]}
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
  summary,
  onAgain,
  onMenu,
}: {
  result: ReturnType<typeof outcome>;
  seedCode: string;
  summary: string;
  onAgain: () => void;
  onMenu: () => void;
}): React.ReactElement {
  const title = result.result === 'win' ? '你贏了' : result.result === 'draw' ? '平手' : '你輸了';

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
        <div className="flex flex-col gap-1 mb-3">
          {result.scores.map((points, seat) => (
            <p key={seat} className="flex justify-between text-sm">
              <span className={seat === HUMAN ? 'text-emerald-300 font-bold' : 'text-slate-300'}>
                {SEAT_NAMES[seat]}
                {result.winners.includes(seat) && ' 🏆'}
              </span>
              <span className="tabular-nums font-black">
                {points}
                <span className={`ml-2 text-xs ${points > result.par ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {points > result.par ? '合格' : '不合格'}
                </span>
              </span>
            </p>
          ))}
        </div>
        {result.wastedPoints > 0 && (
          <p className="text-xs text-amber-300/80 mb-2">
            桌上作廢 {result.wastedPoints} 分（不算任何人）
          </p>
        )}
        <p className="text-xs text-slate-400 mb-5">
          {summary}．標準分 {result.par}．種子碼 {seedCode}
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
  players,
  setPlayers,
  blackAces,
  setBlackAces,
  seedInput,
  setSeedInput,
  stats,
  onStart,
}: {
  difficulty: DifficultyId;
  setDifficulty: (id: DifficultyId) => void;
  players: PlayerCount;
  setPlayers: (count: PlayerCount) => void;
  blackAces: boolean;
  setBlackAces: (on: boolean) => void;
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
            湊十撿牌，只有紅牌算分．全場 {TOTAL_POINTS} 分，過標準分即合格
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
          <p className="text-emerald-100/50 text-xs mt-2">
            計分：紅 A 二十分，紅 9、10、J、Q、K 各十分，紅 2～8 依牌面。
          </p>
        </section>

        <section>
          <h2 className="font-bold mb-2 text-sm text-emerald-200">人數</h2>
          <div className="flex gap-2">
            {([2, 3, 4] as PlayerCount[]).map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setPlayers(count)}
                className={`flex-1 min-h-[44px] rounded-xl border transition-colors ${
                  players === count
                    ? 'border-emerald-400 bg-emerald-500/15'
                    : 'border-slate-700 hover:bg-slate-800/60'
                }`}
              >
                <span className="font-bold">{count} 人</span>
                <span className="block text-[11px] text-emerald-100/50">
                  各 {handSize(count)} 張．標準分 {parScore(count, blackAces)}
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

        <button
          type="button"
          onClick={() => setBlackAces(!blackAces)}
          aria-pressed={blackAces}
          className={`text-left min-h-[44px] rounded-xl px-4 py-2 border transition-colors ${
            blackAces ? 'border-amber-400 bg-amber-500/15' : 'border-slate-700 hover:bg-slate-800/60'
          }`}
        >
          <span className="font-bold text-sm">黑A 也算分{blackAces ? '（開）' : '（關）'}</span>
          <span className="block text-xs text-emerald-100/60">
            常見的家規變體：黑桃 A 三十分、梅花 A 四十分，全場變 {TOTAL_POINTS + BLACK_ACE_POINTS} 分。
          </span>
        </button>

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

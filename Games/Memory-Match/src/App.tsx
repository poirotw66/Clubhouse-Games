import { useCallback, useEffect, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playError, playLose, playMove, playScore, playWin } from '@clubhouse/shared/synthAudio';
import {
  SPRINT_LIMIT_SEC,
  allMatched,
  buildDeck,
  hintPairIndices,
  loadBestMoves,
  loadBestSprintSec,
  saveBestMoves,
  saveBestSprintSec,
  type MemoryCard,
  type PairCount,
  type PlayMode,
} from './memoryLogic';

const PAIR_OPTIONS: { count: PairCount; label: string }[] = [
  { count: 4, label: '簡單 · 4 對' },
  { count: 6, label: '普通 · 6 對' },
];

const HINT_PEEK_MS = 900;

export default function App() {
  const [pairCount, setPairCount] = useState<PairCount>(6);
  const [mode, setMode] = useState<PlayMode>('classic');
  const [cards, setCards] = useState<MemoryCard[]>(() => buildDeck(6));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [locks, setLocks] = useState(false);
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const [best, setBest] = useState<number | null>(() => loadBestMoves(6));
  const [bestSprint, setBestSprint] = useState<number | null>(() => loadBestSprintSec(6));
  const [newRecord, setNewRecord] = useState(false);
  const [hintFlash, setHintFlash] = useState<number[]>([]);

  const restart = useCallback((count: PairCount = pairCount, nextMode: PlayMode = mode) => {
    setPairCount(count);
    setMode(nextMode);
    setCards(buildDeck(count));
    setFlipped([]);
    setLocks(false);
    setMoves(0);
    setElapsed(0);
    setWon(false);
    setLost(false);
    setNewRecord(false);
    setHintFlash([]);
    setBest(loadBestMoves(count));
    setBestSprint(loadBestSprintSec(count));
  }, [pairCount, mode]);

  useEffect(() => {
    if (won || lost) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [won, lost, cards]);

  useEffect(() => {
    if (won || lost) return;
    if (mode === 'sprint' && elapsed >= SPRINT_LIMIT_SEC) {
      setLost(true);
      playLose();
    }
  }, [elapsed, mode, won, lost]);

  useEffect(() => {
    if (!won && !lost && allMatched(cards)) {
      setWon(true);
      playWin();
      if (mode === 'classic') {
        const saved = saveBestMoves(pairCount, moves);
        setBest(saved);
        setNewRecord(saved === moves);
      } else {
        const saved = saveBestSprintSec(pairCount, elapsed);
        setBestSprint(saved);
        setNewRecord(saved === elapsed);
      }
    }
  }, [cards, won, lost, moves, elapsed, pairCount, mode]);

  useEffect(() => {
    if (flipped.length !== 2) return;
    const [a, b] = flipped;
    const match = cards[a].face === cards[b].face;
    setLocks(true);
    setMoves((m) => m + 1);
    const t = window.setTimeout(() => {
      if (match) {
        playScore();
        setCards((prev) =>
          prev.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c)),
        );
      } else {
        playError();
      }
      setFlipped([]);
      setLocks(false);
    }, match ? 280 : 650);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faces fixed for the deal
  }, [flipped]);

  useEffect(() => {
    if (hintFlash.length === 0) return;
    const t = window.setTimeout(() => setHintFlash([]), HINT_PEEK_MS);
    return () => window.clearTimeout(t);
  }, [hintFlash]);

  const onCard = (index: number) => {
    if (locks || won || lost || hintFlash.length > 0) return;
    const card = cards[index];
    if (card.matched || flipped.includes(index)) return;
    if (flipped.length >= 2) return;
    setFlipped((f) => [...f, index]);
  };

  const handleHint = () => {
    if (locks || won || lost || flipped.length > 0 || hintFlash.length > 0) return;
    const pair = hintPairIndices(cards);
    if (!pair) return;
    setHintFlash(pair);
    playMove();
  };

  const gridCols = pairCount === 4 ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-4';
  const remain = Math.max(0, SPRINT_LIMIT_SEC - elapsed);
  const canHint = !locks && !won && !lost && flipped.length === 0 && hintFlash.length === 0;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 gap-4"
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
      <h1 className="text-2xl font-bold tracking-wide">記憶配對</h1>
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="模式">
        {(
          [
            { id: 'classic' as const, label: '經典' },
            { id: 'sprint' as const, label: `衝刺 ${SPRINT_LIMIT_SEC}s` },
          ] as const
        ).map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => restart(pairCount, id)}
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
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="難度">
        {PAIR_OPTIONS.map(({ count, label }) => (
          <button
            key={count}
            type="button"
            onClick={() => restart(count, mode)}
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
      <p className="text-sm text-slate-300">
        翻牌次數：{moves}
        {mode === 'sprint' ? ` · 剩餘 ${remain}s` : ''}
        {mode === 'classic' && best != null ? ` · 最佳：${best}` : ''}
        {mode === 'sprint' && bestSprint != null ? ` · 最佳 ${bestSprint}s` : ''}
      </p>
      <div className={`grid ${gridCols} gap-2 w-[min(94vw,420px)]`}>
        {cards.map((card, i) => {
          const show = card.matched || flipped.includes(i) || hintFlash.includes(i);
          const hinted = hintFlash.includes(i);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onCard(i)}
              disabled={locks || card.matched || hintFlash.length > 0}
              className={`aspect-[3/4] rounded-xl border shadow-md overflow-hidden touch-manipulation bg-cover bg-center active:scale-95 ${
                hinted ? 'border-amber-300 ring-2 ring-amber-400/80' : 'border-white/20'
              }`}
              style={
                show
                  ? {
                      backgroundColor: '#f8fafc',
                      backgroundImage: [
                        'linear-gradient(rgba(255,255,255,0.15), rgba(255,255,255,0.25))',
                        `url(${import.meta.env.BASE_URL}faces/${card.face}.jpg)`,
                      ].join(', '),
                    }
                  : {
                      backgroundColor: '#1e3a8a',
                      backgroundImage: `url(${import.meta.env.BASE_URL}card-back.jpg)`,
                    }
              }
              aria-label={show ? card.face : '背面牌'}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={handleHint}
          disabled={!canHint}
          className="min-h-[44px] px-5 rounded-xl border border-amber-500/50 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25 disabled:opacity-40 font-medium touch-manipulation"
        >
          提示
        </button>
        <button
          type="button"
          onClick={() => restart()}
          className="min-h-[44px] px-5 rounded-xl bg-slate-700 hover:bg-slate-600 font-medium touch-manipulation"
        >
          重開一局
        </button>
      </div>
      {won && (
        <ResultOverlay
          title="全部配對！"
          variant="win"
          badge={newRecord ? '新紀錄' : undefined}
          stats={[
            { label: '翻牌次數', value: moves },
            { label: '配對數', value: pairCount },
            {
              label: mode === 'classic' ? '最佳' : '最佳衝刺',
              value: mode === 'classic' ? (best ?? moves) : `${bestSprint ?? elapsed}s`,
            },
          ]}
          onPrimary={() => restart()}
        />
      )}
      {lost && (
        <ResultOverlay
          title="時間到"
          variant="lose"
          subtitle={`衝刺限時 ${SPRINT_LIMIT_SEC} 秒`}
          stats={[
            { label: '翻牌次數', value: moves },
            { label: '已配對', value: cards.filter((c) => c.matched).length / 2 },
          ]}
          onPrimary={() => restart()}
        />
      )}
    </div>
  );
}

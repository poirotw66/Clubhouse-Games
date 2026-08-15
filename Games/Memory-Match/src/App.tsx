import { useCallback, useEffect, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playError, playScore, playWin } from '@clubhouse/shared/synthAudio';
import {
  allMatched,
  buildDeck,
  loadBestMoves,
  saveBestMoves,
  type MemoryCard,
  type PairCount,
} from './memoryLogic';

const PAIR_OPTIONS: { count: PairCount; label: string }[] = [
  { count: 4, label: '簡單 · 4 對' },
  { count: 6, label: '普通 · 6 對' },
];

export default function App() {
  const [pairCount, setPairCount] = useState<PairCount>(6);
  const [cards, setCards] = useState<MemoryCard[]>(() => buildDeck(6));
  const [flipped, setFlipped] = useState<number[]>([]);
  const [locks, setLocks] = useState(false);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [best, setBest] = useState<number | null>(() => loadBestMoves(6));
  const [newRecord, setNewRecord] = useState(false);

  const restart = useCallback((count: PairCount = pairCount) => {
    setPairCount(count);
    setCards(buildDeck(count));
    setFlipped([]);
    setLocks(false);
    setMoves(0);
    setWon(false);
    setNewRecord(false);
    setBest(loadBestMoves(count));
  }, [pairCount]);

  useEffect(() => {
    if (!won && allMatched(cards)) {
      setWon(true);
      playWin();
      const saved = saveBestMoves(pairCount, moves);
      setBest(saved);
      setNewRecord(saved === moves);
    }
  }, [cards, won, moves, pairCount]);

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

  const onCard = (index: number) => {
    if (locks || won) return;
    const card = cards[index];
    if (card.matched || flipped.includes(index)) return;
    if (flipped.length >= 2) return;
    setFlipped((f) => [...f, index]);
  };

  const gridCols = pairCount === 4 ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-4';

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
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="難度">
        {PAIR_OPTIONS.map(({ count, label }) => (
          <button
            key={count}
            type="button"
            onClick={() => restart(count)}
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
        {best != null ? ` · 最佳：${best}` : ''}
      </p>
      <div className={`grid ${gridCols} gap-2 w-[min(94vw,420px)]`}>
        {cards.map((card, i) => {
          const show = card.matched || flipped.includes(i);
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => onCard(i)}
              disabled={locks || card.matched}
              className="aspect-[3/4] rounded-xl border border-white/20 shadow-md overflow-hidden touch-manipulation bg-cover bg-center active:scale-95"
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
      <button
        type="button"
        onClick={() => restart()}
        className="min-h-[44px] px-5 rounded-xl bg-slate-700 hover:bg-slate-600 font-medium touch-manipulation"
      >
        重開一局
      </button>
      {won && (
        <ResultOverlay
          title="全部配對！"
          variant="win"
          badge={newRecord ? '新紀錄' : undefined}
          stats={[
            { label: '翻牌次數', value: moves },
            { label: '配對數', value: pairCount },
            { label: '最佳', value: best ?? moves },
          ]}
          onPrimary={() => restart()}
        />
      )}
    </div>
  );
}

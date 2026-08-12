import { useCallback, useEffect, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playError, playScore, playWin } from '@clubhouse/shared/synthAudio';
import { allMatched, buildDeck, type MemoryCard } from './memoryLogic';

export default function App() {
  const [cards, setCards] = useState<MemoryCard[]>(() => buildDeck());
  const [flipped, setFlipped] = useState<number[]>([]);
  const [locks, setLocks] = useState(false);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);

  const restart = useCallback(() => {
    setCards(buildDeck());
    setFlipped([]);
    setLocks(false);
    setMoves(0);
    setWon(false);
  }, []);

  useEffect(() => {
    if (!won && allMatched(cards)) {
      setWon(true);
      playWin();
    }
  }, [cards, won]);

  useEffect(() => {
    if (flipped.length !== 2) return;
    const [a, b] = flipped;
    const faceA = cards[a].face;
    const faceB = cards[b].face;
    const match = faceA === faceB;
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
    // ponytail: only react to a completed pair; tile faces are fixed for the deal
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cards faces stable until match paint
  }, [flipped]);

  const onCard = (index: number) => {
    if (locks || won) return;
    const card = cards[index];
    if (card.matched || flipped.includes(index)) return;
    if (flipped.length >= 2) return;
    setFlipped((f) => [...f, index]);
  };

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
      <p className="text-sm text-slate-300">翻牌次數：{moves}</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 w-[min(94vw,420px)]">
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
              aria-label={show ? card.face : 'Face-down card'}
            />
          );
        })}
      </div>
      <button
        type="button"
        onClick={restart}
        className="min-h-[44px] px-5 rounded-xl bg-slate-700 hover:bg-slate-600 font-medium"
      >
        重開一局
      </button>
      {won && (
        <ResultOverlay
          title="全部配對！"
          variant="win"
          stats={[{ label: '翻牌次數', value: moves }]}
          onPrimary={restart}
        />
      )}
    </div>
  );
}

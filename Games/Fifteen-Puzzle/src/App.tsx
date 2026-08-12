import { useCallback, useEffect, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playScore, playWin } from '@clubhouse/shared/synthAudio';
import { isSolved, neighborsOfEmpty, slide, shuffledBoard, type Board } from './fifteenLogic';

export default function App() {
  const [board, setBoard] = useState<Board>(() => shuffledBoard());
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);

  const restart = useCallback(() => {
    setBoard(shuffledBoard());
    setMoves(0);
    setWon(false);
  }, []);

  useEffect(() => {
    if (!won && isSolved(board)) {
      setWon(true);
      playWin();
    }
  }, [board, won]);

  const onTile = (index: number) => {
    if (won) return;
    const next = slide(board, index);
    if (!next) return;
    playScore();
    setBoard(next);
    setMoves((m) => m + 1);
  };

  const movable = new Set(neighborsOfEmpty(board));

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 gap-4"
      style={{
        backgroundColor: '#1e293b',
        backgroundImage: [
          'linear-gradient(rgba(15,23,42,0.55), rgba(15,23,42,0.75))',
          `url(${import.meta.env.BASE_URL}board-bg.jpg)`,
        ].join(', '),
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <BackToMenu />
      <h1 className="text-2xl font-bold tracking-wide">數字推盤</h1>
      <p className="text-sm text-slate-300">移動步數：{moves}</p>
      <div
        className="grid grid-cols-4 gap-1.5 p-2 rounded-xl w-[min(92vw,360px)] aspect-square"
        style={{ background: 'rgba(15,23,42,0.45)' }}
      >
        {board.map((tile, i) =>
          tile === null ? (
            <div key={`e-${i}`} className="rounded-lg bg-slate-900/40" aria-hidden />
          ) : (
            <button
              key={tile}
              type="button"
              onClick={() => onTile(i)}
              disabled={!movable.has(i)}
              className={`rounded-lg font-bold text-xl sm:text-2xl touch-manipulation bg-cover bg-center border border-white/20 shadow ${
                movable.has(i) ? 'hover:brightness-110 active:scale-95' : 'opacity-90'
              }`}
              style={{
                backgroundColor: '#cbd5e1',
                backgroundImage: [
                  'linear-gradient(rgba(248,250,252,0.55), rgba(248,250,252,0.7))',
                  `url(${import.meta.env.BASE_URL}tile-face.jpg)`,
                ].join(', '),
                color: '#0f172a',
              }}
              aria-label={`Tile ${tile}`}
            >
              {tile}
            </button>
          ),
        )}
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
          title="完成！"
          variant="win"
          stats={[{ label: '步數', value: moves }]}
          onPrimary={restart}
        />
      )}
    </div>
  );
}

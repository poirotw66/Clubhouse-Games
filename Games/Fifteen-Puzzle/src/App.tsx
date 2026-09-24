import { useCallback, useEffect, useState } from 'react';
import { BackToMenu } from '@clubhouse/shared/BackToMenu';
import { ResultOverlay } from '@clubhouse/shared/ResultOverlay';
import { playLose, playMove, playScore, playWin } from '@clubhouse/shared/synthAudio';
import {
  SPRINT_LIMIT_SEC,
  hintTileIndex,
  isSolved,
  loadBestMoves,
  loadBestSprintSec,
  neighborsOfEmpty,
  saveBestMoves,
  saveBestSprintSec,
  scrambleBoard,
  slide,
  type Board,
  type PlayMode,
  type ScrambleTier,
} from './fifteenLogic';

const TIER_OPTIONS: { id: ScrambleTier; label: string }[] = [
  { id: 'easy', label: '簡單' },
  { id: 'normal', label: '普通' },
  { id: 'hard', label: '困難' },
];

export default function App() {
  const [tier, setTier] = useState<ScrambleTier>('normal');
  const [mode, setMode] = useState<PlayMode>('classic');
  const [board, setBoard] = useState<Board>(() => scrambleBoard('normal'));
  const [history, setHistory] = useState<Board[]>([]);
  const [moves, setMoves] = useState(0);
  const [won, setWon] = useState(false);
  const [lost, setLost] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [bestMoves, setBestMoves] = useState<number | null>(() => loadBestMoves('normal'));
  const [bestSprint, setBestSprint] = useState<number | null>(() => loadBestSprintSec('normal'));
  const [newRecord, setNewRecord] = useState(false);
  const [hintIndex, setHintIndex] = useState<number | null>(null);

  const restart = useCallback((nextTier: ScrambleTier = tier, nextMode: PlayMode = mode) => {
    setTier(nextTier);
    setMode(nextMode);
    setBoard(scrambleBoard(nextTier));
    setHistory([]);
    setMoves(0);
    setWon(false);
    setLost(false);
    setElapsed(0);
    setNewRecord(false);
    setHintIndex(null);
    setBestMoves(loadBestMoves(nextTier));
    setBestSprint(loadBestSprintSec(nextTier));
  }, [tier, mode]);

  useEffect(() => {
    if (won || lost) return;
    const id = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [won, lost, board]);

  useEffect(() => {
    if (won || lost) return;
    if (mode === 'sprint' && elapsed >= SPRINT_LIMIT_SEC) {
      setLost(true);
      playLose();
    }
  }, [elapsed, mode, won, lost]);

  useEffect(() => {
    if (!won && !lost && isSolved(board)) {
      setWon(true);
      setHintIndex(null);
      playWin();
      if (mode === 'classic') {
        const saved = saveBestMoves(tier, moves);
        setBestMoves(saved);
        setNewRecord(saved === moves);
      } else {
        const saved = saveBestSprintSec(tier, elapsed);
        setBestSprint(saved);
        setNewRecord(saved === elapsed);
      }
    }
  }, [board, won, lost, moves, elapsed, mode, tier]);

  const onTile = (index: number) => {
    if (won || lost) return;
    const next = slide(board, index);
    if (!next) return;
    playScore();
    setHistory((h) => [...h, board]);
    setBoard(next);
    setMoves((m) => m + 1);
    setHintIndex(null);
  };

  const handleUndo = () => {
    if (won || lost || history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setBoard(prev);
    setMoves((m) => Math.max(0, m - 1));
    setHintIndex(null);
    playMove();
  };

  const handleHint = () => {
    if (won || lost) return;
    const idx = hintTileIndex(board);
    setHintIndex(idx);
    if (idx != null) playMove();
  };

  const movable = new Set(neighborsOfEmpty(board));
  const remain = Math.max(0, SPRINT_LIMIT_SEC - elapsed);
  const canUndo = !won && !lost && history.length > 0;

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
            onClick={() => restart(tier, id)}
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
      <div className="flex flex-wrap justify-center gap-2" role="group" aria-label="打亂難度">
        {TIER_OPTIONS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => restart(id, mode)}
            className={`min-h-[44px] px-4 rounded-full border touch-manipulation text-sm ${
              tier === id
                ? 'border-sky-400 bg-sky-500/25 text-sky-100'
                : 'border-slate-600 bg-slate-800/80 text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-sm text-slate-300">
        步數：{moves}
        {mode === 'sprint' ? ` · 剩餘 ${remain}s` : ''}
        {mode === 'classic' && bestMoves != null ? ` · 最佳步數 ${bestMoves}` : ''}
        {mode === 'sprint' && bestSprint != null ? ` · 最佳 ${bestSprint}s` : ''}
      </p>
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
              className={`rounded-lg font-bold text-xl sm:text-2xl touch-manipulation bg-cover bg-center border shadow ${
                hintIndex === i
                  ? 'border-amber-300 ring-2 ring-amber-400/80'
                  : 'border-white/20'
              } ${movable.has(i) ? 'hover:brightness-110 active:scale-95' : 'opacity-90'}`}
              style={{
                backgroundColor: '#cbd5e1',
                backgroundImage: [
                  'linear-gradient(rgba(248,250,252,0.55), rgba(248,250,252,0.7))',
                  `url(${import.meta.env.BASE_URL}tile-face.jpg)`,
                ].join(', '),
                color: '#0f172a',
              }}
              aria-label={`第 ${tile} 格${hintIndex === i ? '（建議）' : ''}`}
            >
              {tile}
            </button>
          ),
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo}
          className="min-h-[44px] px-5 rounded-xl bg-slate-700 hover:bg-slate-600 disabled:opacity-40 font-medium touch-manipulation"
        >
          復原
        </button>
        <button
          type="button"
          onClick={handleHint}
          disabled={won || lost}
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
          title="完成！"
          variant="win"
          badge={newRecord ? '新紀錄' : undefined}
          stats={[
            { label: '步數', value: moves },
            { label: '用時', value: `${elapsed}s` },
            {
              label: mode === 'classic' ? '最佳步數' : '最佳衝刺',
              value: mode === 'classic' ? (bestMoves ?? moves) : `${bestSprint ?? elapsed}s`,
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
          stats={[{ label: '步數', value: moves }]}
          onPrimary={() => restart()}
        />
      )}
    </div>
  );
}

import {useMemo} from 'react';
import {CHARACTERS, DIFFICULTIES, type DifficultyId} from '../data/characters';
import {TRACKS} from '../data/tracks';
import {kartBricks} from '../engine/models';
import {formatTime} from '../engine/race';
import {BrickPreview} from './BrickPreview';
import {TrackPreview} from './TrackPreview';

interface Props {
  charId: string;
  trackId: string;
  difficulty: DifficultyId;
  bestTimes: Record<string, number>;
  onChar: (id: string) => void;
  onTrack: (id: string) => void;
  onDifficulty: (id: DifficultyId) => void;
  onStart: () => void;
}

function StatBar({label, value}: {label: string; value: number}) {
  const pct = Math.max(6, Math.min(100, ((value - 0.8) / 0.5) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-[11px] text-slate-400">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-700">
        <span className="block h-full rounded-full bg-amber-400" style={{width: `${pct}%`}} />
      </span>
    </div>
  );
}

export function MainMenu({
  charId,
  trackId,
  difficulty,
  bestTimes,
  onChar,
  onTrack,
  onDifficulty,
  onStart,
}: Props) {
  const character = CHARACTERS.find((c) => c.id === charId) ?? CHARACTERS[0];
  const bricks = useMemo(() => kartBricks(character), [character]);

  return (
    <div className="min-h-full w-full overflow-y-auto bg-slate-950 px-4 py-14 text-slate-100">
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 text-center">
          <p className="text-xs font-bold tracking-[0.35em] text-amber-400">CLUBHOUSE GAMES</p>
          {/* Served from public/, so a page-relative src works under any base. */}
          <img
            src="./title-logo.svg"
            alt="Brick Kart Racing"
            className="mx-auto mt-3 w-full max-w-md"
          />
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            <span className="text-amber-400">積木</span>賽車
          </h1>
          <p className="mt-2 text-sm text-slate-400">飄移蓄力、道具攻防，搶下 3 圈第一名</p>
        </header>

        <section className="mb-6">
          <h2 className="mb-3 text-sm font-bold tracking-widest text-slate-400">選擇車手</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CHARACTERS.map((c) => {
              const active = c.id === charId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChar(c.id)}
                  aria-pressed={active}
                  className={`rounded-2xl border-2 p-3 text-left transition ${
                    active
                      ? 'border-amber-400 bg-slate-800 shadow-lg shadow-amber-500/10'
                      : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                  }`}
                >
                  <div className="flex justify-center">
                    <BrickPreview bricks={kartBricks(c)} size={84} yaw={0.6} />
                  </div>
                  <p className="mt-1 text-center text-sm font-bold">{c.name}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center rounded-2xl border border-slate-800 bg-slate-900 p-4">
          <div className="flex justify-center">
            <BrickPreview bricks={bricks} size={150} spin />
          </div>
          <div>
            <p className="text-lg font-bold">{character.name}</p>
            <p className="mb-3 text-sm text-slate-400">{character.blurb}</p>
            <div className="space-y-1.5">
              <StatBar label="極速" value={character.topSpeed} />
              <StatBar label="加速" value={character.accel} />
              <StatBar label="操控" value={character.grip} />
              <StatBar label="重量" value={character.weight} />
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-sm font-bold tracking-widest text-slate-400">選擇賽道</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {TRACKS.map((t) => {
              const active = t.id === trackId;
              const best = bestTimes[t.id];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTrack(t.id)}
                  aria-pressed={active}
                  className={`rounded-2xl border-2 p-3 text-left transition ${
                    active
                      ? 'border-amber-400 bg-slate-800 shadow-lg shadow-amber-500/10'
                      : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                  }`}
                >
                  <div className="flex justify-center">
                    <TrackPreview def={t} size={116} />
                  </div>
                  <p className="mt-1 font-bold">{t.name}</p>
                  <p className="text-xs text-slate-400">{t.subtitle}</p>
                  <p className="mt-1 text-xs text-amber-400">
                    {'★'.repeat(t.difficulty)}
                    <span className="text-slate-600">{'★'.repeat(3 - t.difficulty)}</span>
                    {best ? (
                      <span className="ml-2 text-slate-400">最佳 {formatTime(best)}</span>
                    ) : null}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="mb-3 text-sm font-bold tracking-widest text-slate-400">難度</h2>
          <div className="flex gap-3">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => onDifficulty(d.id)}
                aria-pressed={d.id === difficulty}
                className={`flex-1 rounded-xl border-2 py-2 font-bold transition ${
                  d.id === difficulty
                    ? 'border-amber-400 bg-amber-400 text-slate-950'
                    : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                }`}
              >
                {d.name}
              </button>
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={onStart}
          className="w-full rounded-2xl bg-amber-400 py-4 text-xl font-black text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300 active:scale-[0.99]"
        >
          開始比賽
        </button>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
          <p className="mb-2 font-bold text-slate-300">操作說明</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            <li>← → 轉向</li>
            <li>↑ / Z 加速，↓ 煞車</li>
            <li>Shift 飄移（放開觸發小噴射）</li>
            <li>空白鍵 使用道具</li>
            <li>P 暫停，M 靜音</li>
            <li>手機：畫面左右下方的觸控按鍵</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

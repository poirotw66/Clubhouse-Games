import {CHARACTERS} from '../data/characters';
import {TRACKS} from '../data/tracks';
import {formatTime, type Racer} from '../engine/race';
import {kartBricks} from '../engine/models';
import {BrickPreview} from './BrickPreview';

interface Props {
  racers: Racer[];
  playerIndex: number;
  trackId: string;
  bestLap: number;
  isNewRecord: boolean;
  onRetry: () => void;
  onMenu: () => void;
}

export function ResultScreen({
  racers,
  playerIndex,
  trackId,
  bestLap,
  isNewRecord,
  onRetry,
  onMenu,
}: Props) {
  const player = racers[playerIndex];
  const standings = [...racers].sort((a, b) => a.place - b.place);
  const track = TRACKS.find((t) => t.id === trackId);
  const won = player.place === 1;
  const character = CHARACTERS.find((c) => c.id === player.charId)!;

  return (
    <div className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-slate-950/85 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <p className="text-center text-xs font-bold tracking-[0.3em] text-amber-400">
          {track?.name} · 完賽
        </p>
        <div className="my-2 flex justify-center">
          <BrickPreview bricks={kartBricks(character)} size={110} spin={won} yaw={0.6} />
        </div>
        <h2
          className={`text-center text-3xl font-black ${won ? 'text-amber-300' : 'text-slate-100'}`}
        >
          {won ? '冠軍！' : `第 ${player.place} 名`}
        </h2>
        {isNewRecord && (
          <p className="mt-1 text-center text-sm font-bold text-emerald-300">🏁 新的最佳單圈紀錄</p>
        )}

        <dl className="my-4 grid grid-cols-2 gap-2 text-center">
          <div className="rounded-xl bg-slate-800/70 p-3">
            <dt className="text-[11px] text-slate-400">總時間</dt>
            <dd className="font-mono text-lg font-bold text-white">
              {formatTime(player.finishTime)}
            </dd>
          </div>
          <div className="rounded-xl bg-slate-800/70 p-3">
            <dt className="text-[11px] text-slate-400">最佳單圈</dt>
            <dd className="font-mono text-lg font-bold text-white">{formatTime(bestLap)}</dd>
          </div>
        </dl>

        <ol className="mb-5 space-y-1">
          {standings.map((r) => {
            const c = CHARACTERS.find((ch) => ch.id === r.charId)!;
            return (
              <li
                key={r.index}
                className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm ${
                  r.isPlayer ? 'bg-amber-400/15 font-bold text-amber-200' : 'text-slate-300'
                }`}
              >
                <span className="w-5 text-right tabular-nums">{r.place}</span>
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-sm"
                  style={{background: c.body}}
                  aria-hidden
                />
                <span className="flex-1 truncate">{r.name}</span>
                <span className="font-mono text-xs text-slate-400">
                  {r.finished ? formatTime(r.finishTime) : '未完賽'}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onMenu}
            className="flex-1 rounded-xl border border-white/15 bg-slate-800 py-3 font-bold text-slate-200 transition hover:bg-slate-700"
          >
            回選單
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 rounded-xl bg-amber-400 py-3 font-black text-slate-950 transition hover:bg-amber-300"
          >
            再比一場
          </button>
        </div>
      </div>
    </div>
  );
}

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
  timeTrial?: boolean;
  mirror?: boolean;
  itemsEnabled?: boolean;
  onRetry: () => void;
  onMenu: () => void;
}

export function ResultScreen({
  racers,
  playerIndex,
  trackId,
  bestLap,
  isNewRecord,
  timeTrial = false,
  mirror = false,
  itemsEnabled = true,
  onRetry,
  onMenu,
}: Props) {
  const player = racers[playerIndex];
  const standings = [...racers].sort((a, b) => a.place - b.place);
  const track = TRACKS.find((t) => t.id === trackId);
  const won = player.place === 1;
  const character = CHARACTERS.find((c) => c.id === player.charId)!;
  const finishedLaps = player.lapTimes.filter((t) => t > 0);
  const avgLap =
    finishedLaps.length > 0
      ? finishedLaps.reduce((a, b) => a + b, 0) / finishedLaps.length
      : 0;

  const badge = [track?.name, mirror ? '鏡像' : null, timeTrial ? '計時賽' : '對戰賽']
    .filter(Boolean)
    .join(' · ');

  const title = timeTrial ? '計時完賽' : won ? '你拿下冠軍！' : `第 ${player.place} 名完賽`;
  const subtitle = timeTrial
    ? isNewRecord
      ? '新的最佳單圈寫進本機紀錄了。'
      : '再壓一點彎道，單圈還能更快。'
    : won
      ? isNewRecord
        ? '冠軍兼最佳單圈——漂亮的一場。'
        : '搶下第一名！要不要再比一場？'
      : isNewRecord
        ? '名次雖非第一，但單圈破了紀錄。'
        : '差一點——調轉向時機再挑戰一次。';

  const variant = timeTrial || won ? 'text-emerald-300' : 'text-slate-100';

  const stats: {label: string; value: string}[] = [
    {label: timeTrial ? '模式' : '名次', value: timeTrial ? '計時賽' : `第 ${player.place} 名`},
    {label: '總時間', value: formatTime(player.finishTime)},
    {label: '最佳單圈', value: formatTime(bestLap)},
  ];
  if (avgLap > 0) stats.push({label: '平均單圈', value: formatTime(avgLap)});
  if (!timeTrial && !itemsEnabled) stats.push({label: '規則', value: '無道具'});

  return (
    <div
      className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl sm:p-8">
        <p className="mb-2 text-center text-sm font-semibold tracking-wide text-amber-300">
          {badge}
        </p>
        <div className="mb-2 flex justify-center">
          <BrickPreview bricks={kartBricks(character)} size={96} spin={won || timeTrial} yaw={0.6} />
        </div>
        <h2 className={`mb-2 text-center text-2xl font-bold sm:text-3xl ${variant}`}>{title}</h2>
        <p className="mb-1 text-center text-sm text-slate-300">{subtitle}</p>
        {isNewRecord && (
          <p className="mb-4 text-center text-sm font-bold text-emerald-300">新最佳單圈紀錄</p>
        )}
        {!isNewRecord && <div className="mb-4" />}

        <dl className="mb-5 grid gap-2 text-sm">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="flex justify-between rounded-lg border border-white/5 bg-slate-800/80 px-3 py-2"
            >
              <dt className="text-slate-400">{stat.label}</dt>
              <dd className="font-mono font-semibold tabular-nums text-white">{stat.value}</dd>
            </div>
          ))}
        </dl>

        {!timeTrial && (
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
        )}

        <button
          type="button"
          onClick={onRetry}
          className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-500"
        >
          再玩一局
        </button>
        <button
          type="button"
          onClick={onMenu}
          className="mt-2 w-full rounded-xl border border-white/15 bg-slate-800 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-slate-700"
        >
          回選單
        </button>
      </div>
    </div>
  );
}

import {CHARACTERS} from '../data/characters';
import {cupById, CUP_POINTS} from '../data/cups';
import {TRACKS} from '../data/tracks';
import {cupStandings, type CupSession} from '../engine/cupSession';
import {rivalForChar} from '../data/rivals';

interface Props {
  session: CupSession;
  /** Places from the race just finished (before raceIndex was advanced). */
  lastRacePlaces?: {id: string; place: number; points: number}[];
  unlockedMessages?: string[];
  final: boolean;
  onContinue: () => void;
  onMenu: () => void;
}

export function CupStandingsOverlay({
  session,
  lastRacePlaces,
  unlockedMessages = [],
  final,
  onContinue,
  onMenu,
}: Props) {
  const cup = cupById(session.cupId);
  const order = cupStandings(session);
  const player = order.find((e) => e.isPlayer);
  const won = final && player?.points === order[0]?.points && player?.isPlayer;

  // raceIndex is already advanced after applyRacePlaces; show completed count.
  const completed = Math.min(session.raceIndex, cup?.trackIds.length ?? 0);
  const nextTrackId = !final && cup ? cup.trackIds[session.raceIndex] : null;
  const nextTrack = nextTrackId ? TRACKS.find((t) => t.id === nextTrackId) : null;

  const title = final
    ? won
      ? '盃賽冠軍！'
      : `盃賽第 ${order.findIndex((e) => e.isPlayer) + 1} 名`
    : `第 ${completed} 場完賽`;

  return (
    <div
      className="absolute inset-0 z-30 grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl">
        <p className="mb-1 text-center text-sm font-semibold tracking-wide text-amber-300">
          {cup?.name ?? '盃賽'}
          {cup?.mirror ? ' · 鏡像' : ''}
          {!final ? ` · ${completed}/${cup?.trackIds.length ?? 3}` : ''}
        </p>
        <h2
          className={`mb-4 text-center text-2xl font-bold ${
            final && won ? 'text-emerald-300' : 'text-slate-100'
          }`}
        >
          {title}
        </h2>

        {lastRacePlaces && lastRacePlaces.length > 0 && (
          <p className="mb-3 text-center text-xs text-slate-400">
            本場積分：
            {lastRacePlaces
              .filter((p) => p.id === 'player')
              .map((p) => `第 ${p.place} 名 +${p.points}`)
              .join('')}
          </p>
        )}

        <ol className="mb-4 space-y-1.5">
          {order.map((e, i) => {
            const c = CHARACTERS.find((ch) => ch.id === e.charId)!;
            const rival = !e.isPlayer ? rivalForChar(e.charId) : null;
            return (
              <li
                key={e.id}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                  e.isPlayer ? 'bg-amber-400/15 font-bold text-amber-200' : 'bg-slate-800/60 text-slate-300'
                }`}
              >
                <span className="w-5 text-right tabular-nums text-slate-400">{i + 1}</span>
                <span
                  className="h-3.5 w-3.5 shrink-0 rounded-sm"
                  style={{background: c.body}}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{e.name}</span>
                  {rival && (
                    <span className="block truncate text-[10px] font-normal text-slate-500">
                      {rival.tagline}
                    </span>
                  )}
                </span>
                <span className="font-mono text-sm tabular-nums text-white">{e.points}</span>
                <span className="text-[10px] text-slate-500">分</span>
              </li>
            );
          })}
        </ol>

        <p className="mb-3 text-center text-[10px] text-slate-500">
          名次積分 {CUP_POINTS.join(' / ')}
        </p>

        {unlockedMessages.length > 0 && (
          <ul className="mb-4 space-y-1 rounded-xl border border-emerald-400/30 bg-emerald-950/40 p-3">
            {unlockedMessages.map((msg) => (
              <li key={msg} className="text-center text-sm font-bold text-emerald-300">
                {msg}
              </li>
            ))}
          </ul>
        )}

        {!final && nextTrack && (
          <p className="mb-4 text-center text-sm text-slate-300">
            下一場：<span className="font-bold text-amber-300">{nextTrack.name}</span>
          </p>
        )}

        <button
          type="button"
          onClick={onContinue}
          className="inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-emerald-500"
        >
          {final ? '完成盃賽' : '下一場比賽'}
        </button>
        <button
          type="button"
          onClick={onMenu}
          className="mt-2 w-full rounded-xl border border-white/15 bg-slate-800 py-2.5 text-sm font-bold text-slate-200 transition hover:bg-slate-700"
        >
          放棄盃賽 · 回選單
        </button>
      </div>
    </div>
  );
}

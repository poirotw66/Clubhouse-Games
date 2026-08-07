import {useEffect, useMemo, useRef} from 'react';
import {itemIconBricks} from '../engine/models';
import {formatTime, type ItemId} from '../engine/race';
import {BrickPreview} from './BrickPreview';

export interface HudSnapshot {
  place: number;
  lap: number;
  laps: number;
  time: number;
  bestLap: number;
  speed: number;
  item: ItemId | null;
  itemRoll: number;
  shields: number;
  driftLevel: number;
  /** 0–1 progress toward max drift charge while drifting. */
  driftFill: number;
  boosting: boolean;
  countdown: number;
  phase: string;
  lapFlash: number;
  /** Optional callout under lap banner (e.g. new best lap). */
  lapNote: string;
  itemsEnabled: boolean;
  timeTrial: boolean;
}

const ITEM_LABEL: Record<ItemId, string> = {
  boost: '加速磚',
  oil: '油漬磚',
  homing: '追蹤飛磚',
  shield: '三連盾',
};

const PLACE_SUFFIX = ['', 'st', 'nd', 'rd', 'th'];
const DRIFT_COLOR = ['#94a3b8', '#4fc3ff', '#ff9a2e', '#c56bff'];
const DRIFT_LABEL = ['蓄力', '藍噴', '橘噴', '紫噴'];

function ItemSlot({item, roll}: {item: ItemId | null; roll: number}) {
  // While the roulette spins, cycle the icon for a beat before it settles.
  const spinning = roll > 0;
  const shown = useMemo<string | null>(() => {
    if (!spinning) return item;
    const cycle: ItemId[] = ['boost', 'oil', 'homing', 'shield'];
    return cycle[Math.floor(roll * 12) % cycle.length];
  }, [item, roll, spinning]);

  const bricks = useMemo(() => itemIconBricks(shown), [shown]);

  return (
    <div className="flex flex-col items-center">
      <div
        className={`grid h-20 w-20 place-items-center rounded-2xl border-2 bg-slate-900/70 backdrop-blur-sm ${
          item && !spinning ? 'border-amber-400' : 'border-white/25'
        }`}
      >
        {item || spinning ? (
          <BrickPreview bricks={bricks} size={68} yaw={0.58} />
        ) : (
          <span className="text-2xl text-white/25">?</span>
        )}
      </div>
      <span className="mt-1 text-[11px] font-bold text-white/80 drop-shadow">
        {item && !spinning ? ITEM_LABEL[item] : '道具'}
      </span>
    </div>
  );
}

export function Hud({
  snap,
  minimapRef,
  muted,
  onPause,
  onMute,
}: {
  snap: HudSnapshot;
  minimapRef: React.RefObject<HTMLCanvasElement | null>;
  muted: boolean;
  onPause: () => void;
  onMute: () => void;
}) {
  const speedPct = Math.max(0, Math.min(100, (snap.speed / 500) * 100));
  const lapFlashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = lapFlashRef.current;
    if (!el || snap.lapFlash <= 0) return;
    el.animate(
      [
        {opacity: 0, transform: 'scale(0.8)'},
        {opacity: 1, transform: 'scale(1)'},
        {opacity: 0, transform: 'scale(1.1)'},
      ],
      {duration: 1200, easing: 'ease-out'},
    );
  }, [snap.lapFlash]);

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* Lap / time */}
      <div className="absolute left-3 top-3 rounded-xl bg-slate-950/55 px-3 py-2 backdrop-blur-sm">
        <p className="text-[11px] font-bold tracking-widest text-amber-300">LAP</p>
        <p className="-mt-1 text-2xl font-black leading-tight text-white">
          {snap.lap}
          <span className="text-base text-white/60">/{snap.laps}</span>
        </p>
        <p className="font-mono text-xs text-white/80">{formatTime(snap.time)}</p>
        {snap.bestLap > 0 && (
          <p className="font-mono text-[10px] text-amber-300/90">BEST {formatTime(snap.bestLap)}</p>
        )}
      </div>

      {/* Minimap */}
      <div className="absolute right-3 top-3 rounded-xl bg-slate-950/55 p-1 backdrop-blur-sm">
        <canvas ref={minimapRef} width={132} height={132} style={{width: 108, height: 108}} />
      </div>

      {/* Controls */}
      <div className="pointer-events-auto absolute right-3 top-32 flex flex-col gap-2">
        <button
          type="button"
          onClick={onPause}
          aria-label="暫停"
          className="h-9 w-9 rounded-lg bg-slate-950/55 text-sm font-bold text-white backdrop-blur-sm"
        >
          ‖
        </button>
        <button
          type="button"
          onClick={onMute}
          aria-label={muted ? '開啟音效' : '關閉音效'}
          className="h-9 w-9 rounded-lg bg-slate-950/55 text-sm font-bold text-white backdrop-blur-sm"
        >
          {muted ? '✕' : '♪'}
        </button>
      </div>

      {/* Item slot */}
      {snap.itemsEnabled && (
        <div className="absolute left-3 top-28">
          <ItemSlot item={snap.item} roll={snap.itemRoll} />
          {snap.shields > 0 && (
            <p className="mt-1 text-center text-[11px] font-bold text-cyan-300 drop-shadow">
              盾 × {snap.shields}
            </p>
          )}
        </div>
      )}

      {/* Place + speed */}
      <div className="absolute bottom-3 right-3 text-right">
        {snap.timeTrial ? (
          <p className="text-2xl font-black leading-none text-amber-300 drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]">
            計時賽
          </p>
        ) : (
          <p className="text-5xl font-black leading-none text-white drop-shadow-[0_2px_0_rgba(0,0,0,0.5)]">
            {snap.place}
            <span className="text-xl text-amber-300">{PLACE_SUFFIX[snap.place] ?? 'th'}</span>
          </p>
        )}
        <div className="mt-1 h-2 w-36 overflow-hidden rounded-full bg-slate-950/55">
          <div
            className={`h-full rounded-full transition-[width] duration-100 ${
              snap.boosting ? 'bg-orange-400' : 'bg-emerald-400'
            }`}
            style={{width: `${speedPct}%`}}
          />
        </div>
        <p className="font-mono text-xs text-white/85">{Math.max(0, Math.round(snap.speed))} km/h</p>
      </div>

      {/* Drift charge — progressive fill + level label */}
      {snap.driftFill > 0 && (
        <div className="absolute bottom-16 left-1/2 w-48 -translate-x-1/2">
          <p
            className="mb-1 text-center text-xs font-black tracking-wider drop-shadow"
            style={{color: DRIFT_COLOR[snap.driftLevel] ?? '#94a3b8'}}
          >
            {DRIFT_LABEL[snap.driftLevel] ?? '蓄力'}
            {snap.driftLevel >= 3 ? ' MAX' : ''}
          </p>
          <div className="h-3 overflow-hidden rounded-full border border-white/20 bg-slate-950/60">
            <div
              className="h-full rounded-full transition-[width] duration-75"
              style={{
                width: `${Math.max(6, snap.driftFill * 100)}%`,
                background: DRIFT_COLOR[snap.driftLevel] ?? '#94a3b8',
                boxShadow: snap.driftLevel > 0 ? `0 0 10px ${DRIFT_COLOR[snap.driftLevel]}` : undefined,
              }}
            />
          </div>
        </div>
      )}

      {/* Countdown */}
      {snap.phase === 'countdown' && (
        <div className="absolute inset-0 grid place-items-center">
          <p className="text-8xl font-black text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.4)]">
            {snap.countdown > 3
              ? '準備'
              : snap.countdown > 0
                ? Math.ceil(snap.countdown)
                : 'GO!'}
          </p>
        </div>
      )}

      {/* Lap banner */}
      {snap.lapFlash > 0 && (
        <div ref={lapFlashRef} className="absolute inset-x-0 top-1/3 grid place-items-center">
          <div className="rounded-xl bg-amber-400/90 px-6 py-2 text-center">
            <p className="text-3xl font-black text-slate-950">第 {snap.lap} 圈</p>
            {snap.lapNote ? (
              <p className="text-sm font-bold text-emerald-900">{snap.lapNote}</p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

import {useMemo} from 'react';
import type {ItemId} from '../engine/race';
import type {TelemetryData, TireTelemetry, RacerTelemetry} from '../engine/telemetry';
import {formatTime} from '../engine/race';

const ITEM_NAME_MAP: Record<ItemId, {name: string; icon: string; color: string}> = {
  boost: {name: '加速磚', icon: '⚡', color: 'text-amber-400 border-amber-400/40 bg-amber-500/10'},
  oil: {name: '油漬磚', icon: '🛢️', color: 'text-purple-400 border-purple-400/40 bg-purple-500/10'},
  homing: {name: '追蹤飛磚', icon: '🚀', color: 'text-rose-400 border-rose-400/40 bg-rose-500/10'},
  shield: {name: '三連盾', icon: '🛡️', color: 'text-cyan-400 border-cyan-400/40 bg-cyan-500/10'},
};

const PLACE_BADGES: Record<number, {text: string; color: string}> = {
  1: {text: 'P1', color: 'bg-amber-400 text-slate-950 font-black shadow-sm shadow-amber-400/50'},
  2: {text: 'P2', color: 'bg-slate-300 text-slate-950 font-black'},
  3: {text: 'P3', color: 'bg-amber-700 text-amber-100 font-black'},
  4: {text: 'P4', color: 'bg-slate-700 text-slate-200 font-bold'},
};

function TireBlock({
  label,
  temp,
  status,
}: {
  label: string;
  temp: number;
  status: TireTelemetry['status'];
}) {
  const isHot = status === 'hot' || temp > 105;
  const isWarm = status === 'warm' || (temp > 88 && temp <= 105);
  const isOffroad = status === 'offroad';

  let colorClass = 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300';
  if (isOffroad) {
    colorClass = 'border-rose-500/70 bg-rose-950/40 text-rose-300 animate-pulse';
  } else if (isHot) {
    colorClass = 'border-rose-500/60 bg-rose-500/20 text-rose-300';
  } else if (isWarm) {
    colorClass = 'border-amber-400/50 bg-amber-400/15 text-amber-300';
  }

  return (
    <div
      className={`flex flex-col items-center justify-center rounded-lg border px-2 py-1 text-center transition-colors ${colorClass}`}
    >
      <span className="text-[10px] font-bold text-slate-400">{label}</span>
      <span className="font-mono text-xs font-black tracking-tight">{temp}°C</span>
    </div>
  );
}

export function TelemetryLeftWing({
  speed,
  telemetry,
  driftFill,
  driftLevel,
  boosting,
}: {
  speed: number;
  telemetry: TelemetryData;
  driftFill: number;
  driftLevel: number;
  boosting: boolean;
}) {
  const rpmPct = Math.max(8, Math.min(100, (telemetry.rpm / 9500) * 100));
  const isRedline = telemetry.rpm >= 8400;

  return (
    <div className="flex h-full w-full flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/90 p-3 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <h3 className="text-xs font-black tracking-wider text-slate-200">賽道遙測中心</h3>
        </div>
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
            telemetry.onRoad ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
          }`}
        >
          {telemetry.onRoad ? '瀝青路面' : '草地打滑'}
        </span>
      </div>

      {/* Speedometer & Gear */}
      <div className="rounded-xl border border-white/5 bg-slate-950/60 p-2.5">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-slate-400">時速 SPEED</span>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-3xl font-black text-white">
                {Math.max(0, Math.round(speed))}
              </span>
              <span className="text-xs font-bold text-slate-400">km/h</span>
            </div>
          </div>
          <div className="text-right">
            <span className="text-[10px] font-bold tracking-wider text-slate-400">檔位 GEAR</span>
            <p
              className={`text-sm font-black ${
                boosting
                  ? 'animate-pulse text-amber-300'
                  : telemetry.gear.includes('DRIFT')
                    ? 'text-purple-300'
                    : 'text-emerald-400'
              }`}
            >
              {telemetry.gear}
            </p>
          </div>
        </div>

        {/* RPM Tachometer */}
        <div className="mt-2">
          <div className="flex justify-between text-[9px] font-mono font-bold text-slate-400">
            <span>RPM {telemetry.rpm}</span>
            <span className={isRedline ? 'animate-bounce font-black text-rose-400' : ''}>
              {isRedline ? 'REDLINE 超轉' : '9500 MAX'}
            </span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full transition-all duration-75 ${
                isRedline
                  ? 'bg-gradient-to-r from-amber-400 to-rose-500'
                  : telemetry.rpm > 6500
                    ? 'bg-gradient-to-r from-emerald-400 to-amber-400'
                    : 'bg-emerald-400'
              }`}
              style={{width: `${rpmPct}%`}}
            />
          </div>
        </div>
      </div>

      {/* 4-Wheel Tire Grip & Temp Heatmap */}
      <div className="rounded-xl border border-white/5 bg-slate-950/60 p-2.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-wider text-slate-400">
            四輪胎溫與抓地力
          </span>
          <span
            className={`text-[10px] font-bold ${
              telemetry.tires.gripPct < 70 ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {telemetry.tires.statusText}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <TireBlock label="FL 左前" temp={telemetry.tires.flTemp} status={telemetry.tires.status} />
          <TireBlock label="FR 右前" temp={telemetry.tires.frTemp} status={telemetry.tires.status} />
          <TireBlock label="RL 左後" temp={telemetry.tires.rlTemp} status={telemetry.tires.status} />
          <TireBlock label="RR 右後" temp={telemetry.tires.rrTemp} status={telemetry.tires.status} />
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
          <span>抓地效能</span>
          <span className="font-mono font-bold text-white">{telemetry.tires.gripPct}%</span>
        </div>
        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full transition-all duration-100 ${
              telemetry.tires.gripPct < 60 ? 'bg-rose-500' : 'bg-emerald-400'
            }`}
            style={{width: `${telemetry.tires.gripPct}%`}}
          />
        </div>
      </div>

      {/* Drift Turbo Boost Gauge */}
      <div className="rounded-xl border border-white/5 bg-slate-950/60 p-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-wider text-slate-400">
            甩尾渦輪增壓槽
          </span>
          <span
            className={`text-[10px] font-bold ${
              driftLevel === 3
                ? 'animate-pulse text-purple-400'
                : driftLevel === 2
                  ? 'text-amber-400'
                  : driftLevel === 1
                    ? 'text-sky-400'
                    : 'text-slate-500'
            }`}
          >
            {driftLevel === 3
              ? 'MAX 紫噴就緒'
              : driftLevel === 2
                ? '二段橘噴'
                : driftLevel === 1
                  ? '初段藍噴'
                  : '蓄力待命'}
          </span>
        </div>

        <div className="mt-1.5 flex h-2.5 gap-1 overflow-hidden rounded-full bg-slate-800 p-0.5">
          <div
            className={`h-full flex-1 rounded-sm transition-colors ${
              driftLevel >= 1 ? 'bg-sky-400 shadow-[0_0_8px_#38bdf8]' : 'bg-slate-700'
            }`}
          />
          <div
            className={`h-full flex-1 rounded-sm transition-colors ${
              driftLevel >= 2 ? 'bg-amber-400 shadow-[0_0_8px_#fbbf24]' : 'bg-slate-700'
            }`}
          />
          <div
            className={`h-full flex-1 rounded-sm transition-colors ${
              driftLevel >= 3 ? 'bg-purple-400 shadow-[0_0_8px_#c084fc]' : 'bg-slate-700'
            }`}
          />
        </div>

        <div className="mt-1.5 flex justify-between text-[9px] text-slate-400">
          <span>蓄力：{Math.round(driftFill * 100)}%</span>
          <span>出彎鬆開 Shift 觸發</span>
        </div>
      </div>

      {/* Lateral G Sensor */}
      <div className="rounded-xl border border-white/5 bg-slate-950/60 p-2">
        <div className="flex justify-between text-[10px] text-slate-400">
          <span>橫向 G 力 SENSOR</span>
          <span className="font-mono font-bold text-white">
            {telemetry.lateralG > 0 ? `+${telemetry.lateralG}G R` : `${telemetry.lateralG}G L`}
          </span>
        </div>
        <div className="relative mt-1 h-1.5 w-full rounded-full bg-slate-800">
          <div className="absolute left-1/2 top-0 h-full w-0.5 bg-slate-500" />
          <div
            className="absolute top-0 h-full rounded-full bg-sky-400 transition-all duration-75"
            style={{
              left: telemetry.lateralG < 0 ? `${50 + (telemetry.lateralG / 2) * 50}%` : '50%',
              width: `${(Math.abs(telemetry.lateralG) / 2) * 50}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
}

export function PitWallRightWing({
  telemetry,
  time,
  bestLap,
  ghostDelta,
}: {
  telemetry: TelemetryData;
  time: number;
  bestLap: number;
  ghostDelta: number | null;
}) {
  return (
    <div className="flex h-full w-full flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/90 p-3 shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">📡</span>
          <h3 className="text-xs font-black tracking-wider text-slate-200">車隊情資檔案</h3>
        </div>
        <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
          PIT WALL LIVE
        </span>
      </div>

      {/* Gap Delta Broadcast Widget */}
      <div className="rounded-xl border border-white/5 bg-slate-950/60 p-2.5">
        <span className="text-[10px] font-bold tracking-wider text-slate-400">
          前後車距秒差 GAP DELTA
        </span>
        <div className="mt-1.5 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg border border-white/5 bg-slate-900/70 p-2">
            <span className="text-[10px] font-bold text-slate-400">▲ 前方目標</span>
            {telemetry.gapAhead != null ? (
              <p className="font-mono font-bold text-rose-300">
                {telemetry.gapAhead.toFixed(2)}s
              </p>
            ) : (
              <p className="font-bold text-amber-300">領先中 👑</p>
            )}
            <p className="truncate text-[9px] text-slate-400">
              {telemetry.aheadRacerName ?? '領跑領先者'}
            </p>
          </div>

          <div className="rounded-lg border border-white/5 bg-slate-900/70 p-2">
            <span className="text-[10px] font-bold text-slate-400">▼ 後方威脅</span>
            {telemetry.gapBehind != null ? (
              <p className="font-mono font-bold text-emerald-300">
                +{telemetry.gapBehind.toFixed(2)}s
              </p>
            ) : (
              <p className="font-bold text-slate-400">無追兵</p>
            )}
            <p className="truncate text-[9px] text-slate-400">
              {telemetry.behindRacerName ?? '末位追趕'}
            </p>
          </div>
        </div>
      </div>

      {/* Rivals Standings & Weapon Threat Radar */}
      <div className="flex-1 rounded-xl border border-white/5 bg-slate-950/60 p-2.5">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-bold tracking-wider text-slate-400">
            對手檔案與持武雷達
          </span>
          <span className="text-[9px] text-slate-500">4位車手</span>
        </div>

        <div className="space-y-1.5">
          {telemetry.racers.map((r) => {
            const badge = PLACE_BADGES[r.place] ?? {text: `P${r.place}`, color: 'bg-slate-700'};
            const heldItem = r.item ? ITEM_NAME_MAP[r.item] : null;

            return (
              <div
                key={r.index}
                className={`flex items-center justify-between rounded-lg border px-2 py-1.5 transition-colors ${
                  r.isPlayer
                    ? 'border-amber-400/40 bg-amber-500/10'
                    : 'border-white/5 bg-slate-900/50'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${badge.color}`}>
                    {badge.text}
                  </span>
                  <div className="truncate">
                    <p className="truncate text-xs font-bold text-white">
                      {r.name} {r.isPlayer && <span className="text-[10px] text-amber-300">(你)</span>}
                    </p>
                    <p className="truncate text-[9px] text-slate-400">{r.tagline}</p>
                  </div>
                </div>

                {/* Held Weapon Radar Badge */}
                <div className="flex shrink-0 items-center gap-1">
                  {heldItem ? (
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${heldItem.color}`}
                    >
                      <span>{heldItem.icon}</span>
                      <span>{heldItem.name}</span>
                    </span>
                  ) : r.itemRoll > 0 ? (
                    <span className="rounded-md border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                      🎲 抽中
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-600">無道具</span>
                  )}
                  {r.shields > 0 && (
                    <span className="rounded border border-cyan-400/40 bg-cyan-500/20 px-1 text-[9px] font-bold text-cyan-300">
                      🛡️{r.shields}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Spotter Radio / Race Engineer Audio */}
      <div
        className={`rounded-xl border p-2.5 transition-colors ${
          telemetry.spotterUrgent
            ? 'border-rose-500/60 bg-rose-950/40'
            : 'border-white/5 bg-slate-950/60'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-xs">📻</span>
            <span className="text-[10px] font-bold tracking-wider text-slate-300">
              車隊實時無線電 RADIO
            </span>
          </div>
          {/* Animated audio wave bars */}
          <div className="flex items-end gap-0.5 h-3">
            <span className="w-0.5 bg-sky-400 animate-[pulse_0.6s_ease-in-out_infinite] h-2" />
            <span className="w-0.5 bg-sky-400 animate-[pulse_0.4s_ease-in-out_infinite] h-3" />
            <span className="w-0.5 bg-sky-400 animate-[pulse_0.8s_ease-in-out_infinite] h-1.5" />
          </div>
        </div>
        <p
          className={`mt-1 text-xs leading-relaxed font-bold ${
            telemetry.spotterUrgent ? 'text-rose-200' : 'text-slate-200'
          }`}
        >
          {telemetry.spotterMessage}
        </p>
      </div>

      {/* Lap & Ghost Telemetry */}
      <div className="flex justify-between rounded-xl border border-white/5 bg-slate-950/60 px-3 py-2 text-xs">
        <div>
          <span className="text-[10px] text-slate-400">比賽用時</span>
          <p className="font-mono font-bold text-white">{formatTime(time)}</p>
        </div>
        {bestLap > 0 && (
          <div>
            <span className="text-[10px] text-slate-400">最佳單圈</span>
            <p className="font-mono font-bold text-amber-300">{formatTime(bestLap)}</p>
          </div>
        )}
        {ghostDelta != null && (
          <div>
            <span className="text-[10px] text-slate-400">幽靈秒差</span>
            <p
              className={`font-mono font-bold ${
                ghostDelta <= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {ghostDelta <= 0 ? '' : '+'}
              {ghostDelta.toFixed(2)}s
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function EsportsKeyboardHud({activeKeys}: {activeKeys: Set<string>}) {
  const isKeyActive = (key: string) => activeKeys.has(key.toLowerCase());

  const isUp = isKeyActive('arrowup') || isKeyActive('w') || isKeyActive('z');
  const isDown = isKeyActive('arrowdown') || isKeyActive('s');
  const isLeft = isKeyActive('arrowleft') || isKeyActive('a');
  const isRight = isKeyActive('arrowright') || isKeyActive('d');
  const isDrift = isKeyActive('shift') || isKeyActive('c');
  const isItem = isKeyActive(' ') || isKeyActive('e') || isKeyActive('enter');
  const isPause = isKeyActive('p');
  const isMute = isKeyActive('m');

  const keyClass = (active: boolean, accent = 'border-amber-400 bg-amber-400/20 text-amber-300') =>
    `flex items-center justify-center rounded-lg border font-mono font-black transition-all duration-75 text-xs select-none ${
      active
        ? `${accent} scale-95 shadow-[0_0_12px_rgba(251,191,36,0.6)]`
        : 'border-white/15 bg-slate-900/80 text-slate-400 hover:border-white/30'
    }`;

  return (
    <div className="hidden lg:flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-slate-950/70 px-4 py-2 backdrop-blur-md">
      <div className="flex items-center gap-1.5 text-slate-400 text-[11px] font-bold">
        <span>🎮</span>
        <span>電競鍵盤 HUD</span>
      </div>

      <div className="flex items-center gap-3">
        {/* Throttle / Steer / Brake keys */}
        <div className="flex items-center gap-1">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] text-slate-500 font-bold">轉向 / 油門</span>
            <div className="flex gap-1">
              <div className={`h-7 w-7 ${keyClass(isLeft)}`}>A/←</div>
              <div className={`h-7 w-7 ${keyClass(isUp, 'border-emerald-400 bg-emerald-400/20 text-emerald-300')}`}>
                W/↑
              </div>
              <div className={`h-7 w-7 ${keyClass(isDown, 'border-rose-400 bg-rose-400/20 text-rose-300')}`}>
                S/↓
              </div>
              <div className={`h-7 w-7 ${keyClass(isRight)}`}>D/→</div>
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-white/10" />

        {/* Drift & Item */}
        <div className="flex items-center gap-1.5">
          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] text-slate-500 font-bold">甩尾跳躍</span>
            <div
              className={`h-7 px-2.5 ${keyClass(
                isDrift,
                'border-purple-400 bg-purple-400/25 text-purple-300 shadow-[0_0_12px_rgba(192,132,252,0.6)]',
              )}`}
            >
              Shift / C
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <span className="text-[9px] text-slate-500 font-bold">發射道具</span>
            <div
              className={`h-7 px-3 ${keyClass(
                isItem,
                'border-amber-400 bg-amber-400/25 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.6)]',
              )}`}
            >
              Space / E
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-white/10" />

        {/* System Keys */}
        <div className="flex items-center gap-1">
          <div className={`h-7 w-7 ${keyClass(isPause, 'border-sky-400 bg-sky-400/20 text-sky-300')}`}>
            P
          </div>
          <div className={`h-7 w-7 ${keyClass(isMute, 'border-sky-400 bg-sky-400/20 text-sky-300')}`}>
            M
          </div>
        </div>
      </div>
    </div>
  );
}

export function MobileTacticalBar({
  place,
  lap,
  laps,
  telemetry,
  onOpenDossier,
}: {
  place: number;
  lap: number;
  laps: number;
  telemetry: TelemetryData;
  onOpenDossier: () => void;
}) {
  return (
    <div className="pointer-events-auto flex items-center justify-between gap-1.5 border-b border-white/10 bg-slate-950/80 px-2 py-1 text-xs backdrop-blur-md lg:hidden">
      {/* Place & Lap */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="rounded bg-amber-400 px-1.5 py-0.5 font-mono text-[11px] font-black text-slate-950">
          P{place}
        </span>
        <span className="font-mono text-[11px] font-bold text-white">
          {lap}/{laps}圈
        </span>
      </div>

      {/* Gap Delta chip */}
      <div className="flex items-center gap-1 font-mono text-[10px] shrink-0">
        {telemetry.gapAhead != null ? (
          <span className="text-rose-300">▲{telemetry.gapAhead.toFixed(1)}s</span>
        ) : (
          <span className="text-amber-300 font-bold">領先</span>
        )}
        {telemetry.gapBehind != null && (
          <span className="text-emerald-300">▼+{telemetry.gapBehind.toFixed(1)}s</span>
        )}
      </div>

      {/* Spotter Marquee / message */}
      <div className="flex-1 truncate px-1 text-center text-[10px] font-bold text-slate-300">
        {telemetry.spotterMessage}
      </div>

      {/* Pit Wall Dossier Toggle Button */}
      <button
        type="button"
        onClick={onOpenDossier}
        className="shrink-0 min-h-[36px] rounded-lg border border-sky-400/40 bg-sky-500/20 px-2 py-1 text-[11px] font-bold text-sky-200 touch-manipulation"
      >
        情資 📊
      </button>
    </div>
  );
}

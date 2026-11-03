import React from 'react';
import { currentSpeed } from '../game/engine';
import { trainPace } from '../game/constants';
import { RUNNERS } from '../game/profiles';
import type { RunState } from '../game/types';

interface Props {
  state: RunState | null;
}

const LANE_NAMES = ['1 股道（左）', '2 股道（中）', '3 股道（右）'];

export const DispatchLeftWing: React.FC<Props> = ({ state: s }) => {
  if (!s) return null;

  const vPlayer = currentSpeed(s);
  const vTrain = trainPace(s.elapsed) * s.trainPaceMul;
  const deltaV = vPlayer - vTrain;

  const maxBuf = s.maxBuffer || 430;
  const bufferPct = Math.max(0, Math.min(100, (s.buffer / maxBuf) * 100));
  const isEmergency = bufferPct < 22;
  const isWarning = bufferPct < 50 && !isEmergency;

  const runner = RUNNERS.find((r) => r.id === s.config.runnerId) ?? RUNNERS[0];

  const distanceToLock = Math.max(0, s.pendingJunction.lockDistance - s.distance);
  const timeToLock = distanceToLock / Math.max(1, vPlayer);

  return (
    <aside
      className="sr-cockpit-wing hidden lg:flex flex-col gap-3 w-72 xl:w-80 shrink-0 p-3 select-none overflow-y-auto"
      aria-label="中央調度信號雷達與拓撲監控"
    >
      {/* Cockpit Module 1: System Header */}
      <div className="sr-telemetry-card">
        <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isEmergency ? 'bg-rose-400' : 'bg-emerald-400'}`} />
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isEmergency ? 'bg-rose-500' : 'bg-emerald-500'}`} />
            </span>
            <span className="text-xs font-bold tracking-wider text-emerald-300">
              中央調度信號雷達
            </span>
          </div>
          <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
            RADAR-01
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          全線軌道拓撲與追越差速即時測繪
        </p>
      </div>

      {/* Cockpit Module 2: Pursuit Buffer & Delta Speed */}
      <div className={`sr-telemetry-card ${isEmergency ? 'border-rose-500/60 bg-rose-950/20 shadow-[0_0_20px_rgba(244,63,94,0.25)]' : ''}`}>
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold text-slate-300">列車追越緩衝儀</span>
          <span
            className={`font-mono font-bold ${
              isEmergency
                ? 'text-rose-400 animate-pulse'
                : isWarning
                  ? 'text-amber-300'
                  : 'text-emerald-400'
            }`}
          >
            {Math.round(bufferPct)}%
          </span>
        </div>

        {/* Multi-segment Buffer Bar */}
        <div className="h-2.5 w-full bg-slate-950/80 rounded-full overflow-hidden p-0.5 border border-white/10 flex">
          <div
            className={`h-full rounded-full transition-all duration-150 ${
              isEmergency
                ? 'bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_10px_#f43f5e]'
                : isWarning
                  ? 'bg-gradient-to-r from-amber-600 to-amber-400 shadow-[0_0_8px_#f59e0b]'
                  : 'bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_8px_#10b981]'
            }`}
            style={{ width: `${bufferPct}%` }}
          />
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] pt-1">
          <div className="bg-slate-900/60 rounded px-2 py-1 border border-white/5">
            <span className="text-slate-400 block text-[10px]">距離列車</span>
            <span className="font-mono font-bold text-slate-200">
              {Math.round(s.buffer)} / {maxBuf}m
            </span>
          </div>
          <div className="bg-slate-900/60 rounded px-2 py-1 border border-white/5">
            <span className="text-slate-400 block text-[10px]">追越差速 Δv</span>
            <span
              className={`font-mono font-bold ${
                deltaV >= 0 ? 'text-emerald-300' : 'text-rose-400 animate-pulse'
              }`}
            >
              {deltaV >= 0 ? `+${deltaV.toFixed(1)}` : deltaV.toFixed(1)} m/s
            </span>
          </div>
        </div>

        <div className="mt-2 text-center text-[10px] font-semibold py-0.5 rounded bg-slate-950/50">
          {isEmergency && (
            <span className="text-rose-400 tracking-wide animate-pulse">
              🚨 緊急警報：列車即將追撞！全力加速！
            </span>
          )}
          {isWarning && (
            <span className="text-amber-300 tracking-wide">
              ⚠️ 警戒：間隔縮小，請挑選高速或補給股道
            </span>
          )}
          {!isEmergency && !isWarning && (
            <span className="text-emerald-300 tracking-wide">
              🟢 巡航安全：緩衝充足，可爭取高倍率路線
            </span>
          )}
        </div>
      </div>

      {/* Cockpit Module 3: Switchpoint Topology & Upcoming Branches */}
      <div className="sr-telemetry-card flex-1">
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
          <span className="text-xs font-bold text-slate-200">
            {s.activeBranch ? '當前股道運轉狀態' : '前方道岔拓撲預警'}
          </span>
          <span className="text-[10px] font-mono text-sky-400">
            {s.activeBranch ? 'RUNNING' : `#${s.pendingJunction.id} JUNCTION`}
          </span>
        </div>

        {s.activeBranch ? (
          <div className="space-y-2">
            <div className="bg-emerald-950/30 border border-emerald-500/30 rounded-lg p-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-200">
                  {s.activeBranch.name}
                </span>
                <span className="text-[11px] font-mono text-emerald-400">
                  {LANE_NAMES[s.activeBranch.lane] ?? `${s.activeBranch.lane + 1} 股道`}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-300">
                速度倍率: <b className="text-white">×{s.activeBranch.speedMult.toFixed(2)}</b>
                {' · '}
                障礙: <b className="text-white">{s.activeBranch.density} 組</b>
              </p>
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
                  <span>股道進度</span>
                  <span>
                    {Math.round(s.distance - s.activeBranch.startDistance)} /{' '}
                    {Math.round(s.activeBranch.length)}m
                  </span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all duration-100"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(
                          0,
                          ((s.distance - s.activeBranch.startDistance) /
                            Math.max(1, s.activeBranch.length)) *
                            100,
                        ),
                      )}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-900/50 rounded-lg p-2 border border-white/5 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400">未排除障礙</span>
                <span className="font-mono text-amber-300">
                  {s.activeBranch.obstacles.filter((o) => !o.resolved).length} 組
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">特殊物資</span>
                <span className="font-semibold text-slate-200">
                  {s.activeBranch.reward === 'supply'
                    ? s.activeBranch.rewardCollected
                      ? '已領取補給 (+緩衝)'
                      : '前方有緊急補給 (+緩衝)'
                    : s.activeBranch.reward === 'score'
                      ? s.activeBranch.rewardCollected
                        ? '已獲得評分倍率'
                        : '前方有評分倍率節點'
                      : '無特殊物資'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Lock Countdown */}
            <div className="bg-sky-950/20 border border-sky-500/30 rounded-lg p-2">
              <div className="flex justify-between text-[11px] mb-1">
                <span className="text-slate-300">道岔自動鎖定倒數</span>
                <span className="font-mono font-bold text-sky-300">
                  {timeToLock.toFixed(1)}s ({Math.round(distanceToLock)}m)
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-sky-400 rounded-full transition-all duration-100"
                  style={{
                    width: `${Math.max(
                      0,
                      Math.min(100, (1 - distanceToLock / 180) * 100),
                    )}%`,
                  }}
                />
              </div>
            </div>

            {/* 3 Lane branches topology preview */}
            <div className="space-y-1.5">
              {[0, 1, 2].map((lane) => {
                const b = s.pendingJunction.branches.find((br) => br.lane === lane);
                const isCurrent = s.lane === lane;
                return (
                  <div
                    key={lane}
                    className={`rounded-lg p-2 transition-all border ${
                      isCurrent
                        ? 'bg-emerald-950/40 border-emerald-400/70 shadow-[0_0_12px_rgba(52,211,153,0.18)]'
                        : b
                          ? 'bg-slate-900/60 border-white/10'
                          : 'bg-rose-950/20 border-rose-500/20 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold flex items-center gap-1.5 text-slate-100">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            isCurrent
                              ? 'bg-emerald-400 shadow-[0_0_6px_#34d399]'
                              : b
                                ? 'bg-slate-400'
                                : 'bg-rose-500'
                          }`}
                        />
                        {LANE_NAMES[lane]}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          扳道對準
                        </span>
                      )}
                    </div>

                    {b ? (
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-300 truncate max-w-[120px]">
                          {b.name}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`font-semibold ${
                              b.speedMult > 1.05
                                ? 'text-emerald-400'
                                : b.speedMult < 0.95
                                  ? 'text-rose-400'
                                  : 'text-slate-400'
                            }`}
                          >
                            {b.speedMult > 1.05
                              ? '▲ 加速'
                              : b.speedMult < 0.95
                                ? '▼ 減速'
                                : '▬ 維持'}
                          </span>
                          {b.reward === 'supply' && (
                            <span className="text-[10px] text-emerald-300 bg-emerald-950/70 px-1 rounded border border-emerald-500/40">
                              +補給
                            </span>
                          )}
                          {b.reward === 'score' && (
                            <span className="text-[10px] text-amber-300 bg-amber-950/70 px-1 rounded border border-amber-500/40">
                              ×倍率
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 text-[11px] text-rose-400 font-semibold">
                        ✕ 軌道封閉，切勿進入
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Cockpit Module 4: Vehicle Dynamics */}
      <div className="sr-telemetry-card">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="font-semibold text-slate-300">機車姿態與動力</span>
          <span className="text-[10px] text-emerald-300 font-mono">
            {runner.name}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="bg-slate-900/60 rounded px-2 py-1 border border-white/5">
            <span className="text-slate-400 block text-[10px]">即時車速</span>
            <span className="font-mono font-bold text-white">
              {Math.round(vPlayer)} km/h
            </span>
          </div>
          <div className="bg-slate-900/60 rounded px-2 py-1 border border-white/5">
            <span className="text-slate-400 block text-[10px]">姿態狀態</span>
            <span
              className={`font-semibold ${
                s.hitStunTimer > 0
                  ? 'text-rose-400'
                  : s.jumpTimer > 0
                    ? 'text-sky-300'
                    : s.slideTimer > 0
                      ? 'text-indigo-300'
                      : 'text-emerald-300'
              }`}
            >
              {s.hitStunTimer > 0
                ? '撞擊制動中'
                : s.jumpTimer > 0
                  ? '滯空跳躍'
                  : s.slideTimer > 0
                    ? '鏟滑避障'
                    : '平穩巡航'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
};

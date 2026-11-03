import React from 'react';
import { Activity, AlertTriangle, Flame, ShieldAlert, Zap } from 'lucide-react';
import type { GForceTelemetry, StrikeRecord } from '../telemetry';

interface RedCornerTelemetryProps {
  telemetry: GForceTelemetry;
  stamina: number;
  bodyFatigue: number;
  stun: number;
  counterWindowActive: boolean;
  recentStrikes: StrikeRecord[];
}

export const RedCornerTelemetry: React.FC<RedCornerTelemetryProps> = ({
  telemetry,
  stamina,
  bodyFatigue,
  stun,
  counterWindowActive,
  recentStrikes,
}) => {
  const isStunDangerous = stun >= 70;
  const gForcePct = Math.min(100, (telemetry.currentGForce / 60) * 100);

  const getRatingColor = (rating: string) => {
    switch (rating) {
      case 'S':
        return 'text-amber-400 border-amber-400/50 bg-amber-400/10 shadow-[0_0_12px_rgba(251,191,36,0.4)]';
      case 'A':
        return 'text-rose-400 border-rose-400/50 bg-rose-400/10 shadow-[0_0_10px_rgba(244,63,94,0.3)]';
      case 'B':
        return 'text-blue-400 border-blue-400/50 bg-blue-400/10';
      case 'C':
        return 'text-emerald-400 border-emerald-400/50 bg-emerald-400/10';
      default:
        return 'text-neutral-500 border-neutral-700 bg-neutral-900';
    }
  };

  const getOutcomeBadge = (outcome: StrikeRecord['outcome']) => {
    switch (outcome) {
      case 'counter':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40">反擊</span>;
      case 'parry':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/40">撥招</span>;
      case 'hit':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">命中</span>;
      case 'blocked':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-700/60 text-neutral-300 font-medium">格擋</span>;
      case 'wrong_guard':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-medium">擋錯</span>;
      case 'dodged':
        return <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-medium">落空</span>;
    }
  };

  return (
    <aside
      className="flex flex-col gap-3 rounded-2xl border border-rose-500/20 bg-neutral-950/80 p-3.5 shadow-xl backdrop-blur-md"
      aria-label="紅角打擊與體能遙測儀"
    >
      {/* Wing Header */}
      <div className="flex items-center justify-between border-b border-rose-500/20 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          <h3 className="text-xs font-black uppercase tracking-widest text-rose-400">
            紅角遙測儀 · 打擊生化
          </h3>
        </div>
        <span className="rounded bg-rose-950/60 px-1.5 py-0.5 font-mono text-[9px] font-bold text-rose-300 border border-rose-800/50">
          RED WING
        </span>
      </div>

      {/* G-Force Kinetic Radar */}
      <div className="rounded-xl border border-white/5 bg-neutral-900/90 p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-neutral-300">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            衝擊力 G-Force 儀表
          </span>
          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${getRatingColor(telemetry.kineticRating)}`}>
            評級 {telemetry.kineticRating}
          </span>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-2xl font-black text-white tabular-nums tracking-tight">
              {telemetry.currentGForce > 0 ? telemetry.currentGForce.toFixed(1) : '0.0'}
            </span>
            <span className="text-[10px] font-bold text-neutral-400">G</span>
          </div>
          <div className="text-right text-[10px] text-neutral-400">
            <span>峰值 </span>
            <span className="font-mono font-bold text-amber-400 tabular-nums">
              {telemetry.peakGForce.toFixed(1)} G
            </span>
          </div>
        </div>

        {/* Dynamic G-Force Meter Bar */}
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-800 border border-white/5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 via-amber-400 to-rose-500 transition-all duration-150"
            style={{ width: `${gForcePct}%` }}
          />
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-400 border-t border-white/5 pt-1.5">
          <span>初速：<strong className="font-mono text-neutral-200">{telemetry.strikeSpeedMs.toFixed(1)} m/s</strong></span>
          <span>型態：<strong className="text-neutral-200">
            {telemetry.lastPunchKind === 'signature' ? '招牌重擊' : telemetry.lastPunchKind === 'hook' ? '沉猛勾拳' : telemetry.lastPunchKind === 'jab' ? '迅捷刺拳' : '蓄勢待發'}
          </strong></span>
        </div>
      </div>

      {/* Counter Window & Stun Break Alert Box */}
      <div className="grid grid-cols-2 gap-2">
        {/* Counter Opportunity Window */}
        <div
          className={`flex flex-col justify-between rounded-xl border p-2.5 transition-all ${
            counterWindowActive
              ? 'border-amber-400 bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.35)] animate-pulse'
              : 'border-white/5 bg-neutral-900/60'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <Flame className={`w-3.5 h-3.5 ${counterWindowActive ? 'text-amber-300' : 'text-neutral-500'}`} />
            <span className={`text-[10px] font-bold ${counterWindowActive ? 'text-amber-200' : 'text-neutral-400'}`}>
              反擊時機窗口
            </span>
          </div>
          <span
            className={`mt-1 text-xs font-black tracking-tight ${
              counterWindowActive ? 'text-amber-300' : 'text-neutral-500'
            }`}
          >
            {counterWindowActive ? '● COUNTER 開放' : '待機中'}
          </span>
        </div>

        {/* Stun Alert */}
        <div
          className={`flex flex-col justify-between rounded-xl border p-2.5 transition-all ${
            isStunDangerous
              ? 'border-rose-500 bg-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse'
              : 'border-white/5 bg-neutral-900/60'
          }`}
        >
          <div className="flex items-center gap-1.5">
            <ShieldAlert className={`w-3.5 h-3.5 ${isStunDangerous ? 'text-rose-400' : 'text-neutral-500'}`} />
            <span className={`text-[10px] font-bold ${isStunDangerous ? 'text-rose-300' : 'text-neutral-400'}`}>
              破防暈眩警戒
            </span>
          </div>
          <span
            className={`mt-1 text-xs font-black tracking-tight ${
              isStunDangerous ? 'text-rose-300' : 'text-neutral-500'
            }`}
          >
            {isStunDangerous ? '⚠️ 高危戒備！' : `暈眩 ${Math.round(stun)}%`}
          </span>
        </div>
      </div>

      {/* Biometrics & Recovery Status */}
      <div className="rounded-xl border border-white/5 bg-neutral-900/80 p-2.5 text-[11px]">
        <div className="flex items-center justify-between text-neutral-400 mb-1">
          <span className="flex items-center gap-1 font-bold text-neutral-300">
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            體能回充心率儀
          </span>
          <span className="font-mono text-emerald-400 font-bold">{Math.round(stamina)}%</span>
        </div>

        {bodyFatigue > 0.05 && (
          <div className="mt-1 flex items-center justify-between text-[10px] text-orange-400 bg-orange-950/40 px-2 py-1 rounded border border-orange-800/40">
            <span className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-orange-400" />
              腹部疲勞 (回氣延遲)
            </span>
            <span className="font-mono font-bold">-{Math.round(bodyFatigue * 100)}%</span>
          </div>
        )}
      </div>

      {/* Recent Strikes Log */}
      <div className="rounded-xl border border-white/5 bg-neutral-900/80 p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-bold tracking-wider text-neutral-400 uppercase">
            打擊遙測軌跡 (Telemetry Feed)
          </span>
          <span className="text-[9px] text-neutral-500">最近 4 次</span>
        </div>
        {recentStrikes.length === 0 ? (
          <p className="text-center py-2 text-[10px] text-neutral-500 italic">
            尚未打出打擊，進入擂台蓄勢待發
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {recentStrikes.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded bg-neutral-950/60 px-2 py-1 border border-white/5 text-[10px]"
              >
                <div className="flex items-center gap-1.5">
                  {getOutcomeBadge(s.outcome)}
                  <span className="font-bold text-neutral-300">
                    {s.kind === 'jab' ? '刺拳' : s.kind === 'hook' ? '勾拳' : '招牌'}
                  </span>
                  <span className="text-neutral-500 text-[9px]">
                    {s.height === 'high' ? '上段' : '下段'}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="text-neutral-400">{s.gForce.toFixed(1)}G</span>
                  {s.damage > 0 && (
                    <span className="font-bold text-rose-400">-{s.damage.toFixed(1)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
};

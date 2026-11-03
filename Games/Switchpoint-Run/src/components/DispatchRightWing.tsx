import React from 'react';
import type { RunState } from '../game/types';

export interface BlackboxLogEntry {
  id: string;
  time: string;
  text: string;
  kind: 'switch' | 'hazard' | 'supply' | 'score' | 'combo' | 'warning';
}

interface Props {
  state: RunState | null;
  logs: BlackboxLogEntry[];
  activeKeys: {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  };
  estimatedBolts: number;
}

const KIND_BADGES: Record<
  BlackboxLogEntry['kind'],
  { label: string; bg: string; text: string; border: string }
> = {
  switch: {
    label: '道岔',
    bg: 'bg-emerald-950/60',
    text: 'text-emerald-300',
    border: 'border-emerald-500/30',
  },
  hazard: {
    label: '擦撞',
    bg: 'bg-rose-950/60',
    text: 'text-rose-300',
    border: 'border-rose-500/30',
  },
  supply: {
    label: '補給',
    bg: 'bg-teal-950/60',
    text: 'text-teal-300',
    border: 'border-teal-500/30',
  },
  score: {
    label: '倍率',
    bg: 'bg-amber-950/60',
    text: 'text-amber-300',
    border: 'border-amber-500/30',
  },
  combo: {
    label: '連擊',
    bg: 'bg-sky-950/60',
    text: 'text-sky-300',
    border: 'border-sky-500/30',
  },
  warning: {
    label: '警戒',
    bg: 'bg-red-950/60',
    text: 'text-red-300',
    border: 'border-red-500/30',
  },
};

export const DispatchRightWing: React.FC<Props> = ({
  state: s,
  logs,
  activeKeys,
  estimatedBolts,
}) => {
  if (!s) return null;

  const maxBuf = s.maxBuffer || 430;
  const bufferPct = (s.buffer / maxBuf) * 100;

  // Dynamic tactical guidance based on live telemetry
  let tactic = '🧭 觀察前方道岔拓撲，提前對準目標股道，避免最後關頭慌亂換道。';
  if (bufferPct < 25) {
    tactic = '🚨 追越列車逼近極限！下一道岔請果斷選擇「補給」或「加速」路線！';
  } else if (s.hitStunTimer > 0) {
    tactic = '⚠️ 剛承受擦撞制動！速度大幅衰退，專注穩住軌道切勿連續失誤！';
  } else if (s.scoreMult >= 1.6 && bufferPct > 55) {
    tactic = '⚡ 緩衝充足且倍率高漲！可大膽進攻高密度「倍率」支線拉高總分！';
  } else if (bufferPct > 85) {
    tactic = '🛡️ 緩衝已接近上限，無須執著吃補給，建議維持車速或爭取倍率！';
  }

  return (
    <aside
      className="sr-cockpit-wing hidden lg:flex flex-col gap-3 w-72 xl:w-80 shrink-0 p-3 select-none overflow-y-auto"
      aria-label="行車記錄黑盒子與戰術中心"
    >
      {/* Cockpit Module 1: Header */}
      <div className="sr-telemetry-card">
        <div className="flex items-center justify-between border-b border-sky-500/20 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
            <span className="text-xs font-bold tracking-wider text-sky-300">
              行車黑盒子與戰術中心
            </span>
          </div>
          <span className="text-[10px] font-mono tracking-widest text-slate-400 uppercase">
            BLACKBOX
          </span>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          全程行車決策日誌與收益倍率矩陣
        </p>
      </div>

      {/* Cockpit Module 2: Blackbox Flight Recorder Log */}
      <div className="sr-telemetry-card flex-1 flex flex-col min-h-[160px]">
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
          <span className="text-xs font-bold text-slate-200">即時調度事件簿</span>
          <span className="text-[10px] font-mono text-slate-400">
            {logs.length} EVENTS
          </span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-52">
          {logs.length === 0 ? (
            <div className="h-full flex items-center justify-center text-center p-3 text-[11px] text-slate-500">
              行車紀錄器就緒，即將記錄扳道與避障日誌...
            </div>
          ) : (
            logs.map((log) => {
              const badge = KIND_BADGES[log.kind] ?? KIND_BADGES.switch;
              return (
                <div
                  key={log.id}
                  className="rounded bg-slate-900/70 border border-white/5 p-1.5 text-[11px] flex items-start gap-1.5 transition-all"
                >
                  <span className="font-mono text-[10px] text-slate-500 shrink-0 pt-0.5">
                    {log.time}
                  </span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded font-bold shrink-0 border ${badge.bg} ${badge.text} ${badge.border}`}
                  >
                    {badge.label}
                  </span>
                  <span className="text-slate-200 leading-tight flex-1 break-words">
                    {log.text}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Cockpit Module 3: Tactical Multiplier Matrix */}
      <div className="sr-telemetry-card">
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-2">
          <span className="text-xs font-bold text-slate-200">調度收益矩陣</span>
          <span className="text-[10px] text-amber-300 font-mono">
            +{estimatedBolts} 螺栓
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="bg-slate-900/60 rounded px-2 py-1.5 border border-white/5">
            <span className="text-slate-400 block text-[10px]">路線評價</span>
            <span className="font-mono font-bold text-emerald-300">
              {s.routeScore.toLocaleString('zh-Hant')}
            </span>
          </div>
          <div className="bg-slate-900/60 rounded px-2 py-1.5 border border-white/5">
            <span className="text-slate-400 block text-[10px]">評分倍率</span>
            <span className="font-mono font-bold text-amber-300">
              ×{s.scoreMult.toFixed(2)}
            </span>
          </div>
          <div className="bg-slate-900/60 rounded px-2 py-1.5 border border-white/5">
            <span className="text-slate-400 block text-[10px]">當前連擊</span>
            <span className="font-mono font-bold text-sky-300">
              {s.noHitStreak} <span className="text-[9px] text-slate-500">(最高 {s.maxNoHitStreak})</span>
            </span>
          </div>
          <div className="bg-slate-900/60 rounded px-2 py-1.5 border border-white/5">
            <span className="text-slate-400 block text-[10px]">擦撞次數</span>
            <span
              className={`font-mono font-bold ${
                s.hitsTotal > 0 ? 'text-rose-400' : 'text-slate-300'
              }`}
            >
              {s.hitsTotal} 次
            </span>
          </div>
        </div>
      </div>

      {/* Cockpit Module 4: Dispatcher Heuristics Advice */}
      <div className="sr-telemetry-card bg-emerald-950/20 border-emerald-500/25">
        <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-300 mb-1">
          <span>調度錦囊</span>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-300">
          {tactic}
        </p>
      </div>

      {/* Cockpit Module 5: Keyboard HUD with tactile keycaps */}
      <div className="sr-telemetry-card">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-semibold text-slate-300">調度控制盤 HUD</span>
          <span className="text-[10px] text-slate-500 font-mono">KEYBOARD</span>
        </div>

        <div className="flex flex-col items-center gap-1.5">
          {/* Top row: Up / Jump */}
          <div className="flex items-center gap-2">
            <div
              className={`sr-keycap ${
                activeKeys.up ? 'sr-keycap-active' : ''
              }`}
            >
              <span className="text-[11px] font-bold">W / ↑</span>
              <span className="text-[9px] text-slate-400">跳躍</span>
            </div>
          </div>

          {/* Bottom row: Left, Down, Right */}
          <div className="flex items-center gap-2">
            <div
              className={`sr-keycap ${
                activeKeys.left ? 'sr-keycap-active' : ''
              }`}
            >
              <span className="text-[11px] font-bold">A / ←</span>
              <span className="text-[9px] text-slate-400">左扳道</span>
            </div>
            <div
              className={`sr-keycap ${
                activeKeys.down ? 'sr-keycap-active' : ''
              }`}
            >
              <span className="text-[11px] font-bold">S / ↓</span>
              <span className="text-[9px] text-slate-400">鏟滑</span>
            </div>
            <div
              className={`sr-keycap ${
                activeKeys.right ? 'sr-keycap-active' : ''
              }`}
            >
              <span className="text-[11px] font-bold">D / →</span>
              <span className="text-[9px] text-slate-400">右扳道</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

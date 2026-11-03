import React, { useState } from 'react';
import { Radar, ShieldAlert, Sparkles, BookOpen, Key, AlertCircle } from 'lucide-react';
import type { BottleData } from '../types.ts';
import { getTubeQuickStatus } from '../utils/cockpitMetrics.ts';

interface CockpitRightWingProps {
  bottles: BottleData[];
  selectedBottleId: string | null;
  legalMovesCount: number;
  bufferTubesCount: number;
  onSelectTube: (bottleId: string) => void;
  isCompact?: boolean;
}

type TipTab = 'buffer' | 'flow' | 'reverse' | 'recipes';

export const CockpitRightWing: React.FC<CockpitRightWingProps> = ({
  bottles,
  selectedBottleId,
  legalMovesCount,
  bufferTubesCount,
  onSelectTube,
  isCompact = false,
}) => {
  const [activeTip, setActiveTip] = useState<TipTab>('buffer');

  // Determine radar state
  const isDeadlock = legalMovesCount === 0;
  const isConstrained = legalMovesCount > 0 && legalMovesCount <= 2;

  return (
    <div
      className={`
        flex flex-col gap-3 rounded-2xl bg-slate-900/80 backdrop-blur-xl border border-white/15 p-3.5 shadow-2xl text-white select-none
        ${isCompact ? 'w-full' : 'w-72 xl:w-80 flex-shrink-0'}
      `}
    >
      {/* Wing Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
            <Radar className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-xs font-black tracking-wider text-emerald-300">
              態勢雷達與錦囊
            </h3>
            <p className="text-[10px] text-white/50">可行操作與戰術決策</p>
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[10px] font-bold text-emerald-200">
          <Sparkles className="w-3 h-3 text-emerald-300" />
          <span>{legalMovesCount} 航道</span>
        </div>
      </div>

      {/* Deadlock & Feasibility Radar Banner */}
      <div
        className={`
          rounded-xl border p-2.5 flex items-center gap-2.5 transition-all
          ${
            isDeadlock
              ? 'bg-red-500/25 border-red-500/50 text-red-200 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.4)]'
              : isConstrained
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-200'
          }
        `}
      >
        <div className="flex-shrink-0">
          {isDeadlock ? (
            <ShieldAlert className="w-5 h-5 text-red-400" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-black">
            {isDeadlock
              ? '死局過載！無可行倒水航道'
              : isConstrained
                ? '航道狹窄！請謹慎每一步'
                : '航道暢通・液體自由流轉'}
          </div>
          <div className="text-[9px] opacity-80 flex items-center gap-2 font-mono mt-0.5">
            <span>可用航道：{legalMovesCount} 組</span>
            <span>•</span>
            <span>緩衝空管：{bufferTubesCount} 支</span>
          </div>
        </div>
      </div>

      {/* Tube Status Quick Matrix */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px] font-bold text-white/60 tracking-wider">
          <span>試管狀態快檢矩陣</span>
          <span className="text-[9px] text-white/40 font-normal">可直接點選</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5 max-h-36 overflow-y-auto no-scrollbar">
          {bottles.map((tube, idx) => {
            const status = getTubeQuickStatus(tube);
            const isSelected = selectedBottleId === tube.id;
            return (
              <button
                key={tube.id}
                type="button"
                onClick={() => onSelectTube(tube.id)}
                disabled={tube.isCompleted || tube.isBlocked}
                className={`
                  rounded-lg border p-1 flex flex-col items-center justify-center gap-0.5 transition-all
                  ${status.badgeClass}
                  ${
                    isSelected
                      ? 'ring-2 ring-yellow-400 scale-105 shadow-md bg-yellow-400/20 text-yellow-200'
                      : 'hover:brightness-125'
                  }
                  ${tube.isCompleted || tube.isBlocked ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer active:scale-95'}
                `}
                title={`試管 #${idx + 1} (${status.label})`}
              >
                <div className="flex items-center gap-0.5 text-[10px] font-black font-mono">
                  <span className="text-white/60">#{idx + 1}</span>
                  <span>{status.icon}</span>
                </div>
                <div className="text-[8px] font-mono opacity-80">
                  {tube.layers.length}/{tube.capacity}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chemistry Master Tips (化學大師通關錦囊) */}
      <div className="flex flex-col gap-2 mt-auto border-t border-white/10 pt-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-teal-300">
            <BookOpen className="w-3.5 h-3.5 text-teal-400" />
            <span>化學大師錦囊</span>
          </div>
          <div className="flex items-center gap-1 text-[9px]">
            <button
              type="button"
              onClick={() => setActiveTip('buffer')}
              className={`px-1.5 py-0.5 rounded ${
                activeTip === 'buffer'
                  ? 'bg-teal-500/30 text-teal-200 font-bold border border-teal-400/40'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              空管
            </button>
            <button
              type="button"
              onClick={() => setActiveTip('flow')}
              className={`px-1.5 py-0.5 rounded ${
                activeTip === 'flow'
                  ? 'bg-teal-500/30 text-teal-200 font-bold border border-teal-400/40'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              匯流
            </button>
            <button
              type="button"
              onClick={() => setActiveTip('reverse')}
              className={`px-1.5 py-0.5 rounded ${
                activeTip === 'reverse'
                  ? 'bg-teal-500/30 text-teal-200 font-bold border border-teal-400/40'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              逆推
            </button>
            <button
              type="button"
              onClick={() => setActiveTip('recipes')}
              className={`px-1.5 py-0.5 rounded ${
                activeTip === 'recipes'
                  ? 'bg-teal-500/30 text-teal-200 font-bold border border-teal-400/40'
                  : 'text-white/40 hover:text-white/70'
              }`}
            >
              配方
            </button>
          </div>
        </div>

        <div className="rounded-xl bg-white/5 border border-white/10 p-2 text-[10px] text-white/80 leading-relaxed min-h-[58px] flex items-center">
          {activeTip === 'buffer' && (
            <p>
              🛡️ <span className="text-amber-300 font-bold">空試管保留策略：</span>
              空管是極珍貴的中轉緩衝區，切忌將雜色隨意注入最後一支空管！隨時保留至少一支淨空管以供逆向置換。
            </p>
          )}
          {activeTip === 'flow' && (
            <p>
              🌊 <span className="text-emerald-300 font-bold">同色匯流優先級：</span>
              優先將零碎同色液體匯整至同色基底管中，快速清出底部被壓制的關鍵液體層！
            </p>
          )}
          {activeTip === 'reverse' && (
            <p>
              🔍 <span className="text-sky-300 font-bold">層級逆向推演：</span>
              從目標訂單顏色逆推底層液體，計算需要幾步釋放關鍵層，避免過早封閉尚未滿足配方的試管。
            </p>
          )}
          {activeTip === 'recipes' && (
            <div className="w-full flex flex-col gap-0.5 text-[9px] font-mono">
              <div className="text-amber-300 font-bold">⚗️ 鍊金反應（不可逆）：</div>
              <div>緋紅 + 澄黃 → 暖橙</div>
              <div>湛藍 + 澄黃 → 翠綠</div>
              <div>緋紅 + 湛藍 → 紫晶</div>
            </div>
          )}
        </div>

        {/* Keypad Quick Control Reference */}
        <div className="flex items-center justify-between text-[9px] text-white/50 bg-black/30 rounded-lg px-2 py-1 border border-white/5">
          <div className="flex items-center gap-1 text-white/70">
            <Key className="w-3 h-3 text-yellow-400" />
            <span>鍵盤直控</span>
          </div>
          <div className="font-mono flex items-center gap-1.5">
            <span><kbd className="px-1 py-0.2 bg-white/15 rounded text-white font-bold">1</kbd>~<kbd className="px-1 py-0.2 bg-white/15 rounded text-white font-bold">9</kbd> 選管</span>
            <span><kbd className="px-1 py-0.2 bg-white/15 rounded text-white font-bold">U</kbd> 悔棋</span>
            <span><kbd className="px-1 py-0.2 bg-white/15 rounded text-white font-bold">R</kbd> 重置</span>
            <span><kbd className="px-1 py-0.2 bg-white/15 rounded text-white font-bold">H</kbd> 提示</span>
          </div>
        </div>
      </div>
    </div>
  );
};

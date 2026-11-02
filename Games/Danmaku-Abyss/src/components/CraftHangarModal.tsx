import React, { useState } from 'react';
import {
  CRAFTS,
  isCraftUnlocked,
  type CraftDef,
  type ProgressSave,
} from '../game/crafts';

interface CraftHangarModalProps {
  progress: ProgressSave;
  onSelectCraft: (id: string) => void;
  onClose: () => void;
}

export function CraftHangarModal({
  progress,
  onSelectCraft,
  onClose,
}: CraftHangarModalProps): React.ReactElement {
  const [activeTabId, setActiveTabId] = useState<string>(progress.selectedCraftId);
  const activeCraft = CRAFTS.find((c) => c.id === activeTabId) ?? CRAFTS[0];
  const unlocked = isCraftUnlocked(activeCraft, progress.clearCount);
  const isEquipped = progress.selectedCraftId === activeCraft.id;
  const craftBest = progress.craftBest[activeCraft.id];

  return (
    <div
      className="da-dialog-scrim fixed inset-0 z-40 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="da-crafts-title"
      onClick={onClose}
    >
      <div
        className="da-dialog flex max-h-[90vh] w-full max-w-xl flex-col rounded-[20px] p-5 text-left border border-cyan-500/35 bg-[#0a1020]/95 shadow-[0_0_48px_rgba(34,211,238,0.25)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between gap-3 border-b border-cyan-500/20 pb-3">
          <div>
            <h2 id="da-crafts-title" className="text-xl font-black font-display text-cyan-100 flex items-center gap-2">
              <span>深淵機庫 // 選擇機體</span>
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">
              射擊型態／判定／特技各異・通關解鎖・各機體另記最佳分
            </p>
          </div>
          <button
            type="button"
            aria-label="關閉機體選擇"
            onClick={onClose}
            className="da-close font-display text-xs"
          >
            關閉
          </button>
        </div>

        {/* Craft Selector Tabs */}
        <div className="grid grid-cols-3 gap-2 mt-3.5">
          {CRAFTS.map((craft) => {
            const isCraftUnlk = isCraftUnlocked(craft, progress.clearCount);
            const isSelectedTab = activeTabId === craft.id;
            const isEquippedThis = progress.selectedCraftId === craft.id;

            return (
              <button
                key={craft.id}
                type="button"
                onClick={() => setActiveTabId(craft.id)}
                className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all text-center ${
                  isSelectedTab
                    ? 'border-cyan-400 bg-cyan-950/60 shadow-[0_0_16px_rgba(34,211,238,0.35)]'
                    : 'border-slate-800 bg-slate-900/50 hover:bg-slate-850 hover:border-slate-700'
                }`}
              >
                <span className="font-bold text-sm text-slate-100">{craft.name}</span>
                <span className="text-[10px] mt-0.5 font-mono">
                  {isEquippedThis ? (
                    <span className="text-cyan-300 font-bold">使用中</span>
                  ) : isCraftUnlk ? (
                    <span className="text-slate-400">已就緒</span>
                  ) : (
                    <span className="text-amber-400">需通關 {craft.unlockClears} 次</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Fighter Detailed Hologram Card */}
        <div className="mt-3.5 flex-1 overflow-y-auto space-y-3 pr-1">
          <div className="rounded-xl border border-cyan-500/30 bg-[#070b18]/90 p-4 shadow-[inset_0_0_24px_rgba(34,211,238,0.06)]">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-display text-lg font-black text-slate-100">{activeCraft.name}</span>
                <p className="text-xs text-slate-300 mt-0.5">{activeCraft.blurb}</p>
              </div>
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center border shadow-inner"
                style={{
                  borderColor: `hsl(${activeCraft.hullHue}, 80%, 60%)`,
                  background: `hsla(${activeCraft.hullHue}, 80%, 20%, 0.4)`,
                  boxShadow: `0 0 16px hsla(${activeCraft.beamHue}, 90%, 60%, 0.4)`,
                }}
              >
                {/* SVG Silhouette representation */}
                <svg viewBox="0 0 40 40" className="w-8 h-8">
                  <polygon
                    points={
                      activeCraft.id === 'cannon'
                        ? '20,6 6,34 16,28 20,32 24,28 34,34'
                        : activeCraft.id === 'stitch'
                          ? '20,4 12,32 18,26 20,30 22,26 28,32'
                          : '20,6 8,32 17,26 20,30 23,26 32,32'
                    }
                    fill={`hsl(${activeCraft.hullHue}, 85%, 65%)`}
                    stroke="#ffffff"
                    strokeWidth="1.2"
                  />
                  <circle cx="20" cy="20" r={activeCraft.hitboxMult * 2.5} fill="#f472b6" />
                </svg>
              </div>
            </div>

            {/* Attack Pattern Specification */}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-mono">FIREPOWER // 基礎傷害</span>
                <span className="font-display text-sm font-bold text-cyan-200">
                  ×{activeCraft.damageMult.toFixed(2)} ({(activeCraft.damageMult * 100).toFixed(0)}%)
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  射速倍率：×{activeCraft.fireRateMult.toFixed(2)}
                </span>
              </div>

              <div className="rounded-lg bg-slate-900/80 p-2.5 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-mono">HITBOX // 判定尺寸</span>
                <span className="font-display text-sm font-bold text-fuchsia-300">
                  {(activeCraft.hitboxMult * 3.2).toFixed(1)} px ({activeCraft.hitboxMult < 1 ? '超微型' : '標準型'})
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  集中速度：×{activeCraft.focusSpeedMult.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Special Skill Showcase */}
            <div className="mt-2.5 rounded-lg bg-amber-950/30 p-2.5 border border-amber-500/40">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-200 font-display">
                  專屬特技「{activeCraft.special.name}」
                </span>
                <span className="font-mono text-[10px] text-amber-400">
                  冷卻 {activeCraft.special.cooldown}s / 持續 {activeCraft.special.duration}s
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-1">{activeCraft.special.blurb}</p>
            </div>

            {/* Historical Best */}
            {typeof craftBest === 'number' && (
              <div className="mt-2 flex items-center justify-between text-xs px-1 text-slate-400">
                <span>機體最佳分數</span>
                <span className="font-mono text-cyan-300 font-bold">{craftBest.toLocaleString('zh-Hant')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Action CTA */}
        <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            {!unlocked ? (
              <span className="text-amber-400 font-bold">需通關 {activeCraft.unlockClears} 次解鎖</span>
            ) : isEquipped ? (
              <span className="text-cyan-300 font-bold">當前已裝備出擊</span>
            ) : (
              '點擊按鈕更換出擊機體'
            )}
          </span>
          <button
            type="button"
            disabled={!unlocked || isEquipped}
            onClick={() => {
              if (unlocked) {
                onSelectCraft(activeCraft.id);
                onClose();
              }
            }}
            className="da-cta px-6 py-2.5 text-sm min-h-[42px]"
          >
            {isEquipped ? '已裝備' : unlocked ? '選擇此機體' : '未解鎖'}
          </button>
        </div>
      </div>
    </div>
  );
}

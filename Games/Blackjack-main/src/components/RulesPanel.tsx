import React from 'react';
import type { BlackjackSettings, GameRulesConfig } from '../utils/storage';

interface RulesPanelProps {
  settings: BlackjackSettings;
  disabled: boolean;
  onChange: (next: BlackjackSettings) => void;
  onClose: () => void;
}

function patchRules(
  settings: BlackjackSettings,
  patch: Partial<GameRulesConfig>,
): BlackjackSettings {
  return { ...settings, rules: { ...settings.rules, ...patch } };
}

export const RulesPanel: React.FC<RulesPanelProps> = ({
  settings,
  disabled,
  onChange,
  onClose,
}) => {
  const r = settings.rules;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3">
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-emerald-950 border border-white/15 shadow-2xl p-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black tracking-wider">規則與模式</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-lg bg-white/10 hover:bg-white/20 font-bold touch-manipulation"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        <fieldset disabled={disabled} className="space-y-3 disabled:opacity-50">
          <label className="block text-xs font-bold text-white/60 tracking-wider">
            莊家軟 17
            <select
              className="mt-1 w-full min-h-[44px] rounded-lg bg-black/40 border border-white/15 px-3 text-sm"
              value={r.dealerRule}
              onChange={e =>
                onChange(patchRules(settings, { dealerRule: e.target.value as 'H17' | 'S17' }))
              }
            >
              <option value="H17">H17（軟 17 要牌）</option>
              <option value="S17">S17（軟 17 停牌）</option>
            </select>
          </label>

          <label className="block text-xs font-bold text-white/60 tracking-wider">
            副數
            <select
              className="mt-1 w-full min-h-[44px] rounded-lg bg-black/40 border border-white/15 px-3 text-sm"
              value={r.deckCount}
              onChange={e =>
                onChange(patchRules(settings, { deckCount: Number(e.target.value) }))
              }
            >
              {[1, 2, 4, 6, 8].map(n => (
                <option key={n} value={n}>
                  {n} 副
                </option>
              ))}
            </select>
          </label>

          <label className="block text-xs font-bold text-white/60 tracking-wider">
            Blackjack 賠率
            <select
              className="mt-1 w-full min-h-[44px] rounded-lg bg-black/40 border border-white/15 px-3 text-sm"
              value={r.bjPayout}
              onChange={e =>
                onChange(
                  patchRules(settings, { bjPayout: e.target.value as '3:2' | '6:5' }),
                )
              }
            >
              <option value="3:2">3:2</option>
              <option value="6:5">6:5</option>
            </select>
          </label>

          <label className="block text-xs font-bold text-white/60 tracking-wider">
            最多分牌手数
            <select
              className="mt-1 w-full min-h-[44px] rounded-lg bg-black/40 border border-white/15 px-3 text-sm"
              value={r.maxSplitHands}
              onChange={e =>
                onChange(patchRules(settings, { maxSplitHands: Number(e.target.value) }))
              }
            >
              {[2, 3, 4].map(n => (
                <option key={n} value={n}>
                  {n} 手
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-3 min-h-[44px] text-sm font-bold">
            <input
              type="checkbox"
              className="w-5 h-5"
              checked={r.doubleAfterSplit}
              onChange={e =>
                onChange(patchRules(settings, { doubleAfterSplit: e.target.checked }))
              }
            />
            分牌後可加倍（DAS）
          </label>

          <label className="flex items-center gap-3 min-h-[44px] text-sm font-bold">
            <input
              type="checkbox"
              className="w-5 h-5"
              checked={r.resplitAces}
              onChange={e =>
                onChange(patchRules(settings, { resplitAces: e.target.checked }))
              }
            />
            允許再分 A
          </label>

          <label className="block text-xs font-bold text-white/60 tracking-wider">
            投降
            <select
              className="mt-1 w-full min-h-[44px] rounded-lg bg-black/40 border border-white/15 px-3 text-sm"
              value={r.surrender}
              onChange={e =>
                onChange(
                  patchRules(settings, {
                    surrender: e.target.value as 'early' | 'late' | 'none',
                  }),
                )
              }
            >
              <option value="early">提前投降（Early）</option>
              <option value="late">延遲投降（Late）</option>
              <option value="none">不開放</option>
            </select>
          </label>

          <label className="block text-xs font-bold text-white/60 tracking-wider">
            牌靴穿透（切牌位置）
            <input
              type="range"
              min={50}
              max={90}
              step={5}
              value={Math.round(r.penetration * 100)}
              onChange={e =>
                onChange(patchRules(settings, { penetration: Number(e.target.value) / 100 }))
              }
              className="mt-2 w-full"
            />
            <span className="text-white/80 text-sm">{Math.round(r.penetration * 100)}%</span>
          </label>
        </fieldset>

        <div className="mt-4 pt-3 border-t border-white/10 space-y-2">
          <label className="flex items-center gap-3 min-h-[44px] text-sm font-bold">
            <input
              type="checkbox"
              className="w-5 h-5"
              checked={settings.hintsEnabled}
              onChange={e => onChange({ ...settings, hintsEnabled: e.target.checked })}
            />
            允許基本策略提示
          </label>
          <label className="flex items-center gap-3 min-h-[44px] text-sm font-bold">
            <input
              type="checkbox"
              className="w-5 h-5"
              checked={settings.feedbackEnabled}
              onChange={e => onChange({ ...settings, feedbackEnabled: e.target.checked })}
            />
            局後對錯回饋
          </label>
          <label className="flex items-center gap-3 min-h-[44px] text-sm font-bold">
            <input
              type="checkbox"
              className="w-5 h-5"
              checked={settings.mode === 'counting'}
              onChange={e =>
                onChange({
                  ...settings,
                  mode: e.target.checked ? 'counting' : 'standard',
                  showCount: e.target.checked ? settings.showCount : false,
                })
              }
            />
            算牌練習模式（Hi-Lo）
          </label>
          {settings.mode === 'counting' && (
            <label className="flex items-center gap-3 min-h-[44px] text-sm font-bold pl-2">
              <input
                type="checkbox"
                className="w-5 h-5"
                checked={settings.showCount}
                onChange={e => onChange({ ...settings, showCount: e.target.checked })}
              />
              顯示 Running／True Count
            </label>
          )}
        </div>

        {disabled && (
          <p className="mt-3 text-xs text-amber-300/90">請在下注階段變更規則（會重建牌靴）。</p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black tracking-widest touch-manipulation"
        >
          完成
        </button>
      </div>
    </div>
  );
};

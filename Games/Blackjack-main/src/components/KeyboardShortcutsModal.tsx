import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

interface ShortcutRow {
  keyLabel: string;
  action: string;
  description: string;
}

const SHORTCUT_GROUPS: { title: string; rows: ShortcutRow[] }[] = [
  {
    title: '手牌操作（出牌階段）',
    rows: [
      { keyLabel: 'H', action: '要牌（Hit）', description: '向莊家多要一張牌' },
      { keyLabel: 'S', action: '停牌（Stand）', description: '結束本手行動，維持目前點數' },
      { keyLabel: 'D', action: '加倍（Double）', description: '加倍本手賭注並只再補一張牌' },
      { keyLabel: 'P', action: '分牌（Split）', description: '同點數拆分為兩手獨立手牌' },
      { keyLabel: 'R', action: '投降（Surrender）', description: '若規則允許，投降收回一半賭注' },
    ],
  },
  {
    title: '下注與發牌階段',
    rows: [
      { keyLabel: 'Space / Enter', action: '發牌／下一局', description: '主注滿額時發牌，局後按鍵進入下一局' },
      { keyLabel: '1 ~ 5', action: '快捷選籌碼', description: '直接投入對應面額籌碼' },
      { keyLabel: 'M', action: '下限（Min Bet）', description: '快速設置該桌最低門檻主注' },
      { keyLabel: 'C', action: '清除下注', description: '重置目前已放上的所有籌碼' },
      { keyLabel: 'Z', action: '復原（Undo）', description: '復原上一步籌碼下注' },
    ],
  },
  {
    title: '保險、均分與戰術輔助',
    rows: [
      { keyLabel: 'T 或 ?', action: '戰術提示', description: '顯示標準基本策略最佳決策' },
      { keyLabel: 'I / N', action: '保險 是／否', description: '莊家開 A 時快速選擇保險' },
      { keyLabel: 'Y / N', action: '均分 是／否', description: 'Blackjack 對 A 時選擇均分或對抗' },
      { keyLabel: 'K', action: '快速鍵說明', description: '隨時開啟或關閉本熱鍵面板' },
    ],
  },
];

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-emerald-950/95 border border-amber-400/30 shadow-2xl p-4 sm:p-5 text-white max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-amber-500/20 rounded-lg border border-amber-400/30">
              <Keyboard className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black tracking-wider text-amber-200">
                實體鍵盤戰術快速鍵
              </h2>
              <p className="text-[10px] sm:text-xs text-white/50">無需滑鼠點擊，豪客極速對決操作</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors touch-manipulation"
            aria-label="關閉"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto py-3 space-y-4 pr-1">
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.title} className="space-y-1.5">
              <div className="text-[11px] font-black uppercase tracking-widest text-amber-400/80">
                {group.title}
              </div>
              <div className="grid gap-1.5">
                {group.rows.map(row => (
                  <div
                    key={row.keyLabel}
                    className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-xl border border-white/5"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-xs sm:text-sm text-white/90">{row.action}</span>
                      <span className="text-[10px] text-white/40 hidden sm:inline truncate">
                        {row.description}
                      </span>
                    </div>
                    <kbd className="px-2 py-0.5 rounded bg-amber-400/15 border border-amber-400/40 text-amber-200 font-mono text-xs font-black shadow-sm shrink-0">
                      {row.keyLabel}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-white/10 flex justify-between items-center text-[10px] sm:text-xs text-white/40 shrink-0">
          <span>提示：點擊按鈕上的快捷鍵角標亦可直接操作</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-amber-950 font-black text-xs transition-all touch-manipulation"
          >
            我知道了
          </button>
        </div>
      </div>
    </div>
  );
};

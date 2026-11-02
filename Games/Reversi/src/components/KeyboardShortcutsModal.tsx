import type { ReactElement } from 'react';
import { Keyboard, X } from 'lucide-react';

export interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  action: string;
  description: string;
}

const SHORTCUT_GROUPS: { groupName: string; shortcuts: ShortcutItem[] }[] = [
  {
    groupName: '棋盤矩陣準星導航',
    shortcuts: [
      {
        keys: ['W', 'A', 'S', 'D'],
        action: '上下左右移動準星',
        description: '在 8×8 棋盤網格上游標巡航，隨時顯示目標座標與落子預覽',
      },
      {
        keys: ['↑', '←', '↓', '→'],
        action: '方向鍵導航',
        description: '標準方向鍵亦可自由導航準星',
      },
      {
        keys: ['Space', 'Enter'],
        action: '落子確認',
        description: '於當前準星所在合法格精準下子，啟動連鎖翻轉',
      },
    ],
  },
  {
    groupName: '戰術指令與輔助',
    shortcuts: [
      {
        keys: ['H'],
        action: '戰術提示',
        description: '請求高階引擎或精確解算器提供最佳手建議',
      },
      {
        keys: ['Z', 'U'],
        action: '悔棋步法',
        description: '回溯上一步（於謎題模式使用將影響評星）',
      },
      {
        keys: ['T'],
        action: '戰術透視開關',
        description: '切換即時翻子熱圖徽章、角地要塞與 C/X 禁著點標籤',
      },
      {
        keys: ['P'],
        action: 'Pass 放棄回合',
        description: '當無合法落子點時跳過當前回合',
      },
      {
        keys: ['?'],
        action: '快捷鍵指南',
        description: '開啟或關閉本鍵盤操作速查面板',
      },
    ],
  },
];

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps): ReactElement | null {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div className="bg-stone-900 border border-emerald-700/60 rounded-2xl max-w-lg w-full p-6 text-left shadow-2xl space-y-4">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-800 pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-emerald-400" />
            <h2 id="shortcuts-title" className="text-lg font-bold text-emerald-300">
              實體鍵盤矩陣操作指南
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-stone-400 hover:text-white bg-stone-800 hover:bg-stone-700 transition-colors"
            aria-label="關閉快捷鍵指南"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.groupName} className="space-y-2">
              <h3 className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                {group.groupName}
              </h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((sc) => (
                  <div
                    key={sc.action}
                    className="flex items-start justify-between gap-3 bg-stone-950/60 p-2 rounded-xl border border-stone-800"
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-medium text-stone-200">{sc.action}</p>
                      <p className="text-[11px] text-stone-400">{sc.description}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 mt-0.5">
                      {sc.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-2 py-1 text-xs font-mono font-bold bg-stone-800 border border-stone-600 rounded text-stone-100 shadow-sm"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition-colors"
          >
            了解並返回對局
          </button>
        </div>
      </div>
    </div>
  );
}

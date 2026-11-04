import React from 'react';
import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcuts = [
    {
      group: '手牌與牌疊操控',
      items: [
        {
          keys: ['1', '～', '8'],
          desc: '選取該列可移動牌串；已有選取時則移動至該列',
        },
        {
          keys: ['Q', 'W', 'E', 'R'],
          desc: '選取第 1～4 格暫存格；或將選取的卡牌移入暫存格',
        },
        {
          keys: ['Esc'],
          desc: '取消當前卡牌選取狀態',
        },
      ],
    },
    {
      group: '戰術核心指令',
      items: [
        {
          keys: ['A'],
          desc: '一鍵安全收牌（自動將符合安全法則的牌移至回收區）',
        },
        {
          keys: ['H'],
          desc: '大師提示（高亮最佳移動方案）',
        },
        {
          keys: ['Z', '/', 'U'],
          desc: '復原悔棋（退回上一步驟）',
        },
        {
          keys: ['T'],
          desc: '循環切換三大奢華工坊主題（古典宮廷綠絨 / 黑曜黑金 / 未來霓虹）',
        },
        {
          keys: ['M'],
          desc: '開啟或靜音真實物理滑牌、連鎖落牌與編鐘音效',
        },
        {
          keys: ['D'],
          desc: '同局重新發牌（相同局號重新佈局）',
        },
        {
          keys: ['N'],
          desc: '開啟全新牌局',
        },
        {
          keys: ['?'],
          desc: '開啟或關閉本快捷鍵指南',
        },
      ],
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="freecell-keyboard-title"
    >
      <div className="bg-white border border-stone-200 rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col text-stone-800">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-stone-900 text-white">
              <Keyboard size={20} />
            </div>
            <div>
              <h2 id="freecell-keyboard-title" className="text-xl font-serif font-bold text-stone-900">
                實體鍵盤極速操控指南
              </h2>
              <p className="text-xs text-stone-400">專為專業玩家與競技盲操打造</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-colors touch-manipulation"
            aria-label="關閉指南"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {shortcuts.map((sec) => (
            <section key={sec.group} className="space-y-3">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                {sec.group}
              </h3>
              <div className="space-y-2">
                {sec.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 border border-stone-100 gap-3"
                  >
                    <span className="text-xs text-stone-700 leading-snug">{item.desc}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, kIdx) =>
                        k === '～' || k === '/' ? (
                          <span key={kIdx} className="text-xs text-stone-400 font-medium">
                            {k}
                          </span>
                        ) : (
                          <kbd
                            key={kIdx}
                            className="px-2 py-1 min-w-[24px] text-center text-xs font-mono font-bold bg-white border border-stone-300 rounded shadow-[0_1px_1px_rgba(0,0,0,0.08)] text-stone-800"
                          >
                            {k}
                          </kbd>
                        ),
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <div className="rounded-xl bg-amber-50/80 border border-amber-200/80 p-3 text-xs text-amber-800">
            <strong>操作提示：</strong> 在頂端局號輸入框打字時，快捷鍵將自動暫停響應，以避免干擾文字輸入。
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-stone-100 flex justify-end bg-stone-50/50">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-6 py-2 bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-full transition-colors shadow-sm touch-manipulation"
          >
            了解
          </button>
        </div>
      </div>
    </div>
  );
};

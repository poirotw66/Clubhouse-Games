import { Keyboard, X } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

export function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  const shortcuts = [
    {
      keys: ['←', '→', 'A', 'D'],
      label: '切換選取手牌',
      desc: '在合法可出的手牌之間循環移動選取光標',
    },
    {
      keys: ['1', '2', '3', '4'],
      altKeys: ['L', 'R', 'U', 'D'],
      label: '選擇開放端點',
      desc: '依序對應 左端(1/L)、右端(2/R)、上端(3/U)、下端(4/D)',
    },
    {
      keys: ['Space', 'Enter'],
      label: '確認出牌',
      desc: '若僅有一端可接時，選取手牌後按 Enter/Space 即可直接出牌',
    },
    {
      keys: ['P', 'D'],
      label: '過牌 / 摸牌',
      desc: '無牌可出時，自動對應當前規則的抽牌或跳過回合',
    },
    {
      keys: ['H'],
      label: '戰術提示',
      desc: '由專家 AI 試算並標示當前局勢最佳落子位置',
    },
    {
      keys: ['Z', 'U'],
      label: '悔棋',
      desc: '撤銷上一步動作並回復至己方決策狀態',
    },
    {
      keys: ['M', 'Tab'],
      label: '切換情資面板',
      desc: '快速展開或收合左右戰情駕駛艙與骨牌矩陣',
    },
    {
      keys: ['?'],
      label: '快捷鍵說明',
      desc: '隨時叫出此鍵盤快捷鍵指南面板',
    },
  ];

  return (
    <div
      className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="domino-shortcuts-title"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 text-left shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-amber-400" />
            <h2 id="domino-shortcuts-title" className="text-base font-bold text-slate-100">
              實體鍵盤操作指南
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            aria-label="關閉快捷鍵說明"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1 text-xs">
          {shortcuts.map((sc, i) => (
            <div
              key={i}
              className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between gap-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-slate-200">{sc.label}</span>
                <span className="text-[11px] text-slate-400">{sc.desc}</span>
              </div>
              <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
                {sc.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-1 rounded bg-slate-800 border border-slate-600 font-mono text-[11px] font-bold text-amber-300 shadow-sm"
                  >
                    {k}
                  </kbd>
                ))}
                {sc.altKeys && (
                  <>
                    <span className="text-slate-500 text-[10px]">或</span>
                    {sc.altKeys.map((k) => (
                      <kbd
                        key={k}
                        className="px-2 py-1 rounded bg-slate-800 border border-slate-600 font-mono text-[11px] font-bold text-sky-300 shadow-sm"
                      >
                        {k}
                      </kbd>
                    ))}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition-colors touch-manipulation min-h-[44px]"
        >
          我知道了（Enter / Esc 關閉）
        </button>
      </div>
    </div>
  );
}

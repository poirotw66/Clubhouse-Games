import type { ReactElement } from 'react';

interface HotkeysCheatsheetModalProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: '1 – 6', action: '選擇塔種', desc: '1:十字弩 2:磨盤 3:冰霜 4:線圈 5:彈簧錘 6:迫擊砲' },
  { key: 'Space', action: '開始下一波／加壓', desc: '準備階段啟動波次；戰鬥階段強行加壓換取金幣' },
  { key: 'F', action: '發條超頻 (Overdrive)', desc: '壓力蓄滿 100% 時啟動：全塔攻速 +60%、得分 +50%（持續 8 秒）' },
  { key: 'W', action: '手動上發條', desc: '手動旋緊發條核心，快速蓄壓 +15%' },
  { key: 'U', action: '基礎升級', desc: '選取塔後按 U 直接進行 Lv.0 → Lv.1 基礎升級' },
  { key: 'A / B', action: '選擇進階分支', desc: '選取 Lv.1 塔時，直接選擇分支 A 或分支 B' },
  { key: 'S', action: '售出塔', desc: '退還選取塔已投入金幣的 70%' },
  { key: 'Z', action: '撤銷操作', desc: '撤銷準備階段尚未開始時的最後一次放置或升級' },
  { key: 'Tab / T', action: '切換遊戲倍速', desc: '在 1x、2x、3x 三檔倍速之間快速循環' },
  { key: 'Esc / P', action: '暫停／取消選取', desc: '暫停遊戲或取消目前選取的塔' },
];

export function HotkeysCheatsheetModal({ onClose }: HotkeysCheatsheetModalProps): ReactElement {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ck-hotkeys-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#1c1409] border border-amber-900/60 rounded-2xl p-5 shadow-2xl text-amber-50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4 border-b border-amber-900/50 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">⌨️</span>
              <h2 id="ck-hotkeys-title" className="text-xl font-bold text-amber-100">
                操作快捷鍵小抄
              </h2>
            </div>
            <p className="text-xs text-amber-200/70 mt-1">
              熟練運用快捷鍵可大幅提升臨場反應與布防速度。
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-lg hover:bg-white/10 text-amber-200/80 flex items-center justify-center text-lg"
            aria-label="關閉快捷鍵小抄"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2 text-xs">
          {SHORTCUTS.map((s) => (
            <div
              key={s.key}
              className="flex items-start justify-between gap-3 p-2 rounded-lg bg-black/30 border border-amber-900/30"
            >
              <div className="min-w-0">
                <p className="font-bold text-amber-200">{s.action}</p>
                <p className="text-amber-200/60 text-[11px] mt-0.5">{s.desc}</p>
              </div>
              <span className="shrink-0 font-mono font-bold text-amber-300 bg-amber-950/80 border border-amber-700/50 px-2 py-1 rounded">
                {s.key}
              </span>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 font-bold text-sm min-h-[44px]"
        >
          關閉
        </button>
      </div>
    </div>
  );
}

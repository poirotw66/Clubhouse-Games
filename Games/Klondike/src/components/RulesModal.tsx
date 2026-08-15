import React from 'react';
import { X } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RulesModal({ isOpen, onClose }: RulesModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="klondike-rules-title"
    >
      <div className="bg-emerald-950 border border-white/15 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col text-emerald-50">
        <div className="flex justify-between items-center p-6 border-b border-white/10">
          <h2 id="klondike-rules-title" className="text-2xl font-bold">遊戲規則</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] p-2 text-emerald-200/70 hover:text-white hover:bg-white/10 rounded-full transition-colors touch-manipulation"
            aria-label="關閉規則"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-8 text-sm sm:text-base text-emerald-100/90">
          <section>
            <h3 className="text-lg font-bold text-white mb-2">遊戲目標</h3>
            <p>
              將 52 張牌依 <strong>花色</strong> 從 A 到 K 依序搬到四個回收區（Foundation）；完成四疊即獲勝。
            </p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-white mb-2">區域說明</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>牌疊 (Tableau)</strong>：七列。發牌時每列只有最上面一張翻開，其餘蓋牌。
              </li>
              <li>
                <strong>牌堆／廢牌堆 (Stock / Waste)</strong>：從牌堆翻牌到廢牌堆；只有廢牌堆頂張可打出。
              </li>
              <li>
                <strong>回收區 (Foundations)</strong>：四個空位。必須從 A 開始，同花色依序 A→K。
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-white mb-2">移動規則</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>接牌</strong>：可把單張或「紅黑交替、點數遞減」的一串接到另一列頂張之下。
              </li>
              <li>
                <strong>空列</strong>：只有 <strong>K</strong>（或以 K 為首的一串）可放入空列。
              </li>
              <li>
                <strong>翻牌</strong>：可設為一次翻 1 張或 3 張；牌堆翻完後可再循環廢牌堆。
              </li>
              <li>
                <strong>翻開蓋牌</strong>：某列翻開的牌移走後，可翻開該列最上面的蓋牌。
              </li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-white mb-2">操作方式</h3>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>拖曳</strong>：拖牌到目標位置。
              </li>
              <li>
                <strong>點擊</strong>：點選來源，再點目標。
              </li>
              <li>
                <strong>雙擊</strong>：嘗試自動收進回收區。
              </li>
            </ul>
          </section>
        </div>

        <div className="p-6 border-t border-white/10 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-8 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-emerald-950 font-medium rounded-full transition-colors touch-manipulation"
          >
            了解
          </button>
        </div>
      </div>
    </div>
  );
}

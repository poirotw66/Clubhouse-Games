import React from 'react';
import { X } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RulesModal({ isOpen, onClose }: RulesModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-stone-200 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center p-6 border-b border-stone-100">
          <h2 className="text-2xl font-serif font-bold text-stone-900">遊戲規則 (How to Play)</h2>
          <button 
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto text-stone-600 space-y-8 text-sm sm:text-base">
          <section>
            <h3 className="text-lg font-bold text-stone-900 mb-2">遊戲目標</h3>
            <p>將 52 張牌依 <strong>花色</strong> 從 A 到 K 依序搬到右上角的四個回收區（Foundation）；完成四疊（黑桃、紅心、方塊、梅花各 A～K）即獲勝。</p>
          </section>

          <section>
            <h3 className="text-lg font-bold text-stone-900 mb-2">區域說明</h3>
            <ul className="list-disc pl-5 space-y-2 marker:text-stone-300">
              <li><strong>暫存格 (FreeCells)</strong>：左上角 4 個空格。每格可暫時放置 1 張牌。</li>
              <li><strong>回收區 (Foundations)</strong>：右上角 4 個空格。必須從 A 開始，同花色依序 A→2→...→K 疊放。</li>
              <li><strong>牌疊 (Tableau)</strong>：下方 8 列牌。只有每列 <strong>最上面一張</strong> 以及暫存格裡的牌可以移動。</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-stone-900 mb-2">移動規則</h3>
            <ul className="list-disc pl-5 space-y-2 marker:text-stone-300">
              <li><strong>接牌</strong>：可把單張牌接到另一列最上面，條件是：<strong>顏色相反且點數恰好多 1</strong>（例如紅 6 可接在黑 7 下）。</li>
              <li><strong>整串移動</strong>：若某列從頂張起形成「顏色交替且點數連續遞減」的一串，可整串一起移到另一列頂張之下。但移動的張數受暫存格與空列數量限制：<code className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-800 text-sm">(空暫存格數 + 1) × 2^空列數</code>。</li>
              <li><strong>空列</strong>：空列可放任意單張或符合規則的一串牌。</li>
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold text-stone-900 mb-2">操作方式</h3>
            <ul className="list-disc pl-5 space-y-2 marker:text-stone-300">
              <li><strong>拖曳 (Drag & Drop)</strong>：直接拖曳卡牌到目標位置。</li>
              <li><strong>點擊 (Click)</strong>：點擊選取卡牌，再點擊目標位置移動。</li>
              <li><strong>雙擊 (Double Click)</strong>：快速將卡牌移至回收區或空的暫存格。</li>
            </ul>
          </section>
        </div>
        
        <div className="p-6 border-t border-stone-100 flex justify-end bg-stone-50/50">
          <button 
            onClick={onClose}
            className="px-8 py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-medium rounded-full transition-colors shadow-sm"
          >
            了解 (Got it)
          </button>
        </div>
      </div>
    </div>
  );
}

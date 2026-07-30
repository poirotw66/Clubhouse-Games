import React from 'react';
import {WIN_SCORE} from '../utils/gameLogic';

interface RulesModalProps {
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({onClose}) => {
  return (
    <div
      className="fixed inset-0 bg-indigo-deep/90 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="wafu-modal rounded-2xl p-6 sm:p-8 max-w-lg w-full max-h-[85vh] overflow-y-auto relative"
        onClick={e => e.stopPropagation()}
      >
        <div className="corner-ornament corner-ornament-tl" />
        <div className="corner-ornament corner-ornament-tr" />
        <div className="corner-ornament corner-ornament-bl" />
        <div className="corner-ornament corner-ornament-br" />

        <h2 className="font-display text-2xl font-bold text-gold mb-4">遊戲規則</h2>

        <section className="mb-4 text-sm text-cream/80 space-y-2">
          <h3 className="font-display text-gold text-base">基本流程</h3>
          <p>每回合從手牌選一張與場上同月份配對，再從山札翻一張。配對的牌收入己方的「獲得牌」。</p>
          <p>組成新役時可喊 <strong className="text-vermillion-light">Koi-Koi</strong> 繼續衝更高分，或 <strong className="text-gold">勝負</strong> 結算本局分數。</p>
          <p>對手曾喊 Koi-Koi 時，你結算分數 ×2；反之亦然。</p>
        </section>

        <section className="mb-4 text-sm text-cream/80 space-y-2">
          <h3 className="font-display text-gold text-base">整場勝負</h3>
          <p>先累積 <strong className="text-gold">{WIN_SCORE} 分</strong> 者獲勝。流局時莊家得 1 分親權。</p>
        </section>

        <section className="mb-6 text-sm text-cream/80">
          <h3 className="font-display text-gold text-base mb-2">主要役</h3>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <li>五光 — 10 分</li>
            <li>四光 — 8 分</li>
            <li>雨四光 — 7 分</li>
            <li>三光 — 5 分</li>
            <li>豬鹿蝶 — 5 分</li>
            <li>赤短 / 青短 — 5 分</li>
            <li>月見酒 / 花見酒 — 5 分</li>
            <li>種 / 短冊 / 菓子 — 5 張起 1 分+</li>
          </ul>
        </section>

        <button onClick={onClose} className="wafu-btn-gold w-full py-3 rounded-xl">
          關閉
        </button>
      </div>
    </div>
  );
};

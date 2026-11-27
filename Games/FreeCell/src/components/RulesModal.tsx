import React from 'react';
import { JuiceSettingsPanel } from '@clubhouse/shared/JuiceSettings';
import { OriginLoreModal } from '@clubhouse/shared/OriginLoreModal';
import { FREECELL_LORE } from '@clubhouse/shared/lore/cardsBoard';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'origin' | 'rules';
}

export function RulesModal({ isOpen, onClose, initialTab = 'origin' }: RulesModalProps) {
  if (!isOpen) return null;

  return (
    <OriginLoreModal
      dossier={FREECELL_LORE}
      onClose={onClose}
      initialTab={initialTab}
      extraTab={{
        id: 'settings',
        label: '規則速查與手感設定',
        content: (
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5 space-y-2">
              <h3 className="text-base font-bold text-amber-300">遊戲目標</h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                將 52 張牌依 <strong className="text-white">花色</strong> 從 A 到 K
                依序搬到右上角的四個回收區；完成四疊（黑桃、紅心、方塊、梅花各 A～K）即獲勝。
              </p>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5 space-y-2">
              <h3 className="text-base font-bold text-amber-300">區域說明</h3>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-300">
                <li>
                  <strong className="text-slate-100">暫存格</strong>：左上角空格。預設 4 格；「2 格」模式僅開放兩個（其餘鎖定）。
                </li>
                <li>
                  <strong className="text-slate-100">回收區</strong>：右上角 4 個空格。必須從 A 開始，同花色依序 A→2→...→K 疊放。
                </li>
                <li>
                  <strong className="text-slate-100">牌疊</strong>：下方 8 列牌。只有每列 <strong className="text-slate-100">最上面一張</strong> 以及暫存格裡的牌可以移動。
                </li>
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5 space-y-2">
              <h3 className="text-base font-bold text-amber-300">移動與計分規則</h3>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-300">
                <li>
                  <strong className="text-slate-100">接牌</strong>：顏色相反且點數恰好多 1（例如紅 6 可接在黑 7 下）。
                </li>
                <li>
                  <strong className="text-slate-100">整串移動上限</strong>：{' '}
                  <code className="bg-slate-800 px-1.5 py-0.5 rounded text-amber-200 text-xs">
                    (空暫存格數 + 1) × 2^空列數
                  </code>
                </li>
                <li>
                  <strong className="text-slate-100">計分</strong>：每張上回收區 +10；每次復原 −5；通關依與標準步（Par）及時間差結算。
                </li>
                <li>
                  <strong className="text-slate-100">操作</strong>：支援拖曳、點擊選取、雙擊快移，以及鍵盤 1–8 / Q-R / A / H / Z / T / M。
                </li>
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5">
              <h3 className="text-base font-bold text-amber-300 mb-2">打擊感與手感回饋（Juice）</h3>
              <JuiceSettingsPanel className="text-slate-200" />
            </section>
          </div>
        ),
      }}
    />
  );
}

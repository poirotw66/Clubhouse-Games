import React from 'react';
import { JuiceSettingsPanel } from '@clubhouse/shared/JuiceSettings';
import { OriginLoreModal } from '@clubhouse/shared/OriginLoreModal';
import { KLONDIKE_LORE } from '@clubhouse/shared/lore/cardsBoard';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'origin' | 'rules';
}

export function RulesModal({ isOpen, onClose, initialTab = 'origin' }: RulesModalProps) {
  if (!isOpen) return null;

  return (
    <OriginLoreModal
      dossier={KLONDIKE_LORE}
      onClose={onClose}
      initialTab={initialTab}
      extraTab={{
        id: 'settings',
        label: '規則速查與手感設定',
        content: (
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5 space-y-2">
              <h3 className="text-base font-bold text-emerald-300">遊戲目標與區域</h3>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-300">
                <li>
                  將 52 張牌依 <strong className="text-white">花色</strong> 從 A 到 K 依序搬到四個回收區（Foundation）。
                </li>
                <li>
                  <strong className="text-slate-100">牌疊 (Tableau)</strong>：七列，開局每列僅頂張翻開；需「紅黑交替、點數遞減」接龍，空列僅限放入 <strong className="text-slate-100">K</strong> 或以 K 為首的牌串。
                </li>
                <li>
                  <strong className="text-slate-100">牌堆／廢牌堆 (Stock / Waste)</strong>：一次翻 1 或 3 張，僅廢牌堆頂張可用。
                </li>
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5 space-y-2">
              <h3 className="text-base font-bold text-emerald-300">計分與挑戰模式</h3>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-300">
                <li>
                  <strong className="text-slate-100">標準</strong>：上回收區 +10、翻蓋牌 +5、廢牌接牌 +5、拿回 −15、悔棋 −2、循環牌堆翻 1 扣 100／翻 3 扣 20、每 10 秒 −2。
                </li>
                <li>
                  <strong className="text-slate-100">維加斯</strong>：開局 −52，每張上回收區 +5；翻 1 限一輪、翻 3 限三輪。
                </li>
                <li>
                  <strong className="text-slate-100">可解局與每日</strong>：Solver 篩選保證可解發牌；每日挑戰依台北時間同步發牌與計算連勝。
                </li>
              </ul>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5">
              <h3 className="text-base font-bold text-emerald-300 mb-2">打擊感與手感回饋（Juice）</h3>
              <JuiceSettingsPanel className="text-slate-200" />
            </section>
          </div>
        ),
      }}
    />
  );
}

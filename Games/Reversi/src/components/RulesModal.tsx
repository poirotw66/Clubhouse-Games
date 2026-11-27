import type { ReactElement } from 'react';
import { JuiceSettingsPanel } from '@clubhouse/shared/JuiceSettings';
import { OriginLoreModal } from '@clubhouse/shared/OriginLoreModal';
import { REVERSI_LORE } from '@clubhouse/shared/lore/cardsBoard';

interface RulesModalProps {
  onClose: () => void;
  initialTab?: 'origin' | 'rules';
}

export function RulesModal({ onClose, initialTab = 'origin' }: RulesModalProps): ReactElement {
  return (
    <OriginLoreModal
      dossier={REVERSI_LORE}
      onClose={onClose}
      initialTab={initialTab}
      extraTab={{
        id: 'settings',
        label: '規則速查與手感設定',
        content: (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5">
              <h3 className="text-base font-bold text-emerald-300 mb-2">核心規則速查</h3>
              <ul className="text-xs sm:text-sm text-slate-300 space-y-2 list-disc pl-4">
                <li>8×8 棋盤，黑方先手。開局中央 2×2 為兩黑兩白（斜線相對）。</li>
                <li>輪到的一方在空格下子，新子須與己方另一子「夾住」至少一條線上的對方子，並將該線上被夾住的對方子全部翻成己色。</li>
                <li>同一手可同時在多條直線上翻子；至少須翻轉 1 枚才算合法。</li>
                <li>無合法手時須 Pass，改由對方下；若雙方都無合法手則終局，子多者勝。</li>
                <li>角地、機動、奇偶是中盤與殘局的核心概念——詳見主選單「戰略要點」與本圖鑑決策心法。</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5">
              <h3 className="text-base font-bold text-emerald-300 mb-2">手感反饋與特效設定</h3>
              <JuiceSettingsPanel className="text-slate-200" />
            </div>
          </div>
        ),
      }}
    />
  );
}

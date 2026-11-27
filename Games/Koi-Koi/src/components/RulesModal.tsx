import React from 'react';
import { JuiceSettingsPanel } from '@clubhouse/shared/JuiceSettings';
import { OriginLoreModal } from '@clubhouse/shared/OriginLoreModal';
import { KOI_KOI_LORE } from '@clubhouse/shared/originLoreData';

interface RulesModalProps {
  onClose: () => void;
  winScore: number;
}

export const RulesModal: React.FC<RulesModalProps> = ({ onClose, winScore }) => {
  return (
    <OriginLoreModal
      dossier={KOI_KOI_LORE}
      onClose={onClose}
      extraTab={{
        id: 'settings',
        label: '局況與手感設定',
        content: (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5">
              <h3 className="text-base font-bold text-amber-300 mb-2">當前對局目標</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                本場勝負目標：先累積 <strong className="text-amber-400 font-bold">{winScore} 分</strong> 者獲勝。流局時莊家得 1 分親權。
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5">
              <h3 className="text-base font-bold text-amber-300 mb-2">七文倍額與倍率規則</h3>
              <p className="text-sm text-slate-300 leading-relaxed mb-2">
                單局役種總分達 <strong className="text-amber-400 font-bold">7 分以上</strong> 時，結算得分自動翻倍（×2）。
              </p>
              <p className="text-xs text-slate-400 leading-relaxed">
                若對手喊過 Koi-Koi 繼續後被截胡，再乘 2 倍（最高可達 4 倍以上疊加）。
              </p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/75 p-4 sm:p-5">
              <h3 className="text-base font-bold text-amber-300 mb-2">手感反饋與特效偏好</h3>
              <JuiceSettingsPanel className="text-cream" />
            </div>
          </div>
        ),
      }}
    />
  );
};

import React from 'react';
import { X, Check, Lock } from 'lucide-react';
import {
  BOTTLE_SKINS,
  LIQUID_SKINS,
  unlockBottleSkin,
  unlockLiquidSkin,
  equipBottleSkin,
  equipLiquidSkin,
  type CosmeticsState,
} from '../services/cosmeticsService';
import type { BottleSkinId, LiquidSkinId } from '../types';

interface CosmeticsShopProps {
  isOpen: boolean;
  onClose: () => void;
  coins: number;
  cosmetics: CosmeticsState;
  onCosmeticsChange: (next: CosmeticsState, coins: number) => void;
}

export const CosmeticsShop: React.FC<CosmeticsShopProps> = ({
  isOpen,
  onClose,
  coins,
  cosmetics,
  onCosmeticsChange,
}) => {
  if (!isOpen) return null;

  const buyOrEquipBottle = (id: BottleSkinId) => {
    if (cosmetics.unlockedBottles.includes(id)) {
      onCosmeticsChange(equipBottleSkin(cosmetics, id), coins);
      return;
    }
    const result = unlockBottleSkin(cosmetics, id, coins);
    if (result.ok) onCosmeticsChange(result.state, result.coins);
  };

  const buyOrEquipLiquid = (id: LiquidSkinId) => {
    if (cosmetics.unlockedLiquids.includes(id)) {
      onCosmeticsChange(equipLiquidSkin(cosmetics, id), coins);
      return;
    }
    const result = unlockLiquidSkin(cosmetics, id, coins);
    if (result.ok) onCosmeticsChange(result.state, result.coins);
  };

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-3 md:px-4 safe-top safe-bottom">
      <div className="w-full max-w-md bg-[#2d2d44] border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
        <div className="p-4 md:p-5 bg-gradient-to-r from-teal-700 to-cyan-800 flex justify-between items-center flex-shrink-0">
          <div>
            <h2 className="text-lg md:text-xl font-black text-white">外觀商店</h2>
            <p className="text-cyan-100/80 text-xs mt-0.5">用代幣解鎖瓶子／液體造型</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="touch-target w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white/70"
            aria-label="關閉"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-5 overflow-y-auto flex-1">
          <p className="text-white/70 text-sm">持有代幣：<span className="text-yellow-300 font-bold tabular-nums">{coins}</span></p>

          <section>
            <h3 className="text-white font-bold text-sm mb-2">瓶子外觀</h3>
            <div className="space-y-2">
              {BOTTLE_SKINS.map((skin) => {
                const unlocked = cosmetics.unlockedBottles.includes(skin.id);
                const equipped = cosmetics.equippedBottle === skin.id;
                return (
                  <button
                    key={skin.id}
                    type="button"
                    onClick={() => buyOrEquipBottle(skin.id)}
                    className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 border text-left min-h-[44px] ${
                      equipped
                        ? 'bg-cyan-500/25 border-cyan-400/50'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div>
                      <div className="text-white font-bold text-sm">{skin.name}</div>
                      <div className="text-white/50 text-[11px]">{skin.blurb}</div>
                    </div>
                    <div className="text-xs font-bold text-white/80 flex items-center gap-1">
                      {equipped ? (
                        <><Check size={14} /> 使用中</>
                      ) : unlocked ? (
                        '裝備'
                      ) : (
                        <><Lock size={12} /> {skin.cost}</>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-white font-bold text-sm mb-2">液體外觀</h3>
            <div className="space-y-2">
              {LIQUID_SKINS.map((skin) => {
                const unlocked = cosmetics.unlockedLiquids.includes(skin.id);
                const equipped = cosmetics.equippedLiquid === skin.id;
                return (
                  <button
                    key={skin.id}
                    type="button"
                    onClick={() => buyOrEquipLiquid(skin.id)}
                    className={`w-full flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 border text-left min-h-[44px] ${
                      equipped
                        ? 'bg-cyan-500/25 border-cyan-400/50'
                        : 'bg-white/5 border-white/10'
                    }`}
                  >
                    <div>
                      <div className="text-white font-bold text-sm">{skin.name}</div>
                      <div className="text-white/50 text-[11px]">{skin.blurb}</div>
                    </div>
                    <div className="text-xs font-bold text-white/80 flex items-center gap-1">
                      {equipped ? (
                        <><Check size={14} /> 使用中</>
                      ) : unlocked ? (
                        '裝備'
                      ) : (
                        <><Lock size={12} /> {skin.cost}</>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { Crosshair, Scale, ShieldAlert, Sparkles, X } from 'lucide-react';
import type { TacticalRadarState } from '../utils/tacticalRadar';
import type { OpponentPersonality } from '../utils/personalities';
import type { AnimalCharacter } from '../characters';
import { TacticalRadarLeftWing } from './TacticalRadarLeftWing';
import { TacticalRadarRightWing } from './TacticalRadarRightWing';

interface Props {
  radar: TacticalRadarState;
  opponent: AnimalCharacter;
  personality: OpponentPersonality;
  botHandCount: number;
  className?: string;
}

export const TacticalMobileBrief: React.FC<Props> = ({
  radar,
  opponent,
  personality,
  botHandCount,
  className = '',
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'radar' | 'risk'>('radar');

  // Find most critical player status for the ticker
  const topTenpai = radar.yakuRadarList.find(y => y.status === 'tenpai');
  const topOneAway = radar.yakuRadarList.find(y => y.status === 'one_away');
  const briefPlayerStatus = topTenpai
    ? `⚡ ${topTenpai.name} 聽牌！`
    : topOneAway
      ? `🎯 ${topOneAway.name} 差 2 張`
      : radar.completedCount > 0
        ? `✓ 已成 ${radar.completedCount} 役`
        : '進行中';

  const threat = radar.opponentThreat;
  const isHighDanger = threat.level === 'high' || threat.level === 'critical';

  return (
    <>
      {/* Brief Bar */}
      <div
        className={`w-full max-w-4xl wafu-panel rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 text-xs border-gold/30 shadow-md ${className}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('radar');
              setModalOpen(true);
            }}
            className="flex items-center gap-1.5 hover:text-gold transition-colors text-left truncate"
            title="點擊查看役種進聽雷達"
          >
            <div className="w-5 h-5 rounded bg-gold/15 text-gold flex items-center justify-center shrink-0">
              <Crosshair size={12} />
            </div>
            <span className="font-display font-semibold text-cream truncate">
              {briefPlayerStatus}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setActiveTab('risk');
              setModalOpen(true);
            }}
            className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold transition-transform active:scale-95 ${
              isHighDanger
                ? 'bg-vermillion text-cream border-vermillion animate-pulse shadow-sm'
                : 'bg-black/30 text-cream/80 border-gold/20 hover:text-gold'
            }`}
            title="點擊查看對手威脅與博弈天秤"
          >
            {isHighDanger ? <ShieldAlert size={12} /> : <Scale size={12} />}
            <span>對手：{threat.levelLabel.split('（')[0]}</span>
          </button>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="wafu-btn-gold px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 min-h-[32px] flex items-center gap-1"
          >
            <Sparkles size={11} />
            <span>戰術雷達</span>
          </button>
        </div>
      </div>

      {/* Full Modal Drawer for Mobile & Compact screens */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tactical-cockpit-modal-title"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="wafu-modal rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden relative shadow-2xl border-gold/60"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-3.5 border-b border-gold/25 flex items-center justify-between bg-black/30">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gold/20 border border-gold/40 flex items-center justify-center text-gold">
                  <Crosshair size={18} />
                </div>
                <div>
                  <h2
                    id="tactical-cockpit-modal-title"
                    className="font-display text-base font-bold text-gold"
                  >
                    和風戰術座艙 (Tactical Cockpit)
                  </h2>
                  <p className="text-[10px] text-cream/60">實時殘牌透視 · 博弈期望值精算</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-cream/60 hover:text-gold hover:bg-gold/10 transition-colors"
                aria-label="關閉戰術座艙"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="grid grid-cols-2 p-2 bg-black/40 gap-1.5 border-b border-gold/15 text-xs text-center font-display font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('radar')}
                className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === 'radar'
                    ? 'bg-gold/20 text-gold border border-gold/40 shadow-sm'
                    : 'text-cream/60 hover:text-cream'
                }`}
              >
                <Crosshair size={14} />
                <span>左翼 · 役種進聽雷達</span>
                {radar.tenpaiCount > 0 && (
                  <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-vermillion text-cream font-bold">
                    {radar.tenpaiCount}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('risk')}
                className={`py-2 rounded-xl flex items-center justify-center gap-1.5 transition-colors ${
                  activeTab === 'risk'
                    ? 'bg-gold/20 text-gold border border-gold/40 shadow-sm'
                    : 'text-cream/60 hover:text-cream'
                }`}
              >
                <Scale size={14} />
                <span>右翼 · 博弈天秤與情報</span>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-3 sm:p-4 overflow-y-auto flex-1">
              {activeTab === 'radar' ? (
                <TacticalRadarLeftWing
                  radar={radar}
                  collapsed={false}
                  onToggleCollapse={() => {}}
                  className="w-full !max-w-none !border-none !shadow-none !bg-transparent p-0"
                />
              ) : (
                <TacticalRadarRightWing
                  radar={radar}
                  collapsed={false}
                  onToggleCollapse={() => {}}
                  opponent={opponent}
                  personality={personality}
                  botHandCount={botHandCount}
                  className="w-full !max-w-none !border-none !shadow-none !bg-transparent p-0"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

import React, { useState } from 'react';
import type { Card, MatchState } from '../game/types';
import type {
  GrandmasterWisdom,
  KeyCardInfo,
  MomentumMetrics,
  OpponentThreatProfile,
  ScoreLeverage,
  TableProjectionOption,
} from '../game/tactics';
import { TacticalLeftWing } from './TacticalLeftWing';
import { TacticalRightWing } from './TacticalRightWing';

interface Props {
  leverage: ScoreLeverage;
  radar: KeyCardInfo[];
  projections: TableProjectionOption[];
  threats: OpponentThreatProfile[];
  wisdom: GrandmasterWisdom;
  match: MatchState | null;
  selectedCard: Card | null;
  onSelectHandCard: (card: Card) => void;
  onTargetClick?: (card: Card) => void;
  momentum?: MomentumMetrics | null;
}

export function TacticalMobileTicker({
  leverage,
  radar,
  projections,
  threats,
  wisdom,
  match,
  selectedCard,
  onSelectHandCard,
  onTargetClick,
  momentum,
}: Props): React.ReactElement {
  const [activeDrawer, setActiveDrawer] = useState<'left' | 'right' | null>(null);

  const tableCardsCount = radar.filter((r) => r.location === 'on_table').length;
  const dangerCardsCount = leverage.dangerCardsOnTable;

  return (
    <div className="w-full lg:hidden flex flex-col gap-2">
      {/* 行動端戰術速報條 */}
      <div className="flex items-center justify-between gap-1.5 px-3 py-2 rounded-xl bg-slate-900/90 border border-emerald-500/20 text-xs">
        <div className="flex items-center gap-1.5 truncate">
          <span
            className={`font-black px-1.5 py-0.5 rounded text-[10px] ${
              leverage.margin >= 0
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                : 'bg-amber-950 text-amber-300 border border-amber-500/40'
            }`}
          >
            {leverage.margin >= 0 ? `+${leverage.margin.toFixed(0)}分達標` : `差${Math.abs(leverage.margin).toFixed(0)}分`}
          </span>

          {dangerCardsCount > 0 ? (
            <span className="text-rose-400 font-black text-[11px] truncate flex items-center gap-1 animate-pulse">
              👑 池有天王牌 ({dangerCardsCount}張)
            </span>
          ) : tableCardsCount > 0 ? (
            <span className="text-amber-300 font-bold text-[11px] truncate">
              🎯 池有 {tableCardsCount} 張大分
            </span>
          ) : (
            <span className="text-slate-400 text-[11px] truncate">
              {wisdom.title}
            </span>
          )}

          {momentum && (
            <span className="hidden sm:inline-block font-mono text-[10px] text-emerald-300/80 bg-emerald-950/60 px-1.5 py-0.5 rounded">
              勝率 {momentum.winProbability}%
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setActiveDrawer('left')}
            className="px-2 py-1 rounded-lg bg-emerald-500/15 border border-emerald-500/40 hover:bg-emerald-500/25 text-[11px] font-bold text-emerald-200 touch-manipulation"
          >
            📊 牌情雷達
          </button>
          <button
            type="button"
            onClick={() => setActiveDrawer('right')}
            className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 text-[11px] font-bold text-slate-200 touch-manipulation"
          >
            🕵️ 對手戰情
          </button>
        </div>
      </div>

      {/* 彈出式 Drawer 底部半屏面板 */}
      {activeDrawer && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/70 backdrop-blur-sm pr-review-panel"
          onClick={() => setActiveDrawer(null)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full max-h-[85vh] overflow-y-auto bg-slate-950 border-t-2 border-emerald-400/50 rounded-t-3xl p-4 flex flex-col gap-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="font-black text-sm text-emerald-100">
                {activeDrawer === 'left' ? '📊 勝勢天秤與牌情雷達' : '🕵️ 對手戰情與大師錦囊'}
              </h3>
              <button
                type="button"
                onClick={() => setActiveDrawer(null)}
                className="w-8 h-8 rounded-full bg-slate-800 text-slate-300 font-bold text-sm flex items-center justify-center hover:bg-slate-700"
              >
                ✕
              </button>
            </div>

            {activeDrawer === 'left' ? (
              <TacticalLeftWing
                leverage={leverage}
                radar={radar}
                projections={projections}
                selectedCard={selectedCard}
                onSelectHandCard={(card) => {
                  onSelectHandCard(card);
                  setActiveDrawer(null);
                }}
                onTargetClick={(card) => {
                  if (onTargetClick) {
                    onTargetClick(card);
                    setActiveDrawer(null);
                  }
                }}
                isMobileDrawer={true}
                momentum={momentum}
              />
            ) : (
              <TacticalRightWing
                threats={threats}
                wisdom={wisdom}
                match={match}
                isMobileDrawer={true}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

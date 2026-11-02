import React, { useState } from 'react';
import { Crosshair, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import type { TacticalRadarState, YakuRadarItem, CardLocation } from '../utils/tacticalRadar';
import { getCardImageUrl } from '../cardImages';

interface Props {
  radar: TacticalRadarState;
  collapsed: boolean;
  onToggleCollapse: () => void;
  className?: string;
}

const LOCATION_CONFIG: Record<
  CardLocation,
  { label: string; dotClass: string; borderClass: string; bgClass: string }
> = {
  captured_by_player: {
    label: '我方已得',
    dotClass: 'bg-emerald-400',
    borderClass: 'border-emerald-400/80',
    bgClass: 'bg-emerald-950/40',
  },
  in_player_hand: {
    label: '我方手牌',
    dotClass: 'bg-sky-400',
    borderClass: 'border-sky-400/80',
    bgClass: 'bg-sky-950/40',
  },
  on_field: {
    label: '場上可取',
    dotClass: 'bg-amber-400 animate-pulse',
    borderClass: 'border-amber-400',
    bgClass: 'bg-amber-950/40',
  },
  captured_by_bot: {
    label: '對手截獲',
    dotClass: 'bg-rose-500',
    borderClass: 'border-rose-500/80 opacity-60',
    bgClass: 'bg-rose-950/40',
  },
  unseen: {
    label: '山札/對手',
    dotClass: 'bg-cream/40',
    borderClass: 'border-cream/25 opacity-75',
    bgClass: 'bg-indigo-950/30',
  },
};

export const TacticalRadarLeftWing: React.FC<Props> = ({
  radar,
  collapsed,
  onToggleCollapse,
  className = '',
}) => {
  const [filter, setFilter] = useState<'focus' | 'all' | 'completed'>('focus');

  const filteredItems = radar.yakuRadarList.filter(item => {
    if (filter === 'completed') return item.status === 'completed';
    if (filter === 'focus') {
      return (
        item.status === 'tenpai' ||
        item.status === 'one_away' ||
        item.status === 'completed'
      );
    }
    return true;
  });

  if (collapsed) {
    return (
      <aside
        className={`wafu-panel rounded-2xl p-2 flex flex-col items-center gap-3 select-none transition-all duration-200 border-gold/40 shadow-xl ${className}`}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center text-gold/80 hover:text-gold hover:bg-gold/10 rounded-xl transition-colors touch-manipulation"
          title="展開左翼役種雷達"
          aria-label="展開左翼役種雷達"
        >
          <ChevronRight size={18} />
          <Crosshair size={16} className="mt-1" />
        </button>
        <div className="[writing-mode:vertical-rl] text-xs font-display text-gold tracking-widest py-2">
          役種雷達
        </div>
        {radar.tenpaiCount > 0 && (
          <span
            className="px-1.5 py-0.5 rounded-full text-[10px] bg-vermillion text-cream font-bold animate-pulse"
            title={`聽牌 ${radar.tenpaiCount} 組`}
          >
            {radar.tenpaiCount}
          </span>
        )}
      </aside>
    );
  }

  return (
    <aside
      className={`wafu-panel rounded-2xl p-3.5 flex flex-col select-none border-gold/40 shadow-2xl transition-all duration-200 overflow-hidden ${className}`}
      style={{ minWidth: '280px', maxWidth: '340px' }}
      aria-label="役種進聽即時雷達"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-gold/20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gold/15 border border-gold/40 flex items-center justify-center text-gold">
            <Crosshair size={16} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-display text-sm font-bold text-gold tracking-wide">
                役種進聽雷達
              </h2>
              {radar.tenpaiCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-vermillion/90 text-cream font-bold shadow-sm">
                  聽牌 ×{radar.tenpaiCount}
                </span>
              )}
            </div>
            <p className="text-[10px] text-cream/55">實時殘牌透視與進聽追蹤</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="text-cream/50 hover:text-gold p-1.5 rounded-lg hover:bg-gold/10 transition-colors touch-manipulation"
          title="收合左翼"
          aria-label="收合左翼"
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="grid grid-cols-3 gap-1 bg-black/30 p-1 rounded-lg mb-2.5 text-xs text-center">
        <button
          type="button"
          onClick={() => setFilter('focus')}
          className={`py-1 rounded-md transition-colors ${
            filter === 'focus'
              ? 'bg-gold/25 text-gold font-semibold shadow-xs'
              : 'text-cream/60 hover:text-cream'
          }`}
        >
          焦點（{radar.tenpaiCount + radar.oneAwayCount + radar.completedCount}）
        </button>
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`py-1 rounded-md transition-colors ${
            filter === 'all'
              ? 'bg-gold/25 text-gold font-semibold shadow-xs'
              : 'text-cream/60 hover:text-cream'
          }`}
        >
          全部（{radar.yakuRadarList.length}）
        </button>
        <button
          type="button"
          onClick={() => setFilter('completed')}
          className={`py-1 rounded-md transition-colors ${
            filter === 'completed'
              ? 'bg-gold/25 text-gold font-semibold shadow-xs'
              : 'text-cream/60 hover:text-cream'
          }`}
        >
          已成（{radar.completedCount}）
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between px-1 py-1 text-[10px] text-cream/50 mb-2 border-b border-gold/10">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> 已得
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" /> 手牌
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse inline-block" /> 場上
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" /> 對手
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cream/40 inline-block" /> 未現
        </span>
      </div>

      {/* Yaku Items List */}
      <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] pr-1">
        {filteredItems.length === 0 ? (
          <div className="text-center py-8 text-xs text-cream/40">
            {filter === 'completed' ? '本局尚未組成役' : '暫無焦點役種，請切換至「全部」檢視'}
          </div>
        ) : (
          filteredItems.map(item => (
            <YakuRadarCard key={item.id} item={item} />
          ))
        )}
      </div>
    </aside>
  );
};

const YakuRadarCard: React.FC<{ item: YakuRadarItem }> = ({ item }) => {
  const isTenpai = item.status === 'tenpai';
  const isCompleted = item.status === 'completed';
  const isBlocked = item.status === 'blocked';

  return (
    <div
      className={`rounded-xl border p-2.5 transition-all text-xs ${
        isCompleted
          ? 'border-gold/70 bg-gold/10 shadow-sm'
          : isTenpai
            ? 'border-vermillion-light bg-vermillion/15 shadow-md ring-1 ring-vermillion/40'
            : isBlocked
              ? 'border-cream/15 bg-black/20 opacity-60'
              : 'border-gold/25 bg-black/25'
      }`}
    >
      {/* Top row: Name, points, badge */}
      <div className="flex items-center justify-between gap-1 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="font-display font-bold text-cream/95 text-[13px] truncate">
            {item.name}
          </span>
          <span className="text-[10px] font-semibold text-gold shrink-0">
            {item.points} 分
          </span>
        </div>
        <span
          className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${
            isCompleted
              ? 'bg-gold/25 text-gold border border-gold/40'
              : isTenpai
                ? 'bg-vermillion text-cream font-bold animate-pulse'
                : isBlocked
                  ? 'bg-black/40 text-cream/40 border border-cream/20'
                  : 'bg-indigo-900/50 text-cream/70 border border-gold/20'
          }`}
        >
          {item.statusLabel}
        </span>
      </div>

      {/* Block reason if blocked */}
      {item.blockReason && (
        <p className="text-[10px] text-rose-300/80 mb-1.5 leading-tight">
          ✕ {item.blockReason}
        </p>
      )}

      {/* Cards list / preview */}
      <div className="flex flex-wrap gap-1 mt-1">
        {item.cards.map(ci => {
          const cfg = LOCATION_CONFIG[ci.location];
          return (
            <div
              key={ci.card.id}
              className={`relative rounded border p-0.5 flex items-center gap-1 min-w-[70px] ${cfg.borderClass} ${cfg.bgClass}`}
              title={`${ci.card.month}月 ${ci.card.name}（${cfg.label}）`}
            >
              <div className="w-5 h-7 rounded-[2px] overflow-hidden bg-washi shrink-0 border border-lacquer/50">
                <img
                  src={getCardImageUrl(ci.card.id)}
                  alt={ci.card.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="min-w-0 flex-1 pr-1">
                <p className="text-[9px] font-display text-cream/90 truncate leading-tight">
                  {ci.card.name.replace(/^[0-9]+月\s*/, '')}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dotClass}`} />
                  <span className="text-[8px] text-cream/60 leading-none truncate">
                    {cfg.label}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

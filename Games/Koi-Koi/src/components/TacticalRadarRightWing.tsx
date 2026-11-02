import React from 'react';
import { Scale, ChevronRight, ChevronLeft, ShieldAlert, Sparkles, Flame, User } from 'lucide-react';
import type { TacticalRadarState, ThreatLevel, KoiKoiRecommendation } from '../utils/tacticalRadar';
import type { OpponentPersonality } from '../utils/personalities';
import type { AnimalCharacter } from '../characters';

interface Props {
  radar: TacticalRadarState;
  collapsed: boolean;
  onToggleCollapse: () => void;
  opponent: AnimalCharacter;
  personality: OpponentPersonality;
  botHandCount: number;
  className?: string;
}

const THREAT_STYLE: Record<
  ThreatLevel,
  { barColor: string; badgeClass: string; textColor: string }
> = {
  low: {
    barColor: 'bg-emerald-400',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    textColor: 'text-emerald-400',
  },
  medium: {
    barColor: 'bg-amber-400',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    textColor: 'text-amber-400',
  },
  high: {
    barColor: 'bg-orange-500',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40 animate-pulse',
    textColor: 'text-orange-400',
  },
  critical: {
    barColor: 'bg-vermillion',
    badgeClass: 'bg-vermillion text-cream font-bold animate-pulse shadow-md',
    textColor: 'text-vermillion-light',
  },
};

const RECOMMEND_STYLE: Record<
  KoiKoiRecommendation,
  { badgeClass: string; icon: React.ReactNode }
> = {
  call_koi_koi: {
    badgeClass: 'bg-gradient-to-r from-vermillion to-gold text-cream font-bold shadow-md ring-1 ring-gold/60',
    icon: <Flame size={14} className="text-gold animate-bounce" />,
  },
  take_points: {
    badgeClass: 'bg-emerald-700/80 text-cream font-bold border border-emerald-400 shadow-sm',
    icon: <Sparkles size={14} className="text-emerald-300" />,
  },
  balanced: {
    badgeClass: 'bg-amber-600/80 text-cream font-semibold border border-amber-400 shadow-sm',
    icon: <Scale size={14} className="text-amber-200" />,
  },
};

export const TacticalRadarRightWing: React.FC<Props> = ({
  radar,
  collapsed,
  onToggleCollapse,
  opponent,
  personality,
  botHandCount,
  className = '',
}) => {
  const threat = radar.opponentThreat;
  const risk = radar.koiKoiRisk;
  const threatCfg = THREAT_STYLE[threat.level];
  const recCfg = RECOMMEND_STYLE[risk.recommendation];

  if (collapsed) {
    return (
      <aside
        className={`wafu-panel rounded-2xl p-2 flex flex-col items-center gap-3 select-none transition-all duration-200 border-gold/40 shadow-xl ${className}`}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          className="min-h-[44px] min-w-[44px] flex flex-col items-center justify-center text-gold/80 hover:text-gold hover:bg-gold/10 rounded-xl transition-colors touch-manipulation"
          title="展開右翼博弈天秤"
          aria-label="展開右翼博弈天秤"
        >
          <ChevronLeft size={18} />
          <Scale size={16} className="mt-1" />
        </button>
        <div className="[writing-mode:vertical-rl] text-xs font-display text-gold tracking-widest py-2">
          博弈天秤
        </div>
        <span
          className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${threatCfg.badgeClass}`}
          title={`威脅指數：${threat.score}%`}
        >
          {threat.score}%
        </span>
      </aside>
    );
  }

  return (
    <aside
      className={`wafu-panel rounded-2xl p-3.5 flex flex-col select-none border-gold/40 shadow-2xl transition-all duration-200 overflow-hidden ${className}`}
      style={{ minWidth: '280px', maxWidth: '340px' }}
      aria-label="對手威脅推論與博弈天秤"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-gold/20">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="text-cream/50 hover:text-gold p-1.5 rounded-lg hover:bg-gold/10 transition-colors touch-manipulation"
          title="收合右翼"
          aria-label="收合右翼"
        >
          <ChevronRight size={16} />
        </button>
        <div className="flex items-center gap-2 text-right">
          <div>
            <h2 className="font-display text-sm font-bold text-gold tracking-wide">
              博弈天秤與情報
            </h2>
            <p className="text-[10px] text-cream/55">對手手牌威脅與勝率精算</p>
          </div>
          <div className="w-7 h-7 rounded-lg bg-gold/15 border border-gold/40 flex items-center justify-center text-gold">
            <Scale size={16} />
          </div>
        </div>
      </div>

      <div className="space-y-3 overflow-y-auto max-h-[calc(100vh-280px)] pr-1 text-xs">
        {/* Opponent Threat Section */}
        <section className="rounded-xl border border-gold/25 bg-black/30 p-2.5">
          <div className="flex items-center justify-between gap-1 mb-2">
            <div className="flex items-center gap-1.5 text-gold font-semibold">
              <ShieldAlert size={14} />
              <span>對手成役威脅</span>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded border ${threatCfg.badgeClass}`}>
              {threat.levelLabel}
            </span>
          </div>

          {/* Threat Meter Bar */}
          <div className="w-full bg-black/60 rounded-full h-2 overflow-hidden mb-2 border border-gold/15">
            <div
              className={`h-full transition-all duration-300 ${threatCfg.barColor}`}
              style={{ width: `${threat.score}%` }}
            />
          </div>

          {/* Opponent Progress Metrics */}
          <div className="grid grid-cols-2 gap-1.5 mb-2 text-[11px]">
            <div className="bg-black/30 rounded p-1.5 border border-gold/10 flex items-center justify-between">
              <span className="text-cream/70">粕牌</span>
              <span className={`font-semibold ${threat.kasuProgress.current >= 9 ? 'text-vermillion-light' : 'text-cream'}`}>
                {threat.kasuProgress.current} / {threat.kasuProgress.target}
              </span>
            </div>
            <div className="bg-black/30 rounded p-1.5 border border-gold/10 flex items-center justify-between">
              <span className="text-cream/70">短冊</span>
              <span className={`font-semibold ${threat.tanzakuProgress.current >= 4 ? 'text-vermillion-light' : 'text-cream'}`}>
                {threat.tanzakuProgress.current} / {threat.tanzakuProgress.target}
              </span>
            </div>
            <div className="bg-black/30 rounded p-1.5 border border-gold/10 flex items-center justify-between">
              <span className="text-cream/70">種牌</span>
              <span className={`font-semibold ${threat.taneProgress.current >= 4 ? 'text-vermillion-light' : 'text-cream'}`}>
                {threat.taneProgress.current} / {threat.taneProgress.target}
              </span>
            </div>
            <div className="bg-black/30 rounded p-1.5 border border-gold/10 flex items-center justify-between">
              <span className="text-cream/70">光牌</span>
              <span className={`font-semibold ${threat.hikariProgress.current >= 2 ? 'text-gold' : 'text-cream'}`}>
                {threat.hikariProgress.current} / {threat.hikariProgress.target}
              </span>
            </div>
          </div>

          {/* Warning Messages */}
          <div className="space-y-1">
            {threat.warningMessages.map((msg, idx) => (
              <div
                key={idx}
                className="text-[10px] text-cream/80 bg-gold/5 rounded px-2 py-1 border-l-2 border-gold/50 leading-tight"
              >
                {msg}
              </div>
            ))}
          </div>
        </section>

        {/* Koi-Koi Risk & EV Scale Section */}
        <section className="rounded-xl border border-gold/30 bg-gradient-to-br from-indigo-950/60 to-black/40 p-2.5">
          <div className="flex items-center justify-between gap-1 mb-2">
            <span className="text-gold font-semibold flex items-center gap-1.5">
              <Scale size={14} />
              來來（Koi-Koi）博弈天秤
            </span>
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] ${recCfg.badgeClass}`}>
              {recCfg.icon}
              <span>{risk.recommendationLabel}</span>
            </div>
          </div>

          <p className="text-[11px] text-cream/90 leading-relaxed bg-black/30 p-2 rounded-lg border border-gold/15 mb-2">
            {risk.advice}
          </p>

          <div className="flex items-center justify-between text-[10px] text-cream/60 px-1">
            <span>加碼潛力：{risk.canExpandYaku ? '高（具可追役）' : '低（宜落袋）'}</span>
            <span className="text-vermillion-light">逆轉代價：失分 ×2</span>
          </div>
        </section>

        {/* Opponent Intel Section */}
        <section className="rounded-xl border border-gold/15 bg-black/20 p-2.5">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-5 h-5 rounded-full bg-gold/20 flex items-center justify-center text-gold">
              <User size={12} />
            </div>
            <span className="font-semibold text-cream/80 text-[11px]">
              對手情資：{opponent.name}
            </span>
          </div>
          <div className="text-[10px] text-cream/60 space-y-0.5">
            <p>風格特徵：{personality.styleTag}</p>
            <p>剩餘手牌：{botHandCount} 張</p>
          </div>
        </section>
      </div>
    </aside>
  );
};

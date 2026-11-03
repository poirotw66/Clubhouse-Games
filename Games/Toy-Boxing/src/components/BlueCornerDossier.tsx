import React from 'react';
import { Award, Compass, Lightbulb, Shield, Swords, Target } from 'lucide-react';
import type { MasterCoachHint, TacticalOpponentIntel } from '../telemetry';

interface BlueCornerDossierProps {
  intel: TacticalOpponentIntel;
  coachHint: MasterCoachHint;
  leagueCount: number;
  totalOpponents: number;
  playMode: 'free' | 'league';
}

export const BlueCornerDossier: React.FC<BlueCornerDossierProps> = ({
  intel,
  coachHint,
  leagueCount,
  totalOpponents,
  playMode,
}) => {
  const getCoachToneStyle = (tone: MasterCoachHint['tone']) => {
    switch (tone) {
      case 'danger':
        return 'border-rose-500/60 bg-rose-950/40 text-rose-200 shadow-[0_0_12px_rgba(244,63,94,0.25)]';
      case 'opportunity':
        return 'border-amber-400/60 bg-amber-950/40 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.25)] animate-pulse';
      case 'warning':
        return 'border-orange-400/50 bg-orange-950/30 text-orange-200';
      case 'info':
      default:
        return 'border-blue-500/30 bg-blue-950/30 text-blue-100';
    }
  };

  return (
    <aside
      className="flex flex-col gap-3 rounded-2xl border border-blue-500/20 bg-neutral-950/80 p-3.5 shadow-xl backdrop-blur-md"
      aria-label="藍角對手戰力檔案"
    >
      {/* Wing Header */}
      <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
          <h3 className="text-xs font-black uppercase tracking-widest text-blue-400">
            藍角情報檔案 · 戰術雷達
          </h3>
        </div>
        <span className="rounded bg-blue-950/60 px-1.5 py-0.5 font-mono text-[9px] font-bold text-blue-300 border border-blue-800/50">
          BLUE WING
        </span>
      </div>

      {/* Opponent Identity & Style Badge */}
      <div className="rounded-xl border border-white/5 bg-neutral-900/90 p-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-black text-white">{intel.name}</span>
          <span className="rounded-md border border-blue-400/30 bg-blue-950/50 px-2 py-0.5 text-[10px] font-bold text-blue-300">
            {intel.styleBadge}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-400">
          {intel.styleDescription}
        </p>

        {/* Tactical Radar Stat Bars */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-[10px]">
          <div>
            <div className="flex justify-between text-neutral-400 mb-0.5">
              <span>侵略壓迫</span>
              <span className="font-mono text-neutral-300 font-bold">{intel.radarStats.aggression}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-rose-500 rounded-full"
                style={{ width: `${intel.radarStats.aggression}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-neutral-400 mb-0.5">
              <span>防禦格擋</span>
              <span className="font-mono text-neutral-300 font-bold">{intel.radarStats.defense}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${intel.radarStats.defense}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-neutral-400 mb-0.5">
              <span>步法速度</span>
              <span className="font-mono text-neutral-300 font-bold">{intel.radarStats.speed}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full"
                style={{ width: `${intel.radarStats.speed}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-neutral-400 mb-0.5">
              <span>拳質威力</span>
              <span className="font-mono text-neutral-300 font-bold">{intel.radarStats.power}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full"
                style={{ width: `${intel.radarStats.power}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Signature Telegraph & Countermeasure Warning */}
      <div className="rounded-xl border border-white/5 bg-neutral-900/80 p-2.5">
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-300 mb-1">
          <Target className="w-3.5 h-3.5 text-amber-400" />
          <span>對手招牌必殺預警</span>
        </div>
        <div className="rounded-lg bg-neutral-950/70 p-2 border border-white/5 text-[11px]">
          <div className="flex items-center justify-between font-bold text-neutral-200">
            <span>{intel.signatureName}</span>
            <span className="text-[10px] text-fuchsia-300 font-normal">{intel.signatureBlurb}</span>
          </div>
          <div className="mt-1 flex flex-col gap-0.5 text-[10px] text-neutral-400">
            <span>預備起手：<strong className="text-neutral-300">{intel.signatureTelegraph}</strong></span>
            <span>破招解法：<strong className="text-amber-300">{intel.signatureCounterMeasure}</strong></span>
          </div>
        </div>
      </div>

      {/* Ring Master Mastermind Coaching Tip */}
      <div className={`rounded-xl border p-2.5 transition-all ${getCoachToneStyle(coachHint.tone)}`}>
        <div className="flex items-center justify-between mb-1">
          <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-wider uppercase">
            <Lightbulb className="w-3.5 h-3.5" />
            拳王大師錦囊
          </span>
          <span className="rounded bg-black/40 px-1.5 py-0.5 text-[9px] font-bold">
            {coachHint.badge}
          </span>
        </div>
        <p className="text-[11px] leading-relaxed font-medium">
          {coachHint.text}
        </p>
      </div>

      {/* League Progress or Belt Prestige */}
      <div className="rounded-xl border border-white/5 bg-neutral-900/80 p-2.5 text-[10px]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 font-bold text-neutral-300">
            <Award className="w-3.5 h-3.5 text-amber-400" />
            {playMode === 'league' ? '聯賽金腰帶天梯' : '自由對戰擂台'}
          </span>
          <span className="font-mono font-bold text-amber-400">
            {playMode === 'league' ? `第 ${leagueCount + 1}/${totalOpponents} 關` : '自由賽程'}
          </span>
        </div>
        <div className="mt-1.5 flex gap-1">
          {Array.from({ length: totalOpponents }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i < leagueCount
                  ? 'bg-amber-400'
                  : i === leagueCount
                    ? 'bg-amber-400/40 animate-pulse'
                    : 'bg-neutral-800'
              }`}
            />
          ))}
        </div>
      </div>
    </aside>
  );
};

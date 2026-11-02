/**
 * Right Cockpit Wing: Opponent Dossier, Defense Alignment, Base Threat Matrix & Tactical Playbook.
 */

import React from 'react';
import { Shield, Users, Crosshair, MapPin, Zap, Flame, Footprints } from 'lucide-react';
import type { DefenseAlignment } from '../fielding.ts';
import type { PitcherProfile } from '../pitching.ts';
import type { ParkFactors } from '../teams.ts';

interface DossierWingProps {
  pitcherProfile: PitcherProfile | null;
  defenseAlignment: DefenseAlignment;
  bases: [boolean, boolean, boolean];
  outs: number;
  strikes: number;
  balls: number;
  parkFenceDist: number;
  parkGapMul: number;
  parkName?: string;
  isBunting: boolean;
  onToggleBunt: () => void;
  canBunt: boolean;
  stealAttempt: boolean;
  onTriggerSteal: () => void;
  canSteal: boolean;
  isPlayerBatting: boolean;
}

export function DossierWing({
  pitcherProfile,
  defenseAlignment,
  bases,
  outs,
  strikes,
  balls,
  parkFenceDist,
  parkGapMul,
  parkName,
  isBunting,
  onToggleBunt,
  canBunt,
  stealAttempt,
  onTriggerSteal,
  canSteal,
  isPlayerBatting,
}: DossierWingProps): React.ReactElement {
  const hasRisp = bases[1] || bases[2]; // Runners in Scoring Position (2nd or 3rd base)
  const anyRunner = bases[0] || bases[1] || bases[2];

  const alignmentLabel: Record<DefenseAlignment, string> = {
    normal: '常規防守佈陣',
    pull: '拉打防堵佈陣 (Pull Shift)',
    deep: '外野深遠警戒 (Deep Guard)',
  };

  const alignmentTip: Record<DefenseAlignment, string> = {
    normal: '各守位均勻分佈，注意穿越一二壘空檔。',
    pull: '內野往強邊移動，反方向推打容易形成長打！',
    deep: '外野後退防堵長打，前方淺平飛球形成安打率大增。',
  };

  return (
    <aside className="w-full lg:w-72 flex flex-col gap-3 bg-zinc-900/90 border border-white/10 rounded-3xl p-3.5 shadow-xl text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold tracking-wider text-amber-300">戰略情資儀 · DUGOUT</h3>
        </div>
        <span className="text-[10px] bg-amber-950/60 text-amber-400 font-mono px-2 py-0.5 rounded-full border border-amber-800/40">
          INTEL
        </span>
      </div>

      {/* Opponent Pitcher Dossier */}
      <div className="bg-zinc-950/70 rounded-2xl p-3 border border-white/5 flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-bold">
            <Users className="w-3.5 h-3.5 text-blue-400" />
            <span>對手投手檔案</span>
          </div>
          <span className="text-[10px] text-zinc-400 font-mono">
            {pitcherProfile?.style === 'power'
              ? '速球火球派'
              : pitcherProfile?.style === 'finesse'
                ? '精準控球派'
                : pitcherProfile?.style === 'trickster'
                  ? '刁鑽變化型'
                  : '平均穩定型'}
          </span>
        </div>

        <div className="flex items-center gap-2.5 mt-1">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-amber-700 flex items-center justify-center font-bold text-sm text-white shadow-md border border-white/10">
            {pitcherProfile ? pitcherProfile.name[0] : '投'}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-zinc-100 truncate">
              {pitcherProfile ? pitcherProfile.name : '客場王牌投手'}
            </span>
            <span className="text-[10px] text-amber-300/90 font-medium leading-tight">
              {pitcherProfile?.habit ?? '配球重視好球帶邊角，兩好球後擅長引誘揮棒。'}
            </span>
          </div>
        </div>
      </div>

      {/* Tactical Playbook Commands (Bunt & Steal) */}
      <div className="bg-zinc-950/70 rounded-2xl p-3 border border-white/5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-bold">
            <Crosshair className="w-3.5 h-3.5 text-rose-400" />
            <span>戰術指揮所 (Tactics)</span>
          </div>
          <span className="text-[9px] text-zinc-500 font-mono">鍵盤 [B] / [S]</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          {/* Bunt Button */}
          <button
            type="button"
            disabled={!canBunt}
            onClick={onToggleBunt}
            className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all touch-manipulation min-h-[48px] ${
              !canBunt
                ? 'bg-zinc-900/40 border-white/5 text-zinc-600 cursor-not-allowed'
                : isBunting
                  ? 'bg-amber-500/25 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(251,191,36,0.3)] ring-1 ring-amber-400'
                  : 'bg-zinc-800/80 border-white/10 text-zinc-300 hover:border-amber-400/40 hover:text-amber-100'
            }`}
          >
            <div className="flex items-center gap-1">
              <Zap className={`w-3.5 h-3.5 ${isBunting ? 'text-amber-400 animate-pulse' : 'text-zinc-400'}`} />
              <span className="text-xs font-bold">觸擊短打</span>
            </div>
            <span className="text-[9px] font-mono text-zinc-400">
              {isBunting ? '已架棒 [B 取消]' : '點擊架棒 [B]'}
            </span>
          </button>

          {/* Steal Button */}
          <button
            type="button"
            disabled={!canSteal}
            onClick={onTriggerSteal}
            className={`p-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all touch-manipulation min-h-[48px] ${
              !canSteal
                ? 'bg-zinc-900/40 border-white/5 text-zinc-600 cursor-not-allowed'
                : stealAttempt
                  ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400 animate-pulse'
                  : 'bg-zinc-800/80 border-white/10 text-zinc-300 hover:border-emerald-400/40 hover:text-emerald-100'
            }`}
          >
            <div className="flex items-center gap-1">
              <Footprints className={`w-3.5 h-3.5 ${stealAttempt ? 'text-emerald-400' : 'text-zinc-400'}`} />
              <span className="text-xs font-bold">戰術盜壘</span>
            </div>
            <span className="text-[9px] font-mono text-zinc-400">
              {stealAttempt ? '起跑中！[S]' : canSteal ? '發動起跑 [S]' : '需有一二壘跑者'}
            </span>
          </button>
        </div>

        {/* Tactical status hint */}
        <p className="text-[10px] text-zinc-400 leading-tight">
          {isBunting
            ? '短打模式：球棒已擺平，碰球將轉為內野滾地球掩護推進。'
            : stealAttempt
              ? '跑者將在投手啟動時衝刺！慢速變化球盜壘成功率更高。'
              : hasRisp
                ? '得點圈有跑者！可藉由短打推進或抓準時機盜壘。'
                : '適時運用戰術推進壘包，提高得分期望值。'}
        </p>
      </div>

      {/* Defense Alignment & Base Threat Matrix */}
      <div className="bg-zinc-950/70 rounded-2xl p-3 border border-white/5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-bold">
            <Flame className="w-3.5 h-3.5 text-orange-400" />
            <span>守備陣型與得點圈動能</span>
          </div>
          {hasRisp && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse">
              RISP 得點圈
            </span>
          )}
        </div>

        <div className="bg-zinc-900/80 p-2 rounded-xl border border-white/5 flex flex-col gap-1">
          <span className="text-xs font-bold text-amber-300">
            {alignmentLabel[defenseAlignment]}
          </span>
          <span className="text-[10px] text-zinc-400 leading-relaxed">
            {alignmentTip[defenseAlignment]}
          </span>
        </div>

        {/* Bases Matrix Details */}
        <div className="grid grid-cols-3 gap-1 text-center font-mono text-[10px]">
          <div className={`p-1.5 rounded-lg border ${bases[2] ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}>
            三壘 {bases[2] ? '● 佔壘' : '○ 空'}
          </div>
          <div className={`p-1.5 rounded-lg border ${bases[1] ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}>
            二壘 {bases[1] ? '● 佔壘' : '○ 空'}
          </div>
          <div className={`p-1.5 rounded-lg border ${bases[0] ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold' : 'bg-zinc-900 border-white/5 text-zinc-500'}`}>
            一壘 {bases[0] ? '● 佔壘' : '○ 空'}
          </div>
        </div>
      </div>

      {/* Ballpark Factors */}
      <div className="bg-zinc-950/70 rounded-2xl p-2.5 border border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-emerald-400" />
          <span>{parkName ?? '玩具棒球場'}</span>
        </div>
        <div className="flex gap-2 font-mono text-[10px]">
          <span>全壘打牆：<strong className="text-zinc-200">{parkFenceDist}px</strong></span>
          <span>空檔：<strong className="text-zinc-200">{parkGapMul}x</strong></span>
        </div>
      </div>
    </aside>
  );
}

/**
 * Tactical HUD bar: Keyboard shortcuts guide, mobile quick strip, and collapsible cockpit drawers.
 */

import React, { useState } from 'react';
import { Activity, Shield, X, Zap, Footprints } from 'lucide-react';
import type { HitTelemetry, PitchTelemetry, StrikeZonePitch } from '../telemetry.ts';
import type { DefenseAlignment } from '../fielding.ts';
import type { PitcherProfile, PitchType } from '../pitching.ts';
import { TelemetryWing } from './TelemetryWing.tsx';
import { DossierWing } from './DossierWing.tsx';

interface TacticalHudBarProps {
  isPlayerBatting: boolean;
  pitchTelemetry: PitchTelemetry | null;
  hitTelemetry: HitTelemetry | null;
  strikeZonePitches: StrikeZonePitch[];
  currentPitch: StrikeZonePitch | null;
  activePitchType: PitchType | null;
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
}

export function TacticalHudBar(props: TacticalHudBarProps): React.ReactElement {
  const [mobileDrawer, setMobileDrawer] = useState<'telemetry' | 'dossier' | null>(null);

  const hasRisp = props.bases[1] || props.bases[2];

  return (
    <div className="w-full flex flex-col gap-2">
      {/* Desktop Keyboard HUD */}
      <div className="hidden lg:flex items-center justify-between bg-zinc-900/90 border border-white/10 rounded-2xl px-5 py-2.5 text-xs text-zinc-300 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono text-[11px] border border-white/10 font-bold">
              Space
            </kbd>
            <span>{props.isPlayerBatting ? '揮棒擊球' : '選定進壘點'}</span>
          </div>
          <div className="w-px h-3.5 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <kbd className="bg-zinc-800 px-2 py-0.5 rounded font-mono text-[11px] border border-white/10 font-bold">
              ← →
            </kbd>
            <span>{props.isPlayerBatting ? '拉打 / 推打空檔' : '出手後微調控球'}</span>
          </div>
          <div className="w-px h-3.5 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <kbd className={`px-2 py-0.5 rounded font-mono text-[11px] border font-bold ${
              props.isBunting ? 'bg-amber-500/30 border-amber-400 text-amber-200' : 'bg-zinc-800 border-white/10'
            }`}>
              B
            </kbd>
            <span className={props.isBunting ? 'text-amber-300 font-bold' : ''}>
              {props.isBunting ? '已架棒短打' : '觸擊短打'}
            </span>
          </div>
          <div className="w-px h-3.5 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <kbd className={`px-2 py-0.5 rounded font-mono text-[11px] border font-bold ${
              props.stealAttempt ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200' : 'bg-zinc-800 border-white/10'
            }`}>
              S
            </kbd>
            <span className={props.stealAttempt ? 'text-emerald-300 font-bold' : ''}>
              {props.stealAttempt ? '跑者衝刺盜壘中' : '戰術盜壘'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] font-mono">
          {hasRisp && (
            <span className="bg-red-500/20 text-red-300 px-2 py-0.5 rounded-full border border-red-500/30 animate-pulse font-bold">
              ● RISP 得點圈機會
            </span>
          )}
          {props.hitTelemetry && (
            <span className="text-zinc-400">
              初速：<strong className="text-emerald-400">{props.hitTelemetry.exitVeloKmh} km/h</strong> | 仰角：
              <strong className="text-yellow-400">{props.hitTelemetry.launchAngleDeg}°</strong>
            </span>
          )}
        </div>
      </div>

      {/* Mobile Tactical Quick Bar (Visible only on < lg screens) */}
      <div className="flex lg:hidden items-center justify-between bg-zinc-900/95 border border-white/10 rounded-2xl p-2 px-3 gap-2">
        <div className="flex items-center gap-2 overflow-x-auto min-w-0">
          <button
            type="button"
            onClick={() => setMobileDrawer('telemetry')}
            className="flex items-center gap-1.5 bg-cyan-950/60 border border-cyan-800/50 text-cyan-200 px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0 min-h-[40px] touch-manipulation"
          >
            <Activity className="w-3.5 h-3.5 text-cyan-400" />
            <span>遙測儀</span>
            {props.pitchTelemetry && (
              <span className="font-mono text-[10px] text-cyan-300 ml-1">
                {props.pitchTelemetry.speedKmh}k
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileDrawer('dossier')}
            className="flex items-center gap-1.5 bg-amber-950/60 border border-amber-800/50 text-amber-200 px-2.5 py-1.5 rounded-xl text-xs font-bold shrink-0 min-h-[40px] touch-manipulation"
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>戰略情資</span>
            {hasRisp && (
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </button>
        </div>

        {/* Mobile quick action buttons for Bunt and Steal */}
        {props.isPlayerBatting && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              disabled={!props.canBunt}
              onClick={props.onToggleBunt}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all min-h-[40px] touch-manipulation ${
                !props.canBunt
                  ? 'bg-zinc-900/40 border-white/5 text-zinc-600'
                  : props.isBunting
                    ? 'bg-amber-500/30 border-amber-400 text-amber-200'
                    : 'bg-zinc-800 border-white/10 text-zinc-300'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>{props.isBunting ? '短打中' : '短打'}</span>
            </button>

            <button
              type="button"
              disabled={!props.canSteal}
              onClick={props.onTriggerSteal}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all min-h-[40px] touch-manipulation ${
                !props.canSteal
                  ? 'bg-zinc-900/40 border-white/5 text-zinc-600'
                  : props.stealAttempt
                    ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200'
                    : 'bg-zinc-800 border-white/10 text-zinc-300'
              }`}
            >
              <Footprints className="w-3.5 h-3.5 text-emerald-400" />
              <span>{props.stealAttempt ? '盜壘中' : '盜壘'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Mobile Drawer Modal */}
      {mobileDrawer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm lg:hidden">
          <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-zinc-950 border border-white/15 rounded-3xl p-4 shadow-2xl flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-bold text-zinc-300 tracking-wider">
                {mobileDrawer === 'telemetry' ? '戰術遙測儀 · STATCAST' : '戰略情資儀 · DUGOUT'}
              </span>
              <button
                type="button"
                onClick={() => setMobileDrawer(null)}
                className="w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {mobileDrawer === 'telemetry' ? (
              <TelemetryWing
                pitchTelemetry={props.pitchTelemetry}
                hitTelemetry={props.hitTelemetry}
                strikeZonePitches={props.strikeZonePitches}
                currentPitch={props.currentPitch}
                activePitchType={props.activePitchType}
                isPlayerBatting={props.isPlayerBatting}
              />
            ) : (
              <DossierWing
                pitcherProfile={props.pitcherProfile}
                defenseAlignment={props.defenseAlignment}
                bases={props.bases}
                outs={props.outs}
                strikes={props.strikes}
                balls={props.balls}
                parkFenceDist={props.parkFenceDist}
                parkGapMul={props.parkGapMul}
                parkName={props.parkName}
                isBunting={props.isBunting}
                onToggleBunt={props.onToggleBunt}
                canBunt={props.canBunt}
                stealAttempt={props.stealAttempt}
                onTriggerSteal={props.onTriggerSteal}
                canSteal={props.canSteal}
                isPlayerBatting={props.isPlayerBatting}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

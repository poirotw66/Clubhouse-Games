/**
 * Left Cockpit Wing: Tactical Pitch Telemetry, 3x3 Strike Zone Heatmap & StatCast Analytics.
 */

import React from 'react';
import { Activity, Gauge, Sparkles, Compass } from 'lucide-react';
import { PITCH_DEFS, type PitchType } from '../pitching.ts';
import type { HitTelemetry, PitchTelemetry, StrikeZonePitch } from '../telemetry.ts';
import { StrikeZoneHeatmap } from './StrikeZoneHeatmap.tsx';

interface TelemetryWingProps {
  pitchTelemetry: PitchTelemetry | null;
  hitTelemetry: HitTelemetry | null;
  strikeZonePitches: StrikeZonePitch[];
  currentPitch: StrikeZonePitch | null;
  activePitchType: PitchType | null;
  isPlayerBatting: boolean;
}

export function TelemetryWing({
  pitchTelemetry,
  hitTelemetry,
  strikeZonePitches,
  currentPitch,
  activePitchType,
  isPlayerBatting,
}: TelemetryWingProps): React.ReactElement {
  const displayPitchType = activePitchType ?? pitchTelemetry?.pitchType ?? 'fastball';
  const pitchDef = PITCH_DEFS[displayPitchType];

  return (
    <aside className="w-full lg:w-72 flex flex-col gap-3 bg-zinc-900/90 border border-white/10 rounded-3xl p-3.5 shadow-xl text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
          <h3 className="text-xs font-bold tracking-wider text-cyan-300">戰術遙測儀 · STATCAST</h3>
        </div>
        <span className="text-[10px] bg-cyan-950/60 text-cyan-400 font-mono px-2 py-0.5 rounded-full border border-cyan-800/40">
          LIVE
        </span>
      </div>

      {/* Pitch Telemetry Radar */}
      <div className="bg-zinc-950/70 rounded-2xl p-3 border border-white/5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-bold">
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span>球路與轉速雷達</span>
          </div>
          <span
            className="text-[11px] font-bold px-2 py-0.5 rounded-md"
            style={{
              backgroundColor: `rgba(${pitchDef.trailRgb[0]}, ${pitchDef.trailRgb[1]}, ${pitchDef.trailRgb[2]}, 0.2)`,
              color: `rgb(${pitchDef.trailRgb[0]}, ${pitchDef.trailRgb[1]}, ${pitchDef.trailRgb[2]})`,
            }}
          >
            {isPlayerBatting ? '偵測尾跡中' : pitchDef.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="bg-zinc-900/80 p-2 rounded-xl border border-white/5">
            <span className="text-[9px] text-zinc-400 font-bold tracking-wider block">球速 (VELO)</span>
            <span className="text-lg font-mono font-bold text-sky-400">
              {pitchTelemetry ? `${pitchTelemetry.speedKmh}` : '---'}
              <span className="text-[10px] text-zinc-500 font-normal ml-1">km/h</span>
            </span>
          </div>
          <div className="bg-zinc-900/80 p-2 rounded-xl border border-white/5">
            <span className="text-[9px] text-zinc-400 font-bold tracking-wider block">轉速 (SPIN)</span>
            <span className="text-lg font-mono font-bold text-amber-400">
              {pitchTelemetry ? `${pitchTelemetry.spinRpm}` : '---'}
              <span className="text-[10px] text-zinc-500 font-normal ml-1">RPM</span>
            </span>
          </div>
        </div>

        <div className="flex justify-between items-center text-[10px] text-zinc-400 px-1 pt-0.5 font-mono">
          <span>
            橫移位移：
            <strong className="text-zinc-200">
              {pitchTelemetry ? `${pitchTelemetry.breakCmX > 0 ? '+' : ''}${pitchTelemetry.breakCmX} cm` : '---'}
            </strong>
          </span>
          <span>
            縱向下墜：
            <strong className="text-zinc-200">
              {pitchTelemetry ? `${pitchTelemetry.breakCmZ} cm` : '---'}
            </strong>
          </span>
        </div>
      </div>

      {/* 3x3 Strike Zone Heatmap */}
      <StrikeZoneHeatmap
        pitches={strikeZonePitches}
        currentPitch={currentPitch}
      />

      {/* StatCast Exit Velocity & Launch Angle */}
      <div className="bg-zinc-950/70 rounded-2xl p-3 border border-white/5 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-zinc-400 text-[11px] font-bold">
            <Gauge className="w-3.5 h-3.5 text-emerald-400" />
            <span>擊球初速與仰角</span>
          </div>
          {hitTelemetry && (
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                hitTelemetry.barrelGrade === 'barrel'
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : hitTelemetry.barrelGrade === 'solid'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700'
              }`}
            >
              {hitTelemetry.barrelLabel}
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-1.5 mt-1 text-center font-mono">
          <div className="bg-zinc-900/80 p-1.5 rounded-xl border border-white/5">
            <span className="text-[9px] text-zinc-400 block font-sans">擊球初速</span>
            <span className="text-base font-bold text-emerald-400">
              {hitTelemetry ? `${hitTelemetry.exitVeloKmh}` : '--'}
            </span>
            <span className="text-[8px] text-zinc-500 block">km/h</span>
          </div>
          <div className="bg-zinc-900/80 p-1.5 rounded-xl border border-white/5">
            <span className="text-[9px] text-zinc-400 block font-sans">發射仰角</span>
            <span className="text-base font-bold text-yellow-400">
              {hitTelemetry ? `${hitTelemetry.launchAngleDeg}°` : '--'}
            </span>
            <span className="text-[8px] text-zinc-500 block">Launch</span>
          </div>
          <div className="bg-zinc-900/80 p-1.5 rounded-xl border border-white/5">
            <span className="text-[9px] text-zinc-400 block font-sans">預估飛行</span>
            <span className="text-base font-bold text-purple-400">
              {hitTelemetry ? `${hitTelemetry.projectedDistM}` : '--'}
            </span>
            <span className="text-[8px] text-zinc-500 block">公尺</span>
          </div>
        </div>

        {/* Dynamic Launch Angle Meter */}
        {hitTelemetry && (
          <div className="mt-1">
            <div className="flex justify-between text-[9px] text-zinc-500 font-mono mb-0.5">
              <span>滾地 (-15°)</span>
              <span>甜蜜帶 (25°)</span>
              <span>飛球 (50°)</span>
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden relative">
              <div
                className="absolute top-0 bottom-0 bg-gradient-to-r from-blue-500 via-amber-400 to-red-500 rounded-full"
                style={{
                  left: '0%',
                  width: `${Math.min(100, Math.max(5, ((hitTelemetry.launchAngleDeg + 15) / 65) * 100))}%`,
                }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="text-[10px] text-zinc-500 text-center flex items-center justify-center gap-1">
        <Sparkles className="w-3 h-3 text-amber-400" />
        <span>桌上棒球 StatCast 系統連線運作中</span>
      </div>
    </aside>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import type { GameState } from '../game/types';
import { LEAGUES, POSITIONS } from '../game/config';
import { playHeartbeat, playStadiumRoar } from '../game/baseballAudio';

interface StadiumDiamondProps {
  state: GameState;
  isClutch?: boolean;
  clutchPrompt?: string;
}

interface RunnerState {
  first: boolean;
  second: boolean;
  third: boolean;
}

function parseRunners(text: string): RunnerState {
  if (text.includes('滿壘')) {
    return { first: true, second: true, third: true };
  }
  if (text.includes('二三壘') || text.includes('得點圈有人')) {
    return { first: false, second: true, third: true };
  }
  if (text.includes('一三壘')) {
    return { first: true, second: false, third: true };
  }
  if (text.includes('一二壘')) {
    return { first: true, second: true, third: false };
  }
  if (text.includes('二壘')) {
    return { first: false, second: true, third: false };
  }
  if (text.includes('三壘')) {
    return { first: false, second: false, third: true };
  }
  if (text.includes('一壘')) {
    return { first: true, second: false, third: false };
  }
  // Default runner on 2nd (scoring position) for tension
  return { first: false, second: true, third: false };
}

/**
 * Interactive baseball diamond field, stadium scoreboard HUD,
 * Biometric Heart-Rate ECG Telemetry, and Batter-Pitcher Duel Radar.
 */
export function StadiumDiamond({
  state,
  isClutch = false,
  clutchPrompt = '',
}: StadiumDiamondProps): React.ReactElement {
  const runners = isClutch ? parseRunners(clutchPrompt) : { first: false, second: false, third: false };
  const leagueName = LEAGUES[state.league]?.label ?? '棒球聯賽';
  const posLabel = POSITIONS.find((p) => p.id === state.position)?.label ?? '球員';
  const isPitcher = state.position === 'P';

  // Calculate dynamic clutch pressure & biometric heart rate (BPM)
  const { bpm, dbLevel, cardiacLabel, runnerTension } = useMemo(() => {
    let baseBpm = 76;
    let baseDb = 86;
    let label = '正常心率 · 平穩';
    let tension = '壘上無人';

    const runnerCount = (runners.first ? 1 : 0) + (runners.second ? 1 : 0) + (runners.third ? 1 : 0);

    if (runnerCount === 3) {
      baseBpm += 45;
      baseDb += 19;
      tension = '滿壘大危機！';
    } else if (runners.second || runners.third) {
      baseBpm += 28;
      baseDb += 13;
      tension = '得點圈有人！';
    } else if (runnerCount > 0) {
      baseBpm += 15;
      baseDb += 7;
      tension = '壘上有人';
    }

    // Guts modifier: high guts cools heart down; low guts makes heart race
    const guts = state.attrs.guts ?? 40;
    if (guts < 35) {
      baseBpm += 16;
    } else if (guts > 70) {
      baseBpm -= 10;
    }

    // Motivation modifier: high motivation increases focus & adrenaline
    if (state.meta.motivation > 70) {
      baseBpm += 6;
      baseDb += 3;
    }

    if (baseBpm >= 135) {
      label = '🔥 心率狂飆 · 極度緊繃';
    } else if (baseBpm >= 105) {
      label = '⚡ 腎上腺素激增 · 專注對決';
    } else {
      label = '🧊 大心臟 · 冷靜沉著';
    }

    return {
      bpm: Math.min(168, Math.max(72, baseBpm)),
      dbLevel: Math.min(112, Math.max(82, baseDb)),
      cardiacLabel: label,
      runnerTension: tension,
    };
  }, [runners, state.attrs.guts, state.meta.motivation]);

  // Audio heartbeat pulse in clutch mode
  useEffect(() => {
    if (!isClutch) return;
    playHeartbeat(bpm);
    const interval = window.setInterval(() => {
      playHeartbeat(bpm);
    }, Math.max(1200, (60 / bpm) * 2000));
    return () => window.clearInterval(interval);
  }, [isClutch, bpm]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-3 shadow-xl">
      {/* Top Status Bar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span
            className={`flex h-2.5 w-2.5 rounded-full ${
              isClutch ? 'bg-rose-500 animate-ping' : 'bg-emerald-400 animate-pulse'
            }`}
          />
          <span className="text-xs font-bold text-slate-200">
            {isClutch ? '🔥 賽事關鍵局面 · 即時戰況' : `⚾ ${leagueName} · ${state.team}`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isClutch && (
            <span className="rounded bg-rose-500/20 px-2 py-0.5 font-mono text-[10px] font-bold text-rose-300">
              緊繃指數 {bpm}
            </span>
          )}
          <span className="rounded bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-300">
            {state.age} 歲 · 第 {state.turnIndex + 1} 回合
          </span>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-[105px_1fr]">
        {/* Diamond SVG */}
        <div className="relative flex items-center justify-center">
          <div className="relative" style={{ width: 100, height: 90 }}>
            <svg viewBox="0 0 100 90" className="w-full h-full select-none">
              {/* Infield Grass diamond */}
              <polygon
                points="50,15 80,45 50,75 20,45"
                fill="#14532d"
                stroke="#ca8a04"
                strokeWidth="1.5"
              />
              {/* Pitcher's mound */}
              <circle cx="50" cy="45" r="5" fill="#a16207" />
              <circle cx="50" cy="45" r="2" fill="#fef08a" />

              {/* Basepaths */}
              <line x1="50" y1="75" x2="80" y2="45" stroke="#fef08a" strokeWidth="1" strokeDasharray="2 2" />
              <line x1="80" y1="45" x2="50" y2="15" stroke="#fef08a" strokeWidth="1" strokeDasharray="2 2" />
              <line x1="50" y1="15" x2="20" y2="45" stroke="#fef08a" strokeWidth="1" strokeDasharray="2 2" />
              <line x1="20" y1="45" x2="50" y2="75" stroke="#fef08a" strokeWidth="1" strokeDasharray="2 2" />

              {/* 2nd Base (Top) */}
              <rect
                x="46"
                y="11"
                width="8"
                height="8"
                transform="rotate(45 50 15)"
                fill={runners.second ? '#facc15' : '#ffffff'}
                stroke={runners.second ? '#ea580c' : '#334155'}
                strokeWidth="1.5"
                className={runners.second ? 'animate-pulse' : ''}
              />

              {/* 1st Base (Right) */}
              <rect
                x="76"
                y="41"
                width="8"
                height="8"
                transform="rotate(45 80 45)"
                fill={runners.first ? '#facc15' : '#ffffff'}
                stroke={runners.first ? '#ea580c' : '#334155'}
                strokeWidth="1.5"
                className={runners.first ? 'animate-pulse' : ''}
              />

              {/* 3rd Base (Left) */}
              <rect
                x="16"
                y="41"
                width="8"
                height="8"
                transform="rotate(45 20 45)"
                fill={runners.third ? '#facc15' : '#ffffff'}
                stroke={runners.third ? '#ea580c' : '#334155'}
                strokeWidth="1.5"
                className={runners.third ? 'animate-pulse' : ''}
              />

              {/* Home Plate (Bottom) */}
              <polygon
                points="50,78 55,73 55,70 45,70 45,73"
                fill="#ffffff"
                stroke="#334155"
                strokeWidth="1"
              />
            </svg>
          </div>
        </div>

        {/* Telemetry & ECG Monitor Section */}
        <div className="flex flex-col justify-center gap-2">
          {isClutch ? (
            <div className="space-y-2">
              {/* Telemetry Row: Runners + BSO Lamps + Sound Meter */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-900/80 border border-slate-800 p-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-amber-200">{runnerTension}</span>
                  {/* B-S-O Lamps */}
                  <div className="flex items-center gap-2 font-mono text-[10px] font-bold">
                    <span className="flex items-center gap-1 text-emerald-400">
                      B <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </span>
                    <span className="flex items-center gap-1 text-yellow-400">
                      S <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                      <span className="h-1.5 w-1.5 rounded-full bg-yellow-400" />
                    </span>
                    <span className="flex items-center gap-1 text-rose-400">
                      O <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                    </span>
                  </div>
                </div>

                {/* Stadium Crowd Decibel Meter */}
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-[10px] text-slate-400">
                    球場分貝 <span className="font-bold text-amber-300">{dbLevel} dB</span>
                  </span>
                  <div className="flex h-3 items-end gap-0.5">
                    <span className="h-1.5 w-1 rounded-sm bg-emerald-500" />
                    <span className="h-2 w-1 rounded-sm bg-emerald-400" />
                    <span className="h-2.5 w-1 rounded-sm bg-yellow-400" />
                    <span className="h-3 w-1 rounded-sm bg-rose-500 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Biometric ECG Heart Rate Monitor Panel */}
              <div className="relative overflow-hidden rounded-xl border border-rose-500/30 bg-slate-950/80 p-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-4 w-4 items-center justify-center text-rose-400 animate-bounce">
                      ♥
                    </span>
                    <span className="font-mono text-sm font-black text-rose-300">
                      {bpm} <span className="text-[10px] font-normal text-slate-400">BPM</span>
                    </span>
                    <span className="text-[10px] text-slate-400">|</span>
                    <span className="text-[11px] font-semibold text-rose-200">
                      {cardiacLabel}
                    </span>
                  </div>

                  {/* Duel Radar Gun Badge */}
                  <div className="rounded bg-sky-500/10 border border-sky-400/30 px-2 py-0.5 text-[10px] font-bold text-sky-200">
                    {isPitcher
                      ? '🎯 決勝配球預判'
                      : '⚡ 雷達測速：152 km/h 直球戒備'}
                  </div>
                </div>

                {/* Simulated Animated ECG Waveform Canvas */}
                <div className="mt-1.5 h-6 w-full overflow-hidden rounded bg-slate-900/60">
                  <svg
                    viewBox="0 0 300 24"
                    preserveAspectRatio="none"
                    className="h-full w-full stroke-rose-400 select-none"
                    style={{ strokeWidth: 1.5, fill: 'none' }}
                  >
                    {/* Grid backdrop */}
                    <line x1="0" y1="12" x2="300" y2="12" stroke="rgba(244,63,94,0.15)" strokeDasharray="4 4" />
                    {/* ECG Path with P-Q-R-S-T waves */}
                    <path
                      d="M 0,12 L 20,12 L 24,10 L 28,12 L 35,12 L 38,14 L 42,2 L 46,22 L 50,12 L 60,12 L 68,9 L 76,12 L 100,12 L 120,12 L 124,10 L 128,12 L 135,12 L 138,14 L 142,2 L 146,22 L 150,12 L 160,12 L 168,9 L 176,12 L 200,12 L 220,12 L 224,10 L 228,12 L 235,12 L 238,14 L 242,2 L 246,22 L 250,12 L 260,12 L 268,9 L 276,12 L 300,12"
                      className="animate-pulse"
                    />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-slate-300">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>位置：<strong className="text-slate-100">{posLabel}</strong></span>
                <span>球團：<strong className="text-slate-100">{state.team}</strong></span>
              </div>
              {state.coach && (
                <p className="text-[11px] text-slate-400">
                  指導教練：<span className="text-sky-300 font-medium">{state.coach.name}</span>
                </p>
              )}
              {state.rival && (
                <p className="text-[11px] text-slate-400">
                  生涯宿敵：<span className="text-rose-300 font-medium">{state.rival.name}</span>
                  <span className="ml-1 text-[10px] text-slate-500">（宿敵熱度 {state.rival.rivalry}）</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

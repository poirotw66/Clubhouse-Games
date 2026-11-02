import React from 'react';
import type { GameState } from '../game/types';
import { LEAGUES, POSITIONS } from '../game/config';

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
 * Interactive baseball diamond field and stadium scoreboard HUD.
 * Renders in-match diamond base runners and situation telemetry.
 */
export function StadiumDiamond({
  state,
  isClutch = false,
  clutchPrompt = '',
}: StadiumDiamondProps): React.ReactElement {
  const runners = isClutch ? parseRunners(clutchPrompt) : { first: false, second: false, third: false };
  const leagueName = LEAGUES[state.league]?.label ?? '棒球聯賽';
  const posLabel = POSITIONS.find((p) => p.id === state.position)?.label ?? '球員';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-b from-slate-900 via-slate-950 to-slate-900 p-3 shadow-xl">
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-bold text-slate-200">
            {isClutch ? '🔥 賽事關鍵局面' : `⚾ ${leagueName} · ${state.team}`}
          </span>
        </div>
        <span className="rounded bg-slate-800/80 px-2 py-0.5 font-mono text-[11px] font-semibold text-amber-300">
          {state.age} 歲 · 第 {state.turnIndex + 1} 回合
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-4">
        {/* Diamond SVG */}
        <div className="relative shrink-0" style={{ width: 100, height: 90 }}>
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

        {/* Status / BSO Telemetry Column */}
        <div className="flex flex-1 flex-col justify-center gap-1.5 text-xs">
          {isClutch ? (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-200">壘包狀況</span>
                <span className="font-mono text-[10px] text-amber-300 font-bold">
                  {runners.first && runners.second && runners.third
                    ? '滿壘局面'
                    : runners.second || runners.third
                      ? '得點圈有人'
                      : '壘上有人'}
                </span>
              </div>
              {/* B-S-O Lamps */}
              <div className="mt-1.5 flex items-center gap-3 font-mono text-[10px] font-bold">
                <span className="flex items-center gap-1 text-emerald-400">
                  B <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span className="h-2 w-2 rounded-full bg-slate-700" />
                </span>
                <span className="flex items-center gap-1 text-yellow-400">
                  S <span className="h-2 w-2 rounded-full bg-yellow-400" />
                  <span className="h-2 w-2 rounded-full bg-slate-700" />
                </span>
                <span className="flex items-center gap-1 text-rose-400">
                  O <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                  <span className="h-2 w-2 rounded-full bg-slate-700" />
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-1 text-slate-300">
              <p className="text-[11px] text-slate-400">
                位置：<span className="font-bold text-slate-100">{posLabel}</span>
              </p>
              <p className="text-[11px] text-slate-400">
                所屬：<span className="font-bold text-slate-100">{state.team}</span>
              </p>
              {state.coach && (
                <p className="text-[11px] text-slate-400">
                  指導：<span className="text-sky-300">{state.coach.name}</span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

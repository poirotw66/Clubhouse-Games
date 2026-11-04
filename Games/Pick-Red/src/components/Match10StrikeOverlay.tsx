import React, { useEffect, useState } from 'react';
import { CardView } from './CardView';
import { cardLabel, pointsOf } from '../game/cards';
import { playMatch10Collision } from '../game/audio';
import { haptic, particles } from '@clubhouse/shared/juice';
import type { Card, Seat } from '../game/types';

export interface StrikeData {
  id: number;
  played: Card;
  target: Card;
  points: number;
  by: Seat;
  byName: string;
  isAce: boolean;
  isRedFive: boolean;
  combo: number;
  isToolConversion: boolean;
  blackAces: boolean;
}

interface Props {
  strike: StrikeData;
  onComplete: () => void;
}

export function Match10StrikeOverlay({ strike, onComplete }: Props): React.ReactElement {
  const [phase, setPhase] = useState<'attracting' | 'colliding' | 'absorbing'>('attracting');

  const {
    played,
    target,
    points,
    byName,
    isAce,
    isRedFive,
    combo,
    isToolConversion,
    blackAces,
  } = strike;

  useEffect(() => {
    // Sound & Haptics trigger on mount
    playMatch10Collision(points, isAce, combo);
    haptic(isAce ? 'win' : combo >= 2 ? 'combo' : 'impact');

    const tCollide = setTimeout(() => {
      setPhase('colliding');
      particles('burst', { strength: isAce ? 1.2 : 0.85 });
    }, 180);

    const tAbsorb = setTimeout(() => {
      setPhase('absorbing');
    }, 420);

    const tDone = setTimeout(() => {
      onComplete();
    }, 620);

    return () => {
      clearTimeout(tCollide);
      clearTimeout(tAbsorb);
      clearTimeout(tDone);
    };
  }, [points, isAce, combo, onComplete]);

  // Determine title badge
  let badgeTitle = '✨ 湊十合一';
  let badgeColor = 'from-amber-400 via-amber-300 to-yellow-500 text-slate-950 border-amber-300';

  if (isAce || points >= 20) {
    badgeTitle = '👑 天王絕殺合十';
    badgeColor = 'from-rose-500 via-amber-300 to-rose-600 text-slate-950 border-amber-200';
  } else if (isRedFive) {
    badgeTitle = '⚡ 過紅五合十';
    badgeColor = 'from-red-500 via-orange-400 to-amber-300 text-slate-950 border-orange-200';
  } else if (combo >= 2) {
    badgeTitle = `🔥 ${combo} 連撿絕殺`;
    badgeColor = 'from-orange-500 via-amber-400 to-yellow-400 text-slate-950 border-amber-300';
  } else if (isToolConversion) {
    badgeTitle = '🎯 以黑換紅';
    badgeColor = 'from-emerald-400 via-teal-300 to-sky-400 text-slate-950 border-emerald-200';
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-200 select-none cursor-pointer"
      onClick={onComplete}
      role="dialog"
      aria-label="合十絕殺碰撞演出"
    >
      {/* Central Collision Chamber */}
      <div className="relative flex flex-col items-center justify-center p-6 w-80 sm:w-96">
        {/* Dynamic Strike Title & Point Popup */}
        <div
          className={`flex flex-col items-center gap-1 transition-all duration-200 ${
            phase === 'colliding'
              ? 'scale-110 opacity-100 translate-y-0'
              : phase === 'absorbing'
                ? 'scale-90 opacity-40 -translate-y-4'
                : 'scale-90 opacity-0 translate-y-2'
          }`}
        >
          <span
            className={`px-4 py-1 rounded-full text-xs sm:text-sm font-black tracking-wider uppercase bg-gradient-to-r shadow-xl border-2 ${badgeColor}`}
          >
            {badgeTitle}
          </span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-3xl sm:text-4xl font-black text-amber-300 font-mono tracking-tight drop-shadow-[0_2px_12px_rgba(251,191,36,0.6)]">
              +{points}
            </span>
            <span className="text-xs sm:text-sm font-bold text-amber-100/90">分</span>
          </div>
          <span className="text-[11px] text-emerald-200/80 font-medium">
            {byName} · {cardLabel(played)} 碰 {cardLabel(target)}
          </span>
        </div>

        {/* Magnetic Clash Arena */}
        <div className="relative w-full h-40 flex items-center justify-center mt-2">
          {/* Shockwave Rings on Collision */}
          {phase !== 'attracting' && (
            <>
              <div className="absolute w-36 h-36 rounded-full border-2 border-amber-300/80 pr-strike-shockwave pointer-events-none" />
              <div className="absolute w-48 h-48 rounded-full border border-rose-500/60 pr-strike-shockwave-delayed pointer-events-none" />
              <div className="absolute w-24 h-24 rounded-full bg-amber-400/30 blur-xl pointer-events-none" />
            </>
          )}

          {/* Left / Played Card */}
          <div
            className={`absolute transition-all duration-200 ease-out ${
              phase === 'attracting'
                ? '-translate-x-20 rotate-[-12deg] scale-100'
                : phase === 'colliding'
                  ? '-translate-x-3 rotate-[-4deg] scale-110'
                  : '-translate-x-1 rotate-0 scale-75 opacity-20'
            }`}
          >
            <div className="shadow-2xl rounded-lg ring-2 ring-amber-400/70">
              <CardView card={played} size="md" blackAces={blackAces} />
            </div>
          </div>

          {/* Magnetic Attraction Spark / Line */}
          {phase === 'attracting' && (
            <div className="absolute h-0.5 w-24 bg-gradient-to-r from-amber-400 via-rose-400 to-amber-400 animate-pulse pointer-events-none" />
          )}

          {/* Right / Target Card */}
          <div
            className={`absolute transition-all duration-200 ease-out ${
              phase === 'attracting'
                ? 'translate-x-20 rotate-[12deg] scale-100'
                : phase === 'colliding'
                  ? 'translate-x-3 rotate-[4deg] scale-110'
                  : 'translate-x-1 rotate-0 scale-75 opacity-20'
            }`}
          >
            <div className="shadow-2xl rounded-lg ring-2 ring-rose-400/70">
              <CardView card={target} size="md" blackAces={blackAces} />
            </div>
          </div>
        </div>

        {/* Tactile prompt */}
        <div className="text-[10px] text-slate-400 mt-2">
          點選任意處快速略過
        </div>
      </div>
    </div>
  );
}

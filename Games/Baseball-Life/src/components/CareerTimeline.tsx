import React from 'react';
import type { GameState } from '../game/types';

interface CareerTimelineProps {
  state: GameState;
}

interface MilestoneEra {
  id: string;
  label: string;
  sub: string;
  minAge: number;
  maxAge: number;
}

const ERAS: MilestoneEra[] = [
  { id: 'hs', label: '高中養成', sub: '16-18歲', minAge: 16, maxAge: 18 },
  { id: 'draft', label: '選秀啟程', sub: '18-22歲', minAge: 18, maxAge: 22 },
  { id: 'prime', label: '巔峰全盛', sub: '23-30歲', minAge: 23, maxAge: 30 },
  { id: 'veteran', label: '老將傳奇', sub: '31歲+', minAge: 31, maxAge: 99 },
];

/**
 * Career timeline progress bar showing the player's life stage.
 */
export function CareerTimeline({ state }: CareerTimelineProps): React.ReactElement {
  const age = state.age;

  return (
    <div className="w-full rounded-xl border border-slate-700/60 bg-slate-900/60 p-2.5">
      <div className="flex items-center justify-between text-[11px]">
        {ERAS.map((era, index) => {
          const isActive = age >= era.minAge && (index === ERAS.length - 1 || age <= era.maxAge);
          const isPassed = age > era.maxAge;

          return (
            <div key={era.id} className="flex flex-1 flex-col items-center text-center">
              <div className="flex w-full items-center">
                <div
                  className={`h-1 flex-1 rounded-full ${
                    index === 0
                      ? 'invisible'
                      : isPassed || isActive
                        ? 'bg-amber-500/80'
                        : 'bg-slate-800'
                  }`}
                />
                <div
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${
                    isActive
                      ? 'bg-amber-400 text-slate-950 ring-4 ring-amber-400/30'
                      : isPassed
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {isPassed ? '✓' : index + 1}
                </div>
                <div
                  className={`h-1 flex-1 rounded-full ${
                    index === ERAS.length - 1
                      ? 'invisible'
                      : isPassed
                        ? 'bg-amber-500/80'
                        : 'bg-slate-800'
                  }`}
                />
              </div>
              <span
                className={`mt-1 font-bold ${
                  isActive ? 'text-amber-300' : isPassed ? 'text-slate-300' : 'text-slate-500'
                }`}
              >
                {era.label}
              </span>
              <span className="text-[9px] text-slate-500">{era.sub}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

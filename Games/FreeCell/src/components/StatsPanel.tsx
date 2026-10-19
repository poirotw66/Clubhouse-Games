import React from 'react';
import { X } from 'lucide-react';
import { CHALLENGES } from '../utils/challenges.ts';
import { computeStreak, dateKey, type DailyRecord } from '../utils/daily.ts';
import {
  modeKey,
  winRate,
  type FreeCellStats,
  type ModeKey,
} from '../utils/storage.ts';
import type { PlayMode } from '../utils/scoring.ts';
import type { FreeCellSlots } from '../utils/storage.ts';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatPct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

function modeLabel(key: ModeKey): string {
  const [mode, slots] = key.split('-') as [PlayMode, string];
  const modeZh = mode === 'timed' ? '限時' : '經典';
  return `${modeZh} · ${slots} 格`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  stats: FreeCellStats;
  daily: DailyRecord[];
  playMode: PlayMode;
  freeCellSlots: FreeCellSlots;
  currentSeed: number;
};

export function StatsPanel({
  open,
  onClose,
  stats,
  daily,
  playMode,
  freeCellSlots,
  currentSeed,
}: Props): React.ReactElement | null {
  if (!open) return null;
  const key = modeKey(playMode, freeCellSlots);
  const mode = stats.byMode[key];
  const streak = computeStreak(daily, dateKey());
  const deal = stats.byDeal[String(currentSeed)];
  const modes: ModeKey[] = ['classic-4', 'classic-2', 'timed-4', 'timed-2'];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="freecell-stats-title"
    >
      <div className="bg-white border border-stone-200 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col text-stone-800">
        <div className="flex justify-between items-center p-5 border-b border-stone-100">
          <h2 id="freecell-stats-title" className="text-xl font-serif font-bold text-stone-900">
            戰績
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] p-2 rounded-full hover:bg-stone-100 touch-manipulation"
            aria-label="關閉戰績"
          >
            <X size={20} />
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-5 text-sm">
          <section className="grid grid-cols-2 gap-3">
            <Stat label="勝率" value={formatPct(winRate(stats))} />
            <Stat label="勝場 / 場次" value={`${stats.wins} / ${stats.plays}`} />
            <Stat label="目前連勝" value={String(stats.currentStreak)} />
            <Stat label="最長連勝" value={String(stats.bestStreak)} />
            <Stat label="每日連續" value={`${streak} 天`} />
          </section>

          <section>
            <h3 className="font-semibold text-stone-900 mb-2">
              目前模式（{modeLabel(key)}）
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="最佳分數" value={mode?.bestScore == null ? '—' : String(mode.bestScore)} />
              <Stat
                label="最佳時間"
                value={mode?.bestTimeSec == null ? '—' : formatTime(mode.bestTimeSec)}
              />
              <Stat label="最少步數" value={mode?.bestMoves == null ? '—' : String(mode.bestMoves)} />
              <Stat
                label="模式勝率"
                value={
                  !mode || mode.plays === 0 ? '—' : formatPct(mode.wins / mode.plays)
                }
              />
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-stone-900 mb-2">
              本局號最佳（#{currentSeed}）
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Stat
                label="最佳時間"
                value={deal?.bestTimeSec == null ? '—' : formatTime(deal.bestTimeSec)}
              />
              <Stat label="最少步數" value={deal?.bestMoves == null ? '—' : String(deal.bestMoves)} />
              <Stat label="最高分" value={deal?.bestScore == null ? '—' : String(deal.bestScore)} />
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-stone-900 mb-2">各模式最佳</h3>
            <ul className="space-y-1 text-stone-600">
              {modes.map((m) => {
                const row = stats.byMode[m];
                return (
                  <li key={m} className="flex justify-between gap-2">
                    <span>{modeLabel(m)}</span>
                    <span className="tabular-nums text-stone-800">
                      {row?.bestScore == null ? '—' : row.bestScore}
                      {' / '}
                      {row?.bestTimeSec == null ? '—' : formatTime(row.bestTimeSec)}
                      {' / '}
                      {row?.bestMoves == null ? '—' : `${row.bestMoves}步`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-stone-900 mb-2">挑戰目標</h3>
            <ul className="space-y-1">
              {CHALLENGES.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span>
                    {c.name}
                    <span className="text-stone-400"> · {c.goalLabel}</span>
                  </span>
                  <span className="tabular-nums">{stats.challengesCleared[c.id] ?? 0}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="rounded-xl bg-stone-50 border border-stone-100 px-3 py-2">
      <div className="text-xs text-stone-500">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-stone-900">{value}</div>
    </div>
  );
}

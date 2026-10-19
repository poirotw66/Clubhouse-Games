import React from 'react';
import { X } from 'lucide-react';
import { CHALLENGES } from '../utils/challenges.ts';
import { computeStreak, type DailyRecord } from '../utils/daily.ts';
import { dateKey } from '../utils/daily.ts';
import {
  modeKey,
  winRate,
  type KlondikeStats,
  type ModeKey,
} from '../utils/storage.ts';
import type { DrawCount } from '../utils/gameLogic.ts';
import type { ScoreMode } from '../utils/scoring.ts';
import { scoreLabel } from '../utils/scoring.ts';

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatPct(rate: number): string {
  return `${Math.round(rate * 100)}%`;
}

type Props = {
  open: boolean;
  onClose: () => void;
  stats: KlondikeStats;
  daily: DailyRecord[];
  drawCount: DrawCount;
  scoreMode: ScoreMode;
};

export function StatsPanel({
  open,
  onClose,
  stats,
  daily,
  drawCount,
  scoreMode,
}: Props): React.ReactElement | null {
  if (!open) return null;
  const key = modeKey(drawCount, scoreMode);
  const mode = stats.byMode[key];
  const streak = computeStreak(daily, dateKey());
  const modes: ModeKey[] = [
    '1-standard',
    '3-standard',
    '1-vegas',
    '3-vegas',
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="klondike-stats-title"
    >
      <div className="bg-emerald-950 border border-white/15 rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col text-emerald-50">
        <div className="flex justify-between items-center p-5 border-b border-white/10">
          <h2 id="klondike-stats-title" className="text-xl font-bold">
            戰績
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] p-2 rounded-full hover:bg-white/10 touch-manipulation"
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
            <Stat label="維加斯籌碼" value={String(stats.vegasBankroll)} />
            <Stat label="每日連續" value={`${streak} 天`} />
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">
              目前模式（翻 {drawCount} · {scoreLabel(scoreMode)}）
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
                  !mode || mode.plays === 0
                    ? '—'
                    : formatPct(mode.wins / mode.plays)
                }
              />
            </div>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">各模式最佳</h3>
            <ul className="space-y-1 text-emerald-100/90">
              {modes.map((m) => {
                const [d, sm] = m.split('-') as [string, ScoreMode];
                const row = stats.byMode[m];
                return (
                  <li key={m} className="flex justify-between gap-2">
                    <span>
                      翻 {d} · {scoreLabel(sm)}
                    </span>
                    <span className="tabular-nums text-white/80">
                      {row?.bestScore == null ? '—' : row.bestScore}
                      {' / '}
                      {row?.bestTimeSec == null ? '—' : formatTime(row.bestTimeSec)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section>
            <h3 className="font-semibold text-white mb-2">挑戰目標</h3>
            <ul className="space-y-1">
              {CHALLENGES.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span>
                    {c.name}
                    <span className="text-white/50"> · {c.goalLabel}</span>
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
    <div className="rounded-xl bg-black/20 px-3 py-2">
      <div className="text-xs text-white/60">{label}</div>
      <div className="text-lg font-semibold tabular-nums text-white">{value}</div>
    </div>
  );
}

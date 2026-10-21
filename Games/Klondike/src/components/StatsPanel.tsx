import React, { useState } from 'react';
import { Share2, X } from 'lucide-react';
import { CHALLENGES } from '../utils/challenges.ts';
import { computeStreak, dateKey, todaysBest, type DailyRecord } from '../utils/daily.ts';
import {
  modeKey,
  winRate,
  type KlondikeStats,
  type ModeKey,
} from '../utils/storage.ts';
import type { DrawCount } from '../utils/gameLogic.ts';
import type { ScoreMode } from '../utils/scoring.ts';
import { scoreLabel } from '../utils/scoring.ts';
import { dailyRecordToShare, copyText } from '../utils/share.ts';

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
  const [copied, setCopied] = useState(false);
  if (!open) return null;
  const key = modeKey(drawCount, scoreMode);
  const mode = stats.byMode[key];
  const today = dateKey();
  const streak = computeStreak(daily, today);
  const bestToday = todaysBest(daily, today);
  const modes: ModeKey[] = [
    '1-standard',
    '3-standard',
    '1-vegas',
    '3-vegas',
  ];

  const handleShare = async () => {
    if (!bestToday) return;
    const ok = await copyText(dailyRecordToShare(bestToday, streak));
    setCopied(ok);
    if (ok) window.setTimeout(() => setCopied(false), 2000);
  };

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
            <h3 className="font-semibold text-white mb-2">今日挑戰（{today}）</h3>
            {bestToday ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Stat
                    label="今日最佳"
                    value={
                      bestToday.won
                        ? `${bestToday.score} 分`
                        : `未過關（${bestToday.score}）`
                    }
                  />
                  <Stat
                    label="時間 / 步數"
                    value={
                      bestToday.won
                        ? `${formatTime(bestToday.elapsedSec)} / ${bestToday.moves}`
                        : `${bestToday.moves} 步`
                    }
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void handleShare()}
                  className="flex items-center justify-center gap-2 w-full min-h-[44px] px-4 py-2 rounded-xl bg-sky-500/80 hover:bg-sky-400 text-emerald-950 font-semibold touch-manipulation"
                >
                  <Share2 size={18} />
                  {copied ? '已複製分享文案' : '複製分享結果'}
                </button>
              </div>
            ) : (
              <p className="text-white/60">尚未記錄今日成績。開啟「每日」通關後可分享。</p>
            )}
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

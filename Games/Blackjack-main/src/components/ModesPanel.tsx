import React from 'react';
import {
  DAILY_HANDS,
  DAILY_START_BALANCE,
  currentStreak,
  formatDailyShareText,
  strategyAccuracyPercent,
  type DailyPersist,
  type DailyRunRecord,
} from '../utils/daily.ts';
import {
  TIN_BUY_IN,
  TIN_HANDS,
  TIN_RIVALS,
  TIN_START_CHIPS,
  formatTournamentShare,
  prizeForRank,
  tinPotSize,
  type TournamentBest,
} from '../utils/tournament.ts';

interface ModesPanelProps {
  open: boolean;
  onClose: () => void;
  careerBalance: number;
  dailyPersist: DailyPersist;
  todayKey: string;
  todayRecord: DailyRunRecord | undefined;
  tournamentBest: TournamentBest;
  onStartDaily: () => void;
  onStartTournament: () => void;
  /** Abort active special mode without saving a full completion. */
  onReturnCareer: () => void;
  activeMode: 'career' | 'daily' | 'tournament';
}

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export const ModesPanel: React.FC<ModesPanelProps> = ({
  open,
  onClose,
  careerBalance,
  dailyPersist,
  todayKey,
  todayRecord,
  tournamentBest,
  onStartDaily,
  onStartTournament,
  onReturnCareer,
  activeMode,
}) => {
  const [copied, setCopied] = React.useState<string | null>(null);
  if (!open) return null;

  const streak = currentStreak(dailyPersist, todayKey);
  const acc = todayRecord
    ? strategyAccuracyPercent(todayRecord.strategyCorrect, todayRecord.strategyTotal)
    : null;
  const canEnterTournament = careerBalance >= TIN_BUY_IN;
  const pot = tinPotSize();

  const shareDaily = async () => {
    if (!todayRecord) return;
    const text = formatDailyShareText(
      todayKey,
      todayRecord.bestBalance,
      todayRecord.strategyCorrect,
      todayRecord.strategyTotal,
      streak,
    );
    const ok = await copyText(text);
    setCopied(ok ? 'daily' : null);
  };

  const shareTournament = async () => {
    const rank = tournamentBest.bestRank <= 5 ? tournamentBest.bestRank : 5;
    const text = formatTournamentShare(
      rank,
      tournamentBest.bestBalance,
      prizeForRank(rank, pot),
    );
    const ok = await copyText(text);
    setCopied(ok ? 'tin' : null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-3">
      <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl bg-emerald-950 border border-white/15 shadow-2xl p-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-black tracking-wider">模式</h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-lg bg-white/10 hover:bg-white/20 font-bold touch-manipulation"
            aria-label="關閉"
          >
            ✕
          </button>
        </div>

        {activeMode !== 'career' && (
          <div className="mb-3 rounded-xl border border-amber-400/40 bg-amber-500/10 p-3">
            <p className="text-sm font-bold text-amber-200">
              目前在{activeMode === 'daily' ? '每日牌靴' : '錫標賽'}中
            </p>
            <button
              type="button"
              onClick={onReturnCareer}
              className="mt-2 w-full min-h-[44px] rounded-xl bg-white/10 hover:bg-white/15 font-bold touch-manipulation"
            >
              返回生涯桌（不計完整通關）
            </button>
          </div>
        )}

        <section className="space-y-2 mb-4">
          <h3 className="text-sm font-black tracking-wider text-emerald-300">每日牌靴</h3>
          <p className="text-[12px] text-white/55 leading-relaxed">
            以台北日期為種子的固定牌靴。起手 ${DAILY_START_BALANCE}，共 {DAILY_HANDS}{' '}
            手；記錄今日最佳結餘與基本策略正確率。不影響生涯籌碼。
          </p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="bg-black/30 rounded-lg px-3 py-2 border border-white/10">
              <dt className="text-[10px] text-white/45 font-bold">今日</dt>
              <dd className="font-black text-emerald-300">{todayKey}</dd>
            </div>
            <div className="bg-black/30 rounded-lg px-3 py-2 border border-white/10">
              <dt className="text-[10px] text-white/45 font-bold">連續天數</dt>
              <dd className="font-black text-emerald-300">{streak}</dd>
            </div>
            <div className="bg-black/30 rounded-lg px-3 py-2 border border-white/10">
              <dt className="text-[10px] text-white/45 font-bold">今日最佳</dt>
              <dd className="font-black text-emerald-300">
                {todayRecord ? `$${todayRecord.bestBalance}` : '—'}
              </dd>
            </div>
            <div className="bg-black/30 rounded-lg px-3 py-2 border border-white/10">
              <dt className="text-[10px] text-white/45 font-bold">策略命中</dt>
              <dd className="font-black text-emerald-300">
                {todayRecord && todayRecord.strategyTotal
                  ? `${todayRecord.strategyCorrect}/${todayRecord.strategyTotal}${
                      acc != null ? `（${acc}%）` : ''
                    }`
                  : '—'}
              </dd>
            </div>
          </dl>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={activeMode !== 'career'}
              onClick={onStartDaily}
              className="flex-1 min-h-[44px] rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-emerald-950 font-black tracking-widest touch-manipulation"
            >
              開始每日
            </button>
            <button
              type="button"
              disabled={!todayRecord}
              onClick={() => void shareDaily()}
              className="flex-1 min-h-[44px] rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-40 font-bold touch-manipulation"
            >
              {copied === 'daily' ? '已複製' : '複製分享'}
            </button>
          </div>
        </section>

        <section className="space-y-2 pt-3 border-t border-white/10">
          <h3 className="text-sm font-black tracking-wider text-amber-300">錫標賽</h3>
          <p className="text-[12px] text-white/55 leading-relaxed">
            買入 ${TIN_BUY_IN}，起手 ${TIN_START_CHIPS}，打完 {TIN_HANDS}{' '}
            手後與具名 CPU 比最終籌碼。獎池 ${pot}。賽中不可領取破產救濟。
          </p>
          <ul className="text-[12px] text-white/70 space-y-1">
            {TIN_RIVALS.map(r => (
              <li key={r.id}>
                <span className="font-bold text-white">{r.name}</span>
                <span className="text-white/45"> — {r.blurb}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-white/40">
            生涯紀錄：參賽 {tournamentBest.entries} · 冠軍 {tournamentBest.wins} · 最佳名次{' '}
            {tournamentBest.bestRank <= 5 ? `第 ${tournamentBest.bestRank}` : '—'}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={activeMode !== 'career' || !canEnterTournament}
              onClick={onStartTournament}
              className="flex-1 min-h-[44px] rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-amber-950 font-black tracking-widest touch-manipulation"
            >
              {canEnterTournament ? `買入 $${TIN_BUY_IN}` : `需 $${TIN_BUY_IN}`}
            </button>
            <button
              type="button"
              disabled={tournamentBest.entries === 0}
              onClick={() => void shareTournament()}
              className="flex-1 min-h-[44px] rounded-xl bg-white/10 hover:bg-white/15 disabled:opacity-40 font-bold touch-manipulation"
            >
              {copied === 'tin' ? '已複製' : '複製分享'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

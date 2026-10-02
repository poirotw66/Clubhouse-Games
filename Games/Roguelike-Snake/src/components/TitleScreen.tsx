import { useMemo, useState } from 'react';
import { Play, Sparkles, Target } from 'lucide-react';
import {
  SEED_CHALLENGES,
  challengeCount,
  continueChallengeIndex,
  isChallengeUnlocked,
} from '../game/challenges';
import type { ChallengeProgress } from '../game/challenges';
import { MAX_FLOOR } from '../game/config';
import type { BestRecord } from '../game/storage';

interface TitleScreenProps {
  best: BestRecord;
  challengeProgress: ChallengeProgress;
  onStart: (seedInput: string) => void;
  onStartChallenge: (challengeId: string) => void;
}

const RULES: Array<[string, string]> = [
  ['🍎 吃果實', '吃滿當層配額即開啟出口傳送門'],
  ['⚡ 衝刺', 'Space／衝刺鍵，消耗能量並輾殺敵人'],
  ['❤️ 生命', '撞牆、撞自己、被敵人碰到都會 −1 HP'],
  ['🎁 遺物', '每通過一層三選一，永久疊加'],
  ['👹 首領', '每 5 層一場，只有衝刺能傷到它'],
];

export function TitleScreen({
  best,
  challengeProgress,
  onStart,
  onStartChallenge,
}: TitleScreenProps) {
  const [seed, setSeed] = useState('');
  const [showChallenges, setShowChallenges] = useState(false);

  const todaySeed = () => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}${m}${day}`;
  };

  const packTotal = challengeCount();
  const packContinue = continueChallengeIndex(challengeProgress.clearedCount);
  const packSubtitle = useMemo(() => {
    if (challengeProgress.clearedCount >= packTotal) return `已完成 ${packTotal}/${packTotal}`;
    if (challengeProgress.clearedCount > 0) {
      return `進度 ${challengeProgress.clearedCount}/${packTotal}・繼續`;
    }
    return `固定種子 ${packTotal} 關・開始`;
  }, [challengeProgress.clearedCount, packTotal]);

  return (
    <div className="w-full max-w-lg mx-auto text-center">
      <p className="text-xs tracking-[0.3em] text-emerald-400 mb-2">肉鴿貪食蛇</p>
      <h1 className="text-4xl sm:text-5xl font-black tracking-tight mb-2">蛇窟迴廊</h1>
      <p className="text-slate-400 text-sm mb-6">
        深入 {MAX_FLOOR} 層地窟，一路構築你的蛇。死亡即結束，但每一局都不一樣。
      </p>

      <div className="grid gap-2 text-left mb-6">
        {RULES.map(([title, text]) => (
          <div
            key={title}
            className="flex items-start gap-3 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2"
          >
            <span className="text-sm font-semibold whitespace-nowrap">{title}</span>
            <span className="text-sm text-slate-400">{text}</span>
          </div>
        ))}
      </div>

      <label className="block text-left text-xs text-slate-400 mb-1" htmlFor="seed-input">
        種子（可留空隨機；相同種子＝相同地窟）
      </label>
      <div className="flex gap-2 mb-2">
        <input
          id="seed-input"
          value={seed}
          onChange={(event) => setSeed(event.target.value)}
          placeholder="例如 20260727 或 clubhouse"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none focus:border-emerald-500"
        />
        <button
          type="button"
          onClick={() => setSeed('')}
          className="rounded-xl border border-slate-700 bg-slate-800 px-3 text-sm hover:bg-slate-700"
        >
          清除
        </button>
      </div>
      <div className="flex gap-2 mb-5">
        <button
          type="button"
          onClick={() => setSeed(todaySeed())}
          className="flex-1 min-h-[44px] rounded-xl border border-emerald-700/60 bg-emerald-900/40 px-3 text-sm text-emerald-200 hover:bg-emerald-800/50"
        >
          今日種子
        </button>
        <button
          type="button"
          onClick={() => onStart(todaySeed())}
          className="flex-1 min-h-[44px] rounded-xl border border-emerald-600 bg-emerald-700/50 px-3 text-sm text-emerald-100 hover:bg-emerald-600/60"
        >
          開始今日挑戰
        </button>
      </div>

      <button
        type="button"
        onClick={() => onStart(seed)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-lg font-bold hover:bg-emerald-500 transition-colors"
      >
        <Play className="w-5 h-5" />
        開始探索
      </button>

      <button
        type="button"
        onClick={() => setShowChallenges(true)}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-500/50 bg-sky-500/15 px-6 py-3 text-base font-bold text-sky-100 hover:bg-sky-500/25 transition-colors"
        aria-label={`開啟挑戰種子包。${packSubtitle}`}
      >
        <Target className="w-5 h-5" />
        挑戰種子包
      </button>
      <p className="mt-1 text-center text-[11px] text-slate-500">{packSubtitle}</p>

      {best.score > 0 && (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-amber-300">
          <Sparkles className="w-4 h-4" />
          最佳紀錄：{best.score} 分 · 第 {best.floor} 層
        </p>
      )}

      {showChallenges && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/75 p-4 sm:items-center text-left"
          role="dialog"
          aria-modal="true"
          aria-labelledby="snake-challenge-title"
          onClick={() => setShowChallenges(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-slate-700 bg-slate-900/95 p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="snake-challenge-title" className="text-xl font-black text-sky-300">
                  挑戰種子包
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  固定種子・達成目標才算通關・進度獨立於自由探索
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowChallenges(false)}
                className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
                aria-label="關閉挑戰種子包"
              >
                關閉
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                const challenge = SEED_CHALLENGES[packContinue];
                if (!challenge) return;
                setShowChallenges(false);
                onStartChallenge(challenge.id);
              }}
              className="mt-4 w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-black text-slate-950 hover:bg-sky-400"
            >
              {challengeProgress.clearedCount >= packTotal
                ? '重玩最終關'
                : challengeProgress.clearedCount > 0
                  ? `繼續・${SEED_CHALLENGES[packContinue]?.name}`
                  : '開始第一關'}
            </button>

            <ul className="mt-4 space-y-2 overflow-y-auto pr-1">
              {SEED_CHALLENGES.map((challenge, index) => {
                const unlocked = isChallengeUnlocked(index, challengeProgress.clearedCount);
                const done = Boolean(challengeProgress.cleared[challenge.id]);
                const bestFor = challengeProgress.bestScore[challenge.id];
                return (
                  <li key={challenge.id}>
                    <button
                      type="button"
                      disabled={!unlocked}
                      onClick={() => {
                        if (!unlocked) return;
                        setShowChallenges(false);
                        onStartChallenge(challenge.id);
                      }}
                      className="flex min-h-16 w-full flex-col rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-3 text-left transition-colors hover:border-sky-500/40 disabled:cursor-not-allowed disabled:opacity-45"
                      style={
                        done
                          ? { borderColor: 'rgba(56,189,248,0.55)', background: 'rgba(12,74,110,0.28)' }
                          : undefined
                      }
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-100">
                          <span className="mr-2 font-mono text-[11px] text-slate-500">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          {unlocked ? challenge.name : '？？？'}
                        </span>
                        <span className="shrink-0 text-[11px] font-semibold text-slate-400">
                          {!unlocked ? '未解鎖' : done ? '已通關' : '挑戰'}
                        </span>
                      </span>
                      {unlocked && (
                        <>
                          <span className="mt-1 text-[11px] leading-snug text-slate-400">
                            {challenge.blurb}
                          </span>
                          <span className="mt-1 text-[11px] text-sky-200/90">
                            目標：{challenge.goalLabel}
                            <span className="ml-2 font-mono text-slate-500">{challenge.seedInput}</span>
                          </span>
                          {bestFor !== undefined && (
                            <span className="mt-1 font-mono text-[10px] text-amber-300/80">
                              最佳分數 {bestFor}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

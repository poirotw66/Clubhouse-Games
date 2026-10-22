import { useMemo, useState } from 'react';
import { AlertTriangle, Copy, Play, Sparkles, Target, Zap } from 'lucide-react';
import { ACHIEVEMENTS, achievementById } from '../game/achievements';
import {
  STARTING_BUILDS,
  buildUnlockHint,
  isBuildUnlocked,
} from '../game/builds';
import {
  SEED_CHALLENGES,
  challengeCount,
  continueChallengeIndex,
  isChallengeUnlocked,
} from '../game/challenges';
import type { ChallengeProgress } from '../game/challenges';
import { MAX_FLOOR } from '../game/config';
import {
  buildDailyShareText,
  computeDailyStreak,
  copyText,
  todaySeedKey,
} from '../game/daily';
import { RELIC_BY_ID } from '../game/relics';
import type { MetaProgress } from '../game/storage';
import type { RelicId } from '../game/types';

export interface StartOptions {
  seedInput: string;
  ironsnake?: boolean;
  daily?: boolean;
}

interface TitleScreenProps {
  meta: MetaProgress;
  challengeProgress: ChallengeProgress;
  onStart: (options: StartOptions) => void;
  onStartChallenge: (challengeId: string) => void;
  onSelectBuild: (buildId: string) => void;
}

const RULES: Array<[string, string]> = [
  ['🍎 吃果實', '吃滿當層配額即開啟出口傳送門'],
  ['⚡ 衝刺', 'Space／衝刺鍵，消耗能量並輾殺敵人'],
  ['❤️ 生命', '撞牆、撞自己、被敵人碰到都會 −1 HP'],
  ['🎁 遺物', '每通過一層三選一，永久疊加'],
  ['👹 首領', '每 5 層一場，只有衝刺能傷到它'],
];

function startingRelicLabel(relicIds: readonly RelicId[]): string {
  if (relicIds.length === 0) return '無起始遺物';
  return relicIds.map((id) => RELIC_BY_ID[id]?.name ?? id).join('、');
}

export function TitleScreen({
  meta,
  challengeProgress,
  onStart,
  onStartChallenge,
  onSelectBuild,
}: TitleScreenProps) {
  const [seed, setSeed] = useState('');
  const [showChallenges, setShowChallenges] = useState(false);
  const [showIronsnakeWarn, setShowIronsnakeWarn] = useState(false);
  const [showAchievements, setShowAchievements] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const today = todaySeedKey();
  const dailyStreak = computeDailyStreak(meta.dailyRecords, today);
  const todayRecord = meta.dailyRecords.find((r) => r.date === today);
  const selectedBuild = STARTING_BUILDS.find((b) => b.id === meta.selectedBuildId);
  const unlockCtx = {
    bestFloor: meta.floor,
    escapes: meta.escapes,
    dailyClears: meta.dailyRecords.filter((r) => r.cleared).length,
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

  const unlockedAchievementCount = meta.achievements.length;

  const handleCopyDailyShare = async () => {
    if (!todayRecord) return;
    const text = buildDailyShareText({
      date: today,
      cleared: todayRecord.cleared,
      score: todayRecord.score,
      floor: todayRecord.floor,
      streak: dailyStreak,
      buildName: selectedBuild?.name,
    });
    const ok = await copyText(text);
    setShareCopied(ok);
    if (ok) window.setTimeout(() => setShareCopied(false), 1800);
  };

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

      <section className="mb-5 text-left" aria-labelledby="build-picker-title">
        <h2 id="build-picker-title" className="text-xs text-slate-400 mb-2">
          起始身分
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {STARTING_BUILDS.map((build) => {
            const unlocked = isBuildUnlocked(build, unlockCtx);
            const selected = meta.selectedBuildId === build.id;
            return (
              <button
                key={build.id}
                type="button"
                disabled={!unlocked}
                onClick={() => unlocked && onSelectBuild(build.id)}
                className={`rounded-xl border px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  selected
                    ? 'border-emerald-500/70 bg-emerald-950/50'
                    : 'border-slate-700 bg-slate-900/70 hover:border-slate-500'
                }`}
                aria-pressed={selected}
                aria-label={`${build.name}${unlocked ? '' : '（未解鎖）'}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-100">
                    {unlocked ? build.name : '？？？'}
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    {!unlocked ? '未解鎖' : selected ? '已選' : '可選'}
                  </span>
                </span>
                <span className="mt-1 block text-[11px] leading-snug text-slate-400">
                  {unlocked ? build.blurb : buildUnlockHint(build)}
                </span>
                {unlocked && (
                  <span className="mt-1 block font-mono text-[10px] text-slate-500">
                    HP {build.startHp} · 能量 {build.startEnergy}
                    {build.startCoins ? ` · 金幣 ${build.startCoins}` : ''}
                    {' · '}
                    {startingRelicLabel(build.startingRelics)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      <section
        className="mb-5 rounded-2xl border border-emerald-700/50 bg-emerald-950/35 p-3 text-left"
        aria-labelledby="daily-challenge-title"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 id="daily-challenge-title" className="text-sm font-bold text-emerald-100">
              每日挑戰
            </h2>
            <p className="mt-0.5 font-mono text-[11px] text-emerald-200/80">種子 {today}</p>
          </div>
          <span className="shrink-0 rounded-lg border border-emerald-600/40 bg-emerald-900/50 px-2 py-1 text-[11px] font-semibold text-emerald-100">
            連勝 {dailyStreak}
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-emerald-100/85">
          {todayRecord
            ? todayRecord.cleared
              ? `今日已通關 · 最佳 ${todayRecord.score} 分 · 第 ${todayRecord.floor} 層`
              : `今日最佳 ${todayRecord.score} 分 · 第 ${todayRecord.floor} 層`
            : '今日尚未挑戰 · 所有人面對同一地窟'}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => onStart({ seedInput: today, daily: true })}
            className="flex-1 min-h-[44px] rounded-xl border border-emerald-500 bg-emerald-600/70 px-3 text-sm font-bold text-emerald-50 hover:bg-emerald-500/80"
          >
            開始今日挑戰
          </button>
          <button
            type="button"
            disabled={!todayRecord}
            onClick={() => void handleCopyDailyShare()}
            className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-700/60 bg-emerald-950/60 px-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-900/70 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="複製每日挑戰分享文案"
          >
            <Copy className="h-4 w-4" />
            {shareCopied ? '已複製' : todayRecord ? '複製分享' : '尚無紀錄'}
          </button>
        </div>
      </section>

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
          onClick={() => setSeed(today)}
          className="flex-1 min-h-[44px] rounded-xl border border-slate-600 bg-slate-800/80 px-3 text-sm text-slate-200 hover:bg-slate-700"
        >
          填入今日種子
        </button>
      </div>

      <button
        type="button"
        onClick={() => onStart({ seedInput: seed })}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-lg font-bold hover:bg-emerald-500 transition-colors"
      >
        <Play className="w-5 h-5" />
        開始探索
      </button>

      <button
        type="button"
        onClick={() => setShowIronsnakeWarn(true)}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-500/60 bg-rose-950/40 px-6 py-3 text-base font-bold text-rose-100 hover:bg-rose-900/50 transition-colors"
        aria-label="開啟 Ironsnake 硬派模式警告"
      >
        <Zap className="w-5 h-5" />
        Ironsnake 硬派
      </button>
      <p className="mt-1 text-center text-[11px] text-rose-300/70">
        HP 固定 1 · 遺物 4 選 1 · 不加血遺物
        {meta.ironsnakeClears > 0
          ? ` · 通關 ${meta.ironsnakeClears} 次 · 最佳 ${meta.ironsnakeBestScore}`
          : ' · 一擊即死，請謹慎'}
      </p>

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

      <button
        type="button"
        onClick={() => setShowAchievements(true)}
        className="mt-3 text-xs text-amber-200/80 underline-offset-2 hover:underline"
      >
        成就 {unlockedAchievementCount}/{ACHIEVEMENTS.length}
      </button>

      {(meta.score > 0 || meta.escapes > 0) && (
        <p className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm text-amber-300">
          <Sparkles className="w-4 h-4" />
          最佳紀錄：{meta.score} 分 · 第 {meta.floor} 層
          {meta.escapes > 0 ? ` · 逃出 ${meta.escapes} 次` : ''}
        </p>
      )}

      {showIronsnakeWarn && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/80 p-4 sm:items-center text-left"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ironsnake-warn-title"
          onClick={() => setShowIronsnakeWarn(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-rose-500/50 bg-slate-900/95 p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-rose-300" />
              <div>
                <h2 id="ironsnake-warn-title" className="text-xl font-black text-rose-200">
                  Ironsnake 硬派模式
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  HP 固定為 1（一擊即死），每層遺物改為 <strong className="text-rose-100">4 選 1</strong>
                  ，且不會出現加血／回血遺物。受傷、撞牆、被敵人碰到都會立刻結束本局。確定要挑戰嗎？
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setShowIronsnakeWarn(false);
                  onStart({ seedInput: seed, ironsnake: true });
                }}
                className="flex-1 rounded-xl bg-rose-600 px-4 py-3 text-sm font-black text-white hover:bg-rose-500"
              >
                確認進入硬派
              </button>
              <button
                type="button"
                onClick={() => setShowIronsnakeWarn(false)}
                className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-slate-700"
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {showAchievements && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/75 p-4 sm:items-center text-left"
          role="dialog"
          aria-modal="true"
          aria-labelledby="snake-achievements-title"
          onClick={() => setShowAchievements(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-amber-700/40 bg-slate-900/95 p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="snake-achievements-title" className="text-xl font-black text-amber-300">
                  成就
                </h2>
                <p className="mt-1 text-xs text-slate-400">本機紀錄・與起始身分／每日／硬派進度連動</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAchievements(false)}
                className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-bold text-slate-200 hover:bg-slate-700"
              >
                關閉
              </button>
            </div>
            <ul className="mt-4 space-y-2 overflow-y-auto pr-1">
              {ACHIEVEMENTS.map((ach) => {
                const done = meta.achievements.includes(ach.id);
                const def = achievementById(ach.id) ?? ach;
                return (
                  <li
                    key={ach.id}
                    className={`rounded-xl border px-3 py-2 ${
                      done
                        ? 'border-amber-500/40 bg-amber-950/30'
                        : 'border-slate-700 bg-slate-800/50 opacity-70'
                    }`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-100">{def.name}</span>
                      <span className="text-[11px] text-slate-400">{done ? '已達成' : '未達成'}</span>
                    </span>
                    <span className="mt-0.5 block text-[11px] text-slate-400">{def.blurb}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
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

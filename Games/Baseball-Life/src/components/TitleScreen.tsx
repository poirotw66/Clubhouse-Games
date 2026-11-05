import React, { useMemo, useState } from 'react';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import { ACHIEVEMENTS, progressOf } from '../game/achievements';
import type { AchievementProgress } from '../game/achievements';
import { ABILITIES } from '../game/abilities';
import {
  CAREER_CHALLENGES,
  challengeCount,
  continueChallengeIndex,
  isChallengeUnlocked,
} from '../game/challenges';
import type { ChallengeProgress } from '../game/challenges';
import { POSITIONS } from '../game/config';
import { encyclopediaStats } from '../game/encyclopedia';
import type { EncyclopediaProgress } from '../game/encyclopedia';
import type { PendingLegacy } from '../game/legacy';
import { normalizeSeedCode, randomSeedCode } from '../game/rng';
import { hasAnyRecords, totalMilestoneHits } from '../game/records';
import type { PersonalRecords } from '../game/records';
import type { ArchiveEntry } from '../game/storage';
import { traitById } from '../game/traits';

interface Props {
  initialSeed: string;
  hasSave: boolean;
  archive: ArchiveEntry[];
  achievements: AchievementProgress;
  records: PersonalRecords;
  encyclopedia: EncyclopediaProgress;
  pendingLegacy: PendingLegacy | null;
  challengeProgress: ChallengeProgress;
  onShowHowTo: () => void;
  onStart: (seedCode: string) => void;
  onStartChallenge: (challengeId: string) => void;
  onContinue: () => void;
}

export function TitleScreen({
  initialSeed,
  hasSave,
  archive,
  achievements,
  records,
  encyclopedia,
  pendingLegacy,
  challengeProgress,
  onShowHowTo,
  onStart,
  onStartChallenge,
  onContinue,
}: Props): React.ReactElement {
  const [seed, setSeed] = useState(initialSeed);
  const [chapter, setChapter] = useState(0);
  const chapters = [
    { age: '16', label: '高中篇', title: '一副手套，一個還沒被看見的夢。', detail: '從高中棒球部出發。安排訓練與休息，在全國賽讓球探記住你的名字。', tag: '養成 × 全國賽' },
    { age: '18', label: '選秀篇', title: '電話響起的那一刻，未來開始改變。', detail: '三年的每次選擇都會留下痕跡。帶著你的能力與成績，迎接職業球團的選擇。', tag: '成績 × 命運' },
    { age: '20+', label: '職業篇', title: '從一名新人，打成被記住的名字。', detail: '在漫長職業生涯裡追逐紀錄。引退後，將這一代的故事與傳承留給下一位球員。', tag: '紀錄 × 傳承' },
  ];
  const selectedChapter = chapters[chapter];
  const [showAchievements, setShowAchievements] = useState(false);
  const [showEncyclopedia, setShowEncyclopedia] = useState(false);
  const [showChallenges, setShowChallenges] = useState(false);
  const [showRecords, setShowRecords] = useState(false);
  const earned = ACHIEVEMENTS.filter((a) => achievements.unlocked[a.id]).length;
  const encyclopediaProgress = encyclopediaStats(encyclopedia);
  const packTotal = challengeCount();
  const packContinue = continueChallengeIndex(challengeProgress.clearedCount);
  const packSubtitle = useMemo(() => {
    if (challengeProgress.clearedCount >= packTotal) return `已完成 ${packTotal}/${packTotal}`;
    if (challengeProgress.clearedCount > 0) {
      return `進度 ${challengeProgress.clearedCount}/${packTotal}・繼續`;
    }
    return `固定種子 ${packTotal} 關・開始`;
  }, [challengeProgress.clearedCount, packTotal]);

  const showRecordsCta = hasAnyRecords(records, archive.length, achievements.careers);
  const milestoneTotal = totalMilestoneHits(records.milestoneCounts);
  const bestFilled = POSITIONS.filter((p) => records.bestByPosition[p.id]).length;

  const replaySeed = (code: string) => {
    setShowRecords(false);
    onStart(normalizeSeedCode(code));
  };

  return (
    <div
      className="bl-title-shell"
      style={{
        backgroundImage: [
          'linear-gradient(90deg, rgba(7, 13, 23, 0.94) 5%, rgba(7, 13, 23, 0.72) 48%, rgba(7, 13, 23, 0.25)), linear-gradient(0deg, #070d17 5%, transparent 90%)',
          `url(${import.meta.env.BASE_URL}title-bg.jpg)`,
        ].join(', '),
      }}
    >
      <main className="bl-career-home">
        <section className="bl-invitation" aria-labelledby="bl-invitation-title">
          <div className="bl-story">
            <p className="bl-eyebrow"><span /> 一個選擇，一段棒球人生</p>
            <p className="bl-wordmark">BASEBALL LIFE / CAREER SIMULATION</p>
            <h1 id="bl-invitation-title">棒球人生<span>你的名字，<br />值得出現在球場上。</span></h1>
            <p className="bl-story-copy">16 歲的春天，你走進高中棒球部。<br />從第一次練習，到最後一次站上打擊區——<br className="bl-wide-break" />這段生涯，由你決定。</p>
            <div className="bl-story-facts" aria-label="遊戲特色"><span>單人・生涯養成</span><span>每回合自動存檔</span></div>
          </div>

          <section className="bl-entry-ticket" aria-label="生涯入場券">
            <div className="bl-ticket-top"><span>CAREER PASS</span><span>01 / 新的篇章</span></div>
            <div className="bl-ticket-diamond" aria-hidden="true"><span>BL</span></div>
            <p className="bl-ticket-kicker">球場已經準備好了</p>
            <h2>{hasSave ? '你的故事，還沒結束。' : '下一位傳奇，會是你嗎？'}</h2>
            <p className="bl-ticket-description">選擇位置與出身，走進你的第一個賽季。</p>
            {hasSave && <TouchButton label="繼續上次的人生" ariaLabel="繼續上次的人生" onClick={onContinue} className="bl-career-cta" />}
            <TouchButton label={hasSave ? '開始新的棒球人生' : '開始新的棒球人生 →'} ariaLabel="開始新的棒球人生" onClick={() => onStart(normalizeSeedCode(seed))} className={hasSave ? 'bl-career-secondary' : 'bl-career-cta'} />
            {hasSave && <p className="bl-ticket-note">建立新球員後將取代目前的進度。</p>}
            <p className="bl-ticket-note">不用先懂規則。從選一個位置開始。</p>
            <details className="bl-seed-settings">
              <summary>與朋友開啟相同世界 <span>種子設定 ＋</span></summary>
              <label htmlFor="seed-input">世界種子碼</label>
              <p>相同種子碼 ＋ 相同選擇 ＝ 相同人生。</p>
              <div className="bl-seed-row">
                <input id="seed-input" value={seed} onChange={(e) => setSeed(e.target.value)} spellCheck={false} autoComplete="off" placeholder="例如 64aa2bl7" />
                <TouchButton label="重骰" ariaLabel="隨機產生新的種子碼" onClick={() => setSeed(randomSeedCode())} className="bl-career-secondary" />
              </div>
            </details>
            {pendingLegacy && <p className="bl-ticket-note bl-legacy-note">來自 {pendingLegacy.fromName} 的遺產，等待你繼承。</p>}
          </section>
        </section>

        <section className="bl-career-road" aria-labelledby="bl-road-title">
          <div className="bl-road-heading"><p className="bl-eyebrow" id="bl-road-title">你將走過的三個篇章</p><span>每一次選擇，都算數。</span></div>
          <div className="bl-chapter-tabs" role="tablist" aria-label="預覽生涯篇章">
            {chapters.map((item, index) => <button key={item.label} id={`bl-chapter-${index}`} type="button" role="tab" aria-selected={chapter === index} aria-controls="bl-chapter-panel" tabIndex={chapter === index ? 0 : -1} onClick={() => setChapter(index)} onKeyDown={(event) => {
              const next = event.key === 'ArrowRight' ? (index + 1) % chapters.length : event.key === 'ArrowLeft' ? (index + chapters.length - 1) % chapters.length : event.key === 'Home' ? 0 : event.key === 'End' ? chapters.length - 1 : null;
              if (next !== null) { event.preventDefault(); setChapter(next); document.getElementById(`bl-chapter-${next}`)?.focus(); }
            }}><span className="bl-chapter-age">{item.age}<small>歲</small></span><span>{item.label}<small>{item.tag}</small></span><span className="bl-chapter-arrow" aria-hidden="true">↗</span></button>)}
          </div>
          <div id="bl-chapter-panel" role="tabpanel" aria-labelledby={`bl-chapter-${chapter}`} className="bl-chapter-panel" tabIndex={0}><h2>{selectedChapter.title}</h2><p>{selectedChapter.detail}</p></div>
        </section>

        <nav className="bl-career-extras" aria-label="更多玩法與教學">
          <button type="button" onClick={() => setShowChallenges(true)}><span className="bl-extra-icon" aria-hidden="true">↗</span><span><strong>生涯挑戰</strong><small>{packSubtitle}</small></span><span aria-hidden="true">→</span></button>
          <button type="button" onClick={onShowHowTo}><span className="bl-extra-icon" aria-hidden="true">?</span><span><strong>第一次當球員？</strong><small>三步上手・操作教學</small></span><span aria-hidden="true">→</span></button>
          {showRecordsCta && <button type="button" onClick={() => setShowRecords(true)}><span className="bl-extra-icon" aria-hidden="true">★</span><span><strong>紀錄牆</strong><small>位置最佳 {bestFilled}/5・里程碑 {milestoneTotal}</small></span><span aria-hidden="true">→</span></button>}
        </nav>
        <div className="bl-home-collection">
      <section className="bl-card p-4">
        <button
          type="button"
          onClick={() => setShowEncyclopedia((v) => !v)}
          aria-expanded={showEncyclopedia}
          className="flex min-h-11 w-full items-center justify-between text-left"
        >
          <span className="text-sm font-bold text-slate-300">
            特殊能力圖鑑
            <span className="ml-2 font-mono text-xs font-normal text-sky-300">
              {encyclopediaProgress.unlocked}/{encyclopediaProgress.total}
            </span>
          </span>
          <span className="text-xs text-slate-400">{showEncyclopedia ? '收起 ▲' : '展開 ▼'}</span>
        </button>
        <div className="mt-2 h-1.5 w-full rounded-full bg-slate-700/70">
          <div
            className="h-full rounded-full bg-sky-400 transition-[width] duration-300"
            style={{
              width: `${(encyclopediaProgress.unlocked / Math.max(1, encyclopediaProgress.total)) * 100}%`,
            }}
          />
        </div>
        {showEncyclopedia && (
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ABILITIES.map((ability) => {
              const unlocked = Boolean(encyclopedia.unlocked[ability.id]);
              return (
                <li
                  key={ability.id}
                  className={`rounded-lg border px-2.5 py-2 text-left ${
                    unlocked
                      ? ability.negative
                        ? 'border-rose-500/40 bg-rose-500/10'
                        : 'border-sky-500/40 bg-sky-500/10'
                      : 'border-slate-700/60 bg-slate-900/40'
                  }`}
                >
                  <p
                    className={`text-xs font-bold ${
                      unlocked
                        ? ability.negative
                          ? 'text-rose-200'
                          : 'text-sky-100'
                        : 'text-slate-500'
                    }`}
                  >
                    {unlocked ? ability.label : '？？？'}
                    {ability.negative && unlocked && (
                      <span className="ml-1 text-[10px] font-normal text-rose-300/80">負面</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
                    {unlocked ? ability.desc : ability.unlockHint}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {achievements.careers > 0 && (
        <section className="bl-card p-4">
          <button
            type="button"
            onClick={() => setShowAchievements((v) => !v)}
            aria-expanded={showAchievements}
            className="flex min-h-11 w-full items-center justify-between text-left"
          >
            <span className="text-sm font-bold text-slate-300">
              成就
              <span className="ml-2 font-mono text-xs font-normal text-amber-300">
                {earned}/{ACHIEVEMENTS.length}
              </span>
            </span>
            <span className="text-xs text-slate-400">{showAchievements ? '收起 ▲' : '展開 ▼'}</span>
          </button>

          <div className="mt-2 h-1.5 w-full rounded-full bg-slate-700/70">
            <div
              className="h-full rounded-full bg-amber-400 transition-[width] duration-300"
              style={{ width: `${(earned / ACHIEVEMENTS.length) * 100}%` }}
            />
          </div>

          {showAchievements && (
            <ul className="mt-3 space-y-2">
              {ACHIEVEMENTS.map((achievement) => {
                const done = Boolean(achievements.unlocked[achievement.id]);
                const count = progressOf(achievement.id, achievements);
                return (
                  <li key={achievement.id} className="flex items-start gap-2.5">
                    <span aria-hidden="true" className="text-base leading-tight">
                      {done ? '🏅' : '🔒'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-bold ${done ? 'text-amber-200' : 'text-slate-400'}`}
                      >
                        {achievement.label}
                        {achievement.goal !== undefined && count !== null && (
                          <span className="ml-2 font-mono text-[10px] font-normal text-slate-500">
                            {Math.min(count, achievement.goal)}/{achievement.goal}
                          </span>
                        )}
                      </p>
                      {/* Locked descriptions stay visible: they are the to-do list. */}
                      <p className="text-[11px] leading-snug text-slate-500">{achievement.desc}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {archive.length > 0 && (
        <section className="bl-card p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-slate-300">歷代球員</h2>
            <button
              type="button"
              onClick={() => setShowRecords(true)}
              className="min-h-11 text-xs font-semibold text-amber-300/90 underline-offset-2 hover:underline"
            >
              開紀錄牆
            </button>
          </div>
          <ul className="mt-2 divide-y divide-slate-700/60">
            {archive.slice(0, 6).map((entry, index) => (
              <li key={`${entry.seedCode}-${index}`}>
                <button
                  type="button"
                  onClick={() => replaySeed(entry.seedCode)}
                  className="flex min-h-11 w-full items-baseline justify-between gap-3 py-2 text-left"
                  aria-label={`用種子 ${entry.seedCode} 重玩 ${entry.name}`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">
                      {entry.name}
                      <span className="ml-2 text-xs font-normal text-slate-400">{entry.position}</span>
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      <span className="font-mono">{entry.seedCode}</span>
                      {entry.traits.length > 0 && (
                        <span className="ml-2">
                          {entry.traits.map((id) => traitById(id)?.label ?? id).join('・')}
                        </span>
                      )}
                      <span className="ml-2 text-amber-300/70">點擊重玩</span>
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-amber-300">{entry.verdict}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
        </div>
      </main>

      {showChallenges && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/75 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bl-challenge-title"
          onClick={() => setShowChallenges(false)}
        >
          <div
            className="bl-card flex max-h-[85vh] w-full max-w-lg flex-col p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="bl-challenge-title" className="text-xl font-black text-amber-300">
                  生涯挑戰
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  固定種子與位置・達成目標才算通關・部分關卡含必遇抉擇・進度獨立於自由遊玩
                </p>
              </div>
              <TouchButton
                label="關閉"
                ariaLabel="關閉生涯挑戰"
                onClick={() => setShowChallenges(false)}
                className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-3 text-xs font-bold text-slate-200"
              />
            </div>

            <TouchButton
              label={
                challengeProgress.clearedCount >= packTotal
                  ? '重玩最終關'
                  : challengeProgress.clearedCount > 0
                    ? `繼續・${CAREER_CHALLENGES[packContinue]?.name}`
                    : '開始第一關'
              }
              ariaLabel="繼續生涯挑戰"
              onClick={() => {
                const challenge = CAREER_CHALLENGES[packContinue];
                if (!challenge) return;
                setShowChallenges(false);
                onStartChallenge(challenge.id);
              }}
              className="mt-4 w-full rounded-xl bg-sky-500 px-4 text-sm font-black text-slate-950"
            />

            <ul className="mt-4 space-y-2 overflow-y-auto pr-1">
              {CAREER_CHALLENGES.map((challenge, index) => {
                const unlocked = isChallengeUnlocked(index, challengeProgress.clearedCount);
                const done = Boolean(challengeProgress.cleared[challenge.id]);
                const best = challengeProgress.bestHof[challenge.id];
                const positionLabel =
                  POSITIONS.find((p) => p.id === challenge.position)?.label ?? challenge.position;
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
                      className="bl-choice flex min-h-16 w-full flex-col px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-45"
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
                            <span className="ml-2 text-slate-500">
                              {positionLabel}・
                              <span className="font-mono">{challenge.seedCode}</span>
                            </span>
                          </span>
                          {challenge.situationHooks && challenge.situationHooks.length > 0 && (
                            <span className="mt-1 text-[11px] text-amber-200/85">
                              含固定回合必遇抉擇
                              {challenge.requirePicks && challenge.requirePicks.length > 0
                                ? '・通關需特定選項'
                                : ''}
                            </span>
                          )}
                          {best !== undefined && (
                            <span className="mt-1 font-mono text-[10px] text-amber-300/80">
                              最佳積分 {best}
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

      {showRecords && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/75 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="bl-records-title"
          onClick={() => setShowRecords(false)}
        >
          <div
            className="bl-card flex max-h-[85vh] w-full max-w-lg flex-col p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="bl-records-title" className="text-xl font-black text-amber-300">
                  紀錄牆
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  位置最佳與歷代球員可點擊，帶種子碼開新人生
                </p>
              </div>
              <TouchButton
                label="關閉"
                ariaLabel="關閉紀錄牆"
                onClick={() => setShowRecords(false)}
                className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-3 text-xs font-bold text-slate-200"
              />
            </div>

            <section className="mt-4">
              <h3 className="text-xs font-bold tracking-wider text-slate-400">位置別最佳名人堂積分</h3>
              <ul className="mt-2 space-y-2">
                {POSITIONS.map((pos) => {
                  const best = records.bestByPosition[pos.id];
                  if (!best) {
                    return (
                      <li
                        key={pos.id}
                        className="rounded-xl border border-slate-700/70 bg-slate-900/40 px-3 py-3 text-xs text-slate-500"
                      >
                        <span className="font-bold text-slate-400">{pos.label}</span>
                        <span className="ml-2">尚無紀錄</span>
                      </li>
                    );
                  }
                  return (
                    <li key={pos.id}>
                      <button
                        type="button"
                        onClick={() => replaySeed(best.seedCode)}
                        className="bl-choice flex min-h-14 w-full flex-col px-3 py-3 text-left"
                        aria-label={`用種子 ${best.seedCode} 重玩 ${pos.label} 最佳 ${best.name}`}
                      >
                        <span className="flex w-full items-center justify-between gap-2">
                          <span className="text-sm font-bold text-slate-100">
                            {pos.label}
                            <span className="ml-2 font-normal text-slate-300">{best.name}</span>
                          </span>
                          <span className="shrink-0 font-mono text-xs font-bold text-amber-300">
                            {best.hofScore}
                          </span>
                        </span>
                        <span className="mt-1 text-[11px] text-slate-400">
                          <span className="font-mono text-amber-200/80">{best.seedCode}</span>
                          <span className="ml-2">{best.verdict}</span>
                          <span className="ml-2 text-amber-300/70">點擊重玩</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="mt-5">
              <h3 className="text-xs font-bold tracking-wider text-slate-400">通算里程碑</h3>
              <ul className="mt-2 grid grid-cols-2 gap-2">
                {(
                  [
                    ['生涯門檻', records.milestoneCounts.career],
                    ['單場壯舉', records.milestoneCounts.feat],
                    ['名人堂結局', records.milestoneCounts.hof],
                    ['首輪入選', records.milestoneCounts.firstBallot],
                  ] as const
                ).map(([label, value]) => (
                  <li
                    key={label}
                    className="rounded-xl border border-slate-700/70 bg-slate-900/40 px-3 py-3"
                  >
                    <p className="text-[11px] text-slate-500">{label}</p>
                    <p className="mt-0.5 font-mono text-lg font-bold text-amber-200">{value}</p>
                  </li>
                ))}
              </ul>
              {achievements.bestHof > 0 && (
                <p className="mt-2 text-[11px] text-slate-500">
                  生涯最高名人堂積分{' '}
                  <span className="font-mono text-amber-300">{achievements.bestHof}</span>
                  <span className="ml-2">・已完成 {achievements.careers} 段人生</span>
                </p>
              )}
            </section>

            {archive.length > 0 && (
              <section className="mt-5 min-h-0 flex-1 overflow-hidden">
                <h3 className="text-xs font-bold tracking-wider text-slate-400">歷代球員</h3>
                <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto pr-1">
                  {archive.map((entry, index) => (
                    <li key={`${entry.seedCode}-wall-${index}`}>
                      <button
                        type="button"
                        onClick={() => replaySeed(entry.seedCode)}
                        className="flex min-h-11 w-full items-baseline justify-between gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-800/60"
                        aria-label={`用種子 ${entry.seedCode} 重玩 ${entry.name}`}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-100">
                            {entry.name}
                            <span className="ml-2 text-xs font-normal text-slate-400">
                              {entry.position}
                            </span>
                          </p>
                          <p className="truncate font-mono text-[11px] text-slate-500">
                            {entry.seedCode}
                            <span className="ml-2 font-sans text-amber-300/70">點擊重玩</span>
                          </p>
                        </div>
                        <span className="shrink-0 text-right text-[11px] text-amber-300">
                          <span className="block font-mono">{entry.hofScore}</span>
                          <span className="block text-slate-500">{entry.verdict}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

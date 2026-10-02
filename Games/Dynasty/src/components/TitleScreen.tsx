import React, { useMemo, useState } from 'react';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import {
  CAREER_CHALLENGES,
  challengeCount,
  clubNameForChallenge,
  continueChallengeIndex,
  isChallengeUnlocked,
} from '../game/challenges';
import type { ChallengeProgress } from '../game/challenges';
import { CLUBS } from '../game/config';
import { hasAnyRecords, totalMilestoneHits } from '../game/records';
import type { PersonalRecords } from '../game/records';
import { normalizeSeedCode, randomSeedCode } from '../game/rng';
import type { ArchiveEntry } from '../game/storage';

interface Props {
  initialSeed: string;
  hasSave: boolean;
  archive: ArchiveEntry[];
  challengeProgress: ChallengeProgress;
  records: PersonalRecords;
  onShowHowTo: () => void;
  onStart: (seedCode: string, gmName: string, teamId: string) => void;
  onStartChallenge: (challengeId: string, gmName: string) => void;
  onContinue: () => void;
}

export function TitleScreen({
  initialSeed,
  hasSave,
  archive,
  challengeProgress,
  records,
  onShowHowTo,
  onStart,
  onStartChallenge,
  onContinue,
}: Props): React.ReactElement {
  const [seed, setSeed] = useState(initialSeed);
  const [name, setName] = useState('');
  const [teamId, setTeamId] = useState(CLUBS[4].id);
  const [showChallenges, setShowChallenges] = useState(false);
  const [showRecords, setShowRecords] = useState(false);

  const packTotal = challengeCount();
  const packContinue = continueChallengeIndex(challengeProgress.clearedCount);
  const packSubtitle = useMemo(() => {
    if (challengeProgress.clearedCount >= packTotal) return `已完成 ${packTotal}/${packTotal}`;
    if (challengeProgress.clearedCount > 0) {
      return `進度 ${challengeProgress.clearedCount}/${packTotal}・繼續`;
    }
    return `固定種子 ${packTotal} 關・開始`;
  }, [challengeProgress.clearedCount, packTotal]);

  const showRecordsCta = hasAnyRecords(records, archive.length);
  const milestoneTotal = totalMilestoneHits(records.milestoneCounts);
  const bestFilled = CLUBS.filter((c) => records.bestByClub[c.id]).length;

  const replaySeed = (code: string, replayTeamId?: string) => {
    setShowRecords(false);
    onStart(normalizeSeedCode(code), name, replayTeamId ?? teamId);
  };

  return (
    <div
      className="dy-title-shell"
      style={{
        backgroundImage: [
          'linear-gradient(rgba(6, 18, 14, 0.52), rgba(6, 18, 14, 0.94))',
          `url(${import.meta.env.BASE_URL}title-bg.jpg)`,
        ].join(', '),
      }}
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 px-4 pb-16 pt-14">
      <header className="dy-title-hero mt-3 text-center">
        <p className="text-sm tracking-[0.4em] text-slate-300">DYNASTY</p>
        <h1 className="mt-2 text-4xl font-black text-emerald-300 sm:text-5xl">球團王朝</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-200">
          你是總管，任期十年。
          <br />
          贏球要花錢，而錢來自贏球。董事會的耐心是有限的。
        </p>
      </header>

      <section className="dy-card p-4">
        <label className="block text-xs font-semibold tracking-wider text-slate-400" htmlFor="seed-input">
          世界種子碼
        </label>
        <p className="mt-1 text-xs text-slate-500">
          決定聯盟初始名單、每年的選秀梯隊與所有隨機事件。相同種子碼 ＋ 相同決策 ＝ 相同的十年。
        </p>
        <div className="mt-3 flex gap-2">
          <input
            id="seed-input"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="min-h-11 w-full rounded-xl border border-slate-600 bg-slate-900/70 px-3 font-mono text-base text-emerald-200 outline-none focus:border-emerald-400"
            placeholder="例如 dyn2026a"
          />
          <TouchButton
            label="重骰"
            ariaLabel="隨機產生新的種子碼"
            onClick={() => setSeed(randomSeedCode())}
            className="shrink-0 rounded-xl border border-slate-600 bg-slate-800 px-4 text-sm font-bold text-slate-200"
          />
        </div>
      </section>

      <section className="dy-card p-4">
        <label className="block text-xs font-semibold tracking-wider text-slate-400" htmlFor="gm-input">
          總管姓名
        </label>
        <input
          id="gm-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={12}
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-600 bg-slate-900/70 px-3 text-base text-slate-100 outline-none focus:border-emerald-400"
          placeholder="留空則叫做「無名總管」"
        />
      </section>

      <section className="dy-card p-4">
        <h2 className="text-xs font-semibold tracking-wider text-slate-400">選擇球團</h2>
        <p className="mt-1 text-[11px] text-slate-500">初始戰力與財務差很多，難度也差很多。</p>
        <div className="mt-3 flex flex-col gap-2">
          {CLUBS.map((club) => (
            <button
              key={club.id}
              type="button"
              onClick={() => setTeamId(club.id)}
              aria-pressed={teamId === club.id}
              className="dy-choice px-3 py-3 text-left"
              style={
                teamId === club.id
                  ? { borderColor: '#34d399', background: 'rgba(6,78,59,0.45)' }
                  : undefined
              }
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-2 min-w-0">
                  <img
                    src={`${import.meta.env.BASE_URL}clubs/${club.id}.svg`}
                    alt={club.name}
                    aria-hidden="true"
                    className="w-5 h-5 flex-none"
                  />
                  <span className="text-sm font-bold text-slate-100 truncate">{club.name}</span>
                </span>
                <span className="shrink-0 font-mono text-[10px] text-slate-500">
                  戰力 {club.strength >= 0 ? `+${club.strength}` : club.strength}・資金{' '}
                  {(club.cash / 10000).toFixed(1)} 億
                </span>
              </span>
              <span className="mt-1 block text-xs leading-snug text-slate-400">{club.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <TouchButton
          label="接下總管職務"
          ariaLabel="接下總管職務並開始遊戲"
          onClick={() => onStart(normalizeSeedCode(seed), name, teamId)}
          className="w-full rounded-xl bg-emerald-500 px-4 text-base font-black text-slate-950"
        />
        <TouchButton
          label="生涯挑戰"
          ariaLabel={`開啟生涯挑戰。${packSubtitle}`}
          onClick={() => setShowChallenges(true)}
          className="w-full rounded-xl border border-sky-500/50 bg-sky-500/15 px-4 text-base font-bold text-sky-100"
        />
        <p className="-mt-1 text-center text-[11px] text-slate-500">{packSubtitle}</p>
        {showRecordsCta && (
          <>
            <TouchButton
              label="紀錄牆"
              ariaLabel={`開啟紀錄牆。球團最佳 ${bestFilled}/6・里程碑 ${milestoneTotal}`}
              onClick={() => setShowRecords(true)}
              className="w-full rounded-xl border border-amber-500/45 bg-amber-500/10 px-4 text-base font-bold text-amber-100"
            />
            <p className="-mt-1 text-center text-[11px] text-slate-500">
              球團最佳 {bestFilled}/6・里程碑 {milestoneTotal}
            </p>
          </>
        )}
        <TouchButton
          label="操作教學"
          ariaLabel="開啟操作教學"
          onClick={onShowHowTo}
          className="w-full rounded-xl border border-slate-600 bg-slate-800/80 px-4 text-base font-bold text-slate-200"
        />
        {hasSave && (
          <TouchButton
            label="繼續上次的任期"
            ariaLabel="繼續上次的任期"
            onClick={onContinue}
            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 text-base font-bold text-slate-100"
          />
        )}
      </div>

      {archive.length > 0 && (
        <section className="dy-card p-4">
          <h2 className="text-sm font-bold text-slate-300">歷代總管</h2>
          <ul className="mt-2 divide-y divide-slate-700/60">
            {archive.slice(0, 6).map((entry, index) => {
              const entryTeamId =
                CLUBS.find((c) => c.name === entry.club)?.id ??
                CLUBS.find((c) => c.id === entry.club)?.id;
              return (
              <li key={`${entry.seedCode}-${index}`}>
                <button
                  type="button"
                  onClick={() => replaySeed(entry.seedCode, entryTeamId)}
                  className="flex w-full items-baseline justify-between gap-3 py-2 text-left"
                  aria-label={`用種子碼 ${entry.seedCode} 重玩`}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-100">
                      {entry.gmName}
                      <span className="ml-2 text-xs font-normal text-slate-400">{entry.club}</span>
                    </p>
                    <p className="truncate font-mono text-xs text-slate-500">{entry.seedCode}</p>
                  </div>
                  <span className="shrink-0 text-right text-xs text-emerald-300">
                    {entry.verdict}
                    {entry.titles > 0 && <span className="ml-1 text-amber-300">🏆{entry.titles}</span>}
                  </span>
                </button>
              </li>
              );
            })}
          </ul>
          <p className="mt-2 text-[11px] text-slate-500">點一列即可用該種子碼自由重玩。</p>
        </section>
      )}
      </div>

      {showChallenges && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/75 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dy-challenge-title"
          onClick={() => setShowChallenges(false)}
        >
          <div
            className="dy-card flex max-h-[85vh] w-full max-w-lg flex-col p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="dy-challenge-title" className="text-xl font-black text-emerald-300">
                  生涯挑戰
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  固定種子與球團・達成目標才算通關・進度獨立於自由遊玩
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
                onStartChallenge(challenge.id, name);
              }}
              className="mt-4 w-full rounded-xl bg-sky-500 px-4 text-sm font-black text-slate-950"
            />

            <ul className="mt-4 space-y-2 overflow-y-auto pr-1">
              {CAREER_CHALLENGES.map((challenge, index) => {
                const unlocked = isChallengeUnlocked(index, challengeProgress.clearedCount);
                const done = Boolean(challengeProgress.cleared[challenge.id]);
                const best = challengeProgress.bestScore[challenge.id];
                const clubLabel = clubNameForChallenge(challenge.teamId);
                return (
                  <li key={challenge.id}>
                    <button
                      type="button"
                      disabled={!unlocked}
                      onClick={() => {
                        if (!unlocked) return;
                        setShowChallenges(false);
                        onStartChallenge(challenge.id, name);
                      }}
                      className="dy-choice flex min-h-16 w-full flex-col px-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-45"
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
                              {clubLabel}・
                              <span className="font-mono">{challenge.seedCode}</span>
                            </span>
                          </span>
                          {best !== undefined && (
                            <span className="mt-1 font-mono text-[10px] text-amber-300/80">
                              最佳分數 {best}
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
          aria-labelledby="dy-records-title"
          onClick={() => setShowRecords(false)}
        >
          <div
            className="dy-card flex max-h-[85vh] w-full max-w-lg flex-col p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="dy-records-title" className="text-xl font-black text-amber-300">
                  紀錄牆
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  各球團最佳任期・點一列可用該種子碼自由重玩
                </p>
              </div>
              <TouchButton
                label="關閉"
                ariaLabel="關閉紀錄牆"
                onClick={() => setShowRecords(false)}
                className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-3 text-xs font-bold text-slate-200"
              />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {(
                [
                  ['任期', records.milestoneCounts.tenures],
                  ['撐完', records.milestoneCounts.survived],
                  ['總冠軍', records.milestoneCounts.titles],
                  ['名總管', records.milestoneCounts.namedGm],
                  ['王朝', records.milestoneCounts.dynasty],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-700/70 bg-slate-900/50 px-3 py-2 text-center">
                  <p className="text-[10px] text-slate-500">{label}</p>
                  <p className="font-mono text-lg font-bold text-amber-200">{value}</p>
                </div>
              ))}
            </div>

            <ul className="mt-4 space-y-2 overflow-y-auto pr-1">
              {CLUBS.map((club) => {
                const best = records.bestByClub[club.id];
                return (
                  <li key={club.id}>
                    <button
                      type="button"
                      disabled={!best}
                      onClick={() => {
                        if (!best) return;
                        replaySeed(best.seedCode, best.teamId);
                      }}
                      className="dy-choice flex min-h-14 w-full flex-col px-3 py-3 text-left disabled:cursor-default disabled:opacity-50"
                    >
                      <span className="flex w-full items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-100">{club.name}</span>
                        {best ? (
                          <span className="font-mono text-[11px] text-amber-300">分數 {best.score}</span>
                        ) : (
                          <span className="text-[11px] text-slate-500">尚無紀錄</span>
                        )}
                      </span>
                      {best && (
                        <span className="mt-1 text-[11px] text-slate-400">
                          {best.gmName}・{best.verdict}
                          {best.titles > 0 ? `・冠 ${best.titles}` : ''}
                          <span className="ml-2 font-mono text-slate-500">{best.seedCode}</span>
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>

            {archive.length > 0 && (
              <>
                <h3 className="mt-4 text-xs font-bold tracking-wider text-slate-400">歷代總管（點列重玩）</h3>
                <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1">
                  {archive.slice(0, 12).map((entry, index) => {
                    const entryTeamId =
                      CLUBS.find((c) => c.name === entry.club)?.id ??
                      CLUBS.find((c) => c.id === entry.club)?.id;
                    return (
                    <li key={`rec-${entry.seedCode}-${index}`}>
                      <button
                        type="button"
                        onClick={() => replaySeed(entry.seedCode, entryTeamId)}
                        className="flex w-full items-baseline justify-between gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-800/60"
                      >
                        <span className="min-w-0 truncate text-xs text-slate-200">
                          {entry.gmName}
                          <span className="ml-1 text-slate-500">{entry.club}</span>
                          <span className="ml-2 font-mono text-slate-500">{entry.seedCode}</span>
                        </span>
                        <span className="shrink-0 text-[11px] text-emerald-300">{entry.verdict}</span>
                      </button>
                    </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

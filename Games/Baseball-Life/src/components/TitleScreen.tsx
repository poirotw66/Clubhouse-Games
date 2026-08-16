import React, { useState } from 'react';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import { ACHIEVEMENTS, progressOf } from '../game/achievements';
import type { AchievementProgress } from '../game/achievements';
import { normalizeSeedCode, randomSeedCode } from '../game/rng';
import type { ArchiveEntry } from '../game/storage';
import { traitById } from '../game/traits';

interface Props {
  initialSeed: string;
  hasSave: boolean;
  archive: ArchiveEntry[];
  achievements: AchievementProgress;
  onStart: (seedCode: string) => void;
  onContinue: () => void;
}

export function TitleScreen({
  initialSeed,
  hasSave,
  archive,
  achievements,
  onStart,
  onContinue,
}: Props): React.ReactElement {
  const [seed, setSeed] = useState(initialSeed);
  const [showAchievements, setShowAchievements] = useState(false);
  const earned = ACHIEVEMENTS.filter((a) => achievements.unlocked[a.id]).length;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center gap-6 px-4 py-14">
      <header className="text-center">
        <p className="text-sm tracking-[0.4em] text-slate-400">BASEBALL LIFE</p>
        <h1 className="mt-2 text-4xl font-black text-amber-300 sm:text-5xl">棒球人生</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-300">
          16 歲的春天，你走進高中棒球部。
          <br />
          三年的練習、四場全國賽、一次選秀，決定接下來的二十年。
        </p>
      </header>

      <section className="bl-card p-4">
        <label className="block text-xs font-semibold tracking-wider text-slate-400" htmlFor="seed-input">
          世界種子碼
        </label>
        <p className="mt-1 text-xs text-slate-500">
          相同種子碼 ＋ 相同選擇 ＝ 相同人生。把種子碼傳給朋友，比比看誰走得更遠。
        </p>
        <div className="mt-3 flex gap-2">
          <input
            id="seed-input"
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="min-h-11 w-full rounded-xl border border-slate-600 bg-slate-900/70 px-3 font-mono text-base text-amber-200 outline-none focus:border-amber-400"
            placeholder="例如 64aa2bl7"
          />
          <TouchButton
            label="重骰"
            ariaLabel="隨機產生新的種子碼"
            onClick={() => setSeed(randomSeedCode())}
            className="shrink-0 rounded-xl border border-slate-600 bg-slate-800 px-4 text-sm font-bold text-slate-200"
          />
        </div>
      </section>

      <div className="flex flex-col gap-3">
        <TouchButton
          label="開始新的棒球人生"
          ariaLabel="開始新的棒球人生"
          onClick={() => onStart(normalizeSeedCode(seed))}
          className="w-full rounded-xl bg-amber-500 px-4 text-base font-black text-slate-950"
        />
        {hasSave && (
          <TouchButton
            label="繼續上次的人生"
            ariaLabel="繼續上次的人生"
            onClick={onContinue}
            className="w-full rounded-xl border border-slate-600 bg-slate-800 px-4 text-base font-bold text-slate-100"
          />
        )}
      </div>

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
          <h2 className="text-sm font-bold text-slate-300">歷代球員</h2>
          <ul className="mt-2 divide-y divide-slate-700/60">
            {archive.slice(0, 6).map((entry, index) => (
              <li key={`${entry.seedCode}-${index}`} className="flex items-baseline justify-between gap-3 py-2">
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
                  </p>
                </div>
                <span className="shrink-0 text-xs text-amber-300">{entry.verdict}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

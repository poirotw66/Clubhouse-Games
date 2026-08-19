import React, { useState } from 'react';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import { CLUBS } from '../game/config';
import { normalizeSeedCode, randomSeedCode } from '../game/rng';
import type { ArchiveEntry } from '../game/storage';

interface Props {
  initialSeed: string;
  hasSave: boolean;
  archive: ArchiveEntry[];
  onStart: (seedCode: string, gmName: string, teamId: string) => void;
  onContinue: () => void;
}

export function TitleScreen({ initialSeed, hasSave, archive, onStart, onContinue }: Props): React.ReactElement {
  const [seed, setSeed] = useState(initialSeed);
  const [name, setName] = useState('');
  const [teamId, setTeamId] = useState(CLUBS[4].id);

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
            {archive.slice(0, 6).map((entry, index) => (
              <li key={`${entry.seedCode}-${index}`} className="flex items-baseline justify-between gap-3 py-2">
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
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
    </div>
  );
}

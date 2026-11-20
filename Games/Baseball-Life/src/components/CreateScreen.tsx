import React, { useMemo, useState } from 'react';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import type { CareerChallenge } from '../game/challenges';
import { POSITIONS } from '../game/config';
import { rollOrigins } from '../game/engine';
import { legacyCompatible } from '../game/legacy';
import type { LegacyOption, PendingLegacy } from '../game/legacy';
import type { Position } from '../game/types';
import { sceneBackgroundStyle } from '../sceneBackground';

interface Props {
  seedCode: string;
  challenge?: CareerChallenge | null;
  pendingLegacy?: PendingLegacy | null;
  onCreate: (input: {
    name: string;
    position: Position;
    originId: string;
    legacy?: LegacyOption | null;
  }) => void;
  onBack: () => void;
}

export function CreateScreen({
  seedCode,
  challenge,
  pendingLegacy,
  onCreate,
  onBack,
}: Props): React.ReactElement {
  const lockedPosition = challenge?.position;
  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>(lockedPosition ?? 'OF');
  // The three origins are drawn from the seed, so they are part of the world,
  // not a fresh roll each time the player changes their mind about position.
  const origins = useMemo(() => rollOrigins(seedCode), [seedCode]);
  const [originId, setOriginId] = useState(origins[0].id);
  const [legacyId, setLegacyId] = useState<string | 'skip' | null>(
    pendingLegacy ? pendingLegacy.options[0]?.id ?? 'skip' : null,
  );
  const positionChoices = lockedPosition
    ? POSITIONS.filter((p) => p.id === lockedPosition)
    : POSITIONS;

  const legacyOptions = useMemo(() => {
    if (!pendingLegacy || challenge) return [];
    return pendingLegacy.options.filter((o) =>
      legacyCompatible(o, lockedPosition ?? position),
    );
  }, [pendingLegacy, challenge, lockedPosition, position]);

  return (
    <div className="bl-title-shell min-h-screen" style={sceneBackgroundStyle('highschool')}>
      <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-14">
      <header className="bl-title-hero mt-3 overflow-hidden rounded-2xl border border-amber-500/30 bg-slate-900/80 shadow-xl">
        <div className="relative h-32 w-full overflow-hidden sm:h-40">
          <img
            src={`${import.meta.env.BASE_URL}chapter-highschool.jpg`}
            alt="高中野球甲子園青春球場"
            className="h-full w-full object-cover object-center filter brightness-90 contrast-110"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          <div className="absolute bottom-2.5 left-4 right-4 flex items-end justify-between">
            <div>
              <p className="text-xs font-bold tracking-[0.25em] text-amber-300 drop-shadow">
                HIGH SCHOOL BASEBALL · 啟程之章
              </p>
              <h1 className="mt-0.5 text-xl font-black text-white drop-shadow sm:text-2xl">
                {challenge ? challenge.name : '建立球員'}
              </h1>
            </div>
            <p className="font-mono text-xs text-amber-300 drop-shadow">
              種子碼 {seedCode}
            </p>
          </div>
        </div>
        {challenge && (
          <div className="border-t border-sky-500/30 bg-sky-950/50 p-3">
            <p className="text-xs font-semibold text-sky-200">
              生涯挑戰目標：{challenge.goalLabel}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">{challenge.blurb}</p>
          </div>
        )}
      </header>

      {legacyOptions.length > 0 && pendingLegacy && (
        <section className="bl-card border border-amber-500/30 p-4">
          <h2 className="text-xs font-semibold tracking-wider text-amber-300">遺產・New Game+</h2>
          <p className="mt-1 text-[11px] text-slate-400">
            來自 {pendingLegacy.fromName}（名人堂 {pendingLegacy.fromHof}）的傳承。選一項帶走，或跳過。
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {legacyOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setLegacyId(option.id)}
                aria-pressed={legacyId === option.id}
                className="bl-choice px-3 py-3 text-left"
                style={
                  legacyId === option.id
                    ? { borderColor: '#fbbf24', background: 'rgba(120,72,10,0.35)' }
                    : undefined
                }
              >
                <span className="block text-sm font-bold text-slate-100">{option.label}</span>
                <span className="mt-1 block text-xs leading-snug text-slate-400">{option.hint}</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setLegacyId('skip')}
              aria-pressed={legacyId === 'skip'}
              className="bl-choice px-3 py-3 text-left"
              style={
                legacyId === 'skip'
                  ? { borderColor: '#fbbf24', background: 'rgba(120,72,10,0.35)' }
                  : undefined
              }
            >
              <span className="block text-sm font-bold text-slate-100">不繼承</span>
              <span className="mt-1 block text-xs leading-snug text-slate-400">
                從空白開始。遺產會保留到下次開局。
              </span>
            </button>
          </div>
        </section>
      )}

      <section className="bl-card p-4">
        <label className="block text-xs font-semibold tracking-wider text-slate-400" htmlFor="name-input">
          姓名
        </label>
        <input
          id="name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={12}
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-600 bg-slate-900/70 px-3 text-base text-slate-100 outline-none focus:border-amber-400"
          placeholder="留空則叫做「無名球兒」"
        />
      </section>

      <section className="bl-card p-4">
        <h2 className="text-xs font-semibold tracking-wider text-slate-400">守備位置</h2>
        {lockedPosition && (
          <p className="mt-1 text-[11px] text-slate-500">此挑戰鎖定守備位置，不能更換。</p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {positionChoices.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPosition(p.id)}
              aria-pressed={position === p.id}
              className="bl-choice min-h-16 px-3 py-2 text-left"
              style={position === p.id ? { borderColor: '#fbbf24', background: 'rgba(120,72,10,0.35)' } : undefined}
            >
              <span className="block text-base font-bold text-slate-100">{p.label}</span>
              <span className="mt-0.5 block text-[11px] leading-snug text-slate-400">{p.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="bl-card p-4">
        <h2 className="text-xs font-semibold tracking-wider text-slate-400">出身</h2>
        <p className="mt-1 text-[11px] text-slate-500">由種子碼決定的三張出身牌。</p>
        <div className="mt-3 flex flex-col gap-2">
          {origins.map((origin) => (
            <button
              key={origin.id}
              type="button"
              onClick={() => setOriginId(origin.id)}
              aria-pressed={originId === origin.id}
              className="bl-choice px-3 py-3 text-left"
              style={originId === origin.id ? { borderColor: '#fbbf24', background: 'rgba(120,72,10,0.35)' } : undefined}
            >
              <span className="block text-sm font-bold text-slate-100">{origin.label}</span>
              <span className="mt-1 block text-xs leading-snug text-slate-400">{origin.blurb}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="flex gap-3">
        <TouchButton
          label="返回"
          ariaLabel="返回標題畫面"
          onClick={onBack}
          className="rounded-xl border border-slate-600 bg-slate-800 px-5 text-sm font-bold text-slate-200"
        />
        <TouchButton
          label={challenge ? '接受挑戰' : '入部'}
          ariaLabel={challenge ? '建立球員並開始生涯挑戰' : '建立球員並開始遊戲'}
          onClick={() => {
            const chosen =
              legacyId && legacyId !== 'skip'
                ? legacyOptions.find((o) => o.id === legacyId) ?? null
                : null;
            onCreate({
              name,
              position: lockedPosition ?? position,
              originId,
              legacy: chosen,
            });
          }}
          className="flex-1 rounded-xl bg-amber-500 px-4 text-base font-black text-slate-950"
        />
      </div>
      </div>
    </div>
  );
}

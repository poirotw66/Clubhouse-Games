import React, { useMemo, useState } from 'react';
import { TouchButton } from '@clubhouse/shared/TouchButton';
import { POSITIONS } from '../game/config';
import { rollOrigins } from '../game/engine';
import type { Position } from '../game/types';

interface Props {
  seedCode: string;
  onCreate: (input: { name: string; position: Position; originId: string }) => void;
  onBack: () => void;
}

export function CreateScreen({ seedCode, onCreate, onBack }: Props): React.ReactElement {
  const [name, setName] = useState('');
  const [position, setPosition] = useState<Position>('OF');
  // The three origins are drawn from the seed, so they are part of the world,
  // not a fresh roll each time the player changes their mind about position.
  const origins = useMemo(() => rollOrigins(seedCode), [seedCode]);
  const [originId, setOriginId] = useState(origins[0].id);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-5 px-4 py-14">
      <header className="mt-3">
        <p className="text-xs tracking-[0.3em] text-slate-500">
          種子碼 <span className="font-mono text-amber-300">{seedCode}</span>
        </p>
        <h1 className="mt-1 text-2xl font-black text-amber-300">建立球員</h1>
      </header>

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
        <div className="mt-3 grid grid-cols-2 gap-2">
          {POSITIONS.map((p) => (
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
          label="入部"
          ariaLabel="建立球員並開始遊戲"
          onClick={() => onCreate({ name, position, originId })}
          className="flex-1 rounded-xl bg-amber-500 px-4 text-base font-black text-slate-950"
        />
      </div>
    </div>
  );
}

import {useMemo, useState} from 'react';
import {CHARACTERS, DIFFICULTIES, type DifficultyId} from '../data/characters';
import {TRACKS} from '../data/tracks';
import {kartBricks} from '../engine/models';
import {bestLapKey, formatTime, type RaceMode, type RaceOptions} from '../engine/race';
import {BrickPreview} from './BrickPreview';
import {hasSeenHowTo, HowToOverlay} from './HowToOverlay';

interface Props {
  charId: string;
  trackId: string;
  difficulty: DifficultyId;
  options: RaceOptions;
  bestTimes: Record<string, number>;
  onChar: (id: string) => void;
  onTrack: (id: string) => void;
  onDifficulty: (id: DifficultyId) => void;
  onOptions: (patch: Partial<RaceOptions>) => void;
  onStart: () => void;
}

function StatBar({label, value}: {label: string; value: number}) {
  const pct = Math.max(6, Math.min(100, ((value - 0.8) / 0.5) * 100));
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 shrink-0 text-[11px] text-slate-400">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-700">
        <span className="block h-full rounded-full bg-amber-400" style={{width: `${pct}%`}} />
      </span>
    </div>
  );
}

function ToggleChip({
  active,
  label,
  onClick,
  disabled,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={`flex-1 min-h-[44px] rounded-xl border-2 py-2 text-sm font-bold transition touch-manipulation disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-amber-400 bg-amber-400 text-slate-950'
          : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
      }`}
    >
      {label}
    </button>
  );
}

export function MainMenu({
  charId,
  trackId,
  difficulty,
  options,
  bestTimes,
  onChar,
  onTrack,
  onDifficulty,
  onOptions,
  onStart,
}: Props) {
  const character = CHARACTERS.find((c) => c.id === charId) ?? CHARACTERS[0];
  const bricks = useMemo(() => kartBricks(character), [character]);
  const timeTrial = options.mode === 'timeTrial';
  const itemsOn = !timeTrial && options.itemsEnabled;
  const [showHowTo, setShowHowTo] = useState(() => !hasSeenHowTo());

  return (
    <div
      className="min-h-full w-full overflow-y-auto px-4 py-14 text-slate-100 bg-cover bg-center"
      style={{
        backgroundColor: '#020617',
        backgroundImage: [
          'linear-gradient(rgba(2,6,23,0.78), rgba(2,6,23,0.9))',
          `url(${import.meta.env.BASE_URL}menu-bg.jpg)`,
        ].join(', '),
      }}
    >
      {showHowTo && (
        <HowToOverlay itemsEnabled={itemsOn} onClose={() => setShowHowTo(false)} />
      )}
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-8 text-center">
          <p className="text-xs font-bold tracking-[0.35em] text-amber-400">CLUBHOUSE GAMES</p>
          <img
            src="./title-logo.svg"
            alt="Brick Kart Racing"
            className="mx-auto mt-3 w-full max-w-md"
          />
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            <span className="text-amber-400">積木</span>賽車
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {timeTrial ? '獨自刷新單圈 — 無對手、無道具' : '飄移蓄力、道具攻防，搶下 3 圈第一名'}
          </p>
          <button
            type="button"
            onClick={() => setShowHowTo(true)}
            className="mt-3 text-xs font-bold text-amber-400/90 underline-offset-2 hover:underline"
          >
            操作教學
          </button>
        </header>

        <section className="mb-6">
          <h2 className="mb-3 text-sm font-bold tracking-widest text-slate-400">賽事模式</h2>
          <div className="flex gap-3">
            <ToggleChip
              label="對戰賽"
              active={options.mode === 'versus'}
              onClick={() => onOptions({mode: 'versus' as RaceMode})}
            />
            <ToggleChip
              label="計時賽"
              active={timeTrial}
              onClick={() => onOptions({mode: 'timeTrial' as RaceMode, itemsEnabled: false})}
            />
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-sm font-bold tracking-widest text-slate-400">變化規則</h2>
          <div className="flex flex-col gap-3 sm:flex-row">
            <ToggleChip
              label={options.mirror ? '鏡像賽道 ON' : '鏡像賽道'}
              active={options.mirror}
              onClick={() => onOptions({mirror: !options.mirror})}
            />
            <ToggleChip
              label={itemsOn ? '道具 ON' : '道具 OFF'}
              active={itemsOn}
              disabled={timeTrial}
              onClick={() => onOptions({itemsEnabled: !options.itemsEnabled})}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            計時賽固定關閉道具與電腦對手；鏡像會左右翻轉賽道。
          </p>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-sm font-bold tracking-widest text-slate-400">選擇車手</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {CHARACTERS.map((c) => {
              const active = c.id === charId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChar(c.id)}
                  aria-pressed={active}
                  className={`rounded-2xl border-2 p-3 text-left transition ${
                    active
                      ? 'border-amber-400 bg-slate-800 shadow-lg shadow-amber-500/10'
                      : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                  }`}
                >
                  <div className="flex justify-center">
                    <img
                      src={`${import.meta.env.BASE_URL}portraits/${c.id}.jpg`}
                      alt=""
                      className="h-[84px] w-[84px] rounded-xl object-cover border border-white/10"
                      draggable={false}
                    />
                  </div>
                  <p className="mt-1 text-center text-sm font-bold">{c.name}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mb-6 grid gap-4 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:grid-cols-[auto_1fr] sm:items-center">
          <div className="flex justify-center">
            <BrickPreview bricks={bricks} size={150} spin />
          </div>
          <div>
            <p className="text-lg font-bold">{character.name}</p>
            <p className="mb-3 text-sm text-slate-400">{character.blurb}</p>
            <div className="space-y-1.5">
              <StatBar label="極速" value={character.topSpeed} />
              <StatBar label="加速" value={character.accel} />
              <StatBar label="操控" value={character.grip} />
              <StatBar label="重量" value={character.weight} />
            </div>
          </div>
        </section>

        <section className="mb-6">
          <h2 className="mb-3 text-sm font-bold tracking-widest text-slate-400">選擇賽道</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {TRACKS.map((t) => {
              const active = t.id === trackId;
              const best = bestTimes[bestLapKey(t.id, options, difficulty)];
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onTrack(t.id)}
                  aria-pressed={active}
                  className={`rounded-2xl border-2 p-3 text-left transition ${
                    active
                      ? 'border-amber-400 bg-slate-800 shadow-lg shadow-amber-500/10'
                      : 'border-slate-800 bg-slate-900 hover:border-slate-600'
                  }`}
                >
                  <div className="flex justify-center overflow-hidden rounded-xl">
                    <img
                      src={`${import.meta.env.BASE_URL}tracks/${t.id}.jpg`}
                      alt=""
                      className="h-[116px] w-full object-cover"
                      draggable={false}
                    />
                  </div>
                  <p className="mt-1 font-bold">
                    {t.name}
                    {options.mirror ? ' · 鏡像' : ''}
                  </p>
                  <p className="text-xs text-slate-400">{t.subtitle}</p>
                  <p className="mt-1 text-xs text-amber-400">
                    {'★'.repeat(t.difficulty)}
                    <span className="text-slate-600">{'★'.repeat(3 - t.difficulty)}</span>
                    {best ? (
                      <span className="ml-2 text-slate-400">最佳 {formatTime(best)}</span>
                    ) : null}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {!timeTrial && (
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-bold tracking-widest text-slate-400">難度</h2>
            <div className="flex gap-3">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onDifficulty(d.id)}
                  aria-pressed={d.id === difficulty}
                  className={`flex-1 min-h-[44px] rounded-xl border-2 py-2 font-bold transition touch-manipulation ${
                    d.id === difficulty
                      ? 'border-amber-400 bg-amber-400 text-slate-950'
                      : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {d.name}
                </button>
              ))}
            </div>
          </section>
        )}

        <button
          type="button"
          onClick={onStart}
          className="w-full rounded-2xl bg-amber-400 py-4 text-xl font-black text-slate-950 shadow-lg shadow-amber-500/20 transition hover:bg-amber-300 active:scale-[0.99]"
        >
          {timeTrial ? '開始計時' : '開始比賽'}
        </button>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-400">
          <p className="mb-2 font-bold text-slate-300">操作說明</p>
          <ul className="grid gap-1 sm:grid-cols-2">
            <li>← → 轉向</li>
            <li>↑ / Z 加速，↓ 煞車</li>
            <li>Shift 飄移（放開觸發小噴射）</li>
            <li>{itemsOn ? '空白鍵 使用道具' : '本模式無道具'}</li>
            <li>P 暫停，M 靜音</li>
            <li>手機：畫面左右下方的觸控按鍵</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

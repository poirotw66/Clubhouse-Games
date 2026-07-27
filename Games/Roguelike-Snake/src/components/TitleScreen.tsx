import { useState } from 'react';
import { Play, Sparkles } from 'lucide-react';
import { MAX_FLOOR } from '../game/config';
import type { BestRecord } from '../game/storage';

interface TitleScreenProps {
  best: BestRecord;
  onStart: (seedInput: string) => void;
}

const RULES: Array<[string, string]> = [
  ['🍎 吃果實', '吃滿當層配額即開啟出口傳送門'],
  ['⚡ 衝刺', 'Space／衝刺鍵，消耗能量並輾殺敵人'],
  ['❤️ 生命', '撞牆、撞自己、被敵人碰到都會 −1 HP'],
  ['🎁 遺物', '每通過一層三選一，永久疊加'],
  ['👹 首領', '每 5 層一場，只有衝刺能傷到它'],
];

export function TitleScreen({ best, onStart }: TitleScreenProps) {
  const [seed, setSeed] = useState('');

  return (
    <div className="w-full max-w-lg mx-auto text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-emerald-400 mb-2">Roguelike Snake</p>
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
      <div className="flex gap-2 mb-5">
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

      <button
        type="button"
        onClick={() => onStart(seed)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 py-3 text-lg font-bold hover:bg-emerald-500 transition-colors"
      >
        <Play className="w-5 h-5" />
        開始探索
      </button>

      {best.score > 0 && (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-amber-300">
          <Sparkles className="w-4 h-4" />
          最佳紀錄：{best.score} 分 · 第 {best.floor} 層
        </p>
      )}
    </div>
  );
}

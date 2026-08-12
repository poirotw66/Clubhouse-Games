import { Coins, Heart, Layers, Zap } from 'lucide-react';
import { relicImageUrl } from '../game/art';
import { RELIC_BY_ID } from '../game/relics';
import type { Phase, RelicId } from '../game/types';

export interface HudSnapshot {
  phase: Phase;
  floor: number;
  layoutName: string;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  coins: number;
  score: number;
  kills: number;
  eaten: number;
  quota: number;
  length: number;
  relics: RelicId[];
  bossHp: number;
  bossMaxHp: number;
  exitOpen: boolean;
  dashReady: boolean;
  endless: boolean;
}

interface HudProps {
  hud: HudSnapshot;
  seedLabel: string;
}

export function Hud({ hud, seedLabel }: HudProps) {
  const energyPercent = Math.round((hud.energy / hud.maxEnergy) * 100);
  const objective = hud.bossMaxHp > 0
    ? `首領 ${hud.bossHp}/${hud.bossMaxHp}`
    : hud.exitOpen
      ? '出口已開啟'
      : `果實 ${Math.min(hud.eaten, hud.quota)}/${hud.quota}`;

  return (
    <div className="w-full max-w-xl mx-auto space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-sky-300" />
          <span className="font-bold">
            第 {hud.floor} 層{hud.endless && <span className="text-amber-300"> · 無盡</span>}
          </span>
          <span className="text-xs text-slate-400">{hud.layoutName}</span>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="flex items-center gap-1">
            {Array.from({ length: hud.maxHp }, (_, i) => (
              <Heart
                key={i}
                className={`w-4 h-4 ${i < hud.hp ? 'text-rose-400 fill-rose-400' : 'text-slate-700'}`}
              />
            ))}
          </span>
          <span className="flex items-center gap-1 text-amber-300">
            <Coins className="w-4 h-4" />
            <span className="font-mono tabular-nums">{hud.coins}</span>
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex-1 min-w-[160px] rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span className="flex items-center gap-1">
              <Zap className={`w-3.5 h-3.5 ${hud.dashReady ? 'text-cyan-300' : 'text-slate-600'}`} />
              能量
            </span>
            <span className="font-mono tabular-nums">{Math.floor(hud.energy)}/{hud.maxEnergy}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-[width] duration-150"
              style={{ width: `${energyPercent}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs space-y-0.5">
          <div className="flex gap-3">
            <span className="text-slate-400">分數</span>
            <span className="font-mono tabular-nums text-slate-100">{hud.score}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-slate-400">目標</span>
            <span className={hud.exitOpen ? 'text-sky-300' : 'text-slate-200'}>{objective}</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-3 py-2 text-xs space-y-0.5">
          <div className="flex gap-3">
            <span className="text-slate-400">長度</span>
            <span className="font-mono tabular-nums">{hud.length}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-slate-400">種子</span>
            <span className="font-mono text-slate-300">{seedLabel}</span>
          </div>
        </div>
      </div>

      {hud.relics.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {hud.relics.map((id) => (
            <span
              key={id}
              title={RELIC_BY_ID[id].text}
              className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/70 px-2 py-0.5 text-xs"
            >
              <img
                src={relicImageUrl(id)}
                alt=""
                className="w-4 h-4 rounded object-cover"
                draggable={false}
                aria-hidden
              />
              {RELIC_BY_ID[id].name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

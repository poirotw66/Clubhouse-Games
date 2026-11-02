import React, { useMemo } from 'react';
import { hitboxRadius, grazeRadius } from '../game/engine';
import { craftById, DEFAULT_CRAFT_ID } from '../game/crafts';
import { UPGRADE_BY_ID, CONDITION_TEXT } from '../game/upgrades';
import type { DailyBestRecord } from '../game/daily';
import type { ModeDef } from '../game/modes';
import type { RunState } from '../game/types';

interface CabinetWingsProps {
  hud: RunState | null;
  best: number;
  dailyBest: DailyBestRecord;
  isDailyRun: boolean;
  activeMode: ModeDef | undefined;
}

export function CabinetLeftWing({ hud }: { hud: RunState | null }): React.ReactElement {
  const craft = craftById(hud?.craftId ?? DEFAULT_CRAFT_ID);
  const upgrades = useMemo(() => {
    if (!hud?.upgrades) return [];
    return hud.upgrades.map((id) => UPGRADE_BY_ID[id]).filter(Boolean);
  }, [hud?.upgrades]);

  const hr = hud ? hitboxRadius(hud) : 3.2;
  const gr = hud ? grazeRadius(hud) : 18;
  const specialCd = hud?.specialCd ?? 0;
  const specialMax = craft.special.cooldown;
  const specialRatio = specialCd <= 0 ? 1 : Math.max(0, 1 - specialCd / specialMax);

  return (
    <aside
      className="hidden lg:flex w-72 flex-col gap-3 p-3 bg-[#070b18]/85 border-r border-cyan-500/25 backdrop-blur-md overflow-y-auto select-none z-10"
      aria-label="戰術情報座艙"
    >
      {/* Wing Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
        <span className="font-display text-xs tracking-widest text-cyan-400">TACTICAL WING // 戰術座艙</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono">SYS_ONLINE</span>
      </div>

      {/* Craft Hologram Silhouette Card */}
      <div className="rounded-xl border border-cyan-500/30 bg-[#0a1226]/90 p-3 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
        <div className="flex items-center justify-between">
          <span className="font-display text-sm font-bold text-slate-100">{craft.name}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-900/60 text-cyan-200">
            {craft.shotStyle === 'wide' ? '寬幅重擊' : craft.shotStyle === 'needle' ? '細針穿孔' : '均衡扇射'}
          </span>
        </div>

        {/* Tactical Specs Grid */}
        <div className="grid grid-cols-2 gap-2 mt-2.5 text-xs">
          <div className="rounded-lg bg-slate-900/70 p-2 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">判定半徑 (Hitbox)</span>
            <span className="font-mono text-fuchsia-300 font-bold">{hr.toFixed(1)} px</span>
          </div>
          <div className="rounded-lg bg-slate-900/70 p-2 border border-slate-800">
            <span className="text-[10px] text-slate-400 block">擦彈範圍 (Graze)</span>
            <span className="font-mono text-cyan-300 font-bold">{gr.toFixed(0)} px</span>
          </div>
        </div>

        {/* Special Ability Meter */}
        <div className="mt-2.5 rounded-lg bg-slate-900/70 p-2 border border-slate-800">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="text-amber-200 font-bold">特技「{craft.special.name}」</span>
            <span className="font-mono text-[10px] text-slate-400">
              {specialCd <= 0 ? 'READY [X]' : `${specialCd.toFixed(1)}s`}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${
                specialCd <= 0
                  ? 'bg-gradient-to-r from-teal-400 to-cyan-300 shadow-[0_0_8px_rgba(45,212,191,0.8)]'
                  : 'bg-slate-600'
              }`}
              style={{ width: `${specialRatio * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Active Upgrades Loadout */}
      <div className="flex-1 flex flex-col rounded-xl border border-fuchsia-500/25 bg-[#0e0c24]/85 p-3 shadow-[0_0_20px_rgba(232,121,249,0.08)]">
        <div className="flex items-center justify-between mb-2">
          <span className="font-display text-xs tracking-wider text-fuchsia-300">
            本局強化裝備 ({upgrades.length})
          </span>
          <span className="text-[10px] text-slate-400 font-mono">ROGUELIKE LOADOUT</span>
        </div>

        {upgrades.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center p-4 text-xs text-slate-500">
            完成每階段擊破即可自選強化，構築專屬戰機流派。
          </div>
        ) : (
          <ul className="space-y-1.5 overflow-y-auto pr-1 max-h-64 text-xs">
            {upgrades.map((u, idx) => {
              const rarityColor =
                u.rarity === 'epic'
                  ? 'border-fuchsia-500/60 bg-fuchsia-950/40 text-fuchsia-200'
                  : u.rarity === 'rare'
                    ? 'border-cyan-500/60 bg-cyan-950/40 text-cyan-200'
                    : 'border-slate-700 bg-slate-900/60 text-slate-300';
              return (
                <li
                  key={`${u.id}-${idx}`}
                  className={`rounded-lg border px-2.5 py-1.5 transition-all ${rarityColor}`}
                  title={u.text}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">{u.name}</span>
                    <span className="text-[10px] uppercase opacity-75 font-mono">{u.rarity}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 block line-clamp-1 mt-0.5">{u.text}</span>
                  {u.conditional && (
                    <span className="text-[10px] text-amber-300/90 block mt-0.5">
                      觸發：{CONDITION_TEXT[u.conditional.when]}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}

export function CabinetRightWing({
  hud,
  best,
  dailyBest,
  isDailyRun,
  activeMode,
}: CabinetWingsProps): React.ReactElement {
  const boss = hud?.enemies.find((e) => e.isBoss);
  const grazeMult = hud?.grazeMult ?? 1;
  const grazeCount = hud?.grazeCount ?? 0;
  const grazeRatio = Math.max(0, Math.min(1, (grazeMult - 1) / 3));

  const bossFrac = boss ? Math.max(0, boss.hp / boss.maxHp) : 0;
  const cardTimeRemaining = boss?.card
    ? Math.max(0, boss.card.timeLimit - boss.cardElapsed)
    : 0;

  return (
    <aside
      className="hidden lg:flex w-72 flex-col gap-3 p-3 bg-[#070b18]/85 border-l border-fuchsia-500/25 backdrop-blur-md overflow-y-auto select-none z-10"
      aria-label="深淵威脅雷達"
    >
      {/* Wing Header */}
      <div className="flex items-center justify-between border-b border-fuchsia-500/20 pb-2">
        <span className="font-display text-xs tracking-widest text-fuchsia-400">THREAT RADAR // 威脅雷達</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-fuchsia-950 text-fuchsia-300 font-mono">LIVE_FEED</span>
      </div>

      {/* Boss Spell Card Monitor */}
      <div className="rounded-xl border border-fuchsia-500/30 bg-[#160c28]/90 p-3 shadow-[0_0_20px_rgba(232,121,249,0.12)]">
        <div className="flex items-center justify-between">
          <span className="font-display text-xs text-fuchsia-300">
            {boss ? 'BOSS ENGAGED // 首領戰' : 'SECTOR CLEARANCE // 道中推進'}
          </span>
          <span className="font-mono text-[10px] text-slate-400">
            STAGE {hud?.stage ?? 1}/5
          </span>
        </div>

        {boss?.card ? (
          <div className="mt-2.5">
            <span className="font-bold text-sm text-fuchsia-100 block">{boss.card.name}</span>
            {/* Boss HP Bar */}
            <div className="mt-1.5 w-full h-2 rounded-full bg-slate-900 overflow-hidden border border-fuchsia-500/30">
              <div
                className="h-full bg-gradient-to-r from-rose-500 via-fuchsia-500 to-pink-300 transition-all duration-75"
                style={{ width: `${bossFrac * 100}%` }}
              />
            </div>

            {/* Spell Card Timer */}
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className="text-slate-400">Capture 限時</span>
              <span
                className={`font-mono font-bold ${
                  cardTimeRemaining < 5 ? 'text-rose-400 animate-pulse' : 'text-amber-300'
                }`}
              >
                {cardTimeRemaining.toFixed(1)}s
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-fuchsia-400/80">
              <span>Capture 加成</span>
              <span className="font-mono">+50,000 PTS</span>
            </div>
          </div>
        ) : (
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
            <span>消滅迎面敵機，準備迎戰守護者。</span>
          </div>
        )}
      </div>

      {/* Graze Overdrive Gauge */}
      <div className="rounded-xl border border-cyan-500/30 bg-[#0a1226]/90 p-3 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="font-display text-xs text-cyan-300">GRAZE MULTIPLIER // 擦彈倍率</span>
          <span className="text-[10px] font-mono text-slate-400">{grazeCount} 次擦彈</span>
        </div>

        <div className="flex items-baseline justify-between">
          <span className="font-display text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-teal-200 to-amber-300">
            ×{grazeMult.toFixed(2)}
          </span>
          <span className="text-[10px] text-slate-400 font-mono">CAP ×4.00</span>
        </div>

        <div className="w-full h-2 rounded-full bg-slate-900 mt-2 overflow-hidden border border-cyan-500/25">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 via-teal-300 to-amber-400 transition-all duration-75"
            style={{ width: `${grazeRatio * 100}%` }}
          />
        </div>
      </div>

      {/* Arcade Keybinds Guide */}
      <div className="rounded-xl border border-slate-800 bg-[#070b18]/90 p-3 mt-auto text-xs text-slate-300 space-y-1.5">
        <span className="font-display text-[11px] text-slate-400 tracking-wider block mb-1">
          KEYBOARD CONTROLS // 操作指南
        </span>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-400">戰機移動</span>
          <span className="font-mono text-cyan-300">[WASD / 方向鍵]</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-400">集中穿針</span>
          <span className="font-mono text-fuchsia-300">[Shift] 判定點縮小</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-400">機體特技</span>
          <span className="font-mono text-teal-300">[X] 冷卻技</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-400">全屏靈擊</span>
          <span className="font-mono text-amber-300">[Z] 保命消彈</span>
        </div>
        <div className="flex justify-between items-center text-[11px]">
          <span className="text-slate-400">暫停遊戲</span>
          <span className="font-mono text-slate-400">[P / Esc]</span>
        </div>
      </div>
    </aside>
  );
}

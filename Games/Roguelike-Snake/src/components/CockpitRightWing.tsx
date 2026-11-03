import { useState } from 'react';
import { BookOpen, Box, Flame, Info, Skull, Sparkles, Swords } from 'lucide-react';
import { enemyImageUrl, relicImageUrl } from '../artUrls';
import { RELIC_BY_ID } from '../game/relics';
import type { RelicId } from '../game/types';

interface CockpitRightWingProps {
  floor: number;
  relics: RelicId[];
  bossHp: number;
  bossMaxHp: number;
  exitOpen: boolean;
  archetypeName: string;
  archetypeBadge: string;
  energy: number;
  hp: number;
  isBossActive: boolean;
}

export function CockpitRightWing({
  floor,
  relics,
  bossHp,
  bossMaxHp,
  exitOpen,
  archetypeName,
  archetypeBadge,
  energy,
  hp,
  isBossActive,
}: CockpitRightWingProps) {
  const [inspectedRelic, setInspectedRelic] = useState<RelicId | null>(null);

  const nextBossFloor = Math.ceil(floor / 5) * 5;
  const floorsToBoss = nextBossFloor - floor;

  // Dynamic context-aware tips
  let codexTip = '每吃滿本層果實配額即可開啟出口傳送門，前往下層探索。';
  if (isBossActive) {
    codexTip = '🎯 鎖定首領核心！首領僅受衝刺 (Space) 或猛毒脈衝 (E) 傷害，把握核心瞬移停頓輸出！';
  } else if (exitOpen) {
    codexTip = '🌀 出口星門已開啟！迅速前往傳送門，挑選本層遺物強化蛇身構築！';
  } else if (hp === 1) {
    codexTip = '🚨 警報：命懸一線！避免深入自撞死角，保留 30 點動能作為緊急逃生衝刺！';
  } else if (energy >= 90) {
    codexTip = '⚡ 動能已充盈！可隨時使用 Space 衝刺斬殺沿途敵人，或按 E 釋放猛毒脈衝清場！';
  } else if (floorsToBoss === 1) {
    codexTip = '⚠️ 下一層為首領房！請確保血量與動能維持高檔，準備迎戰腐化核心！';
  }

  const selectedRelicDef = inspectedRelic ? RELIC_BY_ID[inspectedRelic] : null;

  return (
    <aside className="w-full lg:w-72 flex flex-col gap-3 font-sans">
      {/* Relic Matrix Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 backdrop-blur-md shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-amber-300 uppercase">
            <Box className="w-4 h-4 text-amber-400" />
            <span>天賦遺物聖物箱</span>
          </div>
          <span className="text-[11px] font-mono text-slate-400">已蒐集: {relics.length}</span>
        </div>

        {/* Build Archetype Banner */}
        <div className="flex items-center justify-between rounded-xl border border-sky-500/30 bg-sky-950/30 px-2.5 py-1.5 mb-2.5">
          <div className="text-xs font-bold text-sky-200">{archetypeName}</div>
          <span className="text-[10px] font-mono rounded bg-sky-900/60 px-1.5 py-0.5 text-sky-300">
            {archetypeBadge}
          </span>
        </div>

        {/* Relic Matrix Grid */}
        {relics.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-3 border border-dashed border-slate-800 rounded-xl">
            尚未獲取遺物
            <span className="block text-[11px] text-slate-500 mt-0.5">通過每層後挑選以構築流派</span>
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
            {relics.map((id) => {
              const def = RELIC_BY_ID[id];
              const isInspected = inspectedRelic === id;
              const rarityColor =
                def?.rarity === 'legendary'
                  ? 'border-amber-400 text-amber-200 shadow-[0_0_8px_rgba(251,191,36,0.3)]'
                  : def?.rarity === 'rare'
                    ? 'border-purple-400 text-purple-200'
                    : 'border-slate-700 text-slate-200';

              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setInspectedRelic(isInspected ? null : id)}
                  className={`group flex items-center gap-1 rounded-lg border bg-slate-950/80 px-2 py-1 text-xs transition-all ${rarityColor} ${
                    isInspected ? 'ring-2 ring-cyan-400' : 'hover:border-slate-500'
                  }`}
                  title={def?.text}
                >
                  <img
                    src={relicImageUrl(id)}
                    alt=""
                    className="w-4 h-4 rounded object-cover"
                    draggable={false}
                    aria-hidden
                  />
                  <span className="text-[11px] font-medium">{def?.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Inspected Relic Lore Card */}
        {selectedRelicDef && (
          <div className="mt-2.5 rounded-xl border border-cyan-500/40 bg-slate-950/90 p-2.5 text-xs animate-fadeIn">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-cyan-200">{selectedRelicDef.name}</span>
              <span className="text-[10px] text-slate-400 uppercase font-mono">
                {selectedRelicDef.rarity === 'legendary'
                  ? '傳說'
                  : selectedRelicDef.rarity === 'rare'
                    ? '稀有'
                    : '普通'}
              </span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">{selectedRelicDef.text}</p>
          </div>
        )}
      </div>

      {/* Boss Dossier & Scouting Report */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 backdrop-blur-md shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-rose-300 uppercase">
            <Skull className="w-4 h-4 text-rose-400" />
            <span>深窟首領檔案</span>
          </div>
          <span className="text-[11px] font-mono text-rose-300">
            {isBossActive
              ? `首領交鋒中`
              : floorsToBoss === 0
                ? '即刻迎戰'
                : `距離首領房 ${floorsToBoss} 層`}
          </span>
        </div>

        {/* Boss Status */}
        <div className="rounded-xl border border-rose-900/50 bg-rose-950/20 p-2.5 mb-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <img
                src={enemyImageUrl('boss')}
                alt="首領"
                className="w-5 h-5 rounded object-cover border border-rose-500/50"
              />
              <span className="text-xs font-bold text-rose-200">腐化核心</span>
            </div>
            <span className="text-[10px] text-rose-300 font-mono">
              HP: {bossMaxHp > 0 ? `${bossHp}/${bossMaxHp}` : '第 5, 10, 15 層現蹤'}
            </span>
          </div>
          {bossMaxHp > 0 && (
            <div className="h-1.5 rounded-full bg-slate-950 overflow-hidden mb-1">
              <div
                className="h-full bg-gradient-to-r from-rose-500 to-pink-500 transition-all duration-200"
                style={{ width: `${Math.round((bossHp / bossMaxHp) * 100)}%` }}
              />
            </div>
          )}
          <p className="text-[10px] text-slate-400 leading-relaxed">
            弱點：僅受衝刺輾撞與猛毒脈衝傷害。週期性召喚追獵者與尖刺地陷。
          </p>
        </div>

        {/* Enemy Bestiary Quick Glance */}
        <div className="space-y-1.5 text-xs">
          <div className="text-[11px] text-slate-400 font-semibold mb-1">本層異種威脅監測</div>
          <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-1">
              <span className="text-slate-300 block font-medium">遊魂</span>
              <span className="text-slate-500 text-[9px]">隨機漫遊</span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-1">
              <span className="text-orange-300 block font-medium">追獵者</span>
              <span className="text-slate-500 text-[9px]">鎖定蛇頭</span>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-1">
              <span className="text-lime-300 block font-medium">吐酸者</span>
              <span className="text-slate-500 text-[9px]">噴射毒彈</span>
            </div>
          </div>
        </div>
      </div>

      {/* Devourer's Codex */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-3.5 backdrop-blur-md shadow-lg">
        <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 mb-2 text-xs font-semibold tracking-wider text-emerald-300 uppercase">
          <BookOpen className="w-4 h-4 text-emerald-400" />
          <span>吞噬者大師錦囊</span>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 rounded-xl p-2.5 border border-slate-800/80">
          {codexTip}
        </p>
      </div>
    </aside>
  );
}

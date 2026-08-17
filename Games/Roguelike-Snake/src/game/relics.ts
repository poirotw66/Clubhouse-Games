import type { RelicId } from './types';

export type Rarity = 'common' | 'rare' | 'legendary' | 'consumable';

/**
 * Numeric levers a relic can pull without touching the engine.
 *
 * Every relic in the first eighteen was a bespoke `hasRelic` branch somewhere in
 * `engine.ts`, which is why the pool never grew: adding one meant editing the
 * simulation. With fifteen picks a run and eighteen relics, a run saw **17.7 of
 * them — 98% of the pool** — and two runs shared 72% of their build, which for a
 * roguelike means every run is the same run.
 *
 * These keys are read once each by the engine and summed, so a relic that only
 * moves numbers is now a single row of data.
 */
export type ModKey =
  | 'speedPct'      // negative is faster
  | 'scorePct'
  | 'growth'
  | 'energyMax'
  | 'energyGainPct'
  | 'dashDistance'
  | 'goldenPct'
  | 'invulnMs'
  | 'maxHp'
  | 'coinPct';

export interface RelicDef {
  id: RelicId;
  name: string;
  icon: string;
  rarity: Rarity;
  text: string;
  /** Consumables can be offered (and taken) more than once. */
  repeatable?: boolean;
  /** Data-only effects. Bespoke relics keep their branches in the engine. */
  mods?: Partial<Record<ModKey, number>>;
}

export const RELICS: RelicDef[] = [
  // ---------------------------------------------------------------------------
  // Data-only relics.
  //
  // These pull the numeric levers in `ModKey` and need no engine change, which
  // is the point: with eighteen relics and fifteen picks a run saw 98% of the
  // pool and two runs shared 72% of their build. Breadth is what a roguelike
  // runs on, and breadth was expensive because every relic used to be a branch.
  // ---------------------------------------------------------------------------
  { id: 'scales', name: '厚鱗', icon: '🛡️', rarity: 'common', text: '受傷後無敵時間 +0.6 秒。', mods: { invulnMs: 600 } },
  { id: 'coil', name: '盤蜷', icon: '🌾', rarity: 'common', text: '果實成長 +1，移動速度 −6%。', mods: { growth: 1, speedPct: 6 } },
  { id: 'venom', name: '毒牙', icon: '🐍', rarity: 'common', text: '所有分數 +20%。', mods: { scorePct: 20 } },
  { id: 'husk', name: '空殼', icon: '🥚', rarity: 'common', text: '果實不再增長，分數 +45%。', mods: { growth: -1, scorePct: 45 } },
  { id: 'ember', name: '餘燼', icon: '🔥', rarity: 'common', text: '能量上限 +25。', mods: { energyMax: 25 } },
  { id: 'frost', name: '霜紋', icon: '❄️', rarity: 'common', text: '移動速度 −8%，分數 +15%。', mods: { speedPct: 8, scorePct: 15 } },
  { id: 'tide', name: '潮汐鱗', icon: '🌊', rarity: 'common', text: '移動速度 +8%。', mods: { speedPct: -8 } },
  { id: 'hunger', name: '飢渴', icon: '🍜', rarity: 'common', text: '果實成長 +1。', mods: { growth: 1 } },
  { id: 'patience', name: '忍', icon: '🧘', rarity: 'common', text: '移動速度 −15%，分數 +40%。', mods: { speedPct: 15, scorePct: 40 } },
  { id: 'mirror', name: '鏡鱗', icon: '🪟', rarity: 'common', text: '金蘋果出現率 +60%。', mods: { goldenPct: 60 } },
  { id: 'lantern', name: '提燈', icon: '🏮', rarity: 'common', text: '金幣獲取 +40%。', mods: { coinPct: 40 } },
  { id: 'anchor', name: '沉錨', icon: '⚓', rarity: 'common', text: '移動速度 −20%，能量上限 +50。', mods: { speedPct: 20, energyMax: 50 } },
  { id: 'kite', name: '風箏骨', icon: '🪁', rarity: 'common', text: '衝刺距離 +1。', mods: { dashDistance: 1 } },
  { id: 'saltline', name: '鹽線', icon: '🧂', rarity: 'common', text: '能量獲取 +35%。', mods: { energyGainPct: 35 } },
  { id: 'moulting', name: '換皮', icon: '🧻', rarity: 'rare', text: '最大 HP +1。', mods: { maxHp: 1 } },
  { id: 'burrow', name: '穴居', icon: '🕳️', rarity: 'rare', text: '移動速度 +14%，果實不再增長。', mods: { speedPct: -14, growth: -1 } },
  { id: 'crest', name: '冠羽', icon: '🪶', rarity: 'rare', text: '分數 +35%，能量上限 +20。', mods: { scorePct: 35, energyMax: 20 } },
  { id: 'tremor', name: '震顫', icon: '💥', rarity: 'rare', text: '衝刺距離 +2，移動速度 −6%。', mods: { dashDistance: 2, speedPct: 6 } },
  { id: 'dust', name: '塵翳', icon: '🌫️', rarity: 'rare', text: '受傷後無敵時間 +1 秒，分數 −10%。', mods: { invulnMs: 1000, scorePct: -10 } },
  { id: 'gilded', name: '鎏金鱗', icon: '✨', rarity: 'rare', text: '金蘋果出現率 +120%，金幣 +30%。', mods: { goldenPct: 120, coinPct: 30 } },
  { id: 'ration', name: '乾糧', icon: '🍞', rarity: 'rare', text: '能量獲取 +60%，衝刺距離 +1。', mods: { energyGainPct: 60, dashDistance: 1 } },
  { id: 'whetstone', name: '磨石', icon: '🪨', rarity: 'rare', text: '移動速度 +10%，分數 +20%。', mods: { speedPct: -10, scorePct: 20 } },
  { id: 'compass', name: '羅盤', icon: '🧭', rarity: 'legendary', text: '金蘋果出現率 +200%。', mods: { goldenPct: 200 } },
  { id: 'lodestone', name: '磁髓', icon: '🧿', rarity: 'legendary', text: '最大 HP +1，移動速度 +10%。', mods: { maxHp: 1, speedPct: -10 } },
  { id: 'tallow', name: '獸脂燭', icon: '🕯️', rarity: 'legendary', text: '分數 +80%，最大 HP −1。', mods: { scorePct: 80, maxHp: -1 } },
  { id: 'vigil', name: '長夜守望', icon: '🌙', rarity: 'legendary', text: '無敵時間 +1.5 秒，能量上限 +40。', mods: { invulnMs: 1500, energyMax: 40 } },
  { id: 'shed', name: '蛇蛻', icon: '🪞', rarity: 'common', text: '受傷時不再縮短蛇身。' },
  { id: 'swift', name: '疾風鱗', icon: '💨', rarity: 'common', text: '移動速度 +12%。' },
  { id: 'torpor', name: '遲滯符', icon: '🐌', rarity: 'common', text: '移動速度 −12%，所有分數 +30%。' },
  { id: 'magnet', name: '磁石之心', icon: '🧲', rarity: 'common', text: '2 格內的果實自動吸附。' },
  { id: 'gluttony', name: '貪食', icon: '🍖', rarity: 'common', text: '果實成長 +1，分數 +25%。' },
  { id: 'ascetic', name: '苦行', icon: '🕯️', rarity: 'common', text: '果實不再增長，能量獲取 ×2。' },
  { id: 'core', name: '蓄能核心', icon: '🔋', rarity: 'common', text: '能量上限 +40，衝刺距離 +1。' },
  { id: 'alchemy', name: '鍊金術', icon: '⚗️', rarity: 'common', text: '金蘋果出現率 ×2。' },
  { id: 'ghost', name: '幽靈尾', icon: '👻', rarity: 'rare', text: '撞到自身不受傷（每層 1 次）。' },
  { id: 'heart', name: '二次心跳', icon: '💗', rarity: 'rare', text: '最大 HP +1 並立即回滿。' },
  { id: 'thorn', name: '荊棘鱗', icon: '🌵', rarity: 'rare', text: '敵人撞上蛇身時死亡且不造成傷害。' },
  { id: 'hourglass', name: '時之沙', icon: '⏳', rarity: 'rare', text: '受傷後無敵時間 +1.2 秒。' },
  { id: 'echo', name: '迴響', icon: '🔊', rarity: 'rare', text: '每吃 5 顆果實引爆衝擊波清場。' },
  { id: 'fang', name: '尖牙', icon: '🦷', rarity: 'rare', text: '蛇頭直接撞擊即可擊殺一般敵人。' },
  { id: 'warp', name: '環界符', icon: '🌀', rarity: 'legendary', text: '撞牆改為從對側穿出。' },
  { id: 'blood', name: '血祭', icon: '🩸', rarity: 'legendary', text: '衝刺不耗能量，改為每 4 次衝刺 −1 HP。' },
  { id: 'bag', name: '金幣袋', icon: '💰', rarity: 'consumable', text: '立即獲得 8 金幣。', repeatable: true },
  { id: 'mend', name: '癒合藥草', icon: '🌿', rarity: 'consumable', text: '立即回復 1 點 HP。', repeatable: true },
];

export const RELIC_BY_ID: Record<RelicId, RelicDef> = RELICS.reduce(
  (acc, relic) => {
    acc[relic.id] = relic;
    return acc;
  },
  {} as Record<RelicId, RelicDef>,
);

export const RARITY_WEIGHT: Record<Rarity, number> = {
  common: 1,
  rare: 0.45,
  legendary: 0.15,
  consumable: 0.3,
};

export const RARITY_LABEL: Record<Rarity, string> = {
  common: '普通',
  rare: '稀有',
  legendary: '傳說',
  consumable: '消耗',
};

export const RARITY_CLASS: Record<Rarity, string> = {
  common: 'border-slate-600 bg-slate-800/80 text-slate-200',
  rare: 'border-sky-500/70 bg-sky-950/60 text-sky-100',
  legendary: 'border-amber-400/80 bg-amber-950/50 text-amber-100',
  consumable: 'border-emerald-600/70 bg-emerald-950/50 text-emerald-100',
};

/** Weighted draw of `count` distinct offers, skipping relics already owned. */
export function rollRelicChoices(
  rng: () => number,
  owned: RelicId[],
  count: number,
): RelicId[] {
  const pool = RELICS.filter((relic) => relic.repeatable || !owned.includes(relic.id));
  const chosen: RelicId[] = [];

  while (chosen.length < count && chosen.length < pool.length) {
    const candidates = pool.filter((relic) => !chosen.includes(relic.id));
    const total = candidates.reduce((sum, relic) => sum + RARITY_WEIGHT[relic.rarity], 0);
    let roll = rng() * total;
    let picked = candidates[candidates.length - 1];
    for (const relic of candidates) {
      roll -= RARITY_WEIGHT[relic.rarity];
      if (roll <= 0) {
        picked = relic;
        break;
      }
    }
    chosen.push(picked.id);
  }

  return chosen;
}

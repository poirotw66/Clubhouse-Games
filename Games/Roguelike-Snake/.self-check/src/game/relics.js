"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RARITY_CLASS = exports.RARITY_LABEL = exports.RARITY_WEIGHT = exports.RELIC_BY_ID = exports.RELICS = void 0;
exports.rollRelicChoices = rollRelicChoices;
exports.RELICS = [
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
exports.RELIC_BY_ID = exports.RELICS.reduce((acc, relic) => {
    acc[relic.id] = relic;
    return acc;
}, {});
exports.RARITY_WEIGHT = {
    common: 1,
    rare: 0.45,
    legendary: 0.15,
    consumable: 0.3,
};
exports.RARITY_LABEL = {
    common: '普通',
    rare: '稀有',
    legendary: '傳說',
    consumable: '消耗',
};
exports.RARITY_CLASS = {
    common: 'border-slate-600 bg-slate-800/80 text-slate-200',
    rare: 'border-sky-500/70 bg-sky-950/60 text-sky-100',
    legendary: 'border-amber-400/80 bg-amber-950/50 text-amber-100',
    consumable: 'border-emerald-600/70 bg-emerald-950/50 text-emerald-100',
};
/** Weighted draw of `count` distinct offers, skipping relics already owned. */
function rollRelicChoices(rng, owned, count) {
    const pool = exports.RELICS.filter((relic) => relic.repeatable || !owned.includes(relic.id));
    const chosen = [];
    while (chosen.length < count && chosen.length < pool.length) {
        const candidates = pool.filter((relic) => !chosen.includes(relic.id));
        const total = candidates.reduce((sum, relic) => sum + exports.RARITY_WEIGHT[relic.rarity], 0);
        let roll = rng() * total;
        let picked = candidates[candidates.length - 1];
        for (const relic of candidates) {
            roll -= exports.RARITY_WEIGHT[relic.rarity];
            if (roll <= 0) {
                picked = relic;
                break;
            }
        }
        chosen.push(picked.id);
    }
    return chosen;
}

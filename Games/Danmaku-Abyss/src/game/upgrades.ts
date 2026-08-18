/**
 * Upgrades are data. Each one declares which effect keys it moves and by how
 * much; the engine reads the summed keys and nothing else.
 *
 * Two lessons paid for in Roguelike-Snake are baked in here:
 *
 * 1. Authoring has to be cheap or the pool stays small. There, every relic was
 *    a bespoke `hasRelic` branch in the engine, so adding one meant editing
 *    engine logic — the pool sat at 18 entries against up to 15 picks per run,
 *    which meant a run was offered 98% of the pool and two runs shared 72% of
 *    what they carried. For a roguelike that is every run being the same run.
 * 2. A declared key that the engine never reads makes the upgrade text a lie,
 *    silently. Five of ten keys were unwired on first declaration there. The
 *    self-check for this game reads engine.ts and asserts every key below
 *    appears in it.
 */

export type EffectKey =
  | 'damagePct' // straight damage multiplier
  | 'fireRatePct'
  | 'shotWidth' // extra bullets per volley
  | 'hitboxPct' // negative shrinks the hitbox
  | 'grazeRangePct'
  | 'grazeGainPct'
  | 'focusSpeedPct'
  | 'fastSpeedPct'
  | 'bombCount' // granted immediately on pick
  | 'lifeCount' // granted immediately on pick
  | 'invulnSec' // longer respawn/bomb mercy
  | 'cardTimeSec' // longer spell-card timers
  | 'nearBonusPct' // steepens the close-range damage reward
  | 'fragmentPullPct'; // fragments drift toward you

export type Rarity = 'common' | 'rare' | 'epic';

export interface UpgradeDef {
  id: string;
  name: string;
  text: string;
  rarity: Rarity;
  /** Repeatable upgrades may be offered again after being taken. */
  repeatable?: boolean;
  effects: Partial<Record<EffectKey, number>>;
}

export const UPGRADES: UpgradeDef[] = [
  // ── Raw offence ───────────────────────────────────────────────────────────
  { id: 'edge', name: '刃芒', text: '傷害 +18%。', rarity: 'common', repeatable: true, effects: { damagePct: 0.18 } },
  { id: 'cadence', name: '連律', text: '射速 +15%。', rarity: 'common', repeatable: true, effects: { fireRatePct: 0.15 } },
  { id: 'fan', name: '扇形', text: '每次齊射多 1 發。', rarity: 'rare', effects: { shotWidth: 1 } },
  { id: 'broadside', name: '側舷', text: '每次齊射多 2 發，但射速 −10%。', rarity: 'epic', effects: { shotWidth: 2, fireRatePct: -0.1 } },
  { id: 'lance', name: '長矛', text: '傷害 +35%，射速 −12%。', rarity: 'rare', effects: { damagePct: 0.35, fireRatePct: -0.12 } },
  { id: 'swarm', name: '蜂群', text: '射速 +32%，傷害 −10%。', rarity: 'rare', effects: { fireRatePct: 0.32, damagePct: -0.1 } },

  // ── The distance spine ────────────────────────────────────────────────────
  { id: 'muzzle', name: '抵近', text: '近距離傷害加成再 +40%。', rarity: 'rare', repeatable: true, effects: { nearBonusPct: 0.4 } },
  { id: 'recklessness', name: '無謀', text: '近距離加成 +80%，判定點 +15%。', rarity: 'epic', effects: { nearBonusPct: 0.8, hitboxPct: 0.15 } },

  // ── Survivability ─────────────────────────────────────────────────────────
  { id: 'pinpoint', name: '針尖', text: '判定點 −18%。', rarity: 'rare', repeatable: true, effects: { hitboxPct: -0.18 } },
  { id: 'ghosting', name: '殘影', text: '判定點 −30%，射速 −15%。', rarity: 'epic', effects: { hitboxPct: -0.3, fireRatePct: -0.15 } },
  { id: 'spare', name: '備件', text: '立刻 +1 殘機。', rarity: 'epic', effects: { lifeCount: 1 } },
  { id: 'ordnance', name: '軍需', text: '立刻 +2 靈擊。', rarity: 'common', repeatable: true, effects: { bombCount: 2 } },
  { id: 'mercy', name: '緩期', text: '無敵時間 +0.8 秒。', rarity: 'common', repeatable: true, effects: { invulnSec: 0.8 } },

  // ── Movement ──────────────────────────────────────────────────────────────
  { id: 'thread', name: '穿線', text: '集中移動速度 +25%。', rarity: 'common', repeatable: true, effects: { focusSpeedPct: 0.25 } },
  { id: 'burst', name: '爆發', text: '高速移動 +20%。', rarity: 'common', repeatable: true, effects: { fastSpeedPct: 0.2 } },
  { id: 'glide', name: '滑走', text: '兩種移動速度各 +12%。', rarity: 'rare', effects: { focusSpeedPct: 0.12, fastSpeedPct: 0.12 } },

  // ── Graze / scoring ───────────────────────────────────────────────────────
  { id: 'brush', name: '擦痕', text: '擦彈範圍 +25%。', rarity: 'common', repeatable: true, effects: { grazeRangePct: 0.25 } },
  { id: 'thrill', name: '戰慄', text: '擦彈倍率累積速度 +50%。', rarity: 'rare', repeatable: true, effects: { grazeGainPct: 0.5 } },
  { id: 'brinkmanship', name: '走鋼索', text: '擦彈累積 +120%，判定點 +12%。', rarity: 'epic', effects: { grazeGainPct: 1.2, hitboxPct: 0.12 } },
  { id: 'aura', name: '氣場', text: '擦彈範圍 +45%，高速移動 −15%。', rarity: 'rare', effects: { grazeRangePct: 0.45, fastSpeedPct: -0.15 } },

  // ── Tempo ─────────────────────────────────────────────────────────────────
  { id: 'stopwatch', name: '懷錶', text: '符卡計時 +6 秒。', rarity: 'common', repeatable: true, effects: { cardTimeSec: 6 } },
  { id: 'magnet', name: '磁引', text: '火力碎片會朝你飄來。', rarity: 'rare', repeatable: true, effects: { fragmentPullPct: 1 } },
  { id: 'salvage', name: '打撈', text: '碎片吸引 +200%，判定點 −8%。', rarity: 'epic', effects: { fragmentPullPct: 2, hitboxPct: -0.08 } },
  { id: 'overclock', name: '超頻', text: '射速 +20%、移動 +15%，但無敵時間 −0.5 秒。', rarity: 'epic', effects: { fireRatePct: 0.2, focusSpeedPct: 0.15, fastSpeedPct: 0.15, invulnSec: -0.5 } },
];

export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
);

/** Every effect key any upgrade actually declares — the honesty check reads this. */
export function declaredEffectKeys(): EffectKey[] {
  const keys = new Set<EffectKey>();
  for (const u of UPGRADES) {
    for (const k of Object.keys(u.effects) as EffectKey[]) keys.add(k);
  }
  return [...keys].sort();
}

/** Summed value of one effect key across everything taken this run. */
export function effect(taken: readonly string[], key: EffectKey): number {
  let total = 0;
  for (const id of taken) {
    const v = UPGRADE_BY_ID[id]?.effects[key];
    if (typeof v === 'number') total += v;
  }
  return total;
}

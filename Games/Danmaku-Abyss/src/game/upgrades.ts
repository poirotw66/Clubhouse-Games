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

/**
 * States an upgrade can key off. This is what turns a pool of independent
 * percentages into builds.
 *
 * The first pass had none: every upgrade was a flat scalar, and the balance
 * harness measured the consequence — the strongest and weakest picks were
 * separated by 0.50 stages, i.e. the choice barely mattered. Depth in a
 * roguelike comes from effects that interact with the state you are in, so
 * that a pick changes how you want to PLAY rather than just how big a number
 * is.
 */
export type Condition =
  | 'grazeHigh' // multiplier at 2x or more — you have been living dangerously
  | 'lastLife' // one life left
  | 'pointBlank' // something hostile within 120 units
  | 'focused' // currently in focus mode
  | 'bombless' // no bombs in reserve
  | 'fullPower'; // power tier maxed

export const CONDITION_TEXT: Record<Condition, string> = {
  grazeHigh: '擦彈倍率 ≥ 2 時',
  lastLife: '剩最後一條命時',
  pointBlank: '貼近敵人時',
  focused: '集中模式中',
  bombless: '沒有靈擊時',
  fullPower: '火力全滿時',
};

export interface UpgradeDef {
  id: string;
  name: string;
  text: string;
  rarity: Rarity;
  /** Repeatable upgrades may be offered again after being taken. */
  repeatable?: boolean;
  effects: Partial<Record<EffectKey, number>>;
  /** Applies only while `when` holds. This is where build identity lives. */
  conditional?: { when: Condition; effects: Partial<Record<EffectKey, number>> };
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

  // ── Conditional: these are the picks that decide how you play ─────────────
  //
  // Each one is weak or dead on its own and strong in a specific state, so
  // taking it commits you to seeking that state out. Two of them (焦土, 賭命)
  // pay for danger you were going to be in anyway; two (定影, 冷血) reward
  // committing to a stance; 見底 turns a spent resource into a reason to keep
  // not spending it.
  {
    id: 'scorched', name: '焦土', text: '貼近敵人時傷害 +70%。', rarity: 'rare', repeatable: true,
    effects: {},
    conditional: { when: 'pointBlank', effects: { damagePct: 0.7 } },
  },
  {
    id: 'gambit', name: '賭命', text: '剩最後一條命時傷害 +35%；平時判定點 +10%。', rarity: 'epic',
    // Trimmed after measurement. At +60% damage and -25% hitbox this was a pure
    // comeback mechanic: it made you strongest exactly when you were closest to
    // losing, which is the opposite of "lives exist but death still hurts".
    // Isolating the pool change showed stage 3 and 4 survival pushed from 88%
    // to 100% and the bot cleared every run. It now carries a standing cost so
    // taking it is a bet rather than a safety net.
    effects: { hitboxPct: 0.1 },
    conditional: { when: 'lastLife', effects: { damagePct: 0.35 } },
  },
  {
    id: 'fixative', name: '定影', text: '集中模式中射速 +45%，非集中時 −15%。', rarity: 'rare',
    effects: { fireRatePct: -0.15 },
    conditional: { when: 'focused', effects: { fireRatePct: 0.6 } },
  },
  {
    id: 'coldblood', name: '冷血', text: '擦彈倍率 ≥ 2 時，傷害 +50%、擦彈範圍 +30%。', rarity: 'epic',
    effects: {},
    conditional: { when: 'grazeHigh', effects: { damagePct: 0.5, grazeRangePct: 0.3 } },
  },
  {
    id: 'dregs', name: '見底', text: '沒有靈擊時，判定點 −22%、擦彈累積 +80%。', rarity: 'rare',
    effects: {},
    conditional: { when: 'bombless', effects: { hitboxPct: -0.22, grazeGainPct: 0.8 } },
  },
  {
    id: 'crown', name: '滿冠', text: '火力全滿時每次齊射多 2 發。', rarity: 'epic',
    effects: {},
    conditional: { when: 'fullPower', effects: { shotWidth: 2 } },
  },
  {
    id: 'brinkfire', name: '臨界', text: '擦彈倍率 ≥ 2 時射速 +40%，否則 −10%。', rarity: 'rare',
    effects: { fireRatePct: -0.1 },
    conditional: { when: 'grazeHigh', effects: { fireRatePct: 0.5 } },
  },
  {
    id: 'lastlight', name: '殘照', text: '剩最後一條命時移動 +25%；平時移動 −8%。', rarity: 'rare',
    // The card-timer half was removed: extra time on the clock while on your
    // last life is help precisely when failing should be closest.
    effects: { focusSpeedPct: -0.08, fastSpeedPct: -0.08 },
    conditional: { when: 'lastLife', effects: { focusSpeedPct: 0.33, fastSpeedPct: 0.33 } },
  },
];

export const UPGRADE_BY_ID: Record<string, UpgradeDef> = Object.fromEntries(
  UPGRADES.map((u) => [u.id, u]),
);

/** Every effect key any upgrade actually declares — the honesty check reads this. */
export function declaredEffectKeys(): EffectKey[] {
  const keys = new Set<EffectKey>();
  for (const u of UPGRADES) {
    for (const k of Object.keys(u.effects) as EffectKey[]) keys.add(k);
    for (const k of Object.keys(u.conditional?.effects ?? {}) as EffectKey[]) keys.add(k);
  }
  return [...keys].sort();
}

/** Every condition any upgrade keys off — the honesty check asserts each is evaluated. */
export function declaredConditions(): Condition[] {
  const set = new Set<Condition>();
  for (const u of UPGRADES) if (u.conditional) set.add(u.conditional.when);
  return [...set].sort();
}

/**
 * Summed value of one effect key across everything taken this run,
 * unconditional parts only. The engine adds the conditional parts through
 * `effectNow`, which is the only place that knows the run's current state.
 */
export function effect(taken: readonly string[], key: EffectKey): number {
  let total = 0;
  for (const id of taken) {
    const v = UPGRADE_BY_ID[id]?.effects[key];
    if (typeof v === 'number') total += v;
  }
  return total;
}

/** Conditional contribution for one key, given which conditions currently hold. */
export function conditionalEffect(
  taken: readonly string[],
  key: EffectKey,
  active: ReadonlySet<Condition>,
): number {
  let total = 0;
  for (const id of taken) {
    const c = UPGRADE_BY_ID[id]?.conditional;
    if (!c || !active.has(c.when)) continue;
    const v = c.effects[key];
    if (typeof v === 'number') total += v;
  }
  return total;
}

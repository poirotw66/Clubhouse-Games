/**
 * Wave composition. Everything here is a pure function of the wave number —
 * no randomness anywhere — so the same wave always produces the same enemy
 * list in the same order. WAVE_TABLE precomputes waves 1..20 once; endless
 * mode keeps calling buildWaveSpawns for wave numbers beyond that using the
 * same formula, so scaling stays deterministic past the 20-wave table too.
 */
import {
  BOSS_WAVE_INTERVAL,
  ENDLESS_HP_GROWTH_PER_WAVE,
  ENEMY_DEFS,
  TOTAL_WAVES,
  type EnemyType,
} from './constants.ts';
import type { WaveSpawnEntry } from './types.ts';

const SPAWN_SPACING_SEC = 0.55;

interface CompositionEntry {
  type: EnemyType;
  count: number;
}

/**
 * Bosses recur on every multiple of BOSS_WAVE_INTERVAL, forever. This used to
 * be a literal `Set([10, 20])`, which meant endless mode had no bosses at all
 * from wave 21 on — the only enemy with meaningful HP and armor silently
 * stopped appearing in the mode that never ends.
 */
export function isBossWave(waveNumber: number): boolean {
  return waveNumber > 0 && waveNumber % BOSS_WAVE_INTERVAL === 0;
}

/**
 * HP multiplier applied on top of the difficulty multiplier. Flat 1 through the
 * 20-wave table, compounding after it so endless runs eventually end.
 */
export function waveHpMultiplier(waveNumber: number): number {
  if (waveNumber <= TOTAL_WAVES) return 1;
  return ENDLESS_HP_GROWTH_PER_WAVE ** (waveNumber - TOTAL_WAVES);
}

/** Deterministic enemy-count formula per wave. No RNG — same wave number always yields the same counts. */
export function waveComposition(waveNumber: number): CompositionEntry[] {
  const comp: CompositionEntry[] = [];
  const gruntCount = 4 + Math.floor(waveNumber * 1.5);
  comp.push({ type: 'grunt', count: gruntCount });
  if (waveNumber >= 3) comp.push({ type: 'runner', count: 2 + Math.floor(waveNumber / 3) });
  if (waveNumber >= 6) comp.push({ type: 'ironclad', count: 1 + Math.floor(waveNumber / 5) });
  if (waveNumber >= 4) comp.push({ type: 'kite', count: 1 + Math.floor(waveNumber / 4) });
  if (waveNumber >= 8) comp.push({ type: 'gearbug', count: 1 + Math.floor(waveNumber / 6) });
  // High-HP sponges — make splash / mortar meaningful without touching early waves.
  if (waveNumber >= 7) comp.push({ type: 'bloater', count: 1 + Math.floor(waveNumber / 7) });
  // Armored flyers — ground-only or non-pierce air coverage is not enough.
  if (waveNumber >= 9) comp.push({ type: 'shellbug', count: 1 + Math.floor(waveNumber / 8) });
  // Wave 20 (and every 20th thereafter): dual-boss escort pattern.
  if (isBossWave(waveNumber)) {
    const bosses = waveNumber % 20 === 0 ? 2 : 1;
    comp.push({ type: 'boss', count: bosses });
  }
  return comp;
}

/**
 * Expands a wave's composition into an ordered, timed spawn list: ground
 * types round-robin (so a wave isn't one long block of a single enemy),
 * boss(es) spawn last for a clear "here it comes" beat.
 */
export function buildWaveSpawns(waveNumber: number): WaveSpawnEntry[] {
  const comp = waveComposition(waveNumber);
  const bosses = comp.filter((c) => c.type === 'boss');
  const rest = comp.filter((c) => c.type !== 'boss').map((c) => ({ ...c }));

  const order: EnemyType[] = [];
  let anyLeft = true;
  while (anyLeft) {
    anyLeft = false;
    for (const entry of rest) {
      if (entry.count > 0) {
        order.push(entry.type);
        entry.count -= 1;
        anyLeft = true;
      }
    }
  }
  for (const b of bosses) {
    for (let i = 0; i < b.count; i++) order.push(b.type);
  }

  const hpMult = waveHpMultiplier(waveNumber);
  return order.map((type, i) => ({ type, delaySec: i * SPAWN_SPACING_SEC, hpMult }));
}

/** Precomputed spawn lists for the 20-wave challenge table. */
export const WAVE_TABLE: WaveSpawnEntry[][] = Array.from({ length: TOTAL_WAVES }, (_, i) =>
  buildWaveSpawns(i + 1),
);

/** Spawn list for any wave number, including past TOTAL_WAVES for endless mode. */
export function getWaveSpawns(waveNumber: number): WaveSpawnEntry[] {
  if (waveNumber >= 1 && waveNumber <= TOTAL_WAVES) return WAVE_TABLE[waveNumber - 1];
  return buildWaveSpawns(waveNumber);
}

export interface WaveThreatDetail {
  type: EnemyType;
  name: string;
  count: number;
  hp: number;
  armor: number;
  speed: number;
  flying: boolean;
}

export interface WaveThreatSummary {
  wave: number;
  totalEnemies: number;
  entries: WaveThreatDetail[];
  hasFlyers: boolean;
  hasHeavyArmor: boolean;
  isBoss: boolean;
  tacticalTip: string;
}

export function getWaveThreatSummary(waveNumber: number): WaveThreatSummary {
  const comp = waveComposition(waveNumber);
  const hpMult = waveHpMultiplier(waveNumber);
  const entries: WaveThreatDetail[] = comp.map((c) => {
    const def = ENEMY_DEFS[c.type];
    return {
      type: c.type,
      name: def.name,
      count: c.count,
      hp: Math.round(def.hp * hpMult),
      armor: def.armor,
      speed: def.speed,
      flying: def.flying,
    };
  });

  const totalEnemies = entries.reduce((sum, e) => sum + e.count, 0);
  const hasFlyers = entries.some((e) => e.flying);
  const hasHeavyArmor = entries.some((e) => e.armor >= 4);
  const isBoss = entries.some((e) => e.type === 'boss');

  let tacticalTip = '均衡部署發條塔以抵禦敵潮。';
  if (isBoss) {
    tacticalTip = '⚠️ 首領親臨！極高血量與堅實裝甲，建議保留發條超頻（按 F 鍵）集中爆發！';
  } else if (hasFlyers && hasHeavyArmor) {
    tacticalTip = '⚠️ 警報：空襲與重裝甲同時進犯！需十字弩／電弧防空，並配合彈簧錘或迫擊砲破甲！';
  } else if (hasFlyers) {
    tacticalTip = '⚠️ 空襲警報：飛行單位無視地面迷宮！請佈署十字弩、電弧線圈或迫擊砲！';
  } else if (hasHeavyArmor) {
    tacticalTip = '🛡️ 重裝逼近：重甲抵消低額平射傷害！建議彈簧錘破甲或升級穿甲分支！';
  } else if (entries.some((e) => e.type === 'runner')) {
    tacticalTip = '⚡ 疾走鼠逼近！移動速度極快，建議以冰霜噴罐緩速或電弧線圈迅速收割！';
  }

  return {
    wave: waveNumber,
    totalEnemies,
    entries,
    hasFlyers,
    hasHeavyArmor,
    isBoss,
    tacticalTip,
  };
}

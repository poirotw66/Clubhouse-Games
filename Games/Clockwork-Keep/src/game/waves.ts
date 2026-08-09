/**
 * Wave composition. Everything here is a pure function of the wave number —
 * no randomness anywhere — so the same wave always produces the same enemy
 * list in the same order. WAVE_TABLE precomputes waves 1..20 once; endless
 * mode keeps calling buildWaveSpawns for wave numbers beyond that using the
 * same formula, so scaling stays deterministic past the 20-wave table too.
 */
import { BOSS_WAVES, TOTAL_WAVES, type EnemyType } from './constants.ts';
import type { WaveSpawnEntry } from './types.ts';

const SPAWN_SPACING_SEC = 0.55;

interface CompositionEntry {
  type: EnemyType;
  count: number;
}

/** Deterministic enemy-count formula per wave. No RNG — same wave number always yields the same counts. */
export function waveComposition(waveNumber: number): CompositionEntry[] {
  const comp: CompositionEntry[] = [];
  const gruntCount = 4 + Math.floor(waveNumber * 1.5);
  comp.push({ type: 'grunt', count: gruntCount });
  if (waveNumber >= 3) comp.push({ type: 'runner', count: 2 + Math.floor(waveNumber / 3) });
  if (waveNumber >= 6) comp.push({ type: 'ironclad', count: 1 + Math.floor(waveNumber / 5) });
  if (waveNumber >= 4) comp.push({ type: 'kite', count: 1 + Math.floor(waveNumber / 4) });
  if (BOSS_WAVES.has(waveNumber)) comp.push({ type: 'boss', count: 1 });
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

  return order.map((type, i) => ({ type, delaySec: i * SPAWN_SPACING_SEC }));
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

/** Shared race-mode option types (kept free of engine deps for easy checks). */

export type RaceMode = 'versus' | 'timeTrial';

export interface RaceOptions {
  mode: RaceMode;
  mirror: boolean;
  itemsEnabled: boolean;
  laps?: number;
}

export const DEFAULT_RACE_OPTIONS: RaceOptions = {
  mode: 'versus',
  mirror: false,
  itemsEnabled: true,
};

const DIFFICULTY_IDS = new Set(['easy', 'normal', 'hard']);

/**
 * localStorage key for best-lap records.
 * Versus includes difficulty; time trial does not (CPU difficulty unused).
 */
export function bestLapKey(
  trackId: string,
  opts: Pick<RaceOptions, 'mode' | 'mirror'>,
  difficulty = 'normal',
): string {
  const bits = [trackId, opts.mode === 'timeTrial' ? 'tt' : 'vs'];
  if (opts.mode !== 'timeTrial') {
    bits.push(DIFFICULTY_IDS.has(difficulty) ? difficulty : 'normal');
  }
  if (opts.mirror) bits.push('mir');
  return bits.join(':');
}

/**
 * Map legacy versus keys (no difficulty) onto `…:normal…`.
 * Returns null when the key is already new-format / unknown.
 */
export function migrateLegacyBestLapKey(key: string): string | null {
  const parts = key.split(':');
  if (parts.length === 2 && (parts[1] === 'vs' || parts[1] === 'tt')) {
    // TT keys stay as-is; only versus needs a difficulty segment.
    if (parts[1] === 'tt') return null;
    return `${parts[0]}:vs:normal`;
  }
  if (
    parts.length === 3 &&
    (parts[1] === 'vs' || parts[1] === 'tt') &&
    parts[2] === 'mir'
  ) {
    if (parts[1] === 'tt') return null;
    return `${parts[0]}:vs:normal:mir`;
  }
  return null;
}

/** Rewrite a best-times map in place; returns whether anything changed. */
export function migrateBestTimesMap(map: Record<string, number>): boolean {
  let dirty = false;
  for (const [key, value] of Object.entries(map)) {
    const nextKey = migrateLegacyBestLapKey(key);
    if (!nextKey) continue;
    const prev = map[nextKey];
    if (prev == null || (typeof value === 'number' && value > 0 && value < prev)) {
      map[nextKey] = value;
    }
    delete map[key];
    dirty = true;
  }
  return dirty;
}

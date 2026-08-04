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

/** localStorage key for best-lap records under a mode combo. */
export function bestLapKey(trackId: string, opts: Pick<RaceOptions, 'mode' | 'mirror'>): string {
  const bits = [trackId, opts.mode === 'timeTrial' ? 'tt' : 'vs'];
  if (opts.mirror) bits.push('mir');
  return bits.join(':');
}

/**
 * CPU rival personalities. Each style is bound to a kart colour so the
 * roster feels like named rivals rather than one bot with three difficulty knobs.
 */
export interface RivalStyle {
  id: string;
  /** Prefer this character when assigning CPU slots. */
  charId: string;
  /** Short flavour shown on the cup roster. */
  tagline: string;
  /** Multiplies CPU top-speed push (around 1.0). */
  aggression: number;
  /** Preferred signed lateral offset on the racing line. */
  lineBias: number;
  /** Scales item-use delay (<1 = chucks items sooner). */
  itemDelayScale: number;
  /** Lower = starts drifting on gentler corners. */
  driftThreshold: number;
  /** How strongly rubber-band catch-up applies to this rival. */
  rubberBandScale: number;
  /** Bias toward holding shield / oil when rolling is not available; used for timing. */
  defensive: number;
}

export const RIVAL_STYLES: RivalStyle[] = [
  {
    id: 'blitzer',
    charId: 'green',
    tagline: '直路猛衝，彎道少飄',
    aggression: 1.06,
    lineBias: 8,
    itemDelayScale: 1.15,
    driftThreshold: 0.55,
    rubberBandScale: 0.85,
    defensive: 0.25,
  },
  {
    id: 'drifter',
    charId: 'yellow',
    tagline: '彎道小噴成癮',
    aggression: 0.97,
    lineBias: -18,
    itemDelayScale: 0.9,
    driftThreshold: 0.28,
    rubberBandScale: 1.05,
    defensive: 0.4,
  },
  {
    id: 'brawler',
    charId: 'blue',
    tagline: '愛撞車、愛丟磚',
    aggression: 1.02,
    lineBias: 22,
    itemDelayScale: 0.7,
    driftThreshold: 0.4,
    rubberBandScale: 1.0,
    defensive: 0.55,
  },
  {
    id: 'tactician',
    charId: 'red',
    tagline: '穩健路線，道具謹慎',
    aggression: 1.0,
    lineBias: -6,
    itemDelayScale: 1.25,
    driftThreshold: 0.38,
    rubberBandScale: 1.1,
    defensive: 0.7,
  },
];

export function rivalForChar(charId: string): RivalStyle {
  return RIVAL_STYLES.find((r) => r.charId === charId) ?? RIVAL_STYLES[0];
}

/** Pick three CPU styles that do not reuse the player's kart colour. */
export function pickCpuRivals(playerCharId: string): RivalStyle[] {
  const pool = RIVAL_STYLES.filter((r) => r.charId !== playerCharId);
  // Prefer one of each remaining colour; fall back if somehow short.
  const picked = [...pool];
  while (picked.length < 3) {
    picked.push(RIVAL_STYLES[picked.length % RIVAL_STYLES.length]);
  }
  return picked.slice(0, 3);
}

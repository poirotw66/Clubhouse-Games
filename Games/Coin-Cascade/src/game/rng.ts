/**
 * Deterministic RNG. The whole run is a pure function of (seed, input
 * sequence), which is what makes replay and headless balance measurement
 * possible — nothing here or anywhere under src/game/ may touch Math.random
 * during play, or the same seed would stop reproducing the same run.
 */

/** FNV-1a over a string, so a seed code maps to a stable 32-bit number. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * An independent stream per purpose. Drawing every roll from one shared
 * generator makes unrelated systems shift each other: adding one bullet to a
 * pattern would change which upgrades are offered three stages later.
 */
export function streamRng(seed: number, label: string): Rng {
  return mulberry32((seed ^ hashString(label)) >>> 0);
}

/** Fisher-Yates. Never `sort(() => r() - 0.5)`: that comparator is inconsistent, so the result is engine-dependent. */
export function shuffle<T>(items: readonly T[], r: Rng): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A short human-typable seed code. Uses Math.random deliberately — this runs before a run starts, never during one. */
export function randomSeedCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) code += Math.floor(Math.random() * 36).toString(36);
  return code.toUpperCase();
}

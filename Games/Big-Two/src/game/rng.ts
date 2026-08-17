/**
 * Determinism contract: the same seed code plus the same sequence of choices
 * must always produce the same deal, so two players can trade seed codes and
 * compare hands.
 *
 * The deal is the only thing that consumes randomness here — everything after
 * it is decided by the players — so a seed code fixes the whole game tree, and
 * two people can play the same hand and compare what they did with it.
 */

/** FNV-1a over UTF-16 code units, used for both seed codes and stream labels. */
export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32: small, fast, and fully determined by its 32-bit state. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An independent stream for one specific roll in one specific run. */
export function streamRng(seed: number, label: string): () => number {
  return createRng((seed ^ hashString(label)) >>> 0);
}

/** Seed codes look like "64aa2bl7": short, lowercase, easy to read aloud. */
export function randomSeedCode(): string {
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += Math.floor(Math.random() * 36).toString(36);
  }
  return code;
}

/** Any text works as a seed code — it is hashed, not parsed. */
export function normalizeSeedCode(input: string): string {
  const cleaned = input.trim().toLowerCase().replace(/[^0-9a-z一-鿿]/g, '');
  return cleaned || randomSeedCode();
}

export function seedFromCode(code: string): number {
  return hashString(`bigtwo:${code}`);
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
}

export function randInt(rng: () => number, min: number, maxInclusive: number): number {
  return min + Math.floor(rng() * (maxInclusive - min + 1));
}

/** Sum of two halves: bell-shaped noise in [-spread, spread], mean 0. */
export function noise(rng: () => number, spread: number): number {
  return (rng() + rng() - 1) * spread;
}

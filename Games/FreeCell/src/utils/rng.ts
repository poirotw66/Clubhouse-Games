/** mulberry32: small, fast, deterministic RNG for seeded deals. */

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

/** FNV-1a style hash so date strings yield stable 32-bit seeds. */
export function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function parseSeed(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) return (Math.random() * 0xffffffff) >>> 0;
  if (/^\d+$/.test(trimmed)) return Number(trimmed) >>> 0;
  return hashString(trimmed);
}

export function shuffleWithSeed<T>(items: readonly T[], seed: number): T[] {
  const rng = createRng(seed);
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = next[i]!;
    next[i] = next[j]!;
    next[j] = tmp;
  }
  return next;
}

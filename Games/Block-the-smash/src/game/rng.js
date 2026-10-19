/** Tiny mulberry32 seeded RNG for deterministic checks and fair match pacing. */

/**
 * @param {number} seed
 * @returns {() => number} float in [0, 1)
 */
export function createRng(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Weighted pick. Weights must be positive; total need not be 1.
 * @template {string} T
 * @param {ReadonlyArray<{ id: T, weight: number }>} table
 * @param {() => number} rng
 * @returns {T}
 */
export function pickWeighted(table, rng) {
  let sum = 0;
  for (const row of table) sum += Math.max(0, row.weight);
  if (sum <= 0) return table[table.length - 1].id;
  let roll = rng() * sum;
  for (const row of table) {
    roll -= Math.max(0, row.weight);
    if (roll <= 0) return row.id;
  }
  return table[table.length - 1].id;
}

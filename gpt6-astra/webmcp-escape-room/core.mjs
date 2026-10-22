/**
 * Shared primitives for escape-room packs (no pack-specific logic).
 */

export function seedFromString(str) {
  let h = 2166136261 >>> 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

export function createRng(seed) {
  let t = seedFromString(seed) >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeObject(id, name, type, description, extras = {}) {
  return {
    id,
    name,
    type,
    visible: true,
    inspectable: true,
    interactable: true,
    locked: false,
    open: false,
    openable: false,
    room: "study",
    description,
    state: {},
    contains: [],
    clues: [],
    ...extras,
  };
}

export function shuffle(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickUniqueDigits(rng, count) {
  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const out = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

export function fourDigit(digits) {
  return digits.map((d) => String(d)).join("").padStart(4, "0");
}

export function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

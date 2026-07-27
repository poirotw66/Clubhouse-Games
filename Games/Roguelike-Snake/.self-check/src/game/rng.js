"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRng = createRng;
exports.randomSeed = randomSeed;
exports.parseSeed = parseSeed;
exports.pick = pick;
exports.randInt = randInt;
/** mulberry32: small, fast, and deterministic so a seed always rebuilds the same delve. */
function createRng(seed) {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function randomSeed() {
    return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
/** Accepts either digits ("12345") or a word, hashed to a stable 32-bit seed. */
function parseSeed(input) {
    const trimmed = input.trim();
    if (!trimmed)
        return randomSeed();
    if (/^\d+$/.test(trimmed))
        return Number(trimmed) >>> 0;
    let hash = 2166136261;
    for (let i = 0; i < trimmed.length; i++) {
        hash ^= trimmed.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function pick(rng, items) {
    return items[Math.floor(rng() * items.length)];
}
function randInt(rng, min, maxInclusive) {
    return min + Math.floor(rng() * (maxInclusive - min + 1));
}

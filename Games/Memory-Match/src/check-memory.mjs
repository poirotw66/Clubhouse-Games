import assert from 'node:assert/strict';
import { FACE_IDS, allMatched, buildDeck } from './memoryLogic.ts';

assert.equal(FACE_IDS.length, 6);
const deck = buildDeck(() => 0.5);
assert.equal(deck.length, 12);
const counts = new Map();
for (const c of deck) counts.set(c.face, (counts.get(c.face) ?? 0) + 1);
for (const id of FACE_IDS) assert.equal(counts.get(id), 2);
assert.equal(allMatched(deck), false);
assert.ok(allMatched(deck.map((c) => ({ ...c, matched: true }))));
console.log('memory-match check ok');

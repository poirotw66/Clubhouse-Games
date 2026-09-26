import assert from 'node:assert/strict';
import {
  FACE_IDS,
  allMatched,
  buildDeck,
  hintPairIndices,
} from './memoryLogic.ts';

assert.equal(FACE_IDS.length, 6);
const full = buildDeck(6, () => 0.5);
assert.equal(full.length, 12);
const easy = buildDeck(4, () => 0.5);
assert.equal(easy.length, 8);
const counts = new Map();
for (const c of easy) counts.set(c.face, (counts.get(c.face) ?? 0) + 1);
assert.equal(counts.size, 4);
for (const n of counts.values()) assert.equal(n, 2);
assert.equal(allMatched(full), false);
assert.ok(allMatched(full.map((c) => ({ ...c, matched: true }))));

const hint = hintPairIndices(easy);
assert.ok(hint);
assert.equal(easy[hint[0]].face, easy[hint[1]].face);
assert.equal(hintPairIndices(easy.map((c) => ({ ...c, matched: true }))), null);

console.log('memory-match check ok');

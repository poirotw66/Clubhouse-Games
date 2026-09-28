import assert from 'node:assert/strict';
import {
  FACE_IDS,
  THEME_OPTIONS,
  allMatched,
  bestStorageSlot,
  buildDeck,
  clampPairCount,
  hintPairIndices,
  maxPairsForTheme,
  themeFaces,
} from './memoryLogic.ts';

assert.equal(FACE_IDS.length, 6);
assert.equal(THEME_OPTIONS.length, 4);

for (const theme of THEME_OPTIONS) {
  const faces = themeFaces(theme.id);
  assert.ok(faces.length >= 4, `${theme.id} needs ≥4 faces`);
  const unique = new Set(faces);
  assert.equal(unique.size, faces.length, `${theme.id} faces must be unique`);
  for (const f of faces) assert.ok(FACE_IDS.includes(f), `${theme.id} unknown face ${f}`);

  const max = maxPairsForTheme(theme.id);
  assert.ok(max === 4 || max === 6);
  assert.equal(clampPairCount(theme.id, 6), max);

  for (const n of [4, 6]) {
    if (n > max) continue;
    const deck = buildDeck(n, theme.id, () => 0.5);
    assert.equal(deck.length, n * 2);
    const counts = new Map();
    for (const c of deck) counts.set(c.face, (counts.get(c.face) ?? 0) + 1);
    assert.equal(counts.size, n);
    for (const cnt of counts.values()) assert.equal(cnt, 2);
    for (const face of counts.keys()) {
      assert.ok(faces.slice(0, n).includes(face), `${theme.id}/${n} face not in theme pool`);
    }
  }
}

const full = buildDeck(6, 'classic', () => 0.5);
assert.equal(full.length, 12);
const easy = buildDeck(4, 'classic', () => 0.5);
assert.equal(easy.length, 8);
assert.equal(allMatched(full), false);
assert.ok(allMatched(full.map((c) => ({ ...c, matched: true }))));

const night = buildDeck(4, 'night', () => 0.1);
assert.equal(night.length, 8);
assert.equal(clampPairCount('night', 6), 4);
assert.equal(buildDeck(6, 'night', () => 0.5).length, 8, 'oversize pairCount clamps to theme max');

const hint = hintPairIndices(easy);
assert.ok(hint);
assert.equal(easy[hint[0]].face, easy[hint[1]].face);
assert.equal(hintPairIndices(easy.map((c) => ({ ...c, matched: true }))), null);

assert.equal(bestStorageSlot('classic', 'classic', 6), '6');
assert.equal(bestStorageSlot('sprint', 'classic', 4), 'sprint-4');
assert.equal(bestStorageSlot('classic', 'orchard', 4), 'orchard-4');
assert.equal(bestStorageSlot('sprint', 'jewel', 4), 'sprint-jewel-4');
assert.equal(bestStorageSlot('classic', 'night', 6), 'night-4');

console.log('memory-match check ok');

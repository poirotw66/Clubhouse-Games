import assert from 'node:assert/strict';
import {
  FACE_IDS,
  PAIR_OPTIONS,
  THEME_OPTIONS,
  allMatched,
  bestStorageSlot,
  buildDeck,
  clampPairCount,
  hintPairIndices,
  maxPairsForTheme,
  nextCombo,
  scoreForMatch,
  themeFaces,
  CPU_CAPACITY,
  CPU_RETAIN,
} from './memoryLogic.ts';
import {
  decayIsMonotonic,
  emptyCpuMemory,
  knownMatchPair,
  pickCpuMove,
  recallProbability,
  rememberRevealed,
} from './cpuAi.ts';

assert.ok(FACE_IDS.length >= 24, `need ≥24 faces, got ${FACE_IDS.length}`);
assert.equal(new Set(FACE_IDS).size, FACE_IDS.length, 'FACE_IDS must be unique');
assert.equal(THEME_OPTIONS.length, 4);
assert.deepEqual(
  PAIR_OPTIONS.map((p) => p.count),
  [6, 12, 18, 24],
);

for (const theme of THEME_OPTIONS) {
  const faces = themeFaces(theme.id);
  assert.ok(faces.length >= 12, `${theme.id} needs ≥12 faces`);
  const unique = new Set(faces);
  assert.equal(unique.size, faces.length, `${theme.id} faces must be unique`);
  for (const f of faces) assert.ok(FACE_IDS.includes(f), `${theme.id} unknown face ${f}`);

  const max = maxPairsForTheme(theme.id);
  assert.ok([6, 12, 18, 24].includes(max));
  assert.equal(clampPairCount(theme.id, 24), max);

  for (const n of [6, 12, 18, 24]) {
    if (n > max) continue;
    const deck = buildDeck(n, theme.id, () => 0.5);
    assert.equal(deck.length, n * 2, `${theme.id}/${n} card count`);
    const counts = new Map();
    for (const c of deck) counts.set(c.face, (counts.get(c.face) ?? 0) + 1);
    assert.equal(counts.size, n);
    for (const cnt of counts.values()) assert.equal(cnt, 2);
    for (const face of counts.keys()) {
      assert.ok(faces.slice(0, n).includes(face), `${theme.id}/${n} face not in theme pool`);
    }
  }
}

const full = buildDeck(24, 'classic', () => 0.5);
assert.equal(full.length, 48);
const mid = buildDeck(12, 'classic', () => 0.5);
assert.equal(mid.length, 24);
const easy = buildDeck(6, 'classic', () => 0.5);
assert.equal(easy.length, 12);
assert.equal(allMatched(full), false);
assert.ok(allMatched(full.map((c) => ({ ...c, matched: true }))));

const night = buildDeck(12, 'night', () => 0.1);
assert.equal(night.length, 24);
assert.equal(clampPairCount('night', 24), 12);
assert.equal(buildDeck(24, 'night', () => 0.5).length, 24, 'oversize pairCount clamps to theme max');

const special = buildDeck(6, 'classic', () => 0.2, { specialInsight: true });
assert.equal(special.filter((c) => c.kind === 'insight').length, 2, 'insight pair is exactly one face×2');

const hint = hintPairIndices(easy);
assert.ok(hint);
assert.equal(easy[hint[0]].face, easy[hint[1]].face);
assert.equal(hintPairIndices(easy.map((c) => ({ ...c, matched: true }))), null);

assert.equal(scoreForMatch(1), 100);
assert.equal(scoreForMatch(3), 300);
assert.equal(nextCombo(0, true), 1);
assert.equal(nextCombo(4, false), 0);

assert.equal(bestStorageSlot('classic', 'classic', 12), '12');
assert.equal(bestStorageSlot('sprint', 'classic', 6), 'sprint-6');
assert.equal(bestStorageSlot('classic', 'orchard', 12), 'orchard-12');
assert.equal(bestStorageSlot('sprint', 'jewel', 12), 'sprint-jewel-12');
assert.equal(bestStorageSlot('versus', 'classic', 12, { cpuDifficulty: 'hard' }), 'versus-hard-classic-12');
assert.equal(bestStorageSlot('special', 'night', 12), 'special-night-12');

// --- CPU memory model ---
assert.ok(decayIsMonotonic(CPU_RETAIN.easy));
assert.ok(decayIsMonotonic(CPU_RETAIN.normal));
assert.ok(decayIsMonotonic(CPU_RETAIN.hard));

const age0 = recallProbability({ index: 0, face: 'star', seenAtTurn: 5 }, 5, 'normal');
const age3 = recallProbability({ index: 0, face: 'star', seenAtTurn: 5 }, 8, 'normal');
const age8 = recallProbability({ index: 0, face: 'star', seenAtTurn: 5 }, 13, 'normal');
assert.ok(age0 >= age3 && age3 >= age8, 'recall probability must fade with age');
assert.equal(age0, 1);
assert.ok(Math.abs(age3 - CPU_RETAIN.normal ** 3) < 1e-9);

const deck = buildDeck(6, 'classic', () => 0.3);
let mem = emptyCpuMemory();
mem = rememberRevealed(mem, deck, [0, 1], 1, 'easy');
assert.ok(mem.length <= CPU_CAPACITY.easy);

mem = emptyCpuMemory();
for (let t = 0; t < 10; t++) {
  mem = rememberRevealed(mem, deck, [t % deck.length], t + 1, 'easy');
}
assert.ok(mem.length <= CPU_CAPACITY.easy, 'memory respects capacity');

const halfMatched = deck.map((c, i) => (i < 4 ? { ...c, matched: true } : c));
const [ci, cj] = pickCpuMove({
  cards: halfMatched,
  memory: emptyCpuMemory(),
  turn: 0,
  difficulty: 'hard',
  rand: () => 0.1,
});
assert.equal(halfMatched[ci].matched, false);
assert.equal(halfMatched[cj].matched, false);
assert.notEqual(ci, cj);

const knownDeck = [
  { id: 'a', face: 'star', matched: false, kind: 'normal' },
  { id: 'b', face: 'moon', matched: false, kind: 'normal' },
  { id: 'c', face: 'star', matched: false, kind: 'normal' },
  { id: 'd', face: 'moon', matched: false, kind: 'normal' },
];
const knownMem = [
  { index: 0, face: 'star', seenAtTurn: 1 },
  { index: 2, face: 'star', seenAtTurn: 1 },
];
assert.deepEqual(knownMatchPair(knownMem), [0, 2]);
const forced = pickCpuMove({
  cards: knownDeck,
  memory: knownMem,
  turn: 1,
  difficulty: 'hard',
  rand: () => 0,
});
assert.deepEqual([...forced].sort((a, b) => a - b), [0, 2]);

console.log('memory-match check ok');

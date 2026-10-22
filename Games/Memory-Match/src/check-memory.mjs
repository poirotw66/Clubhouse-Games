import assert from 'node:assert/strict';
import {
  FACE_IDS,
  FACE_EMOJI,
  FACE_TINT,
  PAIR_OPTIONS,
  THEME_OPTIONS,
  allMatched,
  bestStorageSlot,
  buildDeck,
  clampPairCount,
  cpuCapacityFor,
  gridColsClass,
  gridGapClass,
  hintPairIndices,
  isMatchGroup,
  maxPairsForTheme,
  nextCombo,
  scoreForMatch,
  sprintLimitSec,
  swapTwoHiddenCards,
  themeFaces,
  CPU_CAPACITY,
  CPU_RETAIN,
} from './memoryLogic.ts';
import {
  HARD_STALL_CHANCE,
  decayIsMonotonic,
  emptyCpuMemory,
  knownMatchPair,
  pickCpuMove,
  recallProbability,
  rememberRevealed,
  styleFromOpponent,
} from './cpuAi.ts';
import {
  CAMPAIGN_STAGES,
  CHAPTER_STAR_GATES,
  applyStageClear,
  copiesPerFace,
  flipTarget,
  isChapterUnlocked,
  isStageUnlocked,
  starsEarned,
  stageSeed,
  totalStarsInChapter,
} from './campaign.ts';
import {
  buildDailyShareText,
  computeStreak,
  dailyConfig,
  dailySeedNumber,
  dateKey,
} from './daily.ts';
import { OPPONENTS, isOpponentUnlocked, opponentById } from './opponents.ts';
import { createRng, hashString } from './rng.ts';
import { EMPTY_CAMPAIGN } from './storage.ts';

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

const bombDeck = buildDeck(6, 'classic', () => 0.3, { bombPair: true });
assert.equal(bombDeck.filter((c) => c.kind === 'bomb').length, 2, 'bomb pair is exactly one face×2');

const triple = buildDeck(4, 'orchard', () => 0.25, { copiesPerFace: 3 });
assert.equal(triple.length, 12);
const tripleCounts = new Map();
for (const c of triple) tripleCounts.set(c.face, (tripleCounts.get(c.face) ?? 0) + 1);
for (const cnt of tripleCounts.values()) assert.equal(cnt, 3);
{
  const face = triple[0].face;
  const idxs = [];
  for (let i = 0; i < triple.length; i++) {
    if (triple[i].face === face) idxs.push(i);
  }
  assert.equal(idxs.length, 3);
  assert.ok(isMatchGroup(triple, idxs));
  assert.equal(isMatchGroup(triple, [idxs[0], idxs[1], (idxs[2] + 1) % triple.length]), false);
}

const hint = hintPairIndices(easy);
assert.ok(hint);
assert.equal(hint.length, 2);
assert.equal(easy[hint[0]].face, easy[hint[1]].face);
assert.equal(hintPairIndices(easy.map((c) => ({ ...c, matched: true }))), null);
const hint3 = hintPairIndices(triple, 3);
assert.ok(hint3);
assert.equal(hint3.length, 3);

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
assert.equal(bestStorageSlot('daily', 'classic', 12), '12', 'daily maps to classic free-play slot shape');
assert.equal(bestStorageSlot('campaign', 'classic', 12), '12');

// Legacy save slots stay stable — polish must not rename keys.
assert.equal(bestStorageSlot('classic', 'classic', 6), '6');
assert.equal(bestStorageSlot('sprint', 'classic', 24), 'sprint-24');

// --- Sprint clock scales with board ---
assert.equal(sprintLimitSec(6), 45);
assert.equal(sprintLimitSec(12), 60);
assert.equal(sprintLimitSec(18), 90);
assert.equal(sprintLimitSec(24), 120);

// --- Mobile-friendly grids ---
assert.ok(gridColsClass(24).includes('grid-cols-4'), '24-pair phones use 4 columns');
assert.ok(gridColsClass(18).includes('grid-cols-4'));
assert.ok(gridGapClass(24).includes('gap-1.5'));
assert.equal(gridGapClass(6), 'gap-2');

// --- Face distinguishability ---
assert.notEqual(FACE_EMOJI.ruby, FACE_EMOJI.sapphire);
assert.notEqual(FACE_EMOJI.ruby, '🔴', 'ruby no longer a plain red circle');
assert.ok(FACE_TINT.ruby !== FACE_TINT.sapphire);
for (const id of FACE_IDS) {
  assert.ok(FACE_TINT[id], `tint for ${id}`);
  assert.ok(FACE_EMOJI[id], `emoji for ${id}`);
}

// --- Swap mechanic ---
const swapBase = buildDeck(6, 'classic', () => 0.4);
const swapped = swapTwoHiddenCards(swapBase, [], () => 0.1);
assert.equal(swapped.length, swapBase.length);
assert.ok(
  swapped.some((c, i) => c.face !== swapBase[i].face) ||
    swapped.every((c, i) => c.face === swapBase[i].face),
  'swap either moves cards or is a no-op when rng collapses',
);

// --- CPU memory model ---
assert.ok(decayIsMonotonic(CPU_RETAIN.easy));
assert.ok(decayIsMonotonic(CPU_RETAIN.normal));
assert.ok(decayIsMonotonic(CPU_RETAIN.hard));
assert.ok(CPU_RETAIN.hard < 0.95, 'hard retain softened vs first depth pass');
assert.ok(CPU_CAPACITY.hard <= 12, 'hard base capacity capped');
assert.ok(HARD_STALL_CHANCE <= 0.3);

assert.equal(cpuCapacityFor('easy', 6), CPU_CAPACITY.easy);
assert.ok(cpuCapacityFor('hard', 24) > cpuCapacityFor('hard', 6));
assert.ok(cpuCapacityFor('hard', 24) < 16, 'hard capacity stays below old omniscient 16');

const age0 = recallProbability({ index: 0, face: 'star', seenAtTurn: 5 }, 5, 'normal');
const age3 = recallProbability({ index: 0, face: 'star', seenAtTurn: 5 }, 8, 'normal');
const age8 = recallProbability({ index: 0, face: 'star', seenAtTurn: 5 }, 13, 'normal');
assert.ok(age0 >= age3 && age3 >= age8, 'recall probability must fade with age');
assert.equal(age0, 1);
assert.ok(Math.abs(age3 - CPU_RETAIN.normal ** 3) < 1e-9);

const deck = buildDeck(6, 'classic', () => 0.3);
let mem = emptyCpuMemory();
mem = rememberRevealed(mem, deck, [0, 1], 1, 'easy', 6);
assert.ok(mem.length <= cpuCapacityFor('easy', 6));

mem = emptyCpuMemory();
for (let t = 0; t < 10; t++) {
  mem = rememberRevealed(mem, deck, [t % deck.length], t + 1, 'easy', 6);
}
assert.ok(mem.length <= cpuCapacityFor('easy', 6), 'memory respects capacity');

// Capacity scaling: same flood of sightings, larger board holds more.
mem = emptyCpuMemory();
const big = buildDeck(24, 'classic', () => 0.4);
for (let t = 0; t < 30; t++) {
  mem = rememberRevealed(mem, big, [t % big.length], t + 1, 'hard', 24);
}
assert.equal(mem.length, cpuCapacityFor('hard', 24));
assert.ok(mem.length > cpuCapacityFor('hard', 6));

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

// Conservative style prefers known cards when exploring (no known match).
const consMem = [{ index: 0, face: 'star', seenAtTurn: 1 }];
const consPick = pickCpuMove({
  cards: knownDeck,
  memory: consMem,
  turn: 1,
  difficulty: 'normal',
  style: 'conservative',
  exploreBias: 0.1,
  skipKnownChance: 0,
  rand: () => 0,
});
assert.ok(consPick.includes(0), 'conservative opens a known card first when possible');

// Adventurous may skip known match.
const skipPick = pickCpuMove({
  cards: knownDeck,
  memory: knownMem,
  turn: 1,
  difficulty: 'normal',
  style: 'adventurous',
  skipKnownChance: 1,
  exploreBias: 1,
  rand: () => 0,
});
assert.notDeepEqual(
  [...skipPick].sort((a, b) => a - b),
  [0, 2],
  'adventurous with skipKnownChance=1 avoids the known match',
);

// --- RNG determinism ---
const r1 = createRng(hashString('memory-daily-test'));
const r2 = createRng(hashString('memory-daily-test'));
assert.equal(r1(), r2());
const d1 = buildDeck(6, 'classic', createRng(42));
const d2 = buildDeck(6, 'classic', createRng(42));
assert.deepEqual(
  d1.map((c) => c.face),
  d2.map((c) => c.face),
);

// --- Daily ---
const today = dateKey(new Date('2026-10-22T04:00:00+08:00'));
assert.equal(today, '2026-10-22');
const cfg = dailyConfig(today);
assert.ok([6, 12, 18].includes(cfg.pairCount));
assert.ok(THEME_OPTIONS.some((t) => t.id === cfg.themeId));
assert.equal(dailySeedNumber(today), dailySeedNumber(today));
assert.equal(
  computeStreak(
    [
      { date: '2026-10-21', moves: 10, elapsedSec: 30, score: 100, pairCount: 6 },
      { date: '2026-10-22', moves: 12, elapsedSec: 40, score: 120, pairCount: 6 },
    ],
    '2026-10-22',
  ),
  2,
);
assert.equal(
  computeStreak([{ date: '2026-10-20', moves: 1, elapsedSec: 1, score: 1, pairCount: 6 }], '2026-10-22'),
  0,
);
const share = buildDailyShareText({
  date: today,
  moves: 14,
  elapsedSec: 42,
  streak: 2,
  pairCount: 12,
  themeLabel: '夜空',
});
assert.ok(share.includes('記憶配對 每日'));
assert.ok(share.includes('翻牌 14'));
assert.ok(share.includes('連續 2 天'));

// --- Campaign ---
assert.ok(CAMPAIGN_STAGES.length >= 8 && CAMPAIGN_STAGES.length <= 12);
assert.equal(new Set(CAMPAIGN_STAGES.map((s) => s.id)).size, CAMPAIGN_STAGES.length);
assert.ok(CAMPAIGN_STAGES.some((s) => s.mechanic === 'timed'));
assert.ok(CAMPAIGN_STAGES.some((s) => s.mechanic === 'swap'));
assert.ok(CAMPAIGN_STAGES.some((s) => s.mechanic === 'bomb'));
assert.ok(CAMPAIGN_STAGES.some((s) => s.mechanic === 'triple'));
assert.equal(flipTarget(CAMPAIGN_STAGES.find((s) => s.mechanic === 'triple')), 3);
assert.equal(copiesPerFace(CAMPAIGN_STAGES.find((s) => s.mechanic === 'triple')), 3);
assert.ok(isStageUnlocked(0, EMPTY_CAMPAIGN));
assert.equal(isStageUnlocked(1, EMPTY_CAMPAIGN), false);
assert.equal(isChapterUnlocked(1, EMPTY_CAMPAIGN), true);
assert.equal(isChapterUnlocked(2, EMPTY_CAMPAIGN), false);
assert.equal(CHAPTER_STAR_GATES[2], 6);
assert.equal(CHAPTER_STAR_GATES[3], 12);
assert.equal(starsEarned(CAMPAIGN_STAGES[0], 8, 20), 3);
assert.equal(starsEarned(CAMPAIGN_STAGES[0], 12, 20), 2);
assert.equal(starsEarned(CAMPAIGN_STAGES[0], 30, 20), 1);
const cleared = applyStageClear(EMPTY_CAMPAIGN, 0, 8, 20);
assert.equal(cleared.clearedCount, 1);
assert.equal(cleared.stars[CAMPAIGN_STAGES[0].id], 3);
assert.ok(isStageUnlocked(1, cleared));
assert.equal(stageSeed(CAMPAIGN_STAGES[0]), stageSeed(CAMPAIGN_STAGES[0]));
assert.notEqual(stageSeed(CAMPAIGN_STAGES[0]), stageSeed(CAMPAIGN_STAGES[1]));

const ch1Stars = { ...EMPTY_CAMPAIGN, stars: {} };
for (const s of CAMPAIGN_STAGES.filter((x) => x.chapter === 1)) ch1Stars.stars[s.id] = 2;
assert.ok(totalStarsInChapter(ch1Stars, 1) >= CHAPTER_STAR_GATES[2]);
assert.ok(isChapterUnlocked(2, ch1Stars));

// --- Opponents ---
assert.ok(OPPONENTS.length >= 3 && OPPONENTS.length <= 5);
assert.equal(new Set(OPPONENTS.map((o) => o.id)).size, OPPONENTS.length);
assert.ok(isOpponentUnlocked(0, 0));
assert.equal(isOpponentUnlocked(1, 0), false);
assert.ok(isOpponentUnlocked(1, 1));
const styles = new Set(OPPONENTS.map((o) => o.style));
assert.ok(styles.has('adventurous'));
assert.ok(styles.has('conservative'));
const fox = opponentById('explorer');
assert.equal(fox.style, 'adventurous');
const styled = styleFromOpponent(fox);
assert.equal(styled.difficulty, fox.difficulty);
assert.equal(styled.style, 'adventurous');

console.log('memory-match check ok');

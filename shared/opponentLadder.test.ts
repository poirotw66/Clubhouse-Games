import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EMPTY_FRONTIER_LADDER,
  applyFrontierLoss,
  applyFrontierResult,
  applyFrontierWin,
  isChainUnlocked,
  isFrontierComplete,
  isFrontierUnlocked,
  mergeFrontierProgress,
} from './opponentLadder.ts';

describe('frontier ladder', () => {
  it('unlocks the frontier only', () => {
    assert.equal(isFrontierUnlocked(0, 0, 5), true);
    assert.equal(isFrontierUnlocked(1, 0, 5), false);
    assert.equal(isFrontierUnlocked(1, 1, 5), true);
    assert.equal(isFrontierUnlocked(-1, 0, 5), false);
    assert.equal(isFrontierUnlocked(5, 5, 5), false);
  });

  it('advances clearedCount only on frontier wins', () => {
    let progress = { ...EMPTY_FRONTIER_LADDER, cleared: {} as Record<string, boolean> };
    progress = applyFrontierResult(progress, {
      opponentIndex: 0,
      opponentId: 'ming',
      won: true,
      opponentCount: 5,
    });
    assert.equal(progress.clearedCount, 1);
    assert.equal(progress.cleared.ming, true);
    assert.equal(isFrontierUnlocked(1, progress.clearedCount, 5), true);

    progress = applyFrontierResult(progress, {
      opponentIndex: 1,
      opponentId: 'mei',
      won: false,
      opponentCount: 5,
    });
    assert.equal(progress.clearedCount, 1);
    assert.equal(progress.lastIndex, 1);

    progress = applyFrontierResult(progress, {
      opponentIndex: 0,
      opponentId: 'ming',
      won: true,
      opponentCount: 5,
    });
    assert.equal(progress.clearedCount, 1);
  });

  it('applyFrontierWin reports newlyCleared and caps at opponentCount', () => {
    let { progress, newlyCleared } = applyFrontierWin(EMPTY_FRONTIER_LADDER, {
      opponentIndex: 0,
      opponentId: 'greedy',
      opponentCount: 2,
    });
    assert.equal(newlyCleared, true);
    assert.equal(progress.clearedCount, 1);

    ({ progress, newlyCleared } = applyFrontierWin(progress, {
      opponentIndex: 1,
      opponentId: 'edge',
      opponentCount: 2,
    }));
    assert.equal(newlyCleared, true);
    assert.equal(isFrontierComplete(progress, 2), true);

    progress = applyFrontierLoss(progress, 1);
    assert.equal(progress.lastIndex, 1);
  });

  it('mergeFrontierProgress drops unknown ids and clamps counts', () => {
    const merged = mergeFrontierProgress(
      {
        clearedCount: 99,
        lastIndex: -3,
        cleared: { greedy: true, ghost: true },
      },
      { opponentCount: 3, validIds: ['greedy', 'edge'] },
    );
    assert.equal(merged.clearedCount, 3);
    assert.equal(merged.lastIndex, 0);
    assert.deepEqual(merged.cleared, { greedy: true });

    const high = mergeFrontierProgress(
      { clearedCount: 1, lastIndex: 99, cleared: {} },
      { opponentCount: 3 },
    );
    assert.equal(high.lastIndex, 2);
  });
});

describe('chain ladder', () => {
  it('requires the unlockAfter id', () => {
    assert.equal(isChainUnlocked(null, []), true);
    assert.equal(isChainUnlocked('rookie', []), false);
    assert.equal(isChainUnlocked('rookie', ['rookie']), true);
    assert.equal(isChainUnlocked('rusher', new Set(['rookie'])), false);
  });
});

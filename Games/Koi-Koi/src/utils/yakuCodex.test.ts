import { describe, expect, it } from 'vitest';
import {
  ALL_YAKU_IDS,
  CODEX_KEY,
  DEFAULT_CODEX,
  loadCodex,
  mergeCodex,
  recordYakuCompletions,
  saveCodex,
  unlockedCount,
} from './yakuCodex';

function memoryStorage(seed: Record<string, string> = {}) {
  const map = new Map<string, string>(Object.entries(seed));
  return {
    getItem(key: string) {
      return map.has(key) ? map.get(key)! : null;
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
    raw: map,
  };
}

describe('mergeCodex', () => {
  it('returns empty entries for null or garbage', () => {
    expect(mergeCodex(null)).toEqual(DEFAULT_CODEX);
    expect(mergeCodex('nope')).toEqual(DEFAULT_CODEX);
    expect(mergeCodex(42)).toEqual(DEFAULT_CODEX);
  });

  it('drops unknown yaku ids and invalid entry shapes', () => {
    const merged = mergeCodex({
      entries: {
        sankou: {
          firstCompletedAt: '2026-03-01',
          timesAchieved: 2,
          bestHandScore: 5,
        },
        not_a_yaku: {
          firstCompletedAt: '2026-03-01',
          timesAchieved: 1,
          bestHandScore: 1,
        },
        gokou: { firstCompletedAt: 'yesterday', timesAchieved: 1, bestHandScore: 10 },
        shikou: null,
      },
    });
    expect(Object.keys(merged.entries)).toEqual(['sankou']);
    expect(merged.entries.sankou).toEqual({
      firstCompletedAt: '2026-03-01',
      timesAchieved: 2,
      bestHandScore: 5,
    });
  });

  it('clamps negative counters and floors fractions', () => {
    const merged = mergeCodex({
      entries: {
        kasu: {
          firstCompletedAt: '2026-01-15',
          timesAchieved: -3,
          bestHandScore: 4.9,
        },
      },
    });
    expect(merged.entries.kasu).toEqual({
      firstCompletedAt: '2026-01-15',
      timesAchieved: 1,
      bestHandScore: 4,
    });
  });
});

describe('recordYakuCompletions', () => {
  it('unlocks with first-completed date and tracks times / best score', () => {
    const first = recordYakuCompletions(
      { entries: {} },
      [{ id: 'sankou', handScore: 5, nowMs: Date.parse('2026-04-10T12:00:00Z') }],
    );
    expect(first.newlyUnlocked).toEqual(['sankou']);
    expect(first.codex.entries.sankou).toEqual({
      firstCompletedAt: '2026-04-10',
      timesAchieved: 1,
      bestHandScore: 5,
    });

    const second = recordYakuCompletions(first.codex, [
      { id: 'sankou', handScore: 8, nowMs: Date.parse('2026-05-01T12:00:00Z') },
    ]);
    expect(second.newlyUnlocked).toEqual([]);
    expect(second.codex.entries.sankou).toEqual({
      firstCompletedAt: '2026-04-10',
      timesAchieved: 2,
      bestHandScore: 8,
    });
  });

  it('can refresh best score without counting another achievement', () => {
    const unlocked = recordYakuCompletions(
      { entries: {} },
      [{ id: 'kasu', handScore: 1, nowMs: Date.parse('2026-02-01T00:00:00Z') }],
    );
    const grown = recordYakuCompletions(unlocked.codex, [
      { id: 'kasu', handScore: 3, countAchievement: false },
    ]);
    expect(grown.newlyUnlocked).toEqual([]);
    expect(grown.codex.entries.kasu).toEqual({
      firstCompletedAt: '2026-02-01',
      timesAchieved: 1,
      bestHandScore: 3,
    });
  });
});

describe('loadCodex / saveCodex', () => {
  it('round-trips through storage and validates on parse', () => {
    const storage = memoryStorage();
    saveCodex(
      {
        entries: {
          akatan: {
            firstCompletedAt: '2026-06-01',
            timesAchieved: 3,
            bestHandScore: 5,
          },
        },
      },
      storage,
    );
    expect(storage.raw.get(CODEX_KEY)).toBeTruthy();
    const loaded = loadCodex(storage);
    expect(unlockedCount(loaded)).toBe(1);
    expect(loaded.entries.akatan?.timesAchieved).toBe(3);
  });

  it('ignores corrupt JSON', () => {
    const storage = memoryStorage({ [CODEX_KEY]: '{not-json' });
    expect(loadCodex(storage)).toEqual(DEFAULT_CODEX);
  });

  it('catalog covers every yaku id', () => {
    expect(ALL_YAKU_IDS).toHaveLength(12);
  });
});

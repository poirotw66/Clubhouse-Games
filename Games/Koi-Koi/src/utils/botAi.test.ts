import { describe, expect, it } from 'vitest';
import { DECK } from '../constants';
import {
  pickBotFieldMatch,
  pickBotHandPlay,
  scoreCapture,
  shouldBotKoiKoi,
  getPlayerHint,
} from './botAi';
import { DEFAULT_STATS, mergeStats, recordResult, withDifficulty } from './stats';

function card(id: string) {
  const found = DECK.find(entry => entry.id === id);
  if (!found) throw new Error(`Unknown card id: ${id}`);
  return found;
}

describe('scoreCapture', () => {
  it('prefers yaku-building hikari captures over kasu', () => {
    const captured = [card('1-1'), card('3-1')];
    const hikari = scoreCapture(card('12-1'), [card('12-2')], captured, 100);
    const kasuOnly = scoreCapture(card('4-3'), [card('4-4')], captured, 100);
    expect(hikari).toBeGreaterThan(kasuOnly);
  });
});

describe('pickBotHandPlay', () => {
  it('hard prefers a matching hikari over dumping', () => {
    const hand = [card('1-1'), card('5-3')];
    const field = [card('1-3'), card('6-3')];
    const choice = pickBotHandPlay(hand, field, [], 'hard', () => 0);
    expect(choice?.handCard.id).toBe('1-1');
    expect(choice?.fieldMatch?.id).toBe('1-3');
  });

  it('easy can pick randomly when randomRate triggers', () => {
    const hand = [card('1-1'), card('5-3')];
    const field = [card('1-3')];
    // First rng call: randomRate check (0 < 0.45 → random); second: pick index 1.
    let calls = 0;
    const rng = () => {
      calls += 1;
      return calls === 1 ? 0 : 0.99;
    };
    const choice = pickBotHandPlay(hand, field, [], 'easy', rng);
    expect(choice?.handCard.id).toBe('5-3');
  });
});

describe('pickBotFieldMatch', () => {
  it('hard picks the higher-value of two matches', () => {
    const matches = [card('8-3'), card('8-1')];
    const picked = pickBotFieldMatch(card('8-2'), matches, [], 'hard', () => 0);
    expect(picked.id).toBe('8-1');
  });
});

describe('shouldBotKoiKoi', () => {
  it('normal continues below the point cap when cards remain', () => {
    expect(
      shouldBotKoiKoi({
        totalPoints: 4,
        botHandLength: 3,
        botScore: 0,
        playerScore: 0,
        playerKoiKoiCount: 0,
        difficulty: 'normal',
      }),
    ).toBe(true);
  });

  it('normal banks at or above the point cap', () => {
    expect(
      shouldBotKoiKoi({
        totalPoints: 5,
        botHandLength: 3,
        botScore: 0,
        playerScore: 0,
        playerKoiKoiCount: 0,
        difficulty: 'normal',
      }),
    ).toBe(false);
  });

  it('hard banks when finishing would win the match', () => {
    expect(
      shouldBotKoiKoi({
        totalPoints: 3,
        botHandLength: 5,
        botScore: 10,
        playerScore: 4,
        playerKoiKoiCount: 0,
        difficulty: 'hard',
      }),
    ).toBe(false);
  });

  it('easy keeps going with higher points', () => {
    expect(
      shouldBotKoiKoi({
        totalPoints: 7,
        botHandLength: 2,
        botScore: 0,
        playerScore: 0,
        playerKoiKoiCount: 0,
        difficulty: 'easy',
      }),
    ).toBe(true);
  });
});

describe('getPlayerHint', () => {
  it('highlights a capturing hand card when available', () => {
    const hand = [card('2-3'), card('9-1')];
    const field = [card('9-3'), card('4-3')];
    const hint = getPlayerHint(hand, field, []);
    expect(hint?.handCardId).toBe('9-1');
    expect(hint?.fieldCardId).toBe('9-3');
  });
});

describe('mergeStats', () => {
  it('returns defaults for null or garbage', () => {
    expect(mergeStats(null)).toEqual(DEFAULT_STATS);
    expect(mergeStats('nope')).toEqual(DEFAULT_STATS);
  });

  it('clamps negative and non-numeric fields', () => {
    expect(
      mergeStats({
        wins: -3,
        losses: '2',
        winStreak: 1.9,
        lastDifficulty: 'nightmare',
      }),
    ).toEqual({
      wins: 0,
      losses: 2,
      winStreak: 1,
      lastDifficulty: 'normal',
    });
  });

  it('preserves a valid difficulty', () => {
    expect(mergeStats({ wins: 1, losses: 0, winStreak: 1, lastDifficulty: 'hard' }).lastDifficulty).toBe(
      'hard',
    );
  });
});

describe('recordResult', () => {
  it('increments wins and streak on win', () => {
    const next = recordResult({ ...DEFAULT_STATS, wins: 1, winStreak: 1 }, 'win');
    expect(next).toEqual({ wins: 2, losses: 0, winStreak: 2, lastDifficulty: 'normal' });
  });

  it('resets streak on loss', () => {
    const next = recordResult({ ...DEFAULT_STATS, wins: 2, winStreak: 2 }, 'loss');
    expect(next).toEqual({ wins: 2, losses: 1, winStreak: 0, lastDifficulty: 'normal' });
  });
});

describe('withDifficulty', () => {
  it('updates lastDifficulty only', () => {
    expect(withDifficulty(DEFAULT_STATS, 'easy').lastDifficulty).toBe('easy');
  });
});

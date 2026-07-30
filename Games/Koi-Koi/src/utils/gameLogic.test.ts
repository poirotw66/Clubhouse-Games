import { describe, expect, it } from 'vitest';
import { DECK } from '../constants';
import {
  calculateYakuDetail,
  getMatchWinner,
  resolveRoundScores,
  scoreToWin,
  WIN_SCORE,
} from './gameLogic';

function card(id: string) {
  const found = DECK.find(entry => entry.id === id);
  if (!found) {
    throw new Error(`Unknown card id: ${id}`);
  }
  return found;
}

describe('calculateYakuDetail', () => {
  it('groups sankou hikari cards under the yaku entry', () => {
    const captured = [card('1-1'), card('3-1'), card('12-1')];
    const detail = calculateYakuDetail(captured);

    expect(detail.yaku).toHaveLength(1);
    expect(detail.yaku[0]).toMatchObject({
      id: 'sankou',
      points: 5,
      cardIds: ['1-1', '3-1', '12-1'],
    });
    expect(detail.totalPoints).toBe(5);
    expect(detail.unassignedCardIds).toEqual([]);
  });

  it('shows overlapping cards in multiple yaku groups', () => {
    const captured = [
      card('7-1'),
      card('10-1'),
      card('6-1'),
      card('9-1'),
      card('2-1'),
      card('8-1'),
    ];
    const detail = calculateYakuDetail(captured);

    const inoShikaCho = detail.yaku.find(entry => entry.id === 'ino_shika_cho');
    const tsukimiZake = detail.yaku.find(entry => entry.id === 'tsukimi_zake');
    const taneYaku = detail.yaku.find(entry => entry.id === 'tane');

    expect(inoShikaCho?.cardIds).toEqual(['7-1', '10-1', '6-1']);
    expect(tsukimiZake?.cardIds).toEqual(['9-1', '8-1']);
    expect(taneYaku?.cardIds).toContain('9-1');
    expect(detail.yaku.flatMap(entry => entry.cardIds).filter(id => id === '9-1')).toHaveLength(2);
  });

  it('includes sake in kasu yaku and keeps unassigned kasu separate when yaku not formed', () => {
    const captured = DECK.filter(entry => entry.type === 'kasu').slice(0, 4);
    const detail = calculateYakuDetail([...captured, card('9-1')]);

    expect(detail.yaku).toHaveLength(0);
    expect(detail.unassignedCardIds).toHaveLength(5);
  });

  it('assigns kasu yaku cards including sake', () => {
    const kasuCards = DECK.filter(entry => entry.type === 'kasu').slice(0, 9);
    const captured = [...kasuCards, card('9-1')];
    const detail = calculateYakuDetail(captured);

    const kasuYaku = detail.yaku.find(entry => entry.id === 'kasu');
    expect(kasuYaku?.points).toBe(1);
    expect(kasuYaku?.cardIds).toContain('9-1');
    expect(kasuYaku?.cardIds).toHaveLength(10);
    expect(detail.unassignedCardIds).toEqual([]);
  });
});

describe('getMatchWinner', () => {
  it('returns null when neither player reaches the win score', () => {
    expect(getMatchWinner(5, 8)).toBeNull();
  });

  it('returns player when only player reaches the win score', () => {
    expect(getMatchWinner(12, 6)).toBe('player');
  });

  it('returns bot when only bot reaches the win score', () => {
    expect(getMatchWinner(8, 12)).toBe('bot');
  });

  it('returns higher score when both reach the win score', () => {
    expect(getMatchWinner(14, 12)).toBe('player');
    expect(getMatchWinner(12, 15)).toBe('bot');
  });
});

describe('scoreToWin', () => {
  it('returns remaining points to win', () => {
    expect(scoreToWin(0)).toBe(WIN_SCORE);
    expect(scoreToWin(7)).toBe(5);
    expect(scoreToWin(12)).toBe(0);
    expect(scoreToWin(15)).toBe(0);
  });
});

describe('resolveRoundScores', () => {
  it('continues match when no one reaches the win score', () => {
    const result = resolveRoundScores(4, 3, 5, 0);

    expect(result).toEqual({
      playerScore: 9,
      botScore: 3,
      phase: 'round_end',
      winner: null,
    });
  });

  it('ends match when player reaches the win score', () => {
    const result = resolveRoundScores(10, 5, 3, 0);

    expect(result.playerScore).toBe(13);
    expect(result.botScore).toBe(5);
    expect(result.phase).toBe('game_over');
    expect(result.winner).toBe('player');
  });

  it('ends match when bot reaches the win score', () => {
    const result = resolveRoundScores(6, 9, 0, 4);

    expect(result.playerScore).toBe(6);
    expect(result.botScore).toBe(13);
    expect(result.phase).toBe('game_over');
    expect(result.winner).toBe('bot');
  });

  it('awards dealer point on draw without ending match early', () => {
    const result = resolveRoundScores(11, 10, 1, 0);

    expect(result.playerScore).toBe(12);
    expect(result.botScore).toBe(10);
    expect(result.phase).toBe('game_over');
    expect(result.winner).toBe('player');
  });
});

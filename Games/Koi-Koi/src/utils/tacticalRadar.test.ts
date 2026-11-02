import { describe, it, expect } from 'vitest';
import { DECK } from '../constants';
import {
  buildCardLocationMap,
  analyzeTacticalRadar,
} from './tacticalRadar';
import type { Card } from '../types';

function getCard(id: string): Card {
  const card = DECK.find(c => c.id === id);
  if (!card) throw new Error(`Card not found: ${id}`);
  return card;
}

describe('tacticalRadar', () => {
  describe('buildCardLocationMap', () => {
    it('correctly maps locations across deck, hand, field, and captures', () => {
      const p1 = getCard('1-1'); // player captured
      const h1 = getCard('2-1'); // player hand
      const f1 = getCard('3-1'); // field
      const b1 = getCard('7-1'); // bot captured

      const map = buildCardLocationMap([p1], [h1], [f1], [b1]);

      expect(map.get('1-1')).toBe('captured_by_player');
      expect(map.get('2-1')).toBe('in_player_hand');
      expect(map.get('3-1')).toBe('on_field');
      expect(map.get('7-1')).toBe('captured_by_bot');
      expect(map.get('8-1')).toBe('unseen');
    });
  });

  describe('analyzeTacticalRadar yaku detection', () => {
    it('detects Ino-Shika-Cho tenpai when player has 2 of the 3 animals', () => {
      const playerCaptured = [getCard('7-1'), getCard('10-1')]; // boar + deer
      const radar = analyzeTacticalRadar(
        playerCaptured,
        [],
        [],
        [],
        0,
        5,
        0,
        0,
        12,
      );

      const ino = radar.yakuRadarList.find(y => y.id === 'ino_shika_cho');
      expect(ino).toBeDefined();
      expect(ino?.status).toBe('tenpai');
      expect(ino?.shanten).toBe(1);
      expect(ino?.currentCount).toBe(2);
      expect(radar.tenpaiCount).toBeGreaterThanOrEqual(1);
    });

    it('detects Ino-Shika-Cho blocked when bot captures butterfly', () => {
      const playerCaptured = [getCard('7-1'), getCard('10-1')]; // boar + deer
      const botCaptured = [getCard('6-1')]; // butterfly taken by bot!

      const radar = analyzeTacticalRadar(
        playerCaptured,
        [],
        [],
        botCaptured,
        0,
        5,
        0,
        0,
        12,
      );

      const ino = radar.yakuRadarList.find(y => y.id === 'ino_shika_cho');
      expect(ino?.status).toBe('blocked');
      expect(ino?.blockReason).toContain('牡丹與蝶');
    });

    it('detects completed Hanami-zake and Tsukimi-zake', () => {
      const playerCaptured = [
        getCard('9-1'), // sake
        getCard('3-1'), // curtain
        getCard('8-1'), // moon
      ];

      const radar = analyzeTacticalRadar(
        playerCaptured,
        [],
        [],
        [],
        10,
        4,
        0,
        0,
        12,
      );

      const hanami = radar.yakuRadarList.find(y => y.id === 'hanami_zake');
      const tsukimi = radar.yakuRadarList.find(y => y.id === 'tsukimi_zake');

      expect(hanami?.status).toBe('completed');
      expect(tsukimi?.status).toBe('completed');
      expect(radar.completedCount).toBeGreaterThanOrEqual(2);
    });

    it('identifies Akatan tenpai and remaining needed card location', () => {
      const playerCaptured = [getCard('1-2'), getCard('2-2')]; // 2 akatan
      const field = [getCard('3-2')]; // 3rd akatan is on field!

      const radar = analyzeTacticalRadar(
        playerCaptured,
        [],
        field,
        [],
        0,
        6,
        0,
        0,
        12,
      );

      const akatan = radar.yakuRadarList.find(y => y.id === 'akatan');
      expect(akatan?.status).toBe('tenpai');
      expect(akatan?.neededCards[0].card.id).toBe('3-2');
      expect(akatan?.neededCards[0].location).toBe('on_field');
    });
  });

  describe('opponent threat & risk scale', () => {
    it('elevates threat level to critical when bot is 9/10 Kasu and in tenpai', () => {
      const botCaptured = [
        getCard('1-3'),
        getCard('1-4'),
        getCard('2-3'),
        getCard('2-4'),
        getCard('3-3'),
        getCard('3-4'),
        getCard('4-3'),
        getCard('4-4'),
        getCard('5-3'), // 9 kasu cards!
      ];

      const radar = analyzeTacticalRadar(
        [],
        [],
        [],
        botCaptured,
        5,
        4,
        0,
        8,
        12,
      );

      expect(radar.opponentThreat.score).toBeGreaterThanOrEqual(40);
      expect(radar.opponentThreat.warningMessages.some(m => m.includes('粕牌'))).toBe(true);
      expect(radar.koiKoiRisk.recommendation).toBe('take_points');
    });

    it('recommends Koi-Koi when bot threat is low and player has expandable tenpai', () => {
      const playerCaptured = [getCard('1-2'), getCard('2-2')]; // Akatan tenpai
      const radar = analyzeTacticalRadar(
        playerCaptured,
        [],
        [],
        [],
        5,
        6,
        0,
        0,
        12,
      );

      expect(radar.opponentThreat.level).toBe('low');
      expect(radar.koiKoiRisk.canExpandYaku).toBe(true);
      expect(radar.koiKoiRisk.recommendation).toBe('call_koi_koi');
    });
  });
});

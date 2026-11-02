import { Card, CardType, YakuId } from '../types';
import { DECK } from '../constants';
import { calculateYakuDetail } from './gameLogic';

export type CardLocation =
  | 'captured_by_player'
  | 'in_player_hand'
  | 'on_field'
  | 'captured_by_bot'
  | 'unseen';

export interface CardTacticalInfo {
  card: Card;
  location: CardLocation;
  isKey: boolean;
}

export type YakuProgressStatus =
  | 'completed'
  | 'tenpai'
  | 'one_away'
  | 'in_progress'
  | 'blocked';

export type YakuCategory = 'hikari' | 'special' | 'sake' | 'ribbon' | 'basic';

export interface YakuRadarItem {
  id: YakuId;
  name: string;
  category: YakuCategory;
  status: YakuProgressStatus;
  statusLabel: string;
  shanten: number; // 0 = completed, 1 = tenpai, 2 = 1-away, etc.
  currentCount: number;
  targetCount: number;
  points: number;
  cards: CardTacticalInfo[];
  neededCards: CardTacticalInfo[];
  blockReason?: string;
}

export type ThreatLevel = 'low' | 'medium' | 'high' | 'critical';

export interface OpponentThreatSummary {
  level: ThreatLevel;
  levelLabel: string;
  score: number; // 0 - 100
  warningMessages: string[];
  botTenpaiYaku: string[];
  kasuProgress: { current: number; target: number };
  tanzakuProgress: { current: number; target: number };
  taneProgress: { current: number; target: number };
  hikariProgress: { current: number; target: number };
}

export type KoiKoiRecommendation = 'call_koi_koi' | 'take_points' | 'balanced';

export interface KoiKoiRiskScale {
  currentPoints: number;
  projectedMultiplier: number;
  opponentThreatScore: number;
  recommendation: KoiKoiRecommendation;
  recommendationLabel: string;
  advice: string;
  canExpandYaku: boolean;
  expandableYakuNames: string[];
}

export interface TacticalRadarState {
  yakuRadarList: YakuRadarItem[];
  tenpaiCount: number;
  oneAwayCount: number;
  completedCount: number;
  opponentThreat: OpponentThreatSummary;
  koiKoiRisk: KoiKoiRiskScale;
}

/**
 * Builds a fast lookup map of every card's current known location.
 */
export function buildCardLocationMap(
  playerCaptured: Card[],
  playerHand: Card[],
  field: Card[],
  botCaptured: Card[],
): Map<string, CardLocation> {
  const map = new Map<string, CardLocation>();

  for (const card of DECK) {
    map.set(card.id, 'unseen');
  }
  for (const card of field) {
    map.set(card.id, 'on_field');
  }
  for (const card of playerHand) {
    map.set(card.id, 'in_player_hand');
  }
  for (const card of botCaptured) {
    map.set(card.id, 'captured_by_bot');
  }
  for (const card of playerCaptured) {
    map.set(card.id, 'captured_by_player');
  }

  return map;
}

export function getStatusLabel(status: YakuProgressStatus, shanten: number): string {
  switch (status) {
    case 'completed':
      return '已成役';
    case 'tenpai':
      return '聽牌（差 1 張）';
    case 'one_away':
      return '一向聽（差 2 張）';
    case 'in_progress':
      return `進行中（差 ${shanten} 張）`;
    case 'blocked':
      return '已遭阻斷';
  }
}

/**
 * Analyzes all yaku progress and remaining card distribution for the player.
 */
export function analyzeTacticalRadar(
  playerCaptured: Card[],
  playerHand: Card[],
  field: Card[],
  botCaptured: Card[],
  playerPoints: number,
  botHandCount: number,
  playerKoiKoiCount: number,
  botScore: number,
  winScore: number,
): TacticalRadarState {
  const locMap = buildCardLocationMap(playerCaptured, playerHand, field, botCaptured);

  const getCardInfo = (card: Card, isKey: boolean = false): CardTacticalInfo => ({
    card,
    location: locMap.get(card.id) ?? 'unseen',
    isKey,
  });

  const deckCardsById = new Map(DECK.map(c => [c.id, c]));
  const getCardById = (id: string): Card => deckCardsById.get(id)!;

  const playerDetail = calculateYakuDetail(playerCaptured);
  const completedYakuIds = new Set(playerDetail.yaku.map(y => y.id));

  const items: YakuRadarItem[] = [];

  // 1. 五光 (Gokou)
  const hikariCards = DECK.filter(c => c.type === 'hikari');
  const rainManCard = hikariCards.find(c => c.subType === 'rain_man')!;
  const nonRainHikari = hikariCards.filter(c => c.subType !== 'rain_man');

  const botHikari = botCaptured.filter(c => c.type === 'hikari');
  const playerHikari = playerCaptured.filter(c => c.type === 'hikari');

  {
    const targetCount = 5;
    const currentCount = playerHikari.length;
    const shanten = Math.max(0, targetCount - currentCount);
    const isCompleted = completedYakuIds.has('gokou');
    const isBlocked = botHikari.length > 0;
    const status: YakuProgressStatus = isCompleted
      ? 'completed'
      : isBlocked
        ? 'blocked'
        : shanten === 1
          ? 'tenpai'
          : shanten === 2
            ? 'one_away'
            : 'in_progress';

    const cardInfos = hikariCards.map(c => getCardInfo(c, true));
    items.push({
      id: 'gokou',
      name: '五光',
      category: 'hikari',
      status,
      statusLabel: getStatusLabel(status, shanten),
      shanten,
      currentCount,
      targetCount,
      points: 10,
      cards: cardInfos,
      neededCards: cardInfos.filter(c => c.location !== 'captured_by_player'),
      blockReason: isBlocked ? `對手已獲取 ${botHikari.length} 張光牌` : undefined,
    });
  }

  // 2. 四光 (Shikou) - 4 non-rain hikari
  {
    const targetCount = 4;
    const playerNonRain = playerHikari.filter(c => c.subType !== 'rain_man');
    const botNonRain = botHikari.filter(c => c.subType !== 'rain_man');
    const currentCount = playerNonRain.length;
    const shanten = Math.max(0, targetCount - currentCount);
    const isCompleted = completedYakuIds.has('shikou');
    const isBlocked = botNonRain.length > 0;
    const status: YakuProgressStatus = isCompleted
      ? 'completed'
      : isBlocked
        ? 'blocked'
        : shanten === 1
          ? 'tenpai'
          : shanten === 2
            ? 'one_away'
            : 'in_progress';

    const cardInfos = nonRainHikari.map(c => getCardInfo(c, true));
    items.push({
      id: 'shikou',
      name: '四光',
      category: 'hikari',
      status,
      statusLabel: getStatusLabel(status, shanten),
      shanten,
      currentCount,
      targetCount,
      points: 8,
      cards: cardInfos,
      neededCards: cardInfos.filter(c => c.location !== 'captured_by_player'),
      blockReason: isBlocked ? '對手已截獲非雨光牌' : undefined,
    });
  }

  // 3. 雨四光 (Ame-Shikou) - 3 non-rain + rain_man
  {
    const targetCount = 4;
    const currentCount = playerHikari.length;
    const hasRain = playerHikari.some(c => c.subType === 'rain_man');
    const botHasRain = botHikari.some(c => c.subType === 'rain_man');
    const botNonRainCount = botHikari.filter(c => c.subType !== 'rain_man').length;
    const isCompleted = completedYakuIds.has('ame_shikou');
    const isBlocked = botHasRain || botNonRainCount >= 2;
    const shanten = hasRain ? Math.max(0, 4 - currentCount) : Math.max(1, 4 - currentCount);
    const status: YakuProgressStatus = isCompleted
      ? 'completed'
      : isBlocked
        ? 'blocked'
        : shanten === 1
          ? 'tenpai'
          : shanten === 2
            ? 'one_away'
            : 'in_progress';

    const cardInfos = hikariCards.map(c => getCardInfo(c, c.subType === 'rain_man'));
    items.push({
      id: 'ame_shikou',
      name: '雨四光',
      category: 'hikari',
      status,
      statusLabel: getStatusLabel(status, shanten),
      shanten,
      currentCount,
      targetCount,
      points: 7,
      cards: cardInfos,
      neededCards: cardInfos.filter(c => c.location !== 'captured_by_player'),
      blockReason: isBlocked
        ? botHasRain
          ? '對手已獲取柳與小野道風（雨中人）'
          : '對手截獲過多光牌'
        : undefined,
    });
  }

  // 4. 三光 (Sankou) - 3 non-rain hikari
  {
    const targetCount = 3;
    const playerNonRain = playerHikari.filter(c => c.subType !== 'rain_man');
    const botNonRain = botHikari.filter(c => c.subType !== 'rain_man');
    const currentCount = playerNonRain.length;
    const shanten = Math.max(0, targetCount - currentCount);
    const isCompleted = completedYakuIds.has('sankou');
    const isBlocked = botNonRain.length >= 2; // only 2 non-rain left in game
    const status: YakuProgressStatus = isCompleted
      ? 'completed'
      : isBlocked
        ? 'blocked'
        : shanten === 1
          ? 'tenpai'
          : shanten === 2
            ? 'one_away'
            : 'in_progress';

    const cardInfos = nonRainHikari.map(c => getCardInfo(c, false));
    items.push({
      id: 'sankou',
      name: '三光',
      category: 'hikari',
      status,
      statusLabel: getStatusLabel(status, shanten),
      shanten,
      currentCount,
      targetCount,
      points: 5,
      cards: cardInfos,
      neededCards: cardInfos.filter(c => c.location !== 'captured_by_player'),
      blockReason: isBlocked ? '對手已獲取 2 張以上非雨光牌' : undefined,
    });
  }

  // 5. 豬鹿蝶 (Ino-Shika-Cho)
  {
    const inoShikaChoCards = [getCardById('7-1'), getCardById('10-1'), getCardById('6-1')];
    const playerInoCount = inoShikaChoCards.filter(c => locMap.get(c.id) === 'captured_by_player').length;
    const botIno = inoShikaChoCards.filter(c => locMap.get(c.id) === 'captured_by_bot');
    const isCompleted = completedYakuIds.has('ino_shika_cho');
    const isBlocked = botIno.length > 0;
    const shanten = Math.max(0, 3 - playerInoCount);
    const status: YakuProgressStatus = isCompleted
      ? 'completed'
      : isBlocked
        ? 'blocked'
        : shanten === 1
          ? 'tenpai'
          : shanten === 2
            ? 'one_away'
            : 'in_progress';

    const cardInfos = inoShikaChoCards.map(c => getCardInfo(c, true));
    items.push({
      id: 'ino_shika_cho',
      name: '豬鹿蝶',
      category: 'special',
      status,
      statusLabel: getStatusLabel(status, shanten),
      shanten,
      currentCount: playerInoCount,
      targetCount: 3,
      points: 5,
      cards: cardInfos,
      neededCards: cardInfos.filter(c => c.location !== 'captured_by_player'),
      blockReason: isBlocked ? `對手已獲取 ${botIno.map(c => c.name).join('、')}` : undefined,
    });
  }

  // 6. 花見酒 (Hanami-zake): 9-1 (sake) + 3-1 (curtain)
  {
    const hanamiCards = [getCardById('9-1'), getCardById('3-1')];
    const playerCount = hanamiCards.filter(c => locMap.get(c.id) === 'captured_by_player').length;
    const botCapturedCards = hanamiCards.filter(c => locMap.get(c.id) === 'captured_by_bot');
    const isCompleted = completedYakuIds.has('hanami_zake');
    const isBlocked = botCapturedCards.length > 0;
    const shanten = Math.max(0, 2 - playerCount);
    const status: YakuProgressStatus = isCompleted
      ? 'completed'
      : isBlocked
        ? 'blocked'
        : shanten === 1
          ? 'tenpai'
          : 'in_progress';

    const cardInfos = hanamiCards.map(c => getCardInfo(c, true));
    items.push({
      id: 'hanami_zake',
      name: '花見酒',
      category: 'sake',
      status,
      statusLabel: getStatusLabel(status, shanten),
      shanten,
      currentCount: playerCount,
      targetCount: 2,
      points: 5,
      cards: cardInfos,
      neededCards: cardInfos.filter(c => c.location !== 'captured_by_player'),
      blockReason: isBlocked ? `對手已獲取 ${botCapturedCards.map(c => c.name).join('、')}` : undefined,
    });
  }

  // 7. 月見酒 (Tsukimi-zake): 9-1 (sake) + 8-1 (moon)
  {
    const tsukimiCards = [getCardById('9-1'), getCardById('8-1')];
    const playerCount = tsukimiCards.filter(c => locMap.get(c.id) === 'captured_by_player').length;
    const botCapturedCards = tsukimiCards.filter(c => locMap.get(c.id) === 'captured_by_bot');
    const isCompleted = completedYakuIds.has('tsukimi_zake');
    const isBlocked = botCapturedCards.length > 0;
    const shanten = Math.max(0, 2 - playerCount);
    const status: YakuProgressStatus = isCompleted
      ? 'completed'
      : isBlocked
        ? 'blocked'
        : shanten === 1
          ? 'tenpai'
          : 'in_progress';

    const cardInfos = tsukimiCards.map(c => getCardInfo(c, true));
    items.push({
      id: 'tsukimi_zake',
      name: '月見酒',
      category: 'sake',
      status,
      statusLabel: getStatusLabel(status, shanten),
      shanten,
      currentCount: playerCount,
      targetCount: 2,
      points: 5,
      cards: cardInfos,
      neededCards: cardInfos.filter(c => c.location !== 'captured_by_player'),
      blockReason: isBlocked ? `對手已獲取 ${botCapturedCards.map(c => c.name).join('、')}` : undefined,
    });
  }

  // 8. 赤短 (Akatan)
  {
    const akatanCards = [getCardById('1-2'), getCardById('2-2'), getCardById('3-2')];
    const playerCount = akatanCards.filter(c => locMap.get(c.id) === 'captured_by_player').length;
    const botCapturedCards = akatanCards.filter(c => locMap.get(c.id) === 'captured_by_bot');
    const isCompleted = completedYakuIds.has('akatan');
    const isBlocked = botCapturedCards.length > 0;
    const shanten = Math.max(0, 3 - playerCount);
    const status: YakuProgressStatus = isCompleted
      ? 'completed'
      : isBlocked
        ? 'blocked'
        : shanten === 1
          ? 'tenpai'
          : shanten === 2
            ? 'one_away'
            : 'in_progress';

    const cardInfos = akatanCards.map(c => getCardInfo(c, true));
    items.push({
      id: 'akatan',
      name: '赤短',
      category: 'ribbon',
      status,
      statusLabel: getStatusLabel(status, shanten),
      shanten,
      currentCount: playerCount,
      targetCount: 3,
      points: 5,
      cards: cardInfos,
      neededCards: cardInfos.filter(c => c.location !== 'captured_by_player'),
      blockReason: isBlocked ? '對手已獲取赤短短冊' : undefined,
    });
  }

  // 9. 青短 (Aotan)
  {
    const aotanCards = [getCardById('6-2'), getCardById('9-2'), getCardById('10-2')];
    const playerCount = aotanCards.filter(c => locMap.get(c.id) === 'captured_by_player').length;
    const botCapturedCards = aotanCards.filter(c => locMap.get(c.id) === 'captured_by_bot');
    const isCompleted = completedYakuIds.has('aotan');
    const isBlocked = botCapturedCards.length > 0;
    const shanten = Math.max(0, 3 - playerCount);
    const status: YakuProgressStatus = isCompleted
      ? 'completed'
      : isBlocked
        ? 'blocked'
        : shanten === 1
          ? 'tenpai'
          : shanten === 2
            ? 'one_away'
            : 'in_progress';

    const cardInfos = aotanCards.map(c => getCardInfo(c, true));
    items.push({
      id: 'aotan',
      name: '青短',
      category: 'ribbon',
      status,
      statusLabel: getStatusLabel(status, shanten),
      shanten,
      currentCount: playerCount,
      targetCount: 3,
      points: 5,
      cards: cardInfos,
      neededCards: cardInfos.filter(c => c.location !== 'captured_by_player'),
      blockReason: isBlocked ? '對手已獲取青短短冊' : undefined,
    });
  }

  // 10. 短冊 (Tanzaku) - 5+ tanzaku cards
  {
    const allTanzaku = DECK.filter(c => c.type === 'tanzaku');
    const playerTanzaku = playerCaptured.filter(c => c.type === 'tanzaku');
    const botTanzaku = botCaptured.filter(c => c.type === 'tanzaku');
    const currentCount = playerTanzaku.length;
    const targetCount = 5;
    const remainingPossible = allTanzaku.length - botTanzaku.length;
    const isCompleted = completedYakuIds.has('tanzaku');
    const isBlocked = remainingPossible < targetCount;
    const shanten = Math.max(0, targetCount - currentCount);
    const status: YakuProgressStatus = isCompleted
      ? 'completed'
      : isBlocked
        ? 'blocked'
        : shanten === 1
          ? 'tenpai'
          : shanten === 2
            ? 'one_away'
            : 'in_progress';

    const cardInfos = allTanzaku.map(c => getCardInfo(c, false));
    items.push({
      id: 'tanzaku',
      name: '短冊',
      category: 'ribbon',
      status,
      statusLabel: getStatusLabel(status, shanten),
      shanten,
      currentCount,
      targetCount,
      points: isCompleted ? Math.max(1, 1 + (currentCount - 5)) : 1,
      cards: cardInfos,
      neededCards: cardInfos.filter(c => c.location !== 'captured_by_player' && c.location !== 'captured_by_bot'),
      blockReason: isBlocked ? '場上剩餘短冊不足 5 張' : undefined,
    });
  }

  // 11. 種 (Tane) - 5+ tane cards
  {
    const allTane = DECK.filter(c => c.type === 'tane');
    const playerTane = playerCaptured.filter(c => c.type === 'tane');
    const botTane = botCaptured.filter(c => c.type === 'tane');
    const currentCount = playerTane.length;
    const targetCount = 5;
    const remainingPossible = allTane.length - botTane.length;
    const isCompleted = completedYakuIds.has('tane');
    const isBlocked = remainingPossible < targetCount;
    const shanten = Math.max(0, targetCount - currentCount);
    const status: YakuProgressStatus = isCompleted
      ? 'completed'
      : isBlocked
        ? 'blocked'
        : shanten === 1
          ? 'tenpai'
          : shanten === 2
            ? 'one_away'
            : 'in_progress';

    const cardInfos = allTane.map(c => getCardInfo(c, false));
    items.push({
      id: 'tane',
      name: '種',
      category: 'basic',
      status,
      statusLabel: getStatusLabel(status, shanten),
      shanten,
      currentCount,
      targetCount,
      points: isCompleted ? Math.max(1, 1 + (currentCount - 5)) : 1,
      cards: cardInfos,
      neededCards: cardInfos.filter(c => c.location !== 'captured_by_player' && c.location !== 'captured_by_bot'),
      blockReason: isBlocked ? '場上剩餘種牌不足 5 張' : undefined,
    });
  }

  // 12. 粕 (Kasu) - 10+ kasu cards (sake counts as +1 kasu)
  {
    const allKasu = DECK.filter(c => c.type === 'kasu');
    const playerKasu = playerCaptured.filter(c => c.type === 'kasu');
    const playerHasSake = playerCaptured.some(c => c.subType === 'sake');
    const currentCount = playerKasu.length + (playerHasSake ? 1 : 0);
    const targetCount = 10;
    const isCompleted = completedYakuIds.has('kasu');
    const shanten = Math.max(0, targetCount - currentCount);
    const status: YakuProgressStatus = isCompleted
      ? 'completed'
      : shanten === 1
        ? 'tenpai'
        : shanten === 2
          ? 'one_away'
          : 'in_progress';

    const cardInfos = allKasu.map(c => getCardInfo(c, false));
    items.push({
      id: 'kasu',
      name: '粕',
      category: 'basic',
      status,
      statusLabel: getStatusLabel(status, shanten),
      shanten,
      currentCount,
      targetCount,
      points: isCompleted ? Math.max(1, 1 + (currentCount - 10)) : 1,
      cards: cardInfos,
      neededCards: cardInfos.filter(c => c.location !== 'captured_by_player' && c.location !== 'captured_by_bot'),
    });
  }

  // Opponent Threat Analysis
  const botDetail = calculateYakuDetail(botCaptured);
  const botKasu = botCaptured.filter(c => c.type === 'kasu');
  const botHasSake = botCaptured.some(c => c.subType === 'sake');
  const botKasuEffective = botKasu.length + (botHasSake ? 1 : 0);
  const botTanzaku = botCaptured.filter(c => c.type === 'tanzaku');
  const botTane = botCaptured.filter(c => c.type === 'tane');

  const warnings: string[] = [];
  const botTenpaiList: string[] = [];
  let threatScore = 10;

  // Kasu threat
  if (botKasuEffective >= 9) {
    warnings.push(`粕牌已達 ${botKasuEffective}/10（聽牌速攻）`);
    botTenpaiList.push('粕牌');
    threatScore += 35;
  } else if (botKasuEffective >= 7) {
    warnings.push(`粕牌積累中 (${botKasuEffective}/10)`);
    threatScore += 15;
  }

  // Tanzaku threat
  if (botTanzaku.length === 4) {
    warnings.push('短冊已達 4/5（聽牌）');
    botTenpaiList.push('短冊');
    threatScore += 30;
  } else if (botTanzaku.length === 3) {
    threatScore += 12;
  }

  // Tane threat
  if (botTane.length === 4) {
    warnings.push('種牌已達 4/5（聽牌）');
    botTenpaiList.push('種牌');
    threatScore += 30;
  } else if (botTane.length === 3) {
    threatScore += 12;
  }

  // Sake threat
  const curtainLoc = locMap.get('3-1');
  const moonLoc = locMap.get('8-1');
  if (botHasSake) {
    if (curtainLoc !== 'captured_by_player' && moonLoc !== 'captured_by_player') {
      warnings.push('持有菊盃，花見／月見酒均具極高威脅！');
      threatScore += 35;
    } else if (curtainLoc !== 'captured_by_player') {
      warnings.push('持有菊盃，櫻與幕尚未被截獲！');
      threatScore += 25;
    } else if (moonLoc !== 'captured_by_player') {
      warnings.push('持有菊盃，芒與月尚未被截獲！');
      threatScore += 25;
    }
  }

  // Ino-Shika-Cho threat for bot
  const botBoar = botCaptured.some(c => c.subType === 'boar');
  const botDeer = botCaptured.some(c => c.subType === 'deer');
  const botButterfly = botCaptured.some(c => c.subType === 'butterfly');
  const botInoCount = (botBoar ? 1 : 0) + (botDeer ? 1 : 0) + (botButterfly ? 1 : 0);
  if (botInoCount === 2) {
    const missing = !botBoar ? '野豬' : !botDeer ? '鹿' : '蝴蝶';
    warnings.push(`豬鹿蝶聽牌（差 ${missing}）`);
    botTenpaiList.push('豬鹿蝶');
    threatScore += 30;
  }

  // Akatan / Aotan threat for bot
  const botAkatan = botCaptured.filter(c => c.subType === 'akatan').length;
  const botAotan = botCaptured.filter(c => c.subType === 'aotan').length;
  if (botAkatan === 2) {
    warnings.push('赤短聽牌（2/3）');
    botTenpaiList.push('赤短');
    threatScore += 25;
  }
  if (botAotan === 2) {
    warnings.push('青短聽牌（2/3）');
    botTenpaiList.push('青短');
    threatScore += 25;
  }

  // Hikari threat for bot
  if (botHikari.length === 3) {
    warnings.push('光牌已達 3 張（極高四光威脅）');
    threatScore += 30;
  } else if (botHikari.length === 2) {
    threatScore += 15;
  }

  // If player called Koi-Koi, risk escalates dramatically
  if (playerKoiKoiCount > 0) {
    threatScore = Math.min(100, threatScore + 20);
  }

  threatScore = Math.min(100, Math.max(5, threatScore));

  let level: ThreatLevel = 'low';
  let levelLabel = '低（情勢平穩）';
  if (threatScore >= 80) {
    level = 'critical';
    levelLabel = '絕凶（隨時成役！）';
  } else if (threatScore >= 60) {
    level = 'high';
    levelLabel = '高危（對手聽牌中）';
  } else if (threatScore >= 35) {
    level = 'medium';
    levelLabel = '警戒（注意對手手牌）';
  }

  const opponentThreat: OpponentThreatSummary = {
    level,
    levelLabel,
    score: threatScore,
    warningMessages: warnings.length > 0 ? warnings : ['對手暫無迫切成役威脅，局勢在掌握中。'],
    botTenpaiYaku: botTenpaiList,
    kasuProgress: { current: botKasuEffective, target: 10 },
    tanzakuProgress: { current: botTanzaku.length, target: 5 },
    taneProgress: { current: botTane.length, target: 5 },
    hikariProgress: { current: botHikari.length, target: 5 },
  };

  // Koi-Koi Risk & EV Scale
  const expandable = items.filter(
    item => item.status === 'tenpai' || (item.status === 'one_away' && botHandCount >= 2),
  );
  const canExpandYaku = expandable.length > 0;
  const expandableNames = expandable.map(e => e.name);

  let recommendation: KoiKoiRecommendation = 'balanced';
  let recommendationLabel = '均勢博弈';
  let advice = '';

  const potentialLoss = (botDetail.totalPoints > 0 ? botDetail.totalPoints : 5) * 2;
  const botWinsGameImmediately = botScore + potentialLoss >= winScore;

  if (botWinsGameImmediately || level === 'critical') {
    recommendation = 'take_points';
    recommendationLabel = '穩健勝負';
    advice = '對手已具備極高成役威脅，若被截胡將失分加倍甚至直接輸掉整場！建議見好就收，立即結算。';
  } else if (level === 'low' && canExpandYaku && botHandCount >= 2) {
    recommendation = 'call_koi_koi';
    recommendationLabel = '大膽來來';
    advice = `對手威脅低且我方「${expandableNames.slice(0, 2).join('、')}」極具進展空間，加碼 Koi-Koi 期望值極高！`;
  } else if (canExpandYaku) {
    recommendation = 'balanced';
    recommendationLabel = '加碼博弈';
    advice = `我方可追「${expandableNames.slice(0, 2).join('、')}」，但對手已有所積累，可斟酌手牌與場牌配對率。`;
  } else {
    recommendation = 'take_points';
    recommendationLabel = '結算收分';
    advice = '當前無明顯易追之後續役種，及時勝負落袋為安為上策。';
  }

  const koiKoiRisk: KoiKoiRiskScale = {
    currentPoints: playerPoints,
    projectedMultiplier: playerKoiKoiCount > 0 ? 2 : 1,
    opponentThreatScore: threatScore,
    recommendation,
    recommendationLabel,
    advice,
    canExpandYaku,
    expandableYakuNames: expandableNames,
  };

  const tenpaiCount = items.filter(i => i.status === 'tenpai').length;
  const oneAwayCount = items.filter(i => i.status === 'one_away').length;
  const completedCount = items.filter(i => i.status === 'completed').length;

  return {
    yakuRadarList: items,
    tenpaiCount,
    oneAwayCount,
    completedCount,
    opponentThreat,
    koiKoiRisk,
  };
}

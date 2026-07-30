import { Card, YakuDetail, YakuResult } from '../types';
import { DECK } from '../constants';

export function shuffle(array: Card[]): Card[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

export function deal() {
  const deck = shuffle(DECK);
  const playerHand = deck.splice(0, 8);
  const botHand = deck.splice(0, 8);
  const field = deck.splice(0, 8);
  return { deck, playerHand, botHand, field };
}

function cardIds(cards: Card[]): string[] {
  return cards.map(card => card.id);
}

export function calculateYakuDetail(captured: Card[]): YakuDetail {
  const yaku: YakuResult[] = [];
  let totalPoints = 0;

  const hikari = captured.filter(card => card.type === 'hikari');
  const tane = captured.filter(card => card.type === 'tane');
  const tanzaku = captured.filter(card => card.type === 'tanzaku');
  const kasu = captured.filter(card => card.type === 'kasu');

  const hasRainMan = hikari.some(card => card.subType === 'rain_man');
  const nonRainHikari = hikari.filter(card => card.subType !== 'rain_man');

  if (hikari.length === 5) {
    yaku.push({ id: 'gokou', name: '五光 (Gokou)', points: 10, cardIds: cardIds(hikari) });
    totalPoints += 10;
  } else if (hikari.length === 4) {
    if (hasRainMan) {
      yaku.push({ id: 'ame_shikou', name: '雨四光 (Ame-Shikou)', points: 7, cardIds: cardIds(hikari) });
      totalPoints += 7;
    } else {
      yaku.push({ id: 'shikou', name: '四光 (Shikou)', points: 8, cardIds: cardIds(hikari) });
      totalPoints += 8;
    }
  } else if (hikari.length === 3 && !hasRainMan) {
    yaku.push({ id: 'sankou', name: '三光 (Sankou)', points: 5, cardIds: cardIds(nonRainHikari) });
    totalPoints += 5;
  }

  const boar = tane.find(card => card.subType === 'boar');
  const deer = tane.find(card => card.subType === 'deer');
  const butterfly = tane.find(card => card.subType === 'butterfly');
  if (boar && deer && butterfly) {
    yaku.push({
      id: 'ino_shika_cho',
      name: '豬鹿蝶 (Ino-Shika-Cho)',
      points: 5,
      cardIds: [boar.id, deer.id, butterfly.id],
    });
    totalPoints += 5;
  }

  const sake = tane.find(card => card.subType === 'sake');
  const moon = hikari.find(card => card.subType === 'moon');
  const curtain = hikari.find(card => card.subType === 'curtain');

  if (sake && moon) {
    yaku.push({
      id: 'tsukimi_zake',
      name: '月見酒 (Tsukimi-zake)',
      points: 5,
      cardIds: [sake.id, moon.id],
    });
    totalPoints += 5;
  }
  if (sake && curtain) {
    yaku.push({
      id: 'hanami_zake',
      name: '花見酒 (Hanami-zake)',
      points: 5,
      cardIds: [sake.id, curtain.id],
    });
    totalPoints += 5;
  }

  if (tane.length >= 5) {
    const points = 1 + (tane.length - 5);
    yaku.push({ id: 'tane', name: '種 (Tane)', points, cardIds: cardIds(tane) });
    totalPoints += points;
  }

  const akatan = tanzaku.filter(card => card.subType === 'akatan');
  const aotan = tanzaku.filter(card => card.subType === 'aotan');

  if (akatan.length === 3) {
    yaku.push({ id: 'akatan', name: '赤短 (Akatan)', points: 5, cardIds: cardIds(akatan) });
    totalPoints += 5;
  }
  if (aotan.length === 3) {
    yaku.push({ id: 'aotan', name: '青短 (Aotan)', points: 5, cardIds: cardIds(aotan) });
    totalPoints += 5;
  }
  if (tanzaku.length >= 5) {
    const points = 1 + (tanzaku.length - 5);
    yaku.push({ id: 'tanzaku', name: '短冊 (Tanzaku)', points, cardIds: cardIds(tanzaku) });
    totalPoints += points;
  }

  const kasuYakuCardIds = cardIds(kasu);
  if (sake) {
    kasuYakuCardIds.push(sake.id);
  }
  const kasuCount = kasu.length + (sake ? 1 : 0);
  if (kasuCount >= 10) {
    const points = 1 + (kasuCount - 10);
    yaku.push({ id: 'kasu', name: '菓子 (Kasu)', points, cardIds: kasuYakuCardIds });
    totalPoints += points;
  }

  const assignedIds = new Set(yaku.flatMap(entry => entry.cardIds));
  const unassignedCardIds = captured
    .filter(card => !assignedIds.has(card.id))
    .map(card => card.id);

  return { yaku, totalPoints, unassignedCardIds };
}

export function calculateYaku(captured: Card[]): { yaku: YakuResult[]; totalPoints: number } {
  const { yaku, totalPoints } = calculateYakuDetail(captured);
  return { yaku, totalPoints };
}

export function getMatchingCards(card: Card, field: Card[]): Card[] {
  return field.filter(c => c.month === card.month);
}

export const WIN_SCORE = 12;

export function getMatchWinner(playerScore: number, botScore: number): 'player' | 'bot' | null {
  const playerWins = playerScore >= WIN_SCORE;
  const botWins = botScore >= WIN_SCORE;
  if (!playerWins && !botWins) return null;
  if (playerWins && botWins) return playerScore >= botScore ? 'player' : 'bot';
  return playerWins ? 'player' : 'bot';
}

export function scoreToWin(currentScore: number): number {
  return Math.max(0, WIN_SCORE - currentScore);
}

export interface RoundResolution {
  playerScore: number;
  botScore: number;
  phase: 'round_end' | 'game_over';
  winner: 'player' | 'bot' | null;
}

export function resolveRoundScores(
  playerScore: number,
  botScore: number,
  playerGain: number,
  botGain: number,
): RoundResolution {
  const nextPlayer = playerScore + playerGain;
  const nextBot = botScore + botGain;
  const winner = getMatchWinner(nextPlayer, nextBot);
  return {
    playerScore: nextPlayer,
    botScore: nextBot,
    phase: winner ? 'game_over' : 'round_end',
    winner,
  };
}

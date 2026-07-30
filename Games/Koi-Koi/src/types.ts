export type CardType = 'hikari' | 'tane' | 'tanzaku' | 'kasu';
export type Month = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface Card {
  id: string;
  month: Month;
  type: CardType;
  name: string;
  subType?: 'akatan' | 'aotan' | 'plain_tanzaku' | 'sake' | 'boar' | 'deer' | 'butterfly' | 'rain_man' | 'moon' | 'curtain' | 'crane';
}

export interface YakuResult {
  id: YakuId;
  name: string;
  points: number;
  cardIds: string[];
}

export type YakuId =
  | 'gokou'
  | 'shikou'
  | 'ame_shikou'
  | 'sankou'
  | 'ino_shika_cho'
  | 'tsukimi_zake'
  | 'hanami_zake'
  | 'tane'
  | 'akatan'
  | 'aotan'
  | 'tanzaku'
  | 'kasu';

export interface YakuDetail {
  yaku: YakuResult[];
  totalPoints: number;
  unassignedCardIds: string[];
}

export type Phase = 
  | 'idle' 
  | 'player_turn_hand' 
  | 'player_turn_hand_match' 
  | 'player_turn_draw' 
  | 'player_turn_draw_match' 
  | 'player_koi_koi' 
  | 'bot_turn' 
  | 'round_end'
  | 'game_over';

export interface GameState {
  deck: Card[];
  field: Card[];
  playerHand: Card[];
  botHand: Card[];
  playerCaptured: Card[];
  botCaptured: Card[];
  playerYaku: YakuResult[];
  botYaku: YakuResult[];
  playerPoints: number;
  botPoints: number;
  phase: Phase;
  selectedHandCard: Card | null;
  drawnCard: Card | null;
  matchingFieldCards: Card[];
  message: string;
  playerScore: number;
  botScore: number;
  round: number;
  dealer: 'player' | 'bot';
  koiKoiCount: { player: number, bot: number };
  winner: 'player' | 'bot' | null;
}

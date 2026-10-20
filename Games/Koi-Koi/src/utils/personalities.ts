import type { Card, YakuId } from '../types';
import { ANIMAL_CHARACTERS, DEFAULT_CHARACTER_ID } from '../characters';

export type CharacterId = (typeof ANIMAL_CHARACTERS)[number]['id'] | string;

export type CardSubType = NonNullable<Card['subType']>;

/**
 * Data-driven play style layered on top of Difficulty.
 * Difficulty owns blunder/discipline; personality steers targets and risk.
 */
export interface PersonalityStyle {
  /** Multipliers on subtype capture bonuses (1 = unchanged). */
  subtypeBias: Partial<Record<CardSubType, number>>;
  /** Named yaku this opponent prefers to chase. */
  chaseYaku: YakuId[];
  /** Flat score bonus when a capture projects one of chaseYaku. */
  chaseYakuBonus: number;
  /** Added to difficulty koiKoiPointCap (positive → keeps going longer). */
  koiKoiCapDelta: number;
  /**
   * 0–1 risk appetite for borderline Koi-Koi calls.
   * High = greedy caller; low = cautious stopper.
   */
  riskAppetite: number;
  /** Multiplier on difficulty randomRate. */
  randomRateMul: number;
  /** Added to difficulty captureBias. */
  captureBiasDelta: number;
}

export interface OpponentPersonality {
  characterId: string;
  /** Short Traditional Chinese style tag for setup UI. */
  styleTag: string;
  blurb: string;
  style: PersonalityStyle;
  catchphrases: {
    koiKoi: string;
    win: string;
    lose: string;
  };
}

const DEFAULT_STYLE: PersonalityStyle = {
  subtypeBias: {},
  chaseYaku: [],
  chaseYakuBonus: 0,
  koiKoiCapDelta: 0,
  riskAppetite: 0.45,
  randomRateMul: 1,
  captureBiasDelta: 0,
};

/** One distinct style per selectable animal character. */
export const PERSONALITIES: Record<string, OpponentPersonality> = {
  kitsune: {
    characterId: 'kitsune',
    styleTag: '狡黠收分',
    blurb: '盯光牌與終局，少冒險喊 Koi-Koi。',
    style: {
      subtypeBias: { crane: 2.2, curtain: 2, moon: 2, rain_man: 0.6 },
      chaseYaku: ['gokou', 'shikou', 'sankou', 'ame_shikou'],
      chaseYakuBonus: 35,
      koiKoiCapDelta: -2,
      riskAppetite: 0.2,
      randomRateMul: 0.7,
      captureBiasDelta: 10,
    },
    catchphrases: {
      koiKoi: '還早呢…再讓狐狸多看一眼。',
      win: '計較清楚，勝負也清楚。',
      lose: '這次被看穿了…下次換我。',
    },
  },
  tanuki: {
    characterId: 'tanuki',
    styleTag: '貪心連喊',
    blurb: '愛喊 Koi-Koi 衝高分，常把分數賭進去。',
    style: {
      subtypeBias: { sake: 1.8, moon: 1.4, curtain: 1.4 },
      chaseYaku: ['tsukimi_zake', 'hanami_zake', 'kasu', 'tane'],
      chaseYakuBonus: 22,
      koiKoiCapDelta: 4,
      riskAppetite: 0.92,
      randomRateMul: 1.15,
      captureBiasDelta: -5,
    },
    catchphrases: {
      koiKoi: 'Koi-Koi！肚皮還裝得下！',
      win: '哈哈哈，今天牌運站我這邊！',
      lose: '哎呀，葉子被風吹走了…',
    },
  },
  neko: {
    characterId: 'neko',
    styleTag: '優雅短冊',
    blurb: '不慌不忙湊赤短／青短，適度結算。',
    style: {
      subtypeBias: { akatan: 2.4, aotan: 2.4 },
      chaseYaku: ['akatan', 'aotan', 'tanzaku'],
      chaseYakuBonus: 40,
      koiKoiCapDelta: 0,
      riskAppetite: 0.4,
      randomRateMul: 0.85,
      captureBiasDelta: 5,
    },
    catchphrases: {
      koiKoi: '再伸個懶腰…還沒結束喔。',
      win: '優雅落子，分數自來。',
      lose: '嗯…下一局再理毛。',
    },
  },
  tsuru: {
    characterId: 'tsuru',
    styleTag: '光耀貴族',
    blurb: '執著鶴與光牌，幾乎不亂出手。',
    style: {
      subtypeBias: { crane: 3, curtain: 2.2, moon: 2.2 },
      chaseYaku: ['gokou', 'shikou', 'sankou'],
      chaseYakuBonus: 45,
      koiKoiCapDelta: -1,
      riskAppetite: 0.28,
      randomRateMul: 0.5,
      captureBiasDelta: 15,
    },
    catchphrases: {
      koiKoi: '鶴翼未收，尚可一搏。',
      win: '吉光片羽，落在我這邊。',
      lose: '翼折了…容我重整羽儀。',
    },
  },
  koi: {
    characterId: 'koi',
    styleTag: '逆流賭徒',
    blurb: '逆勢喊 Koi-Koi，專衝花見／月見酒。',
    style: {
      subtypeBias: { sake: 2.6, curtain: 2.2, moon: 2.2 },
      chaseYaku: ['hanami_zake', 'tsukimi_zake'],
      chaseYakuBonus: 48,
      koiKoiCapDelta: 3,
      riskAppetite: 0.85,
      randomRateMul: 1,
      captureBiasDelta: 0,
    },
    catchphrases: {
      koiKoi: '逆流而上——Koi-Koi！',
      win: '龍門就在前方！',
      lose: '瀑布太高了…再游一次。',
    },
  },
  shika: {
    characterId: 'shika',
    styleTag: '森之三獸',
    blurb: '溫柔但執著豬鹿蝶與種牌。',
    style: {
      subtypeBias: { deer: 3, boar: 2.2, butterfly: 2.2 },
      chaseYaku: ['ino_shika_cho', 'tane'],
      chaseYakuBonus: 50,
      koiKoiCapDelta: 1,
      riskAppetite: 0.5,
      randomRateMul: 0.9,
      captureBiasDelta: 8,
    },
    catchphrases: {
      koiKoi: '林間還有腳步聲…繼續。',
      win: '三獸齊聚，楓葉也笑了。',
      lose: '鹿鳴遠去…下次再遇。',
    },
  },
  usagi: {
    characterId: 'usagi',
    styleTag: '月下靈巧',
    blurb: '敏捷搶月見酒，風險中等偏高。',
    style: {
      subtypeBias: { moon: 3, sake: 2.4 },
      chaseYaku: ['tsukimi_zake'],
      chaseYakuBonus: 55,
      koiKoiCapDelta: 2,
      riskAppetite: 0.7,
      randomRateMul: 1.05,
      captureBiasDelta: 5,
    },
    catchphrases: {
      koiKoi: '月亮還亮著——Koi-Koi！',
      win: '搗麻糬的節奏，正好是勝機。',
      lose: '雲遮月了…下一輪再跳。',
    },
  },
  fukurou: {
    characterId: 'fukurou',
    styleTag: '穩健記牌',
    blurb: '博學謹慎，達標就收，很少亂喊。',
    style: {
      subtypeBias: { crane: 1.5, akatan: 1.3, aotan: 1.3 },
      chaseYaku: ['sankou', 'akatan', 'aotan'],
      chaseYakuBonus: 28,
      koiKoiCapDelta: -3,
      riskAppetite: 0.12,
      randomRateMul: 0.4,
      captureBiasDelta: 12,
    },
    catchphrases: {
      koiKoi: '計算尚可…再一回合。',
      win: '記牌沒錯，結果也不錯。',
      lose: '漏算一步…翅羽沉了。',
    },
  },
  inoshishi: {
    characterId: 'inoshishi',
    styleTag: '豪邁衝陣',
    blurb: '積極取牌，豬鹿蝶優先，敢喊也敢收。',
    style: {
      subtypeBias: { boar: 3, deer: 2, butterfly: 2 },
      chaseYaku: ['ino_shika_cho', 'tane'],
      chaseYakuBonus: 42,
      koiKoiCapDelta: 2,
      riskAppetite: 0.75,
      randomRateMul: 1.1,
      captureBiasDelta: 20,
    },
    catchphrases: {
      koiKoi: '衝啊——Koi-Koi！',
      win: '獠牙一亮，勝券在握！',
      lose: '撞牆了…下一回更猛。',
    },
  },
  cho: {
    characterId: 'cho',
    styleTag: '飄忽奇襲',
    blurb: '蝶影難測，偏愛豬鹿蝶，出手較隨興。',
    style: {
      subtypeBias: { butterfly: 3, boar: 1.8, deer: 1.8 },
      chaseYaku: ['ino_shika_cho'],
      chaseYakuBonus: 38,
      koiKoiCapDelta: 1,
      riskAppetite: 0.6,
      randomRateMul: 1.4,
      captureBiasDelta: -8,
    },
    catchphrases: {
      koiKoi: '蝶舞未歇…再繞一圈。',
      win: '翩然一轉，分數落在花心。',
      lose: '風向變了…翅尖沾露。',
    },
  },
};

export const DEFAULT_OPPONENT_ID = 'fukurou';

export const OPPONENT_STORAGE_KEY = 'clubhouse-koi-koi-opponent';

export function getPersonality(characterId: string): OpponentPersonality {
  return PERSONALITIES[characterId] ?? PERSONALITIES[DEFAULT_OPPONENT_ID];
}

export function getPersonalityStyle(characterId: string): PersonalityStyle {
  return getPersonality(characterId).style;
}

export function resolveOpponentId(raw: string | null | undefined): string {
  if (raw && PERSONALITIES[raw]) return raw;
  if (raw && ANIMAL_CHARACTERS.some(c => c.id === raw)) return raw;
  return DEFAULT_OPPONENT_ID;
}

/** Safe default when no opponent was ever chosen. */
export function defaultOpponentId(): string {
  return PERSONALITIES[DEFAULT_CHARACTER_ID] ? DEFAULT_CHARACTER_ID : DEFAULT_OPPONENT_ID;
}

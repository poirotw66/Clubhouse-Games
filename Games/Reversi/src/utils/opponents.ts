/**
 * Named CPU roster — each opponent has a distinct evaluation style, not just
 * a different blunder rate.
 */

import type { BotStyle, Difficulty } from './reversiLogic';

export type OpponentId =
  | 'greedy'
  | 'edge'
  | 'corner'
  | 'mobility'
  | 'cautious'
  | 'parity';

export interface OpponentDef {
  id: OpponentId;
  name: string;
  tagline: string;
  /** Setup blurb explaining how they play. */
  blurb: string;
  catchphrases: { intro: string; win: string; lose: string; taunt: string };
  /** Base difficulty tier (search depth / exact empties / default blunder). */
  difficulty: Difficulty;
  style: BotStyle;
  /** Portrait accent color for ladder UI. */
  accent: string;
}

export const OPPONENTS: OpponentDef[] = [
  {
    id: 'greedy',
    name: '貪心小子',
    tagline: '能翻就翻',
    blurb: '每手都想翻最多子，中盤常被你騙角。',
    catchphrases: {
      intro: '看我一次翻一排！',
      win: '數字比較大就算我贏～',
      lose: '咦，子變少了？',
      taunt: '再給我翻多一點！',
    },
    difficulty: 'easy',
    style: {
      depth: 1,
      blunderRate: 0.2,
      exactEmpties: 0,
      mobilityWeight: 1,
      discGreed: 12,
      cornerGreed: 10,
      edgeWeight: 0,
      xSquareFear: 0,
    },
    accent: '#a3e635',
  },
  {
    id: 'edge',
    name: '貼邊幽靈',
    tagline: '專搶邊線',
    blurb: '愛佔邊、少想機動。邊牆一成形就很難拆。',
    catchphrases: {
      intro: '邊線是我家跑道。',
      win: '你的子被我貼邊封死了。',
      lose: '邊斷了…糟糕。',
      taunt: '再往邊靠一點！',
    },
    difficulty: 'easy',
    style: {
      depth: 2,
      blunderRate: 0.15,
      exactEmpties: 4,
      mobilityWeight: 3,
      discGreed: 2,
      cornerGreed: 20,
      edgeWeight: 18,
      xSquareFear: 10,
    },
    accent: '#38bdf8',
  },
  {
    id: 'corner',
    name: '搶角狂魔',
    tagline: '角＞一切',
    blurb: '極度重視角地，有時會為了角放棄中腹。',
    catchphrases: {
      intro: '四個角，一個都不能少。',
      win: '角在手，天下我有！',
      lose: '角被搶了…全盤崩了。',
      taunt: '那格子旁邊可是角喔。',
    },
    difficulty: 'normal',
    style: {
      depth: 3,
      blunderRate: 0.08,
      exactEmpties: 6,
      mobilityWeight: 4,
      discGreed: 0,
      cornerGreed: 55,
      edgeWeight: 4,
      xSquareFear: 35,
    },
    accent: '#fbbf24',
  },
  {
    id: 'mobility',
    name: '流動舞者',
    tagline: '機動至上',
    blurb: '寧可少子也要保留可下點，擅長逼你 Pass。',
    catchphrases: {
      intro: '空間比子數重要。',
      win: '你動不了，我就贏了。',
      lose: '被你鎖死了…',
      taunt: '還有幾手下？數數看。',
    },
    difficulty: 'normal',
    style: {
      depth: 4,
      blunderRate: 0.05,
      exactEmpties: 8,
      mobilityWeight: 22,
      discGreed: -2,
      cornerGreed: 28,
      edgeWeight: 2,
      xSquareFear: 20,
    },
    accent: '#c084fc',
  },
  {
    id: 'cautious',
    name: '謹慎學者',
    tagline: '怕 X 格',
    blurb: '絕少踏入角旁危險格，殘局開始精算。',
    catchphrases: {
      intro: '先排除會送角的手。',
      win: '穩紮穩打，沒有僥倖。',
      lose: '計算有漏洞…再讀一次。',
      taunt: '那是 X 格，你敢下嗎？',
    },
    difficulty: 'hard',
    style: {
      depth: 5,
      blunderRate: 0.02,
      exactEmpties: 10,
      mobilityWeight: 12,
      discGreed: 0,
      cornerGreed: 30,
      edgeWeight: 6,
      xSquareFear: 50,
    },
    accent: '#94a3b8',
  },
  {
    id: 'parity',
    name: '奇偶大師',
    tagline: '殘局全解',
    blurb: '深算＋殘局完美搜索，會用奇偶搶最後一手。',
    catchphrases: {
      intro: '空格數，我已經算好了。',
      win: '最後一手是我的。',
      lose: '罕見的誤算…',
      taunt: '區域奇偶，聽過嗎？',
    },
    difficulty: 'hard',
    style: {
      depth: 6,
      blunderRate: 0,
      exactEmpties: 12,
      mobilityWeight: 16,
      discGreed: 1,
      cornerGreed: 35,
      edgeWeight: 8,
      xSquareFear: 40,
    },
    accent: '#f472b6',
  },
];

export function opponentCount(): number {
  return OPPONENTS.length;
}

export function opponentById(id: string): OpponentDef | undefined {
  return OPPONENTS.find((o) => o.id === id);
}

export function opponentByIndex(index: number): OpponentDef | undefined {
  return OPPONENTS[index];
}

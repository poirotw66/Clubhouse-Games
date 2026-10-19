/**
 * Duel ladder roster — eight samurai, each with a distinct attack pattern trait.
 */

import type { PracticeScenario } from './constants';

export type OpponentId =
  | 'ronin'
  | 'bait'
  | 'twin'
  | 'delay'
  | 'surge'
  | 'mirror'
  | 'chaos'
  | 'master';

/** Pattern traits drive `nextAttackEvent` in patterns.ts. */
export type PatternTrait =
  | 'basic'
  | 'feints'
  | 'double'
  | 'delay'
  | 'speedup'
  | 'sideswitch'
  | 'mixed'
  | 'boss';

export interface OpponentDef {
  id: OpponentId;
  name: string;
  tagline: string;
  blurb: string;
  /** Portrait accent for ladder cards. */
  accent: string;
  trait: PatternTrait;
  /** Projectile mix bias while dueling this opponent. */
  scenario: PracticeScenario;
  /** Difficulty floor layered into timing windows. */
  baseTier: 0 | 2 | 4;
  /** Enemy HP for duel (player still uses MAX_HP). */
  enemyHp: number;
  /** True for the final boss (index 7). */
  isBoss: boolean;
  catchphrases: { intro: string; win: string; lose: string };
}

export const OPPONENTS: readonly OpponentDef[] = [
  {
    id: 'ronin',
    name: '見習浪人',
    tagline: '基礎打直來',
    blurb: '均衡暗器、少假動作。適合熱身與熟悉左右斬。',
    accent: '#86efac',
    trait: 'basic',
    scenario: 'mixed',
    baseTier: 0,
    enemyHp: 80,
    isBoss: false,
    catchphrases: {
      intro: '請指教……我只會一招。',
      win: '還是輸了……',
      lose: '今天運氣好！',
    },
  },
  {
    id: 'bait',
    name: '誘餌影',
    tagline: '假動作大師',
    blurb: '大量佯攻：紅閃之後未必有刃。放開＝受罰。',
    accent: '#f472b6',
    trait: 'feints',
    scenario: 'bomb',
    baseTier: 0,
    enemyHp: 90,
    isBoss: false,
    catchphrases: {
      intro: '你確定那一閃是真的？',
      win: '耐性不夠呀。',
      lose: '……這次沒騙過你。',
    },
  },
  {
    id: 'twin',
    name: '雙連閃',
    tagline: '二連擊',
    blurb: '命中後緊接第二擊。第一刀後別鬆懈。',
    accent: '#38bdf8',
    trait: 'double',
    scenario: 'kunai',
    baseTier: 2,
    enemyHp: 100,
    isBoss: false,
    catchphrases: {
      intro: '一刀不夠，兩刀剛好。',
      win: '第二刀才是重點。',
      lose: '連擊被看穿了……',
    },
  },
  {
    id: 'delay',
    name: '遲延鬼',
    tagline: '故意拖拍',
    blurb: '超長待機後突然出手，專剋搶快的人。',
    accent: '#a78bfa',
    trait: 'delay',
    scenario: 'bomb',
    baseTier: 2,
    enemyHp: 100,
    isBoss: false,
    catchphrases: {
      intro: '急什麼？時間是我的武器。',
      win: '太早了。',
      lose: '……居然等得到。',
    },
  },
  {
    id: 'surge',
    name: '加速鴉',
    tagline: '中途加速',
    blurb: '飛行瞬速加快，Perfect 窗更窄。',
    accent: '#fb923c',
    trait: 'speedup',
    scenario: 'kunai',
    baseTier: 2,
    enemyHp: 110,
    isBoss: false,
    catchphrases: {
      intro: '眨眼就到。',
      win: '跟不上吧？',
      lose: '鴉羽被斬斷了……',
    },
  },
  {
    id: 'mirror',
    name: '左右幻',
    tagline: '左右亂換',
    blurb: '左右斬頻繁對調，錯邊＝挨打。',
    accent: '#22d3ee',
    trait: 'sideswitch',
    scenario: 'mixed',
    baseTier: 2,
    enemyHp: 110,
    isBoss: false,
    catchphrases: {
      intro: '左邊？右邊？猜啊。',
      win: '邊都搞錯了。',
      lose: '幻影被識破了……',
    },
  },
  {
    id: 'chaos',
    name: '混彈鬼',
    tagline: '暗器亂舞',
    blurb: '四種暗器＋偶爾佯攻，節奏混亂。',
    accent: '#e879f9',
    trait: 'mixed',
    scenario: 'chaos',
    baseTier: 4,
    enemyHp: 120,
    isBoss: false,
    catchphrases: {
      intro: '亂中取勝。',
      win: '你的節奏亂了。',
      lose: '亂舞敗給了冷靜……',
    },
  },
  {
    id: 'master',
    name: '宗師一閃',
    tagline: '最終試煉',
    blurb: '佯攻、二連、遲延、加速、左右全開的頭目戰。',
    accent: '#fbbf24',
    trait: 'boss',
    scenario: 'chaos',
    baseTier: 4,
    enemyHp: 140,
    isBoss: true,
    catchphrases: {
      intro: '拔刀。證明你的剎那。',
      win: '還不夠快。',
      lose: '……一閃，傳承給你。',
    },
  },
] as const;

export function opponentCount(): number {
  return OPPONENTS.length;
}

export function opponentByIndex(index: number): OpponentDef | undefined {
  if (index < 0 || index >= OPPONENTS.length) return undefined;
  return OPPONENTS[index];
}

export function opponentById(id: string): OpponentDef | undefined {
  return OPPONENTS.find((op) => op.id === id);
}

export function opponentIndexOf(id: OpponentId): number {
  return OPPONENTS.findIndex((op) => op.id === id);
}

// League roster: six CPU boxers with distinct styles + signature tells.

import type { CharacterId } from './characters';
import type { Height } from './combat';

export type OpponentId =
  | 'pillow'
  | 'rush'
  | 'needle'
  | 'feint'
  | 'ironbelly'
  | 'champ';

/** Style knobs consumed by cpuAi — not just reactChance. */
export interface OpponentStyle {
  /** 0–1 desire to throw punches when in range. */
  aggression: number;
  /** -1 prefer low, +1 prefer high, 0 mixed. */
  highLowBias: number;
  /** Chance to start a wind-up then cancel into block/dodge (fake). */
  feintRate: number;
  /** After being hit, bias to guard that height (0–1). */
  guardHabit: number;
  /** How strongly to mirror the player's recent high/low mix (0–1). */
  adaptHabit: number;
  /** Prefer hook over jab when attacking. */
  hookBias: number;
  /** Base react chance when a punch is in wind-up. */
  reactChance: number;
  mistakeChance: number;
  parryShare: number;
  moveSpeed: number;
  thinkMin: number;
  thinkMax: number;
  preferredDist: number;
  defenseBias: number;
}

export interface SignatureMove {
  id: string;
  /** Traditional Chinese name shown in UI. */
  name: string;
  blurb: string;
  /** Wind-up seconds (longer = more readable). */
  windup: number;
  height: Height;
  /** Unblockable — must dodge. */
  unblockable: boolean;
}

export interface OpponentDef {
  id: OpponentId;
  name: string;
  tagline: string;
  /** Portrait / body art reuse from playable roster. */
  visual: CharacterId;
  catchphrases: { intro: string; win: string; lose: string; taunt: string };
  style: OpponentStyle;
  signature: SignatureMove;
  /** Power / speed / health / staminaRegen multipliers vs baseline. */
  power: number;
  speed: number;
  health: number;
  staminaRegen: number;
}

export const OPPONENTS: OpponentDef[] = [
  {
    id: 'pillow',
    name: '軟棉拳手',
    tagline: '愛擋・偏下段',
    visual: 'bunny',
    catchphrases: {
      intro: '先護住肚子再說…',
      win: '擋得好｜你打不太進來',
      lose: '唉，擋錯邊了…',
      taunt: '來啊，我擋得住！',
    },
    style: {
      // First rung: throws enough low jabs to teach high/low, still forgiving.
      aggression: 0.58,
      highLowBias: -0.55,
      feintRate: 0.04,
      guardHabit: 0.65,
      adaptHabit: 0.18,
      hookBias: 0.2,
      reactChance: 0.36,
      mistakeChance: 0.4,
      parryShare: 0.05,
      moveSpeed: 0.68,
      thinkMin: 0.28,
      thinkMax: 0.58,
      preferredDist: 105,
      defenseBias: 0.22,
    },
    signature: {
      id: 'pillow-roll',
      name: '棉花翻滾',
      blurb: '長預備・可擋・下段掃腹',
      windup: 0.34,
      height: 'low',
      unblockable: false,
    },
    power: 0.85,
    speed: 0.95,
    health: 100,
    staminaRegen: 1.15,
  },
  {
    id: 'rush',
    name: '衝撞熊',
    tagline: '猛攻・上段重拳',
    visual: 'bear',
    catchphrases: {
      intro: '別想退後！',
      win: '一頭撞飛你！',
      lose: '氣力用完了…',
      taunt: '再靠近一點！',
    },
    style: {
      aggression: 0.88,
      highLowBias: 0.7,
      feintRate: 0.08,
      guardHabit: 0.35,
      adaptHabit: 0.15,
      hookBias: 0.7,
      reactChance: 0.35,
      mistakeChance: 0.28,
      parryShare: 0.05,
      moveSpeed: 1.05,
      thinkMin: 0.12,
      thinkMax: 0.32,
      preferredDist: 75,
      defenseBias: 0.1,
    },
    signature: {
      id: 'bear-charge',
      name: '絨熊衝撞',
      blurb: '預備可見・無法格擋・可閃避',
      windup: 0.3,
      height: 'high',
      unblockable: true,
    },
    power: 1.25,
    speed: 0.88,
    health: 125,
    staminaRegen: 0.85,
  },
  {
    id: 'needle',
    name: '刺拳機器',
    tagline: '連刺・讀上段',
    visual: 'bot',
    catchphrases: {
      intro: '計算完成：刺拳優先。',
      win: '命中率：優秀。',
      lose: '預測偏差…',
      taunt: '你的上段暴露了。',
    },
    style: {
      aggression: 0.76,
      highLowBias: 0.85,
      feintRate: 0.1,
      guardHabit: 0.5,
      adaptHabit: 0.55,
      // Jab machine — keep hookBias low so close-range still mostly jabs.
      hookBias: 0.14,
      reactChance: 0.68,
      mistakeChance: 0.12,
      parryShare: 0.28,
      moveSpeed: 1.0,
      thinkMin: 0.09,
      thinkMax: 0.26,
      preferredDist: 98,
      defenseBias: 0.2,
    },
    signature: {
      id: 'needle-burst',
      name: '連刺暴風',
      blurb: '短預備・上段・可撥招',
      windup: 0.16,
      height: 'high',
      unblockable: false,
    },
    power: 0.95,
    speed: 1.15,
    health: 90,
    staminaRegen: 1.1,
  },
  {
    id: 'feint',
    name: '假動作兔',
    tagline: '虛晃・擾亂節奏',
    visual: 'bunny',
    catchphrases: {
      intro: '看清楚了嗎？嘻嘻',
      win: '你又上當了～',
      lose: '這次騙不到你…',
      taunt: '左邊？右邊？上段？',
    },
    style: {
      aggression: 0.55,
      highLowBias: 0.1,
      feintRate: 0.42,
      guardHabit: 0.4,
      adaptHabit: 0.45,
      hookBias: 0.4,
      reactChance: 0.6,
      mistakeChance: 0.15,
      parryShare: 0.22,
      moveSpeed: 1.2,
      thinkMin: 0.14,
      thinkMax: 0.36,
      preferredDist: 100,
      defenseBias: 0.3,
    },
    signature: {
      id: 'feint-spin',
      name: '旋轉誘敵拳',
      blurb: '長預備・無法格擋・可閃避',
      windup: 0.32,
      height: 'high',
      unblockable: true,
    },
    power: 0.9,
    speed: 1.28,
    health: 88,
    staminaRegen: 1.2,
  },
  {
    id: 'ironbelly',
    name: '鐵腹恐龍',
    tagline: '專打肚子・耗耐力',
    visual: 'dino',
    catchphrases: {
      intro: '先削你的氣。',
      win: '氣力被掏空了吧？',
      lose: '鐵腹也有極限…',
      taunt: '護臉也護不了腹！',
    },
    style: {
      aggression: 0.65,
      highLowBias: -0.8,
      feintRate: 0.1,
      guardHabit: 0.6,
      adaptHabit: 0.4,
      hookBias: 0.55,
      reactChance: 0.55,
      mistakeChance: 0.14,
      parryShare: 0.15,
      moveSpeed: 0.92,
      thinkMin: 0.16,
      thinkMax: 0.4,
      preferredDist: 88,
      defenseBias: 0.28,
    },
    signature: {
      id: 'dino-gut',
      name: '恐龍開腸拳',
      blurb: '中長預備・下段・重耗耐力',
      windup: 0.26,
      height: 'low',
      unblockable: false,
    },
    power: 1.1,
    speed: 0.92,
    health: 110,
    staminaRegen: 0.95,
  },
  {
    id: 'champ',
    name: '冠軍拳王',
    tagline: '讀習慣・全面壓制',
    visual: 'bot',
    catchphrases: {
      intro: '我已經看穿你了。',
      win: '這就是冠軍的距離。',
      lose: '…漂亮的一局。',
      taunt: '你又打那邊了。',
    },
    style: {
      aggression: 0.78,
      highLowBias: 0.05,
      feintRate: 0.22,
      guardHabit: 0.7,
      adaptHabit: 0.92,
      hookBias: 0.45,
      // Still the hardest rung, but not near-perfect react on every tell.
      reactChance: 0.8,
      mistakeChance: 0.06,
      parryShare: 0.34,
      moveSpeed: 1.08,
      thinkMin: 0.08,
      thinkMax: 0.22,
      preferredDist: 82,
      defenseBias: 0.32,
    },
    signature: {
      id: 'champ-spin',
      name: '冠軍旋轉拳',
      blurb: '18 幀級長預備・無法格擋・可閃避',
      windup: 0.3,
      height: 'high',
      unblockable: true,
    },
    power: 1.15,
    speed: 1.05,
    health: 115,
    staminaRegen: 1.0,
  },
];

export function getOpponent(id: OpponentId): OpponentDef {
  return OPPONENTS.find((o) => o.id === id) ?? OPPONENTS[0];
}

export function opponentIndex(id: OpponentId): number {
  return OPPONENTS.findIndex((o) => o.id === id);
}

export function opponentByIndex(index: number): OpponentDef | undefined {
  return OPPONENTS[index];
}

export function opponentCount(): number {
  return OPPONENTS.length;
}

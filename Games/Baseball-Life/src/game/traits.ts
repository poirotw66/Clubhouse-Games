import { overall } from './config';
import type { GameState } from './types';

export interface Trait {
  id: string;
  label: string;
  desc: string;
  /** Traits stay hidden until their condition fires — that is the fun of them. */
  check: (state: GameState) => boolean;
}

export const TRAITS: Trait[] = [
  {
    id: 'genius',
    label: '天才',
    desc: '22 歲前骰出 12 次大成功。成長速度大幅提升，能力上限再往上推。',
    check: (s) => s.age < 22 && s.counters.earlySixes >= 12,
  },
  {
    id: 'ironman',
    label: '鐵人',
    desc: '連續 5 個球季全勤未進傷兵。衰退減半，續航力與體能持續累積。',
    check: (s) => s.counters.fullSeasons >= 5,
  },
  {
    id: 'late-bloomer',
    label: '大器晚成',
    desc: '25 歲時綜合能力仍不出色。26 歲起迎來第二次成長期。',
    check: (s) => s.age === 25 && s.stage === 'pro' && overall(s.attrs, s.position) < 62,
  },
  {
    id: 'ascetic',
    label: '自律狂',
    desc: '累計 8 次選擇調整與自主訓練。30 歲後的衰退明顯延後。',
    check: (s) => s.counters.restTurns >= 8,
  },
  {
    id: 'intl-demon',
    label: '國際賽之鬼',
    desc: '3 次國際賽都繳出好表現。大場面的表現加成，人氣水漲船高。',
    check: (s) => s.counters.intlStrong >= 3,
  },
  {
    id: 'glass',
    label: '玻璃體質',
    desc: '生涯累計 3 次傷病。往後受傷機率提高，復原也更慢。',
    check: (s) => s.counters.injuries >= 3,
  },
  {
    id: 'national-hero',
    label: '全民英雄',
    desc: '人氣衝上 90。每次出賽都是新聞，合約與代言跟著來。',
    check: (s) => s.meta.fame >= 90,
  },
  {
    id: 'koshien-star',
    label: '青春的殘影',
    desc: '高中三年拿下 2 座全國賽冠軍。無論走到哪裡都有人記得那個夏天。',
    check: (s) => s.counters.hsTournamentWins >= 2,
  },
];

export interface TraitEffects {
  growth: number;
  decline: number;
  injury: number;
  clutch: number;
  fameGain: number;
}

export function traitEffects(traits: string[]): TraitEffects {
  const has = (id: string) => traits.includes(id);
  return {
    growth: (has('genius') ? 1.35 : 1) * (has('late-bloomer') ? 1.25 : 1),
    decline: (has('ascetic') ? 0.5 : 1) * (has('ironman') ? 0.7 : 1),
    injury: (has('glass') ? 1.6 : 1) * (has('ironman') ? 0.75 : 1),
    clutch: (has('intl-demon') ? 1.2 : 1) * (has('koshien-star') ? 1.1 : 1),
    fameGain: has('national-hero') ? 1.5 : 1,
  };
}

/** Returns the ids of traits whose condition just became true. */
export function newlyUnlocked(state: GameState): string[] {
  return TRAITS.filter((t) => !state.traits.includes(t.id) && t.check(state)).map((t) => t.id);
}

export function traitById(id: string): Trait | undefined {
  return TRAITS.find((t) => t.id === id);
}

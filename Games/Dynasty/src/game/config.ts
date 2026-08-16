import type { AttrKey, Attributes, Expectation, Position } from './types';

export const STORAGE_KEY = 'clubhouse:dynasty';

/** Same fictional clubs as 棒球人生 — the two games share a world. */
export const CLUBS: { id: string; name: string; blurb: string; strength: number; cash: number }[] = [
  { id: 'lions', name: '南方猛獅', blurb: '老牌強權，陣容成熟但正在集體老化。', strength: 3, cash: 13000 },
  { id: 'angels', name: '桃園天使', blurb: '母企業口袋深，董事會的耐心卻很短。', strength: 1, cash: 20000 },
  { id: 'cannons', name: '台中巨砲', blurb: '打線嚇人、投手荒蕪，年年打進不了季後賽。', strength: 0, cash: 10000 },
  { id: 'eagles', name: '台南飛鷹', blurb: '農場全聯盟最好，一軍最爛。適合有耐心的人。', strength: -3, cash: 9000 },
  { id: 'dolphins', name: '新北海豚', blurb: '什麼都中等，什麼都不突出。', strength: 0, cash: 12000 },
  { id: 'volcano', name: '高雄火山', blurb: '去年剛奪冠，薪資結構已經瀕臨爆炸。', strength: 4, cash: 6000 },
];

export const LEAGUE_BASELINE = 52;
export const GAMES = 120;
export const BLOCKS = 4;
export const HOME_GAMES = 60;
export const SALARY_CAP = 18000;
export const LUXURY_RATE = 0.5;
export const BANKRUPTCY = -5000;
export const TRUST_DANGER = 20;

export const MAJOR_SLOTS = 26;
export const FARM_SLOTS = 20;

export const ATTR_LABELS: Record<AttrKey, string> = {
  contact: '打擊',
  power: '長打',
  speed: '跑壘',
  fielding: '守備',
  eye: '選球',
  velocity: '球速',
  control: '控球',
  breaking: '變化球',
  stamina: '續航力',
  guts: '膽識',
};

export const POSITION_LABELS: Record<Position, string> = {
  P: '投手',
  C: '捕手',
  IF: '內野手',
  OF: '外野手',
};

export const BATTER_ATTRS: AttrKey[] = ['contact', 'power', 'speed', 'fielding', 'eye'];
export const PITCHER_ATTRS: AttrKey[] = ['velocity', 'control', 'breaking', 'stamina', 'guts'];

export function attrsFor(position: Position): AttrKey[] {
  return position === 'P' ? PITCHER_ATTRS : BATTER_ATTRS;
}

/** Identical weighting to 棒球人生, so a player is worth the same in both games. */
export function overall(attrs: Attributes, position: Position): number {
  if (position === 'P') {
    return (
      attrs.velocity * 0.28 +
      attrs.control * 0.28 +
      attrs.breaking * 0.24 +
      attrs.stamina * 0.12 +
      attrs.guts * 0.08
    );
  }
  const defenseWeight = position === 'C' ? 0.24 : position === 'IF' ? 0.2 : 0.15;
  const offenseScale = 1 - defenseWeight;
  return (
    (attrs.contact * 0.42 + attrs.power * 0.28 + attrs.eye * 0.18 + attrs.speed * 0.12) *
      offenseScale +
    attrs.fielding * defenseWeight
  );
}

export function grade(value: number): string {
  if (value >= 92) return 'S';
  if (value >= 82) return 'A';
  if (value >= 70) return 'B';
  if (value >= 56) return 'C';
  if (value >= 42) return 'D';
  if (value >= 28) return 'E';
  return 'F';
}

export function gradeColor(value: number): string {
  if (value >= 92) return '#f87171';
  if (value >= 82) return '#fb923c';
  if (value >= 70) return '#fbbf24';
  if (value >= 56) return '#4ade80';
  if (value >= 42) return '#38bdf8';
  if (value >= 28) return '#a78bfa';
  return '#94a3b8';
}

/** 萬元 → readable Chinese, rolling over into 億 past 10,000. */
export function formatMoney(wan: number): string {
  const value = Math.round(wan);
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(value);
  if (abs < 10000) return `${sign}${abs.toLocaleString('en-US')} 萬`;
  const yi = Math.floor(abs / 10000);
  const rest = abs % 10000;
  return rest === 0
    ? `${sign}${yi} 億`
    : `${sign}${yi} 億 ${rest.toLocaleString('en-US')} 萬`;
}

export interface ExpectationInfo {
  id: Expectation;
  label: string;
  demand: string;
  reward: number;
  penalty: number;
  bonus: number;
  /** Rank among expectations; used when negotiating up or down a tier. */
  tier: number;
}

export const EXPECTATIONS: Record<Expectation, ExpectationInfo> = {
  rebuild: {
    id: 'rebuild',
    label: '重建',
    demand: '三年內讓 3 名自家新秀成為一軍主力',
    reward: 12,
    penalty: -6,
    bonus: 0,
    tier: 0,
  },
  hold: {
    id: 'hold',
    label: '站穩',
    demand: '勝率 .500 以上',
    reward: 10,
    penalty: -12,
    bonus: 0,
    tier: 1,
  },
  playoffs: {
    id: 'playoffs',
    label: '進季後賽',
    demand: '取得季後賽資格',
    reward: 16,
    penalty: -15,
    bonus: 2000,
    tier: 2,
  },
  title: {
    id: 'title',
    label: '拚冠',
    demand: '拿下總冠軍',
    reward: 28,
    penalty: -20,
    bonus: 6000,
    tier: 3,
  },
};

export const EXPECTATION_ORDER: Expectation[] = ['rebuild', 'hold', 'playoffs', 'title'];

/** Scouting spend per draft class → half-width of the reported potential band. */
export const SCOUT_TIERS: { spend: number; width: number; label: string }[] = [
  { spend: 0, width: 25, label: '不派球探' },
  { spend: 200, width: 16, label: '基本球探' },
  { spend: 500, width: 10, label: '完整球探團' },
  { spend: 1000, width: 5, label: '全方位追蹤' },
];

export const FARM_UPKEEP_PER_LEVEL = 600;
export const STADIUM_UPKEEP = 2200;

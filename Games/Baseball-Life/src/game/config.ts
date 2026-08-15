import type { AttrKey, Attributes, LeagueId, Position } from './types';

export const STORAGE_KEY = 'clubhouse:baseball-life';

export const POSITIONS: { id: Position; label: string; blurb: string }[] = [
  { id: 'P', label: '投手', blurb: '球速、控球與變化球決定一切；肩肘是最貴的資產。' },
  { id: 'C', label: '捕手', blurb: '守備與配球撐起球隊，打擊起步慢但生涯長。' },
  { id: 'IF', label: '內野手', blurb: '守備範圍與臂力並重，打擊全面者最搶手。' },
  { id: 'OF', label: '外野手', blurb: '速度與長打的舞台，跑得動就有機會站上先發。' },
];

export const IS_PITCHER: Record<Position, boolean> = { P: true, C: false, IF: false, OF: false };

/** Attributes surfaced in the UI, in display order, split by role. */
export const BATTER_ATTRS: AttrKey[] = ['contact', 'power', 'speed', 'fielding', 'eye'];
export const PITCHER_ATTRS: AttrKey[] = ['velocity', 'control', 'breaking', 'stamina', 'guts'];

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

export const META_LABELS = {
  body: '體能',
  mind: '心志',
  fame: '人氣',
  fatigue: '疲勞',
} as const;

export interface LeagueInfo {
  label: string;
  short: string;
  /** Talent level a league-average regular sits at; the gap drives every stat. */
  baseline: number;
  games: number;
  accent: string;
}

export const LEAGUES: Record<LeagueId, LeagueInfo> = {
  hs: { label: '高中棒球聯賽', short: '高中', baseline: 30, games: 24, accent: '#fbbf24' },
  college: { label: '大學棒球聯賽', short: '大學', baseline: 41, games: 40, accent: '#60a5fa' },
  corp: { label: '成棒社會組', short: '社會人', baseline: 45, games: 45, accent: '#34d399' },
  cpbl: { label: '中華職棒', short: '中職', baseline: 52, games: 120, accent: '#fb7185' },
  milb: { label: '小聯盟', short: '小聯盟', baseline: 58, games: 130, accent: '#a78bfa' },
  npb: { label: '日本職棒', short: '日職', baseline: 63, games: 143, accent: '#f472b6' },
  mlb: { label: '美國大聯盟', short: '大聯盟', baseline: 71, games: 162, accent: '#22d3ee' },
};

/** All teams are fictional — this is a fan simulation, not a licensed one. */
export const TEAMS: Record<LeagueId, string[]> = {
  hs: ['明德高中', '東和工商', '南陽高中', '北辰體中', '青雲高工', '海線高商'],
  college: ['文華大學', '中興體院', '南都大學', '嘉北科大'],
  corp: ['台電勁旅', '合庫金剛', '中油火力', '國訓紅隼'],
  cpbl: ['南方猛獅', '桃園天使', '台中巨砲', '台南飛鷹', '新北海豚', '高雄火山'],
  milb: ['三重A 響尾狼', '雙A 河灣', '高階A 磨坊'],
  npb: ['東京烈風', '大阪猛虎', '福岡海鷹', '北海道極星', '名古屋龍捲'],
  mlb: ['紐約帝國', '洛杉磯星光', '芝加哥鋼鐵', '西雅圖潮汐', '德州牛仔', '亞特蘭大雷鳥'],
};

export interface Origin {
  id: string;
  label: string;
  blurb: string;
  bonus: Partial<Attributes>;
  meta?: { body?: number; mind?: number; fame?: number };
}

/** Three of these are offered at creation, drawn from the seed. */
export const ORIGINS: Origin[] = [
  {
    id: 'little-league',
    label: '少棒名校直升',
    blurb: '從小打到大，基本功紮實，但也早早磨掉了新鮮感。',
    bonus: { contact: 6, fielding: 6, control: 6, breaking: 4 },
    meta: { mind: 4 },
  },
  {
    id: 'late-start',
    label: '國三才入隊',
    blurb: '起步比別人晚，可是身體還沒被操壞，成長空間驚人。',
    bonus: { power: 3, velocity: 3 },
    meta: { body: 10 },
  },
  {
    id: 'track-convert',
    label: '田徑隊轉隊',
    blurb: '百米 11 秒 2 的腳程，教練第一眼就決定要你。',
    bonus: { speed: 12, velocity: 6, power: 3 },
  },
  {
    id: 'coach-son',
    label: '教練之子',
    blurb: '從小在球場長大，看球的眼睛跟別人不一樣。',
    bonus: { eye: 10, guts: 8, fielding: 3 },
    meta: { mind: 6 },
  },
  {
    id: 'big-frame',
    label: '188 公分的原石',
    blurb: '什麼都不會，但那副身材讓所有球探都想賭一把。',
    bonus: { power: 10, velocity: 10 },
    meta: { body: 5, mind: -5 },
  },
  {
    id: 'baseball-town',
    label: '棒球小鎮出身',
    blurb: '全鎮的人都認識你，壓力與掌聲一起長大。',
    bonus: { guts: 6, contact: 4, control: 4 },
    meta: { fame: 12 },
  },
  {
    id: 'switch-hitter',
    label: '左右開弓',
    blurb: '父親從你會走路就逼你練左打，現在成了武器。',
    bonus: { contact: 8, eye: 5, speed: 4, breaking: 6 },
  },
  {
    id: 'frail-genius',
    label: '體弱的天才',
    blurb: '球感是同期第一，但體育館跑三圈就臉色發白。',
    bonus: { contact: 8, eye: 6, breaking: 10, control: 6 },
    meta: { body: -12 },
  },
];

/** Grade letters make a 0–100 number readable at a glance. */
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

export function attrsForPosition(position: Position): AttrKey[] {
  return IS_PITCHER[position] ? PITCHER_ATTRS : BATTER_ATTRS;
}

/**
 * Overall rating drives scouting, playing time and every stat line. Only the
 * attributes that matter for the role count, so a pitcher's dead-weight
 * contact rating never inflates their draft stock.
 */
export function overall(attrs: Attributes, position: Position): number {
  if (IS_PITCHER[position]) {
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

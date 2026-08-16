import type { GameState } from './types';

/**
 * Situational flavour that also moves numbers. Events are filtered by how the
 * club actually stands, so a broke rebuilding side never gets the "your
 * champions are demanding raises" storyline.
 */
export interface ClubEvent {
  id: string;
  weight: number;
  text: string;
  tone?: 'normal' | 'good' | 'bad' | 'great';
  effects?: {
    cash?: number;
    heat?: number;
    trust?: number;
    farmLevel?: number;
    morale?: number;
  };
  condition?: (state: GameState) => boolean;
}

const contending = (s: GameState) =>
  s.history.length > 0 && s.history[s.history.length - 1].finish <= 3;
const rebuilding = (s: GameState) => s.board.expectation === 'rebuild';
const broke = (s: GameState) => s.finance.cash < 2000;
const rich = (s: GameState) => s.finance.cash > 12000;

export const EVENTS: ClubEvent[] = [
  {
    id: 'typhoon',
    weight: 10,
    text: '颱風取消 4 場主場比賽，門票收入蒸發。',
    effects: { cash: -900 },
    tone: 'bad',
  },
  {
    id: 'parent-injection',
    weight: 8,
    text: '母企業年度預算調整，額外撥了一筆錢下來。',
    effects: { cash: 3000 },
    tone: 'good',
  },
  {
    id: 'parent-cut',
    weight: 8,
    text: '母企業本業虧損，要求球團自負盈虧。',
    effects: { cash: -3000, trust: -3 },
    tone: 'bad',
  },
  {
    id: 'farm-poached',
    weight: 7,
    text: '二軍打擊教練被對手挖角，農場的訓練品質掉了一截。',
    effects: { farmLevel: -1 },
    tone: 'bad',
    condition: (s) => s.farmLevel > 1,
  },
  {
    id: 'ticket-protest',
    weight: 7,
    text: '球迷在社群發起抗議，說票價漲得比戰績快。',
    effects: { heat: -8 },
    tone: 'bad',
    condition: (s) => s.finance.ticketPrice >= 400,
  },
  {
    id: 'viral-play',
    weight: 8,
    text: '一次美技守備在社群爆紅，一週內湧進大量新球迷。',
    effects: { heat: 10 },
    tone: 'good',
  },
  {
    id: 'new-tv-deal',
    weight: 6,
    text: '聯盟簽下新的轉播合約，各隊分潤提高。',
    effects: { cash: 2200 },
    tone: 'great',
  },
  {
    id: 'clubhouse-fight',
    weight: 7,
    text: '休息室爆發衝突，兩名主力互不說話。',
    effects: { morale: -3, heat: -4 },
    tone: 'bad',
  },
  {
    id: 'veteran-leadership',
    weight: 8,
    text: '老將主動加練並帶著年輕人一起，氣氛明顯不一樣了。',
    effects: { morale: 3 },
    tone: 'good',
  },
  {
    id: 'title-hangover',
    weight: 7,
    text: '奪冠後的慶功行程排滿，春訓的強度完全拉不起來。',
    effects: { morale: -3 },
    tone: 'bad',
    condition: (s) => s.history.some((h) => h.playoffResult === '總冠軍'),
  },
  {
    id: 'star-extension',
    weight: 8,
    text: '當家球星要求提前續約，經紀人放話說明年就要測試市場。',
    effects: { cash: -1500, trust: 2, morale: 2 },
    condition: contending,
  },
  {
    id: 'prospect-breakout',
    weight: 9,
    text: '一名二軍新秀突然開竅，球探報告整份被推翻重寫。',
    effects: { morale: 2, trust: 3 },
    tone: 'great',
    condition: rebuilding,
  },
  {
    id: 'attendance-slump',
    weight: 8,
    text: '連續的爛戰績讓看台空了一半，週邊店也開始清庫存。',
    effects: { heat: -10, cash: -600 },
    tone: 'bad',
    condition: (s) =>
      s.history.length > 0 && s.history[s.history.length - 1].wins < 50,
  },
  {
    id: 'loan-offer',
    weight: 6,
    text: '銀行主動提供一筆低利週轉金，但董事會不太喜歡這個訊號。',
    effects: { cash: 2500, trust: -4 },
    condition: broke,
  },
  {
    id: 'facility-upgrade',
    weight: 6,
    text: '手頭寬裕，順勢把重訓室整個翻新了。',
    effects: { cash: -1800, morale: 3, farmLevel: 1 },
    tone: 'good',
    condition: rich,
  },
  {
    id: 'scandal',
    weight: 4,
    text: '一名球員涉入賭博調查，最後查無實據，但名字已經上了頭條。',
    effects: { heat: -12, trust: -5 },
    tone: 'bad',
  },
  {
    id: 'youth-camp',
    weight: 7,
    text: '球團在偏鄉辦了少棒訓練營，地方媒體給了很大的版面。',
    effects: { heat: 6, cash: -400 },
    tone: 'good',
  },
  {
    id: 'sponsor-bidding',
    weight: 6,
    text: '兩家企業搶著冠名主場，價碼被抬了上去。',
    effects: { cash: 1600 },
    tone: 'good',
    condition: (s) => s.heat >= 60,
  },
];

export function pickEvent(state: GameState, rng: () => number): ClubEvent | null {
  const eligible = EVENTS.filter((e) => !e.condition || e.condition(state));
  if (eligible.length === 0) return null;
  // Unseen first, exactly as in 棒球人生: a ten-year run should not replay the
  // same storyline before it has shown everything it has.
  const unseen = eligible.filter((e) => !state.seenEvents.includes(e.id));
  const pool = unseen.length > 0 ? unseen : eligible;

  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng() * total;
  for (const event of pool) {
    roll -= event.weight;
    if (roll <= 0) return event;
  }
  return pool[pool.length - 1];
}

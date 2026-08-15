import type { Attributes, GameState, Meta, Stage } from './types';

/**
 * Flavour events fire *after* the turn's training resolves. They never ask the
 * player anything — the branching decisions live in the engine — but they are
 * what makes two runs of the same seed feel like different lives once the
 * choices diverge.
 */
export interface RandomEvent {
  id: string;
  stages: Stage[];
  weight: number;
  text: string;
  deltas?: Partial<Attributes & Meta>;
  tone?: 'normal' | 'good' | 'bad' | 'great';
  condition?: (state: GameState) => boolean;
}

export const EVENTS: RandomEvent[] = [
  // ---- High school ----
  {
    id: 'hs-senior-mentor',
    stages: ['highschool'],
    weight: 10,
    text: '學長把自己的打擊筆記整本傳給你，密密麻麻寫滿對手投手的球路。',
    deltas: { eye: 3, control: 3, mind: 3 },
    tone: 'good',
  },
  {
    id: 'hs-cleanup-duty',
    stages: ['highschool'],
    weight: 12,
    text: '整個禮拜被罰整理球具室，練習時間硬生生少了一半。',
    deltas: { fatigue: -6, mind: 2 },
  },
  {
    id: 'hs-night-run',
    stages: ['highschool'],
    weight: 10,
    text: '不甘心輸球，你開始每晚沿著河堤加跑五公里。',
    deltas: { body: 5, stamina: 3, speed: 2, fatigue: 6 },
    tone: 'good',
  },
  {
    id: 'hs-exam-fail',
    stages: ['highschool'],
    weight: 9,
    text: '兩科被當，補考期間禁止參加練習。',
    deltas: { mind: -3, fatigue: -8 },
    tone: 'bad',
  },
  {
    id: 'hs-scout-visit',
    stages: ['highschool'],
    weight: 8,
    text: '看台角落坐著幾個拿測速槍的陌生人，練習結束後他們問了你的名字。',
    deltas: { fame: 8, mind: 2 },
    tone: 'good',
    condition: (s) => s.age >= 17,
  },
  {
    id: 'hs-love-letter',
    stages: ['highschool'],
    weight: 8,
    text: '鞋櫃裡出現一封信。你把它夾進課本，那天的揮棒莫名輕盈。',
    deltas: { mind: 5, fatigue: -4 },
    tone: 'good',
  },
  {
    id: 'hs-coach-fight',
    stages: ['highschool'],
    weight: 7,
    text: '為了守備位置跟教練起了衝突，被下放二軍練習一個月。',
    deltas: { mind: -5, fame: -5 },
    tone: 'bad',
  },
  {
    id: 'hs-typhoon',
    stages: ['highschool'],
    weight: 7,
    text: '颱風泡爛了球場，全隊在走廊上做了兩週的重量訓練。',
    deltas: { body: 4, power: 2, velocity: 2 },
  },
  {
    id: 'hs-grandpa',
    stages: ['highschool'],
    weight: 6,
    text: '阿公坐三小時客運來看你比賽，散場時只說了一句「有夠讚」。',
    deltas: { mind: 7, guts: 3 },
    tone: 'great',
  },

  // ---- Professional ----
  {
    id: 'pro-veteran-tip',
    stages: ['pro'],
    weight: 10,
    text: '隊上老將在牛棚旁點出你的一個小習慣動作，那是被研究了整季的破綻。',
    deltas: { contact: 2, control: 2, eye: 2, breaking: 2 },
    tone: 'good',
  },
  {
    id: 'pro-slump',
    stages: ['pro'],
    weight: 11,
    text: '長達一個月的低潮，媒體開始寫「是不是被看破手腳了」。',
    deltas: { mind: -5, fame: -6 },
    tone: 'bad',
  },
  {
    id: 'pro-endorsement',
    stages: ['pro'],
    weight: 8,
    text: '運動飲料廣告找上門，你的臉出現在便利商店的冰櫃上。',
    deltas: { fame: 12, mind: 2 },
    tone: 'good',
    condition: (s) => s.meta.fame >= 45,
  },
  {
    id: 'pro-newborn',
    stages: ['pro'],
    weight: 7,
    text: '孩子出生了。休賽期的重訓多了一個很吵的觀眾。',
    deltas: { mind: 8, fatigue: 5 },
    tone: 'good',
    condition: (s) => s.age >= 25,
  },
  {
    id: 'pro-new-pitch',
    stages: ['pro'],
    weight: 9,
    text: '春訓摸索出一顆新的變化球，握法是從影片裡偷學來的。',
    deltas: { breaking: 6, control: -2 },
    tone: 'good',
    condition: (s) => s.position === 'P',
  },
  {
    id: 'pro-swing-change',
    stages: ['pro'],
    weight: 9,
    text: '打擊教練說服你改抬腳時機，代價是前兩個月完全找不到球。',
    deltas: { power: 6, contact: -2 },
    tone: 'good',
    condition: (s) => s.position !== 'P',
  },
  {
    id: 'pro-gambling-probe',
    stages: ['pro'],
    weight: 4,
    text: '聯盟展開調查，你被約談三次才洗清嫌疑，名字卻已經上了頭條。',
    deltas: { fame: -18, mind: -6 },
    tone: 'bad',
  },
  {
    id: 'pro-walkoff',
    stages: ['pro'],
    weight: 8,
    text: '延長賽再見安打，全隊在本壘板上把你的球衣扯破。',
    deltas: { fame: 10, guts: 4, mind: 4 },
    tone: 'great',
  },
  {
    id: 'pro-winter-league',
    stages: ['pro'],
    weight: 8,
    text: '休賽期跑去冬季聯盟兼差，多打了 40 場，錢包和身體都有感。',
    deltas: { contact: 3, control: 3, fatigue: 12 },
  },
  {
    id: 'pro-mentor-role',
    stages: ['pro'],
    weight: 8,
    text: '你成了菜鳥們口中的「前輩」。教別人的過程，自己也重新想了一次。',
    deltas: { mind: 6, guts: 3, fame: 3 },
    tone: 'good',
    condition: (s) => s.age >= 30,
  },

  // ---- Amateur (college / corporate) ----
  {
    id: 'am-study',
    stages: ['amateur'],
    weight: 10,
    text: '學校的運動科學實驗室把你的動作拆成 200 幀，數據不會說謊。',
    deltas: { control: 4, contact: 4, eye: 3 },
    tone: 'good',
  },
  {
    id: 'am-office',
    stages: ['amateur'],
    weight: 10,
    text: '白天在公司打卡，晚上才練球。體力被兩頭燒。',
    deltas: { fatigue: 12, mind: 4 },
  },
  {
    id: 'am-national-camp',
    stages: ['amateur'],
    weight: 8,
    text: '入選國家隊培訓名單，第一次穿上有國旗的球衣。',
    deltas: { fame: 10, guts: 4 },
    tone: 'good',
  },
];

export function pickEvent(state: GameState, rng: () => number): RandomEvent | null {
  const pool = EVENTS.filter(
    (e) => e.stages.includes(state.stage) && (!e.condition || e.condition(state)),
  );
  if (pool.length === 0) return null;
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng() * total;
  for (const event of pool) {
    roll -= event.weight;
    if (roll <= 0) return event;
  }
  return pool[pool.length - 1];
}

export const INJURIES: { name: string; seasons: number; severity: 'minor' | 'major' | 'career' }[] = [
  { name: '腿後肌拉傷', seasons: 0, severity: 'minor' },
  { name: '手腕挫傷', seasons: 0, severity: 'minor' },
  { name: '腰椎椎間盤突出', seasons: 1, severity: 'major' },
  { name: '肩膀旋轉肌撕裂', seasons: 1, severity: 'major' },
  { name: '手肘韌帶重建（Tommy John）', seasons: 1, severity: 'career' },
  { name: '阿基里斯腱斷裂', seasons: 1, severity: 'career' },
];

import type { Attributes, GameState, Meta, Stage } from './types';

/**
 * Flavour events fire *after* the turn's training resolves. They never ask the
 * player anything — the branching decisions live in the engine — but they are
 * what makes two runs of the same seed feel like different lives once the
 * choices diverge.
 *
 * A full career is 30+ turns, so the pool is deliberately large and layered by
 * age: what happens to a 19-year-old rookie should not read the same as what
 * happens to a 34-year-old clubhouse elder.
 */
export interface RandomEvent {
  id: string;
  stages: Stage[];
  weight: number;
  text: string;
  deltas?: Partial<Attributes & Meta>;
  tone?: 'normal' | 'good' | 'bad' | 'great';
  minAge?: number;
  maxAge?: number;
  condition?: (state: GameState) => boolean;
}

const isPitcher = (s: GameState) => s.position === 'P';
const isBatter = (s: GameState) => s.position !== 'P';

export const EVENTS: RandomEvent[] = [
  // ---------------------------------------------------------------- 高中 ----
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
    weight: 9,
    text: '整個禮拜被罰整理球具室，練習時間硬生生少了一半。',
    deltas: { fatigue: -6, mind: 2 },
  },
  {
    id: 'hs-night-run',
    stages: ['highschool'],
    weight: 9,
    text: '不甘心輸球，你開始每晚沿著河堤加跑五公里。',
    deltas: { body: 5, stamina: 3, speed: 2, fatigue: 6 },
    tone: 'good',
  },
  {
    id: 'hs-exam-fail',
    stages: ['highschool'],
    weight: 8,
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
    minAge: 17,
  },
  {
    id: 'hs-love-letter',
    stages: ['highschool'],
    weight: 7,
    text: '鞋櫃裡出現一封信。你把它夾進課本，那天的揮棒莫名輕盈。',
    deltas: { mind: 5, fatigue: -4 },
    tone: 'good',
  },
  {
    id: 'hs-coach-fight',
    stages: ['highschool'],
    weight: 6,
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
  {
    id: 'hs-quit-friend',
    stages: ['highschool'],
    weight: 7,
    text: '同期最要好的隊友退部了。他把手套留給你，說「你幫我打完」。',
    deltas: { mind: 6, guts: 4 },
    tone: 'good',
  },
  {
    id: 'hs-growth-spurt',
    stages: ['highschool'],
    weight: 7,
    text: '一個暑假長高了六公分，制服全部要重買，揮棒的感覺也全部要重找。',
    deltas: { power: 5, velocity: 5, contact: -2, control: -2, body: 4 },
    maxAge: 17,
  },
  {
    id: 'hs-part-time',
    stages: ['highschool'],
    weight: 6,
    text: '家裡狀況不好，你在早餐店打工到七點再去晨操。',
    deltas: { mind: 5, body: -4, fatigue: 10 },
  },
  {
    id: 'hs-manager-notes',
    stages: ['highschool'],
    weight: 6,
    text: '球隊經理默默幫你記了整季的揮棒影片，剪成一支十分鐘的檔案。',
    deltas: { contact: 3, control: 3, eye: 2, mind: 3 },
    tone: 'good',
  },
  {
    id: 'hs-bench',
    stages: ['highschool'],
    weight: 7,
    text: '整個春季聯賽都在板凳上。你把每一顆球都記下來，記到手指發酸。',
    deltas: { eye: 4, guts: 4, mind: -2, fame: -3 },
    maxAge: 17,
  },
  {
    id: 'hs-cleanup-order',
    stages: ['highschool'],
    weight: 6,
    text: '教練把你排進第四棒。走上打擊區時，你發現自己的手在抖。',
    deltas: { guts: 5, power: 3, fame: 5 },
    tone: 'good',
    condition: isBatter,
  },
  {
    id: 'hs-ace-number',
    stages: ['highschool'],
    weight: 6,
    text: '背號一號發到你手上。學長拍你的背說：「接下來看你的了。」',
    deltas: { guts: 5, stamina: 3, fame: 5 },
    tone: 'good',
    condition: isPitcher,
  },
  {
    id: 'hs-elbow-warning',
    stages: ['highschool'],
    weight: 6,
    text: '手肘在連續完投後開始隱隱作痛。你沒有跟任何人說。',
    deltas: { velocity: -2, body: -5, fatigue: 8 },
    tone: 'bad',
    condition: isPitcher,
  },
  {
    id: 'hs-batting-eye',
    stages: ['highschool'],
    weight: 6,
    text: '你開始練習到兩好球才出棒。教練罵歸罵，四壞球倒是變多了。',
    deltas: { eye: 6, contact: 2 },
    tone: 'good',
    condition: isBatter,
  },
  {
    id: 'hs-media-day',
    stages: ['highschool'],
    weight: 5,
    text: '地方報紙寫了你半版，標題是「明日之星」。你剪下來夾在書桌抽屜。',
    deltas: { fame: 10, mind: 3 },
    tone: 'good',
    minAge: 17,
  },
  {
    id: 'hs-last-summer',
    stages: ['highschool'],
    weight: 8,
    text: '最後一年的球隊合照。有人笑到哭，有人哭到笑。',
    deltas: { mind: 8, guts: 3 },
    tone: 'great',
    minAge: 18,
  },

  // ------------------------------------------------------------ 業餘階段 ----
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
  {
    id: 'am-scout-cold',
    stages: ['amateur'],
    weight: 8,
    text: '去年還每場都來的球探，今年一個也沒出現。',
    deltas: { fame: -6, mind: -4 },
    tone: 'bad',
  },
  {
    id: 'am-senior-league',
    stages: ['amateur'],
    weight: 8,
    text: '成棒的比賽節奏跟高中完全是兩回事，你花了整季才適應。',
    deltas: { contact: 3, control: 3, guts: 4 },
  },
  {
    id: 'am-classmate',
    stages: ['amateur'],
    weight: 7,
    text: '同屆的同學開始投履歷找工作，你還在球場上。有時候會想這樣對不對。',
    deltas: { mind: -4, guts: 3 },
  },
  {
    id: 'am-coach-offer',
    stages: ['amateur'],
    weight: 6,
    text: '母校找你回去當助理教練。你婉拒了，但心裡記著這件事。',
    deltas: { mind: 5 },
  },
  {
    id: 'am-gym-rat',
    stages: ['amateur'],
    weight: 8,
    text: '你在健身房遇到一個退役的學長，他把整套課表寫給你。',
    deltas: { body: 8, power: 4, velocity: 4 },
    tone: 'good',
  },

  // ------------------------------------------------- 職業：菜鳥期（≤23）----
  {
    id: 'pro-first-hit',
    stages: ['pro'],
    weight: 10,
    text: '一軍初安打。球被撿回來，用馬克筆寫上日期擺進置物櫃。',
    deltas: { mind: 6, fame: 5 },
    tone: 'great',
    maxAge: 23,
  },
  {
    id: 'pro-farm',
    stages: ['pro'],
    weight: 10,
    text: '被下放二軍。二軍球場的看台只有小貓兩三隻，還有你媽。',
    deltas: { mind: -5, fame: -4, contact: 2, control: 2 },
    tone: 'bad',
    maxAge: 24,
  },
  {
    id: 'pro-rookie-hazing',
    stages: ['pro'],
    weight: 8,
    text: '新人餘興節目要你扮成偶像團體上台。全隊笑翻，你也笑了。',
    deltas: { mind: 4, fame: 3 },
    tone: 'good',
    maxAge: 22,
  },
  {
    id: 'pro-first-paycheck',
    stages: ['pro'],
    weight: 8,
    text: '第一筆薪水下來，你把大部分匯回家，剩下的買了一副新手套。',
    deltas: { mind: 5 },
    tone: 'good',
    maxAge: 22,
  },
  {
    id: 'pro-velocity-jump',
    stages: ['pro'],
    weight: 8,
    text: '球速表突然多了三公里。訓練員說是因為你終於學會用下半身。',
    deltas: { velocity: 6, stamina: 2 },
    tone: 'good',
    maxAge: 25,
    condition: isPitcher,
  },
  {
    id: 'pro-pitch-tipping',
    stages: ['pro'],
    weight: 7,
    text: '被對手抓到出手前的小動作，連續三場被打爆才有人告訴你。',
    deltas: { control: -3, mind: -5, eye: 3 },
    tone: 'bad',
    maxAge: 26,
    condition: isPitcher,
  },
  {
    id: 'pro-first-hr',
    stages: ['pro'],
    weight: 8,
    text: '生涯第一轟。繞壘的時候你刻意跑慢了一點，想把這段路記久一點。',
    deltas: { power: 3, mind: 6, fame: 6 },
    tone: 'great',
    maxAge: 24,
    condition: isBatter,
  },

  // --------------------------------------------- 職業：巔峰期（24–30）----
  {
    id: 'pro-veteran-tip',
    stages: ['pro'],
    weight: 9,
    text: '隊上老將在牛棚旁點出你的一個小習慣動作，那是被研究了整季的破綻。',
    deltas: { contact: 2, control: 2, eye: 2, breaking: 2 },
    tone: 'good',
  },
  {
    id: 'pro-slump',
    stages: ['pro'],
    weight: 10,
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
    minAge: 25,
  },
  {
    id: 'pro-new-pitch',
    stages: ['pro'],
    weight: 8,
    text: '春訓摸索出一顆新的變化球，握法是從影片裡偷學來的。',
    deltas: { breaking: 6, control: -2 },
    tone: 'good',
    condition: isPitcher,
  },
  {
    id: 'pro-swing-change',
    stages: ['pro'],
    weight: 8,
    text: '打擊教練說服你改抬腳時機，代價是前兩個月完全找不到球。',
    deltas: { power: 6, contact: -2 },
    tone: 'good',
    condition: isBatter,
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
    weight: 7,
    text: '休賽期跑去冬季聯盟兼差，多打了 40 場，錢包和身體都有感。',
    deltas: { contact: 3, control: 3, fatigue: 12 },
  },
  {
    id: 'pro-all-star',
    stages: ['pro'],
    weight: 8,
    text: '明星賽先發票選第一。你在紅毯上笨拙地揮手。',
    deltas: { fame: 14, mind: 4 },
    tone: 'great',
    condition: (s) => s.meta.fame >= 55,
  },
  {
    id: 'pro-contract-dispute',
    stages: ['pro'],
    weight: 7,
    text: '合約談判破裂，你在春訓報到日遲了兩天。球團記者會的語氣很冷。',
    deltas: { fame: -8, mind: -4 },
    tone: 'bad',
    minAge: 25,
  },
  {
    id: 'pro-championship',
    stages: ['pro'],
    weight: 7,
    text: '總冠軍賽第七戰。香檳灑進眼睛的時候，你才確定這是真的。',
    deltas: { fame: 18, mind: 8, guts: 4 },
    tone: 'great',
    minAge: 23,
  },
  {
    id: 'pro-position-change',
    stages: ['pro'],
    weight: 6,
    text: '球團要你改守另一個位置。四十歲的守備教練陪你練到天黑。',
    deltas: { fielding: 6, mind: 3 },
    minAge: 26,
    condition: isBatter,
  },
  {
    id: 'pro-bullpen-move',
    stages: ['pro'],
    weight: 6,
    text: '從先發轉進牛棚。你花了半季才習慣不知道哪天要上場的日子。',
    deltas: { guts: 5, control: 3, stamina: -4 },
    minAge: 27,
    condition: isPitcher,
  },
  {
    id: 'pro-charity',
    stages: ['pro'],
    weight: 6,
    text: '你在故鄉辦了免費的少棒訓練營，來了兩百個孩子。',
    deltas: { fame: 8, mind: 6 },
    tone: 'good',
    minAge: 26,
  },

  // ------------------------------------------------ 職業：老將期（31＋）----
  {
    id: 'pro-mentor-role',
    stages: ['pro'],
    weight: 9,
    text: '你成了菜鳥們口中的「前輩」。教別人的過程，自己也重新想了一次。',
    deltas: { mind: 6, guts: 3, fame: 3 },
    tone: 'good',
    minAge: 30,
  },
  {
    id: 'pro-body-check',
    stages: ['pro'],
    weight: 9,
    text: '每天提早兩小時到球場做防護。年輕時二十分鐘就能搞定的事。',
    deltas: { body: 5, fatigue: 6 },
    minAge: 31,
  },
  {
    id: 'pro-bat-speed',
    stages: ['pro'],
    weight: 8,
    text: '同樣的球，以前打出去是全壘打，現在是二壘手正面接殺。',
    deltas: { power: -3, mind: -4 },
    tone: 'bad',
    minAge: 32,
    condition: isBatter,
  },
  {
    id: 'pro-velocity-drop',
    stages: ['pro'],
    weight: 8,
    text: '球速掉了四公里。你開始認真研究怎麼用控球和變化球活下去。',
    deltas: { velocity: -4, control: 4, breaking: 3 },
    minAge: 32,
    condition: isPitcher,
  },
  {
    id: 'pro-younger-star',
    stages: ['pro'],
    weight: 8,
    text: '球隊簽下一個十九歲的新人，守的正是你的位置。',
    deltas: { mind: -5, guts: 4 },
    minAge: 31,
  },
  {
    id: 'pro-1000-game',
    stages: ['pro'],
    weight: 7,
    text: '出賽一千場的紀念花束遞到手上，你看了看休息區，很多人已經不在了。',
    deltas: { fame: 8, mind: 6 },
    tone: 'good',
    minAge: 32,
  },
  {
    id: 'pro-coach-talk',
    stages: ['pro'],
    weight: 7,
    text: '球團總管找你「聊聊未來」。整段對話裡沒有出現「明年」這個詞。',
    deltas: { mind: -6 },
    tone: 'bad',
    minAge: 33,
  },
  {
    id: 'pro-last-dance',
    stages: ['pro'],
    weight: 7,
    text: '你開始把每一場都當成最後一場打。奇怪的是，成績反而變好了。',
    deltas: { guts: 6, mind: 5 },
    tone: 'good',
    minAge: 34,
  },
  {
    id: 'pro-son-watching',
    stages: ['pro'],
    weight: 6,
    text: '孩子第一次看懂你在做什麼，在看台上大喊你的背號。',
    deltas: { mind: 9, guts: 3 },
    tone: 'great',
    minAge: 33,
  },
  {
    id: 'pro-pinch-hit',
    stages: ['pro'],
    weight: 7,
    text: '你的名字從先發名單消失，變成代打欄的一行小字。',
    deltas: { mind: -5, guts: 3, fame: -4 },
    tone: 'bad',
    minAge: 34,
  },

  // ------------------------------------------------------ 職業：海外限定 ----
  {
    id: 'pro-language',
    stages: ['pro'],
    weight: 9,
    text: '翻譯請假的那一週，你靠著比手畫腳跟捕手配完了九局。',
    deltas: { mind: 6, guts: 4 },
    tone: 'good',
    condition: (s) => s.league === 'npb' || s.league === 'mlb' || s.league === 'milb',
  },
  {
    id: 'pro-bus-league',
    stages: ['pro'],
    weight: 9,
    text: '八小時的長途巴士，睡在走道上。這就是小聯盟。',
    deltas: { fatigue: 14, guts: 5, body: -3 },
    condition: (s) => s.league === 'milb',
  },
  {
    id: 'pro-homesick',
    stages: ['pro'],
    weight: 8,
    text: '除夕夜一個人在異國的公寓吃泡麵，視訊那頭是全家圍爐。',
    deltas: { mind: -7 },
    tone: 'bad',
    condition: (s) => s.league !== 'cpbl',
  },
  {
    id: 'pro-npb-camp',
    stages: ['pro'],
    weight: 8,
    text: '日本的春訓一天揮一千次棒。第三天你連筷子都拿不穩。',
    deltas: { contact: 4, control: 4, body: 4, fatigue: 16 },
    tone: 'good',
    condition: (s) => s.league === 'npb',
  },
  {
    id: 'pro-mlb-debut-crowd',
    stages: ['pro'],
    weight: 8,
    text: '四萬人的球場，國歌唱完的那一秒安靜得可怕。',
    deltas: { guts: 6, fame: 10, mind: 4 },
    tone: 'great',
    condition: (s) => s.league === 'mlb',
  },
  {
    id: 'pro-taiwan-media',
    stages: ['pro'],
    weight: 7,
    text: '台灣的體育版每天報你的每一個打數，連被三振都上標題。',
    deltas: { fame: 8, mind: -3 },
    condition: (s) => s.league !== 'cpbl' && s.meta.fame >= 50,
  },
];

export function pickEvent(state: GameState, rng: () => number): RandomEvent | null {
  const eligible = EVENTS.filter(
    (e) =>
      e.stages.includes(state.stage) &&
      (e.minAge === undefined || state.age >= e.minAge) &&
      (e.maxAge === undefined || state.age <= e.maxAge) &&
      (!e.condition || e.condition(state)),
  );
  if (eligible.length === 0) return null;

  // Prefer something the player has not read yet. "生涯第一轟" landing twice
  // would undercut the one thing these events are for. Once the eligible pool
  // is exhausted, repeats are allowed again rather than going silent.
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

export const INJURIES: { name: string; seasons: number; severity: 'minor' | 'major' | 'career' }[] = [
  { name: '腿後肌拉傷', seasons: 0, severity: 'minor' },
  { name: '手腕挫傷', seasons: 0, severity: 'minor' },
  { name: '腰椎椎間盤突出', seasons: 1, severity: 'major' },
  { name: '肩膀旋轉肌撕裂', seasons: 1, severity: 'major' },
  { name: '手肘韌帶重建（Tommy John）', seasons: 1, severity: 'career' },
  { name: '阿基里斯腱斷裂', seasons: 1, severity: 'career' },
];

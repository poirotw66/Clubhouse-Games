/**
 * High-risk / high-reward situations the player must choose through.
 *
 * Flavour events in `events.ts` only narrate. These interrupt with a real
 * Decision card (`kind: 'event'`): every option costs something, and the
 * upside is deliberately larger than a normal training turn.
 */
import { IS_TWO_WAY } from './config';
import type { Attributes, GameState, Meta, Stage } from './types';

export type SituationEffects = Partial<Attributes & Meta> & {
  /** Extra 天命 granted (can be negative). */
  destiny?: number;
  /** Signing-bonus-style cash in 萬元. */
  earnings?: number;
  /** Chance 0–1 to roll a minor injury after this choice. */
  injuryChance?: number;
  /**
   * Challenge / narrative counter bump for strong international performances.
   * Used by hook-only cards so 「國際賽之鬼」 can be designed, not only RNG'd.
   */
  intlStrong?: number;
};

export interface SituationOption {
  id: string;
  label: string;
  hint: string;
  effects: SituationEffects;
  outcome: string;
  tone?: 'normal' | 'good' | 'bad' | 'great';
}

export interface Situation {
  id: string;
  title: string;
  stages: Stage[];
  weight: number;
  minAge?: number;
  maxAge?: number;
  /** Prefer unseen; repeats only after the eligible pool is exhausted. */
  condition?: (state: GameState) => boolean;
  prompt: (state: GameState) => string;
  options: (state: GameState) => SituationOption[];
}

const isTwoWay = (s: GameState) => IS_TWO_WAY[s.position];
const isPitcher = (s: GameState) => s.position === 'P' || isTwoWay(s);
const isBatter = (s: GameState) => s.position !== 'P';

export const SITUATIONS: Situation[] = [
  // ---- High school ----
  {
    id: 'hs-night-cage-gamble',
    title: '夜半加練',
    stages: ['highschool'],
    weight: 12,
    prompt: () =>
      '社團教室的燈還亮著。隊友都走了，教練說你可以加練，但明天還有早操——身體可能吃不消。',
    options: () => [
      {
        id: 'push',
        label: '加練到管理員趕人',
        hint: '打擊／心志大漲，疲勞與受傷風險暴增',
        effects: { contact: 5, power: 4, mind: 4, fatigue: 22, injuryChance: 0.28 },
        outcome: '你揮到手腕發麻。天亮時球棒還握在手裡。',
        tone: 'great',
      },
      {
        id: 'smart',
        label: '練完核心就收工',
        hint: '小幅成長，幾乎不傷身體',
        effects: { contact: 2, body: 2, fatigue: 6 },
        outcome: '你留給明天一點力氣。教練點了點頭。',
        tone: 'good',
      },
      {
        id: 'skip',
        label: '直接回宿舍睡覺',
        hint: '恢復體能，錯過這次成長',
        effects: { fatigue: -10, body: 3, mind: -2 },
        outcome: '你把自己塞進被窩。窗外的打擊聲還在。',
        tone: 'normal',
      },
    ],
  },
  {
    id: 'hs-scout-showcase',
    title: '球探觀戰日',
    stages: ['highschool'],
    weight: 10,
    minAge: 17,
    prompt: () =>
      '有中職球探來看練球。教練問你：要不要今天就把最拚的那一面拿出來？',
    options: () => [
      {
        id: 'show',
        label: '全力演出',
        hint: '人氣大漲，疲勞高；失手會很難看',
        effects: { fame: 14, guts: 4, fatigue: 18, mind: -2, injuryChance: 0.12 },
        outcome: '你把所有武器都亮了出來。球探筆記本停不下來。',
        tone: 'great',
      },
      {
        id: 'steady',
        label: '照日常節奏',
        hint: '穩穩表現，人氣小漲',
        effects: { fame: 5, mind: 2, fatigue: 4 },
        outcome: '你打得像平常一樣。球探留下一句「再觀察」。',
        tone: 'good',
      },
      {
        id: 'hide',
        label: '刻意保留實力',
        hint: '不被看穿，但人氣幾乎不動',
        effects: { mind: 3, fame: -1 },
        outcome: '你收著打。有人覺得你今天很普通——那正是你要的。',
        tone: 'normal',
      },
    ],
  },

  // ---- Amateur ----
  {
    id: 'am-winter-usa',
    title: '寒假赴美自主',
    stages: ['amateur'],
    weight: 11,
    prompt: () =>
      '學長組團去亞利桑那自主訓練。機票不便宜，當地強度也高，但回來的人幾乎都不一樣。',
    options: () => [
      {
        id: 'go',
        label: '借錢也要去',
        hint: '能力大幅成長；體能透支、小傷風險',
        effects: {
          contact: 4,
          power: 3,
          velocity: 4,
          control: 3,
          mind: 5,
          fatigue: 20,
          body: -4,
          injuryChance: 0.22,
        },
        outcome: '沙漠的陽光把你曬黑了兩階。回來之後揮棒聲音都不一樣。',
        tone: 'great',
      },
      {
        id: 'local',
        label: '留在台灣跟著隊練',
        hint: '穩定小幅成長',
        effects: { contact: 2, control: 2, fatigue: 8, mind: 2 },
        outcome: '你留在熟悉的球場。進步不快，但一步都沒踩空。',
        tone: 'good',
      },
      {
        id: 'rest',
        label: '寒假先把傷養好',
        hint: '恢復體能與心志，成長停滯',
        effects: { fatigue: -18, body: 6, mind: 4 },
        outcome: '你睡飽了。開春時身體是整季最輕的一次。',
        tone: 'normal',
      },
    ],
  },

  // ---- Pro (general) ----
  {
    id: 'pro-closer-audition',
    title: '終結者試鏡',
    stages: ['pro'],
    weight: 11,
    condition: (s) => isPitcher(s) && s.attrs.stamina < 56,
    prompt: () =>
      '教練找你談：先發輪值滿了，但牛棚缺一個敢在九局面對四棒的人。要不要改後援？',
    options: () => [
      {
        id: 'take',
        label: '改後援，搶救命局',
        hint: '膽識／人氣暴衝，續航與身體負擔上升',
        effects: { guts: 8, fame: 10, mind: 3, stamina: -3, fatigue: 16, injuryChance: 0.18 },
        outcome: '你走進九局上的那種安靜。心跳很大聲，但你把球投進去了。',
        tone: 'great',
      },
      {
        id: 'split',
        label: '先當對決組',
        hint: '中等回報，風險可控',
        effects: { guts: 3, control: 2, fame: 4, fatigue: 8 },
        outcome: '你專吃左打。角色不大，但每次上場都算數。',
        tone: 'good',
      },
      {
        id: 'refuse',
        label: '拒絕，繼續等先發',
        hint: '保住續航敘事，錯失曝光',
        effects: { stamina: 2, mind: -3, fame: -2 },
        outcome: '你把名字留在先發候選名單上。牛棚的位置給了別人。',
        tone: 'normal',
      },
    ],
  },
  {
    id: 'pro-cleanup-dare',
    title: '清棒賭注',
    stages: ['pro'],
    weight: 11,
    condition: (s) => (isBatter(s) && !isPitcher(s)) || (isTwoWay(s) && s.attrs.power >= 48),
    prompt: () =>
      '四棒手感冰冷。教練私下問你：下一系列要不要讓你頂清棒？打爆會是英雄，打鐵就是頭條。',
    options: () => [
      {
        id: 'take',
        label: '我頂',
        hint: '長打／人氣大漲，心志與疲勞風險高',
        effects: { power: 6, contact: 3, fame: 12, guts: 4, mind: -4, fatigue: 14, injuryChance: 0.14 },
        outcome: '你站上四棒。第一打席的聲音，整個外野都聽得到。',
        tone: 'great',
      },
      {
        id: 'share',
        label: '輪流扛，不要一次賭死',
        hint: '小幅成長與人氣',
        effects: { power: 2, eye: 2, fame: 4, fatigue: 6 },
        outcome: '你和學長輪流站四棒。壓力被分攤了，也分走了鎂光燈。',
        tone: 'good',
      },
      {
        id: 'pass',
        label: '我更適合五棒',
        hint: '保護心志，放棄曝光',
        effects: { mind: 4, fame: -3 },
        outcome: '你把清棒讓出去。教練沒有再問第二次。',
        tone: 'normal',
      },
    ],
  },
  {
    id: 'pro-endorsement-overtime',
    title: '代言連拍',
    stages: ['pro'],
    weight: 10,
    minAge: 22,
    condition: (s) => s.meta.fame >= 40,
    prompt: () =>
      '經紀公司塞來三天兩夜的商業拍攝。酬勞很甜，但會吃掉你整段的恢復日。',
    options: () => [
      {
        id: 'take',
        label: '全接，先把錢賺了',
        hint: '大筆收入與人氣；疲勞爆表、體能下滑',
        effects: { earnings: 420, fame: 10, fatigue: 28, body: -5, mind: -3, injuryChance: 0.16 },
        outcome: '燈光、口號、重拍。回球場時腿像灌了鉛。',
        tone: 'great',
      },
      {
        id: 'half',
        label: '只接半天檔期',
        hint: '中等收入，負擔可控',
        effects: { earnings: 160, fame: 4, fatigue: 10 },
        outcome: '你趕在宵禁前回到宿舍。錢少一點，睡眠還在。',
        tone: 'good',
      },
      {
        id: 'refuse',
        label: '拒絕，球季優先',
        hint: '保護身體，經紀人不高興',
        effects: { body: 3, mind: 2, fame: -4 },
        outcome: '經紀人掛了電話。你把冰敷袋綁回肩膀上。',
        tone: 'normal',
      },
    ],
  },
  {
    id: 'pro-illegal-edge',
    title: '灰色地帶',
    stages: ['pro'],
    weight: 8,
    minAge: 24,
    maxAge: 32,
    prompt: () =>
      '一位舊識在餐桌上推來一個「幫助恢復」的瓶子。他說聯盟查不到，也說很多人都在用。',
    options: () => [
      {
        id: 'take',
        label: '……用一個週期',
        hint: '短期能力暴衝；心志重創、曝光則災難',
        effects: {
          velocity: 5,
          power: 5,
          body: 4,
          mind: -12,
          fame: -6,
          fatigue: -8,
          injuryChance: 0.2,
        },
        outcome: '數字好看了兩個月。鏡子裡的人，你不太認得。',
        tone: 'bad',
      },
      {
        id: 'report',
        label: '拒絕並回報球團',
        hint: '人氣與心志上升，少了捷徑，也耗掉一點心力',
        effects: { mind: 6, fame: 5, guts: 3, fatigue: 4 },
        outcome: '球團悄悄處理了。你睡得比預期中好。',
        tone: 'good',
      },
      {
        id: 'walk',
        label: '假裝沒聽見，買單走人',
        hint: '什麼都不變',
        effects: { mind: -1 },
        outcome: '你把帳結了。瓶子留在桌上。',
        tone: 'normal',
      },
    ],
  },
  {
    id: 'pro-trade-request',
    title: '要求交易',
    stages: ['pro'],
    weight: 9,
    minAge: 26,
    condition: (s) => s.counters.proSeasons >= 3 && s.meta.fame >= 45,
    prompt: (s) =>
      `${s.team}這季的方向讓你看不懂。經紀人說可以正式提出交易要求——鬧大了就回不了頭。`,
    options: () => [
      {
        id: 'demand',
        label: '正式提出交易要求',
        hint: '人氣與心志大動；可能換來舞台或被冷凍',
        effects: { fame: 8, mind: -6, guts: 3, fatigue: 4 },
        outcome: '新聞稿出去的那一晚，置物櫃被貼滿便利貼。有人挺你，有人翻臉。',
        tone: 'great',
      },
      {
        id: 'quiet',
        label: '私下請球團評估',
        hint: '溫和施壓，耗一點人情',
        effects: { mind: 2, fame: 2, fatigue: 3 },
        outcome: '總經理說「知道了」。你不確定那是不是一句空話。',
        tone: 'good',
      },
      {
        id: 'stay',
        label: '咬牙留著打',
        hint: '心志受磨，留下忠誠形象',
        effects: { mind: -3, fame: 3, guts: 2 },
        outcome: '你把交易兩個字吞回去。隔天照常提早到場。',
        tone: 'normal',
      },
    ],
  },
  {
    id: 'pro-surgery-choice',
    title: '手術刀口',
    stages: ['pro'],
    weight: 9,
    minAge: 27,
    condition: (s) => s.meta.body <= 55 || s.counters.injuries >= 1,
    prompt: () =>
      '隊醫把影像攤在桌上：現在動刀，休半年但更乾淨；撐著打，今年還能上場，但惡化機率不低。',
    options: () => [
      {
        id: 'cut',
        label: '現在動刀',
        hint: '缺席衝擊大，但體能長期回升',
        effects: { body: 10, mind: -4, fame: -5, fatigue: -20, velocity: -2, speed: -2 },
        outcome: '你在恢復室數天花板的孔。春天會很遠，但肩膀終於安靜了。',
        tone: 'good',
      },
      {
        id: 'push',
        label: '打完這季再算',
        hint: '短期維持戰力，受傷與衰退風險高',
        effects: { guts: 4, fame: 4, body: -6, fatigue: 12, injuryChance: 0.35 },
        outcome: '你打了封閉針。觀眾看不出來，你自己知道每一次揮空有多痛。',
        tone: 'great',
      },
      {
        id: 'manage',
        label: '保守管理，減少出賽',
        hint: '折衷：小幅護體，少一點表現',
        effects: { body: 3, fatigue: -8, fame: -2, mind: 2 },
        outcome: '教練把你移出天天先發。你學會在板凳上咬牙。',
        tone: 'normal',
      },
    ],
  },

  // ---- Two-way exclusive preferential / high-stakes ----
  {
    id: 'tw-specialty-pressure',
    title: '專精一邊？',
    stages: ['highschool', 'amateur', 'pro'],
    weight: 14,
    condition: isTwoWay,
    prompt: () =>
      '教練把你叫進辦公室：球團（或學長）希望你二選一——專精打者或投手。他們說這樣比較「好養」。',
    options: () => [
      {
        id: 'stay-tw',
        label: '我兩邊都要',
        hint: '二刀流信念：心志／膽識上升，疲勞更高',
        effects: { mind: 6, guts: 5, fame: 6, fatigue: 12, destiny: 8 },
        outcome: '你把兩雙釘鞋都留在置物櫃。教練嘆了口氣，沒有再勸。',
        tone: 'great',
      },
      {
        id: 'lean-bat',
        label: '這季先偏打擊',
        hint: '打擊成長，投球手感下滑',
        effects: { contact: 4, power: 3, velocity: -2, breaking: -2, fatigue: 6 },
        outcome: '你減少投球日。打擊手感回來了，丘上的感覺有點陌生。',
        tone: 'good',
      },
      {
        id: 'lean-pitch',
        label: '這季先偏投球',
        hint: '投球成長，打擊感覺變鈍',
        effects: { velocity: 4, control: 3, contact: -2, power: -2, fatigue: 6 },
        outcome: '你把打擊課表砍半。速球又有重量了，球棒卻重了一點。',
        tone: 'good',
      },
    ],
  },
  {
    id: 'tw-doubleheader-dare',
    title: '雙棲同日',
    stages: ['pro'],
    weight: 13,
    condition: (s) => isTwoWay(s) && s.stage === 'pro',
    prompt: () =>
      '連戰缺人。教練問你：同一天先發投一場、再排指定打擊——媒體會瘋，身體也可能垮。',
    options: () => [
      {
        id: 'both',
        label: '同一天兩邊都上',
        hint: '人氣與天命暴衝；疲勞／受傷風險極高',
        effects: {
          fame: 16,
          guts: 6,
          mind: 4,
          destiny: 12,
          fatigue: 30,
          body: -5,
          injuryChance: 0.32,
        },
        outcome: '你投完六局，換打擊手套。社群上的標籤一夜破百萬。',
        tone: 'great',
      },
      {
        id: 'pitch-only',
        label: '只先發投球',
        hint: '中等曝光，保護身體',
        effects: { fame: 5, velocity: 2, fatigue: 10 },
        outcome: '你把力氣留給丘上。打線的位置給了別人。',
        tone: 'good',
      },
      {
        id: 'decline',
        label: '拒絕，正常輪值就好',
        hint: '護體，少了話題',
        effects: { body: 3, fatigue: -6, fame: -2 },
        outcome: '教練改找別人頂。你知道自己錯過一個會被寫進新聞的夜晚。',
        tone: 'normal',
      },
    ],
  },
  {
    id: 'tw-brand-deal',
    title: '二刀流形象合約',
    stages: ['pro'],
    weight: 12,
    minAge: 21,
    condition: (s) => isTwoWay(s) && s.meta.fame >= 30,
    prompt: () =>
      '品牌指定要「投打都能拍」的形象大使。條件比一般野手優渥，但行程會綁死休賽期。',
    options: () => [
      {
        id: 'sign',
        label: '簽約，打二刀流牌',
        hint: '高額代言與人氣；休賽恢復變差',
        effects: { earnings: 520, fame: 12, destiny: 6, fatigue: 18, body: -3, mind: -2 },
        outcome: '海報上你一手球棒、一手手套。銀行帳戶和睡眠時間同時變了。',
        tone: 'great',
      },
      {
        id: 'short',
        label: '只簽球季中短檔',
        hint: '中等收入',
        effects: { earnings: 200, fame: 5, fatigue: 8 },
        outcome: '你把拍攝擠進客場雨天取消的那段空檔。',
        tone: 'good',
      },
      {
        id: 'no',
        label: '不簽，專心練兩側',
        hint: '雙邊小幅成長，沒有現金',
        effects: { contact: 2, control: 2, mind: 3 },
        outcome: '你婉拒了。訓練場比攝影棚安靜得多。',
        tone: 'normal',
      },
    ],
  },
  {
    id: 'tw-national-two-way',
    title: '國家隊雙掛',
    stages: ['pro'],
    weight: 11,
    minAge: 22,
    condition: (s) => isTwoWay(s) && s.meta.fame >= 50,
    prompt: () =>
      '國家隊召集令來了：他们想讓你投一場、打兩場。教練團說這是「台灣二刀流」的招牌戲。',
    options: () => [
      {
        id: 'accept',
        label: '接受雙掛',
        hint: '人氣／膽識／天命大漲，身體代價高',
        effects: {
          fame: 18,
          guts: 5,
          mind: 4,
          destiny: 10,
          fatigue: 22,
          injuryChance: 0.2,
        },
        outcome: '你穿上有國旗的兩套角色。回家時語音信箱爆了。',
        tone: 'great',
      },
      {
        id: 'one-role',
        label: '只答應單一角色',
        hint: '中等榮耀，較安全',
        effects: { fame: 7, mind: 2, fatigue: 8 },
        outcome: '你選了自己比較穩的那一側。教練團有些可惜，但接受了。',
        tone: 'good',
      },
      {
        id: 'decline',
        label: '為了球季拒絕徵召',
        hint: '護體，輿論會吵',
        effects: { body: 4, fame: -8, mind: -4 },
        outcome: '社群罵聲起來了。你把手機調成飛航模式，繼續練投。',
        tone: 'bad',
      },
    ],
  },

  // ---- Challenge-hook-only cards (stable ids; not in the random pool) ----
  // `condition: () => false` keeps free-play RNG from drawing them; challenge
  // fixed-turn hooks force `pendingSituation` directly. Prefer these ids when
  // scripting wave-2 gates so sibling situation-pool PRs stay merge-friendly.
  {
    id: 'chlg-intl-summons',
    title: '國家隊緊急徵召',
    stages: ['pro'],
    weight: 1,
    condition: () => false,
    prompt: () =>
      '協會來電：短期國際賽缺人，希望你立刻報到。這是挑戰關卡裡的必遇節點——答應就能在大場面留下名字，拒絕就只能看轉播。',
    options: () => [
      {
        id: 'accept',
        label: '立刻報到',
        hint: '國際賽高光＋人氣；疲勞與受傷風險上升',
        effects: {
          intlStrong: 1,
          fame: 10,
          guts: 3,
          mind: 2,
          fatigue: 14,
          injuryChance: 0.12,
        },
        outcome: '你穿上有國旗的球衣。鎂光燈比想像中更刺眼，但你把球打進了縫隙。',
        tone: 'great',
      },
      {
        id: 'half',
        label: '只打分組賽',
        hint: '小幅人氣，沒有高光計數',
        effects: { fame: 4, fatigue: 6, mind: 1 },
        outcome: '你打完分組就回俱樂部。新聞只用一行字帶過。',
        tone: 'good',
      },
      {
        id: 'decline',
        label: '為了球季婉拒',
        hint: '護體，錯過這次高光',
        effects: { body: 3, fame: -4, mind: -2 },
        outcome: '你掛了電話。電視上別人戴著你本來可能戴上的號碼。',
        tone: 'normal',
      },
    ],
  },
  {
    id: 'chlg-mlb-dream-call',
    title: '旅美夢的攤牌',
    stages: ['amateur', 'pro'],
    weight: 1,
    condition: () => false,
    prompt: () =>
      '經紀人把一份旅美意向書攤在桌上：沒有保證一軍，但這是挑戰關卡要你正面回答的關口——要不要把名字寫上去？',
    options: () => [
      {
        id: 'commit',
        label: '寫上名字，挑戰旅美',
        hint: '人氣／心志上漲；身體與疲勞代價高',
        effects: { fame: 12, mind: 4, guts: 3, fatigue: 16, body: -3, injuryChance: 0.1 },
        outcome: '你簽了字。回程的捷運上，耳機裡全是大聯盟的轉播聲。',
        tone: 'great',
      },
      {
        id: 'wait',
        label: '先觀察一年',
        hint: '穩健，幾乎沒有回報',
        effects: { mind: 2, fatigue: 4 },
        outcome: '你把合約折好。經紀人說門不會一直開著。',
        tone: 'good',
      },
      {
        id: 'refuse',
        label: '拒絕，留在熟悉的聯盟',
        hint: '護體，放棄這條路的敘事',
        effects: { body: 3, fame: -3, mind: -1 },
        outcome: '你把意向書推回去。旅美兩個字，暫時從行程裡劃掉。',
        tone: 'normal',
      },
    ],
  },
];

export function situationById(id: string): Situation | undefined {
  return SITUATIONS.find((s) => s.id === id);
}

function eligible(state: GameState, situation: Situation): boolean {
  if (!situation.stages.includes(state.stage)) return false;
  if (situation.minAge !== undefined && state.age < situation.minAge) return false;
  if (situation.maxAge !== undefined && state.age > situation.maxAge) return false;
  if (situation.condition && !situation.condition(state)) return false;
  return true;
}

/** Unseen first; if every eligible card was seen, allow repeats. */
export function pickSituation(state: GameState, rng: () => number): Situation | null {
  const pool = SITUATIONS.filter((s) => eligible(state, s));
  if (pool.length === 0) return null;
  const unseen = pool.filter((s) => !state.seenSituations.includes(s.id));
  const use = unseen.length > 0 ? unseen : pool;
  const total = use.reduce((sum, s) => sum + s.weight, 0);
  let ticket = rng() * total;
  for (const situation of use) {
    ticket -= situation.weight;
    if (ticket <= 0) return situation;
  }
  return use[use.length - 1] ?? null;
}

/** Roughly one situation every 4–5 turns that can host one. */
export const SITUATION_FIRE_CHANCE = 0.22;

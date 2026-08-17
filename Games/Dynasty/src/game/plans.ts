import { formatMoney } from './config';
import { ability } from './players';
import { farm, starCount } from './roster';
import { pickWeighted } from './situations';
import type { GameState, SeasonRecord, Team } from './types';

/**
 * What spring training and the post-season budget ask you.
 *
 * These two phases used to be a single fixed menu each — the same four
 * training plans and the same four budget plans, verbatim, in year one and
 * year ten. That is 20 of the tenure's 100 decisions reading like the same
 * screen shown nine times in a row.
 *
 * The fix is the one `situations.ts` already applied to the regular season:
 * draw the specific offer from the club's actual state. A club defending a
 * title, a club that just got relegated in the standings, a club that is
 * broke, a club sitting on a loaded farm system should not read word-for-word
 * the same four lines every year.
 *
 * The economics underneath do not move — training still trades cash for a
 * strength bonus and farm development, and the budget still sets ticket
 * price, marketing and scouting. Only the presentation and the specific
 * numbers on offer vary, and every option still has to cost something,
 * enforced the same way `situations.ts` enforces it.
 */

// ---------------------------------------------------------------------------
// Spring training (春訓)
// ---------------------------------------------------------------------------

export interface TrainingEffects {
  /** Cash spent on the programme, always ≥ 0. */
  cost: number;
  /** Strength bonus applied for the whole coming season. */
  bonus: number;
  /** Multiplier folded into this offseason's farm development. */
  farmBoost: number;
  morale: number;
}

export interface TrainingOption {
  id: string;
  label: string;
  hint: string;
  effects: TrainingEffects;
}

export interface TrainingContext {
  state: GameState;
  team: Team;
  cash: number;
  lastRecord: SeasonRecord | null;
  wonTitle: boolean;
  /** Finished the bottom half of the league last year. */
  sank: boolean;
  broke: boolean;
  starHeavy: boolean;
  farmHeavy: boolean;
  aging: boolean;
  /** Fan heat has gone cold — a quieter lever than a losing streak. */
  coldFans: boolean;
}

export interface TrainingScenario {
  id: string;
  weight: number;
  condition?: (ctx: TrainingContext) => boolean;
  build: (ctx: TrainingContext) => { prompt: string; options: TrainingOption[] };
}

export const TRAINING_SCENARIOS: TrainingScenario[] = [
  {
    // Keyed on the tenure clock rather than on results, so every run trips it
    // twice regardless of how the club is doing. Two of the nine scenarios are
    // unconditional and this one is near-unconditional, which is what keeps a
    // quiet, mid-table decade from seeing the same screen ten times.
    id: 'spring-coaching-turnover',
    weight: 6,
    condition: (ctx) => ctx.state.seasonIndex >= 2,
    build: (ctx) => ({
      prompt: `任期第 ${ctx.state.seasonIndex + 1} 年，教練團有人約滿走了。春訓要重新分工，順便決定錢往哪裡放。`,
      options: [
        {
          id: 'turnover-promote-within',
          label: '內部升任，省下挖角費',
          hint: '不額外編預算。熟悉度高，但沒有新東西進來。',
          effects: { cost: 0, bonus: -1.1, farmBoost: 0.92, morale: -1 },
        },
        {
          id: 'turnover-hire-hitting',
          label: '外聘打擊教練',
          hint: '花 1,400 萬。一軍打線立刻有感，農場沒人顧。',
          effects: { cost: 1400, bonus: 2, farmBoost: 0.9, morale: 0 },
        },
        {
          id: 'turnover-hire-development',
          label: '外聘育成總監',
          hint: '花 1,200 萬。一軍今年沒差，二軍會不一樣。',
          effects: { cost: 1200, bonus: 0.2, farmBoost: 1.4, morale: 0 },
        },
        {
          id: 'turnover-thin-staff',
          label: '不補人，現有教練多兼一職',
          hint: '完全不花錢，代價是所有人都累。',
          effects: { cost: 0, bonus: -1.2, farmBoost: 0.85, morale: -3 },
        },
      ],
    }),
  },
  {
    // Injuries are common enough that most tenures see this, but not every year.
    id: 'spring-medical-review',
    weight: 5,
    condition: (ctx) => ctx.team.players.some((p) => p.injuredSeasons > 0) || ctx.aging,
    build: () => ({
      prompt: '防護員把去年的傷兵清單投影出來，問你今年要不要改變做法。',
      options: [
        {
          id: 'medical-invest',
          label: '擴編醫療與防護團隊',
          hint: '花 1,500 萬。戰力小補，但人比較不會壞。',
          effects: { cost: 1500, bonus: 1, farmBoost: 1.1, morale: 2 },
        },
        {
          id: 'medical-load-management',
          label: '導入輪休管理',
          hint: '花 700 萬。今年戰力略降，換來整季的健康。',
          effects: { cost: 700, bonus: -0.8, farmBoost: 1.08, morale: 1 },
        },
        {
          id: 'medical-push-harder',
          label: '反過來加重訓練量',
          hint: '花 1,300 萬硬練。戰力衝最高，傷兵名單大概會更長。',
          effects: { cost: 1300, bonus: 2.4, farmBoost: 0.85, morale: -3 },
        },
      ],
    }),
  },
  {
    id: 'spring-standard',
    weight: 6,
    build: () => ({
      prompt: '教練團排出了今年的訓練規劃，等你點頭。',
      options: [
        {
          id: 'train-lean',
          label: '節流',
          hint: '不編訓練預算。省下錢，但戰力與士氣都掉。',
          effects: { cost: 0, bonus: -1, farmBoost: 0.9, morale: -2 },
        },
        {
          id: 'train-balanced',
          label: '均衡強化',
          hint: '花 1,200 萬，五個部門平均分配。',
          effects: { cost: 1200, bonus: 1.5, farmBoost: 1, morale: 0 },
        },
        {
          id: 'train-offense',
          label: '打線優先',
          hint: '花 1,600 萬重壓打擊與體能，戰力提升最多。',
          effects: { cost: 1600, bonus: 2.2, farmBoost: 0.95, morale: 1 },
        },
        {
          id: 'train-farm',
          label: '農場優先',
          hint: '花 1,000 萬投到二軍。一軍沒有立即幫助，新秀成長加速。',
          effects: { cost: 1000, bonus: 0, farmBoost: 1.45, morale: 0 },
        },
      ],
    }),
  },
  {
    // A second, differently-worded baseline so a tenure that never trips a
    // special condition (never broke, never ages out, never a stacked farm)
    // still sees more than one screen — unseen-first alternates the two.
    id: 'spring-checkin',
    weight: 5,
    build: () => ({
      prompt: '體能教練與打擊教練各自遞了一份訓練菜單，總教練要你三選一定案。',
      options: [
        {
          id: 'checkin-frugal',
          label: '嚴格控管預算',
          hint: '不編訓練預算，戰力與士氣都會掉。',
          effects: { cost: 0, bonus: -1.2, farmBoost: 0.9, morale: -2 },
        },
        {
          id: 'checkin-conservative',
          label: '保守編列',
          hint: '花 800 萬，穩紮穩打。',
          effects: { cost: 800, bonus: 0.5, farmBoost: 1, morale: 0 },
        },
        {
          id: 'checkin-aggressive',
          label: '積極加碼',
          hint: '花 1,700 萬拚戰力，士氣會有點緊繃。',
          effects: { cost: 1700, bonus: 2, farmBoost: 0.9, morale: -1 },
        },
        {
          id: 'checkin-farm-tilt',
          label: '略偏農場',
          hint: '花 1,100 萬，一軍小補、農場明顯受益。',
          effects: { cost: 1100, bonus: 0.1, farmBoost: 1.15, morale: 0 },
        },
      ],
    }),
  },
  {
    id: 'spring-champion',
    weight: 9,
    condition: (ctx) => ctx.wonTitle,
    build: () => ({
      prompt: '去年拿下總冠軍，休息室瀰漫著「這隊夠好了」的氣氛，但教練團知道每個對手都在研究你們的錄影帶。',
      options: [
        {
          id: 'defend-title',
          label: '原班人馬，加碼衛冕',
          hint: '花 1,800 萬把冠軍陣容再餵飽一次。',
          effects: { cost: 1800, bonus: 2, farmBoost: 0.95, morale: 1 },
        },
        {
          id: 'quiet-offseason',
          label: '低調整補，把錢省下來',
          hint: '不特別加碼，戰力與士氣都會退一點。',
          effects: { cost: 400, bonus: -0.9, farmBoost: 0.96, morale: -2 },
        },
        {
          id: 'title-youth-push',
          label: '趁氣勢提拔新秀',
          hint: '花 900 萬把二軍新秀塞進備戰名單，衝擊冠軍陣容的默契。',
          effects: { cost: 900, bonus: -0.8, farmBoost: 1.3, morale: 0 },
        },
      ],
    }),
  },
  {
    id: 'spring-relegated',
    weight: 9,
    condition: (ctx) => ctx.sank,
    build: (ctx) => ({
      prompt: `去年打到聯盟第 ${ctx.lastRecord?.finish ?? 5} 名，教練團在檢討會上承認打法出了問題，想利用春訓整個翻新。`,
      options: [
        {
          id: 'full-overhaul',
          label: '全面重練基本功',
          hint: '花 1,400 萬打掉重練，戰力先蹲後跳。',
          effects: { cost: 1400, bonus: -1, farmBoost: 1.3, morale: 1 },
        },
        {
          id: 'targeted-fix',
          label: '只補最弱的一環',
          hint: '花 900 萬集中資源救火。',
          effects: { cost: 900, bonus: 1.3, farmBoost: 0.95, morale: 0 },
        },
        {
          id: 'ride-it-out',
          label: '先把預算留住，明年再說',
          hint: '省錢，但戰力與士氣會繼續掉。',
          effects: { cost: 0, bonus: -1.5, farmBoost: 0.9, morale: -2 },
        },
      ],
    }),
  },
  {
    id: 'spring-broke',
    weight: 9,
    condition: (ctx) => ctx.broke,
    build: (ctx) => ({
      prompt: `財務長把帳本攤開，資金只剩 ${formatMoney(ctx.cash)}。教練團的訓練需求清單很長，你大概只能勾一半。`,
      options: [
        {
          id: 'bare-bones',
          label: '只留基本盤',
          hint: '幾乎不花錢，戰力與士氣都會受影響。',
          effects: { cost: 0, bonus: -1.2, farmBoost: 0.85, morale: -2 },
        },
        {
          id: 'lean-and-targeted',
          label: '省著花，抓最要緊的',
          hint: '花 500 萬做最小限度的補強。',
          effects: { cost: 500, bonus: 0.1, farmBoost: 0.98, morale: -1 },
        },
        {
          id: 'bet-on-farm',
          label: '賭在農場，一軍先苦一年',
          hint: '花 400 萬全押二軍，一軍戰力繼續掉。',
          effects: { cost: 400, bonus: -1.4, farmBoost: 1.3, morale: -2 },
        },
      ],
    }),
  },
  {
    id: 'spring-star-heavy',
    weight: 7,
    condition: (ctx) => ctx.starHeavy,
    build: () => ({
      prompt: '陣中已經有好幾名一軍主力，教練團想知道今年要不要把資源全押在拚一軍戰績。',
      options: [
        {
          id: 'win-now',
          label: '全力拚一軍戰力',
          hint: '花 2,000 萬狂堆一軍，農場先放著。',
          effects: { cost: 2000, bonus: 2.6, farmBoost: 0.8, morale: 1 },
        },
        {
          id: 'stars-balanced',
          label: '維持均衡，不獨厚主力',
          hint: '花 1,200 萬平均分配。',
          effects: { cost: 1200, bonus: 1.5, farmBoost: 1, morale: 0 },
        },
        {
          id: 'protect-the-core',
          label: '控制強度，保護主力身體',
          hint: '花 700 萬做保養型訓練，戰力提升有限。',
          effects: { cost: 700, bonus: 0.2, farmBoost: 1, morale: 0 },
        },
      ],
    }),
  },
  {
    id: 'spring-farm-heavy',
    weight: 7,
    condition: (ctx) => ctx.farmHeavy,
    build: () => ({
      prompt: '二軍一口氣冒出好幾個看得下去的新秀，育成教練覺得今年該把資源大幅倒向農場。',
      options: [
        {
          id: 'farm-first',
          label: '資源全押農場',
          hint: '花 1,000 萬，一軍今年沒有立即幫助。',
          effects: { cost: 1000, bonus: -0.3, farmBoost: 1.6, morale: 0 },
        },
        {
          id: 'dual-track',
          label: '一二軍並重',
          hint: '花 1,300 萬兩邊都顧。',
          effects: { cost: 1300, bonus: 1, farmBoost: 1.2, morale: 0 },
        },
        {
          id: 'majors-first',
          label: '先顧一軍，新秀晚點練',
          hint: '花 1,400 萬，一軍立即受益，農場進度放緩。',
          effects: { cost: 1400, bonus: 2, farmBoost: 0.8, morale: -1 },
        },
      ],
    }),
  },
  {
    id: 'spring-aging',
    weight: 7,
    condition: (ctx) => ctx.aging,
    build: () => ({
      prompt: '體能教練遞了一份紅字報告：一軍主力裡有一大群超過 33 歲的老將，再不控管訓練量會出事。',
      options: [
        {
          id: 'load-management',
          label: '嚴格控管強度',
          hint: '花 800 萬做保護性訓練，戰力提升有限但人保住。',
          effects: { cost: 800, bonus: -0.5, farmBoost: 1, morale: 2 },
        },
        {
          id: 'push-through-age',
          label: '照表操課，別鬆懈',
          hint: '花 1,200 萬照常練，賭他們撐得住。',
          effects: { cost: 1200, bonus: 1.8, farmBoost: 0.95, morale: -1 },
        },
        {
          id: 'youth-infusion',
          label: '拉新秀進來分攤負荷',
          hint: '花 900 萬把新秀拉進一軍備戰，分攤老將的出場量。',
          effects: { cost: 900, bonus: 0.4, farmBoost: 1.25, morale: 0 },
        },
      ],
    }),
  },
  {
    id: 'spring-cold-fans',
    weight: 7,
    condition: (ctx) => ctx.coldFans,
    build: () => ({
      prompt: '主場熱度一路探底，行銷部希望春訓能練出一點看得見的話題，而不只是勝場數。',
      options: [
        {
          id: 'showcase-camp',
          label: '辦公開觀摩',
          hint: '花 600 萬開放球迷看訓練，戰力提升有限但熱度回升。',
          effects: { cost: 600, bonus: 0.1, farmBoost: 0.98, morale: 0 },
        },
        {
          id: 'results-first',
          label: '別管話題，先把戰力練出來',
          hint: '花 1,500 萬全力衝戰力，冷板凳的看台先不管。',
          effects: { cost: 1500, bonus: 2, farmBoost: 0.9, morale: -1 },
        },
        {
          id: 'skip-the-noise',
          label: '不理會外界，照表操課',
          hint: '花 1,000 萬，平常心練球。',
          effects: { cost: 1000, bonus: 1, farmBoost: 1.05, morale: 0 },
        },
      ],
    }),
  },
  {
    // A third, differently-worded baseline — see `spring-checkin` for why one
    // was not enough.
    id: 'spring-preseason',
    weight: 5,
    build: () => ({
      prompt: '春訓基地開幕，記者堵在門口問你今年打算怎麼練兵。',
      options: [
        {
          id: 'preseason-basics',
          label: '先把基本功練回來',
          hint: '花 700 萬，穩健但不亮眼。',
          effects: { cost: 700, bonus: 0.2, farmBoost: 1.02, morale: 0 },
        },
        {
          id: 'preseason-showcase',
          label: '安排熱身賽密集對抗',
          hint: '花 1,500 萬打滿熱身賽，戰力提升明顯但容易受傷。',
          effects: { cost: 1500, bonus: 1.8, farmBoost: 0.9, morale: -1 },
        },
        {
          id: 'preseason-quiet',
          label: '低調閉門練習',
          hint: '不對外開放，省下場地與宣傳費用，士氣普通。',
          effects: { cost: 200, bonus: -1, farmBoost: 0.94, morale: -1 },
        },
      ],
    }),
  },
];

/**
 * Farm players good enough that a scout would call the system "loaded" — the
 * bar sits above the league baseline (52), not merely above replacement.
 */
function decentProspectCount(team: Team): number {
  return farm(team).filter((p) => ability(p) >= 40).length;
}

/**
 * Major-league regulars old enough that a workload conversation is overdue.
 * The initial roster spread (22–36) already puts a handful of players past
 * 33 in year one, so the bar has to sit well above that starting noise or
 * "aging" would fire every single year and stop meaning anything.
 */
function agingCoreCount(team: Team): number {
  return team.players.filter((p) => p.level === 'major' && p.age >= 33).length;
}

export function buildTrainingContext(state: GameState, team: Team): TrainingContext {
  const lastRecord = state.history.length > 0 ? state.history[state.history.length - 1] : null;
  return {
    state,
    team,
    cash: state.finance.cash,
    lastRecord,
    wonTitle: lastRecord?.playoffResult === '總冠軍',
    sank: lastRecord ? lastRecord.finish >= 4 : false,
    broke: state.finance.cash < 1500,
    starHeavy: starCount(team) >= 3,
    farmHeavy: decentProspectCount(team) >= 3,
    aging: agingCoreCount(team) >= 9,
    coldFans: state.heat < 40,
  };
}

export function pickTrainingScenario(
  ctx: TrainingContext,
  seen: string[],
  rng: () => number,
): TrainingScenario {
  return pickWeighted(TRAINING_SCENARIOS, ctx, seen, rng);
}

export function trainingScenarioById(id: string): TrainingScenario | undefined {
  return TRAINING_SCENARIOS.find((s) => s.id === id);
}

// ---------------------------------------------------------------------------
// Post-season budget (季後預算)
// ---------------------------------------------------------------------------

export interface BudgetEffects {
  ticketPrice: number;
  /** Cash committed to marketing next season, always > 0. */
  marketing: number;
  /** Cash committed to scouting next season, always > 0. */
  scouting: number;
}

export interface BudgetOption {
  id: string;
  label: string;
  hint: string;
  effects: BudgetEffects;
}

export interface BudgetContext {
  state: GameState;
  team: Team;
  cash: number;
  heat: number;
  wonTitle: boolean;
  /** Finished the bottom half of the league this year. */
  sank: boolean;
  broke: boolean;
  boomingFans: boolean;
  rebuildMandate: boolean;
  contending: boolean;
  /** Board trust has dropped into the danger band. */
  trustLow: boolean;
}

export interface BudgetScenario {
  id: string;
  weight: number;
  condition?: (ctx: BudgetContext) => boolean;
  build: (ctx: BudgetContext) => { prompt: string; options: BudgetOption[] };
}

export const BUDGET_SCENARIOS: BudgetScenario[] = [
  {
    // Near-unconditional, keyed on the tenure clock: the broadcast cycle comes
    // round for everyone, so a quiet decade still sees more than one budget
    // screen.
    id: 'budget-broadcast-cycle',
    weight: 6,
    condition: (ctx) => ctx.state.seasonIndex >= 2,
    build: (ctx) => ({
      prompt: `轉播合約要重談，對方想知道你明年打算把球團經營成什麼樣子。目前熱度 ${ctx.heat}、資金 ${formatMoney(ctx.cash)}。`,
      options: [
        {
          id: 'cycle-volume',
          label: '衝人數，賣氣氛',
          hint: '票價 260 元、行銷 1,000 萬、球探 300 萬。滿場好談轉播，選秀就別想看清楚。',
          effects: { ticketPrice: 260, marketing: 1000, scouting: 300 },
        },
        {
          id: 'cycle-balanced',
          label: '兩邊都顧',
          hint: '票價 360 元、行銷 700 萬、球探 600 萬。',
          effects: { ticketPrice: 360, marketing: 700, scouting: 600 },
        },
        {
          id: 'cycle-premium',
          label: '走高單價，賣品牌',
          hint: '票價 520 元、行銷 900 萬、球探 400 萬。客人少但每個都貴。',
          effects: { ticketPrice: 520, marketing: 900, scouting: 400 },
        },
        {
          id: 'cycle-scouting',
          label: '把錢壓在看人上',
          hint: '票價 340 元、行銷 300 萬、球探 1,100 萬。轉播談不到好價，但選秀看得最清楚。',
          effects: { ticketPrice: 300, marketing: 300, scouting: 1100 },
        },
      ],
    }),
  },
  {
    // A second unconditional baseline, differently framed, so unseen-first has
    // something to alternate with when no special condition applies.
    id: 'budget-annual-plan',
    weight: 5,
    build: (ctx) => ({
      prompt: `年度營運計畫要送董事會核定。目前熱度 ${ctx.heat}。`,
      options: [
        {
          id: 'annual-family',
          label: '家庭客路線',
          hint: '票價 280 元、行銷 900 萬、球探 300 萬。',
          effects: { ticketPrice: 280, marketing: 900, scouting: 300 },
        },
        {
          id: 'annual-steady',
          label: '穩健維持',
          hint: '票價 380 元、行銷 600 萬、球探 600 萬。',
          effects: { ticketPrice: 380, marketing: 600, scouting: 600 },
        },
        {
          id: 'annual-lean',
          label: '全面撙節',
          hint: '票價 420 元、行銷 200 萬、球探 250 萬。省最多，什麼都不會變好。',
          effects: { ticketPrice: 260, marketing: 200, scouting: 250 },
        },
      ],
    }),
  },
  {
    id: 'budget-standard',
    weight: 6,
    build: (ctx) => ({
      prompt: `為下個球季設定票價、行銷與球探。目前熱度 ${ctx.heat}、資金 ${formatMoney(ctx.cash)}。`,
      options: [
        {
          id: 'budget-cheap',
          label: '親民票價',
          hint: '票價 250 元、行銷 400 萬、球探 200 萬。看台會滿，收入單價低。',
          effects: { ticketPrice: 250, marketing: 400, scouting: 200 },
        },
        {
          id: 'budget-standard',
          label: '標準營運',
          hint: '票價 350 元、行銷 800 萬、球探 500 萬。',
          effects: { ticketPrice: 350, marketing: 800, scouting: 500 },
        },
        {
          id: 'budget-premium',
          label: '高單價路線',
          hint: '票價 500 元、行銷 1,200 萬、球探 500 萬。單價高但趕客。',
          effects: { ticketPrice: 500, marketing: 1200, scouting: 500 },
        },
        {
          id: 'budget-scout',
          label: '押注球探',
          hint: '票價 350 元、行銷 400 萬、球探 1,000 萬。選秀看得最清楚。',
          effects: { ticketPrice: 350, marketing: 400, scouting: 1000 },
        },
      ],
    }),
  },
  {
    // A second, differently-worded baseline for the same reason spring has
    // one: a season that trips no special condition still deserves more than
    // one repeated screen across a decade.
    id: 'budget-annual-review',
    weight: 5,
    build: () => ({
      prompt: '球團年度會議上，財務、行銷與球探三個部門各自提了一份數字，要你拍板。',
      options: [
        {
          id: 'review-balanced',
          label: '維持均衡配置',
          hint: '票價 350 元、行銷 700 萬、球探 600 萬。',
          effects: { ticketPrice: 350, marketing: 700, scouting: 600 },
        },
        {
          id: 'review-fan-first',
          label: '優先討好球迷',
          hint: '票價 280 元、行銷 1,000 萬、球探 400 萬。',
          effects: { ticketPrice: 280, marketing: 1000, scouting: 400 },
        },
        {
          id: 'review-scout-first',
          label: '優先加碼球探',
          hint: '票價 380 元、行銷 500 萬、球探 900 萬。',
          effects: { ticketPrice: 380, marketing: 500, scouting: 900 },
        },
      ],
    }),
  },
  {
    id: 'budget-champion',
    weight: 9,
    condition: (ctx) => ctx.wonTitle,
    build: () => ({
      prompt: '剛拿下總冠軍，票務部說冠軍紅利就這一年最好用，董事會也想趁勢加碼行銷。',
      options: [
        {
          id: 'cash-in-hype',
          label: '拉高票價，吃冠軍紅利',
          hint: '票價 550 元、行銷 1,600 萬、球探 500 萬。',
          effects: { ticketPrice: 550, marketing: 1600, scouting: 500 },
        },
        {
          id: 'keep-fans-close',
          label: '票價不動，把行銷加倍',
          hint: '票價 350 元、行銷 1,600 萬、球探 500 萬。',
          effects: { ticketPrice: 350, marketing: 1600, scouting: 500 },
        },
        {
          id: 'quiet-reinvest',
          label: '悄悄把錢投回球探',
          hint: '票價 350 元、行銷 600 萬、球探 1,200 萬。',
          effects: { ticketPrice: 350, marketing: 600, scouting: 1200 },
        },
      ],
    }),
  },
  {
    id: 'budget-relegated',
    weight: 9,
    condition: (ctx) => ctx.sank,
    build: () => ({
      prompt: '球季難看地結束，看台上的抱怨聲比進球數還多。票務部要你先決定接下來怎麼定價。',
      options: [
        {
          id: 'win-back-fans',
          label: '降價挽回球迷',
          hint: '票價 250 元、行銷 1,000 萬、球探 300 萬。',
          effects: { ticketPrice: 250, marketing: 1000, scouting: 300 },
        },
        {
          id: 'rebuild-via-scouting',
          label: '票房放一邊，重押選秀',
          hint: '票價 300 元、行銷 300 萬、球探 1,200 萬。',
          effects: { ticketPrice: 280, marketing: 300, scouting: 1200 },
        },
        {
          id: 'hold-the-line',
          label: '維持現行價位，觀望',
          hint: '票價 350 元、行銷 500 萬、球探 400 萬。',
          effects: { ticketPrice: 350, marketing: 500, scouting: 400 },
        },
      ],
    }),
  },
  {
    id: 'budget-broke',
    weight: 9,
    condition: (ctx) => ctx.broke,
    build: () => ({
      prompt: '財務長說資金已經見底，行銷與球探預算今年只能挑一個大花。',
      options: [
        {
          id: 'raise-price-now',
          label: '調高票價救現金流',
          hint: '票價 480 元、行銷 300 萬、球探 200 萬。',
          effects: { ticketPrice: 480, marketing: 1000, scouting: 200 },
        },
        {
          id: 'cut-to-bone',
          label: '兩邊都省',
          hint: '票價 350 元、行銷 300 萬、球探 200 萬。',
          effects: { ticketPrice: 290, marketing: 300, scouting: 200 },
        },
        {
          id: 'protect-scouting',
          label: '保住球探，行銷全砍',
          hint: '票價 350 元、行銷 200 萬、球探 700 萬。',
          effects: { ticketPrice: 300, marketing: 200, scouting: 700 },
        },
      ],
    }),
  },
  {
    id: 'budget-booming',
    weight: 7,
    condition: (ctx) => ctx.boomingFans,
    build: () => ({
      prompt: '球隊人氣正旺，週邊與票務都在問要不要趁機拉高票價。',
      options: [
        {
          id: 'ride-the-wave',
          label: '拉高票價，趁熱操作',
          hint: '票價 500 元、行銷 900 萬、球探 500 萬。',
          effects: { ticketPrice: 500, marketing: 900, scouting: 500 },
        },
        {
          id: 'keep-it-affordable',
          label: '票價不動，衝票房人數',
          hint: '票價 300 元、行銷 900 萬、球探 500 萬。',
          effects: { ticketPrice: 300, marketing: 900, scouting: 500 },
        },
        {
          id: 'bank-the-future',
          label: '把熱度換成球探預算',
          hint: '票價 400 元、行銷 500 萬、球探 1,000 萬。',
          effects: { ticketPrice: 330, marketing: 500, scouting: 1000 },
        },
      ],
    }),
  },
  {
    id: 'budget-rebuild',
    weight: 7,
    condition: (ctx) => ctx.rebuildMandate,
    build: () => ({
      prompt: '董事會已經同意重建，球探部說這正是加碼選秀情報的時候。',
      options: [
        {
          id: 'scout-heavy',
          label: '全力加碼球探',
          hint: '票價 300 元、行銷 300 萬、球探 1,200 萬。',
          effects: { ticketPrice: 280, marketing: 300, scouting: 1200 },
        },
        {
          id: 'stay-lean',
          label: '維持精簡營運',
          hint: '票價 300 元、行銷 400 萬、球探 500 萬。',
          effects: { ticketPrice: 300, marketing: 400, scouting: 500 },
        },
        {
          id: 'sell-the-future',
          label: '行銷主打新秀故事',
          hint: '票價 300 元、行銷 900 萬、球探 500 萬。',
          effects: { ticketPrice: 300, marketing: 900, scouting: 500 },
        },
      ],
    }),
  },
  {
    id: 'budget-contending',
    weight: 7,
    condition: (ctx) => ctx.contending,
    build: () => ({
      prompt: '董事會對今年的期望是拚戰績，球探部與行銷部都想多要一點預算。',
      options: [
        {
          id: 'win-now-budget',
          label: '全押今年，行銷球探雙加碼',
          hint: '票價 450 元、行銷 1,200 萬、球探 800 萬。',
          effects: { ticketPrice: 450, marketing: 1200, scouting: 800 },
        },
        {
          id: 'balanced-contender',
          label: '穩健加碼',
          hint: '票價 400 元、行銷 900 萬、球探 600 萬。',
          effects: { ticketPrice: 400, marketing: 900, scouting: 600 },
        },
        {
          id: 'fans-first',
          label: '把行銷讓給球迷福利',
          hint: '票價 300 元、行銷 1,000 萬、球探 400 萬。',
          effects: { ticketPrice: 300, marketing: 1000, scouting: 400 },
        },
      ],
    }),
  },
  {
    id: 'budget-trust-low',
    weight: 7,
    condition: (ctx) => ctx.trustLow,
    build: () => ({
      prompt: '董事會的信任已經亮黃燈，財務長建議這次的預算要編出「看得見的誠意」，而不是再省一次。',
      options: [
        {
          id: 'goodwill-spend',
          label: '大方編列，show 誠意',
          hint: '票價 300 元、行銷 1,200 萬、球探 700 萬。',
          effects: { ticketPrice: 300, marketing: 1200, scouting: 700 },
        },
        {
          id: 'quiet-discipline',
          label: '低調守紀律，先把帳做漂亮',
          hint: '票價 400 元、行銷 400 萬、球探 400 萬。',
          effects: { ticketPrice: 330, marketing: 400, scouting: 400 },
        },
        {
          id: 'scout-to-prove-it',
          label: '拿選秀成果當籌碼',
          hint: '票價 350 元、行銷 500 萬、球探 1,100 萬。',
          effects: { ticketPrice: 350, marketing: 500, scouting: 1100 },
        },
      ],
    }),
  },
  {
    // A third, differently-worded baseline — same reasoning as
    // `budget-annual-review`: two was still not always enough headroom for a
    // season that trips none of the special conditions.
    id: 'budget-market-check',
    weight: 5,
    build: () => ({
      prompt: '票務公司送來明年的市場調查，行銷部與球探部各自想從裡面多要一點預算。',
      options: [
        {
          id: 'market-value-price',
          label: '照市調結果訂價',
          hint: '票價 320 元、行銷 800 萬、球探 500 萬。',
          effects: { ticketPrice: 320, marketing: 800, scouting: 500 },
        },
        {
          id: 'market-push-marketing',
          label: '行銷部多要一點',
          hint: '票價 350 元、行銷 1,100 萬、球探 300 萬。',
          effects: { ticketPrice: 350, marketing: 1100, scouting: 300 },
        },
        {
          id: 'market-push-scouting',
          label: '球探部多要一點',
          hint: '票價 350 元、行銷 400 萬、球探 800 萬。',
          effects: { ticketPrice: 350, marketing: 400, scouting: 800 },
        },
      ],
    }),
  },
];

export function buildBudgetContext(state: GameState, team: Team): BudgetContext {
  const lastRecord = state.history.length > 0 ? state.history[state.history.length - 1] : null;
  return {
    state,
    team,
    cash: state.finance.cash,
    heat: state.heat,
    wonTitle: lastRecord?.playoffResult === '總冠軍',
    sank: lastRecord ? lastRecord.finish >= 4 : false,
    broke: state.finance.cash < 1500,
    boomingFans: state.heat > 65,
    rebuildMandate: state.board.expectation === 'rebuild',
    contending: state.board.expectation === 'title' || state.board.expectation === 'playoffs',
    trustLow: state.board.trust < 40,
  };
}

export function pickBudgetScenario(
  ctx: BudgetContext,
  seen: string[],
  rng: () => number,
): BudgetScenario {
  return pickWeighted(BUDGET_SCENARIOS, ctx, seen, rng);
}

export function budgetScenarioById(id: string): BudgetScenario | undefined {
  return BUDGET_SCENARIOS.find((s) => s.id === id);
}

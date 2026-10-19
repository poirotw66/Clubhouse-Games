import type { AttrKey, GameState, Position, Stage } from './types';
import { IS_PITCHER, IS_TWO_WAY } from './config';

/**
 * Special-ability encyclopedia (M4).
 *
 * M1 shipped five high-school stubs; this pack expands to a collectible book
 * with unlock conditions, positive match bonuses, and a few negative / flavour
 * abilities. Ids stay stable so saves and encyclopedia progress keep working.
 */
export interface Ability {
  id: string;
  label: string;
  desc: string;
  /** Which roles can unlock this ability. */
  roles: 'batter' | 'pitcher' | 'any';
  /**
   * Stages where the ability may unlock. Omit = high school only (M1 default).
   * Pro / amateur unlocks feed the encyclopedia without flooding the HS window.
   */
  stages?: Stage[];
  /** Flavour / downside abilities — still collectible, mixed effects. */
  negative?: boolean;
  /** Short hint shown locked in the encyclopedia. */
  unlockHint: string;
  /** True when the ability should unlock for this state (caller filters stage/role). */
  check: (state: GameState) => boolean;
}

export interface AbilityEffects {
  /** Multiplier applied to gains on matching focus keys. */
  focusBonus: Partial<Record<AttrKey, number>>;
  /** Multiplier on tournament / high-risk injury chance (<1 = safer). */
  injury: number;
  /** Extra motivation recovered when resting. */
  restMotivation: number;
  /** Flat motivation drip each training resolve (can be negative). */
  motivationDrift: number;
  /** Clutch success bias for encyclopedia abilities (added in clutch.ts). */
  clutchBias: number;
}

export const ABILITIES: Ability[] = [
  // --- M1 stubs (ids frozen) ---
  {
    id: 'keen-eye',
    label: '機會眼',
    desc: '選球與讀投練出火候。選球成長略快，大賽更吃得開壞球。',
    roles: 'batter',
    unlockHint: '高中：影片＋揮棒累積，或選球夠高',
    check: (s) =>
      (s.drillCounts.video ?? 0) + (s.drillCounts.swing ?? 0) >= 5 || s.attrs.eye >= 50,
  },
  {
    id: 'basepath',
    label: '盜壘起動',
    desc: '第一步比誰都快。跑壘成長略快，體能課的疲勞比較扛得住。',
    roles: 'batter',
    unlockHint: '高中：跑壘課累積，或跑壘夠高',
    check: (s) => (s.drillCounts.run ?? 0) >= 4 || s.attrs.speed >= 52,
  },
  {
    id: 'range',
    label: '守備範圍',
    desc: '預判落點的腳步。守備成長略快，受傷機率略降。',
    roles: 'batter',
    unlockHint: '高中：守備課累積，或守備夠高',
    check: (s) => (s.drillCounts.field ?? 0) >= 4 || s.attrs.fielding >= 50,
  },
  {
    id: 'pull',
    label: '強打拉打',
    desc: '重量室換來的揮擊軸心。長打成長略快。',
    roles: 'batter',
    unlockHint: '高中：重量訓練累積，或長打夠高',
    check: (s) => (s.drillCounts.weight ?? 0) >= 4 || s.attrs.power >= 50,
  },
  {
    id: 'heavy-ball',
    label: '球質沉重',
    desc: '長傳與牛棚堆出來的球威。球速成長略快。',
    roles: 'pitcher',
    unlockHint: '高中：長傳＋牛棚累積，或球速夠高',
    check: (s) =>
      (s.drillCounts.longtoss ?? 0) + (s.drillCounts.bullpen ?? 0) >= 5 ||
      s.attrs.velocity >= 52,
  },

  // --- Expanded positive (HS) ---
  {
    id: 'contact-artist',
    label: '巧打職人',
    desc: '球棒像尺一樣短。打擊成長略快，短打／確實擊球更穩。',
    roles: 'batter',
    unlockHint: '高中：揮棒課多、長打課少',
    check: (s) =>
      (s.drillCounts.swing ?? 0) >= 6 && (s.drillCounts.weight ?? 0) <= 2 && s.attrs.contact >= 48,
  },
  {
    id: 'wall-climber',
    label: '牆邊捕手',
    desc: '背對牆也能讀出落點。撲接局面成功率上升。',
    roles: 'batter',
    unlockHint: '高中：守備課＋跑壘課都有練',
    check: (s) => (s.drillCounts.field ?? 0) >= 3 && (s.drillCounts.run ?? 0) >= 2,
  },
  {
    id: 'film-room',
    label: '影片室常客',
    desc: '對手習性寫在筆記本上。心志課與影片課成長更好。',
    roles: 'any',
    unlockHint: '高中：影片／心志課累積',
    check: (s) => (s.drillCounts.video ?? 0) + (s.drillCounts.mental ?? 0) >= 5,
  },
  {
    id: 'precision',
    label: '邊角工匠',
    desc: '控球像用尺量的。控球成長略快，配球局面更穩。',
    roles: 'pitcher',
    unlockHint: '高中：牛棚課累積，或控球夠高',
    check: (s) => (s.drillCounts.bullpen ?? 0) >= 5 || s.attrs.control >= 52,
  },
  {
    id: 'iron-shoulder',
    label: '鐵肩',
    desc: '續航力堆出來的肩膀。受傷機率下降，長投成長略快。',
    roles: 'pitcher',
    unlockHint: '高中：續航課累積且少休息',
    check: (s) => (s.drillCounts.stamina ?? 0) >= 4 && (s.drillCounts.rest ?? 0) <= 3,
  },
  {
    id: 'breaking-artist',
    label: '變化球魔術師',
    desc: '握法越練越歪。變化球成長略快。',
    roles: 'pitcher',
    unlockHint: '高中：球種精進課，或變化球夠高',
    check: (s) => {
      const pitchDrills = Object.entries(s.drillCounts)
        .filter(([id]) => id.startsWith('pitch-') || id === 'learn')
        .reduce((n, [, v]) => n + v, 0);
      return pitchDrills >= 4 || s.attrs.breaking >= 50;
    },
  },
  {
    id: 'clubhouse-glue',
    label: '休息室黏著劑',
    desc: '隊友找得到你。隊伍默契高時動機更穩。',
    roles: 'any',
    unlockHint: '高中：隊友默契拉高',
    check: (s) => {
      if (!s.teammates?.length) return false;
      const avg = s.teammates.reduce((a, t) => a + t.bond, 0) / s.teammates.length;
      return avg >= 55;
    },
  },
  {
    id: 'rival-fuel',
    label: '宿敵燃料',
    desc: '名字被寫在一起就睡不著。對決局面膽識上升。',
    roles: 'any',
    unlockHint: '高中：與宿敵對決或對抗心升高',
    check: (s) => (s.rival?.meetings ?? 0) >= 2 || (s.rival?.rivalry ?? 0) >= 55,
  },

  // --- Pro / amateur unlocks ---
  {
    id: 'clutch-gene',
    label: '決勝基因',
    desc: '大場面心跳反而穩。關鍵局面成功率上升。',
    roles: 'any',
    stages: ['amateur', 'pro'],
    unlockHint: '業餘／職業：累積關鍵時刻亮點',
    check: (s) => s.clutchHighlights.filter((h) => h.tone === 'great' || h.tone === 'good').length >= 4,
  },
  {
    id: 'veteran-presence',
    label: '老將氣息',
    desc: '菜鳥看著你練。心志成長略快，休息回動機更多。',
    roles: 'any',
    stages: ['pro'],
    unlockHint: '職業：年齡與人氣到位',
    check: (s) => s.age >= 30 && s.meta.fame >= 55,
  },
  {
    id: 'spring-bloom',
    label: '春訓開竅',
    desc: '春天的課表特別吃得下。職業春訓成長略厚。',
    roles: 'any',
    stages: ['pro'],
    unlockHint: '職業：春訓回合多、動機高',
    check: (s) =>
      s.stage === 'pro' && s.proTurn === 0 && s.meta.motivation >= 70 && s.counters.proSeasons >= 2,
  },
  {
    id: 'intl-nerve',
    label: '國際賽神經',
    desc: '國旗在胸前時手不抖。國際賽相關動機不易掉。',
    roles: 'any',
    stages: ['amateur', 'pro'],
    unlockHint: '業餘／職業：國際賽出場',
    check: (s) => s.counters.intlAppearances >= 2,
  },

  // --- Negative / flavour ---
  {
    id: 'glass-ankle',
    label: '玻璃腳踝',
    desc: '一點小撞就腫。受傷機率上升——但也逼你更懂保養。',
    roles: 'any',
    negative: true,
    unlockHint: '高中：受傷次數累積',
    check: (s) => s.counters.injuries >= 2,
  },
  {
    id: 'hot-head',
    label: '爆脾氣',
    desc: '贏了飛天、輸了摔棒。動機起伏大，膽識成長略快。',
    roles: 'any',
    negative: true,
    unlockHint: '高中：動機長期偏極高或極低',
    check: (s) => s.meta.motivation >= 85 || s.meta.motivation <= 25,
  },
  {
    id: 'media-shy',
    label: '鏡頭過敏',
    desc: '採訪比速球可怕。人氣成長慢，但心志不易被雜音打擾。',
    roles: 'any',
    negative: true,
    unlockHint: '高中：人氣低且心志高',
    check: (s) => s.meta.fame <= 18 && s.meta.mind >= 55 && s.turnIndex >= 6,
  },
  {
    id: 'showboat',
    label: '表演慾',
    desc: '觀眾越多揮得越大。人氣好時長打／球速有感，安靜時會躁。',
    roles: 'any',
    negative: true,
    unlockHint: '高中：人氣衝高',
    check: (s) => s.meta.fame >= 60,
  },
  {
    id: 'stubborn',
    label: '一根筋',
    desc: '教練說東你偏練西。教練好感慢，但主修屬性成長略厚。',
    roles: 'any',
    negative: true,
    unlockHint: '高中：教練好感偏低卻仍在練',
    check: (s) => (s.coach?.bond ?? 50) <= 35 && s.turnIndex >= 8,
  },
];

function roleAllows(ability: Ability, position: Position): boolean {
  if (ability.roles === 'any') return true;
  if (IS_TWO_WAY[position]) return true;
  if (ability.roles === 'pitcher') return IS_PITCHER[position];
  return !IS_PITCHER[position];
}

function stageAllows(ability: Ability, stage: Stage): boolean {
  const stages = ability.stages ?? ['highschool'];
  return stages.includes(stage);
}

export function abilityById(id: string): Ability | undefined {
  return ABILITIES.find((a) => a.id === id);
}

export function abilityEffects(abilityIds: string[]): AbilityEffects {
  const has = (id: string) => abilityIds.includes(id);
  const focusBonus: Partial<Record<AttrKey, number>> = {};
  if (has('keen-eye')) focusBonus.eye = 1.14;
  if (has('basepath')) focusBonus.speed = 1.12;
  if (has('range')) focusBonus.fielding = 1.12;
  if (has('pull')) focusBonus.power = 1.14;
  if (has('heavy-ball')) focusBonus.velocity = 1.14;
  if (has('contact-artist')) focusBonus.contact = 1.12;
  if (has('precision')) focusBonus.control = 1.12;
  if (has('iron-shoulder')) focusBonus.stamina = 1.1;
  if (has('breaking-artist')) focusBonus.breaking = 1.12;
  if (has('film-room')) {
    focusBonus.eye = Math.max(focusBonus.eye ?? 1, 1.08);
    focusBonus.guts = 1.08;
  }
  if (has('veteran-presence')) focusBonus.guts = Math.max(focusBonus.guts ?? 1, 1.1);
  if (has('hot-head')) focusBonus.guts = Math.max(focusBonus.guts ?? 1, 1.08);
  if (has('stubborn')) {
    // Mild across-the-board training stubbornness.
    (['contact', 'power', 'velocity', 'control'] as AttrKey[]).forEach((key) => {
      focusBonus[key] = Math.max(focusBonus[key] ?? 1, 1.06);
    });
  }
  if (has('showboat')) {
    focusBonus.power = Math.max(focusBonus.power ?? 1, 1.06);
    focusBonus.velocity = Math.max(focusBonus.velocity ?? 1, 1.06);
  }

  let injury = 1;
  if (has('range') || has('iron-shoulder')) injury *= 0.9;
  if (has('glass-ankle')) injury *= 1.25;

  let restMotivation = 0;
  if (has('basepath')) restMotivation += 2;
  if (has('veteran-presence')) restMotivation += 2;
  if (has('clubhouse-glue')) restMotivation += 1;

  let motivationDrift = 0;
  if (has('hot-head')) motivationDrift -= 1;
  if (has('media-shy')) motivationDrift += 0;
  if (has('clubhouse-glue')) motivationDrift += 1;
  if (has('intl-nerve')) motivationDrift += 1;

  let clutchBias = 0;
  if (has('clutch-gene')) clutchBias += 0.08;
  if (has('rival-fuel')) clutchBias += 0.05;
  if (has('wall-climber')) clutchBias += 0.03;
  if (has('hot-head')) clutchBias -= 0.02;

  return { focusBonus, injury, restMotivation, motivationDrift, clutchBias };
}

/** Clutch approach bias from encyclopedia abilities (used by clutch.ts). */
export function abilityApproachBias(abilities: string[], approach: string): number {
  const has = (id: string) => abilities.includes(id);
  let bonus = 0;
  if (has('keen-eye') && (approach === 'patient' || approach === 'sit-breaking' || approach === 'sit-fastball'))
    bonus += 0.1;
  if (has('basepath') && (approach === 'steal' || approach === 'hitrun')) bonus += 0.12;
  if (has('pull') && (approach === 'power' || approach === 'sit-fastball')) bonus += 0.1;
  if (has('heavy-ball') && (approach === 'challenge' || approach === 'paint')) bonus += 0.1;
  if (has('range') && approach === 'defend') bonus += 0.14;
  if (has('contact-artist') && (approach === 'contact' || approach === 'bunt')) bonus += 0.1;
  if (has('wall-climber') && approach === 'defend') bonus += 0.1;
  if (has('precision') && (approach === 'paint' || approach === 'waste')) bonus += 0.1;
  if (has('breaking-artist') && approach === 'paint') bonus += 0.08;
  return bonus;
}

/**
 * Newly earned abilities for the current stage. HS still carries most of the
 * book; a few entries unlock later so the encyclopedia keeps filling in pro.
 */
export function newlyUnlockedAbilities(state: GameState): string[] {
  if (state.stage === 'over') return [];
  return ABILITIES.filter(
    (ability) =>
      !state.abilities.includes(ability.id) &&
      roleAllows(ability, state.position) &&
      stageAllows(ability, state.stage) &&
      ability.check(state),
  ).map((ability) => ability.id);
}

/** Spring-training growth nudge from spring-bloom (applied in engine turn scale). */
export function springTrainingMul(abilityIds: string[]): number {
  return abilityIds.includes('spring-bloom') ? 1.12 : 1;
}

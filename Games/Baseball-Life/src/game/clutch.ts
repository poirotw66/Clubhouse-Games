/**
 * M2 — key in-match moments. Seasons and high-school tournaments pause for
 * one or two high-leverage decisions before the auto-sim finishes, so training
 * and special abilities can be felt on the field rather than only on a report.
 */
import { IS_PITCHER, IS_TWO_WAY, LEAGUES, overall } from './config';
import { rivalPresentForMatch, rivalizeClutchCopy } from './people';
import { streamRng } from './rng';
import { traitEffects } from './traits';
import type {
  AttrKey,
  ClutchHighlight,
  ClutchMoment,
  ClutchOption,
  ClutchSeasonMods,
  GameState,
  LogEntry,
  Meta,
  Option,
  Position,
} from './types';

export const EMPTY_CLUTCH_MODS: ClutchSeasonMods = {
  clutchMul: 1,
  qualityDelta: 0,
  batHitBonus: 0,
  batHrBonus: 0,
  batSbBonus: 0,
  pitchSoBonus: 0,
  pitchEraDelta: 0,
  pitchWinBonus: 0,
  tournamentScoreDelta: 0,
};

export type ClutchApproach =
  | 'sit-fastball'
  | 'sit-breaking'
  | 'patient'
  | 'aggressive'
  | 'power'
  | 'contact'
  | 'bunt'
  | 'hitrun'
  | 'steal'
  | 'challenge'
  | 'paint'
  | 'waste'
  | 'defend';

export interface ClutchResolution {
  success: boolean;
  headline: string;
  lines: string[];
  tone: LogEntry['tone'];
  mods: Partial<ClutchSeasonMods>;
  /** Attr + meta deltas applied immediately after the moment. */
  deltas: Partial<Meta & { guts: number; contact: number; power: number; speed: number }>;
  /** When true, the moment is archived for the retirement summary. */
  memorable: boolean;
  highlightText: string;
}

interface MomentTemplate {
  id: string;
  kind: ClutchMoment['kind'];
  /** batter | pitcher | either */
  role: 'batter' | 'pitcher' | 'either';
  stages: Array<GameState['stage']>;
  title: string;
  situation: string;
  prompt: string;
  options: Array<{
    id: string;
    label: string;
    hint: string;
    approach: ClutchApproach;
  }>;
}

const TEMPLATES: MomentTemplate[] = [
  {
    id: 'bases-loaded-ab',
    kind: 'atbat',
    role: 'batter',
    stages: ['highschool', 'amateur', 'pro'],
    title: '滿壘兩出局',
    situation: '兩出局滿壘，勝負就在這一打席。',
    prompt: '投手準備投了。你要怎麼打這個打席？',
    options: [
      {
        id: 'sit-fb',
        label: '死等速球',
        hint: '看準直球開打；錯過變化球就出局',
        approach: 'sit-fastball',
      },
      {
        id: 'sit-brk',
        label: '預判變化球',
        hint: ' induct較深；若來速球可能揮空',
        approach: 'sit-breaking',
      },
      {
        id: 'patient',
        label: '把球數磨深',
        hint: '選球換保送或好吃的球；也可能被三振',
        approach: 'patient',
      },
      {
        id: 'aggressive',
        label: '第一球就攻擊',
        hint: '先發制人；風險高、張力也高',
        approach: 'aggressive',
      },
    ],
  },
  {
    id: 'late-tie-ab',
    kind: 'atbat',
    role: 'batter',
    stages: ['highschool', 'amateur', 'pro'],
    title: '追平分打席',
    situation: '九局下半一分落後，無人出局站上打擊區。',
    prompt: '教練盯著你。這一棒要怎麼打？',
    options: [
      {
        id: 'power',
        label: '拉打追全壘打',
        hint: '一棒定勝負；空棒就是雙殺危機',
        approach: 'power',
      },
      {
        id: 'contact',
        label: '確實擊球推進',
        hint: '安打或犧牲飛球；長打機率低',
        approach: 'contact',
      },
      {
        id: 'patient',
        label: '等保送上壘',
        hint: '把壓力丟回投手；也可能三振',
        approach: 'patient',
      },
    ],
  },
  {
    id: 'steal-read',
    kind: 'steal',
    role: 'batter',
    stages: ['highschool', 'amateur', 'pro'],
    title: '盜壘時機',
    situation: '一壘有跑者，兩好球後投手習慣停很久。',
    prompt: '要不要跑？',
    options: [
      {
        id: 'steal',
        label: '盜二壘',
        hint: '成了就到得點圈；被抓就斷掉攻勢',
        approach: 'steal',
      },
      {
        id: 'hitrun',
        label: '打帶跑',
        hint: '球棒與腳步一起動；需要確實擊球',
        approach: 'hitrun',
      },
      {
        id: 'hold',
        label: '按兵不動',
        hint: '不冒險；這一局節奏交給打者',
        approach: 'contact',
      },
    ],
  },
  {
    id: 'bunt-squeeze',
    kind: 'bunt',
    role: 'batter',
    stages: ['highschool', 'amateur', 'pro'],
    title: '短打抉擇',
    situation: '三壘有人、無人出局，教練比了短打手勢。',
    prompt: '照做，還是自己改打法？',
    options: [
      {
        id: 'bunt',
        label: '確實短打',
        hint: '推進／打點穩；幾乎沒有長打',
        approach: 'bunt',
      },
      {
        id: 'slash',
        label: '假短打真打',
        hint: '騙守備；失敗很難看',
        approach: 'aggressive',
      },
      {
        id: 'swing',
        label: '揮大棒決勝負',
        hint: '無視手勢硬打；教練可能不爽',
        approach: 'power',
      },
    ],
  },
  {
    id: 'pitch-duel',
    kind: 'pitch',
    role: 'pitcher',
    stages: ['highschool', 'amateur', 'pro'],
    title: '關鍵對決',
    situation: '兩出局滿壘，對方強打站上打擊區。',
    prompt: '這一球怎麼配？',
    options: [
      {
        id: 'challenge',
        label: '正面速球對決',
        hint: '球威決勝負；打中就是失分',
        approach: 'challenge',
      },
      {
        id: 'paint',
        label: '邊角變化球',
        hint: '誘揮空；控球不穩會暴投',
        approach: 'paint',
      },
      {
        id: 'waste',
        label: '故意壞球探路',
        hint: '摸清打者；可能保送失分',
        approach: 'waste',
      },
    ],
  },
  {
    id: 'pitch-save',
    kind: 'pitch',
    role: 'pitcher',
    stages: ['amateur', 'pro'],
    title: '救援危機',
    situation: '九局一人出局二三壘有人，你被叫上場。',
    prompt: '怎麼度過這半局？',
    options: [
      {
        id: 'challenge',
        label: '連續速球壓制',
        hint: '用球威解決；球數暴增',
        approach: 'challenge',
      },
      {
        id: 'paint',
        label: '配變化球誘雙殺',
        hint: '誘打滾地球；挂中間就爆炸',
        approach: 'paint',
      },
      {
        id: 'waste',
        label: '謹慎繞打者',
        hint: '降低最壞結果；可能自動上壘',
        approach: 'waste',
      },
    ],
  },
  {
    id: 'wall-catch',
    kind: 'defend',
    role: 'batter',
    stages: ['highschool', 'amateur', 'pro'],
    title: '牆前撲接',
    situation: '對手打出右外野大飛球，勝差分毫。',
    prompt: '你怎麼判斷這顆球？',
    options: [
      {
        id: 'dive',
        label: '捨身撲接',
        hint: '成了是美技；撲空或受傷也常見',
        approach: 'defend',
      },
      {
        id: 'play-safe',
        label: '卡好彈跳',
        hint: '確保一壘打；放棄美技機會',
        approach: 'contact',
      },
      {
        id: 'cut',
        label: '預判封鎖二壘',
        hint: '不求接殺，求擋推進',
        approach: 'hitrun',
      },
    ],
  },
];

function isPitcherRole(position: Position): boolean {
  return IS_PITCHER[position] && !IS_TWO_WAY[position];
}

function eligibleTemplates(state: GameState): MomentTemplate[] {
  const pitcher = isPitcherRole(state.position);
  const twoWay = IS_TWO_WAY[state.position];
  return TEMPLATES.filter((t) => {
    if (!t.stages.includes(state.stage)) return false;
    if (t.role === 'pitcher') return pitcher || twoWay;
    if (t.role === 'batter') return !pitcher || twoWay;
    return true;
  });
}

function attitudeBias(attitudeId: string | undefined, approach: ClutchApproach): number {
  if (!attitudeId) return 0;
  if (attitudeId === 't-allin') {
    if (approach === 'aggressive' || approach === 'power' || approach === 'challenge') return 0.08;
    if (approach === 'patient' || approach === 'bunt' || approach === 'waste') return -0.05;
  }
  if (attitudeId === 't-protect') {
    if (approach === 'patient' || approach === 'bunt' || approach === 'contact' || approach === 'waste')
      return 0.08;
    if (approach === 'aggressive' || approach === 'power' || approach === 'steal') return -0.06;
  }
  return 0;
}

function abilityBias(abilities: string[], approach: ClutchApproach): number {
  const has = (id: string) => abilities.includes(id);
  let bonus = 0;
  if (has('keen-eye') && (approach === 'patient' || approach === 'sit-breaking' || approach === 'sit-fastball'))
    bonus += 0.1;
  if (has('basepath') && (approach === 'steal' || approach === 'hitrun')) bonus += 0.12;
  if (has('pull') && (approach === 'power' || approach === 'sit-fastball')) bonus += 0.1;
  if (has('heavy-ball') && (approach === 'challenge' || approach === 'paint')) bonus += 0.1;
  if (has('range') && approach === 'defend') bonus += 0.14;
  return bonus;
}

function attrBias(state: GameState, approach: ClutchApproach): number {
  const a = state.attrs;
  const scale = (v: number) => (v - 45) / 220;
  switch (approach) {
    case 'sit-fastball':
    case 'challenge':
      return scale(a.contact) * 0.5 + scale(a.velocity) * 0.5;
    case 'sit-breaking':
    case 'paint':
      return scale(a.eye) * 0.45 + scale(a.breaking) * 0.45 + scale(a.control) * 0.2;
    case 'patient':
      return scale(a.eye);
    case 'aggressive':
      return scale(a.guts) * 0.6 + scale(a.contact) * 0.3;
    case 'power':
      return scale(a.power);
    case 'contact':
    case 'bunt':
      return scale(a.contact) * 0.7 + scale(a.eye) * 0.2;
    case 'steal':
    case 'hitrun':
      return scale(a.speed);
    case 'waste':
      return scale(a.control) * 0.6 + scale(a.guts) * 0.3;
    case 'defend':
      return scale(a.fielding) * 0.8 + scale(a.speed) * 0.2;
    default:
      return 0;
  }
}

/**
 * How many clutch moments to insert for this match. Deterministic off `rng`.
 * HS tournaments always get one; pro seasons get one (sometimes two).
 */
export function planClutchCount(
  state: GameState,
  kind: 'tournament' | 'season',
  rng: () => number,
): number {
  if (kind === 'tournament') return 1;
  if (state.stage === 'pro') return rng() < 0.28 ? 2 : 1;
  if (state.stage === 'amateur') return rng() < 0.72 ? 1 : 0;
  return 0;
}

export function buildClutchMoments(
  state: GameState,
  count: number,
  rng: () => number,
): ClutchMoment[] {
  if (count <= 0) return [];
  const pool = [...eligibleTemplates(state)];
  const moments: ClutchMoment[] = [];
  // Rival presence uses a dedicated stream so it does not steal draws from
  // template selection (which would desync M2 injury / season rolls).
  const rivalRoll = streamRng(
    state.seed,
    `rival-present:${state.year}:${state.turnIndex}:${state.choices.length}`,
  );
  let rivalSlot = rivalPresentForMatch(state, rivalRoll);
  for (let i = 0; i < count && pool.length > 0; i++) {
    const index = Math.floor(rng() * pool.length);
    const template = pool.splice(index, 1)[0];
    const vsRival = rivalSlot && i === 0;
    if (vsRival) rivalSlot = false;
    const copy = vsRival
      ? rivalizeClutchCopy(state, template.title, template.situation)
      : { title: template.title, situation: template.situation, vsRival: false };
    moments.push({
      id: `${template.id}:${state.year}:${state.turnIndex}:${i}`,
      templateId: template.id,
      kind: template.kind,
      title: copy.title,
      situation: copy.situation,
      prompt: template.prompt,
      year: state.year,
      age: state.age,
      league: state.league,
      vsRival: copy.vsRival,
      options: template.options.map(
        (o): ClutchOption => ({
          id: o.id,
          label: o.label,
          hint: o.hint,
          approach: o.approach,
        }),
      ),
    });
  }
  return moments;
}

export function clutchDecisionOptions(moment: ClutchMoment): Option[] {
  return moment.options.map((o) => ({
    id: o.id,
    label: o.label,
    hint: o.hint,
  }));
}

function mergeMods(into: ClutchSeasonMods, patch: Partial<ClutchSeasonMods>): void {
  into.clutchMul *= patch.clutchMul ?? 1;
  into.qualityDelta += patch.qualityDelta ?? 0;
  into.batHitBonus += patch.batHitBonus ?? 0;
  into.batHrBonus += patch.batHrBonus ?? 0;
  into.batSbBonus += patch.batSbBonus ?? 0;
  into.pitchSoBonus += patch.pitchSoBonus ?? 0;
  into.pitchEraDelta += patch.pitchEraDelta ?? 0;
  into.pitchWinBonus += patch.pitchWinBonus ?? 0;
  into.tournamentScoreDelta += patch.tournamentScoreDelta ?? 0;
}

export function applyClutchMods(target: ClutchSeasonMods, patch: Partial<ClutchSeasonMods>): void {
  mergeMods(target, patch);
}

/**
 * Resolve a clutch choice. Success chance leans on attributes, motivation,
 * tournament attitude, traits and M1 special abilities — never a coin flip.
 */
export function resolveClutchChoice(
  state: GameState,
  moment: ClutchMoment,
  optionId: string,
  attitudeId: string | undefined,
  rng: () => number,
): ClutchResolution {
  const option = moment.options.find((o) => o.id === optionId) ?? moment.options[0];
  const approach = option.approach as ClutchApproach;
  const effects = traitEffects(state.traits);
  const rating = overall(state.attrs, state.position);
  const baseline = LEAGUES[state.league].baseline;

  let chance =
    0.42 +
    (rating - baseline) / 90 +
    attrBias(state, approach) +
    abilityBias(state.abilities, approach) +
    attitudeBias(attitudeId, approach) +
    (state.meta.motivation - 50) / 180 +
    (state.meta.mind - 50) / 220 +
    (effects.clutch - 1) * 0.15;

  // Rival H2H: tighter window — high rivalry / coach tactician / chemistry help.
  if (moment.vsRival && state.rival) {
    const gap = (rating - state.rival.overall) / 100;
    chance += gap * 0.35 + (state.rival.rivalry - 50) / 400;
    if (state.coach?.style === 'tactician') chance += 0.03;
  }

  // Risky approaches swing harder.
  if (approach === 'aggressive' || approach === 'power' || approach === 'steal' || approach === 'challenge') {
    chance += (rng() - 0.5) * 0.08;
  }
  chance = Math.min(0.88, Math.max(0.12, chance));
  const success = rng() < chance;

  return outcomeFor(state, moment, option, success, chance, rng);
}

function outcomeFor(
  state: GameState,
  moment: ClutchMoment,
  option: ClutchOption,
  success: boolean,
  chance: number,
  rng: () => number,
): ClutchResolution {
  const approach = option.approach as ClutchApproach;
  const great = success && chance > 0.62 && rng() < 0.45;
  const memorable = great || (!success && approach !== 'contact' && rng() < 0.35);
  const leagueShort = LEAGUES[state.league].short;

  const base: ClutchResolution = {
    success,
    headline: option.label,
    lines: [],
    tone: success ? (great ? 'great' : 'good') : 'bad',
    mods: {},
    deltas: {},
    memorable,
    highlightText: '',
  };

  if (moment.kind === 'steal' || approach === 'steal' || approach === 'hitrun') {
    if (success) {
      base.lines.push(
        approach === 'hitrun'
          ? '打帶跑成功——跑者踩上得點圈，外野手來不及。'
          : '盜壘成功。捕手的球在二壘手手套裡遲到了一拍。',
      );
      base.mods = { batSbBonus: great ? 3 : 2, qualityDelta: 0.04, clutchMul: 1.04 };
      base.deltas = { motivation: 4, fame: great ? 3 : 1, fatigue: approach === 'steal' ? 2 : 1 };
      base.highlightText = `${state.year}・${leagueShort}　${moment.title}：盜壘啟動，攻勢活了。`;
    } else {
      base.lines.push('被抓了。教練拍了拍手，攻勢瞬間停住。');
      base.mods = { qualityDelta: -0.03, clutchMul: 0.97 };
      base.deltas = { motivation: -4, mind: -2, fatigue: 3 };
      base.highlightText = `${state.year}・${leagueShort}　${moment.title}：盜壘失敗，場面安靜下來。`;
    }
    return base;
  }

  if (moment.kind === 'pitch' || approach === 'challenge' || approach === 'paint' || approach === 'waste') {
    if (success) {
      base.lines.push(
        approach === 'challenge'
          ? '速球灌進好球帶，打者揮空。滿壘危機化解。'
          : approach === 'paint'
            ? '變化球擦著邊角進壘，誘出軟弱滾地。'
            : '壞球探路成功，下一球把打者凍結在原地。',
      );
      base.mods = {
        pitchSoBonus: great ? 4 : 2,
        pitchEraDelta: great ? -0.12 : -0.06,
        pitchWinBonus: great ? 1 : 0,
        qualityDelta: 0.05,
        clutchMul: 1.05,
        tournamentScoreDelta: great ? 8 : 4,
      };
      base.deltas = {
        motivation: 5,
        guts: 2,
        fame: great ? 4 : 1,
        fatigue: approach === 'challenge' ? 3 : 1,
      };
      base.highlightText = `${state.year}・${leagueShort}　${moment.title}：關鍵對決，你把打者解決了。`;
    } else {
      base.lines.push(
        approach === 'waste'
          ? '四壞球，被迫送分。牛棚開始熱身。'
          : '球心被抓到了。外野牆外，對手慶祝的聲音很遠又很近。',
      );
      base.mods = {
        pitchEraDelta: 0.18,
        qualityDelta: -0.05,
        clutchMul: 0.95,
        tournamentScoreDelta: -6,
      };
      base.deltas = { motivation: -5, mind: -2, fatigue: 4, fame: -1 };
      base.highlightText = `${state.year}・${leagueShort}　${moment.title}：對決失手，比分被翻開。`;
    }
    return base;
  }

  if (approach === 'defend') {
    if (success) {
      base.lines.push(
        state.abilities.includes('range')
          ? '守備範圍讓你早一步到位，美技接殺——觀眾站起來了。'
          : '你撲出去了。手套裡有球，比分保住。',
      );
      base.mods = { qualityDelta: 0.05, clutchMul: 1.04, tournamentScoreDelta: 6 };
      base.deltas = { motivation: 5, fame: great ? 5 : 2, fatigue: 2, body: -1 };
      base.highlightText = `${state.year}・${leagueShort}　${moment.title}：捨身美技，守住勝利。`;
    } else {
      base.lines.push('扑空了。球滾向牆角，對手繞回本壘。');
      base.mods = { qualityDelta: -0.04, tournamentScoreDelta: -5 };
      base.deltas = { motivation: -3, fatigue: 5, mind: -1 };
      base.highlightText = `${state.year}・${leagueShort}　${moment.title}：扑接落空，眼看著失分。`;
    }
    return base;
  }

  // Default: batting approaches
  if (success) {
    const powerish = approach === 'power' || approach === 'sit-fastball';
    base.lines.push(
      great
        ? powerish
          ? '球平飛出牆。這一棒，你會記很久。'
          : '球穿過內野缺口。隊友從休息區衝出來。'
        : approach === 'bunt'
          ? '短打精準——跑者踏進本壘，教練點了點頭。'
          : approach === 'patient'
            ? '四壞球。你把壓力丟回投手丘。'
            : '確實擊球，一壘安打推進了攻勢。',
    );
    base.mods = {
      batHitBonus: great ? 3 : approach === 'patient' ? 1 : 2,
      batHrBonus: powerish && great ? 2 : powerish ? 1 : 0,
      qualityDelta: great ? 0.07 : 0.04,
      clutchMul: great ? 1.08 : 1.04,
      tournamentScoreDelta: great ? 10 : 5,
    };
    base.deltas = {
      motivation: great ? 6 : 3,
      fame: great ? 5 : 2,
      guts: 1,
      fatigue: approach === 'aggressive' || approach === 'power' ? 2 : 0,
    };
    base.highlightText = `${state.year}・${leagueShort}　${moment.title}：${
      great ? '超技一擊，改寫比分。' : '關鍵一打，攻勢延續。'
    }`;
  } else {
    base.lines.push(
      approach === 'patient'
        ? '判斷落空，三振。你走回休息區時沒人說話。'
        : approach === 'bunt'
          ? '短打失敗，變成雙殺。教練把視線移開。'
          : '揮空。這一打席，什麼也沒留下。',
    );
    base.mods = {
      qualityDelta: -0.04,
      clutchMul: 0.96,
      tournamentScoreDelta: -5,
    };
    base.deltas = { motivation: -5, mind: -2, fatigue: 2 };
    base.highlightText = `${state.year}・${leagueShort}　${moment.title}：關鍵打席落空。`;
  }
  return base;
}

export function toHighlight(
  state: GameState,
  resolution: ClutchResolution,
): ClutchHighlight | null {
  if (!resolution.memorable) return null;
  return {
    year: state.year,
    age: state.age,
    league: state.league,
    text: resolution.highlightText,
    tone: resolution.tone === 'bad' ? 'bad' : resolution.tone === 'great' ? 'great' : 'good',
  };
}

/** Soft cap so a career summary stays readable. */
export const MAX_CLUTCH_HIGHLIGHTS = 12;

export function pushHighlight(state: GameState, highlight: ClutchHighlight | null): void {
  if (!highlight) return;
  state.clutchHighlights = [...state.clutchHighlights, highlight].slice(-MAX_CLUTCH_HIGHLIGHTS);
}

/** Exported for UI previews — approach tags are not AttrKeys. */
export function approachFocusHint(approach: ClutchApproach): AttrKey[] {
  switch (approach) {
    case 'power':
    case 'sit-fastball':
      return ['power', 'contact'];
    case 'patient':
    case 'sit-breaking':
      return ['eye'];
    case 'steal':
    case 'hitrun':
      return ['speed'];
    case 'challenge':
      return ['velocity', 'guts'];
    case 'paint':
      return ['control', 'breaking'];
    case 'defend':
      return ['fielding', 'speed'];
    default:
      return ['contact'];
  }
}

/**
 * M3 — coaches, teammates and a recurring rival. Bonds are investable state
 * (not flavour text): they reshape training cards, chemistry story beats, and
 * M2 clutch moments when the rival walks into the box.
 */
import { IS_PITCHER, overall } from './config';
import { streamRng } from './rng';
import type {
  AttrKey,
  Coach,
  CoachStyle,
  GameState,
  Meta,
  Option,
  Position,
  Rival,
  StoryBeat,
  Teammate,
} from './types';

export interface CoachStyleInfo {
  id: CoachStyle;
  label: string;
  blurb: string;
  /** Drill ids this coach pushes; training them grows bond and power. */
  preferred: string[];
  powerMul: number;
  fatigueMul: number;
  motivationMul: number;
  /** Extra focus keys whispered onto preferred drills. */
  whisperFocus?: AttrKey[];
}

export const COACH_STYLES: CoachStyleInfo[] = [
  {
    id: 'strict',
    label: '嚴師',
    blurb: '菜單偏硬，成長快、動機也容易被榨乾。',
    preferred: ['weight', 'longtoss', 'run', 'stamina'],
    powerMul: 1.1,
    fatigueMul: 1.08,
    motivationMul: 1.25,
  },
  {
    id: 'nurture',
    label: '慈父型',
    blurb: '恢復與心志被看得很重；硬練也會被要求收著點。',
    preferred: ['rest', 'stretch', 'notebook', 'video', 'mental'],
    powerMul: 0.94,
    fatigueMul: 0.82,
    motivationMul: 0.55,
    whisperFocus: ['guts'],
  },
  {
    id: 'tactician',
    label: '戰術派',
    blurb: '影片、控球、選球被放大；盲練身體會挨罵。',
    preferred: ['video', 'bullpen', 'swing', 'mental'],
    powerMul: 1.06,
    fatigueMul: 0.95,
    motivationMul: 0.9,
    whisperFocus: ['eye', 'control'],
  },
  {
    id: 'power',
    label: '力量派',
    blurb: '長打與球速優先；輕量菜單幾乎不被認可。',
    preferred: ['weight', 'longtoss', 'swing', 'run'],
    powerMul: 1.1,
    fatigueMul: 1.06,
    motivationMul: 1.15,
    whisperFocus: ['power', 'velocity'],
  },
];

const COACH_NAMES = ['陳建宏', '林志偉', '黃國鋒', '吳明哲', '鄭文彬', '謝俊傑'];
const TEAMMATE_NAMES = [
  '阿凱',
  '小宇',
  '冠廷',
  '承翰',
  '柏毅',
  '彥廷',
  '子軒',
  '皓宇',
  '恩齊',
  '睿哲',
];
const RIVAL_NAMES = ['高遠翔', '葉辰皓', '沈曜安', '方景澤', '羅天御', '江宥辰'];

const TEAMMATE_ROLES_BAT = ['開路先鋒', '中心棒', '守護神游', '捕手搭檔'];
const TEAMMATE_ROLES_PIT = ['牛棚哥哥', '先發搭檔', '捕手搭檔', '守護神'];

export function coachStyleInfo(style: CoachStyle): CoachStyleInfo {
  return COACH_STYLES.find((c) => c.id === style) ?? COACH_STYLES[0];
}

function pickUnique(rng: () => number, pool: string[], count: number): string[] {
  const bag = [...pool];
  const out: string[] = [];
  for (let i = 0; i < count && bag.length > 0; i++) {
    const idx = Math.floor(rng() * bag.length);
    out.push(bag.splice(idx, 1)[0]);
  }
  return out;
}

/** Deterministic cast for a fresh career. */
export function rollPeopleCast(
  seed: number,
  position: Position,
): { coach: Coach; teammates: Teammate[]; rival: Rival } {
  const rng = streamRng(seed, 'people-cast');
  const style = COACH_STYLES[Math.floor(rng() * COACH_STYLES.length)];
  const coachName = COACH_NAMES[Math.floor(rng() * COACH_NAMES.length)];
  const coach: Coach = {
    id: `coach-${style.id}`,
    name: coachName,
    style: style.id,
    bond: 28 + Math.floor(rng() * 12),
  };

  const roles = IS_PITCHER[position] ? TEAMMATE_ROLES_PIT : TEAMMATE_ROLES_BAT;
  const names = pickUnique(rng, TEAMMATE_NAMES, 2);
  const teammates: Teammate[] = names.map((name, i) => ({
    id: `tm-${i}`,
    name,
    role: roles[i % roles.length],
    bond: 18 + Math.floor(rng() * 16),
  }));

  const rivalPosPool: Position[] = IS_PITCHER[position]
    ? ['OF', 'IF', 'C']
    : ['P', 'P', 'OF'];
  const rival: Rival = {
    id: 'rival-0',
    name: RIVAL_NAMES[Math.floor(rng() * RIVAL_NAMES.length)],
    position: rivalPosPool[Math.floor(rng() * rivalPosPool.length)],
    overall: 34 + Math.floor(rng() * 8),
    rivalry: 22 + Math.floor(rng() * 14),
    meetings: 0,
    lastStage: null,
  };

  return { coach, teammates, rival };
}

export function emptyPeopleFallback(position: Position): {
  coach: Coach;
  teammates: Teammate[];
  rival: Rival;
} {
  return rollPeopleCast(1, position);
}

/** Soft-reshape a training card for the active coach style. */
export function applyCoachToDrill<
  T extends {
    id: string;
    power: number;
    fatigue: number;
    motivation?: number;
    hint: string;
    focus: AttrKey[];
  },
>(coach: Coach, drill: T): T {
  const style = coachStyleInfo(coach.style);
  const preferred = style.preferred.includes(drill.id.replace(/^sec-/, ''));
  const bondFactor = 1 + (coach.bond - 40) / 280;
  let power = drill.power;
  let fatigue = drill.fatigue;
  let motivation = drill.motivation ?? 0;
  let hint = drill.hint;
  const focus = [...drill.focus];

  if (preferred) {
    power *= style.powerMul * bondFactor;
    fatigue *= style.fatigueMul;
    motivation *= style.motivationMul;
    hint = `${hint}・教練推`;
    if (style.whisperFocus) {
      style.whisperFocus.forEach((key) => {
        if (!focus.includes(key) && focus.length < 3) focus.push(key);
      });
    }
  } else if (style.id === 'strict' && (drill.id === 'rest' || drill.id === 'video')) {
    power *= 0.9;
    hint = `${hint}・嚴師皺眉`;
  } else if (style.id === 'power' && (drill.id === 'video' || drill.id === 'mental')) {
    power *= 0.88;
  } else if (style.id === 'nurture' && (drill.id === 'weight' || drill.id === 'longtoss')) {
    fatigue *= 0.9;
    motivation = Math.min(motivation, -1);
  }

  return {
    ...drill,
    power: Math.round(power * 10) / 10,
    fatigue: Math.round(fatigue),
    motivation: Math.round(motivation),
    hint,
    focus,
  };
}

export function bumpCoachBond(state: GameState, drillId: string, amount = 3): void {
  if (!state.coach) return;
  const style = coachStyleInfo(state.coach.style);
  const base = drillId.replace(/^sec-/, '');
  const preferred = style.preferred.includes(base);
  const delta = preferred ? amount : base === 'rest' && style.id === 'strict' ? -1 : 1;
  state.coach.bond = clamp01(state.coach.bond + delta);
}

export function bumpTeammateBonds(state: GameState, amount: number): void {
  state.teammates.forEach((tm) => {
    tm.bond = clamp01(tm.bond + amount);
  });
}

export function teamChemistry(state: GameState): number {
  if (!state.teammates.length) return 40;
  const sum = state.teammates.reduce((acc, tm) => acc + tm.bond, 0);
  return Math.round(sum / state.teammates.length);
}

/** Advance rival overall gently with player stage / age. */
export function tickRivalGrowth(state: GameState): void {
  if (!state.rival) return;
  const player = overall(state.attrs, state.position);
  const target =
    state.stage === 'highschool'
      ? 40 + state.turnIndex * 1.2
      : state.stage === 'amateur'
        ? 52 + (state.age - 18) * 2
        : 58 + Math.min(18, state.age - 22) * 1.4;
  const drift = (target + player * 0.15 - state.rival.overall) * 0.35;
  state.rival.overall = Math.round(
    Math.min(92, Math.max(28, state.rival.overall + drift + (state.rival.rivalry - 40) * 0.04)),
  );
}

export function rivalPresentForMatch(state: GameState, rng: () => number): boolean {
  if (!state.rival) return false;
  // Reappear across stages, denser when rivalry is hot.
  const stageChance =
    state.stage === 'highschool' ? 0.42 : state.stage === 'amateur' ? 0.32 : 0.28;
  const heat = state.rival.rivalry / 280;
  return rng() < stageChance + heat;
}

/** Flavour rewrite so clutch copy names the rival when they show up. */
export function rivalizeClutchCopy(
  state: GameState,
  title: string,
  situation: string,
): { title: string; situation: string; vsRival: boolean } {
  if (!state.rival) return { title, situation, vsRival: false };
  return {
    title: `對決・${state.rival.name}`,
    situation: `${situation} 對面是宿敵 ${state.rival.name}（綜合約 ${state.rival.overall}）。`,
    vsRival: true,
  };
}

export function noteRivalMeeting(state: GameState, won: boolean): void {
  if (!state.rival) return;
  state.rival.meetings += 1;
  state.rival.lastStage = state.stage;
  state.rival.rivalry = clamp01(state.rival.rivalry + (won ? 6 : 4));
  if (won) state.rival.overall = Math.min(92, state.rival.overall + 1);
  else state.rival.overall = Math.min(92, state.rival.overall + 2);
}

function clamp01(v: number): number {
  return Math.min(100, Math.max(0, Math.round(v)));
}

/** Build a relationship story beat, or null if the cast is quiet this turn. */
export function maybeQueueStory(
  state: GameState,
  rng: () => number,
): StoryBeat | null {
  if (state.pendingStory || state.pendingChapter || state.pendingClutch) return null;
  if (state.pendingSituation) return null;
  // Keep story beats rarer than flavour situations so careers don't drown.
  const chance = state.stage === 'highschool' ? 0.16 : 0.1;
  if (rng() >= chance) return null;

  const chem = teamChemistry(state);
  const roll = rng();
  if (roll < 0.34 && state.coach) {
    const style = coachStyleInfo(state.coach.style);
    return {
      id: `story-coach-${state.year}-${state.turnIndex}`,
      kind: 'coach',
      title: `教練・${state.coach.name}`,
      prompt: `${style.label}教練把你叫到辦公室。他想知道你這季要怎麼練。`,
      options: [
        {
          id: 'coach-follow',
          label: '照他的菜單走',
          hint: `好感＋・偏 ${style.label} 路線`,
        },
        {
          id: 'coach-pushback',
          label: '提出自己的想法',
          hint: '心志＋・好感可能下滑',
        },
        {
          id: 'coach-listen',
          label: '先聽完再說',
          hint: '穩健・動機小回補',
        },
      ],
    };
  }
  if (roll < 0.72 && state.teammates.length > 0) {
    const tm = state.teammates[Math.floor(rng() * state.teammates.length)];
    return {
      id: `story-mate-${tm.id}-${state.year}-${state.turnIndex}`,
      kind: 'teammate',
      title: `隊友・${tm.name}`,
      prompt:
        chem >= 60
          ? `${tm.role}${tm.name}約你加練。休息區的氣氛不錯。`
          : `${tm.role}${tm.name}看起來有點悶。要不要找他聊聊？`,
      options: [
        {
          id: 'mate-hang',
          label: '吃飯聊天',
          hint: '羈絆＋・動機回補',
        },
        {
          id: 'mate-train',
          label: '一起加練',
          hint: '羈絆＋・疲勞小幅上升',
        },
        {
          id: 'mate-solo',
          label: '婉拒，顧自己',
          hint: '專注訓練・羈絆微降',
        },
      ],
    };
  }
  if (state.rival) {
    return {
      id: `story-rival-${state.year}-${state.turnIndex}`,
      kind: 'rival',
      title: `宿敵・${state.rival.name}`,
      prompt: `媒體又把你跟 ${state.rival.name} 寫在一起。他的綜合大約 ${state.rival.overall}。你怎麼回應？`,
      options: [
        {
          id: 'rival-fuel',
          label: '當成燃料',
          hint: '對抗心↑・動機＋',
        },
        {
          id: 'rival-respect',
          label: '公開致意',
          hint: '人氣＋・對抗心小升',
        },
        {
          id: 'rival-ignore',
          label: '不回應',
          hint: '心志守住・對抗心不變',
        },
      ],
    };
  }
  return null;
}

export interface StoryResolution {
  headline: string;
  lines: string[];
  deltas: Partial<Meta & { guts: number; contact: number; power: number; mind: number }>;
  tone: 'normal' | 'good' | 'bad' | 'great';
}

export function resolveStoryChoice(state: GameState, optionId: string): StoryResolution {
  const beat = state.pendingStory;
  const base: StoryResolution = {
    headline: beat?.title ?? '人際',
    lines: [],
    deltas: {},
    tone: 'normal',
  };
  if (!beat) return base;

  if (beat.kind === 'coach' && state.coach) {
    if (optionId === 'coach-follow') {
      state.coach.bond = clamp01(state.coach.bond + 8);
      base.lines.push(`${state.coach.name}點頭：「這才像話。」`);
      base.deltas = { motivation: 3, mind: 1 };
      base.tone = 'good';
    } else if (optionId === 'coach-pushback') {
      state.coach.bond = clamp01(state.coach.bond - 4);
      base.lines.push('他沉默了一下，最後說：「那就拿出成績給我看。」');
      base.deltas = { mind: 4, guts: 2, motivation: -2 };
      base.tone = 'normal';
    } else {
      state.coach.bond = clamp01(state.coach.bond + 3);
      base.lines.push('你把話聽完。教練的語氣軟了一點。');
      base.deltas = { motivation: 4 };
      base.tone = 'good';
    }
    return base;
  }

  if (beat.kind === 'teammate') {
    const tm =
      state.teammates.find((t) => beat.id.includes(t.id)) ?? state.teammates[0];
    if (optionId === 'mate-train' && tm) {
      tm.bond = clamp01(tm.bond + 7);
      base.lines.push(`和 ${tm.name} 多練了一輪。汗水把距離拉近。`);
      base.deltas = { fatigue: 2, motivation: 2, body: 1 };
      base.tone = 'good';
    } else if (optionId === 'mate-hang' && tm) {
      tm.bond = clamp01(tm.bond + 6);
      base.lines.push(`宵夜桌上，${tm.name} 開始叫你「兄弟」。`);
      base.deltas = { motivation: 6, mind: 2, fatigue: -2 };
      base.tone = 'great';
    } else if (tm) {
      tm.bond = clamp01(tm.bond - 3);
      base.lines.push(`${tm.name} 聳聳肩：「你忙你的。」`);
      base.deltas = { mind: 2, motivation: -1 };
    }
    return base;
  }

  if (beat.kind === 'rival' && state.rival) {
    if (optionId === 'rival-fuel') {
      state.rival.rivalry = clamp01(state.rival.rivalry + 8);
      base.lines.push(`你把新聞剪下來貼在置物櫃。下次見面，一定要比過 ${state.rival.name}。`);
      base.deltas = { motivation: 5, guts: 2 };
      base.tone = 'good';
    } else if (optionId === 'rival-respect') {
      state.rival.rivalry = clamp01(state.rival.rivalry + 3);
      base.lines.push('公開致意之後，媒體反而更愛寫你們的對決。');
      base.deltas = { fame: 4, motivation: 2 };
      base.tone = 'good';
    } else {
      base.lines.push('你把手機螢幕按黑。球場上再見真章。');
      base.deltas = { mind: 3 };
    }
    return base;
  }

  return base;
}

export function storyOptions(beat: StoryBeat): Option[] {
  return beat.options.map((o) => ({ ...o }));
}

/** Club pressure lite: when fame lags expectation, nudge motivation. */
export function clubPressureDelta(state: GameState): Partial<Meta> {
  if (state.stage !== 'pro') return {};
  const expect = 35 + Math.max(0, state.age - 22) * 2.2;
  if (state.meta.fame + 8 >= expect) return {};
  if (teamChemistry(state) >= 70) return { motivation: -1 };
  return { motivation: -3, mind: -1 };
}

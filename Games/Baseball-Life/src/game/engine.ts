import {
  ATTR_LABELS,
  IS_PITCHER,
  LEAGUES,
  META_LABELS,
  ORIGINS,
  TEAMS,
  attrsForPosition,
  overall,
} from './config';
import type { Origin } from './config';
import { INJURIES, pickEvent } from './events';
import { noise, pick, randInt, seedFromCode, streamRng } from './rng';
import { describeLine, simulateSeason, simulateTournament } from './season';
import { newlyUnlocked, traitById, traitEffects } from './traits';
import type {
  AttrKey,
  Attributes,
  Decision,
  DeltaKey,
  GameState,
  LeagueId,
  LogEntry,
  Meta,
  Option,
  Position,
  SeasonRecord,
  Summary,
  TurnReport,
} from './types';

const START_YEAR = 2010;
const HS_TURNS = 11;

/** Turn 0–10 are the three high-school years; 夏 turns are the tournaments. */
interface HsTurn {
  label: string;
  grade: number;
  season: '春' | '夏' | '秋' | '冬';
  tournament: string | null;
}

const HS_SCHEDULE: HsTurn[] = [
  { label: '高一 春', grade: 1, season: '春', tournament: null },
  { label: '高一 夏', grade: 1, season: '夏', tournament: '高中棒球聯賽' },
  { label: '高一 秋', grade: 1, season: '秋', tournament: null },
  { label: '高一 冬', grade: 1, season: '冬', tournament: null },
  { label: '高二 春', grade: 2, season: '春', tournament: null },
  { label: '高二 夏', grade: 2, season: '夏', tournament: '高中棒球聯賽' },
  { label: '高二 秋', grade: 2, season: '秋', tournament: '黑豹旗' },
  { label: '高二 冬', grade: 2, season: '冬', tournament: null },
  { label: '高三 春', grade: 3, season: '春', tournament: null },
  { label: '高三 夏', grade: 3, season: '夏', tournament: '高中棒球聯賽・最後一夏' },
  { label: '高三 秋', grade: 3, season: '秋', tournament: null },
];

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function round(v: number): number {
  return Math.round(v);
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

/**
 * A raw 16-year-old sits a little under the 高中 baseline of 30 — good enough
 * to make the team, nowhere near good enough to be scouted.
 */
const BASE_ATTRS: Attributes = {
  contact: 26,
  power: 24,
  speed: 28,
  fielding: 26,
  eye: 24,
  velocity: 26,
  control: 24,
  breaking: 22,
  stamina: 28,
  guts: 26,
};

/** Three origins drawn from the seed — same seed, same three cards. */
export function rollOrigins(seedCode: string): Origin[] {
  const rng = streamRng(seedFromCode(seedCode), 'origins');
  const pool = [...ORIGINS];
  const out: Origin[] = [];
  for (let i = 0; i < 3 && pool.length > 0; i++) {
    out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
  }
  return out;
}

function rollPotential(attrs: Attributes, seed: number, position: Position): Attributes {
  const rng = streamRng(seed, 'potential');
  const out = { ...attrs };
  const primary = new Set<AttrKey>(attrsForPosition(position));
  (Object.keys(out) as AttrKey[]).forEach((key) => {
    // Potential is the real difficulty dial: a 20-point ceiling means no amount
    // of training makes this player a star, and the player never sees the number.
    const headroom = primary.has(key) ? randInt(rng, 20, 52) : randInt(rng, 8, 30);
    out[key] = clamp(attrs[key] + headroom, 30, 99);
  });
  return out;
}

export interface CreateInput {
  seedCode: string;
  name: string;
  position: Position;
  originId: string;
}

export function createGame(input: CreateInput): GameState {
  const seed = seedFromCode(input.seedCode);
  const origin = ORIGINS.find((o) => o.id === input.originId) ?? ORIGINS[0];

  const attrs = { ...BASE_ATTRS };
  (Object.entries(origin.bonus) as [AttrKey, number][]).forEach(([key, value]) => {
    attrs[key] = clamp(attrs[key] + value, 0, 99);
  });
  // A pitcher's arm and a batter's bat both start a little ahead of the rest.
  const primary = attrsForPosition(input.position);
  primary.forEach((key) => {
    attrs[key] = clamp(attrs[key] + 6, 0, 99);
  });

  const meta: Meta = {
    body: clamp(50 + (origin.meta?.body ?? 0), 0, 100),
    mind: clamp(45 + (origin.meta?.mind ?? 0), 0, 100),
    fame: clamp(3 + (origin.meta?.fame ?? 0), 0, 100),
    fatigue: 0,
  };

  const state: GameState = {
    seedCode: input.seedCode,
    seed,
    name: input.name.trim() || '無名球兒',
    position: input.position,
    originId: origin.id,
    originLabel: origin.label,
    age: 16,
    year: START_YEAR,
    turnIndex: 0,
    stage: 'highschool',
    league: 'hs',
    team: pick(streamRng(seed, 'hs-team'), TEAMS.hs),
    attrs,
    meta,
    injury: null,
    potential: rollPotential(attrs, seed, input.position),
    history: [],
    traits: [],
    counters: {
      earlySixes: 0,
      restTurns: 0,
      injuries: 0,
      intlAppearances: 0,
      intlStrong: 0,
      fullSeasons: 0,
      proSeasons: 0,
      hsTournamentWins: 0,
      badSeasons: 0,
    },
    log: [],
    choices: [],
    decision: null,
    report: null,
    retired: false,
    summary: null,
    pendingDraftRank: null,
    handled: [],
  };

  pushLog(state, '入部', `${state.team} 棒球部，${origin.label}。你的棒球人生從這個春天開始。`, 'normal');
  state.decision = buildDecision(state);
  return state;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pushLog(state: GameState, label: string, text: string, tone: LogEntry['tone']): void {
  state.log.push({ id: state.log.length, label, text, tone });
}

function applyDeltas(state: GameState, deltas: Partial<Attributes & Meta>): void {
  (Object.entries(deltas) as [string, number][]).forEach(([key, value]) => {
    if (key in state.attrs) {
      const k = key as AttrKey;
      state.attrs[k] = clamp(state.attrs[k] + value, 0, 99);
    } else if (key in state.meta) {
      const k = key as keyof Meta;
      state.meta[k] = clamp(state.meta[k] + value, 0, 100);
    }
  });
}

export function deltaLabel(key: string): string {
  if (key in ATTR_LABELS) return ATTR_LABELS[key as AttrKey];
  if (key in META_LABELS) return META_LABELS[key as keyof Meta];
  return key;
}

function turnLabel(state: GameState): string {
  if (state.stage === 'highschool') return HS_SCHEDULE[Math.min(state.turnIndex, HS_TURNS - 1)].label;
  return `${state.year} 年球季（${state.age} 歲）`;
}

function rng(state: GameState, purpose: string): () => number {
  // The turn index and choice count pin the stream to this exact moment in
  // this exact run, so replaying the same choices replays the same numbers.
  return streamRng(state.seed, `${purpose}:${state.turnIndex}:${state.choices.length}`);
}

/** d6 nudged by fatigue and mental strength — never outside 1–6. */
function rollDice(state: GameState, r: () => number): number {
  let dice = randInt(r, 1, 6);
  if (state.meta.fatigue > 65 && dice > 1 && r() < (state.meta.fatigue - 65) / 60) dice -= 1;
  if (state.meta.mind > 70 && dice < 6 && r() < (state.meta.mind - 70) / 90) dice += 1;
  return clamp(dice, 1, 6);
}

const DICE_MULT = [0, 0.15, 0.55, 0.85, 1.15, 1.5, 2.1];

const DICE_FLAVOR: Record<number, { text: string; tone: LogEntry['tone'] }> = {
  1: { text: '完全抓不到感覺，練了等於沒練。', tone: 'bad' },
  2: { text: '有練到，但身體很沉。', tone: 'normal' },
  3: { text: '照著課表走完，紮實但不驚喜。', tone: 'normal' },
  4: { text: '手感不錯，教練點頭了。', tone: 'good' },
  5: { text: '狀況很好，連自己都嚇一跳。', tone: 'good' },
  6: { text: '開竅了。這一刻的感覺，你想一輩子記住。', tone: 'great' },
};

/**
 * Almost all of a player is built before 22. After that, training holds the
 * line and buys a couple of points a year; it does not turn a fringe pro into
 * a star. This is what makes the high-school years the real game.
 */
function growthAgeFactor(age: number): number {
  if (age <= 18) return 1.35;
  if (age <= 21) return 1.0;
  if (age <= 25) return 0.5;
  if (age <= 29) return 0.22;
  if (age <= 32) return 0.08;
  return 0.03;
}

function applyTraining(
  state: GameState,
  focus: AttrKey[],
  dice: number,
  power: number,
  r: () => number,
): Partial<Attributes & Meta> {
  const effects = traitEffects(state.traits);
  const deltas: Partial<Attributes & Meta> = {};
  focus.forEach((key) => {
    const headroom = clamp((state.potential[key] - state.attrs[key]) / 22, 0.12, 1);
    const gain = round(
      power * DICE_MULT[dice] * growthAgeFactor(state.age) * effects.growth * headroom * (0.85 + r() * 0.3),
    );
    if (gain !== 0) deltas[key] = (deltas[key] ?? 0) + gain;
  });
  return deltas;
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

interface TrainingOption extends Option {
  focus: AttrKey[];
  power: number;
  fatigue: number;
  meta?: Partial<Meta>;
  rest?: boolean;
}

function batterDrills(): TrainingOption[] {
  return [
    { id: 'swing', label: '揮棒與打擊籠', hint: '打擊 · 選球', focus: ['contact', 'eye'], power: 7.6, fatigue: 8 },
    { id: 'weight', label: '重量訓練', hint: '長打', focus: ['power'], power: 9.2, fatigue: 12, meta: { body: 3 } },
    { id: 'field', label: '守備特訓', hint: '守備 · 跑壘', focus: ['fielding', 'speed'], power: 7.2, fatigue: 9 },
    { id: 'run', label: '跑壘與基礎體能', hint: '跑壘 · 續航力', focus: ['speed', 'stamina'], power: 7.4, fatigue: 10, meta: { body: 4 } },
    { id: 'video', label: '研究對手影片', hint: '選球', focus: ['eye'], power: 8.0, fatigue: 3, meta: { mind: 4 } },
  ];
}

function pitcherDrills(): TrainingOption[] {
  return [
    { id: 'longtoss', label: '長傳與球速強化', hint: '球速', focus: ['velocity'], power: 9.0, fatigue: 12 },
    { id: 'bullpen', label: '牛棚控球練習', hint: '控球', focus: ['control'], power: 8.4, fatigue: 8 },
    { id: 'breaking', label: '變化球研發', hint: '變化球 · 控球', focus: ['breaking', 'control'], power: 7.4, fatigue: 7 },
    { id: 'stamina', label: '長跑與投球數累積', hint: '續航力', focus: ['stamina'], power: 8.6, fatigue: 11, meta: { body: 4 } },
    { id: 'mental', label: '配球與心理訓練', hint: '膽識', focus: ['guts'], power: 7.4, fatigue: 3, meta: { mind: 5 } },
  ];
}

const REST_OPTION: TrainingOption = {
  id: 'rest',
  label: '調整與自主訓練',
  hint: '消除疲勞 · 體能 · 心志',
  // No attribute focus on purpose: resting buys durability, not skill. 膽識 is
  // a pitcher-only stat, so training it here would be a dead gain for batters.
  focus: [],
  power: 0,
  fatigue: -28,
  meta: { body: 5, mind: 3 },
  rest: true,
};

/**
 * Fisher-Yates, not `sort(() => r() - 0.5)`: an inconsistent comparator makes
 * the result depend on the engine's sort implementation, which would break the
 * promise that a seed code rebuilds the same run everywhere.
 */
function shuffled<T>(items: readonly T[], r: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function trainingOptions(state: GameState): TrainingOption[] {
  const drills = IS_PITCHER[state.position] ? pitcherDrills() : batterDrills();
  const r = streamRng(state.seed, `drills:${state.turnIndex}`);
  return [...shuffled(drills, r).slice(0, 3), REST_OPTION];
}

/**
 * Tournaments develop a player too — game reps are worth more than cage reps —
 * so these carry real training value on the position's core attributes.
 */
function tournamentOptions(state: GameState): TrainingOption[] {
  const core: AttrKey[] = IS_PITCHER[state.position]
    ? ['control', 'guts']
    : ['contact', 'eye'];
  return [
    {
      id: 't-allin',
      label: '拚了，這是我的夏天',
      hint: '成長與人氣最大，疲勞與受傷風險最高',
      focus: core,
      power: 6.2,
      fatigue: 26,
    },
    {
      id: 't-balance',
      label: '照著配置上場',
      hint: '穩定發揮，風險中等',
      focus: core,
      power: 4.6,
      fatigue: 14,
    },
    {
      id: 't-protect',
      label: '保護身體為重',
      hint: '表現保守，但把身體完整帶到下一年',
      focus: core,
      power: 3.0,
      fatigue: 4,
      meta: { body: 3 },
    },
  ];
}

function proOptions(state: GameState): TrainingOption[] {
  const base = trainingOptions(state);
  if (state.meta.fame >= 55 && state.age <= 33) {
    base.splice(3, 0, {
      id: 'overseas-camp',
      label: '海外自主訓練',
      hint: '成長效率高，花費體力也高',
      focus: IS_PITCHER[state.position]
        ? ['velocity', 'breaking']
        : ['power', 'contact'],
      power: 5.0,
      fatigue: 16,
      meta: { mind: 3, fame: 3 },
    });
  }
  return base;
}

function pathOptions(state: GameState): Option[] {
  const rating = overall(state.attrs, state.position);
  const canOverseas = rating >= 60 && state.meta.fame >= 45;
  return [
    { id: 'path-draft', label: '投入中華職棒選秀', hint: '現在就賭一把。落選就要另尋出路。' },
    { id: 'path-college', label: '進入大學球隊', hint: '四年時間繼續長大，22 歲再進選秀。' },
    { id: 'path-corp', label: '加入社會人球隊', hint: '一邊上班一邊打球，三年後再拚選秀。' },
    {
      id: 'path-overseas',
      label: '直接挑戰旅美',
      hint: canOverseas
        ? '簽下小聯盟合約，從最底層往上爬。'
        : '球探還沒把你放進名單。',
      disabled: !canOverseas,
      disabledReason: '需要綜合能力 60 以上且人氣 45 以上',
    },
  ];
}

function buildDecision(state: GameState): Decision {
  if (state.retired) {
    return { kind: 'continue', title: '生涯結束', prompt: '', options: [] };
  }

  // --- High school ---
  if (state.stage === 'highschool') {
    if (state.turnIndex >= HS_TURNS) {
      return {
        kind: 'path',
        title: '畢業之後',
        prompt: `${state.name}，高中三年結束了。制服脫下來之後，你要往哪裡走？`,
        options: pathOptions(state),
      };
    }
    const turn = HS_SCHEDULE[state.turnIndex];
    if (turn.tournament) {
      return {
        kind: 'training',
        title: turn.tournament,
        prompt: `${turn.label}，${turn.tournament}開打。你打算怎麼面對這個夏天？`,
        options: tournamentOptions(state),
      };
    }
    return {
      kind: 'training',
      title: turn.label,
      prompt: '這一季的練習，你要把時間放在哪裡？',
      options: trainingOptions(state).map((o) => ({ ...o })),
    };
  }

  // --- Amateur (college / corporate) ---
  if (state.stage === 'amateur') {
    const done = state.league === 'college' ? state.age >= 22 : state.age >= 21;
    if (done) {
      const rating = overall(state.attrs, state.position);
      return {
        kind: 'path',
        title: '再一次選秀',
        prompt: '業餘生涯告一段落，這次是真正的最後機會。',
        options: [
          { id: 'path-draft', label: '投入中華職棒選秀', hint: '把這幾年的成果攤在球探面前。' },
          {
            id: 'path-overseas',
            label: '挑戰旅美小聯盟',
            hint: rating >= 58 ? '有球團願意給合約。' : '目前沒有球團遞出合約。',
            disabled: rating < 58,
            disabledReason: '需要綜合能力 58 以上',
          },
          { id: 'path-quit', label: '離開球場', hint: '把球具收進櫃子，回去過另一種人生。' },
        ],
      };
    }
    return {
      kind: 'training',
      title: turnLabel(state),
      prompt: '球季前的自主訓練，重點放在哪裡？',
      options: trainingOptions(state).map((o) => ({ ...o })),
    };
  }

  // --- Professional ---
  const offer = pendingOffer(state);
  if (offer) return offer;

  const retireKey = `retire:${state.year}`;
  if (shouldOfferRetirement(state) && !state.handled.includes(retireKey)) {
    return {
      kind: 'retire',
      key: retireKey,
      title: '去留',
      prompt: `${state.age} 歲。身體、數字、合約，每一樣都在提醒你時間到了。`,
      options: [
        { id: 'retire-yes', label: '宣布引退', hint: '在還能好好走下球場的時候離開。' },
        { id: 'retire-no', label: '再打一年', hint: '不甘心。至少再站上去一次。' },
      ],
    };
  }

  return {
    kind: 'training',
    title: turnLabel(state),
    prompt: `${state.team}（${LEAGUES[state.league].label}）。休賽期的重點是？`,
    options: proOptions(state).map((o) => ({ ...o })),
  };
}

/**
 * Posting, promotion and the flight home all arrive as a one-off offer turn
 * that costs no year. Each carries a `key` so that declining it does not make
 * `buildDecision` hand back the very same offer on the next call.
 */
function pendingOffer(state: GameState): Decision | null {
  if (state.stage !== 'pro') return null;
  const rating = overall(state.attrs, state.position);
  const r = streamRng(state.seed, `offer:${state.year}`);
  const unhandled = (key: string) => !state.handled.includes(key);

  const overseasKey = `overseas:${state.year}`;
  if (
    state.league === 'cpbl' &&
    state.counters.proSeasons >= 3 &&
    state.age <= 31 &&
    rating >= 66 &&
    state.meta.fame >= 55 &&
    unhandled(overseasKey) &&
    r() < 0.5
  ) {
    return {
      kind: 'offer',
      key: overseasKey,
      title: '海外的邀請',
      prompt: '球季結束後，經紀人帶來兩份來自海外的意向書。',
      options: [
        { id: 'offer-npb', label: '前往日本職棒', hint: '一軍門檻高，但環境穩定、球技磨得細。' },
        { id: 'offer-mlb', label: '挑戰美國職棒', hint: '從小聯盟開始，打上去就是另一個世界。' },
        { id: 'offer-stay', label: '留在中職', hint: '這裡有你熟悉的球迷與球場。' },
      ],
    };
  }

  const promoteKey = `promote:${state.year}`;
  if (state.league === 'milb' && rating >= 64 && unhandled(promoteKey)) {
    return {
      kind: 'offer',
      key: promoteKey,
      title: '升上大聯盟',
      prompt: '球團通知你收拾行李。你等這通電話很久了。',
      options: [{ id: 'offer-promote', label: '登上大聯盟', hint: '走進那個從小在電視裡看的球場。' }],
    };
  }

  const returnKey = `return:${state.year}`;
  if (
    state.league !== 'cpbl' &&
    state.age >= 33 &&
    rating < LEAGUES[state.league].baseline - 4 &&
    unhandled(returnKey)
  ) {
    return {
      kind: 'offer',
      key: returnKey,
      title: '回家的班機',
      prompt: '海外球團不再續約，中職球隊遞出一份「回來吧」的合約。',
      options: [
        { id: 'offer-return', label: '回中職', hint: '在熟悉的球場把生涯打完。' },
        { id: 'offer-stay', label: '留在海外拚一年', hint: '不甘心就這樣結束。' },
      ],
    };
  }

  return null;
}

function shouldOfferRetirement(state: GameState): boolean {
  if (state.stage !== 'pro') return false;
  if (state.age < 31) return false;
  const rating = overall(state.attrs, state.position);
  const declining = rating < LEAGUES[state.league].baseline - 2;
  return state.age >= 34 || (declining && state.age >= 31) || state.injury?.severity === 'career';
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export function resolve(state: GameState, optionId: string): GameState {
  const next: GameState = structuredClone(state);
  const decision = next.decision;
  if (!decision || next.retired) return next;
  const option = decision.options.find((o) => o.id === optionId);
  if (!option || option.disabled) return next;

  next.choices.push(optionId);
  if (decision.key) next.handled.push(decision.key);

  switch (decision.kind) {
    case 'training':
      resolveTraining(next, option as TrainingOption);
      break;
    case 'path':
      resolvePath(next, optionId);
      break;
    case 'offer':
      resolveOffer(next, optionId);
      break;
    case 'retire':
      if (optionId === 'retire-yes') retire(next, '在還走得動的時候，自己選了離開的時間。');
      else {
        next.report = {
          label: turnLabel(next),
          dice: null,
          headline: '再打一年',
          lines: ['你把球具重新擦過一遍。理由很簡單：還沒打夠。'],
          deltas: {},
          season: null,
          traitsUnlocked: [],
          tone: 'good',
        };
        applyDeltas(next, { mind: 4 });
      }
      break;
    default:
      break;
  }

  if (!next.retired) {
    checkTraits(next);
    next.decision = buildDecision(next);
  } else {
    next.decision = { kind: 'continue', title: '生涯結束', prompt: '', options: [] };
  }
  return next;
}

function checkTraits(state: GameState, report?: TurnReport): void {
  const unlocked = newlyUnlocked(state);
  unlocked.forEach((id) => {
    state.traits.push(id);
    const trait = traitById(id);
    if (!trait) return;
    if (id === 'genius') {
      (Object.keys(state.potential) as AttrKey[]).forEach((key) => {
        state.potential[key] = clamp(state.potential[key] + 8, 0, 99);
      });
    }
    pushLog(state, '覺醒', `隱藏特質【${trait.label}】——${trait.desc}`, 'great');
    report?.traitsUnlocked.push(id);
  });
}

function resolveTraining(state: GameState, option: TrainingOption): void {
  const r = rng(state, 'train');
  const dice = rollDice(state, r);
  const flavor = DICE_FLAVOR[dice];

  const report: TurnReport = {
    label: turnLabel(state),
    dice,
    headline: option.label,
    lines: [flavor.text],
    deltas: {},
    season: null,
    traitsUnlocked: [],
    tone: flavor.tone,
  };

  if (state.age < 22 && dice === 6) state.counters.earlySixes += 1;
  if (option.rest) state.counters.restTurns += 1;

  const deltas = applyTraining(state, option.focus, dice, option.power, r);
  deltas.fatigue = (deltas.fatigue ?? 0) + option.fatigue;
  Object.entries(option.meta ?? {}).forEach(([key, value]) => {
    const k = key as keyof Meta;
    deltas[k] = (deltas[k] ?? 0) + (value as number);
  });
  applyDeltas(state, deltas);
  report.deltas = deltas;

  // The turn's competition: a high-school tournament, or a full pro season.
  if (state.stage === 'highschool') {
    const turn = HS_SCHEDULE[state.turnIndex];
    if (turn.tournament) runTournament(state, report, turn.tournament, option.id);
  } else {
    runSeason(state, report);
  }

  // Flavour event, injuries and ageing all land after the year is played.
  const event = pickEvent(state, rng(state, 'event'));
  if (event && rng(state, 'event-fire')() < 0.55) {
    report.lines.push(event.text);
    applyDeltas(state, event.deltas ?? {});
    (Object.entries(event.deltas ?? {}) as [DeltaKey, number][]).forEach(([key, value]) => {
      report.deltas[key] = (report.deltas[key] ?? 0) + value;
    });
    if (event.tone === 'great' || (event.tone === 'good' && report.tone === 'normal')) {
      report.tone = event.tone;
    }
  }

  checkInjury(state, report, option.fatigue);
  checkTraits(state, report);
  advanceTime(state);
  if (!state.retired) checkRelease(state, report);

  pushLog(state, report.label, `${report.headline}：${report.lines.join(' ')}`, report.tone);
  state.report = report;
}

/**
 * Nobody gets to coast to 40. Two straight seasons well under the league's bar
 * and the club stops calling; past 40 the body decides for you. Without this,
 * a merely adequate player accumulated twenty seasons and walked into the
 * hall of fame on volume alone.
 */
function checkRelease(state: GameState, report: TurnReport): void {
  if (state.age >= 39) {
    retire(state, '三十九歲的球季結束後，身體已經追不上這個舞台了。', report);
    return;
  }
  if (state.stage === 'pro' && state.counters.badSeasons >= 2 && state.age >= 24) {
    retire(state, '球團沒有遞出續約合約，其他隊也沒有。電話就這樣不再響了。', report);
  }
}

function runTournament(state: GameState, report: TurnReport, name: string, optionId: string): void {
  const effects = traitEffects(state.traits);
  const intensity = optionId === 't-allin' ? 1.25 : optionId === 't-protect' ? 0.75 : 1;
  const r = rng(state, 'tournament');

  const result = simulateTournament(
    {
      attrs: state.attrs,
      meta: state.meta,
      position: state.position,
      league: 'hs',
      health: state.injury ? 0.4 : 1,
      clutch: effects.clutch * intensity,
      rng: r,
    },
    randInt(r, 3, 6),
  );

  const rating = overall(state.attrs, state.position);
  const runScore = rating * intensity + state.meta.mind * 0.25 + noise(r, 18);
  let outcome: string;
  let fame = 0;
  if (runScore >= 78) {
    outcome = `${name}　全國冠軍`;
    fame = 26;
    state.counters.hsTournamentWins += 1;
    report.tone = 'great';
  } else if (runScore >= 62) {
    outcome = `${name}　挺進四強`;
    fame = 14;
    report.tone = 'good';
  } else if (runScore >= 46) {
    outcome = `${name}　止步八強`;
    fame = 7;
  } else if (runScore >= 32) {
    outcome = `${name}　第二輪出局`;
    fame = 3;
  } else {
    outcome = `${name}　第一輪就結束了`;
    fame = 1;
    report.tone = 'bad';
  }

  applyDeltas(state, { fame, guts: runScore >= 62 ? 3 : 1 });
  report.deltas.fame = (report.deltas.fame ?? 0) + fame;

  const record: SeasonRecord = {
    year: state.year,
    age: state.age,
    league: 'hs',
    team: state.team,
    line: result.line,
    awards: runScore >= 78 ? ['最有價值球員'] : [],
    note: outcome,
  };
  state.history.push(record);
  report.season = record;
  report.lines.push(`${outcome}　${describeLine(result.line)}`);
}

function runSeason(state: GameState, report: TurnReport): void {
  const effects = traitEffects(state.traits);
  const r = rng(state, 'season');
  const health = state.injury ? (state.injury.severity === 'minor' ? 0.7 : 0.35) : 1;

  const result = simulateSeason({
    attrs: state.attrs,
    meta: state.meta,
    position: state.position,
    league: state.league,
    health,
    clutch: effects.clutch,
    rng: r,
  });

  const awards = [...result.awards];
  if (state.stage === 'pro' && state.counters.proSeasons === 0 && result.quality >= 0.5 && r() < 0.6) {
    awards.push('新人王');
  }

  // International tournaments come round every few years and move fame hard.
  const intlYear = state.age >= 20 && (state.year % 3 === 0) && state.meta.fame >= 35;
  let intlNote: string | null = null;
  if (intlYear) {
    const tournament = pick(r, ['世界棒球經典賽', '亞洲錦標賽', '十二強賽', '奧運棒球']);
    const perf = overall(state.attrs, state.position) * effects.clutch + state.meta.mind * 0.2 + noise(r, 14);
    state.counters.intlAppearances += 1;
    if (perf >= LEAGUES[state.league].baseline + 14) {
      state.counters.intlStrong += 1;
      applyDeltas(state, { fame: round(16 * effects.fameGain), guts: 3, mind: 3 });
      intlNote = `${tournament}：關鍵時刻站出來，全國都在看那一球。`;
      report.tone = 'great';
    } else if (perf >= LEAGUES[state.league].baseline) {
      applyDeltas(state, { fame: round(7 * effects.fameGain), guts: 1 });
      intlNote = `${tournament}：入選國家隊，表現稱職。`;
    } else {
      applyDeltas(state, { fame: -4, mind: -3 });
      intlNote = `${tournament}：在最重要的比賽裡失手，被罵得很慘。`;
      report.tone = 'bad';
    }
  }

  // Fame fades on its own, so it settles at a level the player keeps earning
  // rather than ratcheting to 100 and staying there for twenty years.
  const decay = round(state.meta.fame * 0.1);
  const fameGain = round((result.quality * 14 + awards.length * 6) * effects.fameGain) - decay;
  applyDeltas(state, { fame: fameGain });
  report.deltas.fame = (report.deltas.fame ?? 0) + fameGain;

  const record: SeasonRecord = {
    year: state.year,
    age: state.age,
    league: state.league,
    team: state.team,
    line: result.line,
    awards,
    note: intlNote ?? undefined,
  };
  state.history.push(record);
  report.season = record;
  report.lines.push(describeLine(result.line));
  if (awards.length > 0) {
    report.lines.push(`獲獎：${awards.join('、')}`);
    if (report.tone === 'normal') report.tone = 'good';
  }
  if (intlNote) report.lines.push(intlNote);

  if (state.stage === 'pro') {
    state.counters.proSeasons += 1;
    // The bar a player has to clear rises with age: a club carries a 23-year-old
    // who is a bit short because he might still grow, and cuts a 35-year-old at
    // the same level because a 23-year-old is standing right behind him.
    const bar = LEAGUES[state.league].baseline - 6 + Math.max(0, (state.age - 28) * 2);
    if (overall(state.attrs, state.position) < bar) state.counters.badSeasons += 1;
    else state.counters.badSeasons = 0;
  }
  if (!state.injury && result.line.games >= LEAGUES[state.league].games * 0.85) {
    state.counters.fullSeasons += 1;
  } else if (state.injury) {
    state.counters.fullSeasons = 0;
  }

  applyDecline(state, report, effects.decline);
}

function applyDecline(state: GameState, report: TurnReport, declineMul: number): void {
  const onset = state.traits.includes('ascetic') ? 32 : 30;
  if (state.age < onset) return;
  const r = rng(state, 'decline');
  // Steep enough that the thirties actually take the game away from you:
  // a gentler curve let training offset the loss and produced 22-season
  // careers for everyone.
  const severity = (state.age - onset + 1) * 0.8 * declineMul;
  attrsForPosition(state.position).forEach((key) => {
    const loss = round(severity * (0.6 + r() * 0.9));
    if (loss > 0) {
      state.attrs[key] = clamp(state.attrs[key] - loss, 0, 99);
      report.deltas[key] = (report.deltas[key] ?? 0) - loss;
    }
  });
  applyDeltas(state, { body: -round(2 * declineMul) });
}

function checkInjury(state: GameState, report: TurnReport, fatigueCost: number): void {
  if (state.injury) {
    state.injury.seasonsLeft -= 1;
    if (state.injury.seasonsLeft <= 0) {
      report.lines.push(`${state.injury.name}復健完成，你回到球場上。`);
      state.injury = null;
    } else {
      report.lines.push(`${state.injury.name}仍在復健中。`);
    }
    return;
  }

  const effects = traitEffects(state.traits);
  const base = state.stage === 'highschool' ? 0.035 : 0.065;
  const chance =
    base *
    effects.injury *
    (1 + Math.max(0, state.meta.fatigue - 45) / 55) *
    (1 + Math.max(0, fatigueCost) / 60) *
    clamp(1.5 - state.meta.body / 120, 0.6, 1.6) *
    (state.age >= 31 ? 1.4 : 1);

  const r = rng(state, 'injury');
  if (r() >= chance) return;

  const pool = INJURIES.filter((i) => {
    if (i.name.includes('Tommy John')) return state.position === 'P';
    // A high schooler can get hurt, but the career-altering surgeries belong to
    // bodies that have already thrown or run professionally for years.
    if (i.severity === 'career') return state.stage !== 'highschool';
    return true;
  });
  const injury = pick(r, pool);
  state.injury = { name: injury.name, seasonsLeft: injury.seasons, severity: injury.severity };
  state.counters.injuries += 1;
  state.counters.fullSeasons = 0;

  // A pulled hamstring costs you games, not ability; only the serious ones
  // take something permanent away.
  const cost = injury.severity === 'career' ? 7 : injury.severity === 'major' ? 4 : 0;
  if (cost > 0) {
    attrsForPosition(state.position).forEach((key) => {
      const loss = round(cost * (0.5 + r() * 0.8));
      state.attrs[key] = clamp(state.attrs[key] - loss, 0, 99);
      report.deltas[key] = (report.deltas[key] ?? 0) - loss;
    });
  }
  applyDeltas(state, { body: -6, mind: -4 });
  report.lines.push(`受傷：${injury.name}。${injury.seasons > 0 ? '需要長期復健。' : '所幸不算嚴重。'}`);
  report.tone = 'bad';
}

function advanceTime(state: GameState): void {
  state.turnIndex += 1;
  state.meta.fatigue = clamp(state.meta.fatigue - 6, 0, 100);
  if (state.stage === 'highschool') {
    // Three high-school years pass over eleven turns; age ticks each spring.
    const turn = HS_SCHEDULE[Math.min(state.turnIndex, HS_TURNS - 1)];
    if (state.turnIndex < HS_TURNS && turn.season === '春') {
      state.age += 1;
      state.year += 1;
    }
    if (state.turnIndex >= HS_TURNS) {
      state.age = 18;
      state.year = START_YEAR + 2;
    }
    return;
  }
  state.age += 1;
  state.year += 1;
}

// ---------------------------------------------------------------------------
// Career paths
// ---------------------------------------------------------------------------

function draftScore(state: GameState, r: () => number): number {
  return overall(state.attrs, state.position) * 1.15 + state.meta.fame * 0.35 + noise(r, 10);
}

function resolvePath(state: GameState, optionId: string): void {
  const r = rng(state, 'path');
  const report: TurnReport = {
    label: `${state.year} 年`,
    dice: null,
    headline: '',
    lines: [],
    deltas: {},
    season: null,
    traitsUnlocked: [],
    tone: 'normal',
  };

  if (optionId === 'path-college' || optionId === 'path-corp') {
    const league: LeagueId = optionId === 'path-college' ? 'college' : 'corp';
    state.stage = 'amateur';
    state.league = league;
    state.team = pick(r, TEAMS[league]);
    report.headline = optionId === 'path-college' ? '升學' : '進入社會人球隊';
    report.lines.push(`你成為 ${state.team} 的一員，繼續在 ${LEAGUES[league].label} 磨練。`);
    report.tone = 'good';
  } else if (optionId === 'path-overseas') {
    state.stage = 'pro';
    state.league = 'milb';
    state.team = pick(r, TEAMS.milb);
    applyDeltas(state, { fame: 18, mind: -4 });
    report.headline = '簽下小聯盟合約';
    report.lines.push(`你飛去了地球另一端，落腳在 ${state.team}。語言、食物、球風，全都要重新學。`);
    report.tone = 'great';
  } else if (optionId === 'path-quit') {
    retire(state, '沒有被任何球團選上。你把球具收好，走進另一種人生。');
    return;
  } else {
    // 中職選秀
    const score = draftScore(state, r);
    let rank: number;
    let note: string;
    if (score >= 88) {
      rank = 1;
      note = '第一指名！鎂光燈全部打在你身上。';
      applyDeltas(state, { fame: 30, mind: 5 });
      report.tone = 'great';
    } else if (score >= 76) {
      rank = 1;
      note = '第一輪中選，球團說你是即戰力。';
      applyDeltas(state, { fame: 18, mind: 3 });
      report.tone = 'great';
    } else if (score >= 66) {
      rank = 2;
      note = '第二輪中選，是需要時間培養的潛力股。';
      applyDeltas(state, { fame: 10 });
      report.tone = 'good';
    } else if (score >= 55) {
      rank = 4;
      note = '中後段輪次被點名，至少門是開的。';
      applyDeltas(state, { fame: 4 });
      report.tone = 'good';
    } else if (score >= 46) {
      rank = 9;
      note = '育成選秀最後才聽到自己的名字，薪水很薄。';
      applyDeltas(state, { mind: -3 });
    } else {
      rank = 0;
      note = '從第一輪坐到最後一輪，名字始終沒有被念到。';
      applyDeltas(state, { fame: -5, mind: -8 });
      report.tone = 'bad';
    }
    state.pendingDraftRank = rank;

    if (rank === 0) {
      if (state.stage === 'amateur') {
        retire(state, '兩次選秀都落空。你在最後一場練習賽後，跟隊友一一握手。');
        return;
      }
      state.stage = 'amateur';
      state.league = 'corp';
      state.team = pick(r, TEAMS.corp);
      report.headline = '選秀落選';
      report.lines.push(note, `你先到 ${state.team} 落腳，等下一次機會。`);
    } else {
      state.stage = 'pro';
      state.league = 'cpbl';
      state.team = pick(r, TEAMS.cpbl);
      report.headline = `${state.team} 指名`;
      report.lines.push(note, `你穿上 ${state.team} 的球衣，職業生涯正式開始。`);
    }
  }

  pushLog(state, report.label, `${report.headline}：${report.lines.join(' ')}`, report.tone);
  state.report = report;
}

function resolveOffer(state: GameState, optionId: string): void {
  const r = rng(state, 'offer-resolve');
  const report: TurnReport = {
    label: `${state.year} 年`,
    dice: null,
    headline: '',
    lines: [],
    deltas: {},
    season: null,
    traitsUnlocked: [],
    tone: 'good',
  };

  switch (optionId) {
    case 'offer-npb':
      state.league = 'npb';
      state.team = pick(r, TEAMS.npb);
      applyDeltas(state, { fame: 16, mind: -3 });
      report.headline = '旅日';
      report.lines.push(`${state.team} 把你買下。日本的訓練量讓你第一個月幾乎站不起來。`);
      break;
    case 'offer-mlb':
      state.league = 'milb';
      state.team = pick(r, TEAMS.milb);
      applyDeltas(state, { fame: 14, mind: -5 });
      report.headline = '旅美';
      report.lines.push(`你選了最難的一條路，從 ${state.team} 的長途巴士開始。`);
      break;
    case 'offer-promote':
      state.league = 'mlb';
      state.team = pick(r, TEAMS.mlb);
      applyDeltas(state, { fame: 25, mind: 8 });
      report.headline = '登上大聯盟';
      report.lines.push(`${state.team} 把你叫上來了。走出球員通道的那一刻，草皮綠得不真實。`);
      report.tone = 'great';
      break;
    case 'offer-return':
      state.league = 'cpbl';
      state.team = pick(r, TEAMS.cpbl);
      applyDeltas(state, { fame: 8, mind: 5 });
      report.headline = '回到中職';
      report.lines.push(`${state.team} 為你辦了記者會。球迷還記得你。`);
      break;
    default:
      report.headline = '留下';
      report.lines.push('你決定留在原本的地方，把沒做完的事做完。');
      applyDeltas(state, { mind: 4, fame: 3 });
      break;
  }

  pushLog(state, report.label, `${report.headline}：${report.lines.join(' ')}`, report.tone);
  state.report = report;
}

// ---------------------------------------------------------------------------
// Retirement & summary
// ---------------------------------------------------------------------------

/**
 * `into` lets a retirement that happens *during* a played season append to that
 * season's report rather than replace it — the player still gets to read how
 * the last year went before the curtain comes down.
 */
function retire(state: GameState, reason: string, into?: TurnReport): void {
  state.retired = true;
  state.stage = 'over';
  state.summary = buildSummary(state);
  pushLog(state, '引退', `${reason} ${state.summary.epitaph}`, 'normal');

  if (into) {
    into.lines.push(reason, state.summary.epitaph);
    return;
  }
  state.report = {
    label: `${state.year} 年`,
    dice: null,
    headline: '引退',
    lines: [reason, state.summary.epitaph],
    deltas: {},
    season: null,
    traitsUnlocked: [],
    tone: 'normal',
  };
}

export function buildSummary(state: GameState): Summary {
  const pro = state.history.filter((h) => h.league !== 'hs');
  const totals = {
    seasons: pro.length,
    games: 0,
    hits: 0,
    hr: 0,
    rbi: 0,
    sb: 0,
    avg: 0,
    wins: 0,
    losses: 0,
    saves: 0,
    so: 0,
    ip: 0,
    era: 0,
  };
  let ab = 0;
  let earnedRunSum = 0;

  pro.forEach((record) => {
    totals.games += record.line.games;
    if (record.line.kind === 'batter') {
      ab += record.line.ab;
      totals.hits += record.line.hits;
      totals.hr += record.line.hr;
      totals.rbi += record.line.rbi;
      totals.sb += record.line.sb;
    } else {
      totals.wins += record.line.wins;
      totals.losses += record.line.losses;
      totals.saves += record.line.saves;
      totals.so += record.line.so;
      totals.ip += record.line.ip;
      earnedRunSum += (record.line.era * record.line.ip) / 9;
    }
  });
  totals.avg = ab > 0 ? totals.hits / ab : 0;
  totals.ip = Math.round(totals.ip * 10) / 10;
  totals.era = totals.ip > 0 ? (earnedRunSum * 9) / totals.ip : 0;

  const awardCounts = new Map<string, number>();
  pro.forEach((r) => r.awards.forEach((a) => awardCounts.set(a, (awardCounts.get(a) ?? 0) + 1)));
  const mvp = awardCounts.get('年度 MVP') ?? 0;
  const titles = [...awardCounts.values()].reduce((a, b) => a + b, 0);

  // League strength matters: a season in 大聯盟 is worth more than one in 高中.
  const leagueBonus = pro.reduce((sum, r) => sum + (LEAGUES[r.league].baseline - 45) * 0.6, 0);

  // Weighted so a great pitching career and a great hitting career land in the
  // same range — otherwise every pitcher retires a tier below what they earned.
  const batting = totals.hits * 0.35 + totals.hr * 1.7 + totals.rbi * 0.3 + totals.sb * 0.35;
  const pitching = totals.wins * 8 + totals.so * 0.4 + totals.saves * 4;
  const hofScore = Math.max(
    0,
    round(
      batting +
        pitching +
        titles * 26 +
        mvp * 55 +
        state.meta.fame * 2.2 +
        state.counters.intlStrong * 30 +
        leagueBonus,
    ),
  );

  let verdict: string;
  let epitaph: string;
  if (hofScore >= 2200) {
    verdict = '名人堂首輪高票入選';
    epitaph = '很多年以後，孩子們還會模仿你的打擊姿勢。';
  } else if (hofScore >= 1450) {
    verdict = '名人堂入選';
    epitaph = '球衣號碼被高掛在外野看台上，風一吹就晃。';
  } else if (hofScore >= 850) {
    verdict = '名人堂票選邊緣';
    epitaph = '差一點就進去了。但沒有人能說你不夠努力。';
  } else if (hofScore >= 380) {
    verdict = '稱職的職業球員';
    epitaph = '你在這行待了夠久，久到球場的味道成為身體的一部分。';
  } else if (totals.seasons > 0) {
    verdict = '短暫的職業生涯';
    epitaph = '名字不會被記得，但那些清晨的揮棒是真的。';
  } else {
    verdict = '未竟的棒球夢';
    epitaph = '球具收進櫃子最上層。偶爾路過球場，還是會停下來看兩眼。';
  }

  return {
    hofScore,
    verdict,
    epitaph,
    totals,
    awardCounts: [...awardCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };
}

/** Clears the just-shown report so the next decision can be presented. */
export function acknowledge(state: GameState): GameState {
  const next: GameState = structuredClone(state);
  next.report = null;
  return next;
}

export { overall, turnLabel };

import {
  ATTR_LABELS,
  IS_PITCHER,
  IS_TWO_WAY,
  LEAGUES,
  LEAGUE_PAY,
  META_LABELS,
  ORIGINS,
  TEAMS,
  attrsForPosition,
  formatMoney,
  halfOveralls,
  overall,
} from './config';
import { PITCHES, learnablePitches, pitchInfo, syncBreaking } from './pitches';
import type { Origin } from './config';
import { careerMilestones, careerTotals, seasonFeats } from './milestones';
import { INJURIES, pickEvent } from './events';
import { noise, pick, randInt, seedFromCode, streamRng } from './rng';
import { describeLine, simulateSeason, simulateTournament, simulateTwoWay } from './season';
import {
  challengeById,
  challengeHookKey,
  hookMatchesState,
  situationPickKey,
} from './challenges';
import type {
  AttrKey,
  Attributes,
  CareerFlags,
  Decision,
  DeltaKey,
  GameState,
  Arsenal,
  LeagueId,
  LogEntry,
  Meta,
  Milestone,
  Option,
  PitchId,
  Position,
  SeasonRecord,
  StatLine,
  Summary,
  TurnReport,
} from './types';
import {
  HS_SITUATION_FIRE_CHANCE,
  SITUATION_FIRE_CHANCE,
  pickSituation,
  situationAcceptsDestiny,
  situationById,
} from './situations';
import type { SituationEffects, SituationOption } from './situations';
import { newlyUnlocked, traitById, traitEffects } from './traits';

const START_YEAR = 2010;
/** Fifteen turns across three years — longer than the old eleven-turn sprint. */
export const HS_TURNS = 15;

/**
 * High school runs on a denser calendar than "one pick per season": spring gets
 * a foundation block, year-three adds a pre-summer camp and a winter before
 * the draft fork. The professional stage is three turns a year — 春訓・球季・
 * 球季後 — and every per-turn effect below is divided by this so a full pro
 * season still moves attributes, fatigue and fame by the same total amount.
 */
const PRO_TURNS_PER_YEAR = 3;
const PRO_TURN_SCALE = 1 / PRO_TURNS_PER_YEAR;
const PRO_PHASE_LABELS = ['春訓', '球季', '球季後'] as const;
/** Passive fatigue recovery between turns, split evenly across a pro year. */
const FATIGUE_RECOVERY = 6;

/** Turn 0–14 are the three high-school years; summer (and 黑豹旗) are tournaments. */
interface HsTurn {
  label: string;
  grade: number;
  season: '春' | '夏' | '秋' | '冬';
  tournament: string | null;
  /** Extra prompt flavour for camp / mid-block training turns. */
  camp?: boolean;
}

const HS_SCHEDULE: HsTurn[] = [
  { label: '高一 春・入部', grade: 1, season: '春', tournament: null },
  { label: '高一 春・基礎特訓', grade: 1, season: '春', tournament: null, camp: true },
  { label: '高一 夏', grade: 1, season: '夏', tournament: '高中棒球聯賽' },
  { label: '高一 秋', grade: 1, season: '秋', tournament: null },
  { label: '高一 冬', grade: 1, season: '冬', tournament: null },
  { label: '高二 春・開季', grade: 2, season: '春', tournament: null },
  { label: '高二 春・強化期', grade: 2, season: '春', tournament: null, camp: true },
  { label: '高二 夏', grade: 2, season: '夏', tournament: '高中棒球聯賽' },
  { label: '高二 秋', grade: 2, season: '秋', tournament: '黑豹旗' },
  { label: '高二 冬', grade: 2, season: '冬', tournament: null },
  { label: '高三 春', grade: 3, season: '春', tournament: null },
  { label: '高三 賽前集訓', grade: 3, season: '春', tournament: null, camp: true },
  { label: '高三 夏', grade: 3, season: '夏', tournament: '高中棒球聯賽・最後一夏' },
  { label: '高三 秋', grade: 3, season: '秋', tournament: null },
  { label: '高三 冬・選秀前', grade: 3, season: '冬', tournament: null },
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

/**
 * Every young pitcher shows up with one breaking ball they half-trust. Which
 * one comes from the seed, so the same world hands out the same first pitch.
 */
function startingArsenal(seed: number, breaking: number): Arsenal {
  const r = streamRng(seed, 'arsenal');
  const first = pick(r, PITCHES.filter((p) => p.difficulty <= 1.1));
  return [{ id: first.id, level: Math.max(12, breaking) }];
}

export interface CreateInput {
  seedCode: string;
  name: string;
  position: Position;
  originId: string;
  /** When set, enables that challenge's fixed-turn situation hooks. */
  challengeId?: string | null;
}

export function createGame(input: CreateInput): GameState {
  const seed = seedFromCode(input.seedCode);
  const origin = ORIGINS.find((o) => o.id === input.originId) ?? ORIGINS[0];
  const challengeId =
    input.challengeId && challengeById(input.challengeId) ? input.challengeId : null;

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
    destiny: DESTINY_START,
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
    proTurn: 0,
    team: pick(streamRng(seed, 'hs-team'), TEAMS.hs),
    attrs,
    meta,
    finance: { salary: 0, earnings: 0, endorsements: 0, peakSalary: 0 },
    arsenal: IS_PITCHER[input.position] ? startingArsenal(seed, attrs.breaking) : [],
    injury: null,
    potential: rollPotential(attrs, seed, input.position),
    history: [],
    traits: [],
    milestones: [],
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
    flags: { preferBullpen: false, tradeCooldown: 0, surgeryMiss: 0 },
    log: [],
    choices: [],
    seenEvents: [],
    seenSituations: [],
    pendingSituation: null,
    challengeId,
    decision: null,
    report: null,
    retired: false,
    summary: null,
    pendingDraftRank: null,
    handled: [],
  };

  // `breaking` is derived, never trained directly, so seed it from the arsenal.
  if (state.arsenal.length > 0) syncBreaking(state);

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

/**
 * `breaking` is a projection of the arsenal, so writing to it directly would
 * be silently undone by the next sync. Every change to it — a training gain, a
 * flavour event that hands the pitcher a new grip, ageing, a shoulder tear —
 * has to move the underlying pitches instead.
 *
 * A gain sharpens the pitch they already trust; a loss dulls everything.
 * The 1.6 factor is the inverse of the 0.6 weight the best pitch carries in
 * `breakingFromArsenal`, so a +6 to the aggregate really is worth about +6.
 */
function adjustArsenal(state: GameState, change: number): void {
  if (state.arsenal.length === 0 || change === 0) return;
  if (change > 0) {
    const best = [...state.arsenal].sort((a, b) => b.level - a.level)[0];
    best.level = clamp(round(best.level + change * 1.6), 0, 99);
  } else {
    state.arsenal.forEach((slot) => {
      slot.level = clamp(round(slot.level + change), 0, 99);
    });
  }
  syncBreaking(state);
}

function applyDeltas(state: GameState, deltas: Partial<Attributes & Meta>): void {
  (Object.entries(deltas) as [string, number][]).forEach(([key, value]) => {
    if (key === 'breaking' && state.arsenal.length > 0) {
      adjustArsenal(state, value);
    } else if (key in state.attrs) {
      const k = key as AttrKey;
      state.attrs[k] = clamp(state.attrs[k] + value, 0, 99);
    } else if (key in state.meta) {
      const k = key as keyof Meta;
      state.meta[k] = clamp(state.meta[k] + value, 0, 100);
    }
  });
}

/**
 * Flavour-event deltas fire on the same per-turn cadence as training, so a pro
 * turn scales them down the same way — otherwise three turns of events a year
 * would hand out three times the fame and attribute swing a single event was
 * ever balanced for.
 */
function scaleDeltas(
  deltas: Partial<Attributes & Meta> | undefined,
  scale: number,
): Partial<Attributes & Meta> {
  if (!deltas) return {};
  if (scale === 1) return { ...deltas };
  const out: Partial<Attributes & Meta> = {};
  (Object.entries(deltas) as [keyof (Attributes & Meta), number][]).forEach(([key, value]) => {
    out[key] = round(value * scale);
  });
  return out;
}

export function deltaLabel(key: string): string {
  if (key in ATTR_LABELS) return ATTR_LABELS[key as AttrKey];
  if (key in META_LABELS) return META_LABELS[key as keyof Meta];
  return key;
}

function turnLabel(state: GameState): string {
  if (state.stage === 'highschool') return HS_SCHEDULE[Math.min(state.turnIndex, HS_TURNS - 1)].label;
  if (state.stage === 'pro') {
    const phase = PRO_PHASE_LABELS[state.proTurn] ?? PRO_PHASE_LABELS[0];
    return `${state.year} 年${phase}（${state.age} 歲）`;
  }
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

/** Growth multiplier per die face. Exported so the UI can show the player
 * exactly what a roll was worth without duplicating the balance numbers. */
export const DICE_MULT = [0, 0.15, 0.55, 0.85, 1.15, 1.5, 2.1];

/**
 * 天命 economy. It trickles in every training turn, a natural six tops it up,
 * and the player may pour it into a turn to force a perfect roll. The cost is
 * high enough that a full career only affords a handful of interventions, so
 * it stays a decisive moment rather than a way to erase the dice entirely.
 */
export const DESTINY_START = 20;
export const DESTINY_MAX = 100;
export const DESTINY_COST = 40;
const DESTINY_GAIN_PER_TURN = 5;
/** Two-way players accrue a little extra 天命 — they need more interventions. */
const DESTINY_TWO_WAY_BONUS = 1;
const DESTINY_SIX_BONUS = 8;

/**
 * Whether the player can arm 天命 right now — training force-six, or a
 * situation option that explicitly accepts a destiny boost.
 */
export function canSpendDestiny(state: GameState): boolean {
  if (state.meta.destiny < 1) return false;
  if (state.decision?.kind === 'training') return state.meta.destiny >= DESTINY_COST;
  if (state.decision?.kind === 'event') return situationAcceptsDestiny(state);
  return false;
}

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
  /** Develops one pitch, or 'new' to add one to the repertoire. */
  pitch?: PitchId | 'new';
}

function developPitch(
  state: GameState,
  option: TrainingOption,
  dice: number,
  r: () => number,
  report: TurnReport,
  turnScale: number,
): void {
  const effects = traitEffects(state.traits);
  const scale = DICE_MULT[dice] * growthAgeFactor(state.age) * effects.growth * turnScale;

  if (option.pitch === 'new') {
    const candidates = learnablePitches(state.arsenal);
    if (candidates.length === 0) return;
    const info = candidates[0];
    const level = clamp(round((14 * scale) / info.difficulty), 4, 45);
    state.arsenal.push({ id: info.id, level });
    report.lines.push(`練成了新球種：${info.label}。${info.blurb}`);
  } else {
    const slot = state.arsenal.find((p) => p.id === option.pitch);
    if (!slot) return;
    const info = pitchInfo(slot.id);
    const headroom = clamp((state.potential.breaking - slot.level) / 22, 0.12, 1);
    const gain = round((option.power * scale * headroom * (0.85 + r() * 0.3)) / info.difficulty);
    slot.level = clamp(slot.level + gain, 0, 99);
    report.lines.push(`${info.label}的握法更確實了（${slot.level}）。`);
  }
  syncBreaking(state);
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

function pitcherDrills(state: GameState): TrainingOption[] {
  const drills: TrainingOption[] = [
    { id: 'longtoss', label: '長傳與球速強化', hint: '球速', focus: ['velocity'], power: 9.0, fatigue: 12 },
    { id: 'bullpen', label: '牛棚控球練習', hint: '控球', focus: ['control'], power: 8.4, fatigue: 8 },
    { id: 'stamina', label: '長跑與投球數累積', hint: '續航力', focus: ['stamina'], power: 8.6, fatigue: 11, meta: { body: 4 } },
    { id: 'mental', label: '配球與心理訓練', hint: '膽識', focus: ['guts'], power: 7.4, fatigue: 3, meta: { mind: 5 } },
  ];

  // Sharpening the pitch you already trust versus adding one you do not: the
  // first raises your ceiling slowly, the second widens the repertoire, and
  // the aggregate rating rewards having two or three real weapons.
  const best = [...state.arsenal].sort((a, b) => b.level - a.level)[0];
  if (best) {
    const info = pitchInfo(best.id);
    drills.push({
      id: `pitch-${best.id}`,
      label: `精進${info.label}`,
      hint: `目前 ${best.level}・${info.blurb}`,
      focus: [],
      power: 8.8,
      fatigue: 7,
      pitch: best.id,
    });
  }
  const next = learnablePitches(state.arsenal)[0];
  if (next) {
    drills.push({
      id: 'pitch-new',
      label: `學習新球種：${next.label}`,
      hint: next.blurb,
      focus: [],
      power: 0,
      fatigue: 9,
      pitch: 'new',
    });
  }
  return drills;
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
 * Full training menu — every legal drill plus rest. Earlier builds shuffled a
 * random subset each season; players asked to see the whole board and choose.
 * Order is stable so keyboard 1–N stays predictable across seasons.
 */
function trainingOptions(state: GameState): TrainingOption[] {
  if (IS_TWO_WAY[state.position]) {
    // Every batting drill and every pitching drill: the two-way player still
    // has to pick which half of themselves to feed this block.
    return [...batterDrills(), ...pitcherDrills(state), REST_OPTION];
  }
  const drills = IS_PITCHER[state.position] ? pitcherDrills(state) : batterDrills();
  return [...drills, REST_OPTION];
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

  // Queued high-risk choice cards land before the next training menu.
  const situationDecision = buildSituationDecision(state);
  if (situationDecision) return situationDecision;

  // International call-ups land before the season-playing training menu so the
  // player can accept, trim, or decline before runSeason applies the result.
  const intlCall = pendingIntlCall(state);
  if (intlCall) return intlCall;

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
    const prompt = turn.camp
      ? '集訓菜單全開。這一塊要把時間押在哪一項？'
      : '這一季的練習菜單全開。你要把時間放在哪裡？';
    return {
      kind: 'training',
      title: turn.label,
      prompt,
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
      prompt: '球季前的自主訓練菜單全開，重點放在哪裡？',
      options: trainingOptions(state).map((o) => ({ ...o })),
    };
  }

  // --- Professional ---
  // Offers and the retirement prompt are season-level business — trades,
  // contracts, a call from the front office — so they only surface once a
  // year, at the 球季後 slot, exactly as often as when a pro year was one turn.
  if (state.proTurn === 2) {
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
  }

  return {
    kind: 'training',
    title: turnLabel(state),
    prompt: proPrompt(state),
    options: proOptions(state).map((o) => ({ ...o })),
  };
}

function buildSituationDecision(state: GameState): Decision | null {
  if (!state.pendingSituation) return null;
  const situation = situationById(state.pendingSituation);
  if (!situation) return null;
  const options = situation.options(state).map((option) => {
    const boost = option.destinyBoost;
    let hint = option.hint;
    if (boost) {
      const modeLabel = boost.mode === 'waiveCost' ? '壓過代價' : '翻倍報酬';
      hint = `${hint}｜天命 ${boost.cost}：${modeLabel}`;
    }
    return {
      id: option.id,
      label: option.label,
      hint,
    };
  });
  return {
    kind: 'event',
    key: `situation:${situation.id}:${state.turnIndex}:${state.year}:${state.proTurn}`,
    title: situation.title,
    prompt: situation.prompt(state),
    options,
  };
}

/** Preparation, in-season handling, offseason — a different question each turn. */
function proPrompt(state: GameState): string {
  switch (state.proTurn) {
    case 1:
      return '球季已經開打。這段時間，你想怎麼安排自己？';
    case 2:
      return '球季結束了。休賽期的重點，你想放在哪裡？';
    default:
      return `${state.team}（${LEAGUES[state.league].label}）。春訓的重點，你想放在哪裡？`;
  }
}

/**
 * When fame and the calendar line up, the national team call becomes a real
 * Decision — accept the double schedule, trim to one showcase game, or decline
 * to protect the body. Performance itself still resolves inside `runSeason`.
 */
function pendingIntlCall(state: GameState): Decision | null {
  if (state.stage !== 'amateur' && state.stage !== 'pro') return null;
  const seasonImminent =
    state.stage === 'amateur' || (state.stage === 'pro' && state.proTurn === 1);
  if (!seasonImminent) return null;
  if (state.age < 20 || state.year % 3 !== 0 || state.meta.fame < 35) return null;

  const key = `intl:${state.year}`;
  if (state.handled.includes(key)) return null;

  const r = streamRng(state.seed, `intl-name:${state.year}`);
  const tournament = pick(r, ['世界棒球經典賽', '亞洲錦標賽', '十二強賽', '奧運棒球']);
  return {
    kind: 'offer',
    key,
    title: '國家隊徵召',
    prompt: `${tournament} 的徵召來了。聯盟賽程與國家隊重疊——你要怎麼回？`,
    options: [
      {
        id: 'intl-double',
        label: '接受雙重賽程',
        hint: '全力代表國家；疲勞與傷病風險高，好表現機會最大',
      },
      {
        id: 'intl-one',
        label: '只打一場關鍵戰',
        hint: '保護球季節奏；仍計入出賽，報酬與風險都較小',
      },
      {
        id: 'intl-decline',
        label: '婉拒、守護身體',
        hint: '球團鬆一口氣；球迷與媒體可能不諒解',
      },
    ],
  };
}

/** Commitment recorded when the intl Decision was answered; drives runSeason. */
function intlCommitment(
  state: GameState,
  year: number,
): 'intl-double' | 'intl-one' | 'intl-decline' | null {
  const marker = `intl:${year}:`;
  const hit = state.handled.find((entry) => entry.startsWith(marker));
  if (!hit) return null;
  const plan = hit.slice(marker.length);
  if (plan === 'intl-double' || plan === 'intl-one' || plan === 'intl-decline') return plan;
  return null;
}

const OVERSEAS_ARRIVAL_CHOICES = new Set([
  'offer-npb',
  'offer-mlb',
  'fa-overseas',
  'offer-promote',
  'fa-move',
]);

function choseOverseasArrival(state: GameState): boolean {
  return state.choices.some((id) => OVERSEAS_ARRIVAL_CHOICES.has(id));
}

/**
 * Posting, promotion, the flight home, and the 1–2 follow-up cards that deepen
 * an accepted branch. Each carries a `key` so declining (or answering) does not
 * make `buildDecision` hand back the very same offer on the next call.
 */
function pendingOffer(state: GameState): Decision | null {
  if (state.stage !== 'pro') return null;
  const rating = overall(state.attrs, state.position);
  const r = streamRng(state.seed, `offer:${state.year}`);
  const unhandled = (key: string) => !state.handled.includes(key);

  // Follow-ups first so accepting an overseas / FA offer immediately chains into
  // adaptation (and then a clause / AAA-push card) in the same 球季後 window.
  const followUp = pendingOfferFollowUp(state, rating, unhandled);
  if (followUp) return followUp;

  const overseasKey = `overseas:${state.year}`;
  if (
    state.league === 'cpbl' &&
    state.counters.proSeasons >= 3 &&
    state.age <= 31 &&
    rating >= 66 &&
    state.meta.fame >= 55 &&
    state.flags.tradeCooldown <= 0 &&
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

  // Free agency: nine years of service buys the right to pick an employer.
  const faKey = 'fa';
  if (
    state.league === 'cpbl' &&
    state.counters.proSeasons >= 9 &&
    state.age <= 35 &&
    unhandled(faKey)
  ) {
    return {
      kind: 'offer',
      key: faKey,
      title: '取得自由球員資格',
      prompt: `第 ${state.counters.proSeasons} 個球季結束，你拿到了自由球員資格。桌上有幾份合約。`,
      options: [
        { id: 'fa-move', label: '接受他隊的高薪合約', hint: '薪水大幅提高，但要重新適應一切。' },
        { id: 'fa-stay', label: '留在原球隊', hint: '加薪幅度小一點，換來球迷與球團的敬意。' },
        {
          id: 'fa-overseas',
          label: '用自由身挑戰日職',
          hint: rating >= 64 ? '這可能是最後一次機會了。' : '沒有海外球團遞出合約。',
          disabled: rating < 64,
          disabledReason: '需要綜合能力 64 以上',
        },
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

/**
 * One or two cards after an accepted overseas / FA / promotion fork. Keys are
 * lifetime (`follow:adapt`, `follow:clause`) so a single career only deepens
 * the first big move — later moves stay on the existing offer surface.
 */
function pendingOfferFollowUp(
  state: GameState,
  rating: number,
  unhandled: (key: string) => boolean,
): Decision | null {
  if (!choseOverseasArrival(state)) return null;

  const adaptKey = 'follow:adapt';
  if (unhandled(adaptKey)) {
    if (state.league === 'npb') {
      return {
        kind: 'offer',
        key: adaptKey,
        title: '異鄉適應期',
        prompt: `${state.team} 的自主訓練比想像中更悶。語言、飲食、上下關係——你想怎麼熬過第一個月？`,
        options: [
          {
            id: 'adapt-immerse',
            label: '全力融入當地',
            hint: '球技與心志大漲；疲勞高，想家的夜晚更長',
          },
          {
            id: 'adapt-pace',
            label: '照自己的節奏來',
            hint: '穩定小幅成長，少一點內耗',
          },
          {
            id: 'adapt-homesick',
            label: '心繫台灣、少社交',
            hint: '守住熟悉感；更衣室風評與適應變慢',
          },
        ],
      };
    }
    if (state.league === 'milb') {
      return {
        kind: 'offer',
        key: adaptKey,
        title: '小聯盟適應期',
        prompt: `長途巴士、便宜旅館、陌生的打擊教練。${state.team} 這條路比電視上看起來更顛。`,
        options: [
          {
            id: 'adapt-immerse',
            label: '把每個上場機會當最後一次',
            hint: '能力大漲；疲勞與受傷風險高',
          },
          {
            id: 'adapt-pace',
            label: '跟著體系一步步來',
            hint: '穩健成長，少踩雷',
          },
          {
            id: 'adapt-homesick',
            label: '算著回台灣的機票',
            hint: '心志下滑；人氣在家鄉反而小漲',
          },
        ],
      };
    }
    if (state.league === 'mlb') {
      return {
        kind: 'offer',
        key: adaptKey,
        title: '大聯盟更衣室',
        prompt: '球員通道的燈光比想像中更白。教練問你：要當每天都想上的人，還是先站穩名單？',
        options: [
          {
            id: 'adapt-immerse',
            label: '每天爭先發',
            hint: '膽識與人氣大漲；疲勞與傷病風險高',
          },
          {
            id: 'adapt-pace',
            label: '先站穩 26 人名單',
            hint: '心志穩定，慢慢補上差距',
          },
          {
            id: 'adapt-homesick',
            label: '做完這季再想下一步',
            hint: '保留餘力；媒體會說你不夠餓',
          },
        ],
      };
    }
    if (state.league === 'cpbl' && state.choices.includes('fa-move')) {
      return {
        kind: 'offer',
        key: adaptKey,
        title: '新東家的目光',
        prompt: `${state.team} 的球迷還在適應你的臉。更衣室裡有人把你當救星，也有人把你當過來搶飯碗的。`,
        options: [
          {
            id: 'adapt-immerse',
            label: '加班熟悉新體系',
            hint: '能力與心志上漲；疲勞偏高',
          },
          {
            id: 'adapt-pace',
            label: '先打好自己的比賽',
            hint: '小幅成長，少惹是非',
          },
          {
            id: 'adapt-homesick',
            label: '少說話、少曝光',
            hint: '人氣幾乎不動；心志微幅下滑',
          },
        ],
      };
    }
  }

  const clauseKey = 'follow:clause';
  if (!state.handled.includes(adaptKey) || !unhandled(clauseKey)) return null;

  if (state.league === 'milb') {
    return {
      kind: 'offer',
      key: clauseKey,
      title: '放棄年薪衝一軍？',
      prompt: '球團暗示：若你願意重談保障條款，3A 固定出賽與大聯盟機會會近很多。',
      options: [
        {
          id: 'clause-push',
          label: '自願降薪換固定出賽',
          hint: rating >= 60 ? '年薪縮水，上場與成長空間變大' : '以目前狀態，風險偏高',
        },
        {
          id: 'clause-safe',
          label: '守住合約保障',
          hint: '薪水穩；可能繼續坐板凳',
        },
        {
          id: 'clause-demand',
          label: '要求升上大聯盟或交易',
          hint: '賭氣勢；不成可能弄僵關係',
        },
      ],
    };
  }

  if (state.league === 'npb' || state.league === 'mlb') {
    return {
      kind: 'offer',
      key: clauseKey,
      title: '選擇條款談判',
      prompt: '經紀人把選擇權條款攤在桌上：要保障，還是拿保障去換更多上場時間？',
      options: [
        {
          id: 'clause-safe',
          label: '行使保障、鎖定合約',
          hint: '年薪上修；球團對你的使用更保守',
        },
        {
          id: 'clause-push',
          label: '放棄部分保障換出場',
          hint: '薪資下修；能力與人氣有機會再衝一波',
        },
        {
          id: 'clause-demand',
          label: '要求先發輪值／固定棒次',
          hint: '談得成是大勝；談不成心志受創',
        },
      ],
    };
  }

  if (state.league === 'cpbl' && state.choices.includes('fa-move')) {
    return {
      kind: 'offer',
      key: clauseKey,
      title: '選擇條款與出場時間',
      prompt: '新東家想用選擇權綁住你。你也可以拿它當籌碼，換更明確的定位。',
      options: [
        {
          id: 'clause-safe',
          label: '簽下長年保障',
          hint: '年薪與心志上升；成長空間略收',
        },
        {
          id: 'clause-push',
          label: '縮短保障、換主力承諾',
          hint: '薪水少一點；出場與能力成長較多',
        },
        {
          id: 'clause-demand',
          label: '要求交易條款寫清楚',
          hint: '談判強硬；人氣兩極',
        },
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

export function resolve(state: GameState, optionId: string, useDestiny = false): GameState {
  const next: GameState = structuredClone(state);
  const decision = next.decision;
  if (!decision || next.retired) return next;
  const option = decision.options.find((o) => o.id === optionId);
  if (!option || option.disabled) return next;

  next.choices.push(optionId);
  if (decision.key) next.handled.push(decision.key);

  switch (decision.kind) {
    case 'training':
      // The spend is honoured only when it can actually be paid for, so a
      // stale toggle can never push 天命 negative.
      resolveTraining(next, option as TrainingOption, useDestiny && state.meta.destiny >= DESTINY_COST);
      break;
    case 'event':
      resolveSituation(next, optionId, useDestiny);
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
          milestones: [],
          income: null,
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

function resolveTraining(state: GameState, option: TrainingOption, useDestiny = false): void {
  const r = rng(state, 'train');
  // 天命 forces a perfect roll. The override is deterministic (no dice drawn),
  // so replaying the same choice with the same spend rebuilds the same turn.
  const dice = useDestiny ? 6 : rollDice(state, r);
  const flavor = DICE_FLAVOR[dice];

  const report: TurnReport = {
    label: turnLabel(state),
    dice,
    destinyUsed: useDestiny,
    headline: option.label,
    lines: useDestiny
      ? [`你傾注天命（−${DESTINY_COST}），強行扭轉了這一次的骰。`, flavor.text]
      : [flavor.text],
    deltas: {},
    season: null,
    traitsUnlocked: [],
    milestones: [],
    income: null,
    tone: flavor.tone,
  };

  // 天命 bookkeeping. Spending, the passive trickle and the natural-six top-up
  // all move the pool directly rather than through report.deltas, so a "+5 天命"
  // pill does not clutter every single turn.
  if (useDestiny) state.meta.destiny = clamp(state.meta.destiny - DESTINY_COST, 0, DESTINY_MAX);
  else if (dice === 6) state.meta.destiny = clamp(state.meta.destiny + DESTINY_SIX_BONUS, 0, DESTINY_MAX);
  const destinyGain = DESTINY_GAIN_PER_TURN + (IS_TWO_WAY[state.position] ? DESTINY_TWO_WAY_BONUS : 0);
  state.meta.destiny = clamp(state.meta.destiny + destinyGain, 0, DESTINY_MAX);

  // A pro year is three turns now, not one, so every per-turn effect below is
  // scaled to a third — three turns' worth of training, fatigue and event
  // impact has to sum to the same season total one big turn used to produce.
  // High school and amateur are unaffected (scale stays 1).
  const turnScale = state.stage === 'pro' ? PRO_TURN_SCALE : 1;
  // 球季 is the one turn a pro year actually plays games in; 春訓 and 球季後
  // are preparation and reflection around it.
  const playsSeason = state.stage === 'amateur' || (state.stage === 'pro' && state.proTurn === 1);

  // A forced six is bought, not earned, so it does not count toward 天才 — that
  // trait stays a reward for a genuinely lucky (or high-心志) youth.
  if (!useDestiny && state.age < 22 && dice === 6) state.counters.earlySixes += 1;
  if (option.rest) state.counters.restTurns += turnScale;

  // Pitch work moves the arsenal; `breaking` follows from it, so the delta is
  // read back off the derived rating rather than applied to it.
  const breakingBefore = state.attrs.breaking;
  if (option.pitch) developPitch(state, option, dice, r, report, turnScale);

  const deltas = applyTraining(state, option.focus, dice, option.power * turnScale, r);
  if (option.pitch) {
    const change = state.attrs.breaking - breakingBefore;
    if (change !== 0) deltas.breaking = (deltas.breaking ?? 0) + change;
  }
  const fatigueDelta = round(option.fatigue * turnScale);
  deltas.fatigue = (deltas.fatigue ?? 0) + fatigueDelta;
  Object.entries(option.meta ?? {}).forEach(([key, value]) => {
    const k = key as keyof Meta;
    deltas[k] = (deltas[k] ?? 0) + round((value as number) * turnScale);
  });
  applyDeltas(state, deltas);
  report.deltas = deltas;

  // The turn's competition: a high-school tournament, a full amateur season,
  // or — for the pro stage — just the 球季 turn, since 春訓/球季後 play no games.
  if (state.stage === 'highschool') {
    const turn = HS_SCHEDULE[state.turnIndex];
    if (turn.tournament) runTournament(state, report, turn.tournament, option.id);
  } else if (playsSeason) {
    runSeason(state, report);
  }

  // Flavour event, injuries and ageing all land after the turn is played.
  //
  // The rate is what the pool can actually serve, and that was measured rather
  // than picked. A pro year is three turns now rather than one, so at 0.65 the
  // old pool was already near its limit: the set eligible on a given turn came
  // to a median of 13 once conditions were applied, and 0.85 made events repeat
  // before it was used up. Fourteen unconditional pro events later the eligible
  // set is a median of 26 and 0.8 is comfortable. The `events do not repeat
  // early` check is what draws the line.
  const event = pickEvent(state, rng(state, 'event'));
  const eventChance = 0.8;
  if (event && rng(state, 'event-fire')() < eventChance) {
    state.seenEvents.push(event.id);
    report.lines.push(event.text);
    const eventDeltas = scaleDeltas(event.deltas, turnScale);
    applyDeltas(state, eventDeltas);
    (Object.entries(eventDeltas) as [DeltaKey, number][]).forEach(([key, value]) => {
      report.deltas[key] = (report.deltas[key] ?? 0) + value;
    });
    if (event.tone === 'great' || (event.tone === 'good' && report.tone === 'normal')) {
      report.tone = event.tone;
    }
  }

  // Injury recovery only ticks once a year, on the same turn the season plays,
  // so a one-season injury does not heal three times over in a single year.
  checkInjury(state, report, fatigueDelta, turnScale, state.stage !== 'pro' || playsSeason);
  checkTraits(state, report);
  advanceTime(state);
  if (!state.retired) checkRelease(state, report);
  queueSituation(state);

  pushLog(state, report.label, `${report.headline}：${report.lines.join(' ')}`, report.tone);
  state.report = report;
}

/**
 * After a resolved training turn, maybe queue a high-risk choice for the next
 * decision. Kept out of `buildDecision` so that function stays a pure read of
 * state — the roll happens once, here, and the id rides in `pendingSituation`.
 *
 * Challenge runs may force a scripted card first (fixed-turn hooks), skipping
 * the random fire roll for that turn so narrative gates stay deterministic.
 */
function queueSituation(state: GameState): void {
  if (state.retired || state.pendingSituation) return;
  // Path forks and season-end business should not be interrupted.
  if (state.stage === 'highschool' && state.turnIndex >= HS_TURNS) return;
  if (state.stage === 'amateur') {
    const done = state.league === 'college' ? state.age >= 22 : state.age >= 21;
    if (done) return;
  }

  if (queueChallengeSituationHook(state)) return;

  const fire = rng(state, 'situation-fire')();
  // High school is the real cultivation window — fire a bit more often so
  // the longer calendar actually surfaces high-risk cards.
  const chance =
    state.stage === 'highschool' ? HS_SITUATION_FIRE_CHANCE : SITUATION_FIRE_CHANCE;
  if (fire >= chance) return;
  const situation = pickSituation(state, rng(state, 'situation-pick'));
  if (situation) state.pendingSituation = situation.id;
}

/** Force the next pending scripted hook for the active challenge, if any. */
function queueChallengeSituationHook(state: GameState): boolean {
  if (!state.challengeId) return false;
  const challenge = challengeById(state.challengeId);
  if (!challenge?.situationHooks || challenge.situationHooks.length === 0) return false;

  for (let index = 0; index < challenge.situationHooks.length; index++) {
    const hook = challenge.situationHooks[index];
    const key = challengeHookKey(challenge.id, index);
    if (state.handled.includes(key)) continue;
    if (!hookMatchesState(hook.match, state)) continue;
    if (!situationById(hook.situationId)) continue;
    state.pendingSituation = hook.situationId;
    state.handled.push(key);
    return true;
  }
  return false;
}

function resolveSituation(state: GameState, optionId: string, useDestiny = false): void {
  const situationId = state.pendingSituation;
  const situation = situationId ? situationById(situationId) : undefined;
  state.pendingSituation = null;
  if (!situation) {
    state.report = {
      label: turnLabel(state),
      dice: null,
      headline: '無事發生',
      lines: ['這次的抉擇被時間沖掉了。'],
      deltas: {},
      season: null,
      traitsUnlocked: [],
      milestones: [],
      income: null,
      tone: 'normal',
    };
    return;
  }

  if (!state.seenSituations.includes(situation.id)) {
    state.seenSituations.push(situation.id);
  }

  const chosen: SituationOption | undefined = situation.options(state).find((o) => o.id === optionId);
  const report: TurnReport = {
    label: turnLabel(state),
    dice: null,
    headline: situation.title,
    lines: [],
    deltas: {},
    season: null,
    traitsUnlocked: [],
    milestones: [],
    income: null,
    tone: 'normal',
  };

  if (!chosen) {
    report.lines.push('你沒有做出選擇。機會就這樣過去了。');
    state.report = report;
    pushLog(state, report.label, report.lines.join(' '), report.tone);
    return;
  }

  const pickKey = situationPickKey(situation.id, optionId);
  if (!state.handled.includes(pickKey)) state.handled.push(pickKey);

  report.lines.push(chosen.outcome);
  report.tone = chosen.tone ?? 'normal';

  const boost = chosen.destinyBoost;
  const destinyArmed =
    useDestiny &&
    !!boost &&
    state.meta.destiny >= boost.cost;

  let effects: SituationEffects = { ...chosen.effects };
  if (destinyArmed && boost) {
    state.meta.destiny = clamp(state.meta.destiny - boost.cost, 0, DESTINY_MAX);
    report.destinyUsed = true;
    if (boost.mode === 'waiveCost') {
      effects = waiveSituationCost(effects);
      report.lines.push(`你傾注天命（−${boost.cost}），壓過了這次的代價——受傷風險仍在。`);
    } else {
      effects = doubleSituationReward(effects);
      report.lines.push(`你傾注天命（−${boost.cost}），把報酬翻倍——失敗仍可能受傷。`);
    }
  }

  const { destiny, earnings, injuryChance, flags, intlStrong, ...attrMeta } = effects;
  applyDeltas(state, attrMeta);
  report.deltas = { ...attrMeta };

  if (flags) applyCareerFlags(state, flags, report);

  if (typeof destiny === 'number' && destiny !== 0) {
    state.meta.destiny = clamp(state.meta.destiny + destiny, 0, DESTINY_MAX);
    report.lines.push(destiny > 0 ? `天命 +${destiny}` : `天命 ${destiny}`);
  }
  if (typeof earnings === 'number' && earnings > 0) {
    state.finance.earnings += earnings;
    report.income = earnings;
    report.lines.push(`額外收入 ${formatMoney(earnings)}`);
  }
  if (typeof intlStrong === 'number' && intlStrong > 0) {
    state.counters.intlStrong += intlStrong;
    state.counters.intlAppearances += intlStrong;
    report.lines.push(`國際賽高光 +${intlStrong}`);
  }
  if (injuryChance && injuryChance > 0 && rng(state, 'situation-injury')() < injuryChance) {
    const pool = INJURIES.filter((i) => i.severity !== 'career' || state.stage === 'pro');
    const injury = pick(rng(state, 'situation-injury-pick'), pool);
    state.injury = {
      name: injury.name,
      seasonsLeft: injury.seasons,
      severity: injury.severity,
    };
    state.counters.injuries += 1;
    if (injury.severity !== 'minor') {
      const cost = injury.severity === 'career' ? 7 : 4;
      applyDeltas(state, {
        velocity: -cost,
        stamina: -cost,
        power: -Math.ceil(cost * 0.6),
        speed: -Math.ceil(cost * 0.6),
        body: -cost,
      });
    }
    report.lines.push(`代價來了：${injury.name}。`);
    report.tone = 'bad';
  }

  checkTraits(state, report);
  pushLog(state, report.label, `${report.headline}：${report.lines.join(' ')}`, report.tone);
  state.report = report;
}

/** Strip or soften downside numbers; never touch injuryChance (failure stays risky). */
function waiveSituationCost(effects: SituationEffects): SituationEffects {
  const next: SituationEffects = { ...effects };
  for (const key of Object.keys(next) as (keyof SituationEffects)[]) {
    if (key === 'injuryChance' || key === 'flags' || key === 'intlStrong') continue;
    const value = next[key];
    if (typeof value !== 'number') continue;
    if (key === 'fatigue' && value > 0) {
      next[key] = Math.max(0, Math.round(value * 0.35));
    } else if (value < 0) {
      next[key] = Math.round(value * 0.25);
    }
  }
  return next;
}

/** Double upside numbers; leave costs and injuryChance alone. */
function doubleSituationReward(effects: SituationEffects): SituationEffects {
  const next: SituationEffects = { ...effects };
  for (const key of Object.keys(next) as (keyof SituationEffects)[]) {
    if (key === 'injuryChance' || key === 'flags' || key === 'intlStrong') continue;
    const value = next[key];
    if (typeof value !== 'number' || value <= 0) continue;
    if (key === 'fatigue') continue;
    next[key] = value * 2;
  }
  return next;
}

function applyCareerFlags(
  state: GameState,
  patch: Partial<CareerFlags>,
  report: TurnReport,
): void {
  if (patch.preferBullpen) {
    state.flags.preferBullpen = true;
    report.lines.push('生涯路線：此後以後援角色出賽。');
  }
  if (typeof patch.tradeCooldown === 'number' && patch.tradeCooldown > 0) {
    state.flags.tradeCooldown = Math.max(state.flags.tradeCooldown, patch.tradeCooldown);
    report.lines.push(`交易冷卻：${state.flags.tradeCooldown} 季內難再談正式出走。`);
  }
  if (typeof patch.surgeryMiss === 'number' && patch.surgeryMiss > 0) {
    state.flags.surgeryMiss = Math.max(state.flags.surgeryMiss, patch.surgeryMiss);
    report.lines.push(`手術缺席：接下來 ${state.flags.surgeryMiss} 季出賽將大幅縮水。`);
  }
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

  const tournamentInput = {
    attrs: state.attrs,
    meta: state.meta,
    position: state.position,
    league: 'hs' as const,
    health: state.injury ? 0.4 : 1,
    clutch: effects.clutch * intensity,
    rng: r,
  };
  const games = randInt(r, 3, 6);
  const twoWay = IS_TWO_WAY[state.position];
  // The two-way high schooler is the ace and the cleanup hitter, so the
  // tournament produces both lines just like a professional season does.
  const result = simulateTournament(
    twoWay ? { ...tournamentInput, role: 'batter' } : tournamentInput,
    games,
  );
  const secondary = twoWay
    ? simulateTournament({ ...tournamentInput, role: 'pitcher' }, games).line
    : undefined;

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
    secondary,
    awards: runScore >= 78 ? ['最有價值球員'] : [],
    note: outcome,
  };
  state.history.push(record);
  report.season = record;
  report.lines.push(`${outcome}　${describeLine(result.line)}`);
  if (secondary) report.lines.push(describeLine(secondary));
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

/**
 * Next season's contract. Ability sets the band, last season's results move you
 * inside it, and service time adds the seniority every league pays for.
 */
function salaryFor(state: GameState, quality: number): number {
  const pay = LEAGUE_PAY[state.league];
  if (pay === 0) return 0;
  const edge = overall(state.attrs, state.position) - LEAGUES[state.league].baseline;
  // Steep in the band players actually occupy: a league-average regular sits
  // near 1.0 and a star reaches roughly double, rather than the whole roster
  // bunching up at the bottom of the scale.
  const skill = clamp(0.3 + (edge + 12) / 14, 0.15, 2.6);
  const results = 0.7 + quality * 0.8;
  const service = clamp(0.55 + state.counters.proSeasons * 0.06, 0.55, 1.25);
  return Math.max(round(pay * 0.12), round(pay * skill * results * service));
}

/** Endorsements only start once enough people know the name. */
function endorsementFor(state: GameState): number {
  // Two-way players are easier to sell — brands pay earlier for the dual image.
  const threshold = IS_TWO_WAY[state.position] ? 28 : 35;
  if (state.meta.fame < threshold) return 0;
  const base = round(Math.pow(state.meta.fame - 30, 1.7) / 9);
  return IS_TWO_WAY[state.position] ? round(base * 1.2) : base;
}

function payFor(state: GameState, report: TurnReport, quality: number): void {
  if (LEAGUE_PAY[state.league] === 0) {
    state.finance.salary = 0;
    state.finance.endorsements = 0;
    return;
  }
  // A salary of 0 means the player just arrived in this league; price the
  // first contract off current ability rather than last year's results.
  if (state.finance.salary === 0) state.finance.salary = salaryFor(state, 0.35);

  const endorsements = endorsementFor(state);
  const income = state.finance.salary + endorsements;
  state.finance.endorsements = endorsements;
  state.finance.earnings += income;
  state.finance.peakSalary = Math.max(state.finance.peakSalary, state.finance.salary);
  report.income = income;

  // Next year's deal is negotiated on the back of the season just played.
  state.finance.salary = salaryFor(state, quality);
}

/** Moving leagues voids the contract, so the next one is priced from scratch. */
function moveTo(state: GameState, league: LeagueId, team: string): void {
  state.league = league;
  state.team = team;
  state.finance.salary = 0;
}

function runSeason(state: GameState, report: TurnReport): void {
  const effects = traitEffects(state.traits);
  const r = rng(state, 'season');
  let health = state.injury ? (state.injury.severity === 'minor' ? 0.7 : 0.35) : 1;
  if (state.flags.surgeryMiss > 0) {
    health *= 0.12;
    report.lines.push('手術後缺席季：出賽大幅縮水。');
  }

  const input = {
    attrs: state.attrs,
    meta: state.meta,
    position: state.position,
    league: state.league,
    health,
    clutch: effects.clutch,
    rng: r,
    forceReliever: state.flags.preferBullpen,
  };

  let secondary: StatLine | undefined;
  let result;
  if (IS_TWO_WAY[state.position]) {
    const both = simulateTwoWay(input);
    // The batting line leads and pitching rides along as the secondary, so the
    // rest of the engine keeps treating `line` as the headline performance.
    result = both.batting;
    secondary = both.pitching.line;
    result.awards = [...both.batting.awards, ...both.pitching.awards];
    // Being merely adequate at both should not read as an MVP season, so the
    // combined quality leans on the stronger half rather than summing them.
    result.quality = Math.min(
      1,
      Math.max(both.batting.quality, both.pitching.quality) * 0.75 +
        Math.min(both.batting.quality, both.pitching.quality) * 0.5,
    );
  } else {
    result = simulateSeason(input);
  }

  const awards = [...result.awards];
  if (state.stage === 'pro' && state.counters.proSeasons === 0 && result.quality >= 0.5 && r() < 0.6) {
    awards.push('新人王');
  }

  // International tournaments are an occasional Decision (`pendingIntlCall`).
  // The commitment is recorded in `handled` as `intl:${year}:${option}`; the
  // on-field result still lands on this season's report and counters.
  const intlPlan = intlCommitment(state, state.year);
  let intlNote: string | null = null;
  if (intlPlan && intlPlan !== 'intl-decline') {
    const tournament = pick(
      streamRng(state.seed, `intl-name:${state.year}`),
      ['世界棒球經典賽', '亞洲錦標賽', '十二強賽', '奧運棒球'],
    );
    const oneGame = intlPlan === 'intl-one';
    const clutchMul = oneGame ? 0.92 : 1;
    const perf =
      overall(state.attrs, state.position) * effects.clutch * clutchMul +
      state.meta.mind * 0.2 +
      noise(r, oneGame ? 10 : 14);
    const strongBar = LEAGUES[state.league].baseline + (oneGame ? 18 : 14);
    const fameScale = oneGame ? 0.55 : 1;
    state.counters.intlAppearances += 1;
    if (perf >= strongBar) {
      state.counters.intlStrong += 1;
      applyDeltas(state, {
        fame: round(16 * effects.fameGain * fameScale),
        guts: oneGame ? 2 : 3,
        mind: oneGame ? 2 : 3,
        fatigue: oneGame ? 4 : 10,
      });
      intlNote = oneGame
        ? `${tournament}：只打一場，卻把關鍵打席握在手裡。`
        : `${tournament}：關鍵時刻站出來，全國都在看那一球。`;
      report.tone = 'great';
    } else if (perf >= LEAGUES[state.league].baseline) {
      applyDeltas(state, {
        fame: round(7 * effects.fameGain * fameScale),
        guts: 1,
        fatigue: oneGame ? 3 : 8,
      });
      intlNote = oneGame
        ? `${tournament}：短短一場，表現稱職。`
        : `${tournament}：入選國家隊，表現稱職。`;
    } else {
      applyDeltas(state, {
        fame: oneGame ? -2 : -4,
        mind: oneGame ? -2 : -3,
        fatigue: oneGame ? 2 : 6,
      });
      intlNote = oneGame
        ? `${tournament}：唯一一場沒打好，議論聲還是很大。`
        : `${tournament}：在最重要的比賽裡失手，被罵得很慘。`;
      report.tone = 'bad';
    }
    // Double schedule asks more of the body; one-game trims the injury spike.
    const injuryChance = oneGame ? 0.06 : 0.14;
    if (!state.injury && r() < injuryChance) {
      const pool = INJURIES.filter((i) => i.severity === 'minor');
      const injury = pick(r, pool);
      state.injury = {
        name: injury.name,
        seasonsLeft: injury.seasons,
        severity: injury.severity,
      };
      state.counters.injuries += 1;
      report.lines.push(`國際賽後身體亮紅燈：${injury.name}。`);
    }
  }

  // Fame fades on its own, so it settles at a level the player keeps earning
  // rather than ratcheting to 100 and staying there for twenty years.
  const decay = round(state.meta.fame * 0.1);
  // Two-way seasons are a media product: the same quality line draws more eyes.
  const spectacle = IS_TWO_WAY[state.position] ? 1.18 : 1;
  const fameGain =
    round((result.quality * 14 + awards.length * 6) * effects.fameGain * spectacle) - decay;
  applyDeltas(state, { fame: fameGain });
  report.deltas.fame = (report.deltas.fame ?? 0) + fameGain;
  if (IS_TWO_WAY[state.position] && result.quality >= 0.45) {
    report.lines.push('二刀流話題延續：媒體多寫了你一整版。');
  }

  const record: SeasonRecord = {
    year: state.year,
    age: state.age,
    league: state.league,
    team: state.team,
    line: result.line,
    secondary,
    awards,
    note: intlNote ?? undefined,
  };
  const totalsBefore = careerTotals(state.history);
  state.history.push(record);
  report.season = record;
  report.lines.push(describeLine(result.line));
  if (secondary) report.lines.push(describeLine(secondary));
  if (awards.length > 0) {
    report.lines.push(`獲獎：${awards.join('、')}`);
    if (report.tone === 'normal') report.tone = 'good';
  }
  if (intlNote) report.lines.push(intlNote);

  recordMilestones(state, report, result.line, secondary, result.quality, totalsBefore);
  payFor(state, report, result.quality);

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
  checkTrade(state, report);
  tickCareerFlags(state, report);
}

/** Season-scoped flags count down once per completed pro year. */
function tickCareerFlags(state: GameState, report: TurnReport): void {
  if (state.flags.surgeryMiss > 0) {
    state.flags.surgeryMiss -= 1;
    if (state.flags.surgeryMiss <= 0) {
      report.lines.push('手術缺席期結束，你重新爭取完整出賽。');
    }
  }
  if (state.flags.tradeCooldown > 0) {
    state.flags.tradeCooldown -= 1;
    if (state.flags.tradeCooldown <= 0) {
      report.lines.push('交易冷卻結束，球團不再把「出走」當成禁忌話題。');
    }
  }
}

/**
 * Career totals crossing a round number, plus the one-off feats. Both go into
 * the turn report so the moment lands where the player is looking.
 */
function recordMilestones(
  state: GameState,
  report: TurnReport,
  line: SeasonRecord['line'],
  secondary: StatLine | undefined,
  quality: number,
  totalsBefore: ReturnType<typeof careerTotals>,
): void {
  if (state.league === 'hs') return;
  const found: Milestone[] = [
    ...careerMilestones(totalsBefore, careerTotals(state.history), state),
    ...seasonFeats(state, line, quality, rng(state, 'feats')),
    // A two-way player can throw a no-hitter and hit for the cycle in the same
    // year, so both halves get their own shot at a feat.
    ...(secondary ? seasonFeats(state, secondary, quality, rng(state, 'feats2')) : []),
  ];
  if (found.length === 0) return;
  state.milestones.push(...found);
  found.forEach((m) => report.lines.push(`【紀錄】${m.text}`));
  report.milestones.push(...found);
  applyDeltas(state, { fame: Math.min(12, found.length * 4) });
  if (report.tone === 'normal' || report.tone === 'good') report.tone = 'great';
}

/**
 * Trades are the main reason a career is not spent at one club. Clubs move a
 * player who has stopped clearing the bar, and occasionally shake things up
 * for no reason the player is told about.
 */
function checkTrade(state: GameState, report: TurnReport): void {
  if (state.stage !== 'pro') return;
  const roster = TEAMS[state.league].filter((t) => t !== state.team);
  if (roster.length === 0) return;

  const r = rng(state, 'trade');
  const struggling = state.counters.badSeasons > 0;
  const chance = 0.05 + (struggling ? 0.14 : 0) + (state.age >= 31 ? 0.05 : 0);
  if (r() >= chance) return;

  const from = state.team;
  moveTo(state, state.league, pick(r, roster));
  applyDeltas(state, { mind: -3, fame: -2 });
  report.lines.push(
    struggling
      ? `季後被 ${from} 交易到 ${state.team}。你是被讓出去的那一個。`
      : `一筆突然的交易把你從 ${from} 送到 ${state.team}。`,
  );
}

function applyDecline(state: GameState, report: TurnReport, declineMul: number): void {
  const onset = state.traits.includes('ascetic') ? 32 : 30;
  if (state.age < onset) return;
  const r = rng(state, 'decline');
  // Steep enough that the thirties actually take the game away from you:
  // a gentler curve let training offset the loss and produced 22-season
  // careers for everyone.
  const severity = (state.age - onset + 1) * 0.8 * declineMul;
  const breakingBefore = state.attrs.breaking;
  attrsForPosition(state.position).forEach((key) => {
    const loss = round(severity * (0.6 + r() * 0.9));
    if (loss <= 0) return;
    if (key === 'breaking') {
      adjustArsenal(state, -loss);
      return;
    }
    state.attrs[key] = clamp(state.attrs[key] - loss, 0, 99);
    report.deltas[key] = (report.deltas[key] ?? 0) - loss;
  });
  const breakingLoss = breakingBefore - state.attrs.breaking;
  if (breakingLoss !== 0) report.deltas.breaking = (report.deltas.breaking ?? 0) - breakingLoss;
  applyDeltas(state, { body: -round(2 * declineMul) });
}

function checkInjury(
  state: GameState,
  report: TurnReport,
  fatigueCost: number,
  turnScale: number,
  tickRecovery: boolean,
): void {
  if (state.injury) {
    if (tickRecovery) {
      state.injury.seasonsLeft -= 1;
      if (state.injury.seasonsLeft <= 0) {
        report.lines.push(`${state.injury.name}復健完成，你回到球場上。`);
        state.injury = null;
      } else {
        report.lines.push(`${state.injury.name}仍在復健中。`);
      }
    } else {
      report.lines.push(`${state.injury.name}仍在復健中。`);
    }
    return;
  }

  const effects = traitEffects(state.traits);
  // The base rate is per-year; a pro turn only carries a third of the year's
  // risk, so three turns add up to roughly the same annual chance as before.
  const base = (state.stage === 'highschool' ? 0.035 : 0.065) * turnScale;
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
    const breakingBefore = state.attrs.breaking;
    attrsForPosition(state.position).forEach((key) => {
      const loss = round(cost * (0.5 + r() * 0.8));
      if (key === 'breaking') {
        adjustArsenal(state, -loss);
        return;
      }
      state.attrs[key] = clamp(state.attrs[key] - loss, 0, 99);
      report.deltas[key] = (report.deltas[key] ?? 0) - loss;
    });
    const breakingLoss = breakingBefore - state.attrs.breaking;
    if (breakingLoss !== 0) report.deltas.breaking = (report.deltas.breaking ?? 0) - breakingLoss;
  }
  applyDeltas(state, { body: -6, mind: -4 });
  report.lines.push(`受傷：${injury.name}。${injury.seasons > 0 ? '需要長期復健。' : '所幸不算嚴重。'}`);
  report.tone = 'bad';
}

function advanceTime(state: GameState): void {
  state.turnIndex += 1;
  // Passive recovery between turns is a per-year amount too, split across a
  // pro year's three turns so it does not triple.
  const recovery = state.stage === 'pro' ? round(FATIGUE_RECOVERY / PRO_TURNS_PER_YEAR) : FATIGUE_RECOVERY;
  state.meta.fatigue = clamp(state.meta.fatigue - recovery, 0, 100);

  if (state.stage === 'highschool') {
    // Age ticks when the grade increases (高一→高二→高三), not on every 春
    // label — spring now has mid-block camp turns that must not double-age.
    if (state.turnIndex < HS_TURNS) {
      const turn = HS_SCHEDULE[state.turnIndex];
      const prev = state.turnIndex > 0 ? HS_SCHEDULE[state.turnIndex - 1] : null;
      if (prev && turn.grade > prev.grade) {
        state.age += 1;
        state.year += 1;
      }
    }
    if (state.turnIndex >= HS_TURNS) {
      state.age = 18;
      state.year = START_YEAR + 2;
    }
    return;
  }

  if (state.stage === 'pro') {
    // Age and year only turn over once the offseason turn rolls into next
    // spring's — the same once-a-year cadence a single pro turn used to have.
    state.proTurn = (state.proTurn + 1) % PRO_TURNS_PER_YEAR;
    if (state.proTurn === 0) {
      state.age += 1;
      state.year += 1;
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
    milestones: [],
    income: null,
    tone: 'normal',
  };

  if (optionId === 'path-college' || optionId === 'path-corp') {
    const league: LeagueId = optionId === 'path-college' ? 'college' : 'corp';
    state.stage = 'amateur';
    moveTo(state, league, pick(r, TEAMS[league]));
    report.headline = optionId === 'path-college' ? '升學' : '進入社會人球隊';
    report.lines.push(`你成為 ${state.team} 的一員，繼續在 ${LEAGUES[league].label} 磨練。`);
    report.tone = 'good';
  } else if (optionId === 'path-overseas') {
    state.stage = 'pro';
    state.proTurn = 0;
    moveTo(state, 'milb', pick(r, TEAMS.milb));
    const bonus = 900;
    state.finance.earnings += bonus;
    applyDeltas(state, { fame: 18, mind: -4 });
    report.headline = '簽下小聯盟合約';
    report.lines.push(
      `你飛去了地球另一端，落腳在 ${state.team}，簽約金 ${formatMoney(bonus)}。語言、食物、球風，全都要重新學。`,
    );
    report.income = bonus;
    report.tone = 'great';
  } else if (optionId === 'path-quit') {
    retire(state, '沒有被任何球團選上。你把球具收好，走進另一種人生。');
    return;
  } else {
    // 中職選秀
    const score = draftScore(state, r);
    let rank: number;
    let note: string;
    // The signing bonus is where draft position stops being a bragging right
    // and becomes money — a first pick banks more before his debut than a
    // development pick earns in five years.
    let bonus = 0;
    if (score >= 88) {
      rank = 1;
      bonus = 1200;
      note = '第一指名！鎂光燈全部打在你身上。';
      applyDeltas(state, { fame: 30, mind: 5 });
      report.tone = 'great';
    } else if (score >= 76) {
      rank = 1;
      bonus = 700;
      note = '第一輪中選，球團說你是即戰力。';
      applyDeltas(state, { fame: 18, mind: 3 });
      report.tone = 'great';
    } else if (score >= 66) {
      rank = 2;
      bonus = 350;
      note = '第二輪中選，是需要時間培養的潛力股。';
      applyDeltas(state, { fame: 10 });
      report.tone = 'good';
    } else if (score >= 55) {
      rank = 4;
      bonus = 150;
      note = '中後段輪次被點名，至少門是開的。';
      applyDeltas(state, { fame: 4 });
      report.tone = 'good';
    } else if (score >= 46) {
      rank = 9;
      bonus = 30;
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
      moveTo(state, 'corp', pick(r, TEAMS.corp));
      report.headline = '選秀落選';
      report.lines.push(note, `你先到 ${state.team} 落腳，等下一次機會。`);
    } else {
      state.stage = 'pro';
      state.proTurn = 0;
      moveTo(state, 'cpbl', pick(r, TEAMS.cpbl));
      state.finance.earnings += bonus;
      report.income = bonus;
      report.headline = `${state.team} 指名`;
      report.lines.push(
        note,
        `你穿上 ${state.team} 的球衣，簽約金 ${formatMoney(bonus)}，職業生涯正式開始。`,
      );
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
    milestones: [],
    income: null,
    tone: 'good',
  };

  switch (optionId) {
    case 'intl-double':
      state.handled.push(`intl:${state.year}:intl-double`);
      report.headline = '接受雙重賽程';
      report.lines.push('你答應國家隊：聯盟賽照打，國際賽也照打。球團的訓練官皺了眉頭。');
      applyDeltas(state, { guts: 2, mind: 2, fame: 4 });
      break;
    case 'intl-one':
      state.handled.push(`intl:${state.year}:intl-one`);
      report.headline = '只打一場';
      report.lines.push('你跟兩邊談妥：只打一場關鍵戰，其餘時間留給球團。');
      applyDeltas(state, { mind: 3, fame: 2 });
      break;
    case 'intl-decline':
      state.handled.push(`intl:${state.year}:intl-decline`);
      report.headline = '婉拒徵召';
      report.lines.push('你選擇守護身體。社群上吵了一週，球團私底下鬆了口氣。');
      applyDeltas(state, { fame: -6, mind: 4, fatigue: -8, body: 3 });
      report.tone = 'normal';
      break;
    case 'adapt-immerse':
      report.headline = '全力適應';
      report.lines.push('你把陌生的一切當成訓練的一部分。第一個月很痛苦，第二個月開始有人叫得出你的名字。');
      applyDeltas(state, {
        contact: 3,
        power: 2,
        velocity: 3,
        control: 2,
        mind: 5,
        guts: 3,
        fatigue: 14,
        body: -2,
      });
      report.tone = 'great';
      break;
    case 'adapt-pace':
      report.headline = '照自己的節奏';
      report.lines.push('你沒有硬撐著融入。進步不快，但每一步都踩在實地上。');
      applyDeltas(state, { contact: 2, control: 2, mind: 3, fatigue: 5 });
      break;
    case 'adapt-homesick':
      report.headline = '心繫故鄉';
      report.lines.push('視訊彼端的家人比較近；更衣室裡的玩笑比較遠。你守住了自己，也慢了半拍。');
      applyDeltas(state, { mind: -3, fame: 3, fatigue: -4 });
      report.tone = 'normal';
      break;
    case 'clause-push': {
      const cut = round(Math.max(20, state.finance.salary * 0.18));
      state.finance.salary = Math.max(30, state.finance.salary - cut);
      report.headline = '換取出場時間';
      report.lines.push(
        `你拿保障條款去換上場承諾。年薪少了 ${formatMoney(cut)}，教練組開始把你寫進計畫裡。`,
      );
      applyDeltas(state, {
        contact: 3,
        velocity: 3,
        stamina: 2,
        guts: 4,
        fame: 6,
        fatigue: 8,
        mind: 2,
      });
      report.tone = 'great';
      break;
    }
    case 'clause-safe': {
      const bump = round(Math.max(40, state.finance.salary * 0.12));
      state.finance.salary += bump;
      if (state.finance.salary > state.finance.peakSalary) {
        state.finance.peakSalary = state.finance.salary;
      }
      report.headline = '鎖定保障';
      report.lines.push(
        `你選擇把錢跟安全感留住。年薪來到 ${formatMoney(state.finance.salary)}，球團對你的用法變得更小心。`,
      );
      applyDeltas(state, { mind: 6, fame: 3, guts: -1 });
      break;
    }
    case 'clause-demand': {
      const ok = overall(state.attrs, state.position) >= LEAGUES[state.league].baseline - 2 && r() < 0.55;
      if (ok) {
        report.headline = '談成了';
        report.lines.push('你把談判檯面抬高，對方最後點了頭。壓力與期待一起上來。');
        applyDeltas(state, { fame: 10, guts: 5, mind: 3, fatigue: 6 });
        report.tone = 'great';
      } else {
        report.headline = '談僵了';
        report.lines.push('對方不吃這套。接下來幾週，教練看你的眼神都不一樣。');
        applyDeltas(state, { mind: -6, fame: -3, guts: 2 });
        report.tone = 'bad';
      }
      break;
    }
    case 'offer-npb':
      moveTo(state, 'npb', pick(r, TEAMS.npb));
      applyDeltas(state, { fame: 16, mind: -3 });
      report.headline = '旅日';
      report.lines.push(`${state.team} 把你買下。日本的訓練量讓你第一個月幾乎站不起來。`);
      break;
    case 'offer-mlb':
      moveTo(state, 'milb', pick(r, TEAMS.milb));
      applyDeltas(state, { fame: 14, mind: -5 });
      report.headline = '旅美';
      report.lines.push(`你選了最難的一條路，從 ${state.team} 的長途巴士開始。`);
      break;
    case 'offer-promote':
      moveTo(state, 'mlb', pick(r, TEAMS.mlb));
      applyDeltas(state, { fame: 25, mind: 8 });
      report.headline = '登上大聯盟';
      report.lines.push(`${state.team} 把你叫上來了。走出球員通道的那一刻，草皮綠得不真實。`);
      report.tone = 'great';
      break;
    case 'offer-return':
      moveTo(state, 'cpbl', pick(r, TEAMS.cpbl));
      applyDeltas(state, { fame: 8, mind: 5 });
      report.headline = '回到中職';
      report.lines.push(`${state.team} 為你辦了記者會。球迷還記得你。`);
      break;
    case 'fa-move': {
      const from = state.team;
      const rivals = TEAMS.cpbl.filter((t) => t !== from);
      // A free-agent deal is negotiated, not assigned, so it is priced off the
      // player's market value rather than reset like a league move.
      const deal = round(Math.max(salaryFor(state, 0.75), state.finance.salary) * 1.6);
      state.team = pick(r, rivals);
      state.finance.salary = deal;
      applyDeltas(state, { fame: 6, mind: -4 });
      report.headline = '轉隊';
      report.lines.push(
        `你離開 ${from}，簽進 ${state.team}，年薪 ${formatMoney(deal)}。有些球迷把你的球衣燒了。`,
      );
      break;
    }
    case 'fa-stay': {
      const deal = round(Math.max(salaryFor(state, 0.75), state.finance.salary) * 1.25);
      state.finance.salary = deal;
      applyDeltas(state, { fame: 12, mind: 8 });
      report.headline = '續留';
      report.lines.push(
        `你在記者會上說「我想在這裡打完」。年薪 ${formatMoney(deal)}，比別隊開的少，你沒有多解釋。`,
      );
      report.tone = 'great';
      break;
    }
    case 'fa-overseas':
      moveTo(state, 'npb', pick(r, TEAMS.npb));
      applyDeltas(state, { fame: 14, mind: -3 });
      report.headline = '以自由身旅日';
      report.lines.push(`三十幾歲才第一次出國打球。${state.team} 給了你這個機會。`);
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
    milestones: [],
    income: null,
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

  const accumulate = (line: SeasonRecord['line']) => {
    if (line.kind === 'batter') {
      ab += line.ab;
      totals.hits += line.hits;
      totals.hr += line.hr;
      totals.rbi += line.rbi;
      totals.sb += line.sb;
    } else {
      totals.wins += line.wins;
      totals.losses += line.losses;
      totals.saves += line.saves;
      totals.so += line.so;
      totals.ip += line.ip;
      earnedRunSum += (line.era * line.ip) / 9;
    }
  };

  pro.forEach((record) => {
    // Games are counted once per season: a two-way player's appearances as
    // pitcher are largely the same days they also batted.
    totals.games += record.line.games;
    accumulate(record.line);
    if (record.secondary) accumulate(record.secondary);
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
  // Feats are the moments voters remember; career marks are already implied by
  // the counting stats, so only the one-off feats add credit here.
  const feats = state.milestones.filter((m) => m.kind === 'feat').length;

  const hofScore = Math.max(
    0,
    round(
      batting +
        pitching +
        titles * 26 +
        mvp * 55 +
        feats * 18 +
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
    earnings: round(state.finance.earnings),
    peakSalary: round(state.finance.peakSalary),
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

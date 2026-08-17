/** 'TW' is the two-way player: trains and plays both ways every season. */
export type Position = 'P' | 'C' | 'IF' | 'OF' | 'TW';

export type PitchId = 'slider' | 'curve' | 'forkball' | 'changeup' | 'cutter' | 'sinker';

export interface PitchSlot {
  id: PitchId;
  level: number;
}

export type Arsenal = PitchSlot[];

export type LeagueId = 'hs' | 'college' | 'corp' | 'cpbl' | 'milb' | 'npb' | 'mlb';

export type Stage = 'highschool' | 'amateur' | 'pro' | 'over';

/** Every attribute is 0–100. Batters and pitchers each read half of them. */
export interface Attributes {
  contact: number;
  power: number;
  speed: number;
  fielding: number;
  eye: number;
  velocity: number;
  control: number;
  breaking: number;
  stamina: number;
  guts: number;
}

export type AttrKey = keyof Attributes;

/** Condition/mind/fame sit outside Attributes: they gate growth, not results. */
export interface Meta {
  body: number;
  mind: number;
  fame: number;
  fatigue: number;
}

export interface Injury {
  name: string;
  seasonsLeft: number;
  /** Permanent attribute cost already applied, kept for the career summary. */
  severity: 'minor' | 'major' | 'career';
}

export interface BatterLine {
  kind: 'batter';
  games: number;
  ab: number;
  hits: number;
  hr: number;
  rbi: number;
  sb: number;
  avg: number;
  obp: number;
  slg: number;
}

export interface PitcherLine {
  kind: 'pitcher';
  games: number;
  role: '先發' | '後援';
  ip: number;
  wins: number;
  losses: number;
  saves: number;
  so: number;
  era: number;
  whip: number;
}

export type StatLine = BatterLine | PitcherLine;

export interface SeasonRecord {
  year: number;
  age: number;
  league: LeagueId;
  team: string;
  line: StatLine;
  /** A two-way player's other half — pitching when `line` is batting. */
  secondary?: StatLine;
  awards: string[];
  note?: string;
}

export type DecisionKind =
  | 'training'
  | 'path'
  | 'offer'
  | 'event'
  | 'retire'
  | 'continue';

export interface Option {
  id: string;
  label: string;
  hint: string;
  /** Attribute focus previewed on the card; the dice decide the magnitude. */
  focus?: AttrKey[];
  disabled?: boolean;
  disabledReason?: string;
}

export interface Decision {
  kind: DecisionKind;
  title: string;
  prompt: string;
  options: Option[];
  /**
   * Identifies a one-shot decision (an offer, a retirement prompt) so that
   * answering it records the key in `handled` and the same decision is not
   * rebuilt forever — declining an offer must not re-ask it immediately.
   */
  key?: string;
}

export interface LogEntry {
  id: number;
  label: string;
  text: string;
  tone: 'normal' | 'good' | 'bad' | 'great';
}

export interface TurnReport {
  label: string;
  dice: number | null;
  headline: string;
  lines: string[];
  deltas: Partial<Attributes & Meta>;
  season: SeasonRecord | null;
  traitsUnlocked: string[];
  milestones: Milestone[];
  /** Money earned this turn, in 萬元; null outside a paid season. */
  income: number | null;
  tone: LogEntry['tone'];
}

/** All money is in 萬元 (units of NT$10,000) to keep the numbers readable. */
export interface Finance {
  /** This season's salary. 0 while in high school or college. */
  salary: number;
  /** Everything earned so far: salary, signing bonus and endorsements. */
  earnings: number;
  /** Last season's endorsement income, shown alongside salary. */
  endorsements: number;
  /** Highest salary ever drawn, kept for the career summary. */
  peakSalary: number;
}

export interface Milestone {
  year: number;
  age: number;
  text: string;
  /** Career totals crossing a round number vs. a one-off feat in a game. */
  kind: 'career' | 'feat';
}

export interface Counters {
  /** Sixes rolled before turning 22 — the 天才 trait watches this. */
  earlySixes: number;
  restTurns: number;
  injuries: number;
  intlAppearances: number;
  intlStrong: number;
  fullSeasons: number;
  proSeasons: number;
  hsTournamentWins: number;
  /** Consecutive seasons well below the league's bar — two of them ends it. */
  badSeasons: number;
}

export interface Summary {
  hofScore: number;
  verdict: string;
  epitaph: string;
  /** Career earnings in 萬元. */
  earnings: number;
  peakSalary: number;
  totals: {
    seasons: number;
    games: number;
    hits: number;
    hr: number;
    rbi: number;
    sb: number;
    avg: number;
    wins: number;
    losses: number;
    saves: number;
    so: number;
    ip: number;
    era: number;
  };
  awardCounts: { name: string; count: number }[];
}

export interface GameState {
  seedCode: string;
  seed: number;
  name: string;
  position: Position;
  originId: string;
  originLabel: string;

  age: number;
  year: number;
  turnIndex: number;
  stage: Stage;
  league: LeagueId;
  team: string;
  /**
   * 0/1/2 = 春訓・球季・球季後 within the current pro year. Only meaningful
   * while `stage === 'pro'`; a pro season is three turns, not one, so this is
   * what tells `buildDecision` which third of the year is being played.
   */
  proTurn: number;

  attrs: Attributes;
  meta: Meta;
  finance: Finance;
  /** Pitch repertoire; empty for a position player. Drives `attrs.breaking`. */
  arsenal: Arsenal;
  injury: Injury | null;

  /** Latent ceiling per attribute — training past it yields almost nothing. */
  potential: Attributes;

  history: SeasonRecord[];
  traits: string[];
  milestones: Milestone[];
  counters: Counters;
  log: LogEntry[];
  choices: string[];
  /** Event ids already shown, so the pool drains before anything repeats. */
  seenEvents: string[];

  decision: Decision | null;
  report: TurnReport | null;
  retired: boolean;
  summary: Summary | null;
  /** Round the player was drafted in; 0 means undrafted. */
  pendingDraftRank: number | null;
  /** Keys of one-shot decisions already answered. */
  handled: string[];
}

export type DeltaKey = keyof (Attributes & Meta);

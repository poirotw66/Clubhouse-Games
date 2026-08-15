export type Position = 'P' | 'C' | 'IF' | 'OF';

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
  tone: LogEntry['tone'];
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

  attrs: Attributes;
  meta: Meta;
  injury: Injury | null;

  /** Latent ceiling per attribute — training past it yields almost nothing. */
  potential: Attributes;

  history: SeasonRecord[];
  traits: string[];
  counters: Counters;
  log: LogEntry[];
  choices: string[];

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

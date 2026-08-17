export type Position = 'P' | 'C' | 'IF' | 'OF';

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

export type Level = 'major' | 'farm';

export interface Player {
  id: string;
  name: string;
  position: Position;
  age: number;
  attrs: Attributes;
  /** True ceiling. Never shown — the scouting band is all the player ever sees. */
  potential: number;
  /** Scouting estimate of `potential`; widens or narrows with scouting spend. */
  band: { low: number; high: number };
  salary: number;
  /** Contract years remaining, including the season about to be played. */
  years: number;
  level: Level;
  /** Seasons still missed through injury. */
  injuredSeasons: number;
  /** Drafted by the player's own club rather than acquired. */
  homegrown: boolean;
  teamId: string;
}

export interface Team {
  id: string;
  name: string;
  /** Ratings the AI clubs are steered by; the human club ignores these. */
  aiMode: 'contend' | 'rebuild' | 'balanced';
  players: Player[];
  wins: number;
  losses: number;
}

export type Expectation = 'rebuild' | 'hold' | 'playoffs' | 'title';

export interface BoardState {
  expectation: Expectation;
  trust: number;
  /** Seasons in a row with trust under the danger line. */
  dangerYears: number;
}

export interface Finance {
  cash: number;
  ticketPrice: number;
  marketing: number;
  scouting: number;
  training: number;
}

export interface SeasonLedger {
  year: number;
  tickets: number;
  merch: number;
  broadcast: number;
  sponsor: number;
  salaries: number;
  luxuryTax: number;
  spending: number;
  upkeep: number;
  net: number;
  attendance: number;
}

export interface SeasonRecord {
  year: number;
  wins: number;
  losses: number;
  finish: number;
  playoffResult: '未晉級' | '準決賽敗' | '總冠軍賽敗' | '總冠軍';
  expectation: Expectation;
  met: boolean;
  net: number;
  heat: number;
  trust: number;
}

export type Phase =
  | 'board'
  | 'spring'
  | 'block'
  | 'deadline'
  | 'draft'
  | 'contracts'
  | 'budget'
  | 'over';

export interface Option {
  id: string;
  label: string;
  hint: string;
  cost?: number;
  disabled?: boolean;
  disabledReason?: string;
  /** Extra lines rendered under the option, e.g. a scouting band. */
  detail?: string[];
}

export interface Decision {
  phase: Phase;
  title: string;
  prompt: string;
  options: Option[];
  key?: string;
}

export interface LogEntry {
  id: number;
  label: string;
  text: string;
  tone: 'normal' | 'good' | 'bad' | 'great';
}

export interface Report {
  label: string;
  headline: string;
  lines: string[];
  ledger: SeasonLedger | null;
  standings: { teamId: string; name: string; wins: number; losses: number }[] | null;
  tone: LogEntry['tone'];
}

export interface Summary {
  score: number;
  verdict: string;
  epitaph: string;
  titles: number;
  playoffs: number;
  totalNet: number;
  homegrownStars: number;
  seasonsServed: number;
  fired: boolean;
}

export interface GameState {
  seedCode: string;
  seed: number;
  gmName: string;
  teamId: string;

  year: number;
  seasonIndex: number;
  phase: Phase;
  block: number;

  teams: Team[];
  board: BoardState;
  finance: Finance;
  heat: number;
  farmLevel: number;
  /** Set for the season in progress; folded into history at season end. */
  morale: number;
  /** Strength added by this season's training programme. */
  trainingBonus: number;
  /** Multiplier on farm development at the next offseason. */
  farmBoost: number;

  draftPool: Player[];
  history: SeasonRecord[];
  ledgers: SeasonLedger[];
  log: LogEntry[];
  decisions: string[];
  seenEvents: string[];
  /** Regular-season situations already shown, so a tenure does not repeat one. */
  seenSituations: string[];
  /** Which situation the current block decision was built from. */
  blockSituation: string | null;
  /** Spring-training scenarios already shown, so a tenure does not repeat one. */
  seenTrainingScenarios: string[];
  /** Which scenario the current spring-training decision was built from. */
  trainingScenario: string | null;
  /** Post-season budget scenarios already shown, so a tenure does not repeat one. */
  seenBudgetScenarios: string[];
  /** Which scenario the current budget decision was built from. */
  budgetScenario: string | null;

  decision: Decision | null;
  report: Report | null;
  over: boolean;
  summary: Summary | null;
}

export const TENURE = 10;

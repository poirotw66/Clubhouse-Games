/**
 * Shared series / match session primitives for Clubhouse Games.
 *
 * Two families of series appear across the catalogue:
 *   1. Win-count (first-to-N / best-of-N) — Reversi, Checkers, Connect-Four
 *   2. Score accumulation (fixed hands / race-to-target / single / daily) —
 *      Big-Two, Pick-Red, and similar chip-or-point tables
 *
 * Games keep their own public types and thin adapters so localStorage keys,
 * UI copy, and existing tests stay byte-compatible. This module owns only the
 * shared decision rules.
 */

/** Phase of a multi-hand score series. */
export type ScoreSeriesPhase = 'playing' | 'handOver' | 'matchOver';

/** How a score series ends. */
export type ScoreSeriesMode = 'single' | 'hands' | 'target' | 'daily';

/**
 * Minimal config the score-series winner rule needs.
 * Games may carry extra fields (rules, difficulty, seed…) alongside these.
 */
export interface ScoreSeriesConfig {
  mode: ScoreSeriesMode;
  /** Fixed-hand length when mode === 'hands'. */
  hands: number;
  /** Chip / point threshold when mode === 'target'. */
  target: number;
  /** Hand count when mode === 'daily' (defaults to `hands` if omitted). */
  dailyHands?: number;
}

/** Canonical in-memory score series (balances + hand history). */
export interface ScoreSeriesState<TConfig extends ScoreSeriesConfig = ScoreSeriesConfig, TRecord = unknown> {
  config: TConfig;
  handIndex: number;
  balances: number[];
  history: TRecord[];
  phase: ScoreSeriesPhase;
  /** Seat index of the series winner, or null while the series is open. */
  winner: number | null;
}

export type FormatKey =
  | 'single'
  | 'daily'
  | `hands-${number}`
  | `target-${number}`;

export const DEFAULT_HAND_LENGTHS = [4, 8, 12] as const;
export const DEFAULT_TARGET_SCORES = [50, 100, 200] as const;

export function isSeriesMode(mode: ScoreSeriesMode): boolean {
  return mode === 'hands' || mode === 'target' || mode === 'daily';
}

/**
 * Stable stats-bucket key for a finished series.
 * Returns null when the config does not map to a known format bucket
 * (e.g. an unusual hand count) so callers can skip format tallies.
 */
export function formatKeyFor(
  config: ScoreSeriesConfig,
  opts: {
    handLengths?: readonly number[];
    targetScores?: readonly number[];
  } = {},
): FormatKey | null {
  const handLengths = opts.handLengths ?? DEFAULT_HAND_LENGTHS;
  const targetScores = opts.targetScores ?? DEFAULT_TARGET_SCORES;

  if (config.mode === 'single') return 'single';
  if (config.mode === 'daily') return 'daily';
  if (config.mode === 'hands') {
    if ((handLengths as readonly number[]).includes(config.hands)) {
      return `hands-${config.hands}` as FormatKey;
    }
    return null;
  }
  if (config.mode === 'target') {
    if ((targetScores as readonly number[]).includes(config.target)) {
      return `target-${config.target}` as FormatKey;
    }
    return null;
  }
  return null;
}

/** Seat with the highest balance; ties break toward the lowest seat. */
export function seatWithMost(balances: readonly number[]): number {
  let best = 0;
  for (let seat = 1; seat < balances.length; seat++) {
    if (balances[seat]! > balances[best]!) best = seat;
  }
  return best;
}

/**
 * Who won the score series, or null if more hands remain.
 *
 * - single: after 1 hand, highest balance
 * - daily: after `dailyHands` (or `hands`), highest balance
 * - hands: after N hands, highest balance
 * - target: first seat to reach the target after a hand (ties → lowest seat among reachers)
 */
export function decideScoreSeriesWinner(
  config: ScoreSeriesConfig,
  balances: readonly number[],
  handsPlayed: number,
): number | null {
  if (config.mode === 'single') {
    if (handsPlayed < 1) return null;
    return seatWithMost(balances);
  }

  if (config.mode === 'daily') {
    const need = config.dailyHands ?? config.hands;
    if (handsPlayed < need) return null;
    return seatWithMost(balances);
  }

  if (config.mode === 'target') {
    const reached = balances
      .map((chip, seat) => ({ chip, seat }))
      .filter((entry) => entry.chip >= config.target)
      .sort((a, b) => b.chip - a.chip || a.seat - b.seat);
    return reached.length > 0 ? reached[0]!.seat : null;
  }

  if (handsPlayed < config.hands) return null;
  return seatWithMost(balances);
}

export interface CreateScoreSeriesOptions<TConfig extends ScoreSeriesConfig> {
  config: TConfig;
  seatCount: number;
  /** Optional normalizer for seed / house-rule fields on config. */
  normalizeConfig?: (config: TConfig) => TConfig;
}

export function createScoreSeries<TConfig extends ScoreSeriesConfig, TRecord = unknown>(
  opts: CreateScoreSeriesOptions<TConfig>,
): ScoreSeriesState<TConfig, TRecord> {
  const config = opts.normalizeConfig ? opts.normalizeConfig(opts.config) : opts.config;
  return {
    config,
    handIndex: 0,
    balances: Array.from({ length: opts.seatCount }, () => 0),
    history: [],
    phase: 'playing',
    winner: null,
  };
}

/**
 * Fold one finished hand's deltas + record into the series.
 * Game-specific HandRecord shape stays outside — pass the built record in.
 */
export function applyScoreHandResult<TConfig extends ScoreSeriesConfig, TRecord>(
  match: ScoreSeriesState<TConfig, TRecord>,
  deltas: readonly number[],
  record: TRecord,
  opts: { dailyHands?: number } = {},
): ScoreSeriesState<TConfig, TRecord> {
  if (match.phase === 'matchOver') return match;

  const balances = match.balances.map((chip, seat) => chip + (deltas[seat] ?? 0));
  const history = [...match.history, record];
  const nextHand = match.handIndex + 1;
  const config: ScoreSeriesConfig = {
    mode: match.config.mode,
    hands: match.config.hands,
    target: match.config.target,
    dailyHands: opts.dailyHands ?? match.config.dailyHands,
  };
  const matchWinner = decideScoreSeriesWinner(config, balances, nextHand);

  if (matchWinner !== null) {
    return {
      ...match,
      balances,
      history,
      handIndex: nextHand,
      phase: 'matchOver',
      winner: matchWinner,
    };
  }

  return {
    ...match,
    balances,
    history,
    handIndex: nextHand,
    phase: 'handOver',
    winner: null,
  };
}

export function advanceScoreSeriesHand<TConfig extends ScoreSeriesConfig, TRecord>(
  match: ScoreSeriesState<TConfig, TRecord>,
): ScoreSeriesState<TConfig, TRecord> {
  if (match.phase !== 'handOver') return match;
  return { ...match, phase: 'playing' };
}

export function isScoreSeriesComplete<TConfig extends ScoreSeriesConfig, TRecord>(
  match: ScoreSeriesState<TConfig, TRecord>,
): boolean {
  return match.phase === 'matchOver';
}

export interface ScoreProgressLabelOptions {
  /** Unit word in progress copy — 「局」／「圈」 etc. */
  unit?: string;
  dailyTotal?: number;
}

export function scoreSeriesProgressLabel(
  match: Pick<ScoreSeriesState, 'config' | 'handIndex'>,
  opts: ScoreProgressLabelOptions = {},
): string {
  const unit = opts.unit ?? '局';
  if (match.config.mode === 'single') return '單局';
  if (match.config.mode === 'daily') {
    const total = opts.dailyTotal ?? match.config.dailyHands ?? match.config.hands;
    const current = Math.min(match.handIndex + 1, total);
    return `每日 ${current}／${total} ${unit}`;
  }
  if (match.config.mode === 'hands') {
    const current = Math.min(match.handIndex + 1, match.config.hands);
    return `第 ${current}／${match.config.hands} ${unit}`;
  }
  return `目標 ${match.config.target} 分`;
}

// ---------------------------------------------------------------------------
// Win-count series (first-to-N / best-of-N)
// ---------------------------------------------------------------------------

export type WinSeriesSide = 0 | 1;

export type WinSeriesKind = 'firstTo' | 'bestOf';

export interface WinSeriesState {
  kind: WinSeriesKind;
  /** Wins needed to take the series. */
  winsNeeded: number;
  /**
   * Total games in a best-of series (1, 3, 5…).
   * Null for unbounded first-to series.
   */
  length: number | null;
  scores: [number, number];
  draws: number;
  gameIndex: number;
  over: boolean;
  winner: WinSeriesSide | null;
}

export interface CreateWinSeriesOptions {
  kind: WinSeriesKind;
  /**
   * firstTo → wins needed; bestOf → series length (odd: 1/3/5).
   */
  value: number;
  /** Starting game index. Checkers uses 1; others typically 0. */
  gameIndexStart?: number;
}

export function createWinSeries(opts: CreateWinSeriesOptions): WinSeriesState {
  const gameIndexStart = opts.gameIndexStart ?? 0;
  if (opts.kind === 'bestOf') {
    const length = opts.value;
    const winsNeeded = Math.ceil(length / 2);
    return {
      kind: 'bestOf',
      winsNeeded,
      length,
      scores: [0, 0],
      draws: 0,
      gameIndex: gameIndexStart,
      over: false,
      winner: null,
    };
  }
  return {
    kind: 'firstTo',
    winsNeeded: opts.value,
    length: null,
    scores: [0, 0],
    draws: 0,
    gameIndex: gameIndexStart,
    over: false,
    winner: null,
  };
}

export type WinSeriesResult = WinSeriesSide | 'draw';

export interface ApplyWinSeriesOptions {
  /**
   * When true (default for best-of), exhausting `length` without either side
   * reaching winsNeeded settles by score comparison (or draw if tied).
   * firstTo ignores this — only winsNeeded matters.
   */
  settleOnExhaust?: boolean;
  /**
   * How gameIndex advances after a decisive game.
   * - 'always' (default): +1 every result including the finishing one
   * - 'untilOver': +1 only while the series stays open (Checkers)
   */
  gameIndexMode?: 'always' | 'untilOver';
}

/**
 * Apply one game result to a win-count series.
 * Idempotent once `over` is true.
 *
 * Behaviour notes (must stay compatible with existing games):
 * - firstTo: first side to reach winsNeeded wins; draws never award a point.
 * - bestOf: same win threshold, plus optional exhaust settle when all games
 *   have been played without either side reaching winsNeeded (Reversi).
 * - gameIndexMode 'always': increment after every result (Reversi / Connect-Four).
 * - gameIndexMode 'untilOver': increment only while the series stays open (Checkers).
 */
export function applyWinSeriesResult(
  match: WinSeriesState,
  result: WinSeriesResult,
  opts: ApplyWinSeriesOptions = {},
): WinSeriesState {
  if (match.over) return match;

  const settleOnExhaust = opts.settleOnExhaust ?? match.kind === 'bestOf';
  const gameIndexMode = opts.gameIndexMode ?? 'always';

  const scores: [number, number] = [match.scores[0], match.scores[1]];
  let draws = match.draws;
  if (result === 'draw') {
    draws += 1;
  } else {
    scores[result] += 1;
  }

  let over = false;
  let winner: WinSeriesSide | null = null;

  if (scores[0] >= match.winsNeeded) {
    over = true;
    winner = 0;
  } else if (scores[1] >= match.winsNeeded) {
    over = true;
    winner = 1;
  }

  let gameIndex = match.gameIndex;
  if (gameIndexMode === 'always') {
    gameIndex = match.gameIndex + 1;
  } else if (!over) {
    gameIndex = match.gameIndex + 1;
  }

  if (
    !over &&
    settleOnExhaust &&
    match.length !== null &&
    gameIndex >= match.length
  ) {
    over = true;
    if (scores[0] > scores[1]) winner = 0;
    else if (scores[1] > scores[0]) winner = 1;
    else winner = null;
  }

  return {
    ...match,
    scores,
    draws,
    gameIndex,
    over,
    winner,
  };
}

/** Traditional Chinese label for a best-of length. */
export function bestOfLabel(length: number): string {
  if (length === 1) return '單局';
  if (length === 3) return '三戰兩勝';
  if (length === 5) return '五戰三勝';
  return `${length} 戰制`;
}

/** Traditional Chinese label for a first-to-N target. */
export function firstToLabel(winsNeeded: number): string {
  const map: Record<number, string> = {
    2: '兩勝制',
    3: '三勝制',
    4: '四勝制',
  };
  return map[winsNeeded] ?? `先取 ${winsNeeded} 勝`;
}

export function winSeriesScoreLine(
  match: WinSeriesState,
  opts: { includeDraws?: boolean } = {},
): string {
  const base = `${match.scores[0]} — ${match.scores[1]}`;
  if (opts.includeDraws && match.draws) return `${base}（和 ${match.draws}）`;
  return base;
}

import { DAILY_HANDS } from './daily';
import { deal, outcome } from './engine';
import { ladderSeatPersonalities, opponentById } from './opponents';
import { normalizeSeedCode, seedFromCode, streamRng } from './rng';
import { HUMAN, SEATS } from './types';
import type {
  DifficultyId,
  FormatKey,
  GameState,
  HandRecord,
  HouseRules,
  MatchConfig,
  MatchLength,
  MatchMode,
  MatchMvp,
  MatchState,
  Outcome,
  Seat,
  SeatPersonalityMap,
  TargetScore,
} from './types';

export const MATCH_LENGTHS: MatchLength[] = [4, 8, 12];
export const TARGET_SCORES: TargetScore[] = [50, 100, 200];

export const MATCH_MODE_LABELS: Record<MatchMode, string> = {
  single: '單局',
  hands: '打固定局數',
  target: '先達目標分',
  daily: '每日牌桌',
};

export const FORMAT_LABELS: Record<FormatKey, string> = {
  single: '單局',
  'hands-4': '四局',
  'hands-8': '八局',
  'hands-12': '十二局',
  'target-50': '先達 50',
  'target-100': '先達 100',
  'target-200': '先達 200',
  daily: '每日牌桌',
};

export const DEFAULT_HOUSE_RULES: HouseRules = {
  straights: 'topCard',
  sizeLadder: true,
  deuceDouble: true,
};

export function defaultMatchConfig(
  difficulty: DifficultyId = 'normal',
  rules: HouseRules = DEFAULT_HOUSE_RULES,
): MatchConfig {
  return {
    mode: 'hands',
    hands: 4,
    target: 100,
    difficulty,
    rules,
    seedCode: '',
    ladderOpponentId: null,
  };
}

export function isSeriesMode(mode: MatchMode): boolean {
  return mode === 'hands' || mode === 'target' || mode === 'daily';
}

export function formatKeyFor(config: MatchConfig): FormatKey | null {
  if (config.mode === 'single') return 'single';
  if (config.mode === 'daily') return 'daily';
  if (config.mode === 'hands') {
    if (config.hands === 4) return 'hands-4';
    if (config.hands === 8) return 'hands-8';
    if (config.hands === 12) return 'hands-12';
    return null;
  }
  if (config.mode === 'target') {
    if (config.target === 50) return 'target-50';
    if (config.target === 100) return 'target-100';
    if (config.target === 200) return 'target-200';
    return null;
  }
  return null;
}

/**
 * Derive a per-hand seed so the whole match stays reproducible from one code.
 *
 * Hand 0 uses the base code as-is — players who paste a known seed expect that
 * deal, and the browser check pins ♣3 on a fixed seed. Later hands branch off
 * the same stream so the series stays determined without colliding with hand 0.
 */
export function handSeed(baseCode: string, handIndex: number): string {
  const base = normalizeSeedCode(baseCode || 'match');
  if (handIndex === 0) return base;
  const r = streamRng(seedFromCode(base), `hand:${handIndex}`);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += alphabet[Math.floor(r() * alphabet.length)];
  }
  return out;
}

export function createMatch(config: MatchConfig): MatchState {
  const seedCode = normalizeSeedCode(config.seedCode || `m${Date.now().toString(36)}`);
  return {
    config: {
      ...config,
      seedCode,
      rules: { ...config.rules },
      ladderOpponentId: config.ladderOpponentId ?? null,
    },
    handIndex: 0,
    balances: Array.from({ length: SEATS }, () => 0),
    history: [],
    phase: 'playing',
    winner: null,
  };
}

export function seatPersonalitiesFor(config: MatchConfig): SeatPersonalityMap | undefined {
  if (!config.ladderOpponentId) return undefined;
  const opponent = opponentById(config.ladderOpponentId);
  if (!opponent) return undefined;
  return ladderSeatPersonalities(opponent);
}

export function dealHand(match: MatchState): GameState {
  const seed = handSeed(match.config.seedCode, match.handIndex);
  const dealt = deal(seed, match.config.difficulty, match.config.rules);
  const overrides = seatPersonalitiesFor(match.config);
  if (!overrides) return dealt;
  return { ...dealt, seatPersonalities: overrides };
}

/**
 * Chip deltas for one finished hand.
 *
 * Winner takes the pot (sum of losers' penalties). Each loser pays −penalty.
 * Net across the table is always zero.
 */
export function handDeltas(result: Outcome): number[] {
  const deltas = result.scores.map((entry) => -entry.penalty);
  deltas[result.winner] = result.pot;
  return deltas;
}

/** Bomb + winner-play stats scraped from the finished hand log. */
export function handExtras(
  state: GameState,
  winner: Seat,
): { bombs: number[]; winnerPlayCount: number } {
  const bombs = Array.from({ length: SEATS }, () => 0);
  let winnerPlayCount = 0;
  for (const entry of state.log) {
    if (!entry.play) continue;
    if (entry.play.type === 'quads' || entry.play.type === 'straightFlush') {
      bombs[entry.seat] += 1;
    }
    if (entry.seat === winner) winnerPlayCount += 1;
  }
  return { bombs, winnerPlayCount };
}

export function applyHandResult(
  match: MatchState,
  result: Outcome,
  seedCode: string,
  state?: GameState,
): MatchState {
  if (match.phase === 'matchOver') return match;

  const deltas = handDeltas(result);
  const balances = match.balances.map((chip, seat) => chip + deltas[seat]);
  const extras = state
    ? handExtras(state, result.winner)
    : { bombs: Array.from({ length: SEATS }, () => 0), winnerPlayCount: 0 };
  const record: HandRecord = {
    handIndex: match.handIndex,
    seedCode,
    winner: result.winner,
    scores: result.scores,
    pot: result.pot,
    deltas,
    bombs: extras.bombs,
    winnerPlayCount: extras.winnerPlayCount,
  };
  const history = [...match.history, record];
  const nextHand = match.handIndex + 1;

  const matchWinner = decideMatchWinner(match.config, balances, nextHand);
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

/**
 * Who won the match, or null if more hands remain.
 *
 * Single: after 1 hand. Daily: after DAILY_HANDS. Hands: after N.
 * Target: first seat to reach the target after a hand ends the match.
 */
export function decideMatchWinner(
  config: MatchConfig,
  balances: readonly number[],
  handsPlayed: number,
): Seat | null {
  if (config.mode === 'single') {
    if (handsPlayed < 1) return null;
    return seatWithMost(balances);
  }

  if (config.mode === 'daily') {
    if (handsPlayed < DAILY_HANDS) return null;
    return seatWithMost(balances);
  }

  if (config.mode === 'target') {
    const reached = balances
      .map((chip, seat) => ({ chip, seat }))
      .filter((entry) => entry.chip >= config.target)
      .sort((a, b) => b.chip - a.chip || a.seat - b.seat);
    return reached.length > 0 ? reached[0].seat : null;
  }

  if (handsPlayed < config.hands) return null;
  return seatWithMost(balances);
}

function seatWithMost(balances: readonly number[]): Seat {
  let best = 0;
  for (let seat = 1; seat < balances.length; seat++) {
    if (balances[seat] > balances[best]) best = seat;
  }
  return best;
}

/**
 * Series / single MVP from completed hand history.
 * Fastest empty, most bombs, biggest comeback from a running-balance trough.
 */
export function computeMatchMvp(match: MatchState): MatchMvp | null {
  if (match.history.length === 0) return null;
  const seats = match.balances.length;

  const bombTotals = Array.from({ length: seats }, () => 0);
  const finishPlays: { seat: Seat; plays: number }[] = [];

  for (const hand of match.history) {
    const bombs = hand.bombs ?? Array.from({ length: seats }, () => 0);
    for (let seat = 0; seat < seats; seat++) {
      bombTotals[seat] += bombs[seat] ?? 0;
    }
    finishPlays.push({ seat: hand.winner, plays: hand.winnerPlayCount ?? 99 });
  }

  let fastestSeat = finishPlays[0].seat;
  let fastestPlays = finishPlays[0].plays;
  for (const entry of finishPlays) {
    if (entry.plays < fastestPlays || (entry.plays === fastestPlays && entry.seat < fastestSeat)) {
      fastestPlays = entry.plays;
      fastestSeat = entry.seat;
    }
  }

  let mostBombsSeat = 0;
  for (let seat = 1; seat < seats; seat++) {
    if (
      bombTotals[seat] > bombTotals[mostBombsSeat] ||
      (bombTotals[seat] === bombTotals[mostBombsSeat] && seat < mostBombsSeat)
    ) {
      mostBombsSeat = seat;
    }
  }

  // Comeback: recovery from each seat's lowest running balance to final chips.
  const trough = Array.from({ length: seats }, () => 0);
  const running = Array.from({ length: seats }, () => 0);
  for (const hand of match.history) {
    for (let seat = 0; seat < seats; seat++) {
      running[seat] += hand.deltas[seat] ?? 0;
      if (running[seat] < trough[seat]) trough[seat] = running[seat];
    }
  }
  const recoveries = match.balances.map((final, seat) => final - trough[seat]);
  let biggestComebackSeat = 0;
  for (let seat = 1; seat < seats; seat++) {
    if (
      recoveries[seat] > recoveries[biggestComebackSeat] ||
      (recoveries[seat] === recoveries[biggestComebackSeat] && seat < biggestComebackSeat)
    ) {
      biggestComebackSeat = seat;
    }
  }

  return {
    fastestSeat,
    fastestPlays,
    mostBombsSeat,
    mostBombsCount: bombTotals[mostBombsSeat],
    biggestComebackSeat,
    biggestComebackDelta: recoveries[biggestComebackSeat],
    chipLeaderSeat: seatWithMost(match.balances),
    chipLeaderTotal: Math.max(...match.balances),
  };
}

export function advanceToNextHand(match: MatchState): MatchState {
  if (match.phase !== 'handOver') return match;
  return { ...match, phase: 'playing' };
}

export function matchProgressLabel(match: MatchState): string {
  if (match.config.mode === 'single') return '單局';
  if (match.config.mode === 'daily') {
    const current = Math.min(match.handIndex + 1, DAILY_HANDS);
    return `每日 ${current}／${DAILY_HANDS} 局`;
  }
  if (match.config.mode === 'hands') {
    const current = Math.min(match.handIndex + 1, match.config.hands);
    return `第 ${current}／${match.config.hands} 局`;
  }
  return `目標 ${match.config.target} 分`;
}

export function humanMatchDelta(match: MatchState): number {
  return match.balances[HUMAN];
}

export function isMatchComplete(match: MatchState): boolean {
  return match.phase === 'matchOver';
}

/** Re-export so callers that only import match can still resolve outcomes in tests. */
export { outcome };

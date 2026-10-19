import { deal, outcome } from './engine';
import { normalizeSeedCode, seedFromCode, streamRng } from './rng';
import { HUMAN, SEATS } from './types';
import type {
  DifficultyId,
  GameState,
  HandRecord,
  HouseRules,
  MatchConfig,
  MatchLength,
  MatchMode,
  MatchState,
  Outcome,
  Seat,
  TargetScore,
} from './types';

export const MATCH_LENGTHS: MatchLength[] = [4, 8, 12];
export const TARGET_SCORES: TargetScore[] = [50, 100, 200];

export const MATCH_MODE_LABELS: Record<MatchMode, string> = {
  hands: '打固定局數',
  target: '先達目標分',
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
  };
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
    config: { ...config, seedCode, rules: { ...config.rules } },
    handIndex: 0,
    balances: Array.from({ length: SEATS }, () => 0),
    history: [],
    phase: 'playing',
    winner: null,
  };
}

export function dealHand(match: MatchState): GameState {
  const seed = handSeed(match.config.seedCode, match.handIndex);
  return deal(seed, match.config.difficulty, match.config.rules);
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

export function applyHandResult(match: MatchState, result: Outcome, seedCode: string): MatchState {
  if (match.phase === 'matchOver') return match;

  const deltas = handDeltas(result);
  const balances = match.balances.map((chip, seat) => chip + deltas[seat]);
  const record: HandRecord = {
    handIndex: match.handIndex,
    seedCode,
    winner: result.winner,
    scores: result.scores,
    pot: result.pot,
    deltas,
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
 * Hands mode: after N hands, highest balance wins (ties → human loses the tie-break
 * only when another seat is strictly ahead; equal top → first among tops by seat).
 * Target mode: first seat to reach the target after a hand ends the match.
 */
export function decideMatchWinner(
  config: MatchConfig,
  balances: readonly number[],
  handsPlayed: number,
): Seat | null {
  if (config.mode === 'target') {
    const reached = balances
      .map((chip, seat) => ({ chip, seat }))
      .filter((entry) => entry.chip >= config.target)
      .sort((a, b) => b.chip - a.chip || a.seat - b.seat);
    return reached.length > 0 ? reached[0].seat : null;
  }

  if (handsPlayed < config.hands) return null;
  let best = 0;
  for (let seat = 1; seat < SEATS; seat++) {
    if (balances[seat] > balances[best]) best = seat;
  }
  return best;
}

export function advanceToNextHand(match: MatchState): MatchState {
  if (match.phase !== 'handOver') return match;
  return { ...match, phase: 'playing' };
}

export function matchProgressLabel(match: MatchState): string {
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

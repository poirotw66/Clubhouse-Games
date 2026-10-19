import { deal, outcome } from './engine';
import { leaderFor } from './cpu';
import { normalizeSeedCode, seedFromCode, streamRng } from './rng';
import { HUMAN } from './types';
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
  PlayerCount,
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
  players: 2,
  blackAces: false,
  doubleRedFive: true,
  zeroScoreBonus: true,
  rotateLeader: true,
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
    rules: { ...rules },
    seedCode: '',
  };
}

/**
 * Derive a per-hand seed so the whole match stays reproducible from one code.
 *
 * Hand 0 uses the base code as-is — players who paste a known seed expect that
 * deal, and the browser check pins a fixed opener. Later hands branch off the
 * same stream so the series stays determined without colliding with hand 0.
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
  const players = config.rules.players;
  return {
    config: { ...config, seedCode, rules: { ...config.rules } },
    handIndex: 0,
    balances: Array.from({ length: players }, () => 0),
    history: [],
    phase: 'playing',
    winner: null,
  };
}

/** Who leads this hand: difficulty seat, optionally rotated each hand. */
export function leaderForHand(match: MatchState): Seat {
  const players = match.config.rules.players;
  const base = leaderFor(match.config.difficulty, players);
  if (!match.config.rules.rotateLeader) return base;
  return (base + match.handIndex) % players;
}

export function dealHand(match: MatchState): GameState {
  const seed = handSeed(match.config.seedCode, match.handIndex);
  return deal(
    seed,
    match.config.difficulty,
    match.config.rules,
    leaderForHand(match),
  );
}

/**
 * Chip deltas for one finished hand.
 *
 * Core Taiwanese settlement: `（得分 − 標準分）`. That is what makes 105／70
 * cumulative — going under par costs chips even when you did not finish last.
 * Special bonuses (過紅五／拼零分) layer on top when the house rules are on.
 */
export function handDeltas(result: Outcome): number[] {
  return [...result.deltas];
}

export function applyHandResult(match: MatchState, result: Outcome, seedCode: string): MatchState {
  if (match.phase === 'matchOver') return match;

  const deltas = handDeltas(result);
  const balances = match.balances.map((chip, seat) => chip + (deltas[seat] ?? 0));
  const winner =
    result.winners.length === 1
      ? result.winners[0]
      : result.winners.includes(HUMAN)
        ? HUMAN
        : (result.winners[0] ?? null);

  const record: HandRecord = {
    handIndex: match.handIndex,
    seedCode,
    winner,
    scores: result.scores,
    deltas,
    qualified: result.qualified,
    doubleRedFiveSeat: result.doubleRedFiveSeat,
    zeroScoreSeat: result.zeroScoreSeat,
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
 * Hands mode: after N hands, highest balance wins (ties break toward lowest seat).
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
  for (let seat = 1; seat < balances.length; seat++) {
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

export function isMatchComplete(match: MatchState): boolean {
  return match.phase === 'matchOver';
}

export function seatCount(players: PlayerCount): number {
  return players;
}

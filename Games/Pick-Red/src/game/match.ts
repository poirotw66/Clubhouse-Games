import {
  advanceScoreSeriesHand,
  applyScoreHandResult,
  createScoreSeries,
  decideScoreSeriesWinner,
  formatKeyFor as sharedFormatKeyFor,
  isScoreSeriesComplete,
  isSeriesMode as sharedIsSeriesMode,
  scoreSeriesProgressLabel,
  seatWithMost,
  type ScoreSeriesConfig,
} from '@clubhouse/shared/MatchSession';
import { DAILY_HANDS } from './daily';
import { deal } from './engine';
import { leaderFor } from './cpu';
import { ladderSeatPersonalities, opponentById } from './opponents';
import { normalizeSeedCode, seedFromCode, streamRng } from './rng';
import { HUMAN } from './types';
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
  PlayerCount,
  Seat,
  SeatPersonalityMap,
  TargetScore,
} from './types';

export const MATCH_LENGTHS: MatchLength[] = [4, 8, 12];
export const TARGET_SCORES: TargetScore[] = [50, 100, 200];

export const MATCH_MODE_LABELS: Record<MatchMode, string> = {
  single: '單局',
  hands: '打四圈（輪莊）',
  target: '打到 N 分',
  daily: '每日牌桌',
};

export const FORMAT_LABELS: Record<FormatKey, string> = {
  single: '單局',
  'hands-4': '四圈',
  'hands-8': '八圈',
  'hands-12': '十二圈',
  'target-50': '先達 50',
  'target-100': '先達 100',
  'target-200': '先達 200',
  daily: '每日牌桌',
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
    ladderOpponentId: null,
  };
}

export function isSeriesMode(mode: MatchMode): boolean {
  return sharedIsSeriesMode(mode);
}

export function formatKeyFor(config: MatchConfig): FormatKey | null {
  return sharedFormatKeyFor(config, {
    handLengths: MATCH_LENGTHS,
    targetScores: TARGET_SCORES,
  }) as FormatKey | null;
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
  return createScoreSeries({
    config,
    seatCount: config.rules.players,
    normalizeConfig: (cfg) => ({
      ...cfg,
      seedCode: normalizeSeedCode(cfg.seedCode || `m${Date.now().toString(36)}`),
      rules: { ...cfg.rules },
      ladderOpponentId: cfg.ladderOpponentId ?? null,
    }),
  });
}

/** Who leads this hand: difficulty seat, optionally rotated each hand. */
export function leaderForHand(match: MatchState): Seat {
  const players = match.config.rules.players;
  const base = leaderFor(match.config.difficulty, players);
  // Single-hand sessions keep the difficulty seat; rotation is a series rule.
  if (match.config.mode === 'single' || !match.config.rules.rotateLeader) return base;
  return ((base + match.handIndex) % players) as Seat;
}

export function seatPersonalitiesFor(config: MatchConfig): SeatPersonalityMap | undefined {
  if (!config.ladderOpponentId) return undefined;
  const opponent = opponentById(config.ladderOpponentId);
  if (!opponent) return undefined;
  return ladderSeatPersonalities(opponent);
}

export function dealHand(match: MatchState): GameState {
  const seed = handSeed(match.config.seedCode, match.handIndex);
  const dealt = deal(
    seed,
    match.config.difficulty,
    match.config.rules,
    leaderForHand(match),
  );
  const overrides = seatPersonalitiesFor(match.config);
  if (!overrides) return dealt;
  return { ...dealt, seatPersonalities: overrides };
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
  const deltas = handDeltas(result);
  const winner =
    result.winners.length === 1
      ? result.winners[0]!
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
  return applyScoreHandResult(match, deltas, record, { dailyHands: DAILY_HANDS });
}

/**
 * Who won the match, or null if more hands remain.
 *
 * Single: ends after the first hand.
 * Daily: after DAILY_HANDS.
 * Hands mode: after N hands, highest balance wins (ties break toward lowest seat).
 * Target mode: first seat to reach the target after a hand ends the match.
 */
export function decideMatchWinner(
  config: MatchConfig,
  balances: readonly number[],
  handsPlayed: number,
): Seat | null {
  const seriesConfig: ScoreSeriesConfig = {
    mode: config.mode,
    hands: config.hands,
    target: config.target,
    dailyHands: DAILY_HANDS,
  };
  const winner = decideScoreSeriesWinner(seriesConfig, balances, handsPlayed);
  return winner as Seat | null;
}

/**
 * Series MVP from completed hand history.
 * Ties break toward the lowest seat so the result is deterministic.
 */
export function computeMatchMvp(match: MatchState): MatchMvp | null {
  if (match.history.length === 0) return null;
  const seats = match.balances.length;
  const totals = Array.from({ length: seats }, () => 0);
  let bestHandSeat = 0;
  let bestHandScore = -Infinity;
  let bestHandIndex = 0;

  for (const hand of match.history) {
    for (let seat = 0; seat < seats; seat++) {
      const score = hand.scores[seat] ?? 0;
      totals[seat]! += score;
      if (score > bestHandScore || (score === bestHandScore && seat < bestHandSeat)) {
        bestHandScore = score;
        bestHandSeat = seat;
        bestHandIndex = hand.handIndex;
      }
    }
  }

  return {
    mostPointsSeat: seatWithMost(totals) as Seat,
    mostPointsTotal: Math.max(...totals),
    bestHandSeat: bestHandSeat as Seat,
    bestHandScore: bestHandScore === -Infinity ? 0 : bestHandScore,
    bestHandIndex,
    chipLeaderSeat: seatWithMost(match.balances) as Seat,
    chipLeaderTotal: Math.max(...match.balances),
  };
}

export function advanceToNextHand(match: MatchState): MatchState {
  return advanceScoreSeriesHand(match);
}

export function matchProgressLabel(match: MatchState): string {
  return scoreSeriesProgressLabel(match, {
    unit: '圈',
    dailyTotal: DAILY_HANDS,
  });
}

export function isMatchComplete(match: MatchState): boolean {
  return isScoreSeriesComplete(match);
}

export function seatCount(players: PlayerCount): number {
  return players;
}

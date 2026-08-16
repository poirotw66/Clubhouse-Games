import { BLOCKS, GAMES } from './config';
import { noise } from './rng';
import { leagueAverageStrength, teamStrength } from './roster';
import type { Team } from './types';

const BLOCK_GAMES = GAMES / BLOCKS;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Team strength converted to a win rate. The divisor sets how much of the
 * curve real rosters actually occupy — at /6 almost every decent club pinned
 * the ceiling, so strength stopped mattering above a few points of edge.
 *
 * The clamp still matters: even the worst roster in a six-team league wins a
 * quarter of its games, and nobody wins three quarters over 120.
 */
export function winRate(strength: number, leagueAverage: number): number {
  return clamp(1 / (1 + Math.exp(-(strength - leagueAverage) / 9)), 0.25, 0.75);
}

export interface BlockInput {
  teams: Team[];
  humanTeamId: string;
  humanBonus: number;
  rng: () => number;
}

/**
 * Plays one block of the regular season for every club.
 *
 * Clubs are rated independently, but they play each *other*: the league's wins
 * and losses have to come out equal, because every win is somebody's loss.
 * Simulating each club on its own let the league book 369 wins against 351
 * losses over a decade. So the raw results are drawn from strength first, then
 * reconciled to the exact league total, taking the correction from whichever
 * clubs most overshot their own expectation.
 */
export function playBlock(input: BlockInput): void {
  const average = leagueAverageStrength(input.teams);
  const expected: number[] = [];
  const wins: number[] = [];

  input.teams.forEach((team) => {
    const bonus = team.id === input.humanTeamId ? input.humanBonus : 0;
    const rate = winRate(teamStrength(team, { trainingBonus: bonus }), average);
    const exp = BLOCK_GAMES * rate;
    expected.push(exp);
    wins.push(clamp(Math.round(exp + noise(input.rng, BLOCK_GAMES * 0.16)), 0, BLOCK_GAMES));
  });

  // Half of all team-games are wins, by definition.
  const target = Math.round((input.teams.length * BLOCK_GAMES) / 2);
  let total = wins.reduce((sum, w) => sum + w, 0);

  while (total !== target) {
    const over = total > target;
    let bestIndex = -1;
    let bestResidual = 0;
    wins.forEach((w, index) => {
      if (over ? w <= 0 : w >= BLOCK_GAMES) return;
      // Residual is how far this club ran above (or below) its own expectation.
      const residual = over ? w - expected[index] : expected[index] - w;
      if (bestIndex === -1 || residual > bestResidual) {
        bestIndex = index;
        bestResidual = residual;
      }
    });
    if (bestIndex === -1) break;
    wins[bestIndex] += over ? -1 : 1;
    total += over ? -1 : 1;
  }

  input.teams.forEach((team, index) => {
    team.wins += wins[index];
    team.losses += BLOCK_GAMES - wins[index];
  });
}

export function standings(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
}

export function finishOf(teams: Team[], teamId: string): number {
  return standings(teams).findIndex((t) => t.id === teamId) + 1;
}

export interface PlayoffOutcome {
  champion: string;
  /** How far the human club got. */
  humanResult: '未晉級' | '準決賽敗' | '總冠軍賽敗' | '總冠軍';
  lines: string[];
}

/**
 * Best-of-N between two clubs. Single-game odds are pulled towards .500 first:
 * a short series is far noisier than 120 games, which is exactly why the best
 * regular-season team has to be able to lose one.
 */
function series(
  a: Team,
  b: Team,
  wins: number,
  average: number,
  rng: () => number,
): Team {
  const rawA = winRate(teamStrength(a), average);
  const gameOdds = clamp(0.5 + (rawA - 0.5) * 0.55, 0.3, 0.7);
  let aWins = 0;
  let bWins = 0;
  while (aWins < wins && bWins < wins) {
    if (rng() < gameOdds) aWins += 1;
    else bWins += 1;
  }
  return aWins === wins ? a : b;
}

/** Top four qualify: semi-finals (best of five) then the final (best of seven). */
export function playPostseason(
  teams: Team[],
  humanTeamId: string,
  rng: () => number,
): PlayoffOutcome {
  const table = standings(teams);
  const qualified = table.slice(0, 4);
  const lines: string[] = [];

  if (!qualified.some((t) => t.id === humanTeamId)) {
    const average = leagueAverageStrength(teams);
    const semiA = series(qualified[0], qualified[3], 3, average, rng);
    const semiB = series(qualified[1], qualified[2], 3, average, rng);
    const champion = series(semiA, semiB, 4, average, rng);
    lines.push(`${champion.name} 拿下總冠軍。`);
    return { champion: champion.id, humanResult: '未晉級', lines };
  }

  const average = leagueAverageStrength(teams);
  const semiA = series(qualified[0], qualified[3], 3, average, rng);
  const semiB = series(qualified[1], qualified[2], 3, average, rng);
  lines.push(`準決賽：${semiA.name}、${semiB.name} 晉級總冠軍賽。`);

  const champion = series(semiA, semiB, 4, average, rng);
  lines.push(`總冠軍：${champion.name}。`);

  let humanResult: PlayoffOutcome['humanResult'];
  if (champion.id === humanTeamId) humanResult = '總冠軍';
  else if (semiA.id === humanTeamId || semiB.id === humanTeamId) humanResult = '總冠軍賽敗';
  else humanResult = '準決賽敗';

  return { champion: champion.id, humanResult, lines };
}

export function resetRecords(teams: Team[]): void {
  teams.forEach((team) => {
    team.wins = 0;
    team.losses = 0;
  });
}

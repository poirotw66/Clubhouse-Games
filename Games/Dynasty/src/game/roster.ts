import { LEAGUE_BASELINE, MAJOR_SLOTS } from './config';
import { ability } from './players';
import type { Player, Team } from './types';

/** Available means on the major-league roster and not on the injured list. */
export function available(team: Team): Player[] {
  return team.players.filter((p) => p.level === 'major' && p.injuredSeasons === 0);
}

export function farm(team: Team): Player[] {
  return team.players.filter((p) => p.level === 'farm');
}

function byAbility(players: Player[]): Player[] {
  return [...players].sort((a, b) => ability(b) - ability(a));
}

/**
 * Weighted average that leans on the top of the group: the best hitters take
 * far more plate appearances than the ninth-best, so a lineup is not the mean
 * of its members.
 */
function weightedTop(players: Player[], count: number): number {
  const top = byAbility(players).slice(0, count);
  if (top.length === 0) return 30;
  let sum = 0;
  let weight = 0;
  top.forEach((player, index) => {
    const w = 1 - index * (0.5 / Math.max(1, count));
    sum += ability(player) * w;
    weight += w;
  });
  // A short-handed roster is penalised: the missing slots are replacement level.
  const shortfall = (count - top.length) * 32;
  return (sum + shortfall) / (weight + (count - top.length));
}

export function lineupStrength(team: Team): number {
  return weightedTop(available(team).filter((p) => p.position !== 'P'), 9);
}

export function pitchingStrength(team: Team): number {
  const pitchers = byAbility(available(team).filter((p) => p.position === 'P'));
  const starters = weightedTop(pitchers.slice(0, 5), 5);
  const bullpen = weightedTop(pitchers.slice(5, 10), 5);
  return starters * 0.65 + bullpen * 0.35;
}

export interface StrengthInput {
  trainingBonus?: number;
  morale?: number;
}

export function teamStrength(team: Team, input: StrengthInput = {}): number {
  return (
    lineupStrength(team) * 0.5 +
    pitchingStrength(team) * 0.5 +
    (input.trainingBonus ?? 0) +
    (input.morale ?? 0)
  );
}

export function leagueAverageStrength(teams: Team[]): number {
  if (teams.length === 0) return LEAGUE_BASELINE;
  return teams.reduce((sum, team) => sum + teamStrength(team), 0) / teams.length;
}

export function payroll(team: Team): number {
  return team.players
    .filter((p) => p.level === 'major')
    .reduce((sum, p) => sum + p.salary, 0);
}

/**
 * Keeps the major-league roster at its slot limit by promoting the best
 * available farm hands and demoting the worst optionable players. Called after
 * anything that changes the roster so the club is never illegally short.
 */
export function rebalance(team: Team): void {
  const majors = team.players.filter((p) => p.level === 'major');
  const reserves = byAbility(team.players.filter((p) => p.level === 'farm'));

  if (majors.length > MAJOR_SLOTS) {
    byAbility(majors)
      .slice(MAJOR_SLOTS)
      .forEach((player) => {
        player.level = 'farm';
      });
    return;
  }

  let need = MAJOR_SLOTS - majors.length;
  for (const player of reserves) {
    if (need <= 0) break;
    player.level = 'major';
    need -= 1;
  }
}

export function starCount(team: Team): number {
  return team.players.filter((p) => p.level === 'major' && ability(p) >= 70).length;
}

import { SCOUT_TIERS } from './config';
import { generatePlayer, ability } from './players';
import { randInt, streamRng } from './rng';
import type { GameState, Player } from './types';

const CLASS_SIZE = 8;

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * The scouting band is the signature mechanic: the club never learns a
 * prospect's true ceiling, only an interval around it. Spending narrows the
 * interval but never closes it, so the draft stays a bet.
 *
 * The band is centred with a deliberate offset — reports are wrong in a
 * direction, not merely imprecise — which is what lets a well-scouted club
 * find value that a lazy one misses.
 */
export function scoutBand(
  potential: number,
  width: number,
  r: () => number,
): { low: number; high: number } {
  // The bias can reach the full width while the quoted band is narrower than
  // that, so roughly one report in seven does not contain the truth at all.
  // An interval that always contained it would make the draft a solved
  // problem — you would simply take the highest midpoint every year.
  const bias = (r() - 0.5) * 2 * width;
  const half = width * 0.85;
  const centre = potential + bias;
  return {
    low: clamp(Math.round(centre - half), 20, 99),
    high: clamp(Math.round(centre + half), 20, 99),
  };
}

export function bandWidthFor(spend: number): number {
  let width = SCOUT_TIERS[0].width;
  for (const tier of SCOUT_TIERS) {
    if (spend >= tier.spend) width = tier.width;
  }
  return width;
}

/**
 * One year's draft class. Generated from the seed and the year alone, so the
 * question "is this class worth tanking for?" has a real answer that a player
 * can learn to read.
 */
export function buildDraftClass(state: GameState, scoutSpend: number): Player[] {
  const r = streamRng(state.seed, `draft:${state.year}`);
  const width = bandWidthFor(scoutSpend);
  const scoutRng = streamRng(state.seed, `scout:${state.year}:${scoutSpend}`);

  const pool: Player[] = [];
  for (let i = 0; i < CLASS_SIZE; i++) {
    const age = randInt(r, 18, 21);
    // Raw teenagers: low ability now, and the whole decision is the ceiling.
    const base = randInt(r, 26, 44);
    const potential = clamp(base + randInt(r, 6, 46), 30, 99);
    const player = generatePlayer({
      r,
      teamId: '',
      age,
      ability: base,
      potential,
      level: 'farm',
      homegrown: true,
    });
    player.salary = 60;
    player.years = 5;
    player.band = scoutBand(potential, width, scoutRng);
    pool.push(player);
  }
  return pool;
}

/** What the report claims, for sorting and display. */
export function bandMidpoint(player: Player): number {
  return (player.band.low + player.band.high) / 2;
}

export function describeProspect(player: Player): string[] {
  return [
    `${player.age} 歲・目前能力 ${Math.round(ability(player))}`,
    `球探評估潛力 ${player.band.low}–${player.band.high}`,
  ];
}

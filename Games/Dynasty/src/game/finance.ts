import {
  FARM_UPKEEP_PER_LEVEL,
  HOME_GAMES,
  LUXURY_RATE,
  SALARY_CAP,
  STADIUM_UPKEEP,
} from './config';
import { payroll, starCount } from './roster';
import type { GameState, SeasonLedger, Team } from './types';

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Raising the ticket price lifts the per-head take but thins the crowd, and a
 * thin crowd is also a quieter one — the elasticity is what stops "set price to
 * maximum" from being the answer every year.
 */
export function priceElasticity(price: number): number {
  return clamp(1.5 - price / 650, 0.35, 1.15);
}

export function attendance(state: GameState, lastWins: number): number {
  // Tuned to a real CPBL gate — a few thousand a night, not a full NPB house.
  const base = 2000 + state.heat * 55 + lastWins * 30;
  return Math.max(800, Math.round(base * priceElasticity(state.finance.ticketPrice)));
}

export interface LedgerInput {
  state: GameState;
  team: Team;
  wins: number;
  madePlayoffs: boolean;
  wonTitle: boolean;
  boardBonus: number;
}

export function settle(input: LedgerInput): SeasonLedger {
  const { state, team, wins, wonTitle, boardBonus } = input;
  const crowd = attendance(state, wins);

  const tickets = Math.round((crowd * state.finance.ticketPrice * HOME_GAMES) / 10000);
  const merch = Math.round(state.heat * starCount(team) * 6);
  const broadcast = Math.round(3500 + wins * 25);
  const sponsor = Math.round(state.heat * 30 * (wonTitle ? 1.5 : 1));

  const salaries = payroll(team);
  const over = Math.max(0, salaries - SALARY_CAP);
  const luxuryTax = Math.round(over * LUXURY_RATE);

  const spending =
    state.finance.training + state.finance.scouting + state.finance.marketing;
  // Matchday costs scale with the crowd: stewards, cleaning, catering. Without
  // a variable cost, filling the stadium was pure profit and every club in the
  // league finished the decade with a billion in the bank.
  const matchday = Math.round(crowd * 0.25);
  const upkeep = state.farmLevel * FARM_UPKEEP_PER_LEVEL + STADIUM_UPKEEP + matchday;

  const income = tickets + merch + broadcast + sponsor + boardBonus;
  const outgoing = salaries + luxuryTax + spending + upkeep;

  return {
    year: state.year,
    tickets,
    merch,
    broadcast,
    sponsor,
    salaries,
    luxuryTax,
    spending,
    upkeep,
    net: income - outgoing,
    attendance: crowd,
  };
}

/**
 * Fan heat follows results with a long memory and a slow decay, so one good
 * season does not fill the stadium forever and one bad one does not empty it.
 */
export function nextHeat(
  current: number,
  wins: number,
  games: number,
  madePlayoffs: boolean,
  wonTitle: boolean,
  ticketPrice: number,
): number {
  const winPct = wins / games;
  const priceAnger = Math.max(0, Math.floor((ticketPrice - 350) / 50)) * 2;
  const next =
    current +
    (winPct - 0.5) * 90 +
    (madePlayoffs ? 8 : 0) +
    (wonTitle ? 20 : 0) -
    current * 0.1 -
    priceAnger;
  // A floor of 12, because every club keeps its die-hards. Allowing heat to
  // reach zero created a spiral a weak club could never climb out of: no
  // crowd, no money, no players, no crowd.
  return clamp(Math.round(next), 12, 100);
}

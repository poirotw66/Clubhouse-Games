/**
 * Short league season: 4-team round-robin + championship, with localStorage resume.
 */

import { createRng, type Rng } from './rng.ts';
import {
  PLAYER_TEAM_ID,
  TEAMS,
  getTeam,
  type TeamId,
} from './teams.ts';

export const SEASON_KEY = 'clubhouse-toy-baseball-season-v1';

export type SeasonPhase = 'regular' | 'finals' | 'complete';

export interface SeasonGame {
  id: string;
  homeId: TeamId;
  awayId: TeamId;
  /** Regular-season slot index, or 'finals'. */
  slot: number | 'finals';
  played: boolean;
  homeRuns: number | null;
  awayRuns: number | null;
}

export interface StandingRow {
  teamId: TeamId;
  wins: number;
  losses: number;
  ties: number;
  runsFor: number;
  runsAgainst: number;
}

export interface SeasonState {
  version: 1;
  phase: SeasonPhase;
  /** Index into `schedule` for the next unplayed regular game involving the player, or schedule length when regular is done. */
  nextPlayerGameIndex: number;
  schedule: SeasonGame[];
  finals: SeasonGame | null;
  seed: number;
  difficulty: 'easy' | 'normal' | 'hard';
  inningsLength: 3 | 6 | 9;
  handedness: 'left' | 'right';
  championId: TeamId | null;
  updatedAt: number;
}

export const EMPTY_SEASON_MARKER = null;

function asNonNegInt(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function isTeamId(value: unknown): value is TeamId {
  return typeof value === 'string' && TEAMS.some((t) => t.id === value);
}

/** Build single round-robin: each pair once; player always away (bats first). */
export function buildRoundRobinSchedule(seed: number): SeasonGame[] {
  const others = TEAMS.filter((t) => t.id !== PLAYER_TEAM_ID).map((t) => t.id);
  const pairs: Array<[TeamId, TeamId]> = [];
  // Player vs each opponent (player = away).
  for (const opp of others) {
    pairs.push([PLAYER_TEAM_ID, opp]);
  }
  // Remaining CPU vs CPU games (for standings).
  for (let i = 0; i < others.length; i++) {
    for (let j = i + 1; j < others.length; j++) {
      pairs.push([others[i], others[j]]);
    }
  }
  // Stable order with light seed shuffle of CPU-only games after player games.
  const rng = createRng(seed ^ 0x5ea501);
  const playerGames = pairs.filter((p) => p[0] === PLAYER_TEAM_ID || p[1] === PLAYER_TEAM_ID);
  const cpuGames = pairs.filter((p) => p[0] !== PLAYER_TEAM_ID && p[1] !== PLAYER_TEAM_ID);
  // Fisher-Yates on CPU games only.
  for (let i = cpuGames.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = cpuGames[i];
    cpuGames[i] = cpuGames[j];
    cpuGames[j] = tmp;
  }
  const ordered = [...playerGames, ...cpuGames];
  return ordered.map((pair, slot) => {
    const involvesPlayer = pair[0] === PLAYER_TEAM_ID || pair[1] === PLAYER_TEAM_ID;
    const awayId = involvesPlayer ? PLAYER_TEAM_ID : pair[0];
    const homeId = involvesPlayer
      ? (pair[0] === PLAYER_TEAM_ID ? pair[1] : pair[0])
      : pair[1];
    return {
      id: `rr-${slot}`,
      homeId,
      awayId,
      slot,
      played: false,
      homeRuns: null,
      awayRuns: null,
    };
  });
}

export function createSeason(opts: {
  seed?: number;
  difficulty?: SeasonState['difficulty'];
  inningsLength?: SeasonState['inningsLength'];
  handedness?: SeasonState['handedness'];
}): SeasonState {
  const seed = (opts.seed ?? (Date.now() >>> 0)) >>> 0;
  return {
    version: 1,
    phase: 'regular',
    nextPlayerGameIndex: 0,
    schedule: buildRoundRobinSchedule(seed),
    finals: null,
    seed,
    difficulty: opts.difficulty ?? 'normal',
    inningsLength: opts.inningsLength ?? 3,
    handedness: opts.handedness ?? 'right',
    championId: null,
    updatedAt: Date.now(),
  };
}

export function computeStandings(games: SeasonGame[]): StandingRow[] {
  const rows = new Map<TeamId, StandingRow>();
  for (const t of TEAMS) {
    rows.set(t.id, {
      teamId: t.id,
      wins: 0,
      losses: 0,
      ties: 0,
      runsFor: 0,
      runsAgainst: 0,
    });
  }
  for (const g of games) {
    if (!g.played || g.homeRuns == null || g.awayRuns == null) continue;
    const home = rows.get(g.homeId);
    const away = rows.get(g.awayId);
    if (!home || !away) continue;
    home.runsFor += g.homeRuns;
    home.runsAgainst += g.awayRuns;
    away.runsFor += g.awayRuns;
    away.runsAgainst += g.homeRuns;
    if (g.homeRuns > g.awayRuns) {
      home.wins += 1;
      away.losses += 1;
    } else if (g.awayRuns > g.homeRuns) {
      away.wins += 1;
      home.losses += 1;
    } else {
      home.ties += 1;
      away.ties += 1;
    }
  }
  return [...rows.values()].sort((a, b) => {
    const pts = (r: StandingRow) => r.wins * 2 + r.ties;
    const d = pts(b) - pts(a);
    if (d !== 0) return d;
    const rd = b.runsFor - b.runsAgainst - (a.runsFor - a.runsAgainst);
    if (rd !== 0) return rd;
    return a.teamId.localeCompare(b.teamId);
  });
}

/** Auto-sim a CPU vs CPU game into the schedule entry. */
export function simulateCpuGame(game: SeasonGame, rng: Rng): SeasonGame {
  const home = getTeam(game.homeId);
  const away = getTeam(game.awayId);
  const homeEdge = home.strength / (home.strength + away.strength);
  const homeWins = rng() < homeEdge;
  const base = 1 + Math.floor(rng() * 4);
  const margin = 1 + Math.floor(rng() * 3);
  const homeRuns = homeWins ? base + margin : base;
  const awayRuns = homeWins ? base : base + margin;
  return {
    ...game,
    played: true,
    homeRuns,
    awayRuns,
  };
}

/** Advance: sim pending CPU-only games before the next player game / finals. */
export function advanceCpuGames(state: SeasonState): SeasonState {
  const rng = createRng(state.seed ^ (state.updatedAt & 0xffff) ^ 0xc0ffee);
  const schedule = state.schedule.map((g) => ({ ...g }));
  for (let i = 0; i < schedule.length; i++) {
    const g = schedule[i];
    if (g.played) continue;
    const involvesPlayer = g.homeId === PLAYER_TEAM_ID || g.awayId === PLAYER_TEAM_ID;
    if (involvesPlayer) break;
    schedule[i] = simulateCpuGame(g, () => rng());
  }
  return { ...state, schedule, updatedAt: Date.now() };
}

function involvesPlayer(game: SeasonGame): boolean {
  return game.homeId === PLAYER_TEAM_ID || game.awayId === PLAYER_TEAM_ID;
}

export function nextUnplayedPlayerGame(state: SeasonState): SeasonGame | null {
  if (state.phase === 'finals' && state.finals && !state.finals.played) {
    return involvesPlayer(state.finals) ? state.finals : null;
  }
  if (state.phase !== 'regular') return null;
  return state.schedule.find((g) => !g.played && involvesPlayer(g)) ?? null;
}

export function applyPlayerResult(
  state: SeasonState,
  gameId: string,
  awayRuns: number,
  homeRuns: number,
): SeasonState {
  let schedule = state.schedule.map((g) => ({ ...g }));
  let finals = state.finals ? { ...state.finals } : null;
  let phase = state.phase;
  let championId = state.championId;

  const applyTo = (g: SeasonGame): SeasonGame => ({
    ...g,
    played: true,
    awayRuns: Math.max(0, Math.floor(awayRuns)),
    homeRuns: Math.max(0, Math.floor(homeRuns)),
  });

  if (finals && finals.id === gameId) {
    finals = applyTo(finals);
    phase = 'complete';
    championId =
      (finals.awayRuns ?? 0) > (finals.homeRuns ?? 0)
        ? finals.awayId
        : (finals.homeRuns ?? 0) > (finals.awayRuns ?? 0)
          ? finals.homeId
          : PLAYER_TEAM_ID; // rare tie → give cup to player for arcade feel
  } else {
    schedule = schedule.map((g) => (g.id === gameId ? applyTo(g) : g));
  }

  let next = advanceCpuGames({
    ...state,
    schedule,
    finals,
    phase,
    championId,
    updatedAt: Date.now(),
  });

  // After all regular games: seed finals if needed.
  if (next.phase === 'regular' && next.schedule.every((g) => g.played)) {
    const standings = computeStandings(next.schedule);
    const first = standings[0]?.teamId;
    const second = standings[1]?.teamId;
    if (first && second) {
      // Player always bats (away) in the final when they qualify; else higher seed hosts.
      const playerIn = first === PLAYER_TEAM_ID || second === PLAYER_TEAM_ID;
      const awayId = playerIn ? PLAYER_TEAM_ID : first;
      const homeId = playerIn
        ? first === PLAYER_TEAM_ID
          ? second
          : first
        : second;
      let finals: SeasonGame = {
        id: 'finals',
        homeId,
        awayId,
        slot: 'finals',
        played: false,
        homeRuns: null,
        awayRuns: null,
      };
      // Missed playoffs: auto-sim the CPU championship so the season can complete.
      if (!playerIn) {
        const rng = createRng(next.seed ^ 0xf1a415);
        finals = simulateCpuGame(finals, () => rng());
        next = {
          ...next,
          phase: 'complete',
          finals,
          championId:
            (finals.awayRuns ?? 0) >= (finals.homeRuns ?? 0)
              ? finals.awayId
              : finals.homeId,
          nextPlayerGameIndex: next.schedule.length,
        };
      } else {
        next = {
          ...next,
          phase: 'finals',
          finals,
          nextPlayerGameIndex: next.schedule.length,
        };
      }
    } else {
      next = { ...next, phase: 'complete', championId: first ?? null };
    }
  }

  // Refresh next player cursor.
  const upcoming = nextUnplayedPlayerGame(next);
  if (upcoming && upcoming.slot !== 'finals' && typeof upcoming.slot === 'number') {
    next = { ...next, nextPlayerGameIndex: upcoming.slot };
  }

  return next;
}

export function playerMadePlayoffs(state: SeasonState): boolean {
  if (state.phase === 'finals' || state.phase === 'complete') {
    if (state.finals) {
      return (
        state.finals.awayId === PLAYER_TEAM_ID
        || state.finals.homeId === PLAYER_TEAM_ID
      );
    }
  }
  if (!state.schedule.every((g) => g.played)) return false;
  const standings = computeStandings(state.schedule);
  return standings.slice(0, 2).some((r) => r.teamId === PLAYER_TEAM_ID);
}

export function mergeSeason(raw: unknown): SeasonState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return null;
  const difficulty =
    o.difficulty === 'easy' || o.difficulty === 'hard' || o.difficulty === 'normal'
      ? o.difficulty
      : 'normal';
  const inningsLength =
    o.inningsLength === 6 || o.inningsLength === 9 || o.inningsLength === 3
      ? o.inningsLength
      : 3;
  const handedness = o.handedness === 'left' ? 'left' : 'right';
  const phase: SeasonPhase =
    o.phase === 'finals' || o.phase === 'complete' || o.phase === 'regular'
      ? o.phase
      : 'regular';
  const seed = asNonNegInt(o.seed) || 1;
  const scheduleRaw = Array.isArray(o.schedule) ? o.schedule : [];
  const schedule: SeasonGame[] = [];
  for (const item of scheduleRaw) {
    if (!item || typeof item !== 'object') continue;
    const g = item as Record<string, unknown>;
    if (!isTeamId(g.homeId) || !isTeamId(g.awayId)) continue;
    if (typeof g.id !== 'string') continue;
    schedule.push({
      id: g.id,
      homeId: g.homeId,
      awayId: g.awayId,
      slot: g.slot === 'finals' ? 'finals' : asNonNegInt(g.slot),
      played: Boolean(g.played),
      homeRuns: g.homeRuns == null ? null : asNonNegInt(g.homeRuns),
      awayRuns: g.awayRuns == null ? null : asNonNegInt(g.awayRuns),
    });
  }
  if (schedule.length === 0) return null;

  let finals: SeasonGame | null = null;
  if (o.finals && typeof o.finals === 'object') {
    const g = o.finals as Record<string, unknown>;
    if (isTeamId(g.homeId) && isTeamId(g.awayId) && typeof g.id === 'string') {
      finals = {
        id: g.id,
        homeId: g.homeId,
        awayId: g.awayId,
        slot: 'finals',
        played: Boolean(g.played),
        homeRuns: g.homeRuns == null ? null : asNonNegInt(g.homeRuns),
        awayRuns: g.awayRuns == null ? null : asNonNegInt(g.awayRuns),
      };
    }
  }

  const championId = isTeamId(o.championId) ? o.championId : null;

  return {
    version: 1,
    phase,
    nextPlayerGameIndex: asNonNegInt(o.nextPlayerGameIndex),
    schedule,
    finals,
    seed,
    difficulty,
    inningsLength,
    handedness,
    championId,
    updatedAt: asNonNegInt(o.updatedAt) || Date.now(),
  };
}

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
};

function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function loadSeason(storage: StorageLike | null = defaultStorage()): SeasonState | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(SEASON_KEY);
    if (!raw) return null;
    return mergeSeason(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveSeason(
  state: SeasonState,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(SEASON_KEY, JSON.stringify(state));
  } catch {
    /* quota / private mode */
  }
}

export function clearSeason(storage: StorageLike | null = defaultStorage()): void {
  if (!storage?.removeItem) return;
  try {
    storage.removeItem(SEASON_KEY);
  } catch {
    /* ignore */
  }
}

export function seasonTitle(): string {
  return '玩具聯盟球季';
}

export function recordLabel(row: StandingRow): string {
  if (row.ties > 0) return `${row.wins}-${row.losses}-${row.ties}`;
  return `${row.wins}-${row.losses}`;
}

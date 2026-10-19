import {cupById, pointsForPlace, type CupDef} from '../data/cups.ts';
import {pickCpuRivals, type RivalStyle} from '../data/rivals.ts';
import type {DifficultyId} from '../data/characters.ts';

export interface CupEntrant {
  /** Stable id across the cup (player uses 'player', CPUs use charId). */
  id: string;
  charId: string;
  name: string;
  isPlayer: boolean;
  points: number;
  /** Place in each completed race (1..4). */
  places: number[];
}

export interface CupSession {
  cupId: string;
  raceIndex: number;
  difficulty: DifficultyId;
  entrants: CupEntrant[];
  /** Rival styles locked for the whole cup (CPU only, same order as entrants without player). */
  rivals: RivalStyle[];
}

export function createCupSession(
  cupId: string,
  playerCharId: string,
  playerName: string,
  difficulty: DifficultyId,
): CupSession {
  const rivals = pickCpuRivals(playerCharId);
  const entrants: CupEntrant[] = [
    {
      id: 'player',
      charId: playerCharId,
      name: playerName,
      isPlayer: true,
      points: 0,
      places: [],
    },
    ...rivals.map((r) => ({
      id: r.charId,
      charId: r.charId,
      name: characterNameFallback(r.charId),
      isPlayer: false,
      points: 0,
      places: [] as number[],
    })),
  ];
  return {cupId, raceIndex: 0, difficulty, entrants, rivals};
}

function characterNameFallback(charId: string): string {
  const names: Record<string, string> = {
    red: '紅帽工程師',
    green: '綠盔技師',
    yellow: '黃冠公主',
    blue: '藍鎧武士',
  };
  return names[charId] ?? charId;
}

export function cupTrackId(session: CupSession): string {
  const cup = cupById(session.cupId)!;
  return cup.trackIds[session.raceIndex];
}

export function cupDef(session: CupSession): CupDef {
  return cupById(session.cupId)!;
}

export function isLastCupRace(session: CupSession): boolean {
  const cup = cupById(session.cupId)!;
  return session.raceIndex >= cup.trackIds.length - 1;
}

/**
 * Apply race places onto the session. `placesByEntrantId` maps entrant id → place.
 * Returns a new session advanced to the next race index (or same if last).
 */
export function applyRacePlaces(
  session: CupSession,
  placesByEntrantId: Record<string, number>,
): CupSession {
  const entrants = session.entrants.map((e) => {
    const place = placesByEntrantId[e.id] ?? 4;
    return {
      ...e,
      places: [...e.places, place],
      points: e.points + pointsForPlace(place),
    };
  });
  return {
    ...session,
    entrants,
    raceIndex: session.raceIndex + 1,
  };
}

/** Standings sorted by points desc, then better average place, then player first on ties. */
export function cupStandings(session: CupSession): CupEntrant[] {
  return [...session.entrants].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const avg = (e: CupEntrant) =>
      e.places.length ? e.places.reduce((s, p) => s + p, 0) / e.places.length : 99;
    const aa = avg(a);
    const bb = avg(b);
    if (aa !== bb) return aa - bb;
    if (a.isPlayer !== b.isPlayer) return a.isPlayer ? -1 : 1;
    return a.name.localeCompare(b.name, 'zh-Hant');
  });
}

export function playerOverallPlace(session: CupSession): number {
  const order = cupStandings(session);
  const idx = order.findIndex((e) => e.isPlayer);
  return idx >= 0 ? idx + 1 : 4;
}

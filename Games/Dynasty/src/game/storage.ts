import { STORAGE_KEY } from './config';
import type { GameState } from './types';

const SAVE_KEY = `${STORAGE_KEY}:save`;
const ARCHIVE_KEY = `${STORAGE_KEY}:archive`;

export interface ArchiveEntry {
  seedCode: string;
  gmName: string;
  club: string;
  verdict: string;
  score: number;
  titles: number;
}

export function saveGame(state: GameState): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full quota: the tenure simply is not resumable.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    // Every field the engine reads unguarded is checked, so a save from an
    // older build starts over instead of crashing on the first decision.
    const intact =
      parsed &&
      typeof parsed.seedCode === 'string' &&
      Array.isArray(parsed.teams) &&
      Array.isArray(parsed.history) &&
      Array.isArray(parsed.ledgers) &&
      Array.isArray(parsed.seenEvents) &&
      Array.isArray(parsed.seenSituations) &&
      Array.isArray(parsed.seenTrainingScenarios) &&
      Array.isArray(parsed.seenBudgetScenarios) &&
      !!parsed.board &&
      !!parsed.finance;
    return intact ? parsed : null;
  } catch {
    return null;
  }
}

export function clearGame(): void {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do.
  }
}

export function loadArchive(): ArchiveEntry[] {
  try {
    const raw = window.localStorage.getItem(ARCHIVE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ArchiveEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch {
    return [];
  }
}

export function pushArchive(entry: ArchiveEntry): ArchiveEntry[] {
  const next = [entry, ...loadArchive()].slice(0, 20);
  try {
    window.localStorage.setItem(ARCHIVE_KEY, JSON.stringify(next));
  } catch {
    // Best effort only.
  }
  return next;
}

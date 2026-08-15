import { STORAGE_KEY } from './config';
import type { GameState } from './types';

const SAVE_KEY = `${STORAGE_KEY}:save`;
const ARCHIVE_KEY = `${STORAGE_KEY}:archive`;

export interface ArchiveEntry {
  seedCode: string;
  name: string;
  position: string;
  verdict: string;
  hofScore: number;
  traits: string[];
}

export function saveGame(state: GameState): void {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full quota: the run simply is not resumable.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GameState;
    // Guard against a save written by an older build of the game.
    if (!parsed || typeof parsed.seedCode !== 'string' || !parsed.attrs || !Array.isArray(parsed.handled)) {
      return null;
    }
    return parsed;
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

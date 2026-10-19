import {CUPS} from '../data/cups.ts';
import {CHARACTERS} from '../data/characters.ts';
import {ghostStorageKey, parseGhostLap, type GhostLap} from './ghost.ts';

export const PROGRESS_KEY = 'brick-kart-racing:progress:v1';

const ALL_KART_IDS = CHARACTERS.map((c) => c.id);
/** Always available on a fresh profile. */
export const STARTER_KARTS = ['red', 'yellow'] as const;

export interface KartProgress {
  /** Character ids the player may select. */
  unlockedKarts: string[];
  /** Cup ids cleared with an overall win (1st in standings). */
  cupsWon: string[];
  /** Cup ids finished (any overall place). */
  cupsFinished: string[];
  /** Best overall place per cup (1 = best). */
  cupBestPlace: Record<string, number>;
  /** Mirror mode / Mirror Cup unlocked. */
  mirrorUnlocked: boolean;
  /** Best-lap ghosts keyed by ghostStorageKey. */
  ghosts: Record<string, GhostLap>;
  /** Total versus / GP races finished. */
  racesFinished: number;
  /** Time-trial finishes. */
  timeTrialsFinished: number;
}

export const EMPTY_PROGRESS: KartProgress = {
  unlockedKarts: [...STARTER_KARTS],
  cupsWon: [],
  cupsFinished: [],
  cupBestPlace: {},
  mirrorUnlocked: false,
  ghosts: {},
  racesFinished: 0,
  timeTrialsFinished: 0,
};

function sanitizeKartList(list: unknown): string[] {
  const out: string[] = [];
  if (!Array.isArray(list)) return [...STARTER_KARTS];
  for (const id of list) {
    if (typeof id === 'string' && ALL_KART_IDS.includes(id) && !out.includes(id)) {
      out.push(id);
    }
  }
  for (const id of STARTER_KARTS) {
    if (!out.includes(id)) out.unshift(id);
  }
  return out;
}

function sanitizeCupList(list: unknown): string[] {
  const valid = new Set(CUPS.map((c) => c.id));
  const out: string[] = [];
  if (!Array.isArray(list)) return out;
  for (const id of list) {
    if (typeof id === 'string' && valid.has(id) && !out.includes(id)) out.push(id);
  }
  return out;
}

export function loadProgress(): KartProgress {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {...EMPTY_PROGRESS, unlockedKarts: [...STARTER_KARTS], cupBestPlace: {}, ghosts: {}};
    const parsed = JSON.parse(raw) as Partial<KartProgress>;
    const unlockedKarts = sanitizeKartList(parsed.unlockedKarts);
    const cupsWon = sanitizeCupList(parsed.cupsWon);
    const cupsFinished = sanitizeCupList(parsed.cupsFinished);
    const cupBestPlace: Record<string, number> = {};
    if (parsed.cupBestPlace && typeof parsed.cupBestPlace === 'object') {
      for (const [id, place] of Object.entries(parsed.cupBestPlace)) {
        if (!CUPS.some((c) => c.id === id)) continue;
        const n = Math.floor(Number(place));
        if (n >= 1 && n <= 4) cupBestPlace[id] = n;
      }
    }
    const ghosts: Record<string, GhostLap> = {};
    if (parsed.ghosts && typeof parsed.ghosts === 'object') {
      for (const [key, value] of Object.entries(parsed.ghosts)) {
        const g = parseGhostLap(value);
        if (g) ghosts[key] = g;
      }
    }
    const mirrorUnlocked =
      Boolean(parsed.mirrorUnlocked) || cupsWon.includes('brick-cup');
    return {
      unlockedKarts,
      cupsWon,
      cupsFinished,
      cupBestPlace,
      mirrorUnlocked,
      ghosts,
      racesFinished: Math.max(0, Math.floor(Number(parsed.racesFinished) || 0)),
      timeTrialsFinished: Math.max(0, Math.floor(Number(parsed.timeTrialsFinished) || 0)),
    };
  } catch {
    return {...EMPTY_PROGRESS, unlockedKarts: [...STARTER_KARTS], cupBestPlace: {}, ghosts: {}};
  }
}

export function saveProgress(progress: KartProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* quota / private mode */
  }
}

export function isKartUnlocked(progress: KartProgress, charId: string): boolean {
  return progress.unlockedKarts.includes(charId);
}

export function isCupUnlocked(progress: KartProgress, cupId: string): boolean {
  const cup = CUPS.find((c) => c.id === cupId);
  if (!cup) return false;
  if (!cup.requiresBrickCupWin) return true;
  return progress.mirrorUnlocked || progress.cupsWon.includes('brick-cup');
}

export function isMirrorUnlocked(progress: KartProgress): boolean {
  return progress.mirrorUnlocked || progress.cupsWon.includes('brick-cup');
}

/**
 * Apply end-of-cup rewards. `overallPlace` is 1..4 from standings.
 * Returns which unlock messages to show (Traditional Chinese).
 */
export function applyCupFinish(
  progress: KartProgress,
  cupId: string,
  overallPlace: number,
): {progress: KartProgress; unlocked: string[]} {
  const unlocked: string[] = [];
  const next: KartProgress = {
    ...progress,
    unlockedKarts: [...progress.unlockedKarts],
    cupsWon: [...progress.cupsWon],
    cupsFinished: [...progress.cupsFinished],
    cupBestPlace: {...progress.cupBestPlace},
    ghosts: {...progress.ghosts},
  };

  if (!next.cupsFinished.includes(cupId)) next.cupsFinished.push(cupId);

  const prevBest = next.cupBestPlace[cupId];
  if (prevBest == null || overallPlace < prevBest) {
    next.cupBestPlace[cupId] = overallPlace;
  }

  const unlockKart = (id: string, label: string) => {
    if (!next.unlockedKarts.includes(id)) {
      next.unlockedKarts.push(id);
      unlocked.push(label);
    }
  };

  // Completing any cup unlocks the speed kart.
  unlockKart('green', '解鎖車手：綠盔技師');

  if (overallPlace <= 2) {
    unlockKart('blue', '解鎖車手：藍鎧武士');
  }

  if (overallPlace === 1) {
    if (!next.cupsWon.includes(cupId)) next.cupsWon.push(cupId);
    if (cupId === 'brick-cup' && !next.mirrorUnlocked) {
      next.mirrorUnlocked = true;
      unlocked.push('解鎖：鏡像賽道與鏡像盃');
    }
    unlockKart('blue', '解鎖車手：藍鎧武士');
  }

  return {progress: next, unlocked};
}

export function recordRaceFinished(progress: KartProgress, timeTrial: boolean): KartProgress {
  return {
    ...progress,
    racesFinished: progress.racesFinished + (timeTrial ? 0 : 1),
    timeTrialsFinished: progress.timeTrialsFinished + (timeTrial ? 1 : 0),
  };
}

export function getGhost(progress: KartProgress, trackId: string, mirror: boolean): GhostLap | null {
  return progress.ghosts[ghostStorageKey(trackId, mirror)] ?? null;
}

/** Store a ghost only when it improves the stored best-lap duration. */
export function maybeStoreGhost(
  progress: KartProgress,
  ghost: GhostLap,
): {progress: KartProgress; stored: boolean} {
  const key = ghostStorageKey(ghost.trackId, ghost.mirror);
  const prev = progress.ghosts[key];
  if (prev && prev.duration > 0 && ghost.duration >= prev.duration) {
    return {progress, stored: false};
  }
  return {
    progress: {
      ...progress,
      ghosts: {...progress.ghosts, [key]: ghost},
    },
    stored: true,
  };
}

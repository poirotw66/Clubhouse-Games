import {
  STORAGE_ASSIST_KEY,
  STORAGE_BEST_1P,
  STORAGE_BEST_2P,
  STORAGE_BEST_LEGACY,
  STORAGE_GHOST_1P,
  STORAGE_GHOST_2P,
  STORAGE_LANG_KEY,
  STORAGE_MODE_KEY,
  STORAGE_MUTE_KEY,
  type PlayMode,
} from './constants';

export type Lang = 'zh' | 'en';

export interface GhostSample {
  t: number;
  x: number;
}

function bestKey(mode: PlayMode): string {
  return mode === '2p' ? STORAGE_BEST_2P : STORAGE_BEST_1P;
}

function ghostKey(mode: PlayMode): string {
  return mode === '2p' ? STORAGE_GHOST_2P : STORAGE_GHOST_1P;
}

function readNumber(key: string): number | null {
  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function loadBestTime(mode: PlayMode): number | null {
  const v2 = readNumber(bestKey(mode));
  if (v2 != null) return v2;
  if (mode === '1p') {
    const legacy = readNumber(STORAGE_BEST_LEGACY);
    if (legacy != null) {
      try {
        localStorage.setItem(STORAGE_BEST_1P, String(legacy));
      } catch {
        /* ignore */
      }
      return legacy;
    }
  }
  return null;
}

export function saveBestTime(mode: PlayMode, seconds: number): number | null {
  const prev = loadBestTime(mode);
  if (prev != null && seconds >= prev) return prev;
  try {
    localStorage.setItem(bestKey(mode), String(seconds));
  } catch {
    /* private mode */
  }
  return seconds;
}

export function loadGhost(mode: PlayMode): GhostSample[] | null {
  try {
    const raw = localStorage.getItem(ghostKey(mode));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as GhostSample[];
    if (!Array.isArray(parsed) || parsed.length < 2) return null;
    return parsed.filter((s) => s && Number.isFinite(s.t) && Number.isFinite(s.x));
  } catch {
    return null;
  }
}

export function saveGhost(mode: PlayMode, samples: GhostSample[]): void {
  if (samples.length < 2) return;
  try {
    const slim = samples.length > 600 ? samples.filter((_, i) => i % 2 === 0) : samples;
    localStorage.setItem(ghostKey(mode), JSON.stringify(slim));
  } catch {
    /* ignore */
  }
}

export function loadLang(): Lang {
  try {
    const raw = localStorage.getItem(STORAGE_LANG_KEY);
    if (raw === 'en' || raw === 'zh') return raw;
  } catch {
    /* ignore */
  }
  return 'zh';
}

export function saveLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_LANG_KEY, lang);
  } catch {
    /* ignore */
  }
}

export function loadMute(): boolean {
  try {
    return localStorage.getItem(STORAGE_MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMute(muted: boolean): void {
  try {
    localStorage.setItem(STORAGE_MUTE_KEY, muted ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function loadMode(): PlayMode {
  try {
    const raw = localStorage.getItem(STORAGE_MODE_KEY);
    if (raw === '1p' || raw === '2p') return raw;
  } catch {
    /* ignore */
  }
  return '1p';
}

export function saveMode(mode: PlayMode): void {
  try {
    localStorage.setItem(STORAGE_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Beginner assist — off by default. */
export function loadAssist(): boolean {
  try {
    return localStorage.getItem(STORAGE_ASSIST_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveAssist(on: boolean): void {
  try {
    localStorage.setItem(STORAGE_ASSIST_KEY, on ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function shareToX(text: string, url: string): void {
  const intent = new URL('https://twitter.com/intent/tweet');
  intent.searchParams.set('text', text);
  intent.searchParams.set('url', url);
  window.open(intent.toString(), '_blank', 'noopener,noreferrer');
}

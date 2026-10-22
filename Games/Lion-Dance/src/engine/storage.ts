import { STORAGE_BEST_KEY, STORAGE_LANG_KEY } from './constants';

export type Lang = 'zh' | 'en';

export function loadBestTime(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_BEST_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

export function saveBestTime(seconds: number): number | null {
  const prev = loadBestTime();
  if (prev != null && seconds >= prev) return prev;
  try {
    localStorage.setItem(STORAGE_BEST_KEY, String(seconds));
  } catch {
    /* private mode */
  }
  return seconds;
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

export function shareToX(text: string, url: string): void {
  const intent = new URL('https://twitter.com/intent/tweet');
  intent.searchParams.set('text', text);
  intent.searchParams.set('url', url);
  window.open(intent.toString(), '_blank', 'noopener,noreferrer');
}

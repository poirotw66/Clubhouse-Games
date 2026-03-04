/**
 * Simple i18n: locale stored in localStorage, t(key) returns string by locale.
 * All user-facing strings use keys; no raw Chinese in code.
 */

export type Locale = 'zh-TW' | 'en';

const STORAGE_KEY = 'mls_locale';

const messages: Record<Locale, Record<string, string>> = {
  'zh-TW': {
    'mission.pour': '傾倒液體',
    'mission.win_level': '完成關卡',
    'mission.use_item': '使用任意道具',
    'mission.daily_title': '每日任務',
    'mission.progress': '進度',
    'mission.claimed': '已領取',
    'mission.claim_reward': '領取獎勵',
    'mission.in_progress': '進行中',
    'settings.title': '設定',
    'settings.sound': '音效',
    'settings.sound_on': '開',
    'settings.sound_off': '關',
    'settings.language': '語言',
    'settings.close': '關閉',
  },
  en: {
    'mission.pour': 'Pour liquid',
    'mission.win_level': 'Complete levels',
    'mission.use_item': 'Use any item',
    'mission.daily_title': 'Daily Missions',
    'mission.progress': 'Progress',
    'mission.claimed': 'Claimed',
    'mission.claim_reward': 'Claim Reward',
    'mission.in_progress': 'In progress',
    'settings.title': 'Settings',
    'settings.sound': 'Sound',
    'settings.sound_on': 'On',
    'settings.sound_off': 'Off',
    'settings.language': 'Language',
    'settings.close': 'Close',
  },
};

export function getLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'zh-TW' || stored === 'en') return stored;
  return 'zh-TW';
}

export function setLocale(locale: Locale): void {
  localStorage.setItem(STORAGE_KEY, locale);
}

export function t(key: string, locale?: Locale): string {
  const loc = locale ?? getLocale();
  const map = messages[loc];
  return map[key] ?? key;
}

import type { Lang } from './engine/storage';
import type { RankId } from './engine/titles';

const STR = {
  zh: {
    title: '花花舞獅踩街',
    subtitle: '廟口 50 公尺・醒獅採青',
    tagline: 'Q W 控前腳　O P 控後腳　放開踩地往前衝',
    start: '開始踩街',
    howTo: '操作說明',
    best: '最佳',
    noBest: '尚無紀錄',
    langToggle: 'English',
    distance: '距離',
    time: '剩餘',
    getUp: '起身／重來',
    frontLeft: '前左 Q',
    frontRight: '前右 W',
    backLeft: '後左 O',
    backRight: '後右 P',
    fallHint: '跌倒了！按 R 起身',
    finishHint: '採青！',
    playAgain: '再玩一局',
    share: '分享到 X',
    backMenu: '回選單',
    howtoBody: [
      'Q／W：前左／前右腳 — 按住抬起並向前擺，放開踩地出力。',
      'O／P：後左／後右腳 — 同樣按住擺、放開踩。',
      '試著對角輪替（Q+P、W+O），保持身體平衡。',
      '90 秒內走到 50 公尺終點，獅頭採下紅包（青）即過關。',
      '跌倒後按 R 可在短時間內起身；太慢則本局結束。',
    ],
    close: '關閉',
    ranks: {
      legend: '廟會傳奇',
      king: '獅王',
      awakened: '醒獅',
      cub: '小獅仔',
      retry: '再試一次',
    } satisfies Record<RankId, string>,
    shareWin: (rank: string, time: string) =>
      `我在「花花舞獅踩街」拿到「${rank}」！成績 ${time}｜Clubhouse Games`,
    shareLose: (dist: string) =>
      `我在「花花舞獅踩街」走到 ${dist}，再試一次！｜Clubhouse Games`,
    resultFinish: '採青成功',
    resultFail: '踩街中斷',
    timeoutSub: '時間到了，紅包還掛著。',
    fallSub: '獅腳一軟，花花飛了出去。',
  },
  en: {
    title: 'Bloom Lion Dance',
    subtitle: '50 m temple street · catch the greens',
    tagline: 'Q W front legs · O P back legs · release to plant & push',
    start: 'Start the parade',
    howTo: 'How to play',
    best: 'Best',
    noBest: 'No record yet',
    langToggle: '中文',
    distance: 'Distance',
    time: 'Time left',
    getUp: 'Get up / Restart',
    frontLeft: 'FL Q',
    frontRight: 'FR W',
    backLeft: 'BL O',
    backRight: 'BR P',
    fallHint: 'Down! Press R to get up',
    finishHint: 'Greens!',
    playAgain: 'Play again',
    share: 'Share on X',
    backMenu: 'Menu',
    howtoBody: [
      'Q / W: front-left / front-right — hold to lift & swing, release to plant.',
      'O / P: back-left / back-right — same lift / plant rhythm.',
      'Try diagonal pairs (Q+P, W+O) and keep the body balanced.',
      'Reach 50 m within 90 s; the lion grabs the hanging envelope to finish.',
      'After a fall, press R quickly to get up; wait too long and the run ends.',
    ],
    close: 'Close',
    ranks: {
      legend: 'Temple Fair Legend',
      king: 'Lion King',
      awakened: 'Awakened Lion',
      cub: 'Little Cub',
      retry: 'Try Again',
    } satisfies Record<RankId, string>,
    shareWin: (rank: string, time: string) =>
      `I earned “${rank}” in Bloom Lion Dance in ${time}! | Clubhouse Games`,
    shareLose: (dist: string) =>
      `I reached ${dist} in Bloom Lion Dance — trying again! | Clubhouse Games`,
    resultFinish: 'Greens caught!',
    resultFail: 'Parade interrupted',
    timeoutSub: 'Time’s up — the envelope still hangs.',
    fallSub: 'The lion tipped; Bloom went flying.',
  },
} as const;

type StringTable = {
  title: string;
  subtitle: string;
  tagline: string;
  start: string;
  howTo: string;
  best: string;
  noBest: string;
  langToggle: string;
  distance: string;
  time: string;
  getUp: string;
  frontLeft: string;
  frontRight: string;
  backLeft: string;
  backRight: string;
  fallHint: string;
  finishHint: string;
  playAgain: string;
  share: string;
  backMenu: string;
  howtoBody: readonly string[];
  close: string;
  ranks: Record<RankId, string>;
  shareWin: (rank: string, time: string) => string;
  shareLose: (dist: string) => string;
  resultFinish: string;
  resultFail: string;
  timeoutSub: string;
  fallSub: string;
};

export type Strings = StringTable;

export function t(lang: Lang): Strings {
  return STR[lang];
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  if (m <= 0) return `${r.toFixed(2)}s`;
  return `${m}:${r.toFixed(2).padStart(5, '0')}`;
}

export function formatDistance(meters: number, lang: Lang): string {
  const v = Math.min(50, Math.max(0, meters));
  return lang === 'zh' ? `${v.toFixed(1)} 公尺` : `${v.toFixed(1)} m`;
}

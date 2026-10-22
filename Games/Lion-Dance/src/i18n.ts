import type { PlayMode } from './engine/constants';
import type { Lang } from './engine/storage';
import type { RankId } from './engine/titles';

const STR = {
  zh: {
    title: '花花舞獅踩街',
    subtitle: '廟口 50 公尺・醒獅採青',
    tagline: '跟著鼓點踩街：Q W 前腳　O P 後腳',
    start: '開始踩街',
    howTo: '操作說明',
    best: '最佳',
    best1p: '單人最佳',
    best2p: '雙人最佳',
    noBest: '尚無紀錄',
    langToggle: 'English',
    muteOn: '取消靜音',
    muteOff: '靜音',
    mode1p: '單人',
    mode2p: '雙人',
    modeHint1p: '一人控四腳',
    modeHint2p: '一人獅頭（Q/W），一人獅尾（O/P）',
    distance: '距離',
    time: '剩餘',
    getUp: '起身／重來',
    frontLeft: '前左 Q',
    frontRight: '前右 W',
    backLeft: '後左 O',
    backRight: '後右 P',
    headLabel: '獅頭',
    tailLabel: '獅尾',
    touchAria: '觸控操作',
    fallHint: '跌倒了！按 R 起身',
    finishHint: '採青！',
    perfect: 'Perfect!',
    combo: '連擊',
    onBeat: '鼓點命中',
    playAgain: '再玩一局',
    share: '分享到 X',
    backMenu: '回選單',
    howtoBody: [
      'Q／W：前左／前右腳 — 按住抬起並向前擺，放開踩地出力。',
      'O／P：後左／後右腳 — 同樣按住擺、放開踩。',
      '對角輪替（Q+P ↔ W+O），並在花花鼓點附近踩地可加速。',
      '雙人模式：一人控獅頭（Q/W），一人控獅尾（O/P）。',
      '90 秒內走到 50 公尺終點採青；跌倒後按 R 可短暫起身。',
    ],
    hintRhythm: 'Q+P  ↔  W+O',
    hintCopy: '跟著鼓點放開踩地；對角輪替比較穩。',
    gotIt: '知道了',
    close: '關閉',
    ranks: {
      legend: '廟會傳奇',
      king: '獅王',
      awakened: '醒獅',
      cub: '小獅仔',
      retry: '再試一次',
    } satisfies Record<RankId, string>,
    shareWin: (mode: string, rank: string, time: string, beat: string) =>
      `我在「花花舞獅踩街」${mode}拿到「${rank}」！${time}・鼓點 ${beat}｜Clubhouse Games`,
    shareLose: (mode: string, dist: string, beat: string) =>
      `我在「花花舞獅踩街」${mode}走到 ${dist}（鼓點 ${beat}），再試一次！｜Clubhouse Games`,
    resultFinish: '採青成功',
    resultFail: '踩街中斷',
    timeoutSub: '時間到了，紅包還掛著。',
    fallSub: '獅腳一軟，花花飛了出去。',
    modeLabel: (m: PlayMode) => (m === '2p' ? '雙人' : '單人'),
  },
  en: {
    title: 'Bloom Lion Dance',
    subtitle: '50 m temple street · catch the greens',
    tagline: 'Plant on the drum beat · Q W front · O P back',
    start: 'Start the parade',
    howTo: 'How to play',
    best: 'Best',
    best1p: '1P best',
    best2p: '2P best',
    noBest: 'No record yet',
    langToggle: '中文',
    muteOn: 'Unmute',
    muteOff: 'Mute',
    mode1p: '1 Player',
    mode2p: '2 Players',
    modeHint1p: 'One player, four legs',
    modeHint2p: 'P1 head (Q/W), P2 tail (O/P)',
    distance: 'Distance',
    time: 'Time left',
    getUp: 'Get up / Restart',
    frontLeft: 'FL Q',
    frontRight: 'FR W',
    backLeft: 'BL O',
    backRight: 'BR P',
    headLabel: 'Head',
    tailLabel: 'Tail',
    touchAria: 'Touch controls',
    fallHint: 'Down! Press R to get up',
    finishHint: 'Greens!',
    perfect: 'Perfect!',
    combo: 'Combo',
    onBeat: 'On-beat',
    playAgain: 'Play again',
    share: 'Share on X',
    backMenu: 'Menu',
    howtoBody: [
      'Q / W: front-left / front-right — hold to lift & swing, release to plant.',
      'O / P: back-left / back-right — same lift / plant rhythm.',
      'Alternate diagonals (Q+P ↔ W+O) and plant near Bloom’s drum beat for speed.',
      '2P: one player drives the head (Q/W), the other the tail (O/P).',
      'Reach 50 m in 90 s; press R quickly after a fall to get up.',
    ],
    hintRhythm: 'Q+P  ↔  W+O',
    hintCopy: 'Release on the drum beat; diagonal pairs stay steadier.',
    gotIt: 'Got it',
    close: 'Close',
    ranks: {
      legend: 'Temple Fair Legend',
      king: 'Lion King',
      awakened: 'Awakened Lion',
      cub: 'Little Cub',
      retry: 'Try Again',
    } satisfies Record<RankId, string>,
    shareWin: (mode: string, rank: string, time: string, beat: string) =>
      `I earned “${rank}” in Bloom Lion Dance (${mode}) in ${time} · on-beat ${beat}! | Clubhouse Games`,
    shareLose: (mode: string, dist: string, beat: string) =>
      `I reached ${dist} in Bloom Lion Dance (${mode}, on-beat ${beat}) — trying again! | Clubhouse Games`,
    resultFinish: 'Greens caught!',
    resultFail: 'Parade interrupted',
    timeoutSub: 'Time’s up — the envelope still hangs.',
    fallSub: 'The lion tipped; Bloom went flying.',
    modeLabel: (m: PlayMode) => (m === '2p' ? '2P' : '1P'),
  },
} as const;

export type Strings = {
  title: string;
  subtitle: string;
  tagline: string;
  start: string;
  howTo: string;
  best: string;
  best1p: string;
  best2p: string;
  noBest: string;
  langToggle: string;
  muteOn: string;
  muteOff: string;
  mode1p: string;
  mode2p: string;
  modeHint1p: string;
  modeHint2p: string;
  distance: string;
  time: string;
  getUp: string;
  frontLeft: string;
  frontRight: string;
  backLeft: string;
  backRight: string;
  headLabel: string;
  tailLabel: string;
  touchAria: string;
  fallHint: string;
  finishHint: string;
  perfect: string;
  combo: string;
  onBeat: string;
  playAgain: string;
  share: string;
  backMenu: string;
  howtoBody: readonly string[];
  hintRhythm: string;
  hintCopy: string;
  gotIt: string;
  close: string;
  ranks: Record<RankId, string>;
  shareWin: (mode: string, rank: string, time: string, beat: string) => string;
  shareLose: (mode: string, dist: string, beat: string) => string;
  resultFinish: string;
  resultFail: string;
  timeoutSub: string;
  fallSub: string;
  modeLabel: (m: PlayMode) => string;
};

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

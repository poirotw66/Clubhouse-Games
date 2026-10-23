import type { PlayMode } from './engine/constants';
import type { Lang } from './engine/storage';
import type { RankId } from './engine/titles';

const STR = {
  zh: {
    title: '花花舞獅踩街',
    subtitle: '廟口 50 公尺・醒獅採青',
    tagline: '對角輪替踩街：Q+P ↔ W+O',
    start: '開始踩街（Space）',
    howTo: '操作說明',
    best: '最佳',
    best1p: '單人最佳',
    best2p: '雙人最佳',
    noBest: '尚無紀錄',
    langToggle: 'English',
    muteOn: '開聲',
    muteOff: '靜音',
    mode1p: '單人',
    mode2p: '雙人',
    modeHint1p: '一人控四腳',
    modeHint2p: '一人獅頭（Q/W），一人獅尾（O/P）',
    distanceToGoal: '距離終點',
    distance: '距離',
    time: '時間',
    falls: '跌倒',
    getUp: '起身 (R)',
    frontLeft: '前左',
    frontRight: '前右',
    backLeft: '後左',
    backRight: '後右',
    headLabel: '獅頭',
    tailLabel: '獅尾',
    touchAria: '四腳操作',
    fallStamp: '踩街中斷!!',
    fallStampAlt: '獅腳一軟!!',
    fallHint: '按 R 起身，或稍候結算',
    finishHint: '採青！',
    perfect: 'Perfect!',
    combo: '連擊',
    onBeat: '鼓點',
    playAgain: '再玩一局',
    share: '分享到 X',
    backMenu: '回選單',
    assist: '新手輔助',
    assistHint: '放寬傾倒門檻（預設關閉）',
    rules: [
      '按住抬腳向前擺，放開踩地出力。',
      '對角輪替：Q+P 與 W+O 交替，同側兩腳會倒。',
      '鼓點附近踩地可小幅加速，但亂按幾乎走不遠。',
    ] as const,
    howtoBody: [
      '四隻腳各有顏色腳環，對應下方彩色按鈕（Q／W／O／P）。',
      '按住：腳抬高並向前擺；放開：踩地出力前進。',
      '穩定走法是對角輪替 Q+P ↔ W+O；同側或四腳全抬會立刻傾倒。',
      '雙人：一人控獅頭（Q/W），一人控獅尾（O/P）。',
      '90 秒內走完 50 公尺採青；跌倒後可按「起身 (R)」再試。',
    ],
    hintCopy: '按住抬腳・放開踩地　｜　Q+P ↔ W+O',
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
    tagline: 'Diagonal gait: Q+P ↔ W+O',
    start: 'Start (Space)',
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
    distanceToGoal: 'To goal',
    distance: 'Distance',
    time: 'Time',
    falls: 'Falls',
    getUp: 'Get up (R)',
    frontLeft: 'FL',
    frontRight: 'FR',
    backLeft: 'BL',
    backRight: 'BR',
    headLabel: 'Head',
    tailLabel: 'Tail',
    touchAria: 'Leg controls',
    fallStamp: 'Parade halted!!',
    fallStampAlt: 'Legs gave out!!',
    fallHint: 'Press R to get up, or wait for results',
    finishHint: 'Greens!',
    perfect: 'Perfect!',
    combo: 'Combo',
    onBeat: 'On-beat',
    playAgain: 'Play again',
    share: 'Share on X',
    backMenu: 'Menu',
    assist: 'Beginner assist',
    assistHint: 'Wider fall tolerance (off by default)',
    rules: [
      'Hold to lift & swing; release to plant and push.',
      'Alternate diagonals Q+P ↔ W+O — same-side tips you.',
      'Plant near the drum for a small boost; mashing barely moves.',
    ] as const,
    howtoBody: [
      'Each leg has a colour band matching the on-screen buttons (Q / W / O / P).',
      'Hold: lift high and swing forward; release: plant and push.',
      'Stable gait is diagonal pairs Q+P ↔ W+O; same-side or all-up tips over.',
      '2P: one drives the head (Q/W), the other the tail (O/P).',
      'Reach 50 m in 90 s; after a fall, press Get up (R) to continue.',
    ],
    hintCopy: 'Hold to lift · release to plant  |  Q+P ↔ W+O',
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
  distanceToGoal: string;
  distance: string;
  time: string;
  falls: string;
  getUp: string;
  frontLeft: string;
  frontRight: string;
  backLeft: string;
  backRight: string;
  headLabel: string;
  tailLabel: string;
  touchAria: string;
  fallStamp: string;
  fallStampAlt: string;
  fallHint: string;
  finishHint: string;
  perfect: string;
  combo: string;
  onBeat: string;
  playAgain: string;
  share: string;
  backMenu: string;
  assist: string;
  assistHint: string;
  rules: readonly string[];
  howtoBody: readonly string[];
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
  return STR[lang] as Strings;
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

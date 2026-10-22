/**
 * Short campaign ladder: 10 stages across 3 chapters.
 * Stars gate chapter unlocks; stages unlock sequentially within a chapter.
 */

import type { ThemeId } from './memoryLogic.ts';
import { hashString } from './rng.ts';
import {
  EMPTY_CAMPAIGN,
  loadCampaignProgress,
  saveCampaignProgress,
  type CampaignProgress,
} from './storage.ts';

export type StageMechanic = 'none' | 'timed' | 'swap' | 'bomb' | 'triple';

export type CampaignStage = {
  id: string;
  name: string;
  blurb: string;
  chapter: 1 | 2 | 3;
  /** Distinct faces on the board (pairs when copies=2; triples when copies=3). */
  faceCount: number;
  themeId: ThemeId;
  mechanic: StageMechanic;
  seedCode: string;
  /** Soft time limit in seconds; null = untimed. */
  timeLimitSec: number | null;
  /** Moves for ★★★ / ★★ (clear = at least ★). */
  starMoves: [number, number];
  /** Extra time ceiling for ★★★ (null = ignore time for third star). */
  starTimeSec: number | null;
  /** Swap interval when mechanic includes swap. */
  swapEverySec?: number;
  /** Seconds added to elapsed on bomb miss. */
  bombPenaltySec?: number;
};

export const CAMPAIGN_STAGES: readonly CampaignStage[] = [
  {
    id: 'c1-warmup',
    name: '熱身配對',
    blurb: '六對入門・熟悉翻牌',
    chapter: 1,
    faceCount: 6,
    themeId: 'classic',
    mechanic: 'none',
    seedCode: 'mm-camp-1',
    timeLimitSec: null,
    starMoves: [10, 16],
    starTimeSec: 45,
  },
  {
    id: 'c1-focus',
    name: '專心記住',
    blurb: '六對・步數壓力',
    chapter: 1,
    faceCount: 6,
    themeId: 'orchard',
    mechanic: 'none',
    seedCode: 'mm-camp-2',
    timeLimitSec: null,
    starMoves: [9, 14],
    starTimeSec: 40,
  },
  {
    id: 'c1-night',
    name: '夜空限時',
    blurb: '六對・50 秒內清盤',
    chapter: 1,
    faceCount: 6,
    themeId: 'night',
    mechanic: 'timed',
    seedCode: 'mm-camp-3',
    timeLimitSec: 50,
    starMoves: [12, 18],
    starTimeSec: 35,
  },
  {
    id: 'c1-jewel',
    name: '寶庫擴張',
    blurb: '十二對・經典節奏',
    chapter: 1,
    faceCount: 12,
    themeId: 'jewel',
    mechanic: 'none',
    seedCode: 'mm-camp-4',
    timeLimitSec: null,
    starMoves: [22, 32],
    starTimeSec: 90,
  },
  {
    id: 'c2-swap',
    name: '牌位互換',
    blurb: '背面牌會偶爾互換位置',
    chapter: 2,
    faceCount: 6,
    themeId: 'classic',
    mechanic: 'swap',
    seedCode: 'mm-camp-5',
    timeLimitSec: null,
    starMoves: [12, 18],
    starTimeSec: 55,
    swapEverySec: 9,
  },
  {
    id: 'c2-bomb',
    name: '炸彈警示',
    blurb: '翻錯含炸彈牌會罰時',
    chapter: 2,
    faceCount: 6,
    themeId: 'night',
    mechanic: 'bomb',
    seedCode: 'mm-camp-6',
    timeLimitSec: 70,
    starMoves: [12, 18],
    starTimeSec: 45,
    bombPenaltySec: 8,
  },
  {
    id: 'c2-triple',
    name: '三張一組',
    blurb: '每次翻三張・同圖才算',
    chapter: 2,
    faceCount: 4,
    themeId: 'orchard',
    mechanic: 'triple',
    seedCode: 'mm-camp-7',
    timeLimitSec: null,
    starMoves: [10, 16],
    starTimeSec: 60,
  },
  {
    id: 'c3-pressure',
    name: '雙壓互換',
    blurb: '十二對・限時＋互換',
    chapter: 3,
    faceCount: 12,
    themeId: 'classic',
    mechanic: 'swap',
    seedCode: 'mm-camp-8',
    timeLimitSec: 100,
    starMoves: [28, 40],
    starTimeSec: 75,
    swapEverySec: 8,
  },
  {
    id: 'c3-arsenal',
    name: '炸彈寶庫',
    blurb: '十二對含炸彈・罰時更重',
    chapter: 3,
    faceCount: 12,
    themeId: 'jewel',
    mechanic: 'bomb',
    seedCode: 'mm-camp-9',
    timeLimitSec: 110,
    starMoves: [28, 40],
    starTimeSec: 80,
    bombPenaltySec: 10,
  },
  {
    id: 'c3-finale',
    name: '終章三重奏',
    blurb: '六組三張・限時決戰',
    chapter: 3,
    faceCount: 6,
    themeId: 'classic',
    mechanic: 'triple',
    seedCode: 'mm-camp-10',
    timeLimitSec: 90,
    starMoves: [16, 24],
    starTimeSec: 70,
  },
];

/** Stars required from previous chapter to unlock the next. */
export const CHAPTER_STAR_GATES: Record<2 | 3, number> = {
  2: 6,
  3: 12,
};

export function stageSeed(stage: CampaignStage): number {
  return hashString(stage.seedCode);
}

export function copiesPerFace(stage: CampaignStage): 2 | 3 {
  return stage.mechanic === 'triple' ? 3 : 2;
}

export function flipTarget(stage: CampaignStage | null): number {
  if (!stage) return 2;
  return stage.mechanic === 'triple' ? 3 : 2;
}

export function chapterStages(chapter: 1 | 2 | 3): CampaignStage[] {
  return CAMPAIGN_STAGES.filter((s) => s.chapter === chapter);
}

export function totalStarsInChapter(progress: CampaignProgress, chapter: 1 | 2 | 3): number {
  let sum = 0;
  for (const stage of chapterStages(chapter)) {
    sum += progress.stars[stage.id] ?? 0;
  }
  return sum;
}

export function isChapterUnlocked(chapter: 1 | 2 | 3, progress: CampaignProgress): boolean {
  if (chapter === 1) return true;
  const need = CHAPTER_STAR_GATES[chapter];
  const prev = (chapter - 1) as 1 | 2;
  return totalStarsInChapter(progress, prev) >= need;
}

export function isStageUnlocked(index: number, progress: CampaignProgress): boolean {
  if (index < 0 || index >= CAMPAIGN_STAGES.length) return false;
  const stage = CAMPAIGN_STAGES[index];
  if (!isChapterUnlocked(stage.chapter, progress)) return false;
  // Sequential clears within unlocked chapters (no skipping unfinished prior stages).
  if (index === 0) return true;
  return index <= progress.clearedCount;
}

export function continueStageIndex(progress: CampaignProgress): number {
  for (let i = 0; i < CAMPAIGN_STAGES.length; i++) {
    if (isStageUnlocked(i, progress) && (progress.stars[CAMPAIGN_STAGES[i].id] ?? 0) < 3) {
      return i;
    }
  }
  for (let i = 0; i < CAMPAIGN_STAGES.length; i++) {
    if (isStageUnlocked(i, progress)) return i;
  }
  return 0;
}

/** 1–3 stars from moves/time vs stage thresholds. Clear always yields ≥1. */
export function starsEarned(stage: CampaignStage, moves: number, elapsedSec: number): 1 | 2 | 3 {
  const [three, two] = stage.starMoves;
  let stars: 1 | 2 | 3 = 1;
  if (moves <= two) stars = 2;
  if (moves <= three) {
    if (stage.starTimeSec == null || elapsedSec <= stage.starTimeSec) stars = 3;
    else stars = 2;
  }
  return stars;
}

export function applyStageClear(
  progress: CampaignProgress,
  stageIndex: number,
  moves: number,
  elapsedSec: number,
): CampaignProgress {
  const stage = CAMPAIGN_STAGES[stageIndex];
  if (!stage || !Number.isFinite(moves) || moves < 0) return progress;

  const earned = starsEarned(stage, moves, elapsedSec);
  const stars = { ...progress.stars };
  stars[stage.id] = Math.max(stars[stage.id] ?? 0, earned);

  const bestMoves = { ...progress.bestMoves };
  const bestTimeSec = { ...progress.bestTimeSec };
  const prevM = bestMoves[stage.id];
  const prevT = bestTimeSec[stage.id];
  bestMoves[stage.id] = prevM == null ? moves : Math.min(prevM, moves);
  bestTimeSec[stage.id] = prevT == null ? elapsedSec : Math.min(prevT, elapsedSec);

  let clearedCount = progress.clearedCount;
  if (stageIndex === clearedCount && clearedCount < CAMPAIGN_STAGES.length) {
    clearedCount = stageIndex + 1;
  }
  return { clearedCount, stars, bestMoves, bestTimeSec };
}

export function clearStageAndPersist(
  stageIndex: number,
  moves: number,
  elapsedSec: number,
): CampaignProgress {
  const next = applyStageClear(loadCampaignProgress(), stageIndex, moves, elapsedSec);
  saveCampaignProgress(next);
  return next;
}

export { EMPTY_CAMPAIGN, loadCampaignProgress, saveCampaignProgress };
export type { CampaignProgress };

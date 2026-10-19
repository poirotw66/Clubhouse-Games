/** Place → Grand Prix points (1st…4th). */
export const CUP_POINTS = [15, 12, 10, 8] as const;

/** Track order for every cup (ids must match `data/tracks.ts`). */
export const CUP_TRACK_IDS = ['brick-park', 'desert-yard', 'neon-city'] as const;

export interface CupDef {
  id: string;
  name: string;
  blurb: string;
  /** Track ids raced in order. */
  trackIds: string[];
  /** When true, every race uses mirrored layouts. */
  mirror: boolean;
  /** Must win Brick Cup (overall 1st) before this cup unlocks. */
  requiresBrickCupWin: boolean;
}

export const CUPS: CupDef[] = [
  {
    id: 'brick-cup',
    name: '積木盃',
    blurb: '三條賽道連跑，積分最高者稱霸',
    trackIds: [...CUP_TRACK_IDS],
    mirror: false,
    requiresBrickCupWin: false,
  },
  {
    id: 'mirror-cup',
    name: '鏡像盃',
    blurb: '左右翻轉的盃賽——拿下積木盃冠軍後解鎖',
    trackIds: [...CUP_TRACK_IDS],
    mirror: true,
    requiresBrickCupWin: true,
  },
];

export function cupById(id: string): CupDef | undefined {
  return CUPS.find((c) => c.id === id);
}

export function pointsForPlace(place: number): number {
  const idx = Math.max(1, Math.min(CUP_POINTS.length, place)) - 1;
  return CUP_POINTS[idx];
}

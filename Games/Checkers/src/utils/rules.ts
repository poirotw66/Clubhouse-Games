/**
 * Ruleset variants for Clubhouse Checkers.
 * American (English) 8×8 short kings vs International (FMJD) 10×10 flying kings.
 */

export type RulesetId = 'american' | 'international';

export interface Ruleset {
  id: RulesetId;
  size: number;
  piecesPerSide: number;
  /** Kings slide any distance and long-capture. */
  flyingKings: boolean;
  /** Men may capture diagonally backward. */
  menCaptureBackward: boolean;
  /** When several capture sequences exist, only max-capture ones are legal. */
  majorityCapture: boolean;
  label: string;
  blurb: string;
}

export const RULESETS: Record<RulesetId, Ruleset> = {
  american: {
    id: 'american',
    size: 8,
    piecesPerSide: 12,
    flyingKings: false,
    menCaptureBackward: false,
    majorityCapture: false,
    label: '美式 8×8',
    blurb: '短王・兵僅向前跳',
  },
  international: {
    id: 'international',
    size: 10,
    piecesPerSide: 20,
    flyingKings: true,
    menCaptureBackward: true,
    majorityCapture: true,
    label: '國際式 10×10',
    blurb: '飛王・強制最多吃',
  },
};

export const RULESET_IDS: RulesetId[] = ['american', 'international'];

export function colLabels(size: number): string[] {
  return Array.from({ length: size }, (_, i) => String.fromCharCode(65 + i));
}

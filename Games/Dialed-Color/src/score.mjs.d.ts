declare module './score.mjs' {
  import type { Color } from './types';
  export function calculateScore(c1: Color, c2: Color): number;
}

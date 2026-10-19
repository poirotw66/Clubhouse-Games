declare module './score.mjs' {
  import type { Color } from './types';
  export function hueDelta(c1: Color, c2: Color): number;
  export function distanceComponents(
    c1: Color,
    c2: Color,
  ): {
    hueNorm: number;
    satNorm: number;
    lightNorm: number;
    hueDeg: number;
    satPct: number;
    lightPct: number;
    distance: number;
  };
  export function calculateScore(c1: Color, c2: Color): number;
  export function scoreEmoji(score: number): string;
  export function scoreBandLabel(score: number): string;
  export function scoreToAccuracy(score: number): number;
}

declare module './rng.mjs' {
  export function mulberry32(seed: number): () => number;
  export function hashString(str: string): number;
}

declare module './colors.mjs' {
  import type { Color } from './types';
  export function clampColor(h: number, s: number, l: number): Color;
  export function colorToCss(c: Color): string;
  export function huePatternId(h: number): number;
  export function huePatternLabel(h: number): string;
  export function generateColor(
    rand: () => number,
    opts?: {
      minHueGap?: number;
      lastHue?: number;
      sRange?: [number, number];
      lRange?: [number, number];
      nearHue?: number;
      nearHueWindow?: number;
    },
  ): Color;
  export function meanHue(h1: number, h2: number): number;
  export function mixColors(a: Color, b: Color): Color;
  export function complementaryOf(c: Color): Color;
  export function analogousOf(c: Color, offset: number): Color;
  export function survivalParams(round: number): {
    showMs: number;
    pass: number;
    nearHueWindow: number;
    sRange: [number, number];
    lRange: [number, number];
  };
  export const BLITZ_DURATION_MS: number;
  export const BLITZ_SHOW_MS: number;
  export const ASCENT_SHOW_MS: readonly number[];
  export const ASCENT_PASS: number;
  export const ASCENT_LEVELS: number;
  export const DAILY_ROUNDS: number;
  export const MIX_SHOW_MS: number;
  export const HARMONY_SHOW_MS: number;
  export function buildTargets(
    mode: string,
    rand: () => number,
    opts?: { count?: number; lastHue?: number },
  ): {
    targets: Color[];
    refs?: Color[];
    mixPairs?: [Color, Color][];
    prompts?: string[];
  };
  export function looseRand(): number;
  export function seededRand(seed: number): () => number;
}

declare module './daily.mjs' {
  import type { Color } from './types';
  export function dateKey(now?: Date): string;
  export function dailySeedCode(key: string): string;
  export function dailyBaseSeed(key: string): number;
  export function computeStreak(
    records: { date: string; average: number; scores: number[] }[],
    today: string,
  ): number;
  export function dailyTargets(key?: string): {
    targets: Color[];
    refs?: Color[];
    mixPairs?: [Color, Color][];
    prompts?: string[];
  };
  export const DAILY_ROUNDS: number;
  export function previousDay(key: string): string;
}

declare module './storage.mjs' {
  import type { BestRecords, GameStats, DailyRecord, Prefs } from './types';
  export function defaultBests(): BestRecords;
  export function defaultStats(): GameStats;
  export function defaultPrefs(): Prefs;
  export function loadBests(): BestRecords;
  export function saveBests(next: BestRecords): void;
  export function loadStats(): GameStats;
  export function saveStats(next: GameStats): void;
  export function recordGame(stats: GameStats, mode: string, average: number): GameStats;
  export function overallAverage(stats: GameStats): number;
  export function modeAverage(stats: GameStats, mode: string): number;
  export function loadDailyRecords(): DailyRecord[];
  export function saveDailyRecords(records: DailyRecord[]): void;
  export function upsertDaily(records: DailyRecord[], entry: DailyRecord): DailyRecord[];
  export function loadPrefs(): Prefs;
  export function savePrefs(prefs: Prefs): void;
  export const MODE_KEYS: string[];
  export const HISTORY_LIMIT: number;
}

declare module './share.mjs' {
  export function buildDailyShareText(opts: {
    date: string;
    scores: number[];
    average: number;
    streak: number;
  }): string;
  export function copyText(text: string): Promise<boolean>;
}

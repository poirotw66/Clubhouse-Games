export type DifficultyId = 'easy' | 'normal' | 'hard' | 'expert';

/** A cell index, row-major: `row * cols + col`. */
export type CellId = number;

export interface Size {
  rows: number;
  cols: number;
}

/**
 * Walls live between two orthogonally adjacent cells and block movement in
 * both directions. Stored as the sorted pair joined by a colon so membership
 * is a single set lookup rather than a scan.
 */
export type WallKey = string;

/** Classic fills every cell; blocked leaves holes the path must never enter. */
export type PuzzleVariant = 'classic' | 'blocked';

export interface Puzzle {
  seedCode: string;
  difficulty: DifficultyId;
  size: Size;
  /** Cell id → checkpoint number, 1-based and contiguous up to `checkpointCount`. */
  checkpoints: Record<CellId, number>;
  checkpointCount: number;
  walls: WallKey[];
  /** Cells the path must never enter; empty for classic puzzles. */
  blocked: CellId[];
  variant: PuzzleVariant;
  /** The generator's own Hamiltonian path; verified to be the unique solution. */
  solution: CellId[];
}

export interface Progress {
  /** Cells drawn so far, in order. Empty until the player starts at 1. */
  path: CellId[];
  hintsUsed: number;
  /** Milliseconds of elapsed play, accumulated across sessions. */
  elapsedMs: number;
  solved: boolean;
}

export type HintKind = 'locate' | 'rewind' | 'reveal' | 'segment';

export interface Hint {
  kind: HintKind;
  message: string;
  /** How much of the player's path is still correct. */
  keepLength: number;
  /** The next cell of the canonical solution, when the hint reveals it. */
  nextCell: CellId | null;
  /** Cells to highlight on the board; empty when the hint only says something. */
  revealCells: CellId[];
}

export interface DailyRecord {
  /** Local date key, YYYY-MM-DD. */
  date: string;
  elapsedMs: number;
  hintsUsed: number;
}

export interface DailyStats {
  records: DailyRecord[];
  streak: number;
  bestMs: number;
}

/** One day inside a weekly set: which seed and how the board is shaped. */
export interface WeeklyDaySpec {
  dayIndex: number;
  label: string;
  difficulty: DifficultyId;
  blockedCount: number;
}

export interface WeeklyDayRecord {
  dayIndex: number;
  elapsedMs: number;
  hintsUsed: number;
}

export interface WeeklyRecord {
  /** Monday date key (UTC+8), YYYY-MM-DD. */
  weekKey: string;
  days: WeeklyDayRecord[];
  /** True once all seven days are cleared. */
  completed: boolean;
}

export interface ClearEvent {
  difficulty: DifficultyId;
  sizeKey: string;
  elapsedMs: number;
  hintsUsed: number;
  isDaily: boolean;
  isWeekly: boolean;
  variant: PuzzleVariant;
  gaveUp: boolean;
}

export interface PlayerStats {
  totalSolved: number;
  noHintClears: number;
  clearsByDifficulty: Record<DifficultyId, number>;
  noHintByDifficulty: Record<DifficultyId, number>;
  /** Best clear time per board size key (`5x5`, …); 0 means none yet. */
  bestMsBySize: Record<string, number>;
  /** Achievement ids unlocked so far. */
  achievements: string[];
  weeklyCompletions: number;
}

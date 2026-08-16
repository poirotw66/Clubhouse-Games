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

export interface Puzzle {
  seedCode: string;
  difficulty: DifficultyId;
  size: Size;
  /** Cell id → checkpoint number, 1-based and contiguous up to `checkpointCount`. */
  checkpoints: Record<CellId, number>;
  checkpointCount: number;
  walls: WallKey[];
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

export type HintKind = 'locate' | 'rewind' | 'reveal';

export interface Hint {
  kind: HintKind;
  message: string;
  /** How much of the player's path is still correct. */
  keepLength: number;
  /** The next cell of the canonical solution, when the hint reveals it. */
  nextCell: CellId | null;
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

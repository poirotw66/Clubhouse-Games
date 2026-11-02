import type { Cell, TetrominoType } from './tetrisLogic.ts';
import { BOARD_SIZE } from './tetrisLogic.ts';

export interface StackTelemetry {
  /** Column heights from bottom (0 to 20 for each of 10 columns). */
  colHeights: number[];
  /** Maximum stack height on the board. */
  peakHeight: number;
  /** Average column height. */
  avgHeight: number;
  /** Total count of covered empty spaces (holes). */
  holesCount: number;
  /** Bumpiness: sum of height differences between adjacent columns. */
  bumpiness: number;
  /** Danger status based on peak height. */
  dangerZone: 'safe' | 'warning' | 'critical';
  /** Detected well column (0-9) if a clear vertical well exists, or null. */
  wellColumn: number | null;
  /** Depth of the detected well. */
  wellDepth: number;
}

export type BagPieceStatus = 'active' | 'next' | 'queue' | 'pool';

export interface BagStatusItem {
  type: TetrominoType;
  status: BagPieceStatus;
  label: string;
}

export interface ClearRecordStats {
  singles: number;
  doubles: number;
  triples: number;
  tetrises: number;
  tSpins: number;
  attacksSent: number;
}

export function createInitialClearStats(): ClearRecordStats {
  return {
    singles: 0,
    doubles: 0,
    triples: 0,
    tetrises: 0,
    tSpins: 0,
    attacksSent: 0,
  };
}

export function recordClearStats(
  prev: ClearRecordStats,
  linesCleared: number,
  isTSpin: boolean,
  attack: number,
): ClearRecordStats {
  return {
    singles: prev.singles + (linesCleared === 1 ? 1 : 0),
    doubles: prev.doubles + (linesCleared === 2 ? 1 : 0),
    triples: prev.triples + (linesCleared === 3 ? 1 : 0),
    tetrises: prev.tetrises + (linesCleared === 4 ? 1 : 0),
    tSpins: prev.tSpins + (isTSpin ? 1 : 0),
    attacksSent: prev.attacksSent + attack,
  };
}

/**
 * Computes stack geometry metrics from the current board state.
 */
export function computeStackTelemetry(board: Cell[][]): StackTelemetry {
  const { rows, cols } = BOARD_SIZE;
  const colHeights = new Array<number>(cols).fill(0);
  let holesCount = 0;

  for (let c = 0; c < cols; c++) {
    let foundBlock = false;
    for (let r = 0; r < rows; r++) {
      if (board[r][c] !== null) {
        if (!foundBlock) {
          colHeights[c] = rows - r;
          foundBlock = true;
        }
      } else if (foundBlock) {
        // Empty cell under an occupied cell is a hole.
        holesCount += 1;
      }
    }
  }

  const peakHeight = Math.max(0, ...colHeights);
  const sumHeight = colHeights.reduce((acc, h) => acc + h, 0);
  const avgHeight = Math.round((sumHeight / cols) * 10) / 10;

  let bumpiness = 0;
  for (let c = 0; c < cols - 1; c++) {
    bumpiness += Math.abs(colHeights[c] - colHeights[c + 1]);
  }

  let dangerZone: 'safe' | 'warning' | 'critical' = 'safe';
  if (peakHeight >= 16) {
    dangerZone = 'critical';
  } else if (peakHeight >= 12) {
    dangerZone = 'warning';
  }

  // Detect potential vertical well (e.g. column 9 or column 0 for 9-0 stacking).
  let wellColumn: number | null = null;
  let wellDepth = 0;
  for (let c = 0; c < cols; c++) {
    const leftH = c > 0 ? colHeights[c - 1] : 20;
    const rightH = c < cols - 1 ? colHeights[c + 1] : 20;
    const currentH = colHeights[c];
    const depth = Math.min(leftH, rightH) - currentH;
    if (depth >= 2 && depth > wellDepth) {
      wellDepth = depth;
      wellColumn = c;
    }
  }

  return {
    colHeights,
    peakHeight,
    avgHeight,
    holesCount,
    bumpiness,
    dangerZone,
    wellColumn,
    wellDepth,
  };
}

const ALL_PIECES: TetrominoType[] = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];

/**
 * Computes availability status for all 7 Tetromino types in the current 7-bag cycle.
 */
export function computeBagDistribution(
  activeType: TetrominoType | null,
  queue: TetrominoType[],
): BagStatusItem[] {
  const nextPiece = queue[0] ?? null;
  const queueRest = queue.slice(1, 6);

  return ALL_PIECES.map((type) => {
    let status: BagPieceStatus = 'pool';
    let label = '袋中';
    if (activeType === type) {
      status = 'active';
      label = '手牌';
    } else if (nextPiece === type) {
      status = 'next';
      label = '次手';
    } else if (queueRest.includes(type)) {
      status = 'queue';
      label = '佇列';
    }
    return { type, status, label };
  });
}

export type FeverTier = 'idle' | 'ignited' | 'overdrive' | 'max';

export interface CombatStats {
  tetrisRate: number;
  linesPerMinute: number;
  piecesPerSecond: number;
  feverRatio: number;
  feverTier: FeverTier;
  feverLabel: string;
}

/**
 * Computes competitive performance stats (Tetris Rate, LPM, PPS, Combo Fever).
 */
export function computeCombatStats(
  clearStats: ClearRecordStats,
  totalLines: number,
  locks: number,
  elapsedMs: number,
  currentCombo: number,
): CombatStats {
  const tetrisRate =
    totalLines > 0
      ? Math.round(((clearStats.tetrises * 4) / totalLines) * 100)
      : 0;

  const seconds = elapsedMs / 1000;
  const minutes = seconds / 60;

  const linesPerMinute =
    minutes > 0.05 ? Math.round((totalLines / minutes) * 10) / 10 : 0;
  const piecesPerSecond =
    seconds > 3 ? Math.round((locks / seconds) * 100) / 100 : 0;

  let feverRatio = 0;
  let feverTier: FeverTier = 'idle';
  let feverLabel = '冷靜';

  if (currentCombo >= 6) {
    feverRatio = 1.0;
    feverTier = 'max';
    feverLabel = '極限狂熱';
  } else if (currentCombo >= 4) {
    feverRatio = 0.8;
    feverTier = 'overdrive';
    feverLabel = '狂熱超頻';
  } else if (currentCombo >= 2) {
    feverRatio = 0.5;
    feverTier = 'ignited';
    feverLabel = '連鎖點火';
  } else if (currentCombo === 1) {
    feverRatio = 0.25;
    feverTier = 'ignited';
    feverLabel = '連擊起步';
  }

  return {
    tetrisRate,
    linesPerMinute,
    piecesPerSecond,
    feverRatio,
    feverTier,
    feverLabel,
  };
}

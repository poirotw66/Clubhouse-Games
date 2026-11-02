/**
 * GF(2) Linear Algebra Matrix Solver for Lights-Out / Chroma Matrix.
 * Computes exact minimum solution steps, next optimal move hints, and symmetry totems.
 */

export interface MatrixSolution {
  solvable: boolean;
  minMoves: number;
  solutionGrid: boolean[][]; // true = click this cell
  nextRecommendedMove: { row: number; col: number } | null;
  symmetry: {
    horizontal: boolean;
    vertical: boolean;
    diagonal: boolean;
    totemName: string;
  };
}

/**
 * Solve Lights-Out puzzle on an R x C grid using Gaussian elimination over GF(2).
 */
export function solveGf2LightsOut(grid: boolean[][]): MatrixSolution {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const n = rows * cols;

  if (n === 0) {
    return {
      solvable: false,
      minMoves: 0,
      solutionGrid: [],
      nextRecommendedMove: null,
      symmetry: { horizontal: true, vertical: true, diagonal: true, totemName: '真空原點' },
    };
  }

  // 1. Build adjacency matrix A of size n x n over GF(2)
  const A: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      A[idx][idx] = 1; // Self toggle
      if (r > 0) A[idx][(r - 1) * cols + c] = 1;
      if (r < rows - 1) A[idx][(r + 1) * cols + c] = 1;
      if (c > 0) A[idx][r * cols + (c - 1)] = 1;
      if (c < cols - 1) A[idx][r * cols + (c + 1)] = 1;
    }
  }

  // Target vector: we want to toggle all lights that are currently ON to OFF.
  // In GF(2), if current state is 1, toggling it once brings it to 0.
  const b: number[] = new Array(n).fill(0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      b[r * cols + c] = grid[r][c] ? 1 : 0;
    }
  }

  // Check if already completely solved
  const isAllZero = b.every((val) => val === 0);
  if (isAllZero) {
    const symmetry = analyzeSymmetry(grid);
    return {
      solvable: true,
      minMoves: 0,
      solutionGrid: Array.from({ length: rows }, () => new Array(cols).fill(false)),
      nextRecommendedMove: null,
      symmetry,
    };
  }

  // 2. Perform Gaussian elimination over GF(2) on [A | b]
  const M: number[][] = A.map((row, i) => [...row, b[i]]);
  const pivotRowForCol: number[] = new Array(n).fill(-1);
  let pivotRow = 0;

  for (let col = 0; col < n && pivotRow < n; col++) {
    // Find pivot
    let sel = -1;
    for (let r = pivotRow; r < n; r++) {
      if (M[r][col] === 1) {
        sel = r;
        break;
      }
    }
    if (sel === -1) continue;

    // Swap pivot row
    const temp = M[pivotRow];
    M[pivotRow] = M[sel];
    M[sel] = temp;
    pivotRowForCol[col] = pivotRow;

    // Eliminate other rows in GF(2)
    for (let r = 0; r < n; r++) {
      if (r !== pivotRow && M[r][col] === 1) {
        for (let k = col; k <= n; k++) {
          M[r][k] ^= M[pivotRow][k];
        }
      }
    }
    pivotRow++;
  }

  // Check consistency (no 0 = 1 equations)
  for (let r = pivotRow; r < n; r++) {
    if (M[r][n] === 1) {
      // Inconsistent system
      return {
        solvable: false,
        minMoves: -1,
        solutionGrid: Array.from({ length: rows }, () => new Array(cols).fill(false)),
        nextRecommendedMove: null,
        symmetry: analyzeSymmetry(grid),
      };
    }
  }

  // 3. Find particular solution and identify free variables
  const freeCols: number[] = [];
  for (let col = 0; col < n; col++) {
    if (pivotRowForCol[col] === -1) {
      freeCols.push(col);
    }
  }

  let bestSolution: number[] | null = null;
  let minWeight = Infinity;

  // Enumerate all combinations of free variables (up to 2^freeCols.length)
  const totalCombos = 1 << freeCols.length;
  for (let combo = 0; combo < totalCombos; combo++) {
    const x: number[] = new Array(n).fill(0);
    for (let i = 0; i < freeCols.length; i++) {
      x[freeCols[i]] = (combo >> i) & 1;
    }

    // Solve for pivot variables
    for (let col = 0; col < n; col++) {
      const pRow = pivotRowForCol[col];
      if (pRow !== -1) {
        let val = M[pRow][n];
        for (const fCol of freeCols) {
          if (M[pRow][fCol] === 1) {
            val ^= x[fCol];
          }
        }
        x[col] = val;
      }
    }

    const weight = x.reduce((sum, v) => sum + v, 0);
    if (weight < minWeight) {
      minWeight = weight;
      bestSolution = x;
    }
  }

  const solutionGrid: boolean[][] = Array.from({ length: rows }, () => new Array(cols).fill(false));
  let nextRecommendedMove: { row: number; col: number } | null = null;

  if (bestSolution) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (bestSolution[r * cols + c] === 1) {
          solutionGrid[r][c] = true;
          if (!nextRecommendedMove) {
            nextRecommendedMove = { row: r, col: c };
          }
        }
      }
    }
  }

  const symmetry = analyzeSymmetry(grid);

  return {
    solvable: bestSolution !== null,
    minMoves: minWeight === Infinity ? -1 : minWeight,
    solutionGrid,
    nextRecommendedMove,
    symmetry,
  };
}

/**
 * Analyze matrix symmetry totems: Horizontal, Vertical, Diagonal.
 */
function analyzeSymmetry(grid: boolean[][]): MatrixSolution['symmetry'] {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;

  let horizontal = true;
  let vertical = true;
  let diagonal = rows === cols;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] !== grid[r][cols - 1 - c]) horizontal = false;
      if (grid[r][c] !== grid[rows - 1 - r][c]) vertical = false;
      if (diagonal && grid[r][c] !== grid[c][r]) diagonal = false;
    }
  }

  let totemName = '自由非對稱流';
  if (horizontal && vertical && diagonal) {
    totemName = '全域超弦共鳴圖騰';
  } else if (horizontal && vertical) {
    totemName = '雙軸鏡像聖十字';
  } else if (horizontal) {
    totemName = '水平光鏡圖騰';
  } else if (vertical) {
    totemName = '垂直天秤圖騰';
  } else if (diagonal) {
    totemName = '對角線諧振鏡像';
  }

  return {
    horizontal,
    vertical,
    diagonal,
    totemName,
  };
}

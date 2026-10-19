/**
 * Beginner-method coach: diagnose stage, suggest next algorithm, auto-solve plan.
 * Uses CubeEngine.applyPermutation only (no DOM).
 */
(function (root) {
  "use strict";

  const P = () => root.CubePatterns;
  const MOVES = ["U", "U'", "U2", "D", "D'", "D2", "L", "L'", "L2", "R", "R'", "R2", "F", "F'", "F2", "B", "B'", "B2"];

  function cloneEngine(engine) {
    const CubeEngine = root.RubiksCube.CubeEngine;
    const copy = new CubeEngine(engine.size);
    copy.stickers = engine.getStickers().map((s) => ({
      position: [...s.position],
      normal: [...s.normal],
      color: s.color,
    }));
    copy.history = [...engine.history];
    copy.scramble = engine.scramble;
    return copy;
  }

  function diagnose(faces) {
    const p = P();
    if (p.isSolved(faces)) return "solved";
    if (!p.hasWhiteCross(faces)) return "white-cross";
    if (!p.hasWhiteLayer(faces)) return "white-corners";
    if (!p.hasSecondLayer(faces)) return "second-layer";
    if (!p.hasYellowCross(faces)) return "yellow-cross";
    if (!p.hasYellowFace(faces)) return "yellow-orient";
    if (!p.hasYellowCornersPermuted(faces)) return "permute-corners";
    return "permute-edges";
  }

  const STAGE_LABEL = {
    "white-cross": "白色十字",
    "white-corners": "白色四角",
    "second-layer": "第二層邊緣",
    "yellow-cross": "黃色十字",
    "yellow-orient": "黃面朝向",
    "permute-corners": "排列黃角",
    "permute-edges": "排列黃邊",
    solved: "已還原",
  };

  function scoreToward(stage, faces) {
    const p = P();
    let score = 0;
    if (stage === "white-cross" || !stage) {
      score += [1, 3, 5, 7].filter((i) => faces.U[i] === "U").length * 3;
      if (faces.F[1] === "F") score += 2;
      if (faces.R[1] === "R") score += 2;
      if (faces.B[1] === "B") score += 2;
      if (faces.L[1] === "L") score += 2;
      if (p.hasWhiteCross(faces)) score += 20;
    }
    if (stage === "white-corners") {
      score += faces.U.filter((c) => c === "U").length;
      if (p.hasWhiteLayer(faces)) score += 30;
    }
    if (stage === "second-layer") {
      for (const f of p.RING) {
        if (faces[f][3] === faces[f][4]) score += 3;
        if (faces[f][5] === faces[f][4]) score += 3;
      }
      if (p.hasSecondLayer(faces)) score += 30;
    }
    if (stage === "yellow-cross") {
      score += [1, 3, 5, 7].filter((i) => faces.D[i] === "D").length * 4;
      if (p.hasYellowCross(faces)) score += 20;
    }
    if (stage === "yellow-orient") {
      score += faces.D.filter((c) => c === "D").length;
      if (p.hasYellowFace(faces)) score += 20;
    }
    if (stage === "permute-corners" || stage === "permute-edges") {
      if (p.hasYellowCornersPermuted(faces)) score += 20;
      if (p.isSolved(faces)) score += 50;
    }
    return score;
  }

  /** Greedy deepening: find a short sequence that improves score. */
  function searchImprove(engine, stage, maxDepth) {
    const startScore = scoreToward(stage, engine.getFaces());
    let best = { score: startScore, moves: [] };

    function dfs(depth, lastFace, path) {
      const faces = engine.getFaces();
      const score = scoreToward(stage, faces);
      if (score > best.score || (score === best.score && path.length < best.moves.length)) {
        best = { score, moves: path.slice() };
      }
      if (depth === 0) return;
      // Early exit if goal met for this stage.
      const check = P().checkStage(stage, faces);
      if (check.applicable && check.complete) return;

      for (const move of MOVES) {
        if (move[0] === lastFace) continue;
        engine.applyPermutation(move);
        path.push(move);
        dfs(depth - 1, move[0], path);
        path.pop();
        engine.applyPermutation(root.RubiksCube.inverseMove(move));
      }
    }

    for (let d = 1; d <= maxDepth; d++) {
      dfs(d, "", []);
      if (best.score > startScore && best.moves.length) break;
    }
    return best.moves;
  }

  function formulaSuggest(stage, faces) {
    if (stage === "yellow-cross") {
      const edges = [1, 3, 5, 7].map((i) => faces.D[i] === "D");
      const count = edges.filter(Boolean).length;
      if (count === 4) return null;
      return {
        algorithm: "F R U R' U' F'",
        explanation: count === 0 ? "黃面點狀：先做 FRUR'U'F'" : "調整成線或拐杖後重複 FRUR'U'F'",
      };
    }
    if (stage === "yellow-orient") {
      return {
        algorithm: "R U R' U R U2 R'",
        explanation: "Sune（魚形）公式，對準後執行；可重複直到黃面全黃。",
      };
    }
    if (stage === "permute-corners") {
      return {
        algorithm: "U R U' L' U R' U' L",
        explanation: "交換黃角：已正確的一組放後面再執行。",
      };
    }
    if (stage === "permute-edges") {
      return {
        algorithm: "R2 U R U R' U' R' U' R' U R'",
        explanation: "U-perm：已正確的黃邊放後面再執行。",
      };
    }
    if (stage === "second-layer") {
      return {
        algorithm: "U R U' R' U' F' U F",
        explanation: "右插公式。先把目標邊緣對到前面，再決定左／右插。",
      };
    }
    return null;
  }

  function suggestNext(engine) {
    const faces = engine.getFaces();
    const stage = diagnose(faces);
    if (stage === "solved") {
      return { stage, label: STAGE_LABEL.solved, algorithm: "", explanation: "方塊已還原。", moves: [] };
    }

    const formula = formulaSuggest(stage, faces);
    if (formula && (stage.startsWith("yellow") || stage.startsWith("permute") || stage === "second-layer")) {
      const tokens = root.RubiksCube.parseAlgorithm(formula.algorithm);
      return {
        stage,
        label: STAGE_LABEL[stage],
        algorithm: formula.algorithm,
        explanation: formula.explanation,
        moves: tokens,
      };
    }

    const depth = stage === "white-cross" ? 4 : 3;
    const work = cloneEngine(engine);
    const found = searchImprove(work, stage, depth);
    if (found.length) {
      return {
        stage,
        label: STAGE_LABEL[stage],
        algorithm: found.join(" "),
        explanation: `搜尋到可推進「${STAGE_LABEL[stage]}」的短序列（新手層層法啟發式）。`,
        moves: found,
      };
    }

    // Fallback nudge.
    return {
      stage,
      label: STAGE_LABEL[stage],
      algorithm: "U",
      explanation: `暫以 U 調整觀察角，再繼續「${STAGE_LABEL[stage]}」。`,
      moves: ["U"],
    };
  }

  /**
   * Build a full auto-solve plan (list of {stage, label, algorithm, explanation}).
   * Mutates a clone only.
   */
  function buildSolvePlan(engine, maxSteps = 40) {
    const work = cloneEngine(engine);
    const steps = [];
    for (let i = 0; i < maxSteps; i++) {
      if (work.isSolved()) break;
      const suggestion = suggestNext(work);
      if (!suggestion.moves.length) break;
      steps.push({
        stage: suggestion.stage,
        label: suggestion.label,
        algorithm: suggestion.algorithm,
        explanation: suggestion.explanation,
      });
      for (const move of suggestion.moves) work.applyPermutation(move);
      // Avoid infinite loops on identical suggestions.
      if (steps.length >= 2) {
        const a = steps[steps.length - 1];
        const b = steps[steps.length - 2];
        if (a.algorithm === b.algorithm && a.stage === b.stage) {
          work.applyPermutation("U");
          steps.push({
            stage: a.stage,
            label: a.label,
            algorithm: "U",
            explanation: "旋轉上層以變換案例。",
          });
        }
      }
    }
    return {
      steps,
      solved: work.isSolved(),
      remainingStage: diagnose(work.getFaces()),
    };
  }

  root.BeginnerCoach = {
    diagnose,
    suggestNext,
    buildSolvePlan,
    STAGE_LABEL,
    cloneEngine,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);

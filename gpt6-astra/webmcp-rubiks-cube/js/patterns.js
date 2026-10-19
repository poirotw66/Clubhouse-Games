/**
 * Pure 3×3 stage predicates for beginner layer-by-layer (white on U).
 * faces[face] is a length-9 row-major array of sticker color letters.
 */
(function (root) {
  "use strict";

  const FACE_NAMES = ["U", "D", "L", "R", "F", "B"];

  function center(faces, face) {
    return faces[face][4];
  }

  function edgeIdx() {
    return { U: 1, R: 5, D: 7, L: 3 };
  }

  /** Side faces in clockwise order around U. */
  const RING = ["F", "R", "B", "L"];

  function isSolved(faces) {
    return FACE_NAMES.every((face) => faces[face].every((c) => c === faces[face][0]));
  }

  /** White cross on U with adjacent side colors matching centers. */
  function hasWhiteCross(faces) {
    if (center(faces, "U") !== "U") return false;
    const edges = [1, 3, 5, 7];
    if (!edges.every((i) => faces.U[i] === "U")) return false;
    // Side top-center stickers align with their face centers.
    return (
      faces.F[1] === center(faces, "F") &&
      faces.R[1] === center(faces, "R") &&
      faces.B[1] === center(faces, "B") &&
      faces.L[1] === center(faces, "L")
    );
  }

  /** Full white face on U + first-layer side stickers correct (white layer done). */
  function hasWhiteLayer(faces) {
    if (!hasWhiteCross(faces)) return false;
    if (!faces.U.every((c) => c === "U")) return false;
    // Bottom row of each side (indices 0,1,2 are top row of F when U is up —
    // for F, top row is 0,1,2; corners of white layer sit on side top-corners.
    // With white on U, first-layer side stickers are the top row of F/R/B/L.
    return RING.every((face) => {
      const row = faces[face];
      return row[0] === center(faces, face) && row[1] === center(faces, face) && row[2] === center(faces, face);
    });
  }

  /** Second layer edges placed (middle-layer edges on F/R/B/L). */
  function hasSecondLayer(faces) {
    if (!hasWhiteLayer(faces)) return false;
    return RING.every((face) => {
      const c = center(faces, face);
      // Middle row left/right edges: indices 3 and 5.
      return faces[face][3] === c && faces[face][5] === c;
    });
  }

  /** Yellow cross on D (plus shape), not necessarily oriented corners. */
  function hasYellowCross(faces) {
    if (!hasSecondLayer(faces)) return false;
    // After F2L with white on U, yellow is on D.
    if (center(faces, "D") !== "D") return false;
    return [1, 3, 5, 7].every((i) => faces.D[i] === "D");
  }

  /** All yellow stickers on D (OLL complete). */
  function hasYellowFace(faces) {
    if (!hasYellowCross(faces)) return false;
    return faces.D.every((c) => c === "D");
  }

  /** Yellow corners permuted (side colors of D-layer corners match adjacent centers). */
  function hasYellowCornersPermuted(faces) {
    if (!hasYellowFace(faces)) return false;
    // Bottom-row corners of each side face should match that face's center.
    return RING.every((face) => {
      const c = center(faces, face);
      return faces[face][6] === c && faces[face][8] === c;
    });
  }

  function hasFullSolved(faces) {
    return isSolved(faces);
  }

  /**
   * Map curriculum stage id → predicate.
   * Stages that are conceptual (basics/notation) always return true when asked
   * for "goal met" only after explicit academy flags — those are handled in UI.
   */
  const STAGE_CHECKS = {
    "white-cross": hasWhiteCross,
    "white-corners": hasWhiteLayer,
    "second-layer": hasSecondLayer,
    "yellow-cross": hasYellowCross,
    "yellow-orient": hasYellowFace,
    "permute-corners": hasYellowCornersPermuted,
    "permute-edges": hasFullSolved,
  };

  function checkStage(stageId, faces) {
    const fn = STAGE_CHECKS[stageId];
    if (!fn) return { applicable: false, complete: false };
    return { applicable: true, complete: Boolean(fn(faces)) };
  }

  /** Highlight mask: list of {face, index} sticker slots to emphasize. */
  function highlightForStage(stageId) {
    if (stageId === "white-cross") {
      return [
        { face: "U", index: 1 },
        { face: "U", index: 3 },
        { face: "U", index: 5 },
        { face: "U", index: 7 },
        { face: "F", index: 1 },
        { face: "R", index: 1 },
        { face: "B", index: 1 },
        { face: "L", index: 1 },
      ];
    }
    if (stageId === "white-corners") {
      return [0, 2, 6, 8].map((index) => ({ face: "U", index }));
    }
    if (stageId === "second-layer") {
      return RING.flatMap((face) => [
        { face, index: 3 },
        { face, index: 5 },
      ]);
    }
    if (stageId === "yellow-cross" || stageId === "yellow-orient") {
      return [0, 1, 2, 3, 4, 5, 6, 7, 8].map((index) => ({ face: "D", index }));
    }
    if (stageId === "permute-corners" || stageId === "permute-edges") {
      return RING.flatMap((face) =>
        [6, 7, 8].map((index) => ({ face, index })),
      );
    }
    return [];
  }

  root.CubePatterns = {
    isSolved,
    hasWhiteCross,
    hasWhiteLayer,
    hasSecondLayer,
    hasYellowCross,
    hasYellowFace,
    hasYellowCornersPermuted,
    hasFullSolved,
    checkStage,
    highlightForStage,
    STAGE_CHECKS,
    RING,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);

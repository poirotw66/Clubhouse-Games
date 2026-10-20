/**
 * Random practice case bank for beginner stages (white-on-U).
 * Setups keep earlier stages complete and leave the target stage incomplete.
 */
(function (root) {
  "use strict";

  /** @typedef {{ id: string, stageId: string, label: string, setup: string }} PracticeCase */

  /**
   * Curated setups (white on U). Each preserves the previous LBL stage.
   * Last-layer cases use D-face variants so F2L stays intact.
   * @type {Record<string, PracticeCase[]>}
   */
  const BANK = {
    "white-cross": [
      { id: "wc-01", stageId: "white-cross", label: "半圈打亂", setup: "R2" },
      { id: "wc-02", stageId: "white-cross", label: "雙半圈", setup: "R2 L2" },
      { id: "wc-03", stageId: "white-cross", label: "短打亂 A", setup: "R U F'" },
      { id: "wc-04", stageId: "white-cross", label: "短打亂 B", setup: "F R U'" },
      { id: "wc-05", stageId: "white-cross", label: "短打亂 C", setup: "L' U B" },
      { id: "wc-06", stageId: "white-cross", label: "短打亂 D", setup: "B' R' U2" },
      { id: "wc-07", stageId: "white-cross", label: "課程同款", setup: "R U R' F R F' U F R' F' R" },
      { id: "wc-08", stageId: "white-cross", label: "混合打亂", setup: "R2 U F' L D B'" },
    ],
    "white-corners": [
      { id: "wco-01", stageId: "white-corners", label: "底層 Sexy", setup: "R D R' D'" },
      { id: "wco-02", stageId: "white-corners", label: "底層 Sexy×2", setup: "R D R' D' R D R' D'" },
      { id: "wco-03", stageId: "white-corners", label: "底層 Sexy×3", setup: "R D R' D' R D R' D' R D R' D'" },
      { id: "wco-04", stageId: "white-corners", label: "半圈換角 A", setup: "R2 F2 R2 F2" },
      { id: "wco-05", stageId: "white-corners", label: "半圈換角 B", setup: "L2 B2 L2 B2" },
      { id: "wco-06", stageId: "white-corners", label: "共軛 Sexy", setup: "R U R' D R U' R' D'" },
      { id: "wco-07", stageId: "white-corners", label: "共軛變體", setup: "F R F' D F R' F' D'" },
      { id: "wco-08", stageId: "white-corners", label: "左 Sexy", setup: "L' D' L D L' D' L D" },
    ],
    "second-layer": [
      { id: "f2l-01", stageId: "second-layer", label: "中層缺口 A", setup: "R2 D U' B2 U" },
      { id: "f2l-02", stageId: "second-layer", label: "中層缺口 B", setup: "R2 D' U F2 U'" },
      { id: "f2l-03", stageId: "second-layer", label: "中層缺口 C", setup: "R2 D2 R2 D2 R2" },
      { id: "f2l-04", stageId: "second-layer", label: "中層缺口 D", setup: "R2 U2 L2 U2 R2" },
      { id: "f2l-05", stageId: "second-layer", label: "中層缺口 E", setup: "L2 D U' F2 U" },
      { id: "f2l-06", stageId: "second-layer", label: "中層缺口 F", setup: "L2 D' U B2 U'" },
      { id: "f2l-07", stageId: "second-layer", label: "中層缺口 G", setup: "R2 U D' F2 U'" },
      { id: "f2l-08", stageId: "second-layer", label: "中層缺口 H", setup: "R2 U2 D2 L2 U2" },
    ],
    "yellow-cross": [
      { id: "yc-01", stageId: "yellow-cross", label: "黃邊翻轉 A", setup: "F' R' D' R D F" },
      { id: "yc-02", stageId: "yellow-cross", label: "黃邊翻轉 B", setup: "F' D' R' D R F" },
      { id: "yc-03", stageId: "yellow-cross", label: "黃邊翻轉 C", setup: "F' R' D' R D F D" },
      { id: "yc-04", stageId: "yellow-cross", label: "黃邊翻轉 D", setup: "F' R' D' R D F D'" },
      { id: "yc-05", stageId: "yellow-cross", label: "黃邊翻轉 E", setup: "F' R' D' R D F D2" },
      { id: "yc-06", stageId: "yellow-cross", label: "鏡像翻轉", setup: "F' D' R' D R F D" },
      { id: "yc-07", stageId: "yellow-cross", label: "鏡像＋AUF", setup: "F' D' R' D R F D'" },
      { id: "yc-08", stageId: "yellow-cross", label: "鏡像＋D2", setup: "F' D' R' D R F D2" },
    ],
    "yellow-orient": [
      { id: "oll-01", stageId: "yellow-orient", label: "D-Sune 魚", setup: "R D R' D R D2 R'" },
      { id: "oll-02", stageId: "yellow-orient", label: "反 D-Sune", setup: "R D2 R' D' R D' R'" },
      { id: "oll-03", stageId: "yellow-orient", label: "D-Sune＋AUF", setup: "R D R' D R D2 R' D" },
      { id: "oll-04", stageId: "yellow-orient", label: "反魚＋AUF", setup: "R D2 R' D' R D' R' D'" },
      { id: "oll-05", stageId: "yellow-orient", label: "F-Sune", setup: "F D F' D F D2 F'" },
      { id: "oll-06", stageId: "yellow-orient", label: "B-Sune", setup: "B D B' D B D2 B'" },
      { id: "oll-07", stageId: "yellow-orient", label: "Niklas（D）", setup: "R D' L' D R' D' L" },
      { id: "oll-08", stageId: "yellow-orient", label: "雙魚", setup: "R D R' D R D2 R' R D R' D R D2 R'" },
    ],
    "permute-corners": [
      { id: "plc-01", stageId: "permute-corners", label: "D 轉一格", setup: "D" },
      { id: "plc-02", stageId: "permute-corners", label: "D' 轉一格", setup: "D'" },
      { id: "plc-03", stageId: "permute-corners", label: "D2 半圈", setup: "D2" },
      { id: "plc-04", stageId: "permute-corners", label: "共軛 D", setup: "U D U'" },
      { id: "plc-05", stageId: "permute-corners", label: "共軛 D'", setup: "U D' U'" },
      { id: "plc-06", stageId: "permute-corners", label: "共軛 D2", setup: "U2 D U2" },
      { id: "plc-07", stageId: "permute-corners", label: "雙層共軛", setup: "U D U' D" },
      { id: "plc-08", stageId: "permute-corners", label: "共軛 D2", setup: "U' D2 U" },
    ],
    "permute-edges": [
      { id: "ple-01", stageId: "permute-edges", label: "Ua（R）", setup: "R2 D R D R' D' R' D' R' D R'" },
      { id: "ple-02", stageId: "permute-edges", label: "Ub（R）", setup: "R D' R D R D R D' R' D' R2" },
      { id: "ple-03", stageId: "permute-edges", label: "Ua（F）", setup: "F2 D F D F' D' F' D' F' D F'" },
      { id: "ple-04", stageId: "permute-edges", label: "Ub（F）", setup: "F D' F D F D F D' F' D' F2" },
      { id: "ple-05", stageId: "permute-edges", label: "Ua（B）", setup: "B2 D B D B' D' B' D' B' D B'" },
      { id: "ple-06", stageId: "permute-edges", label: "Ub（B）", setup: "B D' B D B D B D' B' D' B2" },
      { id: "ple-07", stageId: "permute-edges", label: "Ua（L）", setup: "L2 D L D L' D' L' D' L' D L'" },
      { id: "ple-08", stageId: "permute-edges", label: "Ub（L）", setup: "L D' L D L D L D' L' D' L2" },
    ],
  };

  const STAGE_ORDER = [
    "white-cross",
    "white-corners",
    "second-layer",
    "yellow-cross",
    "yellow-orient",
    "permute-corners",
    "permute-edges",
  ];

  const STAGE_LABELS = {
    "white-cross": "白色十字",
    "white-corners": "白色四角",
    "second-layer": "第二層（F2L）",
    "yellow-cross": "黃色十字",
    "yellow-orient": "黃面朝向（OLL）",
    "permute-corners": "排列黃角",
    "permute-edges": "排列黃邊（PLL）",
  };

  const STAGE_HINTS = {
    "white-cross": "先把四顆白邊對準白心成十字，再轉 U 對齊側色。",
    "white-corners": "用 R U R' U'（或鏡像／底層 Sexy）把白角鉤上第一層。",
    "second-layer": "對準上層邊緣後，右插 U R U' R' U' F' U F 或左插。",
    "yellow-cross": "依點／拐杖／橫線調整朝向，執行 F R U R' U' F'（本站黃在 D，可對照公式表）。",
    "yellow-orient": "對準魚形後執行 Sune：R U R' U R U2 R'（黃在 D 時改用 D 版練習）。",
    "permute-corners": "先對好一組角，再用排角公式循環其餘三角。",
    "permute-edges": "角已對好後，用 Ua／Ub 等公式排黃邊；還原才算完成。",
  };

  const AUF_D = ["", "D", "D'", "D2"];

  function stageIds() {
    return [...STAGE_ORDER];
  }

  function casesFor(stageId) {
    return BANK[stageId] ? [...BANK[stageId]] : [];
  }

  function defaultRng() {
    if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
      const buf = new Uint32Array(1);
      globalThis.crypto.getRandomValues(buf);
      return buf[0] / 4294967296;
    }
    return Math.random();
  }

  /**
   * Pick a random practice case. Yellow-cross / OLL may get an extra D AUF
   * for recognition variety; invalid results fall back to the bare bank case.
   */
  function pickCase(stageId, rng) {
    const pool = BANK[stageId];
    if (!pool || !pool.length) {
      throw new Error(`Unknown practice stage: ${stageId}`);
    }
    const roll = typeof rng === "function" ? rng : defaultRng;
    const base = pool[Math.floor(roll() * pool.length) % pool.length];
    // Extra D AUF is safe mainly for yellow-cross / OLL.
    // Corner-perm bank already varies AUF; appending D can cancel to solved.
    // Edge PLL must never get a trailing D (breaks corner alignment).
    const allowAuf = stageId === "yellow-cross" || stageId === "yellow-orient";

    let setup = base.setup;
    let auf = "";
    const endsWithD = /(?:^|\s)D(?:2|')?$/.test(base.setup);
    if (allowAuf && !endsWithD && roll() > 0.45) {
      const candidate = AUF_D[Math.floor(roll() * AUF_D.length) % AUF_D.length];
      if (candidate) {
        const trial = {
          id: `${base.id}-${candidate}`,
          stageId: base.stageId,
          label: `${base.label}＋${candidate}`,
          setup: `${base.setup} ${candidate}`,
        };
        const ok = validateCase(trial);
        if (ok.ok) {
          auf = candidate;
          setup = trial.setup;
        }
      }
    }

    return {
      id: `${base.id}${auf ? `-${auf}` : ""}`,
      stageId: base.stageId,
      label: auf ? `${base.label}＋${auf}` : base.label,
      setup,
      auf,
      bankId: base.id,
      hint: STAGE_HINTS[stageId] || "",
    };
  }

  function applySetup(engine, practiceCase, parseAlgorithm) {
    const parse = parseAlgorithm || root.RubiksCube?.parseAlgorithm;
    if (!parse) throw new Error("parseAlgorithm unavailable");
    engine.initializeSolved();
    const tokens = parse(practiceCase.setup);
    for (const move of tokens) engine.applyPermutation(move);
    engine.history = [];
    const label = `練習·${STAGE_LABELS[practiceCase.stageId] || practiceCase.stageId}·${practiceCase.label}`;
    engine.scramble = `${label}｜${practiceCase.setup}`;
    return engine.scramble;
  }

  /**
   * Validate: target incomplete; previous stage complete when applicable; not fully solved.
   */
  function validateCase(practiceCase, engineFactory, patterns) {
    const RC = root.RubiksCube;
    const p = patterns || root.CubePatterns;
    const engine = engineFactory ? engineFactory() : new RC.CubeEngine(3);
    applySetup(engine, practiceCase, RC.parseAlgorithm);
    const faces = engine.getFaces();
    if (p.isSolved(faces)) {
      return { ok: false, reason: "cube is solved" };
    }
    const target = p.checkStage(practiceCase.stageId, faces);
    if (!target.applicable) {
      return { ok: false, reason: "stage not applicable" };
    }
    if (target.complete) {
      return { ok: false, reason: "target already complete" };
    }
    const idx = STAGE_ORDER.indexOf(practiceCase.stageId);
    if (idx > 0) {
      const prevId = STAGE_ORDER[idx - 1];
      const prev = p.checkStage(prevId, faces);
      if (!prev.complete) {
        return { ok: false, reason: `prerequisite ${prevId} incomplete` };
      }
    }
    return { ok: true, faces };
  }

  /** WCA-style face-turn scramble (delegates to cube-core createScramble). */
  function generateScramble(length, createScrambleFn) {
    const create = createScrambleFn || root.RubiksCube?.createScramble;
    if (!create) throw new Error("createScramble unavailable");
    const count = length === undefined ? 20 : length;
    const seq = create(count);
    return Array.isArray(seq) ? seq.join(" ") : String(seq);
  }

  root.CubePracticeBank = {
    BANK,
    STAGE_ORDER,
    STAGE_LABELS,
    STAGE_HINTS,
    AUF_D,
    stageIds,
    casesFor,
    pickCase,
    applySetup,
    validateCase,
    generateScramble,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);

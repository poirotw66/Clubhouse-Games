"use strict";

/* ==================== CONFIG ==================== */
const CONFIG = Object.freeze({
  cubePixels: 240,
  animationMs: 230,
  maxAlgorithmMoves: 1000,
  maxAlgorithmCharacters: 4000,
  maxLogEntries: 50
});

const FACE_NAMES = ["U", "D", "L", "R", "F", "B"];
const AVAILABLE_MOVES = FACE_NAMES.flatMap(face => [face, face + "'", face + "2"]);
const MOVE_PATTERN = /^[UDLRFB](2|')?$/;

const FACE_INFO = {
  U: { normal: [0, 1, 0], color: "#f1f3f6", name: "White",  css: "rotateX(90deg)" },
  D: { normal: [0,-1, 0], color: "#f3d23e", name: "Yellow", css: "rotateX(-90deg)" },
  L: { normal: [-1,0, 0], color: "#f08a32", name: "Orange", css: "rotateY(-90deg)" },
  R: { normal: [1, 0, 0], color: "#e9495e", name: "Red",    css: "rotateY(90deg)" },
  F: { normal: [0, 0, 1], color: "#35b97c", name: "Green",  css: "rotateY(0deg)" },
  B: { normal: [0, 0,-1], color: "#467deb", name: "Blue",   css: "rotateY(180deg)" }
};

const MOVE_INFO = {
  U: { axis: 1, side:  1, direction: -1 },
  D: { axis: 1, side: -1, direction:  1 },
  L: { axis: 0, side: -1, direction:  1 },
  R: { axis: 0, side:  1, direction: -1 },
  F: { axis: 2, side:  1, direction: -1 },
  B: { axis: 2, side: -1, direction:  1 }
};

/* ==================== UTILITIES ==================== */
const $ = id => document.getElementById(id);

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function validateSize(size) {
  requireCondition(Number.isInteger(size) && (size === 2 || size === 3),
    "size must be the integer 2 or 3.");
  return size;
}

function validateMove(move) {
  requireCondition(typeof move === "string" && MOVE_PATTERN.test(move),
    "Invalid move. Use U, D, L, R, F, B with an optional ' or 2 modifier.");
  return move;
}

function parseAlgorithm(algorithm) {
  requireCondition(typeof algorithm === "string", "algorithm must be a string.");
  requireCondition(algorithm.length <= CONFIG.maxAlgorithmCharacters,
    `Algorithm exceeds ${CONFIG.maxAlgorithmCharacters} characters.`);
  const trimmed = algorithm.trim();
  requireCondition(trimmed.length > 0, "Enter at least one move.");
  const tokens = trimmed.split(/\s+/);
  requireCondition(tokens.length <= CONFIG.maxAlgorithmMoves,
    `Use at most ${CONFIG.maxAlgorithmMoves} moves.`);
  for (let index = 0; index < tokens.length; index++) {
    requireCondition(MOVE_PATTERN.test(tokens[index]),
      `Invalid token ${index + 1}: "${tokens[index]}". Allowed format: U, U', U2 (also D, L, R, F, B). Nothing was executed.`);
  }
  return tokens;
}

function inverseMove(move) {
  validateMove(move);
  return move.endsWith("2") ? move : move.endsWith("'") ? move[0] : move + "'";
}

/* Coordinates are mathematical: +X right, +Y up, +Z front. */
function rotateVector(vector, axis, direction) {
  const [x, y, z] = vector;
  if (axis === 0) return direction === 1 ? [x, -z, y] : [x, z, -y];
  if (axis === 1) return direction === 1 ? [z, y, -x] : [-z, y, x];
  return direction === 1 ? [-y, x, z] : [y, -x, z];
}

function sameVector(a, b) {
  return a.every((value, index) => value === b[index]);
}

function randomInt(max) {
  if (globalThis.crypto && typeof globalThis.crypto.getRandomValues === "function") {
    const buffer = new Uint32Array(1);
    const limit = Math.floor(4294967296 / max) * max;
    do { globalThis.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
    return buffer[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function createScramble(length) {
  const sequence = [];
  let previousFace = "";
  for (let i = 0; i < length; i++) {
    const options = FACE_NAMES.filter(face => face !== previousFace);
    const face = options[randomInt(options.length)];
    sequence.push(face + ["", "'", "2"][randomInt(3)]);
    previousFace = face;
  }
  return sequence;
}

function textElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

let toastTimer;
function showToast(message) {
  const el = $("toast");
  if (!el) return;
  el.textContent = message;
  el.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("visible"), 3600);
}

/** Row-major face index for a sticker position (same convention as getFaces). */
function faceStickerIndex(face, position, size) {
  const [x, y, z] = position;
  let row;
  let col;
  switch (face) {
    case "U": row = z; col = x; break;
    case "D": row = -z; col = x; break;
    case "L": row = -y; col = z; break;
    case "R": row = -y; col = -z; break;
    case "F": row = -y; col = x; break;
    case "B": row = -y; col = -x; break;
    default: return -1;
  }
  const limit = size - 1;
  const coords = Array.from({ length: size }, (_, i) => -limit + i * 2);
  const ri = coords.indexOf(row);
  const ci = coords.indexOf(col);
  if (ri < 0 || ci < 0) return -1;
  return ri * size + ci;
}

/* ==================== CUBE ENGINE ==================== */
/*
 * The engine owns all application state and contains no DOM code.
 * Stickers carry an integer cubie position, outward normal, and fixed color.
 * A legal turn rotates every sticker in the selected cubie layer.
 */
class CubeEngine {
  constructor(size = 3) {
    this.listeners = new Set();
    this.size = validateSize(size);
    this.initializeSolved();
  }

  initializeSolved() {
    const limit = this.size - 1;
    const coordinates = Array.from({ length: this.size }, (_, i) => -limit + i * 2);
    this.stickers = [];

    for (const face of FACE_NAMES) {
      const normal = FACE_INFO[face].normal;
      const fixedAxis = normal.findIndex(value => value !== 0);
      const otherAxes = [0, 1, 2].filter(axis => axis !== fixedAxis);

      for (const a of coordinates) {
        for (const b of coordinates) {
          const position = [0, 0, 0];
          position[fixedAxis] = normal[fixedAxis] * limit;
          position[otherAxes[0]] = a;
          position[otherAxes[1]] = b;
          this.stickers.push({
            position,
            normal: [...normal],
            color: face
          });
        }
      }
    }

    this.history = [];
    this.scramble = "";
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async publish(event) {
    const snapshot = this.getState();
    await Promise.all(Array.from(this.listeners, listener => listener(snapshot, event)));
    return snapshot;
  }

  getFaces() {
    const faces = {};

    for (const face of FACE_NAMES) {
      const normal = FACE_INFO[face].normal;
      const matching = this.stickers.filter(sticker => sameVector(sticker.normal, normal));

      const rowColumn = position => {
        const [x, y, z] = position;
        switch (face) {
          case "U": return [ z,  x];
          case "D": return [-z,  x];
          case "L": return [-y,  z];
          case "R": return [-y, -z];
          case "F": return [-y,  x];
          case "B": return [-y, -x];
        }
      };

      matching.sort((a, b) => {
        const [ar, ac] = rowColumn(a.position);
        const [br, bc] = rowColumn(b.position);
        return ar - br || ac - bc;
      });
      faces[face] = matching.map(sticker => sticker.color);
    }

    return faces;
  }

  isSolved() {
    return Object.values(this.getFaces()).every(face =>
      face.length === this.size * this.size &&
      face.every(color => color === face[0])
    );
  }

  getState() {
    const faces = this.getFaces();
    return {
      size: this.size,
      solved: Object.values(faces).every(face => face.every(color => color === face[0])),
      moveCount: this.history.length,
      history: [...this.history],
      scramble: this.scramble,
      faces
    };
  }

  getStickers() {
    return this.stickers.map(sticker => ({
      position: [...sticker.position],
      normal: [...sticker.normal],
      color: sticker.color
    }));
  }

  /* Synchronous permutation primitive, also used by independent self-tests. */
  applyPermutation(move) {
    validateMove(move);
    const info = MOVE_INFO[move[0]];
    const layer = info.side * (this.size - 1);
    const quarterTurns = move.endsWith("2") ? 2 : 1;
    const direction = info.direction * (move.endsWith("'") ? -1 : 1);

    for (const sticker of this.stickers) {
      if (sticker.position[info.axis] !== layer) continue;

      for (let i = 0; i < quarterTurns; i++) {
        sticker.position = rotateVector(sticker.position, info.axis, direction);
        sticker.normal = rotateVector(sticker.normal, info.axis, direction);
      }
    }

    return {
      axis: info.axis,
      layer,
      angle: direction * 90 * quarterTurns,
      move
    };
  }

  async move(move) {
    validateMove(move);
    const rotation = this.applyPermutation(move);
    this.history.push(move);
    return this.publish({ type: "move", rotation });
  }

  async executeAlgorithm(tokens) {
    requireCondition(Array.isArray(tokens) && tokens.length > 0,
      "An algorithm must contain moves.");
    requireCondition(tokens.length <= CONFIG.maxAlgorithmMoves, "Too many moves.");
    tokens.forEach(validateMove);

    for (const move of tokens) await this.move(move);
    return this.getState();
  }

  async reset() {
    this.initializeSolved();
    return this.publish({ type: "reset" });
  }

  async setSize(size) {
    this.size = validateSize(size);
    this.initializeSolved();
    return this.publish({ type: "size" });
  }

  async scrambleCube(length) {
    const count = length === undefined ? (this.size === 2 ? 11 : 20) : length;
    requireCondition(Number.isInteger(count) && count >= 1 && count <= 100,
      "moves must be an integer between 1 and 100.");

    this.initializeSolved();
    const sequence = createScramble(count);
    sequence.forEach(move => this.applyPermutation(move));

    /*
     * Even an unlikely identity scramble must not leave the cube solved.
     * Changing only the final turn's power preserves length and face spacing.
     */
    if (this.isSolved()) {
      const last = sequence[sequence.length - 1];
      this.applyPermutation(inverseMove(last));
      sequence[sequence.length - 1] = last.endsWith("2") ? last[0] : last[0] + "2";
      this.applyPermutation(sequence[sequence.length - 1]);
    }

    this.scramble = sequence.join(" ");
    this.history = [];
    return this.publish({ type: "scramble" });
  }

  async undo() {
    requireCondition(this.history.length > 0,
      "Nothing to undo. Scramble moves are separate from solving history.");
    const undone = this.history[this.history.length - 1];
    const inverse = inverseMove(undone);
    const rotation = this.applyPermutation(inverse);
    this.history.pop();
    const state = await this.publish({ type: "undo", rotation });
    return { ...state, undone, inverse };
  }
}

/* ==================== CUBE RENDERER ==================== */
class CubeRenderer {
  constructor(engine) {
    this.engine = engine;
    this.container = $("pieces");
    this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    this.viewX = -25;
    this.viewY = 35;
    this.render(engine.getState());
    this.bindOrbit();
    engine.subscribe((state, event) => this.onChange(state, event));
  }

  updateMetadata(state) {
    const setText = (id, value) => { const el = $(id); if (el) el.textContent = value; };
    setText("size-tag", `${state.size} × ${state.size}`);
    setText("move-count", state.moveCount);
    const solved = $("solved-status");
    if (solved) {
      solved.textContent = state.solved ? "已還原" : "未還原";
      solved.className = state.solved ? "solved" : "scrambled";
    }
    setText("scramble-text", state.scramble || "尚未產生打亂。");
    setText("history-count", state.history.length ? `(${state.history.length})` : "");

    document.querySelectorAll(".size-button").forEach(button => {
      button.setAttribute("aria-pressed", String(Number(button.dataset.size) === state.size));
    });

    const history = $("history");
    if (!history) return;
    history.replaceChildren();
    if (!state.history.length) {
      history.append(textElement("span", "尚無解法步數。", "muted"));
    } else {
      if (state.history.length > 100) {
        history.append(textElement("span", "… 最近 100 步", "muted"));
      }
      for (const move of state.history.slice(-100)) {
        history.append(textElement("code", move));
      }
    }
    history.scrollTop = history.scrollHeight;
  }

  render(state) {
    this.updateMetadata(state);
    this.renderGeometry(state.size);
  }

  renderGeometry(size) {
    const unit = CONFIG.cubePixels / size;
    const side = unit - 2;
    const half = side / 2;
    const groups = new Map();

    for (const sticker of this.engine.getStickers()) {
      const key = sticker.position.join(",");
      if (!groups.has(key)) groups.set(key, { position: sticker.position, stickers: [] });
      groups.get(key).stickers.push(sticker);
    }

    const fragment = document.createDocumentFragment();

    for (const group of groups.values()) {
      const cubie = document.createElement("div");
      cubie.className = "cubie";
      cubie.dataset.position = group.position.join(",");
      const [x, y, z] = group.position.map(value => value * unit / 2);
      cubie.style.transform = `translate3d(${x}px, ${-y}px, ${z}px)`;

      /* Six black faces make each cubie solid, including exposed turn interiors. */
      for (const face of FACE_NAMES) {
        const info = FACE_INFO[face];
        const surface = document.createElement("div");
        surface.className = "cube-face";
        surface.style.width = `${side}px`;
        surface.style.height = `${side}px`;
        surface.style.left = `${-half}px`;
        surface.style.top = `${-half}px`;
        surface.style.transform = `${info.css} translateZ(${half}px)`;

        const sticker = group.stickers.find(item => sameVector(item.normal, info.normal));
        if (sticker) {
          const tile = document.createElement("div");
          tile.className = "sticker";
          tile.style.background = FACE_INFO[sticker.color].color;
          tile.dataset.face = face;
          tile.dataset.color = sticker.color;
          tile.dataset.index = String(faceStickerIndex(face, sticker.position, size));
          tile.title = `${face} face · ${FACE_INFO[sticker.color].name} (${sticker.color}) sticker`;
          tile.append(textElement("span", sticker.color));
          surface.append(tile);
        }

        cubie.append(surface);
      }
      fragment.append(cubie);
    }

    this.container.replaceChildren(fragment);
  }

  async onChange(state, event) {
    this.updateMetadata(state);

    if (!event.rotation || this.reducedMotion.matches ||
        typeof Element.prototype.animate !== "function") {
      this.renderGeometry(state.size);
      return;
    }

    const { axis, layer, angle } = event.rotation;
    const layerElement = document.createElement("div");
    layerElement.className = "turn-layer";

    for (const cubie of Array.from(this.container.children)) {
      const position = cubie.dataset.position.split(",").map(Number);
      if (position[axis] === layer) layerElement.append(cubie);
    }
    this.container.append(layerElement);

    /*
     * CSS has downward +Y, unlike engine coordinates.
     * Reflection negates X/Z rotation angles but preserves Y rotation angles.
     */
    const cssAngle = axis === 1 ? angle : -angle;
    const transform = `rotate${["X", "Y", "Z"][axis]}(${cssAngle}deg)`;

    try {
      const animation = layerElement.animate(
        [{ transform: "rotateX(0deg)" }, { transform }],
        {
          duration: (typeof CONFIG.animationMs === "number" ? CONFIG.animationMs : 230),
          easing: "cubic-bezier(.25,.7,.25,1)",
          fill: "forwards"
        }
      );
      await animation.finished;
      animation.cancel();
    } catch (error) {
      console.warn("[CubeRenderer] Animation interrupted; restoring canonical state.", error);
    } finally {
      this.renderGeometry(state.size);
    }
  }

  updateView() {
    $("view").style.transform = `rotateX(${this.viewX}deg) rotateY(${this.viewY}deg)`;
  }

  resetView() {
    this.viewX = -25;
    this.viewY = 35;
    this.updateView();
  }

  bindOrbit() {
    const scene = $("scene");
    let drag = null;

    scene.addEventListener("pointerdown", event => {
      if (event.button !== 0 || drag) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      scene.setPointerCapture(event.pointerId);
      scene.classList.add("dragging");
      scene.focus({ preventScroll: true });
    });

    scene.addEventListener("pointermove", event => {
      if (!drag || drag.id !== event.pointerId) return;
      this.viewY += (event.clientX - drag.x) * .45;
      this.viewX = Math.max(-85, Math.min(85,
        this.viewX - (event.clientY - drag.y) * .45));
      drag.x = event.clientX;
      drag.y = event.clientY;
      this.updateView();
    });

    const stop = event => {
      if (drag && drag.id === event.pointerId) {
        drag = null;
        scene.classList.remove("dragging");
      }
    };
    scene.addEventListener("pointerup", stop);
    scene.addEventListener("pointercancel", stop);
    scene.addEventListener("lostpointercapture", stop);

    scene.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "ArrowLeft") this.viewY -= 10;
      if (event.key === "ArrowRight") this.viewY += 10;
      if (event.key === "ArrowUp") this.viewX = Math.max(-85, this.viewX - 10);
      if (event.key === "ArrowDown") this.viewX = Math.min(85, this.viewX + 10);
      this.updateView();
    });

    const viewReset = $("view-reset");
    if (viewReset) viewReset.addEventListener("click", () => this.resetView());
  }
}

/* ==================== MOVE QUEUE ==================== */
/*
 * Complete write operations are queued as transactions.
 * An algorithm cannot be interleaved with another algorithm, reset, or size change.
 * Read-only tools return the most recently committed state without waiting.
 */
class MoveQueue {
  constructor(onChange) {
    this.tail = Promise.resolve();
    this.pending = 0;
    this.onChange = onChange;
  }

  enqueue(task) {
    this.pending++;
    this.onChange(this.pending);

    const run = this.tail.then(task);
    const completed = run.finally(() => {
      this.pending--;
      this.onChange(this.pending);
    });

    /* A rejected operation never poisons later queued operations. */
    this.tail = completed.catch(() => {});
    return completed;
  }
}

/* ==================== TOOL DEFINITIONS ==================== */
function objectSchema(properties = {}, required = []) {
  return { type: "object", properties, required, additionalProperties: false };
}

const TOOL_DEFINITIONS = [
  {
    name: "cube_get_state",
    readOnly: true,
    summary: "Read size, faces, solved status, moves, history, and scramble.",
    description: "Get the current Rubik's Cube state, cube size, solved status, move count, move history, and current scramble. Does not change the cube. Faces are row-major arrays viewed from outside, with U/D/L/R/F/B representing original sticker colors. Returns the latest committed state even while a turn is animating. Use before planning an algorithm and after cube_execute_algorithm completes.",
    inputSchema: objectSchema()
  },
  {
    name: "cube_set_size",
    readOnly: false,
    summary: "Create a solved 2×2 or 3×3 cube and clear history.",
    description: "Switch to a 2×2 or 3×3 Rubik's Cube using integer size 2 or 3. This writes application state and always resets to solved, clearing solving history and the current scramble, even if the size is unchanged. Waits for earlier queued operations. Use cube_scramble afterward to start a puzzle.",
    inputSchema: objectSchema({
      size: { type: "integer", enum: [2, 3], description: "Cube edge length: 2 or 3." }
    }, ["size"])
  },
  {
    name: "cube_move",
    readOnly: false,
    summary: "Animate one legal face turn and record a solving move.",
    description: "Execute one standard face move on the currently selected cube. move is exactly U, D, L, R, F, or B, optionally followed by prime (') or 2. Clockwise is viewed directly from outside the named face. Mutates the shared cube and solving history and waits for animation completion. Use cube_execute_algorithm for multiple moves, cube_undo to reverse the last solving move, or cube_get_state to inspect the result.",
    inputSchema: objectSchema({
      move: { type: "string", enum: AVAILABLE_MOVES, description: "One legal face turn, such as R, R', or R2." }
    }, ["move"])
  },
  {
    name: "cube_execute_algorithm",
    readOnly: false,
    summary: "Validate an entire algorithm, then animate each move in order.",
    description: "Execute a sequence of standard Rubik's Cube moves on the currently selected cube. Use this when multiple moves are required. Supports U, D, L, R, F, B with optional prime (') or 2 modifiers. The sequence is validated completely before execution. Separate tokens with whitespace; parentheses, repetition syntax, wide moves, and cube rotations are not supported. Mutates the shared cube and records solving moves. The sequence is queued atomically and this tool resolves only after all animations finish. At most 1000 moves and 4000 characters. To apply the sexy move six times, expand R U R' U' six times into one sequence; from solved it returns to solved. Pair with cube_get_state or cube_check_solved.",
    inputSchema: objectSchema({
      algorithm: {
        type: "string",
        minLength: 1,
        maxLength: CONFIG.maxAlgorithmCharacters,
        description: "Whitespace-separated legal moves, for example R U R' U'."
      }
    }, ["algorithm"])
  },
  {
    name: "cube_scramble",
    readOnly: false,
    summary: "Generate a non-solved scramble; reset solving moves to zero.",
    description: "Start from a solved cube of the current size and apply a random legal scramble without consecutive turns of the same face. Mutates the cube immediately when its queued turn arrives; scramble playback is not animated. Optional integer moves is 1 through 100; defaults to 11 for 2×2 or 20 for 3×3. Clears solving history and sets move count to zero, storing the scramble separately. The final cube is guaranteed not solved. Use cube_set_size first when a specific size is needed and cube_get_state afterward.",
    inputSchema: objectSchema({
      moves: { type: "integer", minimum: 1, maximum: 100, description: "Optional scramble length." }
    })
  },
  {
    name: "cube_reset",
    readOnly: false,
    summary: "Restore solved state and clear scramble and history.",
    description: "Reset the currently selected cube to its original solved colors without changing cube size or viewing angle. Mutates the shared cube, sets move count to zero, and clears both solving history and scramble. Waits for earlier queued writes. Use before demonstrating algorithms that should return to solved.",
    inputSchema: objectSchema()
  },
  {
    name: "cube_undo",
    readOnly: false,
    summary: "Animate the inverse of the last solving move.",
    description: "Undo the most recent user or agent solving move by applying its inverse and removing it from history. R becomes R', R' becomes R, and R2 is its own inverse. Mutates the cube and decreases move count by one; the inverse is not added to history. Does not undo scramble moves. Returns a clear error if solving history is empty. Waits for inverse animation completion.",
    inputSchema: objectSchema()
  },
  {
    name: "cube_check_solved",
    readOnly: true,
    summary: "Check actual sticker uniformity on all six faces.",
    description: "Check whether every face has a uniform sticker color on the currently selected cube. Does not mutate state and does not infer solved status from move count. Returns solved, size, and moveCount from the latest committed state. Use after awaiting cube_execute_algorithm to verify its result.",
    inputSchema: objectSchema()
  },
  {
    name: "cube_get_available_moves",
    readOnly: true,
    summary: "List all 18 supported standard move tokens.",
    description: "Return the complete array of legal move tokens for both cube sizes: U, D, L, R, F, B, each with optional prime (') or 2. Read-only. Use this to discover notation before calling cube_move or composing a whitespace-separated cube_execute_algorithm.",
    inputSchema: objectSchema()
  }
];

const TOOL_MAP = new Map(TOOL_DEFINITIONS.map(tool => [tool.name, tool]));

/* ==================== UI CONTROLLER / DOMAIN DISPATCH ==================== */
/*
 * Both interfaces enter invoke(). Tools never click buttons or touch cube DOM.
 * Validation occurs before queueing; all actual state mutations occur in CubeEngine.
 */
class CubeController {
  constructor(engine, queue, logger) {
    this.engine = engine;
    this.queue = queue;
    this.logger = logger;
  }

  validate(name, input) {
    const definition = TOOL_MAP.get(name);
    requireCondition(Boolean(definition), `Unknown tool: ${name}`);
    const args = input === undefined ? {} : input;

    requireCondition(args !== null && typeof args === "object" && !Array.isArray(args),
      "Tool arguments must be a JSON object.");

    const allowed = Object.keys(definition.inputSchema.properties);
    for (const key of Object.keys(args)) {
      requireCondition(allowed.includes(key), `Unexpected argument: ${key}`);
    }
    for (const key of definition.inputSchema.required) {
      requireCondition(Object.prototype.hasOwnProperty.call(args, key),
        `Missing required argument: ${key}`);
    }

    const validated = { ...args };
    if (name === "cube_set_size") validateSize(validated.size);
    if (name === "cube_move") validateMove(validated.move);
    if (name === "cube_execute_algorithm") {
      validated.tokens = parseAlgorithm(validated.algorithm);
    }
    if (name === "cube_scramble" &&
        Object.prototype.hasOwnProperty.call(validated, "moves")) {
      requireCondition(Number.isInteger(validated.moves) &&
        validated.moves >= 1 && validated.moves <= 100,
        "moves must be an integer between 1 and 100.");
    }

    return { definition, args: validated };
  }

  async invoke(name, input = {}, source = "UI") {
    let detail;
    try { detail = JSON.stringify(input); } catch { detail = "[invalid arguments]"; }
    this.logger.add(source, `${name}${detail === "{}" ? "" : " " + detail}`);

    try {
      const { definition, args } = this.validate(name, input);

      if (definition.readOnly) {
        return this.read(name);
      }

      return await this.queue.enqueue(async () => {
        if (source === "WebMCP") {
          let message = `AI Agent → ${name}`;
          if (name === "cube_move") message = `AI Agent → ${args.move}`;
          if (name === "cube_execute_algorithm") {
            const notation = args.tokens.join(" ");
            message = `AI Agent → ${notation.length > 150 ? notation.slice(0, 150) + "…" : notation}`;
          }
          if (name === "cube_scramble") message = "AI Agent scrambled the cube.";
          if (name === "cube_reset") message = "AI Agent reset the cube.";
          if (name === "cube_set_size") message = `AI Agent → ${args.size}×${args.size} cube`;
          if (name === "cube_undo") message = "AI Agent → Undo";
          showToast(message);
        }

        return this.write(name, args);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.add(source, `ERROR ${name}: ${message}`);
      if (source === "WebMCP") showToast(`AI Agent error → ${message}`);
      throw new Error(message);
    }
  }

  read(name) {
    if (name === "cube_get_available_moves") return [...AVAILABLE_MOVES];
    const state = this.engine.getState();
    if (name === "cube_get_state") return state;
    if (name === "cube_check_solved") {
      return { solved: state.solved, size: state.size, moveCount: state.moveCount };
    }
    throw new Error(`Unknown read operation: ${name}`);
  }

  async write(name, args) {
    let state;
    switch (name) {
      case "cube_set_size":
        state = await this.engine.setSize(args.size);
        return { success: true, ...state };

      case "cube_move":
        state = await this.engine.move(args.move);
        return {
          success: true,
          move: args.move,
          moveCount: state.moveCount,
          solved: state.solved
        };

      case "cube_execute_algorithm":
        state = await this.engine.executeAlgorithm(args.tokens);
        return {
          success: true,
          executed: [...args.tokens],
          moveCount: state.moveCount,
          solved: state.solved
        };

      case "cube_scramble":
        state = await this.engine.scrambleCube(args.moves);
        return {
          success: true,
          size: state.size,
          scramble: state.scramble,
          moveCount: state.moveCount,
          solved: state.solved
        };

      case "cube_reset":
        state = await this.engine.reset();
        return { success: true, ...state };

      case "cube_undo":
        state = await this.engine.undo();
        return {
          success: true,
          undone: state.undone,
          inverse: state.inverse,
          moveCount: state.moveCount,
          solved: state.solved
        };

      default:
        throw new Error(`Unknown write operation: ${name}`);
    }
  }

  bindUI() {
    const run = async (name, args = {}) => {
      $("error").textContent = "";
      try {
        await this.invoke(name, args, "UI");
      } catch (error) {
        $("error").textContent = error.message;
      }
    };

    for (const move of AVAILABLE_MOVES) {
      const button = textElement("button", move);
      button.type = "button";
      button.setAttribute("aria-label", `Apply move ${move}`);
      button.addEventListener("click", () => run("cube_move", { move }));
      $("move-grid").append(button);
    }

    document.querySelectorAll(".size-button").forEach(button => {
      button.addEventListener("click", () =>
        run("cube_set_size", { size: Number(button.dataset.size) }));
    });

    $("scramble").addEventListener("click", () => run("cube_scramble"));
    $("reset").addEventListener("click", () => run("cube_reset"));
    $("undo").addEventListener("click", () => run("cube_undo"));
    $("algorithm-form").addEventListener("submit", event => {
      event.preventDefault();
      run("cube_execute_algorithm", { algorithm: $("algorithm").value });
    });

    $("copy-scramble").addEventListener("click", async () => {
      const text = this.engine.getState().scramble;
      if (!text) {
        showToast("Generate a scramble first.");
        return;
      }

      try {
        requireCondition(Boolean(navigator.clipboard &&
          typeof navigator.clipboard.writeText === "function"),
          "Clipboard API is unavailable.");
        await navigator.clipboard.writeText(text);
        this.logger.add("UI", "Copied scramble");
        showToast("Scramble copied.");
      } catch {
        /* Manual copy remains available on restricted file origins. */
        const selection = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents($("scramble-text"));
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
        showToast("Clipboard unavailable. Scramble selected; use Copy or Ctrl/Cmd+C.");
      }
    });
  }
}

/* ==================== WEBMCP ADAPTER ==================== */
class WebMCPAdapter {
  constructor(controller, logger) {
    this.controller = controller;
    this.logger = logger;
    this.registeredNames = new Set();
    this.registrationPromise = null;
    this.context = null;
    this.connected = false;
    const refreshBtn = $("refresh-tools");
    if (refreshBtn) refreshBtn.addEventListener("click", () => this.refreshTools());
  }

  setStatus(text, connected) {
    this.connected = connected;
    $("connection-text").textContent = text;
    $("connection").classList.toggle("connected", connected);
    $("connection").setAttribute("aria-label", `WebMCP ${text}`);
    $("connection").title = `WebMCP ${text}`;
  }

  register() {
    /* A single promise prevents duplicate and concurrent registration. */
    if (!this.registrationPromise) {
      this.registrationPromise = this.registerOnce();
    }
    return this.registrationPromise;
  }

  async registerOnce() {
    if (!("modelContext" in document)) {
      this.setStatus("Unsupported", false);
      console.info(
        "[WebMCP] WebMCP Unsupported: document.modelContext is not available. " +
        "The cube remains fully playable. Use a browser and page origin with " +
        "the document.modelContext imperative API enabled for agent tools."
      );
      this.logger.add("System", "WebMCP Unsupported — human controls remain available.");
      await this.refreshTools();
      return;
    }

    try {
      this.context = document.modelContext;
      requireCondition(this.context &&
        typeof this.context.registerTool === "function",
        "document.modelContext.registerTool is unavailable.");

      for (const definition of TOOL_DEFINITIONS) {
        if (this.registeredNames.has(definition.name)) continue;

        await document.modelContext.registerTool({
          name: definition.name,
          description: definition.description,
          inputSchema: definition.inputSchema,
          annotations: {
            readOnlyHint: definition.readOnly,
            consequentialHint: false,
            untrustedContentHint: false
          },
          execute: async args => {
            try {
              const result = await this.controller.invoke(definition.name, args, "WebMCP");
              return {
                content: [{ type: "text", text: JSON.stringify(result) }]
              };
            } catch (error) {
              return {
                isError: true,
                content: [{
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    tool: definition.name,
                    error: error instanceof Error ? error.message : String(error)
                  })
                }]
              };
            }
          }
        });

        this.registeredNames.add(definition.name);
      }

      this.setStatus("Connected", true);
      console.info("[WebMCP] WebMCP Connected. Registered tools:", [...this.registeredNames]);
      this.logger.add("System", `WebMCP Connected — ${this.registeredNames.size} tools registered.`);
    } catch (error) {
      this.setStatus("Registration failed", false);
      console.warn("[WebMCP] Registration failed; UI remains available.", error);
      this.logger.add("System", `WebMCP registration failed: ${error.message}`);
    }

    await this.refreshTools();
  }

  async refreshTools() {
    let discoveredNames = null;
    let note;

    if (this.context && typeof this.context.getTools === "function") {
      try {
        const result = await this.context.getTools();
        const tools = Array.isArray(result) ? result : result && result.tools;
        requireCondition(Array.isArray(tools), "Unrecognized getTools() response.");

        discoveredNames = new Set(tools.map(tool =>
          typeof tool === "string" ? tool : tool && tool.name
        ));
        note = `Browser discovery: ${TOOL_DEFINITIONS.filter(tool =>
          discoveredNames.has(tool.name)).length}/9 cube tools visible via getTools().`;
      } catch (error) {
        note = `getTools() could not be read. Showing local registration records. ${error.message}`;
        console.warn("[WebMCP] Tool inspection fallback:", error);
      }
    } else {
      note = this.connected
        ? "getTools() is not exposed by this browser. Showing successfully registered page tools."
        : "Showing page tool definitions. Agent access requires document.modelContext support and successful registration.";
    }

    const list = $("tool-list");
    if (!list) return;
    list.replaceChildren();

    for (const definition of TOOL_DEFINITIONS) {
      const card = document.createElement("div");
      card.className = "tool";
      const top = document.createElement("div");
      top.className = "tool-top";

      top.append(
        textElement("span", definition.name, "tool-name"),
        textElement("span", definition.readOnly ? "READ" : "WRITE",
          definition.readOnly ? "badge read" : "badge")
      );

      let state = this.registeredNames.has(definition.name) ? "Registered" : "Local definition";
      if (discoveredNames) {
        state = discoveredNames.has(definition.name) ? "Discovered" : "Not listed";
      }
      top.append(textElement("span", state, "registered"));
      card.append(top, textElement("p", definition.summary));
      card.title = definition.description;
      list.append(card);
    }

    const noteEl = $("inspector-note");
    if (noteEl) noteEl.textContent = note;
  }
}

/* ==================== ACTIVITY LOGGER ==================== */
class ActivityLogger {
  constructor(container) {
    this.container = container;
    this.entries = [];
  }

  add(source, message) {
    this.entries.push({
      time: new Date().toLocaleTimeString("en-GB", { hour12: false }),
      source,
      message
    });
    this.entries = this.entries.slice(-CONFIG.maxLogEntries);

    const fragment = document.createDocumentFragment();
    for (const entry of this.entries) {
      const row = document.createElement("div");
      row.className = "log-entry";
      row.append(
        textElement("time", entry.time),
        textElement("span", entry.source,
          entry.source === "WebMCP" ? "log-source agent" : "log-source"),
        textElement("span", entry.message, "log-message")
      );
      fragment.append(row);
    }

    if (!this.container) return;
    this.container.replaceChildren(fragment);
    this.container.scrollTop = this.container.scrollHeight;
  }
}

/* ==================== SELF TEST ==================== */
function runSelfTests() {
  let passed = 0;
  let failed = 0;

  const test = (name, callback) => {
    try {
      callback();
      passed++;
      console.info(`[Cube self-test] PASS ${name}`);
    } catch (error) {
      failed++;
      console.error(`[Cube self-test] FAIL ${name}`, error);
    }
  };

  const sameState = (a, b) => JSON.stringify(a.getFaces()) === JSON.stringify(b.getFaces());

  for (const size of [2, 3]) {
    const cases = [
      ["R + R' → solved", "R R'"],
      ["U2 + U2 → solved", "U2 U2"],
      ["R four times → solved", "R R R R"],
      ["Sexy move six times → solved", Array(6).fill("R U R' U'").join(" ")]
    ];

    for (const [name, algorithm] of cases) {
      test(`${size}×${size}: ${name}`, () => {
        const engine = new CubeEngine(size);
        parseAlgorithm(algorithm).forEach(move => engine.applyPermutation(move));
        requireCondition(engine.isSolved(), "Cube did not return to solved.");
        requireCondition(sameState(engine, new CubeEngine(size)), "Original face colors were not restored.");
      });
    }

    test(`${size}×${size}: all 18 moves, inverses, and color conservation`, () => {
      for (const move of AVAILABLE_MOVES) {
        const engine = new CubeEngine(size);
        engine.applyPermutation(move);
        requireCondition(!engine.isSolved(), `${move} did not change the solved state.`);
        const stickers = engine.getStickers();

        for (const face of FACE_NAMES) {
          requireCondition(stickers.filter(sticker => sticker.color === face).length === size * size,
            `Sticker color count changed for ${face}.`);
        }

        const occupied = new Set(stickers.map(sticker =>
          sticker.position.join(",") + "/" + sticker.normal.join(",")));
        requireCondition(occupied.size === 6 * size * size, "Duplicate sticker coordinates.");

        engine.applyPermutation(inverseMove(move));
        requireCondition(sameState(engine, new CubeEngine(size)), `${move} inverse failed.`);
      }
    });

    test(`${size}×${size}: R direction and row-major face mapping`, () => {
      const engine = new CubeEngine(size);
      engine.applyPermutation("R");
      const faces = engine.getFaces();
      for (let row = 0; row < size; row++) {
        requireCondition(faces.U[row * size + size - 1] === "F", "R must send F right column to U.");
        requireCondition(faces.F[row * size + size - 1] === "D", "R must send D right column to F.");
        requireCondition(faces.B[row * size] === "U", "R must send U right column to B left column.");
      }
    });

    test(`${size}×${size}: long sequence plus inverse`, () => {
      const engine = new CubeEngine(size);
      const sequence = parseAlgorithm("R U2 F' L D2 B R2 U' L2 F D B2 R' U");
      sequence.forEach(move => engine.applyPermutation(move));
      [...sequence].reverse().map(inverseMove).forEach(move => engine.applyPermutation(move));
      requireCondition(sameState(engine, new CubeEngine(size)), "Sequence inverse failed.");
    });
  }

  test("Parser trims and accepts multiline whitespace", () => {
    const tokens = parseAlgorithm("  R \n U\tR'   U'  ");
    requireCondition(tokens.join(" ") === "R U R' U'", "Whitespace parsing failed.");
  });

  test("Parser rejects entire invalid algorithm without executing", () => {
    const engine = new CubeEngine(3);
    let rejected = false;
    try {
      const tokens = parseAlgorithm("R U INVALID F");
      tokens.forEach(move => engine.applyPermutation(move));
    } catch {
      rejected = true;
    }
    requireCondition(rejected && engine.isSolved(), "Invalid input was not rejected atomically.");
  });

  console.info(`[Cube self-test] Complete: ${passed} passed, ${failed} failed. Live state was not used.`);
}

/* ==================== INITIALIZATION ==================== */
let initialized = false;

async function initialize() {
  if (initialized) return;
  initialized = true;

  runSelfTests();

  const logger = new ActivityLogger($("activity-log"));
  const engine = new CubeEngine(3);
  const renderer = new CubeRenderer(engine);
  const queue = new MoveQueue(pending => {
    $("queue-status").textContent = pending
      ? `${pending} queued operation${pending === 1 ? "" : "s"}`
      : "Queue idle";
  });
  const controller = new CubeController(engine, queue, logger);

  let previouslySolved = true;
  engine.subscribe((state, event) => {
    if (state.solved && (!previouslySolved || event.type === "reset" || event.type === "size")) {
      logger.add("System", `Cube solved · ${state.size}×${state.size} · ${state.moveCount} solving moves`);
    }
    previouslySolved = state.solved;
  });

  controller.bindUI();
  logger.add("System", "Initialized solved 3×3 cube. Human and agent share CubeEngine and one queue.");

  const adapter = new WebMCPAdapter(controller, logger);
  await adapter.register();

  /*
   * Keep application instances private. Agent operations are exposed only through
   * registered capabilities, not an alternate mutable global state.
   */
  void renderer;
}


/* Hosts call RubiksCube.initialize() (freeplay) or academy-app boot. */

globalThis.RubiksCube = {
  CONFIG,
  FACE_NAMES,
  AVAILABLE_MOVES,
  FACE_INFO,
  MOVE_INFO,
  CubeEngine,
  CubeRenderer,
  MoveQueue,
  CubeController,
  WebMCPAdapter,
  ActivityLogger,
  TOOL_DEFINITIONS,
  TOOL_MAP,
  parseAlgorithm,
  inverseMove,
  createScramble,
  validateMove,
  validateSize,
  objectSchema,
  showToast,
  textElement,
  runSelfTests,
  initialize,
  $,
  setAnimationMs(ms) {
    Object.assign(CONFIG, { animationMs: Math.max(40, Math.min(1200, Number(ms) || 230)) });
  }
};

/**
 * Pure puzzle logic for WebMCP Escape Room (depth-4 multi-room).
 * Headless-safe: no DOM. Imported by index.html and check-escape-room.mjs.
 */

export const FIXED_SEED = "agent-demo";
export const STORAGE_KEY = "webmcp-escape-room.v2";
export const META_KEY = "webmcp-escape-room.meta.v2";
export const STATE_VERSION = 2;

export const ROOM_ORDER = ["study", "archive", "vault"];

export const ROOM_META = {
  study: {
    id: "study",
    name: "The Quiet Study",
    eyebrow: "Room 01 / The quiet study",
    headline: "A matter of time.",
    blurb: "Inspect the room. Follow the clues. Reach the hallway.",
  },
  archive: {
    id: "archive",
    name: "The Server Archive",
    eyebrow: "Room 02 / The server archive",
    headline: "Power and order.",
    blurb: "Two paths, either order. Carry what you brought from the study.",
  },
  vault: {
    id: "vault",
    name: "The Vault Antechamber",
    eyebrow: "Room 03 / The vault antechamber",
    headline: "Choose your exit.",
    blurb: "Standard escape, service hatch, or a ghost run.",
  },
};

export const ENDINGS = {
  standard: {
    id: "standard",
    title: "Clean exit",
    badge: "Standard ending",
    subtitle: "You unlocked the vault door and walked out.",
  },
  service: {
    id: "service",
    title: "Service hatch",
    badge: "Alternate ending",
    subtitle: "You slipped out through maintenance — noisier, but free.",
  },
  ghost: {
    id: "ghost",
    title: "Ghost protocol",
    badge: "Hidden ending",
    subtitle: "Zero hints, brass master path, vault exit. The cameras never saw you.",
  },
};

const SYMBOLS = ["triangle", "circle", "square", "diamond"];

/** Mulberry32 PRNG from a string seed. */
export function seedFromString(str) {
  let h = 2166136261 >>> 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) || 1;
}

export function createRng(seed) {
  let t = seedFromString(seed) >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function pickUniqueDigits(rng, count) {
  const pool = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const out = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function shuffle(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fourDigit(digits) {
  return digits.map((d) => String(d)).join("").padStart(4, "0");
}

/**
 * Deterministic puzzle parameters for a run.
 * Fixed seed preserves the classic study codes (0317 / 8426).
 */
export function createPuzzle(seed = FIXED_SEED) {
  const normalized = String(seed || FIXED_SEED).trim() || FIXED_SEED;
  if (normalized === FIXED_SEED) {
    return {
      seed: FIXED_SEED,
      clockDisplay: "03:17",
      safeCode: "0317",
      studyExitCode: "8426",
      symbolOrder: ["triangle", "circle", "square", "diamond"],
      symbolValues: { triangle: 8, circle: 4, square: 2, diamond: 6 },
      filingCode: "1957",
      vaultCode: "7391",
      vaultHalfA: "73",
      vaultHalfB: "91",
    };
  }

  const rng = createRng(normalized);
  const hour = 1 + Math.floor(rng() * 11);
  const minute = Math.floor(rng() * 60);
  const clockDisplay = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const safeCode = `${String(hour).padStart(2, "0")}${String(minute).padStart(2, "0")}`;

  const values = pickUniqueDigits(rng, 4).map((d) => (d === 0 ? 1 + Math.floor(rng() * 9) : d));
  // Ensure four distinct non-zero digits for legend
  const uniq = [...new Set(values)];
  while (uniq.length < 4) {
    const n = 1 + Math.floor(rng() * 9);
    if (!uniq.includes(n)) uniq.push(n);
  }
  const symbolOrder = shuffle(rng, SYMBOLS);
  const symbolValues = {
    triangle: uniq[0],
    circle: uniq[1],
    square: uniq[2],
    diamond: uniq[3],
  };
  const studyExitCode = symbolOrder.map((sym) => String(symbolValues[sym])).join("");

  const filingDigits = pickUniqueDigits(rng, 4);
  const filingCode = fourDigit(filingDigits);
  const vaultDigits = pickUniqueDigits(rng, 4);
  const vaultCode = fourDigit(vaultDigits);
  const vaultHalfA = vaultCode.slice(0, 2);
  const vaultHalfB = vaultCode.slice(2, 4);

  return {
    seed: normalized,
    clockDisplay,
    safeCode,
    studyExitCode,
    symbolOrder,
    symbolValues,
    filingCode,
    vaultCode,
    vaultHalfA,
    vaultHalfB,
  };
}

export function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function emptyMeta() {
  return {
    version: STATE_VERSION,
    bestMs: null,
    bestEnding: null,
    bestRating: null,
    clears: 0,
    endingsSeen: [],
  };
}

export function migrateMeta(raw) {
  const base = emptyMeta();
  if (!raw || typeof raw !== "object") return base;
  return {
    version: STATE_VERSION,
    bestMs: typeof raw.bestMs === "number" && raw.bestMs >= 0 ? raw.bestMs : null,
    bestEnding: typeof raw.bestEnding === "string" ? raw.bestEnding : null,
    bestRating: typeof raw.bestRating === "string" ? raw.bestRating : null,
    clears: Number.isFinite(raw.clears) && raw.clears >= 0 ? Math.floor(raw.clears) : 0,
    endingsSeen: Array.isArray(raw.endingsSeen)
      ? [...new Set(raw.endingsSeen.filter((id) => Object.hasOwn(ENDINGS, id)))]
      : [],
  };
}

/**
 * Rating: hints hurt, ghost ending boosts, slow runs drop a letter.
 */
export function rateRun({ elapsedMs, hintsUsed, endingId }) {
  let score = 100;
  score -= Math.min(60, (hintsUsed || 0) * 18);
  if (elapsedMs > 600_000) score -= 25;
  else if (elapsedMs > 360_000) score -= 15;
  else if (elapsedMs > 180_000) score -= 5;
  if (endingId === "ghost") score += 15;
  else if (endingId === "service") score += 5;
  if (score >= 90) return "S";
  if (score >= 75) return "A";
  if (score >= 55) return "B";
  return "C";
}

export function recordClear(meta, run) {
  const next = migrateMeta(meta);
  next.clears += 1;
  if (run.endingId && !next.endingsSeen.includes(run.endingId)) {
    next.endingsSeen.push(run.endingId);
  }
  const betterTime =
    next.bestMs === null || (typeof run.elapsedMs === "number" && run.elapsedMs < next.bestMs);
  if (betterTime) {
    next.bestMs = run.elapsedMs;
    next.bestEnding = run.endingId;
    next.bestRating = run.rating;
  } else if (!next.bestRating && run.rating) {
    next.bestRating = run.rating;
  }
  return next;
}

export function canCombine(itemA, itemB) {
  const pair = new Set([itemA, itemB]);
  if (pair.has("copper_wire") && pair.has("fuse")) {
    return { product: "patch_cable", consumes: ["copper_wire", "fuse"] };
  }
  // Keep override_token so the service-hatch alternate ending stays available.
  if (pair.has("cipher_card") && pair.has("override_token")) {
    return { product: "vault_slip", consumes: ["cipher_card"] };
  }
  return null;
}

export function progressSteps(state) {
  const o = state.objects;
  return [
    { id: "observe", label: "Discover the stopped time", done: state.cluesDiscovered.includes("stopped_time") },
    { id: "safe", label: "Unlock the digital safe", done: !o.safe.locked },
    { id: "drawer", label: "Unlock the desk drawer", done: !o.desk_drawer.locked },
    { id: "power", label: "Power the study decoder", done: !!o.keypad_box?.state?.powered },
    { id: "hallway", label: "Open the study hallway", done: !o.exit_door.locked },
    { id: "archive", label: "Enter the server archive", done: state.roomsVisited.includes("archive") },
    { id: "fuse_or_file", label: "Complete one archive path", done: !!o.fuse_panel?.state?.powered || !o.filing_cabinet.locked },
    { id: "both_paths", label: "Finish both archive paths", done: !!o.fuse_panel?.state?.powered && !o.filing_cabinet.locked },
    { id: "vault_gate", label: "Unlock the vault gate", done: !o.archive_gate.locked },
    { id: "vault_room", label: "Enter the vault antechamber", done: state.roomsVisited.includes("vault") },
    { id: "escape", label: "Escape (any ending)", done: state.escaped },
  ];
}

export function hintCatalog(puzzle) {
  return [
    {
      id: "h1",
      room: "study",
      text: `The wall clock is frozen at ${puzzle.clockDisplay}. Write it as four digits with no colon.`,
    },
    {
      id: "h2",
      room: "study",
      text: "Safe opens to a brass key. Use the key on the desk drawer, then power the keypad box.",
    },
    {
      id: "h3",
      room: "study",
      text: `Exit sequence follows the folded note's symbol order, translated by the powered decoder → ${puzzle.studyExitCode}.`,
    },
    {
      id: "h4",
      room: "archive",
      text: "Combine copper wire (from the study) with a fuse from the spare bin, then install the patch cable on the fuse panel.",
    },
    {
      id: "h5",
      room: "archive",
      text: `The chalkboard cipher unlocks the filing cabinet with code ${puzzle.filingCode}. Do both archive paths in either order.`,
    },
    {
      id: "h6",
      room: "archive",
      text: "Combine the cipher card and override token into a vault slip, then enter that code on the archive gate.",
    },
    {
      id: "h7",
      room: "vault",
      text: "Standard: unlock and open vault_exit. Alternate: use override path on the service hatch. Hidden: zero hints + brass key on evidence locker before escaping the vault door.",
    },
  ];
}

export function nextHint(state, puzzle) {
  const catalog = hintCatalog(puzzle);
  const used = state.hintsUsedIds || [];
  for (const hint of catalog) {
    if (used.includes(hint.id)) continue;
    // Prefer hints for current room / incomplete steps
    if (hint.room === state.currentRoom || used.length >= 3) {
      return hint;
    }
  }
  return catalog.find((h) => !used.includes(h.id)) || null;
}

export function makeObject(id, name, type, description, extras = {}) {
  return {
    id,
    name,
    type,
    visible: true,
    inspectable: true,
    interactable: true,
    locked: false,
    open: false,
    openable: false,
    room: "study",
    description,
    state: {},
    contains: [],
    clues: [],
    ...extras,
  };
}

export function buildItems(puzzle) {
  const orderText = puzzle.symbolOrder.join(" → ");
  const legendParts = Object.entries(puzzle.symbolValues)
    .map(([k, v]) => `${k} = ${v}`)
    .join("; ");
  return {
    brass_key: {
      id: "brass_key",
      name: "Brass Key",
      description: "A small brass key. Fits the desk drawer — and later, a vault evidence locker.",
      usableOn: ["desk_drawer", "evidence_locker"],
      discovered: false,
      source: "safe",
      icon: "⚿",
    },
    safe_note: {
      id: "safe_note",
      name: "Small Note",
      description: "“The key opens the drawer. Inside: power, wire, and the order in which to read it.”",
      usableOn: [],
      discovered: false,
      source: "safe",
      icon: "▤",
    },
    battery: {
      id: "battery",
      name: "Battery",
      description: "A fresh battery. Its contacts match the slot in the keypad box.",
      usableOn: ["keypad_box"],
      discovered: false,
      source: "desk_drawer",
      icon: "▣",
    },
    folded_note: {
      id: "folded_note",
      name: "Folded Note",
      description: `“EXIT SEQUENCE: ${orderText}. Translate each symbol using the powered box. Enter the four digits at the hallway door.”`,
      usableOn: [],
      discovered: false,
      source: "desk_drawer",
      icon: "▱",
    },
    copper_wire: {
      id: "copper_wire",
      name: "Copper Wire",
      description: "A short length of copper wire. Combine with a fuse to jury-rig power in the archive.",
      usableOn: [],
      discovered: false,
      source: "desk_drawer",
      icon: "⌇",
    },
    fuse: {
      id: "fuse",
      name: "Spare Fuse",
      description: "A ceramic fuse from the spare bin. Combine with copper wire.",
      usableOn: [],
      discovered: false,
      source: "spare_bin",
      icon: "⌁",
    },
    patch_cable: {
      id: "patch_cable",
      name: "Patch Cable",
      description: "A jury-rigged cable. Install it on the fuse panel to restore console power.",
      usableOn: ["fuse_panel"],
      discovered: false,
      source: null,
      icon: "☍",
      crafted: true,
    },
    cipher_card: {
      id: "cipher_card",
      name: "Cipher Card",
      description: `A punched card from the filing cabinet. Half the vault digits: ${puzzle.vaultHalfA}··`,
      usableOn: [],
      discovered: false,
      source: "filing_cabinet",
      icon: "▦",
    },
    override_token: {
      id: "override_token",
      name: "Override Token",
      description: `A glowing token from the powered console. Half the vault digits: ··${puzzle.vaultHalfB}. Also opens the service hatch.`,
      usableOn: ["service_hatch"],
      discovered: false,
      source: "server_console",
      icon: "◈",
    },
    vault_slip: {
      id: "vault_slip",
      name: "Vault Slip",
      description: `Combined vault code: ${puzzle.vaultCode}. Enter it on the archive gate.`,
      usableOn: [],
      discovered: false,
      source: null,
      icon: "▣",
      crafted: true,
    },
    master_tag: {
      id: "master_tag",
      name: "Master Tag",
      description: "Evidence tag marked GHOST. Holding this while escaping the vault door with zero hints triggers the hidden ending.",
      usableOn: [],
      discovered: false,
      source: "evidence_locker",
      icon: "★",
    },
    _legend: legendParts,
  };
}

export function buildClues(puzzle) {
  const orderText = puzzle.symbolOrder.join(" → ");
  const legend = Object.entries(puzzle.symbolValues)
    .map(([k, v]) => `${k} = ${v}`)
    .join("; ");
  return {
    stopped_time: {
      id: "stopped_time",
      source: "clock",
      text: `The clock is stopped at ${puzzle.clockDisplay}.`,
    },
    painting_hint: {
      id: "painting_hint",
      source: "painting",
      text: "The safe's secret is the stopped time, written as four digits without punctuation.",
    },
    safe_engraving: {
      id: "safe_engraving",
      source: "safe",
      text: "The safe is engraved: TIME KEEPS THE SECRET.",
    },
    order_hint: {
      id: "order_hint",
      source: "bookshelf",
      text: "A legend gives values; a note gives sequence. Carry tools forward — later rooms need what you find here.",
    },
    safe_note: {
      id: "safe_note",
      source: "safe_note",
      text: "The key opens the drawer, which contains power, wire, and a sequence.",
    },
    symbol_order: {
      id: "symbol_order",
      source: "folded_note",
      text: `Exit sequence: ${orderText}.`,
    },
    symbol_values: {
      id: "symbol_values",
      source: "keypad_box",
      text: `Decoder legend: ${legend}. Use the note's order.`,
    },
    chalk_cipher: {
      id: "chalk_cipher",
      source: "chalkboard",
      text: `Chalk reads: FILE=${puzzle.filingCode}. Order does not matter — finish power and filing both.`,
    },
    console_half: {
      id: "console_half",
      source: "server_console",
      text: `Console footer: vault digits ··${puzzle.vaultHalfB}. Combine with the cipher card.`,
    },
    vault_combined: {
      id: "vault_combined",
      source: "vault_slip",
      text: `Vault code ${puzzle.vaultCode} unlocks the archive gate.`,
    },
  };
}

export function buildObjects(puzzle) {
  return {
    exit_door: makeObject(
      "exit_door",
      "Hallway Door",
      "exit",
      "A solid door with a four-digit keypad leading to the server archive. Linked to the desk keypad box.",
      { locked: true, openable: true, room: "study" },
    ),
    safe: makeObject(
      "safe",
      "Digital Safe",
      "safe",
      "A compact steel safe. Its display asks for four digits. A tiny engraving reads: TIME KEEPS THE SECRET.",
      {
        locked: true,
        openable: true,
        contains: ["brass_key", "safe_note"],
        clues: ["safe_engraving"],
        room: "study",
      },
    ),
    desk: makeObject(
      "desk",
      "Desk",
      "furniture",
      "A walnut desk holds a monitor, lamp, and unpowered keypad box. A brass keyhole is set into its right-hand drawer.",
      { room: "study" },
    ),
    desk_drawer: makeObject(
      "desk_drawer",
      "Desk Drawer",
      "container",
      "A shallow drawer with a brass keyhole. Something small shifts inside when you pull it.",
      {
        locked: true,
        openable: true,
        contains: ["battery", "folded_note", "copper_wire"],
        room: "study",
      },
    ),
    clock: makeObject(
      "clock",
      "Wall Clock",
      "clue",
      `The clock is silent. Its hands are stopped at ${puzzle.clockDisplay}. A small label confirms: ${puzzle.clockDisplay} — the moment everything paused.`,
      { clues: ["stopped_time"], room: "study" },
    ),
    painting: makeObject(
      "painting",
      "Framed Picture",
      "clue",
      "An abstract landscape in a brass frame. The plaque reads: “The time has stopped, but the secret hasn't. Four digits, no punctuation.”",
      { clues: ["painting_hint"], room: "study" },
    ),
    bookshelf: makeObject(
      "bookshelf",
      "Bookshelf",
      "furniture",
      "Books on architecture and ciphers. One spine reads: “Order matters. Carry wire forward.”",
      { clues: ["order_hint"], room: "study" },
    ),
    plant: makeObject(
      "plant",
      "Potted Plant",
      "decoration",
      "A healthy rubber plant. No key beneath it — some things are just plants.",
      { room: "study" },
    ),
    lamp: makeObject(
      "lamp",
      "Table Lamp",
      "decoration",
      "A warm pool of light falls across the desk. The lamp cannot be removed.",
      { room: "study" },
    ),
    monitor: makeObject(
      "monitor",
      "Monitor",
      "terminal",
      "Welcome: “Restore the desk box, translate the sequence, then carry what you find into the archive.”",
      { room: "study" },
    ),
    rug: makeObject(
      "rug",
      "Rug",
      "decoration",
      "A woven rug. The floor beneath is solid. No hidden panel.",
      { room: "study" },
    ),
    keypad_box: makeObject(
      "keypad_box",
      "Keypad Box",
      "device",
      "A small decoder linked to the hallway keypad. Its screen is dark. The battery slot is empty.",
      { state: { powered: false }, room: "study" },
    ),

    // Archive
    spare_bin: makeObject(
      "spare_bin",
      "Spare Bin",
      "container",
      "An unlocked bin of spare electrical parts. A fuse sits on top.",
      { openable: true, open: false, contains: ["fuse"], room: "archive" },
    ),
    fuse_panel: makeObject(
      "fuse_panel",
      "Fuse Panel",
      "device",
      "A wall fuse panel with an empty jumper bay. Needs a patch cable.",
      { state: { powered: false }, room: "archive" },
    ),
    chalkboard: makeObject(
      "chalkboard",
      "Chalkboard",
      "clue",
      `Dusty chalk marks: a filing cipher. One line is still legible: FILE=${puzzle.filingCode}.`,
      { clues: ["chalk_cipher"], room: "archive" },
    ),
    filing_cabinet: makeObject(
      "filing_cabinet",
      "Filing Cabinet",
      "safe",
      "A four-digit filing cabinet. The chalkboard holds its cipher.",
      {
        locked: true,
        openable: true,
        contains: ["cipher_card"],
        room: "archive",
      },
    ),
    server_console: makeObject(
      "server_console",
      "Server Console",
      "terminal",
      "A rack console. Dark until the fuse panel is restored.",
      {
        state: { powered: false },
        openable: true,
        open: false,
        contains: ["override_token"],
        clues: ["console_half"],
        room: "archive",
      },
    ),
    archive_gate: makeObject(
      "archive_gate",
      "Vault Gate",
      "exit",
      "A reinforced gate to the vault antechamber. Needs the combined vault code.",
      { locked: true, openable: true, room: "archive" },
    ),
    cable_tray: makeObject(
      "cable_tray",
      "Cable Tray",
      "decoration",
      "Labeled trays: POWER PATH · FILING PATH — either order works.",
      { room: "archive" },
    ),
    archive_plant: makeObject(
      "archive_plant",
      "Dusty Fern",
      "decoration",
      "Even server rooms keep a plant. Still just a plant.",
      { room: "archive" },
    ),

    // Vault
    vault_exit: makeObject(
      "vault_exit",
      "Vault Exit",
      "exit",
      "The main vault exit. Enter the vault code, open the door, then escape.",
      { locked: true, openable: true, room: "vault" },
    ),
    service_hatch: makeObject(
      "service_hatch",
      "Service Hatch",
      "exit",
      "A maintenance hatch. An override token can unlock it for an alternate escape.",
      { locked: true, openable: true, room: "vault" },
    ),
    evidence_locker: makeObject(
      "evidence_locker",
      "Evidence Locker",
      "container",
      "A locker sealed with a brass keyhole — the same cut as the study drawer key.",
      {
        locked: true,
        openable: true,
        contains: ["master_tag"],
        room: "vault",
      },
    ),
    biometric_panel: makeObject(
      "biometric_panel",
      "Biometric Panel",
      "decoration",
      "Offline. A plaque: GHOST PROTOCOL — zero hints, master tag, vault exit.",
      { room: "vault" },
    ),
    vault_sign: makeObject(
      "vault_sign",
      "Wayfinding Sign",
      "decoration",
      "← Archive · Exit ahead · Hatch below",
      { room: "vault" },
    ),
  };
}

export function initialState(seed = FIXED_SEED) {
  const puzzle = createPuzzle(seed);
  const items = buildItems(puzzle);
  delete items._legend;
  return {
    version: STATE_VERSION,
    seed: puzzle.seed,
    puzzle,
    currentRoom: "study",
    roomsVisited: ["study"],
    objects: buildObjects(puzzle),
    items,
    inventory: [],
    usedItems: [],
    inspectedObjects: [],
    inspectedItems: [],
    cluesDiscovered: [],
    selectedObject: "desk",
    escaped: false,
    endingId: null,
    hintsUsedIds: [],
    startedAt: null,
    finishedAt: null,
    lastAction: null,
    activityLog: [],
  };
}

export function visibleObjects(state) {
  return Object.values(state.objects).filter(
    (o) => o.visible && o.room === state.currentRoom,
  );
}

export function computeBlockers(state) {
  const o = state.objects;
  const blockers = [];
  if (state.escaped) return blockers;
  if (state.currentRoom === "study") {
    if (o.safe.locked) blockers.push("The safe needs a four-digit code suggested by objects in the room.");
    if (o.desk_drawer.locked) blockers.push("The desk drawer needs its brass key.");
    if (!o.keypad_box.state.powered) blockers.push("The keypad box needs a battery.");
    if (o.exit_door.locked) blockers.push("The hallway door needs a powered decoder and the correct four-digit sequence.");
    else if (!o.exit_door.open) blockers.push("Open the hallway door, then enter the archive.");
    else blockers.push("Use room_enter to step into the archive.");
  } else if (state.currentRoom === "archive") {
    if (!o.fuse_panel.state.powered) blockers.push("Restore fuse power: combine copper wire + fuse, install on fuse_panel.");
    if (o.filing_cabinet.locked) blockers.push("Unlock the filing cabinet using the chalkboard cipher.");
    if (o.archive_gate.locked) blockers.push("Combine cipher card + override token, then enter the vault code on archive_gate.");
    else if (!o.archive_gate.open) blockers.push("Open the vault gate, then enter the vault.");
    else blockers.push("Use room_enter to step into the vault antechamber.");
  } else {
    if (o.vault_exit.locked && o.service_hatch.locked) {
      blockers.push("Unlock vault_exit with the vault code, or unlock service_hatch with the override token.");
    } else if (!state.escaped) {
      blockers.push("Open an unlocked exit and call exit_try_escape.");
    }
  }
  return blockers;
}

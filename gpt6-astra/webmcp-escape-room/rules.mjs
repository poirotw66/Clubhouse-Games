/**
 * Pure puzzle logic for WebMCP Escape Room (depth-4 multi-room).
 * Headless-safe: no DOM. Imported by index.html and check-escape-room.mjs.
 *
 * Packs: facility (classic linear Study→Archive→Vault) and greenhouse
 * (hub + parallel wings). Daily Taipei seeds also reshuffle placements.
 */

import {
  seedFromString,
  createRng,
  makeObject,
  shuffle,
  pickUniqueDigits,
  fourDigit,
  formatElapsed,
} from "./core.mjs";
import {
  GREENHOUSE_PACK_ID,
  GREENHOUSE_FIXED_SEED,
  GREENHOUSE_ROOM_ORDER,
  GREENHOUSE_ROOM_META,
  GREENHOUSE_ENDINGS,
  createGreenhousePuzzle,
  buildGreenhouseItems,
  buildGreenhouseClues,
  buildGreenhouseObjects,
  greenhouseCanCombine,
  greenhouseProgressSteps,
  greenhouseHintCatalog,
  greenhouseBlockers,
  greenhouseInitialExtras,
} from "./greenhouse.mjs";
import {
  taipeiDateKey,
  dailySeedFor,
  nextDailyStreak,
  formatShareText,
  previousTaipeiDateKey,
} from "./daily.mjs";

export {
  seedFromString,
  createRng,
  makeObject,
  formatElapsed,
  taipeiDateKey,
  dailySeedFor,
  nextDailyStreak,
  formatShareText,
  previousTaipeiDateKey,
  GREENHOUSE_PACK_ID,
  GREENHOUSE_FIXED_SEED,
};

export const FIXED_SEED = "agent-demo";
export const FACILITY_PACK_ID = "facility";
export const DEFAULT_PACK_ID = FACILITY_PACK_ID;
export const STORAGE_KEY = "webmcp-escape-room.v3";
export const META_KEY = "webmcp-escape-room.meta.v3";
export const STATE_VERSION = 3;

/** Both packs are open from the start (WebMCP agents must not grind to demo pack 2). */
export const PACKS = {
  facility: {
    id: FACILITY_PACK_ID,
    title: "Quiet Facility",
    blurb: "Study → Archive → Vault. Classic three-room chain with dual archive paths.",
    unlock: "open",
    roomOrder: ["study", "archive", "vault"],
    fixedSeed: FIXED_SEED,
  },
  greenhouse: {
    id: GREENHOUSE_PACK_ID,
    title: "Midnight Greenhouse",
    blurb: "Atrium hub with parallel lab & nursery wings, then rooftop. Distinct topology.",
    unlock: "open",
    roomOrder: GREENHOUSE_ROOM_ORDER,
    fixedSeed: GREENHOUSE_FIXED_SEED,
  },
};

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
  ...GREENHOUSE_ROOM_META,
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
  ...GREENHOUSE_ENDINGS,
};

const SYMBOLS = ["triangle", "circle", "square", "diamond"];

export function normalizePackId(packId) {
  const id = String(packId || DEFAULT_PACK_ID);
  return Object.hasOwn(PACKS, id) ? id : DEFAULT_PACK_ID;
}

export function endingsForPack(packId) {
  const id = normalizePackId(packId);
  if (id === GREENHOUSE_PACK_ID) return { ...GREENHOUSE_ENDINGS };
  return {
    standard: ENDINGS.standard,
    service: ENDINGS.service,
    ghost: ENDINGS.ghost,
  };
}

/**
 * Facility daily/layout variant: moves items & clue hosts, may force archive order.
 * Fixed seed keeps the classic demo placement.
 */
export function createFacilityLayout(seed) {
  const normalized = String(seed || FIXED_SEED).trim() || FIXED_SEED;
  if (normalized === FIXED_SEED) {
    return {
      seed: normalized,
      wireSource: "desk_drawer",
      fuseSource: "spare_bin",
      filingClueOn: "chalkboard",
      timeHintOn: "painting",
      batterySource: "desk_drawer",
      archiveOrder: "free",
      swapVaultHalves: false,
    };
  }
  const rng = createRng(`layout-fac-${normalized}`);
  const wireSources = ["desk_drawer", "plant"];
  const fuseSources = ["spare_bin", "cable_tray"];
  const filingHosts = ["chalkboard", "cable_tray"];
  const timeHosts = ["painting", "monitor"];
  const batterySources = ["desk_drawer", "bookshelf"];
  const orders = ["free", "fuse-first", "file-first"];
  return {
    seed: normalized,
    wireSource: wireSources[Math.floor(rng() * wireSources.length)],
    fuseSource: fuseSources[Math.floor(rng() * fuseSources.length)],
    filingClueOn: filingHosts[Math.floor(rng() * filingHosts.length)],
    timeHintOn: timeHosts[Math.floor(rng() * timeHosts.length)],
    batterySource: batterySources[Math.floor(rng() * batterySources.length)],
    archiveOrder: orders[Math.floor(rng() * orders.length)],
    swapVaultHalves: rng() > 0.45,
  };
}

/**
 * Deterministic puzzle parameters for a run.
 * Fixed seed preserves the classic study codes (0317 / 8426).
 * @param {string} seed
 * @param {string} [packId]
 */
export function createPuzzle(seed = FIXED_SEED, packId = DEFAULT_PACK_ID) {
  const pack = normalizePackId(packId);
  if (pack === GREENHOUSE_PACK_ID) {
    return createGreenhousePuzzle(seed);
  }

  const normalized = String(seed || FIXED_SEED).trim() || FIXED_SEED;
  const layout = createFacilityLayout(normalized);

  if (normalized === FIXED_SEED) {
    return {
      seed: FIXED_SEED,
      packId: FACILITY_PACK_ID,
      clockDisplay: "03:17",
      safeCode: "0317",
      studyExitCode: "8426",
      symbolOrder: ["triangle", "circle", "square", "diamond"],
      symbolValues: { triangle: 8, circle: 4, square: 2, diamond: 6 },
      filingCode: "1957",
      vaultCode: "7391",
      vaultHalfA: "73",
      vaultHalfB: "91",
      layout,
    };
  }

  const rng = createRng(normalized);
  const hour = 1 + Math.floor(rng() * 11);
  const minute = Math.floor(rng() * 60);
  const clockDisplay = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  const safeCode = `${String(hour).padStart(2, "0")}${String(minute).padStart(2, "0")}`;

  const values = pickUniqueDigits(rng, 4).map((d) => (d === 0 ? 1 + Math.floor(rng() * 9) : d));
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
  let vaultCode = fourDigit(vaultDigits);
  let vaultHalfA = vaultCode.slice(0, 2);
  let vaultHalfB = vaultCode.slice(2, 4);
  if (layout.swapVaultHalves) {
    [vaultHalfA, vaultHalfB] = [vaultHalfB, vaultHalfA];
    vaultCode = vaultHalfA + vaultHalfB;
  }

  return {
    seed: normalized,
    packId: FACILITY_PACK_ID,
    clockDisplay,
    safeCode,
    studyExitCode,
    symbolOrder,
    symbolValues,
    filingCode,
    vaultCode,
    vaultHalfA,
    vaultHalfB,
    layout,
  };
}

export function emptyMeta() {
  return {
    version: STATE_VERSION,
    bestMs: null,
    bestEnding: null,
    bestRating: null,
    clears: 0,
    endingsSeen: [],
    noHintClears: 0,
    packsCleared: [],
    dailyBestByDate: {},
    dailyStreak: 0,
    lastDailyClearDate: null,
  };
}

export function migrateMeta(raw) {
  const base = emptyMeta();
  if (!raw || typeof raw !== "object") return base;
  const dailyBestByDate =
    raw.dailyBestByDate && typeof raw.dailyBestByDate === "object" ? { ...raw.dailyBestByDate } : {};
  return {
    version: STATE_VERSION,
    bestMs: typeof raw.bestMs === "number" && raw.bestMs >= 0 ? raw.bestMs : null,
    bestEnding: typeof raw.bestEnding === "string" ? raw.bestEnding : null,
    bestRating: typeof raw.bestRating === "string" ? raw.bestRating : null,
    clears: Number.isFinite(raw.clears) && raw.clears >= 0 ? Math.floor(raw.clears) : 0,
    endingsSeen: Array.isArray(raw.endingsSeen)
      ? [...new Set(raw.endingsSeen.filter((id) => Object.hasOwn(ENDINGS, id)))]
      : [],
    noHintClears:
      Number.isFinite(raw.noHintClears) && raw.noHintClears >= 0 ? Math.floor(raw.noHintClears) : 0,
    packsCleared: Array.isArray(raw.packsCleared)
      ? [...new Set(raw.packsCleared.filter((id) => Object.hasOwn(PACKS, id)))]
      : [],
    dailyBestByDate,
    dailyStreak:
      Number.isFinite(raw.dailyStreak) && raw.dailyStreak >= 0 ? Math.floor(raw.dailyStreak) : 0,
    lastDailyClearDate: typeof raw.lastDailyClearDate === "string" ? raw.lastDailyClearDate : null,
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
  if (endingId === "ghost" || endingId === "bloom") score += 15;
  else if (endingId === "service" || endingId === "ladder") score += 5;
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
  const packId = normalizePackId(run.packId || DEFAULT_PACK_ID);
  if (!next.packsCleared.includes(packId)) next.packsCleared.push(packId);

  const hintsUsed = run.hintsUsed || 0;
  const noHints = !!run.noHintsChallenge || hintsUsed === 0;
  if (noHints && hintsUsed === 0) next.noHintClears += 1;

  const betterTime =
    next.bestMs === null || (typeof run.elapsedMs === "number" && run.elapsedMs < next.bestMs);
  if (betterTime) {
    next.bestMs = run.elapsedMs;
    next.bestEnding = run.endingId;
    next.bestRating = run.rating;
  } else if (!next.bestRating && run.rating) {
    next.bestRating = run.rating;
  }

  if (run.isDaily && run.dateKey) {
    const streakInfo = nextDailyStreak(next, run.dateKey);
    next.dailyStreak = streakInfo.dailyStreak;
    next.lastDailyClearDate = streakInfo.lastDailyClearDate;
    const prev = next.dailyBestByDate[run.dateKey];
    if (!prev || (typeof run.elapsedMs === "number" && run.elapsedMs < prev.ms)) {
      next.dailyBestByDate[run.dateKey] = {
        ms: run.elapsedMs,
        packId,
        noHints: hintsUsed === 0,
        endingId: run.endingId,
        rating: run.rating,
      };
    }
  }
  return next;
}

export function canCombine(itemA, itemB, packId = DEFAULT_PACK_ID) {
  if (normalizePackId(packId) === GREENHOUSE_PACK_ID) {
    return greenhouseCanCombine(itemA, itemB);
  }
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
  if (normalizePackId(state.packId) === GREENHOUSE_PACK_ID) {
    return greenhouseProgressSteps(state);
  }
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
  if (puzzle?.packId === GREENHOUSE_PACK_ID || normalizePackId(puzzle?.packId) === GREENHOUSE_PACK_ID) {
    return greenhouseHintCatalog(puzzle);
  }
  const layout = puzzle.layout || createFacilityLayout(puzzle.seed);
  const fuseHint =
    layout.fuseSource === "cable_tray"
      ? "Combine copper wire with a fuse from the cable tray"
      : "Combine copper wire with a fuse from the spare bin";
  const filingHost = layout.filingClueOn === "cable_tray" ? "cable tray" : "chalkboard";
  const orderNote =
    layout.archiveOrder === "free"
      ? "Do both archive paths in either order."
      : layout.archiveOrder === "fuse-first"
        ? "Today's layout requires fuse power before the filing cabinet."
        : "Today's layout requires the filing cabinet before fuse power.";
  return [
    {
      id: "h1",
      room: "study",
      text: `The wall clock is frozen at ${puzzle.clockDisplay}. Write it as four digits with no colon.`,
    },
    {
      id: "h2",
      room: "study",
      text: `Safe opens to a brass key. Battery is in the ${layout.batterySource.replace("_", " ")}; wire in the ${layout.wireSource.replace("_", " ")}. Power the keypad box.`,
    },
    {
      id: "h3",
      room: "study",
      text: `Exit sequence follows the folded note's symbol order, translated by the powered decoder → ${puzzle.studyExitCode}.`,
    },
    {
      id: "h4",
      room: "archive",
      text: `${fuseHint}, then install the patch cable on the fuse panel.`,
    },
    {
      id: "h5",
      room: "archive",
      text: `The ${filingHost} cipher unlocks the filing cabinet with code ${puzzle.filingCode}. ${orderNote}`,
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

export function buildItems(puzzle) {
  if (puzzle.packId === GREENHOUSE_PACK_ID) {
    const items = buildGreenhouseItems(puzzle);
    delete items._meta;
    return items;
  }
  const layout = puzzle.layout || createFacilityLayout(puzzle.seed);
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
      source: layout.batterySource,
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
      source: layout.wireSource,
      icon: "⌇",
    },
    fuse: {
      id: "fuse",
      name: "Spare Fuse",
      description: `A ceramic fuse from the ${layout.fuseSource.replace("_", " ")}. Combine with copper wire.`,
      usableOn: [],
      discovered: false,
      source: layout.fuseSource,
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
  if (puzzle.packId === GREENHOUSE_PACK_ID) return buildGreenhouseClues(puzzle);
  const layout = puzzle.layout || createFacilityLayout(puzzle.seed);
  const orderText = puzzle.symbolOrder.join(" → ");
  const legend = Object.entries(puzzle.symbolValues)
    .map(([k, v]) => `${k} = ${v}`)
    .join("; ");
  const orderNote =
    layout.archiveOrder === "free"
      ? "Order does not matter — finish power and filing both."
      : layout.archiveOrder === "fuse-first"
        ? "Today: restore fuse power before opening the filing cabinet."
        : "Today: unlock the filing cabinet before restoring fuse power.";
  return {
    stopped_time: {
      id: "stopped_time",
      source: "clock",
      text: `The clock is stopped at ${puzzle.clockDisplay}.`,
    },
    painting_hint: {
      id: "painting_hint",
      source: layout.timeHintOn === "painting" ? "painting" : "monitor",
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
      source: layout.filingClueOn,
      text: `Filing cipher: FILE=${puzzle.filingCode}. ${orderNote}`,
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
  if (puzzle.packId === GREENHOUSE_PACK_ID) return buildGreenhouseObjects(puzzle);
  const layout = puzzle.layout || createFacilityLayout(puzzle.seed);

  const drawerContains = ["folded_note"];
  if (layout.batterySource === "desk_drawer") drawerContains.push("battery");
  if (layout.wireSource === "desk_drawer") drawerContains.push("copper_wire");

  const bookshelfContains = [];
  if (layout.batterySource === "bookshelf") bookshelfContains.push("battery");

  const plantContains = [];
  if (layout.wireSource === "plant") plantContains.push("copper_wire");

  const spareContains = layout.fuseSource === "spare_bin" ? ["fuse"] : [];
  const trayContains = layout.fuseSource === "cable_tray" ? ["fuse"] : [];

  const paintingClues = layout.timeHintOn === "painting" ? ["painting_hint"] : [];
  const monitorClues = layout.timeHintOn === "monitor" ? ["painting_hint"] : [];
  const chalkClues = layout.filingClueOn === "chalkboard" ? ["chalk_cipher"] : [];
  const trayClues = layout.filingClueOn === "cable_tray" ? ["chalk_cipher"] : [];

  const orderLabel =
    layout.archiveOrder === "free"
      ? "POWER PATH · FILING PATH — either order works."
      : layout.archiveOrder === "fuse-first"
        ? "TODAY: POWER PATH before FILING PATH."
        : "TODAY: FILING PATH before POWER PATH.";

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
        contains: drawerContains,
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
      layout.timeHintOn === "painting"
        ? "An abstract landscape in a brass frame. The plaque reads: “The time has stopped, but the secret hasn't. Four digits, no punctuation.”"
        : "An abstract landscape. Today's safe hint is on the monitor instead.",
      { clues: paintingClues, room: "study" },
    ),
    bookshelf: makeObject(
      "bookshelf",
      "Bookshelf",
      bookshelfContains.length ? "container" : "furniture",
      bookshelfContains.length
        ? "Books on architecture and ciphers. A hollow spine hides a battery today."
        : "Books on architecture and ciphers. One spine reads: “Order matters. Carry wire forward.”",
      {
        clues: ["order_hint"],
        room: "study",
        openable: bookshelfContains.length > 0,
        open: false,
        contains: bookshelfContains,
      },
    ),
    plant: makeObject(
      "plant",
      "Potted Plant",
      plantContains.length ? "container" : "decoration",
      plantContains.length
        ? "A rubber plant with disturbed soil — a coil of copper wire is tucked under the rim."
        : "A healthy rubber plant. No key beneath it — some things are just plants.",
      {
        room: "study",
        openable: plantContains.length > 0,
        open: false,
        contains: plantContains,
      },
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
      layout.timeHintOn === "monitor"
        ? `Boot splash: “SAFE = stopped time as four digits (${puzzle.clockDisplay} → no colon).”`
        : "Welcome: “Restore the desk box, translate the sequence, then carry what you find into the archive.”",
      { clues: monitorClues, room: "study" },
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

    spare_bin: makeObject(
      "spare_bin",
      "Spare Bin",
      "container",
      spareContains.length
        ? "An unlocked bin of spare electrical parts. A fuse sits on top."
        : "Spare parts bin. Today's fuse was staged on the cable tray instead.",
      { openable: true, open: false, contains: spareContains, room: "archive" },
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
      chalkClues.length
        ? `Dusty chalk marks: a filing cipher. One line is still legible: FILE=${puzzle.filingCode}.`
        : "Chalkboard wiped clean today — the filing cipher is on the cable tray label.",
      { clues: chalkClues, room: "archive" },
    ),
    filing_cabinet: makeObject(
      "filing_cabinet",
      "Filing Cabinet",
      "safe",
      "A four-digit filing cabinet. Look for today's filing cipher in the room.",
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
      trayContains.length || trayClues.length ? "container" : "decoration",
      [
        `Labeled trays: ${orderLabel}`,
        trayContains.length ? "A spare fuse rests in the POWER bay." : "",
        trayClues.length ? `FILING tag reads FILE=${puzzle.filingCode}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      {
        room: "archive",
        openable: trayContains.length > 0,
        open: false,
        contains: trayContains,
        clues: trayClues,
      },
    ),
    archive_plant: makeObject(
      "archive_plant",
      "Dusty Fern",
      "decoration",
      "Even server rooms keep a plant. Still just a plant.",
      { room: "archive" },
    ),

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

/**
 * @param {string} [seed]
 * @param {{ packId?: string, noHintsChallenge?: boolean, isDaily?: boolean, dateKey?: string|null }} [opts]
 */
export function initialState(seed = FIXED_SEED, opts = {}) {
  const packId = normalizePackId(opts.packId || DEFAULT_PACK_ID);
  const puzzle = createPuzzle(seed, packId);
  const items = buildItems(puzzle);
  delete items._legend;

  const base = {
    version: STATE_VERSION,
    seed: puzzle.seed,
    packId,
    puzzle,
    objects: buildObjects(puzzle),
    items,
    inventory: [],
    usedItems: [],
    inspectedObjects: [],
    inspectedItems: [],
    cluesDiscovered: [],
    escaped: false,
    endingId: null,
    hintsUsedIds: [],
    noHintsChallenge: !!opts.noHintsChallenge,
    isDaily: !!opts.isDaily,
    dateKey: opts.dateKey || null,
    startedAt: null,
    finishedAt: null,
    lastAction: null,
    activityLog: [],
  };

  if (packId === GREENHOUSE_PACK_ID) {
    return { ...base, ...greenhouseInitialExtras() };
  }
  return {
    ...base,
    currentRoom: "study",
    roomsVisited: ["study"],
    selectedObject: "desk",
  };
}

export function visibleObjects(state) {
  return Object.values(state.objects).filter(
    (o) => o.visible && o.room === state.currentRoom,
  );
}

export function computeBlockers(state) {
  if (normalizePackId(state.packId) === GREENHOUSE_PACK_ID) {
    return greenhouseBlockers(state);
  }
  const o = state.objects;
  const blockers = [];
  if (state.escaped) return blockers;
  const archiveOrder = state.puzzle?.layout?.archiveOrder || "free";
  if (state.currentRoom === "study") {
    if (o.safe.locked) blockers.push("The safe needs a four-digit code suggested by objects in the room.");
    if (o.desk_drawer.locked) blockers.push("The desk drawer needs its brass key.");
    if (!o.keypad_box.state.powered) blockers.push("The keypad box needs a battery.");
    if (o.exit_door.locked) blockers.push("The hallway door needs a powered decoder and the correct four-digit sequence.");
    else if (!o.exit_door.open) blockers.push("Open the hallway door, then enter the archive.");
    else blockers.push("Use room_enter to step into the archive.");
  } else if (state.currentRoom === "archive") {
    if (archiveOrder === "fuse-first" && !o.fuse_panel.state.powered && o.filing_cabinet.locked) {
      blockers.push("Today's layout: restore fuse power before unlocking the filing cabinet.");
    }
    if (archiveOrder === "file-first" && o.filing_cabinet.locked && !o.fuse_panel.state.powered) {
      blockers.push("Today's layout: unlock the filing cabinet before restoring fuse power.");
    }
    if (!o.fuse_panel.state.powered) blockers.push("Restore fuse power: combine copper wire + fuse, install on fuse_panel.");
    if (o.filing_cabinet.locked) blockers.push("Unlock the filing cabinet using today's filing cipher.");
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

/** Whether archive path A is currently allowed given daily order constraints. */
export function archivePathAllowed(state, path) {
  const order = state.puzzle?.layout?.archiveOrder || "free";
  if (order === "free") return true;
  const o = state.objects;
  if (path === "file" && order === "fuse-first") return !!o.fuse_panel?.state?.powered;
  if (path === "fuse" && order === "file-first") return !o.filing_cabinet?.locked;
  return true;
}

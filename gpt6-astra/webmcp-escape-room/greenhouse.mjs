/**
 * Scenario pack 2: Midnight Greenhouse.
 * Topology differs from Facility: atrium hub with parallel lab/nursery branches,
 * then rooftop. Four rooms, two public endings + one silent bloom ending.
 */

import { createRng, seedFromString, makeObject, pickUniqueDigits, shuffle, fourDigit } from "./core.mjs";

export const GREENHOUSE_PACK_ID = "greenhouse";
export const GREENHOUSE_FIXED_SEED = "greenhouse-demo";

export const GREENHOUSE_ROOM_ORDER = ["atrium", "lab", "nursery", "rooftop"];

export const GREENHOUSE_ROOM_META = {
  atrium: {
    id: "atrium",
    name: "The Glass Atrium",
    eyebrow: "Room 01 / Glass atrium",
    headline: "Humidity remembers.",
    blurb: "Read the gauges. Unlock the case. Branch into lab or nursery.",
  },
  lab: {
    id: "lab",
    name: "The Night Lab",
    eyebrow: "Room 02 / Night lab",
    headline: "Grow the signal.",
    blurb: "Craft a serum, wake the spectrometer, carry the spectral chip.",
  },
  nursery: {
    id: "nursery",
    name: "The Mist Nursery",
    eyebrow: "Room 03 / Mist nursery",
    headline: "Leaves keep order.",
    blurb: "Translate the trellis, open irrigation, take the moisture token.",
  },
  rooftop: {
    id: "rooftop",
    name: "The Rooftop Hatch",
    eyebrow: "Room 04 / Rooftop",
    headline: "Choose your descent.",
    blurb: "Glass elevator, fire ladder, or a silent bloom with zero hints.",
  },
};

export const GREENHOUSE_ENDINGS = {
  elevator: {
    id: "elevator",
    title: "Glass elevator",
    badge: "Standard ending",
    subtitle: "You rode the glass elevator down into the cool night air.",
  },
  ladder: {
    id: "ladder",
    title: "Fire ladder",
    badge: "Alternate ending",
    subtitle: "Pruning shears freed the fire ladder — louder, but free.",
  },
  bloom: {
    id: "bloom",
    title: "Silent bloom",
    badge: "Hidden ending",
    subtitle: "Zero hints, specimen tag, elevator exit. The cameras misted over.",
  },
};

const LEAF_SYMBOLS = ["fern", "orchid", "ivy", "lotus"];

/**
 * Daily / seeded layout for greenhouse — item rooms & clue hosts, not only codes.
 */
export function createGreenhouseLayout(seed) {
  const normalized = String(seed || GREENHOUSE_FIXED_SEED).trim() || GREENHOUSE_FIXED_SEED;
  if (normalized === GREENHOUSE_FIXED_SEED) {
    return {
      seed: normalized,
      catalystSource: "reagent_fridge",
      humidityClueOn: "hygrometer",
      leafOrderOn: "trellis",
      leafLegendOn: "potting_bench",
      branchPreference: "free",
      swapRooftopHalves: false,
    };
  }
  const rng = createRng(`layout-gh-${normalized}`);
  const catalysts = ["reagent_fridge", "lab_shelf"];
  const humidityHosts = ["hygrometer", "mist_panel"];
  const orderHosts = ["trellis", "nursery_sign"];
  const legendHosts = ["potting_bench", "watering_can"];
  const prefs = ["free", "lab-first", "nursery-first"];
  return {
    seed: normalized,
    catalystSource: catalysts[Math.floor(rng() * catalysts.length)],
    humidityClueOn: humidityHosts[Math.floor(rng() * humidityHosts.length)],
    leafOrderOn: orderHosts[Math.floor(rng() * orderHosts.length)],
    leafLegendOn: legendHosts[Math.floor(rng() * legendHosts.length)],
    branchPreference: prefs[Math.floor(rng() * prefs.length)],
    swapRooftopHalves: rng() > 0.5,
  };
}

export function createGreenhousePuzzle(seed = GREENHOUSE_FIXED_SEED) {
  const normalized = String(seed || GREENHOUSE_FIXED_SEED).trim() || GREENHOUSE_FIXED_SEED;
  const layout = createGreenhouseLayout(normalized);

  if (normalized === GREENHOUSE_FIXED_SEED) {
    return {
      seed: GREENHOUSE_FIXED_SEED,
      packId: GREENHOUSE_PACK_ID,
      humidityDisplay: "62%",
      caseCode: "6200",
      leafOrder: ["fern", "orchid", "ivy", "lotus"],
      leafValues: { fern: 3, orchid: 7, ivy: 1, lotus: 9 },
      irrigationCode: "3719",
      rooftopCode: "5842",
      rooftopHalfA: "58",
      rooftopHalfB: "42",
      layout,
    };
  }

  const rng = createRng(normalized);
  const humidity = 40 + Math.floor(rng() * 50);
  const humidityDisplay = `${humidity}%`;
  // Case code uses humidity tens+ones padded with two zeros (demo-friendly) or four random
  const caseCode = fourDigit([
    Math.floor(humidity / 10) % 10,
    humidity % 10,
    Math.floor(rng() * 10),
    Math.floor(rng() * 10),
  ]);

  const uniq = [];
  while (uniq.length < 4) {
    const n = 1 + Math.floor(rng() * 9);
    if (!uniq.includes(n)) uniq.push(n);
  }
  const leafOrder = shuffle(rng, LEAF_SYMBOLS);
  const leafValues = {
    fern: uniq[0],
    orchid: uniq[1],
    ivy: uniq[2],
    lotus: uniq[3],
  };
  const irrigationCode = leafOrder.map((sym) => String(leafValues[sym])).join("");

  const rooftopDigits = pickUniqueDigits(rng, 4);
  let rooftopCode = fourDigit(rooftopDigits);
  let rooftopHalfA = rooftopCode.slice(0, 2);
  let rooftopHalfB = rooftopCode.slice(2, 4);
  if (layout.swapRooftopHalves) {
    [rooftopHalfA, rooftopHalfB] = [rooftopHalfB, rooftopHalfA];
    rooftopCode = rooftopHalfA + rooftopHalfB;
  }

  return {
    seed: normalized,
    packId: GREENHOUSE_PACK_ID,
    humidityDisplay,
    caseCode,
    leafOrder,
    leafValues,
    irrigationCode,
    rooftopCode,
    rooftopHalfA,
    rooftopHalfB,
    layout,
  };
}

export function greenhouseCanCombine(itemA, itemB) {
  const pair = new Set([itemA, itemB]);
  if (pair.has("nutrient_vial") && pair.has("catalyst_crystal")) {
    return { product: "growth_serum", consumes: ["nutrient_vial", "catalyst_crystal"] };
  }
  if (pair.has("spectral_chip") && pair.has("moisture_token")) {
    return { product: "rooftop_pass", consumes: ["spectral_chip", "moisture_token"] };
  }
  return null;
}

export function buildGreenhouseItems(puzzle) {
  const orderText = puzzle.leafOrder.join(" → ");
  const legend = Object.entries(puzzle.leafValues)
    .map(([k, v]) => `${k} = ${v}`)
    .join("; ");
  return {
    access_badge: {
      id: "access_badge",
      name: "Access Badge",
      description: "Opens the lab and nursery doors from the atrium — and later the rooftop seed vault.",
      usableOn: ["lab_door", "nursery_door", "seed_vault"],
      discovered: false,
      source: "specimen_case",
      icon: "◫",
    },
    nutrient_vial: {
      id: "nutrient_vial",
      name: "Nutrient Vial",
      description: "Green concentrate. Combine with a catalyst crystal in the lab.",
      usableOn: [],
      discovered: false,
      source: "specimen_case",
      icon: "⚗",
    },
    pruning_shears: {
      id: "pruning_shears",
      name: "Pruning Shears",
      description: "Heavy shears. Free the rooftop fire ladder for an alternate escape.",
      usableOn: ["fire_ladder"],
      discovered: false,
      source: "specimen_case",
      icon: "✂",
    },
    catalyst_crystal: {
      id: "catalyst_crystal",
      name: "Catalyst Crystal",
      description: "A cold crystal. Combine with the nutrient vial.",
      usableOn: [],
      discovered: false,
      source: puzzle.layout.catalystSource,
      icon: "✦",
    },
    growth_serum: {
      id: "growth_serum",
      name: "Growth Serum",
      description: "Jury-rigged serum. Feed it to the spectrometer.",
      usableOn: ["spectrometer"],
      discovered: false,
      source: null,
      icon: "◉",
      crafted: true,
    },
    spectral_chip: {
      id: "spectral_chip",
      name: "Spectral Chip",
      description: `Half the rooftop digits: ${puzzle.rooftopHalfA}··`,
      usableOn: [],
      discovered: false,
      source: "spectrometer",
      icon: "▦",
    },
    moisture_token: {
      id: "moisture_token",
      name: "Moisture Token",
      description: `Half the rooftop digits: ··${puzzle.rooftopHalfB}.`,
      usableOn: [],
      discovered: false,
      source: "irrigation_panel",
      icon: "◈",
    },
    rooftop_pass: {
      id: "rooftop_pass",
      name: "Rooftop Pass",
      description: `Combined rooftop code: ${puzzle.rooftopCode}. Enter it on the rooftop hatch.`,
      usableOn: [],
      discovered: false,
      source: null,
      icon: "▣",
      crafted: true,
    },
    specimen_tag: {
      id: "specimen_tag",
      name: "Specimen Tag",
      description: "Tag marked BLOOM. Hold it, use zero hints, and take the elevator for the hidden ending.",
      usableOn: [],
      discovered: false,
      source: "seed_vault",
      icon: "★",
    },
    _meta: { orderText, legend },
  };
}

export function buildGreenhouseClues(puzzle) {
  const orderText = puzzle.leafOrder.join(" → ");
  const legend = Object.entries(puzzle.leafValues)
    .map(([k, v]) => `${k} = ${v}`)
    .join("; ");
  return {
    humidity_reading: {
      id: "humidity_reading",
      source: puzzle.layout.humidityClueOn,
      text: `Humidity reads ${puzzle.humidityDisplay}. The case wants four digits built from that reading and the plaque.`,
    },
    case_plaque: {
      id: "case_plaque",
      source: "specimen_case",
      text: `Plaque: CASE=${puzzle.caseCode}. Humidity led you here.`,
    },
    branch_hint: {
      id: "branch_hint",
      source: "atrium_map",
      text: "Lab and nursery both open with the badge. Finish both branches, then combine chips at the hatch.",
    },
    leaf_order: {
      id: "leaf_order",
      source: puzzle.layout.leafOrderOn,
      text: `Trellis order: ${orderText}.`,
    },
    leaf_values: {
      id: "leaf_values",
      source: puzzle.layout.leafLegendOn,
      text: `Leaf legend: ${legend}.`,
    },
    spectral_half: {
      id: "spectral_half",
      source: "spectrometer",
      text: `Spectrometer footer: rooftop digits ${puzzle.rooftopHalfA}··`,
    },
    moisture_half: {
      id: "moisture_half",
      source: "irrigation_panel",
      text: `Irrigation footer: rooftop digits ··${puzzle.rooftopHalfB}.`,
    },
    rooftop_combined: {
      id: "rooftop_combined",
      source: "rooftop_pass",
      text: `Rooftop code ${puzzle.rooftopCode} unlocks the hatch.`,
    },
  };
}

export function buildGreenhouseObjects(puzzle) {
  const layout = puzzle.layout;
  const humidityDesc =
    layout.humidityClueOn === "hygrometer"
      ? `A brass hygrometer. Needle parked at ${puzzle.humidityDisplay}. A sticker says use the case plaque digits.`
      : "Decorative hygrometer — today's reading is on the mist panel instead.";
  const mistDesc =
    layout.humidityClueOn === "mist_panel"
      ? `Mist panel display: ${puzzle.humidityDisplay}. Match the specimen case plaque.`
      : "Mist nozzles idle. Today's humidity clue is on the hygrometer.";

  const fridgeContains = layout.catalystSource === "reagent_fridge" ? ["catalyst_crystal"] : [];
  const shelfContains = layout.catalystSource === "lab_shelf" ? ["catalyst_crystal"] : [];

  const trellisDesc =
    layout.leafOrderOn === "trellis"
      ? `Wire trellis tags: ${puzzle.leafOrder.join(" → ")}.`
      : "Trellis is bare today — check the nursery sign for leaf order.";
  const nurserySignDesc =
    layout.leafOrderOn === "nursery_sign"
      ? `Hand-painted order: ${puzzle.leafOrder.join(" → ")}.`
      : "Wayfinding only. Leaf order is on the trellis today.";

  const benchDesc =
    layout.leafLegendOn === "potting_bench"
      ? `Chalk legend: ${Object.entries(puzzle.leafValues)
          .map(([k, v]) => `${k}=${v}`)
          .join("; ")}.`
      : "Soil trays. Leaf values are marked on the watering can today.";
  const canDesc =
    layout.leafLegendOn === "watering_can"
      ? `Painted digits: ${Object.entries(puzzle.leafValues)
          .map(([k, v]) => `${k}=${v}`)
          .join("; ")}.`
      : "Just a watering can. Legend is on the potting bench.";

  return {
    specimen_case: makeObject(
      "specimen_case",
      "Specimen Case",
      "safe",
      `A glass case with a four-digit lock. Plaque peek: CASE=${puzzle.caseCode}.`,
      {
        locked: true,
        openable: true,
        contains: ["access_badge", "nutrient_vial", "pruning_shears"],
        clues: ["case_plaque"],
        room: "atrium",
      },
    ),
    hygrometer: makeObject("hygrometer", "Hygrometer", "clue", humidityDesc, {
      clues: layout.humidityClueOn === "hygrometer" ? ["humidity_reading"] : [],
      room: "atrium",
    }),
    mist_panel: makeObject("mist_panel", "Mist Panel", "clue", mistDesc, {
      clues: layout.humidityClueOn === "mist_panel" ? ["humidity_reading"] : [],
      room: "atrium",
    }),
    atrium_map: makeObject(
      "atrium_map",
      "Floor Map",
      "clue",
      "Map: LAB ← atrium → NURSERY · rooftop hatch above. Badge opens both wings.",
      { clues: ["branch_hint"], room: "atrium" },
    ),
    atrium_plant: makeObject(
      "atrium_plant",
      "Fiddle-leaf Fig",
      "decoration",
      "A fig that has seen too many night shifts. Still just a plant.",
      { room: "atrium" },
    ),
    lab_door: makeObject(
      "lab_door",
      "Lab Door",
      "exit",
      "Badge reader for the night lab. Inventory carries through.",
      { locked: true, openable: true, room: "atrium" },
    ),
    nursery_door: makeObject(
      "nursery_door",
      "Nursery Door",
      "exit",
      "Badge reader for the mist nursery. Either wing first — or both.",
      { locked: true, openable: true, room: "atrium" },
    ),
    rooftop_hatch: makeObject(
      "rooftop_hatch",
      "Rooftop Hatch",
      "exit",
      "Ceiling hatch to the rooftop. Needs the combined rooftop pass code.",
      { locked: true, openable: true, room: "atrium" },
    ),

    reagent_fridge: makeObject(
      "reagent_fridge",
      "Reagent Fridge",
      "container",
      fridgeContains.length
        ? "Cold fridge. A catalyst crystal waits on the shelf."
        : "Fridge hums. Today's crystal was staged on the lab shelf instead.",
      {
        openable: true,
        open: false,
        contains: fridgeContains,
        room: "lab",
      },
    ),
    lab_shelf: makeObject(
      "lab_shelf",
      "Lab Shelf",
      "container",
      shelfContains.length
        ? "Open shelf with a catalyst crystal in a foam nest."
        : "Empty foam nest — crystal is in the reagent fridge today.",
      {
        openable: true,
        open: false,
        contains: shelfContains,
        room: "lab",
      },
    ),
    spectrometer: makeObject(
      "spectrometer",
      "Spectrometer",
      "device",
      "Needs growth serum before it will spit a spectral chip.",
      {
        state: { powered: false },
        openable: true,
        open: false,
        contains: ["spectral_chip"],
        clues: ["spectral_half"],
        room: "lab",
      },
    ),
    lab_bench: makeObject(
      "lab_bench",
      "Lab Bench",
      "furniture",
      "Scuffed bench. Combine nutrient + catalyst here in spirit — use item_combine.",
      { room: "lab" },
    ),
    lab_return: makeObject(
      "lab_return",
      "Atrium Return",
      "exit",
      "Door back to the glass atrium.",
      { locked: false, openable: true, open: true, room: "lab" },
    ),

    trellis: makeObject("trellis", "Wire Trellis", "clue", trellisDesc, {
      clues: layout.leafOrderOn === "trellis" ? ["leaf_order"] : [],
      room: "nursery",
    }),
    nursery_sign: makeObject("nursery_sign", "Nursery Sign", "clue", nurserySignDesc, {
      clues: layout.leafOrderOn === "nursery_sign" ? ["leaf_order"] : [],
      room: "nursery",
    }),
    potting_bench: makeObject("potting_bench", "Potting Bench", "clue", benchDesc, {
      clues: layout.leafLegendOn === "potting_bench" ? ["leaf_values"] : [],
      room: "nursery",
    }),
    watering_can: makeObject("watering_can", "Watering Can", "clue", canDesc, {
      clues: layout.leafLegendOn === "watering_can" ? ["leaf_values"] : [],
      room: "nursery",
    }),
    irrigation_panel: makeObject(
      "irrigation_panel",
      "Irrigation Panel",
      "safe",
      "Four-digit irrigation lock. Leaf order × leaf legend.",
      {
        locked: true,
        openable: true,
        contains: ["moisture_token"],
        room: "nursery",
      },
    ),
    nursery_return: makeObject(
      "nursery_return",
      "Atrium Return",
      "exit",
      "Door back to the glass atrium.",
      { locked: false, openable: true, open: true, room: "nursery" },
    ),

    glass_elevator: makeObject(
      "glass_elevator",
      "Glass Elevator",
      "exit",
      "Main descent. Enter the rooftop code, open, then escape.",
      { locked: true, openable: true, room: "rooftop" },
    ),
    fire_ladder: makeObject(
      "fire_ladder",
      "Fire Ladder",
      "exit",
      "Rusted ladder. Pruning shears can cut the safety strap.",
      { locked: true, openable: true, room: "rooftop" },
    ),
    seed_vault: makeObject(
      "seed_vault",
      "Seed Vault",
      "container",
      "Badge-locked vault. Specimen tag for the silent bloom ending.",
      {
        locked: true,
        openable: true,
        contains: ["specimen_tag"],
        room: "rooftop",
      },
    ),
    rooftop_sign: makeObject(
      "rooftop_sign",
      "Rooftop Sign",
      "decoration",
      "← Hatch · Elevator · Ladder · BLOOM = zero hints + tag + elevator",
      { room: "rooftop" },
    ),
    rooftop_return: makeObject(
      "rooftop_return",
      "Hatch Down",
      "exit",
      "Back down to the atrium (not required to escape).",
      { locked: false, openable: true, open: true, room: "rooftop" },
    ),
  };
}

export function greenhouseProgressSteps(state) {
  const o = state.objects;
  return [
    { id: "humidity", label: "Read the humidity clue", done: state.cluesDiscovered.includes("humidity_reading") },
    { id: "case", label: "Open the specimen case", done: !o.specimen_case.locked },
    { id: "badge", label: "Unlock a wing door", done: !o.lab_door.locked || !o.nursery_door.locked },
    { id: "lab_visit", label: "Enter the night lab", done: state.roomsVisited.includes("lab") },
    { id: "serum", label: "Power the spectrometer", done: !!o.spectrometer?.state?.powered },
    { id: "nursery_visit", label: "Enter the mist nursery", done: state.roomsVisited.includes("nursery") },
    { id: "irrigation", label: "Unlock irrigation", done: !o.irrigation_panel.locked },
    { id: "both_chips", label: "Hold both rooftop halves", done: state.inventory.includes("rooftop_pass") || (state.inventory.includes("spectral_chip") && state.inventory.includes("moisture_token")) || state.cluesDiscovered.includes("rooftop_combined") },
    { id: "hatch", label: "Unlock the rooftop hatch", done: !o.rooftop_hatch.locked },
    { id: "rooftop", label: "Reach the rooftop", done: state.roomsVisited.includes("rooftop") },
    { id: "escape", label: "Escape (any ending)", done: state.escaped },
  ];
}

export function greenhouseHintCatalog(puzzle) {
  const layout = puzzle.layout;
  return [
    {
      id: "gh1",
      room: "atrium",
      text: `Humidity is ${puzzle.humidityDisplay}. The specimen case code is ${puzzle.caseCode}.`,
    },
    {
      id: "gh2",
      room: "atrium",
      text: "Take the badge, nutrient vial, and shears. Badge opens lab_door and nursery_door; you may visit either wing first.",
    },
    {
      id: "gh3",
      room: "lab",
      text: `Catalyst is in the ${layout.catalystSource.replace("_", " ")}. Combine nutrient_vial + catalyst_crystal → growth_serum, then use it on the spectrometer.`,
    },
    {
      id: "gh4",
      room: "nursery",
      text: `Leaf order (${layout.leafOrderOn}) × legend (${layout.leafLegendOn}) → irrigation code ${puzzle.irrigationCode}.`,
    },
    {
      id: "gh5",
      room: "atrium",
      text: "Combine spectral_chip + moisture_token → rooftop_pass, then code the rooftop_hatch.",
    },
    {
      id: "gh6",
      room: "rooftop",
      text: "Standard: glass_elevator. Alternate: pruning_shears on fire_ladder. Hidden: zero hints + badge on seed_vault + elevator.",
    },
  ];
}

export function greenhouseBlockers(state) {
  const o = state.objects;
  const blockers = [];
  if (state.escaped) return blockers;
  const pref = state.puzzle.layout?.branchPreference || "free";
  if (state.currentRoom === "atrium") {
    if (o.specimen_case.locked) blockers.push("Unlock the specimen case using the humidity / plaque code.");
    else if (o.lab_door.locked && o.nursery_door.locked) blockers.push("Use the access badge on a wing door.");
    else if (o.rooftop_hatch.locked) {
      if (!state.roomsVisited.includes("lab") || !state.roomsVisited.includes("nursery")) {
        blockers.push("Visit both lab and nursery; craft the rooftop pass from both halves.");
      } else {
        blockers.push("Combine spectral chip + moisture token, then enter the code on rooftop_hatch.");
      }
    } else if (!o.rooftop_hatch.open) blockers.push("Open the rooftop hatch, then enter the rooftop.");
    else blockers.push('Use room_enter({roomId:"rooftop"}).');
    if (pref === "lab-first" && !state.roomsVisited.includes("lab") && !o.lab_door.locked) {
      blockers.push("Today's layout prefers the lab wing before the nursery.");
    }
    if (pref === "nursery-first" && !state.roomsVisited.includes("nursery") && !o.nursery_door.locked) {
      blockers.push("Today's layout prefers the nursery wing before the lab.");
    }
  } else if (state.currentRoom === "lab") {
    if (!o.spectrometer.state.powered) blockers.push("Combine nutrient + catalyst, install growth serum on the spectrometer.");
    else blockers.push("Take the spectral chip, then return to the atrium or continue to the nursery.");
  } else if (state.currentRoom === "nursery") {
    if (o.irrigation_panel.locked) blockers.push("Enter the leaf-derived irrigation code.");
    else blockers.push("Take the moisture token, then return toward the rooftop hatch.");
  } else {
    if (o.glass_elevator.locked && o.fire_ladder.locked) {
      blockers.push("Unlock glass_elevator with the rooftop code, or unlock fire_ladder with pruning shears.");
    } else {
      blockers.push("Open an unlocked exit and call exit_try_escape.");
    }
  }
  return blockers;
}

export function greenhouseInitialExtras() {
  return {
    packId: GREENHOUSE_PACK_ID,
    currentRoom: "atrium",
    roomsVisited: ["atrium"],
    selectedObject: "specimen_case",
  };
}

// Re-export seed helper used only for layout stability checks
export { seedFromString };

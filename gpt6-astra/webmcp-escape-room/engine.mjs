/**
 * Shared GameEngine for WebMCP Escape Room.
 * Browser and headless (vm / node import) both use this module.
 */

import {
  FIXED_SEED,
  STATE_VERSION,
  STORAGE_KEY,
  META_KEY,
  ROOM_META,
  ENDINGS,
  createPuzzle,
  initialState,
  visibleObjects,
  progressSteps,
  computeBlockers,
  canCombine,
  nextHint,
  hintCatalog,
  buildClues,
  rateRun,
  recordClear,
  migrateMeta,
  emptyMeta,
  formatElapsed,
} from "./rules.mjs";

export {
  FIXED_SEED,
  STATE_VERSION,
  STORAGE_KEY,
  META_KEY,
  ROOM_META,
  ENDINGS,
  createPuzzle,
  initialState,
  rateRun,
  recordClear,
  migrateMeta,
  emptyMeta,
  formatElapsed,
  canCombine,
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const assertGame = (condition, message) => {
  if (!condition) throw new Error(message);
};
const action = (tool, args = {}) => ({ tool, args });

function cluesFor(state) {
  return buildClues(state.puzzle);
}

/* ==================== PUZZLE / INVENTORY ==================== */
export class PuzzleEngine {
  static code(state, objectId, code) {
    const codeTargets = {
      safe: state.puzzle.safeCode,
      exit_door: state.puzzle.studyExitCode,
      filing_cabinet: state.puzzle.filingCode,
      archive_gate: state.puzzle.vaultCode,
      vault_exit: state.puzzle.vaultCode,
    };
    assertGame(Object.hasOwn(codeTargets, objectId), "This object does not accept a code.");
    assertGame(/^\d{4}$/.test(code), "Code must be exactly four digits, supplied as a string.");
    const object = state.objects[objectId];
    assertGame(object.locked, `${object.name} is already unlocked.`);
    if (objectId === "exit_door") {
      assertGame(
        state.objects.keypad_box.state.powered,
        "The exit decoder is unpowered. Insert a battery into the keypad box first.",
      );
    }
    if (objectId === "archive_gate" || objectId === "vault_exit") {
      assertGame(
        state.inventory.includes("vault_slip") || state.cluesDiscovered.includes("vault_combined"),
        "Combine cipher card + override token into a vault slip, then enter its code.",
      );
    }
    const expected = codeTargets[objectId];
    assertGame(code === expected, "Incorrect code. The lock remains secured.");
    object.locked = false;
    if (objectId === "safe" || objectId === "filing_cabinet") object.open = true;
    const labels = {
      safe: "Digital Safe unlocked and opened.",
      exit_door: "Hallway Door unlocked. Open it, then enter the archive.",
      filing_cabinet: "Filing Cabinet unlocked and opened.",
      archive_gate: "Vault Gate unlocked. Open it, then enter the vault.",
      vault_exit: "Vault Exit unlocked. Open it, then escape.",
    };
    return labels[objectId];
  }

  static progress(state) {
    const steps = progressSteps(state);
    return {
      steps,
      completed: steps.filter((s) => s.done).length,
      total: steps.length,
      cluesDiscovered: state.cluesDiscovered.length,
      lockedObjects: visibleObjects(state)
        .filter((x) => x.locked)
        .map((x) => x.id),
      openedObjects: visibleObjects(state)
        .filter((x) => x.open)
        .map((x) => x.id),
      inventoryCount: state.inventory.length,
      blockers: computeBlockers(state),
      objective: state.escaped
        ? `Escaped (${state.endingId || "standard"}).`
        : "Escape through the vault (or service hatch).",
      escaped: state.escaped,
      currentRoom: state.currentRoom,
      roomsVisited: clone(state.roomsVisited),
      hintsUsed: (state.hintsUsedIds || []).length,
      endingId: state.endingId,
    };
  }
}

export class InventoryEngine {
  static available(state, itemId) {
    const item = state.items[itemId];
    if (!item || item.crafted && !item.discovered && !state.inventory.includes(itemId)) {
      // crafted products only exist after combine
    }
    if (!item) return false;
    if (state.inventory.includes(itemId) || state.usedItems.includes(itemId)) return false;
    if (item.crafted) return false;
    if (!item.source) return false;
    const source = state.objects[item.source];
    return !!(source && source.open && source.visible && source.room === state.currentRoom);
  }

  static pickup(state, itemId) {
    const item = state.items[itemId];
    assertGame(item, "Unknown item ID.");
    assertGame(!state.inventory.includes(itemId), `${item.name} is already in inventory.`);
    assertGame(!state.usedItems.includes(itemId), `${item.name} has already been installed.`);
    assertGame(this.available(state, itemId), `${item.name} is not accessible. Open its source container first.`);
    item.discovered = true;
    state.inventory.push(itemId);
    return `${item.name} collected.`;
  }

  static requireHeld(state, itemId) {
    const item = state.items[itemId];
    assertGame(item, "Unknown item ID.");
    assertGame(state.inventory.includes(itemId), `${item.name} is not in inventory.`);
    return item;
  }

  static use(state, itemId, targetId) {
    const item = this.requireHeld(state, itemId);
    const target = state.objects[targetId];
    assertGame(target && target.visible && target.room === state.currentRoom, "Unknown or unavailable target object.");
    assertGame(item.usableOn.includes(targetId), `${item.name} cannot be used on ${target.name}.`);

    if (itemId === "brass_key" && targetId === "desk_drawer") {
      assertGame(target.locked, "Desk Drawer is already unlocked.");
      target.locked = false;
      target.open = true;
      return "Desk Drawer unlocked and opened with the Brass Key.";
    }
    if (itemId === "brass_key" && targetId === "evidence_locker") {
      assertGame(target.locked, "Evidence Locker is already unlocked.");
      target.locked = false;
      target.open = true;
      return "Evidence Locker unlocked and opened with the Brass Key.";
    }
    if (itemId === "battery" && targetId === "keypad_box") {
      assertGame(!target.state.powered, "The keypad box is already powered.");
      target.state.powered = true;
      state.inventory = state.inventory.filter((id) => id !== itemId);
      state.usedItems.push(itemId);
      return "Battery inserted. The keypad box is online; inspect its display.";
    }
    if (itemId === "patch_cable" && targetId === "fuse_panel") {
      assertGame(!target.state.powered, "The fuse panel is already restored.");
      target.state.powered = true;
      state.objects.server_console.state.powered = true;
      state.objects.server_console.open = true;
      state.inventory = state.inventory.filter((id) => id !== itemId);
      state.usedItems.push(itemId);
      return "Patch cable installed. Server console is online — inspect it and take the override token.";
    }
    if (itemId === "override_token" && targetId === "service_hatch") {
      assertGame(target.locked, "Service Hatch is already unlocked.");
      target.locked = false;
      return "Service Hatch unlocked with the Override Token. Open it, then escape for the alternate ending.";
    }
    throw new Error("This item has no effect in the current state.");
  }

  static combine(state, itemA, itemB) {
    this.requireHeld(state, itemA);
    this.requireHeld(state, itemB);
    assertGame(itemA !== itemB, "Choose two distinct inventory items.");
    const recipe = canCombine(itemA, itemB);
    assertGame(recipe, "These items cannot be combined.");
    for (const id of recipe.consumes) {
      state.inventory = state.inventory.filter((x) => x !== id);
      state.usedItems.push(id);
    }
    const product = state.items[recipe.product];
    product.discovered = true;
    if (!state.inventory.includes(recipe.product)) state.inventory.push(recipe.product);
    if (!state.inspectedItems.includes(recipe.product)) {
      // auto-reveal vault slip text on craft
    }
    return {
      message: `Combined into ${product.name}.`,
      productId: recipe.product,
    };
  }
}

/* ==================== TOOLS ==================== */
const stringProperty = (description) => ({
  type: "string",
  minLength: 1,
  maxLength: 100,
  description,
});

function toolDefinition(name, read, description, properties = {}) {
  return {
    name,
    read,
    description,
    inputSchema: {
      type: "object",
      properties,
      required: Object.keys(properties),
      additionalProperties: false,
    },
  };
}

const objectIdSchema = stringProperty(
  "Exact visible room object ID. Discover IDs with room_list_objects or game_get_available_options.",
);
const itemIdSchema = stringProperty(
  "Exact item ID. Discover accessible or held items with room_get_state or game_get_available_options.",
);
const roomIdSchema = stringProperty("Target room ID: study, archive, or vault.");
const seedSchema = stringProperty("Run seed string. Use agent-demo for the fixed agent/test seed.");

export const TOOLS = [
  toolDefinition(
    "room_get_state",
    true,
    "Get the complete current observable escape-room state: current room, visible objects, selected object, inventory, discovered clues, open/locked states, available actions, progress, timer, hints used, and escape status.",
  ),
  toolDefinition(
    "room_get_objective",
    true,
    "Return the current objective and exact win condition. Start here when asked to escape the room.",
  ),
  toolDefinition(
    "room_list_objects",
    true,
    "List all currently visible room objects in the active room with stable IDs and short state summaries.",
  ),
  toolDefinition(
    "object_inspect",
    true,
    "Observe a visible room object to read its current description, clues, accessible contents, and available actions.",
    { objectId: objectIdSchema },
  ),
  toolDefinition(
    "object_open",
    false,
    "Open a visible, openable, unlocked object. Containers expose collectible contents.",
    { objectId: objectIdSchema },
  ),
  toolDefinition(
    "object_close",
    false,
    "Close a currently open container or door without relocking it.",
    { objectId: objectIdSchema },
  ),
  toolDefinition(
    "object_unlock",
    false,
    "Use a held compatible key on a lockable object. Brass key fits desk_drawer and evidence_locker. Code locks require code_enter.",
    { objectId: objectIdSchema, itemId: itemIdSchema },
  ),
  toolDefinition(
    "code_enter",
    false,
    "Enter a four-digit string into safe, exit_door (hallway), filing_cabinet, archive_gate, or vault_exit. Preserve leading zeroes.",
    {
      objectId: objectIdSchema,
      code: {
        type: "string",
        pattern: "^[0-9]{4}$",
        description: "Exactly four decimal digits, as a string. Infer the code from room clues.",
      },
    },
  ),
  toolDefinition(
    "item_pickup",
    false,
    "Collect an accessible item from an open source container into the shared inventory.",
    { itemId: itemIdSchema },
  ),
  toolDefinition(
    "inventory_get",
    true,
    "Return all currently held inventory items, their inspection status, and compatible targets.",
  ),
  toolDefinition(
    "item_inspect",
    true,
    "Read a held inventory item, including readable notes and symbol clues.",
    { itemId: itemIdSchema },
  ),
  toolDefinition(
    "item_use",
    false,
    "Use a held item on a compatible room object (key, battery, patch cable, override token).",
    { itemId: itemIdSchema, targetId: objectIdSchema },
  ),
  toolDefinition(
    "item_combine",
    false,
    "Combine two held items when a recipe exists: copper_wire+fuse→patch_cable; cipher_card+override_token→vault_slip.",
    { itemA: itemIdSchema, itemB: itemIdSchema },
  ),
  toolDefinition(
    "room_get_available_actions",
    true,
    "Return currently valid tool names and exact argument objects for the active room.",
  ),
  toolDefinition(
    "puzzle_get_progress",
    true,
    "Return derived puzzle milestones, room progress, hints used, blockers, and escape status.",
  ),
  toolDefinition(
    "exit_try_escape",
    false,
    "Attempt to escape through an open unlocked vault_exit (standard/ghost) or service_hatch (alternate). Hallway/archive transitions use room_enter.",
  ),
  toolDefinition(
    "game_undo",
    false,
    "Undo the most recent successful logical mutation.",
  ),
  toolDefinition(
    "game_reset",
    false,
    "Reset the run using the current seed. Clears progress and session undo history.",
  ),
  toolDefinition(
    "game_get_available_options",
    true,
    "Return valid visible object IDs, held and accessible item IDs, room IDs, and supported action types.",
  ),
  toolDefinition(
    "room_get_current",
    true,
    "Return the active room id, name, visited rooms, and which doors can be entered.",
  ),
  toolDefinition(
    "room_enter",
    false,
    "Enter an adjacent room when its connecting door is unlocked and open. Inventory carries over.",
    { roomId: roomIdSchema },
  ),
  toolDefinition(
    "hint_request",
    false,
    "Request the next progressive hint. Each hint is recorded and lowers the final rating.",
  ),
  toolDefinition(
    "hint_get_status",
    true,
    "Return how many hints were used, remaining catalog size, and whether hints will affect rating.",
  ),
  toolDefinition(
    "game_get_timer",
    true,
    "Return elapsed run time, personal best, and whether the timer has started.",
  ),
  toolDefinition(
    "game_new_run",
    false,
    "Start a fresh run with an optional seed. Omit seed or pass agent-demo for the fixed test seed; any other string randomizes codes.",
    { seed: { ...seedSchema, minLength: 0 } },
  ),
  toolDefinition(
    "ending_get_summary",
    true,
    "After escape, return ending id, rating, elapsed time, hints used, and personal best. Before escape returns status only.",
  ),
];

// game_new_run has optional seed — fix schema required list
TOOLS.find((t) => t.name === "game_new_run").inputSchema.required = [];
TOOLS.find((t) => t.name === "game_new_run").inputSchema.properties = {
  seed: {
    type: "string",
    maxLength: 100,
    description: "Optional. agent-demo = fixed codes; other strings reseed puzzles.",
  },
};

export const TOOL_MAP = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

export function validateInput(name, args) {
  const definition = TOOL_MAP[name];
  assertGame(definition, `Unknown capability: ${name}.`);
  assertGame(
    args !== null && typeof args === "object" && !Array.isArray(args),
    "Input must be a JSON object.",
  );
  const schema = definition.inputSchema;
  for (const key of Object.keys(args)) {
    assertGame(Object.hasOwn(schema.properties, key), `Unexpected argument: ${key}.`);
  }
  for (const key of schema.required) {
    const rule = schema.properties[key];
    const value = args[key];
    assertGame(typeof value === "string", `${key} must be a string.`);
    if (rule.minLength) assertGame(value.length >= rule.minLength, `${key} cannot be empty.`);
    if (rule.maxLength) assertGame(value.length <= rule.maxLength, `${key} is too long.`);
    if (rule.pattern) assertGame(new RegExp(rule.pattern).test(value), `${key} must contain exactly four digits.`);
  }
  for (const [key, value] of Object.entries(args)) {
    if (value === undefined) continue;
    const rule = schema.properties[key];
    if (!rule) continue;
    if (typeof value !== "string") continue;
    if (rule.maxLength) assertGame(value.length <= rule.maxLength, `${key} is too long.`);
    if (rule.pattern) assertGame(new RegExp(rule.pattern).test(value), `${key} must contain exactly four digits.`);
  }
}

/* ==================== UNDO / LOG ==================== */
export class UndoManager {
  constructor() {
    this.history = [];
  }
  push(state) {
    const snapshot = clone(state);
    snapshot.activityLog = [];
    snapshot.lastAction = null;
    this.history.push(snapshot);
    if (this.history.length > 100) this.history.shift();
  }
  pop() {
    return this.history.pop();
  }
  clear() {
    this.history = [];
  }
  get available() {
    return this.history.length > 0;
  }
}

export class ActivityLogger {
  static append(state, source, name, args, result) {
    state.activityLog.push({
      time: new Date().toISOString(),
      source,
      action: name,
      args: clone(args),
      success: result.success,
      message: result.message || result.error || "",
    });
    state.activityLog = state.activityLog.slice(-50);
  }
}

/* ==================== GAME ENGINE ==================== */
export class GameEngine {
  constructor(state = initialState(), meta = emptyMeta()) {
    this.state = clone(state);
    if (!this.state.puzzle) this.state.puzzle = createPuzzle(this.state.seed || FIXED_SEED);
    this.meta = migrateMeta(meta);
    this.undo = new UndoManager();
    this.listeners = new Set();
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  emit(event) {
    for (const callback of this.listeners) {
      try {
        callback(event);
      } catch (error) {
        console.error("Render/subscriber error:", error);
      }
    }
  }

  touchTimer() {
    if (!this.state.startedAt && !this.state.escaped) {
      this.state.startedAt = Date.now();
    }
  }

  getObject(id) {
    assertGame(Object.hasOwn(this.state.objects, id), "Unknown object ID.");
    const object = this.state.objects[id];
    assertGame(object.visible && object.room === this.state.currentRoom, "This object is not visible in the current room.");
    return object;
  }

  discover(ids) {
    for (const id of ids) {
      if (!this.state.cluesDiscovered.includes(id)) this.state.cluesDiscovered.push(id);
    }
  }

  description(id) {
    const o = this.state.objects[id];
    const p = this.state.puzzle;
    if (id === "keypad_box" && o.state.powered) {
      const legend = Object.entries(p.symbolValues)
        .map(([k, v]) => `${k} = ${v}`)
        .join("; ");
      return `The decoder is online. Its legend reads: ${legend}. A footer says: “Use the folded note's sequence, not the display order. Enter the result at the hallway door.”`;
    }
    if (id === "server_console" && o.state.powered) {
      return `Console online. Footer: vault digits ··${p.vaultHalfB}. Take the override token from the tray.`;
    }
    if (id === "safe" && !o.locked) {
      return o.open ? "The safe door is open. Its contents are available below." : "The safe is unlocked but closed.";
    }
    if (id === "desk_drawer" && !o.locked) {
      return o.open ? "The drawer slides freely. Its contents are available below." : "The drawer is unlocked but closed.";
    }
    if (id === "filing_cabinet" && !o.locked) {
      return o.open ? "The cabinet is open. A cipher card rests inside." : "The filing cabinet is unlocked but closed.";
    }
    if (id === "exit_door" && !o.locked) {
      return o.open
        ? "The hallway is open. Use room_enter({roomId:\"archive\"}) to continue with your inventory."
        : "The lock has released. Open the door, then enter the archive.";
    }
    if (id === "archive_gate" && !o.locked) {
      return o.open
        ? "The vault gate is open. Use room_enter({roomId:\"vault\"})."
        : "Gate unlocked. Open it, then enter the vault.";
    }
    if (id === "vault_exit" && !o.locked) {
      return this.state.escaped && this.state.endingId !== "service"
        ? "Beyond the open doorway: freedom."
        : o.open
          ? "The vault exit is open. Use exit_try_escape."
          : "Vault exit unlocked. Open it to escape.";
    }
    if (id === "service_hatch" && !o.locked) {
      return o.open
        ? "The service hatch is open. Escape through it for the alternate ending."
        : "Service hatch unlocked. Open it, then escape.";
    }
    if (id === "evidence_locker" && !o.locked) {
      return o.open ? "The locker is open. A master tag waits inside." : "Evidence locker unlocked but closed.";
    }
    return o.description;
  }

  itemView(id, force = false) {
    const item = this.state.items[id];
    const inspected = this.state.inspectedItems.includes(id);
    return {
      id: item.id,
      name: item.name,
      description: force || inspected ? item.description : "Not yet inspected.",
      usableOn: clone(item.usableOn),
      discovered: item.discovered,
      inspected,
      icon: item.icon,
    };
  }

  objectView(id, force = false) {
    const object = this.getObject(id);
    const inspected = this.state.inspectedObjects.includes(id);
    const CLUES = cluesFor(this.state);
    const clues = [...object.clues];
    if (id === "keypad_box" && object.state.powered) clues.push("symbol_values");
    if (id === "server_console" && object.state.powered) clues.push("console_half");
    return {
      id: object.id,
      name: object.name,
      type: object.type,
      room: object.room,
      visible: object.visible,
      inspectable: object.inspectable,
      interactable: object.interactable,
      locked: object.locked,
      open: object.open,
      openable: object.openable,
      state: clone(object.state),
      inspected,
      description:
        force || inspected
          ? this.description(id)
          : "Not yet inspected. Inspect this object for details and clues.",
      contains: object.open
        ? object.contains
            .filter((item) => InventoryEngine.available(this.state, item))
            .map((item) => ({ id: item, name: this.state.items[item].name }))
        : [],
      clues: clues
        .filter((key) => this.state.cluesDiscovered.includes(key))
        .map((key) => clone(CLUES[key]))
        .filter(Boolean),
      availableActions: this.availableActions(id),
    };
  }

  availableActions(objectId = null) {
    const s = this.state;
    const result = [];
    for (const object of visibleObjects(s)) {
      if (objectId && objectId !== object.id) continue;
      const id = object.id;
      if (object.inspectable) result.push(action("object_inspect", { objectId: id }));
      if (s.escaped) continue;
      if (object.openable && !object.locked) {
        result.push(action(object.open ? "object_close" : "object_open", { objectId: id }));
      }
      const codeReady =
        (id === "safe") ||
        (id === "exit_door" && s.objects.keypad_box.state.powered) ||
        (id === "filing_cabinet") ||
        (id === "archive_gate" && s.inventory.includes("vault_slip")) ||
        (id === "vault_exit" &&
          (s.inventory.includes("vault_slip") || s.cluesDiscovered.includes("vault_combined")));
      if (object.locked && codeReady) {
        result.push({
          tool: "code_enter",
          args: { objectId: id, code: "<four digits>" },
          requires: "Infer the code from discovered clues.",
        });
      }
      for (const itemId of s.inventory) {
        const item = s.items[itemId];
        if (!item.usableOn.includes(id)) continue;
        if (itemId === "brass_key" && object.locked) {
          result.push(action("item_use", { itemId, targetId: id }));
        } else if (itemId === "battery" && id === "keypad_box" && !object.state.powered) {
          result.push(action("item_use", { itemId, targetId: id }));
        } else if (itemId === "patch_cable" && id === "fuse_panel" && !object.state.powered) {
          result.push(action("item_use", { itemId, targetId: id }));
        } else if (itemId === "override_token" && id === "service_hatch" && object.locked) {
          result.push(action("item_use", { itemId, targetId: id }));
        }
      }
      if (object.open) {
        for (const itemId of object.contains) {
          if (InventoryEngine.available(s, itemId)) result.push(action("item_pickup", { itemId }));
        }
      }
      if (
        (id === "vault_exit" || id === "service_hatch") &&
        !object.locked &&
        object.open
      ) {
        result.push(action("exit_try_escape"));
      }
      if (
        id === "exit_door" &&
        !object.locked &&
        object.open &&
        s.currentRoom === "study"
      ) {
        result.push(action("room_enter", { roomId: "archive" }));
      }
      if (
        id === "archive_gate" &&
        !object.locked &&
        object.open &&
        s.currentRoom === "archive"
      ) {
        result.push(action("room_enter", { roomId: "vault" }));
      }
    }

    const seen = new Set();
    const deduped = [];
    for (const a of result) {
      const key = JSON.stringify(a);
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(a);
    }

    if (!objectId) {
      for (const itemId of s.inventory) deduped.push(action("item_inspect", { itemId }));
      // combine suggestions
      for (let i = 0; i < s.inventory.length; i++) {
        for (let j = i + 1; j < s.inventory.length; j++) {
          if (canCombine(s.inventory[i], s.inventory[j])) {
            deduped.push(
              action("item_combine", { itemA: s.inventory[i], itemB: s.inventory[j] }),
            );
          }
        }
      }
      if (!s.escaped) {
        if (
          s.currentRoom === "study" &&
          !s.objects.exit_door.locked &&
          s.objects.exit_door.open
        ) {
          deduped.push(action("room_enter", { roomId: "archive" }));
        }
        if (
          s.currentRoom === "archive" &&
          !s.objects.archive_gate.locked &&
          s.objects.archive_gate.open
        ) {
          deduped.push(action("room_enter", { roomId: "vault" }));
        }
        if (s.currentRoom === "archive" && s.roomsVisited.includes("study")) {
          // no backtracking required for demo
        }
      }
      if (this.undo.available) deduped.push(action("game_undo"));
      deduped.push(action("game_reset"));
      deduped.push(action("hint_request"));
    }
    return deduped;
  }

  elapsedMs(now = Date.now()) {
    if (this.state.finishedAt && this.state.startedAt) {
      return Math.max(0, this.state.finishedAt - this.state.startedAt);
    }
    if (!this.state.startedAt) return 0;
    return Math.max(0, now - this.state.startedAt);
  }

  getState() {
    const s = this.state;
    return {
      version: s.version,
      seed: s.seed,
      currentRoom: s.currentRoom,
      room: clone(ROOM_META[s.currentRoom]),
      roomsVisited: clone(s.roomsVisited),
      objects: visibleObjects(s).map((o) => this.objectView(o.id)),
      inventory: s.inventory.map((id) => this.itemView(id)),
      installedItems: clone(s.usedItems),
      cluesDiscovered: s.cluesDiscovered.map((id) => clone(cluesFor(s)[id])).filter(Boolean),
      progress: PuzzleEngine.progress(s),
      doorState: {
        locked: s.objects.exit_door.locked,
        open: s.objects.exit_door.open,
      },
      escaped: s.escaped,
      endingId: s.endingId,
      hintsUsed: (s.hintsUsedIds || []).length,
      timer: {
        started: !!s.startedAt,
        elapsedMs: this.elapsedMs(),
        elapsedLabel: formatElapsed(this.elapsedMs()),
        bestMs: this.meta.bestMs,
        bestLabel: this.meta.bestMs == null ? null : formatElapsed(this.meta.bestMs),
      },
      selectedObject: s.selectedObject,
      lastAction: clone(s.lastAction),
      activityLog: clone(s.activityLog),
      undoAvailable: this.undo.available,
    };
  }

  resolveEnding() {
    const s = this.state;
    const hatchOpen = !s.objects.service_hatch.locked && s.objects.service_hatch.open;
    const vaultOpen = !s.objects.vault_exit.locked && s.objects.vault_exit.open;
    assertGame(hatchOpen || vaultOpen, "Open an unlocked vault exit or service hatch first.");

    if (hatchOpen && !vaultOpen) return "service";
    if (
      vaultOpen &&
      (s.hintsUsedIds || []).length === 0 &&
      s.inventory.includes("master_tag")
    ) {
      return "ghost";
    }
    if (vaultOpen) return "standard";
    return "service";
  }

  execute(name, args = {}, source = "UI") {
    let before = null;
    let changed = false;
    let message = "";
    let data = null;
    let result;
    let affected = null;
    let metaChanged = false;

    try {
      validateInput(name, args);
      const def = TOOL_MAP[name];
      const s = this.state;

      if (
        !def.read &&
        !["game_undo", "game_reset", "game_new_run", "item_combine", "hint_request"].includes(name)
      ) {
        assertGame(!s.escaped, "Already escaped. Undo, reset, or start game_new_run.");
      }

      if (args.objectId) affected = this.getObject(args.objectId).id;
      if (args.targetId) affected = this.getObject(args.targetId).id;
      for (const field of ["itemId", "itemA", "itemB"]) {
        if (args[field]) assertGame(Object.hasOwn(s.items, args[field]), "Unknown item ID.");
      }
      if (!affected && args.itemId && s.items[args.itemId].source) {
        affected = s.items[args.itemId].source;
      }
      if (!def.read) before = clone(s);

      switch (name) {
        case "room_get_state":
          data = this.getState();
          break;
        case "room_get_objective":
          data = {
            objective: s.escaped
              ? `You escaped (${s.endingId}).`
              : "Escape the facility through the vault antechamber.",
            winCondition:
              "Solve the study, enter the archive, finish both archive paths, reach the vault, then exit_try_escape.",
            guidance:
              "Inspect objects, combine items when recipes exist, carry inventory between rooms via room_enter. Hints lower your rating.",
            rooms: ROOM_ORDER_LABELS(),
            fixedSeed: FIXED_SEED,
          };
          break;
        case "room_list_objects":
          data = {
            currentRoom: s.currentRoom,
            objects: visibleObjects(s).map((o) => ({
              id: o.id,
              name: o.name,
              type: o.type,
              locked: o.locked,
              open: o.open,
              inspected: s.inspectedObjects.includes(o.id),
            })),
          };
          break;
        case "object_inspect": {
          const o = this.getObject(args.objectId);
          assertGame(o.inspectable, "This object cannot be inspected.");
          s.selectedObject = o.id;
          if (!s.inspectedObjects.includes(o.id)) s.inspectedObjects.push(o.id);
          this.discover(o.clues);
          if (o.id === "keypad_box" && o.state.powered) this.discover(["symbol_values"]);
          if (o.id === "server_console" && o.state.powered) this.discover(["console_half"]);
          if (o.open) {
            for (const id of o.contains) {
              if (InventoryEngine.available(s, id)) s.items[id].discovered = true;
            }
          }
          data = this.objectView(o.id, true);
          message = `${o.name} inspected.`;
          break;
        }
        case "object_open": {
          const o = this.getObject(args.objectId);
          assertGame(o.openable, `${o.name} is not an openable object.`);
          assertGame(!o.locked, `${o.name} is locked.`);
          assertGame(!o.open, `${o.name} is already open.`);
          if (o.id === "server_console") {
            assertGame(o.state.powered, "Server console is dark until the fuse panel is restored.");
          }
          o.open = true;
          changed = true;
          message = `${o.name} opened.`;
          break;
        }
        case "object_close": {
          const o = this.getObject(args.objectId);
          assertGame(o.openable && o.open, `${o.name} is not open.`);
          o.open = false;
          changed = true;
          message = `${o.name} closed.`;
          break;
        }
        case "object_unlock": {
          const ok =
            (args.itemId === "brass_key" && args.objectId === "desk_drawer") ||
            (args.itemId === "brass_key" && args.objectId === "evidence_locker");
          assertGame(ok, "This key and lock are incompatible. Code locks require code_enter.");
          message = InventoryEngine.use(s, args.itemId, args.objectId);
          changed = true;
          break;
        }
        case "code_enter":
          message = PuzzleEngine.code(s, args.objectId, args.code);
          changed = true;
          break;
        case "item_pickup":
          message = InventoryEngine.pickup(s, args.itemId);
          changed = true;
          data = { item: this.itemView(args.itemId) };
          break;
        case "inventory_get":
          data = {
            items: s.inventory.map((id) => this.itemView(id)),
            installedItems: s.usedItems.map((id) => ({
              id,
              name: s.items[id]?.name || id,
            })),
          };
          break;
        case "item_inspect": {
          const item = InventoryEngine.requireHeld(s, args.itemId);
          if (!s.inspectedItems.includes(item.id)) s.inspectedItems.push(item.id);
          if (item.id === "folded_note") this.discover(["symbol_order"]);
          if (item.id === "safe_note") this.discover(["safe_note"]);
          if (item.id === "vault_slip") this.discover(["vault_combined"]);
          if (item.id === "cipher_card") this.discover(["chalk_cipher"]);
          data = this.itemView(item.id, true);
          message = `${item.name} inspected.`;
          break;
        }
        case "item_use":
          message = InventoryEngine.use(s, args.itemId, args.targetId);
          changed = true;
          break;
        case "item_combine": {
          InventoryEngine.requireHeld(s, args.itemA);
          InventoryEngine.requireHeld(s, args.itemB);
          assertGame(args.itemA !== args.itemB, "Choose two distinct inventory items.");
          if (!canCombine(args.itemA, args.itemB)) {
            result = {
              success: false,
              action: name,
              error:
                "Those items cannot be combined. Valid recipes: copper_wire+fuse → patch_cable; cipher_card+override_token → vault_slip.",
              errorCode: "NO_COMBINATION",
            };
            break;
          }
          const combined = InventoryEngine.combine(s, args.itemA, args.itemB);
          message = combined.message;
          changed = true;
          data = { product: this.itemView(combined.productId, true) };
          if (combined.productId === "vault_slip") {
            if (!s.inspectedItems.includes("vault_slip")) s.inspectedItems.push("vault_slip");
            this.discover(["vault_combined"]);
          }
          break;
        }
        case "room_get_available_actions":
          data = { actions: this.availableActions() };
          break;
        case "puzzle_get_progress":
          data = PuzzleEngine.progress(s);
          break;
        case "exit_try_escape": {
          const ending = this.resolveEnding();
          const doorId = ending === "service" ? "service_hatch" : "vault_exit";
          affected = doorId;
          s.escaped = true;
          s.endingId = ending;
          s.finishedAt = Date.now();
          if (!s.startedAt) s.startedAt = s.finishedAt;
          const elapsed = this.elapsedMs();
          const rating = rateRun({
            elapsedMs: elapsed,
            hintsUsed: (s.hintsUsedIds || []).length,
            endingId: ending,
          });
          this.meta = recordClear(this.meta, {
            elapsedMs: elapsed,
            endingId: ending,
            rating,
          });
          metaChanged = true;
          changed = true;
          message = `Escape successful (${ENDINGS[ending].title}). Rating ${rating}.`;
          data = {
            endingId: ending,
            ending: ENDINGS[ending],
            rating,
            elapsedMs: elapsed,
            elapsedLabel: formatElapsed(elapsed),
            hintsUsed: (s.hintsUsedIds || []).length,
            isPersonalBest: this.meta.bestMs === elapsed,
          };
          break;
        }
        case "game_undo": {
          assertGame(this.undo.available, "Nothing to undo in this session.");
          const oldLog = s.activityLog;
          this.state = this.undo.pop();
          this.state.activityLog = oldLog;
          changed = true;
          affected = this.state.selectedObject;
          message = "Last logical action undone.";
          break;
        }
        case "game_reset": {
          const oldLog = s.activityLog;
          const seed = s.seed || FIXED_SEED;
          this.state = initialState(seed);
          this.state.activityLog = oldLog;
          this.undo.clear();
          changed = true;
          affected = null;
          message = `Room reset (seed ${seed}).`;
          break;
        }
        case "game_get_available_options":
          data = {
            objectIds: visibleObjects(s).map((o) => o.id),
            inventoryItemIds: clone(s.inventory),
            accessibleItemIds: Object.keys(s.items).filter((id) =>
              InventoryEngine.available(s, id),
            ),
            roomIds: ["study", "archive", "vault"],
            currentRoom: s.currentRoom,
            supportedActionTypes: TOOLS.map((t) => t.name),
          };
          break;
        case "room_get_current":
          data = {
            currentRoom: s.currentRoom,
            room: clone(ROOM_META[s.currentRoom]),
            roomsVisited: clone(s.roomsVisited),
            canEnter: this.availableActions()
              .filter((a) => a.tool === "room_enter")
              .map((a) => a.args.roomId),
          };
          break;
        case "room_enter": {
          const roomId = args.roomId;
          assertGame(["study", "archive", "vault"].includes(roomId), "Unknown room ID.");
          assertGame(roomId !== s.currentRoom, `Already in ${roomId}.`);
          if (roomId === "archive") {
            assertGame(s.currentRoom === "study", "Archive is reached from the study hallway.");
            assertGame(!s.objects.exit_door.locked && s.objects.exit_door.open, "Open the unlocked hallway door first.");
          } else if (roomId === "vault") {
            assertGame(s.currentRoom === "archive", "Vault is reached from the archive gate.");
            assertGame(
              !s.objects.archive_gate.locked && s.objects.archive_gate.open,
              "Open the unlocked vault gate first.",
            );
          } else {
            throw new Error("Backtracking to the study is not required; press forward.");
          }
          s.currentRoom = roomId;
          if (!s.roomsVisited.includes(roomId)) s.roomsVisited.push(roomId);
          const defaults = { archive: "chalkboard", vault: "vault_sign", study: "desk" };
          s.selectedObject = defaults[roomId];
          changed = true;
          message = `Entered ${ROOM_META[roomId].name}. Inventory carried over.`;
          data = { currentRoom: roomId, room: clone(ROOM_META[roomId]) };
          break;
        }
        case "hint_request": {
          const hint = nextHint(s, s.puzzle);
          assertGame(hint, "No further hints remain.");
          s.hintsUsedIds = s.hintsUsedIds || [];
          s.hintsUsedIds.push(hint.id);
          changed = true;
          message = `Hint: ${hint.text}`;
          data = {
            hint,
            hintsUsed: s.hintsUsedIds.length,
            remaining: hintCatalog(s.puzzle).length - s.hintsUsedIds.length,
            ratingNote: "Using hints lowers your final rating.",
          };
          break;
        }
        case "hint_get_status":
          data = {
            hintsUsed: (s.hintsUsedIds || []).length,
            hintsUsedIds: clone(s.hintsUsedIds || []),
            remaining: hintCatalog(s.puzzle).length - (s.hintsUsedIds || []).length,
            affectsRating: true,
          };
          break;
        case "game_get_timer":
          data = {
            started: !!s.startedAt,
            elapsedMs: this.elapsedMs(),
            elapsedLabel: formatElapsed(this.elapsedMs()),
            bestMs: this.meta.bestMs,
            bestLabel: this.meta.bestMs == null ? null : formatElapsed(this.meta.bestMs),
            finished: s.escaped,
          };
          break;
        case "game_new_run": {
          const seed =
            args.seed === undefined || args.seed === ""
              ? FIXED_SEED
              : String(args.seed);
          const oldLog = s.activityLog;
          this.state = initialState(seed);
          this.state.activityLog = oldLog;
          this.undo.clear();
          changed = true;
          message = `New run started (seed ${this.state.seed}).`;
          data = { seed: this.state.seed, puzzlePreview: { clockDisplay: this.state.puzzle.clockDisplay } };
          break;
        }
        case "ending_get_summary":
          if (!s.escaped) {
            data = { escaped: false, message: "Not escaped yet." };
          } else {
            const elapsed = this.elapsedMs();
            data = {
              escaped: true,
              endingId: s.endingId,
              ending: ENDINGS[s.endingId],
              rating: rateRun({
                elapsedMs: elapsed,
                hintsUsed: (s.hintsUsedIds || []).length,
                endingId: s.endingId,
              }),
              elapsedMs: elapsed,
              elapsedLabel: formatElapsed(elapsed),
              hintsUsed: (s.hintsUsedIds || []).length,
              bestMs: this.meta.bestMs,
              clears: this.meta.clears,
              endingsSeen: clone(this.meta.endingsSeen),
            };
          }
          break;
      }

      if (changed && !["game_undo", "game_reset", "game_new_run"].includes(name)) {
        this.undo.push(before);
        this.touchTimer();
        if (affected && s.objects[affected]?.room === this.state.currentRoom) {
          this.state.selectedObject = affected;
        }
        for (const item of Object.values(this.state.items)) {
          if (InventoryEngine.available(this.state, item.id)) item.discovered = true;
        }
      }
      if (!result) {
        result = {
          success: true,
          action: name,
          message: message || "Observation returned.",
          data,
        };
      }
    } catch (error) {
      if (before) this.state = before;
      result = {
        success: false,
        action: name,
        error: error instanceof Error ? error.message : String(error),
        errorCode:
          error instanceof Error && error.message.includes("combin")
            ? "NO_COMBINATION"
            : "INVALID_ACTION",
      };
      // Restore proper NO_COMBINATION for item_combine failures that aren't hold errors
      if (name === "item_combine" && result.error.includes("cannot be combined")) {
        result.errorCode = "NO_COMBINATION";
      }
    }

    this.state.lastAction = {
      source,
      tool: name,
      args: clone(args),
      success: result.success,
      time: new Date().toISOString(),
    };
    ActivityLogger.append(this.state, source, name, args, result);
    if (changed && result.success) {
      ActivityLogger.append(this.state, "System", "state_changed", {}, { success: true, message });
    }
    if (name === "room_get_state" && result.success) result.data = this.getState();
    if (changed && result.success) {
      result.data = {
        ...(result.data || {}),
        progress: PuzzleEngine.progress(this.state),
        affectedObject: affected && this.state.objects[affected]?.room === this.state.currentRoom
          ? this.objectView(affected)
          : null,
        undoAvailable: this.undo.available,
      };
    }
    this.emit({ name, args, source, result, changed, affected, metaChanged });
    return result;
  }

  systemMessage(message) {
    ActivityLogger.append(this.state, "System", "status", {}, { success: true, message });
    this.emit({
      name: "system",
      source: "System",
      result: { success: true, message },
      changed: false,
    });
  }
}

function ROOM_ORDER_LABELS() {
  return ["study", "archive", "vault"].map((id) => clone(ROOM_META[id]));
}

/* ==================== PERSISTENCE HELPERS ==================== */
export function validateState(value) {
  assertGame(value && value.version === STATE_VERSION, "Unsupported saved-state version.");
  assertGame(value.objects && value.items && value.puzzle, "Missing state data.");
  assertGame(["study", "archive", "vault"].includes(value.currentRoom), "Invalid room.");
  assertGame(typeof value.escaped === "boolean", "Invalid escaped flag.");
  assertGame(Array.isArray(value.inventory), "Invalid inventory.");
  assertGame(Array.isArray(value.roomsVisited), "Invalid roomsVisited.");
  // Rebuild from seed and overlay mutable fields for safety
  const fresh = initialState(value.seed || FIXED_SEED);
  const clean = clone(fresh);
  const copyArrays = [
    "inventory",
    "usedItems",
    "inspectedObjects",
    "inspectedItems",
    "cluesDiscovered",
    "roomsVisited",
    "hintsUsedIds",
    "activityLog",
  ];
  for (const key of copyArrays) {
    if (Array.isArray(value[key])) clean[key] = clone(value[key]);
  }
  clean.currentRoom = value.currentRoom;
  clean.escaped = value.escaped;
  clean.endingId = value.endingId || null;
  clean.selectedObject = value.selectedObject;
  clean.startedAt = value.startedAt || null;
  clean.finishedAt = value.finishedAt || null;
  clean.lastAction = value.lastAction || null;
  clean.seed = value.seed || FIXED_SEED;
  clean.puzzle = createPuzzle(clean.seed);

  for (const [id, obj] of Object.entries(fresh.objects)) {
    const saved = value.objects[id];
    assertGame(saved, `Missing object ${id}`);
    clean.objects[id] = {
      ...clone(obj),
      locked: !!saved.locked,
      open: !!saved.open,
      state: saved.state && typeof saved.state === "object" ? clone(saved.state) : clone(obj.state),
    };
  }
  for (const [id, item] of Object.entries(fresh.items)) {
    const saved = value.items[id];
    clean.items[id] = {
      ...clone(item),
      discovered: !!(saved && saved.discovered),
    };
  }
  assertGame(Object.hasOwn(clean.objects, clean.selectedObject), "Invalid selection.");
  if (clean.escaped) {
    assertGame(
      (!clean.objects.vault_exit.locked && clean.objects.vault_exit.open) ||
        (!clean.objects.service_hatch.locked && clean.objects.service_hatch.open),
      "Invalid escaped state.",
    );
  }
  clean.activityLog = (clean.activityLog || []).slice(-50);
  return clean;
}

/** Solve the full game on a fresh engine (for checks). */
export function solveFullRun(seed = FIXED_SEED, opts = {}) {
  const engine = new GameEngine(initialState(seed));
  const call = (name, args = {}) => {
    const r = engine.execute(name, args, "System");
    if (!r.success) throw new Error(`${name} failed: ${r.error}`);
    return r;
  };
  const p = engine.state.puzzle;

  call("object_inspect", { objectId: "clock" });
  call("code_enter", { objectId: "safe", code: p.safeCode });
  call("item_pickup", { itemId: "brass_key" });
  call("item_pickup", { itemId: "safe_note" });
  call("object_unlock", { objectId: "desk_drawer", itemId: "brass_key" });
  call("item_pickup", { itemId: "battery" });
  call("item_pickup", { itemId: "folded_note" });
  call("item_pickup", { itemId: "copper_wire" });
  call("item_use", { itemId: "battery", targetId: "keypad_box" });
  call("code_enter", { objectId: "exit_door", code: p.studyExitCode });
  call("object_open", { objectId: "exit_door" });
  call("room_enter", { roomId: "archive" });

  // Non-linear: filing first then fuse (or reverse via opts)
  if (opts.archiveOrder === "fuse-first") {
    call("object_open", { objectId: "spare_bin" });
    call("item_pickup", { itemId: "fuse" });
    call("item_combine", { itemA: "copper_wire", itemB: "fuse" });
    call("item_use", { itemId: "patch_cable", targetId: "fuse_panel" });
    call("item_pickup", { itemId: "override_token" });
    call("object_inspect", { objectId: "chalkboard" });
    call("code_enter", { objectId: "filing_cabinet", code: p.filingCode });
    call("item_pickup", { itemId: "cipher_card" });
  } else {
    call("object_inspect", { objectId: "chalkboard" });
    call("code_enter", { objectId: "filing_cabinet", code: p.filingCode });
    call("item_pickup", { itemId: "cipher_card" });
    call("object_open", { objectId: "spare_bin" });
    call("item_pickup", { itemId: "fuse" });
    call("item_combine", { itemA: "copper_wire", itemB: "fuse" });
    call("item_use", { itemId: "patch_cable", targetId: "fuse_panel" });
    call("item_pickup", { itemId: "override_token" });
  }

  call("item_combine", { itemA: "cipher_card", itemB: "override_token" });
  // override consumed — for service ending we need to keep token; combine consumes it.
  // For standard/ghost we only need vault_slip.
  call("item_inspect", { itemId: "vault_slip" });
  call("code_enter", { objectId: "archive_gate", code: p.vaultCode });
  call("object_open", { objectId: "archive_gate" });
  call("room_enter", { roomId: "vault" });

  if (opts.ending === "service") {
    call("item_use", { itemId: "override_token", targetId: "service_hatch" });
    call("object_open", { objectId: "service_hatch" });
    call("exit_try_escape");
    return engine;
  }

  if (opts.ending === "ghost") {
    call("object_unlock", { objectId: "evidence_locker", itemId: "brass_key" });
    call("item_pickup", { itemId: "master_tag" });
  }

  call("code_enter", { objectId: "vault_exit", code: p.vaultCode });
  call("object_open", { objectId: "vault_exit" });
  call("exit_try_escape");
  return engine;
}

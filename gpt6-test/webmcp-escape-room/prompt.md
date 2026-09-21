You are a senior Frontend Engineer, Web API Engineer, game systems designer, puzzle designer, and interactive AI demo builder.

Build a complete, polished, fully runnable single-page HTML demo called:

WebMCP Escape Room

Do not give me a plan, architecture proposal, pseudocode, or partial snippets.

Directly implement the complete application.

The final result should clearly demonstrate how a human player and an AI agent can both interact with the same escape-room game through a shared application capability layer using WebMCP.

# Core Goal

Create a small but polished interactive escape-room game that works as a WebMCP technical showcase.

A human should be able to inspect objects, collect items, solve puzzles, and escape the room through the UI.

An AI agent should be able to solve the same room through structured WebMCP tools.

Both the human and the AI agent must operate on the exact same shared game state.

The key concept to demonstrate is:

"The AI agent is not clicking buttons or guessing the DOM. The game directly exposes structured escape-room capabilities through WebMCP."

Example:

Human:
clicks the safe and enters a code

AI:
code_enter({
  "objectId": "safe",
  "code": "0317"
})

Both must call the same underlying GameEngine.

# Final Deliverable

Create:

index.html

Prefer one self-contained HTML file containing:

- HTML
- CSS
- JavaScript

Use:

- Vanilla HTML
- Vanilla CSS
- Vanilla JavaScript

Do not use:

- React
- Vue
- Angular
- npm
- build tools
- backend
- database
- external MCP server
- SSE
- WebSocket
- fake remote APIs

The application must run directly in the browser.

# Optional Visual Assets

For anything that needs bitmaps/textures/sprites (or if it helps to have a mockup reference for any 3d models you build) feel free to use imagegen.

However:

- the final result must still be a fully interactive HTML game
- generated assets are optional support only
- do not replace the application with a static mockup
- game state must be interactive and visibly responsive

# WebMCP

Use the WebMCP Imperative API through:

document.modelContext

Use capability detection:

if ('modelContext' in document)

If unsupported:

- the game must still be fully playable by a human
- show a visible badge:
  "WebMCP Unsupported"
- log a clear console message
- do not crash

If supported:

- show:
  "WebMCP Connected"
- register all tools after game initialization
- avoid duplicate registration

Use:

await document.modelContext.registerTool({...})

Do not use WebMCP tools to simulate DOM clicks.

WebMCP tools must call domain logic directly.

# Application Architecture

Use clear separation of concerns.

Suggested structure:

GameEngine
PuzzleEngine
InventoryEngine
RoomRenderer
UIController
WebMCPAdapter
ActivityLogger
UndoManager

GameEngine must be the single source of truth.

Data flow:

Human UI
    ↓
GameEngine
    ↓
Shared Game State
    ↓
Renderer

AI Agent
    ↓
WebMCP Tools
    ↓
GameEngine
    ↓
Shared Game State
    ↓
Renderer

Both paths must operate on the exact same state.

# Escape Room Concept

Create one visually rich room that contains multiple interactive objects and a small but satisfying puzzle chain.

The room should be compact enough for a demo but deep enough to show real agent reasoning.

Theme:

Modern study / office / apartment escape room

Tone:

smart, polished, slightly mysterious, clean, premium tech-demo feeling

Avoid horror.

# Room Layout

The main room should visually include at least these objects:

- Exit Door
- Digital Safe
- Desk
- Desk Drawer
- Wall Clock
- Painting / Framed Picture
- Bookshelf
- Potted Plant
- Table Lamp
- Laptop or Monitor
- Rug or Floor Panel
- Keypad Box or Locked Cabinet

You may visually add more objects if useful, but keep the puzzle understandable.

The player should immediately see a stylized room scene with clickable hotspots or object cards.

# Core Puzzle Chain

Design a deterministic puzzle flow that can be solved through observation and reasoning.

Example chain:

1. Inspect the clock
   → reveals stopped time: 03:17

2. Inspect the note or painting clue
   → suggests:
   "The time has stopped, but the secret hasn't."

3. Enter 0317 into the safe
   → safe opens

4. Inside safe:
   - brass key
   - small note

5. Use brass key on desk drawer
   → drawer opens

6. Drawer contains:
   - battery
   - folded paper with a symbol clue

7. Insert battery into keypad box or laptop
   → powered object reveals final code or door clue

8. Enter final code or unlock exit
   → exit door opens

9. Use handle / escape
   → game complete

The exact puzzle content may differ, but it must be:

- logically solvable
- deterministic
- understandable from state and clues
- agent-friendly through structured observations
- fun for humans

Avoid random puzzle generation.

# Required Puzzle Design Qualities

The puzzle should:

- require at least 2 to 4 reasoning steps
- require inspecting multiple objects
- include an inventory
- include at least one locked object
- include at least one code entry
- include at least one item-use interaction
- have a clear success state

Do not make it so trivial that the agent wins in one action.

Do not make it so obscure that only humans with external cultural knowledge could solve it.

# Game State Model

The game state should include:

- room objects
- object visibility
- object locked/unlocked/opened states
- collected inventory items
- clues discovered
- puzzle progress
- door state
- solved / escaped status
- selected object
- last action
- activity log

Each object should have a structured model such as:

{
  id,
  name,
  type,
  visible,
  inspectable,
  interactable,
  locked,
  open,
  description,
  state,
  contains,
  clues
}

Each inventory item should have:

{
  id,
  name,
  description,
  usableOn,
  discovered
}

# Main UI Layout

Header:

WebMCP Escape Room

Subtitle:

Escape through UI or AI tools.

Top right:

WebMCP ● Connected

or:

WebMCP ● Unsupported

Main layout:

Left:
large illustrated room scene or polished room-view panel

Right:
interaction panel

Bottom:
inventory
activity log
WebMCP tool inspector
suggested AI prompts
How WebMCP Works section

Desktop:
room left, controls right

Mobile:
room on top, control panel below

No horizontal overflow.

# Room Interaction UI

The room should visually present clickable objects.

Possible approaches:

- illustrated room scene with hotspots
- room map with interactive zones
- hybrid room scene + object list

When the user clicks an object:

- show object details
- show available actions
- highlight the object in the room
- allow relevant interactions

# Object Interaction Panel

When an object is selected, show:

- object name
- current description
- state
- available actions such as:
  - Inspect
  - Open
  - Unlock
  - Enter Code
  - Use Item
  - Take Item

Only show actions that make sense for that object.

# Inventory

Show a visible inventory bar or panel.

Display collected items such as:

- Brass Key
- Battery
- Folded Note
- Small Token
- Screwdriver

The inventory must update live.

Users must be able to:

- inspect item
- use item on object
- optionally combine items if your puzzle supports it

# Interaction Types

Support these game interactions:

- inspect object
- open object
- close object if relevant
- pick up item
- use item on target
- enter code into keypad / safe
- unlock object
- inspect inventory item
- optionally combine items
- escape through exit when door is unlocked

# Visual Design

Create a polished dark-theme interface with a premium technical-demo feel.

Style direction:

- modern game UI
- subtle mystery
- premium escape-room dashboard
- dark mode
- glassmorphism panels
- elegant highlights
- restrained gold / blue / violet accents
- subtle shadows
- clear typography
- smooth motion

The room itself should be the visual focal point.

Avoid a childish cartoon feel.

# Visual Feedback

When state changes, the UI should visibly react.

Examples:

- safe door opens
- drawer slides open
- battery appears in inventory
- door glows or unlocks
- exit status changes
- solved objects get a subtle completed marker

When AI performs actions through WebMCP, briefly highlight affected objects.

# Activity Log

Add a visible Activity Log panel.

Track actions from:

- UI
- WebMCP
- System

Examples:

15:12:03 UI       inspect_object clock
15:12:08 WebMCP   room_get_state
15:12:12 WebMCP   inspect_object painting
15:12:20 WebMCP   code_enter safe "0317"
15:12:26 System   Safe unlocked
15:12:33 UI       pickup_item brass_key
15:12:48 WebMCP   use_item brass_key → desk_drawer
15:13:10 System   Escape successful

Keep the latest 50 entries.

This panel is important for demonstrating that AI actions are using WebMCP tools rather than clicking the page.

# Toast Notifications

Show polished toast notifications for meaningful actions such as:

- AI Agent unlocked the safe
- Brass Key collected
- Desk Drawer opened
- Battery inserted
- Exit Door unlocked
- Escape successful

Do not falsely label UI actions as AI actions.

# Undo

Support undo for logical mutation actions such as:

- item pickup
- object open
- object unlock
- code entry
- item use
- puzzle progression

One undo should revert one logical action.

Undo should not corrupt puzzle state.

# WebMCP Tools

Register structured tools using snake_case names.

Every tool must include:

- a high-quality description
- JSON input schema
- input validation
- predictable structured return
- readOnlyHint where appropriate

Implement at minimum the following tools.

# 1. room_get_state

Description:

Get the complete current escape-room state including visible objects, selected object, room progress, discovered clues, inventory, unlocked/open states, and whether the room has been escaped.

Input:

{}

Annotations:

readOnlyHint: true
consequentialHint: false
untrustedContentHint: false

# 2. room_get_objective

Description:

Return the current objective and win condition.

Input:

{}

readOnlyHint: true

Return something like:

{
  "objective": "Escape the room.",
  "winCondition": "Unlock and open the exit door."
}

# 3. room_list_objects

Description:

Return the currently visible interactive objects in the room with short summaries.

Input:

{}

readOnlyHint: true

# 4. object_inspect

Description:

Inspect an object in the room to obtain its current description, visible details, clues, and available interactions.

Input:

{
  "objectId": "clock"
}

readOnlyHint: true

# 5. object_open

Description:

Open an object if it is openable and unlocked.

Input:

{
  "objectId": "safe"
}

This is a write action because it changes object state when successful.

# 6. object_close

Input:

{
  "objectId": "drawer"
}

Only if relevant.

# 7. object_unlock

Description:

Unlock a lockable object using an item if appropriate.

Input example:

{
  "objectId": "desk_drawer",
  "itemId": "brass_key"
}

Validate compatibility.

# 8. code_enter

Description:

Enter a code into a code-based puzzle object such as a safe or keypad.

Input:

{
  "objectId": "safe",
  "code": "0317"
}

Validate target object and code format.

Return structured success or failure.

# 9. item_pickup

Description:

Pick up a collectible item from an open or available source and place it into inventory.

Input:

{
  "itemId": "brass_key"
}

# 10. inventory_get

Description:

Return the player's current inventory and item summaries.

Input:

{}

readOnlyHint: true

# 11. item_inspect

Description:

Inspect an inventory item for more details, hints, or readable clues.

Input:

{
  "itemId": "folded_note"
}

readOnlyHint: true

# 12. item_use

Description:

Use an inventory item on a target room object.

Input:

{
  "itemId": "battery",
  "targetId": "keypad_box"
}

This is one of the most important tools.

# 13. item_combine

Description:

Combine two inventory items if the puzzle supports combination.

Input:

{
  "itemA": "wire",
  "itemB": "battery"
}

If your chosen puzzle design does not require item combination, this tool may still exist and return a clear unsupported or no-effect result.

# 14. room_get_available_actions

Description:

Return valid actions the agent can currently take based on room state.

Input:

{}

readOnlyHint: true

This prevents the agent from guessing impossible interactions.

# 15. puzzle_get_progress

Description:

Return a structured summary of puzzle progress such as opened objects, solved clues, remaining blockers, and known objectives.

Input:

{}

readOnlyHint: true

# 16. exit_try_escape

Description:

Attempt to escape through the exit door.

Input:

{}

If the exit is still locked, return a clear failure.

If successful, mark the game as escaped.

# 17. game_undo

Input:

{}

Undo the latest logical mutation.

# 18. game_reset

Input:

{}

Restore the game to the original starting state.

# 19. game_get_available_options

Description:

Return valid object IDs, inventory item IDs, and supported action types so the AI does not need to guess identifiers.

Input:

{}

readOnlyHint: true

# Tool Description Quality

Tool descriptions are extremely important.

Bad:

"Open thing."

Good:

"Open a room object if it is currently openable and unlocked. Use this after inspecting an object or unlocking it. This updates the shared room state and immediately updates the UI."

The descriptions should help an AI agent choose tools without inspecting the page layout.

# Agent Scenarios

The application must support realistic natural-language requests such as:

Scenario 1:
"Escape the room."

Expected:
- room_get_objective
- room_get_state or room_list_objects
- object_inspect
- item_pickup
- code_enter
- item_use
- exit_try_escape

Scenario 2:
"Inspect the desk and tell me what you find."

Expected:
- object_inspect desk
- possibly inspect or open drawer if relevant

Scenario 3:
"What's in my inventory?"

Expected:
- inventory_get

Scenario 4:
"Try the clock time as the safe code."

Expected:
- object_inspect clock
- code_enter safe "0317"

Scenario 5:
"Use the battery on the keypad box."

Expected:
- item_use

These scenarios should feel natural and demo-friendly.

# Suggested AI Prompts Panel

Add a panel titled:

Try asking your AI agent

Show example prompts such as:

- Escape the room.
- Inspect the room and tell me what stands out.
- Check the clock and see if it relates to the safe.
- What items do I currently have?
- Open the safe if you can.
- Use the brass key on the drawer.
- Try solving the room step by step.
- What is still blocking the exit?
- Use the battery on anything that seems unpowered.
- Attempt to escape now.

These examples help explain what WebMCP enables.

# Tool Inspector

Add a visible panel:

WebMCP Tool Inspector

For each registered tool show:

- tool name
- READ / WRITE badge
- short description

Examples:

room_get_state            READ
object_inspect            READ
code_enter                WRITE
item_pickup               WRITE
item_use                  WRITE
exit_try_escape           WRITE

Include:

Refresh Tools

If:

document.modelContext.getTools

exists, use it where reasonable.

If unavailable, gracefully show known registered tools.

Do not crash.

# Agent Highlighting

When a WebMCP action affects an object:

- briefly highlight that object
- visually indicate what changed
- keep animation subtle

Examples:

- safe glows when unlocked
- drawer highlights when opened
- door pulses when escape is possible

# Puzzle Progress Panel

Add a panel such as:

Escape Progress

Show derived signals like:

- 2 clues discovered
- Safe unlocked
- 1 locked object remains
- Exit still locked
- Inventory: 3 items

This should derive from actual GameEngine state.

# How WebMCP Works Section

Add a section titled:

How WebMCP powers this game

Explain:

1. The page exposes structured game capabilities.
2. An AI agent discovers those capabilities.
3. The agent reads state and clues.
4. The agent chooses actions such as inspect, pickup, use, or code entry.
5. GameEngine updates the shared room state.
6. The UI immediately reflects those changes.

Show a small diagram:

AI Agent
   ↓
WebMCP Tools
   ↓
GameEngine
   ↓
Shared Game State
   ↓
Escape Room UI

Human Player
   ↓
UI Controls
   ↓
GameEngine

Emphasize clearly that both human and AI use the same capability layer.

# Traditional Browser Agent vs WebMCP

Add a small comparison card:

Traditional Browser Agent:
inspect DOM
↓
find hotspot
↓
click object
↓
read page
↓
guess next action

WebMCP Agent:
room_get_state()
↓
object_inspect("clock")
↓
code_enter("safe", "0317")

This comparison should be concise and easy to understand.

# Accessibility

Provide:

- aria-labels for buttons
- semantic headings
- keyboard focus styles
- clear text contrast
- reduced motion support via prefers-reduced-motion
- readable status labels

# Persistence

Use localStorage for:

- current game state
- inventory
- puzzle progress

Provide:

Reset Game

If localStorage is corrupted, safely fall back to the default initial state.

# Validation

Validate:

- object IDs
- item IDs
- code targets
- locked/open conditions
- whether the item exists in inventory
- whether an action is valid in the current state

Do not silently fail.

Return structured errors such as:

{
  "success": false,
  "error": "Desk Drawer is locked."
}

or:

{
  "success": false,
  "error": "Battery is not in inventory."
}

# Self Tests

Run basic non-destructive console self-tests using isolated game instances.

Test:

- object inspection
- code entry success/failure
- item pickup
- unlocking with correct key
- item use
- escape blocked before completion
- escape success after puzzle completion
- undo
- reset

If a test fails:

console.error(...)

Do not affect live game state.

# Suggested JavaScript Sections

Organize the code clearly:

CONFIG
INITIAL ROOM DATA
PUZZLE DEFINITIONS
UTILITIES
GAME ENGINE
PUZZLE ENGINE
INVENTORY ENGINE
UNDO MANAGER
ROOM RENDERER
INTERACTION PANEL
ACTIVITY LOGGER
WEBMCP ADAPTER
PERSISTENCE
SELF TESTS
INITIALIZATION

Use English:

- function names
- variable names
- class names
- comments

# Acceptance Tests

TEST 1
Open page
→ escape room scene renders
PASS

TEST 2
Click an object like the clock
→ details panel updates
PASS

TEST 3
Inspect clue object
→ clue becomes visible
PASS

TEST 4
Enter a wrong code into the safe
→ structured failure
PASS

TEST 5
Enter the correct code
→ safe unlocks / opens
PASS

TEST 6
Pick up brass key
→ inventory updates
PASS

TEST 7
Use brass key on drawer
→ drawer unlocks or opens
PASS

TEST 8
Use battery on powered object
→ new clue or state change appears
PASS

TEST 9
Call room_get_state()
→ returned state matches visible UI
PASS

TEST 10
Call exit_try_escape before solving
→ blocked
PASS

TEST 11
Complete puzzle and call exit_try_escape()
→ success
PASS

TEST 12
If WebMCP unsupported
→ game remains fully playable
PASS

TEST 13
Refresh browser
→ progress persists
PASS

TEST 14
Reset Game
→ original state restored
PASS

# Final Instruction

Directly build the complete index.html.

Do not only explain how to implement it.

Do not return pseudocode.

Do not omit WebMCP integration.

Do not leave TODO markers.

Do not build a fake MCP server.

Do not require a backend.

The final result should be polished enough for a live technical demo.

Within a few seconds, a viewer should understand:

"Instead of teaching an AI agent where to click inside the room, WebMCP lets the game expose inspect, pickup, unlock, code entry, and escape as structured capabilities."

The strongest demo flow should be:

User says:
"Escape the room."

AI Agent
↓
room_get_objective()
↓
room_get_state()
↓
object_inspect(...)
↓
item_pickup(...)
↓
code_enter(...)
↓
item_use(...)
↓
exit_try_escape()

All state changes must be visible in the UI and shared with the human player.
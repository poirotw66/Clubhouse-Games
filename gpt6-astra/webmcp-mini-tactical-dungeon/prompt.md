You are a senior Frontend Engineer, Web API Engineer, tactical game systems designer, pixel-art game designer, and AI Agent interaction designer.

Build a complete, polished, fully runnable single-page HTML demo called:

WebMCP Mini Tactical Dungeon

Do not give me a plan, architecture proposal, pseudocode, partial snippets, or implementation advice first.

Directly implement the complete application.

The final result should clearly demonstrate how a human player and an AI agent can both play the exact same tactical dungeon through a shared application capability layer using WebMCP.

# Core Concept

Create a small turn-based tactical dungeon game.

A human should be able to:

* inspect the battlefield
* move the hero
* inspect enemies
* attack enemies
* use skills
* use items
* collect treasure
* avoid hazards
* manage HP and resources
* reach the exit

An AI agent should be able to perform the exact same actions through structured WebMCP tools.

Both must operate on exactly the same shared game state.

The key technical concept is:

"The AI agent is not pressing arrow keys, clicking grid cells, or guessing the DOM. The game directly exposes structured tactical capabilities through WebMCP."

Example:

Human:

clicks a neighboring tile to move.

AI:

player_move({
"x": 3,
"y": 4
})

Both must call the same underlying GameEngine.

# Strongest Demo Mission

The default mission should be:

"Collect the Ancient Crystal and reach the exit without dying."

This mission should require:

* observing the map
* navigating around obstacles
* inspecting enemies
* deciding whether to fight or avoid enemies
* collecting at least one useful item
* managing HP
* collecting the objective treasure
* reaching the exit

The AI should not be able to complete the entire mission with one tool call.

The expected Agent loop should look like:

game_get_state()
↓
map_inspect()
↓
enemy_inspect(...)
↓
player_move(...)
↓
player_attack(...)
↓
game_get_state()
↓
player_use_skill(...)
↓
player_pickup(...)
↓
player_move(...)
↓
exit_try_leave()

This repeated Observe → Reason → Act loop is one of the primary things the demo should showcase.

# Final Deliverable

Create:

index.html

Prefer a single self-contained HTML file containing:

* HTML
* CSS
* JavaScript
* game data
* sprites or CSS artwork where practical

Use:

* Vanilla HTML
* Vanilla CSS
* Vanilla JavaScript

Do not require:

* React
* Vue
* Angular
* npm
* build systems
* backend
* database
* external MCP server
* SSE
* WebSocket
* real online services

The game must run directly in the browser.

# Optional Visual Assets

For anything that needs bitmaps/textures/sprites (or if it helps to have a mockup reference for any 3d models you build) feel free to use imagegen.

This can include:

* hero sprites
* enemy sprites
* treasure sprites
* dungeon floor textures
* stone walls
* doors
* crystals
* spell effects
* health potions
* UI icons
* attack effects
* decorative dungeon background

However:

* the final deliverable must remain an interactive HTML game
* generated visual assets are support only
* do not replace the game with a static illustration
* all gameplay state must remain programmatically controlled
* prioritize functional, readable gameplay over asset complexity

A high-quality CSS / SVG / pixel-art approach is also acceptable.

# Game Style

Create a compact tactical RPG / dungeon crawler.

Visual inspiration:

* classic pixel RPG
* Into the Breach-style readability
* tactical roguelike
* premium indie-game UI
* modern developer demo

Do not copy any specific commercial game's assets.

Theme:

Ancient Arcane Dungeon

Mood:

* mysterious
* adventurous
* slightly magical
* not horror
* readable and colorful

# Battlefield

Use an:

8 × 8 grid

Each tile should have structured coordinates.

Example:

x: 0–7
y: 0–7

The battlefield should include:

* floor
* walls
* hero
* enemies
* treasure
* health potion
* mana potion if useful
* obstacle
* trap
* exit portal

Example conceptual map:

W W W W W W W W
W H . . G . . W
W . W . . . T W
W . W . S . . W
W . . . . O . W
W P . W . . C W
W . . . . . E W
W W W W W W W W

Legend:

H = Hero
G = Goblin
S = Skeleton
O = Orc
P = Potion
C = Ancient Crystal
E = Exit
W = Wall
T = Trap
. = Floor

Do not render literal letters.

Render visually attractive tiles and sprites.

# Camera / Board Presentation

Use either:

* top-down
* slight isometric
* pseudo-3D tactical board

The battlefield should be the visual centerpiece.

Each tile should have:

* subtle depth
* hover highlight
* movement range highlight
* attack range highlight
* coordinate-aware internal logic

Clicking a tile should never bypass GameEngine validation.

# Default Player

Create one hero.

Name:

Aria

Class:

Arcane Ranger

Stats:

HP: 100 / 100
Mana: 60 / 60
Attack: 18
Defense: 5
Move Range: 3
Attack Range: 3

Suggested abilities:

Basic Attack
Arcane Shot
Dash
Heal
Barrier

# Player Abilities

## Basic Attack

Range:
3 tiles

Damage:
18

Mana:
0

## Arcane Shot

Range:
4

Damage:
30

Mana:
15

Cooldown:
2 turns

## Dash

Move up to:
4 tiles

Mana:
10

Cannot pass through walls.

## Heal

Restore:
30 HP

Mana:
20

Cooldown:
3 turns

## Barrier

Reduce next incoming damage by:
50%

Mana:
15

Duration:
until next enemy attack or end of next turn

Keep combat mechanics understandable.

# Turn System

Use a simple turn-based system.

Structure:

PLAYER TURN
↓
player performs action
↓
ENEMY TURN
↓
enemies automatically act
↓
PLAYER TURN

A player turn may allow:

* one movement
* one action

or use a simpler action-point system.

Recommended:

2 Action Points per player turn.

Movement:
1 AP

Attack:
1 AP

Skill:
1 AP

Pickup:
free if standing adjacent/on tile, or 1 AP if easier

End Turn:
ends remaining AP

Display:

Turn 4
PLAYER TURN
AP ● ●

Enemy turns should execute automatically after player AP reaches 0 or user chooses End Turn.

# Enemy AI

Implement simple deterministic enemy AI.

Enemies should:

* move toward the player if nearby
* attack if in range
* otherwise patrol or stay

Do not require external AI services.

Enemy behavior should be predictable enough that the AI agent can reason about it.

# Enemies

Include at least:

Goblin Scout
Skeleton Archer
Orc Guardian

## Goblin Scout

HP:
35

Attack:
10

Range:
1

Move:
2

Behavior:
aggressive melee

## Skeleton Archer

HP:
28

Attack:
12

Range:
3

Move:
1

Behavior:
maintain distance where practical

## Orc Guardian

HP:
60

Attack:
18

Range:
1

Move:
1

Behavior:
protect the Ancient Crystal

# Enemy Inspection

Enemy stats should NOT all be automatically revealed.

The human or AI should inspect an enemy to reveal tactical information.

This is important for WebMCP reasoning.

Example:

enemy_inspect({
"enemyId": "orc-1"
})

Returns:

{
"name": "Orc Guardian",
"hp": 60,
"attack": 18,
"attackRange": 1,
"moveRange": 1,
"behavior": "Guards the Ancient Crystal.",
"weakness": "Arcane attacks"
}

The AI can then decide how to fight.

# Fog of Information

Do not use heavy fog-of-war unless implementation remains reliable.

Instead, use "information fog":

Objects are visible, but detailed stats require inspection.

For example:

Goblin visible
but exact stats hidden until inspect.

This makes the WebMCP tools meaningful without making navigation brittle.

# Obstacles

Include:

* stone walls
* pillar
* rubble

These should:

* block movement
* optionally block ranged attacks if line-of-sight is implemented

Line-of-sight is optional.

If implemented, keep it deterministic.

# Trap

Include at least one visible or discoverable trap.

Example:

Spike Trap

Damage:
20

The trap may be revealed by:

map_inspect

or visually appear suspicious.

Agent should have the possibility of avoiding it.

# Items

Include:

Health Potion

Restores:
35 HP

Mana Potion

Restores:
25 Mana

Ancient Crystal

Mission objective

Optional:

Arcane Rune

Buff:
+10 attack for 3 turns

# Inventory

Show an inventory panel.

Inventory should support:

* pickup
* inspect
* use

Example:

Health Potion ×1
Mana Potion ×1
Ancient Crystal ×1

# Mission Rules

Default mission:

Collect the Ancient Crystal and reach the exit.

Victory requires:

Ancient Crystal in inventory
AND
hero reaches exit
AND
hero is alive

If hero reaches exit without crystal:

return:

"You cannot leave yet. The Ancient Crystal is still inside the dungeon."

# Defeat

If HP reaches 0:

Game Over

Show:

Defeated

Allow:

Restart Dungeon

WebMCP game state must report defeated=true.

# Shared Game State

Maintain a structured state such as:

{
turn,
phase,
actionPoints,
player,
enemies,
map,
items,
inventory,
objective,
objectiveCompleted,
exitUnlocked,
victory,
defeated,
selectedTile,
activityLog
}

GameEngine is the single source of truth.

# Application Architecture

Use clear separation of concerns.

Suggested architecture:

GameEngine
MapEngine
CombatEngine
EnemyAI
InventoryEngine
MissionEngine
GameRenderer
UIController
WebMCPAdapter
ActivityLogger

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

WebMCP tools must not click DOM elements.

They must call GameEngine methods directly.

# Human Controls

Humans should be able to:

* click hero
* inspect tiles
* click highlighted tiles to move
* click enemies to inspect
* attack enemies
* use skill buttons
* pick up items
* end turn
* restart game

Provide keyboard shortcuts optionally:

WASD / arrow keys for movement

1:
Basic Attack

2:
Arcane Shot

3:
Dash

4:
Heal

5:
Barrier

But keyboard control is secondary.

# UI Layout

Header:

WebMCP Mini Tactical Dungeon

Subtitle:

Play the dungeon through UI or AI tools.

Top right:

WebMCP ● Connected

or:

WebMCP ● Unsupported

Top status bar:

Turn 4
PLAYER TURN
HP 74/100
Mana 35/60
AP ● ○
Objective: Find the Ancient Crystal

Main desktop layout:

Left:
large tactical battlefield

Right:
character / interaction panel

Bottom:

* ability bar
* inventory
* Agent Activity
* WebMCP Tool Inspector
* AI Prompt Examples
* How WebMCP Works

# Character Panel

Show:

ARIA
Arcane Ranger

HP bar
Mana bar
Attack
Defense
Move Range
Attack Range

Current Status:

Normal
Barrier
Poisoned if implemented

# Selected Target Panel

When selecting enemy:

Skeleton Archer

HP 28 / 28

Range ?? before inspection

[ Inspect ]

After inspection:

Attack 12
Range 3
Move 1

[ Attack ]
[ Arcane Shot ]

# Movement Visualization

When hero is selected:

highlight valid movement tiles.

Use:

blue / cyan outlines or glow

Do not highlight blocked or invalid tiles.

When an enemy is targetable:

use:

red / orange highlight.

# Combat Animation

Keep animations fast and readable.

Examples:

player movement:
150–250ms

basic attack:
small projectile or slash

Arcane Shot:
glowing projectile

enemy damage:
brief shake

damage number:
-18

heal:
+30

Enemy defeated:
fade out

Avoid long animations that would slow Agent tool loops.

# WebMCP

Use:

document.modelContext

Use capability detection:

if ('modelContext' in document)

If unsupported:

* game remains completely playable
* show WebMCP Unsupported
* no crash

If supported:

show:

WebMCP Connected

Register tools after GameEngine initialization.

Use:

await document.modelContext.registerTool({...})

Avoid duplicate registrations.

Tool execution should resolve after the relevant state mutation and animations are complete where practical.

# WebMCP Tool Design

Use snake_case names.

Every tool should include:

* high-quality description
* explicit input schema
* validation
* structured output
* appropriate annotations

Do not expose low-level UI operations such as:

click_tile
press_button
click_skill_icon

Expose game capabilities instead:

player_move
player_attack
player_use_skill

# 1. game_get_state

Description:

Get the complete current tactical dungeon state including hero statistics, position, enemies, visible objects, inventory, turn number, phase, action points, objective progress, victory status, and defeat status.

Input:

{}

Annotations:

readOnlyHint: true
consequentialHint: false
untrustedContentHint: false

Return structured data.

Do not expose hidden implementation details that a player would not normally know.

# 2. game_get_objective

Description:

Get the current mission objective, completion requirements, and current progress.

Input:

{}

Return:

{
"objective": "Collect the Ancient Crystal and reach the exit.",
"hasCrystal": false,
"exitReached": false,
"completed": false
}

readOnlyHint: true

# 3. map_inspect

Description:

Inspect the tactical map to understand the hero position, visible enemies, items, hazards, obstacles, exit location, and currently reachable areas.

Input:

{}

Return structured tile information.

readOnlyHint: true

This should be one of the main observation tools for the AI agent.

# 4. tile_inspect

Input:

{
"x": 4,
"y": 3
}

Return:

* terrain
* occupant
* item
* hazard
* walkability
* relevant visible information

readOnlyHint: true

# 5. player_get_state

Description:

Get detailed current hero statistics including HP, mana, action points, position, status effects, cooldowns, and inventory summary.

Input:

{}

readOnlyHint: true

# 6. player_get_available_actions

Description:

Return the legal actions currently available to the hero based on current position, resources, cooldowns, action points, and game phase.

Input:

{}

Return things such as:

{
"canMove": true,
"reachableTiles": [...],
"attackableEnemies": [...],
"availableSkills": [...],
"pickupAvailable": true,
"canEndTurn": true
}

readOnlyHint: true

This tool is important so the agent does not need to guess legal actions.

# 7. player_move

Description:

Move the hero to a valid reachable tile during the player turn. This consumes movement action points and directly updates the shared game state.

Input:

{
"x": 3,
"y": 4
}

Validate:

* bounds
* walkable tile
* distance
* obstacles
* AP
* current phase

Return:

{
"success": true,
"from": {"x":2,"y":4},
"to": {"x":3,"y":4},
"remainingAP": 1
}

# 8. enemy_list

Description:

Return visible enemies with IDs, names, positions, current HP if known, and whether they have been fully inspected.

Input:

{}

readOnlyHint: true

# 9. enemy_inspect

Description:

Inspect an enemy to reveal tactical information such as health, attack, movement range, attack range, behavior, and known weakness.

Input:

{
"enemyId": "orc-1"
}

readOnlyHint: true

# 10. player_attack

Description:

Perform the hero's basic attack against a valid enemy target.

Input:

{
"enemyId": "goblin-1"
}

Validate:

* target alive
* attack range
* player phase
* AP

Return:

damage
remaining enemy HP
remaining AP

# 11. player_use_skill

Description:

Use one of the hero's tactical abilities against a valid target or location.

Input example:

{
"skill": "arcane_shot",
"enemyId": "orc-1"
}

or for dash:

{
"skill": "dash",
"x": 5,
"y": 4
}

or:

{
"skill": "heal"
}

Supported:

arcane_shot
dash
heal
barrier

Validate:

* mana
* cooldown
* target
* range
* current AP
* phase

# 12. player_get_skills

Description:

Return hero skills including effect, mana cost, cooldown, target type, range, and current availability.

Input:

{}

readOnlyHint: true

# 13. inventory_get

Description:

Return the player's current inventory including item IDs, names, quantities, and basic descriptions.

Input:

{}

readOnlyHint: true

# 14. item_inspect

Input:

{
"itemId": "health_potion"
}

readOnlyHint: true

# 15. player_pickup

Description:

Pick up an item currently available on the hero's tile or adjacent tile according to game rules.

Input:

{
"itemId": "health-potion-1"
}

The Ancient Crystal must also be collected through this tool.

# 16. player_use_item

Description:

Use a consumable item currently in inventory.

Input:

{
"itemId": "health_potion"
}

Return:

before
after
remaining quantity

# 17. game_end_turn

Description:

End the current player turn and allow all enemies to perform their deterministic enemy actions. Resolve the enemy phase completely before returning control to the player.

Input:

{}

The tool should resolve:

player turn end
↓
enemy actions
↓
damage
↓
enemy movement
↓
status effect updates
↓
cooldowns
↓
next player turn

Return a concise event summary.

# 18. game_get_recent_events

Description:

Return recent combat and dungeon events.

Input:

{
"limit": 10
}

readOnlyHint: true

Example:

Goblin moved to (3,4)

Skeleton Archer attacked Aria for 12

Aria collected Health Potion

Orc Guardian defeated

# 19. mission_get_progress

Description:

Return structured progress toward the mission objective and any current blocker preventing completion.

Input:

{}

readOnlyHint: true

Example:

{
"hasAncientCrystal": true,
"exitPosition": {"x":6,"y":6},
"canEscape": true,
"blockers": []
}

# 20. exit_try_leave

Description:

Attempt to leave the dungeon through the exit. Victory requires the hero to be on or adjacent to the exit according to game rules and to possess the Ancient Crystal.

Input:

{}

Return failure with reason if requirements are not met.

# 21. game_reset

Input:

{}

Restore the original dungeon.

# 22. game_get_available_options

Description:

Return valid IDs and enums such as skill names, known enemy IDs, currently visible item IDs, supported actions, and coordinate bounds so the AI does not need to guess tool values.

Input:

{}

readOnlyHint: true

# Tool Quality

Descriptions are extremely important.

Bad:

"Move player."

Good:

"Move the hero to a valid reachable dungeon tile during the current player turn. Use this after inspecting the map or available actions. The move must obey terrain, obstacle, movement range, and action-point constraints, and immediately updates the shared game state."

Agent tool choice should be understandable entirely from tool metadata.

# Agent Reasoning Scenarios

The game must support these types of natural-language requests.

## Scenario 1

"Collect the Ancient Crystal and escape without dying."

Expected behavior:

game_get_objective
↓
game_get_state
↓
map_inspect
↓
reason
↓
multiple tactical actions
↓
re-observe state after actions
↓
collect crystal
↓
reach exit

The AI should need multiple tool calls.

# Scenario 2

"What's the safest route to the crystal?"

Expected:

map_inspect
enemy_list
enemy_inspect if needed

The AI reasons over enemy positions and hazards.

# Scenario 3

"Kill the Orc Guardian."

Expected:

enemy_inspect
player_get_state
player_get_skills
reason
player_use_skill / move / attack

# Scenario 4

"I'm low on HP. Stay alive."

Expected:

player_get_state
inventory_get
possibly player_use_item or heal

# Scenario 5

"Get the treasure while avoiding the Skeleton Archer."

Expected:

map_inspect
enemy_inspect
movement reasoning

# Scenario 6

"Finish this turn optimally."

Expected:

game_get_state
player_get_available_actions
reason
action calls
game_end_turn if appropriate

# Scenario 7

"Can I escape yet?"

Expected:

mission_get_progress

# Agent Activity Panel

Create a highly visible panel:

Agent Activity

Entries include:

timestamp
source
tool/action
summary

Sources:

UI
WebMCP
System
Enemy

Examples:

17:12:04 WebMCP  map_inspect
17:12:08 WebMCP  enemy_inspect orc-1
17:12:13 WebMCP  player_move → (3,4)
17:12:18 WebMCP  player_use_skill arcane_shot → orc-1
17:12:19 System   Orc Guardian -30 HP
17:12:23 Enemy    Skeleton Archer attacked Aria -12 HP
17:12:31 WebMCP  player_pickup ancient-crystal
17:12:42 System   Objective completed

Keep approximately 50 entries.

This is extremely important for the live demo.

# Agent Action Highlighting

When WebMCP performs an action:

visually highlight:

* hero
* selected tile
* target enemy
* item
* relevant skill

For approximately:

500–900ms

Examples:

AI move:
destination tile pulses blue

AI attack:
enemy gets an orange highlight

AI pickup:
item briefly glows before entering inventory

Do not overdo animations.

# AI Thinking Indicator

Create a lightweight visual area titled:

Agent Decision Trail

Do NOT fabricate or display hidden chain-of-thought.

Only display observable tool activity and concise system-level action summaries.

Examples:

Observed battlefield

Inspected Orc Guardian

Moved toward cover

Used Arcane Shot

Collected Ancient Crystal

Do not generate internal reasoning text.

# Suggested AI Prompts

Create a panel titled:

Try asking your AI agent

Display:

"Collect the Ancient Crystal and escape without dying."

"Inspect the battlefield and tell me what the biggest threat is."

"Find the safest route to the crystal."

"Defeat the Orc Guardian."

"Get the potion before fighting the Orc."

"I'm low on health. Keep me alive."

"Avoid the Skeleton Archer and reach the exit."

"Use my turn efficiently."

"Can I escape yet?"

"Finish the dungeon."

# Agent Mission Panel

Add a prominent card:

AGENT MISSION

Collect the Ancient Crystal and reach the exit without dying.

Show live checklist:

[ ] Find Ancient Crystal
[ ] Collect Ancient Crystal
[ ] Survive
[ ] Reach Exit

When complete:

✓ Find Ancient Crystal
✓ Collect Ancient Crystal
✓ Survive
✓ Reach Exit

MISSION COMPLETE

# Tactical Signals

Create a derived panel:

Tactical Signals

Examples:

Orc Guardian protects the crystal

Skeleton Archer has line of attack

Health Potion is 3 tiles away

Hero HP below 40%

Arcane Shot ready

Exit unavailable: Crystal missing

These should derive from game state.

Do not use external AI.

# WebMCP Tool Inspector

Create:

WebMCP Tool Inspector

Show tools with:

name
READ / WRITE badge
short description

Example:

game_get_state                READ
map_inspect                   READ
enemy_inspect                 READ
player_get_available_actions  READ
player_move                   WRITE
player_attack                 WRITE
player_use_skill              WRITE
player_pickup                 WRITE
game_end_turn                 WRITE
exit_try_leave                WRITE

Add:

Refresh Tools

If:

document.modelContext.getTools

exists, use it where practical.

If not, show the locally registered tool list.

Do not crash.

# Traditional Browser Agent vs WebMCP

Include a compact comparison panel.

Traditional Browser Agent:

inspect DOM
↓
find hero
↓
find tile
↓
click tile
↓
wait for animation
↓
inspect DOM again
↓
find attack button
↓
click enemy

WebMCP Agent:

map_inspect()
↓
enemy_inspect("orc-1")
↓
player_move({x:3,y:4})
↓
player_use_skill({
skill:"arcane_shot",
enemyId:"orc-1"
})

Make this visual comparison easy to understand.

# Important Game Design Rule

DO NOT create a tool such as:

game_auto_win
game_solve
navigate_to_objective
kill_enemy_automatically
complete_mission

The AI agent must actually play the game.

The website exposes capabilities.

The AI provides reasoning.

This distinction is essential to the WebMCP demo.

# Another Important Rule

Do not expose perfect hidden-state information through game_get_state.

The Agent should receive information equivalent to what a human player could reasonably know.

For example:

Before inspection:

{
"enemyId": "orc-1",
"name": "Orc Guardian",
"position": {...},
"inspected": false
}

After enemy_inspect:

detailed combat stats become available.

This demonstrates meaningful observation tools.

# Turn Safety

Tool calls must respect game phases.

If the Agent tries:

player_move

during enemy phase:

return structured error.

If AP is zero:

return:

{
"success": false,
"error": "No action points remain. End the turn."
}

If skill cooldown active:

return:

{
"success": false,
"error": "Arcane Shot is on cooldown.",
"remainingTurns": 1
}

# Atomicity

Game actions should be atomic.

For example:

player_use_skill

should either:

* fully succeed
  or
* make no state change

Never consume mana if validation fails.

# Error Handling

Return structured errors.

Examples:

{
"success": false,
"error": "Target is outside attack range."
}

{
"success": false,
"error": "Tile (4,5) is blocked by a wall."
}

{
"success": false,
"error": "Health Potion is not in inventory."
}

{
"success": false,
"error": "The hero must collect the Ancient Crystal before leaving."
}

Do not silently fail.

# Game Animation Queue

Implement a lightweight action queue.

This is important because WebMCP may call actions rapidly.

Do not allow:

move animation
attack animation
enemy turn

to overlap incorrectly.

Tool execute() should wait for relevant action resolution before returning when appropriate.

# Human and AI Shared State

This is mandatory.

If the human:

moves Aria to (3,4)

then:

game_get_state()

must return:

position: (3,4)

If AI:

player_attack({
enemyId:"goblin-1"
})

then the enemy HP bar must immediately change visually.

There must NEVER be:

separate AI state
separate UI state

# Reset

Add:

Restart Dungeon

and WebMCP:

game_reset

Reset:

* hero
* enemies
* inventory
* map items
* objective
* cooldowns
* turn
* HP
* mana
* victory
* defeat

# Persistence

For a live demo, localStorage persistence is optional.

If implemented:

store current game progress.

Provide clear:

Restart Dungeon

Do not allow corrupted storage to break the game.

A fresh-load deterministic dungeon must always be possible.

# Victory Presentation

When the player succeeds:

show a polished overlay:

DUNGEON CLEARED

Ancient Crystal Recovered

Turns: 8
Enemies Defeated: 2
HP Remaining: 42

If completed by WebMCP actions, optionally show:

Completed with AI Agent

But only if the majority/final victory action actually originated through WebMCP.

Include:

Restart Dungeon

# Defeat Presentation

Show:

DEFEATED

The dungeon claimed another adventurer.

[ Restart ]

Do not make it overly dramatic.

# Responsive Design

Desktop:

battlefield left
tactical sidebar right

Tablet:

battlefield top
panels below

Mobile:

board should scale while remaining readable

Use touch-friendly buttons.

Avoid page-wide accidental horizontal overflow.

# Accessibility

Include:

* semantic buttons
* aria-labels
* keyboard focus states
* readable health values
* high-contrast status indicators
* prefers-reduced-motion support
* do not rely exclusively on color for enemy / item states

# Self Tests

Run non-destructive console self-tests using isolated GameEngine instances.

Test:

map bounds

blocked tile rejection

valid movement

AP consumption

attack range

damage

enemy defeat

skill mana consumption

skill cooldown

healing

inventory pickup

item use

enemy AI

turn transition

objective completion

exit blocked without crystal

victory with crystal

game over

reset

If a test fails:

console.error(...)

Never modify live game state.

# Suggested JavaScript Sections

Organize the single HTML clearly:

CONFIG
MAP DEFINITION
PLAYER DATA
ENEMY DATA
ITEM DATA
UTILITIES
GAME ENGINE
MAP ENGINE
COMBAT ENGINE
SKILL ENGINE
INVENTORY ENGINE
ENEMY AI
MISSION ENGINE
ACTION QUEUE
GAME RENDERER
GRID INTERACTIONS
UI CONTROLLER
ACTIVITY LOGGER
WEBMCP ADAPTER
SELF TESTS
INITIALIZATION

Use English for:

* function names
* variable names
* class names
* comments

# Acceptance Tests

TEST 1

Open page.

8×8 dungeon renders.

Hero, enemies, crystal, potion, walls, trap, and exit are visible.

PASS.

TEST 2

Click hero.

Valid movement range is highlighted.

PASS.

TEST 3

Move hero to a valid tile.

Hero moves and AP decreases.

PASS.

TEST 4

Attempt movement through wall.

Rejected.

PASS.

TEST 5

Call:

map_inspect()

Returns correct map representation.

PASS.

TEST 6

Call:

enemy_inspect({
"enemyId":"orc-1"
})

Detailed stats are revealed.

PASS.

TEST 7

Call:

player_get_available_actions()

Returns legal movement, attacks, and skills.

PASS.

TEST 8

Call:

player_move({
"x":3,
"y":4
})

Hero visually moves to that tile.

PASS.

TEST 9

Call:

player_attack({
"enemyId":"goblin-1"
})

Enemy HP changes.

PASS.

TEST 10

Use Arcane Shot.

Mana decreases and cooldown starts.

PASS.

TEST 11

Call:

game_end_turn()

Enemies move or attack.

New player turn begins.

PASS.

TEST 12

Player collects Health Potion.

Inventory updates.

PASS.

TEST 13

Use Health Potion while damaged.

HP increases.

PASS.

TEST 14

Reach Ancient Crystal.

Call player_pickup.

Objective progress updates.

PASS.

TEST 15

Try exit without crystal.

Rejected.

PASS.

TEST 16

Reach exit with crystal.

Call exit_try_leave().

Victory triggered.

PASS.

TEST 17

Human performs an action.

game_get_state reflects the change.

PASS.

TEST 18

WebMCP performs an action.

Visible UI reflects the change.

PASS.

TEST 19

WebMCP unavailable.

Human can still complete the dungeon.

PASS.

TEST 20

Restart Dungeon.

Entire game returns to deterministic initial state.

PASS.

# How WebMCP Powers This Game

Add a bottom section:

How WebMCP powers this dungeon

Explain:

1. The game exposes structured tactical capabilities.
2. The AI agent discovers those capabilities.
3. The agent observes the battlefield.
4. The agent reasons about enemies, resources, and objectives.
5. The agent chooses an action.
6. GameEngine validates and executes it.
7. The battlefield immediately reflects the same shared state.
8. The agent observes again and continues.

Show architecture:

Natural Language
↓
AI Agent
↓
Observe / Reason / Act
↓
WebMCP Tools
↓
GameEngine
↓
Shared Game State
↓
Tactical Dungeon UI

Human Player
↓
Grid + Ability Controls
↓
GameEngine

# Key Message

Visually communicate:

WebMCP does NOT make the AI "press game buttons."

WebMCP gives the AI structured access to game capabilities.

The AI still has to:

* observe
* understand
* plan
* choose
* act
* adapt

# Final Instruction

Directly build the complete index.html.

Do not give implementation advice first.

Do not return pseudocode.

Do not leave TODO markers.

Do not create fake MCP infrastructure.

Do not require a backend.

Do not simplify the project into a static grid with buttons.

Do not create an auto-solve tool.

The final result must feel like a small, polished, genuinely playable tactical game and a premium WebMCP technical showcase.

Within seconds, the viewer should understand:

"Instead of teaching an AI agent how to click around a game UI, WebMCP lets the game expose move, inspect, attack, skill, inventory, and mission capabilities directly."

The strongest live demo should be:

User:

"Collect the Ancient Crystal and escape without dying."

Then the AI agent repeatedly performs:

game_get_state()
↓
map_inspect()
↓
enemy_inspect(...)
↓
player_get_available_actions()
↓
player_move(...)
↓
player_attack(...) or player_use_skill(...)
↓
game_end_turn()
↓
observe again
↓
adapt strategy
↓
collect Ancient Crystal
↓
reach exit
↓
exit_try_leave()

The AI must genuinely play the dungeon through multiple observation and action cycles.

Make that Agent loop visually obvious through the battlefield, animations, mission progress, and Agent Activity panel.

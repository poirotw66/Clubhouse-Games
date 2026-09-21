You are a senior Frontend Engineer, simulation game systems designer, AI Agent interaction designer, Web API engineer, and industrial automation UX designer.

Build a complete, polished, fully runnable single-page HTML demo called:

WebMCP Mini Factory

Do not give me a plan, architecture proposal, pseudocode, implementation notes, or partial snippets.

Directly implement the complete application.

The final result should demonstrate how a human player and an AI agent can both build, inspect, debug, and optimize the exact same miniature factory through a shared application capability layer using WebMCP.

# Core Goal

Create a small automation / factory simulation game.

The player starts with a partially working factory and must improve production throughput.

A human should be able to:

* inspect machines
* build machines
* delete machines
* connect conveyors
* configure recipes
* inspect resource flow
* inspect throughput
* identify bottlenecks
* upgrade machines
* start / stop machines
* optimize the factory

An AI agent should be able to perform the same actions through structured WebMCP tools.

Both human UI actions and WebMCP actions must operate on exactly the same shared factory state.

The key technical concept is:

"The AI agent is not dragging factory blocks or clicking UI controls. The simulation exposes structured factory capabilities directly through WebMCP."

Example:

Human:
clicks Build Smelter and places it on the grid

AI:

machine_build({
"type": "smelter",
"x": 5,
"y": 3
})

Both paths must call the same underlying FactoryEngine.

# Strongest Demo Mission

The default mission should be:

"Increase gear production to at least 10 gears per minute."

The initial factory should intentionally have one or more bottlenecks.

For example:

Iron Mine
↓
Conveyor
↓
Smelter
↓
Iron Plate
↓
Assembler
↓
Gear

Initial throughput:

4 gears/min

Target:

10 gears/min

The AI should need to:

1. inspect factory state
2. inspect production metrics
3. identify bottlenecks
4. decide what to modify
5. build / upgrade / reconnect
6. re-check throughput
7. continue optimizing until target is reached

The expected WebMCP agent loop should resemble:

factory_get_state()
↓
factory_get_throughput()
↓
factory_get_bottlenecks()
↓
machine_inspect(...)
↓
machine_build(...)
↓
machine_set_recipe(...)
↓
conveyor_connect(...)
↓
factory_get_throughput()
↓
adapt
↓
mission complete

The AI must genuinely optimize the simulation.

Do NOT provide an auto-optimize or solve-factory tool.

# Final Deliverable

Create:

index.html

Prefer one self-contained HTML file containing:

* HTML
* CSS
* JavaScript
* factory data
* simulation logic
* rendering logic

Use:

* Vanilla HTML
* Vanilla CSS
* Vanilla JavaScript

Do not use:

* React
* Vue
* Angular
* npm
* build tools
* backend
* database
* external MCP server
* SSE
* WebSocket
* remote simulation services

The application must run directly in the browser.

# Optional Visual Assets

For anything that needs bitmaps/textures/sprites (or if it helps to have a mockup reference for any 3d models you build) feel free to use imagegen.

This may include:

* machine sprites
* conveyor textures
* ore icons
* ingot icons
* gear icons
* smoke or steam sprites
* warning icons
* power icons
* factory floor textures
* mining drills
* furnaces
* assemblers
* storage crates

However:

* the final application must remain fully interactive
* generated assets are optional support only
* do not replace the game with a static image
* factory state must be programmatically controlled
* prioritize simulation clarity and readability

# Visual Style

Create a polished miniature industrial automation game.

Style direction:

* Factorio-inspired readability
* miniature factory board
* clean industrial sci-fi
* modern dark UI
* subtle orange / cyan / green status accents
* premium technical-demo feel
* compact machinery
* animated conveyors
* clean data panels
* restrained particle effects

Do not copy any commercial game's assets or exact UI.

The factory board should be the visual centerpiece.

# Factory Grid

Use a:

10 × 8 grid

or similar compact grid.

Coordinates should be programmatically addressable.

Example:

x: 0–9
y: 0–7

Tiles may contain:

* floor
* resource node
* machine
* conveyor
* storage
* empty tile

Do not render literal grid letters.

Render a visually attractive factory floor.

# Resource Types

Use a small understandable production chain.

Raw resources:

iron_ore
copper_ore

Intermediate resources:

iron_plate
copper_plate

Final resources:

gear
circuit

The primary mission only needs gear production.

Optional secondary chain:

Copper Mine
↓
Smelter
↓
Copper Plate
↓
Assembler
↓
Circuit

This provides extra visual richness without making the main mission too complex.

# Production Recipes

Implement deterministic recipes.

Example:

Smelter:

1 iron_ore
→
1 iron_plate

Cycle:
2 seconds

Assembler Gear:

2 iron_plate
→
1 gear

Cycle:
3 seconds

Assembler Circuit:

1 iron_plate
+
2 copper_plate
→
1 circuit

Cycle:
4 seconds

Keep rates simple and understandable.

# Machine Types

Implement at least:

Miner
Smelter
Assembler
Storage
Splitter

Optional:

Power Generator

Conveyors should be separate connectable entities.

# Miner

Consumes no input.

Produces raw resource from a resource node.

Example:

Iron Miner

Output:
1 iron_ore every 1.5 seconds

# Smelter

Consumes:

iron_ore or copper_ore

Produces:

iron_plate or copper_plate

Requires recipe configuration.

# Assembler

Can be configured to produce:

gear
circuit

Requires recipe selection.

# Storage

Stores items temporarily.

Show:

current contents
capacity
input rate
output rate

# Splitter

Accept one input and split resources between two outputs.

Optional but useful for agent reasoning.

# Machine Data Model

Each machine should contain:

{
id,
type,
x,
y,
online,
level,
recipe,
inputBuffer,
outputBuffer,
capacity,
productionRate,
efficiency,
status,
connections
}

Example:

{
"id": "smelter-1",
"type": "smelter",
"x": 4,
"y": 3,
"online": true,
"level": 1,
"recipe": "iron_plate",
"inputBuffer": {
"iron_ore": 4
},
"outputBuffer": {
"iron_plate": 1
},
"status": "working"
}

# Machine Status

Machines should visually display:

WORKING
STARVED
BLOCKED
OFFLINE
IDLE

Example:

STARVED:
no input material

BLOCKED:
output buffer full

WORKING:
actively producing

OFFLINE:
manually disabled

These states are important for bottleneck analysis.

# Conveyor System

Conveyors connect adjacent grid cells.

Conveyor pieces should visibly animate moving resource icons.

Resources should visibly travel between machines.

Human users should be able to:

* select conveyor tool
* click source
* click destination

or draw simple adjacent paths.

For one-shot reliability, it is acceptable to support direct straight or Manhattan paths automatically.

Example:

connect:

machine A
→
machine B

The app can automatically generate a valid Manhattan conveyor path when possible.

Do not create diagonal conveyors.

# Conveyor Flow

Conveyors should have throughput limits.

Example:

Basic conveyor:
6 items/min

Upgraded conveyor:
12 items/min

This allows conveyor capacity to become a bottleneck.

# Initial Factory

Create an intentionally inefficient but functional starting factory.

Example:

iron-mine-1
↓
conveyor
↓
smelter-1
↓
slow conveyor
↓
assembler-1

assembler-1 recipe:

gear

Initial result:

approximately 4 gears/min

Target:

10 gears/min

Potential bottlenecks may include:

* smelter production rate
* conveyor throughput
* assembler rate
* insufficient ore supply
* blocked output

Design the initial state so there are at least two reasonable optimization approaches.

For example:

Approach A:
upgrade smelter and assembler

Approach B:
add second smelter and second assembler

The Agent should reason about tradeoffs rather than follow one hard-coded solution.

# Factory Simulation

Implement a deterministic simulation tick.

Suggested:

250ms or 500ms simulation tick

Machines process based on elapsed time.

Do not rely on frame-rate-dependent logic.

Simulation should update:

* input buffers
* production progress
* output buffers
* conveyor transfers
* throughput statistics
* machine statuses

# Pause / Play

Include:

[ Pause ]
[ Play ]
[ 1× ]
[ 2× ]
[ 4× ]

Human users can speed up the simulation.

WebMCP should also be able to control simulation speed if useful.

# Throughput Metrics

Track rolling production rate.

Display:

Gears/min
Iron Plates/min
Iron Ore/min
Circuits/min

Use a rolling measurement window.

Example:

Current Gear Throughput

4.2 / min

Target

10.0 / min

# Mission Progress

Add a prominent panel:

FACTORY MISSION

Produce at least:

10 gears / minute

Current:

4.2 gears / minute

Progress bar:

████░░░░░░ 42%

Mission complete only after sustained throughput exceeds 10 gears/min for a short measurement window, for example 5–10 seconds.

This avoids one-time output spikes falsely completing the mission.

# Machine Inspection

Clicking a machine should show:

ID
Type
Status
Level
Recipe
Input Buffer
Output Buffer
Production Rate
Efficiency
Connected Inputs
Connected Outputs

Example:

SMELTER-1

Status: STARVED

Recipe:
Iron Plate

Input:
0 Iron Ore

Output:
2 Iron Plates

Cycle Time:
2.0 sec

Efficiency:
43%

# Factory Signals

Create a derived panel:

Factory Signals

Examples:

Smelter-1 is starved for Iron Ore

Assembler-1 is operating at 52%

Conveyor-4 is at 100% capacity

Iron production exceeds smelting capacity

Storage-1 is nearly full

Gear throughput is 5.8/min below target

These signals must derive from actual simulation state.

Do not use external AI.

# Bottleneck Engine

Implement deterministic bottleneck analysis.

Possible bottleneck types:

INPUT_STARVATION
OUTPUT_BLOCKED
MACHINE_CAPACITY
CONVEYOR_CAPACITY
INSUFFICIENT_PRODUCTION
UNCONNECTED_MACHINE

A bottleneck object might look like:

{
"type": "MACHINE_CAPACITY",
"machineId": "smelter-1",
"severity": "high",
"message": "Smelter-1 cannot produce enough iron plates to satisfy assembler demand.",
"observedRate": 6,
"requiredRate": 12
}

This is important because WebMCP can expose structured diagnostic information.

# Upgrades

Support machine upgrades.

Each machine may have:

Level 1
Level 2
Level 3

Example multiplier:

Level 1:
1.0×

Level 2:
1.5×

Level 3:
2.0×

Upgrading costs simulated credits.

No real currency.

Conveyor upgrades should also be supported.

# Credits

Start with enough simulated credits to solve the mission.

Example:

Credits: 1000

Costs:

Miner:
200

Smelter:
180

Assembler:
250

Storage:
100

Conveyor tile:
15

Machine Upgrade:
150 / 250

Keep economy simple.

# Build Toolbar

Create a toolbar with:

Miner
Smelter
Assembler
Storage
Conveyor
Delete
Inspect

Show cost.

# Human Interactions

Human players should be able to:

* select build tool
* place machines
* connect machines
* configure recipes
* inspect machines
* upgrade
* enable / disable
* delete
* pause
* change simulation speed

All actions must go through FactoryEngine.

# Shared State Architecture

Use:

FactoryEngine
SimulationEngine
FlowEngine
ProductionEngine
BottleneckAnalyzer
FactoryRenderer
UIController
WebMCPAdapter
ActivityLogger
UndoManager

FactoryEngine must be the single source of truth.

Data flow:

Human UI
↓
FactoryEngine
↓
Shared Factory State
↓
Renderer

AI Agent
↓
WebMCP Tools
↓
FactoryEngine
↓
Shared Factory State
↓
Renderer

Never maintain separate AI and UI state.

# WebMCP

Use:

document.modelContext

Use capability detection:

if ('modelContext' in document)

If unsupported:

* factory simulation remains completely playable
* show:
  WebMCP Unsupported
* no crash

If supported:

show:

WebMCP Connected

Register tools after FactoryEngine initialization.

Use:

await document.modelContext.registerTool({...})

Avoid duplicate registrations.

WebMCP tools must NEVER:

* click DOM buttons
* simulate mouse movement
* manipulate visual elements directly

They must call FactoryEngine methods.

# WebMCP Tools

Use snake_case names.

Every tool must include:

* high-quality description
* input schema
* validation
* predictable structured output
* annotations where appropriate

Implement at minimum:

# 1. factory_get_state

Description:

Get the current factory simulation state including machines, conveyors, resource flow, credits, recipes, mission progress, production metrics, machine statuses, and simulation speed.

Input:

{}

Annotations:

readOnlyHint: true
consequentialHint: false
untrustedContentHint: false

Do not return unnecessary visual DOM details.

# 2. factory_get_summary

Description:

Return a concise structured summary of factory health, current production rates, active bottlenecks, resource shortages, blocked machines, credits, and mission progress.

Input:

{}

readOnlyHint: true

Useful when the user asks:

"How is my factory doing?"

# 3. factory_get_throughput

Description:

Return rolling production and consumption rates for all major resources.

Input:

{}

Return example:

{
"iron_ore_per_min": 18,
"iron_plate_per_min": 8,
"gear_per_min": 4.2,
"gear_target_per_min": 10
}

readOnlyHint: true

# 4. factory_get_bottlenecks

Description:

Analyze the current factory and return structured bottlenecks such as starved machines, blocked outputs, insufficient machine capacity, saturated conveyors, or disconnected production stages.

Input:

{}

readOnlyHint: true

This should be one of the primary observation tools for AI optimization.

# 5. machine_list

Description:

Return all machines with IDs, types, positions, recipe, status, level, and summarized input/output state.

Input:

{}

readOnlyHint: true

# 6. machine_inspect

Input:

{
"machineId": "smelter-1"
}

Return detailed metrics.

readOnlyHint: true

# 7. machine_build

Description:

Build a new machine at a valid empty factory tile. This spends simulated credits and updates the shared factory state.

Input example:

{
"type": "smelter",
"x": 5,
"y": 3
}

Valid types:

miner
smelter
assembler
storage
splitter

Validate:

* tile bounds
* occupancy
* resource node requirements for miner
* credits
* machine type

# 8. machine_delete

Input:

{
"machineId": "smelter-2"
}

Refund a reasonable percentage of cost.

Also remove invalid connections.

# 9. machine_set_recipe

Description:

Set the production recipe for a compatible machine.

Input:

{
"machineId": "assembler-1",
"recipe": "gear"
}

Valid recipes should depend on machine type.

Return structured error if incompatible.

# 10. machine_set_power

Input:

{
"machineId": "smelter-1",
"enabled": true
}

# 11. machine_upgrade

Description:

Upgrade a machine to improve its production capacity or efficiency. Use this after inspecting bottlenecks when increasing capacity may improve throughput.

Input:

{
"machineId": "smelter-1"
}

Validate:

* machine exists
* max level
* credits

# 12. conveyor_connect

Description:

Connect two machines using a valid conveyor path. The simulation may automatically generate a Manhattan path when one is available.

Input:

{
"fromMachineId": "miner-1",
"toMachineId": "smelter-2"
}

Return:

{
"success": true,
"conveyorId": "conveyor-8",
"path": [...]
}

Validate:

* both machines exist
* source/output compatibility
* no impossible path
* credits

# 13. conveyor_list

Input:

{}

Return:

* IDs
* source
* destination
* throughput
* utilization
* level

readOnlyHint: true

# 14. conveyor_inspect

Input:

{
"conveyorId": "conveyor-3"
}

Return:

capacity
current flow
utilization
transported resource
source
destination

readOnlyHint: true

# 15. conveyor_upgrade

Input:

{
"conveyorId": "conveyor-3"
}

Increase throughput capacity.

# 16. conveyor_disconnect

Input:

{
"conveyorId": "conveyor-3"
}

# 17. factory_get_recipes

Description:

Return available recipes including ingredients, outputs, cycle times, and compatible machine types.

Input:

{}

readOnlyHint: true

# 18. factory_get_available_builds

Description:

Return valid machine types, costs, upgrade costs, coordinate bounds, resource-node locations, recipes, and current credits.

Input:

{}

readOnlyHint: true

This prevents the agent from guessing valid build options.

# 19. factory_get_resource_flow

Description:

Return structured information showing how resources currently flow between machines.

Input:

{}

Return relationships such as:

miner-1
→ conveyor-1
→ smelter-1
→ conveyor-2
→ assembler-1

Include resource type and measured flow rate.

readOnlyHint: true

# 20. factory_get_machine_efficiency

Input:

{}

Return efficiency / utilization for all machines.

Example:

smelter-1: 100%
assembler-1: 54%
miner-1: 92%

readOnlyHint: true

# 21. factory_get_credits

Input:

{}

readOnlyHint: true

# 22. simulation_set_speed

Input:

{
"speed": 2
}

Valid:

0
1
2
4

0 means paused.

# 23. factory_batch_build

Optional but strongly recommended.

Input example:

{
"machines": [
{
"type": "smelter",
"x": 5,
"y": 2
},
{
"type": "assembler",
"x": 7,
"y": 2
}
]
}

Validate all builds before applying.

Atomic operation.

# 24. factory_batch_upgrade

Input:

{
"machineIds": [
"smelter-1",
"assembler-1"
]
}

Validate credits first.

Do not partially upgrade.

# 25. factory_get_mission

Description:

Return mission target, current throughput, sustained completion state, and remaining gap.

Input:

{}

readOnlyHint: true

# 26. factory_undo

Input:

{}

Undo one logical player/agent mutation.

Do not undo simulation ticks.

# 27. factory_reset

Input:

{}

Restore the deterministic initial factory.

# Tool Description Quality

Tool descriptions are extremely important.

Bad:

"Build machine."

Good:

"Build a new factory machine on a valid empty tile. Use this when increasing production capacity or adding a missing production stage. The action spends simulated credits and updates the shared factory simulation immediately."

The agent should understand the factory capability model entirely through tool metadata.

# Critical Agent Design Rule

Do NOT expose:

factory_auto_optimize
factory_solve
factory_reach_target
build_best_factory
fix_all_bottlenecks

These tools defeat the purpose of the demo.

The website provides:

state
metrics
diagnostics
capabilities

The AI agent provides:

reasoning
planning
optimization decisions

# Agent Reasoning Scenarios

The app must support natural-language missions like:

## Scenario 1

"Increase gear production to at least 10 gears per minute."

Expected behavior:

factory_get_state
↓
factory_get_throughput
↓
factory_get_bottlenecks
↓
machine_inspect
↓
reason
↓
machine_upgrade / machine_build
↓
conveyor_connect
↓
factory_get_throughput
↓
repeat until target

# Scenario 2

"Why is gear production so slow?"

Expected:

factory_get_throughput
factory_get_bottlenecks
machine_inspect
conveyor_inspect

# Scenario 3

"The assembler keeps running out of iron plates. Fix it."

Expected:

inspect assembler
inspect upstream resource flow
reason about smelting capacity
upgrade or add smelter
connect resources

# Scenario 4

"Improve throughput using less than 400 credits."

Expected:

factory_get_credits
factory_get_bottlenecks
factory_get_available_builds
reason about cheapest improvement
perform selected actions

# Scenario 5

"Which machine should I upgrade first?"

Expected:

factory_get_bottlenecks
factory_get_machine_efficiency
machine_inspect

Then explain recommendation.

# Scenario 6

"Double gear production without deleting anything."

Expected:

read current state
plan upgrades / additional machines
avoid delete operations

# Scenario 7

"Build a second gear production line."

Expected:

factory_get_available_builds
factory_get_recipes
machine_build
machine_set_recipe
conveyor_connect

# Scenario 8

"Get the factory above 10 gears/min while spending as little as possible."

This should be the strongest optimization challenge.

The agent must compare:

* upgrades
* new machines
* conveyor capacity

# Suggested AI Prompts

Create a panel titled:

Try asking your AI agent

Show:

"Increase gear production to at least 10 gears per minute."

"Why is gear production so slow?"

"Find the biggest bottleneck in the factory."

"Fix the assembler's material shortage."

"Which machine should I upgrade first?"

"Increase production using less than 400 credits."

"Build a second smelting line."

"Double gear production without deleting anything."

"Optimize the factory while spending as little as possible."

"Are any conveyors operating at full capacity?"

"Which machines are currently idle or starved?"

"Can this factory reach 10 gears/min with the credits we have?"

# Agent Mission Panel

Add a prominent panel:

AGENT MISSION

TARGET
10 gears/min

CURRENT
4.2 gears/min

CREDITS
1000

Show live checklist:

[✓] Factory running
[ ] Identify bottleneck
[ ] Improve iron plate supply
[ ] Increase gear throughput
[ ] Reach 10 gears/min

When the sustained target is met:

FACTORY OPTIMIZED

10.4 gears/min

MISSION COMPLETE

# Agent Activity

Create a prominent:

Agent Activity

panel.

Sources:

UI
WebMCP
System
Factory

Examples:

18:22:03 WebMCP   factory_get_throughput
18:22:08 WebMCP   factory_get_bottlenecks
18:22:12 WebMCP   machine_inspect smelter-1
18:22:19 WebMCP   machine_upgrade smelter-1
18:22:25 System   Smelter-1 upgraded to Level 2
18:22:31 Factory  Gear throughput increased to 6.8/min
18:22:38 WebMCP   machine_build smelter at (5,3)
18:22:45 WebMCP   conveyor_connect miner-1 → smelter-2
18:22:58 Factory  Gear throughput reached 10.3/min
18:23:04 System   Mission completed

Keep approximately 50 entries.

# Agent Decision Trail

Add a lightweight UI area titled:

Agent Decision Trail

Do NOT expose or fabricate hidden chain-of-thought.

Only show observable structured summaries such as:

Checked factory throughput

Detected smelting bottleneck

Upgraded Smelter-1

Added second smelter

Rechecked production

Target reached

Do not display private internal reasoning.

# AI Action Highlighting

When WebMCP changes something:

* highlight affected machine
* highlight new conveyor
* briefly animate upgrade
* flash changed throughput metric

For approximately:

500–1000ms

Do not overanimate.

# Factory Animation

Make the simulation visually satisfying.

Examples:

Miner:
small drill animation

Conveyor:
resource icons visibly move

Smelter:
orange glow when working

Assembler:
mechanical pulse

Blocked machine:
small warning icon

Starved machine:
yellow indicator

Upgraded machine:
slightly enhanced appearance

Keep animations lightweight.

# Production Graph

Add a small live chart or sparkline for:

Gear Throughput

Last 30–60 seconds.

Do not require chart libraries.

Use Canvas or SVG.

Also optionally show:

Iron Plate Production

The graph should clearly rise when the Agent improves the factory.

This makes the optimization visually compelling.

# Bottleneck Visualization

When a bottleneck is detected:

visually mark related machines / conveyors.

Example:

SMELTER-1
⚠ CAPACITY BOTTLENECK

Conveyor:
⚠ 100% UTILIZATION

Use subtle warning outlines.

# WebMCP Tool Inspector

Create:

WebMCP Tool Inspector

Show:

tool
READ / WRITE badge
short description

Examples:

factory_get_state           READ
factory_get_throughput      READ
factory_get_bottlenecks     READ
machine_inspect             READ
machine_build               WRITE
machine_upgrade             WRITE
machine_set_recipe          WRITE
conveyor_connect            WRITE
simulation_set_speed        WRITE

Include:

Refresh Tools

If:

document.modelContext.getTools

exists, use it where practical.

Otherwise show locally known tools.

Do not crash.

# Traditional Browser Agent vs WebMCP

Add a compact comparison card.

Traditional Browser Agent:

inspect DOM
↓
find machine
↓
click machine
↓
open upgrade menu
↓
click upgrade
↓
find conveyor tool
↓
drag path
↓
inspect production UI

WebMCP Agent:

factory_get_bottlenecks()
↓
machine_upgrade({
machineId: "smelter-1"
})
↓
factory_get_throughput()

Make this distinction visually obvious.

# Important WebMCP Message

The game should communicate:

WebMCP does NOT automate mouse interaction.

It exposes meaningful factory capabilities.

The AI still needs to:

* observe
* diagnose
* plan
* change configuration
* measure results
* adapt

# Shared State Requirement

Mandatory:

If human upgrades Smelter-1:

machine_inspect({
machineId: "smelter-1"
})

must return the upgraded level.

If AI builds Smelter-2:

the machine must immediately appear on the factory grid.

If simulation produces gears:

factory_get_throughput()

must use the same simulation data shown in the UI.

There must never be separate AI and UI simulation state.

# Atomic Operations

Build and batch operations must validate first.

For example:

If a batch build contains one occupied tile:

reject the full batch.

Do not spend partial credits.

Do not partially build.

# Validation

Validate:

* coordinates
* occupied tiles
* machine IDs
* conveyor IDs
* resource nodes
* machine types
* recipes
* recipe compatibility
* credits
* max machine levels
* conveyor connections
* simulation speed

# Error Handling

Return structured errors.

Examples:

{
"success": false,
"error": "Tile (5,3) is already occupied."
}

{
"success": false,
"error": "Insufficient credits.",
"required": 250,
"available": 180
}

{
"success": false,
"error": "Recipe 'gear' is not supported by smelters."
}

{
"success": false,
"error": "No valid conveyor path exists between these machines."
}

Do not silently fail.

# Persistence

Use localStorage for:

* factory layout
* machine levels
* recipes
* connections
* credits

Simulation production counters may be recomputed.

Provide:

Reset Factory

Validate saved data.

If corrupted:

restore deterministic initial factory.

# Undo

Support undo for logical construction operations:

* build
* delete
* upgrade
* recipe change
* conveyor connection
* power toggle

Do NOT undo:

simulation ticks
individual item movement
production events

One undo should revert one meaningful configuration change.

# Responsive Design

Desktop:

factory grid left
metrics / inspector right

Bottom:

Agent Activity
throughput graph
tool inspector

Tablet:

factory above
panels below

Mobile:

responsive compact factory grid
scrollable panels
touch-friendly build toolbar

No accidental horizontal overflow.

# Accessibility

Include:

* aria labels
* visible focus
* semantic controls
* readable machine statuses
* non-color-only warnings
* reduced motion support
* accessible tooltips

# Self Tests

Run non-destructive console self-tests using isolated FactoryEngine instances.

Test:

machine build

occupied tile rejection

credit deduction

machine delete

recipe compatibility

machine upgrade

conveyor connection

resource transfer

production cycle

starvation detection

blocked detection

bottleneck analysis

throughput calculation

batch atomicity

undo

reset

If a test fails:

console.error(...)

Never modify live factory state.

# Suggested JavaScript Sections

Organize clearly:

CONFIG
GRID DATA
RESOURCE DATA
RECIPES
MACHINE DEFINITIONS
INITIAL FACTORY
UTILITIES
FACTORY ENGINE
SIMULATION ENGINE
PRODUCTION ENGINE
FLOW ENGINE
BOTTLENECK ANALYZER
MISSION ENGINE
UNDO MANAGER
FACTORY RENDERER
GRID INTERACTION
BUILD TOOLBAR
INSPECTOR PANEL
METRICS
ACTIVITY LOGGER
WEBMCP ADAPTER
PERSISTENCE
SELF TESTS
INITIALIZATION

Use English for:

* class names
* variable names
* function names
* code comments

# Acceptance Tests

TEST 1

Open page.

Factory renders and simulation runs.

PASS.

TEST 2

Resources visibly move through the initial production line.

PASS.

TEST 3

Gears are produced.

PASS.

TEST 4

factory_get_throughput()

returns values matching the visible dashboard.

PASS.

TEST 5

factory_get_bottlenecks()

returns at least one meaningful initial bottleneck.

PASS.

TEST 6

machine_inspect("smelter-1")

returns correct machine state.

PASS.

TEST 7

Human upgrades Smelter-1.

WebMCP inspection reflects the upgrade.

PASS.

TEST 8

Call:

machine_build({
"type":"smelter",
"x":5,
"y":3
})

New machine visibly appears.

PASS.

TEST 9

Set a valid recipe.

Machine becomes operational once supplied.

PASS.

TEST 10

Call:

conveyor_connect({
"fromMachineId":"miner-1",
"toMachineId":"smelter-2"
})

A visible connection appears and resources begin to flow.

PASS.

TEST 11

Attempt invalid build on occupied tile.

Rejected without spending credits.

PASS.

TEST 12

Upgrade production bottlenecks.

Gear throughput increases.

PASS.

TEST 13

Reach sustained:

> = 10 gears/min

Mission becomes complete.

PASS.

TEST 14

Human changes factory state.

factory_get_state reflects it.

PASS.

TEST 15

WebMCP changes factory state.

UI reflects it immediately.

PASS.

TEST 16

WebMCP unsupported environment.

Factory remains fully playable.

PASS.

TEST 17

Reset Factory.

Original deterministic factory returns.

PASS.

# How WebMCP Powers This Factory

Add a section:

How WebMCP powers this factory

Explain:

1. The factory exposes structured simulation capabilities.
2. The AI agent observes production metrics.
3. The agent identifies bottlenecks.
4. The agent decides how to improve capacity.
5. It invokes build, upgrade, recipe, or conveyor tools.
6. FactoryEngine updates the shared simulation.
7. Production changes in real time.
8. The Agent measures results and adapts.

Show this architecture:

Natural Language
↓
AI Agent
↓
Observe → Diagnose → Plan → Act
↓
WebMCP Tools
↓
FactoryEngine
↓
Shared Simulation State
↓
Production + Factory UI
↑
│
Human Controls

# Final Technical Message

The demo should make this distinction clear:

Traditional browser automation asks:

"Where is the Upgrade button?"

WebMCP asks:

"What capability does this factory expose?"

The AI should not operate screen coordinates.

It should operate:

machines
recipes
connections
resources
capacity
throughput

# Final Instruction

Directly build the complete index.html.

Do not explain the implementation first.

Do not return pseudocode.

Do not omit WebMCP integration.

Do not leave TODO markers.

Do not require a backend.

Do not create an auto-optimize tool.

Do not simplify the experience into static cards with fake numbers.

The factory must be a genuine small simulation.

The strongest live demo must support:

User:

"Increase this factory to at least 10 gears per minute while spending as little as possible."

AI Agent
↓
factory_get_throughput()
↓
factory_get_bottlenecks()
↓
machine_inspect(...)
↓
factory_get_credits()
↓
factory_get_available_builds()
↓
reason about upgrade vs expansion
↓
machine_upgrade(...) and/or machine_build(...)
↓
conveyor_connect(...)
↓
factory_get_throughput()
↓
observe again
↓
adapt if necessary
↓
reach >= 10 gears/min

The AI must genuinely diagnose and optimize the factory through multiple observation and action cycles.

Make the production increase visually satisfying through machine animation, resource flow, bottleneck indicators, and the live throughput graph.

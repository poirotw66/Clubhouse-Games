You are a senior Frontend Engineer, Web API Engineer, Smart Home UX Designer, AI Agent Product Designer, and interactive demo engineer.

Build a complete, polished, fully runnable single-page HTML demo called:

WebMCP AI Smart Home

Do not give me a plan, outline, architecture proposal, pseudocode, or partial snippets.

Directly implement the complete application.

The final result should clearly demonstrate how a human user and an AI agent can control the same smart home through a shared application capability layer using WebMCP.

# Core Goal

Create a visually impressive smart-home control dashboard where:

* A human can control rooms and devices through the UI
* An AI agent can control the exact same home through structured WebMCP tools
* Both operate on exactly the same application state
* AI actions immediately update the visible smart-home UI
* Human actions immediately affect the state returned by WebMCP tools

The key concept is:

"The AI agent is not clicking buttons or guessing the UI. The smart-home application directly exposes structured capabilities through WebMCP."

Example:

Human:
turns off the bedroom light through a toggle

AI:

light_set({
"deviceId": "bedroom-light",
"power": false
})

Both must call the same underlying SmartHomeEngine.

# Final Deliverable

Create:

index.html

Prefer one self-contained HTML file containing:

* HTML
* CSS
* JavaScript
* mock smart-home data

Use:

* Vanilla HTML
* Vanilla CSS
* Vanilla JavaScript

Do not use:

* React
* Vue
* Angular
* npm
* build systems
* backend
* external APIs
* MQTT server
* WebSocket backend
* external MCP server
* SSE
* real IoT services

Everything must run directly in the browser.

# Optional Visual Assets

For anything that needs bitmaps/textures/sprites, room textures, furniture elements, device icons, decorative environmental assets, floor-plan artwork, lighting overlays, weather visuals, or if it helps to have a mockup reference for any 3D models you build, feel free to use imagegen.

However:

* the final application must remain fully interactive
* generated assets are optional supporting assets
* do not replace the actual UI with a static mockup
* prefer interactive DOM/CSS/SVG elements where possible
* the smart-home state must visibly react in real time

# WebMCP

Use the WebMCP page capability API through:

document.modelContext

Use capability detection:

if ('modelContext' in document)

If unsupported:

* the smart-home UI must remain completely usable
* show:
  "WebMCP Unsupported"
* do not throw errors
* log a clear console message

If supported:

show:

"WebMCP Connected"

Register tools after SmartHomeEngine initialization.

Use:

await document.modelContext.registerTool({...})

Avoid duplicate registration.

WebMCP tools must NEVER simulate DOM clicks.

They must call SmartHomeEngine domain methods directly.

# Application Architecture

Use a clear separation of concerns.

Suggested architecture:

SmartHomeEngine
HomeState
SceneEngine
AutomationEngine
HomeRenderer
UIController
WebMCPAdapter
ActivityLogger
UndoManager

SmartHomeEngine must be the single source of truth.

Data flow:

Human UI
↓
SmartHomeEngine
↓
Shared Home State
↓
Renderer

AI Agent
↓
WebMCP Tools
↓
SmartHomeEngine
↓
Shared Home State
↓
Renderer

Both must operate on the exact same state.

# Smart Home Layout

Create a fictional apartment or modern house with the following rooms:

* Living Room
* Bedroom
* Kitchen
* Study
* Bathroom
* Entrance

Use a stylized top-down floor plan or isometric-style layout.

Each room should be visually recognizable.

The home should feel like a premium smart-home dashboard.

# Room Devices

Create realistic devices.

## Living Room

living-light-main
Type: light
Capabilities:

* power
* brightness
* colorTemperature

living-light-ambient
Type: light
Capabilities:

* power
* brightness
* color

living-ac
Type: climate
Capabilities:

* power
* targetTemperature
* mode
* fanSpeed

living-tv
Type: media
Capabilities:

* power
* volume
* source

living-curtain
Type: curtain
Capabilities:

* position

living-air-purifier
Type: purifier
Capabilities:

* power
* fanSpeed
* mode

## Bedroom

bedroom-light
Type: light

bedroom-bedside-light
Type: light

bedroom-ac
Type: climate

bedroom-curtain
Type: curtain

bedroom-humidifier
Type: humidifier

bedroom-speaker
Type: media

## Kitchen

kitchen-light
Type: light

kitchen-hood
Type: appliance

kitchen-coffee-machine
Type: appliance

kitchen-smart-plug
Type: plug

## Study

study-light
Type: light

study-desk-light
Type: light

study-ac
Type: climate

study-monitor
Type: plug or display

study-speaker
Type: media

## Bathroom

bathroom-light
Type: light

bathroom-fan
Type: fan

bathroom-heater
Type: appliance

## Entrance

entrance-light
Type: light

entrance-lock
Type: lock

entrance-camera
Type: camera

# Device State Model

Every device should contain:

{
id,
name,
room,
type,
online,
power,
capabilities,
state
}

Example:

{
"id": "living-light-main",
"name": "Main Light",
"room": "living_room",
"type": "light",
"online": true,
"power": true,
"capabilities": [
"power",
"brightness",
"colorTemperature"
],
"state": {
"brightness": 75,
"colorTemperature": 4200
}
}

# Visual Home State

The room visuals must clearly change when device states change.

Examples:

If Living Room main light turns off:

* room becomes visibly darker

If ambient light turns purple:

* add a subtle purple glow

If curtain closes:

* window becomes dark / covered

If AC turns on:

* show a subtle airflow or AC active indicator

If TV turns on:

* TV screen glows

If kitchen coffee machine activates:

* show subtle steam / active animation

If entrance lock is locked:

* show clear lock state

These effects should remain subtle and polished.

# Main Layout

Header:

WebMCP AI Smart Home

Subtitle:

Control your home through UI or AI tools.

Top-right:

WebMCP ● Connected

or:

WebMCP ● Unsupported

Secondary status row:

Home
6 Rooms
21 Devices
18 Online
Current Scene: Home

Main desktop layout:

Left:
large interactive floor plan

Right:
Smart Home Control Panel

Bottom:

* Agent Activity
* Scenes
* Energy / Home Signals
* WebMCP Tool Inspector
* Suggested AI prompts
* How WebMCP Works

# Floor Plan

The floor plan is the visual centerpiece.

Each room should be clickable.

Rooms display small real-time indicators such as:

Living Room
23°C
2 lights on
TV on

Bedroom
25°C
Lights off
Curtain closed

When clicking a room:

open or update the right-side control panel with its devices.

Devices inside the floor plan can have subtle mini-icons.

# Device Control Panel

When a room is selected, show its devices.

Each device card should display:

* device name
* type
* online/offline
* current state
* controls

Examples:

Light:

* power toggle
* brightness slider
* color temperature slider
* optional color buttons

AC:

* power
* target temperature
* mode
* fan speed

Curtain:

* open
* 50%
* close
* slider

TV:

* power
* volume
* source

Lock:

* locked / unlocked

Appliances:

* power
* relevant state

# Smart Home Scenes

Scenes are a major part of the demo.

Implement these default scenes:

Home
Away
Sleep
Movie
Focus
Dinner
Morning
Energy Saver

Scenes should apply multiple device changes.

## Home Scene

* living room lights on
* bedroom normal
* AC comfortable
* entrance unlocked or normal state

## Away Scene

* turn off most lights
* TV off
* kitchen appliances off
* AC off or eco
* curtains partially closed
* entrance locked

## Sleep Scene

* living room devices off
* bedroom main light off
* bedside light 15%
* bedroom AC 25°C
* bedroom curtain closed
* bedroom speaker low or off
* entrance locked

## Movie Scene

* living main light off
* ambient light 20%
* ambient color purple / warm
* curtain closed
* TV on
* TV volume around 25
* AC comfortable

## Focus Scene

* study light 100%
* desk light 80%
* study AC 24°C
* study monitor on
* living room distractions off

## Dinner Scene

* kitchen light on
* living room warm lighting
* TV off
* ambient light warm

## Morning Scene

* bedroom curtain open
* bedroom light 50%
* AC normal
* coffee machine activates
* living room light on

## Energy Saver Scene

* unnecessary devices off
* reduce brightness
* AC eco mode
* TV off
* appliances off

Scenes must modify the real shared device state.

# Scene Visualization

Include a prominent scene selector.

Example:

[ Home ]
[ Away ]
[ Sleep ]
[ Movie ]
[ Focus ]
[ Dinner ]
[ Morning ]
[ Energy Saver ]

When a scene is activated:

* animate affected rooms subtly
* show toast:
  "AI Agent activated Movie Scene"
* update floor plan
* update controls
* update current scene
* update activity log

If activated through UI, do not label it as AI.

# Home Signals

Create a panel called:

Home Signals

Show derived information such as:

3 lights currently on

Living Room AC set to 23°C

Entrance is locked

2 devices are offline

Estimated power usage: 1.8 kW

Bedroom curtain is closed

TV is currently on

These must derive from actual SmartHomeEngine state.

# Energy Dashboard

Create a compact energy section.

Show estimated current consumption based on enabled devices.

Example power values:

Main light: 12W
Ambient light: 8W
AC: 900W
TV: 120W
Air purifier: 35W
Coffee machine: 1000W while active
Monitor: 80W
Heater: 800W

Show:

Current Power
Today's Estimated Usage
Devices Consuming Most Power

Values may be locally simulated.

Do not require external data.

# Environment Data

Include simulated room environment data:

temperature
humidity
air quality

Example:

Living Room
23.4°C
55%
AQI 21

Bedroom
25.1°C
62%
AQI 18

These values may be static or lightly simulated.

Do not make random changes excessively.

# Activity Log

Create a visible panel:

Agent Activity

Entries include:

timestamp
source
action
summary

Sources:

UI
WebMCP
System

Examples:

15:03:04 UI       light_set living-light-main brightness=50
15:03:12 WebMCP   scene_activate movie
15:03:18 WebMCP   climate_set bedroom-ac 25°C
15:03:26 System   Entrance locked
15:03:30 WebMCP   home_get_state

Keep the latest 50 entries.

This is important for a live technical demo.

# Agent Action Highlighting

When an action originates from WebMCP:

briefly highlight:

* affected room
* affected device
* relevant control

For approximately 600–1000ms.

Use subtle glow or outline.

Do not use excessive animation.

# Toast Notifications

Examples:

AI Agent turned off Living Room TV

AI Agent set Bedroom AC to 25°C

AI Agent activated Sleep Scene

AI Agent closed all curtains

Do not falsely label human UI actions as AI actions.

# Undo

Support undo for:

* device changes
* scene activation
* batch room changes
* whole-home actions

One undo should revert one logical action.

For scene activation:

undo restores the entire pre-scene snapshot.

# WebMCP Tools

Register structured smart-home tools.

Use snake_case names.

Every tool must have:

* high-quality description
* JSON input schema
* validation
* predictable structured return
* readOnlyHint where appropriate

Implement at minimum:

# 1. home_get_state

Description:

Get the complete current smart-home state including all rooms, devices, active scene, environmental values, energy estimate, lock state, and online/offline device status.

Input:

{}

Annotations:

readOnlyHint: true
consequentialHint: false
untrustedContentHint: false

# 2. home_get_summary

Description:

Return a concise human-readable and structured summary of the home, including active devices, current temperatures, locks, open curtains, offline devices, and notable conditions.

Input:

{}

readOnlyHint: true

Useful for questions like:

"What's currently happening at home?"

# 3. room_get_state

Input:

{
"room": "living_room"
}

Valid rooms:

living_room
bedroom
kitchen
study
bathroom
entrance

Return all devices and environmental state for that room.

readOnlyHint: true

# 4. device_get_state

Input:

{
"deviceId": "living-ac"
}

Return full device state.

readOnlyHint: true

# 5. device_set_power

Input:

{
"deviceId": "living-tv",
"power": false
}

Validate whether the device supports power.

# 6. light_set

Description:

Control a smart light. Use this for power, brightness, color temperature, or RGB-style color where supported.

Input example:

{
"deviceId": "living-light-ambient",
"power": true,
"brightness": 30,
"color": "purple"
}

All fields except deviceId are optional, but at least one mutable field must be provided.

Brightness:
0–100

Color temperature:
2700–6500

Validate capabilities.

# 7. climate_set

Input example:

{
"deviceId": "bedroom-ac",
"power": true,
"targetTemperature": 25,
"mode": "cool",
"fanSpeed": "auto"
}

Supported mode examples:

cool
heat
fan
dry
eco
auto

Temperature range:

16–30

# 8. curtain_set

Input:

{
"deviceId": "bedroom-curtain",
"position": 0
}

Position:

0 = closed
100 = fully open

# 9. media_set

Input example:

{
"deviceId": "living-tv",
"power": true,
"volume": 25,
"source": "streaming"
}

Volume:

0–100

# 10. lock_set

Input:

{
"deviceId": "entrance-lock",
"locked": true
}

Use only for lock devices.

# 11. fan_set

Input example:

{
"deviceId": "bathroom-fan",
"power": true,
"speed": "high"
}

# 12. appliance_set

Input example:

{
"deviceId": "kitchen-coffee-machine",
"power": true
}

# 13. scene_activate

Description:

Activate a predefined whole-home scene. Use this when the user's request describes a high-level intent such as sleeping, watching a movie, leaving home, focusing, dining, waking up, or saving energy.

Input:

{
"scene": "sleep"
}

Valid:

home
away
sleep
movie
focus
dinner
morning
energy_saver

This tool changes multiple devices atomically.

Return:

{
"success": true,
"scene": "sleep",
"changedDevices": [...]
}

# 14. scene_get_available

Input:

{}

Return scenes and brief descriptions.

readOnlyHint: true

# 15. room_set_lights

Description:

Control all lights in a room together.

Input example:

{
"room": "living_room",
"power": false
}

or:

{
"room": "study",
"power": true,
"brightness": 80
}

Validate every target before applying.

Atomic operation.

# 16. home_set_all_lights

Input example:

{
"power": false
}

Optional brightness if turning on.

Apply to all supported lights.

# 17. home_close_all_curtains

Input:

{}

Set all curtain devices to position 0.

# 18. home_open_all_curtains

Input:

{}

Set all curtains to position 100.

# 19. home_lock_all

Input:

{}

Lock all available smart locks.

# 20. home_turn_off_nonessential_devices

Description:

Turn off nonessential active devices such as lights, displays, TV, speakers, and selected appliances while preserving critical/security devices.

Input:

{}

Useful for energy-saving or leaving-home requests.

# 21. home_get_energy_usage

Input:

{}

Return:

{
"currentWatts": 1845,
"estimatedDailyKWh": 8.4,
"topConsumers": [...]
}

readOnlyHint: true

# 22. home_get_offline_devices

Input:

{}

Return all unavailable devices.

readOnlyHint: true

# 23. home_get_security_status

Description:

Return current entrance lock state, camera state, and security-relevant device status.

Input:

{}

readOnlyHint: true

# 24. home_batch_update

Input example:

{
"updates": [
{
"deviceId": "living-tv",
"changes": {
"power": false
}
},
{
"deviceId": "living-light-main",
"changes": {
"brightness": 20
}
}
]
}

Validate the full batch first.

Do not partially execute invalid batches.

# 25. home_get_available_options

Description:

Return valid rooms, devices, capabilities, scenes, climate modes, fan speeds, supported colors, and state ranges so the AI agent does not need to guess valid values.

Input:

{}

readOnlyHint: true

# 26. home_undo

Input:

{}

Undo the most recent logical smart-home mutation.

# 27. home_reset_demo

Input:

{}

Restore original demo home state.

# Tool Design Quality

Tool descriptions are extremely important.

Bad:

"Control light."

Good:

"Control a specific smart light through structured state changes. Use this for power, brightness, color temperature, or color changes on devices that support those capabilities. This directly modifies the shared home state and immediately updates the smart-home UI."

The descriptions should help an AI agent select the correct tool without inspecting the UI.

# Agent Reasoning Scenarios

The application must support natural-language requests such as:

## Scenario 1

"I'm going to bed."

Expected:

scene_activate({
"scene": "sleep"
})

Do not require individual device calls when a scene already expresses the intent.

## Scenario 2

"I'm going out."

Expected:

scene_activate({
"scene": "away"
})

## Scenario 3

"Let's watch a movie."

Expected:

scene_activate({
"scene": "movie"
})

## Scenario 4

"It's too hot in the bedroom."

Expected:

room_get_state({
"room": "bedroom"
})

then perhaps:

climate_set({
"deviceId": "bedroom-ac",
"power": true,
"targetTemperature": 23
})

## Scenario 5

"Turn off every light except the bedroom bedside light."

Expected:

home_set_all_lights({
"power": false
})

then:

light_set({
"deviceId": "bedroom-bedside-light",
"power": true
})

## Scenario 6

"Make the study ready for deep work."

Expected:

scene_activate({
"scene": "focus"
})

or suitable structured actions.

## Scenario 7

"How much power are we using right now?"

Expected:

home_get_energy_usage()

## Scenario 8

"Is the house secure?"

Expected:

home_get_security_status()

## Scenario 9

"Close all curtains and lock the entrance."

Expected:

home_close_all_curtains()
↓
home_lock_all()

## Scenario 10

"Reduce power usage without turning off the AC."

Expected:

home_get_state()
↓
reason over active devices
↓
home_turn_off_nonessential_devices()
or targeted calls that preserve AC

# Suggested AI Prompts

Create a panel titled:

Try asking your AI agent

Display prompts:

"I'm going to bed."

"Set the house to Movie Mode."

"Turn off every light downstairs."

"Make the study ready for focused work."

"Set the bedroom AC to 24°C."

"Close every curtain."

"Is my front door locked?"

"Which devices are using the most power?"

"Turn off unnecessary devices but keep the bedroom AC running."

"Prepare the house for when I leave."

"Open the bedroom curtain and start the coffee machine."

"What's currently happening at home?"

"Turn the living room purple and dim the lights to 20%."

"Make the house use less than 500 watts if possible."

# Agent Mission

Add a small showcase panel:

Agent Mission

Default mission:

"Prepare the house for bedtime."

Show expected high-level behavior:

Bedroom
→ comfortable temperature
→ curtain closed
→ bedside light dimmed

Living Room
→ lights off
→ TV off

Entrance
→ locked

This is an excellent demo mission because one natural-language intent causes multiple coordinated state changes.

# Natural Language vs Structured Capability Comparison

Add a compact visual comparison:

Traditional Browser Agent

"Turn on Movie Mode"

AI
↓
inspect DOM
↓
find scene controls
↓
find Movie button
↓
click
↓
wait
↓
inspect page again

WebMCP Agent

scene_activate({
"scene": "movie"
})

Make this contrast easy to understand.

# Current Scene Detection

If the user manually changes devices after activating a scene, the app may mark:

Current Scene: Custom

For example:

Activate Movie Scene
→ Current Scene = Movie

Then manually turn the kitchen light on
→ Current Scene = Custom

This helps demonstrate real application state.

# Device Availability

Simulate one or two offline devices.

Example:

bathroom-heater
online: false

If an agent attempts to control an offline device:

return:

{
"success": false,
"error": "Bathroom Heater is currently offline."
}

Do not silently succeed.

# Validation

Validate:

device IDs
room IDs
scene IDs
capability support
temperature ranges
brightness ranges
volume
curtain position
fan mode
device availability

Batch operations must be atomic.

If one requested update is invalid:

do not partially apply.

# Security-Relevant Confirmation

For the demo, locking the entrance may execute normally.

However, unlocking the entrance should require explicit confirmation.

For example:

lock_set({
"deviceId": "entrance-lock",
"locked": false,
"confirm": true
})

Require:

confirm: true

for unlocking.

If omitted:

return:

{
"success": false,
"requiresConfirmation": true,
"error": "Unlocking the entrance requires explicit confirmation."
}

This demonstrates that not all WebMCP actions should have the same consequence level.

# Activity / Consequence Indicators

In the WebMCP Tool Inspector, distinguish:

READ

WRITE

SENSITIVE

Examples:

home_get_state               READ
home_get_energy_usage        READ
light_set                    WRITE
scene_activate               WRITE
lock_set                     SENSITIVE

This makes the technical demo richer.

# WebMCP Tool Inspector

Add:

WebMCP Tool Inspector

For each tool show:

* name
* READ / WRITE / SENSITIVE badge
* short description

Example:

home_get_state                    READ
room_get_state                    READ
light_set                         WRITE
climate_set                       WRITE
scene_activate                    WRITE
home_batch_update                 WRITE
home_get_security_status          READ
lock_set                          SENSITIVE

Include:

Refresh Tools

If:

document.modelContext.getTools

exists, use it where reasonable.

Otherwise display locally registered tools.

Do not crash.

# Shared State Rules

If human UI changes Bedroom AC:

home_get_state()

must return the new value.

If AI uses:

climate_set()

the visible Bedroom AC controls must update immediately.

If AI activates Sleep Scene:

the floor plan, room cards, device cards, energy values, and scene status must all update.

There must never be separate AI state and UI state.

# Persistence

Use localStorage for:

* device states
* selected room
* current scene where applicable

Validate saved state.

If corrupted:

fall back safely.

Provide:

Reset Demo

# Responsive Behavior

Desktop:

large floor plan left
controls right

Tablet:

floor plan above
controls below or compact side panel

Mobile:

floor plan scrollable / responsive
room selector tabs
controls stacked vertically

No accidental horizontal overflow.

# Accessibility

Support:

* semantic buttons
* aria labels
* keyboard focus
* contrast
* reduced motion
* readable status labels
* sliders with labels

# Self Tests

Run isolated non-destructive console self-tests.

Test:

device power changes

light brightness

climate range validation

curtain control

scene activation

scene undo

batch atomicity

offline device rejection

unlock confirmation

energy calculation

room state query

reset behavior

If something fails:

console.error(...)

Do not alter live state.

# Suggested JavaScript Sections

Organize clearly:

CONFIG
ROOM DATA
DEVICE DATA
SCENE DEFINITIONS
UTILITIES
SMART HOME ENGINE
SCENE ENGINE
ENERGY ENGINE
UNDO MANAGER
HOME RENDERER
FLOOR PLAN
DEVICE CONTROLS
UI CONTROLLER
ACTIVITY LOGGER
WEBMCP ADAPTER
PERSISTENCE
SELF TESTS
INITIALIZATION

Use English:

* function names
* variable names
* classes
* comments

# Acceptance Tests

TEST 1

Open page.

Floor plan and rooms render.

PASS.

TEST 2

Human turns Living Room main light off.

Room becomes visibly darker.

PASS.

TEST 3

Call:

light_set({
"deviceId": "living-light-main",
"power": true,
"brightness": 30
})

UI immediately updates.

PASS.

TEST 4

Call:

climate_set({
"deviceId": "bedroom-ac",
"power": true,
"targetTemperature": 24
})

Bedroom UI updates to 24°C.

PASS.

TEST 5

Call:

scene_activate({
"scene": "movie"
})

Expected devices update together.

PASS.

TEST 6

After Movie Scene, manually modify one device.

Current Scene changes to:

Custom

PASS.

TEST 7

Call:

home_get_state()

Returned state matches visible UI.

PASS.

TEST 8

Call:

home_get_energy_usage()

Energy estimate matches active device model.

PASS.

TEST 9

Attempt to control an offline device.

Returns a structured error.

PASS.

TEST 10

Attempt to unlock entrance without confirm=true.

Request is rejected with confirmation-required response.

PASS.

TEST 11

Call:

home_close_all_curtains()

All curtain visuals close.

PASS.

TEST 12

Activate Sleep Scene.

Undo.

Entire previous state returns.

PASS.

TEST 13

WebMCP unavailable environment.

Smart-home UI still works completely.

PASS.

TEST 14

Refresh browser.

Persisted home state is restored.

PASS.

TEST 15

Reset Demo.

Original home state returns.

PASS.

# How WebMCP Works

Add a section:

How WebMCP powers this home

Explain:

1. The smart-home page exposes structured device and scene capabilities.
2. An AI agent discovers those capabilities.
3. The agent interprets user intent.
4. The agent selects an appropriate tool or scene.
5. SmartHomeEngine changes the shared application state.
6. The floor plan and controls immediately reflect those changes.

Show this architecture:

Natural Language
↓
AI Agent
↓
WebMCP Tools
↓
SmartHomeEngine
↓
Shared Home State
↓
Floor Plan + UI

Human User
↓
Device Controls
↓
SmartHomeEngine

Emphasize visually:

Humans and AI operate through the same smart-home capability layer.

# Final Instruction

Directly build the complete index.html.

Do not give me implementation advice first.

Do not return pseudocode.

Do not omit WebMCP integration.

Do not leave TODO markers.

Do not build a fake backend or MCP server.

Do not reduce the demo to simple toggle switches.

The final result must feel like a premium interactive AI smart-home showcase.

Within a few seconds, a viewer should understand:

"Instead of teaching an AI agent where every switch is located, WebMCP lets the smart-home application expose lights, climate, curtains, scenes, security, and energy management directly as structured capabilities."

The strongest showcase flow should be:

User:
"I'm going to bed."

AI Agent
↓
scene_activate({
"scene": "sleep"
})
↓
Living room turns off
↓
Bedroom dims
↓
Curtains close
↓
AC changes temperature
↓
Entrance locks
↓
Energy usage drops
↓
UI updates everywhere

Make this experience visually satisfying and immediately understandable.

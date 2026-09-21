You are a senior Frontend Engineer, Web API Engineer, and interactive product-demo designer.

Please build a complete, polished, fully runnable HTML demo for a WebMCP-powered food builder application.

Do not give me a plan, outline, pseudocode, or partial snippets.
Directly implement the complete deliverable.

# Project Goal

Create a single-page interactive web demo called:

WebMCP Pizza / Burger Builder

The app should let a human user and an AI agent both control the same food-building experience.

The core concept is:

- A human can build a pizza or burger through the UI
- An AI agent can build the same pizza or burger through WebMCP tools
- Both human and AI must operate on the same shared application state
- Changes from either side must immediately update the UI
- This should clearly demonstrate that WebMCP exposes structured application capabilities, not DOM-click automation

# Final Deliverable

Create a complete runnable:

index.html

Use:

- Vanilla HTML
- Vanilla CSS
- Vanilla JavaScript

Do not use:

- React
- Vue
- Angular
- npm
- build steps
- backend
- MCP server
- SSE
- WebSocket server
- simulated remote API

Everything should run directly in the browser.

Prefer a single self-contained HTML file with embedded CSS and JS.

# Important Additional Instruction

For anything that needs bitmaps, textures, sprites, icon-like visual assets, ingredient mockups, or if it helps to have a mockup reference for any 3D-looking food models you build, feel free to use imagegen.

However, the final deliverable must still be a fully functional HTML demo.
Do not turn the project into only a static mockup.
Use generated visual assets only as supporting design resources if helpful.

# Product Concept

The demo supports two product modes:

1. Pizza Builder
2. Burger Builder

The user can switch between them using a segmented control or tabs.

The UI and WebMCP tools must both work for whichever mode is currently active.

The demo should feel polished, playful, modern, and visually impressive enough for a technical showcase.

# WebMCP Requirement

Use the current WebMCP Imperative API based on:

document.modelContext

Use capability detection:

if ('modelContext' in document)

If WebMCP is unsupported:

- The app must still work normally for human users
- Show a visible badge:
  "WebMCP Unsupported"
- Log a clear console message
- Do not crash

If WebMCP is supported:

- Show:
  "WebMCP Connected"
- Register all tools after app initialization
- Avoid duplicate registration

Use:

await document.modelContext.registerTool({...})

Do not rely on deprecated navigator.modelContext patterns.

# Shared State Architecture

Separate logic from presentation.

Use a structure similar to:

AppState / BuilderEngine
FoodRenderer
UIController
WebMCPAdapter
ActivityLogger

All actions must go through the same central state engine.

The WebMCP tools must NOT simulate button clicks.
They must call domain logic directly.

The UI must also call the same domain logic.

There must be exactly one source of truth.

# Core State Model

The application should maintain state for:

- activeProductType: "pizza" | "burger"
- pizza configuration
- burger configuration
- current selected size / bun / crust / sauce / ingredients
- quantity
- total price
- order summary
- action history
- last AI action
- whether current build is empty or ready to order

The app must preserve separate draft states for pizza and burger so that switching between them does not wipe the current configuration unless reset is called.

# Pizza Builder Features

Pizza options should include:

Size:
- Small
- Medium
- Large

Crust:
- Thin
- Hand Tossed
- Pan

Sauce:
- Tomato
- White Sauce
- Pesto
- Spicy Sauce

Cheese level:
- Light
- Normal
- Extra

Toppings:
- Pepperoni
- Sausage
- Bacon
- Ham
- Mushroom
- Onion
- Olive
- Pineapple
- Jalapeño
- Bell Pepper
- Tomato
- Corn

Support:

- add topping
- remove topping
- set topping quantity if desired
- clear pizza
- random pizza
- preset combos like:
  - Margherita
  - Hawaiian
  - Meat Lovers
  - Veggie Supreme

# Burger Builder Features

Burger options should include:

Size:
- Single
- Double
- Triple

Bun:
- Sesame
- Brioche
- Whole Wheat
- Lettuce Wrap

Patty:
- Beef
- Chicken
- Fish
- Plant-Based

Cheese:
- None
- Cheddar
- American
- Swiss
- Mozzarella

Sauce:
- Ketchup
- Mustard
- Mayo
- BBQ
- Special Sauce
- Spicy Mayo

Ingredients:
- Lettuce
- Tomato
- Onion
- Pickles
- Bacon
- Fried Egg
- Jalapeño
- Avocado
- Mushroom

Support:

- add ingredient
- remove ingredient
- clear burger
- random burger
- preset combos like:
  - Classic Cheeseburger
  - Bacon Deluxe
  - Spicy Chicken Burger
  - Veggie Burger

# Visual Design

Use a polished dark-theme modern developer-demo style.

Style direction:

- Chrome AI Demo
- clean product UI
- dark mode
- subtle glassmorphism
- violet / orange / green accents
- elegant cards
- clean typography
- restrained motion
- visually rich but not noisy

The page should feel like a technical showcase, not a toy website.

# Layout

Desktop layout:

Left side:
- Large live visual preview of the current pizza or burger

Right side:
- Control panel
- Product switcher
- configuration controls
- order summary
- WebMCP info

Top header:
- Title: WebMCP Pizza / Burger Builder
- Subtitle: Build food through UI or AI tools.
- Status badge: Connected / Unsupported

Lower section:
- Activity log
- WebMCP Tool Inspector
- Suggested AI prompts
- "How WebMCP works" explanation

Mobile layout:
- Preview on top
- Controls below
- No horizontal overflow

# Food Preview

The center visual preview is very important.

It should visually update in real time when ingredients change.

Requirements:

For pizza:
- a top-down or slightly angled large pizza render
- visible crust
- visible sauce/cheese base
- toppings placed attractively
- ingredients appear and disappear when state changes
- layered look
- subtle shadows
- appealing composition

For burger:
- a stacked side-view or slightly angled burger render
- bun top and bottom
- patty layers
- ingredient layers visibly stacked
- cheese draping if appropriate
- layered look
- subtle animation when ingredients update

You may use CSS illustration, layered DOM elements, SVG, canvas, or supporting generated mock assets if useful.

The important point is that the food must be visually impressive and clearly react to state changes.

# Human UI Controls

Include visible controls for:

Product Type
- Pizza
- Burger

For Pizza:
- size
- crust
- sauce
- cheese level
- topping add/remove controls
- preset combos
- random
- clear

For Burger:
- size
- bun
- patty
- cheese
- sauce
- ingredient add/remove controls
- preset combos
- random
- clear

General actions:
- Reset Current Product
- Reset All
- Undo
- Place Order

Also include:
- quantity selector
- total price
- ingredient list
- build summary

# Pricing

Implement a simple pricing model.

Example:

Pizza:
- base by size
- toppings add cost
- extra cheese adds cost
- special crust may add cost

Burger:
- base by size
- additional patty cost
- bacon / avocado / egg add cost
- premium bun may add cost

Show a live-updating total.

Keep pricing simple but consistent.

# Order Summary

Show an order summary card that includes:

- Product type
- Main options
- Toppings / ingredients
- Quantity
- Price
- Status:
  - Empty
  - In Progress
  - Ready to Order
  - Ordered

When "Place Order" is clicked or triggered by AI:

- show a success state
- show a toast
- append activity log entry
- preserve the current built item unless reset

# Undo

Support undo for recent user or AI actions.

Undo should revert one logical action at a time.

Examples:
- add topping → undo removes it
- remove topping → undo restores it
- preset combo → undo returns previous state
- switch product type → undo returns previous product type and previous state snapshot if appropriate

Use a reasonable history stack.

# Activity Log

Create an Activity Log panel.

Track recent actions from:

- UI
- WebMCP
- System

Examples:

12:03:18 UI       add_topping Pepperoni
12:03:22 WebMCP   food_set_product pizza
12:03:25 WebMCP   pizza_apply_preset "Hawaiian"
12:03:31 System   Order placed
12:03:35 UI       remove_topping Onion

Keep up to 50 entries.

This panel is important because it makes the WebMCP value obvious during demos.

# Toast Notifications

Show toasts for meaningful actions, such as:

- AI Agent added mushroom
- Burger preset applied
- Order placed
- Reset complete

Do not falsely label human actions as AI actions.

# WebMCP Tools

Register structured tools with clear descriptions and schemas.

Use snake_case tool names.

At minimum include the following tools.

## 1. food_get_state

Description:
Get the full current application state including active product, pizza state, burger state, totals, history summary, and order readiness.

Input:
{}

Annotations:
- readOnlyHint: true
- consequentialHint: false
- untrustedContentHint: false

Return structured JSON-like content.

## 2. food_set_product

Description:
Switch the active product type between pizza and burger.

Input schema:
{
  "product": {
    "type": "string",
    "enum": ["pizza", "burger"]
  }
}

This should only switch active mode, not wipe the inactive product draft.

## 3. pizza_set_size

Input:
{
  "size": {
    "type": "string",
    "enum": ["small", "medium", "large"]
  }
}

## 4. pizza_set_crust

Input:
{
  "crust": {
    "type": "string",
    "enum": ["thin", "hand_tossed", "pan"]
  }
}

## 5. pizza_set_sauce

Input:
{
  "sauce": {
    "type": "string",
    "enum": ["tomato", "white_sauce", "pesto", "spicy_sauce"]
  }
}

## 6. pizza_set_cheese_level

Input:
{
  "cheeseLevel": {
    "type": "string",
    "enum": ["light", "normal", "extra"]
  }
}

## 7. pizza_add_topping

Input:
{
  "topping": {
    "type": "string",
    "enum": [
      "pepperoni","sausage","bacon","ham",
      "mushroom","onion","olive","pineapple",
      "jalapeno","bell_pepper","tomato","corn"
    ]
  }
}

## 8. pizza_remove_topping

Input:
{
  "topping": {
    "type": "string",
    "enum": [
      "pepperoni","sausage","bacon","ham",
      "mushroom","onion","olive","pineapple",
      "jalapeno","bell_pepper","tomato","corn"
    ]
  }
}

## 9. pizza_apply_preset

Input:
{
  "preset": {
    "type": "string",
    "enum": ["margherita","hawaiian","meat_lovers","veggie_supreme"]
  }
}

## 10. pizza_randomize

Input:
{}

## 11. pizza_clear

Input:
{}

## 12. burger_set_size

Input:
{
  "size": {
    "type": "string",
    "enum": ["single", "double", "triple"]
  }
}

## 13. burger_set_bun

Input:
{
  "bun": {
    "type": "string",
    "enum": ["sesame", "brioche", "whole_wheat", "lettuce_wrap"]
  }
}

## 14. burger_set_patty

Input:
{
  "patty": {
    "type": "string",
    "enum": ["beef", "chicken", "fish", "plant_based"]
  }
}

## 15. burger_set_cheese

Input:
{
  "cheese": {
    "type": "string",
    "enum": ["none", "cheddar", "american", "swiss", "mozzarella"]
  }
}

## 16. burger_set_sauce

Input:
{
  "sauce": {
    "type": "string",
    "enum": ["ketchup", "mustard", "mayo", "bbq", "special_sauce", "spicy_mayo"]
  }
}

## 17. burger_add_ingredient

Input:
{
  "ingredient": {
    "type": "string",
    "enum": [
      "lettuce","tomato","onion","pickles","bacon",
      "fried_egg","jalapeno","avocado","mushroom"
    ]
  }
}

## 18. burger_remove_ingredient

Input:
{
  "ingredient": {
    "type": "string",
    "enum": [
      "lettuce","tomato","onion","pickles","bacon",
      "fried_egg","jalapeno","avocado","mushroom"
    ]
  }
}

## 19. burger_apply_preset

Input:
{
  "preset": {
    "type": "string",
    "enum": ["classic_cheeseburger","bacon_deluxe","spicy_chicken","veggie_burger"]
  }
}

## 20. burger_randomize

Input:
{}

## 21. burger_clear

Input:
{}

## 22. food_set_quantity

Input:
{
  "quantity": {
    "type": "integer",
    "minimum": 1,
    "maximum": 20
  }
}

## 23. food_get_price

Description:
Return current computed pricing and line-item details.

Input:
{}

Annotations:
- readOnlyHint: true

## 24. food_place_order

Description:
Place the current configured food order.

Input:
{}

This should set status to ordered and create a visible success notification.

## 25. food_reset_current

Input:
{}

## 26. food_reset_all

Input:
{}

## 27. food_undo

Input:
{}

## 28. food_get_available_options

Description:
Return available products, sizes, sauces, toppings, ingredients, presets, and quantity limits so the AI does not need to guess valid values.

Input:
{}

Annotations:
- readOnlyHint: true

# Tool Quality

Every tool must have:

- clear description
- clear input schema
- clear behavior
- predictable return structure

Do not write vague descriptions such as:
"Adds stuff"

Instead, write high-quality descriptions that help an AI agent choose the right tool.

# WebMCP Tool Inspector

Add a WebMCP Tool Inspector panel to the page.

Display:

- registered tool name
- read/write badge
- short description

If available, use something like:
document.modelContext.getTools()

If not available, degrade gracefully.

Add a:
[ Refresh Tools ]
button.

# Suggested AI Prompts Panel

Include a panel titled:

Try asking your AI agent

Show example prompts such as:

- Build a large pizza with thin crust, extra cheese, pepperoni, mushroom, and onion.
- Remove the onion and add jalapeño.
- Switch to burger mode and make a double bacon cheeseburger.
- Show me the current order summary.
- Clear the burger and make a veggie burger.
- Randomize a pizza and tell me the price.
- Place the current order.
- Compare my current burger and pizza drafts.
- Build a Hawaiian pizza, then remove pineapple.
- Make a spicy chicken burger with avocado and no onion.

These examples help visually communicate how an agent would use the tools.

# How WebMCP Works Section

At the bottom, include a compact explanation:

1. The page exposes structured food-building tools.
2. An AI agent discovers those tools.
3. The agent calls them with structured arguments.
4. The shared BuilderEngine updates application state.
5. The UI immediately reflects the same state.

Show a small architecture diagram like:

AI Agent
  ↓
WebMCP Tools
  ↓
BuilderEngine
  ↓
Application State
  ↓
Food UI

Human UI
  ↓
BuilderEngine

Make it visually obvious that human and AI operate through the same capability layer.

# Accessibility

Add reasonable accessibility support:

- aria-label for buttons
- keyboard-focus styles
- clear contrast
- semantic headings
- reduced motion support via prefers-reduced-motion

# Engineering Rules

1. Use one shared state engine.
2. Human UI and WebMCP must call the same logic.
3. No DOM-click simulation in WebMCP tools.
4. Validate all tool inputs.
5. Handle unsupported WebMCP gracefully.
6. Maintain clear separation of logic and rendering.
7. No placeholder TODOs.
8. No fake backend.
9. The demo must feel polished and demo-ready.
10. The preview must visibly react to all meaningful state changes.

# Initialization

Default startup:

- active product: pizza
- default pizza: medium, hand tossed, tomato sauce, normal cheese, no toppings
- quantity: 1
- status: In Progress or Ready depending on your logic
- WebMCP badge visible immediately
- all panels properly initialized

# Self Check / Basic Test Logic

Include some non-destructive console self-checks using isolated test state objects, such as:

- switching products preserves drafts
- adding and removing a topping works
- price changes when premium ingredients are added
- burger preset applies expected fields
- reset current clears only active product
- reset all clears both
- undo restores previous state

If a test fails:
console.error(...)
But do not break the live app state.

# Acceptance Criteria

After implementation, verify:

TEST 1
Open page
→ pizza preview visible
PASS

TEST 2
User adds pepperoni
→ preview updates
→ summary updates
→ price updates
PASS

TEST 3
User switches to burger
→ burger preview visible
→ pizza draft preserved
PASS

TEST 4
AI calls food_set_product("burger")
→ UI updates to burger
PASS

TEST 5
AI calls burger_add_ingredient("bacon")
→ burger preview updates
PASS

TEST 6
AI calls pizza_apply_preset("hawaiian")
after switching back to pizza
→ preset applied correctly
PASS

TEST 7
AI calls food_get_state
→ returned state matches visible UI
PASS

TEST 8
Place order
→ success state / toast / log entry
PASS

TEST 9
Undo
→ most recent logical action reverts
PASS

TEST 10
If WebMCP unsupported
→ UI still fully usable
PASS

# Final Instruction

Directly generate the complete index.html implementation.

Do not give me an explanation first.
Do not return pseudocode.
Do not omit the WebMCP integration.
Do not leave unfinished placeholders.

The result should be suitable for a live technical demo showing that:
"A human and an AI agent can both build the same pizza or burger through a shared WebMCP capability layer."
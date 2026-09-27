Build a complete, polished, playable browser game as a single-page HTML demo inspired by the core design philosophy of loop-based roguelike auto-battlers.

Do not recreate or copy Loop Hero's copyrighted characters, names, maps, UI, art, lore, or assets. Create an original game with its own setting, visuals, enemies, cards, equipment, and terminology.

The game should feel like a mysterious retro pixel-art roguelike where the player does NOT directly control the hero. Instead, the hero continuously travels around a looping path, automatically fights enemies, collects loot, and becomes stronger. The player changes the world around the hero by placing cards and deciding how much danger to create.

## Core fantasy

The player controls the world, not the hero.

The central tension should be:

"How dangerous can I make this loop before I need to escape?"

The game must be genuinely playable, not just a visual mockup.

## Technology

Create everything as a self-contained web app using:

* HTML
* CSS
* Vanilla JavaScript
* Canvas or DOM rendering where appropriate

Prefer a single `index.html` if practical.

It must run immediately by opening the HTML file locally.

Do not require a backend, build step, package manager, external API, login, or database.

For anything that needs bitmaps/textures/sprites, or if it helps to have a mockup reference for any 3D models you build, feel free to use imagegen.

If generated images are unavailable, create convincing procedural pixel-art placeholders using Canvas/CSS so the game remains fully playable.

## Visual direction

Create an original dark-fantasy pixel-art aesthetic.

Visual mood:

* ancient ruined world
* muted earthy palette
* mysterious fog
* glowing magical accents
* worn parchment / stone UI
* chunky pixel sprites
* subtle CRT/pixel texture
* readable but atmospheric interface

Target desktop first, approximately 1440×900, but make it responsive.

Avoid overly modern SaaS-style UI.

The entire screen should feel like a real indie game.

## Main game layout

The screen should contain three major regions.

### Center: Loop Map

Create a visible looping road containing approximately 18–24 tiles.

The road should form an irregular circular/oval path around a central wilderness area.

The hero moves automatically from tile to tile.

Each tile can contain:

* empty road
* enemy encounter
* village
* camp
* ruins
* magical structure
* environmental effect

Show the hero physically walking around the loop.

Movement should feel continuous but readable.

### Right side: Hero Panel

Show:

* hero portrait
* HP
* max HP
* attack
* defense
* attack speed
* evasion
* loop number
* level
* XP

Equipment slots:

* weapon
* armor
* boots
* charm

Each equipment item should have:

* generated fantasy name
* rarity
* stats
* comparison tooltip

Loot should occasionally drop after combat.

The player can click loot to equip it.

Highlight whether a new item is better or worse than the currently equipped item.

### Bottom: Card Hand

Show a hand of world-building cards.

Example original cards:

* Whispering Grove
* Bone Cairn
* Ember Shrine
* Forgotten Hamlet
* Spider Hollow
* Mist Beacon
* Ancient Watchtower
* Moonwell

Cards should have:

* pixel-art icon
* card name
* short effect
* placement rules
* hover tooltip

The player drags or clicks a card and then places it onto a valid map tile.

Valid tiles should highlight.

## World-building mechanics

Cards should alter the simulation.

Examples:

### Whispering Grove

Placed beside the loop.

Effect:
+3% hero attack speed.

### Bone Cairn

Placed on the road.

Spawns skeletons every few loops.

### Spider Hollow

Placed beside the road.

Causes spiders to appear on nearby road tiles.

### Forgotten Hamlet

Placed on the road.

Heals the hero when passing through.

### Ember Shrine

Placed beside the road.

Increases attack but also makes nearby enemies stronger.

### Mist Beacon

Increases rare enemy spawn chance.

### Moonwell

Restores a small percentage of HP once per loop.

Create at least 8 distinct card types.

Cards should have meaningful tradeoffs rather than only positive bonuses.

## Combat

Combat is fully automatic.

When the hero reaches an enemy:

* movement pauses
* combat animation begins
* hero and enemy attack automatically
* damage numbers appear
* HP bars animate
* occasional crits or dodges appear
* enemy dies or hero dies

Combat should last roughly 2–8 seconds depending on enemy strength.

Include at least:

* basic melee enemy
* fast enemy
* armored enemy
* magical enemy
* elite enemy

Enemies should scale gradually with loop count.

## Loot system

Enemies can drop equipment.

Use rarity tiers such as:

* Common
* Uncommon
* Rare
* Epic

Equipment stats should be procedurally generated.

Possible modifiers:

* +attack
* +defense
* +HP
* +attack speed
* +evasion
* +crit chance
* vampirism / life steal

Show floating loot cards near the inventory panel.

Allow one-click equip.

Old equipment can be discarded automatically.

## Loop progression

Every time the hero completes a full circuit:

* loop number increases
* enemies become slightly stronger
* resource rewards improve
* card drop rate slightly changes
* atmosphere becomes more dangerous

Show a dramatic but short:

"LOOP 4"

overlay whenever a new loop starts.

## Boss progression

Add a boss progress meter.

Every card placed contributes slightly to the boss meter.

When the meter reaches 100%, spawn a boss on a special tile.

Create one original boss, for example:

"The Hollow Warden"

The boss should:

* have significantly more HP
* use a distinctive sprite
* have at least one special mechanic
* provide a dramatic encounter

Defeating the boss counts as a run victory.

## Retreat mechanic

The player must be able to voluntarily retreat.

Provide a "Return to Camp" button.

Rules:

* retreating while standing on the camp tile preserves 100% of collected resources
* retreating elsewhere preserves only 60%
* dying preserves only 25%

Clearly communicate this risk/reward mechanic.

This decision should be one of the most important parts of the game.

## Resources and meta progression

During the run, collect resources such as:

* Ancient Wood
* Stone Shards
* Spirit Dust
* Iron Fragments

Show a small resource inventory.

After retreating or dying, transition to a simple Camp screen.

The Camp should allow a few permanent upgrades such as:

* +5% starting HP
* unlock a new card
* improve starting weapon
* increase potion capacity

Keep the meta layer simple but functional.

Allow starting another expedition.

Use localStorage to preserve meta progression between refreshes.

## Dynamic events

Add occasional small random events.

Examples:

"A strange merchant appears."

"Fog covers the eastern road."

"A ruined shrine begins glowing."

"An elite creature has entered the loop."

Show these as short atmospheric notifications.

## UX polish

Include:

* hover tooltips
* smooth UI transitions
* floating combat text
* card placement preview
* invalid placement feedback
* pause button
* x1 / x2 / x4 simulation speed
* sound toggle
* subtle screen shake on heavy attacks
* particle effects
* enemy death effects

Keyboard shortcuts:

Space = pause

1 = x1 speed

2 = x2 speed

3 = x4 speed

R = retreat

## Tutorial

On the first run, display lightweight contextual hints:

1. "Your hero moves automatically."
2. "Defeat enemies to earn equipment and cards."
3. "Place cards to reshape the world."
4. "More danger means better rewards."
5. "Return to camp before the loop overwhelms you."

Do not use a long modal tutorial.

Teach through play.

## Simulation balancing

The first few minutes should follow this rhythm:

Loop 1:
Easy, player learns controls.

Loop 2:
First meaningful equipment upgrades.

Loop 3:
Enemy combinations become dangerous.

Loop 4+:
Player must actively decide whether to continue or retreat.

A normal run should become interesting within 30 seconds.

Do not make the player wait.

## Important implementation requirement

Build actual game state and systems rather than faking them visually.

Implement separate logical systems for:

* hero
* map
* movement
* combat
* enemy spawning
* cards
* equipment
* loot
* resources
* loop progression
* boss progression
* camp upgrades
* save state

Keep the JavaScript organized and readable.

## Originality requirement

The game may be inspired by the concept of an automatically looping roguelike expedition, but all names, art, UI layout, enemy designs, world lore, cards, effects, and presentation must be original.

Do not use any Loop Hero assets or reproduce its exact map, interface, cards, sprites, or terminology.

## Final quality bar

Treat this as a polished indie-game vertical slice, not a coding tutorial.

When I open the page, I should immediately be able to:

* see the hero moving around the loop
* watch automatic combat
* receive cards
* place cards onto the map
* alter enemy spawns and hero power
* equip loot
* complete increasingly dangerous loops
* decide whether to retreat
* eventually trigger and fight a boss
* return to camp and buy permanent upgrades
* begin another expedition

Prioritize game feel, readability, feedback, and a satisfying risk-versus-reward loop.

Do not stop at scaffolding, pseudocode, placeholder buttons, or TODO comments.

Make the complete playable experience in one pass.

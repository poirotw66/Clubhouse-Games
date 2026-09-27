You are a senior Frontend Engineer, Web API Engineer, AI Agent UX Designer, and interactive product-demo designer.

Build a complete, polished, fully runnable single-page HTML demo called:

WebMCP Mini Amazon

Do not give me a plan, architecture proposal, pseudocode, or partial snippets.

Directly implement the complete application.

The final result should clearly demonstrate how a human user and an AI agent can browse products, search, filter, compare products, manage a shopping cart, apply coupons, and prepare an order through the same shared application capability layer.

# Core Goal

Create a fictional e-commerce storefront inspired by modern marketplace experiences.

The website should support both:

1. Human interaction through normal UI
2. AI agent interaction through structured WebMCP tools

Both humans and AI agents must operate on exactly the same application state.

The central idea to demonstrate is:

"The AI agent does not inspect the DOM, guess button locations, or simulate clicks. The website directly exposes structured commerce capabilities through WebMCP."

Example:

Human:

searches for:
wireless mechanical keyboard

sets:
price < $3000
layout = 75%
wireless = true

then clicks:
Add to Cart

AI:

product_search({
"query": "mechanical keyboard",
"maxPrice": 3000,
"features": ["wireless", "75_percent"]
})

then:

cart_add({
"productId": "P-102"
})

Both paths must use the same underlying CommerceEngine.

# Final Deliverable

Create:

index.html

Prefer one self-contained HTML file containing:

* HTML
* CSS
* JavaScript
* embedded mock data

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
* fake remote APIs

The application must run directly in a browser.

# Optional Visual Assets

For anything that needs bitmaps/textures/sprites, product thumbnails, icon-like assets, decorative artwork, packaging mockups, branded-looking fictional products, or if it helps to have a mockup reference for any 3D models you build, feel free to use imagegen.

However:

* the final result must remain a fully functional HTML application
* generated assets should only support the UI
* do not replace the actual application with a static mockup
* avoid copyrighted logos and recognizable real-brand product artwork
* use fictional product brands

# Product Concept

The app is a fictional marketplace called:

MiniMart AI

or:

AgentMart

Use a small fictional catalog of approximately 24 to 36 products.

Product categories:

* Keyboards
* Mice
* Headphones
* Monitors
* Webcams
* Laptop Stands
* Chargers
* Smart Home
* Storage
* Accessories

Products should have realistic but fictional specifications.

Example fictional products:

NovaKey 75 Wireless
OrbitMouse Pro
EchoBeat ANC
PixelView 27Q
CloudCam 4K
LiftStand Air
VoltHub 100W
Nimbus SSD 2TB
Aura Light Mini
FlexCable USB-C

Do not use real Amazon product listings.

# Architecture

Use clear separation of concerns.

Suggested architecture:

CommerceEngine
CatalogState
SearchEngine
CartEngine
CheckoutEngine
ProductRenderer
UIController
WebMCPAdapter
ActivityLogger
UndoManager

The CommerceEngine must be the shared capability layer.

Data flow:

Human UI
↓
CommerceEngine
↓
Shared State
↓
Renderer

AI Agent
↓
WebMCP Tools
↓
CommerceEngine
↓
Shared State
↓
Renderer

WebMCP tools must not simulate clicks.

They must call domain methods directly.

# WebMCP

Use the current WebMCP page capability approach through:

document.modelContext

Use capability detection:

if ('modelContext' in document)

If unsupported:

* the store must remain completely usable by human users
* show:
  "WebMCP Unsupported"
* do not throw
* log a clear console message

If supported:

show:

"WebMCP Connected"

Register tools after the commerce engine is initialized.

Use:

await document.modelContext.registerTool({...})

Avoid duplicate registration.

# Product Data Model

Every product should include:

{
id,
name,
brand,
category,
price,
originalPrice,
rating,
reviewCount,
stock,
description,
features,
specs,
tags,
image,
shippingDays,
bestseller,
featured
}

Example:

{
"id": "P-101",
"name": "NovaKey 75 Wireless",
"brand": "NovaForge",
"category": "keyboards",
"price": 2490,
"originalPrice": 2990,
"rating": 4.8,
"reviewCount": 342,
"stock": 18,
"features": [
"wireless",
"bluetooth",
"75_percent",
"hot_swappable",
"rgb"
],
"shippingDays": 1
}

# Product Catalog

Seed the application with enough variation for meaningful AI reasoning.

Include products across different:

* price ranges
* ratings
* stock levels
* features
* shipping speeds
* categories

Examples:

Mechanical keyboards:

* budget wired
* wireless 75%
* premium low-profile
* silent office keyboard

Mice:

* gaming
* office ergonomic
* lightweight wireless

Headphones:

* ANC
* gaming headset
* budget wireless earbuds

Monitors:

* 24-inch FHD
* 27-inch QHD
* 32-inch 4K

This variation is important because agents need meaningful tradeoffs.

# Main UI

Create a polished e-commerce layout.

Header:

AgentMart

Search bar

Cart icon with count

WebMCP status badge

Optional small subtitle:

Shop through UI or AI tools.

Main content:

Left:
filters sidebar

Center:
product grid

Right or drawer:
cart / AI activity summary

Desktop:
3 to 4 product cards per row

Tablet:
2 to 3

Mobile:
1 to 2

# Visual Style

Use a polished modern commerce design.

Style direction:

* modern marketplace
* clean developer demo
* dark mode or elegant dark hybrid
* subtle glass panels
* restrained gradients
* crisp product cards
* polished hover states
* high-quality spacing
* subtle motion
* readable typography

Avoid copying Amazon's visual design exactly.

This is a fictional marketplace inspired by modern commerce experiences.

# Product Cards

Each product card should display:

* image or visual placeholder
* brand
* product name
* price
* optional original price
* rating
* review count
* 2 to 4 feature chips
* stock indicator
* shipping speed
* Add to Cart button
* Compare checkbox/button
* Details button

Example:

NovaKey 75 Wireless

★★★★★ 4.8 (342)

NT$2,490

Wireless
75%
Hot-swappable

Tomorrow delivery

[ Add to Cart ]

# Search

Provide a large search box.

Search against:

* product name
* brand
* category
* description
* features
* tags

Search should be case-insensitive.

Do not only search visible DOM text.

Use the underlying catalog data.

# Filters

Support filters:

Category
Minimum price
Maximum price
Minimum rating
In stock only
Free shipping / fast shipping
Features
Brand

Example feature filters:

wireless
bluetooth
usb_c
rgb
hot_swappable
anc
ergonomic
4k
qhd
100w
portable

# Sorting

Support:

Recommended
Price: Low to High
Price: High to Low
Rating
Most Reviewed
Fastest Shipping

Sorting should not modify product data.

# Product Details

Clicking a product opens a polished modal or drawer.

Display:

* larger product image
* description
* price
* full specifications
* features
* stock
* rating
* shipping estimate
* quantity
* Add to Cart

# Compare Products

Allow users to select up to 3 products for comparison.

Show a comparison drawer/modal/table containing:

* Price
* Rating
* Reviews
* Features
* Key specifications
* Shipping
* Stock

This feature is important for agent workflows.

Example AI request:

"Compare the three highest-rated wireless keyboards under NT$3,000."

# Cart

Create a functional shopping cart.

Cart state should contain:

{
productId,
quantity
}

Features:

* add
* remove
* update quantity
* clear cart
* subtotal
* discount
* shipping
* tax if desired
* final total

Do not allow quantity above available stock.

# Coupons

Include fictional coupons:

SAVE100
TECH10
FREESHIP

Example behavior:

SAVE100
NT$100 off orders above NT$1,500

TECH10
10% off eligible orders above NT$3,000
maximum discount NT$500

FREESHIP
free shipping

Only one coupon needs to be active at a time.

Show clear validation.

# Checkout

This is a demo checkout.

Do not ask for real payment information.

Create a Checkout Preview flow.

Show:

Items
Subtotal
Discount
Shipping
Total

Shipping options:

Standard
Express

Delivery information can use fictional/demo fields only.

Final button:

Place Demo Order

When clicked:

* create a fake order ID
* show success state
* log activity
* clear cart optionally after success
* do not process any real payment

# Order Preview

Example:

Order Summary

NovaKey 75 Wireless ×1
OrbitMouse Pro ×1

Subtotal: NT$4,280
Coupon: -NT$428
Shipping: NT$0

Total: NT$3,852

# Activity Log

Include a visible panel titled:

Agent Activity

or:

Commerce Activity

Each entry includes:

timestamp
source
action
summary

Sources:

UI
WebMCP
System

Example:

14:18:02 UI       search "mechanical keyboard"
14:18:09 WebMCP   product_search maxPrice=3000
14:18:13 WebMCP   product_compare P-101, P-106, P-110
14:18:20 WebMCP   cart_add P-101
14:18:27 WebMCP   coupon_apply TECH10
14:18:34 System   Checkout ready

Keep the latest 50 activities.

This panel is important for live demos.

# Agent Action Highlighting

When WebMCP modifies something:

* briefly highlight the affected product card
* animate cart count subtly
* show a toast

Examples:

AI Agent added NovaKey 75 Wireless to cart

AI Agent applied TECH10

AI Agent selected 3 products for comparison

Do not label normal UI interactions as AI actions.

# Undo

Support reasonable undo for:

* cart add
* cart remove
* cart quantity change
* coupon apply
* compare selection

Search and filters do not need undo.

# WebMCP Tools

Register structured tools using snake_case names.

Every tool must include:

* high-quality description
* JSON input schema
* input validation
* predictable return structure
* readOnlyHint where appropriate

At minimum implement the following tools.

# 1. store_get_state

Description:

Get the complete current storefront state including search query, filters, sorting, visible product IDs, selected comparison products, cart, coupon, pricing summary, and checkout state.

Input:

{}

Annotations:

readOnlyHint: true
consequentialHint: false
untrustedContentHint: false

# 2. product_search

Description:

Search and filter products using structured criteria. Use this instead of guessing what products are visible in the UI. Supports query text, categories, price range, minimum rating, features, stock availability, and shipping constraints.

Input example:

{
"query": "mechanical keyboard",
"category": "keyboards",
"maxPrice": 3000,
"minRating": 4.5,
"features": ["wireless", "75_percent"],
"inStockOnly": true,
"maxShippingDays": 2,
"sort": "rating_desc",
"limit": 10
}

All fields optional.

The tool should search underlying catalog data.

Return:

{
"count": 3,
"products": [...]
}

readOnlyHint: true

# 3. product_get

Input:

{
"productId": "P-101"
}

Return full product details.

readOnlyHint: true

# 4. product_get_recommendations

Input example:

{
"category": "keyboards",
"budget": 3000,
"priorities": [
"wireless",
"rating",
"fast_shipping"
],
"limit": 5
}

Use deterministic scoring logic based on product data.

Do not call an external AI service.

Return ranked recommendations with simple reasons.

readOnlyHint: true

# 5. product_compare

Input:

{
"productIds": [
"P-101",
"P-102",
"P-103"
]
}

Maximum:
3 products

Return a structured comparison.

Also update the UI compare panel so the human can see what the agent compared.

# 6. store_get_available_options

Description:

Return valid product categories, brands, features, sort options, coupons, shipping options, and supported price range.

Input:

{}

readOnlyHint: true

This prevents the AI agent from guessing valid enum values.

# 7. store_set_filters

Input example:

{
"category": "keyboards",
"minPrice": 1000,
"maxPrice": 3000,
"minRating": 4.5,
"features": ["wireless"],
"inStockOnly": true
}

All fields optional.

This changes the visible storefront filters.

# 8. store_clear_filters

Input:

{}

# 9. store_set_sort

Input:

{
"sort": "price_asc"
}

Valid values:

recommended
price_asc
price_desc
rating_desc
reviews_desc
shipping_asc

# 10. cart_get

Description:

Return all cart items, quantities, stock availability, subtotal, discount, shipping, and final estimated total.

Input:

{}

readOnlyHint: true

# 11. cart_add

Input:

{
"productId": "P-101",
"quantity": 1
}

Quantity optional, default 1.

Validate:

* product exists
* product is in stock
* requested quantity does not exceed stock

# 12. cart_remove

Input:

{
"productId": "P-101"
}

# 13. cart_set_quantity

Input:

{
"productId": "P-101",
"quantity": 2
}

If quantity is 0:

remove the item.

Do not allow negative quantity.

# 14. cart_clear

Input:

{}

# 15. cart_add_multiple

Input:

{
"items": [
{
"productId": "P-101",
"quantity": 1
},
{
"productId": "P-107",
"quantity": 2
}
]
}

Validate the entire batch before modifying the cart.

Do not partially add invalid batches.

# 16. coupon_apply

Input:

{
"code": "TECH10"
}

Coupon matching should be case-insensitive.

Return:

{
"success": true,
"code": "TECH10",
"discount": 428,
"newTotal": 3852
}

# 17. coupon_remove

Input:

{}

# 18. checkout_get_summary

Description:

Return a checkout-ready summary including cart items, subtotal, discounts, shipping, selected shipping method, and final total.

Input:

{}

readOnlyHint: true

# 19. checkout_set_shipping

Input:

{
"method": "express"
}

Valid:

standard
express

# 20. checkout_prepare

Description:

Validate whether the current cart can proceed to checkout. Check stock, quantities, coupon validity, totals, and shipping selection.

Input:

{}

Return:

{
"ready": true,
"issues": [],
"summary": {...}
}

readOnlyHint: true

# 21. checkout_place_demo_order

Description:

Place a simulated demo order using the current cart. This does not charge money or contact any external service.

Input:

{
"confirm": true
}

Require confirm=true.

Generate something like:

ORDER-20260910-4821

Show a success screen.

# 22. store_undo

Input:

{}

Undo the most recent cart, coupon, or compare mutation.

# 23. store_reset_demo

Input:

{}

Reset:

* filters
* sorting
* compare selections
* cart
* coupons
* checkout state

Do not wipe the product catalog.

# Tool Design Quality

Tool descriptions are extremely important.

Do not use vague descriptions such as:

"Search products."

Instead write:

"Search the underlying product catalog using structured commerce criteria such as query text, category, price range, minimum rating, features, stock availability, and shipping speed. Use this when the user asks to find products that meet specific requirements."

Agent tool choice should be obvious from tool descriptions.

# Agent Scenarios

The app must support realistic multi-step natural-language requests.

Example 1:

"Find me a wireless mechanical keyboard under NT$3,000 with at least a 4.5 rating."

Expected:

product_search

# Example 2

"Compare the three best wireless keyboards under NT$3,000."

Expected:

product_search
↓
product_compare

# Example 3

"Choose the highest-rated one and add it to my cart."

Expected:

use previous search/compare context
↓
cart_add

# Example 4

"I need a keyboard and mouse together for under NT$5,000."

Expected:

product_search for keyboards
↓
product_search for mice
↓
reason over results
↓
cart_add_multiple

# Example 5

"Find me an ergonomic wireless mouse under NT$2,000 and add the highest-rated one."

Expected:

product_search
↓
cart_add

# Example 6

"Apply the best available coupon to my cart."

Expected:

store_get_available_options
↓
cart_get
↓
reason over coupon rules
↓
coupon_apply

# Example 7

"Can I get this order by tomorrow?"

Expected:

cart_get
↓
inspect shippingDays
↓
checkout_get_summary

# Example 8

"Prepare checkout but don't place the order."

Expected:

checkout_prepare

# Example 9

"Place the demo order."

Expected:

checkout_prepare
↓
checkout_place_demo_order({
"confirm": true
})

# Suggested Agent Prompts Panel

Create a section titled:

Try asking your AI agent

Display prompts like:

"Find a wireless 75% mechanical keyboard under NT$3,000."

"Compare the three highest-rated wireless keyboards."

"Add the best one to my cart."

"Find me a keyboard and mouse combination under NT$5,000."

"Show me all 27-inch QHD monitors under NT$8,000."

"Find an ergonomic mouse with at least a 4.5 rating."

"Apply the best coupon available for my current cart."

"Can everything in my cart arrive within two days?"

"Prepare checkout, but do not place the order."

"Place my demo order."

"What's the best-value product currently in my cart?"

"Remove the most expensive item from my cart."

# AI Shopping Session Demo

Add a special small panel called:

Agent Mission

Default mission:

"Build a complete work-from-home setup under NT$10,000."

Allow the user to copy this prompt.

The product catalog should contain enough compatible items that the AI can potentially choose:

* keyboard
* mouse
* webcam or headset
* laptop stand

within the budget.

This is an important live-demo scenario.

# Cart Intelligence

Add small derived signals such as:

Cart Total

Savings

Items

Estimated Delivery

Possible Coupon

Example:

3 items
NT$7,840
Save NT$680
Fastest delivery: Tomorrow
TECH10 may save NT$500

These are calculated from local state.

# Store Intelligence Panel

Add a small panel called:

Shopping Signals

Examples:

5 wireless keyboards under NT$3,000

2 products in your cart have next-day delivery

TECH10 is currently the best coupon

1 cart item has only 2 units left

These should derive from CommerceEngine state.

# WebMCP Tool Inspector

Add a visible panel:

WebMCP Tool Inspector

For each registered tool display:

tool name
READ / WRITE badge
short description

Examples:

product_search           READ
product_compare          READ
cart_add                 WRITE
cart_set_quantity        WRITE
coupon_apply             WRITE
checkout_prepare         READ
checkout_place_demo_order WRITE

Include:

Refresh Tools

If:

document.modelContext.getTools

exists, use it where reasonable.

Otherwise show locally known registered tools.

Do not crash if getTools is unavailable.

# Traditional Agent vs WebMCP

Create a compact visual comparison.

Traditional Browser Agent:

Inspect DOM
↓
Find search field
↓
Type text
↓
Find filter
↓
Click option
↓
Scroll
↓
Find product
↓
Click Add to Cart

WebMCP Agent:

product_search(...)
↓
cart_add(...)

Make this visually clear without overwhelming the page.

# Search Result Explanation

When product_search is called through WebMCP:

briefly show something like:

AI searched:
wireless + 75% + ≤ NT$3,000

3 matches found

This makes structured tool usage visible during demos.

# Human and AI Shared State

If a human adds a product:

cart_get

must immediately return it.

If AI adds a product:

cart drawer must immediately display it.

If human applies a filter:

store_get_state

must reflect it.

If AI changes sorting:

the visible product grid must update.

There must never be separate AI and UI state.

# Persistence

Use localStorage for:

* cart
* compare products
* coupon
* filter state
* sort selection

Product catalog can remain embedded in code.

If localStorage is invalid:

fall back safely.

Provide:

Reset Demo

# Responsive Design

Desktop:

filters left
products center
cart/activity right or drawer

Tablet:

collapsible filters
2 to 3 columns

Mobile:

single column or compact 2-column cards
bottom cart button
full-screen product detail drawer

No accidental horizontal overflow.

# Accessibility

Provide:

* aria-labels
* semantic buttons
* keyboard focus styles
* proper labels for inputs
* sufficient contrast
* reduced-motion support

# Validation

Validate:

product IDs
quantities
stock
coupon codes
shipping methods
sort options
categories
price ranges
comparison limits

Batch cart operations must be atomic.

If one product is invalid:

do not partially modify the cart.

# Error Handling

Return predictable structured errors.

Example:

{
"success": false,
"error": "Product P-999 does not exist."
}

or:

{
"success": false,
"error": "Requested quantity exceeds available stock.",
"availableStock": 2
}

Never silently fail.

# Self Tests

Run non-destructive console self-tests with isolated engine state.

Test:

product search

price filter

feature filter

sorting

cart add

cart remove

quantity update

stock validation

coupon calculation

comparison

checkout preparation

batch add atomicity

undo

If a test fails:

console.error(...)

Do not modify live application state.

# Suggested JavaScript Sections

Organize code clearly:

CONFIG
CATALOG DATA
UTILITIES
SEARCH ENGINE
COMMERCE ENGINE
CART ENGINE
COUPON ENGINE
CHECKOUT ENGINE
UNDO MANAGER
RENDERER
PRODUCT MODAL
COMPARE UI
UI CONTROLLER
ACTIVITY LOGGER
WEBMCP ADAPTER
PERSISTENCE
SELF TESTS
INITIALIZATION

Use English:

function names
variable names
class names
comments

# Acceptance Tests

TEST 1

Open page.

Product catalog renders.

PASS.

TEST 2

Search:

wireless keyboard

Relevant products appear.

PASS.

TEST 3

Set max price:

NT$3,000

Results update.

PASS.

TEST 4

Call:

product_search({
"category": "keyboards",
"maxPrice": 3000,
"features": ["wireless"]
})

Correct structured results are returned.

PASS.

TEST 5

Call:

product_compare({
"productIds": ["P-101", "P-102"]
})

Comparison UI opens.

PASS.

TEST 6

Call:

cart_add({
"productId": "P-101",
"quantity": 1
})

Cart UI immediately updates.

PASS.

TEST 7

Human manually adds another product.

Calling:

cart_get()

returns both items.

PASS.

TEST 8

Apply:

TECH10

Correct discount appears.

PASS.

TEST 9

checkout_prepare()

returns ready=true for a valid cart.

PASS.

TEST 10

checkout_place_demo_order({
"confirm": true
})

Shows demo order success.

PASS.

TEST 11

WebMCP unsupported environment:

store remains fully usable.

PASS.

TEST 12

Refresh browser.

Cart and relevant UI state persist.

PASS.

TEST 13

Reset Demo.

State returns to original defaults.

PASS.

# Final Instruction

Directly build the complete index.html.

Do not only explain how to implement it.

Do not return pseudocode.

Do not omit WebMCP integration.

Do not leave TODO markers.

Do not create fake MCP server infrastructure.

Do not require a backend.

The final result should be polished enough for a live technical demo.

Within a few seconds, the viewer should understand:

"Instead of making an AI agent navigate an e-commerce UI, WebMCP lets the website expose search, comparison, cart, and checkout capabilities directly as structured tools."

The strongest demo flow should be:

Natural-language request
↓
product_search
↓
product_compare
↓
cart_add
↓
coupon_apply
↓
checkout_prepare
↓
visible UI updates

The human and AI agent must always share the exact same commerce state.

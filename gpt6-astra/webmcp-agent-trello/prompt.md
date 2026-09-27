You are a senior Frontend Engineer, Web API Engineer, AI Agent UX Designer, and interactive product-demo designer.

Build a complete, polished, fully runnable single-page HTML demo called:

WebMCP Agent Kanban Board

Do not give me a plan, architecture proposal, pseudocode, or partial snippets.

Directly implement the complete application.

The final result should clearly demonstrate how a human user and an AI agent can manage the exact same Kanban board through a shared application capability layer.

# Core Goal

Create a modern Kanban project-management application with WebMCP support.

A human should be able to manage tasks through the UI.

An AI agent should be able to manage the same tasks through structured WebMCP tools.

Both must operate on exactly the same application state.

The key concept to demonstrate is:

"The AI agent is not clicking buttons or guessing the DOM. The website directly exposes structured project-management capabilities through WebMCP."

Examples:

Human:
drag a task from TODO to DOING

AI:
task_move({
"taskId": "TASK-104",
"status": "doing"
})

Both operations must call the same underlying BoardEngine.

# Final Deliverable

Create:

index.html

Prefer a single self-contained HTML file containing:

* HTML
* CSS
* JavaScript

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
* backend services
* MCP server
* SSE
* WebSocket
* external database

The application must run directly in the browser.

# Optional Visual Assets

For anything that needs bitmaps/textures/sprites, avatar assets, decorative illustrations, background artwork, icon-like visual elements, or if it helps to have a mockup reference for any 3D models you build, feel free to use imagegen.

However:

* generated assets are optional
* the application must remain fully interactive
* do not replace the app with a static image
* prioritize clean UI over decorative assets

# WebMCP

Use the WebMCP Imperative API through:

document.modelContext

Use capability detection:

if ('modelContext' in document)

If unsupported:

* the Kanban board must remain completely usable
* show:
  "WebMCP Unsupported"
* do not crash
* log a clear console message

If supported:

show:

"WebMCP Connected"

Register tools after application state initialization.

Use:

await document.modelContext.registerTool({...})

Avoid duplicate registrations.

Do not implement WebMCP tools by triggering DOM clicks.

WebMCP tools must call domain logic directly.

# Application Architecture

Use clear separation of concerns.

Suggested architecture:

BoardEngine
BoardState
BoardRenderer
UIController
WebMCPAdapter
ActivityLogger
UndoManager

The BoardEngine must be the single source of truth.

Data flow:

Human UI
↓
BoardEngine
↓
Board State
↓
Renderer

AI Agent
↓
WebMCP Tools
↓
BoardEngine
↓
Board State
↓
Renderer

Both paths must modify the exact same state.

# Board Structure

Create four default columns:

BACKLOG
TODO
DOING
DONE

Each column shows:

* title
* task count
* tasks
* optional WIP indicator

Tasks can be:

* created
* edited
* moved
* deleted
* assigned
* prioritized
* tagged
* given due dates
* linked with dependencies

# Initial Demo Data

Start with realistic software / AI project tasks.

Example tasks:

TASK-101
Design Agent Architecture
Status: backlog
Priority: high
Assignee: Justin
Tags: architecture, ai

TASK-102
Implement WebMCP Adapter
Status: todo
Priority: critical
Assignee: Mia
Tags: frontend, webmcp

TASK-103
Build RAG Evaluation Dataset
Status: todo
Priority: medium
Assignee: Kevin
Tags: rag, evaluation

TASK-104
Implement Authentication
Status: doing
Priority: high
Assignee: Justin
Tags: security

TASK-105
Create Demo Dashboard
Status: doing
Priority: medium
Assignee: Emma
Tags: frontend

TASK-106
Deploy PoC
Status: done
Priority: high
Assignee: Mia
Tags: cloud

TASK-107
Write Technical Documentation
Status: backlog
Priority: low
Assignee: unassigned
Tags: docs

Make the initial board look alive and believable.

# Task Data Model

Every task should contain:

{
id,
title,
description,
status,
priority,
assignee,
tags,
dueDate,
createdAt,
updatedAt,
dependencies,
completed
}

Statuses:

backlog
todo
doing
done

Priorities:

low
medium
high
critical

# Visual Design

Create a polished developer-product interface.

Style direction:

* Linear
* GitHub Projects
* Notion
* modern AI developer tooling
* dark mode
* subtle glass surfaces
* restrained gradients
* clean typography
* developer-friendly
* subtle motion
* polished SaaS dashboard

Avoid overly playful design.

The Kanban board should immediately look like a serious productivity application.

# Layout

Top navigation:

WebMCP Agent Kanban

Subtitle:

Manage project work through UI or AI tools.

Right side:

WebMCP ● Connected

or:

WebMCP ● Unsupported

Below header:

Project summary bar showing:

Total Tasks
Backlog
Todo
Doing
Done
High Priority
Overdue

Main area:

four Kanban columns horizontally on desktop.

Allow horizontal scrolling on narrower screens.

Each column should have its own subtle visual identity.

# Task Cards

Each task card should display:

Task ID
Title
Priority badge
Assignee
Tags
Due date
Dependency indicator if present

Optional small avatar circle with initials.

Example:

TASK-104

Implement Authentication

HIGH

Justin

security
backend

Due Sep 15

# Drag and Drop

Human users must be able to drag and drop tasks between columns.

Use native browser APIs or lightweight custom logic.

Do not require external libraries.

When a task is dropped:

* BoardEngine updates task status
* updatedAt changes
* activity log records action
* UI re-renders
* WebMCP get_state sees the new status

Dragging must not create separate UI-only state.

# Task Creation

Add:

* New Task

Opening a modal or drawer with:

Title
Description
Status
Priority
Assignee
Tags
Due Date

Validate required fields.

Create stable task IDs automatically:

TASK-108
TASK-109
...

Do not reuse deleted IDs.

# Task Editing

Clicking a task should open a detail panel or modal.

Allow editing:

* title
* description
* status
* priority
* assignee
* tags
* due date
* dependencies

# Filtering

Add a filter bar.

Support filters by:

* status
* priority
* assignee
* tag
* search keyword
* overdue
* unassigned

The filter must only affect visibility.

It must not mutate task state.

# Search

Include search input.

Search:

* task title
* task ID
* description
* tags
* assignee

# Sorting

Allow sorting cards inside a column by:

* manual
* priority
* due date
* updated time

# Undo

Add an Undo button.

Support undo for:

* create
* edit
* move
* delete
* assign
* priority changes
* batch operations

Use snapshots or command history.

Undo should revert one logical action.

# Activity Log

Add a visible:

Agent Activity

or:

Activity Log

panel.

Each entry shows:

timestamp
source
action
summary

Sources:

UI
WebMCP
System

Example:

14:03:12 UI       task_move TASK-104 → doing
14:03:18 WebMCP   task_update TASK-102 priority=critical
14:03:23 WebMCP   task_create "Test Agent Guardrails"
14:03:29 System   2 overdue tasks detected

Keep the latest 50 entries.

This panel is important for demonstrating that AI actions are coming through WebMCP rather than browser clicking.

# Toasts

Show polished toast notifications.

Examples:

AI Agent moved TASK-102 to Doing

AI Agent created TASK-108

Priority changed to Critical

3 tasks updated

Task deleted

Task restored

Do not label UI actions as AI actions.

# Batch Operations

WebMCP should support meaningful multi-task operations.

The AI agent should be able to:

* move multiple tasks
* change priority on multiple tasks
* assign multiple tasks
* add a tag to multiple tasks

Batch operations are important because they show an advantage over manually clicking UI elements.

# Dependencies

Tasks may depend on other tasks.

Example:

TASK-110 depends on TASK-102

Show dependency chips or icons.

A task may contain:

dependencies: ["TASK-102"]

Optionally visually warn if a task is moved to DONE while dependencies are incomplete.

Do not hard-block unless you choose to provide a clear validation message.

# WebMCP Tools

Register the following tools.

Use snake_case names.

Every tool must have:

* high-quality description
* JSON input schema
* validation
* predictable structured return
* appropriate readOnlyHint when applicable

# 1. board_get_state

Description:

Get the complete current Kanban board state including columns, tasks, visible filters, project statistics, and current sorting configuration.

Input:

{}

Annotations:

readOnlyHint: true
consequentialHint: false
untrustedContentHint: false

Return structured data.

Example:

{
"columns": {
"backlog": [...],
"todo": [...],
"doing": [...],
"done": [...]
},
"stats": {
"total": 12,
"highPriority": 4,
"overdue": 2
}
}

# 2. board_get_summary

Description:

Return a concise project summary including task counts, workload by assignee, priority distribution, overdue tasks, and blockers.

Input:

{}

readOnlyHint: true

This tool should be useful when the agent is asked:

"How is the project doing?"

# 3. task_get

Input:

{
"taskId": "TASK-102"
}

Return full task details.

readOnlyHint: true

# 4. task_create

Input schema should support:

{
"title": "Implement audit logging",
"description": "...",
"status": "todo",
"priority": "high",
"assignee": "Justin",
"tags": ["security", "backend"],
"dueDate": "2026-09-18"
}

Only title is strictly required.

Use sensible defaults for omitted values.

# 5. task_update

Allow editing one or multiple properties.

Input:

{
"taskId": "TASK-102",
"updates": {
"priority": "critical",
"assignee": "Justin"
}
}

Validate field names and enum values.

# 6. task_move

Input:

{
"taskId": "TASK-102",
"status": "doing"
}

Statuses:

backlog
todo
doing
done

Update:

status
updatedAt
completed state if appropriate

# 7. task_delete

Input:

{
"taskId": "TASK-102"
}

Delete the task and update UI.

Return enough information for logging and undo.

# 8. task_assign

Input:

{
"taskId": "TASK-102",
"assignee": "Justin"
}

Support:

"unassigned"

# 9. task_set_priority

Input:

{
"taskId": "TASK-102",
"priority": "critical"
}

# 10. task_add_tag

Input:

{
"taskId": "TASK-102",
"tag": "webmcp"
}

Avoid duplicate tags.

# 11. task_remove_tag

Input:

{
"taskId": "TASK-102",
"tag": "webmcp"
}

# 12. task_set_due_date

Input:

{
"taskId": "TASK-102",
"dueDate": "2026-09-20"
}

Allow:

null

to clear the due date.

# 13. task_add_dependency

Input:

{
"taskId": "TASK-110",
"dependsOn": "TASK-102"
}

Prevent:

* self-dependency
* duplicate dependency

# 14. task_remove_dependency

Input:

{
"taskId": "TASK-110",
"dependsOn": "TASK-102"
}

# 15. board_search_tasks

Input may contain:

{
"query": "WebMCP",
"status": ["todo", "doing"],
"priority": ["high", "critical"],
"assignee": "Justin",
"tags": ["frontend"],
"overdue": false
}

All fields optional.

This tool should search underlying task data, not only currently visible DOM cards.

Return matching task IDs and summaries.

readOnlyHint: true

# 16. board_get_overdue_tasks

Input:

{}

Return overdue incomplete tasks.

readOnlyHint: true

# 17. board_get_blocked_tasks

Input:

{}

A task is considered blocked when one or more dependencies are not completed.

Return:

task
blocking dependencies

readOnlyHint: true

# 18. board_batch_move

Input:

{
"taskIds": [
"TASK-102",
"TASK-103"
],
"status": "doing"
}

Validate all tasks before performing the operation.

Do not partially execute an invalid batch.

# 19. board_batch_assign

Input:

{
"taskIds": [
"TASK-102",
"TASK-103"
],
"assignee": "Justin"
}

# 20. board_batch_set_priority

Input:

{
"taskIds": [
"TASK-102",
"TASK-103"
],
"priority": "high"
}

# 21. board_batch_add_tag

Input:

{
"taskIds": [
"TASK-102",
"TASK-103"
],
"tag": "sprint-1"
}

# 22. board_get_assignee_workload

Input:

{}

Return something like:

{
"Justin": {
"total": 4,
"doing": 2,
"highPriority": 2
}
}

readOnlyHint: true

# 23. board_get_available_options

Description:

Return all valid enums and options the agent may use.

Input:

{}

Return:

statuses
priorities
known assignees
existing tags
sorting modes

readOnlyHint: true

This prevents the agent from guessing enum values.

# 24. board_reset_demo

Input:

{}

Reset board back to the original demo dataset.

Clearly mark this as a write action.

# 25. board_undo

Input:

{}

Undo the latest logical board modification.

# Agent-Oriented Tool Design

Tool descriptions must clearly explain:

* what the tool does
* when the agent should use it
* whether it changes board state
* what valid values are
* whether multiple tools may be needed

Avoid vague descriptions.

Example:

Bad:

"Move task."

Good:

"Move a task to another Kanban workflow status. Use this when changing a task between backlog, todo, doing, or done. This updates the underlying shared board state and immediately updates the UI."

# Important Agent Scenarios

The application must support realistic natural-language requests.

Example 1:

"Move all critical TODO tasks to Doing."

Expected behavior:

board_search_tasks
↓
board_batch_move

Example 2:

"Assign all unassigned frontend tasks to Justin."

Expected:

board_search_tasks
↓
board_batch_assign

Example 3:

"Which tasks are blocking the project?"

Expected:

board_get_blocked_tasks

Example 4:

"Create a high-priority task called 'Test WebMCP Guardrails', assign it to Justin, and put it in TODO."

Expected:

task_create

Example 5:

"Move TASK-102 to Done."

Expected:

task_move

Example 6:

"Show me overdue tasks owned by Justin."

Expected:

board_search_tasks

Example 7:

"Tag every active AI-related task with sprint-1."

Expected:

board_search_tasks
↓
board_batch_add_tag

# AI Prompt Examples

Create a panel titled:

Try asking your AI agent

Display example prompts:

"Create a critical task called Test WebMCP Guardrails and assign it to Justin."

"Move all critical TODO tasks into Doing."

"Show me all overdue tasks."

"Which tasks are currently blocked?"

"Assign all unassigned frontend tasks to Justin."

"Set every active security task to High priority."

"Move TASK-104 to Done."

"Give me a summary of the current project."

"Who currently has the most work?"

"Add the sprint-1 tag to every task in Doing."

"Create three tasks for testing, documentation, and deployment."

These examples should visually help explain what WebMCP enables.

# Agent Activity Highlight

When an action originates from WebMCP:

briefly highlight the affected card.

Example:

TASK-102 glows subtly for 800ms.

If multiple tasks are changed:

highlight all affected cards.

This creates a clear live-demo effect.

Do not use excessive animation.

# WebMCP Tool Inspector

Add a panel:

WebMCP Tool Inspector

List registered tools.

For each:

tool name
READ / WRITE badge
short description

Example:

board_get_state          READ
task_create              WRITE
task_move                WRITE
board_search_tasks       READ
board_batch_move         WRITE

Include:

Refresh Tools

If:

document.modelContext.getTools

exists, use it where reasonable.

If unavailable, gracefully show the known registered tools.

# Stats Dashboard

At the top of the board, compute live statistics:

Total Tasks
Todo
Doing
Done
Critical
Overdue
Blocked

All values must update whenever board state changes.

# Board Intelligence Panel

Add a compact panel called:

Project Signals

Automatically compute useful signals such as:

2 overdue tasks

1 blocked task

Justin has 3 active tasks

2 critical tasks are still in TODO

This is purely derived from BoardEngine state.

It should update automatically.

# Persistence

Use localStorage so board state survives refresh.

Provide:

Reset Demo

to restore the original dataset.

Do not allow corrupted localStorage data to break the app.

Validate loaded data and fall back safely.

# Responsive Behavior

Desktop:

Kanban board horizontally arranged.

Tablet:

smaller cards and horizontal scrolling.

Mobile:

horizontal column scrolling with touch-friendly layout.

Task modals must fit smaller screens.

No accidental page-level horizontal overflow outside the board area.

# Accessibility

Include:

* semantic buttons
* aria labels
* visible focus styles
* keyboard-friendly controls
* sufficient contrast
* reduced-motion support

# Validation

All task IDs must exist before updates.

Validate:

status
priority
dates
dependency task IDs
tags
assignee values where appropriate

Batch operations must be atomic:

validate every target first.

If one target is invalid:

do not partially update.

Return a useful error.

# Error Handling

WebMCP tools should return structured errors.

Example:

{
"success": false,
"error": "TASK-999 does not exist."
}

Never silently fail.

# Self Tests

Run basic non-destructive tests in console using isolated BoardEngine instances.

Test:

create task

update task

move task

delete task

undo

batch move

dependency detection

overdue detection

priority filtering

draft persistence

If something fails:

console.error

Do not modify live board state.

# How WebMCP Works

At the bottom create a short explanation:

How WebMCP powers this board

1. The page exposes structured project-management capabilities.
2. The AI agent discovers those capabilities.
3. The agent reads project state when needed.
4. The agent chooses appropriate tools.
5. BoardEngine updates the shared application state.
6. The same Kanban UI immediately reflects those changes.

Show this architecture:

AI Agent
↓
WebMCP Tools
↓
BoardEngine
↓
Shared Board State
↓
Kanban UI

Human User
↓
UI Controls / Drag & Drop
↓
BoardEngine

Emphasize visually:

AI and humans use the same underlying capability layer.

# Demo Narrative

The UI should make it easy to explain:

Traditional browser agent:

AI
→ inspect DOM
→ find card
→ find button
→ click
→ wait
→ inspect page again

WebMCP agent:

AI
→ board_search_tasks()
→ board_batch_move()

This comparison may be shown as a small visual card.

# Engineering Rules

1. BoardEngine is the single source of truth.
2. WebMCP tools must never simulate UI clicks.
3. UI and WebMCP use the same BoardEngine methods.
4. Filtering does not mutate board state.
5. Drag and drop must update BoardEngine state.
6. Batch operations must be atomic.
7. All inputs must be validated.
8. Do not use eval().
9. No fake backend.
10. No placeholder code.
11. Unsupported WebMCP must degrade gracefully.
12. Keep code modular even inside one HTML file.
13. Use English function and variable names.
14. Use English source-code comments.
15. Avoid Simplified Chinese in source-code comments.

# Suggested Code Sections

Inside the HTML organize JavaScript into clear sections:

CONFIG
INITIAL DEMO DATA
UTILITIES
BOARD ENGINE
UNDO MANAGER
FILTER ENGINE
BOARD RENDERER
DRAG AND DROP
MODALS
UI CONTROLLER
ACTIVITY LOGGER
WEBMCP ADAPTER
SELF TESTS
PERSISTENCE
INITIALIZATION

# Acceptance Tests

TEST 1

Open page.

Four Kanban columns render.

PASS.

TEST 2

Drag TASK-102 from TODO to DOING.

Board state changes.

PASS.

TEST 3

Refresh page.

Task remains in DOING.

PASS.

TEST 4

Call:

task_move({
"taskId": "TASK-103",
"status": "doing"
})

UI immediately updates.

PASS.

TEST 5

Call:

task_create({
"title": "Test WebMCP Guardrails",
"priority": "critical",
"assignee": "Justin",
"status": "todo"
})

New card appears.

PASS.

TEST 6

Call:

board_search_tasks({
"priority": ["critical"],
"status": ["todo"]
})

Correct matching tasks returned.

PASS.

TEST 7

Call:

board_batch_move({
"taskIds": [...],
"status": "doing"
})

All cards move atomically.

PASS.

TEST 8

Call:

board_get_state()

Returned state exactly matches current UI state.

PASS.

TEST 9

Click Undo after an AI task move.

Previous state restored.

PASS.

TEST 10

Create dependency:

TASK-110 depends on TASK-102

If TASK-102 is incomplete:

board_get_blocked_tasks()

returns TASK-110.

PASS.

TEST 11

If WebMCP is unavailable:

Kanban UI still works completely.

PASS.

TEST 12

Reset Demo restores original project state.

PASS.

# Final Instruction

Directly build the complete index.html.

Do not only describe how it should work.

Do not return pseudocode.

Do not omit WebMCP implementation.

Do not leave TODO markers.

Do not create fake MCP infrastructure.

The final demo should make this idea visually obvious within seconds:

"An AI agent can manage a real application through structured WebMCP capabilities instead of manipulating the UI."

The result should be polished enough for a live technical presentation.

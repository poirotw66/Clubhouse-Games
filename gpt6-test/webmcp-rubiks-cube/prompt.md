你是一位資深 Frontend Engineer、Web API Engineer 與互動式 Web Demo Designer。

請直接建立一個「WebMCP Rubik's Cube」完整可執行 Demo。

不要只提供規格、Pseudo Code 或部分範例。
請直接完成所有 HTML、CSS、JavaScript 與 WebMCP integration，確保開啟後可以實際操作。

# 核心目標

建立一個支援 WebMCP 的互動式魔術方塊網站。

網站同時支援：

* 2×2 Rubik's Cube
* 3×3 Rubik's Cube
* 人類透過 UI 操作
* AI Agent 透過 WebMCP Tools 操作
* UI 與 WebMCP 共用同一份 Cube State，不可各自維護狀態
* Agent 操作後，畫面必須立即同步更新
* 使用者操作後，Agent 查詢 state 也必須立即取得最新狀態

這個 Demo 的核心概念是：

「不要讓 AI Agent 看 DOM、猜按鈕、模擬點擊，而是讓網站直接透過 WebMCP 暴露 Rubik's Cube 的能力。」

# 技術限制

建立：

index.html

即可直接執行。

優先使用：

* Vanilla HTML
* Vanilla CSS
* Vanilla JavaScript
* CSS 3D Transform

不要使用 React、Vue、Angular。
不要需要 npm install。
不要需要 build step。
不要建立 Backend。
不要建立 MCP Server。
WebMCP 必須直接運行在 Browser Page Context。

整個 Demo 最好只需要：

index.html

即可執行。

若程式碼較多，仍優先維持 Single HTML Demo，CSS 與 JavaScript 直接放在 HTML 中。

# WebMCP API

使用目前新版 WebMCP Imperative API：

document.modelContext

並使用：

await document.modelContext.registerTool({...})

不要以已 deprecated 的 navigator.modelContext 作為主要實作。

必須先做 capability detection：

if ('modelContext' in document)

如果目前瀏覽器沒有 WebMCP：

* 網站仍然可以正常玩魔術方塊
* 不可以 throw error
* UI 顯示：
  "WebMCP Unsupported"
* Console 顯示清楚提示

如果支援：

顯示：

"WebMCP Connected"

並註冊所有 Rubik's Cube tools。

# Cube Architecture

請將魔方邏輯與 UI rendering 完全分離。

例如：

CubeEngine
CubeRenderer
CubeController
WebMCPAdapter

概念上應該類似：

CubeEngine
→ 唯一 State Source

CubeRenderer
→ 將 CubeEngine state 畫到畫面

UI Controller
→ 呼叫 CubeEngine

WebMCP Tools
→ 呼叫 CubeEngine

所有操作最終都必須走：

CubeEngine

禁止 WebMCP Tool 直接 manipulate DOM。

# Cube State

Cube Engine 必須真正維護合法 Rubik's Cube state。

不要只做視覺動畫。

至少正確支援：

U
U'
U2

D
D'
D2

L
L'
L2

R
R'
R2

F
F'
F2

B
B'
B2

同一套 Move Engine 必須可以支援：

2×2
3×3

切換 Cube Size 時建立對應的新 cube state。

建議採用可靠且可維護的 sticker/cubie permutation model。

每次 move 都必須：

1. 修改 Cube State
2. 更新 move history
3. 更新 move counter
4. Render UI
5. 更新 solved 狀態

不要只交換 CSS class。

# 3D Cube UI

畫面中央呈現真正具有立體感的 Rubik's Cube。

要求：

* Perspective
* CSS 3D transforms
* 明顯 cube depth
* sticker 有微小間距
* 黑色 cube body
* sticker 有圓角
* subtle shadow
* smooth rotation animation
* 整體質感像 developer demo，而不是兒童遊戲網站

標準六色：

U = White
D = Yellow
F = Green
B = Blue
R = Red
L = Orange

需要能清楚看到至少三個面。

Cube 本體可以：

* Mouse drag 旋轉觀看角度
* Touch drag
* 不因為旋轉視角而修改 cube state

視角 rotation 與 cube move 必須是完全不同的兩件事情。

# Layout

整體做成 modern developer tool / AI demo 風格。

Dark theme。

頁首：

WebMCP Rubik's Cube

副標：

Control a Rubik's Cube through UI or AI tools.

右上角顯示：

WebMCP
● Connected

或：

● Unsupported

主要區域：

左側：
3D Rubik's Cube

右側：
Control Panel

Control Panel 包含：

Cube Size

[ 2 × 2 ]
[ 3 × 3 ]

Actions：

[ Scramble ]
[ Reset ]
[ Undo ]

Move Controls：

U U' U2
D D' D2
L L' L2
R R' R2
F F' F2
B B' B2

Algorithm Input：

[R U R' U']

[ Execute ]

下面顯示：

Moves: 12
Status: Scrambled / Solved

# Move History

顯示最近操作：

R
U
R'
U'

History 應該可以水平排列或放在小 panel。

Reset 時清空。

Scramble 時可以紀錄 scramble sequence，但 move counter 最好 reset 為 0，讓使用者從 scramble 後開始計算解題步數。

# Scramble

Scramble 產生合理隨機 move sequence。

2×2：
約 10～12 moves

3×3：
約 20～25 moves

避免：

R R'
R R
U U'

這類立即互相抵銷或同面連續 move。

Scramble 完成後顯示 scramble notation，例如：

R U2 F' L D2 R' B U F2 ...

提供：

Copy Scramble

按鈕。

# Algorithm Parser

支援輸入例如：

R U R' U'

R U2 R' U' R U' R'

F R U R' U' F'

parser 必須：

* trim whitespace
* split tokens
* validate notation
* 不合法 notation 不可以執行
* UI 顯示錯誤訊息
* 不允許 eval()
* 不要 partially execute invalid algorithm

合法格式只有：

^[UDLRFB](2|')?$

# Animation

Move 操作應該有簡單流暢動畫。

Animation duration 約：

180～300ms

如果一次執行 algorithm：

R U R' U'

應逐步播放，而不是瞬間全部變化。

同時需要避免 race condition。

建立 move queue。

不論：

* UI button
* algorithm input
* WebMCP

都使用相同 queue。

# WebMCP Tools

請至少註冊以下 Tools。

工具名稱使用 snake_case。

---

## 1. cube_get_state

Description：

Get the current Rubik's Cube state, cube size, solved status, move count, move history, and current scramble.

Input：

{}

Annotations：

readOnlyHint: true
consequentialHint: false
untrustedContentHint: false

回傳 structured JSON string，例如：

{
"size": 3,
"solved": false,
"moveCount": 7,
"history": ["R", "U", "R'", "U'"],
"scramble": "F R2 U' ...",
"faces": {
"U": [...],
"D": [...],
"L": [...],
"R": [...],
"F": [...],
"B": [...]
}
}

---

## 2. cube_set_size

讓 Agent 切換：

2×2
3×3

Input Schema：

{
"size": {
"type": "integer",
"enum": [2, 3]
}
}

修改 size 時：

* Reset cube
* Clear history
* Clear scramble
* Render UI

Annotations：

readOnlyHint: false
consequentialHint: false

---

## 3. cube_move

讓 Agent 執行單一 move。

Input：

{
"move": "R"
}

允許：

U U' U2
D D' D2
L L' L2
R R' R2
F F' F2
B B' B2

例如 Agent 可以呼叫：

cube_move({
"move": "R"
})

Tool execute 完成後回傳：

{
"success": true,
"move": "R",
"moveCount": 8,
"solved": false
}

---

## 4. cube_execute_algorithm

這是 Agent 最重要的 tool。

Input：

{
"algorithm": "R U R' U'"
}

Tool 必須：

* validate algorithm
* enqueue moves
* sequentially animate
* update cube state
* update history
* update UI
* wait until sequence execution completes
* 再 resolve execute()

回傳例如：

{
"success": true,
"executed": ["R", "U", "R'", "U'"],
"moveCount": 11,
"solved": false
}

這樣 AI Agent 不需要為每一步 call 一次 tool。

---

## 5. cube_scramble

Input：

{}

或：

{
"moves": 20
}

moves 可以 optional。

限制合理範圍，例如：

1～100

若沒有傳：

2×2 = 11
3×3 = 20

Tool 執行後回傳：

{
"size": 3,
"scramble": "R F2 U' ...",
"solved": false
}

Scramble 動畫可以快速播放或直接套用，但 UI 最終狀態必須正確。

---

## 6. cube_reset

Reset cube to solved state。

Input：

{}

執行後：

* solved = true
* moveCount = 0
* clear history
* clear scramble

---

## 7. cube_undo

Undo previous user/agent solving move。

Input：

{}

必須使用 inverse move。

例如：

R → R'
R' → R
R2 → R2

Undo 本身不要再造成 history stack 錯亂。

---

## 8. cube_check_solved

Input：

{}

Annotations：

readOnlyHint: true

回傳：

{
"solved": true,
"size": 3,
"moveCount": 32
}

---

## 9. cube_get_available_moves

Input：

{}

Annotations：

readOnlyHint: true

回傳：

[
"U","U'","U2",
"D","D'","D2",
"L","L'","L2",
"R","R'","R2",
"F","F'","F2",
"B","B'","B2"
]

這個 Tool 的目的，是讓 Agent 不需要自己猜操作 notation。

# WebMCP Tool Description Quality

Tool descriptions 非常重要。

不要只寫：

"Move cube"

而要讓 Agent 能清楚理解：

* Tool 的用途
* 什麼時候應該使用
* 參數代表什麼
* Tool 是否會改變 cube
* 可以搭配哪個 tool 使用

例如 cube_execute_algorithm description：

"Execute a sequence of standard Rubik's Cube moves on the currently selected cube. Use this when multiple moves are required. Supports U, D, L, R, F, B with optional prime (') or 2 modifiers. The sequence is validated completely before execution."

# WebMCP Debug Panel

網站底部增加：

WebMCP Tool Inspector

顯示目前網站暴露的 tools：

cube_get_state
cube_set_size
cube_move
cube_execute_algorithm
cube_scramble
cube_reset
cube_undo
cube_check_solved
cube_get_available_moves

每個顯示：

Tool Name
Read / Write badge
簡短 Description

另外提供：

[ Refresh Tools ]

如果：

document.modelContext.getTools

存在，可以取得目前 registered tools。

不要因為 getTools 不存在而 crash。

# Activity Log

增加一個 Agent Activity panel。

例如：

12:03:18  UI       cube_move R
12:03:21  WebMCP   cube_get_state
12:03:25  WebMCP   cube_execute_algorithm "R U R' U'"
12:03:31  System   Cube solved

來源至少區分：

UI
WebMCP
System

讓 Demo 時可以非常直觀看出：

AI Agent 並不是在點畫面，而是直接呼叫 WebMCP Tools。

最多保存最近 50 筆。

# Demo Commands

在畫面右側額外放一個：

"Try asking your AI agent"

的小卡片。

裡面顯示幾個 Prompt Example：

"Scramble the 3×3 cube."

"Show me the current cube state."

"Execute R U R' U'."

"Reset the cube."

"Switch to a 2×2 cube and scramble it."

"Check whether the cube is solved."

以及進階：

"Apply the sexy move six times."

這個應該可以讓 Agent：

1. cube_execute_algorithm
2. 執行 "R U R' U'" × 6
3. 最終 cube 回到 solved

這也是 Demo 的一個重要驗證案例。

# Toast

WebMCP 執行操作時顯示簡單 toast：

AI Agent → R U R' U'

或：

AI Agent scrambled the cube.

UI 使用者操作不要假裝是 AI。

# Accessibility

Button 加 aria-label。

Color sticker 不要完全只依賴顏色辨識，可提供：

data-face
title

適當 keyboard focus style。

prefers-reduced-motion 時降低或關閉動畫。

# Responsive

Desktop：

Cube 左
Panel 右

Mobile：

Cube 上
Panel 下

不要出現 horizontal overflow。

# Visual Style

設計語言：

* Chrome AI Demo
* Developer Tool
* Dark mode
* subtle glassmorphism
* indigo / violet accent
* monospace code badges
* restrained animation
* clean typography

背景不要太花。

Rubik's Cube 本身必須成為視覺焦點。

WebMCP Connected badge 可以有非常淡的綠色 pulse。

不要過度 cyberpunk。

# Important Engineering Rules

1. Cube state 必須是真的，不是假的 animation。
2. UI 與 WebMCP 必須使用同一 CubeEngine。
3. WebMCP Tool 不可以透過 document.querySelector().click() 模擬 UI。
4. Tool 應直接呼叫 domain logic。
5. 所有輸入必須 validation。
6. 不可以使用 eval()。
7. algorithm 必須先完整驗證才執行。
8. Tool error 應回傳清楚訊息。
9. WebMCP unavailable 時 Demo 仍可正常運作。
10. WebMCP Tool execution 必須觸發 UI re-render。
11. UI action 必須影響 WebMCP get_state 回傳結果。
12. 不要建立假的 MCP Server。
13. 不使用 SSE。
14. 不使用 stdio。
15. 不需要 Backend。
16. 不要將 WebMCP 與傳統 Backend MCP 混淆。

# State Validation

請寫最基本的自動 self-test。

例如在初始化時，只於 console 執行：

R + R' → solved

U2 + U2 → solved

R R R R → solved

R U R' U' repeated 6 times → solved

如果任一測試失敗：

console.error

但不能破壞正式 cube state。

Self-test 使用獨立 CubeEngine instance。

# Solved Detection

不能只靠 moveCount。

應確認每個 face 的所有 stickers 是否為同一顏色。

例如：

U 全部 white
D 全部 yellow
F 全部 green
B 全部 blue
R 全部 red
L 全部 orange

# Initialization

Default：

3×3

Solved state。

預設視角稍微：

rotateX(-25deg)
rotateY(35deg)

讓使用者一進網站就看到三個面。

# WebMCP Registration Lifecycle

所有 tools 在 DOM ready 且 CubeEngine 初始化完成後 register。

避免 duplicate registration。

若重新初始化 UI，不要重複 register 相同 tool。

可以使用：

webMCPRegistered = true

或合理 lifecycle management。

# Code Quality

即使全部放在 single HTML，也要有明確區塊：

CONFIG
UTILITIES
CUBE ENGINE
CUBE RENDERER
MOVE QUEUE
UI CONTROLLER
WEBMCP ADAPTER
ACTIVITY LOGGER
SELF TEST
INITIALIZATION

Function / variable names 使用英文。

Code comments 使用英文。

UI 可以使用英文。

不要產生 Simplified Chinese source code comments。

# README IN PAGE

在頁面最底部增加：

How WebMCP works

簡短說明：

1. The page exposes structured Rubik's Cube tools.
2. An AI agent discovers the available tools.
3. The agent calls the tools with structured arguments.
4. CubeEngine changes the application state.
5. The UI immediately reflects the same state.

再用一個小型架構圖：

AI Agent
↓
WebMCP Tools
↓
CubeEngine
↓
Cube State
↓
3D UI

UI Controls
↓
CubeEngine

明確表達：

Agent 和 Human 操作的是同一個 application capability layer。

# Acceptance Tests

完成後請自行確認：

TEST 1

開啟頁面。

看到 3×3 solved cube。

PASS。

TEST 2

按 R。

cube state 改變。

PASS。

TEST 3

按 R'。

回到 solved。

PASS。

TEST 4

切換 2×2。

畫面真的變成每面 2×2。

PASS。

TEST 5

Scramble。

Cube state 改變且不是 solved。

PASS。

TEST 6

Reset。

回到 solved。

PASS。

TEST 7

執行：

R U R' U'

Cube 正確變化。

PASS。

TEST 8

執行：

R U R' U'
R U R' U'
R U R' U'
R U R' U'
R U R' U'
R U R' U'

最終 solved = true。

PASS。

TEST 9

WebMCP 支援環境中：

document.modelContext.getTools()

可以看到 Rubik's Cube tools。

PASS。

TEST 10

Agent 呼叫：

cube_set_size({size:2})

UI 立刻變成 2×2。

PASS。

TEST 11

Agent 呼叫：

cube_execute_algorithm({
algorithm: "R U R' U'"
})

UI 必須實際 animate。

PASS。

TEST 12

WebMCP 呼叫：

cube_get_state

回傳 state 必須與目前畫面一致。

PASS。

# Final Delivery

請直接建立完整：

index.html

不要只告訴我該怎麼做。

不要留下：

TODO
placeholder
implement later
pseudo code

所有核心功能都必須完成。

完成後再自行檢查 JavaScript syntax error、Cube move permutation、2×2 / 3×3 rendering、WebMCP registration 與 Responsive layout。

如果某個瀏覽器目前沒有 document.modelContext，請 graceful fallback，而不是刪除 WebMCP implementation。

最終成果要讓我能直接拿來 Demo：

「同一顆魔術方塊，人可以用 UI 玩，AI Agent 也可以透過 WebMCP 的 structured tools 操作。」

這個概念必須在第一次看到畫面時就能理解。
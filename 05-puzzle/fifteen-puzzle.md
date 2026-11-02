# 數字推盤（Fifteen Puzzle）

## 類別

益智類型（滑塊推盤）

## 概述

可調盤面的滑塊推盤：支援 **3×3～6×6**、**數字**或**圖片拼圖**（`public/puzzle-art.jpg` 切分）。點擊／拖曳／滑動與空格相鄰的方塊即可移動；當 1…N²−1 依序排好且空格在右下角即過關。開局洗牌保證可解。過關以 **IDA\***（Manhattan＋線性衝突）算出的標準桿對照步數並給出評等。

## 人數與建議年齡

- 人數：1 人。
- 建議年齡：約 6 歲以上。

## 操作與座艙配置

- **整排／整欄連動推盤（Multi-Tile Line Push）**：點擊或觸控同列或同行之任一方塊，中間整排方塊將一次連動滑入空格，支援極速推盤手速，滑步動畫流暢連動。
- **實體鍵盤完整操控**：
  - 方向鍵／<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>：推動相鄰方塊進入空格。
  - <kbd>Z</kbd>／<kbd>Backspace</kbd>：復原上一步。
  - <kbd>H</kbd>：提示下一步最佳滑塊。
  - <kbd>G</kbd>：切換目標藍圖透視（Ghost Overlay）。
  - <kbd>R</kbd>：重新開局。
- **解謎拓撲雙翼座艙（Battle Station Cockpit）**：
  - **左翼（解謎拓撲導航 PUZZLE TELEMETRY）**：全盤歸位和諧度（%）與進度條、即時通關評等預測儀（動態預測 S/A/B/C/D 與標準桿領先／落後差距）、曼哈頓總偏差距、鍵盤快捷鍵指南。
  - **右翼（目標藍圖與工坊 BLUEPRINT & WORKSHOP）**：微型目標陣列縮圖（即時標記已歸位方塊與終點空格）、目標透視開關、連動推盤秘笈、本機最少步數與衝刺榜。
  - **行動端自適應**：在寬度小於 1024px 之螢幕自動摺疊雙翼，呈現純淨觸控棋盤與即時狀態列。
- **目標透視與歸位感知（Ghost Blueprint & In-Place Glow）**：
  - 開啟目標透視可在底層浮現目標編號與終點位置，化解尋找方塊定位之困惑。
  - 當方塊抵達正解槽位時，即時點亮翡翠綠微光（`ring-1 ring-emerald-400/50`）與綠點標記，提供即時正向回饋。

## 遊戲目標

以盡量少的步數（或在限時／限步內）還原盤面，並挑戰標準桿評等。

## 模式

| 模式 | 說明 |
|------|------|
| **經典** | 無時限；依盤面大小×打亂難度記錄最少步數。 |
| **衝刺** | 限時 **90 秒**；逾時失敗；記錄最短用時。 |
| **每日挑戰** | 以台北日期種子產生當日同一盤（3×3～5×5 輪替，偶為圖片）；連續天數。 |
| **闖關階梯** | 8 關依序解鎖；步數上限（標準桿×寬鬆係數）或限時。 |

### 打亂難度（`ScrambleTier`）

| 難度 | 洗牌方式 |
|------|----------|
| 簡單 | 自正解盤隨機合法滑 `size×5` 步 |
| 普通 | 自正解盤隨機合法滑 `size×12` 步 |
| 困難 | 3×3／4×4 全盤洗牌；5×5／6×6 長距離合法滑步（以便估算標準桿） |

### 標準桿與評等

- 以 IDA\*＋Manhattan＋線性衝突求最短解；若節點／時間預算不足以證明最優，則以打亂步數上界作為「≤N」近優標準桿。
- 評等：完美 S／優秀 A／達標 B／尚可 C／再接再厲 D（依超出標準桿比例）。

## 規則說明

1. 僅能移動與空格正交相鄰的方塊。
2. 盤面以一維 N² 格表示（列優先）；目標為 `1…N²−1` 後接 `null`。
3. 可解性：奇數邊長看反序數奇偶；偶數邊長另加空格自底列起算之列號（見 `isSolvable`）。

## 勝負與回饋

- **勝利**：盤面還原 → `ResultOverlay`（步數、標準桿、用時、評等）；經典／衝刺寫入最佳紀錄；每日寫入連續天數；闖關推進進度。
- **失敗**：限時逾時或闖關步數用盡 → `ResultOverlay`（lose）。
- **音效**：`@clubhouse/shared/synthAudio`（移動／勝負）。
- **本機紀錄**：
  - `clubhouse:fifteen-puzzle:best`（`moves-{size}-{tier}`／`sprint-{size}-{tier}`；會遷移舊鍵 `clubhouse-fifteen-best`）
  - `clubhouse:fifteen-puzzle:daily`
  - `clubhouse:fifteen-puzzle:campaign`

## 品質門檻對齊

對照 [`docs/GAME-QUALITY-BAR.md`](../docs/GAME-QUALITY-BAR.md)：

| 項目 | 本實作 |
|------|--------|
| 模式／變體 | 經典／衝刺／每日／闖關 × 盤面 × 數字／圖片 × 三級打亂 |
| Replay hook | 最佳步數／衝刺秒數／每日連續／闖關進度 |
| Undo／Hint | 皆有 |
| Feedback | `ResultOverlay` + `synthAudio` + 標準桿評等 |
| Touch | 點擊、拖曳／滑動、工具列可觸控 |
| Check | `npm run check` → `src/check-fifteen.mjs` |

## 實作

- 專案路徑：[Games/Fifteen-Puzzle/](../Games/Fifteen-Puzzle/)
- 核心：`src/fifteenLogic.ts`、`src/solver.ts`、`src/daily.ts`、`src/campaign.ts`、`src/storage.ts`
- UI：`src/App.tsx`、`src/PuzzleBoard.tsx`

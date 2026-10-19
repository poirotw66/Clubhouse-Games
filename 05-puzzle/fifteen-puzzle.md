# 數字推盤（Fifteen Puzzle）

## 類別

益智類型（滑塊推盤）

## 概述

可調盤面的滑塊推盤：支援 **3×3～6×6**、**數字**或**圖片拼圖**（`public/puzzle-art.jpg` 切分）。點擊／拖曳／滑動與空格相鄰的方塊即可移動；當 1…N²−1 依序排好且空格在右下角即過關。開局洗牌保證可解。過關以 **IDA\***（Manhattan＋線性衝突）算出的標準桿對照步數並給出評等。

## 人數與建議年齡

- 人數：1 人。
- 建議年齡：約 6 歲以上。

## 操作

- **點擊／觸控**：點與空格相鄰的方塊滑入空格（按鈕可觸控）。
- **拖曳／滑動**：在盤面上滑動可依方向推動鄰格（閾值約 28px）。
- **滑動動畫**：方塊以約 160ms 過渡位移（尊重 `prefers-reduced-motion`）。
- **復原（Undo）**：退回上一步盤面並扣回一步數。
- **提示（Hint）**：高亮建議滑動的一格（優先回位，否則最小化 Manhattan）。
- **重開／選單**：重開目前模式，或回標題選擇模式。

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

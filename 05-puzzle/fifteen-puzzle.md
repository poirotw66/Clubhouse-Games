# 數字推盤（Fifteen Puzzle）

## 類別

益智類型（滑塊推盤）

## 概述

經典 4×4 滑塊推盤：盤面為數字 1–15 與一格空位。點擊與空格相鄰的數字塊即可滑動；當 1–15 依序排好且空格在右下角即過關。開局洗牌保證可解。

## 人數與建議年齡

- 人數：1 人。
- 建議年齡：約 6 歲以上。

## 操作

- **點擊／觸控**：點與空格相鄰的數字塊滑入空格（按鈕 `min-h-[44px]`，支援觸控）。
- **復原（Undo）**：退回上一步盤面並扣回一步數。
- **提示（Hint）**：高亮建議滑動的一格（優先把可回位的數字放回家格，否則選最能降低 Manhattan 距離的合法步）。
- **重開一局**：依目前難度與模式重新洗牌。

## 遊戲目標

以盡量少的步數（經典）或盡快（衝刺）還原盤面。

## 模式與難度

### 模式（`PlayMode`）

1. **經典（classic）**：無時限；過關記錄該難度下最少步數。
2. **衝刺（sprint）**：限時 **90 秒**（`SPRINT_LIMIT_SEC`）；逾時失敗；過關記錄該難度下最短用時（秒）。

### 打亂難度（`ScrambleTier`）

| 難度 | 洗牌方式 |
|------|----------|
| 簡單（easy） | 自正解盤隨機合法滑 **20** 步 |
| 普通（normal） | 自正解盤隨機合法滑 **50** 步 |
| 困難（hard） | 全盤 Fisher–Yates 洗牌（僅保留可解且非已解盤） |

切換模式或難度會立即重開一局。

## 規則說明

1. 僅能移動與空格正交相鄰的數字塊。
2. 盤面以一維 16 格表示（列優先）；目標為 `1…15` 後接 `null`。
3. 可解性：偶數邊長盤依反序數與空格自底列起算之列號判定（見 `isSolvable`）；實作洗牌必為可解。

## 勝負與回饋

- **勝利**：盤面還原 → `ResultOverlay`（win）；經典寫入最佳步數，衝刺寫入最佳秒數；新紀錄顯示徽章。
- **失敗**：衝刺逾時 → `ResultOverlay`（lose，標題「時間到」）。
- **音效**：`@clubhouse/shared/synthAudio`（移動／勝負）。
- **本機紀錄**：`localStorage` 鍵 `clubhouse-fifteen-best`（依難度分開存 `moves-*`／`sprint-*`）。

## 品質門檻對齊

對照 [`docs/GAME-QUALITY-BAR.md`](../docs/GAME-QUALITY-BAR.md)：

| 項目 | 本實作 |
|------|--------|
| 模式／變體 | 經典／衝刺 × 三級打亂 |
| Replay hook | 最佳步數／最佳衝刺秒數 |
| Undo／Hint | 皆有 |
| Feedback | `ResultOverlay` + `synthAudio` |
| Touch | 主操作與工具列可觸控 |
| Check | `npm run check` → `src/check-fifteen.mjs`（可解性、提示合法性） |

## 實作

- 專案路徑：[Games/Fifteen-Puzzle/](../Games/Fifteen-Puzzle/)
- 核心邏輯：`src/fifteenLogic.ts`；UI：`src/App.tsx`

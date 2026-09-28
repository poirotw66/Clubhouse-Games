# 記憶配對（Memory Match）

## 類別

益智類型（翻牌配對）

## 概述

翻開兩張卡，正面圖案相同即配對成功並留在場上；不同則蓋回。全部配對即過關。開局可選配對數與模式。

## 人數與建議年齡

- 人數：1 人。
- 建議年齡：約 5 歲以上。

## 操作

- **點擊／觸控**：點背面卡翻開；一次最多翻兩張；鎖定期間不可再點。
- **提示（Hint）**：短暫（約 900ms）掀開一組尚未配對的相同圖案，再蓋回；翻牌中或提示進行中不可再用。
- **重開一局**：依目前配對數與模式重新洗牌。
- 本局**無 Undo**（翻牌為資訊揭露，不逐手悔棋）。

## 遊戲目標

以盡量少的翻牌次數（經典）或盡快（衝刺）完成全部配對。一次「翻兩張」計為一次翻牌次數（`moves`）。

## 模式與難度

### 模式（`PlayMode`）

1. **經典（classic）**：無時限；過關記錄該配對數下最少翻牌次數。
2. **衝刺（sprint）**：限時 **60 秒**（`SPRINT_LIMIT_SEC`）；逾時失敗；過關記錄該配對數下最短用時（秒）。

### 配對數（`PairCount`）

| 選項 | 牌數 | 圖案 |
|------|------|------|
| 簡單 · 4 對 | 8 | `FACE_IDS` 前 4 種 |
| 普通 · 6 對 | 12 | 全部 6 種（star／moon／fish／cherry／leaf／gem） |

切換模式或配對數會立即重開一局。

## 規則說明

1. 開局自圖案池取 N 對、洗牌後背面朝上。
2. 翻開第二張後：相同 → 標記 `matched` 並留在場上；不同 → 短暫停頓後蓋回。
3. 全部 `matched` 即勝利；衝刺模式下時間歸零且未全配對即失敗。

## 勝負與回饋

- **勝利**：全部配對 → `ResultOverlay`（win）；顯示翻牌次數、配對數與最佳紀錄；新紀錄徽章。
- **失敗**：衝刺逾時 → `ResultOverlay`（lose）；顯示已配對數。
- **音效**：`synthAudio`（翻錯／配對成功／勝負）。
- **本機紀錄**：`localStorage` 鍵 `clubhouse-memory-match-best`（經典依配對數存最少步數；衝刺存 `sprint-{n}` 最短秒數）。

## 品質門檻對齊

對照 [`docs/GAME-QUALITY-BAR.md`](../docs/GAME-QUALITY-BAR.md)：

| 項目 | 本實作 |
|------|--------|
| 模式／變體 | 經典／衝刺 × 4 對／6 對 |
| Replay hook | 最佳翻牌次數／最佳衝刺秒數 |
| Undo／Hint | Hint（Peek 一對）；無 Undo（設計選擇） |
| Feedback | `ResultOverlay` + `synthAudio` |
| Touch | 卡面與工具列可觸控 |
| Check | `npm run check` → `src/check-memory.mjs`（組牌、提示配對） |

## 實作

- 專案路徑：[Games/Memory-Match/](../Games/Memory-Match/)
- 核心邏輯：`src/memoryLogic.ts`；UI：`src/App.tsx`

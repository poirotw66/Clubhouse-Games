# 花牌（Koi-Koi）

## 類別

紙牌類型（花札）

## 概述

使用日本傳統花札（48 張、12 月份）的 **Koi-Koi** 玩法：兩人輪流出手牌與翻山牌，依月份配對取牌，組成「役」得分。成役後可選擇結算或喊「Koi-Koi」繼續博取更高分；若被對手先成役結算，分數可能歸對手並加倍。

本館實作為 **單人對電腦**（花札師匠），含三角難度、勝分目標、角色選擇、提示、悔棋、首局引導、戰績連勝、背景音樂、`ResultOverlay` 與規則說明。

來源專案：[poirotw66/Koi-Koi](https://github.com/poirotw66/Koi-Koi)

## 人數與建議年齡

- 人數：1 人（對電腦）。
- 建議年齡：約 10 歲以上。

## 所需器材與操作

- 花札牌面、場牌區、手牌與取牌區；觸控或滑鼠點選出牌／配對。
- **提示（Hint）**：高亮建議的手牌與可配場牌（金環樣式，與一般可配高亮區分）。
- **悔棋（Undo）**：在對手回合、整場合計／結束以外，可回到「你出手前」快照（含對手剛回的那手）；動畫中悔棋會取消未完成的排程。成役後的 Koi-Koi／勝負選擇亦可悔回出手前。
- **首局引導**：首次開啟顯示三步上手疊層（`clubhouse-koi-koi-howto-seen`）；之後可從規則按鈕複習細節。
- **BGM**：可靜音；靜音偏好寫入本機。

## 遊戲目標

組成役並累積分數，先達到約定勝分者獲勝。

## 模式與設定

### AI 難度（`Difficulty`）

| id | 標籤 | 體感（UI 短述） | 行為概要 |
|----|------|-----------------|----------|
| easy | 簡單 | 常亂出手，愛喊 Koi-Koi | 高亂手率、低取牌偏好、較晚結算 |
| normal | 普通 | 會湊役，適度結算 | 平衡役分權重與亂手 |
| hard | 困難 | 少失誤，懂得及時收分 | 零亂手、重視役分與終局／達標收分 |

### 勝分目標（`WinScore`）

開局可選 **先達 7／12／20**（預設 12）。達標即整場勝利。

### 其他

- **角色選擇**：玩家頭像寫入本機，跨局保留。
- 上次難度與勝分目標一併記在戰績物件中。

## 規則說明（概要）

1. 雙方各持手牌，場上有若干牌；剩餘為山牌。
2. **出手牌**：若場上有同月牌可取走（多張時由玩家選）；否則該牌留在場上。
3. **翻山牌**：再翻一張，同樣可與場牌配對取走。
4. **成役**：取牌後若組成役，可選「結算」或喊「Koi-Koi」繼續；對方若先成役結算，可能奪走分數並加倍。
5. 詳細役種與點數見遊戲內規則說明（`RulesModal`）與 `calculateYaku`。

## 勝負與回饋

- 整場：任一方分數 ≥ 勝分目標 → `ResultOverlay`（勝／負）；徽章顯示難度與勝分設定。
- **戰績**：`localStorage` 鍵 `clubhouse-koi-koi-stats`（wins／losses／winStreak／lastDifficulty／lastWinScore）。
- **音效**：`synthAudio`（出牌／取牌／勝負）；另有可靜音 BGM。

## 品質門檻對齊

對照 [`docs/GAME-QUALITY-BAR.md`](../docs/GAME-QUALITY-BAR.md)：

| 項目 | 本實作 |
|------|--------|
| 模式／變體 | 三難度 AI × 三檔勝分；角色選擇 |
| Replay hook | 勝敗與連勝（`winStreak`） |
| 對手 AI | 三級可分辨；**Hint** + **Undo** |
| Feedback | `ResultOverlay` + `synthAudio` + BGM；首局引導 |
| Touch | 出牌／配對／悔棋可觸控 |
| Check | `npm run check` → `vitest run`（`gameLogic`／`botAi` 等） |

## 實作

- 專案路徑：[Games/Koi-Koi/](../Games/Koi-Koi/)
- 核心：`src/utils/gameLogic.ts`、`src/utils/botAi.ts`、`src/utils/stats.ts`；UI：`src/App.tsx`、`src/components/FirstRunGuide.tsx`

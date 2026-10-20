# 花牌（Koi-Koi）

## 類別

紙牌類型（花札）

## 概述

使用日本傳統花札（48 張、12 月份）的 **Koi-Koi** 玩法：兩人輪流出手牌與翻山牌，依月份配對取牌，組成「役」得分。成役後可選擇結算或喊「Koi-Koi」繼續博取更高分；若被對手先成役結算，分數可能歸對手並加倍。

本館實作為 **單人對電腦**，含三角難度、勝分目標、玩家／對手角色選擇（對手帶個性 AI）、役種圖鑑、提示、悔棋、首局引導、戰績連勝、背景音樂、`ResultOverlay` 與規則說明。

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

### 對手個性（`OpponentPersonality`）

每位可選動物角色對應一組資料驅動的打牌風格，**疊加在難度之上**（難度管亂手／紀律，個性管追役與風險）：

| 面向 | 說明 |
|------|------|
| 追役 | `chaseYaku`／`subtypeBias` 偏好光牌、短冊、豬鹿蝶、月見／花見酒等 |
| 風險 | `riskAppetite`／`koiKoiCapDelta`：貪心連喊 vs 穩健收分 |
| 台詞 | 喊 Koi-Koi、整場勝／負時顯示短句（繁中） |

對手選擇寫入 `clubhouse-koi-koi-opponent`；對局中頭像與名稱跟隨所選角色。

### 役種圖鑑（Yaku Codex）

- 鍵：`clubhouse-koi-koi-yaku-codex`（parse 時驗證／合併非法資料）。
- 紀錄每個已完成役的**首成日期**、**達成次數**、**最佳手牌總分**；未解鎖顯示剪影與提示。
- 選單書本按鈕、結果畫面次要按鈕可開啟。

### 其他

- **角色選擇**：玩家頭像寫入本機，跨局保留；對手另選（見上）。
- 上次難度與勝分目標一併記在戰績物件中。
- **成役回饋**：組成役時短動畫＋音效（尊重 `prefers-reduced-motion`）；圖鑑首解鎖另有加強音效。

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
| 模式／變體 | 三難度 AI × 三檔勝分；玩家／對手角色；對手個性 |
| Replay hook | 勝敗與連勝（`winStreak`）；役種圖鑑 |
| 對手 AI | 三級可分辨 + 角色個性；**Hint** + **Undo** |
| Feedback | `ResultOverlay` + `synthAudio` + BGM；成役動畫；首局引導 |
| Touch | 出牌／配對／悔棋／圖鑑可觸控 |
| Check | `npm run check` → `vitest run`（`gameLogic`／`botAi`／`yakuCodex` 等） |

## 實作

- 專案路徑：[Games/Koi-Koi/](../Games/Koi-Koi/)
- 核心：`src/utils/gameLogic.ts`、`src/utils/botAi.ts`、`src/utils/personalities.ts`、`src/utils/yakuCodex.ts`、`src/utils/stats.ts`；UI：`src/App.tsx`、`src/components/YakuCodexModal.tsx`、`src/components/FirstRunGuide.tsx`

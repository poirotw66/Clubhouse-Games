# 循環之路（Loop Hero）

> Astra／GPT-6 one-shot。靜態單頁實作位於 `gpt6-astra/loop-hero/`。

## 簡介

循環路線建造式 Roguelike（遊戲內名 **Cinder Circuit**）。玩家不直接操作旅人，而是放置世界卡、裝備戰利品，並決定何時撤退。

## 路線（深度 5）

營火可選兩條迴路（地圖與 Boss 不同；`awakenBoss` 共用）：

| 路線 | 名稱 | Keeper | 解鎖 |
|------|------|--------|------|
| drowned | Drowned Verge | The Ninth Bell | 預設 |
| ashen | Ashen Coil | The Hollow Peal | 通關 Wick，或工藝「Cartographer's Desk」 |

## 遠征目標／難度檔

| 檔 | 名稱 | 目標 | 難度 | 覺醒 |
|----|------|------|------|------|
| Ember | Ember Scout | 存活滿 3 圈後撤退通關 | 敵較弱 | 25 張 × +4% |
| Wick | Wick Expedition | 擊敗該路線 Keeper | 標準 | 20 張 × +5% |
| Ash | Ash Trial | 於第 5 圈前擊敗 Keeper | 敵較強 | 15 張 × +7% |

`cardsNeeded` 與 `bossGain` 對齊：UI／seal 提示顯示「距離 Bell 還差幾張牌」。

## 營地卡牌工藝

以 bank 資源解鎖／強化建築（永久）：

| 建築 | 效果 |
|------|------|
| Waystone Archive | 解鎖 Road Omen 事件牌 |
| Veilwright Bench | 解鎖 Veil Eclipse；等級強化減傷 |
| Bellfoundry | 每級開局 +5% Bell 進度 |
| Cartographer's Desk | 永久解鎖 Ashen Coil |

## 勝敗與結算

- **通關（GOAL MET）**：達成該檔目標（Scout 撤退／Keeper 擊殺／時限內擊殺）。
- **失敗（GOAL FAILED）**：旅人死亡（僅保留 25% 物資）。
- **放棄（GOAL ABANDONED）**：未達目標即撤退（營火旁 100%／路上 60%）。
- **遲勝（LATE VICTORY）**：Ash 逾第 5 圈才擊殺 Boss（仍算勝利，但不計該檔目標通關）。

## 局內加深

- **事件牌**：工藝解鎖後，道路事件可抽到 Omen／Eclipse。
- **精英修飾**：Frenzied／Plated／Virulent（攻速、防禦、穿透）。

## 首局提示

- 首次開啟顯示 **FIRST LIGHT** 三則提示，確認後才選檔出發。
- 首局仍有路上 `FIELD NOTE` 情境提示。

## 遊玩

- 從總覽選單「07 Astra」進入，或開啟 [`gpt6-astra/loop-hero/index.html`](../gpt6-astra/loop-hero/index.html)。
- 完整提示詞見同資料夾 `prompt.md`。

## 技術備註

- 類型：`game`
- 建置：純靜態 HTML + ESM（無 Vite／React／CDN）；Pages 部署時整包複製 `gpt6-astra/`。
- 純邏輯：`rules.mjs`；檢查：`npm run check:astra-loop-hero` → `self-check.mjs`。
- Meta：`localStorage` 鍵 `cinder-circuit-refuge-v3`（可從 v1／v2 遷移）。
- 音效：`shared/sfx.mjs` 新增 `playCardPlace`／`playBellAwaken`／`playCraft`／`playEliteMod`／`playEventCard`（不改既有函式）。

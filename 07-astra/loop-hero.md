# 循環之路（Loop Hero）

> Astra／GPT-6 one-shot。靜態單頁實作位於 `gpt6-astra/loop-hero/`。

## 簡介

循環路線建造式 Roguelike（遊戲內名 **Cinder Circuit**）。玩家不直接操作旅人，而是放置世界卡、裝備戰利品，並決定何時撤退。

## 遠征目標／難度檔

營火介面可選三檔（目標與敵勢一併設定）：

| 檔 | 名稱 | 目標 | 難度 |
|----|------|------|------|
| Ember | Ember Scout | 存活滿 3 圈後撤退通關 | 敵較弱、鈴覺醒較慢 |
| Wick | Wick Expedition | 擊敗第九鈴（The Ninth Bell） | 標準 |
| Ash | Ash Trial | 於第 5 圈前擊敗第九鈴 | 敵較強、覺醒較快 |

通關會記入該檔 `cleared` 次數；資源入庫另乘該檔獎勵係數。

## 勝敗與結算

- **通關（GOAL MET）**：達成該檔目標（Scout 撤退／Bell 擊殺／時限內擊殺）。
- **失敗（GOAL FAILED）**：旅人死亡（僅保留 25% 物資）。
- **放棄（GOAL ABANDONED）**：未達目標即撤退（營火旁 100%／路上 60%）。
- **遲勝（LATE VICTORY）**：Ash 逾第 5 圈才擊殺 Boss（仍算勝利，但不計該檔目標通關）。

結算面板以徽章＋檢查清單標示 outcome／goal／保留物資。

## 首局提示

- 首次開啟顯示 **FIRST LIGHT** 三則提示（塑造迴路／選遠征／知退路），確認後才選檔出發。
- 首局仍有路上 `FIELD NOTE` 情境提示。

## 遊玩

- 從總覽選單「07 Astra」進入，或開啟 [`gpt6-astra/loop-hero/index.html`](../gpt6-astra/loop-hero/index.html)。
- 完整提示詞見同資料夾 `prompt.md`。

## 技術備註

- 類型：`game`
- 建置：純靜態 HTML（無 Vite workspace）；Pages 部署時整包複製 `gpt6-astra/`。
- Meta：`localStorage` 鍵 `cinder-circuit-refuge-v2`（可從 v1 遷移）。

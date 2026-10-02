# 弓箭手（Archer）／停步射手（Stillshot）

> Astra／GPT-6 作品。靜態實作：`gpt6-astra/archer/`（`index.html` + `rules.mjs`）。

## 簡介

移動時不能攻擊、停步才自動射擊的 Roguelite 房間戰。本版由單一路線「開始冒險」加深為**可重玩**：難度／限房模式、分模式最遠房、清楚結算與再來迴路。

## 遊玩

- 總覽「07 Astra」或開啟 [`gpt6-astra/archer/index.html`](../gpt6-astra/archer/index.html)。
- 手機：拖曳移動，放開即停步射擊；電腦：WASD／方向鍵，`Esc` 暫停。

## 難度／限房模式

| 模式 | 體感 | 主要差異 |
|------|------|----------|
| 輕鬆 | 熟悉節奏 | 敵血／傷害／數量較低，通關獎勵 120 |
| 標準 | 原本十五房 | 基準數值（與初版 demo 對齊），通關 150 |
| 高壓 | 站太久就痛 | 敵血／傷害／數量上修，通關 200 |
| 五房突襲 | **限房**速通 | 房數上限 5（一區含 Boss），略增壓，通關 90 |

永久金幣／攻擊／生命仍跨模式共用；**最遠房與通關次數依模式分記**。

## 結算／重玩

- 結束畫面：模式徽章、通關／陣亡／撤退、本模式新紀錄、房數／等級／擊殺／金幣。
- 動作：**再來一局 ·（同模式）**、**換模式**、**回營地 · 永久成長**。
- `localStorage` 鍵 `stillshot-save-v2`（遷移舊鍵 `stillshot-save` 的 `best` → 標準模式最遠房）。

## 品質門檻對齊（GAME-QUALITY-BAR 適用項）

| 項目 | 狀態 |
|------|------|
| 模式／規則變體 | ✓ 輕鬆／標準／高壓＋五房突襲（限房） |
| localStorage 重玩 | ✓ 分模式最遠房＋通關次數；永久成長共用 |
| Undo／Hint／三段 AI | — 非對戰／非牌局 |
| 結算 UI | ～ 靜態單頁自製結算（無 React／`resultOverlayDom`；契約對齊：標題／數據／再來） |
| 觸控 | ✓ 拖曳移動（既有） |
| check | ✓ `node gpt6-astra/archer/check-archer.mjs`（根腳本 `npm run check:astra-archer`） |

## 技術備註

- 類型：`game`；純靜態 ESM（無 Vite workspace）；Pages 整包複製 `gpt6-astra/`。
- 規則純模組：`rules.mjs`（模式表、生成／受傷縮放、存檔遷移、結算紀錄）。
- 完整創作提示詞見同資料夾 `prompt.md`。

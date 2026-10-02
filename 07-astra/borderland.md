# 邊疆／荒土暴動（Borderland · Dust Riot）

> Astra／GPT-6 實驗。靜態實作：`gpt6-astra/borderland/`（`index.html` + `rules.mjs`）。

## 簡介

第一人稱波次防衛：在荒漠前哨擊退機械掠奪者、撿綠箱補血、撐過目標波次。本版由 one-shot demo 加深為**可重玩**：難度檔＋波次目標、本機最佳、清楚結算與再來迴路。

## 遊玩

- 總覽「07 Astra」或開啟 [`gpt6-astra/borderland/index.html`](../gpt6-astra/borderland/index.html)。
- 桌面瀏覽器：點擊鎖定滑鼠；WASD 移動、Shift 奔跑、Space 跳躍、左鍵射擊、R 換彈、Esc 暫停。
- 命中黃色頭部雙倍傷害；利用建築／貨箱掩體避開紅彈。

## 難度／波次目標

| 模式 | 體感 | 通關波次 | 主要差異 |
|------|------|----------|----------|
| 輕鬆 | 熟悉瞄準與掩體 | 第 5 波 | 敵弱、彈傷輕、補血較多 |
| 標準 | 原本荒土節奏 | 第 8 波 | 基準數值（對齊初版 demo） |
| 高壓 | 催得兇 | 第 12 波 | 血厚、彈密、開局 90 HP、補血較少 |

清完該模式的目標波次即通關（勝利結算）；中途倒下則戰敗結算。

## 結算／重玩

- 結束畫面：模式徽章、通關／戰敗、分數、波次、擊殺、本模式最佳波／最高分；新紀錄徽章。
- 動作：**再來一局**（同模式）、**換模式**。
- `localStorage` 鍵 `dust-riot-v1`（分模式最佳波／最高分／通關次數）。

## 品質門檻對齊（GAME-QUALITY-BAR 適用項）

| 項目 | 狀態 |
|------|------|
| 模式／規則變體 | ✓ 輕鬆／標準／高壓＋波次通關目標 |
| localStorage 重玩 | ✓ 分模式最佳波／最高分／通關數 |
| Undo／Hint／三段 AI | — 非對戰／非牌局 |
| 結算 UI | ～ 靜態單頁自製結算（無 React／`resultOverlayDom`；契約對齊：標題／數據／再來） |
| 觸控 | — 需 Pointer Lock 的桌面 FPS；行動裝置非本版主路徑 |
| check | ✓ `node gpt6-astra/borderland/check-borderland.mjs`（根腳本 `npm run check:astra-borderland`） |

## 技術備註

- 類型：`game`；純靜態 ESM（無 Vite workspace）；Pages 整包複製 `gpt6-astra/`。
- 規則純模組：`rules.mjs`（難度表、生成／血量／彈速、成績遷移）。
- **Three**：本機 `gpt6-astra/vendor/three/`；納入 `check:no-cdn` 對 `gpt6-astra` 的掃描。
- 完整創作提示詞見同資料夾 `prompt.md`。

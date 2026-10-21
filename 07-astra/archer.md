# 弓箭手（Archer）／停步射手（Stillshot）

> Astra／GPT-6 作品。靜態實作：`gpt6-astra/archer/`（`index.html` + `rules.mjs` + 共用 `shared/sfx.mjs`）。

## 簡介

移動時不能攻擊、停步才自動射擊的 Roguelite 房間戰。深度 5：音效、有意義永久樹、今日種子挑戰、分區 Boss 行為。

## 遊玩

- 總覽「07 Astra」或開啟 [`gpt6-astra/archer/index.html`](../gpt6-astra/archer/index.html)。
- 手機：拖曳移動，放開即停步射擊；電腦：WASD／方向鍵，`Esc` 暫停。
- 大廳可開關音效（設定寫入 `localStorage`，鍵 `astra-sfx-muted`）。

## 難度／限房／今日

| 模式 | 體感 | 主要差異 |
|------|------|----------|
| 輕鬆 | 熟悉節奏 | 敵血／傷害／數量較低，通關獎勵 120 |
| 標準 | 原本十五房 | 基準數值，通關 150 |
| 高壓 | 站太久就痛 | 敵血／傷害／數量上修，通關 200 |
| 五房突襲 | **限房**速通 | 房數上限 5，通關 90 |
| 夜襲突襲 | 限房變體（解鎖） | 彈幕更密、獎勵更高 |
| 玻璃突襲 | 限房變體（解鎖） | 雙方玻璃血，輸出為王 |
| 今日挑戰 | 固定種子 | 8 房腳本配置 + 禁用 3 項能力；記 `bestDaily` |

## 永久樹（取代純 +%）

金幣一次解鎖身分／結構，而非疊百分比：

- 開局能力：穿透／多重／護盾／冰霜
- 泉水客房：第 6、11 房改為治療房（無敵人）
- 突襲變體：夜襲、玻璃

舊存檔的永久攻擊／生命等級會折現為金幣（`stillshot-save-v3`，遷移 v2／legacy）。

## 分區 Boss

| 區域 | 主題行為 |
|------|----------|
| 翠葉（1） | 衝刺／突進為主 |
| 琥珀（2） | 落區封鎖為主 |
| 星光（3） | 環彈縫更窄、扇形更密 |

## 結算／重玩

- 結束畫面：模式徽章、通關／陣亡／撤退、本模式／今日新紀錄。
- 動作：**再來一局**、**換模式**、**回營地 · 永久成長**。
- Agent 介面：`window.__ASTRA_ARCHER__`；若瀏覽器支援 `document.modelContext`，另註冊 `stillshot_*` WebMCP 工具。

## 品質門檻對齊（GAME-QUALITY-BAR 適用項）

| 項目 | 狀態 |
|------|------|
| 模式／規則變體 | ✓ 難度＋限房＋解鎖變體＋今日挑戰 |
| localStorage 重玩 | ✓ 分模式最遠房／通關；`bestDaily`；永久解鎖 |
| 音效 | ✓ 射擊／命中／升級／死亡／通關 + 靜音記憶 |
| 結算 UI | ～ 靜態單頁自製結算 |
| 觸控 | ✓ 拖曳移動 |
| check | ✓ `node gpt6-astra/archer/check-archer.mjs`（`npm run check:astra-archer`） |

## 技術備註

- 類型：`game`；純靜態 ESM（無 Vite／React／CDN）；Pages 整包複製 `gpt6-astra/`。
- 規則純模組：`rules.mjs`；音效只**新增**於 `gpt6-astra/shared/sfx.mjs`（不改既有函式）。
- 完整創作提示詞見同資料夾 `prompt.md`。

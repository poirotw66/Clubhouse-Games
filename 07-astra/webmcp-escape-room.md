# 密室逃脫（Escape Room）

> Astra／GPT-6 one-shot。靜態單頁實作位於 `gpt6-astra/webmcp-escape-room/`。

## 簡介

三房密室（書房 → 機房檔案庫 → 金庫前室）；人類 UI 與 WebMCP agent 共用同一 `GameEngine`。含道具組合、非線性機房雙路徑、三種結局、提示（影響評價）、計時與個人最佳、可重玩種子（`agent-demo` 固定碼）。

## 遊玩

- 從總覽選單「07 Astra」進入，或開啟 [`gpt6-astra/webmcp-escape-room/index.html`](../gpt6-astra/webmcp-escape-room/index.html)。
- 固定種子 `agent-demo`：書房密碼 `0317`／走廊 `8426`（給 agent／測試）。
- 其他種子會重抽密碼；進度存 `webmcp-escape-room.v2`，最佳成績存 `webmcp-escape-room.meta.v2`。

## 品質門檻對齊

| 項目 | 狀態 |
|------|------|
| 模式／變體 | 三種結局（標準／維修艙／Ghost）＋可重玩種子 |
| 重玩鉤子 | localStorage 計時個人最佳、通關次數、見過的結局 |
| 提示／Undo | Hint（扣評價）＋ Undo |
| 回饋 | 共用 `sfx.mjs` 音效＋`result-overlay` 結算 |
| 觸控 | 主要按鈕 ≥44px、`touch-action: manipulation` |
| Check script | `npm run check:astra-escape-room` |

## 技術備註

- 類型：`webmcp`（既有 19 個 tools 保留，另增房間／提示／計時／結局等）
- 建置：純靜態 HTML + ESM（`rules.mjs`／`engine.mjs`）；無 Vite／CDN
- 邏輯檢查：`gpt6-astra/webmcp-escape-room/check-escape-room.mjs`
- 完整初版提示詞見同資料夾 `prompt.md`（歷史規格；現況以本檔與實作為準）

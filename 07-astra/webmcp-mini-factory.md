# 迷你工廠（Mini Factory）

> Astra／GPT-6 one-shot。靜態單頁實作位於 `gpt6-astra/webmcp-mini-factory/`。

## 簡介

工廠產線控制面板，展示 WebMCP 對應用狀態的雙向控制。含 10 關戰役、電力／機台上限、研究樹、星級評分，以及以 Asia/Taipei 日期為種子的每日藍圖。

## 遊玩

- 從總覽選單「07 Astra」進入，或開啟 [`gpt6-astra/webmcp-mini-factory/index.html`](../gpt6-astra/webmcp-mini-factory/index.html)。
- 戰役：L01–L10；研究含分流、電路、機器人、超頻、配線、馬達、大宗倉儲、深層採礦。
- 每日藍圖：當日生產目標與限制（可用機台／電力／格子），星級與連續天數，可複製分享文字。
- 本目錄為實驗／展示規格摘要，完整提示詞見同資料夾 `prompt.md`（若有）。

## 技術備註

- 類型：`webmcp`
- 建置：純靜態 HTML（無 Vite workspace）；Pages 部署時整包複製 `gpt6-astra/`。
- 邏輯檢查：`npm run check:astra-factory`；瀏覽器測試：`tests/browser/astra-mini-factory.spec.mjs`。


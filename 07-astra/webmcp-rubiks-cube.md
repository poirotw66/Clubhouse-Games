# 魔術方塊學院（Rubik’s Cube Academy）

> Astra／GPT-6 one-shot。靜態實作位於 `gpt6-astra/webmcp-rubiks-cube/`。

## 簡介

給完全新手的魔術方塊學習站（介面繁體中文；轉面記號維持 `R U R' U'`）。在既有 WebMCP 魔術方塊 Demo 的 CubeEngine／MoveQueue／`document.modelContext` 之上，加上層層法課程、公式表、**隨機練習庫**、**WCA 風格計時**，並保留「自由練習」模式。

## 遊玩

- 從總覽選單「07 Astra」進入，或開啟 [`gpt6-astra/webmcp-rubiks-cube/index.html`](../gpt6-astra/webmcp-rubiks-cube/index.html)。
- **學習路徑**：基礎認識 → 記號 → 白十字／白角／第二層／黃十字／黃面／排角／排邊；選修 CFOP／四步預覽。進度存 `localStorage`。
- **公式表**：常用公式速查，可在 3D 方塊上播放。
- **隨機練習**：針對十字／F2L／OLL／PLL 等階段隨機出題；可勾選本題計時；熟練度（嘗試／完成／最佳／平均）寫入 `rubiks-cube-academy:practice:v1`，並反映在課程側欄。
- **計時**：WCA 風格打亂 → 15 秒觀察 → 開表／停表（手機有按鈕）。**只有方塊真正還原才記成績**；保留 PB、ao5、ao12。鍵：`rubiks-cube-academy:times:v1`。
- **自由練習**：原 WebMCP Demo 操控面；完整舊版介面見 [`freeplay.html`](../gpt6-astra/webmcp-rubiks-cube/freeplay.html)。

## WebMCP 工具

既有 `cube_*` 工具維持相容。學院另提供導師工具：

- `academy_get_progress`／`academy_get_lesson`／`academy_get_hint`／`academy_explain_next`
- `academy_setup_practice`／`academy_set_lesson`

## 技術備註

- 類型：`webmcp`
- 建置：純靜態 HTML／JS（無 Vite）；Pages 部署時整包複製 `gpt6-astra/`。
- 邏輯檢查：`node gpt6-astra/webmcp-rubiks-cube/check-academy.mjs`（亦見 `npm run check:astra-rubiks`）。
- 完整提示詞見同資料夾 `prompt.md`（若有）。

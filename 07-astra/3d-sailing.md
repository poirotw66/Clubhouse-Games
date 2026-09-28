# 3D 航行（3D Sailing）

> Astra／GPT-6 one-shot。靜態單頁實作位於 `gpt6-astra/3d-sailing/`。

## 簡介

瀏覽器內 3D 航行體驗（本機 Three.js）。

## 遊玩

- 從總覽選單「07 Astra」進入，或開啟 [`gpt6-astra/3d-sailing/index.html`](../gpt6-astra/3d-sailing/index.html)。
- 本目錄為實驗／展示規格摘要，完整提示詞見同資料夾 `prompt.md`（若有）。

## 技術備註

- 類型：`game`
- 建置：純靜態 HTML（無 Vite workspace）；Pages 部署時整包複製 `gpt6-astra/`。
- **Three**：本機 `gpt6-astra/vendor/three/`；納入 `check:no-cdn` 對 `gpt6-astra` 的掃描。


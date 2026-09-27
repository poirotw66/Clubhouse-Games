# 3D 填空（3D Fill the Void）

> Astra／GPT-6 one-shot。靜態單頁實作位於 `gpt6-astra/3d-fill-the-void/`。

## 簡介

3D 空間填補／建造類互動小品（執行期依賴 Three.js CDN）。

## 遊玩

- 從總覽選單「07 Astra」進入，或開啟 [`gpt6-astra/3d-fill-the-void/index.html`](../gpt6-astra/3d-fill-the-void/index.html)。
- 本目錄為實驗／展示規格摘要，完整提示詞見同資料夾 `prompt.md`（若有）。

## 技術備註

- 類型：`game`
- 建置：純靜態 HTML（無 Vite workspace）；Pages 部署時整包複製 `gpt6-astra/`。
- **CDN**：執行期自 jsDelivr 載入 Three.js；未納入主線 `check:no-cdn` 掃描範圍。


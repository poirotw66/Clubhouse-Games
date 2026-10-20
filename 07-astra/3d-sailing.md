# 3D 航行（Windward）

> Astra／GPT-6 one-shot。靜態單頁實作位於 `gpt6-astra/3d-sailing/`。

## 簡介

瀏覽器內 3D 計時帆航行（本機 Three.js）。三條航線、個人最佳、幽靈船重播與完賽回饋。

## 遊玩

- 從總覽選單「07 Astra」進入，或開啟 [`gpt6-astra/3d-sailing/index.html`](../gpt6-astra/3d-sailing/index.html)。
- **航線：** 群島巡航 → 橫風疾航 → 陣風繞島（通關解鎖下一條）。
- **操作：** W/S 動力、A/D 轉向、Space 煞車、R 重開、Esc 選單；觸控另有 Brake／R。
- **進度：** `localStorage` 鍵 `windward-progress-v1`（PB／解鎖）、`windward-ghosts-v1`（幽靈軌跡）。

## 手感／Feedback

- 過門／碰撞／完賽／失敗合成音效（`gpt6-astra/shared/sfx.mjs`，vendored from `synthAudio`）。
- 結算使用 `gpt6-astra/shared/result-overlay.mjs`（vendored from `resultOverlayDom`）。

## 技術備註

- 類型：`game`
- 建置：純靜態 HTML（無 Vite workspace）；Pages 部署時整包複製 `gpt6-astra/`。
- **Three：** 本機 `gpt6-astra/vendor/three/`；納入 `check:no-cdn` 對 `gpt6-astra` 的掃描。
- **Fonts：** 本機 `gpt6-astra/vendor/fonts/dm-space.css`（DM Sans + Space Grotesk latin）；無 Google Fonts CDN。
- **Check：** `npm run check:astra-sailing` → `gpt6-astra/3d-sailing/check-sailing.mjs`。

## 品質矩陣（對照 GAME-QUALITY-BAR）

| 項目 | 狀態 |
|------|------|
| 模式／航線變體 | ✓ 三航線＋風預設 |
| 重玩鉤子 | ✓ PB＋幽靈船＋解鎖梯 |
| Feedback | ✓ synth 音效＋ResultOverlay Dom＋完賽光暈 |
| 觸控 | ✓ 轉向／動力／煞車／重開 |
| Check script | ✓ `check:astra-sailing` |

# 3D 填空（3D Fill the Void）

> Astra／GPT-6 one-shot。靜態單頁實作位於 `gpt6-astra/3d-fill-the-void/`。

## 簡介

療癒向的立體拼板：把多連方塊放進棋盤、填滿空隙。無計時壓力；以**星等／關卡包／每日關**提供重玩理由。

## 遊玩

- 從總覽選單「07 Astra」進入，或開啟 [`gpt6-astra/3d-fill-the-void/index.html`](../gpt6-astra/3d-fill-the-void/index.html)。
- **Campaign**：三包共 20 關（Breath → Garden → Hush），依序解鎖。
- **Daily calm**：依本地日期固定一題；當日最佳星等會記住。
- **星等**：通關 1★；≤1 次 Undo 為 2★；0 Undo 且旋轉／翻面次數 ≤ 標準桿（par）為 3★。
- 操作：點選碎片 → 點棋盤放置；`R` 旋轉、`F` 翻面；手機可用觸控＋側欄按鈕。

## 存檔

- `localStorage` 鍵：`astra-fill-the-void:v1`（含 clears／currentId／daily）。
- 會遷移舊鍵 `fill-void-level`（僅關卡索引）到新進度結構。

## 品質對照

| 項目 | 狀態 |
|------|------|
| 模式變體 | ✓ Campaign 三包 + Daily calm |
| 重玩鉤子 | ✓ 星等、par、每日關、進度解鎖 |
| Feedback | ✓ `gpt6-astra/shared/sfx.mjs`（放置／翻面／過關）+ 結算星等演出 |
| 觸控 | ✓ pointer 放置；旋轉／翻面／Undo 大按鈕 |
| check | ✓ `node gpt6-astra/3d-fill-the-void/check-fill-void.mjs`（亦見 `npm run check:astra-fill-void`） |

## 技術備註

- 類型：`game`
- 建置：純靜態 HTML（無 Vite workspace）；Pages 部署時整包複製 `gpt6-astra/`。
- 邏輯模組：`levels.mjs`、`rules.mjs`（含解謎驗證／星等／存檔）；全關以腳本驗證可解。
- **Three**：本機 `gpt6-astra/vendor/three/`（含 RoundedBoxGeometry）；納入 `check:no-cdn` 對 `gpt6-astra` 的掃描。
- **Fonts**：本機 `gpt6-astra/vendor/fonts/dm-space.css`（DM Sans + Space Grotesk latin）；無 Google Fonts CDN。
- 本機 `server.mjs` 已對 `.mjs` 回傳 `text/javascript`，方便直接 `import` 模組。

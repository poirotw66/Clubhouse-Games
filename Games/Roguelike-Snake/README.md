## 蛇窟迴廊（Roguelike Snake）

以經典貪吃蛇為骨幹的 **Roguelike 單局制**地窟探險：吃滿果實開啟出口、用衝刺輾殺敵人、每通過一層三選一挑遺物，深入 15 層擊敗最終首領即可逃出蛇窟。HP 歸零則單局結束。

本專案是 `Clubhouse-Games` 底下 `Games/Roguelike-Snake` 子專案，使用 React + TypeScript + Vite + Tailwind CSS 實作，遊戲邏輯為純 TypeScript 模組、畫面以 Canvas 繪製。

規格文件：[`05-puzzle/roguelike-snake.md`](../../05-puzzle/roguelike-snake.md)

---

## 操作

| 操作 | 鍵盤 | 行動裝置 |
|------|------|----------|
| 轉向 | ↑↓←→ 或 WASD | 滑動畫面或方向鍵 |
| 衝刺 | Space | 衝刺鍵或輕點畫面 |
| 暫停 | P / Esc | 暫停按鈕 |
| 重新開始 | R（結算時） | 再玩一局 |

---

## 本地開發（Dev Server）

在 `Games/Roguelike-Snake` 資料夾下執行：

```bash
npm install
npm run dev
```

---

## 建置

在專案根目錄執行：

```bash
npm run build:game Roguelike-Snake
```

產物輸出至 `Games/Roguelike-Snake/dist/`，由根目錄的 `server.mjs` 或 GitHub Pages 提供。

---

## 原始碼結構

```
src/
├── App.tsx              # 畫面切換、遊戲迴圈、輸入處理
├── components/          # Arena（Canvas 容器）、Hud、RelicPicker、TitleScreen
├── game/
│   ├── config.ts        # 所有數值調校常數
│   ├── engine.ts        # 核心規則：移動、戰鬥、樓層推進、遺物
│   ├── level.ts         # 地形模板生成與連通性檢查
│   ├── relics.ts        # 遺物定義與加權抽取
│   ├── rng.ts           # 可重現的種子亂數（mulberry32）
│   ├── storage.ts       # 最佳紀錄（localStorage）
│   └── types.ts
└── render/draw.ts       # Canvas 繪製與逐格內插
```

同一組 **種子** 會產生完全相同的地窟，可在標題畫面輸入種子重玩或與他人比較。

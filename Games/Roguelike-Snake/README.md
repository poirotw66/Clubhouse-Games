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

## 遺物池為什麼從 18 擴到 44

肉鴿最核心的東西是「兩輪玩起來不一樣」。稽核之後發現這裡完全不是這樣：

| | 之前 | 現在 |
|---|---|---|
| 遺物池 | 18 | **44** |
| 一輪看到池子的比例 | **98%**（17.7／18） | 68% |
| **兩輪之間持有遺物的重疊度** | **72%** | **27%** |

一輪最多 15 層、每層 3 選 1，所以 18 個遺物幾乎每輪都被看完——**每一輪都是同一輪**。

### 真正的原因是「新增一個遺物太貴」

原本的 18 個遺物，每一個都是 `engine.ts` 裡的一條 `hasRelic` 分支。**加一個遺物等於改模擬邏輯**，所以池子長不大。

現在多了一組 `ModKey`（速度、分數、成長、能量上限、能量獲取、衝刺距離、金蘋果率、無敵時間、最大 HP、金幣），引擎各讀一次並加總，所以 **只動數值的遺物變成一行資料**。新增的 26 個全部是資料。原本那些有特殊行為的（環界符、幽靈尾、荊棘鱗、尖牙、迴響、血祭）保持原本的分支不動。

### 測試釘住兩件事

`npm run check` 新增一項，兩個斷言都驗證過會紅：

- **變化度**：一輪被提供的遺物不得超過池子的 80%，兩輪之間的重疊不得超過 45%。把池子縮回 18 個，它會報 `a run is offered 98% of the pool`
- **沒有謊話**：遺物文字宣稱的每一個 `ModKey`，引擎都必須真的讀取。把 `dashDistance` 的讀取改掉，它會報 `relics advertise "dashDistance" but engine.ts never reads it — the text would be a lie`

第二條是資料化之後才需要的：遺物變成一行資料之後，很容易寫出「能量上限 +25」但引擎根本沒讀那個欄位的東西，**那比不做這個遺物更糟，因為玩家被告知了假訊息**。

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

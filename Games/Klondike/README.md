## Klondike Solitaire

**接龍（Klondike Solitaire）** 是最經典的單人接龍玩法：  
七列 tableau 以紅黑交替、點數遞減排成，透過翻牌堆與廢牌堆循環翻牌，目標是把 52 張牌依花色從 A 到 K 收到四疊 foundation。

本專案是 `Clubhouse-Games` 底下 `Games/Klondike` 子專案，使用 React + TypeScript + Vite + Tailwind CSS 實作。

---

## 開發環境需求

- [Node.js](https://nodejs.org/)（建議使用 LTS 版本）

---

## 本地開發（Dev Server）

在 `Games/Klondike` 資料夾下執行：

```bash
npm install
npm run dev
```

預設會啟動在 `http://localhost:3000/`，根節點為 `index.html` 中的 `#root`。

---

## 建置（Build）

### 單獨建置此遊戲

在 `Games/Klondike` 下：

```bash
npm run build
```

輸出會在 `dist/` 資料夾，可直接丟到任一靜態主機。

### 由 `Clubhouse-Games` 主專案統一建置

在專案根目錄（`Clubhouse-Games`）下，會自動偵測 `Games/Klondike` 並帶入正確的 `BASE_URL`：

```bash
# 建置單一遊戲（不含規則文件、總目錄）
npm run build:game Klondike

# 為 GitHub Pages 等靜態主機輸出完整網站（含所有 Games/* 子專案）
REPO_NAME=Clubhouse-Games npm run build:pages
```

`scripts/build-for-pages.mjs` 會對每一個 `Games/<name>`：

- 設定 `BASE_URL=/Clubhouse-Games/Games/<name>/`
- 執行 `npm run build`
- 將各自的 `dist/` 複製到主專案的 `dist/Games/<name>/`

本遊戲的 `vite.config.ts` 已配合此流程，當沒有設定 `BASE_URL` 時則使用相對路徑 `./`，方便獨立部署或搭配 Capacitor 等工具。

---

## 數位模式

- **翻 1／翻 3**、**標準／維加斯計分**（含累計籌碼；標準悔棋額外 −2）
- **可解局**：thoughtful solver 篩種子，必要時腳本構局
- **每日一局**：台北時間種子、今日最佳、連續天數、可複製分享文案
- **戰績**：勝率、連勝、各模式最佳分／時間／步數、挑戰目標

驗證：`npm run check`（`src/check-klondike.mjs`）、`npm run lint`。

## 檔案結構（重點）

- `src/App.tsx`：主要遊戲 UI 與操作流程。
- `src/utils/deck.ts`：牌堆建立、可解／每日發牌。
- `src/utils/scoring.ts` / `solver.ts` / `daily.ts` / `share.ts` / `storage.ts`：計分、可解篩選、每日與分享、戰績。
- `src/utils/gameLogic.ts`：接龍規則、提示、自動完成。
- `src/components/StatsPanel.tsx`：戰績與今日分享。
- `src/types.ts`：`GameState`、`Card` 等型別定義。

完整的規則說明則在主專案的 `01-cards/klondike.md` 中。

---

## 版權與授權

此子專案隸屬 `Clubhouse-Games`，除非另有標示，預設為私人／未授權使用。

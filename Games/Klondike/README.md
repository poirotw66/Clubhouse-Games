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

## 檔案結構（重點）

- `src/App.tsx`：主要遊戲 UI 與操作流程。
- `src/utils/deck.ts`：牌堆建立與洗牌、發牌邏輯。
- `src/utils/gameLogic.ts`：接龍規則驗證、合法移動判斷、勝負檢查等核心邏輯。
- `src/components/Card.tsx`：單張牌的呈現與樣式。
- `src/components/EmptySlot.tsx`：空牌位顯示（例如空 foundation 或空 tableau 列）。
- `src/types.ts`：`GameState`、`Card` 等型別定義。

完整的規則說明則在主專案的 `01-cards/klondike.md` 中。

---

## 版權與授權

此子專案隸屬 `Clubhouse-Games`，除非另有標示，預設為私人／未授權使用。

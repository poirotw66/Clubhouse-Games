# FreeCell Solitaire

一個經典的 **連環新接龍（FreeCell）** 小遊戲，特色：

- **完整 FreeCell 規則**：4 個暫存格、4 個 foundation、8 列 tableau。
- **自動移動（Auto-move）**：安全時自動把牌移到 foundation。
- **拖曳與雙擊操作**：支援點擊選牌、拖曳整串合法序列、雙擊自動上收。
- **悔棋（Undo）與重新開始**：隨時回到上一手或開新局。
- **Bot 解牌（Solve Game）**：內建簡單解牌器，自動依序走出一條解法路徑（若可找到）。

本專案是 `Clubhouse-Games` 底下 `Games/FreeCell` 子專案，使用 React + TypeScript + Vite + Tailwind CSS 實作。

---

## 開發環境需求

- [Node.js](https://nodejs.org/)（建議使用 LTS 版本）

---

## 本地開發（Dev Server）

在 `Games/FreeCell` 資料夾下執行：

```bash
npm install
npm run dev
```

預設會啟動在 `http://localhost:3000/`，根節點為 `index.html` 中的 `#root`。

---

## 建置（Build）

### 單獨建置此遊戲

在 `Games/FreeCell` 下：

```bash
npm run build
```

輸出會在 `dist/` 資料夾，可直接丟到任一靜態主機。

### 由 `Clubhouse-Games` 主專案統一建置

在專案根目錄（`Clubhouse-Games`）下，會自動偵測 `Games/FreeCell` 並帶入正確的 `BASE_URL`：

```bash
# 建置單一遊戲（不含規則文件、總目錄）
npm run build:game FreeCell

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

- `src/App.tsx`：主要遊戲 UI 與互動邏輯（拖曳、點擊、Bot、Auto-move 等）。
- `src/utils/deck.ts`：建立與發牌（deal）邏輯。
- `src/utils/gameLogic.ts`：合法移動判斷、連續序列檢查、勝負判斷等核心規則。
- `src/utils/solver.ts`：簡易解牌器，給 Bot 使用。
- `src/components/PlayingCard.tsx`：單張牌的呈現與樣式。
- `src/components/RulesModal.tsx`：遊戲規則說明的彈出視窗。
- `src/types.ts`：`GameState`、`Position`、`Card` 等型別定義。

完整的規則說明則在主專案的 `01-cards/freecell.md`（以及對應的 `dist/01-cards/freecell.md`）中。

---

## 版權與授權

此子專案隸屬 `Clubhouse-Games`，除非另有標示，預設為私人／未授權使用。

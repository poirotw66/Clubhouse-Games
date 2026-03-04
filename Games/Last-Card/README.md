# Last Card（Crazy Eights）

**最後一張牌（Last Card / Crazy Eights）** 是一款脫手型紙牌遊戲：  
你與 3 名電腦對手輪流出牌，需與棄牌堆頂張同花色或同點數，特殊牌（如 8）可以改變花色或觸發效果，**先打光手牌的人獲勝**。

本專案是 `Clubhouse-Games` 底下 `Games/Last-Card` 子專案，使用 React + TypeScript + Vite + Tailwind CSS 實作。

---

## 開發環境需求

- [Node.js](https://nodejs.org/)（建議使用 LTS 版本）

---

## 本地開發（Dev Server）

在 `Games/Last-Card` 資料夾下執行：

```bash
npm install
npm run dev
```

預設會啟動在 `http://localhost:3000/`，根節點為 `index.html` 中的 `#root`。

---

## 建置（Build）

### 單獨建置此遊戲

在 `Games/Last-Card` 下：

```bash
npm run build
```

輸出會在 `dist/` 資料夾，可直接丟到任一靜態主機。

### 由 `Clubhouse-Games` 主專案統一建置

在專案根目錄（`Clubhouse-Games`）下，會自動偵測 `Games/Last-Card` 並帶入正確的 `BASE_URL`：

```bash
# 建置單一遊戲（不含規則文件、總目錄）
npm run build:game Last-Card

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

- `src/App.tsx`：主要遊戲 UI 與流程。
- `src/hooks/useGame.ts`：遊戲核心狀態管理與回合邏輯。
- `src/components/PlayingCard.tsx`：單張牌的呈現與樣式。
- `src/components/Opponent.tsx`：對手手牌與狀態顯示。
- `src/components/RulesModal.tsx`：遊戲規則說明的彈出視窗。
- `src/types.ts`：`GameState`、`Card` 等型別定義。

完整的規則說明則在主專案的 `01-cards/last-card.md` 中。

---

## 版權與授權

此子專案隸屬 `Clubhouse-Games`，除非另有標示，預設為私人／未授權使用。

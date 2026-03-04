## Instant Flash: Iai Training Grounds

**Instant Flash** 是一款以武士拔刀術（居合）為主題的反應力小遊戲：  
玩家必須在瞬間判斷提示，於精準時機按下指令完成斬擊，挑戰自己的節奏感與反應速度。

本專案是 `Clubhouse-Games` 底下 `Games/Instant-Flash` 子專案，使用 React + TypeScript + Vite 製作，包含節奏提示與結果統計畫面。

---

## 開發環境需求

- [Node.js](https://nodejs.org/)（建議使用 LTS 版本）
- 可選：Google Gemini API 金鑰（若遊戲有使用到）

---

## 本地開發（Dev Server）

在 `Games/Instant-Flash` 資料夾下執行：

```bash
npm install
npm run dev
```

預設會啟動在 `http://localhost:3000/`，根節點為 `index.html` 中的 `#root`。

如需使用 Gemini API，可在 `.env.local` 或環境變數中設定：

```bash
GEMINI_API_KEY=your_api_key_here
```

---

## 建置（Build）

### 單獨建置此遊戲

在 `Games/Instant-Flash` 下：

```bash
npm run build
```

輸出會在 `dist/` 資料夾，可直接丟到任一靜態主機。

### 由 `Clubhouse-Games` 主專案統一建置

在專案根目錄（`Clubhouse-Games`）下，會自動偵測 `Games/Instant-Flash` 並帶入正確的 `BASE_URL`：

```bash
# 建置單一遊戲（不含規則文件、總目錄）
npm run build:game Instant-Flash

# 為 GitHub Pages 等靜態主機輸出完整網站（含所有 Games/* 子專案）
REPO_NAME=Clubhouse-Games npm run build:pages
```

`scripts/build-for-pages.mjs` 會對每一個 `Games/<name>`：

- 設定 `BASE_URL=/Clubhouse-Games/Games/<name>/`
- 執行 `npm run build`
- 將各自的 `dist/` 複製到主專案的 `dist/Games/<name>/`

本遊戲的 `vite.config.ts` 已配合此流程，當沒有設定 `BASE_URL` 時則使用相對路徑 `./`，方便獨立部署。

---

## 檔案結構（重點）

- `index.html`：主要 HTML 入口。
- `index.tsx`：React app 入口。
- `App.tsx`：遊戲主畫面與狀態管理。
- `components/GameCanvas.tsx`：反應／節奏遊戲的主互動畫面。
- `components/Results.tsx`：結算畫面與統計資訊。
- `constants.ts`、`types.ts`：遊戲設定與型別定義。
- `services/audioService.ts`：音效與提示音管理。

---

## 版權與授權

此子專案隸屬 `Clubhouse-Games`，除非另有標示，預設為私人／未授權使用。

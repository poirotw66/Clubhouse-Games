# Block the Smash（羽毛球接殺訓練）

**Block the Smash** 是一款 3D 羽毛球接殺小遊戲：  
透過滑鼠控制球拍，在限定時間內盡可能成功擋下對手的殺球，訓練反應與判斷。

本專案是 `Clubhouse-Games` 底下 `Games/Block-the-smash` 子專案，使用 React + TypeScript + Vite 建置，並透過 Three.js 在瀏覽器中呈現立體場景。

---

## 開發環境需求

- [Node.js](https://nodejs.org/)（建議使用 LTS 版本）
- 可選：Google Gemini API 金鑰（若要啟用 Remix / AI 相關功能）

---

## 本地開發（Dev Server）

在 `Games/Block-the-smash` 資料夾下執行：

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

在 `Games/Block-the-smash` 下：

```bash
npm run build
```

輸出會在 `dist/` 資料夾，可直接丟到任一靜態主機。

### 由 `Clubhouse-Games` 主專案統一建置

在專案根目錄（`Clubhouse-Games`）下，會自動偵測 `Games/Block-the-smash` 並帶入正確的 `BASE_URL`：

```bash
# 建置單一遊戲（不含規則文件、總目錄）
npm run build:game Block-the-smash

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
- `index.tsx`：React app 入口與 UI 控制介面。
- `public/init/gemini3.html`：實際 3D 場景與物理模擬的遊戲引擎頁面。
- `vite.config.ts`：Vite 設定（含 `BASE_URL` 與 Three.js 相關優化）。
- `tsconfig.json`、`package.json`：TypeScript 與依賴設定。

---

## 版權與授權

此子專案隸屬 `Clubhouse-Games`，除非另有標示，預設為私人／未授權使用。

# GitHub Pages 建置與部署流程

本專案以 **單一建置產物** 部署到 GitHub Pages：選單、規格文件與所有遊戲的建置結果會輸出到一個 `dist/` 目錄，由 CI 上傳並發布。

---

## 一、建置流程概覽

```
push to main (或手動觸發)
    → GitHub Actions: deploy-pages workflow
    → Install dependencies (各 Games/<name>)
    → scripts/build-for-pages.mjs
        ├── 複製靜態：index.html, README, docs, 01-cards…06-minigames → dist/
        └── 對每個 Games/<name>：
                ├── 設定 BASE_URL=/${REPO_NAME}/Games/<name>/
                ├── npm run build（Vite 產出到 Games/<name>/dist/）
                └── 複製 dist/ → dist/Games/<name>/
    → 上傳 dist/ 為 pages artifact
    → 部署到 GitHub Pages
```

- **REPO_NAME**：來自 repository 名稱（例如 `Clubhouse-Games`），用來組成每個遊戲的 `base`（例如 `/Clubhouse-Games/Games/Blackjack-main/`）。
- 各遊戲的 Vite 需支援 **BASE_URL**：`vite.config` 使用 `base: process.env.BASE_URL || './'`，本地開發用相對路徑，CI 建置時帶入絕對路徑。

---

## 二、本地建置（與 CI 一致）

在專案根目錄執行：

```bash
# 可選：先為要建置的遊戲安裝依賴
cd Games/Blackjack-main && npm install && cd ../..

# 建置整站（預設輸出到根目錄 dist/）
REPO_NAME=Clubhouse-Games npm run build:pages
```

或使用 npm script（需先設定 REPO_NAME，或依預設 `Clubhouse-Games`）：

```bash
npm run build:pages
```

產出目錄為 **dist/**，內容可直接給靜態網站或上傳到任一 Pages 環境使用。

---

## 三、GitHub Actions 部署

### 1. 啟用 GitHub Pages

- 到儲存庫 **Settings → Pages**。
- **Source** 選 **GitHub Actions**（不要選 branch）。

### 2. 觸發部署

- **push 到 `main`** 會自動跑 `.github/workflows/deploy-pages.yml`。
- 或到 **Actions → Deploy to GitHub Pages → Run workflow** 手動觸發。

### 3. 工作流程步驟摘要

| 步驟 | 說明 |
|------|------|
| Checkout | 取出目前程式碼 |
| Setup Node | Node 20、npm cache |
| Install root deps | `npm ci \|\| npm install`（可略，腳本不依賴根目錄套件） |
| Install game deps | 對每個 `Games/*/package.json` 執行 `npm ci` 或 `npm install` |
| Build for Pages | `REPO_NAME=${{ github.event.repository.name }}` 執行 `node scripts/build-for-pages.mjs` |
| Upload artifact | 上傳 `dist/` 為 pages artifact |
| Deploy | `actions/deploy-pages` 部署到 GitHub Pages |

部署完成後，站台網址為：

`https://<username>.github.io/<REPO_NAME>/`

例如：`https://myuser.github.io/Clubhouse-Games/`  
選單在首頁，二十一點在：`https://myuser.github.io/Clubhouse-Games/Games/Blackjack-main/`。

---

## 四、新增遊戲時要注意的事

1. **遊戲目錄**：放在 `Games/<專案名>/`，內含 `package.json` 與 Vite 專案。
2. **Vite base**：在該遊戲的 `vite.config` 使用  
   `base: process.env.BASE_URL || './'`  
   不要寫死絕對路徑，以利本地與 Pages 共用同一份設定。
3. **自動納入建置**：`build-for-pages.mjs` 會掃描 `Games/` 下所有含 `package.json` 的資料夾並依序建置、複製到 `dist/Games/<名>/`，無需改 workflow。
4. **子專案依賴**：CI 會對每個 `Games/*` 執行 `npm ci` 或 `npm install`，請在該目錄提供 `package.json`（若有 `package-lock.json` 可一併提交以加快安裝）。

---

## 五、僅部署部分遊戲

若只想建置部分遊戲，可改 `build-for-pages.mjs` 的 `getGameFolders()`，改為讀取環境變數白名單，例如：

```js
const ONLY_GAMES = process.env.ONLY_GAMES ? process.env.ONLY_GAMES.split(',') : null;
// 在 getGameFolders 回傳時若 ONLY_GAMES 存在則 filter 只保留在名單內的資料夾
```

CI 中可設 `ONLY_GAMES: 'Blackjack-main,klondike'` 等，依需求調整。

---

## 六、參考

- [GitHub Pages: Building and testing (Actions)](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publish-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow)
- [actions/deploy-pages](https://github.com/actions/deploy-pages)
- 專案架構：[PROJECT-STRUCTURE.md](PROJECT-STRUCTURE.md)

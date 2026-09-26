# GitHub Pages 建置與驗證

選單、規格與所有遊戲輸出到根目錄 `dist/`。唯一的 CI 工作流程是
`.github/workflows/build.yml`：PR 執行驗證；推送 main 或在 main 手動執行 Build，
驗證成功後才部署同一份產物。部署 job 透過 `needs: build` 等待所有檢查。

## 本地執行

使用 Node 22，所有依賴只從根目錄 lockfile 安裝：

```bash
npm ci
npx playwright install --only-shell chromium
npm run check:versions
npm run check:shared-styles
npm run lint:all
npm run check:all
# check:all / lint:all 預設依 CPU 數並行；可用 CHECK_JOBS 或
# `node scripts/run-in-games.mjs check --jobs N` 調整。
npm run build:pages
npm run check:no-cdn -- --pages
npm run test:browser
```

`npm run setup` 也使用 `npm ci`，並產生選單及其圖片、CSS。
新增依賴時使用 npm install 更新根目錄 package-lock.json，請勿新增子專案 lockfile。
如果出現 Tailwind 3 專案載入 Tailwind 4 的錯誤，先以根目錄 `npm ci` 重建依賴；
不要為了本機缺少套件而修改遊戲的 PostCSS 版本。

## 發布順序

1. `npm ci` 與安裝 Chromium。
2. 依賴版本、共用樣式、型別及遊戲邏輯檢查。
3. `npm run build:pages`：產生封面、選單與 README，編譯 CSS，建置全部遊戲一次。
4. 掃描 `dist/Games/` 的實際發布產物，拒絕缺少遊戲或外部 CDN 程式引用。
5. 在桌面 Chromium 與手機觸控模擬執行瀏覽器測試。
6. 僅 main 的非 PR 執行可上傳並部署已通過驗證的 Pages artifact。

失敗時上傳 `test-results/`，包含失敗測試的 screenshot 與 trace。
在 GitHub Settings → Pages，將 Source 設為 GitHub Actions。

## 子路徑與預覽

`REPO_NAME` 預設為 `Clubhouse-Games`，CI 使用 repository 名稱。每款遊戲以
`BASE_URL=/${REPO_NAME}/Games/<folder>/` 建置。自訂名稱時，建置與測試必須一致：

```bash
REPO_NAME=My-Games npm run build:pages
REPO_NAME=My-Games npm run test:browser
REPO_NAME=My-Games npm run preview:pages
```

預覽網址為 `http://127.0.0.1:4173/My-Games/`。預覽伺服器只提供 `dist/`，
缺少資產會回傳 404，不會回傳首頁掩蓋問題。
`npm run dev` 仍提供原有本地開發入口；瀏覽器測試不使用該開發伺服器。

## 圖片與瀏覽器測試範圍

`assets/covers/*.jpg` 是保留的原圖。`npm run generate` 自動產生
`assets/covers/optimized/` 中的 320px／640px WebP 與 640px JPEG fallback。
生成檔不納入版本控制；建置會排除有替代圖片的原始封面。每張 WebP 上限為
150 KiB，JPEG 上限為 200 KiB，超過時建置失敗。

瀏覽器測試涵蓋全部目錄遊戲的進入與返回、選單搜尋／分類／網址恢復、
響應式圖片載入，以及記憶配對和四子棋的實際操作／重開。手機情境使用觸控。
測試收集 JavaScript 例外與站內資產錯誤；可選用的 Google Fonts 在測試中回傳空樣式，
避免外部字型服務影響結果。這些基本測試不等於逐款完整玩法或實機效能驗證。

新增遊戲時，將 package.json、規格與 JPG 封面加入目錄並更新 data/games.json；
建置與基本導航測試會自動納入。新增複雜互動時，在 tests/browser 補上對應情境。

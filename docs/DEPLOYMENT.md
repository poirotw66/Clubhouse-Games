# GitHub Pages 建置與驗證

選單、規格與所有遊戲輸出到根目錄 `dist/`。唯一的 CI 工作流程是
`.github/workflows/build.yml`：PR 與 main push 執行快速驗證；手動執行預設為完整驗證。
僅 main push 驗證成功後部署同一份產物，手動驗證不部署。
部署 job 透過 `needs: build` 等待所有必要檢查。

## 本地執行

使用 Node 22，所有依賴只從根目錄 lockfile 安裝：

```bash
npm ci
npx playwright install --only-shell chromium
npm run check:versions
npm run check:shared-styles
npm run check:tooling
npm run check:shared
npm run check:dev-server-mime
npm run lint:all
npm run check:all
# check:all / lint:all 預設依 CPU 數並行；可用 CHECK_JOBS 或
# `node scripts/run-in-games.mjs check --jobs N` 調整。
npm run build:pages
npm run check:no-cdn -- --pages
npm run test:browser
```

日常快速檢查可改用：

```bash
npm run check:all:quick
npm run check:browser-profile
npm run test:browser:quick
```

`npm run check:all` 與 `npm run test:browser` 預設保留完整模式。
也可明確設定 `CLUBHOUSE_TEST_PROFILE=full`；不認得的模式會失敗。
快速指令在本機也預設最多 2 個並行工作，可用 `CHECK_JOBS` 或
`PLAYWRIGHT_WORKERS` 明確調整。

`npm run setup` 也使用 `npm ci`，並產生選單及其圖片、CSS。
新增依賴時使用 npm install 更新根目錄 package-lock.json，請勿新增子專案 lockfile。
如果出現 Tailwind 3 專案載入 Tailwind 4 的錯誤，先以根目錄 `npm ci` 重建依賴；
不要為了本機缺少套件而修改遊戲的 PostCSS 版本。

每款 `Games/*` 都必須定義 `lint` 與 `check`。全量、單款與分片檢查對缺少
這兩個指令採相同的失敗規則；其他選用指令會明確列出略過項目。

PR 只修改單一遊戲時，CI 建置與檢查該遊戲；只修改已登錄的 Astra 實驗時，
執行該實驗的邏輯與桌面入口檢查，不建置無關的 Vite 遊戲。
Astra gallery、vendor、共用資產、未知實驗路徑及站台基礎設施變更仍涵蓋所有遊戲，
驗證深度則由模式決定。`check:tooling` 以隔離測試驗證範圍判定與遊戲檢查執行器，
並在 CI 判定範圍前執行；安裝依賴後另執行 `check:browser-profile`，確認選中的
瀏覽器案例及手機覆蓋。

## 平衡版 CI

| 情境 | 建置與核心檢查 | 瀏覽器驗證 |
| --- | --- | --- |
| 一般遊戲／Astra PR | 受影響的遊戲；核心邏輯與型別檢查 | 受影響遊戲的桌面入口、首頁；若涉及記憶配對／四子棋，包含對應手機操作 |
| 共用基礎設施 PR、main push | 全部遊戲建置、型別與快速核心檢查 | 54 項桌面首頁／入口檢查，加 6 項手機情境；目前合計 60 項 |
| 手動 `validation_profile=full`（預設） | 全部遊戲原有完整邏輯與長時間模擬 | 原有完整桌面＋手機套件，目前 338 項 |

快速模式使用 `CLUBHOUSE_TEST_PROFILE=quick`。桌面選取 `@smoke`，手機選取
`@mobile-smoke`，未選中的深度測試不註冊執行。單款 PR 依受影響範圍進一步縮減，
不會以數百筆 skipped 案例代替精確選取。手機保留搜尋／網址恢復、gallery 導航、
減少動態效果、字型預算，以及記憶配對／四子棋的觸控與重開情境；單款 PR 省略
未變更首頁的字型預算檢查。

大老二快速模式保留出牌規則、發牌、計分、儲存與有界重播，完整 AI 對局、
難度比較與搜尋衍生檢查移至完整模式。幣潮保留固定步數的決定性、不可變狀態、
邊界、費用／冷卻、結束條件、計分及進度；長時間整局、多 seed 平衡性與 RTP
檢查移至完整模式。略過的類別會以 `DEFERRED (full profile)` 明列，並未降低
原有完整測試的斷言門檻。其他遊戲既有邏輯檢查維持原樣。

快速模式使用 1 個邏輯檢查 runner 與 1 個瀏覽器 runner；完整模式保留原有的
4 組邏輯分片與 4 組 E2E 分片。全站型別檢查維持 2 分片，單款 PR 為 1 分片。
範圍判定工具的 `CI_FORCE_FULL=1` 可強制 CI 全範圍與完整驗證。
手動與自動流程的 concurrency group
分開，避免手動驗證取消正在進行的 main 部署。

在 GitHub Actions 選擇 Build → Run workflow，即可選擇 `full` 或 `quick`；
兩者都只驗證，不部署。自動部署通過的狀態代表快速檢查通過，並不代表已執行
完整玩法回歸；需要深度驗收時，手動執行完整模式並確認結果。

## 發布順序

1. `npm ci` 與安裝 Chromium。
2. 依賴版本、共用樣式、型別及遊戲邏輯檢查。
3. `npm run build:pages`：產生封面、選單與 README，編譯 CSS，建置全部遊戲一次；並複製靜態樹（含 `07-astra/`、`gpt6-astra/`）。
4. 掃描 `dist/Games/` 與 `dist/gpt6-astra/` 的實際發布產物，拒絕外部 CDN 程式引用；Astra vendor 原始碼不納入掃描。
5. 在桌面 Chromium 與手機觸控模擬執行所選模式的瀏覽器測試。
6. 僅 main push 可上傳並部署已通過快速驗證的 Pages artifact。

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
開發伺服器預設只監聽 `127.0.0.1`；需要區域網路測試時，明確使用
`HOST=0.0.0.0 npm run dev`。它只提供公開目錄及各遊戲的 `dist`，阻擋隱藏檔、
路徑穿越與越界 symlink；畸形網址回傳 400，缺少遊戲或資產回傳 404。

## 圖片與瀏覽器測試範圍

`assets/covers/*.jpg` 是保留的原圖。`npm run generate` 自動產生
`assets/covers/optimized/` 中的 320px／640px WebP 與 640px JPEG fallback。
生成檔不納入版本控制；建置會排除有替代圖片的原始封面。每張 WebP 上限為
150 KiB，JPEG 上限為 200 KiB，超過時建置失敗。

首頁中文字型由 `npm run generate` 在更新選單後自動產生子集，保留
400／500／600 三個字重，涵蓋首頁、遊戲目錄及動態搜尋／最近遊玩文案。
每個 WOFF2 子集上限 128 KiB；原始字型留在儲存庫，不複製至 Pages 產物。
首頁瀏覽器測試驗證字重載入、離線資源、搜尋篩選及字型下載總量低於 420 KiB。

瀏覽器測試涵蓋全部目錄遊戲的進入與返回、選單搜尋／分類／網址恢復、
響應式圖片載入，以及記憶配對和四子棋的實際操作／重開。手機情境使用觸控。
測試收集 JavaScript 例外與站內資產錯誤；可選用的 Google Fonts 在測試中回傳空樣式，
避免外部字型服務影響結果。Astra（`gpt6-astra/`，`vendor/fonts/`）與總覽選單（`assets/fonts/`）
已改本機字型，不再依賴 Google Fonts。主線批次一（FreeCell、Koi-Koi、Dialed-Color、
Cyber-Neon-Rush、Instant-Flash）改用本機 `shared/fonts/`（Fontsource latin；CJK 走系統字型）。
其餘部分 `Games/` 仍可能拉 CDN 字型（允許降級，見 `check:no-cdn`）。
這些基本測試不等於逐款完整玩法或實機效能驗證。

新增遊戲時，將 package.json、規格與 JPG 封面加入目錄並更新 data/games.json；
建置與基本導航測試會自動納入。新增複雜互動時，在 tests/browser 補上對應情境。

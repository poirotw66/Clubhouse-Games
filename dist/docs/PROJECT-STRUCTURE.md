# Clubhouse Games 專案架構與部署指南

本文件說明專案的文件架構、遊戲實作擺放方式，以及如何部署至 GitHub Pages 並透過總覽選單進入各遊戲。

---

## 一、專案根目錄結構

```
Clubhouse-Games/
├── index.html              # 遊戲總覽選單（站台首頁，點選後進入各遊戲）
├── README.md               # 專案說明與規格索引
├── docs/
│   └── PROJECT-STRUCTURE.md   # 本文件：架構與部署指南
├── 01-cards/               # 紙牌類規格（.md）
├── 02-board/               # 棋盤類規格（.md）
├── 03-tiles-dice/          # 牌張類規格（.md）
├── 04-sports-arcade/       # 運動機檯類規格（.md）
├── 05-puzzle/              # 串聯拼砌類規格（.md）
├── 06-minigames/           # 迷你遊戲類規格（.md）
└── Games/                  # 各遊戲實作（每款一子資料夾）
    └── Blackjack-main/     # 已實作：二十一點
        ├── index.html
        ├── package.json
        ├── vite.config.ts
        ├── src/
        └── dist/           # 建置輸出（部署時將此目錄內容對外提供）
```

- **規格文件**：僅放在 `01-cards/`～`06-minigames/`，不包含程式碼。  
- **遊戲實作**：每款遊戲一個獨立子專案，放在 `Games/<遊戲專案名>/`。  
- **總覽選單**：根目錄 `index.html` 為 GitHub Pages 首頁，列出所有遊戲並連結至規格與遊戲入口。
- **本地單一服務**：根目錄執行 `npm run dev` 只會啟動 **一個** Node 伺服器（`server.mjs`），提供選單與靜態檔；各遊戲從 `Games/<名>/dist/` 提供（需先 `npm run build:game <名>`）。不會因遊戲變多而開多個服務。

---

## 二、遊戲實作放置約定

| 項目 | 約定 |
|------|------|
| 路徑 | `Games/<專案資料夾名>/`，例如 `Games/Blackjack-main/`、`Games/Klondike/` |
| 專案名 | 可與規格檔名對應（如 `blackjack`、`klondike`），或保留既有名稱（如 `Blackjack-main`） |
| 建置輸出 | 建議將 Vite/Webpack 的 `dist` 建置到該子資料夾內，或由 CI 將 `dist` 內容複製到 `Games/<名>/` 供 GitHub Pages 提供 |

### 現有範例：Blackjack

- 路徑：`Games/Blackjack-main/`
- 技術：Vite + React + TypeScript
- 建置：在根目錄執行 `npm run build:game Blackjack-main`，或進入該目錄執行 `npm run build`；輸出至 `Games/Blackjack-main/dist/`。
- **本地單一服務**：`server.mjs` 會把 `/Games/Blackjack-main/` 的請求對應到 `Games/Blackjack-main/dist/`，故 Vite 需設定 `base: '/Games/Blackjack-main/'`，建置後資源路徑才會正確。
- **GitHub Pages**：部署時可將 `dist/` 內容複製到 `Games/Blackjack-main/`（或由 CI 建置並輸出到該路徑），並在 Vite 建置時使用 `base: '/Clubhouse-Games/Games/Blackjack-main/'`。

---

## 三、GitHub Pages 部署要點

1. **儲存庫設定**  
   - 在 GitHub 專案 **Settings → Pages** 選擇來源（如 `main` 分支、`/root`）。

2. **站台網址**  
   - 若儲存庫名為 `Clubhouse-Games`，則站台為：  
     `https://<username>.github.io/Clubhouse-Games/`  
   - 根目錄 `index.html` 即為總覽選單首頁。

3. **各遊戲網址**  
   - 二十一點（範例）：`https://<username>.github.io/Clubhouse-Games/Games/Blackjack-main/`  
   - 新遊戲：`https://<username>.github.io/Clubhouse-Games/Games/<專案資料夾名>/`

4. **SPA 的 base 路徑**  
   - 若遊戲為 Vite/React SPA，建置時需設定 `base`，否則資源會找錯路徑。  
   - 範例（Vite）：在 `vite.config.ts` 中設定  
     `base: '/Clubhouse-Games/Games/Blackjack-main/',`  
   - 這樣打包後的 `index.html` 與 `assets/` 會以該路徑為前綴，在 GitHub Pages 下可正常載入。

5. **部署流程建議**  
   - 手動：在專案內執行 `npm run build`，再將 `dist` 內容複製到 `Games/<專案名>/`，commit 後 push。  
   - 自動：使用 GitHub Actions 在 push 時建置各遊戲並將輸出寫入對應的 `Games/<名>/`，再由 Pages 發布。

---

## 四、總覽選單（index.html）行為

- 根目錄的 `index.html` 為 **遊戲總覽選單**：
  - 依六大類列出所有遊戲（紙牌、棋盤、牌張、運動機檯、串聯拼砌、迷你遊戲）。
  - 每個遊戲提供：
    - **規格**：連結到對應 `.md`（如 `01-cards/blackjack.md`）。
    - **進入遊戲**：連結到 `Games/<專案資料夾名>/`；若尚未實作，可顯示「尚未實作」或隱藏連結。
- 你已實作的 **二十一點** 連結至 `Games/Blackjack-main/`，其餘遊戲可先連到規格，待實作後再在選單中補上遊戲連結。

---

## 五、新增一款遊戲的檢查清單

1. **規格**  
   - 確認該遊戲在 `01-cards/`～`06-minigames/` 已有對應 `.md`（已完成）。

2. **專案**  
   - 在 `Games/` 下建立新資料夾，例如 `Games/Klondike/`。  
   - 在該資料夾內建立獨立前端專案（如 Vite + React），實作玩法。  
   - 若有 `metadata.json` 或類似設定，可一併加入（方便未來擴充選單資訊）。

3. **建置與路徑**  
   - 在該遊戲的 `vite.config.ts` 設定 `base: '/Clubhouse-Games/Games/<專案名>/'`。  
   - 建置後將 `dist` 內容部署到 `Games/<專案名>/`（手動或 CI）。

4. **總覽選單**  
   - 在根目錄 `index.html` 中，將該遊戲的「進入遊戲」改為連結到 `Games/<專案名>/`（若選單為靜態維護）。  
   - 若日後改為由 JSON 等資料驅動選單，則在資料來源中新增該遊戲的 path 與名稱即可。

---

## 六、規格與遊戲對照（節錄）

| 類別 | 規格檔（.md） | 建議遊戲路徑（Games/） |
|------|----------------|--------------------------|
| 紙牌 | 01-cards/blackjack.md | Blackjack-main（已實作） |
| 紙牌 | 01-cards/klondike.md | klondike |
| 紙牌 | 01-cards/hanafuda.md | hanafuda |
| … | … | … |

其餘遊戲依相同規則：規格在對應類別資料夾，實作在 `Games/<專案名>/`，選單同時連結規格與遊戲入口。

---

## 七、參考

- 規格總覽與遊戲索引：[README.md](../README.md)  
- 二十一點實作範例：`Games/Blackjack-main/`  
- GitHub Pages 文件：<https://docs.github.com/en/pages>

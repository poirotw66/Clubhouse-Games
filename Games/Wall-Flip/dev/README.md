# Wall Flip 線上排行 API（參考實作）

`rank-server.mjs` 是一個**零依賴**的 Node.js HTTP 伺服器，作為 `../index.html`（牆上翻滾 2D）線上排行榜的後端參考實作。單一檔案、無需 `npm install`，資料存在同目錄的 `rank-data.json`。

## 功能

- `GET /top?c=N` — 回傳 `{ board: [{ n, s, r, t }, ...] }`：賽道 `N` 的前 10 名（`n` 名字、`s` 總分、`r` 翻滾數、`t` 完賽秒數）。
- `POST /submit` — JSON 內容 `{ n, s, r, c, t, log }`，伺服器端驗證後插入、依分數排序、每條賽道最多保留 100 筆，回傳 `{ ok: true, rank: <名次> }`。
- CORS 全開（`Access-Control-Allow-Origin: *`，含 OPTIONS 處理），GitHub Pages 等靜態網站可直接呼叫。

## 執行

```bash
node rank-server.mjs        # 預設埠 8787
node rank-server.mjs 9000   # 指定埠
```

測試：

```bash
curl -X POST http://127.0.0.1:8787/submit \
  -H 'Content-Type: application/json' \
  -d '{"n":"TEST","s":120,"r":2,"c":0,"t":9.87,"log":[[1,2],[240,6]]}'
# -> {"ok":true,"rank":1}

curl 'http://127.0.0.1:8787/top?c=0'
# -> {"board":[{"n":"TEST","s":120,"r":2,"t":9.87}]}
```

## 讓遊戲連上

1. 啟動本伺服器（見上）。
2. 開啟遊戲（本機可用 `python3 -m http.server` 或 `npm run dev` 後打開 `../index.html`）。
3. 進入排行榜（READY 畫面的「排行榜」鈕或按 `L`），點右上角的 **⚙**。
4. 貼上 API 網址，例如 `http://127.0.0.1:8787`，按「儲存」。留空＝停用線上排行（僅本機）。
5. 之後成功著地就會出現「上傳成績」面板，輸入名字（10 字內）按「送出」；排行榜會以「線上」籤頁為主、可切換「本機」。網址存在瀏覽器的 `localStorage`（`wallflip2.api`）。

## 防作弊說明（重要）

分數防護僅為 **best-effort**：用戶端做基本淨化（名字 ≤ 10 字、分數 ≤ 5000、log ≤ 12000 組），伺服器端做欄位驗證與過濾，但**無法證明分數是真的**。每次送出會附上該局的輸入紀錄 `log`（`[距上次變更的影格數, 輸入位元遮罩]` 成對、只記錄變化）——因為遊戲物理是 240 Hz 的**確定性模擬**，未來可在伺服器端用這份 log 重放整局、比對分數是否相符，作為真正的驗證機制；本參考伺服器尚未實作重放，僅保存資料。

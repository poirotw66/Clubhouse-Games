# 岔道疾走（Switchpoint Run）

## 類別

運動機檯類型

## 概述

岔道疾走是一款**鐵道路線抉擇跑酷**。角色沿軌道自動奔跑，前方每隔數秒出現一個**道岔**；玩家扳道選擇要走哪一條支線，每條支線的內容會**提前預覽**。後方有一列持續逼近的火車，慢下來就會被追上。

本作與同分類的〈霓虹疾馳〉刻意不同：那一款是**反射閃避**（看到障礙就切道），這一款是**路線抉擇**（在資訊已知的情況下決定要吃哪種風險）。前者考驗手，後者考驗判斷。

> 本作為原創玩法設計，不使用任何既有商標角色或品牌素材。

## 人數與建議年齡

- 人數：1 人
- 建議年齡：8 歲以上

## 所需器材

- **介面**：雙翼中央鐵道調度座艙（寬螢幕左右雙翼戰術面板、行動端戰術速報條與抽屜）；支援鍵盤與觸控。
- **操作**：
  - 鍵盤：`A` `D` 或 `←` `→` 扳道／變換股道、`W` 或 `↑` 跳躍、`S` 或 `↓` 滑行、`P` 或 `Esc` 暫停。
  - 觸控：支援畫面手勢滑動（左右滑動扳道、上滑跳躍、下滑滑行）以及螢幕虛擬觸控按鍵。
- **計分**：距離、路線評價、連續無傷；最佳成績存於瀏覽器本機（localStorage）。

## 遊戲目標

在被後方列車追上之前跑得越遠越好。距離不是靠跑，是靠**選對路線**。

## 規則說明

### 核心張力：預覽過的風險

1. **道岔**：每隔數秒抵達一個岔口，有 2–3 條支線。扳道方向在抵達前可自由變更，抵達瞬間鎖定。
2. **每條支線都會預覽**：畫面上方以簡圖顯示各支線接下來的內容（障礙密度、有無加速、有無補給）。玩家永遠是在**資訊已知**的情況下做選擇。
3. **後方列車**持續逼近，逼近速度取決於你目前的速度。慢下來就會被追上。
4. **速度只能從危險的分支拿**：安全的支線速度會衰減，快的支線障礙更密。**沒有一條支線是全面最優的**——這是本作的設計核心規則，等同〈球團王朝〉的「每個選項都要付出代價」。

### 支線的三種軸向

一條支線由三個獨立軸向組成，資料驅動、可自由組合：

| 軸向 | 內容 |
|---|---|
| **速度** | 加速／維持／減速 |
| **密度** | 障礙的疏密與類型（低欄需跳、高架需滑、側牆需變股道） |
| **收益** | 補給（回復緩衝）／評分倍率／無 |

規則上**速度與收益必須由密度支付**：任何提高速度或給予收益的支線，密度必須同步提高。反過來說，低密度的支線一定在速度或收益上劣勢。自我測試會斷言不存在「三軸皆優」的支線模板。

### 股道與動作

1. 每條支線內有 **3 條股道**，可左右移動。
2. **跳躍**越過低欄，**滑行**通過高架。兩者都有硬直：跳躍中無法變股道，滑行中無法跳躍。
3. 撞到障礙不會立即結束，而是**大幅降速**——降速讓後方列車逼近，所以懲罰是透過核心張力傳導的，不是一條獨立的血量。

### 緩衝（Buffer）

1. 玩家與後方列車之間的距離即**緩衝**，畫面上持續可見。
2. 緩衝歸零即結束。補給支線可回復緩衝，但補給支線的密度一定較高。
3. 這取代了傳統的「一撞就死」，讓每次失誤有可挽回的餘地，同時保持壓力連續。

### 難度

隨距離推進，**基礎速度上升**且**支線模板池會開放更高階的條目**。難度是一條連續曲線，不是分關卡。

## 勝負條件

- **結束**：緩衝歸零，被列車追上。
- **成績**：分數 = 距離 + 路線評價 × 倍率 + 無傷連續加成。
- **紀錄**：依模式分開保存最佳距離／分數（自由遊玩、每日挑戰、挑戰種子包），見「進度與解鎖」。
- **結算 UI**：共用 `@clubhouse/shared/ResultOverlay`。

## 品質門檻對齊

對照 [`docs/GAME-QUALITY-BAR.md`](../docs/GAME-QUALITY-BAR.md)：

| 項目 | 本實作規範與對齊成果 |
|---|---|
| **模式／變體** | 自由遊玩（Free Play，無盡挑戰、隨距離推進動態開放高階 26 種支線模板）／挑戰種子包（Challenge Pack，6 關手編固定種子闖關階梯：初探道岔、五千之遙、萬米長征、萬分之爭、極限超馳、終焉之途，具備解鎖前進機制）／台北每日挑戰（Daily Challenge，Asia/Taipei UTC+8 日曆日期種子 `DYYYYMMDD` 全球統一題庫，獨立記錄當日最佳與連續挑戰天數 Streak）／車庫負載自訂（4 款特性扳道車：標準／重載／信使／特急 × 4 款地貌主題：深隧／貨場／濱海／夜班 × 4 款修飾規則：玻璃緩衝、密岔預覽、評分狂熱、無補給）。實作：[`src/game/challenges.ts`](../Games/Switchpoint-Run/src/game/challenges.ts)、[`src/game/daily.ts`](../Games/Switchpoint-Run/src/game/daily.ts)、[`src/game/profiles.ts`](../Games/Switchpoint-Run/src/game/profiles.ts)、[`src/game/themes.ts`](../Games/Switchpoint-Run/src/game/themes.ts)、[`src/game/modifiers.ts`](../Games/Switchpoint-Run/src/game/modifiers.ts)。 |
| **重玩誘因** | 採用結構化本機儲存（`switchpoint-run:meta-v1` 與 `switchpoint-run:challenges`），具備嚴格防禦解析與自動遷移舊版 `best-distance` / `best-score`。持久化儲存自由遊玩最佳距離、最高分數、總趟數、生涯累積里程與通過道岔數；結算鐵道螺栓經濟貨幣（依距離、岔道數、連擊數與評分換算，用於解鎖車款與地貌主題）；記錄台北每日挑戰今日最佳距離、最高得分、嘗試次數與連續每日完成天數（Streak）；記錄挑戰種子包 6 關解鎖進度與各關最佳成績。實作：[`src/game/progress.ts`](../Games/Switchpoint-Run/src/game/progress.ts)、[`src/game/challenges.ts`](../Games/Switchpoint-Run/src/game/challenges.ts)、[`src/game/daily.ts`](../Games/Switchpoint-Run/src/game/daily.ts)。 |
| **盤面／卡牌對手與提示** | 即時高速跑酷不適用 Undo；無棋盤卡牌對手，以「後方追越列車（Pursuit Train）」作為連續動態加壓對手。左翼中央調度信號雷達（Signal Dispatch Radar）提供三股道拓撲預警、綠／黃／紅信號燈識別、道岔自動鎖定距離與時間倒數條、追越列車差速計（Δv）與三段式安全／警戒／緊急預警；右翼行車記錄黑盒子提供調度員動態錦囊（依即時列車間距與車速智慧建議避險或進攻策略）、即時調度事件簿與倍率收益矩陣；首次開跑提供新手操作引導與障礙識別說明（低欄跳躍、鋼樑鏟滑、側牆變更股道）。實作：[`src/components/DispatchLeftWing.tsx`](../Games/Switchpoint-Run/src/components/DispatchLeftWing.tsx)、[`src/components/DispatchRightWing.tsx`](../Games/Switchpoint-Run/src/components/DispatchRightWing.tsx)、[`src/game/engine.ts`](../Games/Switchpoint-Run/src/game/engine.ts)。 |
| **手感回饋** | 結算面板深度整合共用套件 `@clubhouse/shared/ResultOverlay`：依勝負條件（挑戰成功、挑戰未過、今日挑戰結束、被列車追上）動態呈現結算卡片，包含距離、分數、目標、螺栓收益、解鎖徽章與重試／下一關／回選單動作，主要按鈕明確標記快捷鍵提示（如「再試一次 (Space)」、「再跑一次 (Space)」、「再挑戰今日 (Space)」），並支援鍵盤 `Space` / `Enter` / `KeyR` 極速重試（gameplay-ux-009 Rapid Retry）。深度整合共用 WebAudio 原生合成音效 `@clubhouse/shared/synthAudio`（`playMove` 扳道變更股道音、`playWin` 挑戰通關和弦、`playLose` 列車追撞出局音、`playScore` 收集物資音、`playCombo` 連續無傷升調音、`playError` 撞擊制動音）。撞擊觸發 Hit-Stop 凍結與畫面震顫（Screen Shake）、擦身閃避粒子、扳道鎖定光環、高速速度線（Speed Lines）、車載姿態動力儀、電競按鍵 HUD 發光；完整支援 `prefers-reduced-motion: reduce` 無障礙降級。實作：[`src/App.tsx`](../Games/Switchpoint-Run/src/App.tsx)、[`src/game/juice.ts`](../Games/Switchpoint-Run/src/game/juice.ts)、[`src/components/GameCanvas.tsx`](../Games/Switchpoint-Run/src/components/GameCanvas.tsx)。 |
| **原生觸控支援** | 雙重原生觸控模式：支援手勢滑動（左右滑動扳道換股道、上滑跳躍、下滑鏟滑）與行動端專屬大尺寸電競虛擬按鍵（`MobileControlsOverlay`：左扳道、右扳道、跳躍、鏟滑，可一鍵開啟或隱藏）。觸控手勢具備 28px 移動門檻防抖（Debounce）與方向優先級判定，避免誤觸；切道硬直與冷卻時間（100ms）防止連點抽搐。整合行動端調度速報條（`MobileTacticalRibbon`，整合緩衝%、差速計與即時道岔簡況）與可隨時滑出之調度速報抽屜（`DispatchDrawer`）。原生觸控震動反饋（Haptic Feedback：tap 0.6 / 0.7）與 CSS `touch-action: manipulation` 防雙擊縮放。實作：[`src/components/MobileControlsOverlay.tsx`](../Games/Switchpoint-Run/src/components/MobileControlsOverlay.tsx)、[`src/components/MobileTacticalRibbon.tsx`](../Games/Switchpoint-Run/src/components/MobileTacticalRibbon.tsx)、[`src/components/DispatchDrawer.tsx`](../Games/Switchpoint-Run/src/components/DispatchDrawer.tsx)、[`src/App.tsx`](../Games/Switchpoint-Run/src/App.tsx)。 |
| **驗證腳本** | 執行 `npm run lint -w switchpoint-run`（TypeScript 零錯誤）與 `npm run check -w switchpoint-run`（`scripts/self-check.ts`，大幅擴充深化至 >1,600 行）。涵蓋：1) 多道岔分支預覽窗與鐵路信號燈指示器狀態機（2 支線 vs 3 支線股道佔用、封閉股道識別、APPROACH_LEN 預覽距離倒數、誤入封閉軌道制動懲罰與最近安全股道重定位、信號燈綠黃紅色彩契約與密度光點投影）；2) 後方追越列車差速公式、追越加速度與緩衝恢復（Δv = v_player - v_train 微分積分模型、撞擊失速降至 0.22x 之追越加速度極限、緩衝上限 430m 截斷防止無盡脫逃、補給節點 +190m 階躍恢復與歸零出局判定）；3) 全 26 款支線模板之密度 vs 速度評分權衡（無任一模板三軸占優、危險加速/評分路徑產出最高倍率成長與連擊無傷密度加成、失誤撞擊喪失密度清潔加分之嚴格風險回報守恆）；4) 行動端觸控滑動切道輸入防抖（Debounce）、跳躍/鏟滑互斥狀態機轉移與撞擊失速無敵緩衝期（100ms 切道冷卻、跳躍/鏟滑互鎖、障礙物一次性解析標記與同軌 110m 間距容許度）；5) Asia/Taipei 台北時區日曆換日決定論與連勝天數守恆（UTC 16:00 跨日翻轉、跨月跨年與閏年邊界計算、每日種子 DYYYYMMDD 全局統一性、連勝 Streak 維持與中斷判定）。實作：[`scripts/self-check.ts`](../Games/Switchpoint-Run/scripts/self-check.ts)。 |

## 雙翼中央調度座艙（Dual-Wing Cockpit）

為提供極致的鐵道調度臨場感與資訊透明度，遊戲搭載雙翼戰術調度座艙：

1. **左翼：中央調度信號雷達與拓撲監控（Signal Dispatch Radar）**：
   - **道岔拓撲預警**：顯示前方即將抵達的 3 線股道屬性（加速／維持／減速、障礙密度、補給／倍率節點），並即時標注玩家當前扳道對準狀態與鎖定倒數。
   - **列車追越緩衝儀與差速計（Δv）**：多段緩衝計量與追越警報（安全綠光／警戒橙光／緊急紅閃），即時計算玩家與追越列車的差速（拉開速度或逼近速度）。
   - **車載動力姿態儀**：顯示即時車速、機車型號以及滯空／鏟滑／制動冷卻姿態。
2. **右翼：行車記錄黑盒子與戰術中心（Flight Recorder & Tactical Hub）**：
   - **即時調度事件簿**：即時紀錄道岔切換、障礙擦撞制動、補給捕獲、評分倍率跳升與連擊達成日誌。
   - **收益倍率矩陣**：即時展示路線評價、評分倍率乘數、無傷連擊與預估結算螺栓。
   - **調度員動態錦囊**：依據當前列車間距與車速，動態提示最佳避險與進攻策略。
   - **電競鍵盤 HUD**：實體按鍵（`A`/`D` 或 `←`/`→`、`W`/`↑`、`S`/`↓`、`P`）的即時按壓回饋發光鍵帽。
3. **行動端調度速報與觸控按鍵**：
   - 頂部緊湊戰術速報條（整合緩衝%、差速計與即時道岔簡況）。
   - 可隨時點開的調度速報抽屜（提供完整道岔拓撲與黑盒子日誌）。
   - 螢幕底部虛擬觸控按鍵（支援單鍵點按換道與跳躍鏟滑，並可自由開啟或關閉）。

## 手感回饋（Juice）

撞擊會觸發短暫 **hit-stop** 與畫面震動；補給／扳道鎖定／擦身閃避會噴出粒子；高速時出現速度線；連續無傷以連擊數字與升調音效回饋。以上皆遵守 `prefers-reduced-motion: reduce`（關閉震動／粒子／hit-stop 動畫，改以靜態閃光或省略）。實作：`Games/Switchpoint-Run/src/game/juice.ts`、`GameCanvas.tsx`。

## 進度與解鎖

跑完一趟會結算 **鐵道螺栓**（與距離、岔道數、連擊、分數相關）。螺栓可解鎖：

| 種類 | 內容 | 玩法意義 |
|---|---|---|
| **扳道車** | 標準／重載／信使／特急 | 改變起步緩衝、上限、速度、撞擊恢復、換股道冷卻、補給量 |
| **路線主題** | 深隧／貨場／濱海／夜班 | 調色之外改變列車追趕倍率與岔口密度偏好 |
| **修飾規則** | 玻璃緩衝、密岔預覽、評分狂熱、無補給等 | 以自由遊玩最佳距離里程碑解鎖，可疊加；挑戰種子包不套用 |

Meta 存於 `switchpoint-run:meta-v1`；讀取時逐欄驗證，損壞資料回落安全預設。挑戰進度仍為 `switchpoint-run:challenges`。實作：`Games/Switchpoint-Run/src/game/progress.ts`、`profiles.ts`、`themes.ts`、`modifiers.ts`。

預設負載（標準車＋深隧、無修飾）必須與初版常數一致，以免平衡腳本與挑戰種子失效。

## 每日挑戰

標題有 **今日挑戰** CTA。種子碼由當日曆日決定（`DYYYYMMDD`），走既有決定性 seeding；當日最佳距離／分數獨立紀錄。實作：`Games/Switchpoint-Run/src/game/daily.ts`。

## 挑戰種子包

標題畫面有 **挑戰種子包** CTA。固定種子的關卡包（目前 6 關），達成距離或分數門檻才算通關；關卡依序解鎖（通關第 N 關才開第 N+1 關）。目標種類：距離門檻、分數門檻。挑戰跑一律使用預設負載（不解鎖車／主題／修飾），種子可比。

通關當下即結算成功（不必等被追上）；未達目標被追上則為「挑戰未過」。進度獨立存放於 `switchpoint-run:challenges`（與自由遊玩最佳距離／分數互不覆寫）。實作：`Games/Switchpoint-Run/src/game/challenges.ts`。

## 平衡量測（第一天就要有）

模擬層為**固定時間步長的純函數**：整趟是 `(種子, 輸入序列)` 的函數，可重播、可無頭模擬。平衡工具與遊戲同時存在。要量的是：

1. **不存在全面最優的支線**——用「永遠選最快」「永遠選最安全」「永遠選補給」三種策略跑，三者的平均距離必須落在可比較的區間，不能有一種碾壓其他。
2. **支線模板池的跨趟重疊率**——一趟只應看到池子的少數。
3. **緩衝曲線**——不能出現「開頭必死」或「撐過前段就再也不會死」。
4. **預覽的資訊必須足夠**——盲選（隨機扳道）與依預覽選擇的策略，成績必須有顯著差距。若沒有差距，代表預覽是裝飾。

## 常見變體或可選規則

- **種子分享**：輸入相同種子碼重現完全相同的路線，可比較同一條路線上誰跑得遠。
- **挑戰種子包**：標題選關，固定種子＋距離／分數門檻（見上節）。
- **每日挑戰**：日曆種子＋當日最佳（見上節）。
- **車庫負載**：解鎖扳道車／主題／修飾後，自由遊玩與每日挑戰可裝備（挑戰包除外）。

## 備註

- 以 2D Canvas 繪製（側視或俯視皆可，實作時決定），**不使用 3D 引擎**——同分類的〈霓虹疾馳〉已經是 Three.js，這一款刻意走輕量路線。
- 不含任何第三方美術資源。
- **極速重試（`gameplay-ux-009` Rapid Retry）**：被列車追上或通關結算時，直接支援按 <kbd>Space</kbd> / <kbd>Enter</kbd> / <kbd>KeyR</kbd> 瞬時重啟跑酷，免除滑鼠點擊等待，將失敗重試的熱情冷卻時間降至零；結算按鈕標籤明確提示 `(Space)` 快捷鍵。
- 語言：程式識別字與註解用英文；玩家可見文案僅繁體中文。

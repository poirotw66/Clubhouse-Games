# 神秘液體排序（Mystery Liquid Sort）

## 類別

串聯拼砌類型

## 概述

神秘液體排序（Mystery Liquid Sort）是一款單人益智遊戲：玩家將 **多種顏色的液體** 在 **瓶子** 之間傾倒，目標是讓每個瓶子內只留下 **單一顏色** 的液體（或留空），從而完成關卡。本作結合「液體分色」機制與 **隱藏層**、**每日任務**、**道具** 等要素，可支援冒險模式、快速遊玩，以及手編 **關卡包**。

## 人數與建議年齡

- 人數：1 人。
- 建議年齡：約 6 歲以上。

## 所需器材

- **瓶子**：每關有若干個瓶子，每個瓶子有固定容量（例如 4～6 格）。
- **液體層**：每格為一種顏色；可存在 **隱藏層**（未揭露前不可傾倒）。
- **操作**：點選來源瓶子再點選目標瓶子，將頂部同色液體傾倒至目標瓶（目標須為空或頂部同色，且未滿）。

## 遊戲目標

- 將所有液體 **按顏色分裝**，使每個瓶子內僅有一種顏色（或為空）。
- 完成後該瓶視為「完成」；全部完成即過關。
- 可選目標：完成每日任務（例如傾倒次數、過關數、使用道具）以獲得代幣，用於購買道具。

## 規則說明

### 準備／設定

- 每關會給定瓶子數量、容量與各瓶內液體顏色分布。
- 部分關卡含有 **隱藏層**：該層在頂部液體被倒出後才會揭露，揭露前不能作為傾倒來源。
- 難度可體現為：顏色種類數、瓶子容量、隱藏層數量。

### 傾倒規則

1. **來源**：點選一個瓶子，其 **最上層**（且非隱藏）的液體顏色為本次傾倒的顏色。
2. **目標**：點選另一個瓶子。目標須滿足：
   - 未滿（層數 < 容量）；
   - 為空，或 **頂部顏色與來源頂部顏色相同**。
3. **傾倒量**：一次傾倒會將來源瓶頂部 **連續同色** 且 **非隱藏** 的液體，依序移入目標瓶，直到目標滿或來源頂部不再同色／遇隱藏為止。
4. **完成瓶**：當一瓶內液體已滿且全部為同一顏色（且無隱藏）時，該瓶視為完成，通常不再接受傾倒。

### 可行動作與限制

- 不可將液體倒入已完成的瓶子。
- 隱藏層在未被揭露前不可作為傾倒來源。
- 空瓶可作為任意顏色的傾倒目標（若來源頂部為該色）。

## 勝負條件

- **過關**：所有瓶子均為「單一顏色或空」即勝利。
- **未過關**：無步數或時間強制失敗時，可持續嘗試；部分模式可搭配道具（如復原、洗牌、增加空瓶、揭露隱藏層）協助過關。

## 常見變體或可選規則

- **冒險模式**：關卡遞進，難度（顏色數、容量、隱藏層）逐漸提高；自第 4 關起開放混色（偶數容量時可出現必混訂單色）。
- **快速遊玩**：自選難度（簡單／中等／困難／專家）；可加挑戰規則（限步／限時），最佳倒次分軌儲存。
- **關卡包**：手編固定盤面（命名關卡），進度以 `mls-puzzle-pack-v1` 分軌，不與冒險／快速遊玩共用。
- **混合墨水挑戰**：手編必混配方關，進度以 `mls-mix-challenge-v1` 分軌（勿與關卡包共用）。
- **每日任務**：完成指定條件（傾倒次數、過關、使用道具）獲得代幣。
- **道具**：提示下一步、復原一步、洗牌、增加空瓶、揭露隱藏層等，消耗代幣使用。
- **混色**：紅+黃→橙、藍+黃→綠、紅+藍→紫；混色不可逆。局內可看配方 HUD。

## 關卡包（puzzle_pack）

Home「關卡包」入口；8 關手編盤面（三色入門 → 六色終章），含隱藏層關。依序解鎖：清完第 N 關才開第 N+1。過關記錄該關最佳倒次。`check` 覆蓋每關可解性與進度函式。純分色（`mixingEnabled: false`）。

## 混合墨水挑戰（mix_challenge）

Home「混合墨水挑戰」入口；6 關必混配方（橙墨初混 → 三色混終章）。依序解鎖；進度鍵 `mls-mix-challenge-v1`。局內顯示配方 tip 與配方 HUD。

## 機制挑戰（mechanism_pack）

Home「機制挑戰」入口；6 關新手感機制：

- **封鎖瓶**：開局封印，不可倒入／倒出；每交付一筆訂單依盤面順序解鎖下一瓶。
- **參差容量**：同關瓶子容量可不同（2／3／4）。
- **步數上限**（部分關）：超過即敗。
- **星級**：以自動驗證的 **最少步數**（`minSteps`）為 3★ 標準；進度鍵 `mls-mechanism-pack-v1`。

`check-liquid-sort.mjs` 對每關做交付感知 BFS，確認可解且 `minSteps` 與最短解一致。

## 手感與長期目標

- **手感與視覺創新**：
  - **即時倒液預測（Live Pour Projection）**：選中來源瓶後，所有合法目標瓶即時顯示脈衝「幽靈預覽層（Ghost Layer）」與頂部動態膠囊徽章（`+X 格`、`✨ 混色：配方`、`⭐ 滿瓶交單！`），消除倒液步數與混色猶豫。
  - **動態微物理流體表現**：試管頂部液面呈現真實微張力彎月水波（Meniscus Wave）與高光鏡面；液體內部升起隨機浮動微氣泡粒子。
  - **流體傾倒與鍊金混色反應**：來源瓶 55° 大角度向目標瓶傾注，目標瓶口噴濺動態液體流束與衝擊水花圈；觸發混色時迸發旋轉鍊金星芒（Alchemy Swirl）。
  - **平衡實驗室試管架（Test Tube Rack）**：依關卡瓶數自適應分層排版（如 5 瓶自動分為 3+2 雙排），下方襯托質感深木底架，擺脫孤立落單瓶與懸空漂浮感。
  - **訂單交付星芒慶祝**：訂單達成時浮現星芒與微彈跳。
  - 全數動態遵循 `prefers-reduced-motion`。
- **每日一題**：依日期輪替手編盤面；可複製分享文字；通關計入 **連續天數**。
- **外觀商店**：代幣解鎖瓶子／液體造型（`mls-cosmetics-v1`）。

## 化學合成實驗室雙翼座艙（Chemical Synthesis Cockpit）

將傳統液體排序遊戲躍升為高科技化學鍊金座艙體驗：

- **左翼座艙（純度光譜儀與最優導航羅盤）**：
  - **試管顏色純度光譜儀（Color Purity Spectrometer）**：即時分析全場液體（緋紅、湛藍、翠綠、澄黃、紫晶、暖橙、青碧），展示各色純化進度條與全場綜合純化指數（Overall Lab Purity Index）。
  - **最優步數導航指針（Par Steps Compass）**：依據基準步數（Par Steps）與關卡極限動態偏轉導航指針，即時計算當前步數效率評級（S級卓越、A級精準、B級平穩、C級冗餘）。
- **右翼座艙（態勢雷達與化學錦囊）**：
  - **可行操作與死局過載雷達（Deadlock & Invalid Pour Radar）**：實時計算全場可行倒水航道組數；當航道歸零時觸發「死局過載警報」，並追蹤「可用緩衝管」餘裕。
  - **試管狀態快檢矩陣（Tube Status Quick Matrix）**：高密度監控矩陣呈現各試管編號、即時狀態（純淨封裝 🔒、同色匯整 💧、混雜待析 🧪、緩衝空管 ⚪、封鎖 🧊）與容量，支援滑鼠與觸控直接選管。
  - **化學大師通關錦囊（Chemistry Master Tips）**：內建四大核心調配戰術（空試管保留策略、同色匯流優先級、層級逆向推演、鍊金不可逆配方）。
- **全鍵盤數字直選倒水（Keypad Pour Matrix）**：
  - 鍵盤數字鍵與九宮格數字鍵 <kbd>1</kbd>～<kbd>9</kbd> 秒速選定來源管與目標管，試管底部常駐高對比鍵位指示徽章，大幅縮短操作延遲。
  - 輔助快捷鍵：<kbd>U</kbd> 悔棋復原、<kbd>R</kbd> 重新開始、<kbd>H</kbd> 智能提示、<kbd>Esc</kbd> 取消選取。
- **感官反饋升級**：
  - 接入 `@clubhouse/shared/synthAudio` 之 Web Audio 物理合成注水汩汩聲（Bubbling Pour）、滿瓶昇華金色晶瑩和弦（Sublimation Chime）與鍊金混色反應音。
  - 接入 `@clubhouse/shared/juice` 微物理微粒噴濺（sparkle / burst / confetti）與觸覺回饋（haptics）。
- **行動端頂部緊湊戰術速報條（Tactical Quick Strip）**：
  - 行動版頂部整合戰術微型速報條，支援一鍵開啟左翼光譜儀與右翼錦囊抽屜，兼顧觸控舒適度與決策深度。

## 品質門檻對齊

對照 [`docs/GAME-QUALITY-BAR.md`](../docs/GAME-QUALITY-BAR.md)：

| 項目 | 本實作說明與亮點 |
|------|------------------|
| **模式／變體** | 涵蓋六大遊玩模式：**冒險模式**（無盡遞進關卡，隨等級擴增顏色、瓶容與隱藏層，自第 4 關起開放混色）、**快速遊玩**（自選簡單／普通／困難／專家難度 × 限步／限時挑戰規則）、**手編關卡包**（8 關純分色精選題庫，依序解鎖）、**混合墨水挑戰**（6 關必混配方關卡，搭配專屬配方提示 HUD）、**機制挑戰**（6 關封鎖瓶解鎖／參差容量 2～4 / 3★ 最少步數 `minSteps` 評級）、**每日挑戰**（Asia/Taipei UTC+8 日曆種子循環題庫與每日任務）。相關實作請見：[`services/gameLogic.ts`](../Games/Mystery-Liquid-Sort/services/gameLogic.ts)、[`services/puzzlePack.ts`](../Games/Mystery-Liquid-Sort/services/puzzlePack.ts)、[`services/mixChallengePack.ts`](../Games/Mystery-Liquid-Sort/services/mixChallengePack.ts)、[`services/mechanismPack.ts`](../Games/Mystery-Liquid-Sort/services/mechanismPack.ts)、[`services/dailyChallenge.ts`](../Games/Mystery-Liquid-Sort/services/dailyChallenge.ts)。 |
| **Replay hook** | 完整持久化至 `localStorage`：關卡包進度與最佳倒次（`mls-puzzle-pack-v1`）、混合墨水挑戰進度（`mls-mix-challenge-v1`）、機制挑戰星級與最佳步數（`mls-mechanism-pack-v1`）、每日挑戰連續過關天數與最佳紀錄（`mls-streak-v1`）、每日一題完成日期（`mls-daily-clear-v1`）、每日任務進度與代幣經濟（`mls-missions-v1`、`mls-economy-v1`）、外觀商店解鎖紀錄（`mls-cosmetics-v1`）與新手教學標記（`mls-howto-seen`）。相關實作請見：[`services/streakService.ts`](../Games/Mystery-Liquid-Sort/services/streakService.ts)、[`services/dailyChallenge.ts`](../Games/Mystery-Liquid-Sort/services/dailyChallenge.ts)、[`services/missionService.ts`](../Games/Mystery-Liquid-Sort/services/missionService.ts)、[`services/economyService.ts`](../Games/Mystery-Liquid-Sort/services/economyService.ts)、[`services/cosmeticsService.ts`](../Games/Mystery-Liquid-Sort/services/cosmeticsService.ts)。 |
| **對手／輔助（Undo／Hint）** | 搭載高科技化學鍊金雙翼座艙與多重輔助道具：**多步悔棋復原（Undo）**（快照歷史棧完整還原試管分層、液體狀態與訂單交付解鎖狀態，支援快捷鍵 <kbd>U</kbd>）、**即時重新開始（Restart）**（一鍵復原原始題盤與倒次，支援快捷鍵 <kbd>R</kbd>）、**智能解題推薦提示（Hint）**（啟發式評分引擎即時推薦最優合法傾倒路徑，優先促成滿瓶與同色匯流，支援快捷鍵 <kbd>H</kbd>）、**備用試管道具（Extra Vial Booster）**（動態添入額外容量緩衝試管，安全解圍死局狀態）、**洗牌道具（Shuffle）** 與 **隱藏層全揭露（Reveal）**，以及雙翼座艙之可行航道與死局過載雷達、最優步數羅盤（Par Steps Compass）與化學大師通關錦囊。相關實作請見：[`components/Game.tsx`](../Games/Mystery-Liquid-Sort/components/Game.tsx)、[`services/gameLogic.ts`](../Games/Mystery-Liquid-Sort/services/gameLogic.ts)、[`utils/cockpitMetrics.ts`](../Games/Mystery-Liquid-Sort/utils/cockpitMetrics.ts)、[`components/CockpitLeftWing.tsx`](../Games/Mystery-Liquid-Sort/components/CockpitLeftWing.tsx)、[`components/CockpitRightWing.tsx`](../Games/Mystery-Liquid-Sort/components/CockpitRightWing.tsx)。 |
| **回饋（Feedback）** | 採用標準化結算面板架構（展示勝負、倒次步數、用時、步數效率評級 S/A/B/C、星級與再玩／下一關／分享功能，契約相容 ResultOverlay 規範）；搭配原生 Web Audio 合成音效（注水汩汩聲 Bubbling Pour、滿瓶昇華金色晶瑩和弦 Sublimation Chime、鍊金混色反應音、錯誤警報與彈出音）；動態視覺包含即時倒液預測（Live Pour Projection 脈衝幽靈層 Ghost Layer、`+X 格` 動態膠囊徽章）、微物理流體彎月波（Meniscus Wave）、微氣泡上升粒子、傾倒流束與鍊金星芒慶祝。相關實作請見：[`components/Game.tsx`](../Games/Mystery-Liquid-Sort/components/Game.tsx)、[`utils/sound.ts`](../Games/Mystery-Liquid-Sort/utils/sound.ts)、[`utils/pourPreview.ts`](../Games/Mystery-Liquid-Sort/utils/pourPreview.ts)、[`components/Bottle.tsx`](../Games/Mystery-Liquid-Sort/components/Bottle.tsx)、[`index.css`](../Games/Mystery-Liquid-Sort/index.css)。 |
| **觸控與操作（Touch）** | 完整行動端原生觸控支援：直覺點選來源管與目標管完成注水；自適應平衡實驗室試管架（Test Tube Rack，依瓶數動態配置 3+2 等多排排版，避免孤立懸空）；行動端專屬頂部緊湊戰術速報條（Tactical Quick Strip，高密度展示純度、步數與航道，一鍵滑出光譜儀與錦囊抽屜）；桌面端支援九宮格數字鍵倒水矩陣（Keypad Pour Matrix <kbd>1</kbd>～<kbd>9</kbd> 秒速選管）。相關實作請見：[`components/TestTubeRack.tsx`](../Games/Mystery-Liquid-Sort/components/TestTubeRack.tsx)、[`components/TacticalStrip.tsx`](../Games/Mystery-Liquid-Sort/components/TacticalStrip.tsx)、[`components/Bottle.tsx`](../Games/Mystery-Liquid-Sort/components/Bottle.tsx)、[`components/Game.tsx`](../Games/Mystery-Liquid-Sort/components/Game.tsx)。 |
| **驗證腳本（Check）** | `npm run check -w mystery-liquid-sort` → [`check-liquid-sort.mjs`](../Games/Mystery-Liquid-Sort/check-liquid-sort.mjs)（無瀏覽器依賴純邏輯驗證，深度測試擴充至 >1,600 行）：涵蓋液體轉移容量與溢位截斷不變量（連續同色轉移、容量 4 截斷防溢出、容積守恆）、盲層／迷霧層揭露不變量（頂部露出逐層揭露、未解開前禁倒禁滿）、IDA* 啟發式解題器回溯深度上限與死局不可解狀態偵測（容許式啟發式函數、深度上限截斷、零可行步死局偵測、容積赤字偵測、不可逆混色死局偵測）、備用試管安全與多步 Undo / Restart 狀態守恆（快照棧步步復原、交付倒回、重置恢復原貌）、Asia/Taipei（UTC+8）跨日曆／跨月／跨年邊界種子決定論與連續天數（Streak）守恆、全關卡包（Puzzle Pack / Mix Challenge / Mechanism Pack / Daily Boards）交付感知 BFS 可解性與座艙指標算式檢驗。 |

## 實作結構

- 專案根目錄：[`Games/Mystery-Liquid-Sort/`](../Games/Mystery-Liquid-Sort/)
- 遊戲核心邏輯：[`services/gameLogic.ts`](../Games/Mystery-Liquid-Sort/services/gameLogic.ts)
- 關卡與挑戰題庫：[`services/puzzlePack.ts`](../Games/Mystery-Liquid-Sort/services/puzzlePack.ts)、[`services/mixChallengePack.ts`](../Games/Mystery-Liquid-Sort/services/mixChallengePack.ts)、[`services/mechanismPack.ts`](../Games/Mystery-Liquid-Sort/services/mechanismPack.ts)、[`services/dailyChallenge.ts`](../Games/Mystery-Liquid-Sort/services/dailyChallenge.ts)
- 連續天數與存檔：[`services/streakService.ts`](../Games/Mystery-Liquid-Sort/services/streakService.ts)、[`services/missionService.ts`](../Games/Mystery-Liquid-Sort/services/missionService.ts)、[`services/economyService.ts`](../Games/Mystery-Liquid-Sort/services/economyService.ts)、[`services/cosmeticsService.ts`](../Games/Mystery-Liquid-Sort/services/cosmeticsService.ts)
- 雙翼座艙遙測與預測：[`utils/cockpitMetrics.ts`](../Games/Mystery-Liquid-Sort/utils/cockpitMetrics.ts)、[`utils/pourPreview.ts`](../Games/Mystery-Liquid-Sort/utils/pourPreview.ts)、[`utils/sound.ts`](../Games/Mystery-Liquid-Sort/utils/sound.ts)
- 主要介面組件：[`components/Game.tsx`](../Games/Mystery-Liquid-Sort/components/Game.tsx)、[`components/Bottle.tsx`](../Games/Mystery-Liquid-Sort/components/Bottle.tsx)、[`components/TestTubeRack.tsx`](../Games/Mystery-Liquid-Sort/components/TestTubeRack.tsx)、[`components/TacticalStrip.tsx`](../Games/Mystery-Liquid-Sort/components/TacticalStrip.tsx)、[`components/CockpitLeftWing.tsx`](../Games/Mystery-Liquid-Sort/components/CockpitLeftWing.tsx)、[`components/CockpitRightWing.tsx`](../Games/Mystery-Liquid-Sort/components/CockpitRightWing.tsx)
- 深度驗證腳本：[`check-liquid-sort.mjs`](../Games/Mystery-Liquid-Sort/check-liquid-sort.mjs)

## 參考來源

- 本專案實作：`Games/Mystery-Liquid-Sort/`
- 同類型液體排序益智遊戲與 Clubhouse Games 收錄

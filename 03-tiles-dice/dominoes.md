# 西洋骨牌（Dominoes）

## 類別

牌張類型

## 概述

西洋骨牌（Dominoes）是一類用「骨牌」進行的遊戲；每張牌有兩端，各標有 0～6 點（或更多）。玩家輪流將己方牌接到桌面已出牌的「線」上，使相鄰端點點數相同；常見目標為先出完手牌，或依點數計分。本規格以 **阻擋型／抽牌型／五倍數（All Fives）** 雙人玩法為主，並以整場累積分數決勝負。

## 人數與建議年齡

- 人數：2～4 人（或更多，依變體）。
- 建議年齡：約 6 歲以上。

## 所需器材

- **骨牌組**：標準「雙六」組為 28 張（0-0 至 6-6 各組合一張）；雙九 55 張、雙十二 91 張等為擴充。
- 牌背無區分，洗牌後抽牌。

## 遊戲目標

- **阻擋型／摸牌型**：先 **出完手牌** 者得對手手牌點數；若無人能出牌則「阻塞」，點數較少者得分。整場先達約定總分者勝。
- **五倍數（All Fives / Muggins）**：出牌時使開放端點點數之和為 5 的倍數即可得分；一手結束另計對手剩餘點數（四捨五入到 5）。整場先達約定總分者勝。

## 規則說明

### 準備／設定（雙人）

1. 28 張牌洗勻，面朝下。每人抽 7 張，其餘為 **牌堆（boneyard）**。
2. 持最大雙張者先出第一張，放在桌面中央。

### 回合流程

1. 輪到的一方從手牌選一張，與開放端點點數 **相同** 的一邊相接。
2. **五倍數**：第一張雙張為 **轉軸（spinner）**，四邊皆可接（須先接滿左右兩側，再接上下）。雙張在端點時計兩倍點數。
3. **無法出牌時**（依規則變體）：
   - **摸牌制（Draw）**／**五倍數**：從牌堆抽牌直到能出，或牌堆剩 2 張不抽後改為跳過。
   - **封鎖制（Block）**：直接跳過，不摸牌。
4. 先 **出完手牌** 或雙方阻塞時結算本局分數，累加入整場比分。

### 計分（五倍數）

- 每次出牌後加總所有開放端點；若為 5 的倍數（5／10／15…），立即得該和為分。
- 一手結束：出完者得對手手牌點數和（四捨五入到最近的 5）；阻塞時點數較少者得對手點數（同樣四捨五入）。
- 整場目標可選 61／100／150 分。

### 計分（摸牌制／封鎖制）

- 無中途端點得分。出完或阻塞勝者得對手手牌點數和（原點，不四捨五入）。
- 整場同樣累積到目標分。

## 勝負條件

- **單局**：出完手牌或阻塞結算後，將本局得分記入比賽。
- **整場**：先達到約定總分（61／100／150）者勝；若同時達標且同分則繼續加賽。

## 常見變體或可選規則

- **Block Game**：不抽牌，無法出則過牌。
- **Draw Game**：可抽牌直到能出；牌堆留 2 張不抽。
- **All Fives / Muggins**：端點和為 5 的倍數時得分；第一張雙張為 spinner。

## 參考來源

- Wikipedia: Dominoes
- Pagat.com: All Fives / Muggins

## Clubhouse 實作（摘要）

路徑：[Games/Dominoes/](../Games/Dominoes/)

- 雙人／對電腦；**五倍數／摸牌制／封鎖制**；整場先達 61／100／150；三級 AI（Hard 會算即時得分、留下的端點危險、與對手疑似缺門）、Hint、Undo。
- **3D 奢華骨牌工藝與古典雙張排版（Luxury Bone Tile Craft）**：
  - **三種精工材質**：
    - **典藏象牙（Imperial Ivory）**：溫潤骨白質感、沉香黑曜凹雕點數、微倒角拋光陰影。
    - **皇家黑曜（Royal Obsidian）**：火山玄石暗面、24K 閃耀黃金點數與金屬微光。
    - **古董胡桃（Antique Walnut）**：頂級深色木紋、珠光古銅嵌點與陳年原木質感。
  - **黃銅中孔轉軸鉚釘（Brass Spinner Rivet）**：完整重現古典骨牌中央防磨金屬鉚釘；在五倍數模式激活時具備專屬光芒。
  - **正統橫向雙張排版（Transverse Doubles）**：水平鏈上的雙張骨牌垂直橫置、垂直臂上的雙張骨牌水平橫置，真實還原百年骨牌排面美學。
  - **點數呈現模式**：支援「經典點數 (Pips)」、「數字標籤 (Numerals)」與「雙模並存 (Hybrid)」隨心切換。
- **原生 Web Audio 物理聲學合成引擎（Acoustic Clatter & Bell Synthesis）**：
  - **骨牌微彈碰撞（Bone Clatter）**：雙陶瓷共振頻段與 20ms 微反彈物理微敲擊。
  - **沉重桌面扣牌（Table Slam）**：出雙張與絕殺牌時觸發實木重低音轟鳴與脆響。
  - **牌堆洗牌聲（Boneyard Shuffle）**：開局與摸牌時多骨牌於桌布翻滾滑動音效。
  - **五倍數和弦鐘鳴（All-Fives Arpeggios）**：依 5/10/15/20/25+ 得分檔位動態演奏純律五聲音階水晶鐘琴琶音。
- **雙翼戰情駕駛艙（Dual-wing Table Cockpit）**：
  - **左翼（牌局情資雷達）**：
    - **端點走向與戰術引導**：分析各開放端點剩餘流通量、對手斷門牽制點與敵方高發端點。
    - **28 張骨牌池透視矩陣（Boneyard Matrix）**：已出、手牌、未現身分色矩陣。
    - **點數存量進度條**：0～6 點各 7 張動態存量。
    - **五倍數即時試算與回防評級**：評定 S/A/B/C 戰術等級，防範送分給對手。
    - **工藝音效面板**：即時切換材質、點數模式與音效試聽。
  - **右翼（對手戰情檔案）**：
    - **對手持牌機率透視雷達（Hypergeometric Probability Analyzer）**：即時計算對手持有 0～6 點的超幾何機率百分比（0% 確鑿斷門、高危牌組）。
    - **實戰壓制戰術建議**、系列賽動能進度、殘局牌術錦囊。
  - **行動端戰術膠囊（Mobile Cockpit Capsule）**：窄螢幕專屬抽屜面板，一鍵展開情報雷達與對手檔案。
- **實體鍵盤操作快捷鍵**：
  - <kbd>←</kbd>／<kbd>→</kbd> 或 <kbd>A</kbd>／<kbd>D</kbd>：循環切換選取手牌
  - <kbd>1</kbd>／<kbd>2</kbd>／<kbd>3</kbd>／<kbd>4</kbd> 或 <kbd>L</kbd>／<kbd>R</kbd>／<kbd>U</kbd>／<kbd>D</kbd>：選擇開放端點（左／右／上／下）
  - <kbd>Space</kbd>／<kbd>Enter</kbd>：確認出牌
  - <kbd>P</kbd>／<kbd>D</kbd>：跳過／抽牌
  - <kbd>C</kbd>：切換骨牌材質工藝
  - <kbd>S</kbd>：切換原生聲學音效
  - <kbd>H</kbd>：提示、<kbd>Z</kbd>／<kbd>U</kbd>：悔棋、<kbd>?</kbd>：快捷鍵指南面板
- 戰績：`clubhouse-dominoes-stats`（勝敗、連勝）；進行中比賽：`clubhouse-dominoes-match`。
- 首局引導：首次開啟三步上手疊層（`clubhouse-dominoes-howto-seen`）。
- Check：`npm run check` → vitest（90 tests，含五倍數計分、超幾何持牌機率分析、端點走向趨勢分析與戰術引導單元與進階測試）。

## 品質門檻對齊

對照 [`docs/GAME-QUALITY-BAR.md`](../docs/GAME-QUALITY-BAR.md)：

| 項目 | 本實作說明與亮點 |
|------|------------------|
| **模式／變體** | 實作三大正規規則變體：**五倍數（All Fives / Muggins）**（首張雙張激活轉軸鉚釘 Spinner Rivet 四向分支、開放端點和為 5 的倍數即時給分、局末計分四捨五入至 5 的倍數）、**摸牌制（Draw Game）**（無路可走時自牌堆抽牌直至有牌可出或留存 2 張跳過）、**封鎖制（Block Game）**（不可抽牌，無牌即過，全體阻塞時依剩餘點數最小者獲勝結算）；支援雙人單挑（2 Players）與四人隊友制（4 Players Partners，偶數座位 vs 奇數座位隊伍累計計分）；支援單局對決（1 分結算）與 61／100／150 分系列賽目標分制（含同分持續加賽機制）；支援每日挑戰（Daily Challenge，依 Asia/Taipei 台北時區每日日期字串生成固定種子亂數發牌，全球同題競技）。詳見 [`dominoesLogic.ts`](../Games/Dominoes/src/utils/dominoesLogic.ts)、[`board.ts`](../Games/Dominoes/src/utils/board.ts) 與 [`daily.ts`](../Games/Dominoes/src/utils/daily.ts)。 |
| **Replay hook** | 完整本機 `localStorage` 持久化儲存機制：`clubhouse-dominoes-stats`（累計總場次、勝場、敗場、勝率、當前連勝 Streak、歷史最佳連勝、五倍數模式單局最高得分）、`clubhouse-dominoes-match`（多局系列賽 Match State 進行中盤面狀態與即時隊伍比分持久化，中途重整網頁無縫恢復戰局）、`clubhouse-dominoes-daily`（每日挑戰完成紀錄、完成次數與連續挑戰天數持久化）、`clubhouse-dominoes-settings`（骨牌精工材質工藝、點數呈現模式、音效偏好設定）、`clubhouse-dominoes-howto-seen`（首局三步引導教學已讀標記）。詳見 [`storage.ts`](../Games/Dominoes/src/utils/storage.ts) 與 [`daily.ts`](../Games/Dominoes/src/utils/daily.ts)。 |
| **對手／輔助（Undo／Hint）** | 三階階梯 AI 引擎（Easy 簡單／Normal 普通／Hard 困難）：簡單 AI 具 45% 失誤率並優先拋棄輕牌（dumpLightFirst Heuristic）；普通 AI 具 12% 失誤率並計算後續出牌彈性加權；困難 AI 具 0% 失誤率，整合完整過牌斷門記憶（Void Memory Weight）、對手斷門誘餌壓制（Lack Feed Weight）、五倍數送分危險評估（Leave Score Penalty，避免留下 5 的倍數讓對手撿分）、未現身牌花色殘留頻率（Remaining Pip Counts）軟先驗機率推估與隊友防禦協同。輔助系統包含智能走法提示（Hint，動態試算所有合法出牌並高亮推薦出牌與目標端點）、單步悔棋（Undo，隨時撤銷回到玩家出牌前狀態）；雙翼戰術情報駕駛艙（左翼：28 張骨牌池全盤透視矩陣、0～6 點流通存量條、端點走向趨勢分析、五倍數即時試算與 S/A/B/C 戰術評級；右翼：嚴格超幾何持牌機率透視雷達、確鑿斷門辨識、鴿巢原理 100% 必持牌判定、封鎖威脅評估與壓制錦囊）。詳見 [`intelligence.ts`](../Games/Dominoes/src/utils/intelligence.ts)、[`CockpitLeftWing.tsx`](../Games/Dominoes/src/components/CockpitLeftWing.tsx) 與 [`CockpitRightWing.tsx`](../Games/Dominoes/src/components/CockpitRightWing.tsx)。 |
| **回饋（Feedback）** | 原生 Web Audio 聲學物理合成引擎（`dominoAcoustics.ts`）：骨牌陶瓷微敲擊碰撞聲（Bone Clatter，雙陶瓷共振頻段與 20ms 微反彈物理微敲擊）、實木重扣轟鳴脆響（Table Slam，出雙張與局末絕殺出牌時觸發重低音衝擊波）、牌堆洗牌聲（Boneyard Shuffle，多骨牌桌布翻滾滑動微噪聲）、五倍數純律琶音和弦鐘鳴（All-Fives Arpeggios，依 5/10/15/20/25+ 得分階層動態演奏五聲音階水晶鐘琴琶音）；奢華骨牌工藝視覺（三種高精材質：典藏象牙 Imperial Ivory、皇家黑曜 Royal Obsidian、古董胡桃 Antique Walnut；黃銅防磨中孔轉軸鉚釘 Brass Spinner Rivet，激活時具備專屬光芒與浮雕感；正統橫向雙張排版 Transverse Doubles，水平鏈垂直橫置、垂直臂水平橫置）；局末結算視窗呈現手牌扣分、對手手牌點數吸收、系列賽總比分比對、連勝晉級提示與下一局按鈕。詳見 [`dominoAcoustics.ts`](../Games/Dominoes/src/utils/dominoAcoustics.ts)、[`DominoTile.tsx`](../Games/Dominoes/src/components/DominoTile.tsx) 與 [`App.tsx`](../Games/Dominoes/src/App.tsx)。 |
| **觸控與操作（Touch）** | 行動端專屬戰術膠囊抽屜（`MobileCockpitDrawer.tsx`），專為直屏與窄螢幕設計，一鍵滑動展開左右翼情資雷達與對手超幾何戰情檔案；直覺雙模觸控，支援點擊選牌後點選目標開放端點，亦支援將骨牌直接拖曳至桌面上對應端點，具備行動端大尺寸點擊熱區；桌面支援完整實體鍵盤快捷鍵（方向鍵／AD 切換手牌、1-4／LRUD 選端點、Space／Enter 確認出牌、P／D 抽牌跳過、C 切換材質、S 切換音效、H 提示、Z／U 悔棋、? 快捷鍵指南面板）。詳見 [`MobileCockpitDrawer.tsx`](../Games/Dominoes/src/components/MobileCockpitDrawer.tsx) 與 [`KeyboardShortcutsModal.tsx`](../Games/Dominoes/src/components/KeyboardShortcutsModal.tsx)。 |
| **驗證腳本（Check）** | `npm run check -w dominoes` → 執行 Vitest 完整測試套件（90 項單元與進階整合測試，測試代碼總行數達 1,691 行，遠超 1,050 行品質門檻）：全方位覆蓋五倍數跨牌端點計分演算法、橫向雙張 2 倍點數權重與轉軸四臂分支解鎖機制、轉軸鉚釘提升（`promoteDoubleToSpinner`）鏈條逆向重組、牌堆抽牌池消耗邊界守恆（`BONEYARD_LEAVE = 2`）與局末對手手牌吸收計分、封鎖制和局判定（`allBlocked`）與平手裁決不變式、超幾何機率分布公式與鴿巢原理必持牌判定、AI 斷門誘餌與出牌防禦、多局系列賽（100／150／200 分）計分累加與加賽終止條件；`npm run lint -w dominoes` 執行 TypeScript 嚴格型別檢查（`tsc --noEmit`，0 errors）。詳見 [`dominoesAdvanced.test.ts`](../Games/Dominoes/src/__tests__/dominoesAdvanced.test.ts)、[`dominoesLogic.test.ts`](../Games/Dominoes/src/utils/dominoesLogic.test.ts) 與 [`intelligence.test.ts`](../Games/Dominoes/src/utils/intelligence.test.ts)。 |

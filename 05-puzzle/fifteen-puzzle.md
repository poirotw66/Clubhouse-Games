# 數字推盤（Fifteen Puzzle）

## 類別

益智類型（滑塊推盤）

## 概述

可調盤面的滑塊推盤：支援 **3×3～6×6**、**數字**或**名畫拼圖**（`public/puzzle-art.jpg` 切分）。點擊／拖曳／滑動與空格相鄰的方塊即可移動；當 1…N²−1 依序排好且空格在右下角即過關。開局洗牌保證可解。過關以 **IDA\***（Manhattan＋線性衝突）算出的標準桿對照步數並給出評等。

搭載**奢華典藏機械工坊引擎**，賦予方塊立體雕刻厚度、卡榫金屬光澤與物理陰影，並引入曼哈頓距離熱力光暈、機械卡榫星爆粒子反饋與即時推盤時速計（SPS）。

## 人數與建議年齡

- 人數：1 人。
- 建議年齡：約 6 歲以上。

## 創新亮點與操作座艙

- **三大典藏工坊材質主題（Artisan Workshop Themes）**：
  - **胡桃木黃銅（Walnut & Brass）**：深色天然胡桃木紋理托盤、手工拉絲黃銅方塊鑲嵌、深邃雕刻立體厚度（3D chamfered bevels 與底槽深陰影）。
  - **黑曜石金箔（Obsidian & Gold）**：啞光火山黑曜石底盤、耀金微光鑲邊與鍍金雕刻文字。
  - **賽博鈦金（Cyber Titanium）**：航太級鈦合金導軌、霓虹刻線與高精度量子齒輪光譜。
  - 玩家可在遊戲中隨時無縫切換（按鍵 <kbd>T</kbd> 或點選工坊晶片）。
- **曼哈頓距離熱力光暈（Dynamic Manhattan Heatmap Glow）**：
  - 一鍵切換熱力光暈（按鍵 <kbd>M</kbd> 或點選按鈕），方塊依距離正解目標之曼哈頓步數呈現動態光暈：
    - 0 步（已歸位）：翡翠綠鎖定微光與實體金屬錨點。
    - 1 步（臨門一腳）：耀金暖光光暈與 `+1` 徽記。
    - 2 步（接近中）：珊瑚暖橙微光與 `+2` 徽記。
    - 3+ 步：沉穩基底色彩。
- **機械齒輪咬合聲與星爆微粒子（Mechanical Latch & Spark Burst）**：
  - 方塊歸位瞬間觸發高低雙頻「咔噠」機械咬合音訊（`playGearLatchLock`）與雙重觸覺微震（Haptic feedback）。
  - 正解槽位同步迸發 8 顆環形放射星爆微粒子，帶來極致打擊回饋與解謎成就感。
- **整排連動推盤與多塊衝刺波（Multi-Tile Dash Wave）**：
  - 點擊或觸控同列或同行之任一方塊，中間整排方塊連動滑入空格。
  - 連續滑塊具備物理衝撞慣性與多段音階滑步音效（`playMechanicalSlide`）。
- **即時推盤時速儀表與連擊動力（Sliding Speedometer & Combo Streak）**：
  - 左翼座艙即時顯示 SPS（Slides Per Second，推盤時速）與最高時速紀錄。
  - 0.95 秒內連續推盤累積連擊（Combo Counter），達 3x 以上觸發五聲音階爬升與連擊徽章。
- **互動式目標藍圖矩陣（Interactive Blueprint Mini-Map）**：
  - 右翼座艙縮圖矩陣可即時互動：滑鼠懸停或點選手機藍圖格位，盤面即刻高亮該方塊（Spotlight Halo），瞬間化解大盤面找方塊之視覺負擔。
- **行動端專屬戰術抽屜（Mobile Tactical HUD Drawer）**：
  - 在行動裝置（< 1024px）提供純淨觸控棋盤，頂部具備可摺疊戰術抽屜，一鍵展開全盤和諧度、SPS 時速與工坊切換列。
- **實體鍵盤完整操控**：
  - 方向鍵／<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>：推動相鄰方塊進入空格。
  - <kbd>Z</kbd>／<kbd>Backspace</kbd>：復原上一步。
  - <kbd>H</kbd>：提示下一步最佳滑塊。
  - <kbd>G</kbd>：切換目標藍圖透視（Ghost Overlay）。
  - <kbd>M</kbd>：切換曼哈頓熱力光暈（Heatmap Glow）。
  - <kbd>T</kbd>：循環切換工坊材質主題（胡桃木／黑曜石／賽博）。
  - <kbd>R</kbd>：重新開局。

## 遊戲目標

以盡量少的步數（或在限時／限步內）還原盤面，並挑戰標準桿評等。

## 模式

| 模式 | 說明 |
|------|------|
| **經典** | 無時限；依盤面大小×打亂難度記錄最少步數與最高推盤時速。 |
| **衝刺** | 限時 **90 秒**；逾時失敗；記錄最短用時。 |
| **每日挑戰** | 以台北日期種子產生當日同一盤（3×3～5×5 輪替，偶為圖片）；連續天數。 |
| **闖關階梯** | 8 關依序解鎖；步數上限（標準桿×寬鬆係數）或限時。 |

### 打亂難度（`ScrambleTier`）

| 難度 | 洗牌方式 |
|------|----------|
| 簡單 | 自正解盤隨機合法滑 `size×5` 步 |
| 普通 | 自正解盤隨機合法滑 `size×12` 步 |
| 困難 | 3×3／4×4 全盤洗牌；5×5／6×6 長距離合法滑步（以便估算標準桿） |

### 標準桿與評等

- 以 IDA\*＋Manhattan＋線性衝突求最短解；若節點／時間預算不足以證明最優，則以打亂步數上界作為「≤N」近優標準桿。
- 評等：完美 S／優秀 A／達標 B／尚可 C／再接再厲 D（依超出標準桿比例）。

## 規則說明

1. 僅能移動與空格正交相鄰的方塊。
2. 盤面以一維 N² 格表示（列優先）；目標為 `1…N²−1` 後接 `null`。
3. 可解性：奇數邊長看反序數奇偶；偶數邊長另加空格自底列起算之列號（見 `isSolvable`）。

## 勝負與回饋

- **勝利**：盤面還原 → `ResultOverlay`（步數、標準桿、用時、最高時速、評等）；經典／衝刺寫入最佳紀錄；每日寫入連續天數；闖關推進進度。
- **失敗**：限時逾時或闖關步數用盡 → `ResultOverlay`（lose）。
- **音效與震動**：`src/mechanicalAudio.ts`（物理木銅滑動、機械齒輪鎖定、五聲連擊音訊、觸覺微震）。
- **本機紀錄**：
  - `clubhouse:fifteen-puzzle:best`（`moves-{size}-{tier}`／`sprint-{size}-{tier}`；會遷移舊鍵 `clubhouse-fifteen-best`）
  - `clubhouse:fifteen-puzzle:daily`
  - `clubhouse:fifteen-puzzle:campaign`
  - `clubhouse:fifteen-puzzle:theme`
  - `clubhouse:fifteen-puzzle:heatmap`
  - `clubhouse:fifteen-puzzle:max-sps`

## 櫻井政博遊戲手感與體驗設計

本遊戲遵循櫻井政博手感回饋與心流節奏設計原則：

- **fx-004 機械物理打擊感與微震動（Mechanical Impact & Shake）**：
  - 方塊推動具備真實木質黃銅摩擦音與落地微震（`shake 0.15~0.3`），多塊連動衝刺時觸發骨牌連鎖推移震感。
  - 方塊歸位瞬間觸發齒輪卡榫鎖定聲（`playGearLatchLock`）與星爆火花粒子（`haptic success`）。
  - 還原通關時激發全螢幕勝利慶祝震動（`shake 0.75`）與彩帶粒子彩屑（`particles confetti`）；逾時或步數用盡時觸發柔和警示震動（`shake 0.4`，`haptic error`）。
- **fx-005 節奏連擊與音階攀升（Rhythm & Pitch Ascent）**：
  - 0.95 秒滑動窗口內連續推盤觸發推盤時速（SPS）連擊，五聲音階水晶琴音隨連擊數動態攀升（`playSpeedCombo`）。
- **gameplay-core-001 風險回報與精準反饋（Clear Feedback & Mastery）**：
  - 即時呈現曼哈頓距離熱力圖、目標藍圖幽靈透視與標準桿（Par）即時差值評等（S～D 級），激勵極限操作與思維精準度。
- **gameplay-ux-009 極速重試與零摩擦操作（Rapid Retry）**：
  - 結算畫面全局監聽 <kbd>Space</kbd>、<kbd>Enter</kbd>、<kbd>R</kbd> 快捷鍵，獲勝或失敗瞬間即可秒速進入下一關或原地重開局，無須點擊滑鼠。
  - 結算按鈕明確標註 `(Space / Enter / R)`。
  - 首頁大廳內嵌 Juice 手感回饋控制面板，支援自訂震動與粒子強度。

## 品質門檻對齊

對照 [`docs/GAME-QUALITY-BAR.md`](../docs/GAME-QUALITY-BAR.md)：

| 項目 | 本實作說明與亮點 |
|------|------------------|
| **模式／變體** | 經典／衝刺（90 秒）／每日挑戰／闖關階梯（8 關循序漸進，已校準第 5 關限時衝刺 95s 與第 7 關馬賽克 120s 觸控容錯）× 3×3～6×6 盤面 × 數字／名畫拼圖 × 簡單／普通／困難三級打亂 × 三大典藏工坊材質（胡桃木黃銅／黑曜石金箔／賽博鈦金） |
| **Replay hook** | 完整持久化至 `localStorage`：各盤面難度最佳步數、最速衝刺秒數、每日挑戰連續天數（Streak）、歷史最高推盤時速（Max SPS）、闖關階梯進度（Cleared Count & 關卡最佳成績）與工坊個人化偏好 |
| **對手／輔助（Undo／Hint）** | 雙重智能輔助：一鍵復原（Undo，支援鍵盤 <kbd>Z</kbd>／<kbd>Backspace</kbd>）與即時最佳解提示（IDA\* 啟發式推薦下一步，支援鍵盤 <kbd>H</kbd>）；另具備曼哈頓熱力光暈（<kbd>M</kbd>）與目標藍圖透視（<kbd>G</kbd>） |
| **回饋（Feedback）** | 標準 `ResultOverlay`（結算勝負、標準桿差距、評等 S～D、最高 SPS）+ **機械卡榫星爆粒子（Mechanical Latch Particles）**（歸位迸發 8 顆環形金色微粒子與雙重震動）+ **動態時速計與連擊（SPS Speedometer & Combo Streak）**（0.95s 窗口五聲音階爬升） |
| **觸控與操作（Touch）** | 原生觸控手勢滑動 + **整排多塊連動衝刺（Multi-Tile Physics Dash Wave）**（點擊同行列方塊觸發骨牌連鎖推移與多段滑步音效）+ 行動端專屬戰術抽屜（Mobile Tactical HUD Drawer，< 1024px 自動摺疊） |
| **驗證腳本（Check）** | `npm run check -w fifteen-puzzle` → `src/check-fifteen.mjs`（涵蓋多尺寸連動推盤物理、IDA\* 啟發式與線性衝突、音效合成器契約、存儲遷移與歷史紀錄等深層單元測試，>500 行深度檢驗） |

## 實作

- 專案路徑：[Games/Fifteen-Puzzle/](../Games/Fifteen-Puzzle/)
- 核心：`src/fifteenLogic.ts`、`src/solver.ts`、`src/daily.ts`、`src/campaign.ts`、`src/storage.ts`、`src/mechanicalAudio.ts`
- UI：`src/App.tsx`、`src/PuzzleBoard.tsx`、`src/index.css`

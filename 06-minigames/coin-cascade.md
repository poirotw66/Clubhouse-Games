# 幣潮（Coin Cascade）

## 類別

迷你遊戲類型

## 概述

幣潮是一款**推幣機**：投幣、推板前後移動、幣堆被推向邊緣落下。

推幣機天生是零決策的娛樂裝置——投幣、看、拿錢。本作刻意不做成那樣，而是圍繞一條規則重建：**沒掉下去的幣會留在台面上，成為之後要被推的地形**。你投失的每一枚都在改變棋盤，所以「投在哪裡」不是隨機動作，而是佈局；崩塌不是運氣，是你自己安排的。

> 本作為原創玩法設計，不使用任何既有商標角色或品牌素材。

## 人數與建議年齡

- 人數：1 人
- 建議年齡：8 歲以上

## 所需器材

- **介面**：直向為主；支援鍵盤與觸控。
- **操作**：
  - 鍵盤：`←` `→` 移動投幣口、`空白鍵` 投幣、`1`–`4` 切換特殊幣、`M` 靜音切換、`P` 或 `Esc` 暫停。
  - 觸控：點擊台面上方任一橫向位置即在該處投幣；特殊幣以下方按鍵切換。
- **計分**：回收的幣數、彩池爆開次數、最長連鎖；最佳成績存於瀏覽器本機（localStorage）。

## 遊戲目標

用有限的投幣數換回盡可能多的幣。

## 規則說明

### 核心：台面是你自己蓋的

1. 投下的幣落在台面上，被**推板**（前後往復運動）推向前緣。
2. 推落前緣的幣**回收計入分數**；沒落下的幣**留在台面**，成為之後要被推的地形。
3. 因此爛的投法會把台面堆成推不動的山；好的投法是在**蓋一道之後會塌的牆**。

### 三個決策，每個都有代價

| 決策 | 得到 | 付出 |
|---|---|---|
| **投在哪**（橫向位置） | 邊緣落幣率高 | 邊緣也容易卡死成死角 |
| **何時投**（推板週期） | 推板後退時投＝吃滿整個推程 | 要等，期間不能投第二枚 |
| **買什麼特殊幣** | 重幣推力大／滾珠穿縫／震動搖台 | 重幣佔位、滾珠不堆積、**震動會把你自己的牆也搖散** |

**沒有一種投法在所有情況下都最好**——這是本作的核心設計規則，等同〈球團王朝〉的「每個選項都要付出代價」。自我測試會斷言不存在全面最優的投放位置。

### 彩池

1. 投入的幣有一部分進入**彩池**，彩池金額持續可見。
2. 台面上有**觸發區**；當觸發物被推落時彩池整池爆開。
3. 觸發區的位置決定了你要不要為了它去堆一個特定形狀——這是彩池存在的理由，不是為了給錢。

### 結束

- 投幣數用盡即結束。**不設時間限制**——這是佈局遊戲，不是反應遊戲。

## 勝負條件

- **成績**：回收幣數 + 彩池爆開加成 + 最長連鎖加成。
- **紀錄**：自由遊玩最佳分數、最長連鎖保存在瀏覽器本機（`coin-cascade:best`／`coin-cascade:best-cascade`，鍵名不變）；挑戰／模式包、主題台面／收藏、每日挑戰另有獨立鍵（見下節），**不得覆寫**上述最佳鍵。

## 多巴胺的具體工程

爽感是可以工程化的，而且它跟「有決策」不衝突。以下每一項都是機制而非美術：

1. **懸吊偵測**：幣半懸在前緣時高亮並短暫停頓——近失（near-miss）是這類機台最強的鉤子。
2. **連鎖偵測**：單次推程掉落 ≥3 枚觸發雪崩演出，數字滾動累加。
3. **彩池爆開**：整池一次傾瀉，並有慶祝閃光／粒子（縮減動態時改為靜態高亮）。
4. **雷射瞄準與甜蜜點光暈**：投幣漏斗於推板最深處（完美甜蜜點）散發綠金光暈與 `PERFECT` 標記，發射動態光子軌跡雷射與台面落點十字預測虛影。
5. **桌面雙翼街機儀表（Arcade Wings）**：桌面寬螢幕左翼搭載「機台動態儀」（推板動能波形、台面左/中/右三道地形密度分析、特殊幣戰術指引）；右翼搭載「彩池與金流」（大獎彩池金庫、觸發幣落崖距離、邊緣懸垂警報、即時回報率 RTP %、最長連鎖、快捷選幣），行動裝置自動收合保持純粹觸控體驗。
6. **即時數值噴發與懸垂光環**：前緣落幣跳動飄升金幣數值（`+1`, `+2`）、彩池爆開浮空字樣、彩池觸發幣動態訊號圈，大幅提升推幣物理與連鎖成就感。
7. **音效**：本地合成金屬撞擊（`src/audio.ts`），依同時落幣數疊加層次與泛音；彩池另有扇形與低音落地；按 `M` 鍵快速切換靜音。

以上都必須尊重 `prefers-reduced-motion`。

## 平衡量測（第一天就要有）

模擬層為**固定時間步長的純函數**：整局是 `(種子, 輸入序列)` 的函數，可重播、可無頭模擬。要量的是：

1. **返還率（RTP）**——**這是本作最重要的量測，也是這個 repo 目前沒有的類型：一個不依賴自製機器人的客觀指標。** 無頭跑數萬次投幣，量出實際返還率。兩個失效方向都要擋：
   - **過低** → 三十秒破產，只有挫折沒有多巴胺
   - **過高** → 永遠不會輸，沒有張力，變成看動畫
2. **不存在全面最優的投放位置**——用「永遠投左／中／右／隨機」四種策略比較，不能有一種碾壓其他。
3. **台面不會鎖死**——長時間遊玩後台面不應堆成一個再也推不動、落幣率趨近零的死局。
4. **連鎖與近失的實際發生率**——這兩個是爽感的來源，如果一局裡幾乎不發生，那些演出等於不存在。

**量測必須連同信賴區間一起報告。** 這個 repo 曾因為樣本量不足而把最難的關卡標成最簡單的，也曾把 8 個種子的雜訊讀成一套機制並寫進文件。

## 已知的最大風險：物理的決定性

本 repo 所有遊戲都要求「相同種子＋相同輸入＝完全相同的一局」，而幣的堆疊碰撞是浮點數密集的模擬。作法是固定時間步長、固定迭代次數、固定碰撞解算順序（依幣的 id 排序而非陣列順序），並**優先驗證**：自我測試必須包含「同一局重播兩次得到位元相同的結果」，且該檢查要在物理實作完成後**立刻**建立，而不是最後補。

## 常見變體或可選規則

- **種子分享**：輸入相同種子碼重現完全相同的台面與掉落。

### 挑戰／模式包（標題入口）

標題「挑戰／模式包」提供固定種子的可刷關卡，進度鍵 `coin-cascade:modes-v1`（`clearedCount`／`cleared`／`bestScore`／`bestCascade`），**與自由遊玩最佳分 `coin-cascade:best` 分開**。依序解鎖：

| 關 | id | 內容 |
|----|----|------|
| 1 | `score-novice` | 分數入門：投幣 100，分數 ≥ 70（達標提前結束） |
| 2 | `score-steady` | 穩健回收：投幣 180，分數 ≥ 130 |
| 3 | `score-surge` | 高分潮：投幣 220，分數 ≥ 190 |
| 4 | `cascade-trio` | 連鎖起步：投幣 120，最長連鎖 ≥ 4 |
| 5 | `cascade-avalanche` | 雪崩挑戰：投幣 200，最長連鎖 ≥ 6 |
| 6 | `timed-rush` | 限時衝刺：75 秒內分數 ≥ 45 |

實作：`src/game/modes.ts`；引擎 `createRun` 接受 `startingCredits`／`timeLimitTicks`／`clearScore`／`clearCascade`／`modeId`／`tableId`／`isDaily`。

### 主題台面（機制不同，不是換皮）

標題「主題台面」提供至少三張機台，各自有獨立物理／規則，並以既有 balance／self-check 腳本量測 RTP，維持可玩區間（約 35–115% 守衛帶）：

| id | 名稱 | 機制差異 |
|----|------|----------|
| `classic` | 經典廳 | 基準推程與彩池（免費解鎖） |
| `peg-alley` | 釘陣廳 | 固定釘柱碰撞，投幣必須繞縫；潮幣 40 或模式通關 2 |
| `spring-tide` | 潮汐廳 | 更快更長推程；觸發幣與 ≥2 枚同推程落下時彩池 1.5×（潮湧）；潮幣 100 或模式通關 4 |

實作：`src/game/tables.ts`；物理快照凍結在 `RunConfig.physics`。

### 解鎖／收藏／潮幣

進度鍵 `coin-cascade:meta-v1`（解析時欄位級驗證；壞資料不整包清掉）。結束一局依分數／連鎖／彩池發放**潮幣**，用來解鎖台面、**磁吸幣**（落地拉近鄰幣，代價是可能拆自己的牆）、以及幣面收藏（黃金／翠玉／霓虹）。收藏櫃畫面列出台面紀錄、特殊幣、幣面與里程碑。**絕不寫入** `coin-cascade:best`。

實作：`src/game/progress.ts`。

### 每日挑戰

標題「每日挑戰」：本地日曆日 → 固定種子 `cc-daily-YYYY-MM-DD`、目標分數與輪替台面（決定性）。達標條件為分數 ≥ 當日目標；進度鍵 `coin-cascade:daily-v1`。

實作：`src/game/daily.ts`。

## 品質門檻對齊

對照 [`docs/GAME-QUALITY-BAR.md`](../docs/GAME-QUALITY-BAR.md)：

| 項目 | 本實作規範與對齊成果 |
|---|---|
| **模式／變體** | 自由遊玩（Free Play，無時間限制，地形堆疊與連鎖佈局，支援種子分享）／挑戰模式包（Mode Pack，6 關手編固定種子闖關階梯：`score-novice` 分數入門、`score-steady` 穩健回收、`score-surge` 高分潮、`cascade-trio` 連鎖起步、`cascade-avalanche` 雪崩挑戰、`timed-rush` 限時衝刺，具備依序解鎖前進機制）／主題台面（Themed Tables，3 張具備獨立物理與規則之機台：`classic` 經典基準廳、`peg-alley` 釘陣廳含 5 根固定阻擋釘柱、`spring-tide` 潮汐廳快推程與 1.5× 潮湧彩池加成）／台北每日挑戰（Daily Challenge，依 Asia/Taipei 台北時區曆法產生決定性固定種子 `cc-daily-YYYY-MM-DD` 與輪替台面）／狂熱超頻模式（Fever Overdrive，100% 充能觸發 12 秒 2× 雙倍結算倍率與合成器狂熱琶音）／幸運輪盤迷你遊戲（Lucky Wheel Spin，彩池連鎖觸發、乘數疊加至 30× MEGA 與潮幣結算轉換）／5 款特殊幣種（普通幣、重幣、滾珠、震動搖台、解鎖磁吸幣）。相關實作請見：[`src/game/modes.ts`](../Games/Coin-Cascade/src/game/modes.ts)、[`src/game/tables.ts`](../Games/Coin-Cascade/src/game/tables.ts)、[`src/game/daily.ts`](../Games/Coin-Cascade/src/game/daily.ts)、[`src/game/fever.ts`](../Games/Coin-Cascade/src/game/fever.ts)、[`src/game/wheel.ts`](../Games/Coin-Cascade/src/game/wheel.ts)。 |
| **重玩誘因** | 多軌獨立 `localStorage` 持久化架構，遵循嚴格不可互相覆寫與欄位級防禦解析規範：`coin-cascade:best`（自由遊玩歷史最佳總分）、`coin-cascade:best-cascade`（自由遊玩最長連鎖紀錄）、`coin-cascade:modes-v1`（模式包 6 關解鎖進度、通關旗標、各關最佳得分與最長連鎖）、`coin-cascade:meta-v1`（潮幣餘額與生涯累計潮幣、解鎖台面、解鎖磁吸特殊幣、幣面收藏［黃金／翠玉／霓虹］、各台面最佳紀錄、8 大本機成就里程碑）、`coin-cascade:daily-v1`（每日挑戰嘗試次數、通關狀態、最佳成績、Asia/Taipei 台北時區連續挑戰天數 Streak）、每日登入與離線補給（7 天登入獎勵階梯 Day 1～Day 7 大滿貫、每 90 秒離線閒置代幣補充上限 80 枚且具備單調防作弊機制）。相關實作請見：[`src/game/progress.ts`](../Games/Coin-Cascade/src/game/progress.ts)、[`src/game/daily.ts`](../Games/Coin-Cascade/src/game/daily.ts)、[`src/game/rewards.ts`](../Games/Coin-Cascade/src/game/rewards.ts)。 |
| **盤面／卡牌對手與提示** | 物理街機推幣機不適用傳統棋盤 AI 或回溯撤銷（Undo，推幣崩塌物理不可逆）；以「台面地形障礙、重力與推板動態」作為環境對手。懸吊近失偵測（Near-miss Teetering Detection）：前緣幣懸垂超過 35% 半徑高亮與停頓訊號圈，觸發近失心理學誘因；桌面雙翼戰術座艙（Arcade Wings）：左翼機台動態儀提供推板動能波形、台面左／中／右三道地形密度分析、落點側向滑移偏角預測與特殊幣戰術指引；右翼彩池與金流提供即時 RTP % 遙測、彩池金庫深度、懸垂崩塌雷達（Cliff Danger Radar，0～100% 邊緣坍方危險指數、最危險走道預警）與觸發幣落崖距離；甜蜜點雷射瞄準（Laser Aiming）：推板後退最深處（甜蜜點）觸發 PERFECT 光暈、光子軌跡雷射與十字落點虛影預測。相關實作請見：[`src/game/engine.ts`](../Games/Coin-Cascade/src/game/engine.ts)、[`src/game/chute.ts`](../Games/Coin-Cascade/src/game/chute.ts)、[`src/game/fever.ts`](../Games/Coin-Cascade/src/game/fever.ts)、[`src/components/GameCanvas.tsx`](../Games/Coin-Cascade/src/components/GameCanvas.tsx)。 |
| **手感回饋** | 結算介面：專屬全螢幕結算卡片（展示回收幣數、彩池爆開加成、最長連鎖、新高分徽章與潮幣獲取結算），契約對齊 `ResultOverlay` 之指標與操作規格；因純 2D Canvas 街機一體化機台設計誠實標註為永久 ～（詳見 [`docs/GAME-QUALITY-BAR.md`](../docs/GAME-QUALITY-BAR.md)）。WebAudio 原生雙重合成音效引擎：`src/audio.ts`（金屬撞擊多層次泛音、彩池傾瀉低音扇形衝擊、落幣節奏鐘琴、即時音量與 <kbd>M</kbd> 鍵快速靜音）、`src/feverAudio.ts`（狂熱超頻啟動號角 Fanfare、合成器琶音 Arpeggiator BGM、脈衝鼓點）；視覺多巴胺特效：落幣飄升金幣數值浮空字樣（`+1`, `+2`, 狂熱雙倍 `+2`）、彩池爆開全螢幕金色粒子傾瀉、潮湧彩池青藍衝擊波、螢幕微震（完整支援 `prefers-reduced-motion` 無障礙降級）。相關實作請見：[`src/audio.ts`](../Games/Coin-Cascade/src/audio.ts)、[`src/feverAudio.ts`](../Games/Coin-Cascade/src/feverAudio.ts)、[`src/components/GameCanvas.tsx`](../Games/Coin-Cascade/src/components/GameCanvas.tsx)、[`src/App.tsx`](../Games/Coin-Cascade/src/App.tsx)。 |
| **觸控與操作** | 雙模式適配：寬螢幕桌面展開左右雙翼戰術座艙；行動端自適應收合雙翼座艙，保持純粹推幣視野。台面上方觸控橫條：手指觸控滑動或點擊任意橫向位置，投幣漏斗即時平滑跟隨並完成落幣。底部觸控盤面：直覺切換 5 款特殊幣種、暫停／繼續選單、收藏櫃彈窗與重新開始。相關實作請見：[`src/App.tsx`](../Games/Coin-Cascade/src/App.tsx)、[`src/components/GameCanvas.tsx`](../Games/Coin-Cascade/src/components/GameCanvas.tsx)。 |
| **驗證腳本** | `npm run lint -w coin-cascade`（TypeScript 嚴格型別檢查 0 錯誤）與 `npm run check -w coin-cascade` → [`scripts/self-check.ts`](../Games/Coin-Cascade/scripts/self-check.ts)（1,515 行深度測試，30 項全面斷言）：涵蓋推板物理週期、正弦速度、三角波加速度與各幣種邊緣懸垂臨界值（normal, heavy, ball, magnet, trigger）；側溝損耗（Gutter Loss）vs 出幣獎勵槽（Prize Chute）在三大台面（classic, peg-alley, spring-tide）的 RTP 數值邊界（35%～115% 守衛帶）與防死局保證；幸運輪盤迷你遊戲（Wheel Spin Mini-game）彩池連鎖觸發、乘數疊加（Fever 2× + 潮湧 1.5× + 輪盤 2～10× = 最高 30× MEGA）與潮幣結算轉換；離線閒置代幣補充（Idle Credit Replenishment）上限與單調遞增算術、Asia/Taipei 台北時區每日登入 7 天階梯獎勵與連勝判定；懸垂崩塌雷達（Cliff Danger Radar）與狂熱超頻（Fever Overdrive）狀態機生命週期。 |

## 實作結構

- 專案根目錄：[`Games/Coin-Cascade/`](../Games/Coin-Cascade/)
- 物理核心與幾何引擎：[`src/game/engine.ts`](../Games/Coin-Cascade/src/game/engine.ts)、[`src/game/constants.ts`](../Games/Coin-Cascade/src/game/constants.ts)、[`src/game/chute.ts`](../Games/Coin-Cascade/src/game/chute.ts)
- 關卡、台面與隨機種子：[`src/game/modes.ts`](../Games/Coin-Cascade/src/game/modes.ts)、[`src/game/tables.ts`](../Games/Coin-Cascade/src/game/tables.ts)、[`src/game/rng.ts`](../Games/Coin-Cascade/src/game/rng.ts)
- 每日挑戰與經濟存檔：[`src/game/daily.ts`](../Games/Coin-Cascade/src/game/daily.ts)、[`src/game/progress.ts`](../Games/Coin-Cascade/src/game/progress.ts)、[`src/game/rewards.ts`](../Games/Coin-Cascade/src/game/rewards.ts)
- 狂熱超頻與輪盤迷你遊戲：[`src/game/fever.ts`](../Games/Coin-Cascade/src/game/fever.ts)、[`src/game/wheel.ts`](../Games/Coin-Cascade/src/game/wheel.ts)
- WebAudio 原生合成音效：[`src/audio.ts`](../Games/Coin-Cascade/src/audio.ts)、[`src/feverAudio.ts`](../Games/Coin-Cascade/src/feverAudio.ts)
- 街機介面與 Canvas 繪製：[`src/App.tsx`](../Games/Coin-Cascade/src/App.tsx)、[`src/components/GameCanvas.tsx`](../Games/Coin-Cascade/src/components/GameCanvas.tsx)
- 驗證測試腳本：[`scripts/self-check.ts`](../Games/Coin-Cascade/scripts/self-check.ts)

## 備註

- 以 2D Canvas 繪製，不使用 3D 引擎與任何第三方物理函式庫；碰撞解算自行實作，因為決定性要求比效能重要。
- 不含任何第三方美術資源。
- 自由遊玩**不設時間限制**；限時僅出現在模式包的「限時衝刺」。
- 實作路徑：`Games/Coin-Cascade/`。

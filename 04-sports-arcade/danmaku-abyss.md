# 彈幕深淵（Danmaku Abyss）

## 類別

運動機檯類型

## 概述

彈幕深淵是一款 **Roguelike 縱向捲軸彈幕射擊**。一趟由五個階段組成，每階段結束後從三個強化中擇一，戰機隨著這趟的選擇逐步成形；敵方彈幕則沿著一條連續的強度曲線越來越密、越來越刁鑽。

這類遊戲最常見的失敗，是手指按住不放就能通關——開火沒有代價，「要不要射」就不是決策，遊戲退化成純閃避。本作不用人造的資源管理去補這個洞，而是採用彈幕遊戲本來就有的答案：**把張力放進距離裡**。

> 本作為原創玩法設計，不使用任何既有商標角色或品牌素材。

## 人數與建議年齡

- 人數：1 人
- 建議年齡：10 歲以上

## 所需器材

- **介面**：直向為主；支援鍵盤與觸控。
- **操作**：
  - 鍵盤：方向鍵移動、`Shift` 集中模式、`Z` 靈擊、`X` 機體特技、`P` 或 `Esc` 暫停。射擊為自動。
  - 觸控：單指拖曳移動（戰機跟隨手指，帶固定偏移，避免手指蓋住判定點）；拖曳中長按進入集中模式；靈擊與特技為畫面側邊的獨立按鍵。
- **計分**：擊破分、擦彈倍率、符卡 Capture 加成；最佳成績存於瀏覽器本機（localStorage）。
- **機體**：標題可選至少三架可玩機體（迅羽／重炮／縫影），各有不同**射擊型態**（均衡扇射／寬幅重擊／細針集火）、判定大小、集中／高速取捨，以及專屬**特技**（X／觸控「特技」：羽閃／過載／縫隙，冷卻制、不花靈擊）；額外機體以通關次數解鎖。各機體最佳分與符卡 Capture 圖鑑存於 `danmaku-abyss:progress-v1`（與自由遊玩總最佳 `danmaku-abyss:best`、模式包進度、每日挑戰分開）。
- **每日挑戰**：標題「今日挑戰」以當日日期種子（`DYYYYMMDD`）開局（遊戲本身已是種子決定性）；今日最佳存於 `danmaku-abyss:daily-v1`，結算可複製分享文案。

## 遊戲目標

在五個階段中活下來，並且盡可能靠近——因為分數與傷害都來自你敢站多前面。

## 規則說明

### 核心張力：距離

1. **傷害隨距離衰減**：離目標越近，每發子彈的傷害越高。
2. **擦彈倍率隨距離上升**：子彈擦過判定點附近會累積倍率，越貼近累積越快。
3. 兩者都把你往前推，而最前面正是彈幕最密、反應時間最短的地方。**「站哪裡」是這個遊戲從頭到尾唯一重要的問題。**

### 集中模式與判定點

1. 戰機的**判定點極小**，遠小於機身圖形；集中模式下判定點會顯示出來。
2. **集中模式移動速度大幅降低**：能穿針引線，但無法重新佈局。
3. 放開則恢復高速：能換位，但穿不過密網。這是一個持續存在的取捨，不是輔助功能。

### 靈擊（Bomb）

1. 次數有限，發動後清除畫面上的子彈並提供短暫無敵。
2. **被清掉的子彈折算成分數的比率刻意很低**，所以靈擊是保命手段而非刷分手段。
3. 若靈擊在量測中變成「永遠該按」的免費保險，即視為平衡缺陷（見〈平衡量測〉）。

### 彈幕：資料，不是程式碼

1. 一張**符卡**是若干**發射器**的組合；發射器只有參數，沒有客製邏輯：
   數量、散佈角、初速、角速度、瞄準模式（固定／自機狙／旋轉）、波形（直線／螺旋／加速／反向）、齊射間隔、存活時間。
2. **「越來越變態」由單一 `intensity` 標量驅動**：彈數變多、間隙收窄、速度上升、自機狙比例提高。難度是一條連續函數，不是手刻的分級表，因此可以量測出「人類還通得過」的門檻落在哪裡。
3. 這個決定是有代價換來的：蛇窟迴廊的遺物原本每個都是引擎裡一段客製分支，新增一個就要動引擎，所以沒人加，池子卡在 18 個而一局要選 15 次——**一局被提供到 98% 的池子，兩局重疊 72%**。彈幕若用同樣的寫法，結果會是每一趟都打同一場。

### 回合流程

1. **道中**：波次推進，敵機沿固定軌跡進場並依符卡發射彈幕。
2. **王戰**：每階段結尾一名王，持有多張符卡（目前各王 4 張，形狀互異）；每張符卡有**計時**。
3. **Capture**：在時限內擊破該符卡可獲得加成；時間耗盡則符卡自行結束，不給加成。
4. **強化**：階段結束後三選一，效果為純資料的效果鍵（傷害、擦彈範圍、集中速度、靈擊數、判定點縮小、符卡計時延長……）。
5. **強度推進**：`intensity` 隨階段連續上升，並在王戰期間額外加權。

### 殘機與死亡代價

1. 起始 **3 條殘機**。死亡不結束一趟。
2. 死亡的代價是**吃掉累積的東西**：扣一條殘機、**火力段數掉一級**、擦彈倍率歸零。
3. 死亡時會把部分火力碎片**撒回場上**，可以撿回來——但碎片落在你剛剛死掉的地方。要不要衝回去，是一個立即的冒險決定。
4. 殘機歸零才結束一趟。

## 勝負條件

- **通關**：完成第五階段的王。
- **結束**：殘機歸零。
- **成績**：總分 = 擊破分 × 擦彈倍率 + 符卡 Capture 加成 + 剩餘殘機與靈擊的結算分。
- **紀錄**：自由遊玩最佳分數保存在 `danmaku-abyss:best`；模式／關卡包另有分模式最佳與通關進度（見〈模式／關卡包〉）。

## 品質門檻對齊

對照 [`docs/GAME-QUALITY-BAR.md`](../docs/GAME-QUALITY-BAR.md)：

| 項目 | 本實作規範與對齊成果 |
|---|---|
| **模式／變體** | 自由遊玩（Free Play，五階段深淵，Roguelike 32 種強化三選一升級構築，種子決定論重現）／挑戰關卡包（Mode Pack，10 關手編固定種子闖關階梯：演習模式 `practice-lamp`、`practice-tide`、`practice-frost`；高難五階段全通 `hard-abyss` 強度 +0.55、殘機與靈擊各 2；指定符卡 Capture 挑戰 `spell-frost-rain`、`spell-abyss-gaze`、`spell-frost-duet`、`spell-abyss-rift`、`spell-lamp-beacon`、`spell-ember-bloom`，具備循序漸進解鎖機制）／可選機體陣容（3 款特性機體：迅羽 Swift 均衡扇射＋羽閃、重炮 Cannon 寬幅重擊＋過載暴傷、縫影 Stitch 細針集火＋微型判定＋縫隙，生涯通關累積解鎖）／台北每日挑戰（Daily Challenge，依 Asia/Taipei 台北時區曆法產生決定性固定日期種子 `DYYYYMMDD`，獨立記錄當日最佳成績與一鍵複製分享文案）。相關實作請見：[`src/game/modes.ts`](../Games/Danmaku-Abyss/src/game/modes.ts)、[`src/game/crafts.ts`](../Games/Danmaku-Abyss/src/game/crafts.ts)、[`src/game/daily.ts`](../Games/Danmaku-Abyss/src/game/daily.ts)、[`src/game/cards.ts`](../Games/Danmaku-Abyss/src/game/cards.ts)。 |
| **重玩誘因** | 多軌獨立 `localStorage` 持久化架構，遵循嚴格不可互相覆寫與欄位級防禦解析規範：`danmaku-abyss:best`（自由遊玩歷史最佳總分）、`danmaku-abyss:progress-v1`（生涯通關次數、各機體最佳分、20 張符卡 Capture 收集圖鑑、當前選用機體）、`danmaku-abyss:modes-v1`（模式包 10 關解鎖進度 `clearedCount`、各關通關旗標與各關歷史最高分）、`danmaku-abyss:daily-v1`（每日挑戰嘗試次數、當日最佳得分、通關狀態、使用機體與 Capture 數）、`danmaku-abyss:howto-seen`（首局三步引導標記）。相關實作請見：[`src/game/crafts.ts`](../Games/Danmaku-Abyss/src/game/crafts.ts)、[`src/game/modes.ts`](../Games/Danmaku-Abyss/src/game/modes.ts)、[`src/game/daily.ts`](../Games/Danmaku-Abyss/src/game/daily.ts)、[`src/components/FirstRunGuide.tsx`](../Games/Danmaku-Abyss/src/components/FirstRunGuide.tsx)。 |
| **盤面／卡牌對手與提示** | 彈幕射擊環境對手（5 大階段首領各 4 張符卡，共 20 張獨特符卡資料驅動發射器，單調 `intensity` 難度曲線驅動彈數、間隔、彈速與自機狙微轉向，血量閾值觸發多階段進化）。輔助提示與雙翼座艙：頂部首領符卡戰況儀提供 Boss 名稱、當前符卡名、血量百分比、符卡倒數計時（最後 5 秒紅色警戒）與多階段刻度標記；彈幕高明度差雙層描邊（暗色外廓 `rgba(5, 5, 15, 0.88)` + 高亮內線，徹底杜絕爆炸或白光掩蓋彈幕之辨識度問題）；桌面端展開左右雙翼戰術座艙（Arcade Cabinet Wings）提供左翼機體規格藍圖、精準核心判定（3.2px / 2.5px）與擦彈半徑（26px / 31.2px）、特技冷卻計與當前已啟用之 Roguelike 強化詞條清單；右翼首領威脅雷達提供首領血條、符卡名、Capture 倒數計時與 50,000 PTS 獎勵儀、擦彈超載倍率儀（Graze Overdrive 1.00x～4.00x）與全套鍵盤操作手冊；戰場內貼身動態戰術光弧（Tactical Proximity Arc）依據與最近目標距離即時投影貼臉極限區（<135px）赤金光弧與 `POINT-BLANK / ×2.20 MAX` 增傷徽標；集中模式（Focus Mode）長按或按住 Shift 即時切換低速穿針（速度由 260 降至 105）並高亮機身核心微型判定點。相關實作請見：[`src/game/engine.ts`](../Games/Danmaku-Abyss/src/game/engine.ts)、[`src/components/CabinetWings.tsx`](../Games/Danmaku-Abyss/src/components/CabinetWings.tsx)、[`src/components/GameCanvas.tsx`](../Games/Danmaku-Abyss/src/components/GameCanvas.tsx)。 |
| **手感回饋** | 完整整合 `@clubhouse/shared/ResultOverlay` 結算面板（清晰展示勝負結果、最終得分、抵達階段、Capture 符卡數、擦彈次數、最高擦彈倍率、種子碼與今日最佳成績，具備再挑戰、再刷今日、回標題與複製分享文案功能，支援 <kbd>Space</kbd>／<kbd>Enter</kbd>／<kbd>KeyR</kbd> 極速瞬時重試）；Roguelike 強化選擇支援 <kbd>1</kbd>／<kbd>2</kbd>／<kbd>3</kbd> 單鍵快選；原生 Web Audio 合成音效引擎全面整合 `@clubhouse/shared/synthAudio`（`playImpact` 子彈命中與被擊、`playCombo` 連擊與擦彈累加、`playCapture` 符卡 Capture 成功慶祝、`playWin` 全通勝利和弦、`playLose` 墜機失敗音效）；多巴胺回饋包含被擊微震（整合 `@clubhouse/shared/juice` 之 `haptic`）、全螢幕闃光閃爍（Juice Flash）、擦彈微粒火花噴濺、首領重擊短暫 hit-stop；完全遵守 `prefers-reduced-motion` 無障礙減敏降級。相關實作請見：[`src/App.tsx`](../Games/Danmaku-Abyss/src/App.tsx)、[`src/game/juice.ts`](../Games/Danmaku-Abyss/src/game/juice.ts)、[`src/components/GameCanvas.tsx`](../Games/Danmaku-Abyss/src/components/GameCanvas.tsx)。 |
| **觸控與操作** | 行動端極致手感調校：自適應直向戰場並設有 **46px 固定垂直抬升偏移（drag offset）**，戰機與微型判定點永遠懸浮於手指觸控點上方，徹底解決拇指遮蔽核心判定點之痛點；拖曳平滑向量導向（Steering Vector）杜絕暴力瞬移與邊界穿透，距離 ≤ 1.5px 自動煞停無抖動；長按 220ms 自動啟動集中微操模式（Hold-to-Focus）；螢幕底部安全區配置獨立觸控操作列（Touch bar）點擊「特技 X」與「靈擊 Z」，杜絕飛行閃避時誤觸；行動端專屬強化抽屜（Mobile Upgrades Drawer）一鍵隨時滑出檢視本局 Roguelike 強化構築。相關實作請見：[`src/App.tsx`](../Games/Danmaku-Abyss/src/App.tsx)、[`src/components/GameCanvas.tsx`](../Games/Danmaku-Abyss/src/components/GameCanvas.tsx)。 |
| **驗證腳本** | `npm run lint -w danmaku-abyss`（TypeScript 嚴格型別檢查 0 錯誤）與 `npm run check -w danmaku-abyss` → [`scripts/self-check.ts`](../Games/Danmaku-Abyss/scripts/self-check.ts)（無瀏覽器依賴純邏輯驗證，深度擴充至 >1,250 行）：覆蓋微型核心判定盒（2.0px～3.2px）vs 擦彈盒（24px～31.2px）精密幾何判斷、邊界像素精確命中／擦彈／完全未受波及三態分類、擦彈計數單發不重複；擦彈倍率升降動力學（連續擦彈平滑單調遞增至 4.0x 上限封頂不溢位、平靜期 0.04/s 線性衰減至 1.0x 下限保底不掉穿）；貼臉霰彈傷害衰減與非線性曲線（近距 2.2x 到 380px 遠距 0.55x 的 4:1 陡峭收益曲線、近身增傷詞條 steepen 強化加成、重炮與過載特技加權）；五階段首領符卡階梯與發射器單調性（5 位首領共 20 張符卡、道中與首領強度 intensity 曲線逐級單調遞增、全強度區間發射器係數連續平滑無階躍突變、高難度下障礙壁 wall 縫隙 gap >= 1 絕對保證生還通路）；靈擊保命代價取捨（即時清彈＋1.6s 無敵視窗 vs 擦彈倍率歸 1 嚴苛犧牲高達數千分結算加成、無敵期間免疫傷害且防重複投彈）；觸控座標偏移與集中模式動力學（-46px 拇指抬升幾何換算、向量跟隨死區防震顫、260 vs 105 高低速比與 focused 條件判定觸發）；種子決定論、狀態純函數不變量、32 種 Roguelike 強化與條件鍵 100% 引擎接線率、模式包與機庫進度持久化。 |

## 實作結構

- 專案根目錄：[`Games/Danmaku-Abyss/`](../Games/Danmaku-Abyss/)
- 遊戲核心與物理引擎：[`src/game/engine.ts`](../Games/Danmaku-Abyss/src/game/engine.ts)、[`src/game/constants.ts`](../Games/Danmaku-Abyss/src/game/constants.ts)、[`src/game/types.ts`](../Games/Danmaku-Abyss/src/game/types.ts)
- 符卡題庫與首領階段：[`src/game/cards.ts`](../Games/Danmaku-Abyss/src/game/cards.ts)
- 機體特性與技能：[`src/game/crafts.ts`](../Games/Danmaku-Abyss/src/game/crafts.ts)、[`src/components/CraftHangarModal.tsx`](../Games/Danmaku-Abyss/src/components/CraftHangarModal.tsx)
- Roguelike 強化詞條：[`src/game/upgrades.ts`](../Games/Danmaku-Abyss/src/game/upgrades.ts)
- 關卡包與每日挑戰：[`src/game/modes.ts`](../Games/Danmaku-Abyss/src/game/modes.ts)、[`src/game/daily.ts`](../Games/Danmaku-Abyss/src/game/daily.ts)
- 手感與震動回饋：[`src/game/juice.ts`](../Games/Danmaku-Abyss/src/game/juice.ts)
- 街機雙翼座艙與 Canvas 渲染：[`src/components/CabinetWings.tsx`](../Games/Danmaku-Abyss/src/components/CabinetWings.tsx)、[`src/components/GameCanvas.tsx`](../Games/Danmaku-Abyss/src/components/GameCanvas.tsx)、[`src/components/FirstRunGuide.tsx`](../Games/Danmaku-Abyss/src/components/FirstRunGuide.tsx)
- 主應用程式介面：[`src/App.tsx`](../Games/Danmaku-Abyss/src/App.tsx)
- 深度自我驗證腳本：[`scripts/self-check.ts`](../Games/Danmaku-Abyss/scripts/self-check.ts)

## 平衡量測

本作的模擬層為**固定時間步長的純函數**：整趟遊戲是 `(種子, 輸入序列)` 的函數，因此可重播、可無頭模擬。平衡工具與遊戲同時存在，而不是等問題出現才補。要量的是：

1. **存活率對 `intensity` 的曲線**——難度曲線必須是連續且單調的，而不是某一階段忽然變成不可能。
   - 實測抓到兩次牆。第一次是符卡本身被逐關手刻（第 1 階段的環 10–14 發、第 5 階段 24–26 發），手刻的escalation 乘上標量的escalation：存活率 100/100/88/88/**13%**，子彈峰值 720→**1701**。
   - 拉平密度之後牆還在，因為**每秒彈量是彈數除以間隔，兩者都乘上 `intensity` 就是平方成長**，最後一步永遠最痛。把節奏的成長放緩（彈數繼續扛escalation）之後：100/100/88/88/**38%**，峰值 244→300→432→483→760。
   - 守這條線的檢查不是比較相鄰階段——那樣不管節奏設得多殘暴都不會翻倍，實測放回 0% 存活的設定仍然全綠。改成比較頭尾總比值，門檻取在實測「可玩」（3.46×）與實測「是牆」（4.29×）之間。
2. **強化池的跨趟重疊率**——一趟只應看到池子的少數。蛇窟迴廊是修完才把重疊率壓到 27%，這次要一開始就守住。實測：池子 32 個，一趟拿 5 個、看到 40%、兩趟重疊 12%。
   - 排名量測本身出過一次錯：32 個強化對上一趟最多 15 次提案，大部分強化在受測種子裡根本沒被提供過，那些列全都走同一條後備路徑而得到**完全相同的分數**（四個不同強化並列 84255）。改成把受測強化直接注入第一次提案，並加了退化偵測——超過四分之一的列分數重複就直接印警告，而不是安靜地產生一個好看的結論。
3. **靈擊是不是免費保險**——比較「永遠不用靈擊」與「一有危險就用」兩種策略，若後者全面優於前者，代表它不是決策。
4. **強化的誠實性**——自我測試直接讀引擎原始碼，斷言每個宣告過的效果鍵真的被引擎使用，條件也一樣（每個宣告過的條件必須出現在 `activeConditions()` 裡）。蛇窟迴廊曾宣告 10 個效果鍵而其中 **5 個引擎根本沒讀**，那些強化的說明文字會是騙人的，而且不會有任何錯誤訊息。
5. **計分曲線必須真的會動**——擦彈倍率的打平速率是「每秒衰減 ÷ 每次增量」。第一版是 0.12 / 0.004＝**每秒 30 次擦彈**，而實測速率是 0.74，所以倍率永遠是 1.00，整個計分系統與兩個 `倍率 ≥ 2` 的條件式強化全部是死的。這種失效不會有任何錯誤訊息，而且靈擊的斷言 `grazeMult === 1` 還會因為錯誤的理由持續通過。
6. **條件式強化必須在條件之外付出代價**——否則它只是披著條件當裝飾的免費強化。`賭命`／`殘照` 原本綁在「剩最後一條命」而無代價，是讓人在最接近失敗時最強的逆轉機制，與「有殘機但死亡仍然很痛」直接衝突，實測把第 3、4 階段存活率從 88% 推到 100%。
7. **難度曲線必須落在量過的可玩區間**——這一項原本寫的是「已知未解：難度槓桿飽和了，調高反而讓機器人活得更好」。**那個結論已被推翻並收回。**
   - 推翻它的是一個控制變因實驗：把強化清單**整個清空**再掃描斜率。沒有強化就沒有東西讓「擦彈→戰力」的迴圈跑，而斜率照樣把通關率從 100% 壓到 63% 再到 0%。**槓桿是完美單調的。**
   - 錯誤來源是我盯著**平均剩命**（2.6 → 2.9 → 2.0）的非單調波動，替它編了一套機制解釋，而**通關率一直都是單調的**（100 → 100 → 88）。八個種子的剩命是兩個指標裡比較吵的那個。當時也漏了一個很簡單的算術檢查：觸發該迴圈的強化只佔池子 2/32。
   - 真正的問題是出貨強度太低：`+0.55` 斜率下，**有沒有強化都是 100% 通關**。改為 `+0.85`（88% / 剩命 1.6）。
   - 守這條線的檢查現在是**雙邊**的，錨在實測的三個點（3.28× → 100%、4.34× → 88%、5.51× → 13%）。舊檢查只有上限，這正是「太簡單」能一路出貨而不被攔下的原因。舊上限本身也已過期——它錨在舊強化池的量測，內容改變後同一個比值的意義完全不同。

## 常見變體或可選規則

- **練習模式**：單獨挑選已見過的符卡反覆練習，不計入紀錄。
- **強度自訂**：手動指定起始 `intensity`，供想直接跳到高壓段落的玩家使用。

### 模式／關卡包（標題入口）

標題「模式／關卡包」提供固定種子的可刷關卡，進度鍵 `danmaku-abyss:modes-v1`（`clearedCount`／`cleared`／`bestScore`），**與自由遊玩最佳分 `danmaku-abyss:best` 分開**。依序解鎖：

| 關 | id | 內容 |
|----|----|------|
| 1 | `practice-lamp` | 燈守演習：僅第 1 階段，跳過道中 |
| 2 | `practice-tide` | 潮鳴演習：僅第 2 階段 |
| 3 | `practice-frost` | 刃霜演習：僅第 3 階段 |
| 4 | `hard-abyss` | 高難深潛：五階段全通，強度＋0.55，殘機／靈擊各 2 |
| 5 | `spell-frost-rain` | 指定符卡：凍符「靜止的雨」，必須 Capture |
| 6 | `spell-abyss-gaze` | 指定符卡：終符「深淵回望」，必須 Capture |
| 7 | `spell-frost-duet` | 指定符卡：霜符「雙弦」，必須 Capture |
| 8 | `spell-abyss-rift` | 指定符卡：淵符「裂壁」，必須 Capture |
| 9 | `spell-lamp-beacon` | 指定符卡：燈符「導標」，必須 Capture |
| 10 | `spell-ember-bloom` | 指定符卡：燼符「花開」，必須 Capture |

實作：`src/game/modes.ts`；引擎 `createRun` 接受 `endStage`／`skipMidway`／`singleCard`／`intensityBonus`／`craftId` 等 knobs。新符卡仍為發射器參數資料，不改引擎分支；平衡腳本仍只讀 `intensity` 曲線與卡池密度。

### 回饋（Juice）與櫻井政博遊戲手感對齊

受擊、靈擊、特技、王擊破、道中擊破會觸發畫面震動／闃光與粒子；擦彈有微粒回饋，連段或對王的重擊有短暫 hit-stop，並以 `synthAudio`（`playImpact`／`playCombo`／`playCapture`）配音。`prefers-reduced-motion: reduce` 時關閉震動、hit-stop、粒子與閃光，模擬層不受影響。

對齊櫻井政博遊戲設計哲學（`Sakurai-Skills`）：
1. **彈幕高明度差外框（`readability-before-decoration`）**：所有子彈外圍增加深色高反差描邊（外圈 `rgba(5, 5, 15, 0.88)` 暗色輪廓 + 內圈高亮色彩線條 + 中心白核），解決亮色爆炸或全螢幕白光時彈幕被視覺吞噬的問題。
2. **首領符卡戰況儀（`fx-005`）**：重構頂部 Boss 血條框架，清晰顯示 Boss 名稱、當前符卡名稱、血量百分比、符卡倒數計時（剩餘 ≤ 5 秒顯著紅色告警）及多階段切換刻度。
3. **極速重試（`gameplay-ux-009` Rapid Retry）**：結算畫面支援 <kbd>Space</kbd> / <kbd>Enter</kbd> / <kbd>KeyR</kbd> 單鍵瞬時重試，將「失敗到再開」的操作阻力縮減至零；並在升級抽卡畫面支援 <kbd>1</kbd> / <kbd>2</kbd> / <kbd>3</kbd> 單鍵快選。

### 戰術抬頭顯示與機庫視覺革新（HUD & Visual Overhaul）

1. **貼身動態戰術光弧（Tactical Proximity Arc）**：
   - 即時計算戰機與最近敵方目標的歐氏距離，將核心規則「距離越近、傷害越高」視覺化為動態光弧。
   - **極限貼臉區（距離 < 135px）**：繪製赤金高亮戰術弧圈與 `POINT-BLANK / ×2.20 MAX` 增傷徽標，給予玩家極致的近身搏命正回饋。
   - **中距離戰術區（135–260px）**：繪製電青色環狀標記與當前增傷倍率（如 `×1.50`）。
   - **遠距離衰減區（> 260px）**：淡化漸層標記，提示玩家往前站位獲取火力優勢。
2. **街機框體副螢幕（Arcade Cabinet Wings，寬度 ≥ 1024px）**：
   - **左翼戰術監控儀**：顯示機體藍圖規格、精準判定半徑（3.2px）與擦彈半徑（26px）、特技冷卻計，以及**本局已啟動的 Roguelike 強化甲板**，支援懸浮詞條說明與稀有度光階。
   - **右翼首領威脅雷達**：王戰時動態展開血條、符卡名、Capture 倒數計時與 50,000 PTS 獎勵儀，配備擦彈超載倍率儀（Graze Overdrive 1.00x–4.00x）與全套鍵盤操作手冊。
3. **行動端強化抽屜（Mobile Upgrades Drawer）**：
   - 手機版畫面上方設有動態強化晶片（如「強化 3」），點擊即可滑出半透明毛玻璃抽屜，隨時盤點本局裝備構築。
4. **深淵機庫展示室（Craft Hangar Showcase）**：
   - 全新升級「選擇機體」為沈浸式機庫介面，具備機體向量輪廓投影、扇型射程分佈、判定精確度量測儀與專屬特技數值展示。

## 備註

- 以 2D Canvas 繪製，不使用 3D 引擎；子彈為程式繪製的簡單圖形，不含任何第三方美術資源。
- 全部彈幕與敵機行為皆為決定性，相同種子碼與相同輸入序列會重現完全相同的一趟。
- **首局引導**：首次進入標題頁顯示三步上手疊層（`danmaku-abyss:howto-seen`）；關閉後可從「操作教學」再開。CTA 為「知道了」，避免與「潛入深淵」衝突。
- **機體／圖鑑**：`src/game/crafts.ts`、`src/components/CraftHangarModal.tsx`；標題「選擇機體」「符卡圖鑑」。
- **街機框體**：`src/components/CabinetWings.tsx`；桌面端大螢幕展示。
- **每日挑戰**：`src/game/daily.ts`；標題「今日挑戰」、結算分享文案。
- 實作路徑：`Games/Danmaku-Abyss/`；UI：`src/App.tsx`、`src/components/FirstRunGuide.tsx`、`src/components/CabinetWings.tsx`、`src/components/CraftHangarModal.tsx`；核心：`src/game/`。

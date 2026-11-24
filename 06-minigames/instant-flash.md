# 武士反應訓練（Instant Flash）

## 類別

迷你遊戲類型

## 概述

武士反應訓練（Instant Flash: Iai Training Grounds）為節奏與反應遊戲，靈感來自居合「一閃」：在提示出現的瞬間以正確時機與方向操作，完成完美反擊。考驗專注力、反應速度與左右判斷。全新重構導入「雙翼武道館戰術座艙（Dual-wing Bushido Dojo Cockpit）」與「九段拔刀段位系統」，大幅提升電競手感與武道沈浸體驗。

## 人數與建議年齡

- 人數：1 人（對決／每日／挑戰／練習）；同機雙人拔刀為 2 人。
- 建議年齡：約 8 歲以上。

## 所需器材與操作

- 訓練場畫面、時機提示、左右斬提示與評分回饋。
- 操作指南（支援電競熱鍵 HUD）：
  - `A`／`←`：左鞘蓄力引刀，放開觸發左斬。
  - `D`／`→`：右鞘蓄力引刀，放開觸發右斬。
  - `Space`／`J`：智慧快速拔刀（自動根據暗器偏向出鞘，放開即斬）。
  - `R`：戰敗或任意時刻快速再戰一場。
  - `Esc`：中斷並返回道場選單。
  - 觸控：按住螢幕左／右半邊待機，放開即反擊。雙人模式為左側 P1（A）、右側 P2（L）。

## 遊戲目標

在連續回合中掌握時機與左右邊，取得「完美」判定並累積高分；對決階梯則以擊敗對手、解鎖下一位為目標，並晉陞個人九段拔刀段位至「皆傳・神速」。

## 模式

1. **對決階梯**：八位對手武士，各有獨特攻擊模式（佯攻、二連擊、遲延、加速、左右亂換、混彈、頭目綜合）。擊敗當前對手解鎖下一位；紀錄每位對手最佳反應時間與評價（S／A／B／C）。
2. **每日對決**：以 Asia／Taipei 日曆日為種子，當日固定對手與亂數序列；通關寫入連勝 streak。
3. **雙人拔刀**：同機快拔競賽，先得 5 分勝出。
4. **挑戰模式**：無盡挑戰；HP 歸零結束；分數與最高連段寫入 `localStorage` 個人最佳。含輕度佯攻與左右斬。
5. **練習模式**：無限生命；不計入個人最佳；可選練習劇本與強度。

### 對手名冊（`OPPONENTS`）

| # | id | 名稱 | 模式特點 |
|---|-----|------|----------|
| 1 | ronin | 見習浪人 | 基本均衡 |
| 2 | bait | 誘餌影 | 大量佯攻（放開受罰） |
| 3 | twin | 雙連閃 | 二連擊 |
| 4 | delay | 遲延鬼 | 超長待機後出手 |
| 5 | surge | 加速鴉 | 飛行加速 |
| 6 | mirror | 左右幻 | 左右頻繁對調 |
| 7 | chaos | 混彈鬼 | 四種暗器＋偶爾佯攻 |
| 8 | master | 宗師一閃 | 頭目：全能綜合 |

### 練習劇本（`PracticeScenario`）

| 劇本 | UI | 暗器偏重 | 預設強度 |
|------|-----|----------|----------|
| mixed | 標準亂舞 | 手裡劍 40%／飛刀 25%／炸彈 20%／鐮刀 15% | 標準 |
| kunai | 飛刀特訓 | 飛刀為主（55%） | 標準 |
| bomb | 炸彈誘餌 | 慢彈為主（50%） | 輕鬆 |
| chaos | 亂舞高壓 | 飛刀＋鐮刀混打 | 高壓 |

## 雙翼武道館戰術座艙（Dual-wing Bushido Dojo Cockpit）

全新座艙架構將對決視線、神經反應數據與武士心法無縫結合：

1. **左翼：居合神經反應光譜儀（Reaction Spectrum Radar）**
   - **實時秒差散佈圖**：追蹤最近拔刀動作之毫秒級偏差（-250ms 至 +250ms），以白熱命中點（0ms）為核心。
   - **動態判定視窗**：清晰標註當前難度下收斂之 Perfect 窗（±60~120ms）與 Good 窗（±160~300ms）。
   - **居合心流波形（Zen Flow Waveform）**：Canvas 動態示波器，依據連段、蓄力與身心專注度流暢變換波長振幅與紫金輝光。
   - **極致度量**：即時換算最速斬擊與平均秒差。
2. **右翼：天下劍豪錄與武士心法（Bushido Dossier & Scrolls）**
   - **劍豪交鋒情報**：即時解析當前對手特徵、暗器偏好、破綻指引與個人交戰勝負紀錄。
   - **九段拔刀段位階梯（9-Dan Iai Master Progression）**：
     - 初段・青竹（初窺門徑）
     - 二段・白刃（凝神出鞘）
     - 三段・青嵐（身動如風）
     - 四段・飛燕（雙閃連破）
     - 五段・雷鳴（看破幻影）
     - 六段・紫電（刀光化弧）
     - 七段・業火（百步絕斬）
     - 八段・無雙（天人合一）
     - 皆傳・神速（剎那一閃）
   - **心法大師錦囊**：交互輪播「靜心凝神」、「破綻捕捉」、「看破假相」、「殘心收刀」、「氣韻回流」五大居合訣竅。
3. **中央戰場與動態特效**
   - **殘心光環與刀柄寒光**：按住蓄力出鞘時散發居合凝神光環與微爍寒星。
   - **多層次電光火石刀光**：左斬（天青湛藍）、右斬（旭日金琥珀）專屬雷弧 SVG 動態刀痕，伴隨四射火花粒子。
   - **完美一閃衝擊波**：精準命中時激發全螢幕白熾負片反色、完美震波環與 Hit-Stop 鈍化頓點。
4. **行動端頂部戰術速報條（Tactical Ticker）**
   - 整合當前段位徽章、最速反應、心流狀態，並提供一鍵滑入式左右翼戰術抽屜。

## 規則說明

1. 按住左或右進入拔刀待機；暗器路線上偏＝左斬、下偏＝右斬。亦可直接使用 `Space`／`J` 依直覺快速引刀。
2. 在 Perfect／Good 時間窗內放開**正確側**得分；錯邊、太早、太晚皆受傷並斷連段。
3. **佯攻**：警告後暗器中途消失——不要放開，忍耐「看破」得分；若放開則佯攻懲罰。
4. 連續成功可提升倍率；分數與連段提升時，Perfect／Good 時間窗收斂、攻擊節奏加快（見 `constants.ts`）。
5. 對決雙方皆有 HP；打空對手 HP 為勝。結算顯示最快／平均反應、S／A／B／C 評價以及晉階段位。

## 勝負條件

- 挑戰：總分與最高連擊為個人紀錄。
- 對決／每日：擊敗對手為勝；每日另計連勝。
- 雙人：先得 5 分。
- 練習：僅供訓練，不寫入挑戰最佳。

## 櫻井政博遊戲手感與美術原則實踐（Game Feel & Visual Art）

本遊戲繼承櫻井政博在《星之卡比 超級豪華版》「武士卡比（Samurai Kirby）」中創立的極限反應手感體系，並全面貫徹櫻井政博視覺美術設計原則：
1. **剪影優先辨識度（skill-gfx-013 Silhouette-First Readability）**：
   - 告別過往所有對手共用單一 `enemy.jpg` 的廉價感，為對決階梯 8 位劍豪建立專屬高對比立繪與頭像（[Games/Instant-Flash/public/opponents/](file:///Users/cfh00896102/Github/Clubhouse-Games/Games/Instant-Flash/public/opponents/)）：
     - `ronin`（見習浪人）：竹笠斗笠、竹刀練習木刃、翠綠專屬輝光與「浪」字落款印。
     - `bait`（誘餌影）：斜戴白瓷狐面、雙隱藏苦無、櫻粉殘影與「影」字落款印。
     - `twin`（雙連閃）：雙交叉小太刀、疾風閃電弧、天青電光與「雙」字落款印。
     - `delay`（遲延鬼）：鐵鬼面具、肩扛巨大野太刀、沈穩紫焰與「鬼」字落款印。
     - `surge`（加速鴉）：長喙黑鴉天狗面具、羽刃衝刺姿態、烈橙疾風與「鴉」字落款印。
     - `mirror`（左右幻）：黑白對稱羽織、鏡光雙刃、幻像青光與「幻」字落款印。
     - `chaos`（混彈鬼）：狂暴鐵鎖鐮、暗器綁帶、洋紅火花與「亂」字落款印。
     - `master`（宗師一閃）：金紋符文眼罩、神聖金龍鍔神刀、金光聖環與「極」字落款印。
   - 玩家主角升級為高解析度居合神童立繪（[player.jpg](file:///Users/cfh00896102/Github/Clubhouse-Games/Games/Instant-Flash/public/player.jpg)）：深藍飛鶴羽織、白袴、冷澈拔刀待機姿態與湛藍氣韻。
2. **清晰度高於裝飾（skill-gfx-002 Readability Before Decoration）**：
   - 四大暗器全面升級 512×512 高對比高銳利材質（[Games/Instant-Flash/public/projectiles/](file:///Users/cfh00896102/Github/Clubhouse-Games/Games/Instant-Flash/public/projectiles/)），搭配專屬光暈辨識框（手裡劍紅芒、苦無藍光、炸彈橙火、鎖鐮青風），在高速飛行中確保左右判斷清晰無誤。
3. **格鬥選人格調與情報整合（skill-gfx-007 Unified Stylized Aesthetic）**：
   - 對決階梯導入動漫格鬥遊戲選人卡片，具備頭像外框、頭目專屬勳章、通關勾選與最快毫秒紀錄。
   - 右翼劍豪情報座艙（`OpponentDossierCard`）同步整合對手頭像、專屬配色邊框與破綻指引。
4. **待機懸念心跳音律（gameplay-core-002 Stress & Release）**：
   - 居合納刀待機與警告階段導入低頻 60Hz 呼吸心跳音律脈動（Heartbeat Thump），在寂靜的對峙中營造極致神經緊張感，直到「閃」字爆發。
5. **居合一閃 120ms Hit-stop 與物理震顫（fx-005 & fx-004）**：
   - 完美反擊時啟動物理定格（Hit-stop）與畫布實體震顫（`shake(container, 1.8)`），搭配水墨金光與彩帶慶祝（`particles('confetti')`），極大化刀光一瞬的破壞張力。
6. **搶拍與失誤詼諧音效反饋（communicate-through-feedback）**：
   - 提前搶拍揮刀時合成滑稽鈍擊音與震顫（`shake(container, 1.1)`），清晰告知犯規。
7. **極速重試（gameplay-ux-009）**：
   - 對決或挑戰結束時，結算疊層支援 <kbd>Space</kbd>、<kbd>Enter</kbd> 與 <kbd>R</kbd> 鍵秒速立即再戰，無需滑鼠位移點擊。

## 品質門檻對齊

對照 [`docs/GAME-QUALITY-BAR.md`](../docs/GAME-QUALITY-BAR.md)：

| 項目 | 本實作 |
|------|--------|
| 模式／變體 | 5 種遊戲模式（對決階梯 8 位劍豪、每日對決 Asia/Taipei 種子、同機雙人拔刀競賽、無盡挑戰模式、4 大練習劇本 × 3 種難度強度） |
| 遙測與座艙 | 雙翼武道館戰術座艙（居合神經反應光譜儀、毫秒級秒差散佈圖、動態收斂判定視窗、Zen Flow 心流動態波形、劍豪交鋒情報、九段拔刀段位階梯、心法大師錦囊、行動端戰術速報條） |
| Replay hook | `localStorage` 本地儲存多維度紀錄（挑戰模式最佳高分、最高連段、8 位劍豪個別擊破狀態、每位對手最快反應毫秒與最高評級 S/A/B/C、每日挑戰 Asia/Taipei 連勝 Streak、九段拔刀段位累積晉陞） |
| Undo／Hint | 練習模式無限生命免受傷重試；劍豪交鋒破綻指引與居合心法錦囊提示（靜心凝神、破綻捕捉、看破假相、殘心收刀、氣韻回流）；暗器軌跡上偏左斬／下偏右斬直覺引導 |
| Feedback | 完美一閃全螢幕白熾負片反色與衝擊波、Hit-Stop 鈍化頓點、自適應螢幕震動、雙向雷弧刀光與火花粒子、`@clubhouse/shared/synthAudio` 居合拔刀／斬擊音效、結算畫面與段位晉陞徽章 |
| Touch | 螢幕左右分區觸控引刀與放開拔刀、雙人模式左右同機對決觸控（P1/P2）、行動端頂部戰術速報條與滑入式左右翼戰術抽屜 |
| Check | `npm run check` → `check-instant-flash.mjs`（`node --experimental-strip-types` 原生導入 TS 模組，驗證 0-6 難度階梯時間窗、左右斬判定、佯攻看破與提前放刀懲罰、九段拔刀段位晉陞、8 位劍豪解鎖、Asia/Taipei 每日種子與連勝） |

## 櫻井政博風格視覺美術與道場劍客重繪（Sakurai Art Design & Wave 14 Visual Assets）

本作在第 14 波美術優化中，全面落實櫻井政博視覺第一眼辨識與浮世繪居合張力原則：

- **黃昏暮色道場與金箔雲紋主視覺（skill-gfx-013 & skill-gfx-007）**：繪製 1350×900 傳統居合武道場主視覺（`dojo-bg.jpg`），描繪穿透障子紙門的夕陽金暉、幽黑竹林剪影、大和繪金箔雲紋、壁龕掛軸「一閃」書法與朱印「劍」，營造凝神聚氣的拔刀對決氛圍。
- **深色檜木地板與榻榻米邊界（skill-gfx-004 Dojo Timber & Tatami Ground）**：繪製 1350×900 檜木道場地面（`floor.jpg`），具備深邃漆木光澤倒影、木質紋理與深青藍織錦包邊榻榻米緣。
- **居合劍客與暗影對手武士立繪（skill-gfx-001 Samurai Duelist Sprites）**：
  - 拔刀劍豪（`player.jpg` & `opponents/player.jpg`，深藍行燈袴、白色旅羽織、手按刀柄之居合待機姿態，朱印「斬」）
  - 暗影武士（`enemy.jpg`，赤紅煞氣鬥篷與灼熱目光之挑戰者剪影）
- **八位名冊劍豪 512×512 肖像與 600×900 對決立繪（skill-gfx-013 Duelist Roster）**：
  - 見習浪人（`opponents/ronin.jpg` & `opponents/ronin-sprite.jpg`，斗笠草履、樸實木刀與沉穩架式，朱印「浪」）
  - 誘餌影（`opponents/bait.jpg` & `opponents/bait-sprite.jpg`，暗黑夜行忍者、雙重煙幕包與虛實假招，朱印「影」）
  - 沉著蓄力客（`opponents/delay.jpg` & `opponents/delay-sprite.jpg`，金角兜盔黑鐵胴甲、雙手後撤之長野太刀延遲斬，朱印「蓄」）
  - 疾風狂刀（`opponents/surge.jpg` & `opponents/surge-sprite.jpg`，翠綠風行羽織、雙持短刀與旋轉風刃氣流，朱印「風」）
  - 鏡像倒影（`opponents/mirror.jpg` & `opponents/mirror-sprite.jpg`，銀白和服、白髮能面與反射刀光，朱印「鏡」）
  - 陰陽雙子（`opponents/twin.jpg` & `opponents/twin-sprite.jpg`，紅白雙色對稱武服、雙刀十字連擊，朱印「雙」）
  - 混亂狂僧（`opponents/chaos.jpg` & `opponents/chaos-sprite.jpg`，狂亂長髮修驗山伏、錫杖寶珠與無序步法，朱印「狂」）
  - 居合大師（`opponents/master.jpg` & `opponents/master-sprite.jpg`，金絲織錦羽織、白眉劍聖神威金芒刀氣，朱印「極」）
- **四款高對比飛射暗器貼圖（skill-gfx-001 Ninja Projectiles）**：
  - 手裏劍（`projectiles/shuriken.jpg`，鍛造四角烏鋼飛鏢、鋒利倒角與中心旋轉空孔）
  - 苦無（`projectiles/kunai.jpg`，菱形破甲鋼刃、防滑纏繩握把與赤紅流蘇圈）
  - 火藥炸彈（`projectiles/bomb.jpg`，鑄鐵球形焙烙玉地雷、燃燒引信火花）
  - 鎖鐮飛刃（`projectiles/sickle.jpg`，新月弧形鐮刀刃、連環鐵鏈軌跡）

## 實作

- 專案路徑：[Games/Instant-Flash/](../Games/Instant-Flash/)
- 檢查腳本：`npm run check`（`check-instant-flash.mjs`；以 `node --experimental-strip-types` 執行，含難度時間窗、左右／佯攻判定、階梯解鎖、九段晉陞、Taipei 每日種子與評價）
- 靜態檢查：`npm run lint`（TypeScript 編譯驗證）
- 打包驗證：`npm run build`（Vite 生產建置）
- 手感：hit-stop、螢幕震動、斬擊 SVG、`@clubhouse/shared/synthAudio`、雙翼戰術座艙

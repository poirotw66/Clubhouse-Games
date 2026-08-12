# Clubhouse Games 遊戲規格總覽

![Clubhouse Games](title-image.jpg)

本專案收錄各款遊戲的規格與玩法說明文件，供後續開發使用；遊戲實作置於 `Games/` 下，可透過 **遊戲總覽選單** 進入各遊戲並部署於 GitHub Pages。

- **遊戲總覽選單**：[index.html](index.html)（站台首頁，可選取遊戲進入）
- **架構與部署**：[docs/PROJECT-STRUCTURE.md](docs/PROJECT-STRUCTURE.md)（文件架構、Games 放置約定）
- **GitHub Pages 建置與部署**：[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)（建置流程、CI、本地 build:pages）
- **已實作範例**：二十一點 → [Games/Blackjack-main/](Games/Blackjack-main/)；連環新接龍（FreeCell） → [Games/FreeCell/](Games/FreeCell/)；接龍（Klondike） → [Games/Klondike/](Games/Klondike/)；羽毛球接殺訓練（Block the Smash） → [Games/Block-the-smash/](Games/Block-the-smash/)；武士反應訓練（Instant Flash） → [Games/Instant-Flash/](Games/Instant-Flash/)；神秘液體排序 → [Games/Mystery-Liquid-Sort/](Games/Mystery-Liquid-Sort/)

### 本地啟動（單一服務）

只會啟動 **一個** 開發伺服器，選單與所有已建置的遊戲都由同一個 port 提供。

1. 在專案根目錄安裝依賴（npm workspaces，一次裝完全部遊戲）：
   ```bash
   npm run setup
   ```
2. 建置要玩的遊戲，或一次建置全部：
   ```bash
   npm run build:game Blackjack-main
   # 或
   npm run build:all
   ```
3. 啟動：
   ```bash
   npm run dev
   ```
4. 開啟 **http://localhost:3000**：總覽選單；點「進入遊戲」可進入已建置的遊戲（如二十一點）。

之後新增的遊戲也是先 `npm run build:game <資料夾名>` 再從選單進入，不會變成 51 個服務。

## 目錄結構

<!-- GENERATED_TABLE -->
| 類別 | 資料夾 | 遊戲數 |
|------|--------|--------|
| 紙牌類型 | [01-cards/](01-cards/) | 4 |
| 棋盤類型 | [02-board/](02-board/) | 3 |
| 牌張類型 | [03-tiles-dice/](03-tiles-dice/) | 1 |
| 運動機檯類型 | [04-sports-arcade/](04-sports-arcade/) | 6 |
| 串聯拼砌類型 | [05-puzzle/](05-puzzle/) | 7 |
| 迷你遊戲類型 | [06-minigames/](06-minigames/) | 2 |
<!-- /GENERATED_TABLE -->

# 俱樂部遊戲

<!-- GENERATED_GAMES_CHECKLIST -->
## 01-紙牌遊戲
- [x] [二十一點](01-cards/blackjack.md) → [Games/Blackjack-main/](Games/Blackjack-main/)
- [x] [連環新接龍（FreeCell）](01-cards/freecell.md) → [Games/FreeCell/](Games/FreeCell/)
- [x] [克朗代克接龍](01-cards/klondike.md) → [Games/Klondike/](Games/Klondike/)
- [x] [花牌 Koi-Koi](01-cards/koi-koi.md) → [Games/Koi-Koi/](Games/Koi-Koi/)

## 02-棋盤遊戲
- [x] [黑白棋](02-board/reversi.md) → [Games/Reversi/](Games/Reversi/)
- [x] [西洋跳棋](02-board/checkers.md) → [Games/Checkers/](Games/Checkers/)
- [x] [四子棋](02-board/connect-four.md) → [Games/Connect-Four/](Games/Connect-Four/)

## 03-牌塊與骰子
- [x] [西洋骨牌](03-tiles-dice/dominoes.md) → [Games/Dominoes/](Games/Dominoes/)

## 04-運動與街機
- [x] [玩具拳擊](04-sports-arcade/toy-boxing.md) → [Games/Toy-Boxing/](Games/Toy-Boxing/)
- [x] [玩具棒球](04-sports-arcade/toy-baseball.md) → [Games/Toy-Baseball/](Games/Toy-Baseball/)
- [x] [羽毛球接殺訓練](04-sports-arcade/badminton-smash.md) → [Games/Block-the-smash/](Games/Block-the-smash/)
- [x] [積木賽車](04-sports-arcade/brick-kart-racing.md) → [Games/Brick-Kart-Racing/](Games/Brick-Kart-Racing/)
- [x] [海灣帆航](04-sports-arcade/sailing.md) → [Games/Sailing/](Games/Sailing/)
- [x] [霓虹疾馳](04-sports-arcade/cyber-neon-rush.md) → [Games/Cyber-Neon-Rush/](Games/Cyber-Neon-Rush/)

## 05-益智遊戲
- [x] [神秘液體排序](05-puzzle/mystery-liquid-sort.md) → [Games/Mystery-Liquid-Sort/](Games/Mystery-Liquid-Sort/)
- [x] [俄羅斯方塊](05-puzzle/tetris.md) → [Games/Tetris/](Games/Tetris/)
- [x] [蛇窟迴廊（Roguelike 貪吃蛇）](05-puzzle/roguelike-snake.md) → [Games/Roguelike-Snake/](Games/Roguelike-Snake/)
- [x] [魔法氣泡](05-puzzle/puyo-puyo.md) → [Games/Puyo-Puyo/](Games/Puyo-Puyo/)
- [x] [發條守城](05-puzzle/clockwork-keep.md) → [Games/Clockwork-Keep/](Games/Clockwork-Keep/)
- [x] [數字推盤](05-puzzle/fifteen-puzzle.md) → [Games/Fifteen-Puzzle/](Games/Fifteen-Puzzle/)
- [x] [記憶配對](05-puzzle/memory-match.md) → [Games/Memory-Match/](Games/Memory-Match/)

## 06-迷你遊戲
- [x] [武士反應訓練](06-minigames/instant-flash.md) → [Games/Instant-Flash/](Games/Instant-Flash/)
- [x] [色感記憶](06-minigames/dialed-color.md) → [Games/Dialed-Color/](Games/Dialed-Color/)
<!-- /GENERATED_GAMES_CHECKLIST -->

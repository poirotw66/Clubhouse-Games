# Clubhouse Games 遊戲規格總覽

本專案收錄各款遊戲的規格與玩法說明文件，供後續開發使用；遊戲實作置於 `Games/` 下，可透過 **遊戲總覽選單** 進入各遊戲並部署於 GitHub Pages。

- **遊戲總覽選單**：[index.html](index.html)（站台首頁，可選取遊戲進入）
- **架構與部署**：[docs/PROJECT-STRUCTURE.md](docs/PROJECT-STRUCTURE.md)（文件架構、Games 放置約定）
- **GitHub Pages 建置與部署**：[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)（建置流程、CI、本地 build:pages）
- **已實作範例**：二十一點 → [Games/Blackjack-main/](Games/Blackjack-main/)；連環新接龍（FreeCell） → [Games/FreeCell/](Games/FreeCell/)；最後一張牌（Last Card） → [Games/Last-Card/](Games/Last-Card/)；接龍（Klondike） → [Games/Klondike/](Games/Klondike/)；羽毛球接殺訓練（Block the Smash） → [Games/Block-the-smash/](Games/Block-the-smash/)；武士反應訓練（Instant Flash） → [Games/Instant-Flash/](Games/Instant-Flash/)；神秘液體排序 → [Games/Mystery-Liquid-Sort/](Games/Mystery-Liquid-Sort/)

### 本地啟動（單一服務）

只會啟動 **一個** 開發伺服器，選單與所有已建置的遊戲都由同一個 port 提供。

1. 在專案根目錄安裝依賴（子專案需各自安裝一次）：
   ```bash
   npm install
   cd Games/Blackjack-main && npm install && cd ../..
   cd Games/Mystery-Liquid-Sort && npm install && cd ../..
   ```
2. 建置要玩的遊戲（例如二十一點或神秘液體排序）：
   ```bash
   npm run build:game Blackjack-main
   # 或
   npm run build:game Mystery-Liquid-Sort
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
| 紙牌類型 | [01-cards/](01-cards/) | 11 |
| 棋盤類型 | [02-board/](02-board/) | 14 |
| 牌張類型 | [03-tiles-dice/](03-tiles-dice/) | 4 |
| 運動機檯類型 | [04-sports-arcade/](04-sports-arcade/) | 13 |
| 串聯拼砌類型 | [05-puzzle/](05-puzzle/) | 5 |
| 迷你遊戲類型 | [06-minigames/](06-minigames/) | 7 |
<!-- /GENERATED_TABLE -->

# 俱樂部遊戲

<!-- GENERATED_GAMES_CHECKLIST -->
## 01-紙牌遊戲
- [x] [二十一點](01-cards/blackjack.md) → [Games/Blackjack-main/](Games/Blackjack-main/)
- [x] [連環新接龍（FreeCell）](01-cards/freecell.md) → [Games/FreeCell/](Games/FreeCell/)
- [ ] [花札](01-cards/hanafuda.md)
- [x] [克朗代克接龍](01-cards/klondike.md) → [Games/Klondike/](Games/Klondike/)
- [x] [最後一張牌](01-cards/last-card.md) → [Games/Last-Card/](Games/Last-Card/)
- [ ] [記憶牌](01-cards/memory-cards.md)
- [ ] [總統](01-cards/president.md)
- [ ] [七並](01-cards/sevens.md)
- [ ] [速戰接龍](01-cards/speed-solitaire.md)
- [ ] [德州撲克](01-cards/texas-holdem.md)
- [ ] [戰爭](01-cards/war.md)

## 02-棋盤遊戲
- [ ] [播棋](02-board/mancala.md)
- [ ] [雙陸棋](02-board/backgammon.md)
- [x] [黑白棋](02-board/reversi.md) → [Games/Reversi/](Games/Reversi/)
- [x] [西洋跳棋](02-board/checkers.md) → [Games/Checkers/](Games/Checkers/)
- [x] [四子棋](02-board/connect-four.md) → [Games/Connect-Four/](Games/Connect-Four/)
- [ ] [英國十字戲](02-board/ludo.md)
- [ ] [西洋棋](02-board/chess.md)
- [ ] [將棋](02-board/shogi.md)
- [ ] [兔子和獵犬](02-board/hare-and-hounds.md)
- [ ] [五子棋／5五將棋](02-board/gomoku.md)
- [ ] [直棋](02-board/nine-mens-morris.md)
- [ ] [六貫棋](02-board/rithmomachy.md)
- [ ] [中國跳棋](02-board/chinese-checkers.md)
- [ ] [點格棋](02-board/dots-and-boxes.md)

## 03-牌塊與骰子
- [x] [西洋骨牌](03-tiles-dice/dominoes.md) → [Games/Dominoes/](Games/Dominoes/)
- [ ] [日式麻將](03-tiles-dice/japanese-mahjong.md)
- [x] [快艇骰子](03-tiles-dice/yahtzee.md) → [Games/Yahtzee/](Games/Yahtzee/)
- [ ] [麻將對對消](03-tiles-dice/mahjong-solitaire.md)

## 04-運動與街機
- [ ] [高爾夫球](04-sports-arcade/golf.md)
- [ ] [飛鏢](04-sports-arcade/darts.md)
- [ ] [氣墊球](04-sports-arcade/air-hockey.md)
- [ ] [撞球](04-sports-arcade/billiards.md)
- [ ] [保齡球](04-sports-arcade/bowling.md)
- [ ] [射靶](04-sports-arcade/target-shooting.md)
- [ ] [釣魚](04-sports-arcade/fishing.md)
- [x] [玩具網球](04-sports-arcade/toy-tennis.md) → [Games/Toy-Tennis/](Games/Toy-Tennis/)
- [x] [玩具足球](04-sports-arcade/toy-football.md) → [Games/Toy-Football/](Games/Toy-Football/)
- [ ] [玩具冰壺](04-sports-arcade/toy-curling.md)
- [x] [玩具拳擊](04-sports-arcade/toy-boxing.md) → [Games/Toy-Boxing/](Games/Toy-Boxing/)
- [x] [玩具棒球](04-sports-arcade/toy-baseball.md) → [Games/Toy-Baseball/](Games/Toy-Baseball/)
- [x] [羽毛球接殺訓練](04-sports-arcade/badminton-smash.md) → [Games/Block-the-smash/](Games/Block-the-smash/)

## 05-益智遊戲
- [x] [神秘液體排序](05-puzzle/mystery-liquid-sort.md) → [Games/Mystery-Liquid-Sort/](Games/Mystery-Liquid-Sort/)
- [x] [章魚燒](05-puzzle/takoyaki.md) → [Games/Takoyaki/](Games/Takoyaki/)
- [ ] [滑塊益智](05-puzzle/sliding-puzzle.md)
- [ ] [6連珠益智](05-puzzle/six-puzzle.md)
- [x] [俄羅斯方塊](05-puzzle/tetris.md) → [Games/Tetris/](Games/Tetris/)

## 06-迷你遊戲
- [x] [彈戲](06-minigames/pachinko.md) → [Games/Pachinko/](Games/Pachinko/)
- [x] [軌道車](06-minigames/slot-cars.md) → [Games/Slot-Cars/](Games/Slot-Cars/)
- [x] [猜顏色](06-minigames/guess-the-color.md) → [Games/Guess-the-Color/](Games/Guess-the-Color/)
- [ ] [豬尾巴](06-minigames/pigs-tail.md)
- [x] [坦克對決](06-minigames/tank-battle.md) → [Games/Tank-Battle/](Games/Tank-Battle/)
- [ ] [協力坦克](06-minigames/coop-tanks.md)
- [x] [武士反應訓練](06-minigames/instant-flash.md) → [Games/Instant-Flash/](Games/Instant-Flash/)
<!-- /GENERATED_GAMES_CHECKLIST -->

# Clubhouse Games 遊戲規格總覽

本專案收錄各款遊戲的規格與玩法說明文件，供後續開發使用；遊戲實作置於 `Games/` 下，可透過 **遊戲總覽選單** 進入各遊戲並部署於 GitHub Pages。

- **遊戲總覽選單**：[index.html](index.html)（站台首頁，可選取遊戲進入）
- **架構與部署**：[docs/PROJECT-STRUCTURE.md](docs/PROJECT-STRUCTURE.md)（文件架構、Games 放置約定）
- **GitHub Pages 建置與部署**：[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)（建置流程、CI、本地 build:pages）
- **已實作範例**：二十一點 → [Games/Blackjack-main/](Games/Blackjack-main/)

### 本地啟動（單一服務）

只會啟動 **一個** 開發伺服器，選單與所有已建置的遊戲都由同一個 port 提供。

1. 在專案根目錄安裝依賴（子專案需各自安裝一次）：
   ```bash
   npm install
   cd Games/Blackjack-main && npm install && cd ../..
   ```
2. 建置要玩的遊戲（例如二十一點）：
   ```bash
   npm run build:game Blackjack-main
   ```
3. 啟動：
   ```bash
   npm run dev
   ```
4. 開啟 **http://localhost:3000**：總覽選單；點「進入遊戲」可進入已建置的遊戲（如二十一點）。

之後新增的遊戲也是先 `npm run build:game <資料夾名>` 再從選單進入，不會變成 51 個服務。

## 目錄結構

| 類別 | 資料夾 | 遊戲數 |
|------|--------|--------|
| 紙牌類型 | [01-cards/](01-cards/) | 11 |
| 棋盤類型 | [02-board/](02-board/) | 14 |
| 牌張類型 | [03-tiles-dice/](03-tiles-dice/) | 4 |
| 運動機檯類型 | [04-sports-arcade/](04-sports-arcade/) | 12 |
| 串聯拼砌類型 | [05-puzzle/](05-puzzle/) | 3 |
| 迷你遊戲類型 | [06-minigames/](06-minigames/) | 6 |



# 俱樂部遊戲

## 01-紙牌遊戲
- [ ] [二十一點](01-cards/blackjack.md)
- [ ] [接龍](01-cards/freecell.md)
- [ ] [花札](01-cards/hanafuda.md)
- [ ] [克朗代克接龍](01-cards/klondike.md)
- [ ] [最後一張牌](01-cards/last-card.md)
- [ ] [記憶牌](01-cards/memory-cards.md)
- [ ] [總統](01-cards/president.md)
- [ ] [七並](01-cards/sevens.md)
- [ ] [速戰接龍](01-cards/speed-solitaire.md)
- [ ] [德州撲克](01-cards/texas-holdem.md)
- [ ] [戰爭](01-cards/war.md)

## 02-棋盤遊戲
- [ ] [西洋雙陸棋](02-board/backgammon.md)
- [ ] [西洋跳棋](02-board/checkers.md)
- [ ] [西洋棋](02-board/chess.md)
- [ ] [中國跳棋](02-board/chinese-checkers.md)
- [ ] [四子棋](02-board/connect-four.md)
- [ ] [連點成方](02-board/dots-and-boxes.md)
- [ ] [五子棋](02-board/gomoku.md)
- [ ] [野兔與獵犬](02-board/hare-and-hounds.md)
- [ ] [飛行棋](02-board/ludo.md)
- [ ] [曼卡拉](02-board/mancala.md)
- [ ] [九子棋](02-board/nine-mens-morris.md)
- [ ] [黑白棋](02-board/reversi.md)
- [ ] [數字棋](02-board/rithmomachy.md)
- [ ] [將棋](02-board/shogi.md)

## 03-牌塊與骰子
- [ ] [骨牌](03-tiles-dice/dominoes.md)
- [ ] [日本麻將](03-tiles-dice/japanese-mahjong.md)
- [ ] [麻將接龍](03-tiles-dice/mahjong-solitaire.md)
- [ ] [大富翁骰子](03-tiles-dice/yahtzee.md)

## 04-運動與街機
- [ ] [空氣曲棍球](04-sports-arcade/air-hockey.md)
- [ ] [撞球](04-sports-arcade/billiards.md)
- [ ] [保齡球](04-sports-arcade/bowling.md)
- [ ] [飛鏢](04-sports-arcade/darts.md)
- [ ] [釣魚](04-sports-arcade/fishing.md)
- [ ] [高爾夫](04-sports-arcade/golf.md)
- [ ] [射擊靶](04-sports-arcade/target-shooting.md)
- [ ] [玩具棒球](04-sports-arcade/toy-baseball.md)
- [ ] [玩具拳擊](04-sports-arcade/toy-boxing.md)
- [ ] [玩具冰壺](04-sports-arcade/toy-curling.md)
- [ ] [玩具足球](04-sports-arcade/toy-football.md)
- [ ] [玩具網球](04-sports-arcade/toy-tennis.md)

## 05-益智遊戲
- [ ] [六塊拼圖](05-puzzle/six-puzzle.md)
- [ ] [滑動拼圖](05-puzzle/sliding-puzzle.md)
- [ ] [章魚燒](05-puzzle/takoyaki.md)

## 06-迷你遊戲
- [ ] [合作坦克](06-minigames/coop-tanks.md)
- [ ] [猜顏色](06-minigames/guess-the-color.md)
- [ ] [彈珠台](06-minigames/pachinko.md)
- [ ] [豬尾巴](06-minigames/pigs-tail.md)
- [ ] [軌道賽車](06-minigames/slot-cars.md)
- [ ] [坦克大戰](06-minigames/tank-battle.md)

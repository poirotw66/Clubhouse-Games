# 玩具棒球（Toy Baseball）

Clubhouse 機檯棒球：讀球、控球、打向空檔。

## 模式

- **正規賽**：3／6／9 局，客場先打，六球種＋出手後控球，九人守備。
- **球季模式**：四隊循環＋冠軍賽；戰績表；具名投手傾向；球場外野深度；`localStorage` 可續玩。
- **全壘打大賽**：10 次揮擊拚全壘打數。

## 打擊手感

依接觸品質觸發畫面震動、短暫停格、塵土／火花粒子；`prefers-reduced-motion` 時關閉。

## 開發

```bash
npm install
npm run dev
npm run lint
npm run check
npm run build
```

規格見 [`04-sports-arcade/toy-baseball.md`](../../04-sports-arcade/toy-baseball.md)。

# 霓虹疾馳（Cyber Neon Rush）

3D 賽博龐克無限跑酷。規格見 [04-sports-arcade/cyber-neon-rush.md](../../04-sports-arcade/cyber-neon-rush.md)。

## 開發

```bash
# 於倉庫根目錄
npm run setup
npm run build:game Cyber-Neon-Rush
npm run dev
```

開啟 http://localhost:3000 後從總覽進入，或直接開啟 `Games/Cyber-Neon-Rush/dist/`。

## 操作

- `←` / `A`：左切道
- `→` / `D`：右切道
- `↑` / `W` / `Space`：跳躍，越過低矮路障
- `↓` / `S` / `Shift`：衝刺（需等待冷卻）
- `P` / `Esc`：暫停／繼續；切換到其他分頁時自動暫停，返回後手動繼續
- 觸控：使用畫面上的操作鍵，或左右滑動切道、上滑跳躍、下滑衝刺

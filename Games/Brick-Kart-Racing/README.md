# 積木賽車 (Brick Kart Racing)

積木玩具風格的卡丁車競速遊戲，規格見 [04-sports-arcade/brick-kart-racing.md](../../04-sports-arcade/brick-kart-racing.md)。

3 圈賽事、4 台賽車、3 條賽道。畫面採 **Mode-7 逐掃描線仿射投影** 呈現偽 3D 賽道，賽車與場景物件皆由程式即時堆砌積木方塊後預算繪製成精靈圖。

## 執行

```bash
npm install
npm run dev
```

或從專案根目錄建置後由統一伺服器提供：

```bash
npm run build:game Brick-Kart-Racing
```

## 操作

| 動作 | 鍵盤 | 觸控 |
|------|------|------|
| 轉向 | `←` `→`（或 `A` `D`） | 左下方向鍵 |
| 加速 | `↑` / `Z` / `W` | 右下「加速」 |
| 煞車／倒車 | `↓` / `S` | 右下「煞車」 |
| 飄移 | `Shift` | 右下「飄移」 |
| 使用道具 | `空白鍵` | 右下「道具」 |
| 暫停／靜音 | `P` / `M` | HUD 右上按鈕 |

飄移時持續蓄力，放開飄移鍵依蓄力等級（藍→橘→紫）獲得對應長度的小噴射。

## 程式結構

```
src/
├── engine/
│   ├── constants.ts     世界座標、鏡頭與渲染參數
│   ├── spline.ts        Catmull-Rom 中心線、等弧長取樣、圈數進度索引
│   ├── trackAssets.ts   賽道貼圖、路面型別圖、道具點、起跑格（依賽道快取）
│   ├── mode7.ts         逐掃描線仿射地面渲染與世界→螢幕投影
│   ├── brickModel.ts    積木方塊的畫家演算法渲染器（含凸點）
│   ├── models.ts        賽車、道具、場景物件的積木模型定義
│   ├── sprites.ts       各偏航角預算繪製精靈圖並自動計算縮放與著地錨點
│   ├── race.ts          物理、飄移、道具、碰撞、CPU AI、圈數與名次
│   ├── renderer.ts      天空／背景／地面／告示板合成、小地圖
│   └── audio.ts         引擎聲與音效（共用 shared/synthAudio）
├── components/          選單、HUD、結算、觸控操作
└── App.tsx              畫面切換與 requestAnimationFrame 主迴圈
```

賽道由 `data/tracks.ts` 的極座標諧波參數生成，因此保證是不自交的封閉迴圈，調整 `harmonics` 即可產生新賽道。

## 美術素材

- 賽車、人偶、道具、路邊物件、賽道貼圖：**全部程式即時生成**，無外部圖檔。
- `public/title-logo.svg`：選單標題，以 Gemini（`gemini-3.1-flash-lite`）產生 SVG 後修正並納入版控。**遊戲執行時不需要任何 API 金鑰。**

# 海灣帆航 (Sailing)

開闊海面的 3D 帆船繞標遊戲，規格見 [04-sports-arcade/sailing.md](../../04-sports-arcade/sailing.md)。

WebGL2 即時渲染 Gerstner 海浪、天空、單桅快艇與橙白浮標。帆推力依相對風簡化氣動力模型計算，需避開頂風區並依序繞標完賽。

## 執行

```bash
npm install
npm run dev
```

或從專案根目錄：

```bash
npm run build:game Sailing
```

## 操作

| 動作 | 鍵盤 | 觸控 |
|------|------|------|
| 轉舵 | `←` `→` / `A` `D` | 左下 |
| 收帆／放帆 | `Q` / `E` | 右下 |
| 自動調帆 | `T` | HUD 按鈕 |
| 環顧 | 拖曳畫面 | 拖曳畫面 |
| 重開 | `R` | HUD 按鈕 |

## 程式結構

```
src/
├── main.js           主迴圈、HUD、賽程狀態
├── sailing.js        相對風、升力／阻力、操舵與傾側
├── boat.js           程序化船体／帆幾何
├── ocean.js          海面網格與泡沫尾流
├── sky.js / solid.js 天空與著色物體
├── marks.js          繞標浮標與航線
├── camera.js         追蹤鏡頭
├── input.js          鍵盤／觸控
├── shaderChunks.js   共用 Gerstner／天空 GLSL
├── gl.js / math.js   WebGL 與矩陣工具
public/textures/      甲板、帆布、天空、漣漪貼圖
```

## 美術素材

- 船体與浮標：程序化網格；浮標配色參考 Gemini／imagegen 產生的概念圖。
- `public/textures/*`：甲板、帆布、天空、漣漪（imagegen）。
- `public/title-logo.svg`：選單圖示，以 Gemini（`gemini-3.1-flash-lite`）產生後微調。**遊戲執行時不需要 API 金鑰。**

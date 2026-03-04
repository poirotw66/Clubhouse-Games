# Android 上架 - 下一步執行清單

## ✅ 已完成
- [x] 安裝 Capacitor
- [x] 添加 Android 平台
- [x] 打開 Android Studio

## 📋 接下來要做的步驟

### 步驟 1：在 Android Studio 中同步專案

1. **等待 Gradle 同步完成**
   - Android Studio 會自動開始同步
   - 查看底部狀態欄，等待 "Gradle sync finished" 訊息
   - 如果出現錯誤，點擊 "Sync Now" 或 "Try Again"

2. **檢查是否有錯誤**
   - 查看 "Build" 視窗底部的訊息
   - 如果有紅色錯誤，先解決它們

### 步驟 2：配置應用資訊

需要更新以下配置：

#### 2.1 更新 Capacitor 配置

編輯 `capacitor.config.ts`：

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourcompany.mysteryliquidsort',  // 改成你的唯一應用 ID
  appName: 'Mystery Liquid Sort',              // 改成顯示名稱
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
```

**重要**：`appId` 必須是唯一的，格式：`com.你的名字或公司.mysteryliquidsort`
例如：`com.john.mysteryliquidsort` 或 `com.mygamecompany.mysteryliquidsort`

#### 2.2 同步配置到 Android

```bash
npm run build
npx cap sync
```

#### 2.3 在 Android Studio 中檢查配置

打開 `android/app/build.gradle`，確認：
- `applicationId` 已更新（與 `capacitor.config.ts` 中的 `appId` 一致）
- `versionCode` 為 1
- `versionName` 為 "1.0.0"

### 步驟 3：測試構建

#### 3.1 連接設備或啟動模擬器

**選項 A：使用實體 Android 設備**
1. 在設備上啟用開發者選項：
   - 設置 > 關於手機 > 連續點擊「版本號」7 次
2. 啟用 USB 調試：
   - 設置 > 系統 > 開發者選項 > USB 調試
3. 用 USB 連接設備到電腦
4. 在 Android Studio 中，點擊設備選擇器，選擇你的設備

**選項 B：使用模擬器**
1. 在 Android Studio 中：`Tools > Device Manager`
2. 點擊 "Create Device"
3. 選擇設備（建議 Pixel 5）
4. 選擇系統映像（建議 API 33 或更高）
5. 完成創建並啟動模擬器

#### 3.2 運行應用

1. 在 Android Studio 中選擇目標設備（實體設備或模擬器）
2. 點擊綠色「運行」按鈕（▶️）或按 `Shift + F10`
3. 等待構建和安裝完成
4. 應用應該會在設備上啟動

#### 3.3 測試功能

檢查以下功能是否正常：
- [ ] 應用正常啟動
- [ ] 主畫面顯示正常
- [ ] 可以開始遊戲
- [ ] 觸控操作流暢（點擊瓶子）
- [ ] 音效正常
- [ ] 設定功能正常
- [ ] 數據保存正常（關卡進度、金幣）

### 步驟 4：準備上架素材

在等待測試的同時，可以開始準備上架所需的素材：

#### 4.1 應用圖標

需要準備以下尺寸的 PNG 圖標（透明背景）：
- [ ] 48x48 px
- [ ] 72x72 px
- [ ] 96x96 px
- [ ] 144x144 px
- [ ] 192x192 px
- [ ] **512x512 px**（Google Play 必需）

**工具建議**：
- 使用 Figma、Sketch 或 Photoshop 設計
- 或使用在線工具：https://www.appicon.co/

#### 4.2 啟動畫面（Splash Screen）

- [ ] 尺寸：1080x1920 px（9:16）
- [ ] 顯示應用 Logo 和品牌色
- [ ] 格式：PNG

#### 4.3 功能圖標（Feature Graphic）

- [ ] 尺寸：1024x500 px
- [ ] 用於 Google Play 商店展示
- [ ] 格式：PNG 或 JPG

#### 4.4 應用截圖

準備至少 4-8 張截圖：
- [ ] 主畫面
- [ ] 遊戲進行中
- [ ] 完成關卡畫面
- [ ] 每日任務畫面
- [ ] 設定畫面

**截圖要求**：
- 尺寸：16:9 或 9:16 比例
- 寬度至少 320px
- 格式：PNG 或 JPG
- 無邊框

**如何截圖**：
- 在 Android 設備上運行應用
- 使用設備的截圖功能
- 或使用 Android Studio 的截圖工具

#### 4.5 應用描述

準備以下文字內容：

**簡短描述**（80 字元）：
```
益智液體排序遊戲，挑戰你的邏輯思維！完成訂單，解鎖關卡。
```

**完整描述**（4000 字元）：
```
Mystery Liquid Sort 是一款創新的益智遊戲，結合了液體排序機制和隱藏層挑戰。

🎮 遊戲特色：
• 冒險模式：漸進式關卡，難度逐步提升
• 快速遊戲：選擇適合你的難度等級（簡單/中等/困難/專家）
• 每日任務：完成任務獲得金幣獎勵
• 道具系統：使用撤銷、洗牌、添加空瓶、揭示隱藏層等道具
• 多語言支援：繁體中文和英文

🎯 玩法說明：
將不同顏色的液體倒入瓶子中，完成單色瓶子後交付訂單。但要小心隱藏的液體層（顯示為 ?），它們會增加遊戲難度！

💡 遊戲技巧：
- 仔細規劃每一步
- 利用空瓶作為臨時存儲
- 使用道具幫助你完成挑戰
- 完成每日任務獲得更多金幣

立即下載，開始你的液體排序之旅！
```

### 步驟 5：配置應用簽名（準備上架時）

當應用測試無誤後，需要配置簽名以構建發布版本。這一步在 `ANDROID_SETUP.md` 的步驟 9 中有詳細說明。

---

## 🎯 當前優先任務

**立即執行**：
1. ✅ 在 Android Studio 中等待 Gradle 同步完成
2. ✅ 更新 `capacitor.config.ts` 中的應用 ID 和名稱
3. ✅ 運行 `npm run build && npx cap sync`
4. ✅ 連接設備或啟動模擬器
5. ✅ 運行應用並測試功能

**同時進行**：
- 開始準備應用圖標和截圖素材

---

## ❓ 遇到問題？

### Gradle 同步失敗？
- 檢查網路連接（需要下載依賴）
- 在 Android Studio：`File > Invalidate Caches / Restart`
- 檢查 `android/build.gradle` 中的 Gradle 版本

### 應用無法運行？
- 檢查設備是否正確連接（`adb devices`）
- 查看 Logcat 中的錯誤訊息
- 確認 `npm run build` 成功完成

### 需要更多幫助？
查看 `ANDROID_SETUP.md` 和 `TROUBLESHOOTING.md` 獲取詳細說明。

---

**下一步**：完成步驟 1-3 後，告訴我測試結果，我們繼續配置簽名和準備上架！

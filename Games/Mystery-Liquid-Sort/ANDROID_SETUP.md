# Android 上架執行步驟

本文件提供將 Mystery Liquid Sort 上架到 Google Play Store 的完整執行步驟。

## 前置準備

### 1. 開發環境檢查

確保已安裝以下工具：

- [ ] **Node.js** (LTS 版本，建議 18+)
  ```bash
  node --version
  ```

- [ ] **Java JDK** (JDK 17 或更高版本)
  ```bash
  java -version
  ```
  如果未安裝，下載：https://www.oracle.com/java/technologies/downloads/

- [ ] **Android Studio**
  - 下載：https://developer.android.com/studio
  - 安裝時選擇：
    - Android SDK
    - Android SDK Platform
    - Android Virtual Device (AVD)

- [ ] **Android SDK**
  - 在 Android Studio 中：`Tools > SDK Manager`
  - 安裝 Android 13 (API 33) 或更高版本
  - 安裝 Android SDK Build-Tools

- [ ] **環境變數設置**
  ```bash
  # 添加到 ~/.zshrc 或 ~/.bash_profile
  export ANDROID_HOME=$HOME/Library/Android/sdk  # macOS
  # export ANDROID_HOME=$HOME/Android/Sdk        # Linux
  export PATH=$PATH:$ANDROID_HOME/emulator
  export PATH=$PATH:$ANDROID_HOME/platform-tools
  export PATH=$PATH:$ANDROID_HOME/tools
  export PATH=$PATH:$ANDROID_HOME/tools/bin
  ```

### 2. Google Play Console 帳號

- [ ] 註冊 Google Play Console 開發者帳號
  - 網址：https://play.google.com/console/signup
  - 費用：$25 USD（一次性）
  - 需要 Google 帳號和付款方式

---

## 步驟 1：安裝 Capacitor

### 1.1 安裝 Capacitor 核心套件

```bash
cd /Users/cfh00896102/Github/Mystery-Liquid-Sort
npm install @capacitor/cli @capacitor/core
```

### 1.2 安裝 Android 平台支援

```bash
npm install @capacitor/android
```

---

## 步驟 2：初始化 Capacitor

### 2.1 初始化 Capacitor 配置

```bash
npx cap init
```

按照提示輸入：
- **App name**: `Mystery Liquid Sort`
- **App ID**: `com.yourcompany.mysteryliquidsort` (替換 yourcompany 為你的公司/個人名稱)
- **Web dir**: `dist`

這會創建 `capacitor.config.ts` 文件。

### 2.2 檢查生成的配置

確認 `capacitor.config.ts` 內容類似：

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.yourcompany.mysteryliquidsort',
  appName: 'Mystery Liquid Sort',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
```

---

## 步驟 3：配置 Vite

### 3.1 更新 vite.config.ts

確保構建輸出目錄為 `dist`，並設置正確的 base URL：

```typescript
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        outDir: 'dist',
        assetsDir: 'assets',
        // 確保資源路徑正確
        base: './'
      }
    };
});
```

---

## 步驟 4：構建 Web 應用

### 4.1 構建生產版本

```bash
npm run build
```

確認 `dist/` 目錄已生成，包含所有構建文件。

### 4.2 預覽構建結果（可選）

```bash
npm run preview
```

在瀏覽器中檢查應用是否正常運行。

---

## 步驟 5：添加 Android 平台

### 5.1 添加 Android 平台到專案

```bash
npx cap add android
```

這會創建 `android/` 目錄，包含完整的 Android 專案。

### 5.2 同步 Web 資源到 Android

```bash
npx cap sync
```

這個命令會：
- 將 `dist/` 中的文件複製到 Android 專案
- 更新原生依賴

---

## 步驟 6：配置 Android 專案

### 6.1 打開 Android Studio

```bash
npx cap open android
```

或在 Android Studio 中：`File > Open` > 選擇 `android/` 目錄

### 6.2 配置應用資訊

編輯 `android/app/build.gradle`：

```gradle
android {
    namespace "com.yourcompany.mysteryliquidsort"
    compileSdkVersion 34  // 使用最新版本
    
    defaultConfig {
        applicationId "com.yourcompany.mysteryliquidsort"
        minSdkVersion 22  // Android 5.1+
        targetSdkVersion 34  // Android 13+
        versionCode 1  // 每次上傳遞增
        versionName "1.0.0"  // 用戶可見版本
    }
    
    buildTypes {
        release {
            minifyEnabled false
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 6.3 配置應用名稱和圖標（暫時使用預設）

- 應用名稱在 `android/app/src/main/res/values/strings.xml`
- 圖標在 `android/app/src/main/res/mipmap-*/`

---

## 步驟 7：本地測試

### 7.1 連接 Android 設備或啟動模擬器

**使用實體設備：**
1. 啟用開發者選項和 USB 調試
2. 連接設備到電腦
3. 確認設備被識別：`adb devices`

**使用模擬器：**
1. 在 Android Studio 中：`Tools > Device Manager`
2. 創建新的虛擬設備（建議使用 Pixel 5 或類似）
3. 啟動模擬器

### 7.2 運行應用

在 Android Studio 中：
1. 選擇目標設備
2. 點擊運行按鈕（綠色播放圖標）
3. 或使用命令：`npx cap run android`

### 7.3 測試功能

- [ ] 應用正常啟動
- [ ] 遊戲功能正常
- [ ] 觸控操作流暢
- [ ] 音效正常
- [ ] 設定功能正常
- [ ] 數據保存正常

---

## 步驟 8：準備上架素材

### 8.1 應用圖標

需要多種尺寸的 PNG 圖標（透明背景）：
- 48x48 px
- 72x72 px
- 96x96 px
- 144x144 px
- 192x192 px
- 512x512 px（用於 Google Play）

**工具建議：**
- Figma / Sketch（設計）
- ImageMagick（批量生成尺寸）
- 或使用在線工具：https://www.appicon.co/

### 8.2 啟動畫面（Splash Screen）

- 尺寸：1080x1920 px（9:16）
- 顯示應用 Logo 和品牌色
- 格式：PNG

### 8.3 功能圖標（Feature Graphic）

- 尺寸：1024x500 px
- 用於 Google Play 商店展示
- 格式：PNG 或 JPG

### 8.4 應用截圖

準備至少 4-8 張截圖：
- 尺寸：16:9 或 9:16 比例
- 寬度至少 320px
- 格式：PNG 或 JPG
- 無邊框

**截圖建議：**
1. 主畫面
2. 遊戲進行中
3. 完成關卡畫面
4. 每日任務畫面
5. 設定畫面

### 8.5 應用描述

**簡短描述**（80 字元）：
```
益智液體排序遊戲，挑戰你的邏輯思維！完成訂單，解鎖關卡。
```

**完整描述**（4000 字元）：
```
Mystery Liquid Sort 是一款創新的益智遊戲，結合了液體排序機制和隱藏層挑戰。

遊戲特色：
• 冒險模式：漸進式關卡，難度逐步提升
• 快速遊戲：選擇適合你的難度等級
• 每日任務：完成任務獲得金幣獎勵
• 道具系統：使用道具幫助你完成挑戰
• 多語言支援：繁體中文和英文

玩法簡單但充滿挑戰：將不同顏色的液體倒入瓶子中，完成單色瓶子後交付訂單。但要小心隱藏的液體層，它們會增加遊戲難度！

立即下載，開始你的液體排序之旅！
```

---

## 步驟 9：創建應用簽名

### 9.1 生成 Keystore

**重要：妥善保管 keystore 文件和密碼！遺失後無法更新應用。**

```bash
cd android/app
keytool -genkey -v -keystore mystery-liquid-sort-release.keystore -alias mystery-liquid-sort -keyalg RSA -keysize 2048 -validity 10000
```

按照提示輸入：
- Keystore 密碼（記住這個密碼！）
- 姓名、組織單位、組織名稱等資訊
- Key 密碼（可以與 keystore 密碼相同）

### 9.2 配置簽名

創建 `android/key.properties`：

```properties
storePassword=你的keystore密碼
keyPassword=你的key密碼
keyAlias=mystery-liquid-sort
storeFile=app/mystery-liquid-sort-release.keystore
```

### 9.3 更新 build.gradle

在 `android/app/build.gradle` 開頭添加：

```gradle
def keystorePropertiesFile = rootProject.file("key.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}
```

在 `android` 區塊中添加：

```gradle
signingConfigs {
    release {
        if (keystorePropertiesFile.exists()) {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
        }
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

### 9.4 將 key.properties 添加到 .gitignore

```bash
echo "android/key.properties" >> .gitignore
echo "android/app/*.keystore" >> .gitignore
```

---

## 步驟 10：構建發布版本

### 10.1 構建 AAB（Android App Bundle）

在 Android Studio 中：
1. `Build > Generate Signed Bundle / APK`
2. 選擇 "Android App Bundle"
3. 選擇 release keystore
4. 輸入密碼
5. 選擇 release 構建類型
6. 點擊 "Finish"

或使用命令：

```bash
cd android
./gradlew bundleRelease
```

生成的 AAB 文件位於：`android/app/build/outputs/bundle/release/app-release.aab`

### 10.2 驗證 AAB（可選）

```bash
bundletool build-apks --bundle=app-release.aab --output=app.apks --ks=app/mystery-liquid-sort-release.keystore --ks-key-alias=mystery-liquid-sort
```

---

## 步驟 11：上傳到 Google Play Console

### 11.1 創建應用

1. 登入 [Google Play Console](https://play.google.com/console)
2. 點擊 "創建應用"
3. 選擇預設語言：繁體中文
4. 輸入應用名稱：`Mystery Liquid Sort`
5. 選擇應用類型：應用
6. 選擇免費或付費（建議先選擇免費）
7. 填寫聲明（內容分級、目標受眾等）

### 11.2 填寫商店資訊

在 "商店設定" 中填寫：
- [ ] 應用名稱
- [ ] 簡短描述（80 字元）
- [ ] 完整描述（4000 字元）
- [ ] 應用圖標（512x512）
- [ ] 功能圖標（1024x500）
- [ ] 應用截圖（至少 2 張）
- [ ] 隱私政策 URL（必須！）

### 11.3 上傳應用

1. 進入 "發布 > 生產環境"
2. 創建新的發布版本
3. 上傳 AAB 文件（`app-release.aab`）
4. 填寫版本說明
5. 點擊 "審核發布"

### 11.4 完成內容分級問卷

回答關於應用內容的問題，系統會自動生成分級。

### 11.5 提交審核

檢查所有必填項目後，點擊 "提交審核"。

審核時間通常為 1-3 天。

---

## 步驟 12：後續維護

### 12.1 監控應用狀態

- 在 Play Console 中查看審核狀態
- 監控崩潰報告和用戶反饋
- 查看下載量和評分

### 12.2 更新應用

當需要更新時：
1. 修改代碼
2. 更新 `versionCode`（遞增）和 `versionName`
3. 重新構建：`npm run build && npx cap sync`
4. 構建新的 AAB
5. 在 Play Console 中上傳新版本

---

## 常見問題

### Q: 構建時出現錯誤？
A: 檢查：
- Android SDK 是否正確安裝
- `ANDROID_HOME` 環境變數是否設置
- Gradle 版本是否兼容

### Q: 應用在設備上無法運行？
A: 檢查：
- 設備是否啟用 USB 調試
- 是否安裝了正確的驅動程式
- 查看 Logcat 錯誤訊息

### Q: 上傳 AAB 時出現錯誤？
A: 檢查：
- AAB 是否正確簽名
- 版本號是否遞增
- 是否填寫了所有必填資訊

### Q: 審核被拒絕？
A: 常見原因：
- 缺少隱私政策
- 內容分級不正確
- 應用名稱或描述違規
- 應用崩潰或無法運行

---

## 檢查清單

在提交審核前，確認：

- [ ] 應用在實體設備上測試通過
- [ ] 所有功能正常運作
- [ ] 應用圖標和啟動畫面已設置
- [ ] 商店素材已準備完成
- [ ] 隱私政策 URL 已提供
- [ ] 應用已正確簽名
- [ ] AAB 文件已構建
- [ ] 所有必填資訊已填寫
- [ ] 內容分級問卷已完成

---

## 參考資源

- [Capacitor Android 文檔](https://capacitorjs.com/docs/android)
- [Google Play Console 幫助](https://support.google.com/googleplay/android-developer)
- [Android 應用簽名指南](https://developer.android.com/studio/publish/app-signing)
- [AAB 格式說明](https://developer.android.com/guide/app-bundle)

---

祝上架順利！🎉

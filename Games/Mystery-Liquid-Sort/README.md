# Mystery Liquid Sort

A puzzle game where you sort colored liquids into bottles. Complete customer orders by filling bottles with a single color, then deliver them. Supports hidden layers, daily missions, and power-ups.

## Features

- **Adventure mode**: Progressive levels with increasing difficulty (more colors, hidden layers).
- **Quick play**: Choose difficulty (Easy / Medium / Hard / Expert) for a single run.
- **Daily missions**: Complete tasks (e.g. pour liquid, win levels, use items) to earn coins.
- **Power-ups**: Undo, shuffle, add empty bottle, reveal hidden layers (cost coins).
- **Settings**: Sound on/off, language (繁體中文 / English).

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
3. Open the URL shown in the terminal (e.g. `http://localhost:5173`).

## Build and deploy

- Build for production:
  ```bash
  npm run build
  ```
- Preview the production build locally:
  ```bash
  npm run preview
  ```

Output is in `dist/`. Deploy the contents of `dist/` to any static host (e.g. Vercel, Netlify, GitHub Pages). The app uses hash routing (`#/`, `#/game`), so configure the host to serve `index.html` for all routes if needed.

## Tech stack

- React 18, TypeScript, Vite
- React Router (HashRouter)
- Tailwind CSS (via class names in JSX)
- Lucide React (icons)
- 計劃支援：Capacitor（移動端打包）

## 移動端開發

### 上架策略

**核心策略：優先上架 Android 版本**

- 先專注於 Android 平台開發和上架（開發者帳號費用：$25 一次性）
- 等待 Android 版本有穩定收益後，再考慮 iOS 上架（開發者帳號費用：$99/年）
- 此策略可以降低初期成本，並透過市場驗證後再投入 iOS 開發

### 使用 Capacitor 打包

本專案使用 [Capacitor](https://capacitorjs.com/) 將 Web 應用打包為原生 Android 應用。Capacitor 是 Ionic 團隊開發的跨平台框架，與 Vite 整合良好，可以重用現有的 Web 代碼。

#### 安裝和初始化

1. 安裝 Capacitor CLI：
   ```bash
   npm install @capacitor/cli @capacitor/core
   ```

2. 初始化 Capacitor：
   ```bash
   npx cap init
   ```
   按照提示輸入應用名稱、Bundle ID 等資訊。

3. 添加 Android 平台支援：
   ```bash
   # Android（優先開發）
   npm install @capacitor/android
   npx cap add android

   # iOS（後續計劃，待 Android 有收益後再考慮）
   # npm install @capacitor/ios
   # npx cap add ios
   ```

4. 配置 `vite.config.ts`：
   確保構建輸出目錄為 `dist`，並設置正確的 base URL。

5. 構建 Web 應用：
   ```bash
   npm run build
   ```

6. 同步到原生專案：
   ```bash
   npx cap sync
   ```

#### 本地測試

- **Android**: 使用 Android Studio 打開 `android/` 目錄，連接設備或啟動模擬器後運行

#### 基本配置

在 `capacitor.config.ts` 中配置：
- 應用 ID（Package Name，例如：`com.yourcompany.mysteryliquidsort`）
- 應用名稱
- Web 資源目錄（`dist`）
- 伺服器 URL（開發時可指向本地伺服器）

## 上架準備

### 上架策略

**核心策略：先上架 Android，有收益後再考慮 iOS**

1. **第一階段：Android 上架**（優先執行）
   - 開發者帳號費用：$25 一次性費用
   - 市場佔有率高，用戶基數大
   - 先驗證市場反應和用戶反饋
   - 透過 Google Play 獲得收入

2. **第二階段：iOS 上架**（待 Android 有收益後）
   - 開發者帳號費用：$99/年
   - 當 Android 版本有穩定收入時再考慮
   - iOS 用戶通常付費意願較高，可考慮付費下載模式

### Android (Google Play) - 優先開發

#### 開發者帳號和工具

- [ ] **Google Play Console 開發者帳號**
  - 一次性註冊費用：$25 USD
  - 註冊地址：https://play.google.com/console/signup
  - 需要 Google 帳號和付款方式

- [ ] **Android Studio**
  - 下載：https://developer.android.com/studio
  - 用於構建 APK/AAB、應用簽名、測試
  - 需要安裝 Android SDK

#### 應用資源

- [ ] **應用圖標**
  - 需要多種尺寸：48x48, 72x72, 96x96, 144x144, 192x192, 512x512 px
  - 格式：PNG（透明背景）
  - 建議使用設計工具生成所有尺寸

- [ ] **啟動畫面/閃屏（Splash Screen）**
  - 建議尺寸：1080x1920 px（9:16）
  - 顯示應用 Logo 和品牌色

- [ ] **功能圖標（Feature Graphic）**
  - 尺寸：1024x500 px
  - 用於 Google Play 商店展示
  - 格式：PNG 或 JPG

#### 商店素材

- [ ] **應用名稱**
  - 最大長度：50 字元
  - 簡短描述：80 字元

- [ ] **完整描述**
  - 最大長度：4000 字元
  - 包含遊戲特色、玩法說明、系統需求

- [ ] **應用截圖**
  - 至少 2 張，建議 4-8 張
  - 手機截圖：16:9 或 9:16 比例，至少 320px 寬
  - 平板截圖：7 吋和 10 吋（可選但建議）
  - 格式：PNG 或 JPG，無邊框

- [ ] **宣傳影片**（可選）
  - YouTube 連結
  - 展示遊戲玩法

- [ ] **隱私政策 URL**（必須）
  - 必須提供可公開訪問的隱私政策頁面
  - 說明數據收集和使用情況

#### 技術要求

- [ ] **應用簽名**
  - 生成 keystore 文件用於簽名
  - 妥善保管 keystore 和密碼（遺失無法更新應用）

- [ ] **目標 API 級別**
  - 建議：Android 13 (API 33) 或更高
  - 在 `android/app/build.gradle` 中配置

- [ ] **權限聲明**
  - 在 `AndroidManifest.xml` 中聲明所需權限
  - 如果使用原生功能（相機、位置等），需要說明用途

- [ ] **內容分級**
  - 選擇適合的年齡分級（PEGI/ESRB）
  - 本遊戲建議：適合所有年齡（4+）

- [ ] **構建 AAB 格式**
  - Google Play 要求使用 AAB（Android App Bundle）格式上傳
  - 在 Android Studio 中構建：`Build > Generate Signed Bundle / APK`

### iOS (App Store) - 後續計劃

> **注意**：iOS 上架計劃在 Android 版本有穩定收益後再執行。目前先專注於 Android 開發。

#### 開發者帳號和工具

- [ ] **Apple Developer Program 帳號**（待 Android 有收益後）
  - 年費：$99 USD
  - 註冊地址：https://developer.apple.com/programs/
  - 需要 Apple ID 和付款方式
  - 審核時間：通常 24-48 小時
  
  **💡 執行時機：**
  - 等待 Android 版本有穩定收入後再考慮
  - 如果遊戲受歡迎，$99 的年費通常可以透過應用內購買或廣告收入回收
  - 可以先使用 TestFlight 進行 Beta 測試（需要開發者帳號）

- [ ] **Xcode**（僅 macOS）
  - 從 Mac App Store 下載
  - 最新版本（建議 Xcode 15+）
  - 包含 iOS SDK 和模擬器

- [ ] **CocoaPods**（依賴管理）
  ```bash
  sudo gem install cocoapods
  ```

#### 應用資源

- [ ] **應用圖標**
  - 尺寸：1024x1024 px
  - 格式：PNG，無圓角（系統會自動處理）
  - 無透明背景
  - 其他尺寸由 Xcode 自動生成

- [ ] **啟動畫面（Launch Screen）**
  - 使用 Xcode 的 Launch Screen 編輯器
  - 或提供圖片資源
  - 建議與應用主題一致

#### 商店素材

- [ ] **應用名稱**
  - 最大長度：30 字元
  - 在 App Store Connect 中設置

- [ ] **副標題**
  - 最大長度：30 字元
  - 簡短描述遊戲特色

- [ ] **描述**
  - 最大長度：4000 字元
  - 前 3 行最重要（預覽時顯示）

- [ ] **關鍵字**
  - 最大長度：100 字元
  - 用逗號分隔，影響搜索排名

- [ ] **應用截圖**
  - iPhone 截圖：
    - 6.7" 顯示器（iPhone 14 Pro Max）：1290x2796 px
    - 6.5" 顯示器（iPhone 11 Pro Max）：1242x2688 px
    - 5.5" 顯示器（iPhone 8 Plus）：1242x2208 px
  - iPad Pro 截圖（可選）：
    - 12.9"：2048x2732 px
    - 11"：1668x2388 px
  - 至少需要 1 組，建議提供多組

- [ ] **App 預覽影片**（可選）
  - 15-30 秒影片
  - 展示遊戲玩法
  - 可提升轉換率

- [ ] **隱私政策 URL**（必須）
  - 必須提供可公開訪問的隱私政策頁面
  - 如果收集用戶數據，需要詳細說明

- [ ] **支援 URL**（可選）
  - 提供用戶支援頁面或聯繫方式

#### 技術要求

- [ ] **Bundle ID**
  - 唯一標識符，格式：`com.yourcompany.appname`
  - 在 Apple Developer 和 Xcode 中設置
  - 一旦發布無法更改

- [ ] **版本號和構建號**
  - 版本號：用戶可見（如 1.0.0）
  - 構建號：每次上傳遞增（如 1, 2, 3...）

- [ ] **權限使用說明**
  - 如果使用相機、位置、通知等權限
  - 需要在 App Store Connect 中說明用途
  - 在 `Info.plist` 中添加使用說明

- [ ] **內容分級**
  - 選擇適合的年齡分級
  - 本遊戲建議：4+（適合所有年齡）

- [ ] **構建 IPA**
  - 使用 Xcode Archive 功能
  - 選擇 "App Store Connect" 分發方式
  - 上傳到 App Store Connect

### 通用準備事項

#### 應用商店優化（ASO）

- [ ] **關鍵字研究**
  - 研究競爭對手的關鍵字
  - 在應用名稱、副標題、描述中使用相關關鍵字
  - 避免關鍵字堆砌

- [ ] **視覺素材優化**
  - 截圖要能清楚展示遊戲玩法
  - 使用吸引人的設計和配色
  - 考慮添加文字說明在截圖上

- [ ] **本地化考慮**
  - 目前支援：繁體中文、English
  - 考慮添加更多語言以擴大市場
  - 翻譯應用描述和商店素材

#### 測試計劃

- [ ] **內部測試**
  - 開發團隊內部測試
  - 檢查所有功能是否正常

- [ ] **封閉測試（Beta）**
  - Google Play：內部測試軌道或封閉測試軌道（優先執行）
  - iOS：TestFlight（待 Android 有收益後再考慮）
  - 邀請少量用戶測試並收集反饋

- [ ] **公開測試**（可選）
  - Google Play：公開測試軌道
  - 在正式發布前收集更多反饋

#### 定價策略

- [ ] **免費 vs 付費**
  - 建議：免費下載 + 應用內購買（IAP）
  - 或：一次性付費
  - 考慮：訂閱模式（如果適用）

- [ ] **應用內購買**（如果選擇免費模式）
  - 考慮：移除廣告、額外關卡、特殊道具
  - 需要整合支付系統（Google Play Billing / StoreKit）

#### 法律和合規

- [ ] **隱私政策**
  - 必須提供詳細的隱私政策
  - 說明數據收集、使用、存儲方式
  - 如果使用第三方服務（分析、廣告），需要說明

- [ ] **用戶協議**（可選但建議）
  - 明確用戶權利和責任
  - 說明應用使用條款

- [ ] **版權聲明**
  - 確保所有素材（圖標、音效、圖片）有使用權限
  - 避免使用受版權保護的內容

#### 發布時間表

建議的發布流程：

1. **準備階段**（1-2 週）
   - 準備所有商店素材
   - 編寫應用描述
   - 準備隱私政策

2. **測試階段**（1-2 週）
   - 內部測試
   - Beta 測試
   - 修復發現的問題

3. **提交審核**（1-3 天）
   - Google Play：通常 1-3 天
   - App Store：通常 1-2 天（可能更長）

4. **發布**
   - 選擇發布時間（考慮時區）
   - 監控下載和評分
   - 及時回應用戶反饋

## 參考資源

### Capacitor 相關

- [Capacitor 官方文檔](https://capacitorjs.com/docs)
- [Capacitor GitHub](https://github.com/ionic-team/capacitor)
- [Vite + Capacitor 整合指南](https://capacitorjs.com/docs/getting-started)

### Android 上架

- [Google Play Console](https://play.google.com/console)
- [Google Play 政策中心](https://play.google.com/about/developer-content-policy/)
- [Android 應用簽名指南](https://developer.android.com/studio/publish/app-signing)
- [AAB 格式說明](https://developer.android.com/guide/app-bundle)

### iOS 上架（後續計劃）

> 待 Android 版本有收益後再參考以下資源

- [App Store Connect](https://appstoreconnect.apple.com)
- [App Store 審核指南](https://developer.apple.com/app-store/review/guidelines/)
- [TestFlight Beta 測試](https://developer.apple.com/testflight/)
- [Xcode 文檔](https://developer.apple.com/documentation/xcode)

### 設計資源

- [Material Design 圖標](https://fonts.google.com/icons)（Android）
- [SF Symbols](https://developer.apple.com/sf-symbols/)（iOS）
- [App Store 截圖模板](https://www.figma.com/community/templates/app-store-screenshots)

### ASO 工具

- [App Annie](https://www.data.ai/)（應用分析）
- [Sensor Tower](https://sensortower.com/)（市場分析）
- [App Store Optimization 指南](https://www.apptweak.com/en/blog/app-store-optimization-guide)

## License

Private / unlicensed unless stated otherwise.

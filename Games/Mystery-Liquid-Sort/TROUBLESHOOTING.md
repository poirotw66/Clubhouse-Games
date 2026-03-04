# 疑難排解指南

## Android Studio 無法找到

### 問題
執行 `npx cap open android` 時出現錯誤：
```
[error] Unable to launch Android Studio. Is it installed?
```

### 解決方案

#### 方案 1：安裝 Android Studio（推薦）

如果尚未安裝 Android Studio：

1. **下載 Android Studio**
   - 網址：https://developer.android.com/studio
   - 選擇 macOS 版本下載

2. **安裝步驟**
   - 下載後打開 `.dmg` 文件
   - 將 Android Studio 拖到 Applications 資料夾
   - 首次啟動時，按照設置精靈完成安裝
   - **重要**：安裝時選擇以下組件：
     - Android SDK
     - Android SDK Platform
     - Android Virtual Device (AVD)
     - Performance (Intel HAXM) - 如果使用 Intel Mac

3. **設置環境變數**
   
   打開終端，編輯 `~/.zshrc`：
   ```bash
   nano ~/.zshrc
   ```
   
   添加以下內容：
   ```bash
   # Android SDK
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/emulator
   export PATH=$PATH:$ANDROID_HOME/platform-tools
   export PATH=$PATH:$ANDROID_HOME/tools
   export PATH=$PATH:$ANDROID_HOME/tools/bin
   
   # Android Studio (可選，用於 cap open 命令)
   export CAPACITOR_ANDROID_STUDIO_PATH="/Applications/Android Studio.app"
   ```
   
   保存後重新載入：
   ```bash
   source ~/.zshrc
   ```

4. **驗證安裝**
   ```bash
   # 檢查 Android SDK
   echo $ANDROID_HOME
   
   # 檢查 adb
   adb version
   ```

5. **重新嘗試**
   ```bash
   npx cap open android
   ```

#### 方案 2：手動打開 Android 專案

如果 Android Studio 已安裝但路徑不同，或暫時不想配置：

1. **手動打開 Android Studio**
   - 啟動 Android Studio
   - 選擇 `File > Open`
   - 導航到專案目錄：`/Users/cfh00896102/Github/Mystery-Liquid-Sort/android`
   - 點擊 "Open"

2. **配置 Android Studio 路徑（可選）**
   
   如果 Android Studio 安裝在其他位置，設置環境變數：
   ```bash
   # 找到 Android Studio 的實際位置
   find /Applications -name "Android Studio.app" -type d
   
   # 設置環境變數（替換為實際路徑）
   export CAPACITOR_ANDROID_STUDIO_PATH="/實際/路徑/Android Studio.app"
   
   # 或添加到 ~/.zshrc 使其永久生效
   echo 'export CAPACITOR_ANDROID_STUDIO_PATH="/實際/路徑/Android Studio.app"' >> ~/.zshrc
   source ~/.zshrc
   ```

#### 方案 3：使用命令行構建（進階）

如果只需要構建而不需要 IDE：

1. **確保已安裝 Android SDK**
   ```bash
   # 檢查 SDK 是否存在
   ls ~/Library/Android/sdk
   ```

2. **設置環境變數**（見方案 1）

3. **使用 Gradle 構建**
   ```bash
   cd android
   ./gradlew assembleDebug  # 構建 Debug 版本
   ./gradlew bundleRelease  # 構建 Release AAB（需要簽名配置）
   ```

### 檢查清單

在繼續之前，確認：

- [ ] Android Studio 已安裝
- [ ] Android SDK 已安裝（API 33 或更高）
- [ ] 環境變數 `ANDROID_HOME` 已設置
- [ ] `adb` 命令可用（`adb version`）
- [ ] 可以手動打開 Android 專案

### 其他常見問題

#### Q: Android Studio 啟動很慢？
A: 首次啟動需要下載組件，請耐心等待。也可以增加記憶體分配：
- `Help > Edit Custom VM Options`
- 增加 `-Xmx` 值（例如：`-Xmx4096m`）

#### Q: 找不到 Android SDK？
A: 在 Android Studio 中：
- `Tools > SDK Manager`
- 確認 SDK Location 路徑
- 安裝必要的 SDK Platform 和 Build Tools

#### Q: Gradle 同步失敗？
A: 
- 檢查網路連接（Gradle 需要下載依賴）
- 在 Android Studio 中：`File > Invalidate Caches / Restart`
- 檢查 `android/build.gradle` 中的 Gradle 版本

---

需要更多幫助？請查看 [ANDROID_SETUP.md](./ANDROID_SETUP.md) 的完整指南。

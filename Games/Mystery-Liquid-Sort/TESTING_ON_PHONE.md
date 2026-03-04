# 在實體手機上測試應用

## 前置準備

### 1. 啟用開發者選項

在 Android 手機上：

1. **打開設定**
2. **關於手機**（About phone）
3. **找到「版本號碼」**（Build number）或「MIUI 版本」（小米手機）
4. **連續點擊 7 次**，直到看到「您現在是開發人員！」的提示

### 2. 啟用 USB 調試

1. 返回設定主頁
2. 找到**「系統」**或**「其他設定」**
3. 點擊**「開發人員選項」**（Developer options）
4. 開啟**「USB 調試」**（USB debugging）
5. （可選）開啟**「USB 安裝」**（USB install）或**「透過 USB 安裝應用程式」**

### 3. 連接手機到電腦

1. 使用 USB 線連接手機到電腦
2. 手機上會出現「允許 USB 調試嗎？」的提示
3. 勾選**「一律允許這部電腦」**
4. 點擊**「允許」**

## 方法 1：使用 Android Studio（推薦）

### 步驟 1：確認設備連接

1. 打開 Android Studio
2. 打開專案：`/Users/cfh00896102/Github/Mystery-Liquid-Sort/android`
3. 等待 Gradle 同步完成

### 步驟 2：檢查設備

1. 在 Android Studio 底部，點擊 **「Terminal」** 標籤
2. 執行以下命令檢查設備是否被識別：

```bash
adb devices
```

**預期輸出：**
```
List of devices attached
ABC123XYZ    device
```

如果看到 `device`，表示連接成功！

如果看到 `unauthorized`：
- 檢查手機上的 USB 調試授權提示
- 重新連接 USB 線
- 執行 `adb kill-server && adb start-server`

### 步驟 3：運行應用

1. 在 Android Studio 頂部，點擊設備選擇器（顯示 "No devices" 或設備名稱）
2. 選擇你的手機設備
3. 點擊綠色**「運行」**按鈕（▶️）或按 `Shift + F10`
4. 等待構建和安裝完成
5. 應用會自動在手機上啟動！

## 方法 2：使用命令行

### 步驟 1：構建 APK

在終端中執行：

```bash
cd /Users/cfh00896102/Github/Mystery-Liquid-Sort

# 構建 Web 應用
npm run build

# 同步到 Android
npx cap sync

# 進入 Android 目錄
cd android

# 構建 Debug APK
./gradlew assembleDebug
```

### 步驟 2：安裝到手機

```bash
# 檢查設備
adb devices

# 安裝 APK（APK 位置：android/app/build/outputs/apk/debug/app-debug.apk）
adb install app/build/outputs/apk/debug/app-debug.apk
```

### 步驟 3：運行應用

```bash
# 啟動應用
adb shell am start -n com.mysteryliquidsort.app/.MainActivity
```

## 方法 3：使用 Vite Dev Server（開發模式）

如果你想在開發時即時看到更改：

### 步驟 1：啟動開發伺服器

```bash
cd /Users/cfh00896102/Github/Mystery-Liquid-Sort

# 啟動 Vite 開發伺服器（監聽所有網路介面）
npm run dev -- --host
```

### 步驟 2：獲取電腦的 IP 地址

```bash
# macOS
ifconfig | grep "inet " | grep -v 127.0.0.1

# 或使用
ipconfig getifaddr en0
```

你會看到類似 `192.168.1.100` 的 IP 地址。

### 步驟 3：配置 Capacitor

編輯 `capacitor.config.ts`：

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mysteryliquidsort.app',
  appName: 'Mystery Liquid Sort',
  webDir: 'dist',
  server: {
    // 開發模式：指向你的電腦 IP
    url: 'http://192.168.1.100:5173', // 替換為你的 IP
    cleartext: true // 允許 HTTP（僅開發時使用）
  }
};

export default config;
```

### 步驟 4：同步並運行

```bash
npx cap sync android
npx cap run android
```

現在應用會連接到你的開發伺服器，更改會即時反映！

## 常見問題排查

### 問題 1：`adb devices` 顯示 `unauthorized`

**解決方案：**
1. 檢查手機上的 USB 調試授權提示
2. 重新連接 USB 線
3. 執行：
   ```bash
   adb kill-server
   adb start-server
   adb devices
   ```

### 問題 2：找不到設備

**解決方案：**
1. 確認 USB 調試已啟用
2. 嘗試不同的 USB 線
3. 嘗試不同的 USB 端口
4. 在手機上重新授權 USB 調試
5. 檢查 USB 連接模式（選擇「檔案傳輸」或「MTP」）

### 問題 3：安裝失敗（INSTALL_FAILED）

**解決方案：**
1. 卸載舊版本：
   ```bash
   adb uninstall com.mysteryliquidsort.app
   ```
2. 重新安裝

### 問題 4：應用崩潰

**解決方案：**
1. 查看 Logcat 錯誤：
   ```bash
   adb logcat | grep -i error
   ```
2. 或在 Android Studio 中查看 Logcat 視窗
3. 檢查是否有權限問題

### 問題 5：WiFi 連接開發伺服器失敗

**解決方案：**
1. 確認手機和電腦在同一個 Wi-Fi 網路
2. 確認防火牆沒有阻擋端口 5173
3. 檢查 `capacitor.config.ts` 中的 IP 地址是否正確

## 測試檢查清單

在實體手機上測試時，檢查以下項目：

### 基本功能
- [ ] 應用正常啟動
- [ ] 主畫面顯示正常
- [ ] 可以開始遊戲
- [ ] 瓶子可以點擊和選擇
- [ ] 液體可以傾倒
- [ ] 完成關卡後顯示勝利畫面

### UI/UX
- [ ] 所有按鈕大小合適，易於點擊
- [ ] 文字大小適中，易於閱讀
- [ ] 頂部按鈕不被狀態欄遮擋
- [ ] 底部控制欄不被系統導航欄遮擋
- [ ] Modal 完整顯示，不被裁切
- [ ] 觸控反饋流暢

### 性能
- [ ] 動畫流暢，無卡頓
- [ ] 載入速度合理
- [ ] 記憶體使用正常（長時間運行不崩潰）

### 不同屏幕尺寸
- [ ] 小屏幕設備（5-5.5 吋）測試
- [ ] 大屏幕設備（6.5+ 吋）測試
- [ ] 橫屏模式測試（如果支援）

### 特殊功能
- [ ] 音效正常播放
- [ ] 設定可以保存
- [ ] 關卡進度可以保存
- [ ] 金幣數量正確保存

## 調試技巧

### 查看即時日誌

```bash
# 查看所有日誌
adb logcat

# 只查看錯誤
adb logcat *:E

# 只查看你的應用
adb logcat | grep Mystery
```

### 截圖

```bash
# 截圖到電腦
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png
```

### 錄製屏幕

```bash
# 開始錄製
adb shell screenrecord /sdcard/demo.mp4

# 停止錄製（Ctrl+C）
# 下載到電腦
adb pull /sdcard/demo.mp4
```

### 清除應用數據

```bash
# 清除應用數據（重置到初始狀態）
adb shell pm clear com.mysteryliquidsort.app
```

## 無線調試（進階）

如果你不想一直插著 USB 線，可以設置無線調試：

### Android 11+ 無線調試

1. 在手機上：**設定 > 開發人員選項 > 無線除錯**
2. 開啟無線除錯
3. 點擊「配對裝置與配對碼」
4. 在電腦上執行：
   ```bash
   adb pair <手機顯示的IP>:<端口>
   # 輸入配對碼
   ```
5. 然後連接：
   ```bash
   adb connect <手機顯示的IP>:<端口>
   ```

### 傳統無線調試（需要先 USB 連接一次）

```bash
# 1. 先用 USB 連接
adb devices

# 2. 設置端口轉發
adb tcpip 5555

# 3. 拔掉 USB，連接 Wi-Fi
adb connect <手機IP>:5555

# 4. 確認連接
adb devices
```

## 下一步

測試完成後，如果發現問題：

1. **記錄問題**：截圖或錄製視頻
2. **查看日誌**：使用 `adb logcat` 查看錯誤
3. **修復問題**：根據錯誤訊息修復代碼
4. **重新測試**：確認問題已解決

準備好上架時，記得構建 Release 版本並簽名！

---

**提示**：第一次連接可能需要一些時間來安裝驅動程式和授權。之後連接會更快！

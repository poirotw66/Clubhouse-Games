# 手機截圖指南

## 方法 1：使用 ADB 命令（最簡單，推薦）

### 快速截圖

**如果只有一個設備連接：**
```bash
# 截圖到手機
adb shell screencap -p /sdcard/screenshot.png

# 下載到電腦當前目錄
adb pull /sdcard/screenshot.png

# 清理手機上的截圖（可選）
adb shell rm /sdcard/screenshot.png
```

**如果有多個設備（實體手機 + 模擬器）：**
```bash
# 先查看設備列表
adb devices

# 使用設備 ID 指定設備（替換 QV780VZT8G 為你的設備 ID）
adb -s QV780VZT8G shell screencap -p /sdcard/screenshot.png
adb -s QV780VZT8G pull /sdcard/screenshot.png
adb -s QV780VZT8G shell rm /sdcard/screenshot.png
```

### 一鍵截圖腳本

創建一個便捷腳本：

```bash
# 創建腳本
cat > ~/screenshot.sh << 'EOF'
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="screenshot_${TIMESTAMP}.png"
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png "$FILENAME"
adb shell rm /sdcard/screenshot.png
echo "截圖已保存為: $FILENAME"
EOF

# 添加執行權限
chmod +x ~/screenshot.sh

# 使用
~/screenshot.sh
```

### 直接保存到專案目錄

```bash
# 在專案根目錄執行
cd /Users/cfh00896102/Github/Mystery-Liquid-Sort

# 截圖並保存
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png screenshots/$(date +%Y%m%d_%H%M%S).png
adb shell rm /sdcard/screenshot.png
```

## 方法 2：使用 Android Studio

1. 打開 Android Studio
2. 連接手機
3. 點擊底部工具欄的 **「Logcat」** 旁邊的 **「Device File Explorer」**
4. 導航到 `/sdcard/`
5. 找到截圖文件
6. 右鍵點擊 > **「Save As」** 保存到電腦

## 方法 3：手機內建截圖 + 傳輸

### Android 手機截圖方法

**大部分 Android 手機：**
- 同時按住 **電源鍵 + 音量下鍵** 1-2 秒

**Sony 手機（你的設備）：**
- 同時按住 **電源鍵 + 音量下鍵**
- 或使用 **側邊感應**（如果啟用）

### 傳輸到電腦

**方法 A：USB 傳輸**
1. 用 USB 連接手機到電腦
2. 在手機上選擇 **「檔案傳輸」** 或 **「MTP」** 模式
3. 在電腦上打開手機文件夾
4. 找到 `Pictures/Screenshots/` 或 `DCIM/Screenshots/`
5. 複製截圖到電腦

**方法 B：雲端同步**
- Google Photos 自動備份
- 或使用其他雲端服務（Dropbox、OneDrive 等）

**方法 C：AirDroid / Send Anywhere**
- 使用無線傳輸應用

## 方法 4：錄製屏幕視頻

如果需要錄製操作過程：

```bash
# 開始錄製（會一直錄製直到你停止）
adb shell screenrecord /sdcard/demo.mp4

# 停止錄製：按 Ctrl+C

# 下載到電腦
adb pull /sdcard/demo.mp4

# 清理手機上的視頻
adb shell rm /sdcard/demo.mp4
```

**注意**：錄製的視頻可能很大，建議錄製後立即下載並刪除。

## 實用技巧

### 批量截圖

```bash
# 連續截圖多張（用於測試不同畫面）
for i in {1..5}; do
  echo "截圖 $i..."
  adb shell screencap -p /sdcard/screenshot_$i.png
  adb pull /sdcard/screenshot_$i.png
  adb shell rm /sdcard/screenshot_$i.png
  sleep 2  # 等待 2 秒再截下一張
done
```

### 自動命名截圖

```bash
# 使用時間戳命名
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png "screenshot_${TIMESTAMP}.png"
adb shell rm /sdcard/screenshot.png
```

### 創建截圖目錄

```bash
# 在專案中創建截圖目錄
mkdir -p /Users/cfh00896102/Github/Mystery-Liquid-Sort/screenshots

# 截圖並保存到該目錄
adb shell screencap -p /sdcard/screenshot.png
adb pull /sdcard/screenshot.png screenshots/$(date +%Y%m%d_%H%M%S).png
adb shell rm /sdcard/screenshot.png
```

## 檢查設備連接

如果命令不工作，先確認設備連接：

```bash
# 檢查設備
adb devices

# 應該看到：
# List of devices attached
# ABC123XYZ    device
```

如果顯示 `unauthorized`：
1. 檢查手機上的 USB 調試授權提示
2. 重新連接 USB 線
3. 執行：`adb kill-server && adb start-server`

## 推薦工作流程

對於測試和調試，推薦使用：

1. **快速截圖**：使用 `adb shell screencap` 命令
2. **保存到專案**：創建 `screenshots/` 目錄
3. **命名規範**：使用時間戳或描述性名稱
   - `screenshot_20260209_143022.png`（時間戳）
   - `game_start_screen.png`（描述性）

## 快速命令參考

```bash
# 最簡單的截圖命令
adb shell screencap -p /sdcard/screenshot.png && adb pull /sdcard/screenshot.png && adb shell rm /sdcard/screenshot.png

# 帶時間戳的截圖
adb shell screencap -p /sdcard/screenshot.png && adb pull /sdcard/screenshot.png "screenshot_$(date +%Y%m%d_%H%M%S).png" && adb shell rm /sdcard/screenshot.png
```

---

**提示**：如果經常需要截圖，建議創建一個別名（alias）在 `~/.zshrc` 中：

```bash
alias screenshot='adb shell screencap -p /sdcard/screenshot.png && adb pull /sdcard/screenshot.png "screenshot_$(date +%Y%m%d_%H%M%S).png" && adb shell rm /sdcard/screenshot.png && echo "截圖已保存"'
```

然後就可以直接使用：`screenshot`

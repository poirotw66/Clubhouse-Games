# 快速截圖指南

## ✅ 是的！可以直接在電腦上截取手機畫面

只要手機通過 USB 連接並啟用 USB 調試，就可以直接從電腦截圖，**不需要在手機上操作**。

## 最簡單的方法

### 使用快捷命令（推薦）

```bash
# 重新載入環境變數（如果還沒載入）
source ~/.zshrc

# 直接執行（會自動截圖、下載、清理）
screenshot
```

截圖會自動保存到當前目錄，文件名包含時間戳。

### 完整命令

```bash
# 1. 截圖到手機臨時位置
adb -s QV780VZT8G shell screencap -p /sdcard/screenshot.png

# 2. 下載到電腦
adb -s QV780VZT8G pull /sdcard/screenshot.png screenshots/my_screenshot.png

# 3. 清理手機上的臨時文件
adb -s QV780VZT8G shell rm /sdcard/screenshot.png
```

## 一鍵截圖到專案目錄

```bash
cd /Users/cfh00896102/Github/Mystery-Liquid-Sort

# 截圖並自動命名
adb -s QV780VZT8G shell screencap -p /sdcard/screenshot.png && \
adb -s QV780VZT8G pull /sdcard/screenshot.png screenshots/screenshot_$(date +%Y%m%d_%H%M%S).png && \
adb -s QV780VZT8G shell rm /sdcard/screenshot.png && \
echo "✅ 截圖已保存到 screenshots/ 目錄"
```

## 優勢

✅ **不需要觸摸手機** - 完全從電腦操作  
✅ **快速** - 一鍵完成  
✅ **自動命名** - 使用時間戳避免覆蓋  
✅ **自動清理** - 不會佔用手機空間  
✅ **批量截圖** - 可以連續截取多張  

## 實際使用場景

### 測試 UI 時快速截圖

```bash
# 在遊戲中，直接從電腦截圖
screenshot

# 截圖會自動保存，例如：
# screenshot_20260209_171500.png
```

### 批量截圖（測試不同畫面）

```bash
# 連續截圖 5 張，每張間隔 2 秒
for i in {1..5}; do
  echo "截圖 $i..."
  screenshot
  sleep 2
done
```

### 錄製操作過程

```bash
# 開始錄製（會一直錄製直到 Ctrl+C）
adb -s QV780VZT8G shell screenrecord /sdcard/demo.mp4

# 停止錄製後，下載視頻
adb -s QV780VZT8G pull /sdcard/demo.mp4 demo.mp4
adb -s QV780VZT8G shell rm /sdcard/demo.mp4
```

## 查看截圖

```bash
# 列出所有截圖
ls -lh screenshots/

# 在 Finder 中打開截圖目錄
open screenshots/

# 查看最新截圖
ls -t screenshots/ | head -1 | xargs open
```

## 注意事項

- 確保手機已連接：`adb devices`
- 如果有多個設備，需要指定設備 ID（`-s QV780VZT8G`）
- 截圖會自動從手機刪除，不會佔用空間
- 截圖文件通常約 15-50KB

---

**現在試試看**：在終端執行 `screenshot`，就會立即截取手機畫面並保存到電腦！

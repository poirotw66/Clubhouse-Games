# Screenshots Directory

這個目錄用於存放從手機截取的測試截圖。

## 快速截圖

### 方法 1：使用別名（推薦）

```bash
# 重新載入環境變數（如果還沒載入）
source ~/.zshrc

# 直接使用 screenshot 命令
screenshot
```

截圖會自動保存到當前目錄，文件名包含時間戳。

### 方法 2：完整命令

```bash
# 截圖並保存到 screenshots 目錄
cd /Users/cfh00896102/Github/Mystery-Liquid-Sort
adb -s QV780VZT8G shell screencap -p /sdcard/screenshot.png
adb -s QV780VZT8G pull /sdcard/screenshot.png screenshots/screenshot_$(date +%Y%m%d_%H%M%S).png
adb -s QV780VZT8G shell rm /sdcard/screenshot.png
```

## 設備 ID

當前使用的設備 ID：`QV780VZT8G`（Sony XQ-BC72）

如果設備 ID 改變，更新 `~/.zshrc` 中的別名。

## 查看截圖

```bash
# 列出所有截圖
ls -lh screenshots/

# 在 Finder 中打開
open screenshots/
```

## 注意事項

- 截圖會自動從手機刪除，不會佔用手機空間
- 截圖文件通常約 15-50KB
- 建議定期清理舊截圖

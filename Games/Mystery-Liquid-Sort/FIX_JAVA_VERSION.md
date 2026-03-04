# 修復 Java 版本問題

## 問題
- Gradle 9.1.0 需要 Java 17 或更高版本
- **Capacitor 8.0.2 需要 Java 21**（這是實際要求）
- 系統目前使用的是 Java 8

## 解決方案

### 方法 1：安裝 Java 21（推薦 - Capacitor 8.0.2 要求）

#### 使用 Homebrew 安裝（最簡單）

```bash
# 安裝 Java 21（Capacitor 8.0.2 要求）
brew install openjdk@21

# 設置環境變數
export JAVA_HOME="/usr/local/opt/openjdk@21"
export PATH="/usr/local/opt/openjdk@21/bin:$PATH"

# 添加到 ~/.zshrc 使其永久生效
echo 'export JAVA_HOME="/usr/local/opt/openjdk@21"' >> ~/.zshrc
echo 'export PATH="/usr/local/opt/openjdk@21/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# 驗證
java -version
# 應該顯示：openjdk version "21.x.x"
```

#### 手動安裝 Java 17

1. **下載 Java 17**
   - 訪問：https://www.oracle.com/java/technologies/downloads/#java17
   - 或使用 OpenJDK：https://adoptium.net/temurin/releases/?version=17
   - 選擇 macOS 版本下載

2. **安裝後設置環境變數**
   ```bash
   # 添加到 ~/.zshrc
   export JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home
   export PATH=$JAVA_HOME/bin:$PATH
   
   # 重新載入
   source ~/.zshrc
   ```

### 方法 2：在 Android Studio 中設置 Java 版本

1. 打開 Android Studio
2. **Android Studio > Settings** (macOS) 或 **File > Settings** (Windows/Linux)
3. 導航到：**Build, Execution, Deployment > Build Tools > Gradle**
4. 在 **Gradle JDK** 下拉選單中選擇：
   - **jbr-17** (JetBrains Runtime 17) - 如果已安裝
   - 或點擊 **Download JDK** 下載 Java 17
5. 點擊 **Apply** 和 **OK**
6. 重新同步 Gradle

### 方法 3：配置 Gradle 使用特定 Java 版本

在 `android/gradle.properties` 中添加：

```properties
# 指定 Java 21（Capacitor 8.0.2 要求）
org.gradle.java.home=/usr/local/opt/openjdk@21
```

**注意**：`android/app/capacitor.build.gradle` 也需要設置為 Java 21：
```gradle
android {
  compileOptions {
      sourceCompatibility JavaVersion.VERSION_21
      targetCompatibility JavaVersion.VERSION_21
  }
}
```

## 驗證修復

執行以下命令確認：

```bash
# 檢查 Java 版本
java -version
# 應該顯示：java version "17.x.x"

# 檢查 JAVA_HOME
echo $JAVA_HOME
# 應該指向 Java 17 的路徑

# 測試 Gradle
cd android
./gradlew --version
```

## 如果沒有 Homebrew

安裝 Homebrew（推薦用於 macOS）：

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

然後使用上面的方法 1。

## 臨時解決方案（不推薦）

如果暫時無法安裝 Java 17，可以降級 Gradle 版本：

編輯 `android/gradle/wrapper/gradle-wrapper.properties`：

```properties
distributionUrl=https\://services.gradle.org/distributions/gradle-8.5-all.zip
```

但這不推薦，因為新版本的 Gradle 有更好的功能和性能。

## 完成後

修復後，重新嘗試：

```bash
npx cap run android
```

---

**推薦**：使用 Homebrew 安裝 Java 17，這是最簡單且可靠的方法。

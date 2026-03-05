# Local Android Build Guide

Build your Expo/React Native app locally without waiting in EAS queues.

## Prerequisites

### 1. Install Android Studio
```bash
# Download from: https://developer.android.com/studio
# Or on Linux:
sudo snap install android-studio --classic
```

### 2. Set Up Android SDK
After installing Android Studio:
1. Open Android Studio
2. Go to Settings → Appearance & Behavior → System Settings → Android SDK
3. Install:
   - Android SDK Platform 34 (or latest)
   - Android SDK Build-Tools
   - Android SDK Command-line Tools
   - Android Emulator (optional)

### 3. Set Environment Variables
Add to `~/.bashrc` or `~/.zshrc`:
```bash
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
```

Then reload:
```bash
source ~/.bashrc  # or ~/.zshrc
```

### 4. Accept Android SDK Licenses
```bash
sdkmanager --licenses
```

---

## Build Commands

### First-Time Setup (Generate Native Code)
```bash
cd client
npx expo prebuild --clean
```

This generates `android/` and `ios/` directories with native code.

### Build Development APK (Debug)
```bash
npx expo run:android
```
- Installs on connected device/emulator
- Fast iteration
- Includes debugging tools

### Build Production APK (Release)
```bash
npx expo run:android --variant release
```
- Optimized production build
- Not signed for Play Store (yet)
- Ready for testing

### Build Signed Release APK
```bash
cd android
./gradlew assembleRelease
```
Output: `android/app/build/outputs/apk/release/app-release.apk`

---

## Signing Configuration (For Play Store)

### 1. Generate Keystore (One Time)
```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore rstify-release.keystore \
  -alias rstify-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Save the keystore file and passwords securely!

### 2. Configure Gradle Signing

Edit `android/app/build.gradle`:

```gradle
android {
    ...
    signingConfigs {
        release {
            storeFile file("../../rstify-release.keystore")
            storePassword System.getenv("KEYSTORE_PASSWORD")
            keyAlias "rstify-key"
            keyPassword System.getenv("KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
        }
    }
}
```

### 3. Build Signed APK
```bash
export KEYSTORE_PASSWORD="your_store_password"
export KEY_PASSWORD="your_key_password"
cd android
./gradlew assembleRelease
```

---

## Quick Reference

| Command | Purpose | Output |
|---------|---------|--------|
| `npx expo prebuild --clean` | Generate native code | `android/`, `ios/` dirs |
| `npx expo run:android` | Debug build + install | Runs on device |
| `npx expo run:android --variant release` | Release build + install | Runs on device |
| `cd android && ./gradlew assembleRelease` | Build APK file | `.apk` file |
| `cd android && ./gradlew bundleRelease` | Build AAB for Play Store | `.aab` file |

---

## Troubleshooting

### "SDK location not found"
Create `android/local.properties`:
```properties
sdk.dir=/home/YOUR_USERNAME/Android/Sdk
```

### "License not accepted"
```bash
sdkmanager --licenses
```

### Clean Build
```bash
cd android
./gradlew clean
cd ..
npx expo prebuild --clean
```

### Build Cache Issues
```bash
rm -rf android/app/build
rm -rf android/.gradle
cd android && ./gradlew clean
```

---

## Benefits of Local Builds

✅ **No Queue** - Build instantly
✅ **Faster Iteration** - Change code, rebuild in minutes
✅ **Full Control** - Customize native code
✅ **Offline Builds** - No internet required
✅ **Free** - No EAS limits

---

## When to Use Each Method

**Local Builds:**
- Development and testing
- Quick iterations
- Custom native code
- Offline environments

**EAS Builds:**
- Production releases
- Automated CI/CD
- No local Android setup
- Multiple platform builds

# rstify Mobile App: Build & Update Guide

All three build methods use the same keystore, so builds are interchangeable.
Install from any method without uninstalling first.

---

## Method 1: GitHub Actions (Recommended for Development)

**Build time:** ~8 min | **Queue:** None | **Requires:** Nothing

### Build

```bash
# Trigger signed build
gh workflow run build-android-signed.yml

# Check build status
gh run list --workflow=build-android-signed.yml --limit 1

# Watch build progress
gh run watch
```

### Download APK

```bash
# Get the latest run ID
RUN_ID=$(gh run list --workflow=build-android-signed.yml --json databaseId -q '.[0].databaseId')

# Download APK
gh run download $RUN_ID
```

The APK is saved to `./rstify-release-signed.apk/app-release.apk`

### Install on Phone

**Option A: USB (ADB)**
```bash
adb install -r rstify-release-signed.apk/app-release.apk
```

**Option B: Download on Phone**
1. Open the GitHub Actions run URL on your phone browser
2. Scroll to "Artifacts" at bottom
3. Tap "rstify-release-signed.apk" to download
4. Open the ZIP, extract APK, tap to install

**Option C: Multiple Devices**
```bash
for device in $(adb devices | grep "device$" | cut -f1); do
    echo "Installing on $device..."
    adb -s "$device" install -r rstify-release-signed.apk/app-release.apk
done
```

---

## Method 2: EAS Build (Expo Cloud)

**Build time:** ~10 min | **Queue:** 5-30 min (free tier) | **Requires:** Expo account

### Build

```bash
cd client

# Preview profile (APK for direct install)
npx eas build --profile preview --platform android

# Production profile (AAB for Play Store)
npx eas build --profile production --platform android
```

### Download APK

**Option A: From Terminal Output**

The build prints a URL when complete. Open it to download.

**Option B: From EAS Dashboard**
1. Go to: https://expo.dev/accounts/jsprague/projects/rstify/builds
2. Click the latest build
3. Download APK

### Install on Phone

**Option A: Open EAS Link on Phone**
1. Copy the build URL from the terminal output
2. Open on your phone browser
3. Tap "Install" or download the APK
4. Tap the downloaded file to install

**Option B: USB (ADB)**
```bash
# Download from EAS first, then:
adb install -r rstify.apk
```

---

## Method 3: Local Build (Fastest Iteration)

**Build time:** ~3-5 min | **Queue:** None | **Requires:** Android SDK, Java 17

### One-Time Setup

```bash
# Install Android SDK (if not already)
# Set environment variables
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools

# Accept licenses
sdkmanager --licenses

# Generate native project files
cd client
npx expo prebuild --platform android --clean

# Copy keystore into place
cp credentials/android/keystore.jks android/app/rstify-release.keystore
```

Add signing config to `client/android/app/build.gradle` (inside the `android` block):

```gradle
signingConfigs {
    release {
        storeFile file("rstify-release.keystore")
        storePassword "a6ed562186d0edfa5517cba0b279203d"
        keyAlias "5dafbecc8649b6fd2462b0ac0f043e92"
        keyPassword "33f77e8e1294b49c37668e29dfd0d24f"
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
    }
}
```

> **Security Note:** For shared repos, use environment variables instead of
> hardcoding passwords. The values above are from your EAS credentials.

### Build

```bash
cd client/android

# Build signed release APK
./gradlew assembleRelease
```

Output: `client/android/app/build/outputs/apk/release/app-release.apk`

### Install on Phone

```bash
adb install -r client/android/app/build/outputs/apk/release/app-release.apk
```

---

## Quick Reference

| Action | Command |
|--------|---------|
| **GH Actions: Build** | `gh workflow run build-android-signed.yml` |
| **GH Actions: Status** | `gh run list --workflow=build-android-signed.yml --limit 1` |
| **GH Actions: Download** | `gh run download <RUN_ID>` |
| **EAS: Build** | `cd client && npx eas build --profile preview -p android` |
| **EAS: Dashboard** | https://expo.dev/accounts/jsprague/projects/rstify/builds |
| **Local: Build** | `cd client/android && ./gradlew assembleRelease` |
| **Install via ADB** | `adb install -r <path-to-apk>` |
| **List devices** | `adb devices` |
| **Uninstall (if needed)** | `adb uninstall cc.js_node.rstify` |

---

## First-Time Phone Setup

If this is a new device that has never had the app:

1. **Enable "Install Unknown Apps"**
   - Settings > Security > Install unknown apps
   - Allow your browser or file manager

2. **Install the APK** using any method above

3. **Open rstify**

4. **Tap "Server Settings"** on login screen

5. **Enter server URL:** `https://rstify.js-node.cc`

6. **Login** with your credentials

---

## Troubleshooting

**"App not installed" error**
- Signature mismatch. Uninstall old app first: `adb uninstall cc.js_node.rstify`
- This only happens if someone built with a different keystore

**"No connected devices" (ADB)**
- Enable Developer Options: Settings > About Phone > tap Build Number 7 times
- Enable USB Debugging: Settings > Developer Options > USB Debugging
- Reconnect USB cable
- Run `adb devices` to verify

**GitHub Actions build fails at signing**
- Verify secrets are set: https://github.com/jsprague84/rstify/settings/secrets/actions
- Required secrets: `ANDROID_KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`

**Local build fails at prebuild**
- Run `npx expo prebuild --platform android --clean` to regenerate native code
- Make sure Java 17 is installed: `java -version`

**EAS build stuck in queue**
- Use GitHub Actions or local build instead
- Free tier queues can be 5-30 minutes

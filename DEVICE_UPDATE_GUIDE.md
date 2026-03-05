# How to Update Multiple Devices with New rstify Builds

Quick guide for distributing and updating the rstify Android app across multiple devices.

---

## 🚀 Method 1: Direct Download (Easiest for Users)

### Setup Once (Share the Link)

1. **Build the APK** (GitHub Actions or EAS)
2. **Get the download link**
3. **Share with users** via:
   - Email
   - Slack/Discord
   - QR code
   - SMS

### Users Install

1. Open link on Android phone
2. Download APK
3. Tap to install
4. Allow "Install unknown apps" if prompted
5. Open rstify app

**Pros:**
- ✅ Self-service for users
- ✅ No physical device access needed
- ✅ Works remotely

**Cons:**
- ❌ Users must manually update
- ❌ Requires "unknown apps" permission

---

## 📦 Method 2: ADB Bulk Install (For Local Devices)

### Install on Multiple Connected Devices

```bash
#!/bin/bash
# Save as: bulk-install.sh

APK_PATH="./rstify-release.apk"

# Find all connected devices
for device in $(adb devices | grep -v "List" | grep "device$" | cut -f1); do
    echo "Installing on device: $device"
    adb -s "$device" install -r "$APK_PATH"
    echo "✅ Installed on $device"
done

echo "🎉 Installation complete on all devices!"
```

**Usage:**
```bash
chmod +x bulk-install.sh
./bulk-install.sh
```

**Pros:**
- ✅ Fast for multiple devices
- ✅ Automated
- ✅ Can be scripted

**Cons:**
- ❌ Requires USB connection
- ❌ Must enable ADB on each device

---

## 🌐 Method 3: Self-Hosted Download Server

### Setup a Simple Download Page

```bash
# 1. Put APK in your web server directory
cp rstify-release.apk /var/www/html/downloads/

# 2. Create simple download page
cat > /var/www/html/downloads/index.html <<'EOF'
<!DOCTYPE html>
<html>
<head>
    <title>rstify Downloads</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
        body {
            font-family: system-ui;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            text-align: center;
        }
        .download-btn {
            display: inline-block;
            background: #3b82f6;
            color: white;
            padding: 15px 30px;
            border-radius: 8px;
            text-decoration: none;
            font-size: 18px;
            margin: 20px 0;
        }
        .version {
            color: #666;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <h1>📱 rstify Mobile App</h1>
    <p class="version">Latest Version: 1.0.0</p>
    <a href="rstify-release.apk" class="download-btn">
        Download for Android
    </a>
    <p>
        <small>
            <a href="https://github.com/jsprague84/rstify">GitHub</a> |
            <a href="/docs">Documentation</a>
        </small>
    </p>
</body>
</html>
EOF

# 3. Share the URL
echo "Download page: https://your-domain.com/downloads/"
```

**Users access:**
```
https://your-domain.com/downloads/
```

**Pros:**
- ✅ Professional
- ✅ Easy to update (just replace APK)
- ✅ Can add version history
- ✅ Track downloads

**Cons:**
- ❌ Requires web server
- ❌ HTTPS recommended

---

## ☁️ Method 4: Google Drive / Dropbox

### Share via Cloud Storage

1. **Upload APK to Drive/Dropbox**
2. **Set permissions to "Anyone with link"**
3. **Get shareable link**
4. **Share with users**

**Google Drive:**
```
https://drive.google.com/file/d/FILE_ID/view?usp=sharing
```

**Dropbox:**
```
https://www.dropbox.com/s/FILE_ID/rstify-release.apk?dl=1
```

**Pros:**
- ✅ Free and easy
- ✅ No server needed
- ✅ Version control in Drive

**Cons:**
- ❌ Download limits on free tier
- ❌ Extra clicks for users

---

## 🤖 Method 5: Automated GitHub Actions + Update Notifications

### Full Automation Setup

**1. Build triggers on push:**
Already configured in `.github/workflows/build-android.yml`

**2. Create GitHub Release automatically:**
```yaml
# Add to workflow after successful build:
- name: Create Release
  uses: softprops/action-gh-release@v1
  if: startsWith(github.ref, 'refs/tags/v')
  with:
    files: client/android/app/build/outputs/apk/release/*.apk
    generate_release_notes: true
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**3. Trigger release:**
```bash
git tag v1.0.1
git push origin v1.0.1
```

**4. Users download from:**
```
https://github.com/jsprague84/rstify/releases/latest
```

**5. Add update notification in app (future):**
```typescript
// Check for updates on app start
const checkForUpdates = async () => {
  const response = await fetch(
    'https://api.github.com/repos/jsprague84/rstify/releases/latest'
  );
  const latest = await response.json();

  if (latest.tag_name !== currentVersion) {
    Alert.alert(
      'Update Available',
      `Version ${latest.tag_name} is available`,
      [
        { text: 'Later' },
        { text: 'Download', onPress: () => Linking.openURL(latest.html_url) }
      ]
    );
  }
};
```

**Pros:**
- ✅ Fully automated
- ✅ Version control
- ✅ Release notes
- ✅ Professional

**Cons:**
- ❌ Requires public repo (or tokens for private)
- ❌ Extra development for in-app updates

---

## 🎯 Recommended Workflow

### For Development/Testing:
```bash
# 1. Make changes
git add -A
git commit -m "Feature: XYZ"
git push

# 2. Build via GitHub Actions (auto-triggered)
# Wait ~5-8 minutes

# 3. Download APK from Actions artifacts
gh run download --name rstify-release.apk

# 4. Install on test devices
./bulk-install.sh
```

### For Production Releases:
```bash
# 1. Create release tag
git tag v1.0.1
git push origin v1.0.1

# 2. GitHub Actions builds automatically
# 3. Creates GitHub Release
# 4. Share release URL with users:
https://github.com/jsprague84/rstify/releases/latest
```

---

## 📱 Installation Tips for Users

### First-Time Installation

1. **Enable "Install from Unknown Sources":**
   - Settings → Security → Unknown Sources → ON
   - Or per-app: Settings → Apps → Browser → Install unknown apps → Allow

2. **Download APK**
3. **Tap notification or Downloads folder**
4. **Tap "Install"**
5. **Open app**

### Updating Existing Installation

**If same signature (recommended):**
- Just install new APK over old one
- Settings and data preserved

**If different signature:**
- Uninstall old version first
- Install new version
- Re-login required

---

## 🔐 Signing Best Practices

### Use Same Keystore for Updates

```bash
# Generate once, keep forever
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore rstify-release.keystore \
  -alias rstify-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

# Store securely:
# - Backup to password manager
# - Backup to encrypted USB
# - Never commit to git
```

**For GitHub Actions:**
```bash
# Encode for GitHub secrets
base64 -w 0 rstify-release.keystore > keystore.base64.txt

# Add to GitHub secrets:
# Settings → Secrets → Actions → New repository secret
# Name: ANDROID_KEYSTORE_BASE64
# Value: <paste from keystore.base64.txt>
```

---

## 📊 Comparison

| Method | Setup | Speed | Users | Cost |
|--------|-------|-------|-------|------|
| Direct Download | Easy | Fast | Manual | Free |
| ADB Bulk | Medium | Instant | Automated | Free |
| Self-Hosted | Hard | Fast | Manual | Server cost |
| Cloud Storage | Easy | Fast | Manual | Free/Paid |
| GitHub Releases | Easy | Fast | Manual | Free |

---

## 🚀 Quick Commands

### Download latest build from GitHub Actions:
```bash
# List recent builds
gh run list --workflow=build-android.yml

# Download specific build
gh run download 22718619145

# Download latest
gh run download $(gh run list --workflow=build-android.yml --json databaseId -q '.[0].databaseId')
```

### Install on connected device:
```bash
adb install -r rstify-release.apk
```

### Install on specific device:
```bash
adb -s DEVICE_ID install -r rstify-release.apk
```

### List connected devices:
```bash
adb devices
```

---

## 🆘 Troubleshooting

### "App not installed" error
- **Cause:** Signature mismatch
- **Fix:** Uninstall old version first

### "Unknown sources" blocked
- **Cause:** Security setting
- **Fix:** Settings → Security → Enable unknown sources

### APK download stuck
- **Cause:** GitHub artifacts require login
- **Fix:** Use `gh` CLI or login to GitHub first

### Multiple devices, one fails
- **Cause:** Different Android version
- **Fix:** Build with minimum SDK 21 (covered)

---

## 📧 Example Update Email Template

```
Subject: rstify Mobile App Update Available - v1.0.1

Hi team,

A new version of the rstify mobile app is ready:

📱 Download: https://github.com/jsprague84/rstify/releases/latest

What's new in v1.0.1:
- ✅ Dark mode with 3 theme options
- ✅ Improved message rendering
- ✅ Bug fixes and performance improvements

Installation:
1. Download APK from link above
2. Install (it will update your existing app)
3. Open and enjoy!

Questions? Reply to this email.

Thanks,
Admin Team
```

---

**Ready to distribute your app!** 🎉

Choose the method that works best for your use case.

# GitHub Actions Build Guide

Build Android APKs automatically with GitHub Actions - no EAS queues!

## 📁 Files Created

1. **`.github/workflows/build-android.yml`** - Unsigned builds (for testing)
2. **`.github/workflows/build-android-signed.yml`** - Signed builds (for distribution)

---

## 🚀 Quick Start (Unsigned Builds)

The basic workflow is already set up and requires **no configuration**!

### Trigger a Build

**Option 1: Manual Trigger**
1. Go to: https://github.com/jsprague84/rstify/actions
2. Click "Build Android APK"
3. Click "Run workflow"
4. Select build type (debug or release)
5. Click "Run workflow"

**Option 2: Automatic on Push**
- Pushes to `master` branch with changes in `client/` automatically trigger builds

### Download the APK

1. Go to the workflow run
2. Scroll to "Artifacts" section at bottom
3. Download `rstify-debug.apk` or `rstify-release-unsigned.apk`
4. Install on your Android device

---

## 🔐 Setup Signed Builds (For Distribution)

To create signed APKs that can be distributed via Play Store or direct download:

### Step 1: Generate Keystore (if you don't have one)

```bash
cd client
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore rstify-release.keystore \
  -alias rstify-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=rstify, OU=Mobile, O=rstify, L=City, S=State, C=US"

# You'll be prompted for passwords - remember them!
```

**Save these securely:**
- Keystore file: `rstify-release.keystore`
- Store password (you entered)
- Key alias: `rstify-key`
- Key password (you entered)

### Step 2: Encode Keystore to Base64

```bash
base64 -w 0 rstify-release.keystore > keystore.base64.txt
cat keystore.base64.txt
```

Copy the output (long base64 string).

### Step 3: Add GitHub Secrets

1. Go to: https://github.com/jsprague84/rstify/settings/secrets/actions
2. Click "New repository secret"
3. Add these secrets:

| Secret Name | Value |
|-------------|-------|
| `ANDROID_KEYSTORE_BASE64` | Paste the base64 string from Step 2 |
| `KEYSTORE_PASSWORD` | Your keystore password |
| `KEY_ALIAS` | `rstify-key` |
| `KEY_PASSWORD` | Your key password |

### Step 4: Trigger Signed Build

**Option 1: Manual**
1. Go to: https://github.com/jsprague84/rstify/actions
2. Click "Build Signed Android APK"
3. Click "Run workflow"
4. Download from artifacts: `rstify-release-signed.apk`

**Option 2: Git Tag**
```bash
git tag v1.0.0
git push origin v1.0.0
```
This automatically builds AND creates a GitHub Release!

---

## 🔄 Workflow Features

### `build-android.yml` (Unsigned)

**Triggers:**
- Manual dispatch (Actions tab)
- Push to `master` with changes in `client/`

**Outputs:**
- Debug APK (for development)
- Release APK unsigned (for testing)

**Build Time:** ~5-8 minutes

### `build-android-signed.yml` (Signed)

**Triggers:**
- Manual dispatch (Actions tab)
- Git tags matching `v*` (e.g., `v1.0.0`)

**Outputs:**
- Signed release APK (ready for distribution)
- GitHub Release (if triggered by tag)

**Build Time:** ~5-8 minutes

---

## 📊 Comparison: EAS vs GitHub Actions vs Local

| Feature | EAS Build | GitHub Actions | Local Build |
|---------|-----------|----------------|-------------|
| **Queue Time** | 5-30 min | None | None |
| **Build Time** | 5-10 min | 5-8 min | 2-5 min |
| **Cost** | Free tier limits | Free (2000 min/month) | Free |
| **Setup** | Easy | Medium | Complex |
| **Signing** | Managed | Manual | Manual |
| **CI/CD** | ✅ Native | ✅ Native | ❌ Manual |
| **Offline** | ❌ | ❌ | ✅ |

---

## 🎯 Recommended Workflow

**For Development:**
```bash
# Fast local iteration
npx expo run:android --variant release
```

**For Testing/Staging:**
```bash
# GitHub Actions - no queue, automated
git push origin master
# Download APK from Actions tab
```

**For Production:**
```bash
# Signed build with version tag
git tag v1.0.1
git push origin v1.0.1
# Auto-creates GitHub Release with APK
```

---

## 🐛 Troubleshooting GitHub Actions

### Build Fails at "Generate native code"

**Cause:** Missing dependencies in package.json

**Fix:** Ensure all deps are in `client/package.json`, not global

### "Keystore not found"

**Cause:** Base64 secret is incorrect

**Fix:**
```bash
# Re-encode without line wraps
base64 -w 0 rstify-release.keystore
```

### "Signing config not found"

**Cause:** Secrets not configured

**Fix:** Check all 4 secrets are set in GitHub repository settings

### Build succeeds but APK doesn't install

**Cause:** Unsigned APK or signature mismatch

**Fix:**
- For testing: Use debug APK or unsigned release
- For distribution: Use signed release APK

---

## ⚡ Speed Optimization

### Cache Dependencies

Already configured in workflows:
```yaml
- uses: actions/setup-node@v4
  with:
    cache: 'npm'
```

### Parallel Builds

To build multiple variants simultaneously:

```yaml
strategy:
  matrix:
    build_type: [debug, release]
```

### Reduce Prebuild Time

If you commit the `android/` directory (not recommended for Expo apps):
- Skip `npx expo prebuild`
- Directly run `./gradlew assembleRelease`
- Faster but harder to maintain

---

## 📱 Installing Unsigned APKs

Unsigned release APKs require:

1. **Enable "Install Unknown Apps"** on Android
2. **Allow from browser/file manager**
3. **Installation warning** - click "Install anyway"

For production, always use signed APKs.

---

## 🎉 Benefits

✅ **No EAS Queue** - Build immediately
✅ **Free** - 2000 min/month on GitHub Actions
✅ **Automated** - Push to trigger builds
✅ **Version Control** - Git tags auto-release
✅ **Artifacts** - 30-90 day retention
✅ **CI/CD Ready** - Integrate with testing
✅ **Self-Hosted Option** - Run on your own runners

---

## 🔜 Next Steps

1. ✅ Test unsigned build workflow
2. ✅ Set up signing secrets
3. ✅ Create your first signed release
4. 🔄 Add automated testing before build
5. 🚀 Set up Play Store deployment

**Need help?** Check the workflow logs in the Actions tab!

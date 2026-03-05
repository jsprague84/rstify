# Setup Signed GitHub Actions Builds (Same as EAS)

Use GitHub Actions for fast builds while maintaining the same app signature as your EAS builds.

---

## 🎯 Goal

- ✅ GitHub Actions builds (~5-8 min, no queue)
- ✅ Same signature as current EAS builds
- ✅ Seamless updates (no uninstall needed)
- ✅ Save time during development

---

## Step 1: Download Your EAS Keystore

### Option A: Via EAS CLI (Easiest)

```bash
cd client
npx eas credentials

# Follow prompts:
# 1. Select "Android"
# 2. Select "Download Keystore"
# 3. Choose your keystore (should be "Build Credentials EzMG4oYXfp")
# 4. File downloads to current directory
```

### Option B: Via Expo Website

1. Go to: https://expo.dev/accounts/jsprague/projects/rstify/credentials
2. Click "Android"
3. Find your keystore: "Build Credentials EzMG4oYXfp"
4. Click "Download"
5. Save as `rstify-release.keystore`

---

## Step 2: Get Keystore Info

You'll need the passwords. If you created the keystore yourself, you know them. If EAS generated it:

```bash
# EAS typically uses:
# Store Password: (check your EAS dashboard or create new)
# Key Alias: (usually shown in EAS dashboard)
# Key Password: (usually same as store password)

# You can view keystore info (but not passwords):
keytool -list -v -keystore rstify-release.keystore
```

**Note:** If you don't know the passwords and EAS generated the keystore, you may need to create a new keystore. However, this means users will need to uninstall and reinstall the app.

---

## Step 3: Encode Keystore for GitHub

```bash
# Navigate to where you downloaded the keystore
cd client

# Encode to base64 (no line wrapping)
base64 -w 0 rstify-release.keystore > keystore.base64.txt

# Copy the output
cat keystore.base64.txt | xclip -selection clipboard
# Or just: cat keystore.base64.txt
# Then manually copy the output
```

---

## Step 4: Add GitHub Secrets

1. **Go to your repo secrets page:**
   ```
   https://github.com/jsprague84/rstify/settings/secrets/actions
   ```

2. **Click "New repository secret"**

3. **Add these 4 secrets:**

| Secret Name | Value | How to Get |
|-------------|-------|------------|
| `ANDROID_KEYSTORE_BASE64` | Paste from `keystore.base64.txt` | Step 3 above |
| `KEYSTORE_PASSWORD` | Your keystore password | From EAS or your records |
| `KEY_ALIAS` | Key alias name | Usually `rstify-key` or check EAS dashboard |
| `KEY_PASSWORD` | Key password | Usually same as keystore password |

**Example:**
- Name: `ANDROID_KEYSTORE_BASE64`
- Value: `MIIJqgIBAzCCCWAGCSqGSIb3DQEHAaCCCVEEgglNMII...` (very long string)

---

## Step 5: Test Signed Build

The workflow is already configured! Just trigger it:

```bash
# Trigger signed build workflow
gh workflow run build-android-signed.yml

# Monitor progress
gh run watch
```

Or via web UI:
1. Go to: https://github.com/jsprague84/rstify/actions/workflows/build-android-signed.yml
2. Click "Run workflow"
3. Wait ~5-8 minutes
4. Download from artifacts

---

## Step 6: Verify Signature Matches

After the GitHub Actions build completes:

```bash
# Download the GitHub Actions APK
gh run download XXXXX  # replace with run ID

# Download latest EAS APK
# (from https://expo.dev/accounts/jsprague/projects/rstify/builds)

# Compare signatures
jarsigner -verify -verbose -certs github-build.apk | grep "SHA-256"
jarsigner -verify -verbose -certs eas-build.apk | grep "SHA-256"

# Should match!
```

If signatures match, you can update your existing apps seamlessly!

---

## Alternative: Use EAS Credentials in GitHub Actions

If you can't get the keystore passwords, you can configure GitHub Actions to use EAS for signing:

### Option: Let EAS Handle Signing

Keep using EAS for signing but use GitHub Actions to trigger builds:

```yaml
# .github/workflows/eas-build-trigger.yml
name: Trigger EAS Build
on:
  workflow_dispatch:
  push:
    branches: [master]
    paths: ['client/**']

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: client/package-lock.json

      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}

      - name: Install dependencies
        working-directory: ./client
        run: npm ci

      - name: Trigger EAS Build
        working-directory: ./client
        run: eas build --platform android --profile preview --non-interactive --no-wait
```

**Setup:**
1. Get Expo token: https://expo.dev/accounts/jsprague/settings/access-tokens
2. Add as GitHub secret: `EXPO_TOKEN`
3. This triggers EAS builds automatically on push

**Pros:**
- ✅ Uses your existing EAS credentials
- ✅ Automatic on push
- ✅ Same signature

**Cons:**
- ❌ Still has EAS queue time
- ❌ Uses EAS build minutes

---

## Quick Decision Matrix

### Scenario 1: You have the keystore password
- ✅ **Use:** Signed GitHub Actions builds
- ✅ **Setup:** Steps 1-5 above
- ✅ **Result:** Fast builds (5-8 min), no queue, same signature

### Scenario 2: You DON'T have the keystore password
- **Option A:** Create new keystore
  - ✅ Fast GitHub Actions builds
  - ❌ Users must uninstall old app and install new

- **Option B:** Continue with EAS
  - ✅ Same signature
  - ❌ Queue time (5-30 min)

- **Option C:** Use EAS + GitHub Actions trigger (above)
  - ✅ Automated
  - ❌ Still has queue time

---

## Recommended Approach

### For Development (Fast Iteration):
```bash
# Use unsigned GitHub Actions builds
# Install fresh on test devices (uninstall old version first)
gh workflow run build-android.yml -f build_type=release
```

### For Production (User Devices):
```bash
# Use signed builds (either EAS or GitHub Actions with keystore)
# Can update existing apps seamlessly
gh workflow run build-android-signed.yml
# OR
cd client && npx eas build --profile preview --platform android
```

### Best of Both Worlds:
1. **Setup signed GitHub Actions** (Steps 1-5)
2. **Use for all builds** - Fast + signed
3. **Save EAS builds** as backup/fallback

---

## 🚀 Next Steps

1. **Try to get keystore from EAS:**
   ```bash
   cd client
   npx eas credentials
   ```

2. **If successful:**
   - Follow Steps 3-5 to set up GitHub Actions
   - Test with signed build workflow
   - Verify signature matches

3. **If can't get keystore/passwords:**
   - For dev: Use unsigned GitHub Actions (fast, must uninstall)
   - For prod: Continue with EAS (slow but signed)
   - Or: Create new keystore, distribute as new app

---

## 🆘 Troubleshooting

### "Can't download keystore"
- Try the web UI: https://expo.dev/accounts/jsprague/projects/rstify/credentials
- Or create new keystore (see `client/LOCAL_BUILD_GUIDE.md`)

### "Don't know keystore password"
- If EAS generated it, check your email or EAS dashboard
- Or create new keystore

### "Signature doesn't match"
- Wrong keystore
- Wrong password/alias
- Try downloading from EAS again

### "GitHub Actions build fails"
- Check secrets are set correctly
- Verify base64 encoding has no line breaks
- Check workflow logs

---

## 📞 Need Help?

If you get stuck, you can:

1. **Check EAS dashboard** for keystore details
2. **Run interactive EAS credentials** command
3. **Create new keystore** for fresh start
4. **Use EAS for now** while figuring out signing

Let me know which scenario applies and I can help further!

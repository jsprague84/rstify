# Forgejo Setup Guide

Self-hosted Git + CI/CD alongside rstify on your VPS.

## Prerequisites

- DNS: Add an A record for `git.js-node.cc` pointing to your VPS
- Traefik already running with the `proxy` network and Cloudflare cert resolver

---

## Step 1: Create Directories

```bash
ssh your-vps

mkdir -p /home/ubuntu/docker/forgejo/{data,runner-data,dind-data}
```

## Step 2: Start Forgejo (Without Runner First)

```bash
cd /path/to/deploy/forgejo
docker compose up -d forgejo docker-in-docker
```

Wait ~30 seconds for Forgejo to initialize, then visit:
```
https://git.js-node.cc
```

## Step 3: Create Admin Account

1. Open `https://git.js-node.cc`
2. First user automatically becomes admin (registration is disabled after)
3. Create your account

## Step 4: Register the Runner

1. In Forgejo, go to: **Site Administration > Actions > Runners**
2. Click **"Create new runner"**
3. Copy the **registration token**
4. Register the runner:

```bash
# Shell into the runner container
docker exec -it forgejo-runner sh

# Register with your Forgejo instance
forgejo-runner register \
  --instance https://git.js-node.cc \
  --token YOUR_REGISTRATION_TOKEN \
  --name "vps-runner" \
  --labels "ubuntu-latest:docker://node:20,docker:docker://node:20" \
  --no-interactive

# Exit the container
exit
```

5. Start the runner:

```bash
docker compose up -d forgejo-runner
```

6. Verify in Forgejo UI: **Site Administration > Actions > Runners** should show your runner as online.

## Step 5: Mirror Your GitHub Repo (Optional)

1. In Forgejo, click **+ > New Migration**
2. Select **GitHub**
3. Enter: `https://github.com/jsprague84/rstify.git`
4. Check **"Mirror"** to keep it synced
5. Click **Migrate**

---

## CI/CD: Android APK Workflow

Create `.forgejo/workflows/build-android.yml` in your repo:

```yaml
name: Build Signed Android APK
on:
  workflow_dispatch:
  push:
    branches: [master]
    paths: ['client/**']

jobs:
  build:
    runs-on: docker
    container:
      image: node:20
    steps:
      - uses: actions/checkout@v4

      - name: Setup Java
        run: |
          apt-get update && apt-get install -y openjdk-17-jdk-headless
          echo "JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64" >> $GITHUB_ENV

      - name: Setup Android SDK
        run: |
          apt-get install -y wget unzip
          mkdir -p /opt/android-sdk/cmdline-tools
          cd /opt/android-sdk/cmdline-tools
          wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O tools.zip
          unzip -q tools.zip
          mv cmdline-tools latest
          rm tools.zip
          yes | /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager --licenses > /dev/null 2>&1
          /opt/android-sdk/cmdline-tools/latest/bin/sdkmanager "platform-tools" "platforms;android-34" "build-tools;34.0.0"
          echo "ANDROID_HOME=/opt/android-sdk" >> $GITHUB_ENV

      - name: Install dependencies
        working-directory: ./client
        run: npm ci

      - name: Expo prebuild
        working-directory: ./client
        run: npx expo prebuild --platform android --clean

      - name: Decode Keystore
        run: echo "${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 -d > client/rstify-release.keystore

      - name: Build Signed APK
        working-directory: ./client/android
        run: |
          chmod +x gradlew
          ./gradlew assembleRelease \
            -Pandroid.injected.signing.store.file=../rstify-release.keystore \
            -Pandroid.injected.signing.store.password=${{ secrets.KEYSTORE_PASSWORD }} \
            -Pandroid.injected.signing.key.alias=${{ secrets.KEY_ALIAS }} \
            -Pandroid.injected.signing.key.password=${{ secrets.KEY_PASSWORD }}

      # Note: Forgejo uses gitea/upload-artifact instead of actions/upload-artifact
      - name: Upload APK
        uses: actions/upload-artifact@v3
        with:
          name: rstify-release-signed.apk
          path: client/android/app/build/outputs/apk/release/*.apk
```

## Add Secrets in Forgejo

1. Go to your repo **Settings > Actions > Secrets**
2. Add the same 4 secrets:
   - `ANDROID_KEYSTORE_BASE64`
   - `KEYSTORE_PASSWORD`
   - `KEY_ALIAS`
   - `KEY_PASSWORD`

Same values as your GitHub secrets. Same keystore = interchangeable builds.

---

## Maintenance

### Backup
```bash
# Backup Forgejo data
tar czf forgejo-backup-$(date +%Y%m%d).tar.gz /home/ubuntu/docker/forgejo/data
```

### Update
```bash
docker compose pull
docker compose up -d
```

### Logs
```bash
docker logs forgejo
docker logs forgejo-runner
```

---

## Resource Usage

Forgejo is lightweight:
- **RAM:** ~150-250 MB
- **Disk:** ~500 MB base + your repos
- **CPU:** Minimal (spikes during CI/CD)

The runner + DinD use more resources during builds:
- **RAM:** ~1-2 GB during Android builds
- **Disk:** ~5 GB for Android SDK cache

---

## Comparison: Where to Build

After setup, you have 4 interchangeable build options:

| Method | Build Time | Queue | Cost |
|--------|-----------|-------|------|
| **Forgejo Actions** | ~8-15 min | None | Free (your VPS) |
| **GitHub Actions** | ~8 min | None | Free (2000 min/mo) |
| **EAS** | ~10 min | 5-30 min | Free tier limits |
| **Local** | ~3-5 min | None | Free |

All use the same keystore. All produce interchangeable APKs.

---

## DNS Setup Reminder

Add to your Cloudflare DNS:

```
Type: A
Name: git
Content: YOUR_VPS_IP
Proxy: Proxied (orange cloud)
```

Then the Traefik labels in docker-compose.yml handle HTTPS automatically.

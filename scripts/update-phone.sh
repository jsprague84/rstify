#!/bin/bash

# Quick script to build and install rstify on connected Android device
# Usage: ./scripts/update-phone.sh

set -e

echo "🏗️  Building Android APK via GitHub Actions..."

# Trigger build
RUN_URL=$(gh workflow run build-android.yml -f build_type=release 2>&1 | grep -o 'https://.*')
RUN_ID=$(echo "$RUN_URL" | grep -o '[0-9]*$')

echo "✅ Build started: $RUN_URL"
echo "⏳ Waiting for build to complete..."

# Wait for build to complete
gh run watch "$RUN_ID" --exit-status

echo "✅ Build complete!"
echo ""
echo "📥 Downloading APK..."

# Download artifact
gh run download "$RUN_ID"

# Find the APK
APK_PATH=$(find . -name "app-release-unsigned.apk" | head -1)

if [ -z "$APK_PATH" ]; then
    echo "❌ APK not found"
    exit 1
fi

echo "✅ APK downloaded: $APK_PATH"
echo ""

# Check if phone is connected
if adb devices | grep -q "device$"; then
    echo "📱 Phone detected! Installing..."
    adb install -r "$APK_PATH"
    echo "✅ Installed on phone!"
    echo ""
    echo "🚀 Opening rstify app..."
    adb shell am start -n cc.js_node.rstify/.MainActivity
else
    echo "⚠️  No phone connected via ADB"
    echo ""
    echo "📱 To install manually:"
    echo "1. Copy APK to phone: $APK_PATH"
    echo "2. Open file on phone"
    echo "3. Tap 'Install'"
    echo ""
    echo "Or connect phone via USB and run this script again"
fi

# Cleanup
rm -rf rstify-release-unsigned.apk

echo ""
echo "✅ Done!"

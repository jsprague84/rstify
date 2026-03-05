# rstify Quick Start Guide

**Get started with rstify in 5 minutes!**

---

## 🚀 For Users

### Web UI

**Access:** https://rstify.js-node.cc

**Create Account:**
1. Click "Register"
2. Enter username, password
3. Login

**Create Application:**
1. Go to "Applications"
2. Click "+ New Application"
3. Name it (e.g., "Home Server")
4. **Save the token!** (Format: `AP_xxxxxxxxxx`)

**Send Your First Message:**
```bash
export APP_TOKEN="AP_your_token_here"

curl -X POST https://rstify.js-node.cc/message \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -d '{
    "title": "Hello World",
    "message": "My first rstify message!",
    "priority": 5
  }'
```

**Send Markdown Message:**
```bash
curl -X POST https://rstify.js-node.cc/message \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -d '{
    "title": "Server Stats",
    "message": "| Service | Status |\n|:--|:--:|\n| API | ✅ |\n| DB | ✅ |",
    "extras": {"client::display": {"contentType": "text/markdown"}}
  }'
```

---

## 📱 Mobile App

### Option 1: Expo Go (Simplest)
1. Install **Expo Go** from App Store/Play Store
2. Update to latest version (2.33.0+)
3. Ask developer for QR code
4. Scan and open app

### Option 2: Development Build (Better)
1. Download APK from developer
2. Install on Android phone
3. Open app

### Test Features
```bash
# Send test messages to see all features
export APP_TOKEN="your_token"
./test_mobile_features.sh
```

---

## 🔧 For Developers

### Backend Setup

```bash
# Clone
git clone https://github.com/jsprague84/rstify
cd rstify

# Run with Docker
docker run -d \
  -p 8080:8080 \
  -v ./data:/data \
  ghcr.io/jsprague84/rstify:latest

# Or build from source
cargo build --release
./target/release/rstify
```

### Web UI Development

```bash
cd web-ui
npm install
npm run dev  # Development
npm run build  # Production
```

### Mobile Development

```bash
cd client
npm install

# Expo Go
npx expo start

# Development build
npx eas build --profile development --platform android
```

---

## 📖 Feature Examples

### Click URL
```bash
curl -X POST https://rstify.js-node.cc/message \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -d '{
    "title": "Build Complete",
    "message": "Click to view",
    "click_url": "https://github.com/user/repo"
  }'
```

### Custom Icon
```bash
curl -X POST https://rstify.js-node.cc/message \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -d '{
    "title": "Alert",
    "message": "Something happened",
    "icon_url": "https://example.com/icon.png"
  }'
```

### Action Buttons
```bash
curl -X POST https://rstify.js-node.cc/message \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -d '{
    "title": "Deployment Ready",
    "message": "Click to deploy",
    "actions": [
      {"action": "view", "label": "View", "url": "https://example.com"},
      {"action": "http", "label": "Deploy", "url": "https://api.example.com/deploy", "method": "POST"}
    ]
  }'
```

### Everything Combined
```bash
curl -X POST https://rstify.js-node.cc/message \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -d '{
    "title": "Feature Showcase",
    "message": "## Stats\n\n| Metric | Value |\n|:--|--:|\n| CPU | 45% |",
    "priority": 7,
    "click_url": "https://github.com",
    "icon_url": "https://em-content.zobj.net/thumbs/120/apple/325/rocket_1f680.png",
    "tags": ["test"],
    "extras": {"client::display": {"contentType": "text/markdown"}},
    "actions": [{"action": "view", "label": "Details", "url": "https://github.com"}]
  }'
```

---

## 📚 Documentation

- **USER_GUIDE.md** - Complete user reference
- **MESSAGE_FEATURES.md** - All message features with examples
- **TESTING_GUIDE.md** - How to test
- **API_AUTHENTICATION.md** - Authentication methods
- **REACT_NATIVE_IMPLEMENTATION.md** - Mobile app details
- **ACCOMPLISHMENTS.md** - What was built

---

## 🆘 Help

**Message not showing?**
- Check your app token is correct
- Verify you're logged in
- Check message was sent successfully (curl shows ID)

**Markdown not rendering?**
- Add `extras.client::display.contentType: "text/markdown"`
- Check markdown syntax is valid

**Icons not showing?**
- Verify URL is accessible
- Check image format (PNG/JPG/GIF)
- Try different URL

**Actions not working?**
- Verify actions array format
- Check each action has required fields
- Look for errors in console

**Mobile app won't connect?**
- Update Expo Go to latest version
- Use tunnel mode: `npx expo start --tunnel`
- Try development build instead

---

## 🎯 Quick Commands

```bash
# Set your token (do this once)
export APP_TOKEN="AP_your_token_here"

# Send basic message
curl -X POST https://rstify.js-node.cc/message \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -d '{"title": "Test", "message": "Hello"}'

# Test all mobile features
./test_mobile_features.sh

# Start mobile dev server
cd client && npx expo start

# Build mobile app
cd client && npx eas build --profile development --platform android
```

---

## 🏆 Why rstify?

✅ **100% Gotify compatible** - Works with existing clients
✅ **More features** - Topics, webhooks, attachments, tags
✅ **Better UX** - Markdown, dark mode, action buttons
✅ **Faster** - Optimized for <100ms responses
✅ **Secure** - 5/5 security headers
✅ **Open source** - MIT license
✅ **Self-hosted** - Your data, your server

**Ready to get started? Send your first message! 🚀**

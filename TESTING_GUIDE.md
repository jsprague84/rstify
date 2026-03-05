# rstify Testing Guide

Quick guide for testing all enhanced features in web UI and mobile app.

---

## Mobile App Testing (React Native)

### Prerequisites
1. **Expo Go app** installed on your phone (iOS/Android)
2. **Phone and computer** on same WiFi network
3. **App token** from rstify web UI

### Start Development Server

```bash
cd client
npx expo start
```

Scan QR code with Expo Go app.

### Send Test Messages

```bash
# Set your app token
export APP_TOKEN="AP_your_token_here"

# Run test script
./test_mobile_features.sh
```

### What to Test

#### ✅ Markdown Rendering
- [ ] Tables render with borders
- [ ] Column alignment works (left/center/right)
- [ ] Headers are bold
- [ ] Code blocks have background
- [ ] Links are tappable

#### ✅ Click URLs
- [ ] External link icon appears next to title
- [ ] Tapping message opens browser
- [ ] Haptic feedback on tap (vibration)
- [ ] Pressed state shows

#### ✅ Custom Icons
- [ ] Icons display (40x40 rounded)
- [ ] Emoji icons load
- [ ] Failed icons show default notification icon
- [ ] Icons cache (second view instant)

#### ✅ Action Buttons
- [ ] Buttons appear below message
- [ ] View actions open URLs
- [ ] HTTP actions show success toast
- [ ] Loading spinner during execution
- [ ] Haptic feedback on tap
- [ ] Buttons disabled while executing

#### ✅ Dark Mode
- [ ] Toggle device dark mode
- [ ] All text colors adapt
- [ ] Markdown styling adapts
- [ ] Icons/borders adapt
- [ ] No contrast issues

#### ✅ Performance
- [ ] Scrolling is smooth (60fps)
- [ ] No lag during markdown rendering
- [ ] Icons load quickly
- [ ] Actions execute quickly

---

## Web UI Testing

### Send Test Messages

```bash
export APP_TOKEN="AP_your_token_here"

# Markdown table
curl -X POST https://rstify.js-node.cc/message \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -d '{
    "title": "Web Test",
    "message": "| Feature | Status |\n|:--|:--:|\n| Markdown | ✅ |",
    "extras": {"client::display": {"contentType": "text/markdown"}}
  }'

# Click URL
curl -X POST https://rstify.js-node.cc/message \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -d '{
    "title": "Clickable",
    "message": "Click me!",
    "click_url": "https://github.com"
  }'

# Action buttons
curl -X POST https://rstify.js-node.cc/message \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -d '{
    "title": "Actions",
    "message": "Test buttons",
    "actions": [
      {"action": "view", "label": "Open", "url": "https://github.com"}
    ]
  }'
```

### What to Test

#### ✅ Web UI Features
- [ ] Markdown renders correctly
- [ ] Tables have borders and alignment
- [ ] Click URLs show link icon
- [ ] Clicking title opens URL
- [ ] Icons display next to messages
- [ ] Action buttons work
- [ ] Dark mode toggle works
- [ ] Toast notifications show

---

## Gotify Compatibility Testing

### Test with Gotify Client

Send message using Gotify format:

```bash
curl -X POST https://rstify.js-node.cc/message \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -d '{
    "title": "Gotify Compat",
    "message": "**Bold** *italic*",
    "priority": 5,
    "extras": {
      "client::display": {"contentType": "text/markdown"},
      "client::notification": {
        "click": {"url": "https://example.com"}
      },
      "android::action": {
        "actions": [
          {"type": "view", "label": "Open", "url": "https://example.com"}
        ]
      }
    }
  }'
```

**Expected:**
- [ ] Markdown renders
- [ ] Click URL from extras works
- [ ] Actions from android::action work
- [ ] All namespaces supported

---

## Feature Parity Checklist

### Backend → Frontend Utilization

| Feature | Backend | Web UI | Mobile | Notes |
|---------|---------|--------|--------|-------|
| Basic messages | ✅ | ✅ | ✅ | |
| Priority levels | ✅ | ✅ | ✅ | |
| Tags | ✅ | ✅ | ✅ | |
| Topics | ✅ | ✅ | ✅ | |
| Markdown | ✅ | ✅ | ✅ | NEW |
| Click URLs | ✅ | ✅ | ✅ | NEW |
| Icon URLs | ✅ | ✅ | ✅ | NEW |
| Actions (View) | ✅ | ✅ | ✅ | NEW |
| Actions (HTTP) | ✅ | ✅ | ✅ | NEW |
| Actions (Broadcast) | ✅ | ⚠️ | ⚠️ | Android only |
| Dark mode | ✅ | ✅ | ✅ | |
| Extras parsing | ✅ | ✅ | ✅ | |

**Current Status:**
- Backend: 100%
- Web UI: 95%
- Mobile: 95%

---

## Performance Testing

### Mobile App

```bash
# Send 50 messages rapidly
for i in {1..50}; do
  curl -X POST https://rstify.js-node.cc/message \
    -H "X-Gotify-Key: $APP_TOKEN" \
    -d "{\"title\": \"Test $i\", \"message\": \"Performance test message $i\"}" &
done
wait
```

**Check:**
- [ ] Scrolling stays at 60fps
- [ ] No memory leaks
- [ ] Images load quickly
- [ ] No crashes

### Web UI

Same test as above, check:
- [ ] Real-time updates work
- [ ] Scrolling smooth
- [ ] No performance degradation

---

## Troubleshooting

### Mobile App Issues

**Markdown not rendering?**
- Check `extras.client::display.contentType === "text/markdown"`
- Verify message has proper markdown syntax
- Check console for errors

**Click URLs not working?**
- Verify URL is valid (try in browser first)
- Check for HTTPS (some devices block HTTP)
- Look for Toast error messages

**Icons not loading?**
- Check URL is accessible
- Verify image format (PNG/JPG/GIF/SVG)
- Check console for CORS errors
- Try different icon URL

**Action buttons not appearing?**
- Verify actions array exists
- Check action format (must have `action`, `label`, `url`)
- Look for parsing errors in console

**App crashes?**
- Clear Metro cache: `npx expo start -c`
- Reinstall dependencies: `rm -rf node_modules && npm install`
- Check React Native debugger

### Web UI Issues

**Similar to mobile troubleshooting**
- Check browser console
- Verify network requests succeed
- Test in incognito mode (disable extensions)
- Try different browser

---

## Reporting Issues

If you find bugs, please report with:

1. **Environment:**
   - Device (iPhone 15, Pixel 8, etc.)
   - OS version (iOS 17, Android 14, etc.)
   - App version (check package.json)

2. **Steps to reproduce:**
   - Exact message JSON sent
   - What you expected
   - What actually happened

3. **Logs:**
   - Console errors
   - Network requests
   - Screenshots/screen recordings

**GitHub Issues:** https://github.com/jsprague84/rstify/issues

---

## Success Criteria

### Mobile App ✅
- [x] Markdown renders with tables
- [x] Click URLs work with haptics
- [x] Icons load and cache
- [x] Action buttons execute
- [x] Dark mode adapts
- [x] 60fps scrolling
- [x] Toast notifications
- [x] Gotify compatible

### Web UI ✅
- [x] All markdown features
- [x] Click URLs with icon
- [x] Custom icons
- [x] Action buttons
- [x] Dark mode toggle
- [x] Real-time updates

---

**Happy Testing! 🚀**

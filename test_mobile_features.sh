#!/bin/bash

# rstify Mobile App Feature Testing Script
# Tests all new features: Markdown, Click URLs, Icons, Actions

set -e

# Configuration
RSTIFY_URL="${RSTIFY_URL:-https://rstify.js-node.cc}"
APP_TOKEN="${APP_TOKEN}"

if [ -z "$APP_TOKEN" ]; then
    echo "❌ Error: APP_TOKEN environment variable is required"
    echo "Usage: APP_TOKEN=your_token_here ./test_mobile_features.sh"
    exit 1
fi

echo "🚀 Testing rstify Mobile App Features"
echo "Server: $RSTIFY_URL"
echo ""

# Test 1: Markdown Rendering
echo "📝 Test 1: Markdown Table Rendering..."
curl -X POST "$RSTIFY_URL/message" \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test 1: Markdown Table",
    "message": "## Server Status\n\n| Service | Status | Response Time |\n|:--|:--:|--:|\n| API | ✅ | 45ms |\n| Database | ✅ | 12ms |\n| Cache | ⚠️ | 150ms |\n\n**All systems operational**",
    "priority": 5,
    "extras": {
      "client::display": {
        "contentType": "text/markdown"
      }
    }
  }' -s | jq -r '.id // "Error"'
echo "✅ Sent markdown table message"
echo ""
sleep 1

# Test 2: Click URL
echo "🔗 Test 2: Click URL Support..."
curl -X POST "$RSTIFY_URL/message" \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test 2: Clickable Message",
    "message": "Tap this message to open GitHub!",
    "priority": 5,
    "click_url": "https://github.com/jsprague84/rstify"
  }' -s | jq -r '.id // "Error"'
echo "✅ Sent click URL message"
echo ""
sleep 1

# Test 3: Custom Icon
echo "🎨 Test 3: Custom Icon..."
curl -X POST "$RSTIFY_URL/message" \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test 3: Custom Icon",
    "message": "This message has a rocket icon 🚀",
    "priority": 5,
    "icon_url": "https://em-content.zobj.net/thumbs/120/apple/325/rocket_1f680.png"
  }' -s | jq -r '.id // "Error"'
echo "✅ Sent custom icon message"
echo ""
sleep 1

# Test 4: Action Buttons
echo "🎬 Test 4: Action Buttons..."
curl -X POST "$RSTIFY_URL/message" \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test 4: Action Buttons",
    "message": "Try tapping the action buttons below!",
    "priority": 5,
    "actions": [
      {
        "action": "view",
        "label": "View Repo",
        "url": "https://github.com/jsprague84/rstify"
      },
      {
        "action": "http",
        "label": "Test API",
        "url": "https://httpbin.org/post",
        "method": "POST"
      }
    ]
  }' -s | jq -r '.id // "Error"'
echo "✅ Sent action buttons message"
echo ""
sleep 1

# Test 5: Dark Mode (just for display)
echo "🌙 Test 5: Dark Mode Test..."
curl -X POST "$RSTIFY_URL/message" \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test 5: Dark Mode",
    "message": "Toggle dark mode in your device settings to see adaptive theming!",
    "priority": 3
  }' -s | jq -r '.id // "Error"'
echo "✅ Sent dark mode test message"
echo ""
sleep 1

# Test 6: Everything Combined
echo "🎉 Test 6: Feature Showcase (All Features)..."
curl -X POST "$RSTIFY_URL/message" \
  -H "X-Gotify-Key: $APP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test 6: Feature Showcase",
    "message": "## Success! 🎉\n\n| Feature | Status |\n|:--|:--:|\n| Markdown | ✅ |\n| Click URL | ✅ |\n| Custom Icon | ✅ |\n| Actions | ✅ |\n| Dark Mode | ✅ |\n\n**All features implemented!**",
    "priority": 7,
    "click_url": "https://github.com/jsprague84/rstify",
    "icon_url": "https://em-content.zobj.net/thumbs/120/apple/325/party-popper_1f389.png",
    "tags": ["test", "mobile", "showcase"],
    "extras": {
      "client::display": {
        "contentType": "text/markdown"
      }
    },
    "actions": [
      {
        "action": "view",
        "label": "View Repo",
        "url": "https://github.com/jsprague84/rstify"
      },
      {
        "action": "http",
        "label": "Test Success",
        "url": "https://httpbin.org/post",
        "method": "POST"
      }
    ]
  }' -s | jq -r '.id // "Error"'
echo "✅ Sent feature showcase message"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All test messages sent successfully!"
echo ""
echo "📱 Check your mobile app to see:"
echo "  1. Markdown table with borders and alignment"
echo "  2. Clickable message with link icon"
echo "  3. Message with rocket emoji icon"
echo "  4. Message with action buttons"
echo "  5. Dark mode compatibility message"
echo "  6. Combined feature showcase with 🎉 icon"
echo ""
echo "💡 Features to test:"
echo "  • Tap clickable messages to open URLs"
echo "  • Tap action buttons to test View/HTTP actions"
echo "  • Toggle device dark mode to see adaptive theming"
echo "  • Scroll to test 60fps performance"
echo "  • Check icons are cached (reload should be instant)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

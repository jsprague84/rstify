# Advanced Message Features

rstify supports all Gotify message features plus additional enhancements for rich, interactive notifications.

---

## Overview

Beyond basic text messages, rstify supports:
- ✅ **Markdown rendering** - Tables, formatting, lists
- ✅ **Click URLs** - Make messages clickable
- ✅ **Custom icons** - Add images or emojis
- ✅ **Action buttons** - Interactive buttons for View, HTTP, and Broadcast actions
- ✅ **Message extras** - Custom metadata and platform-specific features
- ✅ **Priority levels** - Visual indicators and sorting
- ✅ **Tags** - Organize and filter messages
- ✅ **File attachments** - Upload files up to 10MB

---

## Click URLs

Make your messages clickable to open external links.

### How It Works

When a message has a `click_url`, the title becomes a clickable link with an external link icon (↗).

### API Usage

```bash
curl -X POST https://rstify.example.com/message \
  -H "X-Gotify-Key: APP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Build #1234 Failed",
    "message": "Click to view details",
    "click_url": "https://ci.example.com/builds/1234"
  }'
```

### Example Use Cases

**CI/CD Notifications:**
```json
{
  "title": "Deploy Completed",
  "message": "Production deployment successful",
  "click_url": "https://github.com/user/repo/actions/runs/12345",
  "priority": 5
}
```

**Monitoring Alerts:**
```json
{
  "title": "High CPU Usage",
  "message": "Server load: 85%",
  "click_url": "https://grafana.example.com/d/cpu-dashboard",
  "priority": 8
}
```

**Order Notifications:**
```json
{
  "title": "New Order #5678",
  "message": "John Smith ordered 3 items",
  "click_url": "https://admin.example.com/orders/5678",
  "priority": 5
}
```

---

## Custom Icons

Add visual context with custom icons or images.

### How It Works

The `icon_url` field displays a small icon (40x40px) next to your message. Supports:
- Image URLs (PNG, JPG, GIF, SVG)
- Emoji (via Unicode or emoji URLs)
- App logos
- Status indicators

### API Usage

```bash
curl -X POST https://rstify.example.com/message \
  -H "X-Gotify-Key: APP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Payment Received",
    "message": "$50.00 from John Doe",
    "icon_url": "https://example.com/icons/payment-success.png"
  }'
```

### Example Use Cases

**Status Indicators:**
```json
{
  "title": "Server Status",
  "message": "All systems operational",
  "icon_url": "https://example.com/icons/green-check.png",
  "priority": 2
}
```

**App-Specific Icons:**
```json
{
  "title": "GitHub PR Merged",
  "message": "Pull request #42 was merged",
  "icon_url": "https://github.com/favicon.ico",
  "click_url": "https://github.com/user/repo/pull/42"
}
```

**Emoji Icons:**
```json
{
  "title": "Daily Reminder",
  "message": "Don't forget to backup!",
  "icon_url": "https://em-content.zobj.net/thumbs/120/apple/325/floppy-disk_1f4be.png"
}
```

---

## Action Buttons

Add interactive buttons to your messages for quick actions.

### Action Types

#### 1. View Action
Opens a URL in a new browser tab.

```json
{
  "title": "Deployment Ready",
  "message": "Click to view the staging environment",
  "extras": {
    "android::action": {
      "actions": [
        {
          "type": "view",
          "label": "View Site",
          "url": "https://staging.example.com"
        }
      ]
    }
  }
}
```

#### 2. HTTP Action
Makes an HTTP request when clicked (useful for approvals, triggers).

```json
{
  "title": "Deployment Awaiting Approval",
  "message": "Production deployment is ready",
  "extras": {
    "android::action": {
      "actions": [
        {
          "type": "http",
          "label": "Approve",
          "url": "https://api.example.com/deploys/123/approve",
          "method": "POST",
          "headers": {
            "Authorization": "Bearer TOKEN"
          }
        },
        {
          "type": "http",
          "label": "Reject",
          "url": "https://api.example.com/deploys/123/reject",
          "method": "POST"
        }
      ]
    }
  }
}
```

#### 3. Broadcast Action
Sends an Android intent (mobile only).

```json
{
  "title": "Smart Home Alert",
  "message": "Motion detected at front door",
  "extras": {
    "android::action": {
      "actions": [
        {
          "type": "broadcast",
          "label": "Turn On Lights",
          "intent": "com.example.smarthome.LIGHTS_ON",
          "extras": {
            "room": "entryway",
            "brightness": "100"
          }
        }
      ]
    }
  }
}
```

### Multiple Actions

You can add multiple buttons to a single message:

```json
{
  "title": "Server Alert: High Memory",
  "message": "Server memory usage at 90%",
  "priority": 7,
  "extras": {
    "android::action": {
      "actions": [
        {
          "type": "view",
          "label": "View Dashboard",
          "url": "https://grafana.example.com"
        },
        {
          "type": "http",
          "label": "Restart Service",
          "url": "https://api.example.com/services/restart",
          "method": "POST"
        },
        {
          "type": "http",
          "label": "Acknowledge",
          "url": "https://api.example.com/alerts/123/ack",
          "method": "POST"
        }
      ]
    }
  }
}
```

---

## Message Extras

The `extras` field allows custom metadata and platform-specific features.

### Supported Namespaces

#### client::display
Controls how the message is displayed.

```json
{
  "message": "| Metric | Value |\n|:--|--:|\n| CPU | 45% |",
  "extras": {
    "client::display": {
      "contentType": "text/markdown"
    }
  }
}
```

**Supported contentType values:**
- `text/markdown` - Render as markdown
- `text/plain` - Plain text (default)
- `text/html` - HTML (future support)

#### client::notification
Controls notification behavior.

```json
{
  "title": "Important Alert",
  "message": "System requires attention",
  "extras": {
    "client::notification": {
      "click": {
        "url": "https://example.com/alerts"
      },
      "bigImageUrl": "https://example.com/alert-screenshot.png"
    }
  }
}
```

**Supported fields:**
- `click.url` - URL to open when notification is clicked (same as top-level `click_url`)
- `bigImageUrl` - Large image for rich notifications (same as `icon_url` but can be bigger)

#### android::action
Android-specific actions and intents.

```json
{
  "title": "New Message",
  "message": "You have a new message",
  "extras": {
    "android::action": {
      "onReceive": {
        "intentUrl": "myapp://messages/new"
      },
      "actions": [
        {
          "type": "view",
          "label": "Read",
          "url": "https://example.com/messages"
        }
      ]
    }
  }
}
```

**Supported fields:**
- `onReceive.intentUrl` - Intent to trigger when notification is received
- `actions` - Array of action buttons

### Custom Extras

You can add your own custom fields for application-specific use:

```json
{
  "title": "Order Shipped",
  "message": "Your order has been shipped",
  "extras": {
    "client::display": {
      "contentType": "text/markdown"
    },
    "myapp::order": {
      "orderId": "12345",
      "trackingNumber": "1Z999AA10123456784",
      "estimatedDelivery": "2026-03-10"
    }
  }
}
```

---

## Markdown Rendering

Full GitHub Flavored Markdown support with tables, formatting, and more.

### Enabling Markdown

Set `extras.client::display.contentType` to `"text/markdown"`:

```json
{
  "title": "Daily Report",
  "message": "## Server Stats\n\n| Metric | Value |\n|:--|--:|\n| CPU | 45% |\n| RAM | 8GB |\n| Disk | 120GB |",
  "extras": {
    "client::display": {
      "contentType": "text/markdown"
    }
  }
}
```

### Supported Features

- **Tables** - With column alignment (`:--`, `--:`, `:--:`)
- **Headers** - `#`, `##`, `###`
- **Formatting** - **bold**, *italic*, ~~strikethrough~~
- **Lists** - Ordered and unordered
- **Links** - `[text](url)`
- **Code** - Inline `code` and ```code blocks```
- **Blockquotes** - `> quote`
- **Emojis** - 🟢 🟡 🔴 ✅ ❌

See [MARKDOWN_SUPPORT.md](./MARKDOWN_SUPPORT.md) for complete markdown documentation.

---

## Combining Features

All features can be combined for rich, interactive messages:

### Example: Complete Feature Showcase

```json
{
  "title": "Production Deployment Ready",
  "message": "## Deployment Summary\n\n| Service | Status | Version |\n|:--|:--:|--:|\n| API | ✅ | v2.1.0 |\n| Web | ✅ | v3.0.5 |\n| Worker | ✅ | v1.8.2 |\n\n**Ready to deploy to production.**",
  "priority": 7,
  "tags": ["deployment", "production"],
  "click_url": "https://ci.example.com/deploys/456",
  "icon_url": "https://example.com/icons/rocket.png",
  "extras": {
    "client::display": {
      "contentType": "text/markdown"
    },
    "android::action": {
      "actions": [
        {
          "type": "view",
          "label": "View Pipeline",
          "url": "https://ci.example.com/deploys/456"
        },
        {
          "type": "http",
          "label": "Deploy Now",
          "url": "https://api.example.com/deploys/456/execute",
          "method": "POST",
          "headers": {
            "Authorization": "Bearer YOUR_TOKEN"
          }
        },
        {
          "type": "http",
          "label": "Cancel",
          "url": "https://api.example.com/deploys/456/cancel",
          "method": "POST"
        }
      ]
    }
  }
}
```

**Renders as:**
- 🚀 Rocket icon (from `icon_url`)
- Clickable title linking to CI pipeline
- Markdown table showing service status
- Priority badge (P7 - orange/yellow)
- Tags: "deployment", "production"
- Three action buttons: "View Pipeline", "Deploy Now", "Cancel"

---

## Best Practices

### Click URLs
- ✅ Use for linking to detailed information
- ✅ Use HTTPS URLs
- ✅ Keep URLs readable and meaningful
- ❌ Don't use for sensitive actions (use HTTP actions instead)

### Icons
- ✅ Use 40x40px to 128x128px images
- ✅ Use PNG or SVG for best quality
- ✅ Use consistent icon style across your app
- ✅ Consider dark mode compatibility
- ❌ Don't use very large images (>200KB)

### Action Buttons
- ✅ Use clear, action-oriented labels ("Approve", "View", "Restart")
- ✅ Limit to 1-3 buttons per message
- ✅ Use HTTP actions for state-changing operations
- ✅ Include authentication headers for HTTP actions
- ❌ Don't use generic labels ("Click Here", "OK")
- ❌ Don't put sensitive data in URLs (use headers or POST body)

### Markdown
- ✅ Use tables for structured data
- ✅ Use headers for sections
- ✅ Test rendering before sending to users
- ✅ Keep mobile view in mind (tables can be wide)
- ❌ Don't use HTML (it's sanitized)
- ❌ Don't nest tables (not well supported)

### Combining Features
- ✅ Use icons + markdown for visual reports
- ✅ Use click URL + actions for multiple interaction points
- ✅ Use priority + actions for actionable alerts
- ❌ Don't overwhelm users with too many features in one message

---

## Gotify Compatibility

All features are **100% compatible** with Gotify's API:

| Feature | Gotify Format | rstify Support |
|---------|---------------|----------------|
| Click URL | `click_url` | ✅ Full |
| Icon URL | `icon_url` | ✅ Full |
| Actions | `extras.android::action.actions` | ✅ Full |
| Markdown | `extras.client::display.contentType` | ✅ Full |
| Big Image | `extras.client::notification.bigImageUrl` | ✅ Via `icon_url` |

Messages sent to Gotify will work in rstify, and vice versa!

---

## Platform Support

| Feature | Web UI | Android App | iOS App |
|---------|--------|-------------|---------|
| Markdown | ✅ | ⏳ Coming soon | ⏳ Coming soon |
| Click URL | ✅ | ⏳ Coming soon | ⏳ Coming soon |
| Icon URL | ✅ | ⏳ Coming soon | ⏳ Coming soon |
| View Actions | ✅ | ⏳ Coming soon | ⏳ Coming soon |
| HTTP Actions | ✅ | ⏳ Coming soon | ⏳ Coming soon |
| Broadcast Actions | N/A | ⏳ Coming soon | N/A |

---

## Examples by Use Case

### CI/CD Pipeline
```json
{
  "title": "Build #456 Failed",
  "message": "**Error:** Tests failed in `auth-service`\n\n```\nERROR: 3 tests failed\n```",
  "priority": 8,
  "click_url": "https://ci.example.com/builds/456",
  "icon_url": "https://example.com/icons/build-failed.png",
  "extras": {
    "client::display": {"contentType": "text/markdown"},
    "android::action": {
      "actions": [
        {"type": "view", "label": "View Logs", "url": "https://ci.example.com/builds/456/logs"},
        {"type": "http", "label": "Retry", "url": "https://api.example.com/builds/456/retry", "method": "POST"}
      ]
    }
  }
}
```

### Monitoring Alert
```json
{
  "title": "High CPU Usage",
  "message": "## Server: web-01\n\n| Metric | Value | Threshold |\n|:--|--:|--:|\n| CPU | 92% | 80% |\n| Load | 4.5 | 3.0 |",
  "priority": 7,
  "click_url": "https://grafana.example.com/d/server-cpu",
  "extras": {
    "client::display": {"contentType": "text/markdown"},
    "android::action": {
      "actions": [
        {"type": "http", "label": "Acknowledge", "url": "https://api.example.com/alerts/789/ack", "method": "POST"}
      ]
    }
  }
}
```

### E-commerce Order
```json
{
  "title": "New Order #12345",
  "message": "**Customer:** Jane Doe\n**Total:** $149.99\n**Items:** 3\n\n*Awaiting fulfillment*",
  "priority": 5,
  "click_url": "https://admin.example.com/orders/12345",
  "icon_url": "https://example.com/icons/shopping-cart.png",
  "extras": {
    "client::display": {"contentType": "text/markdown"},
    "android::action": {
      "actions": [
        {"type": "view", "label": "View Order", "url": "https://admin.example.com/orders/12345"},
        {"type": "http", "label": "Start Fulfillment", "url": "https://api.example.com/orders/12345/fulfill", "method": "POST"}
      ]
    }
  }
}
```

### Security Alert
```json
{
  "title": "🚨 Unauthorized Access Attempt",
  "message": "## Security Event\n\n- **IP:** 192.168.1.100\n- **Time:** 2026-03-04 14:23:45\n- **Service:** SSH\n- **Attempts:** 5\n\n**Action required!**",
  "priority": 10,
  "click_url": "https://security.example.com/events/999",
  "icon_url": "https://example.com/icons/security-alert.png",
  "extras": {
    "client::display": {"contentType": "text/markdown"},
    "android::action": {
      "actions": [
        {"type": "http", "label": "Block IP", "url": "https://api.example.com/firewall/block", "method": "POST", "body": "{\"ip\":\"192.168.1.100\"}"},
        {"type": "view", "label": "View Details", "url": "https://security.example.com/events/999"}
      ]
    }
  }
}
```

---

## Migration from Gotify

If you're migrating from Gotify, your existing messages **will work without changes**:

- ✅ All Gotify API endpoints work the same
- ✅ All message fields are supported
- ✅ All extras namespaces are recognized
- ✅ Actions work identically
- ✅ Markdown rendering is identical

Simply change your endpoint URL from Gotify to rstify!

---

## Troubleshooting

### Markdown Not Rendering?
- ✅ Check `extras.client::display.contentType === "text/markdown"`
- ✅ Verify message is valid markdown
- ✅ Check browser console for errors

### Click URL Not Working?
- ✅ Ensure `click_url` is a valid HTTPS URL
- ✅ Check popup blocker settings
- ✅ Verify URL is accessible

### Actions Not Showing?
- ✅ Check `extras.android::action.actions` is an array
- ✅ Verify each action has required fields (`type`, `label`, `url`)
- ✅ Check browser console for errors

### Icon Not Loading?
- ✅ Verify `icon_url` is accessible (try opening in browser)
- ✅ Check CORS settings on icon host
- ✅ Ensure image format is supported (PNG, JPG, GIF, SVG)

---

## API Reference

### Message Object (Complete)

```typescript
{
  // Required
  "message": string,

  // Optional - Basic
  "title"?: string,
  "priority"?: number,  // 0-10, default: 5

  // Optional - Organization
  "topic"?: string,
  "tags"?: string[],

  // Optional - Interactivity
  "click_url"?: string,
  "icon_url"?: string,

  // Optional - Metadata
  "content_type"?: string,
  "extras"?: {
    "client::display"?: {
      "contentType"?: "text/markdown" | "text/plain"
    },
    "client::notification"?: {
      "click"?: { "url": string },
      "bigImageUrl"?: string
    },
    "android::action"?: {
      "onReceive"?: { "intentUrl": string },
      "actions"?: Array<{
        "type": "view" | "http" | "broadcast",
        "label": string,
        "url"?: string,
        "method"?: string,
        "headers"?: Record<string, string>,
        "body"?: string,
        "intent"?: string,
        "extras"?: Record<string, string>
      }>
    },
    // Custom fields allowed
    [key: string]: any
  }
}
```

---

**For more information:**
- [MARKDOWN_SUPPORT.md](./MARKDOWN_SUPPORT.md) - Complete markdown guide
- [USER_GUIDE.md](./USER_GUIDE.md) - Full user documentation
- [API_AUTHENTICATION.md](./API_AUTHENTICATION.md) - Authentication methods

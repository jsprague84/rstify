# API Authentication Guide

## Overview

rstify supports **three different API styles** for maximum compatibility:

1. **Gotify API** - Full compatibility with Gotify servers
2. **ntfy API** - Compatible with ntfy publishing style
3. **rstify Enhanced API** - Additional features like webhooks and topics

Each API has different authentication requirements based on its design philosophy.

---

## 🔐 Authentication Methods

### Method 1: Application Tokens (Gotify-style)

**Format:** `AP_xxxxxxxxxxxxxxxxxxxxxxxxx`

**Usage:** Send messages on behalf of an application

```bash
curl -X POST https://rstify.js-node.cc/message \
  -H "X-Gotify-Key: AP_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{"title":"Hello","message":"Test message","priority":5}'
```

**When to use:**
- Sending messages from scripts/apps
- Gotify client compatibility
- Simple push notifications

---

### Method 2: Client Tokens (Gotify-style)

**Format:** `CL_xxxxxxxxxxxxxxxxxxxxxxxxx`

**Usage:** Receive messages via WebSocket streams

```bash
# WebSocket connection
wscat -c "wss://rstify.js-node.cc/stream?token=CL_your_token_here"
```

**When to use:**
- Receiving real-time notifications
- Gotify Android/iOS apps
- WebSocket subscriptions

---

### Method 3: JWT Bearer Tokens

**Format:** `eyJhbGciOiJIUzI1NiIs...` (standard JWT)

**Usage:** Admin operations and enhanced features

```bash
# Login to get JWT
curl -X POST https://rstify.js-node.cc/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"yourpassword"}'

# Use JWT for API calls
curl -X GET https://rstify.js-node.cc/api/stats \
  -H "Authorization: Bearer your_jwt_token_here"
```

**When to use:**
- User management
- Topic management
- Webhook configuration
- Statistics and monitoring
- Any `/api/*` endpoint

---

## 📡 API Comparison: Gotify vs ntfy vs rstify

### Gotify API (`/message`, `/application`, etc.)

**Authentication:** ✅ Required (App or Client tokens)

**Philosophy:** Secure, user-owned notification system

**Endpoints:**
```bash
# Authenticated with app token
POST /message                 # Send message
GET  /message                 # List messages
GET  /application             # List apps
POST /application             # Create app
GET  /stream?token=CLIENT     # WebSocket stream
```

**Example:**
```bash
curl -X POST https://rstify.js-node.cc/message \
  -H "X-Gotify-Key: AP_abc123..." \
  -d '{"title":"Alert","message":"Server down!"}'
```

**Why authentication is required:**
- Messages are user-specific
- Prevents spam
- Tracks which app sent what
- Enables per-user permissions

---

### ntfy API (`/{topic}`)

**Authentication in rstify:** ✅ Required for write operations

**Philosophy (original ntfy):** Open, public topic broadcasting

**Philosophy (rstify implementation):** Controlled topics with permissions

**Endpoints:**
```bash
# In rstify, requires authentication OR topic permissions
POST /{topic}                 # Publish to topic
PUT  /{topic}                 # Publish to topic
GET  /{topic}/json            # Subscribe to topic
```

**rstify Implementation:**
```bash
# Option 1: Use client token (authenticated)
curl -X POST https://rstify.js-node.cc/alerts \
  -H "Authorization: Bearer CL_your_token" \
  -H "Title: Alert" \
  -d "Server is down!"

# Option 2: Use app token
curl -X POST https://rstify.js-node.cc/alerts \
  -H "X-Gotify-Key: AP_your_token" \
  -H "Title: Alert" \
  -d "Server is down!"

# Option 3: Topic with everyoneWrite=true (no auth needed)
# (Topic must be configured to allow public writes)
curl -X POST https://rstify.js-node.cc/public-topic \
  -d "Public message"
```

---

## 🤔 Why rstify's ntfy API Requires Auth

### Original ntfy Design

**Pros:**
- Simple to use
- No account needed
- Great for quick notifications
- Public topics are useful

**Cons:**
- ⚠️ Anyone can publish to ANY topic
- ⚠️ Spam/abuse potential
- ⚠️ No message attribution
- ⚠️ No user-specific filtering

### rstify's Enhanced ntfy Design

**rstify adds authentication and permissions for security:**

1. **Controlled Access**
   - Prevent random internet users from spamming your topics
   - Know who sent what message
   - Enable audit trails

2. **Flexible Permissions**
   ```bash
   # Topics can be:
   everyoneRead: true   # Anyone can subscribe
   everyoneWrite: false # Only authorized users can publish
   ```

3. **Backward Compatible**
   - Can still create public topics (everyoneWrite: true)
   - Works with ntfy headers
   - Supports ntfy-style message formatting

---

## 🔓 Making Topics Public (ntfy-style)

If you want a topic to work like ntfy (no auth required for publishing):

### Step 1: Create Public Topic

```bash
curl -X POST https://rstify.js-node.cc/api/topics \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{
    "name": "public-alerts",
    "description": "Public topic, anyone can publish",
    "everyoneRead": true,
    "everyoneWrite": true
  }'
```

### Step 2: Publish Without Auth

```bash
# Now works without authentication!
curl -X POST https://rstify.js-node.cc/public-alerts \
  -H "Title: Public Alert" \
  -d "This works without auth!"
```

**⚠️ Security Warning:** Only use `everyoneWrite: true` for topics you want publicly accessible. Consider the spam implications!

---

## 📊 Feature Comparison Table

| Feature | Gotify API | ntfy API (rstify) | rstify Enhanced API |
|---------|-----------|-------------------|---------------------|
| **Authentication** | Required | Configurable | Required |
| **Message Format** | JSON | Text + Headers | JSON |
| **Applications** | ✅ Yes | ❌ No | ✅ Yes |
| **Topics** | ❌ No | ✅ Yes | ✅ Advanced |
| **Permissions** | User-based | Topic-based | Both |
| **Webhooks** | ❌ No | ❌ No | ✅ Yes |
| **Attachments** | ❌ No | ⚠️ Limited | ✅ 10MB |
| **WebSocket** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Use Case** | Personal notifications | Public/team broadcasts | Enterprise features |

---

## 🎯 Which API Should You Use?

### Use Gotify API (`/message`) when:
- ✅ Migrating from Gotify
- ✅ Using Gotify Android/iOS apps
- ✅ Simple application notifications
- ✅ Need per-app tracking

### Use ntfy API (`/{topic}`) when:
- ✅ Broadcasting to multiple subscribers
- ✅ Topic-based organization
- ✅ Using ntfy clients (with auth configured)
- ✅ Team/group notifications

### Use rstify Enhanced API (`/api/*`) when:
- ✅ Need webhooks
- ✅ Want file attachments
- ✅ Complex permissions
- ✅ User/topic management
- ✅ Statistics and monitoring

---

## 🔐 Security Best Practices

### 1. Token Management

```bash
# Application tokens - One per app/script
AP_xxx # Production API
AP_yyy # Monitoring scripts
AP_zzz # Test environment

# Client tokens - One per device/user
CL_xxx # Phone
CL_yyy # Desktop
CL_zzz # Tablet
```

### 2. Topic Permissions

```bash
# Private topic (default)
{
  "everyoneRead": false,
  "everyoneWrite": false
}

# Public read, controlled write
{
  "everyoneRead": true,
  "everyoneWrite": false
}

# Fully public (use cautiously!)
{
  "everyoneRead": true,
  "everyoneWrite": true
}
```

### 3. Audit Trail

Every message includes:
- `appid` - Which application sent it
- `user_id` - Which user (for authenticated requests)
- `created_at` - When it was sent

---

## 💡 Migration Guide

### From Gotify

✅ **No changes needed!** rstify is 100% Gotify-compatible.

```bash
# Your existing Gotify apps/scripts work as-is
curl -X POST https://rstify.js-node.cc/message \
  -H "X-Gotify-Key: YOUR_GOTIFY_TOKEN" \
  -d '{"message":"Still works!"}'
```

### From ntfy

⚠️ **Add authentication** OR create public topics

**Option 1: Add Authentication**
```bash
# Old ntfy way (won't work)
curl -X POST ntfy.sh/mytopic -d "Hello"

# rstify way with auth
curl -X POST rstify.js-node.cc/mytopic \
  -H "X-Gotify-Key: YOUR_TOKEN" \
  -d "Hello"
```

**Option 2: Create Public Topics**
```bash
# Create public topic (once)
curl -X POST rstify.js-node.cc/api/topics \
  -H "Authorization: Bearer JWT" \
  -d '{"name":"mytopic","everyoneWrite":true}'

# Then use like ntfy (no auth needed)
curl -X POST rstify.js-node.cc/mytopic \
  -d "Hello"
```

---

## 🆘 Common Authentication Errors

### Error: "No authentication token provided"

**Cause:** Endpoint requires authentication, none provided

**Solution:** Add one of:
```bash
-H "X-Gotify-Key: AP_xxx"           # App token
-H "Authorization: Bearer CL_xxx"   # Client token
-H "Authorization: Bearer JWT_xxx"  # JWT token
```

### Error: "Invalid credentials"

**Cause:** Wrong username/password for JWT login

**Solution:** Verify credentials:
```bash
curl -X POST https://rstify.js-node.cc/api/auth/login \
  -d '{"username":"correct_user","password":"correct_pass"}'
```

### Error: "Unauthorized" (401)

**Cause:** Token is invalid or expired

**Solutions:**
- Regenerate app/client token
- Login again to get new JWT (expires after 24h)
- Check token wasn't deleted

---

## 📖 Quick Reference

### Get JWT Token
```bash
curl -X POST https://rstify.js-node.cc/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user","password":"pass"}'
```

### Create Application (get app token)
```bash
curl -X POST https://rstify.js-node.cc/application \
  -H "Authorization: Bearer JWT" \
  -d '{"name":"My App"}'
```

### Create Client (get client token)
```bash
curl -X POST https://rstify.js-node.cc/client \
  -H "Authorization: Bearer JWT" \
  -d '{"name":"My Device"}'
```

### Send Message (Gotify way)
```bash
curl -X POST https://rstify.js-node.cc/message \
  -H "X-Gotify-Key: APP_TOKEN" \
  -d '{"title":"Test","message":"Hello"}'
```

### Send Message (ntfy way, with auth)
```bash
curl -X POST https://rstify.js-node.cc/mytopic \
  -H "X-Gotify-Key: APP_TOKEN" \
  -H "Title: Test" \
  -d "Hello"
```

### Create Public Topic (no auth needed to publish)
```bash
curl -X POST https://rstify.js-node.cc/api/topics \
  -H "Authorization: Bearer JWT" \
  -d '{"name":"public","everyoneWrite":true}'
```

---

## Summary

**rstify's authentication design**:

1. **Gotify API** - Always requires auth (backward compatible)
2. **ntfy API** - Requires auth by default, but topics can be made public
3. **Enhanced API** - Always requires JWT for admin operations

This design gives you the **best of both worlds**:
- ✅ Secure by default (no spam)
- ✅ Flexible permissions (can make topics public)
- ✅ Full audit trail (know who sent what)
- ✅ Backward compatible with Gotify
- ✅ Enhanced features beyond Gotify/ntfy

**Recommendation:** Use authentication for production systems. Only make topics public when you specifically need that ntfy-style behavior and understand the implications.

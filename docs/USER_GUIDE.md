# rstify User Guide

**Complete guide to using rstify - A Gotify-compatible notification server with enhanced features**

Version: 0.1.0
Last Updated: 2026-03-05

---

## 📖 Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Applications](#applications)
4. [Sending Messages](#sending-messages)
5. [Topics](#topics)
6. [Webhooks](#webhooks)
7. [File Attachments](#file-attachments)
8. [Receiving Messages](#receiving-messages)
9. [User Management](#user-management)
10. [Permissions](#permissions)
11. [API Reference](#api-reference)
12. [Mobile Apps](#mobile-apps)
13. [Best Practices](#best-practices)
14. [Troubleshooting](#troubleshooting)

---

## Introduction

### What is rstify?

**rstify** is a self-hosted notification server that:
- ✅ Is **100% compatible** with Gotify clients and apps
- ✅ Adds **webhooks** for receiving external notifications
- ✅ Supports **file attachments** up to 10MB
- ✅ Provides **advanced topics** with permissions
- ✅ Offers **ntfy-style** publishing for flexibility
- ✅ Includes **dark mode** web UI
- ✅ Built with **Rust** for performance and safety

### Key Features

| Feature | Description |
|---------|-------------|
| **Messages** | Send and receive push notifications |
| **Applications** | Organize notifications by app |
| **Topics** | Broadcast messages to multiple subscribers |
| **Webhooks** | Receive notifications from external services |
| **Attachments** | Include files with messages |
| **Permissions** | Fine-grained access control |
| **WebSocket** | Real-time message delivery |
| **Web UI** | Modern interface with dark mode |
| **Mobile Apps** | Android app (iOS compatible) |

---

## Getting Started

### 1. Access the Web UI

Open your browser and navigate to:
```
https://your-rstify-instance.com
```

### 2. Login

Use your credentials to login. Default admin account (change immediately!):
- **Username:** admin
- **Password:** (set during installation)

### 3. Create Your First Application

1. Click **Applications** in the sidebar
2. Click **"+ New Application"**
3. Fill in:
   - **Name:** My App (e.g., "Home Server")
   - **Description:** Optional description
   - **Default Priority:** 5 (1=lowest, 10=highest)
4. Click **Create**
5. **Save the token!** (Format: `AP_xxxxxxxxxx`)

You'll use this token to send messages.

---

## Applications

### What are Applications?

Applications are the primary way to organize notifications. Each application:
- Has its own unique token
- Can send messages
- Has a default priority
- Can have a custom icon

### Creating an Application

**Via Web UI:**
1. Navigate to **Applications**
2. Click **"+ New Application"**
3. Fill in details
4. Copy the generated token

**Via API:**
```bash
curl -X POST https://your-rstify.com/application \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My App",
    "description": "My application notifications",
    "defaultPriority": 5
  }'
```

**Response:**
```json
{
  "id": 1,
  "name": "My App",
  "token": "AP_abc123xyz789...",
  "default_priority": 5
}
```

### Managing Applications

**List all applications:**
```bash
curl https://your-rstify.com/application \
  -H "Authorization: Bearer YOUR_JWT"
```

**Update application:**
```bash
curl -X PUT https://your-rstify.com/application/{id} \
  -H "Authorization: Bearer YOUR_JWT" \
  -d '{"name":"Updated Name"}'
```

**Delete application:**
```bash
curl -X DELETE https://your-rstify.com/application/{id} \
  -H "Authorization: Bearer YOUR_JWT"
```

⚠️ **Warning:** Deleting an application deletes all its messages!

---

## Sending Messages

### Basic Message

**Using Application Token:**
```bash
curl -X POST https://your-rstify.com/message \
  -H "X-Gotify-Key: AP_your_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Hello World",
    "message": "This is my first notification!",
    "priority": 5
  }'
```

### Message Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `title` | string | No | Message title |
| `message` | string | **Yes** | Message body |
| `priority` | number | No | 1-10 (default: 5) |
| `click_url` | string | No | URL to open when clicked |
| `icon_url` | string | No | Custom icon/image URL |
| `tags` | array | No | Tags for filtering |
| `extras` | object | No | Custom metadata and features |

For advanced features (markdown, actions, etc.), see [MESSAGE_FEATURES.md](./MESSAGE_FEATURES.md).

### Priority Levels

| Priority | Meaning | Use Case |
|----------|---------|----------|
| 0 | No notification | Silent logging |
| 1-3 | Low | Info, debug messages |
| 4-6 | Normal | Regular notifications |
| 7-8 | High | Important alerts |
| 9-10 | Emergency | Critical alerts |

### Advanced Message Options

**Full message example:**
```bash
curl -X POST https://your-rstify.com/message \
  -H "X-Gotify-Key: AP_token" \
  -d '{
    "title": "Server Alert",
    "message": "CPU usage exceeded 90%",
    "priority": 8,
    "extras": {
      "server": "web-01",
      "cpu": "92%",
      "timestamp": "2026-03-05T10:30:00Z"
    }
  }'
```

### Interactive Features

#### Click URLs

Make messages clickable by adding a `click_url`:

```bash
curl -X POST https://your-rstify.com/message \
  -H "X-Gotify-Key: AP_token" \
  -d '{
    "title": "Build Failed",
    "message": "Click to view details",
    "click_url": "https://ci.example.com/builds/123"
  }'
```

When clicked, the title becomes a link that opens in a new tab.

#### Custom Icons

Add visual context with `icon_url`:

```bash
curl -X POST https://your-rstify.com/message \
  -H "X-Gotify-Key: AP_token" \
  -d '{
    "title": "Payment Received",
    "message": "$50.00 from John Doe",
    "icon_url": "https://example.com/icons/payment.png"
  }'
```

#### Action Buttons

Add interactive buttons to messages:

```bash
curl -X POST https://your-rstify.com/message \
  -H "X-Gotify-Key: AP_token" \
  -d '{
    "title": "Deployment Ready",
    "message": "Click to deploy or cancel",
    "extras": {
      "android::action": {
        "actions": [
          {
            "type": "view",
            "label": "View Details",
            "url": "https://ci.example.com"
          },
          {
            "type": "http",
            "label": "Deploy",
            "url": "https://api.example.com/deploy",
            "method": "POST"
          }
        ]
      }
    }
  }'
```

**Action types:**
- **view**: Opens a URL in browser
- **http**: Makes an HTTP request (for approvals, triggers)
- **broadcast**: Sends Android intent (mobile only)

#### Markdown Rendering

Format messages with markdown:

```bash
curl -X POST https://your-rstify.com/message \
  -H "X-Gotify-Key: AP_token" \
  -d '{
    "title": "Server Stats",
    "message": "## Daily Report\n\n| Metric | Value |\n|:--|--:|\n| CPU | 45% |\n| RAM | 8GB |",
    "extras": {
      "client::display": {
        "contentType": "text/markdown"
      }
    }
  }'
```

**Supported markdown:**
- Tables with alignment
- Headers (# ## ###)
- **Bold**, *italic*, ~~strikethrough~~
- Lists, links, code blocks
- Emojis 🚀 ✅ ❌

See [MESSAGE_FEATURES.md](./MESSAGE_FEATURES.md) for complete documentation of all interactive features.

### ntfy-Style Publishing

**Simple text message:**
```bash
curl -X POST https://your-rstify.com/alerts \
  -H "X-Gotify-Key: AP_token" \
  -H "Title: Server Down" \
  -H "Priority: high" \
  -H "Tags: alert,urgent" \
  -d "The web server is not responding!"
```

**ntfy headers supported:**
- `Title:` - Message title
- `Priority:` - min, low, default, high, urgent
- `Tags:` - Comma-separated tags
- `Click:` - URL to open when clicked

---

## Topics

### What are Topics?

Topics allow **broadcasting** messages to multiple subscribers:
- Multiple apps can publish to a topic
- Multiple clients can subscribe to a topic
- Flexible permissions (read/write)
- Public or private

### Creating a Topic

**Via Web UI:**
1. Navigate to **Topics**
2. Click **"+ New Topic"**
3. Fill in:
   - **Name:** alerts
   - **Description:** Server alerts
   - **Everyone Read:** true/false
   - **Everyone Write:** true/false
4. Click **Create**

**Via API:**
```bash
curl -X POST https://your-rstify.com/api/topics \
  -H "Authorization: Bearer JWT" \
  -d '{
    "name": "server-alerts",
    "description": "Production server alerts",
    "everyoneRead": true,
    "everyoneWrite": false
  }'
```

### Publishing to Topics

**Using topic name:**
```bash
curl -X POST https://your-rstify.com/server-alerts \
  -H "X-Gotify-Key: AP_token" \
  -H "Title: Alert" \
  -d "Server CPU high!"
```

**Using topic API:**
```bash
curl -X POST https://your-rstify.com/api/topics/server-alerts/publish \
  -H "Authorization: Bearer JWT" \
  -d '{
    "title": "Alert",
    "message": "Server CPU high!"
  }'
```

### Topic Permissions

**Permission Matrix:**

| Setting | Who can read? | Who can write? |
|---------|---------------|----------------|
| `everyoneRead: false`<br/>`everyoneWrite: false` | Only owner | Only owner |
| `everyoneRead: true`<br/>`everyoneWrite: false` | Anyone | Only authorized users |
| `everyoneRead: true`<br/>`everyoneWrite: true` | Anyone | Anyone |

**Granting specific user permissions:**
```bash
curl -X POST https://your-rstify.com/api/permissions \
  -H "Authorization: Bearer JWT" \
  -d '{
    "userId": 2,
    "topicPattern": "server-*",
    "canRead": true,
    "canWrite": true
  }'
```

**Topic patterns:**
- `server-*` - All topics starting with "server-"
- `*-alerts` - All topics ending with "-alerts"
- `team/*` - All topics under "team/"

---

## Webhooks

### What are Webhooks?

Webhooks let you receive notifications from external services:
- Receive from GitHub, GitLab, Jenkins, etc.
- Transform webhook payloads into messages
- Route to specific topics or applications
- Template-based message formatting

### Creating a Webhook

**Via Web UI:**
1. Navigate to **Webhooks**
2. Click **"+ New Webhook"**
3. Fill in:
   - **Name:** GitHub Webhook
   - **Type:** Incoming
   - **Target:** Choose topic or application
   - **Template:** Define message format
4. Copy the webhook URL

**Via API:**
```bash
curl -X POST https://your-rstify.com/api/webhooks \
  -H "Authorization: Bearer JWT" \
  -d '{
    "name": "GitHub Webhook",
    "webhookType": "incoming",
    "targetTopicId": 1,
    "template": {
      "title": "{{repository.name}} - {{action}}",
      "message": "{{sender.login}} {{action}} {{pull_request.title}}",
      "priority": 5
    }
  }'
```

**Response:**
```json
{
  "id": 1,
  "token": "WH_abc123xyz...",
  "name": "GitHub Webhook"
}
```

**Webhook URL:**
```
https://your-rstify.com/api/wh/WH_abc123xyz...
```

### Template Syntax

**Access nested fields:**
```json
{
  "title": "{{repository.name}}",
  "message": "{{sender.login}} pushed to {{ref}}"
}
```

**Example GitHub webhook payload:**
```json
{
  "repository": {"name": "myapp"},
  "sender": {"login": "john"},
  "ref": "refs/heads/main"
}
```

**Resulting message:**
```json
{
  "title": "myapp",
  "message": "john pushed to refs/heads/main"
}
```

### Common Webhook Sources

**GitHub:**
```bash
# In GitHub repo settings > Webhooks
Payload URL: https://your-rstify.com/api/wh/WH_token
Content type: application/json
Events: Push, Pull Request, Issues
```

**GitLab:**
```bash
# In GitLab project > Settings > Webhooks
URL: https://your-rstify.com/api/wh/WH_token
Trigger: Push events, Merge requests
```

**Jenkins:**
```bash
# In Jenkins job configuration
Notification Endpoint: https://your-rstify.com/api/wh/WH_token
Format: JSON
```

**Testing webhooks:**
```bash
curl -X POST https://your-rstify.com/api/wh/WH_token \
  -H "Content-Type: application/json" \
  -d '{
    "repository": {"name": "test-repo"},
    "action": "opened",
    "sender": {"login": "testuser"}
  }'
```

---

## File Attachments

### Uploading Files

**Upload a file to a message:**
```bash
curl -X POST https://your-rstify.com/api/messages/{id}/attachments \
  -H "Authorization: Bearer JWT" \
  -F "file=@/path/to/document.pdf"
```

**Response:**
```json
{
  "id": 1,
  "message_id": 123,
  "filename": "document.pdf",
  "content_type": "application/pdf",
  "size_bytes": 54321,
  "created_at": "2026-03-05T10:30:00Z"
}
```

### Downloading Files

**Via API:**
```bash
curl https://your-rstify.com/api/attachments/{id} \
  -o downloaded-file.pdf
```

**Via Web UI:**
- Click on the message
- Click the attachment link
- File downloads automatically

### Supported File Types

| Type | Extensions | Max Size |
|------|------------|----------|
| Images | PNG, JPG, GIF, WebP | 10MB |
| Documents | PDF, DOCX, TXT, MD | 10MB |
| Videos | MP4, WebM | 10MB |
| Audio | MP3, OGG, WAV | 10MB |
| Archives | ZIP, TAR, GZ | 10MB |
| Other | Any file | 10MB |

### Best Practices

✅ **Do:**
- Compress large files before uploading
- Use descriptive filenames
- Delete old attachments to save space

❌ **Don't:**
- Upload sensitive data without encryption
- Exceed 10MB limit
- Upload executables (.exe, .sh) unless necessary

---

## Receiving Messages

### Web UI

**Real-time notifications:**
1. Login to web UI
2. Keep browser tab open
3. Messages appear instantly via WebSocket
4. Desktop notifications (if enabled)

### WebSocket Stream

**Connect to WebSocket:**
```javascript
const ws = new WebSocket(
  'wss://your-rstify.com/stream?token=CL_your_client_token'
);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('New message:', message.title);
};
```

**Client token:**
Create via Web UI or API:
```bash
curl -X POST https://your-rstify.com/client \
  -H "Authorization: Bearer JWT" \
  -d '{"name":"My Device"}'
```

### Server-Sent Events (SSE)

**Subscribe to topic via SSE:**
```bash
curl -N https://your-rstify.com/api/topics/alerts/sse \
  -H "Authorization: Bearer CL_token"
```

**In JavaScript:**
```javascript
const source = new EventSource(
  'https://your-rstify.com/api/topics/alerts/sse'
);

source.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log(message);
};
```

### Mobile Apps

**Android:**
1. Install rstify Android app
2. Add server: `https://your-rstify.com`
3. Enter client token
4. Receive push notifications

**iOS:**
- Use Gotify iOS app (compatible)
- Configure same as Android

---

## User Management

### Creating Users

**Via Web UI (Admin only):**
1. Navigate to **Users**
2. Click **"+ New User"**
3. Fill in:
   - Username
   - Email (optional)
   - Password
   - Admin checkbox
4. Click **Create**

**Via API:**
```bash
curl -X POST https://your-rstify.com/user \
  -H "Authorization: Bearer ADMIN_JWT" \
  -d '{
    "username": "john",
    "email": "john@example.com",
    "password": "secure_password",
    "isAdmin": false
  }'
```

### User Roles

| Role | Permissions |
|------|-------------|
| **Admin** | Full access: users, apps, topics, webhooks |
| **User** | Own apps, messages, topics (if allowed) |

### Changing Password

**Self-service:**
```bash
curl -X POST https://your-rstify.com/current/user/password \
  -H "Authorization: Bearer JWT" \
  -d '{
    "currentPassword": "old_pass",
    "newPassword": "new_pass"
  }'
```

**Admin reset (via API):**
```bash
curl -X PUT https://your-rstify.com/user/{id} \
  -H "Authorization: Bearer ADMIN_JWT" \
  -d '{"password": "new_password"}'
```

---

## Permissions

### Topic Permissions

**Grant user permission:**
```bash
curl -X POST https://your-rstify.com/api/permissions \
  -H "Authorization: Bearer JWT" \
  -d '{
    "userId": 2,
    "topicPattern": "team-*",
    "canRead": true,
    "canWrite": true
  }'
```

**Permission patterns:**
```
team-*          # team-alerts, team-updates, etc.
prod/*          # prod/alerts, prod/errors
*-critical      # Any topic ending with -critical
alerts          # Exact match only
```

### Application Ownership

- Applications belong to the user who created them
- Only owner can delete or modify
- Admin can manage all applications

---

## API Reference

### Authentication

**JWT Login:**
```bash
POST /api/auth/login
{
  "username": "user",
  "password": "pass"
}

Response:
{
  "token": "eyJhbGci..."
}
```

**Using Tokens:**
```bash
# Application token
-H "X-Gotify-Key: AP_token"

# Client token (WebSocket)
?token=CL_token

# JWT token
-H "Authorization: Bearer JWT_token"
```

### Messages

```bash
# Create message
POST /message
-H "X-Gotify-Key: AP_token"
Body: {"title":"Hi","message":"Hello","priority":5}

# List messages
GET /message
-H "Authorization: Bearer JWT"

# Delete message
DELETE /message/{id}
-H "Authorization: Bearer JWT"
```

### Applications

```bash
# List applications
GET /application
-H "Authorization: Bearer JWT"

# Create application
POST /application
-H "Authorization: Bearer JWT"
Body: {"name":"App","defaultPriority":5}

# Update application
PUT /application/{id}
-H "Authorization: Bearer JWT"
Body: {"name":"New Name"}

# Delete application
DELETE /application/{id}
-H "Authorization: Bearer JWT"
```

### Topics

```bash
# List topics
GET /api/topics
-H "Authorization: Bearer JWT"

# Create topic
POST /api/topics
-H "Authorization: Bearer JWT"
Body: {"name":"alerts","everyoneRead":true}

# Publish to topic
POST /{topic}
-H "X-Gotify-Key: AP_token"
Body: "Message text"

# Subscribe to topic (WebSocket)
GET /api/topics/{topic}/ws?token=CL_token
```

### Webhooks

```bash
# Create webhook
POST /api/webhooks
-H "Authorization: Bearer JWT"
Body: {
  "name":"My Webhook",
  "webhookType":"incoming",
  "targetTopicId":1,
  "template":{"title":"{{title}}"}
}

# Send to webhook
POST /api/wh/{token}
Body: {"title":"Alert","message":"Test"}
```

### Attachments

```bash
# Upload attachment
POST /api/messages/{id}/attachments
-H "Authorization: Bearer JWT"
-F "file=@image.png"

# Download attachment
GET /api/attachments/{id}
```

### Health & Stats

```bash
# Health check
GET /health
Response: {"health":"green","database":"ok"}

# Version info
GET /version
Response: {"version":"0.1.0","name":"rstify"}

# Statistics (admin)
GET /api/stats
-H "Authorization: Bearer JWT"
Response: {
  "users":10,
  "topics":5,
  "messages":1234
}
```

---

## Mobile Apps

### Android App

**Installation:**
1. Download from [GitHub Releases](https://github.com/your-repo/releases)
2. Or build from source in `/client`

**Configuration:**
1. Open app
2. Tap "+" to add server
3. Enter:
   - **Server URL:** https://your-rstify.com
   - **Name:** My Server (optional)
4. Login with username/password OR
5. Enter client token (recommended)

**Features:**
- ✅ Push notifications
- ✅ Message history
- ✅ Dark mode
- ✅ Custom sounds per app
- ✅ Priority-based alerts

### iOS Support

**Use Gotify iOS app:**
- Available on App Store
- 100% compatible with rstify
- Same configuration as Android

---

## Best Practices

### Security

1. **Use Strong Passwords**
   - Min 12 characters
   - Mix uppercase, lowercase, numbers, symbols

2. **Rotate Tokens Regularly**
   ```bash
   # Delete old application, create new one
   # Update scripts with new token
   ```

3. **Limit Admin Accounts**
   - Create admin only when needed
   - Use regular accounts for daily use

4. **Use HTTPS**
   - Never use HTTP in production
   - Enable HSTS headers

5. **Restrict Topic Permissions**
   - Set `everyoneWrite: false` for important topics
   - Grant permissions only to trusted users

### Performance

1. **Clean Up Old Messages**
   ```bash
   # Delete messages older than 30 days
   DELETE /message?before=2026-02-01
   ```

2. **Limit Message Size**
   - Keep messages under 1KB when possible
   - Use attachments for large content

3. **Use Appropriate Priorities**
   - Don't use priority 10 for everything
   - Reserve high priorities for true alerts

4. **Batch Operations**
   ```bash
   # Instead of 100 individual messages
   # Send one message with summary
   ```

### Organization

1. **Application Naming**
   - Use clear, descriptive names
   - Example: "Home-Server", "CI-Pipeline", "Website-Monitoring"

2. **Topic Structure**
   - Use hierarchical names: `prod/alerts`, `dev/logs`
   - Group related topics

3. **Message Formatting**
   ```json
   {
     "title": "[PROD] Database Alert",
     "message": "Connection pool exhausted\n\nServer: db-01\nPool size: 20/20\nWaiting: 15"
   }
   ```

---

## Troubleshooting

### Common Issues

**Issue: "No authentication token provided"**
```bash
# Solution: Add authentication header
-H "X-Gotify-Key: AP_token"
# OR
-H "Authorization: Bearer JWT_token"
```

**Issue: Messages not appearing**
1. Check WebSocket connection (browser console)
2. Verify client token is valid
3. Check message was sent to correct application/topic

**Issue: Webhook not working**
1. Verify webhook URL is correct
2. Check template syntax
3. Test with curl:
   ```bash
   curl -X POST https://your-rstify.com/api/wh/TOKEN \
     -d '{"test":"data"}'
   ```

**Issue: File upload fails**
- Check file size < 10MB
- Verify authentication
- Check disk space on server

### Debugging

**Enable debug logs:**
```bash
RUST_LOG=debug ./rstify-server
```

**Check database:**
```bash
sqlite3 rstify.db "SELECT COUNT(*) FROM messages"
```

**Test connectivity:**
```bash
curl https://your-rstify.com/health
```

### Getting Help

1. Check documentation: `/docs`
2. GitHub issues: https://github.com/your-repo/issues
3. Check logs: `journalctl -u rstify -f`

---

## Quick Reference

### Essential Commands

```bash
# Login
curl -X POST https://rstify.com/api/auth/login \
  -d '{"username":"user","password":"pass"}'

# Create app
curl -X POST https://rstify.com/application \
  -H "Authorization: Bearer JWT" \
  -d '{"name":"MyApp"}'

# Send message
curl -X POST https://rstify.com/message \
  -H "X-Gotify-Key: AP_token" \
  -d '{"title":"Test","message":"Hello"}'

# Create topic
curl -X POST https://rstify.com/api/topics \
  -H "Authorization: Bearer JWT" \
  -d '{"name":"alerts","everyoneRead":true}'

# Create webhook
curl -X POST https://rstify.com/api/webhooks \
  -H "Authorization: Bearer JWT" \
  -d '{
    "name":"GitHub",
    "webhookType":"incoming",
    "targetTopicId":1,
    "template":{"title":"{{repository.name}}"}
  }'
```

### Token Formats

- Application: `AP_xxxxxxxxxxxxxxxxxxxxxxxx`
- Client: `CL_xxxxxxxxxxxxxxxxxxxxxxxx`
- Webhook: `WH_xxxxxxxxxxxxxxxxxxxxxxxx`
- JWT: `eyJhbGciOiJIUzI1NiIs...` (long)

---

## Appendix

### Environment Variables

```bash
DATABASE_URL=sqlite://./rstify.db
RUST_LOG=info
HOST=0.0.0.0
PORT=8080
UPLOAD_DIR=./uploads
JWT_SECRET=your-secret-key-here
```

### File Locations

```
/opt/rstify/
├── rstify-server          # Main binary
├── rstify.db              # SQLite database
├── uploads/               # File attachments
└── config.toml            # Configuration (optional)
```

### Default Ports

- HTTP: 8080
- HTTPS: 8443 (with reverse proxy)
- WebSocket: Same as HTTP

---

**End of User Guide**

For more information:
- GitHub: https://github.com/your-repo/rstify
- Documentation: https://your-rstify.com/docs
- API Docs: https://your-rstify.com/swagger-ui

Happy notifying! 🚀

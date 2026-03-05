# Markdown Support in rstify

## Overview

rstify now supports **markdown rendering** for messages, just like Gotify! When a message includes markdown content, it will be beautifully rendered with proper formatting for tables, headers, lists, and more.

---

## How It Works

### Detection

rstify automatically detects markdown messages using the same method as Gotify:

```json
{
  "message": "**Bold text** | Header |\n|:--|\n| Cell |",
  "extras": {
    "client::display": {
      "contentType": "text/markdown"
    }
  }
}
```

When `extras["client::display"].contentType === "text/markdown"`, the message is rendered as markdown.

---

## Supported Markdown Features

### ✅ Tables (Your Use Case!)

```markdown
| Metric | R/G Limit | Value | Status |
|:--|--:|--:|:--:|
| NOx (lb/ton) | 4.00 | 0.00 | 🟩 |
| Kiln Opacity | 5.00 | 0.00 | 🟩 |
```

**Renders as:**
- Proper HTML table with borders
- Column alignment (left, right, center)
- Headers in bold with gray background
- Dark mode support

### ✅ Text Formatting

```markdown
**Bold text**
*Italic text*
~~Strikethrough~~
`inline code`
```

### ✅ Headers

```markdown
# Header 1
## Header 2
### Header 3
```

### ✅ Lists

```markdown
- Unordered list
- Item 2

1. Ordered list
2. Item 2
```

### ✅ Links

```markdown
[Link text](https://example.com)
```

### ✅ Blockquotes

```markdown
> This is a quote
> Multi-line quote
```

### ✅ Code Blocks

````markdown
```javascript
const x = 10;
```
````

### ✅ Emojis

```markdown
🟩 🟥 ✅ ❌ 🚀 📊
```

---

## Styling

The markdown renderer includes beautiful styling for both light and dark modes:

### Tables
- **Light mode:** Gray borders, white background
- **Dark mode:** Dark gray borders, dark background
- Column alignment preserved (`:--`, `--:`, `:--:`)
- Proper spacing and padding

### Colors
- Links: Blue (light/dark adaptive)
- Code: Gray background
- Headers: Bold, sized appropriately
- Strong emphasis: Bold text

---

## Example: Your CEMS Report

**Your message:**
```json
{
  "title": "DAV CEMS Daily Red/Green",
  "message": "| Metric | R/G Limit | Value | Status |\n|:--|--:|--:|:--:|\n| NOx | 4.00 | 0.00 | 🟩 |",
  "extras": {
    "client::display": {
      "contentType": "text/markdown"
    }
  }
}
```

**Renders as:**
- Properly formatted HTML table
- Right-aligned numbers
- Center-aligned status emojis
- Clean, readable layout
- Dark mode compatible

---

## Implementation Details

### Files Modified

1. **`web-ui/src/components/MessageContent.tsx`** (new)
   - Smart component that detects markdown
   - Renders markdown or plain text
   - Custom styling for all elements

2. **`web-ui/src/pages/Messages.tsx`**
   - Updated to use `MessageContent` component
   - Passes `extras` field to renderer

3. **`web-ui/src/api/types.ts`**
   - Added `extras?: Record<string, any>` to `MessageResponse`

4. **`web-ui/package.json`**
   - Added `react-markdown` - Core markdown renderer
   - Added `remark-gfm` - GitHub Flavored Markdown (tables!)
   - Added `rehype-sanitize` - Security (XSS prevention)

---

## Security

Markdown rendering includes **sanitization** to prevent XSS attacks:

✅ HTML tags are escaped
✅ Scripts are blocked
✅ Only safe markdown is rendered
✅ Links open in new tab with `rel="noopener noreferrer"`

---

## Backward Compatibility

**Plain text messages still work!**

If `extras["client::display"].contentType` is NOT set to `"text/markdown"`, messages display as plain text with preserved whitespace (same as before).

---

## API Usage

### Sending Markdown Messages

**cURL:**
```bash
curl -X POST https://your-rstify.com/message \
  -H "X-Gotify-Key: APP_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Daily Report",
    "message": "| Metric | Value |\n|:--|--:|\n| CPU | 45% |\n| RAM | 8GB |",
    "priority": 5,
    "extras": {
      "client::display": {
        "contentType": "text/markdown"
      }
    }
  }'
```

**JavaScript:**
```javascript
const message = {
  title: "Daily Report",
  message: `| Metric | Value |
|:--|--:|
| CPU | 45% |
| RAM | 8GB |`,
  priority: 5,
  extras: {
    "client::display": {
      contentType: "text/markdown"
    }
  }
};

fetch('https://your-rstify.com/message', {
  method: 'POST',
  headers: {
    'X-Gotify-Key': 'APP_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(message)
});
```

**Python:**
```python
import requests

message = {
    "title": "Daily Report",
    "message": """| Metric | Value |
|:--|--:|
| CPU | 45% |
| RAM | 8GB |""",
    "priority": 5,
    "extras": {
        "client::display": {
            "contentType": "text/markdown"
        }
    }
}

requests.post(
    'https://your-rstify.com/message',
    headers={'X-Gotify-Key': 'APP_TOKEN'},
    json=message
)
```

---

## Comparison: Before vs After

### Before (Plain Text)
```
| Metric | R/G Limit | Value | Status |
|:--|--:|--:|:--:|
| NOx (lb/ton) | 4.00 | 0.00 | 🟩 |
| Kiln Opacity | 5.00 | 0.00 | 🟩 |
```

### After (Rendered Markdown)
```
┌─────────────────┬───────────┬─────────┬──────────┐
│ Metric          │ R/G Limit │   Value │  Status  │
├─────────────────┼───────────┼─────────┼──────────┤
│ NOx (lb/ton)    │      4.00 │    0.00 │    🟩    │
│ Kiln Opacity    │      5.00 │    0.00 │    🟩    │
└─────────────────┴───────────┴─────────┴──────────┘
```
*(Actual rendering is HTML table with proper styling)*

---

## Testing

### Test Your Existing Message

Your CEMS report message already has the correct format! Simply resend it to rstify and it will now render beautifully as a table.

### Quick Test

```bash
curl -X POST https://rstify.js-node.cc/message \
  -H "X-Gotify-Key: YOUR_TOKEN" \
  -d '{
    "title": "Test Table",
    "message": "| A | B |\n|:--|--:|\n| Left | Right |",
    "extras": {
      "client::display": {
        "contentType": "text/markdown"
      }
    }
  }'
```

---

## Additional Features

### GitHub Flavored Markdown (GFM)

Thanks to `remark-gfm`, you get:
- ✅ Tables (with alignment)
- ✅ Strikethrough (`~~text~~`)
- ✅ Task lists (`- [ ]` and `- [x]`)
- ✅ Autolinks (`www.example.com`)

### Dark Mode

All markdown elements have dark mode variants:
- Tables: Dark gray borders and backgrounds
- Code: Dark background with light text
- Links: Light blue for visibility
- Text: Proper contrast ratios

---

## Gotify Compatibility

**100% Compatible!**

rstify uses the exact same `extras["client::display"].contentType` convention as Gotify, so:

✅ Messages sent to Gotify render correctly
✅ Messages sent to rstify render correctly
✅ Same API, same format, same rendering
✅ Can migrate between Gotify and rstify seamlessly

---

## Troubleshooting

### Table Not Rendering?

**Check:**
1. ✅ Message has `extras` field
2. ✅ `extras["client::display"].contentType === "text/markdown"`
3. ✅ Table syntax is correct (pipe separators)
4. ✅ Header separator row exists (`|:--|--:|`)

### Alignment Not Working?

**Separator syntax:**
- Left: `|:--|`
- Right: `|--:|`
- Center: `|:--:|`

**Example:**
```markdown
| Left | Center | Right |
|:--|:--:|--:|
| L | C | R |
```

### Dark Mode Issues?

Refresh the page after toggling dark mode to ensure styles apply correctly.

---

## Future Enhancements

Potential additions:
- 📊 Chart rendering from data
- 🎨 Syntax highlighting for code blocks
- 📷 Inline images
- 🔢 Math equations (LaTeX)
- 📋 Collapsible sections

---

## Summary

**What Changed:**
- ✅ Added markdown rendering library
- ✅ Detects markdown via `extras` field
- ✅ Beautiful table formatting (like Gotify)
- ✅ Dark mode support
- ✅ Security (sanitization)
- ✅ Backward compatible

**Impact:**
- 🎨 Your CEMS reports now display as proper tables!
- 📊 Rich formatting for all messages
- 🔄 100% Gotify compatible
- ✨ Better user experience

**Your CEMS report will now look amazing in rstify!** 🎉

---

**Ready to use!** Just rebuild and deploy the web UI:

```bash
cd web-ui
npm run build
# Copy dist/ to your server
```

The feature is already built and ready! ✅

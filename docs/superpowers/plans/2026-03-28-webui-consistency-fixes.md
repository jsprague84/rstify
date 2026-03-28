# WebUI + API Consistency Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all code consistency, quality, and design system issues identified in the WebUI code review — type mismatches, missing error handling, ignored fields, and shared component extraction.

**Architecture:** Work through the web UI (`web-ui/src/`) fixing issues from foundational (shared utilities, types) to page-level (error handling, feature gaps). Each task is independent and produces a working commit.

**Tech Stack:** React 19, TypeScript, Vite 6, TailwindCSS, react-markdown + remark-gfm + rehype-sanitize

---

## File Map

### New Files
- `web-ui/src/utils/webhookHelpers.ts` — `parseWebhookHeaders()` utility
- `web-ui/src/components/PriorityBadge.tsx` — Shared priority badge component

### Modified Files
- `web-ui/src/components/MessageContent.tsx` — Add `contentType` prop for `content_type` field
- `web-ui/src/components/Modal.tsx` — Add overflow/max-height for long content
- `web-ui/src/pages/Messages.tsx` — Fix `parseActions` to check `message.actions` first
- `web-ui/src/pages/Topics.tsx` — Add try/catch error handling, use PriorityBadge
- `web-ui/src/pages/Applications.tsx` — Fix import ordering, add try/catch, use PriorityBadge
- `web-ui/src/pages/Users.tsx` — Add try/catch error handling
- `web-ui/src/pages/Bridges.tsx` — Add try/catch error handling
- `web-ui/src/pages/Webhooks.tsx` — Use `parseWebhookHeaders`, add template to edit form, add `forgejo` type option

---

## Task 1: Create parseWebhookHeaders Utility

**Files:**
- Create: `web-ui/src/utils/webhookHelpers.ts`
- Modify: `web-ui/src/pages/Webhooks.tsx`

The `WebhookConfig.headers` is stored as a JSON string but used as `Record<string,string>` in create/update. `JSON.parse` is scattered across multiple places. Centralize it.

- [ ] **Step 1: Create the utility file**

```typescript
// web-ui/src/utils/webhookHelpers.ts

/**
 * Parse webhook headers from the stored JSON string format
 * to a Record<string,string> for use in forms and API calls.
 */
export function parseWebhookHeaders(headers: string | undefined | null): Record<string, string> {
  if (!headers) return {};
  try {
    return JSON.parse(headers);
  } catch {
    return {};
  }
}

/**
 * Parse webhook topics from stored JSON string to string array.
 * Used by MQTT bridge topics which are stored as JSON arrays.
 */
export function parseJsonArray(json: string | undefined | null): string[] {
  if (!json) return [];
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Replace inline JSON.parse calls in Webhooks.tsx**

In `web-ui/src/pages/Webhooks.tsx`, add import:

```typescript
import { parseWebhookHeaders } from '../utils/webhookHelpers';
```

Find `handleDuplicate` (around line 54). Replace:
```typescript
headers: w.headers ? tryParseHeaders(w.headers) : undefined,
```
With:
```typescript
headers: Object.keys(parseWebhookHeaders(w.headers)).length > 0 ? parseWebhookHeaders(w.headers) : undefined,
```

Find the CodeGenerator invocation (around line 342) that has the inline `try { return JSON.parse(codeWh.headers!); } catch { return {}; }`. Replace with:
```typescript
headers={parseWebhookHeaders(codeWh?.headers)}
```

Also find `tryParseHeaders` if it exists as a local function and remove it in favor of the imported utility.

- [ ] **Step 3: Replace inline JSON.parse in Bridges.tsx**

In `web-ui/src/pages/Bridges.tsx`, add import:

```typescript
import { parseJsonArray } from '../utils/webhookHelpers';
```

Find the `parseTopics` function (around line 42):
```typescript
const parseTopics = (json: string | undefined): string[] => {
  if (!json) return [];
  try { return JSON.parse(json); } catch { return []; }
};
```

Replace all calls to `parseTopics(...)` with `parseJsonArray(...)` and remove the local `parseTopics` function.

- [ ] **Step 4: Verify build**

Run: `cd web-ui && npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/utils/webhookHelpers.ts web-ui/src/pages/Webhooks.tsx web-ui/src/pages/Bridges.tsx
git commit -m "refactor(webui): extract parseWebhookHeaders and parseJsonArray utilities"
```

---

## Task 2: Fix MessageActions — Check message.actions Field

**Files:**
- Modify: `web-ui/src/pages/Messages.tsx`

The `parseActions` function only checks `extras` but ignores the top-level `message.actions` array. Messages published via topic API with actions set directly are silently dropped.

- [ ] **Step 1: Update parseActions to accept full message**

Find `parseActions` (around line 385). Replace the entire function:

```typescript
function getMessageActions(message: MessageResponse): any[] | null {
  // Check top-level actions field first (set via topic publish API)
  if (message.actions && message.actions.length > 0) {
    return message.actions;
  }

  const extras = message.extras;
  if (!extras) return null;

  // Try android::action format (Gotify compatibility)
  if (extras['android::action']?.actions) {
    return extras['android::action'].actions;
  }

  // Try direct actions array in extras (rstify format)
  if (Array.isArray(extras.actions)) {
    return extras.actions;
  }

  return null;
}
```

- [ ] **Step 2: Update MessageActions component to use new function**

Find the `MessageActions` component (around line 329). Replace the guard and actions extraction:

```typescript
function MessageActions({ message }: { message: MessageResponse }) {
  const { toast } = useToast();
  const [executing, setExecuting] = useState<string | null>(null);

  const actions = getMessageActions(message);
  if (!actions || actions.length === 0) return null;

  // ... rest of handleAction and render stays the same
```

Remove the old redundant check:
```typescript
// DELETE THIS:
if (!message.extras?.['android::action']?.actions && !parseActions(message.extras)) {
  return null;
}
const actions = parseActions(message.extras);
```

- [ ] **Step 3: Verify build**

Run: `cd web-ui && npm run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/pages/Messages.tsx
git commit -m "fix(webui): check message.actions field in MessageActions component"
```

---

## Task 3: Fix MessageContent — Add content_type Support

**Files:**
- Modify: `web-ui/src/components/MessageContent.tsx`
- Modify: `web-ui/src/pages/Messages.tsx`
- Modify: `web-ui/src/pages/Topics.tsx`
- Modify: `web-ui/src/pages/Applications.tsx`

Same fix as mobile — detect markdown via `content_type` field, not just extras.

- [ ] **Step 1: Update MessageContent props and detection**

In `web-ui/src/components/MessageContent.tsx`, update the interface:

```typescript
interface MessageContentProps {
  message: string;
  extras?: Record<string, any>;
  contentType?: string | null;
}
```

Update the component signature and markdown detection:

```typescript
export default function MessageContent({ message, extras, contentType }: MessageContentProps) {
  const isMarkdown =
    contentType === 'text/markdown' ||
    extras?.['client::display']?.contentType === 'text/markdown';
```

- [ ] **Step 2: Update call sites to pass contentType**

In `Messages.tsx`, find where `<MessageContent>` is rendered (around line 212). Add the prop:

```tsx
<MessageContent message={m.message} extras={m.extras} contentType={m.content_type} />
```

In `Topics.tsx`, find where `<MessageContent>` is rendered (around line 315). Add:

```tsx
<MessageContent message={m.message} extras={m.extras} contentType={m.content_type} />
```

In `Applications.tsx`, find where `<MessageContent>` is rendered (around line 137). Add:

```tsx
<MessageContent message={m.message} extras={m.extras} contentType={m.content_type} />
```

- [ ] **Step 3: Verify build**

Run: `cd web-ui && npm run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/components/MessageContent.tsx web-ui/src/pages/Messages.tsx web-ui/src/pages/Topics.tsx web-ui/src/pages/Applications.tsx
git commit -m "fix(webui): detect markdown via content_type field as fallback"
```

---

## Task 4: Extract Shared PriorityBadge Component

**Files:**
- Create: `web-ui/src/components/PriorityBadge.tsx`
- Modify: `web-ui/src/pages/Messages.tsx`
- Modify: `web-ui/src/pages/Topics.tsx`
- Modify: `web-ui/src/pages/Applications.tsx`

Priority badge logic is duplicated inline in 3 pages with inconsistent dark mode colors.

- [ ] **Step 1: Create PriorityBadge component**

```tsx
// web-ui/src/components/PriorityBadge.tsx

interface PriorityBadgeProps {
  priority: number;
}

export default function PriorityBadge({ priority }: PriorityBadgeProps) {
  const cls =
    priority >= 8
      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
      : priority >= 5
        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';

  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${cls}`}>
      P{priority}
    </span>
  );
}
```

- [ ] **Step 2: Replace inline priority badges in Messages.tsx**

Find the local `PriorityBadge` function component in Messages.tsx (around line 401). Remove it. Add import at the top:

```typescript
import PriorityBadge from '../components/PriorityBadge';
```

- [ ] **Step 3: Replace inline priority rendering in Topics.tsx**

Find where priority is rendered inline in the `renderMessage` function (around line 312). Replace with:

```tsx
<PriorityBadge priority={m.priority} />
```

Add import:
```typescript
import PriorityBadge from '../components/PriorityBadge';
```

- [ ] **Step 4: Replace inline priority rendering in Applications.tsx**

Find where priority is rendered inline in the app messages list (around line 135). Replace with:

```tsx
<PriorityBadge priority={m.priority} />
```

Add import:
```typescript
import PriorityBadge from '../components/PriorityBadge';
```

- [ ] **Step 5: Verify build**

Run: `cd web-ui && npm run build`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add web-ui/src/components/PriorityBadge.tsx web-ui/src/pages/Messages.tsx web-ui/src/pages/Topics.tsx web-ui/src/pages/Applications.tsx
git commit -m "refactor(webui): extract shared PriorityBadge component"
```

---

## Task 5: Fix Modal Overflow for Long Content

**Files:**
- Modify: `web-ui/src/components/Modal.tsx`

Modals with many fields (webhook forms, topic policy editor) can extend below the viewport.

- [ ] **Step 1: Add max-height and overflow to modal container**

In `web-ui/src/components/Modal.tsx`, find the inner div (around line 28):

```tsx
<div ref={ref} className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
```

Replace with:

```tsx
<div ref={ref} className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6 max-h-[85vh] overflow-y-auto">
```

- [ ] **Step 2: Verify build**

Run: `cd web-ui && npm run build`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/components/Modal.tsx
git commit -m "fix(webui): add max-height and overflow to Modal for long content"
```

---

## Task 6: Add Error Handling to All Page Handlers

**Files:**
- Modify: `web-ui/src/pages/Topics.tsx`
- Modify: `web-ui/src/pages/Applications.tsx`
- Modify: `web-ui/src/pages/Users.tsx`
- Modify: `web-ui/src/pages/Bridges.tsx`

All four pages have async handlers (handleCreate, handleUpdate, handleDelete) that lack try/catch. If the API call fails, the error silently propagates and the modal/dialog state gets stuck.

- [ ] **Step 1: Fix Topics.tsx handlers**

Replace the three handlers:

```typescript
const handleCreate = async (data: CreateTopic) => {
  try {
    await api.createTopic(data);
    setShowCreate(false);
    load();
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Failed to create topic');
  }
};

const handleUpdate = async (data: Record<string, any>) => {
  if (!editTopic) return;
  try {
    await api.updateTopic(editTopic.name, data);
    setEditTopic(null);
    load();
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Failed to update topic');
  }
};

const handleDelete = async () => {
  if (!deleteTopic) return;
  try {
    await api.deleteTopic(deleteTopic.name);
    setDeleteTopic(null);
    load();
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Failed to delete topic');
  }
};
```

Ensure `error` state and the error display div already exist (they should from the existing `setError` pattern). If not, add:

```typescript
const [error, setError] = useState('');
```

And in the JSX before the DataTable:

```tsx
{error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded text-sm mb-4">{error}</div>}
```

- [ ] **Step 2: Fix Applications.tsx handlers**

Same pattern — wrap handleCreate, handleUpdate, handleDelete in try/catch with `setError`. The `error` state and display already exist in this file.

- [ ] **Step 3: Fix Users.tsx handlers**

Same pattern for handleCreate, handleUpdate, handleDelete.

- [ ] **Step 4: Fix Bridges.tsx handlers**

Same pattern for handleCreate, handleUpdate, handleDelete.

- [ ] **Step 5: Fix Applications.tsx import ordering**

Move the imports at lines 27-30 (DataTable, Modal, ConfirmDialog, TokenDisplay) to the top of the file, after the other imports.

- [ ] **Step 6: Verify build**

Run: `cd web-ui && npm run build`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add web-ui/src/pages/Topics.tsx web-ui/src/pages/Applications.tsx web-ui/src/pages/Users.tsx web-ui/src/pages/Bridges.tsx
git commit -m "fix(webui): add try/catch error handling to all page CRUD handlers"
```

---

## Task 7: Add Webhook Template to Edit Form

**Files:**
- Modify: `web-ui/src/pages/Webhooks.tsx`

The webhook template field exists in the create form and `UpdateWebhookConfig` type but the edit form never sends it, silently dropping edits.

- [ ] **Step 1: Add template field to edit form state**

Find the edit form initialization (where `setForm` is called when opening edit). Ensure `template` is included:

```typescript
template: webhook.template || '',
```

- [ ] **Step 2: Add template textarea to edit form JSX**

Find the edit form fields. After the body_template field, add:

```tsx
<div>
  <label className={labelCls}>Template (JSON)</label>
  <textarea
    value={form.template}
    onChange={e => setForm(f => ({ ...f, template: e.target.value }))}
    className={`${inputCls} min-h-[80px] font-mono text-xs`}
    placeholder='{"title": "{{.Title}}", "message": "{{.Message}}"}'
  />
</div>
```

- [ ] **Step 3: Include template in the update API call**

Find the edit form submit handler. Ensure `template` is passed to `api.updateWebhook`:

```typescript
template: form.template,
```

- [ ] **Step 4: Verify build**

Run: `cd web-ui && npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/pages/Webhooks.tsx
git commit -m "fix(webui): include webhook template field in edit form"
```

---

## Verification Checklist

After all tasks complete:

- [ ] `cd web-ui && npm run build` — zero errors
- [ ] `parseWebhookHeaders` used in Webhooks.tsx (no inline JSON.parse for headers)
- [ ] `parseJsonArray` used in Bridges.tsx (no local parseTopics function)
- [ ] `getMessageActions` checks `message.actions` before `extras`
- [ ] `MessageContent` accepts `contentType` prop, all 3 call sites pass it
- [ ] `PriorityBadge` imported in Messages, Topics, Applications (no inline priority logic)
- [ ] `Modal` has `max-h-[85vh] overflow-y-auto`
- [ ] Topics, Applications, Users, Bridges all have try/catch on CRUD handlers
- [ ] Applications.tsx imports are at top of file
- [ ] Webhook edit form includes template field

# Phase 3: Frontend Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove repeated async/form/CRUD boilerplate across 11 web-ui pages and 5 mobile hub screens by introducing shared hooks and composable UI primitives.

**Architecture:** Web-ui gets two hooks (`useAsyncAction`, `useCrudResource`) that own all async state, plus `FormField`/`FormModal` components that own form submission. Pages become declarative orchestrators of modal state + layout. Mobile gets an equivalent `useHubData` hook and shared cache helpers for Zustand stores. Webhooks pages on both platforms get split into sub-components.

**Tech Stack:** React 19, TypeScript, Vite (web-ui); React Native 0.83, Expo SDK 55, NativeWind v4, Zustand, MMKV (mobile)

**Note:** Frontend component tests are deferred to Phase 4 per spec. This plan focuses on implementation, not test coverage.

**Deferred:** `CrudPageLayout` (spec 3b) is explicitly optional/opt-in. Skip it for now — if the pattern proves useful after migrating several pages, it can be added as a follow-up. Don't build a composition helper until we know the exact shape.

### Execution Rules

1. **No double reload:** `useCrudResource.mutate()` already reloads after success. Page-level `onSubmit` handlers inside `FormModal` must NOT call `crud.reload()` manually — let `mutate()` own the reload.
2. **Stable `fetchAll` references:** The `fetchAll` argument to `useCrudResource` must be wrapped in `useCallback` or defined outside the render function. An inline arrow function creates a new reference every render, causing infinite reload loops via useEffect.
3. **FormModal owns its own async state** internally rather than consuming `useAsyncAction`. This keeps form submission behavior self-contained and avoids prop-threading.
4. **Error display locations:** Page-level errors (`crud.error`) display as a banner at the top of the page. Modal submission errors display inside the `FormModal`. These are separate concerns.
5. **Each page migration committed independently.** Verify the build passes before proceeding to the next page. If a migration introduces regressions, revert that single page and continue with others.
6. **Webhooks stopping condition:** If the Webhooks refactor (Task 10) becomes complex or unstable, stop after applying `useCrudResource` + removing try-catch duplication. Component extraction can be a follow-up.

---

## File Structure

### New files to create

```
web-ui/src/
├── hooks/
│   ├── useAsyncAction.ts         # Loading/error state for one-off async ops
│   └── useCrudResource.ts        # List lifecycle + mutation wrappers
├── components/
│   ├── FormField.tsx              # Label + input/select/textarea + error display
│   └── FormModal.tsx              # Modal + form submit + loading/error (uses useAsyncAction)
└── utils/
    └── normalizeError.ts          # Unknown → string error normalization

client/src/
├── hooks/
│   └── useHubData.ts             # Fetch lifecycle + mutation wrapper for hub screens
├── utils/
│   └── cache.ts                  # Shared MMKV cache helpers
└── components/webhooks/
    ├── WebhookList.tsx            # Webhook list with group headers
    ├── WebhookForm.tsx            # Create/edit form (both directions)
    └── WebhookDetail.tsx          # Logs + test + code gen modals
```

### Files to modify

**Web-ui pages (all 11):** Replace inline useState/try-catch with hook usage. Replace inline form markup with FormField/FormModal.

**Web-ui API client:** `web-ui/src/api/client.ts` — add `changePassword()` method.

**Mobile hub screens (5):** Replace inline fetch/error/loading with `useHubData`. Replace manual cache patterns with shared helpers.

**Mobile stores (4):** Replace manual `loadFromCache`/`saveToCache` with shared `cache.ts` helpers.

---

## Task 1: Create error normalization utility and useAsyncAction hook

**Files:**
- Create: `web-ui/src/utils/normalizeError.ts`
- Create: `web-ui/src/hooks/useAsyncAction.ts`

- [ ] **Step 1: Create normalizeError utility**

```typescript
// web-ui/src/utils/normalizeError.ts

/**
 * Normalize an unknown thrown value into a user-facing error string.
 * Centralizes the `err instanceof Error ? err.message : String(err)` pattern
 * duplicated across every page handler.
 */
export function normalizeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'An unexpected error occurred';
}
```

- [ ] **Step 2: Create useAsyncAction hook**

```typescript
// web-ui/src/hooks/useAsyncAction.ts
import { useState, useCallback } from 'react';
import { normalizeError } from '../utils/normalizeError';

interface AsyncAction<T> {
  /** Run the given async function, tracking loading/error state. Returns the result or undefined on failure. */
  execute: (fn: () => Promise<T>) => Promise<T | undefined>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Lightweight hook for one-off async operations (password change, webhook test, publish).
 * Manages loading + error state for a single action without the full CRUD lifecycle.
 *
 * Usage:
 *   const action = useAsyncAction<TestResult>();
 *   const result = await action.execute(() => api.testWebhook(id));
 */
export function useAsyncAction<T = void>(): AsyncAction<T> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async (fn: () => Promise<T>): Promise<T | undefined> => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn();
      return result;
    } catch (e) {
      setError(normalizeError(e));
      return undefined;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { execute, loading, error, clearError };
}
```

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/utils/normalizeError.ts web-ui/src/hooks/useAsyncAction.ts
git commit -m "feat(web-ui): add normalizeError utility and useAsyncAction hook"
```

---

## Task 2: Create useCrudResource hook

**Files:**
- Create: `web-ui/src/hooks/useCrudResource.ts`

- [ ] **Step 1: Create useCrudResource hook**

```typescript
// web-ui/src/hooks/useCrudResource.ts
import { useState, useCallback, useEffect } from 'react';
import { normalizeError } from '../utils/normalizeError';

interface CrudResource<T> {
  /** The current list of items. */
  items: T[];
  /** True during initial load or reload. */
  loading: boolean;
  /** Page-level error message (from load or mutation failures). */
  error: string | null;
  /** Re-fetch the list from the API. */
  reload: () => Promise<void>;
  /** Wrap a mutation (create/update/delete): runs fn, reloads on success, sets error on failure. Returns true on success. */
  mutate: (fn: () => Promise<void>) => Promise<boolean>;
  /** Clear the current error. */
  clearError: () => void;
}

/**
 * Manages CRUD resource lifecycle: load list, expose loading/error/reload,
 * and wrap mutations with consistent error handling and reload semantics.
 *
 * Does NOT manage: modal state, selection state, filtering/sorting UI, form shape.
 *
 * Usage:
 *   // fetchAll must be stable — wrap in useCallback or define outside render
 *   const fetchClients = useCallback(() => api.listClients(), []);
 *   const crud = useCrudResource(fetchClients);
 *   // crud.items, crud.loading, crud.error, crud.reload
 *   // const ok = await crud.mutate(() => api.deleteClient(id));
 */
export function useCrudResource<T>(fetchAll: () => Promise<T[]>): CrudResource<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAll();
      setItems(data);
    } catch (e) {
      setError(normalizeError(e));
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  useEffect(() => {
    reload();
  }, [reload]);

  const mutate = useCallback(
    async (fn: () => Promise<void>): Promise<boolean> => {
      try {
        await fn();
        await reload();
        return true;
      } catch (e) {
        setError(normalizeError(e));
        return false;
      }
    },
    [reload],
  );

  const clearError = useCallback(() => setError(null), []);

  return { items, loading, error, reload, mutate, clearError };
}
```

- [ ] **Step 2: Commit**

```bash
git add web-ui/src/hooks/useCrudResource.ts
git commit -m "feat(web-ui): add useCrudResource hook for list lifecycle and mutations"
```

---

## Task 3: Create FormField and FormModal components

**Files:**
- Create: `web-ui/src/components/FormField.tsx`
- Create: `web-ui/src/components/FormModal.tsx`

- [ ] **Step 1: Create FormField component**

```tsx
// web-ui/src/components/FormField.tsx
import React from 'react';

interface BaseProps {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
}

interface TextFieldProps extends BaseProps {
  type?: 'text' | 'password' | 'number';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

interface TextareaProps extends BaseProps {
  type: 'textarea';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

interface SelectProps extends BaseProps {
  type: 'select';
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}

interface CheckboxProps extends BaseProps {
  type: 'checkbox';
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export type FormFieldProps = TextFieldProps | TextareaProps | SelectProps | CheckboxProps;

/**
 * Composable form field: label + input/select/textarea + validation error.
 * Replaces duplicated inline form markup across page modals.
 */
export function FormField(props: FormFieldProps) {
  const { label, error, required, className = '' } = props;

  const inputClasses =
    'w-full px-3 py-2 border rounded bg-white dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

  let input: React.ReactNode;

  if (props.type === 'checkbox') {
    return (
      <label className={`flex items-center gap-2 ${className}`}>
        <input
          type="checkbox"
          checked={props.checked}
          onChange={(e) => props.onChange(e.target.checked)}
          className="rounded border-gray-300 dark:border-gray-600"
        />
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        {error && <span className="text-red-500 text-xs ml-2">{error}</span>}
      </label>
    );
  }

  if (props.type === 'select') {
    input = (
      <select value={props.value} onChange={(e) => props.onChange(e.target.value)} className={inputClasses}>
        {props.options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  } else if (props.type === 'textarea') {
    input = (
      <textarea
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        rows={props.rows ?? 3}
        className={inputClasses}
      />
    );
  } else {
    input = (
      <input
        type={props.type ?? 'text'}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
        className={inputClasses}
      />
    );
  }

  return (
    <div className={`mb-3 ${className}`}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {input}
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Create FormModal component**

```tsx
// web-ui/src/components/FormModal.tsx
import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { normalizeError } from '../utils/normalizeError';

interface FormModalProps {
  /** Modal title. */
  title: string;
  /** Whether the modal is visible. */
  open: boolean;
  /** Called when user cancels or submission succeeds. */
  onClose: () => void;
  /** Async submit handler — throw to show error, resolve to auto-close. */
  onSubmit: () => Promise<void>;
  /** Form field children. */
  children: React.ReactNode;
  /** Submit button label. Default: "Save". */
  submitLabel?: string;
  /** Cancel button label. Default: "Cancel". */
  cancelLabel?: string;
}

/**
 * Composes Modal + form submission handling + loading/error state.
 * Replaces the pattern where every page builds its own modal with
 * embedded form, try-catch, loading spinner, and error display.
 *
 * On submit success: auto-calls onClose.
 * On submit failure: shows error inside the modal, keeps it open.
 */
export function FormModal({
  title,
  open,
  onClose,
  onSubmit,
  children,
  submitLabel = 'Save',
  cancelLabel = 'Cancel',
}: FormModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear error when modal opens
  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSubmit();
      onClose();
    } catch (err) {
      setError(normalizeError(err));
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        {error && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}
        {children}
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            {cancelLabel}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 3: Verify web-ui builds**

```bash
cd web-ui && npm run build
```

Expected: Builds with no errors. The new files are not imported yet — they just need to compile.

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/components/FormField.tsx web-ui/src/components/FormModal.tsx
git commit -m "feat(web-ui): add FormField and FormModal shared form components"
```

---

## Task 4: Add changePassword to API client

**Files:**
- Modify: `web-ui/src/api/client.ts`

The Settings page currently has a direct `fetch('/current/user/password', ...)` call. Move it to the API client.

- [ ] **Step 1: Read client.ts to find the right location**

Read `web-ui/src/api/client.ts` and find the User methods section.

- [ ] **Step 2: Add changePassword method**

Add after the existing user methods (near `getCurrentUser`):

```typescript
async changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${this.base}/current/user/password`, {
    method: 'POST',
    headers: this.headers(),
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || 'Failed to change password');
  }
}
```

- [ ] **Step 3: Verify build**

```bash
cd web-ui && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/api/client.ts
git commit -m "feat(web-ui): add changePassword method to API client"
```

---

## Task 5: Migrate Clients page (prove abstractions)

**Files:**
- Modify: `web-ui/src/pages/Clients.tsx`

This is the simplest CRUD page (202 lines). The migration proves the hook/component APIs work.

**Current pattern (to be replaced):**
- `useState` for clients array, error, showCreate, editClient, deleteClient
- `useCallback` + `useEffect` for loading
- Inline `handleCreate`, `handleUpdate`, `handleDelete` with try-catch
- Inline `ClientForm` component (70 lines) with its own loading/error state

**Target pattern:**
- `useCrudResource` for list + mutations
- `FormModal` + `FormField` for create/edit modals
- Page owns only modal state + form field values

- [ ] **Step 1: Rewrite Clients.tsx**

Read the current file first, then replace it. The new version:

1. Imports `useCrudResource` from hooks, `FormModal`/`FormField` from components
2. Uses `const crud = useCrudResource(() => api.listClients())` — replaces 5 lines of state + 4 lines of load callback + 1 useEffect
3. Uses `crud.mutate(() => api.deleteClient(id))` for delete — replaces try-catch handler
4. Uses `<FormModal onSubmit={...}>` for create/edit — replaces the entire inline ClientForm component
5. Page-level form state: `name` and `scopes` fields managed with `useState`
6. Modal state: `showCreate`, `editClient`, `deleteClient` remain as page state

Key transformation — the old inline `ClientForm` (70 lines with its own try-catch/loading/error) becomes:

```tsx
<FormModal
  title={editClient ? 'Edit Client' : 'Create Client'}
  open={showCreate || !!editClient}
  onClose={() => { setShowCreate(false); setEditClient(null); resetForm(); }}
  onSubmit={async () => {
    if (editClient) {
      await crud.mutate(() => api.updateClient(editClient.id, { name: formName, scopes: formScopes }));
    } else {
      await crud.mutate(() => api.createClient({ name: formName, scopes: formScopes }));
    }
    resetForm();
  }}
  submitLabel={editClient ? 'Update' : 'Create'}
>
  <FormField label="Name" value={formName} onChange={setFormName} required />
  {/* scopes field */}
</FormModal>
```

**Important:** `crud.mutate()` handles both the API call and reload. Do NOT add a separate `crud.reload()` call — that causes double network requests.

- [ ] **Step 2: Verify build and test manually**

```bash
cd web-ui && npm run build
```

Open in browser, verify:
- Client list loads
- Create modal works
- Edit modal works
- Delete confirmation works
- Error display works

- [ ] **Step 3: Commit**

```bash
git add web-ui/src/pages/Clients.tsx
git commit -m "refactor(web-ui): migrate Clients page to shared hooks and FormModal"
```

---

## Task 6: Migrate Applications page

**Files:**
- Modify: `web-ui/src/pages/Applications.tsx`

Moderately complex — has icon upload, messages modal, different form structure.

- [ ] **Step 1: Read the current Applications.tsx**

Note the unique features:
- Icon upload via `api.uploadApplicationIcon()` / `api.deleteApplicationIcon()`
- Icon version state for cache busting
- Messages modal that loads on demand
- Form uses object state: `{ name, description, default_priority }`

- [ ] **Step 2: Rewrite Applications.tsx**

Apply the same pattern as Clients:
- `useCrudResource(() => api.listApplications())` for list
- `FormModal` for create/edit (fields: name, description, default_priority)
- Keep icon upload as page-specific behavior (not abstracted — YAGNI)
- Keep messages modal as page-specific (uses `useAsyncAction` for loading messages)
- `crud.mutate()` for delete

The icon upload section stays inline since it's unique to this page. The messages modal uses `useAsyncAction<MessageResponse[]>()` for its fetch:

```tsx
const messagesAction = useAsyncAction<MessageResponse[]>();

const loadMessages = async (app: Application) => {
  setMessagesApp(app);
  await messagesAction.execute(() => api.listApplicationMessages(app.id));
};
```

- [ ] **Step 3: Verify build**

```bash
cd web-ui && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/pages/Applications.tsx
git commit -m "refactor(web-ui): migrate Applications page to shared hooks and FormModal"
```

---

## Task 7: Migrate Users and Permissions pages

**Files:**
- Modify: `web-ui/src/pages/Users.tsx`
- Modify: `web-ui/src/pages/Permissions.tsx`

Both are standard CRUD, similar to Clients.

- [ ] **Step 1: Rewrite Users.tsx**

Read first. Apply pattern:
- `useCrudResource(() => api.listUsers())` for list
- `FormModal` for create (fields: username, password, email, is_admin checkbox)
- Separate `FormModal` for edit (fields: username, email, is_admin — no password)
- `crud.mutate()` for delete
- Note: Uses `UserResponse` type (not `User`)

- [ ] **Step 2: Rewrite Permissions.tsx**

Read first. Apply pattern:
- `useCrudResource(() => api.listPermissions())` for list
- `FormModal` for create only (no edit — permissions are create/delete only)
- Fields: user_id (select from users list), topic_pattern, can_read checkbox, can_write checkbox
- Need to also load users list for the user_id dropdown — use `useCrudResource` for that too, or inline fetch
- `crud.mutate()` for delete

- [ ] **Step 3: Verify build**

```bash
cd web-ui && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/pages/Users.tsx web-ui/src/pages/Permissions.tsx
git commit -m "refactor(web-ui): migrate Users and Permissions pages to shared hooks"
```

---

## Task 8: Migrate Bridges and Topics pages

**Files:**
- Modify: `web-ui/src/pages/Bridges.tsx`
- Modify: `web-ui/src/pages/Topics.tsx`

Both have complex forms with conditional fields.

- [ ] **Step 1: Rewrite Bridges.tsx**

Read first. Apply pattern:
- `useCrudResource` for bridges list and MQTT status
- `FormModal` for create/edit
- Complex form: subscribe_topics and publish_topics are arrays managed with add/remove buttons
- Keep array management as page-specific inline logic (FormField handles individual inputs, but the array add/remove UI is custom)
- Fields: name, remote_url, subscribe_topics (array), publish_topics (array), username, password, qos, topic_prefix, auto_create_topics

- [ ] **Step 2: Rewrite Topics.tsx**

Read first. This is the most complex of the standard pages (486 lines):
- `useCrudResource(() => api.listTopics())` for list
- `FormModal` for create (simple: name, description, everyone_read, everyone_write)
- Separate inline edit form (12 fields with collapsible policy section — too complex for FormModal, keep as custom component)
- Publish modal uses `useAsyncAction`
- Messages modal uses `useAsyncAction`
- Batch delete uses `crud.mutate`
- Keep the edit form as an inline component — not everything needs to use FormModal

- [ ] **Step 3: Verify build**

```bash
cd web-ui && npm run build
```

- [ ] **Step 4: Commit**

```bash
git add web-ui/src/pages/Bridges.tsx web-ui/src/pages/Topics.tsx
git commit -m "refactor(web-ui): migrate Bridges and Topics pages to shared hooks"
```

---

## Task 9: Migrate Settings, Dashboard, and Messages pages

**Files:**
- Modify: `web-ui/src/pages/Settings.tsx`
- Modify: `web-ui/src/pages/Dashboard.tsx`
- Modify: `web-ui/src/pages/Messages.tsx`

These are non-standard pages with lighter cleanup needed.

- [ ] **Step 1: Rewrite Settings.tsx**

Read first. Key changes:
- Replace direct `fetch('/current/user/password', ...)` with `api.changePassword()` (added in Task 4)
- Use `useAsyncAction` for password change: `const pwAction = useAsyncAction()`
- Use `useCrudResource` for settings list
- Use `useAsyncAction` for individual setting updates

- [ ] **Step 2: Update Dashboard.tsx**

Read first. Light touch — Dashboard is read-only (107 lines):
- Replace manual `useState`+`useEffect` fetch pattern with `useAsyncAction` for each data source (stats, health, version, mqtt status)
- Or use multiple `useCrudResource` calls for each endpoint — but these aren't CRUD resources, they're read-only. Better: use `useAsyncAction` for each:

```tsx
const statsAction = useAsyncAction<StatsResponse>();
const healthAction = useAsyncAction<HealthResponse>();
// ...
useEffect(() => {
  statsAction.execute(() => api.getStats());
  healthAction.execute(() => api.getHealth());
  // ...
}, []);
```

- [ ] **Step 3: Update Messages.tsx**

Read first. Light touch — Messages is read-heavy (400 lines) with pagination, search, WebSocket:
- Use `useCrudResource` for the paginated message list (or keep manual since it has pagination params)
- Use `useAsyncAction` for search, delete operations
- Keep WebSocket stream logic as-is (it's unique and works)
- The `fetch()` call for message action execution (line ~354) is intentional (user-defined URLs) — keep as-is but wrap in a small utility function

Messages.tsx has the most unique behavior. Only migrate the patterns that clearly map to the shared hooks. Don't force-fit pagination into `useCrudResource`.

For the `fetch()` call that executes user-defined message actions (spec 3c requires it move to the API client), add a method to `web-ui/src/api/client.ts`:

```typescript
async executeMessageAction(action: { url: string; method?: string; headers?: Record<string, string>; body?: string }): Promise<Response> {
  return fetch(action.url, {
    method: action.method || 'POST',
    headers: action.headers || {},
    body: action.body,
  });
}
```

Then replace the direct `fetch()` in Messages.tsx with `api.executeMessageAction(action)`.

**Note:** `executeMessageAction` is an intentional exception to the API boundary rule — it executes user-defined external URLs rather than backend API endpoints. It lives in the API client for consistency (no raw `fetch()` in pages) but is architecturally distinct from rstify API methods.

- [ ] **Step 4: Verify build**

```bash
cd web-ui && npm run build
```

- [ ] **Step 5: Commit**

```bash
git add web-ui/src/pages/Settings.tsx web-ui/src/pages/Dashboard.tsx web-ui/src/pages/Messages.tsx
git commit -m "refactor(web-ui): migrate Settings, Dashboard, and Messages pages to shared hooks"
```

---

## Task 10: Migrate Webhooks page

**Files:**
- Modify: `web-ui/src/pages/Webhooks.tsx`

The most complex page (1258 lines). Split into sub-components and apply hooks.

- [ ] **Step 1: Read the current Webhooks.tsx carefully**

Identify the sub-components to extract:
- Webhook list with group headers and health sparklines
- Create/edit form (both incoming and outgoing, with conditional fields)
- Delivery logs viewer modal
- Test webhook modal with custom payload
- Code generator modal
- Webhook variables management

- [ ] **Step 2: Extract WebhookForm as a separate component**

Create the form for create/edit as a child component. It receives the webhook data (for edit) or nothing (for create) and renders the appropriate fields. The parent wraps it in `FormModal`.

Keep this inline in Webhooks.tsx as a named function component — don't create a separate file unless it exceeds ~200 lines on its own.

- [ ] **Step 3: Apply hooks to the page**

- `useCrudResource(() => api.listWebhooks())` for webhook list
- `useCrudResource(() => api.listWebhookVariables())` for variables
- `useAsyncAction` for: test webhook, toggle enabled, duplicate, delivery log fetch
- `FormModal` for create/edit webhook and create/edit variable
- `crud.mutate()` for delete

- [ ] **Step 4: Reduce inline handlers**

Replace each try-catch handler with hook calls:

```tsx
// Before (current):
const handleToggleEnabled = async (wh: WebhookConfigWithHealth) => {
  try {
    await api.updateWebhook(wh.id, { enabled: !wh.enabled });
    load();
  } catch (e) {
    setError(e instanceof Error ? e.message : 'Failed');
  }
};

// After:
const handleToggleEnabled = (wh: WebhookConfigWithHealth) =>
  crud.mutate(() => api.updateWebhook(wh.id, { enabled: !wh.enabled }));
```

- [ ] **Step 5: Verify build**

```bash
cd web-ui && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add web-ui/src/pages/Webhooks.tsx
git commit -m "refactor(web-ui): migrate Webhooks page to shared hooks and reduce boilerplate"
```

---

## Task 11: Create mobile useHubData hook and cache helpers

**Files:**
- Create: `client/src/hooks/useHubData.ts`
- Create: `client/src/utils/cache.ts`

- [ ] **Step 1: Create useHubData hook**

```typescript
// client/src/hooks/useHubData.ts
import { useState, useCallback, useEffect } from 'react';
import { Alert } from 'react-native';

function normalizeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'An unexpected error occurred';
}

interface HubData<T> {
  /** The current list of items. */
  items: T[];
  /** True during load/reload. */
  isLoading: boolean;
  /** Re-fetch from API. Alerts on error unless silent=true. */
  refresh: (silent?: boolean) => Promise<void>;
  /** Wrap a mutation: runs fn, refreshes on success, shows Alert on failure. Returns true on success. */
  mutate: (fn: () => Promise<void>) => Promise<boolean>;
}

/**
 * Shared fetch/error/loading lifecycle for mobile hub screens.
 * Replaces the duplicated useState + useCallback + try-catch + Alert.alert pattern.
 *
 * Initial load is silent (no Alert popup on app open).
 * Pull-to-refresh and mutations show Alerts on failure.
 *
 * Usage:
 *   const { items, isLoading, refresh, mutate } = useHubData(() => api.listClients());
 */
export function useHubData<T>(fetchFn: () => Promise<T[]>): HubData<T> {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async (silent = false) => {
    setIsLoading(true);
    try {
      const data = await fetchFn();
      setItems(data);
    } catch (e) {
      if (!silent) {
        Alert.alert('Error', normalizeError(e));
      }
    } finally {
      setIsLoading(false);
    }
  }, [fetchFn]);

  // Initial load is silent — no Alert popup if server is unreachable at startup
  useEffect(() => {
    refresh(true);
  }, [refresh]);

  const mutate = useCallback(
    async (fn: () => Promise<void>): Promise<boolean> => {
      try {
        await fn();
        await refresh();
        return true;
      } catch (e) {
        Alert.alert('Error', normalizeError(e));
        return false;
      }
    },
    [refresh],
  );

  return { items, isLoading, refresh, mutate };
}
```

- [ ] **Step 2: Create cache helpers**

```typescript
// client/src/utils/cache.ts
import { storage, secureStorage } from '../storage/mmkv';

type MMKVStorage = typeof storage;

interface CacheHelpers<T> {
  /** Load cached data, or null if missing/corrupt. */
  load: () => T | null;
  /** Save data to cache. */
  save: (data: T) => void;
  /** Remove cached data. */
  clear: () => void;
}

/**
 * Create typed cache read/write helpers for a given MMKV key.
 * Replaces duplicated loadFromCache/saveToCache across Zustand stores.
 *
 * Usage:
 *   const appCache = createCache<Application[]>('app_cache');
 *   const cached = appCache.load();
 *   appCache.save(freshData);
 */
export function createCache<T>(key: string, mmkv: MMKVStorage = storage): CacheHelpers<T> {
  return {
    load: (): T | null => {
      const raw = mmkv.getString(key);
      if (!raw) return null;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return null;
      }
    },
    save: (data: T) => {
      mmkv.set(key, JSON.stringify(data));
    },
    clear: () => {
      mmkv.delete(key);
    },
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add client/src/hooks/useHubData.ts client/src/utils/cache.ts
git commit -m "feat(client): add useHubData hook and shared cache helpers"
```

---

## Task 12: Migrate simple mobile hub screens

**Files:**
- Modify: `client/app/hub/clients.tsx`
- Modify: `client/app/hub/apps.tsx`
- Modify: `client/app/hub/mqtt.tsx`

These three are the simplest hub screens (192-278 lines).

- [ ] **Step 1: Rewrite clients.tsx**

Read first. Apply pattern:
- Import `useHubData` from hooks
- Replace `useState` for clients + isLoading + the fetchClients callback + useEffect with:
  ```tsx
  const { items: clients, isLoading, refresh, mutate } = useHubData(() => {
    const api = getApiClient();
    return api.listClients();
  });
  ```
- Replace try-catch mutation handlers with `mutate()`:
  ```tsx
  const handleDelete = async (client: Client) => {
    const api = getApiClient();
    await mutate(() => api.deleteClient(client.id));
  };
  ```
- Keep modal/form state as page-owned
- Keep FlatList + RefreshControl but wire to `isLoading` and `refresh`

- [ ] **Step 2: Rewrite apps.tsx**

Same pattern. Keep token copy, icon display as page-specific.

- [ ] **Step 3: Rewrite mqtt.tsx**

Same pattern. Has MQTT status + bridges list — use two `useHubData` calls or one with a combined fetch. The status fetch is separate from bridge CRUD.

- [ ] **Step 4: Verify TypeScript**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add client/app/hub/clients.tsx client/app/hub/apps.tsx client/app/hub/mqtt.tsx
git commit -m "refactor(client): migrate simple hub screens to useHubData hook"
```

---

## Task 13: Migrate mobile users hub screen

**Files:**
- Modify: `client/app/hub/users.tsx`

Users screen (420 lines) has nested permission management. Apply hooks but keep the permission sub-screen as-is.

- [ ] **Step 1: Rewrite users.tsx**

Read first. Apply `useHubData` for user list. Replace try-catch handlers with `mutate()`. The permission management section within the user screen may use its own `useHubData` for permissions, or keep inline if tightly coupled.

- [ ] **Step 2: Verify TypeScript**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add client/app/hub/users.tsx
git commit -m "refactor(client): migrate users hub screen to useHubData hook"
```

---

## Task 14: Split and migrate mobile webhooks screen

**Files:**
- Modify: `client/app/hub/webhooks.tsx`
- Create: `client/src/components/webhooks/WebhookForm.tsx` (if form exceeds ~150 lines)
- Create: `client/src/components/webhooks/WebhookList.tsx` (if list rendering exceeds ~100 lines)

The webhooks screen (838 lines) is the most complex mobile screen and needs splitting.

- [ ] **Step 1: Read webhooks.tsx and identify split boundaries**

Look for natural boundaries:
- List rendering with direction badges
- Create/edit form with conditional fields (incoming vs outgoing)
- Auth field builders (basic, bearer, custom)
- Template section

- [ ] **Step 2: Extract WebhookForm component**

Move the create/edit form JSX into `client/src/components/webhooks/WebhookForm.tsx`. It receives:
- `webhook?: WebhookConfigWithHealth` (for edit, undefined for create)
- `onSubmit: (data: CreateWebhookConfig | UpdateWebhookConfig) => Promise<void>`
- `onClose: () => void`

The form manages its own field state. The parent handles the API call.

- [ ] **Step 3: Apply useHubData to the main screen**

Replace fetch/error/loading pattern with `useHubData`. Replace mutation handlers with `mutate()`.

- [ ] **Step 4: Verify TypeScript**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add client/app/hub/webhooks.tsx client/src/components/webhooks/
git commit -m "refactor(client): split webhooks screen and migrate to useHubData hook"
```

---

## Task 15: Update Zustand stores to use cache helpers

**Files:**
- Modify: `client/src/store/applications.ts`
- Modify: `client/src/store/channels.ts`
- Modify: `client/src/store/messages.ts`

Replace manual `loadFromCache`/`saveToCache` implementations with the shared `createCache` helper from Task 11.

- [ ] **Step 1: Update applications.ts**

Read first. Replace:
```typescript
// Before:
const CACHE_KEY = 'app_cache';
// ... manual storage.getString(CACHE_KEY) + JSON.parse in loadFromCache
// ... manual JSON.stringify + storage.set in saveToCache

// After:
import { createCache } from '../utils/cache';
const appCache = createCache<Application[]>('app_cache');
// ... loadFromCache: () => appCache.load()
// ... saveToCache: () => appCache.save(get().applications)
```

- [ ] **Step 2: Update channels.ts**

Read first. Same pattern — replace manual cache reads/writes with `createCache` calls. Two cache keys: `channel_folders`, `channel_pinned`.

- [ ] **Step 3: Update messages.ts**

Read first. Same pattern but has debounced saves. Keep the debounce logic, just replace the inner `storage.set` with `createCache`:

```typescript
const msgCache = createCache<[string, MessageGroup][]>('msg_cache_groups');
// In debounced save: msgCache.save(Array.from(get().groups.entries()));
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd client && npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add client/src/store/applications.ts client/src/store/channels.ts client/src/store/messages.ts
git commit -m "refactor(client): standardize Zustand stores with shared cache helpers"
```

---

## Verification Checklist

After all tasks, verify these Phase 3 completion criteria:

- [ ] No page-level `useState` for loading/error in web-ui pages (shared hooks handle this)
- [ ] No try-catch blocks for API calls in web-ui page code (hooks/FormModal handle this)
- [ ] No direct `fetch()` calls in web-ui pages (all through api client)
- [ ] `useCrudResource` used across all 8 CRUD pages
- [ ] `FormModal` used for standard create/edit forms
- [ ] Mobile hub screens use `useHubData` for fetch lifecycle
- [ ] Mobile webhooks screen split into focused components
- [ ] Zustand stores use shared cache helpers
- [ ] `cd web-ui && npm run build` passes
- [ ] `cd client && npx tsc --noEmit` passes
- [ ] No accidental UX changes (loading states, modal behavior, error visibility preserved)

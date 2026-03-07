# Ralph PRD: Feature Parity Gaps

Close all remaining gaps between the rstify backend API, web UI, and mobile app.

## Rules

- Run `cargo check` after every Rust change. Run `cd web-ui && npm run build` after every web UI change. Fix errors before moving on.
- Do NOT create new files unless absolutely necessary. Prefer editing existing files.
- Do NOT add comments, docstrings, or type annotations to code you didn't change.
- Keep changes minimal and focused. No refactoring unless required.
- Update RALPH-PROGRESS.md after completing each task.
- After all tasks are done, run full build verification: `cargo check && cd web-ui && npm run build`.

## Tasks

### TASK 1: App-specific message history (Web UI)

**What:** Add a "View Messages" link/button to the Applications page that shows messages for that specific app.

**How:**
- In `web-ui/src/pages/Applications.tsx`, add a "Messages" button in the actions column for each app
- When clicked, open a modal or expandable section that calls `api.listApplicationMessages(id)` and renders the messages
- Reuse the message rendering pattern from Messages.tsx (MessageContent, priority badge, tags, attachments)
- The `listApplicationMessages` method already exists in `web-ui/src/api/client.ts`

**Verify:** `cd web-ui && npm run build` passes.

---

### TASK 2: Topic message viewer (Web UI)

**What:** Add a "View Messages" link/button to the Topics page that shows messages for that specific topic.

**How:**
- In `web-ui/src/pages/Topics.tsx`, add a "Messages" button in the actions column for each topic
- When clicked, open a modal or expandable section that calls `api.listTopicMessages(name)` and renders the messages
- Reuse the message rendering pattern from Messages.tsx
- The `listTopicMessages` method already exists in `web-ui/src/api/client.ts`

**Verify:** `cd web-ui && npm run build` passes.

---

### TASK 3: Publish to topic (Web UI)

**What:** Add a "Send Message" button to the Topics page that lets users publish a message to a topic.

**How:**
- In `web-ui/src/pages/Topics.tsx`, add a "Send" button per topic
- Open a modal with fields: title (optional), message (required), priority (1-10, default 5), tags (comma-separated, optional)
- Add `publishToTopic` method to `web-ui/src/api/client.ts`:
  ```
  publishToTopic(name: string, data: { title?: string; message: string; priority?: number; tags?: string[] }): Promise<MessageResponse>
  ```
  calls `POST /api/topics/{name}/publish`
- On success, show toast and optionally refresh the topic message list

**Verify:** `cd web-ui && npm run build` passes.

---

### TASK 4: Message search (Mobile)

**What:** Add a search bar to the Messages screen in the mobile app.

**How:**
- Add a `searchMessages` method to `client/src/api/client.ts`:
  ```
  searchMessages(params: { q?: string; tag?: string; priority_min?: number; priority_max?: number; appid?: number; limit?: number }): Promise<MessageResponse[]>
  ```
  calls `GET /message/search?q=...&tag=...` etc.
- In `client/app/(tabs)/index.tsx`, add a search TextInput above the message list
- When the user types, debounce (300ms) and call `searchMessages({ q: query })`
- Show search results in the same FlatList, replacing the normal message list
- When search is cleared, restore normal paginated messages

**Verify:** No TypeScript errors in the changed files (mobile doesn't have a strict build step, but types must be correct).

---

### TASK 5: Scheduled message support (Web UI)

**What:** Add a "Schedule" option when publishing to topics (from Task 3's publish modal).

**How:**
- In the publish modal from Task 3, add an optional "Schedule for" datetime input field
- Include `scheduled_for` in the publish request body (ISO 8601 format)
- The backend already supports `scheduled_for` in `CreateTopicMessage`
- Add `scheduled_for?: string` to the publish API call types

**Verify:** `cd web-ui && npm run build` passes.

---

### TASK 6: Application editing (Mobile)

**What:** Allow editing application name, description, and default_priority in the mobile app.

**How:**
- In `client/app/(tabs)/apps.tsx`, add an "Edit" option (long-press menu or edit button)
- Open a modal with editable fields: name, description, default_priority
- Call `updateApplication(id, data)` which already exists in `client/src/api/client.ts`
- Refresh the list on success

**Verify:** Types are correct, no TypeScript errors.

---

### TASK 7: Webhook full editing (Mobile)

**What:** Allow full webhook editing in mobile (not just enabled toggle).

**How:**
- In `client/app/(tabs)/webhooks.tsx`, add an "Edit" option per webhook
- Open a modal pre-filled with current webhook data: name, target_url, http_method, body_template, enabled
- Call `updateWebhook(id, data)` which already exists in `client/src/api/client.ts`
- The `UpdateWebhookConfig` type in `client/src/api/types.ts` may need fields added: `max_retries`, `retry_delay_secs`

**Verify:** Types are correct, no TypeScript errors.

---

### TASK 8: Webhook delivery logs (Mobile)

**What:** Show webhook delivery history in the mobile app.

**How:**
- Add `listWebhookDeliveries` method to `client/src/api/client.ts`:
  ```
  listWebhookDeliveries(id: number, limit?: number): Promise<WebhookDeliveryLog[]>
  ```
  calls `GET /api/webhooks/{id}/deliveries?limit=...`
- Add `WebhookDeliveryLog` type to `client/src/api/types.ts`:
  ```
  { id, webhook_config_id, message_id?, status_code?, response_body_preview?, duration_ms, attempted_at, success }
  ```
- In `client/app/(tabs)/webhooks.tsx`, add a "Deliveries" button per webhook
- Show delivery logs in a modal with status, timestamp, duration, response preview

**Verify:** Types are correct, no TypeScript errors.

---

### TASK 9: Permissions management (Mobile)

**What:** Add topic permissions management for admin users in the mobile app.

**How:**
- Add API methods to `client/src/api/client.ts`:
  - `createPermission(data)` calls `POST /api/permissions`
  - `deletePermission(id)` calls `DELETE /api/permissions/{id}`
  - `listPermissions()` already exists
- Add `CreateTopicPermission` type to `client/src/api/types.ts` if not present:
  ```
  { user_id: number; topic_pattern: string; can_read?: boolean; can_write?: boolean }
  ```
- In `client/app/(tabs)/settings.tsx` admin panel, add a "Permissions" section
- Show list of permissions with user, pattern, read/write flags
- Add button to create new permission (user picker, pattern input, read/write toggles)
- Swipe-to-delete or long-press to delete permissions

**Verify:** Types are correct, no TypeScript errors.

---

### TASK 10: Attachment upload (Mobile)

**What:** Allow uploading attachments to messages from the mobile app.

**How:**
- Add `uploadAttachment` method to `client/src/api/client.ts`:
  ```
  async uploadAttachment(messageId: number, uri: string, filename: string, mimeType: string): Promise<AttachmentInfo>
  ```
  Use FormData with fetch to `POST /api/messages/{id}/attachments`
- In `client/src/components/MessageCard.tsx` or `MessageAttachments.tsx`, add an "Attach" button (paperclip icon)
- Use `expo-document-picker` to select a file
- Upload and refresh attachments on the message
- Check that `expo-document-picker` is in package.json dependencies; if not, add it

**Verify:** Types are correct, no TypeScript errors.

---

### TASK 11: Attachment deletion (Web UI + Backend + Mobile)

**What:** Add ability to delete attachments from messages.

**How:**
- **Backend:** Add a `DELETE /api/attachments/{id}` route:
  - In `crates/rstify-api/src/routes/attachments.rs`, add `delete_attachment` handler that finds the attachment, verifies ownership via the parent message, deletes file from disk + DB record
  - In `crates/rstify-api/src/routes/mod.rs`, add `.route("/api/attachments/{id}", get(attachments::download_attachment).delete(attachments::delete_attachment))`
- **Web UI:** Add `deleteAttachment(id)` to `web-ui/src/api/client.ts`
  - In `web-ui/src/pages/Messages.tsx` `MessageAttachments` component, add a delete button (X) on each attachment
- **Mobile:** Add `deleteAttachment(id)` to `client/src/api/client.ts`
  - In `client/src/components/MessageAttachments.tsx`, add long-press to delete

**Verify:** `cargo check` passes. `cd web-ui && npm run build` passes.

---

### TASK 12: Version info on web dashboard

**What:** Display server version on the web UI dashboard.

**How:**
- In `web-ui/src/pages/Dashboard.tsx`, the `ServerInfo` component already calls `getHealth()`. Also call `api.getVersion()` and display version + build date alongside health info.
- `getVersion()` already exists in `web-ui/src/api/client.ts`

**Verify:** `cd web-ui && npm run build` passes.

---

### TASK 13: Client token management (Mobile)

**What:** Allow creating and deleting client tokens from the mobile settings screen.

**How:**
- `createClient` and `deleteClient` already exist in `client/src/api/client.ts`
- In `client/app/(tabs)/settings.tsx`, the client tokens section already shows tokens
- Add a "Create Token" button that opens a modal with name input, calls `createClient({ name })`
- Add swipe-to-delete or a delete button on each token, calls `deleteClient(id)`
- Refresh the list after create/delete

**Verify:** Types are correct, no TypeScript errors.

---

### TASK 14: Topic editing (Mobile)

**What:** Allow editing topic description and permission flags in the mobile app.

**How:**
- Add `updateTopic` method to `client/src/api/client.ts`:
  ```
  updateTopic(name: string, data: { description?: string; everyone_read?: boolean; everyone_write?: boolean }): Promise<Topic>
  ```
  calls `PUT /api/topics/{name}`
- In `client/app/(tabs)/topics.tsx`, add an "Edit" option (long-press or edit button)
- Open a modal with editable fields: description, everyone_read, everyone_write
- Refresh on success

**Verify:** Types are correct, no TypeScript errors.

---

### TASK 15: Message source filter (Mobile)

**What:** Add filter tabs (All / App / Topic) to the messages screen, matching the web UI.

**How:**
- In `client/app/(tabs)/index.tsx`, add a row of filter buttons above the message list: All, App, Topic
- Filter the displayed messages client-side:
  - All: show everything
  - App: only messages with `appid != null`
  - Topic: only messages with `topic != null`
- Store filter state locally

**Verify:** Types are correct, no TypeScript errors.

---

### TASK 16: Topic creation flags (Mobile)

**What:** Allow setting `everyone_read` and `everyone_write` when creating topics in mobile.

**How:**
- In `client/app/(tabs)/topics.tsx`, the create topic modal currently only has name and description
- Add two toggle switches: "Public Read" and "Public Write"
- Include `everyone_read` and `everyone_write` in the `createTopic` request body
- The `CreateTopic` type in `client/src/api/types.ts` already has these optional fields

**Verify:** Types are correct, no TypeScript errors.

---

## Completion Criteria

All 16 tasks completed, all builds pass (`cargo check`, `npm run build`), and RALPH-PROGRESS.md shows all tasks as DONE.

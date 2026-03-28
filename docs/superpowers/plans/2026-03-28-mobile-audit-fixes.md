# Mobile App Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all audit findings from the mobile app rewrite — must-fix bugs, missing features, and UI consistency issues — while establishing shared patterns for maintainability.

**Architecture:** Bottom-up approach: first create shared components and utilities (ConfirmDialog, API methods, type fixes), then apply them across screens. Each task produces a working, testable change. Mobile app is at `.worktrees/mobile-overhaul/client/`, web UI at `web-ui/`.

**Tech Stack:** React Native 0.83, Expo SDK 55, NativeWind v5, Zustand, react-native-keyboard-controller, react-native-reanimated, react-native-gesture-handler, zeego/context-menu, @legendapp/list, TypeScript 5.x

**Branch:** `feature/mobile-ui-overhaul` (worktree at `.worktrees/mobile-overhaul/`)

---

## File Map

### New Files
- `client/src/components/design/ConfirmSheet.tsx` — Themed confirmation dialog replacing `Alert.alert`
- `client/src/components/channels/EditTopicModal.tsx` — Edit topic form (description, permissions)

### Modified Files — Shared/Foundation
- `client/src/api/types.ts` — Add missing fields (`Client.scopes`, `Application.retention_days`)
- `client/src/api/client.ts` — Add missing API methods (`createUser`, `updateClient`)
- `client/src/components/MessageContent.tsx` — Check `content_type` field fallback

### Modified Files — Screens
- `client/app/hub/settings.tsx` — Password confirm field, auto-logout on URL change
- `client/app/hub/users.tsx` — Create user modal, username resolution in permissions, user picker
- `client/app/(tabs)/channels.tsx` — Create topic read/write switches, edit/delete/publish in context menu
- `client/src/components/channels/ChannelRow.tsx` — Add edit/delete/publish context menu items
- `client/app/thread/[sourceId].tsx` — Fetch messages from server, swipe-to-delete
- `client/app/(tabs)/index.tsx` — Grouped view infinite scroll

---

## Task 1: Create Themed ConfirmSheet Component

**Files:**
- Create: `client/src/components/design/ConfirmSheet.tsx`

This replaces all `Alert.alert()` for destructive confirmations with a themed modal that respects dark mode. Follows the existing `FormModal` pattern (double-pressable wrapper, fade animation, NativeWind classes).

- [ ] **Step 1: Create ConfirmSheet component**

```tsx
// client/src/components/design/ConfirmSheet.tsx
import React from "react";
import { View, Text, Modal, Pressable } from "react-native";
import { AnimatedPressable } from "./AnimatedPressable";

interface ConfirmSheetProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  destructive?: boolean;
}

export function ConfirmSheet({
  visible,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  destructive = true,
}: ConfirmSheetProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        className="flex-1 bg-black/50 justify-center items-center px-6"
        onPress={onClose}
      >
        <Pressable
          className="bg-white dark:bg-surface-card rounded-2xl p-5 w-full max-w-sm"
          onPress={(e) => e.stopPropagation()}
        >
          <Text className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {title}
          </Text>
          <Text className="text-sm text-slate-500 dark:text-slate-400 mb-5">
            {message}
          </Text>
          <View className="flex-row gap-3 justify-end">
            <AnimatedPressable
              className="px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-700"
              onPress={onClose}
              haptic={false}
            >
              <Text className="text-sm font-medium text-slate-600 dark:text-slate-300">
                Cancel
              </Text>
            </AnimatedPressable>
            <AnimatedPressable
              className={`px-4 py-2.5 rounded-lg ${destructive ? "bg-red-500" : "bg-primary"}`}
              onPress={() => {
                onConfirm();
                onClose();
              }}
            >
              <Text className="text-sm font-semibold text-white">
                {confirmLabel}
              </Text>
            </AnimatedPressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd .worktrees/mobile-overhaul/client && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/design/ConfirmSheet.tsx
git commit -m "feat(mobile): add themed ConfirmSheet component replacing Alert.alert"
```

---

## Task 2: Fix API Types — Missing Fields

**Files:**
- Modify: `client/src/api/types.ts`

Add missing fields identified in the audit. These type fixes are prerequisites for later tasks.

- [ ] **Step 1: Add `scopes` to Client type**

In `client/src/api/types.ts`, find the `Client` interface and add the `scopes` field:

```typescript
export interface Client {
  id: number;
  user_id: number;
  name: string;
  token: string;
  scopes: string;          // ADD THIS
  fcm_token: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Add `scopes` to CreateClient type**

Find `CreateClient` and add optional scopes:

```typescript
export interface CreateClient {
  name: string;
  scopes?: string[];       // ADD THIS
}
```

- [ ] **Step 3: Add `retention_days` to Application and UpdateApplication**

Find the `Application` interface and add:

```typescript
export interface Application {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  token: string;
  default_priority: number;
  retention_days: number | null;   // ADD THIS
  image: string | null;
  created_at: string;
  updated_at: string;
}
```

Find `UpdateApplication` and add:

```typescript
export interface UpdateApplication {
  name?: string;
  description?: string;
  default_priority?: number;
  retention_days?: number | null;  // ADD THIS
}
```

- [ ] **Step 4: Add `recent_durations` to WebhookConfig**

Find `WebhookConfig` and add:

```typescript
  recent_durations?: number[];     // ADD THIS (after recent_success_rate)
```

- [ ] **Step 5: Add `enabled` to UpdateWebhookConfig**

Find `UpdateWebhookConfig` and add:

```typescript
  enabled?: boolean;               // ADD THIS
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/api/types.ts
git commit -m "fix(mobile): add missing fields to API types (scopes, retention_days, enabled)"
```

---

## Task 3: Add Missing API Client Methods

**Files:**
- Modify: `client/src/api/client.ts`

Add `createUser` and `updateClient` methods following existing patterns.

- [ ] **Step 1: Add createUser method**

In `RstifyClient` class, after the existing user methods, add:

```typescript
  async createUser(req: CreateUser): Promise<UserResponse> {
    return this.request("POST", "/api/user", req);
  }
```

Also add `CreateUser` to the import list at the top of the file.

- [ ] **Step 2: Add updateClient method**

After the existing client methods, add:

```typescript
  async updateClient(id: number, req: { name?: string; scopes?: string[] }): Promise<Client> {
    return this.request("PUT", `/api/client/${id}`, req);
  }
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/api/client.ts
git commit -m "feat(mobile): add createUser and updateClient API methods"
```

---

## Task 4: Fix MessageContent — Check `content_type` Field

**Files:**
- Modify: `client/src/components/MessageContent.tsx`

The component only checks `extras["client::display"].contentType` for markdown. It should also check `message.content_type`.

- [ ] **Step 1: Update markdown detection logic**

Find the markdown detection line (around line 16-17) that currently reads:

```typescript
const isMarkdown = message.extras?.["client::display"]?.contentType === "text/markdown";
```

Replace with:

```typescript
const isMarkdown =
  message.extras?.["client::display"]?.contentType === "text/markdown" ||
  message.content_type === "text/markdown";
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/MessageContent.tsx
git commit -m "fix(mobile): detect markdown via content_type field as fallback"
```

---

## Task 5: Fix Settings — Password Confirm Field + Auto-Logout

**Files:**
- Modify: `client/app/hub/settings.tsx`

Two fixes: (1) add confirm password field with match validation, (2) auto-logout when server URL changes.

- [ ] **Step 1: Add confirmPassword state**

Find the existing password state variables (around line 42-43):

```typescript
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
```

Add after `newPassword`:

```typescript
  const [confirmPassword, setConfirmPassword] = useState('');
```

- [ ] **Step 2: Add match validation to handleChangePassword**

Find `handleChangePassword` (around line 80). After the length check, add:

```typescript
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
```

Also update the success handler to clear the new field:

```typescript
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowPassword(false);
```

- [ ] **Step 3: Add confirm password TextInput**

Find the "New password" TextInput in the Change Password section. After it, add:

```tsx
              <TextInput
                className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
                placeholder="Confirm new password"
                placeholderTextColor="#9ca3af"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
```

- [ ] **Step 4: Fix auto-logout on server URL change**

Find `handleSaveUrl` (around line 70). Replace the existing function body:

```typescript
  const handleSaveUrl = async () => {
    try {
      setServerUrl(urlInput);
      setEditingUrl(false);
      logout();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update');
    }
  };
```

Also import `logout` from auth store at the top of the component:

```typescript
  const logout = useAuthStore((s) => s.logout);
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add app/hub/settings.tsx
git commit -m "fix(mobile): add password confirm field and auto-logout on URL change"
```

---

## Task 6: Fix Users Page — Create User, Username Resolution, User Picker

**Files:**
- Modify: `client/app/hub/users.tsx`

Three fixes: (1) add create user modal, (2) resolve user IDs to usernames in permissions list, (3) replace raw user ID input with picker in create permission modal.

- [ ] **Step 1: Add create user state variables**

After the existing state variables (around line 27), add:

```typescript
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserAdmin, setNewUserAdmin] = useState(false);
```

- [ ] **Step 2: Add create user handler**

After `handleCreatePermission`, add:

```typescript
  const handleCreateUser = async () => {
    if (!newUsername.trim() || !newUserPassword.trim()) {
      Alert.alert('Error', 'Username and password are required');
      return;
    }
    if (newUserPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }
    try {
      const api = getApiClient();
      await api.createUser({
        username: newUsername.trim(),
        password: newUserPassword,
        email: newUserEmail.trim() || undefined,
        is_admin: newUserAdmin,
      });
      setNewUsername('');
      setNewUserPassword('');
      setNewUserEmail('');
      setNewUserAdmin(false);
      setShowCreateUser(false);
      fetchData();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to create user');
    }
  };
```

- [ ] **Step 3: Add username resolver helper**

Before the return statement, add:

```typescript
  const resolveUsername = (userId: number): string => {
    const found = users.find((u) => u.id === userId);
    return found?.username ?? `User #${userId}`;
  };
```

- [ ] **Step 4: Update HubScreenHeader to add create button**

Find the `<HubScreenHeader title="User Management" />` line. Replace with:

```tsx
      <HubScreenHeader title="User Management" onAdd={() => setShowCreateUser(true)} />
```

- [ ] **Step 5: Fix permissions display to show usernames**

Find the line that renders `User #{p.user_id}` (around line 224). Replace:

```tsx
                      <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        User #{p.user_id} -- {p.topic_pattern}
                      </Text>
```

With:

```tsx
                      <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {resolveUsername(p.user_id)} -- {p.topic_pattern}
                      </Text>
```

- [ ] **Step 6: Replace raw user ID input with picker in create permission modal**

Find the User ID `TextInput` in the create permission `FormModal` (the one with `placeholder="User ID"`). Replace it with a scrollable picker:

```tsx
        <View className="gap-1">
          <Text className="text-sm text-slate-500 dark:text-slate-400">User</Text>
          <View className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
            {users.filter((u) => u.id !== user?.id).map((u) => (
              <Pressable
                key={u.id}
                className={`flex-row items-center justify-between p-3 ${newPermUserId === String(u.id) ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                onPress={() => setNewPermUserId(String(u.id))}
              >
                <Text className="text-base text-slate-900 dark:text-slate-100">{u.username}</Text>
                {newPermUserId === String(u.id) && (
                  <Ionicons name="checkmark" size={18} color="#3b82f6" />
                )}
              </Pressable>
            ))}
          </View>
        </View>
```

- [ ] **Step 7: Add create user FormModal at the end of the component (before closing SafeAreaView)**

```tsx
      <FormModal visible={showCreateUser} onClose={() => setShowCreateUser(false)} title="Create User">
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Username"
          placeholderTextColor="#9ca3af"
          value={newUsername}
          onChangeText={setNewUsername}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Password (min 8 chars)"
          placeholderTextColor="#9ca3af"
          value={newUserPassword}
          onChangeText={setNewUserPassword}
          secureTextEntry
        />
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Email (optional)"
          placeholderTextColor="#9ca3af"
          value={newUserEmail}
          onChangeText={setNewUserEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <View className="flex-row justify-between items-center py-1">
          <Text className="text-base text-slate-900 dark:text-slate-100">Admin</Text>
          <Switch value={newUserAdmin} onValueChange={setNewUserAdmin} />
        </View>
        <View className="flex-row gap-3 mt-1">
          <AnimatedPressable
            className="flex-1 p-3.5 rounded-lg bg-slate-100 dark:bg-surface-elevated items-center"
            onPress={() => setShowCreateUser(false)}
          >
            <Text className="font-semibold text-slate-500 dark:text-slate-400">Cancel</Text>
          </AnimatedPressable>
          <AnimatedPressable
            className="flex-1 p-3.5 rounded-lg bg-primary items-center"
            onPress={handleCreateUser}
          >
            <Text className="font-semibold text-white">Create</Text>
          </AnimatedPressable>
        </View>
      </FormModal>
```

- [ ] **Step 8: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add app/hub/users.tsx
git commit -m "feat(mobile): add create user, resolve usernames in permissions, user picker"
```

---

## Task 7: Create EditTopicModal Component

**Files:**
- Create: `client/src/components/channels/EditTopicModal.tsx`

Simplified mobile edit: description, everyone_read, everyone_write. Notification/storage policies are web-only per the platform analysis.

- [ ] **Step 1: Create EditTopicModal**

```tsx
// client/src/components/channels/EditTopicModal.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Switch,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Pressable } from "react-native";
import { getApiClient } from "../../api";
import type { Topic } from "../../api/types";
import Toast from "react-native-toast-message";

interface EditTopicModalProps {
  visible: boolean;
  topic: Topic | null;
  onClose: () => void;
  onUpdated: () => void;
}

export function EditTopicModal({ visible, topic, onClose, onUpdated }: EditTopicModalProps) {
  const [description, setDescription] = useState("");
  const [everyoneRead, setEveryoneRead] = useState(false);
  const [everyoneWrite, setEveryoneWrite] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (topic) {
      setDescription(topic.description ?? "");
      setEveryoneRead(topic.everyone_read);
      setEveryoneWrite(topic.everyone_write);
    }
  }, [topic]);

  const handleSave = async () => {
    if (!topic) return;
    setIsSubmitting(true);
    try {
      await getApiClient().updateTopic(topic.name, {
        description: description.trim() || undefined,
        everyone_read: everyoneRead,
        everyone_write: everyoneWrite,
      });
      Toast.show({ type: "success", text1: "Topic updated" });
      onUpdated();
      onClose();
    } catch (e) {
      Toast.show({
        type: "error",
        text1: "Failed to update topic",
        text2: e instanceof Error ? e.message : "Unknown error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-surface-bg" edges={["top"]}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View className="flex-row items-center justify-between px-4 py-4 border-b border-slate-200 dark:border-slate-700">
            <Pressable onPress={onClose} hitSlop={12}>
              <Text className="text-body text-slate-500 dark:text-slate-400">Cancel</Text>
            </Pressable>
            <Text className="text-body font-semibold text-gray-900 dark:text-white">
              Edit {topic?.name}
            </Text>
            <Pressable onPress={handleSave} disabled={isSubmitting} hitSlop={12}>
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#3b82f6" />
              ) : (
                <Text className="text-body font-semibold text-primary">Save</Text>
              )}
            </Pressable>
          </View>

          <View className="p-4 gap-4">
            <View>
              <Text className="text-caption font-medium text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">
                Description
              </Text>
              <TextInput
                className="bg-white dark:bg-surface-card rounded-lg px-3 py-2.5 text-body text-gray-900 dark:text-white border border-slate-200 dark:border-slate-700"
                placeholder="What is this topic for?"
                placeholderTextColor="#94a3b8"
                value={description}
                onChangeText={setDescription}
                multiline
                style={{ minHeight: 72, textAlignVertical: "top" }}
              />
            </View>

            <View className="bg-white dark:bg-surface-card rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <View className="flex-row items-center justify-between p-3">
                <View>
                  <Text className="text-body font-medium text-gray-900 dark:text-white">
                    Public Read
                  </Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Everyone can read messages
                  </Text>
                </View>
                <Switch value={everyoneRead} onValueChange={setEveryoneRead} />
              </View>
              <View className="h-px bg-slate-100 dark:bg-slate-700" />
              <View className="flex-row items-center justify-between p-3">
                <View>
                  <Text className="text-body font-medium text-gray-900 dark:text-white">
                    Public Write
                  </Text>
                  <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Everyone can publish messages
                  </Text>
                </View>
                <Switch value={everyoneWrite} onValueChange={setEveryoneWrite} />
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/channels/EditTopicModal.tsx
git commit -m "feat(mobile): add EditTopicModal with description and access controls"
```

---

## Task 8: Enhance ChannelRow Context Menu — Edit, Delete, Publish

**Files:**
- Modify: `client/src/components/channels/ChannelRow.tsx`
- Modify: `client/app/(tabs)/channels.tsx`

Add edit, delete, and publish actions to the channel context menu. Wire them to the EditTopicModal, ConfirmSheet, and PublishModal.

- [ ] **Step 1: Update ChannelRow to accept new callbacks**

Update the `ChannelRowProps` interface and add the new context menu items in `ChannelRow.tsx`:

```tsx
// client/src/components/channels/ChannelRow.tsx
import React, { useRef } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as ContextMenu from "zeego/context-menu";
import { useChannelsStore } from "../../store";
import type { Topic } from "../../api/types";

interface ChannelRowProps {
  topic: Topic;
  onEdit?: (topic: Topic) => void;
  onDelete?: (topic: Topic) => void;
  onPublish?: (topic: Topic) => void;
}

export const ChannelRow = React.memo(function ChannelRow({
  topic,
  onEdit,
  onDelete,
  onPublish,
}: ChannelRowProps) {
  const router = useRouter();
  const isPinned = useChannelsStore((s) => s.isPinned);
  const pinTopic = useChannelsStore((s) => s.pinTopic);
  const unpinTopic = useChannelsStore((s) => s.unpinTopic);
  const folders = useChannelsStore((s) => s.folders);
  const moveToFolder = useChannelsStore((s) => s.moveToFolder);

  const pinned = isPinned(topic.name);
  const menuOpenRef = useRef(false);

  const handlePress = () => {
    if (menuOpenRef.current) return;
    router.push(`/thread/${encodeURIComponent(`topic:${topic.name}`)}`);
  };

  return (
    <ContextMenu.Root
      onOpenChange={(open) => {
        menuOpenRef.current = open;
        if (!open) {
          setTimeout(() => { menuOpenRef.current = false; }, 300);
        }
      }}
    >
      <ContextMenu.Trigger>
        <Pressable onPress={handlePress}>
          <View className="px-4 py-3 bg-white dark:bg-surface-card rounded-lg mx-4 mb-1.5">
            <View className="flex-row items-center gap-3">
              {pinned ? (
                <View className="w-2 h-2 rounded-full bg-blue-500" />
              ) : (
                <View className="w-2 h-2 rounded-full bg-transparent" />
              )}
              <View className="flex-1 min-w-0">
                <Text
                  className="text-body font-medium text-gray-900 dark:text-white"
                  numberOfLines={1}
                >
                  {topic.name}
                </Text>
                {topic.description ? (
                  <Text
                    className="text-caption text-slate-500 dark:text-slate-400 mt-0.5"
                    numberOfLines={1}
                  >
                    {topic.description}
                  </Text>
                ) : null}
              </View>
              <View className="flex-row gap-1">
                {topic.everyone_read && (
                  <View className="bg-green-100 dark:bg-green-900/30 rounded px-1.5 py-0.5">
                    <Text className="text-xs text-green-700 dark:text-green-400">R</Text>
                  </View>
                )}
                {topic.everyone_write && (
                  <View className="bg-blue-100 dark:bg-blue-900/30 rounded px-1.5 py-0.5">
                    <Text className="text-xs text-blue-700 dark:text-blue-400">W</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </Pressable>
      </ContextMenu.Trigger>

      <ContextMenu.Content>
        <ContextMenu.Item key="pin" onSelect={() => pinned ? unpinTopic(topic.name) : pinTopic(topic.name)}>
          <ContextMenu.ItemTitle>{pinned ? "Unpin" : "Pin to Top"}</ContextMenu.ItemTitle>
        </ContextMenu.Item>

        {onPublish ? (
          <ContextMenu.Item key="publish" onSelect={() => onPublish(topic)}>
            <ContextMenu.ItemTitle>Publish Message</ContextMenu.ItemTitle>
          </ContextMenu.Item>
        ) : null}

        {onEdit ? (
          <ContextMenu.Item key="edit" onSelect={() => onEdit(topic)}>
            <ContextMenu.ItemTitle>Edit Topic</ContextMenu.ItemTitle>
          </ContextMenu.Item>
        ) : null}

        {folders.length > 0 ? (
          <ContextMenu.Group>
            {folders.map((folder) => (
              <ContextMenu.Item key={`folder-${folder.id}`} onSelect={() => moveToFolder(topic.name, folder.id)}>
                <ContextMenu.ItemTitle>Move to {folder.name}</ContextMenu.ItemTitle>
              </ContextMenu.Item>
            ))}
          </ContextMenu.Group>
        ) : null}

        <ContextMenu.Item key="remove-folder" onSelect={() => moveToFolder(topic.name, null)}>
          <ContextMenu.ItemTitle>Remove from Folder</ContextMenu.ItemTitle>
        </ContextMenu.Item>

        {onDelete ? (
          <ContextMenu.Item key="delete" destructive onSelect={() => onDelete(topic)}>
            <ContextMenu.ItemTitle>Delete Topic</ContextMenu.ItemTitle>
          </ContextMenu.Item>
        ) : null}
      </ContextMenu.Content>
    </ContextMenu.Root>
  );
});
```

- [ ] **Step 2: Wire channels.tsx to pass edit/delete/publish callbacks**

In `channels.tsx`, add imports for the new components and state:

```tsx
import { EditTopicModal } from "../../src/components/channels/EditTopicModal";
import { PublishModal } from "../../src/components/channels/PublishModal";
import { ConfirmSheet } from "../../src/components/design/ConfirmSheet";
```

Add state variables in `ChannelsScreen`:

```typescript
  const [editTopic, setEditTopic] = useState<Topic | null>(null);
  const [publishTopic, setPublishTopic] = useState<Topic | null>(null);
  const [deleteTopic, setDeleteTopic] = useState<Topic | null>(null);
```

Add delete handler:

```typescript
  const handleDeleteTopic = async () => {
    if (!deleteTopic) return;
    try {
      await getApiClient().deleteTopic(deleteTopic.name);
      fetchTopics();
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Failed to delete topic");
    }
  };
```

Update `FolderSection` to pass a render function for `ChannelRow` with the new props. In each `<FolderSection>` instance, the `ChannelRow` already receives `topic` but needs the callbacks. Since `FolderSection` renders `ChannelRow` internally, update `FolderSection.tsx` to accept optional callbacks and pass them through. Or alternatively, make `FolderSection` accept a custom `renderRow` prop.

The simplest approach: pass the callbacks through `FolderSection` as optional props.

Update `FolderSection.tsx` to add:

```typescript
interface FolderSectionProps {
  // ... existing props
  onEditTopic?: (topic: Topic) => void;
  onDeleteTopic?: (topic: Topic) => void;
  onPublishTopic?: (topic: Topic) => void;
}
```

And pass them to each `ChannelRow`:

```tsx
<ChannelRow
  key={topic.id}
  topic={topic}
  onEdit={onEditTopic}
  onDelete={onDeleteTopic}
  onPublish={onPublishTopic}
/>
```

Then in `channels.tsx`, pass callbacks to each `FolderSection`:

```tsx
onEditTopic={setEditTopic}
onDeleteTopic={setDeleteTopic}
onPublishTopic={setPublishTopic}
```

Add the modals before closing `</SafeAreaView>`:

```tsx
      <EditTopicModal
        visible={!!editTopic}
        topic={editTopic}
        onClose={() => setEditTopic(null)}
        onUpdated={fetchTopics}
      />
      <PublishModal
        visible={!!publishTopic}
        topicName={publishTopic?.name ?? ""}
        onClose={() => setPublishTopic(null)}
      />
      <ConfirmSheet
        visible={!!deleteTopic}
        onClose={() => setDeleteTopic(null)}
        onConfirm={handleDeleteTopic}
        title="Delete Topic"
        message={`Delete "${deleteTopic?.name}"? All messages in this topic will be permanently removed.`}
      />
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/channels/ChannelRow.tsx src/components/channels/FolderSection.tsx app/\(tabs\)/channels.tsx
git commit -m "feat(mobile): add edit, delete, publish actions to channel context menu"
```

---

## Task 9: Fix Create Topic — Add Read/Write Switches

**Files:**
- Modify: `client/app/(tabs)/channels.tsx`

Add `everyone_read` and `everyone_write` toggles to the create topic modal.

- [ ] **Step 1: Add state for access controls in CreateTopicModal**

Find `CreateTopicModal` in `channels.tsx`. After the `description` state, add:

```typescript
  const [everyoneRead, setEveryoneRead] = useState(false);
  const [everyoneWrite, setEveryoneWrite] = useState(false);
```

Add `Switch` import to the react-native import list at the top of the file.

- [ ] **Step 2: Pass access controls in the API call**

Update `handleCreate` to include the new fields:

```typescript
      await getApiClient().createTopic({
        name: trimmedName,
        description: description.trim() || undefined,
        everyone_read: everyoneRead,
        everyone_write: everyoneWrite,
      });
```

Also reset them after success:

```typescript
      setEveryoneRead(false);
      setEveryoneWrite(false);
```

- [ ] **Step 3: Add toggle UI after the description field**

After the Description input `</View>`, before the error message, add:

```tsx
          <View className="bg-white dark:bg-surface-card rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            <View className="flex-row items-center justify-between p-3">
              <Text className="text-body text-gray-900 dark:text-white">Everyone can read</Text>
              <Switch value={everyoneRead} onValueChange={setEveryoneRead} />
            </View>
            <View className="h-px bg-slate-100 dark:bg-slate-700" />
            <View className="flex-row items-center justify-between p-3">
              <Text className="text-body text-gray-900 dark:text-white">Everyone can write</Text>
              <Switch value={everyoneWrite} onValueChange={setEveryoneWrite} />
            </View>
          </View>
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add app/\(tabs\)/channels.tsx
git commit -m "feat(mobile): add everyone_read/everyone_write toggles to create topic"
```

---

## Task 10: Fix Thread View — Fetch from Server + Swipe-to-Delete

**Files:**
- Modify: `client/app/thread/[sourceId].tsx`

Two fixes: (1) fetch topic messages from server when store has no data, (2) add swipe-to-delete on messages.

- [ ] **Step 1: Add server fetch for topic messages**

In `thread/[sourceId].tsx`, add state and effect for server-side fetch:

```typescript
  const [serverMessages, setServerMessages] = useState<MessageResponse[]>([]);
  const [isFetching, setIsFetching] = useState(false);
```

Add the import for `getApiClient` and `MessageResponse`:

```typescript
import { getApiClient } from "../../src/api";
import type { MessageResponse } from "../../src/api";
```

Add a fetch effect after the existing hooks:

```typescript
  useEffect(() => {
    const storeMessages = groupedMessages.get(decodedSourceId);
    if (storeMessages && storeMessages.length > 0) return;

    // No store data — fetch from server for topics
    if (decodedSourceId.startsWith("topic:")) {
      const topicName = decodedSourceId.replace("topic:", "");
      setIsFetching(true);
      getApiClient()
        .getTopicMessages(topicName, 100, 0)
        .then(setServerMessages)
        .catch(() => {})
        .finally(() => setIsFetching(false));
    }
  }, [decodedSourceId, groupedMessages]);
```

Update the messages variable to use server data as fallback:

```typescript
  const storeMessages = groupedMessages.get(decodedSourceId);
  const messages = storeMessages && storeMessages.length > 0
    ? storeMessages
    : serverMessages;
```

- [ ] **Step 2: Add swipe-to-delete using SwipeableRow**

Import `SwipeableRow`:

```typescript
import { SwipeableRow } from "../../src/components/design/SwipeableRow";
```

Import `deleteMessage` from the messages store:

```typescript
  const deleteMessage = useMessagesStore((s) => s.deleteMessage);
```

Wrap each `MessageBubble` in a `SwipeableRow`:

```tsx
  const renderMessage = ({ item }: { item: MessageResponse }) => (
    <SwipeableRow onDelete={() => deleteMessage(item.id)}>
      <MessageBubble message={item} />
    </SwipeableRow>
  );
```

Update the LegendList to use the new render function:

```tsx
  <LegendList
    data={messages}
    renderItem={renderMessage}
    keyExtractor={(item) => item.id.toString()}
    // ... rest of existing props
  />
```

- [ ] **Step 3: Add pull-to-refresh**

Add refresh state and handler:

```typescript
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!decodedSourceId.startsWith("topic:")) return;
    const topicName = decodedSourceId.replace("topic:", "");
    setRefreshing(true);
    try {
      const msgs = await getApiClient().getTopicMessages(topicName, 100, 0);
      setServerMessages(msgs);
    } catch {}
    setRefreshing(false);
  };
```

Add `RefreshControl` import and the prop to the LegendList:

```tsx
import { RefreshControl } from "react-native";

// On the LegendList:
refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add app/thread/\[sourceId\].tsx
git commit -m "feat(mobile): fetch topic messages from server, add swipe-to-delete and pull-to-refresh"
```

---

## Task 11: Fix Grouped Inbox Infinite Scroll

**Files:**
- Modify: `client/app/(tabs)/index.tsx`

The grouped view `LegendList` has no `onEndReached`, so older messages never load.

- [ ] **Step 1: Add onEndReached to grouped LegendList**

Find the grouped view `LegendList` (the one rendering `SourceGroupCard`, around line 203-228). Add the missing props:

```tsx
  onEndReached={fetchOlderMessages}
  onEndReachedThreshold={0.3}
```

These should match the props already present on the stream view LegendList.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/\(tabs\)/index.tsx
git commit -m "fix(mobile): add infinite scroll to grouped inbox view"
```

---

## Task 12: Replace Alert.alert with ConfirmSheet in Hub Screens

**Files:**
- Modify: `client/app/hub/apps.tsx`
- Modify: `client/app/hub/clients.tsx`
- Modify: `client/app/hub/mqtt.tsx`
- Modify: `client/app/hub/webhooks.tsx`

Replace destructive confirmation `Alert.alert` calls with the themed `ConfirmSheet`. Non-destructive alerts (error messages, success feedback) can remain as `Alert.alert` or `Toast`.

- [ ] **Step 1: Update apps.tsx**

Import `ConfirmSheet`:

```typescript
import { ConfirmSheet } from '../../src/components/design/ConfirmSheet';
```

Add state:

```typescript
  const [deleteApp, setDeleteApp] = useState<Application | null>(null);
```

Replace `handleDeleteApp` body to use ConfirmSheet state instead of Alert:

```typescript
  const handleDeleteApp = (app: Application) => {
    setDeleteApp(app);
  };

  const confirmDeleteApp = async () => {
    if (!deleteApp) return;
    try {
      const api = getApiClient();
      await api.deleteApplication(deleteApp.id);
      fetchApps();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Delete failed');
    }
  };
```

Add before closing `</SafeAreaView>`:

```tsx
      <ConfirmSheet
        visible={!!deleteApp}
        onClose={() => setDeleteApp(null)}
        onConfirm={confirmDeleteApp}
        title="Delete Application"
        message={`Delete "${deleteApp?.name}"? This cannot be undone.`}
      />
```

- [ ] **Step 2: Repeat the same pattern for clients.tsx**

Replace delete client `Alert.alert` with `ConfirmSheet` state + modal, following the same pattern as Step 1.

- [ ] **Step 3: Repeat for mqtt.tsx**

Replace delete bridge `Alert.alert` with `ConfirmSheet`.

- [ ] **Step 4: Repeat for webhooks.tsx**

Replace delete webhook `Alert.alert` with `ConfirmSheet`.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add app/hub/apps.tsx app/hub/clients.tsx app/hub/mqtt.tsx app/hub/webhooks.tsx
git commit -m "feat(mobile): replace Alert.alert with themed ConfirmSheet for destructive actions"
```

---

## Task 13: Add Edit User Modal to Users Page

**Files:**
- Modify: `client/app/hub/users.tsx`

Add ability to edit username and email for existing users.

- [ ] **Step 1: Add edit user state**

```typescript
  const [editingUser, setEditingUser] = useState<UserResponse | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
```

- [ ] **Step 2: Add edit handler**

```typescript
  const openEditUser = (u: UserResponse) => {
    setEditingUser(u);
    setEditUsername(u.username);
    setEditEmail(u.email ?? '');
  };

  const handleEditUser = async () => {
    if (!editingUser || !editUsername.trim()) return;
    try {
      const api = getApiClient();
      await api.updateUser(editingUser.id, {
        username: editUsername.trim(),
        email: editEmail.trim() || undefined,
      });
      setEditingUser(null);
      fetchData();
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to update user');
    }
  };
```

- [ ] **Step 3: Add edit button to each user row**

In the user list rendering, add an edit icon before the delete icon:

```tsx
                      <Pressable onPress={() => openEditUser(u)} hitSlop={8}>
                        <Ionicons name="create-outline" size={16} color="#3b82f6" />
                      </Pressable>
```

- [ ] **Step 4: Add edit user FormModal**

```tsx
      <FormModal visible={!!editingUser} onClose={() => setEditingUser(null)} title="Edit User">
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Username"
          placeholderTextColor="#9ca3af"
          value={editUsername}
          onChangeText={setEditUsername}
          autoCapitalize="none"
        />
        <TextInput
          className="bg-slate-50 dark:bg-surface-elevated border border-slate-200 dark:border-slate-600 rounded-lg p-3 text-base text-slate-900 dark:text-slate-100"
          placeholder="Email (optional)"
          placeholderTextColor="#9ca3af"
          value={editEmail}
          onChangeText={setEditEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <View className="flex-row gap-3 mt-1">
          <AnimatedPressable
            className="flex-1 p-3.5 rounded-lg bg-slate-100 dark:bg-surface-elevated items-center"
            onPress={() => setEditingUser(null)}
          >
            <Text className="font-semibold text-slate-500 dark:text-slate-400">Cancel</Text>
          </AnimatedPressable>
          <AnimatedPressable
            className="flex-1 p-3.5 rounded-lg bg-primary items-center"
            onPress={handleEditUser}
          >
            <Text className="font-semibold text-white">Save</Text>
          </AnimatedPressable>
        </View>
      </FormModal>
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add app/hub/users.tsx
git commit -m "feat(mobile): add edit user modal for username and email"
```

---

## Verification Checklist

After all tasks complete, verify:

- [ ] `npx tsc --noEmit` — zero errors
- [ ] App builds: `npx expo run:android`
- [ ] Password change requires confirm match
- [ ] Server URL change triggers logout
- [ ] Create topic has read/write switches
- [ ] Channel long-press shows: Pin, Publish, Edit, Move to folder, Remove from folder, Delete
- [ ] Edit topic modal saves description + access controls
- [ ] Delete topic uses themed ConfirmSheet
- [ ] Thread view fetches messages from server for topics with no cached data
- [ ] Thread view supports swipe-to-delete and pull-to-refresh
- [ ] Grouped inbox scrolls to load older messages
- [ ] Users page: create user, edit user, permissions show usernames, user picker for permissions
- [ ] All destructive confirmations use ConfirmSheet (not Alert.alert)
- [ ] Markdown detected via both `extras` and `content_type`

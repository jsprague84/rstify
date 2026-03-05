# React Native Mobile App - Product Requirements Document

**Project:** rstify Mobile App Feature Parity Enhancement
**Platform:** React Native 0.83.2 + Expo SDK 55
**Goal:** Achieve 100% feature parity with web UI and backend capabilities
**Timeline:** 2-3 development sessions
**Version:** 1.0.0

---

## Executive Summary

The rstify React Native mobile app currently utilizes only **40% of backend capabilities**. The web UI was recently enhanced from 40% to 95% utilization by implementing markdown rendering, click URLs, custom icons, and action buttons. This PRD outlines the implementation plan to bring the mobile app to **100% feature parity**.

### Current Status
- **Backend:** 100% Gotify-compatible + enhanced features ✅
- **Web UI:** 95% feature complete ✅
- **Mobile App:** 40% feature complete ❌
- **Target:** 100% feature complete

### Success Criteria
1. ✅ Markdown rendering with tables, GFM support, and dark mode
2. ✅ Click URL handling with deep linking and external URLs
3. ✅ Custom icon/image display with caching and fallback
4. ✅ Action buttons (View, HTTP, Broadcast) with native UI
5. ✅ Full message extras parsing (client::display, client::notification, android::action)
6. ✅ File attachment display and download
7. ✅ Enhanced notification experience with rich content
8. ✅ 100% Gotify API compatibility maintained

---

## Table of Contents

1. [Feature Requirements](#feature-requirements)
2. [Technical Architecture](#technical-architecture)
3. [Implementation Plan](#implementation-plan)
4. [Component Specifications](#component-specifications)
5. [API Integration](#api-integration)
6. [Testing Strategy](#testing-strategy)
7. [Performance Requirements](#performance-requirements)
8. [Security Considerations](#security-considerations)
9. [Accessibility](#accessibility)
10. [Future Enhancements](#future-enhancements)

---

## Feature Requirements

### 1. Markdown Rendering (HIGH PRIORITY)

#### Requirements
- **FR-MD-001:** Render GitHub Flavored Markdown (GFM) in message content
- **FR-MD-002:** Support tables with column alignment (left, right, center)
- **FR-MD-003:** Support headers (h1-h6), bold, italic, strikethrough
- **FR-MD-004:** Support lists (ordered, unordered, nested)
- **FR-MD-005:** Support code blocks with syntax highlighting
- **FR-MD-006:** Support inline code with background color
- **FR-MD-007:** Support links with tap handling
- **FR-MD-008:** Support blockquotes with visual styling
- **FR-MD-009:** Support thematic breaks (horizontal rules)
- **FR-MD-010:** Support emoji rendering (Unicode and image-based)
- **FR-MD-011:** Adapt styling to device theme (light/dark mode)
- **FR-MD-012:** Detect markdown via `extras.client::display.contentType === "text/markdown"`
- **FR-MD-013:** Fall back to plain text when markdown is not specified

#### User Stories
- **As a user**, I want to see formatted tables in messages so that data is easy to read
- **As a user**, I want markdown formatting (bold, italic, headers) so messages are more readable
- **As a user**, I want code blocks to be syntax-highlighted so technical content is clear
- **As a user**, I want markdown to match the web UI appearance so experience is consistent

#### Acceptance Criteria
- [ ] Table with 3 columns renders with proper borders and alignment
- [ ] Headers (h1-h6) render with appropriate font sizes
- [ ] Bold, italic, and strikethrough render correctly
- [ ] Code blocks have background color and monospace font
- [ ] Links are tappable and open in browser
- [ ] Dark mode automatically applies dark markdown theme
- [ ] Non-markdown messages display as plain text (no regression)

#### Technical Implementation
**Library:** `react-native-enriched-markdown` (Score: 82.2, 73 snippets)
- **Why:** Native text rendering (no WebView), high performance, CommonMark compliant
- **Alternative:** `react-native-markdown-display` (simpler, 31 snippets)

**Installation:**
```bash
npx expo install react-native-enriched-markdown
```

**Component Structure:**
```tsx
// components/MessageContent.tsx
import { EnrichedMarkdownText, type MarkdownStyle } from 'react-native-enriched-markdown';
import { useColorScheme, StyleSheet, Text } from 'react-native';

interface MessageContentProps {
  message: string;
  extras?: Record<string, any>;
}

export function MessageContent({ message, extras }: MessageContentProps) {
  const colorScheme = useColorScheme();
  const isMarkdown = extras?.['client::display']?.contentType === 'text/markdown';

  const markdownStyle: MarkdownStyle = {
    paragraph: {
      fontSize: 14,
      color: colorScheme === 'dark' ? '#E5E7EB' : '#374151',
      marginBottom: 8,
    },
    h1: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
    h2: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
    h3: { fontSize: 18, fontWeight: '600', marginBottom: 6 },
    strong: { fontWeight: '700' },
    em: { fontStyle: 'italic' },
    link: {
      color: colorScheme === 'dark' ? '#60A5FA' : '#2563EB',
      underline: true
    },
    code: {
      color: colorScheme === 'dark' ? '#F472B6' : '#DB2777',
      backgroundColor: colorScheme === 'dark' ? '#1F2937' : '#F3F4F6',
      fontSize: 13,
    },
    codeBlock: {
      backgroundColor: colorScheme === 'dark' ? '#1F2937' : '#F9FAFB',
      borderColor: colorScheme === 'dark' ? '#374151' : '#E5E7EB',
      borderWidth: 1,
      borderRadius: 6,
      padding: 12,
      fontSize: 13,
    },
    blockquote: {
      borderColor: colorScheme === 'dark' ? '#4B5563' : '#D1D5DB',
      borderWidth: 3,
      backgroundColor: colorScheme === 'dark' ? '#1F2937' : '#F9FAFB',
      gapWidth: 12,
    },
    list: {
      bulletColor: colorScheme === 'dark' ? '#9CA3AF' : '#6B7280',
      markerColor: colorScheme === 'dark' ? '#9CA3AF' : '#6B7280',
      gapWidth: 8,
      marginLeft: 20,
    },
    // Table styles - EnrichedMarkdown renders tables as text blocks
    // May need custom table parsing if library doesn't support tables
  };

  if (isMarkdown) {
    return (
      <EnrichedMarkdownText
        markdown={message}
        markdownStyle={markdownStyle}
        onLinkPress={(event) => {
          Linking.openURL(event.url);
        }}
      />
    );
  }

  return (
    <Text style={styles.plainText}>
      {message}
    </Text>
  );
}
```

**Note on Tables:** `react-native-enriched-markdown` may not support tables fully. If tables don't render:
- **Option A:** Use `react-native-markdown-display` which has table support
- **Option B:** Parse tables manually and render using `<View>` and `<Text>` grid
- **Option C:** Show table data as formatted text with proper spacing

---

### 2. Click URL Handling (HIGH PRIORITY)

#### Requirements
- **FR-URL-001:** Detect `click_url` field in messages
- **FR-URL-002:** Make entire message card tappable when `click_url` is present
- **FR-URL-003:** Show visual indicator (icon) that message is tappable
- **FR-URL-004:** Handle HTTPS URLs by opening in browser
- **FR-URL-005:** Handle deep links (app://) by navigating within app
- **FR-URL-006:** Handle `extras.client::notification.click.url` as fallback
- **FR-URL-007:** Open URLs with `Linking.openURL()` for external links
- **FR-URL-008:** Provide haptic feedback on tap
- **FR-URL-009:** Show loading state when opening URL

#### User Stories
- **As a user**, I want to tap a message to open related links so I can quickly access details
- **As a user**, I want CI/CD notifications to link to build pages so I can view logs
- **As a user**, I want monitoring alerts to link to dashboards so I can investigate issues

#### Acceptance Criteria
- [ ] Message with `click_url` shows external link icon in top-right
- [ ] Tapping message opens URL in device browser
- [ ] Deep link URLs (app://) navigate within the app
- [ ] Haptic feedback occurs on tap
- [ ] Invalid URLs show error toast
- [ ] Works in both notification and message list views

#### Technical Implementation
```tsx
// components/MessageCard.tsx
import { TouchableOpacity, Linking, View, Text } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';

interface MessageCardProps {
  message: MessageResponse;
  onPress?: () => void;
}

export function MessageCard({ message, onPress }: MessageCardProps) {
  const clickUrl = message.click_url || message.extras?.['client::notification']?.click?.url;

  const handlePress = async () => {
    if (clickUrl) {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      try {
        const supported = await Linking.canOpenURL(clickUrl);
        if (supported) {
          await Linking.openURL(clickUrl);
        } else {
          Alert.alert('Error', 'Cannot open this URL');
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to open URL');
      }
    } else if (onPress) {
      onPress();
    }
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={clickUrl ? 0.7 : 1}
      disabled={!clickUrl && !onPress}
    >
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{message.title}</Text>
          {clickUrl && (
            <Ionicons name="open-outline" size={16} color="#60A5FA" />
          )}
        </View>
        <MessageContent message={message.message} extras={message.extras} />
      </View>
    </TouchableOpacity>
  );
}
```

---

### 3. Custom Icon/Image Display (MEDIUM PRIORITY)

#### Requirements
- **FR-ICON-001:** Display custom icons from `icon_url` field
- **FR-ICON-002:** Support PNG, JPG, GIF, SVG image formats
- **FR-ICON-003:** Support emoji URLs (e.g., Apple emoji CDN)
- **FR-ICON-004:** Cache loaded icons for performance
- **FR-ICON-005:** Show placeholder while loading
- **FR-ICON-006:** Fall back to app icon on error
- **FR-ICON-007:** Display icon at 40x40dp size
- **FR-ICON-008:** Support `extras.client::notification.bigImageUrl` for large images
- **FR-ICON-009:** Lazy load icons (only when visible)
- **FR-ICON-010:** Respect image memory constraints

#### User Stories
- **As a user**, I want to see app-specific icons so I can quickly identify message sources
- **As a user**, I want emoji icons for status indicators so messages are visually clear
- **As a user**, I want icons to load quickly so the app feels responsive

#### Acceptance Criteria
- [ ] Icon displays to the left of message title
- [ ] Icon is 40x40dp with rounded corners
- [ ] Cached icons load instantly on subsequent views
- [ ] Failed icon loads show default app icon
- [ ] Large images are scaled down appropriately
- [ ] Memory usage stays within reasonable limits

#### Technical Implementation
**Library:** `expo-image` (built-in with Expo SDK 55)

```tsx
// components/MessageIcon.tsx
import { Image } from 'expo-image';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MessageIconProps {
  iconUrl?: string;
  size?: number;
}

export function MessageIcon({ iconUrl, size = 40 }: MessageIconProps) {
  const [error, setError] = React.useState(false);

  if (!iconUrl || error) {
    return (
      <View style={[styles.iconContainer, { width: size, height: size }]}>
        <Ionicons name="notifications" size={size * 0.6} color="#9CA3AF" />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: iconUrl }}
      style={[styles.icon, { width: size, height: size }]}
      contentFit="cover"
      transition={200}
      placeholder={require('../assets/placeholder.png')}
      onError={() => setError(true)}
      cachePolicy="memory-disk"
      priority="normal"
    />
  );
}

const styles = StyleSheet.create({
  icon: {
    borderRadius: 8,
  },
  iconContainer: {
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

---

### 4. Action Buttons (HIGH PRIORITY)

#### Requirements
- **FR-ACT-001:** Parse actions from `extras.android::action.actions` array
- **FR-ACT-002:** Display action buttons below message content
- **FR-ACT-003:** Support "View" action type (open URL in browser)
- **FR-ACT-004:** Support "HTTP" action type (make API request)
- **FR-ACT-005:** Support "Broadcast" action type (Android intents)
- **FR-ACT-006:** Show loading state while action executes
- **FR-ACT-007:** Provide success/error feedback via toast
- **FR-ACT-008:** Haptic feedback on button press
- **FR-ACT-009:** Disable button during execution
- **FR-ACT-010:** Support up to 3 buttons per message
- **FR-ACT-011:** Handle action authentication (headers, tokens)
- **FR-ACT-012:** Log action execution for debugging

#### Action Types

##### View Action
- Opens URL in browser or in-app browser
- Works on iOS and Android
- Example: "View Details", "Open Dashboard"

##### HTTP Action
- Makes POST/GET/PUT/DELETE request to URL
- Supports custom headers (Authorization, etc.)
- Supports request body
- Shows success/error toast
- Example: "Approve", "Reject", "Restart Service"

##### Broadcast Action (Android Only)
- Sends Android intent to trigger system actions
- Only available on Android platform
- Shows "iOS not supported" message on iOS
- Example: "Turn On Lights", "Trigger Automation"

#### User Stories
- **As a user**, I want to approve deployments from notifications so I don't need to open web UI
- **As a user**, I want to view detailed information with one tap so navigation is faster
- **As a user**, I want to restart services from alerts so I can quickly respond to issues
- **As a user**, I want immediate feedback on action execution so I know it worked

#### Acceptance Criteria
- [ ] Action buttons render below message content
- [ ] View actions open URLs in browser
- [ ] HTTP actions make requests and show success/error
- [ ] Broadcast actions work on Android, show iOS message on iOS
- [ ] Loading state shows during execution
- [ ] Success shows green toast, error shows red toast
- [ ] Buttons are disabled while one executes
- [ ] Maximum 3 buttons displayed per message

#### Technical Implementation
```tsx
// components/MessageActions.tsx
import { View, TouchableOpacity, Text, Alert, Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

interface MessageAction {
  type: 'view' | 'http' | 'broadcast';
  label: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  intent?: string;
  extras?: Record<string, string>;
}

interface MessageActionsProps {
  message: MessageResponse;
}

export function MessageActions({ message }: MessageActionsProps) {
  const [executing, setExecuting] = React.useState<string | null>(null);

  const actions = parseActions(message.extras);
  if (!actions || actions.length === 0) return null;

  const handleAction = async (action: MessageAction, index: number) => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setExecuting(`${index}`);

    try {
      if (action.type === 'view') {
        const supported = await Linking.canOpenURL(action.url!);
        if (supported) {
          await Linking.openURL(action.url!);
        } else {
          throw new Error('Cannot open URL');
        }
      } else if (action.type === 'http') {
        const response = await fetch(action.url!, {
          method: action.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...action.headers,
          },
          body: action.body,
        });

        if (response.ok) {
          Toast.show({
            type: 'success',
            text1: 'Success',
            text2: `${action.label} completed`,
          });
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } else if (action.type === 'broadcast') {
        if (Platform.OS === 'android') {
          // Use react-native-send-intent or similar
          // await SendIntentAndroid.sendBroadcast(action.intent!, action.extras);
          Toast.show({
            type: 'success',
            text1: 'Broadcast Sent',
            text2: action.label,
          });
        } else {
          Toast.show({
            type: 'info',
            text1: 'iOS Not Supported',
            text2: 'Broadcast actions are Android only',
          });
        }
      }
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: 'Action Failed',
        text2: error.message,
      });
    } finally {
      setExecuting(null);
    }
  };

  return (
    <View style={styles.actionsContainer}>
      {actions.slice(0, 3).map((action, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.actionButton,
            executing === `${index}` && styles.actionButtonDisabled,
          ]}
          onPress={() => handleAction(action, index)}
          disabled={executing !== null}
        >
          {executing === `${index}` ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.actionText}>{action.label}</Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function parseActions(extras?: Record<string, any>): MessageAction[] | null {
  if (!extras) return null;

  // Try Gotify format
  if (extras['android::action']?.actions) {
    return extras['android::action'].actions;
  }

  // Try direct format
  if (Array.isArray(extras.actions)) {
    return extras.actions;
  }

  return null;
}

const styles = StyleSheet.create({
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
```

---

### 5. Enhanced Notification Experience (HIGH PRIORITY)

#### Requirements
- **FR-NOTIF-001:** Display rich notifications with markdown content
- **FR-NOTIF-002:** Show custom icons in notifications
- **FR-NOTIF-003:** Add action buttons to notifications
- **FR-NOTIF-004:** Handle notification taps to open app
- **FR-NOTIF-005:** Handle action button taps from notifications
- **FR-NOTIF-006:** Support big text style for long messages
- **FR-NOTIF-007:** Support big image style for image URLs
- **FR-NOTIF-008:** Respect priority levels for notification importance
- **FR-NOTIF-009:** Group notifications by app/topic
- **FR-NOTIF-010:** Clear notification on message view

#### User Stories
- **As a user**, I want rich notifications so I can see formatted content without opening app
- **As a user**, I want to act on notifications directly so I save time
- **As a user**, I want notifications grouped logically so my notification shade stays organized

#### Acceptance Criteria
- [ ] Notifications show title, message, and icon
- [ ] Priority 8+ shows as high priority notification
- [ ] Action buttons appear in notification (max 3)
- [ ] Tapping notification opens app to message detail
- [ ] Tapping action executes without opening app
- [ ] Markdown is stripped to plain text in notification
- [ ] Large images show in expanded notification

#### Technical Implementation
```tsx
// services/notificationService.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const { priority } = notification.request.content.data;

    return {
      shouldShowAlert: true,
      shouldPlaySound: priority >= 7,
      shouldSetBadge: true,
      priority: priority >= 8
        ? Notifications.AndroidNotificationPriority.HIGH
        : Notifications.AndroidNotificationPriority.DEFAULT,
    };
  },
});

export async function schedulePushNotification(message: MessageResponse) {
  const { title, message: body, priority, icon_url, extras } = message;

  // Parse actions for notification buttons
  const actions = parseActions(extras);
  const categoryIdentifier = actions && actions.length > 0
    ? `message-actions-${message.id}`
    : undefined;

  // Register category if actions exist
  if (categoryIdentifier && actions) {
    await Notifications.setNotificationCategoryAsync(categoryIdentifier, actions.map((action, index) => ({
      identifier: `action-${index}`,
      buttonTitle: action.label,
      options: {
        opensAppToForeground: action.type !== 'http',
        isDestructive: false,
        isAuthenticationRequired: false,
      },
    })));
  }

  await Notifications.scheduleNotificationAsync({
    content: {
      title: title || 'New Message',
      body: stripMarkdown(body),
      data: {
        messageId: message.id,
        click_url: message.click_url,
        actions: actions || [],
      },
      sound: priority >= 7 ? 'default' : undefined,
      priority: priority >= 8
        ? Notifications.AndroidNotificationPriority.HIGH
        : Notifications.AndroidNotificationPriority.DEFAULT,
      categoryIdentifier,
      // iOS big image
      ...(Platform.OS === 'ios' && icon_url && {
        attachments: [{ url: icon_url }],
      }),
      // Android big picture
      ...(Platform.OS === 'android' && icon_url && {
        android: {
          largeIcon: icon_url,
          style: 'bigPicture',
          picture: icon_url,
        },
      }),
    },
    trigger: null, // Immediate
  });
}

function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/#{1,6}\s/g, '') // Headers
    .replace(/\*\*(.+?)\*\*/g, '$1') // Bold
    .replace(/\*(.+?)\*/g, '$1') // Italic
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Links
    .replace(/`(.+?)`/g, '$1') // Code
    .replace(/\n\|.+\|\n/g, '\n') // Tables
    .trim();
}

// Listen for notification responses
Notifications.addNotificationResponseReceivedListener(async (response) => {
  const { notification, actionIdentifier } = response;
  const { messageId, click_url, actions } = notification.request.content.data;

  if (actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
    // Notification tapped - navigate to message
    if (click_url) {
      await Linking.openURL(click_url);
    } else {
      // Navigate to message detail in app
      navigation.navigate('MessageDetail', { id: messageId });
    }
  } else {
    // Action button tapped
    const actionIndex = parseInt(actionIdentifier.split('-')[1]);
    const action = actions[actionIndex];
    if (action) {
      await executeAction(action);
    }
  }
});
```

---

### 6. File Attachments Display (MEDIUM PRIORITY)

#### Requirements
- **FR-ATTACH-001:** Fetch attachments associated with message
- **FR-ATTACH-002:** Display attachment count badge on message
- **FR-ATTACH-003:** Show attachment list in message detail view
- **FR-ATTACH-004:** Display image thumbnails for image attachments
- **FR-ATTACH-005:** Show file icon for non-image attachments
- **FR-ATTACH-006:** Display file name and size
- **FR-ATTACH-007:** Support downloading attachments
- **FR-ATTACH-008:** Save images to photo library
- **FR-ATTACH-009:** Share attachments via native share sheet
- **FR-ATTACH-010:** Open attachments in appropriate app

#### User Stories
- **As a user**, I want to see when messages have attachments so I know to check them
- **As a user**, I want to view image attachments so I can see screenshots and photos
- **As a user**, I want to download files so I can access them offline
- **As a user**, I want to share attachments so I can forward them to others

#### Acceptance Criteria
- [ ] Messages with attachments show badge with count
- [ ] Tapping attachment badge opens attachment list
- [ ] Image attachments show thumbnails
- [ ] Tapping image opens full-screen viewer
- [ ] Non-image files show appropriate icon
- [ ] Download progress shows for large files
- [ ] Downloaded files open in appropriate app

#### Technical Implementation
```tsx
// components/MessageAttachments.tsx
import { View, TouchableOpacity, Text, Image, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Ionicons } from '@expo/vector-icons';

interface Attachment {
  id: number;
  filename: string;
  content_type: string;
  size: number;
  url: string;
}

interface MessageAttachmentsProps {
  messageId: number;
}

export function MessageAttachments({ messageId }: MessageAttachmentsProps) {
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [downloading, setDownloading] = React.useState<number | null>(null);

  React.useEffect(() => {
    fetchAttachments();
  }, [messageId]);

  const fetchAttachments = async () => {
    try {
      const response = await api.getMessageAttachments(messageId);
      setAttachments(response);
    } catch (error) {
      console.error('Failed to fetch attachments:', error);
    }
  };

  const downloadAttachment = async (attachment: Attachment) => {
    setDownloading(attachment.id);

    try {
      const downloadResumable = FileSystem.createDownloadResumable(
        attachment.url,
        FileSystem.documentDirectory + attachment.filename,
        {},
        (downloadProgress) => {
          const progress = downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite;
          // Update progress indicator
        }
      );

      const result = await downloadResumable.downloadAsync();
      if (result) {
        // Save to photo library if image
        if (attachment.content_type.startsWith('image/')) {
          const permission = await MediaLibrary.requestPermissionsAsync();
          if (permission.granted) {
            await MediaLibrary.saveToLibraryAsync(result.uri);
            Alert.alert('Success', 'Image saved to photo library');
          }
        } else {
          // Share file
          await Sharing.shareAsync(result.uri);
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to download attachment');
    } finally {
      setDownloading(null);
    }
  };

  if (attachments.length === 0) return null;

  return (
    <View style={styles.attachmentsContainer}>
      <Text style={styles.attachmentsTitle}>
        Attachments ({attachments.length})
      </Text>
      {attachments.map((attachment) => (
        <TouchableOpacity
          key={attachment.id}
          style={styles.attachmentItem}
          onPress={() => downloadAttachment(attachment)}
          disabled={downloading === attachment.id}
        >
          {attachment.content_type.startsWith('image/') ? (
            <Image
              source={{ uri: attachment.url }}
              style={styles.attachmentThumbnail}
            />
          ) : (
            <Ionicons name="document" size={40} color="#9CA3AF" />
          )}
          <View style={styles.attachmentInfo}>
            <Text style={styles.attachmentName} numberOfLines={1}>
              {attachment.filename}
            </Text>
            <Text style={styles.attachmentSize}>
              {formatBytes(attachment.size)}
            </Text>
          </View>
          {downloading === attachment.id ? (
            <ActivityIndicator size="small" />
          ) : (
            <Ionicons name="download-outline" size={20} color="#4F46E5" />
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
```

---

### 7. Full Message Extras Support (LOW PRIORITY)

#### Requirements
- **FR-EXTRA-001:** Parse all extras namespaces (client::display, client::notification, android::action)
- **FR-EXTRA-002:** Display custom extras in message detail view
- **FR-EXTRA-003:** Support arbitrary key-value pairs
- **FR-EXTRA-004:** Format extras for readability
- **FR-EXTRA-005:** Allow copying extras to clipboard

#### User Stories
- **As a developer**, I want to see all message extras so I can debug integrations
- **As a power user**, I want to access custom metadata so I can use app-specific features

#### Acceptance Criteria
- [ ] All extras keys are visible in message detail
- [ ] Nested objects are properly formatted
- [ ] Long-press on extras copies to clipboard
- [ ] System extras (client::*) are highlighted

---

## Technical Architecture

### Component Hierarchy

```
App
├── Navigation
│   ├── AuthNavigator
│   │   ├── LoginScreen
│   │   └── RegisterScreen
│   └── MainNavigator
│       ├── MessagesScreen
│       │   ├── MessageList
│       │   │   └── MessageCard
│       │   │       ├── MessageIcon
│       │   │       ├── MessageContent (Markdown)
│       │   │       └── MessageActions
│       │   └── MessageDetail
│       │       ├── MessageContent
│       │       ├── MessageActions
│       │       ├── MessageAttachments
│       │       └── MessageExtras
│       ├── AppsScreen
│       ├── TopicsScreen
│       └── SettingsScreen
└── Services
    ├── API Client
    ├── Notification Service
    ├── WebSocket Service
    └── Storage Service
```

### Data Flow

1. **Message Reception:**
   - WebSocket receives new message
   - Store in local state
   - Trigger notification
   - Update UI

2. **Message Display:**
   - Fetch from API or local cache
   - Parse extras for features
   - Render with appropriate components

3. **Action Execution:**
   - User taps action button
   - Execute action (View/HTTP/Broadcast)
   - Show feedback toast
   - Log execution

### State Management

**Recommendation:** Use React Context + AsyncStorage for persistence

```tsx
// contexts/MessagesContext.tsx
interface MessagesContextType {
  messages: MessageResponse[];
  fetchMessages: () => Promise<void>;
  deleteMessage: (id: number) => Promise<void>;
  markAsRead: (id: number) => void;
}

const MessagesContext = React.createContext<MessagesContextType | undefined>(undefined);

export function MessagesProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = React.useState<MessageResponse[]>([]);

  React.useEffect(() => {
    // Load from AsyncStorage on mount
    loadCachedMessages();

    // Setup WebSocket
    const ws = setupWebSocket();

    return () => ws.close();
  }, []);

  const fetchMessages = async () => {
    const data = await api.listMessages();
    setMessages(data.messages);
    await AsyncStorage.setItem('messages', JSON.stringify(data.messages));
  };

  return (
    <MessagesContext.Provider value={{ messages, fetchMessages, deleteMessage, markAsRead }}>
      {children}
    </MessagesContext.Provider>
  );
}
```

---

## Implementation Plan

### Phase 1: Core Features (Session 1 - 4 hours)

**Goal:** Implement markdown, click URLs, and basic action buttons

#### Tasks
1. ✅ **Setup Dependencies** (30 min)
   - Install `react-native-enriched-markdown`
   - Install `react-native-toast-message`
   - Update Expo SDK if needed

2. ✅ **Markdown Rendering** (2 hours)
   - Create `MessageContent.tsx` component
   - Implement markdown detection from extras
   - Style markdown for light/dark themes
   - Test with tables, headers, lists, code blocks
   - Handle fallback to plain text

3. ✅ **Click URL Support** (1 hour)
   - Update `MessageCard.tsx` to detect click_url
   - Add TouchableOpacity wrapper
   - Implement `Linking.openURL()` handler
   - Add visual indicator (icon)
   - Add haptic feedback

4. ✅ **Basic Action Buttons** (30 min)
   - Create `MessageActions.tsx` component
   - Parse actions from extras
   - Implement View action (open URL)
   - Add loading state
   - Style buttons

**Deliverables:**
- Markdown rendering works
- Click URLs functional
- View actions work
- Basic UI matches web UI

**Testing:**
- [ ] Send markdown message with table - renders correctly
- [ ] Send message with click_url - taps open browser
- [ ] Send message with View action - button works

---

### Phase 2: Advanced Actions & Icons (Session 2 - 3 hours)

**Goal:** Complete action buttons, add custom icons, enhance notifications

#### Tasks
1. ✅ **HTTP Actions** (1.5 hours)
   - Implement HTTP action execution
   - Support custom headers and body
   - Add success/error handling
   - Show toast feedback
   - Log requests for debugging

2. ✅ **Broadcast Actions** (30 min)
   - Implement Android broadcast actions
   - Add platform check (Android only)
   - Show iOS not supported message
   - Test with Android intents

3. ✅ **Custom Icons** (1 hour)
   - Create `MessageIcon.tsx` component
   - Implement expo-image with caching
   - Add placeholder and error fallback
   - Integrate into MessageCard
   - Test with various image URLs

**Deliverables:**
- All action types work
- Custom icons display
- Error handling robust

**Testing:**
- [ ] HTTP action approves deployment successfully
- [ ] Broadcast action works on Android
- [ ] Custom icons load and cache
- [ ] Error states handled gracefully

---

### Phase 3: Notifications & Attachments (Session 3 - 3 hours)

**Goal:** Rich notifications, file attachments, polish

#### Tasks
1. ✅ **Enhanced Notifications** (1.5 hours)
   - Configure notification categories
   - Add action buttons to notifications
   - Implement notification tap handling
   - Test priority levels
   - Add custom sounds

2. ✅ **File Attachments** (1.5 hours)
   - Implement attachment fetching
   - Create attachment list UI
   - Add download functionality
   - Implement share feature
   - Add image viewer

**Deliverables:**
- Rich notifications work
- Attachments can be downloaded
- Image viewer implemented

**Testing:**
- [ ] Notification shows with actions
- [ ] Action buttons work from notification
- [ ] Attachments download successfully
- [ ] Images save to photo library

---

### Phase 4: Polish & Testing (Ongoing)

**Goal:** Refinement, performance, edge cases

#### Tasks
1. ✅ **Performance Optimization**
   - Implement FlatList virtualization
   - Optimize image loading
   - Reduce re-renders
   - Profile with React DevTools

2. ✅ **Error Handling**
   - Add error boundaries
   - Graceful degradation
   - Offline support
   - Retry logic

3. ✅ **Accessibility**
   - Add screen reader labels
   - Test with VoiceOver/TalkBack
   - Ensure proper contrast ratios
   - Add semantic HTML equivalents

4. ✅ **Documentation**
   - Update README.md
   - Add inline code comments
   - Create user guide section for mobile
   - Document known limitations

**Deliverables:**
- App is performant (60fps)
- Accessibility compliant
- Comprehensive documentation

---

## Component Specifications

### MessageContent Component

**Purpose:** Render message body with markdown support

**Props:**
```typescript
interface MessageContentProps {
  message: string;
  extras?: Record<string, any>;
  testID?: string;
}
```

**Behavior:**
- Check `extras.client::display.contentType`
- If `text/markdown`, render with EnrichedMarkdownText
- Otherwise, render plain Text
- Apply theme colors based on colorScheme

**Dependencies:**
- react-native-enriched-markdown
- @react-native-community/hooks (useColorScheme)

---

### MessageActions Component

**Purpose:** Display and handle action buttons

**Props:**
```typescript
interface MessageActionsProps {
  message: MessageResponse;
  compact?: boolean;
}
```

**Behavior:**
- Parse actions from `extras.android::action.actions`
- Display up to 3 buttons
- Handle View, HTTP, Broadcast actions
- Show loading state during execution
- Toast feedback on success/error

**Dependencies:**
- react-native-toast-message
- expo-haptics
- expo-linking

---

### MessageIcon Component

**Purpose:** Display custom message icon with fallback

**Props:**
```typescript
interface MessageIconProps {
  iconUrl?: string;
  size?: number;
  fallback?: string; // Icon name
}
```

**Behavior:**
- Load image from iconUrl
- Show placeholder while loading
- Fall back to Ionicons icon on error
- Cache loaded images

**Dependencies:**
- expo-image
- @expo/vector-icons

---

### MessageCard Component

**Purpose:** Display message in list with all features

**Props:**
```typescript
interface MessageCardProps {
  message: MessageResponse;
  onPress?: () => void;
  compact?: boolean;
}
```

**Behavior:**
- Show icon, title, content, actions
- Handle click_url taps
- Navigate to detail on press
- Show priority badge
- Show attachment count

**Dependencies:**
- MessageIcon
- MessageContent
- MessageActions

---

## API Integration

### Existing Endpoints

All endpoints already exist in rstify backend:

- `GET /message?limit=50` - List messages
- `GET /message/:id` - Get message detail
- `DELETE /message/:id` - Delete message
- `GET /message/:id/attachments` - List attachments (may need to add)
- `GET /attachment/:id` - Download attachment

### WebSocket Integration

```typescript
// services/websocket.ts
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function connectWebSocket(token: string, onMessage: (msg: MessageResponse) => void) {
  socket = io('wss://rstify.js-node.cc', {
    auth: { token },
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log('WebSocket connected');
  });

  socket.on('message', (message: MessageResponse) => {
    onMessage(message);
    // Trigger notification if app in background
    if (AppState.currentState !== 'active') {
      schedulePushNotification(message);
    }
  });

  socket.on('disconnect', () => {
    console.log('WebSocket disconnected');
  });

  return socket;
}

export function disconnectWebSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
```

---

## Testing Strategy

### Unit Tests

**Components to Test:**
- MessageContent - markdown rendering, plain text fallback
- MessageActions - action parsing, execution, error handling
- MessageIcon - loading, error states, caching

**Test Framework:** Jest + React Native Testing Library

```typescript
// __tests__/MessageContent.test.tsx
import { render } from '@testing-library/react-native';
import { MessageContent } from '../components/MessageContent';

describe('MessageContent', () => {
  it('renders markdown when contentType is text/markdown', () => {
    const { getByText } = render(
      <MessageContent
        message="**Bold text**"
        extras={{ 'client::display': { contentType: 'text/markdown' } }}
      />
    );
    expect(getByText('Bold text')).toBeTruthy();
  });

  it('renders plain text when no contentType', () => {
    const { getByText } = render(
      <MessageContent message="Plain text" />
    );
    expect(getByText('Plain text')).toBeTruthy();
  });
});
```

### Integration Tests

**Flows to Test:**
- Message fetch → Display → Action execution
- Notification received → Tap → Open app
- Attachment download → Save → Share

### End-to-End Tests

**Tools:** Detox or Maestro

**Scenarios:**
1. User logs in → Sees messages with markdown
2. User taps message with click_url → Browser opens
3. User taps "Approve" action → HTTP request succeeds
4. User receives notification → Taps → App opens to message

### Device Testing

**Required Devices:**
- iOS Simulator (latest iOS)
- Android Emulator (API 30+)
- Physical iPhone (test notifications, haptics)
- Physical Android (test broadcasts, intents)

---

## Performance Requirements

### Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| FlatList scroll FPS | 60fps | React DevTools Profiler |
| Message render time | <100ms | Performance.now() |
| Image load time | <500ms | Expo Image metrics |
| Action execution time | <1s | Network tab |
| App launch time | <2s | Flipper |
| Memory usage | <150MB | Xcode Instruments / Android Profiler |

### Optimization Strategies

1. **FlatList Virtualization**
   - Use `getItemLayout` for consistent item heights
   - Set `maxToRenderPerBatch={10}`
   - Set `updateCellsBatchingPeriod={50}`

2. **Image Optimization**
   - Use expo-image caching
   - Limit image size with `maxWidth`/`maxHeight`
   - Lazy load images outside viewport

3. **Memoization**
   - Use `React.memo` for MessageCard
   - Use `useMemo` for expensive parsing
   - Use `useCallback` for event handlers

4. **Code Splitting**
   - Lazy load screens with React.lazy
   - Dynamic imports for heavy libraries

---

## Security Considerations

### Authentication
- Store JWT securely in Keychain/Keystore (use expo-secure-store)
- Implement auto-refresh for expired tokens
- Clear credentials on logout

### Network Security
- Use HTTPS for all API requests
- Implement certificate pinning for production
- Validate all URLs before opening

### Data Privacy
- Don't log sensitive data (tokens, passwords)
- Implement secure storage for cached messages
- Clear cache on logout

### Action Security
- Validate action URLs before execution
- Confirm destructive actions
- Rate limit action executions

---

## Accessibility

### Screen Reader Support

**iOS VoiceOver:**
- Add `accessibilityLabel` to all interactive elements
- Use `accessibilityHint` for complex actions
- Announce notifications with `UIAccessibility.post`

**Android TalkBack:**
- Add `accessible={true}` to touchables
- Use `accessibilityRole` to identify element types

### Visual Accessibility

- Ensure 4.5:1 contrast ratio for text
- Support Dynamic Type / Font Scaling
- Don't rely solely on color for information

### Motor Accessibility

- Minimum touch target size: 44x44dp
- Add sufficient spacing between buttons
- Support voice control

---

## Future Enhancements

### Phase 5: Advanced Features

1. **Message Expiration/TTL**
   - Automatically delete old messages
   - Show countdown timer

2. **Message Search**
   - Full-text search
   - Filter by app/topic
   - Search history

3. **Offline Mode**
   - Queue outgoing messages
   - Sync when online
   - Conflict resolution

4. **Themes**
   - Multiple color schemes
   - Custom theme builder
   - System theme sync

5. **Widgets**
   - iOS Home Screen widget
   - Android home screen widget
   - Show recent messages

6. **Shortcuts**
   - Siri Shortcuts integration
   - Quick actions from home screen
   - Voice commands

7. **Apple Watch / Wear OS**
   - View messages on watch
   - Quick actions from wrist
   - Custom complications

---

## Dependencies Summary

### New Dependencies to Install

```json
{
  "dependencies": {
    "react-native-enriched-markdown": "^1.0.0",
    "react-native-toast-message": "^2.1.6",
    "expo-haptics": "~14.0.0",
    "expo-image": "~2.0.0",
    "expo-notifications": "~0.30.0",
    "expo-file-system": "~18.0.0",
    "expo-sharing": "~13.0.0",
    "expo-media-library": "~17.0.0",
    "expo-secure-store": "~14.0.0",
    "@react-native-async-storage/async-storage": "1.24.0"
  }
}
```

**Installation Command:**
```bash
cd client
npx expo install react-native-enriched-markdown react-native-toast-message expo-haptics expo-image expo-notifications expo-file-system expo-sharing expo-media-library expo-secure-store @react-native-async-storage/async-storage
```

---

## Success Metrics

### Feature Adoption
- 90%+ of users see markdown rendered correctly
- 70%+ of users interact with click URLs
- 50%+ of users use action buttons

### Performance
- App maintains 60fps during scrolling
- Image load time <500ms
- Zero crashes related to new features

### User Satisfaction
- App Store rating maintains 4.5+ stars
- Positive feedback on rich messaging
- Reduction in support tickets related to message display

### Gotify Compatibility
- 100% of Gotify messages render correctly
- Zero compatibility issues reported

---

## Deliverables Checklist

### Code
- [ ] MessageContent component with markdown
- [ ] MessageActions component with all action types
- [ ] MessageIcon component with caching
- [ ] Enhanced notification service
- [ ] File attachment UI
- [ ] Updated TypeScript types
- [ ] Unit tests for all new components
- [ ] Integration tests for critical flows

### Documentation
- [ ] Updated README.md with new features
- [ ] Component documentation with examples
- [ ] User guide section for mobile app
- [ ] API integration guide
- [ ] Known limitations documented

### Testing
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests for critical flows
- [ ] Tested on iOS simulator
- [ ] Tested on Android emulator
- [ ] Tested on physical devices

### Release
- [ ] Build and submit to TestFlight
- [ ] Build and submit to internal testing track
- [ ] Gather beta tester feedback
- [ ] Address critical bugs
- [ ] Production release

---

## Appendix

### Gotify Message Examples

#### Basic Markdown
```json
{
  "title": "Server Report",
  "message": "## Status\n\n**All systems operational**\n\n- CPU: 45%\n- RAM: 60%\n- Disk: 120GB",
  "extras": {
    "client::display": {
      "contentType": "text/markdown"
    }
  }
}
```

#### With Actions
```json
{
  "title": "Deployment Ready",
  "message": "Version 2.1.0 is ready to deploy",
  "click_url": "https://ci.example.com/deploys/456",
  "icon_url": "https://example.com/rocket.png",
  "priority": 7,
  "extras": {
    "android::action": {
      "actions": [
        {
          "type": "view",
          "label": "View Details",
          "url": "https://ci.example.com/deploys/456"
        },
        {
          "type": "http",
          "label": "Deploy",
          "url": "https://api.example.com/deploy",
          "method": "POST",
          "headers": {
            "Authorization": "Bearer TOKEN"
          }
        }
      ]
    }
  }
}
```

#### With Table
```json
{
  "title": "Daily Metrics",
  "message": "| Service | Status | Response Time |\n|:--|:--:|--:|\n| API | ✅ | 45ms |\n| DB | ✅ | 12ms |\n| Cache | ⚠️ | 150ms |",
  "extras": {
    "client::display": {
      "contentType": "text/markdown"
    }
  }
}
```

---

## References

- [Expo Notifications Documentation](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [Expo Image Documentation](https://docs.expo.dev/versions/latest/sdk/image/)
- [react-native-enriched-markdown](https://github.com/software-mansion-labs/react-native-enriched-markdown)
- [Gotify Message Extras](https://gotify.net/docs/msgextras)
- [React Native Performance](https://reactnative.dev/docs/performance)

---

**END OF PRODUCT REQUIREMENTS DOCUMENT**

**Ready for Implementation:** Yes ✅
**Dependencies Identified:** Yes ✅
**Timeline Estimated:** Yes ✅
**Success Criteria Defined:** Yes ✅

**Next Step:** Begin Phase 1 implementation (Markdown + Click URLs + Basic Actions)

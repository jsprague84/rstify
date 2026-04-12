import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  SectionList,
  Text,
  RefreshControl,
  Pressable,
  Alert,
  Modal,
  Switch,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { Ionicons } from '@expo/vector-icons';
import { EmptyState } from '../../src/components/EmptyState';
import { AnimatedPressable } from '../../src/components/design/AnimatedPressable';
import { ConfirmSheet } from '../../src/components/design/ConfirmSheet';
import { HubScreenHeader } from '../../src/components/hub/HubScreenHeader';
import { FormInput } from '../../src/components/design/FormInput';
import { useHubData } from '../../src/hooks/useHubData';
import { getApiClient } from '../../src/api';
import type {
  WebhookConfig,
  WebhookConfigWithHealth,
  Topic,
  WebhookDeliveryLog,
  WebhookTestResult,
} from '../../src/api';
import * as Clipboard from 'expo-clipboard';

type Direction = 'incoming' | 'outgoing';

export default function WebhooksScreen() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [showCreate, setShowCreate] = useState(false);

  const [editWebhook, setEditWebhook] = useState<WebhookConfigWithHealth | null>(null);
  const [editName, setEditName] = useState('');
  const [editEnabled, setEditEnabled] = useState(true);
  const [editTargetUrl, setEditTargetUrl] = useState('');
  const [editHttpMethod, setEditHttpMethod] = useState('POST');
  const [editHeaders, setEditHeaders] = useState('');
  const [editBodyTemplate, setEditBodyTemplate] = useState('');
  const [editMaxRetries, setEditMaxRetries] = useState('3');
  const [editRetryDelay, setEditRetryDelay] = useState('60');
  const [editTimeout, setEditTimeout] = useState('15');
  const [editFollowRedirects, setEditFollowRedirects] = useState(true);
  const [editGroupName, setEditGroupName] = useState('');
  const [editContentType, setEditContentType] = useState('application/json');
  const [editAuthType, setEditAuthType] = useState<'none' | 'bearer' | 'basic' | 'apikey'>('none');
  const [editAuthToken, setEditAuthToken] = useState('');
  const [editAuthUser, setEditAuthUser] = useState('');
  const [editAuthPass, setEditAuthPass] = useState('');
  const [deliveriesWebhook, setDeliveriesWebhook] = useState<WebhookConfig | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDeliveryLog[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  // Create form state
  const [direction, setDirection] = useState<Direction>('incoming');
  const [name, setName] = useState('');
  const [webhookType, setWebhookType] = useState('custom');
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [targetUrl, setTargetUrl] = useState('');
  const [httpMethod, setHttpMethod] = useState('POST');
  const [createHeaders, setCreateHeaders] = useState('');
  const [createContentType, setCreateContentType] = useState('application/json');
  const [createAuthType, setCreateAuthType] = useState<'none' | 'bearer' | 'basic' | 'apikey'>('none');
  const [createAuthToken, setCreateAuthToken] = useState('');
  const [createAuthUser, setCreateAuthUser] = useState('');
  const [createAuthPass, setCreateAuthPass] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [createMaxRetries, setCreateMaxRetries] = useState('3');
  const [createRetryDelay, setCreateRetryDelay] = useState('60');
  const [createTimeout, setCreateTimeout] = useState('15');
  const [createFollowRedirects, setCreateFollowRedirects] = useState(true);
  const [createGroupName, setCreateGroupName] = useState('');

  const [serverBase, setServerBase] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<WebhookConfigWithHealth | null>(null);

  const fetchWebhooks = useCallback(() => {
    const api = getApiClient();
    return api.listWebhooks();
  }, []);
  const { items: webhooks, isLoading, refresh, mutate } = useHubData(fetchWebhooks);

  // Fetch topics separately (they're used in forms, not as the primary list)
  useEffect(() => {
    (async () => {
      try {
        const api = getApiClient();
        const tp = await api.listTopics();
        setTopics(tp);
        if (!serverBase) {
          try { setServerBase(api.getBaseUrl() || ''); } catch { /* ignore */ }
        }
      } catch { /* topics are optional, fail silently */ }
    })();
  }, [serverBase]);

  // --- Utility helpers ---

  const parseHeadersToText = (headers?: string | null): string => {
    if (!headers) return '';
    try {
      const obj = JSON.parse(headers);
      return Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join('\n');
    } catch { return headers; }
  };

  const parseTextToHeaders = (text: string): Record<string, string> | undefined => {
    const headers: Record<string, string> = {};
    for (const line of text.split('\n')) {
      const idx = line.indexOf(':');
      if (idx > 0) headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
    return Object.keys(headers).length > 0 ? headers : undefined;
  };

  const mergeAuthIntoHeaders = (
    headersText: string, authType: string, authToken: string, authUser: string, authPass: string,
  ): Record<string, string> | undefined => {
    const base = parseTextToHeaders(headersText) || {};
    for (const k of Object.keys(base)) {
      if (k.toLowerCase() === 'authorization' || k.toLowerCase() === 'x-api-key') delete base[k];
    }
    if (authType === 'bearer' && authToken) base['Authorization'] = `Bearer ${authToken}`;
    else if (authType === 'basic' && authUser) {
      const encoded = btoa(`${authUser}:${authPass}`);
      base['Authorization'] = `Basic ${encoded}`;
    } else if (authType === 'apikey' && authToken) base['X-API-Key'] = authToken;
    return Object.keys(base).length > 0 ? base : undefined;
  };

  const detectAuthFromHeaders = (headersJson: string | null) => {
    if (!headersJson) return { type: 'none' as const, token: '', user: '', pass: '' };
    try {
      const obj = JSON.parse(headersJson);
      const authValue = Object.entries(obj).find(([k]) => k.toLowerCase() === 'authorization')?.[1] as string | undefined;
      if (authValue?.startsWith('Bearer ')) return { type: 'bearer' as const, token: authValue.slice(7), user: '', pass: '' };
      if (authValue?.startsWith('Basic ')) {
        try {
          const decoded = atob(authValue.slice(6));
          const [user, ...rest] = decoded.split(':');
          return { type: 'basic' as const, token: '', user, pass: rest.join(':') };
        } catch { /* fall through */ }
      }
      const apiKeyEntry = Object.entries(obj).find(([k]) => k.toLowerCase() === 'x-api-key');
      if (apiKeyEntry) return { type: 'apikey' as const, token: apiKeyEntry[1] as string, user: '', pass: '' };
    } catch { /* fall through */ }
    return { type: 'none' as const, token: '', user: '', pass: '' };
  };

  const resetForm = () => {
    setDirection('incoming'); setName(''); setWebhookType('custom');
    setSelectedTopicId(null); setTargetUrl(''); setHttpMethod('POST');
    setCreateHeaders(''); setBodyTemplate('');
    setCreateAuthType('none'); setCreateAuthToken(''); setCreateAuthUser(''); setCreateAuthPass('');
    setCreateMaxRetries('3'); setCreateRetryDelay('60'); setCreateTimeout('15');
    setCreateFollowRedirects(true); setCreateGroupName(''); setCreateContentType('application/json');
  };

  const getWebhookUrl = (wh: WebhookConfigWithHealth) => {
    const base = serverBase || 'https://your-server';
    return `${base}/api/wh/${wh.token}`;
  };

  // --- CRUD handlers ---

  const handleCreate = async () => {
    if (!name.trim()) { Alert.alert('Error', 'Name is required'); return; }
    if (direction === 'outgoing' && !targetUrl.trim()) {
      Alert.alert('Error', 'Target URL is required for outgoing webhooks'); return;
    }
    const api = getApiClient();
    const ok = await mutate(() => api.createWebhook({
      name: name.trim(), webhookType: webhookType, template: null, direction: direction,
      targetTopicId: selectedTopicId ?? null,
      targetApplicationId: null,
      enabled: null,
      targetUrl: direction === 'outgoing' ? targetUrl.trim() : null,
      httpMethod: direction === 'outgoing' ? httpMethod : null,
      headers: direction === 'outgoing' ? (() => {
        const h = mergeAuthIntoHeaders(createHeaders, createAuthType, createAuthToken, createAuthUser, createAuthPass) || {};
        h['Content-Type'] = createContentType;
        return h;
      })() : null,
      bodyTemplate: direction === 'outgoing' && bodyTemplate.trim() ? bodyTemplate.trim() : null,
      maxRetries: direction === 'outgoing' ? parseInt(createMaxRetries, 10) || 3 : null,
      retryDelaySecs: direction === 'outgoing' ? parseInt(createRetryDelay, 10) || 60 : null,
      timeoutSecs: direction === 'outgoing' ? parseInt(createTimeout, 10) || 15 : null,
      followRedirects: direction === 'outgoing' ? createFollowRedirects : null,
      groupName: createGroupName.trim() || null,
      secret: null,
    }));
    if (ok) {
      resetForm(); setShowCreate(false);
    }
  };

  const handleToggleEnabled = async (webhook: WebhookConfigWithHealth) => {
    const api = getApiClient();
    await mutate(() => api.updateWebhook(webhook.id, {
      name: null, template: null, enabled: !webhook.enabled,
      targetUrl: null, httpMethod: null, headers: null,
      bodyTemplate: null, maxRetries: null, retryDelaySecs: null,
      timeoutSecs: null, followRedirects: null, groupName: null, secret: null,
    }));
  };

  const handleDuplicate = (webhook: WebhookConfigWithHealth) => {
    Alert.alert('Duplicate Webhook', `Create a copy of "${webhook.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Duplicate',
        onPress: async () => {
          const api = getApiClient();
          await mutate(() => api.createWebhook({
            name: `${webhook.name} (copy)`, webhookType: webhook.webhook_type,
            direction: webhook.direction,
            targetTopicId: webhook.target_topic_id ?? null,
            targetApplicationId: webhook.target_application_id ?? null,
            template: webhook.template ? JSON.parse(webhook.template) : null,
            enabled: webhook.enabled,
            targetUrl: webhook.target_url ?? null,
            httpMethod: webhook.http_method,
            headers: webhook.headers ? JSON.parse(webhook.headers) : null,
            bodyTemplate: webhook.body_template ?? null,
            maxRetries: webhook.max_retries, retryDelaySecs: webhook.retry_delay_secs,
            timeoutSecs: webhook.timeout_secs, followRedirects: webhook.follow_redirects,
            groupName: webhook.group_name ?? null,
            secret: null,
          }));
        },
      },
    ]);
  };

  const handleDelete = (webhook: WebhookConfigWithHealth) => setDeleteTarget(webhook);

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const api = getApiClient();
    const ok = await mutate(() => api.deleteWebhook(deleteTarget.id));
    if (ok) setDeleteTarget(null);
  };

  const handleTest = async (webhook: WebhookConfigWithHealth) => {
    setTestingId(webhook.id);
    try {
      const api = getApiClient();
      const result: WebhookTestResult = await api.testWebhook(webhook.id);
      if (webhook.direction === 'incoming') {
        const url = result.webhook_url || getWebhookUrl(webhook);
        Alert.alert('Incoming Webhook URL', `Send POST requests to:\n\n${url}`, [
          { text: 'Copy URL', onPress: () => Clipboard.setStringAsync(url) },
          { text: 'Copy curl', onPress: () => Clipboard.setStringAsync(result.curl_example || '') },
          { text: 'OK' },
        ]);
      } else {
        Alert.alert(
          result.success ? 'Test Successful' : 'Test Failed',
          result.success
            ? `HTTP ${result.status_code}\n${result.response_preview?.slice(0, 200) || ''}`
            : result.error || 'Unknown error',
        );
      }
    } catch (e) {
      Alert.alert('Test Failed', e instanceof Error ? e.message : 'Test failed');
    } finally { setTestingId(null); }
  };

  const openEdit = (wh: WebhookConfigWithHealth) => {
    setEditWebhook(wh); setEditName(wh.name); setEditEnabled(wh.enabled);
    setEditTargetUrl(wh.target_url || ''); setEditHttpMethod(wh.http_method || 'POST');
    setEditHeaders(parseHeadersToText(wh.headers));
    if (wh.headers) {
      try {
        const obj = JSON.parse(wh.headers);
        const ct = Object.entries(obj).find(([k]) => k.toLowerCase() === 'content-type')?.[1] as string | undefined;
        setEditContentType(ct || 'application/json');
      } catch { setEditContentType('application/json'); }
    } else { setEditContentType('application/json'); }
    const auth = detectAuthFromHeaders(wh.headers);
    setEditAuthType(auth.type); setEditAuthToken(auth.token);
    setEditAuthUser(auth.user); setEditAuthPass(auth.pass);
    setEditBodyTemplate(wh.body_template || '');
    setEditMaxRetries(String(wh.max_retries ?? 3));
    setEditRetryDelay(String(wh.retry_delay_secs ?? 60));
    setEditTimeout(String(wh.timeout_secs ?? 15));
    setEditFollowRedirects(wh.follow_redirects ?? true);
    setEditGroupName(wh.group_name || '');
  };

  const handleEdit = async () => {
    if (!editWebhook) return;
    const isOutgoing = editWebhook.direction === 'outgoing';
    const api = getApiClient();
    const ok = await mutate(() => api.updateWebhook(editWebhook.id, {
      name: editName.trim() || null, template: null, enabled: editEnabled,
      groupName: editGroupName.trim() || null, secret: null,
      targetUrl: isOutgoing ? (editTargetUrl.trim() || null) : null,
      httpMethod: isOutgoing ? editHttpMethod : null,
      headers: isOutgoing ? (() => {
        const h = mergeAuthIntoHeaders(editHeaders, editAuthType, editAuthToken, editAuthUser, editAuthPass) || {};
        h['Content-Type'] = editContentType; return h;
      })() : null,
      bodyTemplate: isOutgoing ? (editBodyTemplate.trim() || null) : null,
      maxRetries: isOutgoing ? (parseInt(editMaxRetries, 10) || 3) : null,
      retryDelaySecs: isOutgoing ? (parseInt(editRetryDelay, 10) || 60) : null,
      timeoutSecs: isOutgoing ? (parseInt(editTimeout, 10) || 15) : null,
      followRedirects: isOutgoing ? editFollowRedirects : null,
    }));
    if (ok) setEditWebhook(null);
  };

  const openDeliveries = async (wh: WebhookConfigWithHealth) => {
    setDeliveriesWebhook(wh); setDeliveriesLoading(true);
    try {
      const api = getApiClient();
      const logs = await api.listWebhookDeliveries(wh.id);
      setDeliveries(logs);
    } catch (e) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Failed to load deliveries');
    } finally { setDeliveriesLoading(false); }
  };

  const generateCurl = (wh: WebhookConfigWithHealth): string => {
    if (wh.direction === 'outgoing' && wh.target_url) {
      const parts = [`curl -X ${wh.http_method} '${wh.target_url}'`];
      if (wh.headers) {
        try {
          const h = JSON.parse(wh.headers) as Record<string, string>;
          for (const [k, v] of Object.entries(h)) parts.push(`-H '${k}: ${v}'`);
        } catch { /* skip */ }
      }
      if (wh.http_method !== 'GET' && wh.http_method !== 'DELETE') {
        const body = wh.body_template || '{"title":"Test","message":"Hello"}';
        parts.push(`-d '${body.replace(/'/g, "'\\''")}'`);
        if (!wh.headers || !wh.headers.toLowerCase().includes('content-type')) {
          parts.push("-H 'Content-Type: application/json'");
        }
      }
      return parts.join(' \\\n  ');
    }
    const url = getWebhookUrl(wh);
    return `curl -X POST '${url}' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"title":"Test","message":"Hello"}'`;
  };

  const handleCopyCurl = async (wh: WebhookConfigWithHealth) => {
    try { await Clipboard.setStringAsync(generateCurl(wh)); Alert.alert('Copied', 'curl command copied'); }
    catch { Alert.alert('Error', 'Failed to copy'); }
  };

  const handleCopyUrl = async (wh: WebhookConfigWithHealth) => {
    const url = getWebhookUrl(wh);
    try { await Clipboard.setStringAsync(url); Alert.alert('Copied', 'Webhook URL copied'); }
    catch { Alert.alert('Webhook URL', url); }
  };

  const closeModal = () => { resetForm(); setShowCreate(false); };

  // --- Helper components ---

  const DirectionBadge = ({ dir }: { dir: string }) => {
    const isOut = dir === 'outgoing';
    return (
      <View className={`flex-row items-center gap-1 px-1.5 py-0.5 rounded ${isOut ? 'bg-amber-100 dark:bg-amber-900/50' : 'bg-blue-100 dark:bg-blue-900/50'}`}>
        <Ionicons
          name={isOut ? 'arrow-forward-outline' : 'arrow-back-outline'}
          size={10}
          color={isOut ? '#92400e' : '#1e40af'}
        />
        <Text className={`text-[10px] font-semibold ${isOut ? 'text-amber-800 dark:text-amber-300' : 'text-blue-800 dark:text-blue-300'}`}>
          {isOut ? 'Outgoing' : 'Incoming'}
        </Text>
      </View>
    );
  };

  const InputField = FormInput;

  const ChipRow = ({ items, selected, onSelect }: {
    items: string[]; selected: string; onSelect: (v: string) => void;
  }) => (
    <View className="flex-row gap-2 flex-wrap">
      {items.map((item) => (
        <Pressable
          key={item}
          className={`px-3 py-2 rounded-lg items-center ${selected === item ? 'bg-primary' : 'bg-slate-100 dark:bg-surface-elevated'}`}
          onPress={() => onSelect(item)}
        >
          <Text className={`text-sm font-semibold ${selected === item ? 'text-white' : 'text-slate-600 dark:text-slate-300'}`}>
            {item}
          </Text>
        </Pressable>
      ))}
    </View>
  );

  const AuthFields = ({ authType, setAuthType, authToken, setAuthToken, authUser, setAuthUser, authPass, setAuthPass }: {
    authType: 'none' | 'bearer' | 'basic' | 'apikey'; setAuthType: (t: 'none' | 'bearer' | 'basic' | 'apikey') => void;
    authToken: string; setAuthToken: (t: string) => void;
    authUser: string; setAuthUser: (t: string) => void;
    authPass: string; setAuthPass: (t: string) => void;
  }) => (
    <>
      <Text className="text-xs text-slate-500 dark:text-slate-400 mb-1">Authentication</Text>
      <ChipRow
        items={['none', 'bearer', 'basic', 'apikey']}
        selected={authType}
        onSelect={(v) => setAuthType(v as 'none' | 'bearer' | 'basic' | 'apikey')}
      />
      {authType === 'bearer' && <InputField value={authToken} onChangeText={setAuthToken} placeholder="Bearer token" />}
      {authType === 'basic' && (
        <View className="flex-row gap-2">
          <View className="flex-1"><InputField value={authUser} onChangeText={setAuthUser} placeholder="Username" /></View>
          <View className="flex-1"><InputField value={authPass} onChangeText={setAuthPass} placeholder="Password" secureTextEntry /></View>
        </View>
      )}
      {authType === 'apikey' && <InputField value={authToken} onChangeText={setAuthToken} placeholder="API Key value" />}
    </>
  );

  // --- Sections ---

  const sections = (() => {
    const ungrouped: WebhookConfigWithHealth[] = [];
    const groups: Record<string, WebhookConfigWithHealth[]> = {};
    for (const w of webhooks) {
      if (w.group_name) (groups[w.group_name] ??= []).push(w);
      else ungrouped.push(w);
    }
    const s: { title: string; data: WebhookConfigWithHealth[] }[] = [];
    if (ungrouped.length > 0) s.push({ title: '', data: ungrouped });
    for (const [title, data] of Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))) {
      s.push({ title, data });
    }
    return s;
  })();

  return (
    <SafeAreaView className="flex-1 bg-surface-light-bg dark:bg-surface-bg" edges={['top']}>
      <HubScreenHeader title="Webhooks" onAdd={() => setShowCreate(true)} />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id.toString()}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <View className="px-4 py-1.5 bg-surface-light-bg dark:bg-surface-bg">
              <Text className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {section.title} ({section.data.length})
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <View className="px-4 py-4 bg-white dark:bg-surface-card border-b border-slate-100 dark:border-slate-700">
            <View className="flex-row justify-between items-start">
              <View className="flex-1 mr-3">
                <View className="flex-row items-center gap-2">
                  <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">{item.name}</Text>
                  {item.direction === 'outgoing' && item.recent_success_rate != null && (
                    <View className={`w-2 h-2 rounded-full ${item.recent_success_rate >= 0.8 ? 'bg-green-500' : item.recent_success_rate >= 0.5 ? 'bg-amber-500' : 'bg-red-500'}`} />
                  )}
                  <DirectionBadge dir={item.direction} />
                </View>
                <Text className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {item.webhook_type}{item.group_name ? ` \u2022 ${item.group_name}` : ''}
                </Text>
                {item.direction === 'outgoing' && item.target_url ? (
                  <Text className="text-xs text-slate-500 dark:text-slate-400 mt-0.5" numberOfLines={1}>
                    {item.http_method} {item.target_url}
                  </Text>
                ) : (
                  <Pressable className="flex-row items-center gap-1 mt-1" onPress={() => handleCopyUrl(item)}>
                    <Text className="text-[11px] text-primary font-mono" numberOfLines={1}>
                      {getWebhookUrl(item)}
                    </Text>
                    <Ionicons name="copy-outline" size={12} color="#3b82f6" />
                  </Pressable>
                )}
              </View>
              <View className="items-center gap-3">
                <Switch
                  value={item.enabled}
                  onValueChange={() => handleToggleEnabled(item)}
                  trackColor={{ false: '#94a3b8', true: '#93c5fd' }}
                  thumbColor={item.enabled ? '#3b82f6' : '#94a3b8'}
                />
                <View className="flex-row gap-3">
                  <Pressable onPress={() => handleTest(item)} hitSlop={8}>
                    <Ionicons name="play-outline" size={18} color={testingId === item.id ? '#94a3b8' : '#22c55e'} />
                  </Pressable>
                  <Pressable onPress={() => handleCopyCurl(item)} hitSlop={8}>
                    <Ionicons name="code-slash-outline" size={18} color="#94a3b8" />
                  </Pressable>
                  <Pressable onPress={() => handleDuplicate(item)} hitSlop={8}>
                    <Ionicons name="copy-outline" size={18} color="#94a3b8" />
                  </Pressable>
                  <Pressable onPress={() => openDeliveries(item)} hitSlop={8}>
                    <Ionicons name="list-outline" size={18} color="#94a3b8" />
                  </Pressable>
                  <Pressable onPress={() => openEdit(item)} hitSlop={8}>
                    <Ionicons name="create-outline" size={18} color="#3b82f6" />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(item)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} />}
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState icon="link-outline" title="No webhooks" subtitle="Create a webhook to integrate with external services" />
          )
        }
        contentContainerStyle={webhooks.length === 0 ? { flex: 1 } : undefined}
      />

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="fade" transparent>
        <Pressable className="flex-1 bg-black/40 justify-center px-4" onPress={closeModal}>
          <Pressable style={{ maxHeight: '85%' }} onPress={() => {}}>
            <KeyboardAwareScrollView bottomOffset={20} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
              <View className="bg-white dark:bg-surface-card rounded-2xl p-6 gap-3">
                <Text className="text-lg font-bold text-slate-900 dark:text-slate-100">Create Webhook</Text>

                {/* Direction toggle */}
                <View className="flex-row gap-2">
                  <Pressable
                    className={`flex-1 p-2.5 rounded-lg items-center ${direction === 'incoming' ? 'bg-primary' : 'bg-slate-100 dark:bg-surface-elevated'}`}
                    onPress={() => setDirection('incoming')}
                  >
                    <Text className={`font-semibold ${direction === 'incoming' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>Incoming</Text>
                  </Pressable>
                  <Pressable
                    className={`flex-1 p-2.5 rounded-lg items-center ${direction === 'outgoing' ? 'bg-primary' : 'bg-slate-100 dark:bg-surface-elevated'}`}
                    onPress={() => setDirection('outgoing')}
                  >
                    <Text className={`font-semibold ${direction === 'outgoing' ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`}>Outgoing</Text>
                  </Pressable>
                </View>

                <InputField value={name} onChangeText={setName} placeholder="Webhook name" />
                <InputField value={createGroupName} onChangeText={setCreateGroupName} placeholder="Group (optional)" />

                {/* Webhook type */}
                <Text className="text-xs text-slate-500 dark:text-slate-400">Webhook Type</Text>
                <ChipRow items={['custom', 'json', 'github', 'grafana']} selected={webhookType} onSelect={setWebhookType} />

                {/* Topic selector */}
                {topics.length > 0 && (
                  <>
                    <Text className="text-xs text-slate-500 dark:text-slate-400">
                      Target Topic {direction === 'incoming' ? '(required)' : '(triggers outgoing)'}
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <View className="flex-row gap-1.5">
                        <Pressable
                          className={`px-3 py-1.5 rounded-full ${selectedTopicId === null ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-slate-100 dark:bg-surface-elevated'}`}
                          onPress={() => setSelectedTopicId(null)}
                        >
                          <Text className={`text-sm ${selectedTopicId === null ? 'text-blue-800 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>None</Text>
                        </Pressable>
                        {topics.map((t) => (
                          <Pressable
                            key={t.id}
                            className={`px-3 py-1.5 rounded-full ${selectedTopicId === t.id ? 'bg-blue-100 dark:bg-blue-900/50' : 'bg-slate-100 dark:bg-surface-elevated'}`}
                            onPress={() => setSelectedTopicId(t.id)}
                          >
                            <Text className={`text-sm ${selectedTopicId === t.id ? 'text-blue-800 dark:text-blue-300' : 'text-slate-500 dark:text-slate-400'}`}>{t.name}</Text>
                          </Pressable>
                        ))}
                      </View>
                    </ScrollView>
                  </>
                )}

                {/* Outgoing-specific fields */}
                {direction === 'outgoing' && (
                  <>
                    <InputField value={targetUrl} onChangeText={setTargetUrl} placeholder="Target URL" autoCapitalize="none" keyboardType="url" />
                    <ChipRow items={['GET', 'POST', 'PUT', 'PATCH', 'DELETE']} selected={httpMethod} onSelect={setHttpMethod} />
                    <Text className="text-xs text-slate-500 dark:text-slate-400">Content-Type</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <ChipRow
                        items={['application/json', 'application/x-www-form-urlencoded', 'text/plain', 'application/xml']}
                        selected={createContentType}
                        onSelect={setCreateContentType}
                      />
                    </ScrollView>
                    <AuthFields
                      authType={createAuthType} setAuthType={setCreateAuthType}
                      authToken={createAuthToken} setAuthToken={setCreateAuthToken}
                      authUser={createAuthUser} setAuthUser={setCreateAuthUser}
                      authPass={createAuthPass} setAuthPass={setCreateAuthPass}
                    />
                    <InputField value={createHeaders} onChangeText={setCreateHeaders} placeholder="Additional headers (Key: Value per line)" multiline numberOfLines={2} />
                    <InputField value={bodyTemplate} onChangeText={setBodyTemplate} placeholder="Body template ({{message}}, {{title}})" multiline numberOfLines={3} />
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Text className="text-xs text-slate-500 dark:text-slate-400 mb-1">Max Retries</Text>
                        <InputField value={createMaxRetries} onChangeText={setCreateMaxRetries} placeholder="3" keyboardType="numeric" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs text-slate-500 dark:text-slate-400 mb-1">Retry Delay (s)</Text>
                        <InputField value={createRetryDelay} onChangeText={setCreateRetryDelay} placeholder="60" keyboardType="numeric" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs text-slate-500 dark:text-slate-400 mb-1">Timeout (s)</Text>
                        <InputField value={createTimeout} onChangeText={setCreateTimeout} placeholder="15" keyboardType="numeric" />
                      </View>
                    </View>
                    <View className="flex-row justify-between items-center py-1">
                      <Text className="text-xs text-slate-500 dark:text-slate-400">Follow Redirects</Text>
                      <Switch value={createFollowRedirects} onValueChange={setCreateFollowRedirects} />
                    </View>
                  </>
                )}

                <View className="flex-row gap-3 mt-1">
                  <AnimatedPressable className="flex-1 p-3.5 rounded-lg bg-slate-100 dark:bg-surface-elevated items-center" onPress={closeModal}>
                    <Text className="font-semibold text-slate-500 dark:text-slate-400">Cancel</Text>
                  </AnimatedPressable>
                  <AnimatedPressable className="flex-1 p-3.5 rounded-lg bg-primary items-center" onPress={handleCreate}>
                    <Text className="font-semibold text-white">Create</Text>
                  </AnimatedPressable>
                </View>
              </View>
            </KeyboardAwareScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={!!editWebhook} animationType="fade" transparent>
        <Pressable className="flex-1 bg-black/40 justify-center px-4" onPress={() => setEditWebhook(null)}>
          <Pressable style={{ maxHeight: '85%' }} onPress={() => {}}>
            <KeyboardAwareScrollView bottomOffset={20} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
              <View className="bg-white dark:bg-surface-card rounded-2xl p-6 gap-3">
                <Text className="text-lg font-bold text-slate-900 dark:text-slate-100">Edit Webhook</Text>

                {/* Incoming URL display */}
                {editWebhook && editWebhook.direction !== 'outgoing' && (
                  <Pressable
                    className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-2.5"
                    onPress={() => {
                      const url = getWebhookUrl(editWebhook);
                      Clipboard.setStringAsync(url);
                      Alert.alert('Copied', 'Webhook URL copied');
                    }}
                  >
                    <Text className="text-[11px] font-semibold text-blue-800 dark:text-blue-300 mb-1">Webhook URL (tap to copy)</Text>
                    <Text className="text-xs text-blue-900 dark:text-blue-200 font-mono" numberOfLines={2}>
                      {getWebhookUrl(editWebhook)}
                    </Text>
                  </Pressable>
                )}

                {/* Regenerate token */}
                {editWebhook && editWebhook.direction !== 'outgoing' && (
                  <Pressable onPress={() => {
                    Alert.alert('Regenerate Token', 'The old webhook URL will stop working. Continue?', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Regenerate', style: 'destructive',
                        onPress: async () => {
                          const api = getApiClient();
                          await mutate(async () => {
                            const updated = await api.regenerateWebhookToken(editWebhook.id);
                            setEditWebhook({ ...editWebhook, ...updated });
                          });
                        },
                      },
                    ]);
                  }}>
                    <Text className="text-amber-600 text-sm mt-1">Regenerate Token</Text>
                  </Pressable>
                )}

                {editWebhook && (
                  <Text className="text-xs text-slate-400 dark:text-slate-500">
                    Type: {editWebhook.webhook_type} | Direction: {editWebhook.direction}
                  </Text>
                )}

                <InputField value={editName} onChangeText={setEditName} placeholder="Name" />
                <InputField value={editGroupName} onChangeText={setEditGroupName} placeholder="Group (optional)" />

                <View className="flex-row justify-between items-center py-1">
                  <Text className="text-base text-slate-900 dark:text-slate-100">Enabled</Text>
                  <Switch value={editEnabled} onValueChange={setEditEnabled} />
                </View>

                {editWebhook?.direction === 'outgoing' && (
                  <>
                    <InputField value={editTargetUrl} onChangeText={setEditTargetUrl} placeholder="Target URL" autoCapitalize="none" keyboardType="url" />
                    <ChipRow items={['GET', 'POST', 'PUT', 'PATCH', 'DELETE']} selected={editHttpMethod} onSelect={setEditHttpMethod} />
                    <Text className="text-xs text-slate-500 dark:text-slate-400">Content-Type</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                      <ChipRow
                        items={['application/json', 'application/x-www-form-urlencoded', 'text/plain', 'application/xml']}
                        selected={editContentType}
                        onSelect={setEditContentType}
                      />
                    </ScrollView>
                    <AuthFields
                      authType={editAuthType} setAuthType={setEditAuthType}
                      authToken={editAuthToken} setAuthToken={setEditAuthToken}
                      authUser={editAuthUser} setAuthUser={setEditAuthUser}
                      authPass={editAuthPass} setAuthPass={setEditAuthPass}
                    />
                    <InputField value={editHeaders} onChangeText={setEditHeaders} placeholder="Additional headers (Key: Value per line)" multiline numberOfLines={2} />
                    <InputField value={editBodyTemplate} onChangeText={setEditBodyTemplate} placeholder="Body template" multiline numberOfLines={3} />
                    <View className="flex-row gap-2">
                      <View className="flex-1">
                        <Text className="text-xs text-slate-500 dark:text-slate-400 mb-1">Max Retries</Text>
                        <InputField value={editMaxRetries} onChangeText={setEditMaxRetries} placeholder="3" keyboardType="numeric" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs text-slate-500 dark:text-slate-400 mb-1">Retry Delay (s)</Text>
                        <InputField value={editRetryDelay} onChangeText={setEditRetryDelay} placeholder="60" keyboardType="numeric" />
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs text-slate-500 dark:text-slate-400 mb-1">Timeout (s)</Text>
                        <InputField value={editTimeout} onChangeText={setEditTimeout} placeholder="15" keyboardType="numeric" />
                      </View>
                    </View>
                    <View className="flex-row justify-between items-center py-1">
                      <Text className="text-xs text-slate-500 dark:text-slate-400">Follow Redirects</Text>
                      <Switch value={editFollowRedirects} onValueChange={setEditFollowRedirects} />
                    </View>
                  </>
                )}

                <View className="flex-row gap-3 mt-1">
                  <AnimatedPressable className="flex-1 p-3.5 rounded-lg bg-slate-100 dark:bg-surface-elevated items-center" onPress={() => setEditWebhook(null)}>
                    <Text className="font-semibold text-slate-500 dark:text-slate-400">Cancel</Text>
                  </AnimatedPressable>
                  <AnimatedPressable className="flex-1 p-3.5 rounded-lg bg-primary items-center" onPress={handleEdit}>
                    <Text className="font-semibold text-white">Save</Text>
                  </AnimatedPressable>
                </View>
              </View>
            </KeyboardAwareScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Deliveries Modal */}
      <Modal visible={!!deliveriesWebhook} animationType="fade" transparent>
        <Pressable className="flex-1 bg-black/40 justify-center px-4" onPress={() => setDeliveriesWebhook(null)}>
          <Pressable style={{ maxHeight: '85%' }} onPress={() => {}}>
            <View className="bg-white dark:bg-surface-card rounded-2xl p-6 gap-3">
              <Text className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Delivery Logs {deliveriesWebhook ? `\u2014 ${deliveriesWebhook.name}` : ''}
              </Text>
              {deliveriesLoading ? (
                <Text className="text-slate-500 dark:text-slate-400 text-center py-4">Loading...</Text>
              ) : deliveries.length === 0 ? (
                <Text className="text-slate-500 dark:text-slate-400 text-center py-4">No deliveries yet</Text>
              ) : (
                <FlatList
                  data={deliveries}
                  keyExtractor={(d) => d.id.toString()}
                  style={{ maxHeight: 300 }}
                  renderItem={({ item: d }) => (
                    <View className="py-2 border-b border-slate-100 dark:border-slate-700">
                      <View className="flex-row justify-between">
                        <Text className={`text-sm font-semibold ${d.success ? 'text-green-500' : 'text-red-500'}`}>
                          {d.success ? 'OK' : 'FAIL'} {d.status_code ? `(${d.status_code})` : ''}
                        </Text>
                        <Text className="text-[11px] text-slate-400 dark:text-slate-500">{d.duration_ms}ms</Text>
                      </View>
                      <Text className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {new Date(d.attempted_at).toLocaleString()}
                      </Text>
                      {d.response_body_preview ? (
                        <Text className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5" numberOfLines={2}>
                          {d.response_body_preview}
                        </Text>
                      ) : null}
                    </View>
                  )}
                />
              )}
              <AnimatedPressable
                className="p-3.5 rounded-lg bg-slate-100 dark:bg-surface-elevated items-center mt-2"
                onPress={() => setDeliveriesWebhook(null)}
              >
                <Text className="font-semibold text-slate-500 dark:text-slate-400">Close</Text>
              </AnimatedPressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ConfirmSheet
        visible={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title="Delete Webhook"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
      />
    </SafeAreaView>
  );
}

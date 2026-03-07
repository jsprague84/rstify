import type {
  User, CreateUser, UpdateUser,
  Application, CreateApplication, UpdateApplication,
  Client, CreateClient, UpdateClient,
  Topic, CreateTopic,
  TopicPermission, CreateTopicPermission,
  PagedMessages, MessageResponse, AttachmentInfo,
  WebhookConfig, CreateWebhookConfig, UpdateWebhookConfig,
  WebhookDeliveryLog,
  StatsResponse, LoginResponse,
  HealthResponse, VersionResponse,
} from './types';

const BASE = '';

function getToken(): string | null {
  return localStorage.getItem('rstify_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (options.body && typeof options.body === 'string') {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Auth
export const api = {
  login(username: string, password: string): Promise<LoginResponse> {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },

  // Users
  listUsers(): Promise<User[]> {
    return request('/user');
  },
  createUser(data: CreateUser): Promise<User> {
    return request('/user', { method: 'POST', body: JSON.stringify(data) });
  },
  updateUser(id: number, data: UpdateUser): Promise<User> {
    return request(`/user/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteUser(id: number): Promise<void> {
    return request(`/user/${id}`, { method: 'DELETE' });
  },
  getCurrentUser(): Promise<User> {
    return request('/current/user');
  },

  // Applications
  listApplications(): Promise<Application[]> {
    return request('/application');
  },
  createApplication(data: CreateApplication): Promise<Application> {
    return request('/application', { method: 'POST', body: JSON.stringify(data) });
  },
  updateApplication(id: number, data: UpdateApplication): Promise<Application> {
    return request(`/application/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteApplication(id: number): Promise<void> {
    return request(`/application/${id}`, { method: 'DELETE' });
  },
  listApplicationMessages(id: number, limit = 100, since = 0): Promise<PagedMessages> {
    return request(`/application/${id}/messages?limit=${limit}&since=${since}`);
  },
  async uploadApplicationIcon(id: number, file: File): Promise<Application> {
    const form = new FormData();
    form.append('file', file);
    const token = getToken();
    const res = await fetch(`${BASE}/application/${id}/icon`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  },
  getApplicationIconUrl(id: number): string {
    return `${BASE}/application/${id}/icon`;
  },
  deleteApplicationIcon(id: number): Promise<void> {
    return request(`/application/${id}/icon`, { method: 'DELETE' });
  },

  // Clients
  listClients(): Promise<Client[]> {
    return request('/client');
  },
  createClient(data: CreateClient): Promise<Client> {
    return request('/client', { method: 'POST', body: JSON.stringify(data) });
  },
  updateClient(id: number, data: UpdateClient): Promise<Client> {
    return request(`/client/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteClient(id: number): Promise<void> {
    return request(`/client/${id}`, { method: 'DELETE' });
  },

  // Topics
  listTopics(): Promise<Topic[]> {
    return request('/api/topics');
  },
  createTopic(data: CreateTopic): Promise<Topic> {
    return request('/api/topics', { method: 'POST', body: JSON.stringify(data) });
  },
  updateTopic(name: string, data: { description?: string; everyone_read?: boolean; everyone_write?: boolean }): Promise<Topic> {
    return request(`/api/topics/${encodeURIComponent(name)}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteTopic(name: string): Promise<void> {
    return request(`/api/topics/${encodeURIComponent(name)}`, { method: 'DELETE' });
  },
  listTopicMessages(name: string, limit = 100, since = 0): Promise<PagedMessages> {
    return request(`/api/topics/${encodeURIComponent(name)}/messages?limit=${limit}&since=${since}`);
  },
  publishToTopic(name: string, data: { title?: string; message: string; priority?: number; tags?: string[]; scheduled_for?: string }): Promise<MessageResponse> {
    return request(`/api/topics/${encodeURIComponent(name)}/publish`, { method: 'POST', body: JSON.stringify(data) });
  },

  // Messages
  listMessages(limit = 100, since = 0): Promise<PagedMessages> {
    return request(`/message?limit=${limit}&since=${since}`);
  },
  deleteMessage(id: number): Promise<void> {
    return request(`/message/${id}`, { method: 'DELETE' });
  },

  // Webhooks
  listWebhooks(): Promise<WebhookConfig[]> {
    return request('/api/webhooks');
  },
  createWebhook(data: CreateWebhookConfig): Promise<WebhookConfig> {
    return request('/api/webhooks', { method: 'POST', body: JSON.stringify(data) });
  },
  updateWebhook(id: number, data: UpdateWebhookConfig): Promise<WebhookConfig> {
    return request(`/api/webhooks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },
  deleteWebhook(id: number): Promise<void> {
    return request(`/api/webhooks/${id}`, { method: 'DELETE' });
  },
  listWebhookDeliveries(id: number, limit = 20): Promise<WebhookDeliveryLog[]> {
    return request(`/api/webhooks/${id}/deliveries?limit=${limit}`);
  },

  // Permissions
  listPermissions(): Promise<TopicPermission[]> {
    return request('/api/permissions');
  },
  createPermission(data: CreateTopicPermission): Promise<TopicPermission> {
    return request('/api/permissions', { method: 'POST', body: JSON.stringify(data) });
  },
  deletePermission(id: number): Promise<void> {
    return request(`/api/permissions/${id}`, { method: 'DELETE' });
  },

  // Attachments
  async uploadAttachment(messageId: number, file: File): Promise<AttachmentInfo> {
    const form = new FormData();
    form.append('file', file);
    const token = getToken();
    const res = await fetch(`${BASE}/api/messages/${messageId}/attachments`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  },
  listAttachments(messageId: number): Promise<AttachmentInfo[]> {
    return request(`/api/messages/${messageId}/attachments`);
  },
  deleteAttachment(id: number): Promise<void> {
    return request(`/api/attachments/${id}`, { method: 'DELETE' });
  },

  // Message search
  searchMessages(params: { q?: string; tag?: string; priority_min?: number; priority_max?: number; appid?: number; limit?: number }): Promise<MessageResponse[]> {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.tag) qs.set('tag', params.tag);
    if (params.priority_min != null) qs.set('priority_min', String(params.priority_min));
    if (params.priority_max != null) qs.set('priority_max', String(params.priority_max));
    if (params.appid != null) qs.set('appid', String(params.appid));
    if (params.limit != null) qs.set('limit', String(params.limit));
    return request(`/message/search?${qs.toString()}`);
  },

  // Messages - bulk
  deleteAllMessages(): Promise<void> {
    return request('/message', { method: 'DELETE' });
  },

  // Health & version
  getHealth(): Promise<HealthResponse> {
    return request('/health');
  },
  getVersion(): Promise<VersionResponse> {
    return request('/version');
  },

  // Stats
  getStats(): Promise<StatsResponse> {
    return request('/api/stats');
  },
};

import type {
  User, CreateUser, UpdateUser,
  Application, CreateApplication, UpdateApplication,
  Client, CreateClient, UpdateClient,
  Topic, CreateTopic,
  TopicPermission, CreateTopicPermission,
  PagedMessages, MessageResponse,
  WebhookConfig, CreateWebhookConfig, UpdateWebhookConfig,
  StatsResponse, LoginResponse,
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
  deleteTopic(name: string): Promise<void> {
    return request(`/api/topics/${encodeURIComponent(name)}`, { method: 'DELETE' });
  },
  listTopicMessages(name: string, limit = 100, since = 0): Promise<PagedMessages> {
    return request(`/api/topics/${encodeURIComponent(name)}/messages?limit=${limit}&since=${since}`);
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

  // Stats
  getStats(): Promise<StatsResponse> {
    return request('/api/stats');
  },
};

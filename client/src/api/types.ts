// rstify API TypeScript types

export interface UserResponse {
  id: number;
  username: string;
  email: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUser {
  username: string;
  password: string;
  email?: string | null;
  is_admin?: boolean;
}

export interface ChangePassword {
  current_password: string;
  new_password: string;
}

export interface Application {
  id: number;
  user_id: number;
  name: string;
  description: string | null;
  token: string;
  default_priority: number;
  image: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateApplication {
  name: string;
  description?: string | null;
  default_priority?: number;
}

export interface UpdateApplication {
  name?: string;
  description?: string | null;
  default_priority?: number;
}

export interface Client {
  id: number;
  user_id: number;
  name: string;
  token: string;
  created_at: string;
}

export interface CreateClient {
  name: string;
}

export interface Topic {
  id: number;
  name: string;
  owner_id: number | null;
  description: string | null;
  everyone_read: boolean;
  everyone_write: boolean;
  created_at: string;
}

export interface CreateTopic {
  name: string;
  description?: string | null;
  everyone_read?: boolean;
  everyone_write?: boolean;
}

export interface TopicPermission {
  id: number;
  user_id: number;
  topic_pattern: string;
  can_read: boolean;
  can_write: boolean;
}

export interface MessageAction {
  action: "view" | "http" | "broadcast";
  label: string;
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  intent?: string;
  extras?: Record<string, unknown>;
  clear?: boolean;
}

export interface MessageResponse {
  id: number;
  appid: number | null;
  topic: string | null;
  title: string | null;
  message: string;
  priority: number;
  tags: string[] | null;
  click_url: string | null;
  icon_url: string | null;
  actions: MessageAction[] | null;
  extras: Record<string, unknown> | null;
  content_type: string | null;
  date: string;
}

export interface CreateAppMessage {
  title?: string;
  message: string;
  priority?: number;
  extras?: Record<string, unknown>;
}

export interface CreateTopicMessage {
  title?: string;
  message: string;
  priority?: number;
  tags?: string[];
  click_url?: string;
  icon_url?: string;
  actions?: MessageAction[];
  scheduled_for?: string;
}

export interface PagedMessages {
  messages: MessageResponse[];
  paging: {
    size: number;
    since: number;
    limit: number;
  };
}

export interface Attachment {
  id: number;
  message_id: number;
  filename: string;
  content_type: string | null;
  size_bytes: number;
  storage_type: string;
  storage_path: string;
  expires_at: string | null;
  created_at: string;
}

export interface WebhookConfig {
  id: number;
  user_id: number;
  name: string;
  token: string;
  webhook_type: string;
  target_topic_id: number | null;
  target_application_id: number | null;
  template: string;
  enabled: boolean;
  created_at: string;
  // Outgoing webhook fields
  direction: string;
  target_url: string | null;
  http_method: string;
  headers: string | null;
  body_template: string | null;
  max_retries: number;
  retry_delay_secs: number;
}

export interface CreateWebhookConfig {
  name: string;
  webhook_type: string;
  target_topic_id?: number;
  target_application_id?: number;
  template: Record<string, unknown>;
  enabled?: boolean;
  direction?: string;
  target_url?: string;
  http_method?: string;
  headers?: Record<string, string>;
  body_template?: string;
}

export interface UpdateWebhookConfig {
  name?: string;
  template?: Record<string, unknown>;
  enabled?: boolean;
  target_url?: string;
  http_method?: string;
  headers?: Record<string, string>;
  body_template?: string;
}

export interface StatsResponse {
  users: number;
  topics: number;
  messages: number;
  messages_last_24h: number;
}

export interface UpRegistration {
  id: number;
  token: string;
  user_id: number | null;
  endpoint: string;
  created_at: string;
}

export interface CreateUpRegistration {
  endpoint: string;
}

export interface UpdateUser {
  username?: string;
  email?: string;
  is_admin?: boolean;
}

export interface ApiError {
  error: string;
  errorCode: number;
}

export interface HealthResponse {
  health: string;
  database: string;
}

export interface VersionResponse {
  version: string;
  name: string;
  buildDate: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

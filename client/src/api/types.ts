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
  fcm_token: string | null;
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
  notify_policy: string;
  notify_priority_min?: number;
  notify_condition?: string;
  notify_digest_interval?: number;
  store_policy: string;
  store_interval?: number;
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

export interface CreateTopicPermission {
  user_id: number;
  topic_pattern: string;
  can_read?: boolean;
  can_write?: boolean;
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

export interface AttachmentInfo {
  id: number;
  name: string;
  type?: string;
  size: number;
  url: string;
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
  source?: string;
  attachments?: AttachmentInfo[];
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
  timeout_secs: number;
  follow_redirects: boolean;
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
  max_retries?: number;
  retry_delay_secs?: number;
  timeout_secs?: number;
  follow_redirects?: boolean;
}

export interface UpdateWebhookConfig {
  name?: string;
  template?: Record<string, unknown>;
  enabled?: boolean;
  target_url?: string;
  http_method?: string;
  headers?: Record<string, string>;
  body_template?: string;
  max_retries?: number;
  retry_delay_secs?: number;
  timeout_secs?: number;
  follow_redirects?: boolean;
}

export interface WebhookDeliveryLog {
  id: number;
  webhook_config_id: number;
  message_id: number | null;
  status_code: number | null;
  response_body_preview: string | null;
  duration_ms: number;
  attempted_at: string;
  success: boolean;
}

export interface WebhookTestResult {
  success: boolean;
  direction: string;
  status_code?: number;
  response_preview?: string;
  error?: string;
  webhook_url?: string;
  curl_example?: string;
}

export interface StatsResponse {
  users: number;
  topics: number;
  messages: number;
  messages_last_24h: number;
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

export interface MqttBridge {
  id: number;
  user_id: number;
  name: string;
  remote_url: string;
  subscribe_topics: string;
  publish_topics?: string;
  qos?: number;
  topic_prefix?: string;
  auto_create_topics: boolean;
  enabled: boolean;
  created_at: string;
}

export interface CreateMqttBridge {
  name: string;
  remote_url: string;
  subscribe_topics: string[];
  publish_topics?: string[];
  username?: string;
  password?: string;
  qos?: number;
  topic_prefix?: string;
  auto_create_topics?: boolean;
}

export interface UpdateMqttBridge {
  name?: string;
  remote_url?: string;
  subscribe_topics?: string[];
  publish_topics?: string[];
  username?: string;
  password?: string;
  qos?: number;
  topic_prefix?: string;
  auto_create_topics?: boolean;
  enabled?: boolean;
}

export interface MqttStatus {
  enabled: boolean;
  listen_addr?: string;
  ws_listen_addr?: string;
  connections: number;
  bridges_active: number;
}

export interface UpdateTopic {
  description?: string;
  everyone_read?: boolean;
  everyone_write?: boolean;
  notify_policy?: string;
  notify_priority_min?: number;
  notify_condition?: string;
  notify_digest_interval?: number;
  store_policy?: string;
  store_interval?: number;
}

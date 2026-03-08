export interface User {
  id: number;
  username: string;
  email?: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUser {
  username: string;
  password: string;
  email?: string;
  is_admin?: boolean;
}

export interface UpdateUser {
  username?: string;
  email?: string;
  is_admin?: boolean;
}

export interface Application {
  id: number;
  user_id: number;
  name: string;
  description?: string;
  token: string;
  default_priority: number;
  retention_days?: number;
  image?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateApplication {
  name: string;
  description?: string;
  default_priority?: number;
}

export interface UpdateApplication {
  name?: string;
  description?: string;
  default_priority?: number;
  retention_days?: number;
}

export interface Client {
  id: number;
  user_id: number;
  name: string;
  token: string;
  scopes: string;
  created_at: string;
}

export interface CreateClient {
  name: string;
  scopes?: string[];
}

export interface UpdateClient {
  name?: string;
  scopes?: string[];
}

export interface Topic {
  id: number;
  name: string;
  owner_id?: number;
  description?: string;
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
  description?: string;
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

export interface AttachmentInfo {
  id: number;
  name: string;
  type?: string;
  size: number;
  url: string;
}

export interface MessageResponse {
  id: number;
  appid?: number;
  topic?: string;
  title?: string;
  message: string;
  priority: number;
  tags?: string[];
  click_url?: string;
  icon_url?: string;
  content_type?: string;
  extras?: Record<string, any>;
  source?: string;
  attachments?: AttachmentInfo[];
  date: string;
}

export interface PagedMessages {
  messages: MessageResponse[];
  paging: { size: number; since: number; limit: number };
}

export interface WebhookConfig {
  id: number;
  user_id: number;
  name: string;
  token: string;
  webhook_type: string;
  target_topic_id?: number;
  target_application_id?: number;
  template: string;
  enabled: boolean;
  direction: string;
  target_url?: string;
  http_method: string;
  headers?: string;
  body_template?: string;
  max_retries: number;
  retry_delay_secs: number;
  timeout_secs: number;
  follow_redirects: boolean;
  group_name?: string;
  created_at: string;
  // Health data (from list endpoint)
  last_delivery_at?: string;
  last_delivery_success?: boolean;
  recent_success_rate?: number;
  recent_durations?: number[];
}

export interface CreateWebhookConfig {
  name: string;
  webhook_type: string;
  target_topic_id?: number;
  target_application_id?: number;
  template?: string;
  direction?: string;
  target_url?: string;
  http_method?: string;
  headers?: Record<string, string>;
  body_template?: string;
  max_retries?: number;
  retry_delay_secs?: number;
  timeout_secs?: number;
  follow_redirects?: boolean;
  group_name?: string;
}

export interface UpdateWebhookConfig {
  name?: string;
  template?: string;
  enabled?: boolean;
  target_url?: string;
  http_method?: string;
  headers?: Record<string, string>;
  body_template?: string;
  max_retries?: number;
  retry_delay_secs?: number;
  timeout_secs?: number;
  follow_redirects?: boolean;
  group_name?: string;
}

export interface WebhookDeliveryLog {
  id: number;
  webhook_config_id: number;
  message_id?: number;
  status_code?: number;
  response_body_preview?: string;
  duration_ms: number;
  attempted_at: string;
  success: boolean;
}

export interface WebhookTestResult {
  success: boolean;
  direction: string;
  status_code?: number;
  response_preview?: string;
  response_headers?: Record<string, string>;
  duration_ms?: number;
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

export interface LoginResponse {
  token: string;
}

export interface HealthResponse {
  health: string;
  database: string;
  version: string;
}

export interface VersionResponse {
  version: string;
  name: string;
  buildDate: string;
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

export interface WebhookVariable {
  id: number;
  user_id: number;
  key: string;
  value: string;
  created_at: string;
}

export interface CreateWebhookVariable {
  key: string;
  value: string;
}

export interface UpdateWebhookVariable {
  key?: string;
  value?: string;
}

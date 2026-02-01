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

export interface UpdateClient {
  name?: string;
}

export interface Topic {
  id: number;
  name: string;
  owner_id?: number;
  description?: string;
  everyone_read: boolean;
  everyone_write: boolean;
  created_at: string;
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
  created_at: string;
}

export interface CreateWebhookConfig {
  name: string;
  webhook_type: string;
  target_topic_id?: number;
  target_application_id?: number;
  template?: string;
}

export interface UpdateWebhookConfig {
  name?: string;
  template?: string;
  enabled?: boolean;
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

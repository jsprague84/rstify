import type {
  ApiError,
  Application,
  ChangePassword,
  Client,
  CreateApplication,
  CreateClient,
  CreateTopic,
  CreateTopicMessage,
  CreateAppMessage,
  HealthResponse,
  LoginRequest,
  LoginResponse,
  MessageResponse,
  PagedMessages,
  Topic,
  TopicPermission,
  UpdateApplication,
  UserResponse,
  VersionResponse,
  WebhookConfig,
  CreateWebhookConfig,
} from "./types";

export class RstifyApiError extends Error {
  constructor(
    public status: number,
    public body: ApiError,
  ) {
    super(body.error);
    this.name = "RstifyApiError";
  }
}

export class RstifyClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  setToken(token: string | null) {
    this.token = token;
  }

  getToken(): string | null {
    return this.token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const headers: Record<string, string> = {};

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    if (this.token) {
      headers["Authorization"] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      let errorBody: ApiError;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = {
          error: response.statusText,
          errorCode: response.status,
        };
      }
      throw new RstifyApiError(response.status, errorBody);
    }

    // Handle empty responses (204 No Content, etc.)
    const contentLength = response.headers.get("content-length");
    if (response.status === 204 || contentLength === "0") {
      return undefined as T;
    }

    return response.json();
  }

  // Auth
  async login(req: LoginRequest): Promise<LoginResponse> {
    return this.request("POST", "/api/auth/login", req);
  }

  // Health
  async health(): Promise<HealthResponse> {
    return this.request("GET", "/health");
  }

  async version(): Promise<VersionResponse> {
    return this.request("GET", "/version");
  }

  // User
  async currentUser(): Promise<UserResponse> {
    return this.request("GET", "/current/user");
  }

  async changePassword(req: ChangePassword): Promise<void> {
    await this.request("POST", "/current/user/password", req);
  }

  async listUsers(): Promise<UserResponse[]> {
    return this.request("GET", "/user");
  }

  // Applications
  async listApplications(): Promise<Application[]> {
    return this.request("GET", "/application");
  }

  async createApplication(req: CreateApplication): Promise<Application> {
    return this.request("POST", "/application", req);
  }

  async updateApplication(
    id: number,
    req: UpdateApplication,
  ): Promise<Application> {
    return this.request("PUT", `/application/${id}`, req);
  }

  async deleteApplication(id: number): Promise<void> {
    await this.request("DELETE", `/application/${id}`);
  }

  // Clients
  async listClients(): Promise<Client[]> {
    return this.request("GET", "/client");
  }

  async createClient(req: CreateClient): Promise<Client> {
    return this.request("POST", "/client", req);
  }

  async deleteClient(id: number): Promise<void> {
    await this.request("DELETE", `/client/${id}`);
  }

  // Messages
  async listMessages(
    limit = 100,
    since = 0,
  ): Promise<PagedMessages> {
    return this.request(
      "GET",
      `/message?limit=${limit}&since=${since}`,
    );
  }

  async sendAppMessage(
    appToken: string,
    req: CreateAppMessage,
  ): Promise<MessageResponse> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${appToken}`,
    };

    const response = await fetch(`${this.baseUrl}/message`, {
      method: "POST",
      headers,
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      let errorBody: ApiError;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = {
          error: response.statusText,
          errorCode: response.status,
        };
      }
      throw new RstifyApiError(response.status, errorBody);
    }

    return response.json();
  }

  async deleteMessage(id: number): Promise<void> {
    await this.request("DELETE", `/message/${id}`);
  }

  async deleteAllMessages(): Promise<void> {
    await this.request("DELETE", "/message");
  }

  // Topics
  async listTopics(): Promise<Topic[]> {
    return this.request("GET", "/api/topics");
  }

  async getTopic(name: string): Promise<Topic> {
    return this.request("GET", `/api/topics/${encodeURIComponent(name)}`);
  }

  async createTopic(req: CreateTopic): Promise<Topic> {
    return this.request("POST", "/api/topics", req);
  }

  async deleteTopic(name: string): Promise<void> {
    await this.request(
      "DELETE",
      `/api/topics/${encodeURIComponent(name)}`,
    );
  }

  async publishToTopic(
    name: string,
    req: CreateTopicMessage,
  ): Promise<MessageResponse> {
    return this.request(
      "POST",
      `/api/topics/${encodeURIComponent(name)}/publish`,
      req,
    );
  }

  async getTopicMessages(
    name: string,
    limit = 100,
    since = 0,
  ): Promise<MessageResponse[]> {
    return this.request(
      "GET",
      `/api/topics/${encodeURIComponent(name)}/json?limit=${limit}&since=${since}`,
    );
  }

  // Permissions
  async listPermissions(): Promise<TopicPermission[]> {
    return this.request("GET", "/api/permissions");
  }

  // Attachments
  downloadAttachmentUrl(id: number): string {
    return `${this.baseUrl}/api/attachments/${id}`;
  }

  // Webhooks
  async listWebhooks(): Promise<WebhookConfig[]> {
    return this.request("GET", "/api/webhooks");
  }

  async createWebhook(req: CreateWebhookConfig): Promise<WebhookConfig> {
    return this.request("POST", "/api/webhooks", req);
  }

  async deleteWebhook(id: number): Promise<void> {
    await this.request("DELETE", `/api/webhooks/${id}`);
  }

  // WebSocket connection for user stream (Gotify compat)
  connectUserStream(
    clientToken: string,
    onMessage: (msg: MessageResponse) => void,
    onError?: (error: Event) => void,
    onClose?: () => void,
  ): WebSocket {
    const wsUrl = this.baseUrl
      .replace(/^http/, "ws")
      .concat(`/stream?token=${encodeURIComponent(clientToken)}`);

    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg: MessageResponse = JSON.parse(event.data);
        onMessage(msg);
      } catch {
        // ignore parse errors
      }
    };

    if (onError) ws.onerror = onError;
    if (onClose) ws.onclose = onClose;

    return ws;
  }

  // WebSocket connection for topic stream
  connectTopicStream(
    topicName: string,
    onMessage: (msg: MessageResponse) => void,
    onError?: (error: Event) => void,
    onClose?: () => void,
  ): WebSocket {
    const wsUrl = this.baseUrl
      .replace(/^http/, "ws")
      .concat(
        `/api/topics/${encodeURIComponent(topicName)}/ws?token=${encodeURIComponent(this.token ?? "")}`,
      );

    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const msg: MessageResponse = JSON.parse(event.data);
        onMessage(msg);
      } catch {
        // ignore parse errors
      }
    };

    if (onError) ws.onerror = onError;
    if (onClose) ws.onclose = onClose;

    return ws;
  }
}

// Singleton instance
let instance: RstifyClient | null = null;

export function getApiClient(): RstifyClient {
  if (!instance) {
    // Default; will be reconfigured via settings
    instance = new RstifyClient("http://localhost:8080");
  }
  return instance;
}

export function initApiClient(baseUrl: string): RstifyClient {
  instance = new RstifyClient(baseUrl);
  return instance;
}

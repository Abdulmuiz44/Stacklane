// ─── Existing Stacklane client (backward compatible) ───

export interface StacklaneClientOptions {
  baseUrl: string;
  accessToken?: string;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function createStacklaneClient(options: StacklaneClientOptions) {
  const { baseUrl, accessToken } = options;

  async function request<T>(path: string, method = 'GET', body?: unknown): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    try {
      const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.error?.message || `HTTP ${res.status}` };
      }
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : 'Network error' };
    }
  }

  return {
    async health() {
      return request<{ ok: boolean; service: string; version?: string }>('/api/v1/health');
    },

    async configStatus() {
      return request<{ ok: boolean; config: unknown }>('/api/v1/config/status');
    },

    async createCustomer(data: { name: string; email?: string; externalRef?: string; status?: 'active' | 'suspended' | 'deleted' }) {
        return request<{ ok: boolean; customer: any }>('/api/v1/customers', 'POST', data)
    },

    async listCustomers() {
        return request<{ ok: boolean; customers: any[] }>('/api/v1/customers')
    },

    async getCustomer(customerId: string) {
        return request<{ ok: boolean; customer: any }>(`/api/v1/customers/${customerId}`)
    },

    async updateCustomer(customerId: string, data: Record<string, unknown>) {
        return request<{ ok: boolean; customer: any }>(`/api/v1/customers/${customerId}`, 'PATCH', data)
    },

    async createApiKey(data: { customerId: string; name: string; scopes?: string[]; mode?: 'dev' | 'live' }) {
        return request<{ ok: boolean; apiKey: any; warning: string }>('/api/v1/api-keys', 'POST', data)
    },

    async listApiKeys(customerId?: string) {
      const suffix = customerId ? `?customerId=${encodeURIComponent(customerId)}` : ''
      return request<{ ok: boolean; apiKeys: any[] }>(`/api/v1/api-keys${suffix}`)
    },

    async revokeApiKey(apiKeyId: string) {
      return request<{ ok: boolean; apiKey: any }>(`/api/v1/api-keys/${apiKeyId}/revoke`, 'POST')
    },

    async recordUsageEvent(data: { product: string; action: string; units: number; metadata?: Record<string, unknown> }) {
      return request<{ ok: boolean; event: any }>('/api/v1/usage/events', 'POST', data)
    },

    async listUsageEvents(query?: Record<string, string>) {
      const suffix = query ? `?${new URLSearchParams(query).toString()}` : ''
      return request<{ ok: boolean; events: any[] }>(`/api/v1/usage/events${suffix}`)
    },

    async summarizeUsage(query?: Record<string, string>) {
      const suffix = query ? `?${new URLSearchParams(query).toString()}` : ''
      return request<{ ok: boolean; summary: any; byCustomer: any; byProduct: any; byAction: any }>(`/api/v1/usage/summary${suffix}`)
    },

    async createAsset(data: { product: string; filename: string; contentType: string; bytesBase64?: string; publicUrl?: string; metadata?: Record<string, unknown> }) {
      return request<{ ok: boolean; asset: any }>('/api/v1/assets', 'POST', data)
    },

    async listAssets(query?: Record<string, string>) {
      const suffix = query ? `?${new URLSearchParams(query).toString()}` : ''
      return request<{ ok: boolean; assets: any[] }>(`/api/v1/assets${suffix}`)
    },

    async getAsset(assetId: string) {
      return request<{ ok: boolean; asset: any }>(`/api/v1/assets/${assetId}`)
    },

    async deleteAsset(assetId: string) {
      return request<{ ok: boolean; asset: any }>(`/api/v1/assets/${assetId}`, 'DELETE')
    },

    projects: {
      async create(data: { name: string; organizationId: string }) {
        return request<{ project: any }>('/v1/projects', 'POST', data);
      },
      async list() {
        return request<{ projects: any[] }>('/v1/projects');
      },
      async get(projectId: string) {
        return request<{ project: any }>(`/v1/projects/${projectId}`);
      },
    },

    database: {
      async set(projectId: string, data: { databaseUrl: string; password: string; provider?: string }) {
        return request<{ database: any }>(`/v1/projects/${projectId}/database`, 'POST', data);
      },
      async get(projectId: string) {
        return request<{ database: any }>(`/v1/projects/${projectId}/database`);
      },
    },

    tokens: {
      async create(projectId: string, data: { name: string; scopes?: string[] }) {
        return request<{ token: any; rawToken: string }>(`/v1/projects/${projectId}/tokens`, 'POST', data);
      },
      async verify(token: string) {
        return request<{ valid: boolean; projectId: string; scopes: string[] }>('/v1/tokens/verify', 'POST', { token });
      },
      async revoke(projectId: string, tokenId: string) {
        return request<{ message: string }>(`/v1/projects/${projectId}/tokens/${tokenId}/revoke`, 'POST');
      },
    },

    audit: {
      async list(projectId: string, limit = 50) {
        return request<{ events: any[] }>(`/v1/projects/${projectId}/audit?limit=${limit}`);
      },
    },
  };
}

export type StacklaneClient = ReturnType<typeof createStacklaneClient>;

// ─── Talocode Cloud SDK ───

export { Talocode } from './talocode'
export type { TalocodeOptions } from './talocode'
export { TeraClient } from './tera'
export { AgentBrowserClient } from './agent-browser'
export { ClipLoopClient } from './cliploop'
export { CodraClient } from './codra'
export { InvoiceLaneClient } from './invoicelane.js'
export { GeoLaneClient } from './geolane.js'
export { SearchLaneClient } from './searchlane.js'
export { CalcLaneClient } from './calclane.js'
export { WebDataLaneClient } from './webdatalane.js'
export { SkillsClient } from './skills'
export { SignalLaneClient } from './signallane.js'
export { UGCLaneClient } from './ugclane.js'
export { CrawlerLaneClient } from './crawlerlane.js'
export { OpenSourceLaneClient } from './opensourcelane.js'
export { ForgeCADClient } from './forgecad.js'
export { ReplyLaneClient } from './replylane.js'
export { TradiaClient } from './tradia'
export {
  CodraClientPlaceholder,
  WorkLaneClientPlaceholder,
} from './placeholders'
export {
  TalocodeError,
  TalocodeAuthError,
  TalocodeInsufficientCreditsError,
  TalocodeRateLimitError,
  TalocodeValidationError,
  TalocodeNotImplementedError,
} from './errors'
export * from './types'

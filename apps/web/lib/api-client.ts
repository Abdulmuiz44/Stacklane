import type {
  ApiKey,
  AuditEvent,
  CloudPricingTier,
  CloudTopupIntent,
  CloudTransaction,
  CloudUsageEvent,
  CloudWallet,
  Environment,
  Organization,
  Project,
  ProjectRuntimeBinding,
  ProvisioningAttempt,
  ProvisioningTask,
  Region,
  OrganizationOperationsRow,
  Capabilities,
  ResourceStatus,
  User
} from './api-types'

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (process.env.NODE_ENV === 'production' ? 'https://api.talocode.site' : 'http://localhost:4000')

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(options?.headers || {})
    },
    cache: 'no-store'
  })

  const payload = await response.json()

  if (!response.ok) {
    const message = payload?.error?.message || 'Unexpected API error'
    throw new Error(message)
  }

  return payload.data as T
}

export const apiClient = {
  login: (input: { email: string; password: string }) =>
    request<User>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
  me: () => request<User>('/auth/me'),
  listRegions: () => request<Region[]>('/regions'),
  listOrganizations: () => request<Organization[]>('/organizations'),
  createOrganization: (input: { name: string; slug?: string }) =>
    request<Organization>('/organizations', { method: 'POST', body: JSON.stringify(input) }),
  listProjects: () => request<Project[]>('/projects'),
  listOrganizationProjects: (idOrSlug: string) => request<Project[]>(`/organizations/${idOrSlug}/projects`),
  listOrganizationOperations: (idOrSlug: string) => request<OrganizationOperationsRow[]>(`/organizations/${idOrSlug}/operations`),
  getProject: (idOrSlug: string) => request<Project>(`/projects/${idOrSlug}`),
  createProject: (input: {
    name: string
    organizationId: string
    status: ResourceStatus
    region: string
    description: string
    slug?: string
  }) => request<Project>('/projects', { method: 'POST', body: JSON.stringify(input) }),
  updateProject: (
    idOrSlug: string,
    input: { name?: string; status?: ResourceStatus; description?: string }
  ) => request<Project>(`/projects/${idOrSlug}`, { method: 'PATCH', body: JSON.stringify(input) }),
  triggerProvisioning: (idOrSlug: string, input?: { regionCode?: string }) =>
    request<ProvisioningTask>(`/projects/${idOrSlug}/provision`, { method: 'POST', body: JSON.stringify(input || {}) }),
  getProvisioning: (idOrSlug: string) =>
    request<{ task: ProvisioningTask | null; attempts: ProvisioningAttempt[]; runtimeBinding: ProjectRuntimeBinding | null; capabilities: Capabilities }>(
      `/projects/${idOrSlug}/provisioning`
    ),
  listProvisioningTasks: (idOrSlug: string) => request<ProvisioningTask[]>(`/projects/${idOrSlug}/provisioning/tasks`),
  retryProvisioning: (idOrSlug: string) => request<ProvisioningTask>(`/projects/${idOrSlug}/provisioning/retry`, { method: 'POST' }),
  listProjectEvents: (idOrSlug: string) => request<AuditEvent[]>(`/projects/${idOrSlug}/events`),
  listProjectApiKeys: (idOrSlug: string) => request<ApiKey[]>(`/projects/${idOrSlug}/api-keys`),
  createProjectApiKey: (idOrSlug: string, input: { name: string }) =>
    request<{ key: ApiKey; secret: string }>(`/projects/${idOrSlug}/api-keys`, {
      method: 'POST',
      body: JSON.stringify(input)
    }),
  revokeProjectApiKey: (idOrSlug: string, keyId: string) =>
    request<ApiKey>(`/projects/${idOrSlug}/api-keys/${keyId}/revoke`, { method: 'POST' }),
  listEnvironments: (idOrSlug: string) => request<Environment[]>(`/projects/${idOrSlug}/environments`),
  createEnvironment: (
    idOrSlug: string,
    input: { name: string; slug?: string; status?: string; region?: string; deploymentTarget?: string }
  ) => request<Environment>(`/projects/${idOrSlug}/environments`, { method: 'POST', body: JSON.stringify(input) }),
  updateEnvironment: (
    idOrSlug: string,
    environmentId: string,
    input: { status?: string; region?: string; deploymentTarget?: string }
  ) =>
    request<Environment>(`/projects/${idOrSlug}/environments/${environmentId}`, {
      method: 'PATCH',
      body: JSON.stringify(input)
    }),

  // ─── Cloud Billing ──────────────────────────────────────────────

  getCloudWallet: (projectId: string) =>
    request<CloudWallet>(`/api/v1/cloud/billing/wallet?projectId=${projectId}`),

  listCloudTransactions: (projectId: string, limit = 50) =>
    request<CloudTransaction[]>(`/api/v1/cloud/billing/transactions?projectId=${projectId}&limit=${limit}`),

  listCloudUsageEvents: (projectId: string, limit = 50) =>
    request<CloudUsageEvent[]>(`/api/v1/cloud/usage/events?projectId=${projectId}&limit=${limit}`),

  listCloudPricing: () =>
    request<CloudPricingTier[]>('/api/v1/cloud/pricing'),

  createCloudTopup: (projectId: string, amount: number) =>
    request<CloudTopupIntent>('/api/v1/cloud/billing/topup', {
      method: 'POST',
      body: JSON.stringify({ projectId, amount })
    }),

}

export function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat('en-NG', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value))
}

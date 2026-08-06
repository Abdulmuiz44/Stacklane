import { TalocodeApiClient } from './talocode.js'

export interface ReliabilityLaneMatchInput {
  symptom?: string
  error?: string
  category?: string
}

export interface ReliabilityLaneRetryPlanInput {
  status?: number
  code?: string
  message?: string
  kind?: string
}

export interface ReliabilityLaneVerifyInput {
  checklist?: string
  area?: string
  evidence?: Record<string, unknown>
}

export interface ReliabilityLaneIncidentInput {
  symptom?: string
  error?: string
}

export class ReliabilityLaneClient {
  private api: TalocodeApiClient

  constructor(api: TalocodeApiClient) {
    this.api = api
  }

  async health(): Promise<{ ok: boolean; service: string; version: string; endpoints?: string[] }> {
    return this.api.request('/v1/reliabilitylane/health') as Promise<{
      ok: boolean
      service: string
      version: string
      endpoints?: string[]
    }>
  }

  async pricing(): Promise<Record<string, unknown>> {
    return this.api.request('/v1/reliabilitylane/pricing') as Promise<Record<string, unknown>>
  }

  async capabilities(): Promise<Record<string, unknown>> {
    return this.api.request('/v1/reliabilitylane/capabilities') as Promise<Record<string, unknown>>
  }

  async patterns(): Promise<Record<string, unknown>> {
    return this.api.request('/v1/reliabilitylane/patterns') as Promise<Record<string, unknown>>
  }

  async retries(): Promise<Record<string, unknown>> {
    return this.api.request('/v1/reliabilitylane/retries') as Promise<Record<string, unknown>>
  }

  async checklists(): Promise<Record<string, unknown>> {
    return this.api.request('/v1/reliabilitylane/checklists') as Promise<Record<string, unknown>>
  }

  async playbooks(): Promise<Record<string, unknown>> {
    return this.api.request('/v1/reliabilitylane/playbooks') as Promise<Record<string, unknown>>
  }

  async antipatterns(): Promise<Record<string, unknown>> {
    return this.api.request('/v1/reliabilitylane/antipatterns') as Promise<Record<string, unknown>>
  }

  async match(input: ReliabilityLaneMatchInput): Promise<Record<string, unknown>> {
    return this.api.request('/v1/reliabilitylane/match', {
      method: 'POST',
      body: input as unknown as Record<string, unknown>,
    }) as Promise<Record<string, unknown>>
  }

  async retryPlan(input: ReliabilityLaneRetryPlanInput): Promise<Record<string, unknown>> {
    return this.api.request('/v1/reliabilitylane/retry-plan', {
      method: 'POST',
      body: input as unknown as Record<string, unknown>,
    }) as Promise<Record<string, unknown>>
  }

  async verify(input: ReliabilityLaneVerifyInput): Promise<Record<string, unknown>> {
    return this.api.request('/v1/reliabilitylane/verify', {
      method: 'POST',
      body: input as unknown as Record<string, unknown>,
    }) as Promise<Record<string, unknown>>
  }

  async incident(input: ReliabilityLaneIncidentInput): Promise<Record<string, unknown>> {
    return this.api.request('/v1/reliabilitylane/incident', {
      method: 'POST',
      body: input as unknown as Record<string, unknown>,
    }) as Promise<Record<string, unknown>>
  }
}

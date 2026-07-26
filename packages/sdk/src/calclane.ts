import { TalocodeApiClient } from './talocode.js'

export interface CalcLaneEvaluateInput {
  expression: string
  mode?: 'standard' | 'scientific'
  angle?: 'deg' | 'rad' | 'grad'
  fe?: boolean
}

export interface CalcLaneDispatchInput {
  commands: Array<Record<string, unknown>>
  mode?: 'standard' | 'scientific'
  angle?: 'deg' | 'rad' | 'grad'
}

export class CalcLaneClient {
  private api: TalocodeApiClient

  constructor(api: TalocodeApiClient) {
    this.api = api
  }

  async health(): Promise<{ ok: boolean; service: string; version: string; endpoints?: string[] }> {
    return this.api.request('/v1/calclane/health') as Promise<{
      ok: boolean
      service: string
      version: string
      endpoints?: string[]
    }>
  }

  async pricing(): Promise<Record<string, unknown>> {
    return this.api.request('/v1/calclane/pricing') as Promise<Record<string, unknown>>
  }

  async capabilities(): Promise<Record<string, unknown>> {
    return this.api.request('/v1/calclane/capabilities') as Promise<Record<string, unknown>>
  }

  async evaluate(input: CalcLaneEvaluateInput): Promise<Record<string, unknown>> {
    return this.api.request('/v1/calclane/evaluate', {
      method: 'POST',
      body: input as unknown as Record<string, unknown>,
    }) as Promise<Record<string, unknown>>
  }

  async dispatch(input: CalcLaneDispatchInput): Promise<Record<string, unknown>> {
    return this.api.request('/v1/calclane/dispatch', {
      method: 'POST',
      body: input as unknown as Record<string, unknown>,
    }) as Promise<Record<string, unknown>>
  }
}

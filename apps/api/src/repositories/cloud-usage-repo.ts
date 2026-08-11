import { db } from '../db'
import type { CloudUsageEventRecord, CloudTopupRecord } from '@stacklane/types'

export async function createCloudUsageEvent(input: {
  id: string
  projectId: string
  apiKeyId?: string
  product: string
  action: string
  credits: number
  status: CloudUsageEventRecord['status']
  requestId?: string
  idempotencyKey?: string
  metadata?: Record<string, unknown>
}) {
  const result = await db.query<CloudUsageEventRecord>(
    `INSERT INTO cloud_usage_events (id, project_id, api_key_id, product, action, credits, status, request_id, idempotency_key, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING id, project_id, api_key_id, product, action, credits, status, request_id, idempotency_key, metadata, created_at`,
    [
      input.id,
      input.projectId,
      input.apiKeyId || null,
      input.product,
      input.action,
      input.credits,
      input.status,
      input.requestId || null,
      input.idempotencyKey || null,
      input.metadata ? JSON.stringify(input.metadata) : '{}'
    ]
  )
  return result.rows[0]
}

export async function findUsageEventByIdempotencyKey(key: string) {
  const result = await db.query<CloudUsageEventRecord>(
    `SELECT id, project_id, api_key_id, product, action, credits, status, request_id, idempotency_key, metadata, created_at
     FROM cloud_usage_events
     WHERE idempotency_key = $1
     LIMIT 1`,
    [key]
  )
  return result.rows[0] || null
}

export async function listCloudUsageEvents(projectId: string, filters?: {
  product?: string
  action?: string
  from?: string
  to?: string
  limit?: number
}) {
  const conditions: string[] = ['project_id = $1']
  const params: unknown[] = [projectId]
  let paramIndex = 2

  if (filters?.product) {
    conditions.push(`product = $${paramIndex++}`)
    params.push(filters.product)
  }
  if (filters?.action) {
    conditions.push(`action = $${paramIndex++}`)
    params.push(filters.action)
  }
  if (filters?.from) {
    conditions.push(`created_at >= $${paramIndex++}`)
    params.push(filters.from)
  }
  if (filters?.to) {
    conditions.push(`created_at <= $${paramIndex++}`)
    params.push(filters.to)
  }

  const limit = filters?.limit || 50
  params.push(limit)

  const result = await db.query<CloudUsageEventRecord>(
    `SELECT id, project_id, api_key_id, product, action, credits, status, request_id, idempotency_key, metadata, created_at
     FROM cloud_usage_events
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${paramIndex}`,
    params
  )
  return result.rows
}

export async function getCloudUsageSummary(projectId: string, from?: string, to?: string) {
  const conditions: string[] = ['project_id = $1']
  const params: unknown[] = [projectId]
  let paramIndex = 2

  if (from) {
    conditions.push(`created_at >= $${paramIndex++}`)
    params.push(from)
  }
  if (to) {
    conditions.push(`created_at <= $${paramIndex++}`)
    params.push(to)
  }

  const result = await db.query(
    `SELECT
       COALESCE(SUM(credits) FILTER (WHERE status = 'success'), 0) AS total_credits_used,
       COUNT(*) FILTER (WHERE status = 'success') AS total_requests,
       COUNT(*) FILTER (WHERE status = 'rejected') AS total_rejected
     FROM cloud_usage_events
     WHERE ${conditions.join(' AND ')}`,
    params
  )
  return result.rows[0] || { total_credits_used: 0, total_requests: 0, total_rejected: 0 }
}

export async function createCloudTopup(input: {
  id: string
  projectId: string
  provider: string
  amountUsd: number
  credits: number
  status: CloudTopupRecord['status']
  providerReference?: string
}) {
  const result = await db.query<CloudTopupRecord>(
    `INSERT INTO cloud_topups (id, project_id, provider, provider_reference, amount_usd, credits, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, project_id, provider, provider_reference, amount_usd, credits, status, created_at, updated_at`,
    [
      input.id,
      input.projectId,
      input.provider,
      input.providerReference || null,
      input.amountUsd,
      input.credits,
      input.status
    ]
  )
  return result.rows[0]
}

export async function listCloudTopups(projectId: string, limit = 20) {
  const result = await db.query<CloudTopupRecord>(
    `SELECT id, project_id, provider, provider_reference, amount_usd, credits, status, created_at, updated_at
     FROM cloud_topups
     WHERE project_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [projectId, limit]
  )
  return result.rows
}

export async function findTopupByProviderReference(providerRef: string) {
  const result = await db.query<CloudTopupRecord>(
    `SELECT id, project_id, provider, provider_reference, amount_usd, credits, status, created_at, updated_at
     FROM cloud_topups
     WHERE provider_reference = $1
     LIMIT 1`,
    [providerRef]
  )
  return result.rows[0] || null
}

export async function findTopupById(id: string) {
  const result = await db.query<CloudTopupRecord>(
    `SELECT id, project_id, provider, provider_reference, amount_usd, credits, status, created_at, updated_at
     FROM cloud_topups
     WHERE id = $1
     LIMIT 1`,
    [id],
  )
  return result.rows[0] || null
}

export async function markTopupSucceeded(id: string, providerReference?: string) {
  const result = await db.query<CloudTopupRecord>(
    `UPDATE cloud_topups
     SET status = 'succeeded',
         provider_reference = COALESCE($2, provider_reference),
         updated_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING id, project_id, provider, provider_reference, amount_usd, credits, status, created_at, updated_at`,
    [id, providerReference || null],
  )
  return result.rows[0] || null
}

export async function markTopupFailed(id: string) {
  const result = await db.query<CloudTopupRecord>(
    `UPDATE cloud_topups
     SET status = 'failed', updated_at = now()
     WHERE id = $1 AND status = 'pending'
     RETURNING id, project_id, provider, provider_reference, amount_usd, credits, status, created_at, updated_at`,
    [id]
  )
  return result.rows[0] || null
}

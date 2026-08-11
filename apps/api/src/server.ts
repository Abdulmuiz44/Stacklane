import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { randomUUID } from 'node:crypto'
import { config } from './config'
import { db } from './db'
import {
  authenticateApiKey,
  createApiKey as createLocalApiKey,
  createAssetRecord,
  createCustomer as createLocalCustomer,
  deleteAssetRecord,
  getAsset,
  getConfigStatus,
  getCustomer,
  listApiKeys as listLocalApiKeys,
  listAssets,
  listCustomers as listLocalCustomers,
  listUsageEvents,
  recordUsageEvent as recordLocalUsageEvent,
  revokeApiKey as revokeLocalApiKey,
  summarizeUsage,
  summarizeUsageByAction,
  summarizeUsageByCustomer,
  summarizeUsageByProduct,
  updateCustomer as updateLocalCustomer
} from './local-store'
import {
  HttpError,
  attachCors,
  clearSessionCookie,
  parseBody,
  parseCookies,
  sendData,
  sendError,
  sendJson,
  setSessionCookie
} from './http'
import { ensureBootstrapData } from './bootstrap/seed'
import { createApiSecret, createSessionToken, hashPassword, hashValue, makeId, safeSlug, verifyPassword } from './utils'
import {
  addOrganizationMember,
  createOrganization,
  findOrganizationByIdOrSlugForUser,
  findUserRoleForOrganization,
  listOrganizationsByUser
} from './repositories/organization-repo'
import {
  createProject,
  createProjectEnvironment,
  findProjectByIdOrSlugForUser,
  findUserRoleForProject,
  listProjectEnvironments,
  listProjectsByOrganizationForUser,
  listProjectsByUser,
  updateEnvironment,
  updateProject
} from './repositories/project-repo'
import { listOrganizationEvents, listProjectEvents, recordAuditEvent } from './repositories/audit-repo'
import {
  createApiKeySchema,
  createEnvironmentSchema,
  createOrganizationSchema,
  createProjectSchema,
  loginSchema,
  registerSchema,
  provisionProjectSchema,
  updateEnvironmentSchema,
  updateProjectSchema
} from './validation'
import {
  toApiKeyResponse,
  toAuditResponse,
  toEnvironmentResponse,
  toOrganizationResponse,
  toProjectResponse,
  toProvisioningAttemptResponse,
  toProvisioningTaskResponse,
  toRegionResponse,
  toRuntimeBindingResponse,
  toUserResponse
} from './services/formatters'
import { createUser, findUserByEmail, findUserById, touchUserLogin } from './repositories/user-repo'
import { createSession, findSessionByHash, revokeSessionByHash, touchSession } from './repositories/session-repo'
import { createApiKey, findProjectApiKey, listProjectApiKeys, revokeApiKey } from './repositories/api-key-repo'
import { findRegionById, listRegions } from './repositories/region-repo'
import {
  findLatestProvisioningTask,
  findRuntimeBindingByProject,
  listProvisioningTasks
} from './repositories/provisioning-repo'
import {
  getProjectProvisioningSnapshot,
  requestProjectProvisioning,
  retryLatestProvisioning,
  runProvisioningWorkerTick
} from './services/provisioning/orchestrator'
import { MockProvisioningAdapter } from './services/provisioning/mock-adapter'
import { projectCapabilities, requirePermission, type PolicyAction } from './policy'
import {
  createCloudProject,
  listCloudProjectsByOwner,
  findCloudProjectById,
  findCloudProjectBySlug
} from './repositories/cloud-project-repo'
import {
  listCloudApiKeys,
  createCloudApiKey,
  revokeCloudApiKey,
  findCloudApiKeyById,
  findCloudApiKeyByHash
} from './repositories/cloud-api-key-repo'
import {
  findWalletByProjectId,
  createWallet,
  listWalletTransactions
} from './repositories/cloud-wallet-repo'
import {
  listCloudUsageEvents,
  getCloudUsageSummary,
  listCloudTopups,
  createCloudTopup,
  findTopupById
} from './repositories/cloud-usage-repo'
import {
  toCloudProjectResponse,
  toCloudApiKeyResponse,
  toCloudWalletResponse,
  toCloudWalletTransactionResponse,
  toCloudUsageEventResponse,
  toCloudTopupResponse
} from './services/cloud-formatters'
import {
  authenticateTalocodeApiKey,
  chargeCredits,
  grantFreeCredits,
  checkBalance,
  getWalletWithTransactions,
  createTopupIntent,
  confirmTopup,
  confirmStripeTopup,
  confirmLemonSqueezyTopup,
  parseLemonSqueezyWebhook,
  TALOCODE_CLOUD_PRICING,
  listAllPricing,
  ensureWallet,
} from './services/cloud-billing'
import {
  constructStripeWebhookEvent
} from './services/payments/stripe-provider'
const SESSION_TTL_DAYS = 7
const WORKER_INTERVAL_MS = Number(process.env.PROVISIONING_WORKER_INTERVAL_MS || 3000)
const adapter = new MockProvisioningAdapter()
const workerId = `worker-${randomUUID().slice(0, 8)}`

process.on('uncaughtException', (error) => {
  console.error('[FATAL] Uncaught exception:', error)
  process.exitCode = 1
})

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason)
})

export { handler }

const DB_TIMEOUT_MS = 15000

async function queryWithTimeout(text: string, timeoutMs: number = DB_TIMEOUT_MS): Promise<any> {
  return Promise.race([
    db.query(text),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Database query timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ])
}

function requireLocalApiKey(req: IncomingMessage) {
  const authHeader = req.headers.authorization
  const bearer = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  const headerKey = typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'] : undefined
  const rawKey = bearer || headerKey
  if (!rawKey) throw new HttpError(401, 'MISSING_API_KEY', 'Missing API key.')
  const apiKey = authenticateApiKey(rawKey)
  if (!apiKey || apiKey.status !== 'active') {
    throw new HttpError(401, 'INVALID_API_KEY', 'Invalid or revoked API key.')
  }
  return apiKey
}

async function getAuthUser(req: IncomingMessage) {
  const cookies = parseCookies(req)
  const token = cookies.sl_session
  if (!token) return null

  const session = await findSessionByHash(hashValue(token))
  if (!session) return null

  await touchSession(session.id)
  const user = await findUserById(session.user_id)
  if (!user) return null
  return user
}

async function requireUser(req: IncomingMessage) {
  const user = await getAuthUser(req)
  if (!user) throw new HttpError(401, 'UNAUTHORIZED', 'Authentication required.')
  return user
}

async function enforceProjectPermission(projectId: string, userId: string, action: PolicyAction) {
  const role = await findUserRoleForProject(projectId, userId)
  requirePermission(role, action)
  return role
}

async function enforceOrganizationPermission(organizationId: string, userId: string, action: PolicyAction) {
  const role = await findUserRoleForOrganization(organizationId, userId)
  requirePermission(role, action)
  return role
}

async function requireCloudProjectOwner(projectId: string, userId: string) {
  const project = await findCloudProjectById(projectId)
  if (!project) throw new HttpError(404, 'NOT_FOUND', 'Cloud project not found.')
  if (project.owner_id !== userId) {
    throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this Cloud project.')
  }
  return project
}

async function handler(req: IncomingMessage, res: ServerResponse) {
  if (!req.url || !req.method) throw new HttpError(400, 'BAD_REQUEST', 'Malformed request metadata.')

  attachCors(res, req)

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const path = url.pathname

  if (req.method === 'OPTIONS') {
    sendJson(res, 204, {})
    return
  }

  if (req.method === 'GET' && path === '/health') {
    sendJson(res, 200, { ok: true, service: 'stacklane-api', now: new Date().toISOString(), adapter: adapter.name, workerId })
    return
  }

  if (req.method === 'GET' && path === '/api/v1/health') {
    sendJson(res, 200, { ok: true, service: 'stacklane-api', version: '0.4.0', mode: 'local-first', timestamp: new Date().toISOString() })
    return
  }

  if (req.method === 'GET' && (path === '/api/v1/cloud/health' || path === '/cloud/health')) {
    let dbOk = false
    try {
      await queryWithTimeout('SELECT 1', 5000)
      dbOk = true
    } catch {}
    sendJson(res, 200, {
      ok: true,
      service: 'talocode-cloud-api',
      version: '0.4.0',
      timestamp: new Date().toISOString(),
      database: dbOk ? 'connected' : 'disconnected',
      uptime: process.uptime(),
    })
    return
  }

  if (req.method === 'GET' && path === '/api/v1/config/status') {
    sendJson(res, 200, { ok: true, config: getConfigStatus() })
    return
  }

  // ─── Public / API-key-authenticated cloud routes (before session check) ───

  if (req.method === 'GET' && path === '/api/v1/cloud/pricing') {
    sendData(res, 200, listAllPricing())
    return
  }

  if (req.method === 'POST' && path === '/api/v1/cloud/usage/charge') {
    let rawKey: string
    const authHeader = req.headers['authorization'] || ''
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7)
    } else if (typeof req.headers['x-api-key'] === 'string') {
      rawKey = req.headers['x-api-key'] as string
    } else {
      throw new HttpError(401, 'MISSING_API_KEY', 'Missing Talocode API key. Provide via Authorization: Bearer header or X-Api-Key header.')
    }

    const apiKey = await authenticateTalocodeApiKey(rawKey)
    const body = await parseBody(req)
    const product = typeof body.product === 'string' ? body.product.trim() : ''
    const action = typeof body.action === 'string' ? body.action.trim() : ''
    if (!product || !action) throw new HttpError(422, 'VALIDATION_ERROR', 'product and action are required.')

    const result = await chargeCredits({
      projectId: apiKey.project_id,
      apiKeyId: apiKey.id,
      product,
      action,
      requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
      idempotencyKey: typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined,
      metadata: typeof body.metadata === 'object' && body.metadata ? (body.metadata as Record<string, unknown>) : undefined
    })

    if (!result.success) {
      sendData(res, 402, {
        ok: false,
        error: 'insufficient_credits',
        required: result.event.credits,
        available: result.remainingCredits,
        event: result.event
      })
      return
    }

    sendData(res, 200, { ok: true, event: result.event, remainingCredits: result.remainingCredits })
    return
  }

  // ─── MCP (Model Context Protocol) Routes ──────────────────────────────

  if (req.method === 'GET' && path === '/api/v1/cloud/mcp/tools') {
    const { handleMcpToolList } = await import('./mcp/server.js')
    const response = handleMcpToolList()
    const body = await response.text()
    sendJson(res, response.status, JSON.parse(body) as Record<string, unknown>)
    return
  }

  if (path === '/mcp') {
    const { handleMcpRequest } = await import('./mcp/server.js')
    const protocol = req.headers['x-forwarded-proto'] ?? 'http'
    const url = new URL(req.url ?? '/mcp', `${protocol}://${req.headers.host ?? 'localhost'}`)
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value) {
        headers.set(key, Array.isArray(value) ? value.join(', ') : value)
      }
    }
    const body = req.method === 'GET' || req.method === 'OPTIONS' ? undefined : await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', reject)
    })
    const webRequest = new Request(url.toString(), { method: req.method, headers, body })
    const response = await handleMcpRequest(webRequest)
    const responseBody = await response.text()
    res.writeHead(response.status, Object.fromEntries(response.headers))
    res.end(responseBody)
    return
  }

  // ─── Talocode Skills API (API-key authenticated) ──────────────────────

  if (path.startsWith('/v1/skills/')) {
    let rawKey: string
    const authHeader = req.headers['authorization'] || ''
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7)
    } else if (typeof req.headers['x-api-key'] === 'string') {
      rawKey = req.headers['x-api-key'] as string
    } else {
      throw new HttpError(401, 'MISSING_API_KEY', 'Missing Talocode API key. Provide via Authorization: Bearer header or X-Api-Key header.')
    }

    const apiKey = await authenticateTalocodeApiKey(rawKey)

    if (req.method === 'GET' && path === '/v1/skills/health') {
      const { generateFromProfile } = await import('./services/skills.js')
      sendData(res, 200, {
        status: 'ok',
        version: '0.2.0',
        endpoints: [
          'POST /v1/skills/generate/github-profile',
          'POST /v1/skills/generate/github-repo',
          'POST /v1/skills/generate/docs',
          'POST /v1/skills/generate/text',
          'POST /v1/skills/generate/recording',
          'POST /v1/skills/export/cursor',
          'POST /v1/skills/export/claude',
          'GET /v1/skills/health',
        ],
      })
      return
    }

    if (req.method === 'POST') {
      const body = await parseBody(req)

      if (path === '/v1/skills/generate/recording') {
        const recordingUrl = typeof body.recordingUrl === 'string' ? body.recordingUrl.trim() : ''
        if (!recordingUrl) throw new HttpError(422, 'VALIDATION_ERROR', 'recordingUrl is required.')
        const target = typeof body.target === 'string' ? body.target : 'cursor'

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'skills',
          action: 'generate.recording',
          requestId: undefined,
          metadata: { recordingUrl, target },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        const { generateFromRecording } = await import('./services/skills.js')
        const result = await generateFromRecording({
          recordingUrl,
          target,
          focus: Array.isArray(body.focus) ? body.focus.filter((f: unknown) => typeof f === 'string') : undefined,
          frameDescriptions: Array.isArray(body.frameDescriptions) ? body.frameDescriptions : undefined,
        })
        sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'skills.generate.recording' } })
        return
      }

      if (path === '/v1/skills/generate/github-profile') {
        const username = typeof body.username === 'string' ? body.username.trim() : ''
        if (!username) throw new HttpError(422, 'VALIDATION_ERROR', 'username is required.')
        const target = typeof body.target === 'string' ? body.target : 'cursor'

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'skills',
          action: 'generate.github_profile',
          requestId: undefined,
          metadata: { username, target },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        const { generateFromProfile } = await import('./services/skills.js')
        const result = await generateFromProfile({
          username,
          target,
          focus: Array.isArray(body.focus) ? body.focus.filter((f: unknown) => typeof f === 'string') : undefined,
          includeRepositories: body.includeRepositories === true,
          maxRepositories: typeof body.maxRepositories === 'number' ? body.maxRepositories : undefined,
        })
        sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'skills.generate.github_profile' } })
        return
      }

      if (path === '/v1/skills/generate/github-repo') {
        const repoUrl = typeof body.repoUrl === 'string' ? body.repoUrl.trim() : ''
        if (!repoUrl) throw new HttpError(422, 'VALIDATION_ERROR', 'repoUrl is required.')
        if (!repoUrl.startsWith('https://github.com/')) throw new HttpError(422, 'VALIDATION_ERROR', 'Only public GitHub repository URLs are supported.')
        const target = typeof body.target === 'string' ? body.target : 'cursor'

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'skills',
          action: 'generate.github_repo',
          requestId: undefined,
          metadata: { repoUrl, target },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        const { generateFromRepo } = await import('./services/skills.js')
        const result = await generateFromRepo({
          repoUrl,
          target,
          focus: Array.isArray(body.focus) ? body.focus.filter((f: unknown) => typeof f === 'string') : undefined,
        })
        sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'skills.generate.github_repo' } })
        return
      }

      if (path === '/v1/skills/generate/docs') {
        const url = typeof body.url === 'string' ? body.url.trim() : ''
        if (!url) throw new HttpError(422, 'VALIDATION_ERROR', 'url is required.')
        const target = typeof body.target === 'string' ? body.target : 'cursor'

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'skills',
          action: 'generate.docs',
          requestId: undefined,
          metadata: { url, target },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        const { generateFromDocs } = await import('./services/skills.js')
        try {
          const result = await generateFromDocs({ url, target, focus: Array.isArray(body.focus) ? body.focus.filter((f: unknown) => typeof f === 'string') : undefined })
          sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'skills.generate.docs' } })
        } catch (error) {
          throw new HttpError(422, 'FETCH_ERROR', error instanceof Error ? error.message : 'Failed to fetch docs URL.')
        }
        return
      }

      if (path === '/v1/skills/generate/text') {
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        const content = typeof body.content === 'string' ? body.content : ''
        if (!name || !content) throw new HttpError(422, 'VALIDATION_ERROR', 'name and content are required.')
        const target = typeof body.target === 'string' ? body.target : 'cursor'

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'skills',
          action: 'generate.text',
          requestId: undefined,
          metadata: { name, target },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        const { generateFromText } = await import('./services/skills.js')
        const result = await generateFromText({ name, content, target, focus: Array.isArray(body.focus) ? body.focus.filter((f: unknown) => typeof f === 'string') : undefined })
        sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'skills.generate.text' } })
        return
      }

      if (path === '/v1/skills/export/cursor') {
        const skill = body.skill as Record<string, unknown> | undefined
        if (!skill || !skill.name || !skill.skillMd) throw new HttpError(422, 'VALIDATION_ERROR', 'skill object with name and skillMd is required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'skills',
          action: 'export.cursor',
          requestId: undefined,
          metadata: { skillName: skill.name },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        const { exportForCursor } = await import('./services/skills.js')
        const result = exportForCursor({
          name: skill.name as string,
          title: (skill.title as string) || skill.name as string,
          description: (skill.description as string) || '',
          skillMd: skill.skillMd as string,
          metadata: (skill.metadata as Record<string, unknown>) || {},
        })
        sendData(res, 200, { id: 'skill_exp_' + randomUUID().slice(0, 12), object: 'skills.exported', files: result.cursor?.files ?? [], usage: { credits: chargeResult.event.credits, action: 'skills.export.cursor' } })
        return
      }

      if (path === '/v1/skills/export/claude') {
        const skill = body.skill as Record<string, unknown> | undefined
        if (!skill || !skill.name || !skill.skillMd) throw new HttpError(422, 'VALIDATION_ERROR', 'skill object with name and skillMd is required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'skills',
          action: 'export.claude',
          requestId: undefined,
          metadata: { skillName: skill.name },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        const { exportForClaude } = await import('./services/skills.js')
        const result = exportForClaude({
          name: skill.name as string,
          title: (skill.title as string) || skill.name as string,
          description: (skill.description as string) || '',
          skillMd: skill.skillMd as string,
          metadata: (skill.metadata as Record<string, unknown>) || {},
        })
        sendData(res, 200, { id: 'skill_exp_' + randomUUID().slice(0, 12), object: 'skills.exported', files: result.claude?.files ?? [], usage: { credits: chargeResult.event.credits, action: 'skills.export.claude' } })
        return
      }
    }

    throw new HttpError(404, 'NOT_FOUND', 'Skills API route not found.', { method: req.method, path })
  }

  // ─── Talocode Agent Browser API (API-key authenticated) ─────────────────

  if (path.startsWith('/v1/agent-browser/')) {
    let rawKey: string
    const authHeader = req.headers['authorization'] || ''
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7)
    } else if (typeof req.headers['x-api-key'] === 'string') {
      rawKey = req.headers['x-api-key'] as string
    } else {
      throw new HttpError(401, 'MISSING_API_KEY', 'Missing Talocode API key. Provide via Authorization: Bearer header or X-Api-Key header.')
    }

    const apiKey = await authenticateTalocodeApiKey(rawKey)

    if (req.method === 'GET' && path === '/v1/agent-browser/health') {
      sendData(res, 200, {
        status: 'ok',
        version: '0.2.0',
        mode: process.env.AGENT_BROWSER_SERVICE_URL ? 'proxy' : 'http',
        endpoints: [
          'POST /v1/agent-browser/check',
          'POST /v1/agent-browser/screenshot',
          'POST /v1/agent-browser/evidence',
          'POST /v1/agent-browser/extract',
          'POST /v1/agent-browser/analyze',
          'POST /v1/agent-browser/trace-report',
          'GET /v1/agent-browser/health',
        ],
      })
      return
    }

    if (req.method === 'POST') {
      const body = await parseBody(req)
      const {
        runBrowserCheck,
        runBrowserScreenshot,
        runBrowserEvidence,
        runBrowserTraceReport,
        runBrowserExtract,
        runBrowserAnalyze,
      } = await import('./services/agent-browser.js')

      if (path === '/v1/agent-browser/check') {
        const url = typeof body.url === 'string' ? body.url.trim() : ''
        if (!url) throw new HttpError(422, 'VALIDATION_ERROR', 'url is required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'agent_browser',
          action: 'browser.check',
          requestId: undefined,
          metadata: { url },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        try {
          const result = await runBrowserCheck({
            url,
            screenshot: body.screenshot === true,
            vision: body.vision === true,
            sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
          })
          sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'agent_browser.browser.check' } })
        } catch (error) {
          throw new HttpError(422, 'BROWSER_ERROR', error instanceof Error ? error.message : 'Browser check failed.')
        }
        return
      }

      if (path === '/v1/agent-browser/screenshot') {
        const url = typeof body.url === 'string' ? body.url.trim() : ''
        if (!url) throw new HttpError(422, 'VALIDATION_ERROR', 'url is required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'agent_browser',
          action: 'browser.screenshot',
          requestId: undefined,
          metadata: { url },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        try {
          const result = await runBrowserScreenshot({
            url,
            fullPage: body.fullPage === true,
            width: typeof body.width === 'number' ? body.width : undefined,
            height: typeof body.height === 'number' ? body.height : undefined,
            sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
          })
          sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'agent_browser.browser.screenshot' } })
        } catch (error) {
          throw new HttpError(503, 'BROWSER_UNAVAILABLE', error instanceof Error ? error.message : 'Screenshot capture unavailable.')
        }
        return
      }

      if (path === '/v1/agent-browser/evidence') {
        const url = typeof body.url === 'string' ? body.url.trim() : ''
        if (!url) throw new HttpError(422, 'VALIDATION_ERROR', 'url is required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'agent_browser',
          action: 'browser.evidence',
          requestId: undefined,
          metadata: { url },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        try {
          const result = await runBrowserEvidence({
            url,
            sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
          })
          sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'agent_browser.browser.evidence' } })
        } catch (error) {
          throw new HttpError(422, 'BROWSER_ERROR', error instanceof Error ? error.message : 'Evidence capture failed.')
        }
        return
      }

      if (path === '/v1/agent-browser/trace-report') {
        const url = typeof body.url === 'string' ? body.url.trim() : ''
        if (!url) throw new HttpError(422, 'VALIDATION_ERROR', 'url is required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'agent_browser',
          action: 'browser.trace_report',
          requestId: undefined,
          metadata: { url },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        try {
          const result = await runBrowserTraceReport({
            url,
            sessionId: typeof body.sessionId === 'string' ? body.sessionId : undefined,
            steps: Array.isArray(body.steps)
              ? body.steps.filter((step: unknown) => typeof step === 'object' && step !== null) as { action: string; selector?: string; value?: string }[]
              : undefined,
          })
          sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'agent_browser.browser.trace_report' } })
        } catch (error) {
          throw new HttpError(422, 'BROWSER_ERROR', error instanceof Error ? error.message : 'Trace report failed.')
        }
        return
      }

      if (path === '/v1/agent-browser/extract') {
        const url = typeof body.url === 'string' ? body.url.trim() : ''
        if (!url) throw new HttpError(422, 'VALIDATION_ERROR', 'url is required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'agent_browser',
          action: 'browser.extract',
          requestId: undefined,
          metadata: { url },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        try {
          const result = await runBrowserExtract({
            url,
            includeImages: body.includeImages !== false,
            includeLinks: body.includeLinks !== false,
            maxTextLength: typeof body.maxTextLength === 'number' ? body.maxTextLength : undefined,
          })
          sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'agent_browser.browser.extract' } })
        } catch (error) {
          throw new HttpError(422, 'EXTRACT_ERROR', error instanceof Error ? error.message : 'Content extraction failed.')
        }
        return
      }

      if (path === '/v1/agent-browser/analyze') {
        const url = typeof body.url === 'string' ? body.url.trim() : ''
        if (!url) throw new HttpError(422, 'VALIDATION_ERROR', 'url is required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'agent_browser',
          action: 'browser.analyze',
          requestId: undefined,
          metadata: { url },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        try {
          const result = await runBrowserAnalyze({
            url,
            analysis: Array.isArray(body.analysis) ? body.analysis : undefined,
            maxTextLength: typeof body.maxTextLength === 'number' ? body.maxTextLength : undefined,
          })
          sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'agent_browser.browser.analyze' } })
        } catch (error) {
          throw new HttpError(422, 'ANALYZE_ERROR', error instanceof Error ? error.message : 'Content analysis failed.')
        }
        return
      }
    }

    throw new HttpError(404, 'NOT_FOUND', 'Agent Browser API route not found.', { method: req.method, path })
  }

  // ─── ScreenLane Image Analysis API (API-key authenticated) ───────────────

  if (path.startsWith('/v1/screenlane/')) {
    const authHeader = req.headers.authorization
    const rawKey = typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : typeof req.headers['x-api-key'] === 'string'
        ? req.headers['x-api-key']
        : undefined
    if (!rawKey) {
      throw new HttpError(401, 'MISSING_API_KEY', 'Missing Talocode API key. Provide via Authorization: Bearer header or X-Api-Key header.')
    }
    await authenticateTalocodeApiKey(rawKey)

    if (req.method === 'GET' && path === '/v1/screenlane/health') {
      sendData(res, 200, {
        status: 'ok',
        providerConfigured: Boolean(process.env.SCREENLANE_VISION_PROVIDER_URL),
        endpoints: ['POST /v1/screenlane/analyze', 'GET /v1/screenlane/health'],
      })
      return
    }

    if (req.method === 'POST' && path === '/v1/screenlane/analyze') {
      const { MAX_SCREENLANE_REQUEST_BYTES } = await import('./services/screenlane.js')
      const body = await parseBody(req, MAX_SCREENLANE_REQUEST_BYTES)
      const features = Array.isArray(body.features) ? body.features : undefined
      if (features?.some((feature) => feature !== 'text' && feature !== 'labels')) {
        throw new HttpError(422, 'VALIDATION_ERROR', 'features may only include text and labels.')
      }
      const {
        analyzeScreenImage,
        ScreenLaneInputError,
        VisionProviderTimeoutError,
        VisionProviderUnavailableError,
      } = await import('./services/screenlane.js')
      try {
        const result = await analyzeScreenImage({
          imageBase64: typeof body.imageBase64 === 'string' ? body.imageBase64 : '',
          mimeType: typeof body.mimeType === 'string' ? body.mimeType : '',
          features: features as ('text' | 'labels')[] | undefined,
        })
        sendData(res, 200, result)
      } catch (error) {
        if (error instanceof VisionProviderUnavailableError) {
          throw new HttpError(503, 'VISION_UNAVAILABLE', error.message)
        }
        if (error instanceof ScreenLaneInputError) {
          throw new HttpError(422, 'VALIDATION_ERROR', error.message)
        }
        if (error instanceof VisionProviderTimeoutError) {
          throw new HttpError(504, 'VISION_PROVIDER_TIMEOUT', 'Image analysis provider timed out.')
        }
        throw new HttpError(502, 'VISION_PROVIDER_ERROR', 'Image analysis provider failed.')
      }
      return
    }

    throw new HttpError(404, 'NOT_FOUND', 'ScreenLane API route not found.', { method: req.method, path })
  }

  // ─── InvoiceLane Document API (API-key authenticated) ────────────────────

  if (path.startsWith('/v1/invoicelane/')) {
    let rawKey: string
    const authHeader = req.headers['authorization'] || ''
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7)
    } else if (typeof req.headers['x-api-key'] === 'string') {
      rawKey = req.headers['x-api-key'] as string
    } else {
      throw new HttpError(401, 'MISSING_API_KEY', 'Missing Talocode API key. Provide via Authorization: Bearer header or X-Api-Key header.')
    }

    const apiKey = await authenticateTalocodeApiKey(rawKey)

    const {
      extractFromText,
      extractInvoiceFromText,
      extractReceiptFromText,
      validateFields,
      toCsv,
      getInvoiceLanePricing,
      getInvoiceLaneCapabilities,
      assertTextOrOcrError,
      OcrNotAvailableError,
    } = await import('./services/invoicelane.js')

    if (req.method === 'GET' && path === '/v1/invoicelane/health') {
      sendData(res, 200, {
        ok: true,
        service: 'invoicelane',
        version: '0.2.0',
        endpoints: [
          'GET /v1/invoicelane/health',
          'GET /v1/invoicelane/pricing',
          'GET /v1/invoicelane/capabilities',
          'POST /v1/invoicelane/extract',
          'POST /v1/invoicelane/invoice/extract',
          'POST /v1/invoicelane/receipt/extract',
          'POST /v1/invoicelane/validate',
          'POST /v1/invoicelane/export/csv',
        ],
      })
      return
    }

    if (req.method === 'GET' && path === '/v1/invoicelane/pricing') {
      sendData(res, 200, getInvoiceLanePricing())
      return
    }

    if (req.method === 'GET' && path === '/v1/invoicelane/capabilities') {
      sendData(res, 200, getInvoiceLaneCapabilities())
      return
    }

    if (req.method === 'POST') {
      const body = await parseBody(req)

      if (path === '/v1/invoicelane/extract') {
        try {
          const text = assertTextOrOcrError(body as { text?: string; fileUrl?: string; base64?: string })
          const chargeResult = await chargeCredits({
            projectId: apiKey.project_id,
            apiKeyId: apiKey.id,
            product: 'invoicelane',
            action: 'invoicelane.extract',
            requestId: undefined,
            metadata: { type: body.type, inputSize: text.length },
          })
          if (!chargeResult.success) {
            sendData(res, 402, {
              ok: false,
              error: 'insufficient_credits',
              required: chargeResult.event.credits,
              available: chargeResult.remainingCredits,
            })
            return
          }

          const result = extractFromText(text, {
            type: typeof body.type === 'string' ? (body.type as 'invoice' | 'receipt' | 'document' | 'auto') : undefined,
            currency: typeof body.currency === 'string' ? body.currency : undefined,
            locale: typeof body.locale === 'string' ? body.locale : undefined,
          })
          sendData(res, 200, {
            ...result,
            usage: {
              credits: chargeResult.event.credits,
              action: 'invoicelane.extract',
              remaining: chargeResult.remainingCredits,
            },
          })
        } catch (error) {
          if (error instanceof OcrNotAvailableError) {
            throw new HttpError(400, 'OCR_NOT_AVAILABLE', error.message)
          }
          throw error
        }
        return
      }

      if (path === '/v1/invoicelane/invoice/extract') {
        try {
          const text = assertTextOrOcrError(body as { text?: string; fileUrl?: string; base64?: string })
          const chargeResult = await chargeCredits({
            projectId: apiKey.project_id,
            apiKeyId: apiKey.id,
            product: 'invoicelane',
            action: 'invoicelane.invoice.extract',
            requestId: undefined,
            metadata: { inputSize: text.length },
          })
          if (!chargeResult.success) {
            sendData(res, 402, {
              ok: false,
              error: 'insufficient_credits',
              required: chargeResult.event.credits,
              available: chargeResult.remainingCredits,
            })
            return
          }

          const result = extractInvoiceFromText(text, {
            currency: typeof body.currency === 'string' ? body.currency : undefined,
            locale: typeof body.locale === 'string' ? body.locale : undefined,
          })
          sendData(res, 200, {
            ...result,
            usage: {
              credits: chargeResult.event.credits,
              action: 'invoicelane.invoice.extract',
              remaining: chargeResult.remainingCredits,
            },
          })
        } catch (error) {
          if (error instanceof OcrNotAvailableError) {
            throw new HttpError(400, 'OCR_NOT_AVAILABLE', error.message)
          }
          throw error
        }
        return
      }

      if (path === '/v1/invoicelane/receipt/extract') {
        try {
          const text = assertTextOrOcrError(body as { text?: string; fileUrl?: string; base64?: string })
          const chargeResult = await chargeCredits({
            projectId: apiKey.project_id,
            apiKeyId: apiKey.id,
            product: 'invoicelane',
            action: 'invoicelane.receipt.extract',
            requestId: undefined,
            metadata: { inputSize: text.length },
          })
          if (!chargeResult.success) {
            sendData(res, 402, {
              ok: false,
              error: 'insufficient_credits',
              required: chargeResult.event.credits,
              available: chargeResult.remainingCredits,
            })
            return
          }

          const result = extractReceiptFromText(text, {
            currency: typeof body.currency === 'string' ? body.currency : undefined,
            locale: typeof body.locale === 'string' ? body.locale : undefined,
          })
          sendData(res, 200, {
            ...result,
            usage: {
              credits: chargeResult.event.credits,
              action: 'invoicelane.receipt.extract',
              remaining: chargeResult.remainingCredits,
            },
          })
        } catch (error) {
          if (error instanceof OcrNotAvailableError) {
            throw new HttpError(400, 'OCR_NOT_AVAILABLE', error.message)
          }
          throw error
        }
        return
      }

      if (path === '/v1/invoicelane/validate') {
        const documentType = typeof body.documentType === 'string' ? body.documentType : ''
        const fields =
          body.fields && typeof body.fields === 'object' && !Array.isArray(body.fields)
            ? (body.fields as Record<string, unknown>)
            : null
        if (!documentType || !fields) {
          throw new HttpError(422, 'VALIDATION_ERROR', 'documentType and fields are required.')
        }

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'invoicelane',
          action: 'invoicelane.validate',
          requestId: undefined,
          metadata: { documentType },
        })
        if (!chargeResult.success) {
          sendData(res, 402, {
            ok: false,
            error: 'insufficient_credits',
            required: chargeResult.event.credits,
            available: chargeResult.remainingCredits,
          })
          return
        }

        const result = validateFields({ documentType, fields })
        sendData(res, 200, {
          ...result,
          usage: {
            credits: chargeResult.event.credits,
            action: 'invoicelane.validate',
            remaining: chargeResult.remainingCredits,
          },
        })
        return
      }

      if (path === '/v1/invoicelane/export/csv') {
        const rows = Array.isArray(body.rows) ? (body.rows as Record<string, unknown>[]) : null
        if (!rows) {
          throw new HttpError(422, 'VALIDATION_ERROR', 'rows array is required.')
        }

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'invoicelane',
          action: 'invoicelane.export.csv',
          requestId: undefined,
          metadata: { rowCount: rows.length },
        })
        if (!chargeResult.success) {
          sendData(res, 402, {
            ok: false,
            error: 'insufficient_credits',
            required: chargeResult.event.credits,
            available: chargeResult.remainingCredits,
          })
          return
        }

        const csv = toCsv(rows)
        sendData(res, 200, {
          filename: 'export.csv',
          contentType: 'text/csv',
          csv,
          usage: {
            credits: chargeResult.event.credits,
            action: 'invoicelane.export.csv',
            remaining: chargeResult.remainingCredits,
          },
        })
        return
      }
    }

    throw new HttpError(404, 'NOT_FOUND', 'InvoiceLane API route not found.', { method: req.method, path })
  }

  // ─── GeoLane AI Visibility API (API-key authenticated) ───────────────────

  if (path.startsWith('/v1/geolane/')) {
    let rawKey: string
    const authHeader = req.headers['authorization'] || ''
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7)
    } else if (typeof req.headers['x-api-key'] === 'string') {
      rawKey = req.headers['x-api-key'] as string
    } else {
      throw new HttpError(401, 'MISSING_API_KEY', 'Missing Talocode API key. Provide via Authorization: Bearer header or X-Api-Key header.')
    }

    const apiKey = await authenticateTalocodeApiKey(rawKey)
    const {
      runGeoAudit,
      runCrawlerAccess,
      runLlmsTxt,
      runCitationReadiness,
      runCompare,
      getGeoLanePricing,
      getGeoLaneCapabilities,
    } = await import('./services/geolane.js')

    if (req.method === 'GET' && path === '/v1/geolane/health') {
      sendData(res, 200, {
        ok: true,
        service: 'geolane',
        version: '0.1.0',
        endpoints: getGeoLaneCapabilities().endpoints,
      })
      return
    }

    if (req.method === 'GET' && path === '/v1/geolane/pricing') {
      sendData(res, 200, getGeoLanePricing())
      return
    }

    if (req.method === 'GET' && path === '/v1/geolane/capabilities') {
      sendData(res, 200, getGeoLaneCapabilities())
      return
    }

    if (req.method === 'POST') {
      const body = await parseBody(req)

      if (path === '/v1/geolane/audit') {
        const url = typeof body.url === 'string' ? body.url.trim() : ''
        if (!url) throw new HttpError(422, 'VALIDATION_ERROR', 'url is required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'geolane',
          action: 'geolane.audit',
          requestId: undefined,
          metadata: { url },
        })
        if (!chargeResult.success) {
          sendData(res, 402, {
            ok: false,
            error: 'insufficient_credits',
            required: chargeResult.event.credits,
            available: chargeResult.remainingCredits,
          })
          return
        }

        try {
          const result = await runGeoAudit(url)
          sendData(res, 200, {
            ...result,
            usage: {
              credits: chargeResult.event.credits,
              action: 'geolane.audit',
              remaining: chargeResult.remainingCredits,
            },
          })
        } catch (error) {
          throw new HttpError(422, 'GEO_ERROR', error instanceof Error ? error.message : 'GEO audit failed.')
        }
        return
      }

      if (path === '/v1/geolane/crawlers') {
        const url = typeof body.url === 'string' ? body.url.trim() : ''
        if (!url) throw new HttpError(422, 'VALIDATION_ERROR', 'url is required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'geolane',
          action: 'geolane.crawlers',
          requestId: undefined,
          metadata: { url },
        })
        if (!chargeResult.success) {
          sendData(res, 402, {
            ok: false,
            error: 'insufficient_credits',
            required: chargeResult.event.credits,
            available: chargeResult.remainingCredits,
          })
          return
        }

        try {
          const result = await runCrawlerAccess(url)
          sendData(res, 200, {
            ...result,
            usage: {
              credits: chargeResult.event.credits,
              action: 'geolane.crawlers',
              remaining: chargeResult.remainingCredits,
            },
          })
        } catch (error) {
          throw new HttpError(422, 'GEO_ERROR', error instanceof Error ? error.message : 'Crawler access check failed.')
        }
        return
      }

      if (path === '/v1/geolane/llms-txt') {
        const url = typeof body.url === 'string' ? body.url.trim() : ''
        if (!url) throw new HttpError(422, 'VALIDATION_ERROR', 'url is required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'geolane',
          action: 'geolane.llms_txt',
          requestId: undefined,
          metadata: { url },
        })
        if (!chargeResult.success) {
          sendData(res, 402, {
            ok: false,
            error: 'insufficient_credits',
            required: chargeResult.event.credits,
            available: chargeResult.remainingCredits,
          })
          return
        }

        try {
          const result = await runLlmsTxt(url)
          sendData(res, 200, {
            ...result,
            usage: {
              credits: chargeResult.event.credits,
              action: 'geolane.llms_txt',
              remaining: chargeResult.remainingCredits,
            },
          })
        } catch (error) {
          throw new HttpError(422, 'GEO_ERROR', error instanceof Error ? error.message : 'llms.txt analysis failed.')
        }
        return
      }

      if (path === '/v1/geolane/citation-readiness') {
        const url = typeof body.url === 'string' ? body.url.trim() : ''
        if (!url) throw new HttpError(422, 'VALIDATION_ERROR', 'url is required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'geolane',
          action: 'geolane.citation_readiness',
          requestId: undefined,
          metadata: { url },
        })
        if (!chargeResult.success) {
          sendData(res, 402, {
            ok: false,
            error: 'insufficient_credits',
            required: chargeResult.event.credits,
            available: chargeResult.remainingCredits,
          })
          return
        }

        try {
          const result = await runCitationReadiness(url)
          sendData(res, 200, {
            ...result,
            usage: {
              credits: chargeResult.event.credits,
              action: 'geolane.citation_readiness',
              remaining: chargeResult.remainingCredits,
            },
          })
        } catch (error) {
          throw new HttpError(422, 'GEO_ERROR', error instanceof Error ? error.message : 'Citation readiness failed.')
        }
        return
      }

      if (path === '/v1/geolane/compare') {
        const urlA = typeof body.urlA === 'string' ? body.urlA.trim() : typeof body.a === 'string' ? body.a.trim() : ''
        const urlB = typeof body.urlB === 'string' ? body.urlB.trim() : typeof body.b === 'string' ? body.b.trim() : ''
        if (!urlA || !urlB) throw new HttpError(422, 'VALIDATION_ERROR', 'urlA and urlB are required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'geolane',
          action: 'geolane.compare',
          requestId: undefined,
          metadata: { urlA, urlB },
        })
        if (!chargeResult.success) {
          sendData(res, 402, {
            ok: false,
            error: 'insufficient_credits',
            required: chargeResult.event.credits,
            available: chargeResult.remainingCredits,
          })
          return
        }

        try {
          const result = await runCompare(urlA, urlB)
          sendData(res, 200, {
            ...result,
            usage: {
              credits: chargeResult.event.credits,
              action: 'geolane.compare',
              remaining: chargeResult.remainingCredits,
            },
          })
        } catch (error) {
          throw new HttpError(422, 'GEO_ERROR', error instanceof Error ? error.message : 'GEO compare failed.')
        }
        return
      }
    }

    throw new HttpError(404, 'NOT_FOUND', 'GeoLane API route not found.', { method: req.method, path })
  }

  // ─── SearchLane Agent Search API (API-key authenticated) ─────────────────

  if (path.startsWith('/v1/searchlane/')) {
    let rawKey: string
    const authHeader = req.headers['authorization'] || ''
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7)
    } else if (typeof req.headers['x-api-key'] === 'string') {
      rawKey = req.headers['x-api-key'] as string
    } else {
      throw new HttpError(401, 'MISSING_API_KEY', 'Missing Talocode API key. Provide via Authorization: Bearer header or X-Api-Key header.')
    }

    const apiKey = await authenticateTalocodeApiKey(rawKey)
    const {
      runSearchQuery,
      runSearchNews,
      runResearch,
      getSearchLanePricing,
      getSearchLaneCapabilities,
    } = await import('./services/searchlane.js')

    if (req.method === 'GET' && path === '/v1/searchlane/health') {
      sendData(res, 200, {
        ok: true,
        service: 'searchlane',
        version: '0.1.0',
        endpoints: getSearchLaneCapabilities().endpoints,
      })
      return
    }

    if (req.method === 'GET' && path === '/v1/searchlane/pricing') {
      sendData(res, 200, getSearchLanePricing())
      return
    }

    if (req.method === 'GET' && path === '/v1/searchlane/capabilities') {
      sendData(res, 200, getSearchLaneCapabilities())
      return
    }

    if (req.method === 'POST') {
      const body = await parseBody(req)
      const query = typeof body.query === 'string' ? body.query.trim() : typeof body.q === 'string' ? body.q.trim() : ''
      const limit = typeof body.limit === 'number' ? body.limit : undefined

      if (path === '/v1/searchlane/query') {
        if (!query) throw new HttpError(422, 'VALIDATION_ERROR', 'query is required.')
        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'searchlane',
          action: 'searchlane.query',
          requestId: undefined,
          metadata: { query, limit },
        })
        if (!chargeResult.success) {
          sendData(res, 402, {
            ok: false,
            error: 'insufficient_credits',
            required: chargeResult.event.credits,
            available: chargeResult.remainingCredits,
          })
          return
        }
        try {
          const result = await runSearchQuery(query, { limit })
          sendData(res, 200, {
            ...result,
            usage: {
              credits: chargeResult.event.credits,
              action: 'searchlane.query',
              remaining: chargeResult.remainingCredits,
            },
          })
        } catch (error) {
          throw new HttpError(422, 'SEARCH_ERROR', error instanceof Error ? error.message : 'Search failed.')
        }
        return
      }

      if (path === '/v1/searchlane/news') {
        if (!query) throw new HttpError(422, 'VALIDATION_ERROR', 'query is required.')
        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'searchlane',
          action: 'searchlane.news',
          requestId: undefined,
          metadata: { query, limit },
        })
        if (!chargeResult.success) {
          sendData(res, 402, {
            ok: false,
            error: 'insufficient_credits',
            required: chargeResult.event.credits,
            available: chargeResult.remainingCredits,
          })
          return
        }
        try {
          const result = await runSearchNews(query, { limit })
          sendData(res, 200, {
            ...result,
            usage: {
              credits: chargeResult.event.credits,
              action: 'searchlane.news',
              remaining: chargeResult.remainingCredits,
            },
          })
        } catch (error) {
          throw new HttpError(422, 'SEARCH_ERROR', error instanceof Error ? error.message : 'News search failed.')
        }
        return
      }

      if (path === '/v1/searchlane/research') {
        if (!query) throw new HttpError(422, 'VALIDATION_ERROR', 'query is required.')
        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'searchlane',
          action: 'searchlane.research',
          requestId: undefined,
          metadata: { query, limit },
        })
        if (!chargeResult.success) {
          sendData(res, 402, {
            ok: false,
            error: 'insufficient_credits',
            required: chargeResult.event.credits,
            available: chargeResult.remainingCredits,
          })
          return
        }
        try {
          const result = await runResearch(query, {
            limit,
            fetchPages: body.fetchPages !== false,
          })
          sendData(res, 200, {
            ...result,
            usage: {
              credits: chargeResult.event.credits,
              action: 'searchlane.research',
              remaining: chargeResult.remainingCredits,
            },
          })
        } catch (error) {
          throw new HttpError(422, 'SEARCH_ERROR', error instanceof Error ? error.message : 'Research failed.')
        }
        return
      }
    }

    throw new HttpError(404, 'NOT_FOUND', 'SearchLane API route not found.', { method: req.method, path })
  }

  // ─── CalcLane Calculator API (API-key authenticated) ─────────────────────

  if (path.startsWith('/v1/calclane/')) {
    let rawKey: string
    const authHeader = req.headers['authorization'] || ''
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7)
    } else if (typeof req.headers['x-api-key'] === 'string') {
      rawKey = req.headers['x-api-key'] as string
    } else {
      throw new HttpError(401, 'MISSING_API_KEY', 'Missing Talocode API key. Provide via Authorization: Bearer header or X-Api-Key header.')
    }

    const apiKey = await authenticateTalocodeApiKey(rawKey)
    const {
      evaluateExpression,
      runDispatch,
      getCalcLanePricing,
      getCalcLaneCapabilities,
      CALCLANE_VERSION,
    } = await import('./services/calclane.js')

    if (req.method === 'GET' && path === '/v1/calclane/health') {
      sendData(res, 200, {
        ok: true,
        service: 'calclane',
        version: CALCLANE_VERSION,
        endpoints: getCalcLaneCapabilities().endpoints,
      })
      return
    }

    if (req.method === 'GET' && path === '/v1/calclane/pricing') {
      sendData(res, 200, getCalcLanePricing())
      return
    }

    if (req.method === 'GET' && path === '/v1/calclane/capabilities') {
      sendData(res, 200, getCalcLaneCapabilities())
      return
    }

    if (req.method === 'POST' && path === '/v1/calclane/evaluate') {
      const body = await parseBody(req)
      const expression =
        typeof body.expression === 'string'
          ? body.expression
          : typeof body.expr === 'string'
            ? body.expr
            : typeof body.q === 'string'
              ? body.q
              : ''
      if (!String(expression).trim()) {
        throw new HttpError(422, 'VALIDATION_ERROR', 'expression is required.')
      }
      const chargeResult = await chargeCredits({
        projectId: apiKey.project_id,
        apiKeyId: apiKey.id,
        product: 'calclane',
        action: 'calclane.evaluate',
        requestId: undefined,
        metadata: { expression: String(expression).slice(0, 200) },
      })
      if (!chargeResult.success) {
        sendData(res, 402, {
          ok: false,
          error: 'insufficient_credits',
          required: chargeResult.event.credits,
          available: chargeResult.remainingCredits,
        })
        return
      }
      const result = evaluateExpression(String(expression), {
        mode: body.mode === 'standard' ? 'standard' : 'scientific',
        angle: body.angle === 'rad' || body.angle === 'grad' ? body.angle : 'deg',
        fe: Boolean(body.fe),
      })
      if (!result.ok) {
        sendData(res, 422, {
          ...result,
          usage: {
            credits: chargeResult.event.credits,
            action: 'calclane.evaluate',
            remaining: chargeResult.remainingCredits,
          },
        })
        return
      }
      sendData(res, 200, {
        ...result,
        usage: {
          credits: chargeResult.event.credits,
          action: 'calclane.evaluate',
          remaining: chargeResult.remainingCredits,
        },
      })
      return
    }

    if (req.method === 'POST' && path === '/v1/calclane/dispatch') {
      const body = await parseBody(req)
      const commands = Array.isArray(body.commands) ? body.commands : null
      if (!commands) {
        throw new HttpError(422, 'VALIDATION_ERROR', 'commands array is required.')
      }
      const chargeResult = await chargeCredits({
        projectId: apiKey.project_id,
        apiKeyId: apiKey.id,
        product: 'calclane',
        action: 'calclane.dispatch',
        requestId: undefined,
        metadata: { commandCount: commands.length },
      })
      if (!chargeResult.success) {
        sendData(res, 402, {
          ok: false,
          error: 'insufficient_credits',
          required: chargeResult.event.credits,
          available: chargeResult.remainingCredits,
        })
        return
      }
      const result = runDispatch({
        commands: commands as Array<Record<string, unknown>>,
        mode: body.mode === 'standard' ? 'standard' : 'scientific',
        angle: body.angle === 'rad' || body.angle === 'grad' ? body.angle : 'deg',
      })
      sendData(res, result.ok ? 200 : 422, {
        ...result,
        usage: {
          credits: chargeResult.event.credits,
          action: 'calclane.dispatch',
          remaining: chargeResult.remainingCredits,
        },
      })
      return
    }

    throw new HttpError(404, 'NOT_FOUND', 'CalcLane API route not found.', { method: req.method, path })
  }

  // ─── ReliabilityLane Reliability API (API-key authenticated) ────────────────────

  if (path.startsWith('/v1/reliabilitylane/')) {
    let rawKey: string
    const authHeader = req.headers['authorization'] || ''
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7)
    } else if (typeof req.headers['x-api-key'] === 'string') {
      rawKey = req.headers['x-api-key'] as string
    } else {
      throw new HttpError(401, 'MISSING_API_KEY', 'Missing Talocode API key. Provide via Authorization: Bearer header or X-Api-Key header.')
    }

    const apiKey = await authenticateTalocodeApiKey(rawKey)
    const {
      FAILURE_PATTERNS,
      RETRY_STRATEGIES,
      VERIFICATION_CHECKLISTS,
      INCIDENT_PLAYBOOKS,
      ANTI_PATTERNS,
      matchFailure,
      planRetry,
      verify,
      incidentFor,
      getReliabilityLanePricing,
      getReliabilityLaneCapabilities,
      RELIABILITYLANE_VERSION,
    } = await import('./services/reliabilitylane.js')

    if (req.method === 'GET' && path === '/v1/reliabilitylane/health') {
      sendData(res, 200, {
        ok: true,
        service: 'reliabilitylane',
        version: RELIABILITYLANE_VERSION,
        endpoints: getReliabilityLaneCapabilities().endpoints,
      })
      return
    }

    if (req.method === 'GET' && path === '/v1/reliabilitylane/pricing') {
      sendData(res, 200, getReliabilityLanePricing())
      return
    }

    if (req.method === 'GET' && path === '/v1/reliabilitylane/capabilities') {
      sendData(res, 200, getReliabilityLaneCapabilities())
      return
    }

    if (req.method === 'GET' && path === '/v1/reliabilitylane/antipatterns') {
      sendData(res, 200, { product: 'reliabilitylane', version: RELIABILITYLANE_VERSION, antiPatterns: ANTI_PATTERNS })
      return
    }

    if (req.method === 'GET' && path === '/v1/reliabilitylane/patterns') {
      sendData(res, 200, { product: 'reliabilitylane', version: RELIABILITYLANE_VERSION, patterns: FAILURE_PATTERNS })
      return
    }

    if (req.method === 'GET' && path === '/v1/reliabilitylane/retries') {
      sendData(res, 200, { product: 'reliabilitylane', version: RELIABILITYLANE_VERSION, strategies: RETRY_STRATEGIES })
      return
    }

    if (req.method === 'GET' && path === '/v1/reliabilitylane/checklists') {
      sendData(res, 200, { product: 'reliabilitylane', version: RELIABILITYLANE_VERSION, checklists: VERIFICATION_CHECKLISTS })
      return
    }

    if (req.method === 'GET' && path === '/v1/reliabilitylane/playbooks') {
      sendData(res, 200, { product: 'reliabilitylane', version: RELIABILITYLANE_VERSION, playbooks: INCIDENT_PLAYBOOKS })
      return
    }

    const patternMatch = path.match(/^\/v1\/reliabilitylane\/patterns\/([\w-]+)$/)
    if (req.method === 'GET' && patternMatch) {
      const pattern = FAILURE_PATTERNS.find((p) => p.id === patternMatch[1])
      if (!pattern) {
        throw new HttpError(404, 'NOT_FOUND', `ReliabilityLane pattern '${patternMatch[1]}' not found.`)
      }
      sendData(res, 200, { product: 'reliabilitylane', version: RELIABILITYLANE_VERSION, pattern })
      return
    }

    if (req.method === 'POST' && path === '/v1/reliabilitylane/match') {
      const body = await parseBody(req)
      const chargeResult = await chargeCredits({
        projectId: apiKey.project_id,
        apiKeyId: apiKey.id,
        product: 'reliabilitylane',
        action: 'reliabilitylane.patterns',
        requestId: undefined,
        metadata: { symptom: String(body.symptom || '').slice(0, 200) },
      })
      if (!chargeResult.success) {
        sendData(res, 402, {
          ok: false,
          error: 'insufficient_credits',
          required: chargeResult.event.credits,
          available: chargeResult.remainingCredits,
        })
        return
      }
      const result = matchFailure({
        symptom: typeof body.symptom === 'string' ? body.symptom : '',
        error: typeof body.error === 'string' ? body.error : '',
        category: typeof body.category === 'string' ? body.category : undefined,
      })
      sendData(res, 200, {
        ...result,
        usage: {
          credits: chargeResult.event.credits,
          action: 'reliabilitylane.patterns',
          remaining: chargeResult.remainingCredits,
        },
      })
      return
    }

    if (req.method === 'POST' && path === '/v1/reliabilitylane/retry-plan') {
      const body = await parseBody(req)
      const chargeResult = await chargeCredits({
        projectId: apiKey.project_id,
        apiKeyId: apiKey.id,
        product: 'reliabilitylane',
        action: 'reliabilitylane.retry',
        requestId: undefined,
        metadata: { status: typeof body.status === 'number' ? body.status : undefined },
      })
      if (!chargeResult.success) {
        sendData(res, 402, {
          ok: false,
          error: 'insufficient_credits',
          required: chargeResult.event.credits,
          available: chargeResult.remainingCredits,
        })
        return
      }
      const result = planRetry({
        status: typeof body.status === 'number' ? body.status : undefined,
        code: typeof body.code === 'string' ? body.code : undefined,
        message: typeof body.message === 'string' ? body.message : undefined,
        kind: typeof body.kind === 'string' ? body.kind : undefined,
      })
      sendData(res, 200, {
        ...result,
        usage: {
          credits: chargeResult.event.credits,
          action: 'reliabilitylane.retry',
          remaining: chargeResult.remainingCredits,
        },
      })
      return
    }

    if (req.method === 'POST' && path === '/v1/reliabilitylane/verify') {
      const body = await parseBody(req)
      const chargeResult = await chargeCredits({
        projectId: apiKey.project_id,
        apiKeyId: apiKey.id,
        product: 'reliabilitylane',
        action: 'reliabilitylane.verify',
        requestId: undefined,
        metadata: { area: typeof body.area === 'string' ? body.area : undefined },
      })
      if (!chargeResult.success) {
        sendData(res, 402, {
          ok: false,
          error: 'insufficient_credits',
          required: chargeResult.event.credits,
          available: chargeResult.remainingCredits,
        })
        return
      }
      const result = verify({
        checklist: typeof body.checklist === 'string' ? body.checklist : undefined,
        area: typeof body.area === 'string' ? body.area : undefined,
        evidence: body.evidence && typeof body.evidence === 'object' ? (body.evidence as Record<string, unknown>) : undefined,
      })
      sendData(res, 200, {
        ...result,
        usage: {
          credits: chargeResult.event.credits,
          action: 'reliabilitylane.verify',
          remaining: chargeResult.remainingCredits,
        },
      })
      return
    }

    if (req.method === 'POST' && path === '/v1/reliabilitylane/incident') {
      const body = await parseBody(req)
      const chargeResult = await chargeCredits({
        projectId: apiKey.project_id,
        apiKeyId: apiKey.id,
        product: 'reliabilitylane',
        action: 'reliabilitylane.incident',
        requestId: undefined,
        metadata: { symptom: String(body.symptom || '').slice(0, 200) },
      })
      if (!chargeResult.success) {
        sendData(res, 402, {
          ok: false,
          error: 'insufficient_credits',
          required: chargeResult.event.credits,
          available: chargeResult.remainingCredits,
        })
        return
      }
      const result = incidentFor({
        symptom: typeof body.symptom === 'string' ? body.symptom : '',
        error: typeof body.error === 'string' ? body.error : '',
      })
      sendData(res, 200, {
        ...result,
        usage: {
          credits: chargeResult.event.credits,
          action: 'reliabilitylane.incident',
          remaining: chargeResult.remainingCredits,
        },
      })
      return
    }

    throw new HttpError(404, 'NOT_FOUND', 'ReliabilityLane API route not found.', { method: req.method, path })
  }

  // ─── Agent control plane: GateLane / PolicyLane / VerifyLane / SpendCaps ─

  const controlPlaneAuth = async (): Promise<{ id: string; project_id: string }> => {
    let rawKey: string
    const authHeader = req.headers['authorization'] || ''
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7)
    } else if (typeof req.headers['x-api-key'] === 'string') {
      rawKey = req.headers['x-api-key'] as string
    } else {
      throw new HttpError(401, 'MISSING_API_KEY', 'Missing Talocode API key. Provide via Authorization: Bearer header or X-Api-Key header.')
    }
    return authenticateTalocodeApiKey(rawKey)
  }

  if (path.startsWith('/v1/verifylane/')) {
    const apiKey = await controlPlaneAuth()
    const {
      verifySecrets,
      verifySecurity,
      verifyQuality,
      verifyCode,
      verifyDiff,
      verifyAgentOutput,
      getVerifyLanePricing,
      getVerifyLaneCapabilities,
      VERIFYLANE_VERSION,
    } = await import('./services/verifylane.js')

    if (req.method === 'GET' && path === '/v1/verifylane/health') {
      sendData(res, 200, {
        ok: true,
        service: 'verifylane',
        version: VERIFYLANE_VERSION,
        endpoints: getVerifyLaneCapabilities().endpoints,
      })
      return
    }
    if (req.method === 'GET' && path === '/v1/verifylane/pricing') {
      sendData(res, 200, getVerifyLanePricing())
      return
    }
    if (req.method === 'GET' && path === '/v1/verifylane/capabilities') {
      sendData(res, 200, getVerifyLaneCapabilities())
      return
    }

    const runVerify = async (
      action: string,
      runner: () => unknown,
    ) => {
      const chargeResult = await chargeCredits({
        projectId: apiKey.project_id,
        apiKeyId: apiKey.id,
        product: 'verifylane',
        action,
      })
      if (!chargeResult.success) {
        sendData(res, 402, {
          ok: false,
          error: 'insufficient_credits',
          required: chargeResult.event.credits,
          available: chargeResult.remainingCredits,
        })
        return
      }
      try {
        const result = runner()
        sendData(res, 200, {
          ...(result as object),
          usage: {
            credits: chargeResult.event.credits,
            action,
            remaining: chargeResult.remainingCredits,
          },
        })
      } catch (e) {
        throw new HttpError(422, 'VALIDATION_ERROR', e instanceof Error ? e.message : 'verify failed')
      }
    }

    if (req.method === 'POST' && path === '/v1/verifylane/secrets') {
      const body = await parseBody(req)
      await runVerify('verifylane.secrets', () => verifySecrets(body as any))
      return
    }
    if (req.method === 'POST' && path === '/v1/verifylane/security') {
      const body = await parseBody(req)
      await runVerify('verifylane.security', () => verifySecurity(body as any))
      return
    }
    if (req.method === 'POST' && path === '/v1/verifylane/quality') {
      const body = await parseBody(req)
      await runVerify('verifylane.quality', () => verifyQuality(body as any))
      return
    }
    if (req.method === 'POST' && path === '/v1/verifylane/code') {
      const body = await parseBody(req)
      await runVerify('verifylane.code', () => verifyCode(body as any))
      return
    }
    if (req.method === 'POST' && path === '/v1/verifylane/diff') {
      const body = await parseBody(req)
      await runVerify('verifylane.diff', () => verifyDiff(body as any))
      return
    }
    if (req.method === 'POST' && path === '/v1/verifylane/agent-output') {
      const body = await parseBody(req)
      await runVerify('verifylane.agent-output', () => verifyAgentOutput(body as any))
      return
    }

    throw new HttpError(404, 'NOT_FOUND', 'VerifyLane API route not found.', { method: req.method, path })
  }

  if (path.startsWith('/v1/policylane/')) {
    const apiKey = await controlPlaneAuth()
    const {
      checkPolicy,
      redact,
      getPolicyLanePricing,
      getPolicyLaneCapabilities,
      POLICYLANE_VERSION,
    } = await import('./services/policylane.js')

    if (req.method === 'GET' && path === '/v1/policylane/health') {
      sendData(res, 200, {
        ok: true,
        service: 'policylane',
        version: POLICYLANE_VERSION,
        endpoints: getPolicyLaneCapabilities().endpoints,
      })
      return
    }
    if (req.method === 'GET' && path === '/v1/policylane/pricing') {
      sendData(res, 200, getPolicyLanePricing())
      return
    }
    if (req.method === 'GET' && path === '/v1/policylane/capabilities') {
      sendData(res, 200, getPolicyLaneCapabilities())
      return
    }
    if (req.method === 'POST' && path === '/v1/policylane/check') {
      const body = await parseBody(req)
      const chargeResult = await chargeCredits({
        projectId: apiKey.project_id,
        apiKeyId: apiKey.id,
        product: 'policylane',
        action: 'policylane.check',
      })
      if (!chargeResult.success) {
        sendData(res, 402, {
          ok: false,
          error: 'insufficient_credits',
          required: chargeResult.event.credits,
          available: chargeResult.remainingCredits,
        })
        return
      }
      if (!body.policy || !body.action) {
        throw new HttpError(422, 'VALIDATION_ERROR', 'action and policy are required.')
      }
      const result = checkPolicy(body as any)
      sendData(res, 200, {
        ...result,
        usage: {
          credits: chargeResult.event.credits,
          action: 'policylane.check',
          remaining: chargeResult.remainingCredits,
        },
      })
      return
    }
    if (req.method === 'POST' && path === '/v1/policylane/redact') {
      const body = await parseBody(req)
      const chargeResult = await chargeCredits({
        projectId: apiKey.project_id,
        apiKeyId: apiKey.id,
        product: 'policylane',
        action: 'policylane.redact',
      })
      if (!chargeResult.success) {
        sendData(res, 402, {
          ok: false,
          error: 'insufficient_credits',
          required: chargeResult.event.credits,
          available: chargeResult.remainingCredits,
        })
        return
      }
      const result = redact(body.value ?? body.payload, body.patterns)
      sendData(res, 200, {
        product: 'policylane',
        version: POLICYLANE_VERSION,
        ...result,
        usage: {
          credits: chargeResult.event.credits,
          action: 'policylane.redact',
          remaining: chargeResult.remainingCredits,
        },
      })
      return
    }
    throw new HttpError(404, 'NOT_FOUND', 'PolicyLane API route not found.', { method: req.method, path })
  }

  if (path.startsWith('/v1/gatelane/')) {
    const apiKey = await controlPlaneAuth()
    const {
      checkToolCall,
      suggestDangerousTools,
      getGateLanePricing,
      getGateLaneCapabilities,
      GATELANE_VERSION,
    } = await import('./services/gatelane.js')

    if (req.method === 'GET' && path === '/v1/gatelane/health') {
      sendData(res, 200, {
        ok: true,
        service: 'gatelane',
        version: GATELANE_VERSION,
        endpoints: getGateLaneCapabilities().endpoints,
      })
      return
    }
    if (req.method === 'GET' && path === '/v1/gatelane/pricing') {
      sendData(res, 200, getGateLanePricing())
      return
    }
    if (req.method === 'GET' && path === '/v1/gatelane/capabilities') {
      sendData(res, 200, getGateLaneCapabilities())
      return
    }
    if (req.method === 'GET' && path === '/v1/gatelane/dangerous-tools') {
      sendData(res, 200, {
        product: 'gatelane',
        version: GATELANE_VERSION,
        tools: suggestDangerousTools(),
      })
      return
    }
    if (req.method === 'POST' && (path === '/v1/gatelane/check' || path === '/v1/gatelane/guard')) {
      const body = await parseBody(req)
      const action = path.endsWith('/guard') ? 'gatelane.guard' : 'gatelane.check'
      const chargeResult = await chargeCredits({
        projectId: apiKey.project_id,
        apiKeyId: apiKey.id,
        product: 'gatelane',
        action,
      })
      if (!chargeResult.success) {
        sendData(res, 402, {
          ok: false,
          error: 'insufficient_credits',
          required: chargeResult.event.credits,
          available: chargeResult.remainingCredits,
        })
        return
      }
      // guard mode: auto-deny known dangerous tools unless explicitly allowed
      let policies = Array.isArray(body.policies) ? body.policies : []
      if (action === 'gatelane.guard') {
        const danger = suggestDangerousTools().map((t: string) => ({
          effect: 'deny' as const,
          tool: t,
          reason: 'dangerous tool (guard mode)',
          id: `danger:${t}`,
        }))
        policies = [...danger, ...policies]
      }
      const result = checkToolCall({
        tool: String(body.tool || ''),
        actor: body.actor ? String(body.actor) : undefined,
        defaultEffect: body.defaultEffect === 'allow' ? 'allow' : 'deny',
        policies,
        spend: body.spend,
        payload: body.payload,
      })
      sendData(res, 200, {
        ...result,
        usage: {
          credits: chargeResult.event.credits,
          action,
          remaining: chargeResult.remainingCredits,
        },
      })
      return
    }
    throw new HttpError(404, 'NOT_FOUND', 'GateLane API route not found.', { method: req.method, path })
  }

  if (path.startsWith('/v1/spendcaps/')) {
    const apiKey = await controlPlaneAuth()
    const {
      checkSpendCap,
      getSpendCapsPricing,
      getSpendCapsCapabilities,
      SPENDCAPS_VERSION,
    } = await import('./services/spendcaps.js')

    if (req.method === 'GET' && path === '/v1/spendcaps/health') {
      sendData(res, 200, {
        ok: true,
        service: 'spendcaps',
        version: SPENDCAPS_VERSION,
        endpoints: getSpendCapsCapabilities().endpoints,
      })
      return
    }
    if (req.method === 'GET' && path === '/v1/spendcaps/pricing') {
      sendData(res, 200, getSpendCapsPricing())
      return
    }
    if (req.method === 'GET' && path === '/v1/spendcaps/capabilities') {
      sendData(res, 200, getSpendCapsCapabilities())
      return
    }
    if (req.method === 'POST' && path === '/v1/spendcaps/check') {
      const body = await parseBody(req)
      const chargeResult = await chargeCredits({
        projectId: apiKey.project_id,
        apiKeyId: apiKey.id,
        product: 'spendcaps',
        action: 'spendcaps.check',
      })
      if (!chargeResult.success) {
        sendData(res, 402, {
          ok: false,
          error: 'insufficient_credits',
          required: chargeResult.event.credits,
          available: chargeResult.remainingCredits,
        })
        return
      }
      const result = checkSpendCap({
        balanceCredits: Number(body.balanceCredits),
        costCredits: Number(body.costCredits),
        spentInWindow: body.spentInWindow != null ? Number(body.spentInWindow) : undefined,
        windowLimit: body.windowLimit != null ? Number(body.windowLimit) : undefined,
        monthlySpent: body.monthlySpent != null ? Number(body.monthlySpent) : undefined,
        monthlyLimit: body.monthlyLimit != null ? Number(body.monthlyLimit) : undefined,
        warnAtRatio: body.warnAtRatio != null ? Number(body.warnAtRatio) : undefined,
        action: body.action ? String(body.action) : undefined,
      })
      sendData(res, 200, {
        ...result,
        usage: {
          credits: chargeResult.event.credits,
          action: 'spendcaps.check',
          remaining: chargeResult.remainingCredits,
        },
      })
      return
    }
    throw new HttpError(404, 'NOT_FOUND', 'SpendCaps API route not found.', { method: req.method, path })
  }

  // ─── ClipLoop API (API-key authenticated) ────────────────────────────────

  if (path.startsWith('/v1/cliploop/')) {
    let rawKey: string
    const authHeader = req.headers['authorization'] || ''
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7)
    } else if (typeof req.headers['x-api-key'] === 'string') {
      rawKey = req.headers['x-api-key'] as string
    } else {
      throw new HttpError(401, 'MISSING_API_KEY', 'Missing Talocode API key. Provide via Authorization: Bearer header or X-Api-Key header.')
    }

    const apiKey = await authenticateTalocodeApiKey(rawKey)

    if (req.method === 'GET' && path === '/v1/cliploop/health') {
      sendData(res, 200, {
        status: 'ok',
        version: '0.1.0',
        endpoints: [
          'POST /v1/cliploop/brief/generate',
          'POST /v1/cliploop/script/generate',
          'POST /v1/cliploop/video/render',
          'GET /v1/cliploop/video/:id',
          'POST /v1/cliploop/campaign/create',
          'POST /v1/cliploop/campaign/package',
          'GET /v1/cliploop/health',
        ],
      })
      return
    }

    if (req.method === 'POST') {
      const body = await parseBody(req)
      const { generateBrief, generateScript, submitRender, createCampaign, packageCampaign } = await import('./services/cliploop/service.js')

      if (path === '/v1/cliploop/brief/generate') {
        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
        if (!prompt) throw new HttpError(422, 'VALIDATION_ERROR', 'prompt is required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'cliploop',
          action: 'brief.generate',
          credits: 15,
          requestId: undefined,
          metadata: { prompt: prompt.slice(0, 200) },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        try {
          const result = await generateBrief({
            prompt,
            channel: typeof body.channel === 'string' ? body.channel : undefined,
            duration: typeof body.duration === 'number' ? body.duration : undefined,
          })
          sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'cliploop.brief.generate' } })
        } catch (error) {
          throw new HttpError(422, 'CLIPLOOP_ERROR', error instanceof Error ? error.message : 'Brief generation failed.')
        }
        return
      }

      if (path === '/v1/cliploop/script/generate') {
        const briefId = typeof body.briefId === 'string' ? body.briefId.trim() : ''
        if (!briefId) throw new HttpError(422, 'VALIDATION_ERROR', 'briefId is required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'cliploop',
          action: 'script.generate',
          credits: 15,
          requestId: undefined,
          metadata: { briefId },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        try {
          const result = await generateScript({
            briefId,
            style: typeof body.style === 'string' ? body.style : undefined,
          })
          sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'cliploop.script.generate' } })
        } catch (error) {
          throw new HttpError(422, 'CLIPLOOP_ERROR', error instanceof Error ? error.message : 'Script generation failed.')
        }
        return
      }

      if (path === '/v1/cliploop/video/render') {
        const scriptId = typeof body.scriptId === 'string' ? body.scriptId.trim() : ''
        if (!scriptId) throw new HttpError(422, 'VALIDATION_ERROR', 'scriptId is required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'cliploop',
          action: 'video.render',
          credits: 200,
          requestId: undefined,
          metadata: { scriptId },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        try {
          const result = await submitRender({
            scriptId,
            format: body.format === 'landscape' || body.format === 'square' ? body.format : undefined,
            quality: body.quality === 'draft' || body.quality === 'standard' || body.quality === 'high' ? body.quality : undefined,
          })
          sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'cliploop.video.render' } })
        } catch (error) {
          throw new HttpError(422, 'CLIPLOOP_ERROR', error instanceof Error ? error.message : 'Video render submission failed.')
        }
        return
      }

      if (path === '/v1/cliploop/campaign/create') {
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        if (!name) throw new HttpError(422, 'VALIDATION_ERROR', 'name is required.')
        const platform = typeof body.platform === 'string' ? body.platform.trim() : ''
        if (!platform) throw new HttpError(422, 'VALIDATION_ERROR', 'platform is required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'cliploop',
          action: 'campaign.create',
          credits: 50,
          requestId: undefined,
          metadata: { name, platform },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        try {
          const result = await createCampaign({
            name,
            platform,
            schedule: typeof body.schedule === 'string' ? body.schedule : undefined,
          })
          sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'cliploop.campaign.create' } })
        } catch (error) {
          throw new HttpError(422, 'CLIPLOOP_ERROR', error instanceof Error ? error.message : 'Campaign creation failed.')
        }
        return
      }

      if (path === '/v1/cliploop/campaign/package') {
        const campaignId = typeof body.campaignId === 'string' ? body.campaignId.trim() : ''
        if (!campaignId) throw new HttpError(422, 'VALIDATION_ERROR', 'campaignId is required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'cliploop',
          action: 'campaign.package',
          credits: 400,
          requestId: undefined,
          metadata: { campaignId },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        try {
          const result = await packageCampaign(campaignId)
          sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'cliploop.campaign.package' } })
        } catch (error) {
          throw new HttpError(422, 'CLIPLOOP_ERROR', error instanceof Error ? error.message : 'Campaign packaging failed.')
        }
        return
      }
    }

    if (req.method === 'GET' && path.startsWith('/v1/cliploop/video/')) {
      const renderId = decodeURIComponent(path.replace('/v1/cliploop/video/', ''))

      const { getRenderStatus } = await import('./services/cliploop/service.js')
      try {
        const result = await getRenderStatus(renderId)
        sendData(res, 200, result)
      } catch (error) {
        throw new HttpError(404, 'NOT_FOUND', error instanceof Error ? error.message : 'Render job not found.')
      }
      return
    }

    throw new HttpError(404, 'NOT_FOUND', 'ClipLoop API route not found.', { method: req.method, path })
  }

  // ─── Payment webhooks (no session auth) ────────────────────────────────

  if (req.method === 'POST' && path === '/api/v1/cloud/billing/lemonsqueezy/webhook') {
    const rawBody = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', reject)
    })
    const signature =
      typeof req.headers['x-signature'] === 'string'
        ? req.headers['x-signature']
        : typeof req.headers['X-Signature'] === 'string'
          ? (req.headers['X-Signature'] as string)
          : ''

    try {
      const event = parseLemonSqueezyWebhook(rawBody, signature)
      const result = await confirmLemonSqueezyTopup(event)
      sendJson(res, 200, { received: true, credited: Boolean(result && !('already' in result && result.already)) })
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.statusCode, { error: { code: error.code, message: error.message } })
        return
      }
      sendJson(res, 400, { error: { code: 'WEBHOOK_ERROR', message: 'Webhook processing failed.' } })
    }
    return
  }

  if (req.method === 'POST' && path === '/api/v1/cloud/billing/stripe/webhook') {
    const rawBody = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      req.on('error', reject)
    })

    const signature = typeof req.headers['stripe-signature'] === 'string' ? req.headers['stripe-signature'] : ''
    if (!signature) {
      sendJson(res, 400, { error: { code: 'MISSING_SIGNATURE', message: 'Missing Stripe-Signature header.' } })
      return
    }

    try {
      const event = await constructStripeWebhookEvent(rawBody, signature)

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as unknown as Record<string, unknown>
        const topupResult = await confirmStripeTopup({
          id: session.id as string,
          metadata: (session.metadata || {}) as Record<string, string>,
          amount_total: (session.amount_total as number | null) ?? null,
          payment_status: (session.payment_status as string) || ''
        })
        if (!topupResult) {
          sendJson(res, 200, { received: true, skipped: true })
          return
        }
      }

      sendJson(res, 200, { received: true })
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.statusCode, { error: { code: error.code, message: error.message } })
        return
      }
      sendJson(res, 400, { error: { code: 'WEBHOOK_ERROR', message: 'Webhook processing failed.' } })
    }
    return
  }

  // ─── Dashboard-friendly cloud billing routes (session cookie) ──────────
  // These match apps/web api-client paths.

  if (req.method === 'GET' && path === '/api/v1/cloud/billing/wallet') {
    const user = await requireUser(req)
    const projectId = url.searchParams.get('projectId') || ''
    if (!projectId) throw new HttpError(422, 'VALIDATION_ERROR', 'projectId is required.')
    await requireCloudProjectOwner(projectId, user.id)
    const wallet = await ensureWallet(projectId)
    sendData(res, 200, {
      id: wallet.id,
      projectId: wallet.project_id,
      balance: wallet.balance_credits,
      lifetimeCredits: wallet.balance_credits + 0,
      lifetimeSpend: 0,
      freeCreditsGranted: wallet.free_credits_granted,
      createdAt: wallet.created_at,
      updatedAt: wallet.updated_at,
    })
    return
  }

  if (req.method === 'GET' && path === '/api/v1/cloud/billing/transactions') {
    const user = await requireUser(req)
    const projectId = url.searchParams.get('projectId') || ''
    if (!projectId) throw new HttpError(422, 'VALIDATION_ERROR', 'projectId is required.')
    await requireCloudProjectOwner(projectId, user.id)
    const limit = Number(url.searchParams.get('limit') || 50)
    const { wallet, transactions } = await getWalletWithTransactions(projectId, limit)
    sendData(
      res,
      200,
      transactions.map((t) => ({
        id: t.id,
        walletId: t.wallet_id,
        type: t.type,
        creditsDelta: t.credits_delta,
        balanceAfter: t.balance_after,
        product: (t.metadata as { product?: string } | null)?.product || null,
        action: (t.metadata as { action?: string } | null)?.action || null,
        reference: t.reference,
        metadata: t.metadata,
        createdAt: t.created_at,
      })),
    )
    void wallet
    return
  }

  if (req.method === 'GET' && path === '/api/v1/cloud/usage/events') {
    const user = await requireUser(req)
    const projectId = url.searchParams.get('projectId') || ''
    if (!projectId) throw new HttpError(422, 'VALIDATION_ERROR', 'projectId is required.')
    await requireCloudProjectOwner(projectId, user.id)
    const limit = Number(url.searchParams.get('limit') || 50)
    const events = await listCloudUsageEvents(projectId, {})
    sendData(
      res,
      200,
      events.slice(0, limit).map((e) => ({
        id: e.id,
        projectId: e.project_id,
        apiKeyId: e.api_key_id,
        product: e.product,
        action: e.action,
        credits: e.credits,
        status: e.status,
        idempotencyKey: e.idempotency_key,
        metadata: e.metadata,
        createdAt: e.created_at,
      })),
    )
    return
  }

  if (req.method === 'POST' && path === '/api/v1/cloud/billing/topup') {
    const user = await requireUser(req)
    const body = await parseBody(req)
    const projectId = typeof body.projectId === 'string' ? body.projectId : ''
    // Dashboard may send amount as credits (500) or amountUsd (5)
    let amountUsd = 0
    if (typeof body.amountUsd === 'number' || body.amountUsd) {
      amountUsd = Number(body.amountUsd)
    } else if (typeof body.amount === 'number' || body.amount) {
      const raw = Number(body.amount)
      // treat values >= 100 as credits
      amountUsd = raw >= 100 ? raw * TALOCODE_CLOUD_PRICING.creditUsdValue : raw
    }
    if (!projectId || !Number.isFinite(amountUsd) || amountUsd <= 0) {
      throw new HttpError(422, 'VALIDATION_ERROR', 'projectId and amount (credits or amountUsd) are required.')
    }
    await requireCloudProjectOwner(projectId, user.id)
    const result = await createTopupIntent({
      projectId,
      amountUsd,
      provider: (body.provider as string) || 'lemonsqueezy',
    })
    // Shape expected by dashboard
    const topup = (result as { topup: { id: string; credits?: number; amountUsd?: number; status: string } }).topup
    const ls = (result as { lemonsqueezy?: { checkoutUrl?: string }; checkoutUrl?: string }).lemonsqueezy
    sendData(res, 201, {
      topup: {
        id: topup.id,
        walletId: projectId,
        amount: topup.credits ?? Math.floor(amountUsd / TALOCODE_CLOUD_PRICING.creditUsdValue),
        status: topup.status,
      },
      checkoutUrl: ls?.checkoutUrl || (result as { checkoutUrl?: string }).checkoutUrl || null,
      lemonsqueezy: ls || null,
      stripePublishableKey: (result as { stripe?: { publishableKey?: string | null } }).stripe?.publishableKey || null,
      clientSecret: (result as { stripe?: { clientSecret?: string | null } }).stripe?.clientSecret || null,
      creditsPerDollar: (result as { creditsPerDollar?: number }).creditsPerDollar,
    })
    return
  }

  if (req.method === 'POST' && path === '/api/v1/cloud/billing/topup/confirm') {
    const user = await requireUser(req)
    const body = await parseBody(req)
    const topupId = typeof body.topupId === 'string' ? body.topupId : ''
    if (!topupId) throw new HttpError(422, 'VALIDATION_ERROR', 'topupId is required.')
    const topup = await findTopupById(topupId)
    if (!topup) throw new HttpError(404, 'TOPUP_NOT_FOUND', 'Top-up not found.')
    const requestedProjectId = typeof body.projectId === 'string' ? body.projectId : topup.project_id
    if (requestedProjectId !== topup.project_id) {
      throw new HttpError(422, 'VALIDATION_ERROR', 'Top-up does not belong to the requested project.')
    }
    await requireCloudProjectOwner(topup.project_id, user.id)
    // Production: only manual/dev confirm; real credits come from webhooks
    if (process.env.NODE_ENV === 'production' && process.env.TALOCODE_ALLOW_MANUAL_TOPUPS !== 'true') {
      throw new HttpError(403, 'MANUAL_DISABLED', 'Use Lemon Squeezy checkout; wallet is credited via webhook.')
    }
    const result = await confirmTopup(topupId, body.providerReference as string | undefined)
    sendData(res, 200, {
      topup: toCloudTopupResponse(result.topup),
      wallet: toCloudWalletResponse(result.wallet),
    })
    return
  }

  if (req.method === 'POST' && path === '/api/v1/customers') {
    const body = await parseBody(req)
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) throw new HttpError(422, 'VALIDATION_ERROR', 'name is required.')
    const customer = createLocalCustomer({
      name,
      email: typeof body.email === 'string' ? body.email : undefined,
      externalRef: typeof body.externalRef === 'string' ? body.externalRef : undefined,
      status: body.status === 'suspended' || body.status === 'deleted' ? body.status : 'active'
    })
    sendJson(res, 201, { ok: true, customer })
    return
  }

  if (req.method === 'GET' && path === '/api/v1/customers') {
    sendJson(res, 200, { ok: true, customers: listLocalCustomers() })
    return
  }

  if (path.startsWith('/api/v1/customers/')) {
    const customerId = decodeURIComponent(path.replace('/api/v1/customers/', ''))
    if (req.method === 'GET') {
      const customer = getCustomer(customerId)
      if (!customer) throw new HttpError(404, 'NOT_FOUND', 'Customer not found.')
      sendJson(res, 200, { ok: true, customer })
      return
    }
    if (req.method === 'PATCH') {
      const body = await parseBody(req)
      const customer = updateLocalCustomer(customerId, {
        name: typeof body.name === 'string' ? body.name.trim() : undefined,
        email: typeof body.email === 'string' ? body.email : undefined,
        externalRef: typeof body.externalRef === 'string' ? body.externalRef : undefined,
        status: body.status === 'active' || body.status === 'suspended' || body.status === 'deleted' ? body.status : undefined
      })
      if (!customer) throw new HttpError(404, 'NOT_FOUND', 'Customer not found.')
      sendJson(res, 200, { ok: true, customer })
      return
    }
  }

  if (req.method === 'POST' && path === '/api/v1/api-keys') {
    const body = await parseBody(req)
    const customerId = typeof body.customerId === 'string' ? body.customerId : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!customerId || !getCustomer(customerId)) throw new HttpError(422, 'VALIDATION_ERROR', 'customerId must reference an existing customer.')
    if (!name) throw new HttpError(422, 'VALIDATION_ERROR', 'name is required.')
    const result = createLocalApiKey({
      customerId,
      name,
      scopes: Array.isArray(body.scopes) ? body.scopes.filter((value): value is string => typeof value === 'string') : undefined,
      mode: body.mode === 'live' ? 'live' : 'dev'
    })
    sendJson(res, 201, {
      ok: true,
      apiKey: result.apiKey,
      rawKey: result.rawKey,
      warning: 'Store this raw API key securely. It will not be shown again.'
    })
    return
  }

  if (req.method === 'GET' && path === '/api/v1/api-keys') {
    const customerId = url.searchParams.get('customerId') || undefined
    sendJson(res, 200, { ok: true, apiKeys: listLocalApiKeys(customerId) })
    return
  }

  if (req.method === 'POST' && path === '/api/v1/api-keys/verify') {
    const body = await parseBody(req)
    const key = typeof body.key === 'string' ? body.key : ''
    if (!key) throw new HttpError(422, 'VALIDATION_ERROR', 'key is required.')
    const apiKey = authenticateApiKey(key)
    if (!apiKey) throw new HttpError(401, 'INVALID_API_KEY', 'Invalid or revoked API key.')
    sendJson(res, 200, { ok: true, valid: true, apiKeyId: apiKey.id, customerId: apiKey.customerId, scopes: apiKey.scopes })
    return
  }

  if (req.method === 'POST' && path.startsWith('/api/v1/api-keys/') && path.endsWith('/revoke')) {
    const keyId = decodeURIComponent(path.replace('/api/v1/api-keys/', '').replace('/revoke', ''))
    const apiKey = revokeLocalApiKey(keyId)
    if (!apiKey) throw new HttpError(404, 'NOT_FOUND', 'API key not found.')
    sendJson(res, 200, { ok: true, apiKey })
    return
  }

  if (req.method === 'POST' && path === '/api/v1/usage/events') {
    const apiKey = requireLocalApiKey(req)
    const body = await parseBody(req)
    const product = typeof body.product === 'string' ? body.product.trim() : ''
    const action = typeof body.action === 'string' ? body.action.trim() : ''
    const units = typeof body.units === 'number' ? body.units : Number(body.units || 0)
    if (!product || !action || !Number.isFinite(units) || units <= 0) {
      throw new HttpError(422, 'VALIDATION_ERROR', 'product, action, and positive units are required.')
    }
    const event = recordLocalUsageEvent({
      customerId: apiKey.customerId,
      apiKeyId: apiKey.id,
      product,
      action,
      units,
      metadata: typeof body.metadata === 'object' && body.metadata ? (body.metadata as Record<string, unknown>) : undefined
    })
    sendJson(res, 201, { ok: true, event })
    return
  }

  if (req.method === 'GET' && path === '/api/v1/usage/events') {
    requireLocalApiKey(req)
    const events = listUsageEvents({
      customerId: url.searchParams.get('customerId') || undefined,
      product: url.searchParams.get('product') || undefined,
      action: url.searchParams.get('action') || undefined,
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined
    })
    sendJson(res, 200, { ok: true, events })
    return
  }

  if (req.method === 'GET' && path === '/api/v1/usage/summary') {
    requireLocalApiKey(req)
    const filters = {
      customerId: url.searchParams.get('customerId') || undefined,
      product: url.searchParams.get('product') || undefined,
      action: url.searchParams.get('action') || undefined,
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined
    }
    sendJson(res, 200, {
      ok: true,
      summary: summarizeUsage(filters),
      byCustomer: summarizeUsageByCustomer(filters),
      byProduct: summarizeUsageByProduct(filters),
      byAction: summarizeUsageByAction(filters)
    })
    return
  }

  if (req.method === 'POST' && path === '/api/v1/files') {
    const apiKey = requireLocalApiKey(req)
    const body = await parseBody(req)
    const product = typeof body.product === 'string' ? body.product.trim() : ''
    const filename = typeof body.filename === 'string' ? body.filename.trim() : ''
    const contentType = typeof body.contentType === 'string' ? body.contentType.trim() : 'application/octet-stream'
    const bytesBase64 = typeof body.bytesBase64 === 'string' ? body.bytesBase64 : ''
    if (!product || !filename || !bytesBase64) {
      throw new HttpError(422, 'VALIDATION_ERROR', 'product, filename, and bytesBase64 are required.')
    }
    const file = createAssetRecord({
      customerId: apiKey.customerId,
      product,
      filename,
      contentType,
      metadata: typeof body.metadata === 'object' && body.metadata ? (body.metadata as Record<string, unknown>) : undefined,
      bytesBase64
    })
    sendJson(res, 201, { ok: true, file })
    return
  }

  if (req.method === 'POST' && path === '/api/v1/assets') {
    const apiKey = requireLocalApiKey(req)
    const body = await parseBody(req)
    const product = typeof body.product === 'string' ? body.product.trim() : ''
    const filename = typeof body.filename === 'string' ? body.filename.trim() : ''
    const contentType = typeof body.contentType === 'string' ? body.contentType.trim() : 'application/octet-stream'
    if (!product || !filename) throw new HttpError(422, 'VALIDATION_ERROR', 'product and filename are required.')
    const asset = createAssetRecord({
      customerId: apiKey.customerId,
      product,
      filename,
      contentType,
      publicUrl: typeof body.publicUrl === 'string' ? body.publicUrl : undefined,
      metadata: typeof body.metadata === 'object' && body.metadata ? (body.metadata as Record<string, unknown>) : undefined,
      bytesBase64: typeof body.bytesBase64 === 'string' ? body.bytesBase64 : undefined
    })
    sendJson(res, 201, { ok: true, asset })
    return
  }

  if (req.method === 'GET' && path === '/api/v1/assets') {
    requireLocalApiKey(req)
    sendJson(res, 200, {
      ok: true,
      assets: listAssets({
        customerId: url.searchParams.get('customerId') || undefined,
        product: url.searchParams.get('product') || undefined
      })
    })
    return
  }

  if (path.startsWith('/api/v1/assets/')) {
    requireLocalApiKey(req)
    const assetId = decodeURIComponent(path.replace('/api/v1/assets/', ''))
    if (req.method === 'GET') {
      const asset = getAsset(assetId)
      if (!asset) throw new HttpError(404, 'NOT_FOUND', 'Asset not found.')
      sendJson(res, 200, { ok: true, asset })
      return
    }
    if (req.method === 'DELETE') {
      const asset = deleteAssetRecord(assetId)
      if (!asset) throw new HttpError(404, 'NOT_FOUND', 'Asset not found.')
      sendJson(res, 200, { ok: true, asset })
      return
    }
  }

  if (req.method === 'POST' && path === '/auth/register') {
    const payload = registerSchema.safeParse(await parseBody(req))
    if (!payload.success) {
      throw new HttpError(422, 'VALIDATION_ERROR', payload.error.issues[0]?.message || 'Invalid registration payload.')
    }

    const email = payload.data.email.toLowerCase().trim()
    const existing = await findUserByEmail(email)
    if (existing) {
      throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists.')
    }

    const name =
      (payload.data.name && payload.data.name.trim()) ||
      email.split('@')[0] ||
      'Talocode User'

    const user = await createUser({
      id: makeId('usr'),
      email,
      name,
      passwordHash: hashPassword(payload.data.password),
    })

    const token = createSessionToken()
    await createSession({
      id: makeId('sess'),
      userId: user.id,
      sessionHash: hashValue(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    })

    await touchUserLogin(user.id)
    setSessionCookie(res, token)

    await recordAuditEvent({
      id: makeId('evt'),
      action: 'auth.register',
      targetType: 'user',
      targetId: user.id,
      actorUserId: user.id,
      metadata: { email: user.email },
    })

    sendData(res, 201, toUserResponse(user))
    return
  }

  if (req.method === 'POST' && path === '/auth/login') {
    const payload = loginSchema.safeParse(await parseBody(req))
    if (!payload.success) throw new HttpError(422, 'VALIDATION_ERROR', 'Invalid login payload.')

    const user = await findUserByEmail(payload.data.email.toLowerCase().trim())
    if (!user || !user.password_hash || !verifyPassword(payload.data.password, user.password_hash)) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Invalid email/password.')
    }

    const token = createSessionToken()
    await createSession({
      id: makeId('sess'),
      userId: user.id,
      sessionHash: hashValue(token),
      expiresAt: new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    })

    await touchUserLogin(user.id)
    setSessionCookie(res, token)

    await recordAuditEvent({
      id: makeId('evt'),
      action: 'auth.login',
      targetType: 'user',
      targetId: user.id,
      actorUserId: user.id,
      metadata: { email: user.email }
    })

    sendData(res, 200, toUserResponse(user))
    return
  }

  if (req.method === 'POST' && path === '/auth/logout') {
    const cookies = parseCookies(req)
    if (cookies.sl_session) {
      const hash = hashValue(cookies.sl_session)
      const existingSession = await findSessionByHash(hash)
      await revokeSessionByHash(hash)
      if (existingSession) {
        await recordAuditEvent({
          id: makeId('evt'),
          action: 'auth.logout',
          targetType: 'user',
          targetId: existingSession.user_id,
          actorUserId: existingSession.user_id
        })
      }
    }
    clearSessionCookie(res)
    sendData(res, 200, { ok: true })
    return
  }

  if (req.method === 'GET' && path === '/auth/me') {
    const user = await requireUser(req)
    sendData(res, 200, toUserResponse(user))
    return
  }

  const user = await requireUser(req)

  if (req.method === 'GET' && path === '/regions') {
    const regions = await listRegions()
    sendData(res, 200, regions.map(toRegionResponse))
    return
  }

  if (req.method === 'GET' && path === '/organizations') {
    const organizations = await listOrganizationsByUser(user.id)
    sendData(res, 200, organizations.map(toOrganizationResponse))
    return
  }

  if (req.method === 'POST' && path === '/organizations') {
    requirePermission('owner', 'organization:create')
    const payload = createOrganizationSchema.safeParse(await parseBody(req))
    if (!payload.success) throw new HttpError(422, 'VALIDATION_ERROR', payload.error.issues[0]?.message || 'Invalid payload')

    const created = await createOrganization({
      id: makeId('org'),
      name: payload.data.name.trim(),
      slug: safeSlug(payload.data.slug || payload.data.name)
    })

    await addOrganizationMember({ id: makeId('om'), organizationId: created.id, userId: user.id, role: 'owner' })
    await recordAuditEvent({
      id: makeId('evt'),
      action: 'organization.created',
      targetType: 'organization',
      targetId: created.id,
      organizationId: created.id,
      actorUserId: user.id,
      metadata: { slug: created.slug }
    })
    sendData(res, 201, toOrganizationResponse(created))
    return
  }

  if (req.method === 'GET' && path.startsWith('/organizations/')) {
    const idOrSlug = decodeURIComponent(path.replace('/organizations/', ''))

    if (idOrSlug.endsWith('/operations')) {
      const orgRef = idOrSlug.replace('/operations', '')
      const organization = await findOrganizationByIdOrSlugForUser(orgRef, user.id)
      if (!organization) throw new HttpError(404, 'NOT_FOUND', 'Organization was not found.', { id: orgRef })
      const projects = await listProjectsByOrganizationForUser(organization.id, user.id)
      const rows = await Promise.all(projects.map(async (project) => {
        const latestTask = await findLatestProvisioningTask(project.id)
        const region = latestTask?.region_id ? await findRegionById(latestTask.region_id) : null
        return {
          project: toProjectResponse(project, toOrganizationResponse(organization)),
          provisioning: latestTask ? toProvisioningTaskResponse(latestTask, region ? toRegionResponse(region) : null) : null,
          capabilities: projectCapabilities(await findUserRoleForProject(project.id, user.id))
        }
      }))
      sendData(res, 200, rows)
      return
    }

    if (idOrSlug.endsWith('/projects')) {
      const orgRef = idOrSlug.replace('/projects', '')
      const organization = await findOrganizationByIdOrSlugForUser(orgRef, user.id)
      if (!organization) throw new HttpError(404, 'NOT_FOUND', 'Organization was not found.', { id: orgRef })
      const projects = await listProjectsByOrganizationForUser(organization.id, user.id)
      sendData(res, 200, projects.map((project) => toProjectResponse(project, toOrganizationResponse(organization))))
      return
    }

    if (idOrSlug.endsWith('/events')) {
      const orgRef = idOrSlug.replace('/events', '')
      const organization = await findOrganizationByIdOrSlugForUser(orgRef, user.id)
      if (!organization) throw new HttpError(404, 'NOT_FOUND', 'Organization was not found.', { id: orgRef })
      const events = await listOrganizationEvents(organization.id)
      sendData(res, 200, events.map(toAuditResponse))
      return
    }

    const organization = await findOrganizationByIdOrSlugForUser(idOrSlug, user.id)
    if (!organization) throw new HttpError(404, 'NOT_FOUND', 'Organization was not found.', { id: idOrSlug })
    sendData(res, 200, toOrganizationResponse(organization))
    return
  }

  if (req.method === 'GET' && path === '/projects') {
    const projects = await listProjectsByUser(user.id)
    const organizations = await listOrganizationsByUser(user.id)
    const data = await Promise.all(projects.map(async (project) => {
      const org = organizations.find((entry) => entry.id === project.organization_id) || null
      const role = await findUserRoleForProject(project.id, user.id)
      return { ...toProjectResponse(project, org ? toOrganizationResponse(org) : null), capabilities: projectCapabilities(role) }
    }))
    sendData(res, 200, data)
    return
  }

  if (req.method === 'POST' && path === '/projects') {
    const payload = createProjectSchema.safeParse(await parseBody(req))
    if (!payload.success) throw new HttpError(422, 'VALIDATION_ERROR', payload.error.issues[0]?.message || 'Invalid payload')

    const organization = await findOrganizationByIdOrSlugForUser(payload.data.organizationId, user.id)
    if (!organization) throw new HttpError(404, 'NOT_FOUND', 'Organization was not found.', { id: payload.data.organizationId })

    await enforceOrganizationPermission(organization.id, user.id, 'project:create')

    const created = await createProject({
      id: makeId('prj'),
      organizationId: organization.id,
      name: payload.data.name,
      slug: safeSlug(payload.data.slug || payload.data.name),
      status: payload.data.status,
      region: payload.data.region,
      description: payload.data.description || ''
    })

    await recordAuditEvent({
      id: makeId('evt'),
      action: 'project.created',
      targetType: 'project',
      targetId: created.id,
      organizationId: created.organization_id,
      projectId: created.id,
      actorUserId: user.id,
      metadata: { status: created.status }
    })

    sendData(res, 201, toProjectResponse(created, toOrganizationResponse(organization)))
    return
  }

  if (path.startsWith('/projects/')) {
    const ref = decodeURIComponent(path.replace('/projects/', ''))

    if (req.method === 'POST' && ref.endsWith('/provision')) {
      const projectRef = ref.replace('/provision', '')
      const project = await findProjectByIdOrSlugForUser(projectRef, user.id)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found.', { id: projectRef })
      await enforceProjectPermission(project.id, user.id, 'provisioning:request')
      const payload = provisionProjectSchema.safeParse(await parseBody(req))
      if (!payload.success) throw new HttpError(422, 'VALIDATION_ERROR', 'Invalid provision payload')
      const result = await requestProjectProvisioning({ projectRef, user, regionCode: payload.data.regionCode })
      if (!result) throw new HttpError(404, 'NOT_FOUND', 'Project was not found.', { id: projectRef })
      const region = result.task.region_id ? await findRegionById(result.task.region_id) : null
      sendData(res, 202, toProvisioningTaskResponse(result.task, region ? toRegionResponse(region) : null))
      return
    }

    if (req.method === 'POST' && ref.endsWith('/provisioning/retry')) {
      const projectRef = ref.replace('/provisioning/retry', '')
      const project = await findProjectByIdOrSlugForUser(projectRef, user.id)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found.', { id: projectRef })
      await enforceProjectPermission(project.id, user.id, 'provisioning:retry')
      const result = await retryLatestProvisioning(projectRef, user)
      if (!result || !result.task) throw new HttpError(404, 'NOT_FOUND', 'No task to retry.', { id: projectRef })
      const region = result.task.region_id ? await findRegionById(result.task.region_id) : null
      sendData(res, 200, toProvisioningTaskResponse(result.task, region ? toRegionResponse(region) : null))
      return
    }

    if (req.method === 'GET' && ref.endsWith('/provisioning')) {
      const projectRef = ref.replace('/provisioning', '')
      const project = await findProjectByIdOrSlugForUser(projectRef, user.id)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found.', { id: projectRef })
      const snapshot = await getProjectProvisioningSnapshot(project.id)
      const role = await findUserRoleForProject(project.id, user.id)
      if (!snapshot) return sendData(res, 200, { task: null, attempts: [], runtimeBinding: null, capabilities: projectCapabilities(role) })
      const runtimeBinding = await findRuntimeBindingByProject(project.id)
      sendData(res, 200, {
        task: toProvisioningTaskResponse(snapshot.task, snapshot.region ? toRegionResponse(snapshot.region) : null),
        attempts: snapshot.attempts.map(toProvisioningAttemptResponse),
        runtimeBinding: runtimeBinding ? toRuntimeBindingResponse(runtimeBinding) : null,
        capabilities: projectCapabilities(role)
      })
      return
    }

    if (req.method === 'GET' && ref.endsWith('/provisioning/tasks')) {
      const projectRef = ref.replace('/provisioning/tasks', '')
      const project = await findProjectByIdOrSlugForUser(projectRef, user.id)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found.', { id: projectRef })
      const tasks = await listProvisioningTasks(project.id)
      const data = await Promise.all(tasks.map(async (task) => {
        const region = task.region_id ? await findRegionById(task.region_id) : null
        return toProvisioningTaskResponse(task, region ? toRegionResponse(region) : null)
      }))
      sendData(res, 200, data)
      return
    }

    if (req.method === 'GET' && ref.endsWith('/events')) {
      const projectRef = ref.replace('/events', '')
      const project = await findProjectByIdOrSlugForUser(projectRef, user.id)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found.', { id: projectRef })
      const events = await listProjectEvents(project.id)
      sendData(res, 200, events.map(toAuditResponse))
      return
    }

    if (req.method === 'GET' && ref.endsWith('/environments')) {
      const projectRef = ref.replace('/environments', '')
      const project = await findProjectByIdOrSlugForUser(projectRef, user.id)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found.', { id: projectRef })
      const environments = await listProjectEnvironments(project.id)
      sendData(res, 200, environments.map(toEnvironmentResponse))
      return
    }

    if (req.method === 'POST' && ref.endsWith('/environments')) {
      const projectRef = ref.replace('/environments', '')
      const project = await findProjectByIdOrSlugForUser(projectRef, user.id)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found.', { id: projectRef })
      await enforceProjectPermission(project.id, user.id, 'environment:create')
      const payload = createEnvironmentSchema.safeParse(await parseBody(req))
      if (!payload.success) throw new HttpError(422, 'VALIDATION_ERROR', payload.error.issues[0]?.message || 'Invalid payload')
      const environment = await createProjectEnvironment({
        id: makeId('env'),
        projectId: project.id,
        name: payload.data.name,
        slug: safeSlug(payload.data.slug || payload.data.name),
        status: payload.data.status,
        region: payload.data.region,
        deploymentTarget: payload.data.deploymentTarget
      })
      await recordAuditEvent({
        id: makeId('evt'),
        action: 'environment.created',
        targetType: 'environment',
        targetId: environment.id,
        organizationId: project.organization_id,
        projectId: project.id,
        actorUserId: user.id,
        metadata: { slug: environment.slug, region: environment.region }
      })
      sendData(res, 201, toEnvironmentResponse(environment))
      return
    }

    if (req.method === 'PATCH' && ref.includes('/environments/')) {
      const [projectRef, envId] = ref.split('/environments/')
      const project = await findProjectByIdOrSlugForUser(projectRef, user.id)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found.', { id: projectRef })
      await enforceProjectPermission(project.id, user.id, 'environment:update')
      const payload = updateEnvironmentSchema.safeParse(await parseBody(req))
      if (!payload.success) throw new HttpError(422, 'VALIDATION_ERROR', payload.error.issues[0]?.message || 'Invalid payload')
      const updated = await updateEnvironment(envId, project.id, payload.data)
      if (!updated) throw new HttpError(404, 'NOT_FOUND', 'Environment not found.', { id: envId })
      await recordAuditEvent({
        id: makeId('evt'),
        action: 'environment.updated',
        targetType: 'environment',
        targetId: updated.id,
        organizationId: project.organization_id,
        projectId: project.id,
        actorUserId: user.id,
        metadata: payload.data
      })
      sendData(res, 200, toEnvironmentResponse(updated))
      return
    }

    if (req.method === 'GET' && ref.endsWith('/api-keys')) {
      const projectRef = ref.replace('/api-keys', '')
      const project = await findProjectByIdOrSlugForUser(projectRef, user.id)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found.', { id: projectRef })
      const keys = await listProjectApiKeys(project.id)
      sendData(res, 200, keys.map(toApiKeyResponse))
      return
    }

    if (req.method === 'POST' && ref.endsWith('/api-keys')) {
      const projectRef = ref.replace('/api-keys', '')
      const project = await findProjectByIdOrSlugForUser(projectRef, user.id)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found.', { id: projectRef })
      await enforceProjectPermission(project.id, user.id, 'apikey:create')
      const payload = createApiKeySchema.safeParse(await parseBody(req))
      if (!payload.success) throw new HttpError(422, 'VALIDATION_ERROR', payload.error.issues[0]?.message || 'Invalid payload')
      const prefix = `sk_live_${Math.random().toString(36).slice(2, 8)}`
      const secret = createApiSecret(prefix)
      const created = await createApiKey({ id: makeId('key'), projectId: project.id, organizationId: project.organization_id, name: payload.data.name, keyPrefix: prefix, keyHash: hashValue(secret) })
      await recordAuditEvent({
        id: makeId('evt'), action: 'api_key.created', targetType: 'api_key', targetId: created.id,
        organizationId: project.organization_id, projectId: project.id, actorUserId: user.id, metadata: { prefix }
      })
      sendData(res, 201, { key: toApiKeyResponse(created), secret })
      return
    }

    if (req.method === 'POST' && ref.includes('/api-keys/') && ref.endsWith('/revoke')) {
      const [projectRef, keyRef] = ref.split('/api-keys/')
      const keyId = keyRef.replace('/revoke', '')
      const project = await findProjectByIdOrSlugForUser(projectRef, user.id)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found.', { id: projectRef })
      await enforceProjectPermission(project.id, user.id, 'apikey:revoke')
      const key = await findProjectApiKey(project.id, keyId)
      if (!key) throw new HttpError(404, 'NOT_FOUND', 'API key not found.', { id: keyId })
      const revoked = await revokeApiKey(key.id, project.id)
      if (!revoked) throw new HttpError(404, 'NOT_FOUND', 'API key not found.', { id: keyId })
      await recordAuditEvent({ id: makeId('evt'), action: 'api_key.revoked', targetType: 'api_key', targetId: revoked.id, organizationId: project.organization_id, projectId: project.id, actorUserId: user.id, metadata: { prefix: revoked.key_prefix } })
      sendData(res, 200, toApiKeyResponse(revoked))
      return
    }

    if (req.method === 'GET') {
      const project = await findProjectByIdOrSlugForUser(ref, user.id)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found.', { id: ref })
      const organizations = await listOrganizationsByUser(user.id)
      const organization = organizations.find((entry) => entry.id === project.organization_id) || null
      const environments = await listProjectEnvironments(project.id)
      const role = await findUserRoleForProject(project.id, user.id)
      sendData(res, 200, {
        ...toProjectResponse(project, organization ? toOrganizationResponse(organization) : null),
        environments: environments.map(toEnvironmentResponse),
        capabilities: projectCapabilities(role)
      })
      return
    }

    if (req.method === 'PATCH') {
      const project = await findProjectByIdOrSlugForUser(ref, user.id)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Project not found.', { id: ref })
      await enforceProjectPermission(project.id, user.id, 'project:update')
      const payload = updateProjectSchema.safeParse(await parseBody(req))
      if (!payload.success) throw new HttpError(422, 'VALIDATION_ERROR', payload.error.issues[0]?.message || 'Invalid payload')
      const updated = await updateProject(project.id, payload.data)
      if (!updated) throw new HttpError(404, 'NOT_FOUND', 'Project not found.', { id: ref })
      const organizations = await listOrganizationsByUser(user.id)
      const organization = organizations.find((entry) => entry.id === updated.organization_id) || null
      await recordAuditEvent({ id: makeId('evt'), action: 'project.updated', targetType: 'project', targetId: updated.id, organizationId: updated.organization_id, projectId: updated.id, actorUserId: user.id, metadata: payload.data })
      sendData(res, 200, toProjectResponse(updated, organization ? toOrganizationResponse(organization) : null))
      return
    }
  }

  // ─── Talocode Cloud Billing Routes ──────────────────────────────────────

  if (req.method === 'POST' && path === '/api/v1/cloud/projects') {
    const body = await parseBody(req)
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const slug = typeof body.slug === 'string' ? safeSlug(body.slug) : safeSlug(name)
    if (!name) throw new HttpError(422, 'VALIDATION_ERROR', 'name is required.')

    const existing = await findCloudProjectBySlug(slug)
    if (existing) throw new HttpError(409, 'DUPLICATE_SLUG', 'A project with this slug already exists.')

    const project = await createCloudProject({ id: makeId('cprj'), ownerId: user.id, name, slug })
    await grantFreeCredits(project.id)
    sendData(res, 201, toCloudProjectResponse(project))
    return
  }

  if (req.method === 'GET' && path === '/api/v1/cloud/projects') {
    const projects = await listCloudProjectsByOwner(user.id)
    const data = await Promise.all(projects.map(async (p) => {
      const wallet = await findWalletByProjectId(p.id)
      return { ...toCloudProjectResponse(p), balanceCredits: wallet?.balance_credits ?? 0 }
    }))
    sendData(res, 200, data)
    return
  }

  if (path.startsWith('/api/v1/cloud/projects/')) {
    const ref = decodeURIComponent(path.replace('/api/v1/cloud/projects/', ''))

    if (ref.endsWith('/api-keys')) {
      const projectRef = ref.replace('/api-keys', '')
      const project = await findCloudProjectById(projectRef)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Cloud project not found.', { id: projectRef })
      if (project.owner_id !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Access denied.')

      if (req.method === 'POST') {
        const body = await parseBody(req)
        const name = typeof body.name === 'string' ? body.name.trim() : ''
        const mode = body.mode === 'live' ? 'live' : 'dev'
        if (!name) throw new HttpError(422, 'VALIDATION_ERROR', 'name is required.')
        const prefix = `tk_${mode === 'live' ? 'live' : 'dev'}_${Math.random().toString(36).slice(2, 8)}`
        const secretPart = randomUUID().replace(/-/g, '') + randomUUID().replace(/-/g, '')
        const rawKey = `${prefix}.${secretPart}`
        const keyHash = hashValue(rawKey)
        const created = await createCloudApiKey({
          id: makeId('ckey'),
          projectId: project.id,
          name,
          keyPrefix: prefix,
          keyHash,
          mode
        })
        sendData(res, 201, { key: toCloudApiKeyResponse(created), rawKey })
        return
      }

      if (req.method === 'GET') {
        const keys = await listCloudApiKeys(project.id)
        sendData(res, 200, keys.map(toCloudApiKeyResponse))
        return
      }
    }

    if (ref.endsWith('/wallet/transactions')) {
      const projectRef = ref.replace('/wallet/transactions', '')
      const project = await findCloudProjectById(projectRef)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Cloud project not found.', { id: projectRef })
      if (project.owner_id !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Access denied.')
      const wallet = await findWalletByProjectId(project.id)
      if (!wallet) { sendData(res, 200, []); return }
      const transactions = await listWalletTransactions(wallet.id)
      sendData(res, 200, transactions.map(toCloudWalletTransactionResponse))
      return
    }

    if (ref.endsWith('/wallet')) {
      const projectRef = ref.replace('/wallet', '')
      const project = await findCloudProjectById(projectRef)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Cloud project not found.', { id: projectRef })
      if (project.owner_id !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Access denied.')
      const { wallet, transactions } = await getWalletWithTransactions(project.id)
      sendData(res, 200, {
        wallet: toCloudWalletResponse(wallet),
        transactions: transactions.map(toCloudWalletTransactionResponse)
      })
      return
    }

    if (ref.endsWith('/topups')) {
      const projectRef = ref.replace('/topups', '')
      const project = await findCloudProjectById(projectRef)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Cloud project not found.', { id: projectRef })
      if (project.owner_id !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Access denied.')

      if (req.method === 'POST') {
        const body = await parseBody(req)
        const amountUsd = typeof body.amountUsd === 'number' ? body.amountUsd : Number(body.amountUsd || 0)
        if (!Number.isFinite(amountUsd) || amountUsd <= 0) throw new HttpError(422, 'VALIDATION_ERROR', 'amountUsd must be a positive number.')
        const result = await createTopupIntent({ projectId: project.id, amountUsd, provider: body.provider as string | undefined })
        sendData(res, 201, result)
        return
      }

      if (req.method === 'GET') {
        const topups = await listCloudTopups(project.id)
        sendData(res, 200, topups.map(toCloudTopupResponse))
        return
      }
    }

    if (ref.endsWith('/usage/summary')) {
      const projectRef = ref.replace('/usage/summary', '')
      const project = await findCloudProjectById(projectRef)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Cloud project not found.', { id: projectRef })
      if (project.owner_id !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Access denied.')
      const from = url.searchParams.get('from') || undefined
      const to = url.searchParams.get('to') || undefined
      const summary = await getCloudUsageSummary(project.id, from, to)
      sendData(res, 200, summary)
      return
    }

    if (ref.endsWith('/usage')) {
      const projectRef = ref.replace('/usage', '')
      const project = await findCloudProjectById(projectRef)
      if (!project) throw new HttpError(404, 'NOT_FOUND', 'Cloud project not found.', { id: projectRef })
      if (project.owner_id !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Access denied.')
      const events = await listCloudUsageEvents(project.id, {
        product: url.searchParams.get('product') || undefined,
        action: url.searchParams.get('action') || undefined,
        from: url.searchParams.get('from') || undefined,
        to: url.searchParams.get('to') || undefined
      })
      sendData(res, 200, events.map(toCloudUsageEventResponse))
      return
    }

    const project = await findCloudProjectById(ref)
    if (!project) throw new HttpError(404, 'NOT_FOUND', 'Cloud project not found.', { id: ref })
    if (project.owner_id !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Access denied.')
    const wallet = await findWalletByProjectId(project.id)
    sendData(res, 200, {
      ...toCloudProjectResponse(project),
      balanceCredits: wallet?.balance_credits ?? 0
    })
    return
  }

  if (req.method === 'POST' && path.startsWith('/api/v1/cloud/api-keys/') && path.endsWith('/revoke')) {
    const keyId = decodeURIComponent(path.replace('/api/v1/cloud/api-keys/', '').replace('/revoke', ''))
    const key = await findCloudApiKeyById(keyId)
    if (!key) throw new HttpError(404, 'NOT_FOUND', 'API key not found.', { id: keyId })
    const project = await findCloudProjectById(key.project_id)
    if (!project || project.owner_id !== user.id) throw new HttpError(403, 'FORBIDDEN', 'Access denied.')
    const revoked = await revokeCloudApiKey(keyId)
    sendData(res, 200, { key: toCloudApiKeyResponse(revoked!) })
    return
  }

  if (req.method === 'POST' && path === '/api/v1/cloud/topups/confirm') {
    const body = await parseBody(req)
    const topupId = typeof body.topupId === 'string' ? body.topupId : ''
    if (!topupId) throw new HttpError(422, 'VALIDATION_ERROR', 'topupId is required.')
    const result = await confirmTopup(topupId, body.providerReference as string | undefined)
    sendData(res, 200, { topup: toCloudTopupResponse(result.topup), wallet: toCloudWalletResponse(result.wallet) })
    return
  }

  // ─── VideoLane (API-key authenticated) ────────────────────────

  if (path.startsWith('/v1/videolane/')) {
    let rawKey: string
    const authHeader = req.headers['authorization'] || ''
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7)
    } else if (typeof req.headers['x-api-key'] === 'string') {
      rawKey = req.headers['x-api-key'] as string
    } else {
      throw new HttpError(401, 'MISSING_API_KEY', 'Missing Talocode API key. Provide via Authorization: Bearer header or X-Api-Key header.')
    }

    const apiKey = await authenticateTalocodeApiKey(rawKey)

    if (req.method === 'GET' && path === '/v1/videolane/health') {
      const { checkHealth } = await import('./services/videolane.js')
      const health = await checkHealth()
      sendData(res, 200, { ok: health.ok, service: 'videolane', version: '0.1.0', server: health })
      return
    }

    if (req.method === 'GET' && path === '/v1/videolane/pricing') {
      const { getVideoLanePricing } = await import('./services/videolane.js')
      sendData(res, 200, getVideoLanePricing())
      return
    }

    if (req.method === 'GET' && path === '/v1/videolane/capabilities') {
      const { getVideoLaneCapabilities } = await import('./services/videolane.js')
      sendData(res, 200, getVideoLaneCapabilities())
      return
    }

    if (req.method === 'POST' && path === '/v1/videolane/plan') {
      const body = await parseBody(req)
      const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
      if (!prompt) throw new HttpError(422, 'VALIDATION_ERROR', 'prompt is required.')

      const chargeResult = await chargeCredits({
        projectId: apiKey.project_id,
        apiKeyId: apiKey.id,
        product: 'videolane',
        action: 'videolane.plan',
        credits: 30,
        requestId: undefined,
        metadata: { prompt: prompt.slice(0, 200) },
      })
      if (!chargeResult.success) {
        sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
        return
      }

      const { generateVideoPlan } = await import('./services/videolane.js')
      const result = await generateVideoPlan({ prompt, style: body.style, duration: body.duration })
      if (!result.ok) throw new HttpError(422, 'VIDEOLANE_ERROR', result.error || 'Video plan generation failed.')
      sendData(res, 200, { ok: true, plan: result.plan, usage: { credits: chargeResult.event.credits, action: 'videolane.plan' } })
      return
    }

    if (req.method === 'POST' && path === '/v1/videolane/captions') {
      const body = await parseBody(req)
      const planPath = typeof body.plan === 'string' ? body.plan.trim() : ''
      if (!planPath) throw new HttpError(422, 'VALIDATION_ERROR', 'plan path is required.')

      const chargeResult = await chargeCredits({
        projectId: apiKey.project_id,
        apiKeyId: apiKey.id,
        product: 'videolane',
        action: 'videolane.captions',
        credits: 10,
        requestId: undefined,
        metadata: {},
      })
      if (!chargeResult.success) {
        sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
        return
      }

      const { generateCaptions } = await import('./services/videolane.js')
      const result = await generateCaptions(planPath)
      sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'videolane.captions' } })
      return
    }

    if (req.method === 'POST' && path === '/v1/videolane/metadata') {
      const body = await parseBody(req)
      const title = typeof body.title === 'string' ? body.title.trim() : ''
      if (!title) throw new HttpError(422, 'VALIDATION_ERROR', 'title is required.')

      const chargeResult = await chargeCredits({
        projectId: apiKey.project_id,
        apiKeyId: apiKey.id,
        product: 'videolane',
        action: 'videolane.metadata',
        credits: 10,
        requestId: undefined,
        metadata: { title: title.slice(0, 200) },
      })
      if (!chargeResult.success) {
        sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
        return
      }

      const { generateMetadata } = await import('./services/videolane.js')
      const result = await generateMetadata(title, body.outDir)
      sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'videolane.metadata' } })
      return
    }

    throw new HttpError(404, 'NOT_FOUND', 'VideoLane API route not found.', { method: req.method, path })
  }

  // ─── DocuLane Office Document API (API-key authenticated) ─────────────────

  if (path.startsWith('/v1/doculane/')) {
    let rawKey: string
    const authHeader = req.headers['authorization'] || ''
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7)
    } else if (typeof req.headers['x-api-key'] === 'string') {
      rawKey = req.headers['x-api-key'] as string
    } else {
      throw new HttpError(401, 'MISSING_API_KEY', 'Missing Talocode API key. Provide via Authorization: Bearer header or X-Api-Key header.')
    }

    const apiKey = await authenticateTalocodeApiKey(rawKey)

    if (req.method === 'GET' && path === '/v1/doculane/health') {
      sendData(res, 200, {
        ok: true,
        service: 'doculane',
        version: '0.1.0',
        endpoints: [
          'GET /v1/doculane/health',
          'GET /v1/doculane/pricing',
          'GET /v1/doculane/capabilities',
          'POST /v1/doculane/read',
          'POST /v1/doculane/write',
          'POST /v1/doculane/info',
        ],
      })
      return
    }

    if (req.method === 'GET' && path === '/v1/doculane/pricing') {
      sendData(res, 200, [
        { feature: 'read', credits: 5 },
        { feature: 'write', credits: 5 },
        { feature: 'info', credits: 2 },
      ])
      return
    }

    if (req.method === 'GET' && path === '/v1/doculane/capabilities') {
      sendData(res, 200, {
        supportedTypes: ['word', 'excel', 'powerpoint'],
        features: ['read', 'write', 'info', 'convert'],
        extensions: {
          word: ['.docx', '.doc'],
          excel: ['.xlsx', '.xls'],
          powerpoint: ['.pptx', '.ppt'],
        },
      })
      return
    }

    if (req.method === 'POST') {
      const body = await parseBody(req)

      if (path === '/v1/doculane/read') {
        const fileUrl = typeof body.fileUrl === 'string' ? body.fileUrl.trim() : ''
        const fileType = typeof body.fileType === 'string' ? body.fileType.trim() : ''
        if (!fileUrl || !fileType) throw new HttpError(422, 'VALIDATION_ERROR', 'fileUrl and fileType are required.')

        const validTypes = ['word', 'excel', 'powerpoint']
        if (!validTypes.includes(fileType)) throw new HttpError(422, 'VALIDATION_ERROR', `fileType must be one of: ${validTypes.join(', ')}`)

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'doculane',
          action: 'doculane.read',
          credits: 5,
          requestId: undefined,
          metadata: { fileUrl, fileType },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        try {
          const { readFile } = await import('./services/doculane.js')
          const result = await readFile({ fileUrl, fileType })
          sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'doculane.read' } })
        } catch (error) {
          throw new HttpError(422, 'DOCULANE_ERROR', error instanceof Error ? error.message : 'Failed to read document.')
        }
        return
      }

      if (path === '/v1/doculane/write') {
        const fileType = typeof body.fileType === 'string' ? body.fileType.trim() : ''
        const content = body.content
        if (!fileType || !content) throw new HttpError(422, 'VALIDATION_ERROR', 'fileType and content are required.')

        const validTypes = ['word', 'excel', 'powerpoint']
        if (!validTypes.includes(fileType)) throw new HttpError(422, 'VALIDATION_ERROR', `fileType must be one of: ${validTypes.join(', ')}`)

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'doculane',
          action: 'doculane.write',
          credits: 5,
          requestId: undefined,
          metadata: { fileType },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        try {
          const { writeFile } = await import('./services/doculane.js')
          const result = await writeFile({ fileType, content })
          sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'doculane.write' } })
        } catch (error) {
          throw new HttpError(422, 'DOCULANE_ERROR', error instanceof Error ? error.message : 'Failed to write document.')
        }
        return
      }

      if (path === '/v1/doculane/info') {
        const fileUrl = typeof body.fileUrl === 'string' ? body.fileUrl.trim() : ''
        const fileType = typeof body.fileType === 'string' ? body.fileType.trim() : ''
        if (!fileUrl || !fileType) throw new HttpError(422, 'VALIDATION_ERROR', 'fileUrl and fileType are required.')

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'doculane',
          action: 'doculane.info',
          credits: 2,
          requestId: undefined,
          metadata: { fileUrl, fileType },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        try {
          const { getFileInfo } = await import('./services/doculane.js')
          const result = await getFileInfo({ fileUrl, fileType })
          sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'doculane.info' } })
        } catch (error) {
          throw new HttpError(422, 'DOCULANE_ERROR', error instanceof Error ? error.message : 'Failed to get document info.')
        }
        return
      }

      if (path === '/v1/doculane/extract') {
        const documentUrl = typeof body.documentUrl === 'string' ? body.documentUrl.trim() : ''
        const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : ''
        if (!documentUrl || !prompt) throw new HttpError(422, 'VALIDATION_ERROR', 'documentUrl and prompt are required.')
        const format = typeof body.format === 'string' ? body.format : 'json'
        const schema = typeof body.schema === 'object' ? body.schema : undefined

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'doculane',
          action: 'doculane.extract',
          credits: 30,
          requestId: undefined,
          metadata: { documentUrl, prompt: prompt.slice(0, 200), format },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        try {
          const { extractFromDocument } = await import('./services/doculane.js')
          const result = await extractFromDocument({ documentUrl, prompt, format, schema })
          sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'doculane.extract' } })
        } catch (error) {
          throw new HttpError(422, 'DOCULANE_ERROR', error instanceof Error ? error.message : 'Failed to extract from document.')
        }
        return
      }
    }

    throw new HttpError(404, 'NOT_FOUND', 'DocuLane API route not found.', { method: req.method, path })
  }

  if (path.startsWith('/v1/wiki/')) {
    if (req.method === 'GET' && path === '/v1/wiki/health') {
      sendJson(res, 200, { status: 'ok', product: 'wiki', version: '0.1.0' })
      return
    }

    if (req.method === 'GET' && path === '/v1/wiki/pricing') {
      sendJson(res, 200, {
        product: 'wiki',
        credits: {
          init: 0,
          ingest: 5,
          query: 3,
          lint: 2,
          save: 2,
        },
        note: '1 credit = $0.01 USD',
      })
      return
    }

    if (req.method === 'GET' && path === '/v1/wiki/capabilities') {
      sendJson(res, 200, {
        product: 'wiki',
        actions: ['init', 'ingest', 'query', 'lint', 'save'],
        features: [
          'Knowledge base initialization',
          'Content ingestion (files, text)',
          'Natural language querying',
          'Cross-referencing and linking',
          'Wiki health linting',
          'Hot cache for recent context',
        ],
      })
      return
    }

    const apiKey = await authenticateApiKey(req)
    if (!apiKey) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Valid API key required.')
    }

    const customer = await getCustomer(apiKey.customerId)
    if (!customer) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Customer not found.')
    }

    if (req.method === 'POST' && path === '/v1/wiki/init') {
      const chargeResult = await recordLocalUsageEvent(customer.id, 'wiki.init', 0)
      if (!chargeResult) {
        throw new HttpError(402, 'INSUFFICIENT_CREDITS', 'Not enough credits.')
      }
      sendJson(res, 200, { status: 'ok', message: 'Wiki structure initialized.', usage: { credits: 0, action: 'wiki.init' } })
      return
    }

    if (req.method === 'POST' && path === '/v1/wiki/ingest') {
      const body = await parseBody(req)
      if (!body.source && !body.content) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'source or content required.')
      }
      const chargeResult = await recordLocalUsageEvent(customer.id, 'wiki.ingest', 5)
      if (!chargeResult) {
        throw new HttpError(402, 'INSUFFICIENT_CREDITS', 'Not enough credits.')
      }
      const result = { source: body.source || 'inline', pagesCreated: 1, linksCreated: 0, pages: ['extracted'] }
      sendData(res, 200, { ...result, usage: { credits: 5, action: 'wiki.ingest' } })
      return
    }

    if (req.method === 'POST' && path === '/v1/wiki/query') {
      const body = await parseBody(req)
      if (!body.question) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'question required.')
      }
      const chargeResult = await recordLocalUsageEvent(customer.id, 'wiki.query', 3)
      if (!chargeResult) {
        throw new HttpError(402, 'INSUFFICIENT_CREDITS', 'Not enough credits.')
      }
      const result = { answer: 'Query processed. Connect local wiki for full results.', sources: [] }
      sendData(res, 200, { ...result, usage: { credits: 3, action: 'wiki.query' } })
      return
    }

    if (req.method === 'POST' && path === '/v1/wiki/lint') {
      const chargeResult = await recordLocalUsageEvent(customer.id, 'wiki.lint', 2)
      if (!chargeResult) {
        throw new HttpError(402, 'INSUFFICIENT_CREDITS', 'Not enough credits.')
      }
      const result = { orphans: [], deadLinks: [], contradictions: [], staleClaims: [], stats: { pages: 0, links: 0, orphans: 0, deadLinks: 0, contradictions: 0 } }
      sendData(res, 200, { ...result, usage: { credits: 2, action: 'wiki.lint' } })
      return
    }

    if (req.method === 'POST' && path === '/v1/wiki/save') {
      const body = await parseBody(req)
      if (!body.title || !body.content) {
        throw new HttpError(400, 'VALIDATION_ERROR', 'title and content required.')
      }
      const chargeResult = await recordLocalUsageEvent(customer.id, 'wiki.save', 2)
      if (!chargeResult) {
        throw new HttpError(402, 'INSUFFICIENT_CREDITS', 'Not enough credits.')
      }
      const result = { path: `conversation-${new Date().toISOString().split('T')[0]}` }
      sendData(res, 200, { ...result, usage: { credits: 2, action: 'wiki.save' } })
      return
    }
  }

  // ─── Codra API (API-key authenticated) ─────────────────────────────────────

  if (path.startsWith('/v1/codra/')) {
    let rawKey: string
    const authHeader = req.headers['authorization'] || ''
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7)
    } else if (typeof req.headers['x-api-key'] === 'string') {
      rawKey = req.headers['x-api-key'] as string
    } else {
      throw new HttpError(401, 'MISSING_API_KEY', 'Missing Talocode API key. Provide via Authorization: Bearer header or X-Api-Key header.')
    }

    const apiKey = await authenticateTalocodeApiKey(rawKey)

    if (req.method === 'GET' && path === '/v1/codra/health') {
      sendData(res, 200, {
        status: 'ok',
        version: '0.1.0',
        endpoints: [
          'POST /v1/codra/review',
          'GET /v1/codra/health',
        ],
      })
      return
    }

    if (req.method === 'POST') {
      const body = await parseBody(req)

      if (path === '/v1/codra/review') {
        const code = typeof body.code === 'string' ? body.code.trim() : ''
        if (!code) throw new HttpError(422, 'VALIDATION_ERROR', 'code is required.')
        const language = typeof body.language === 'string' ? body.language : 'javascript'
        const rules = Array.isArray(body.rules) ? body.rules.filter((r: unknown) => typeof r === 'string') : undefined

        const chargeResult = await chargeCredits({
          projectId: apiKey.project_id,
          apiKeyId: apiKey.id,
          product: 'codra',
          action: 'codra.review',
          requestId: undefined,
          metadata: { language, codeLength: code.length },
        })
        if (!chargeResult.success) {
          sendData(res, 402, { ok: false, error: 'insufficient_credits', required: chargeResult.event.credits, available: chargeResult.remainingCredits })
          return
        }

        const { reviewCode } = await import('./services/codra.js')
        const result = reviewCode({ code, language, rules })
        sendData(res, 200, { ...result, usage: { credits: chargeResult.event.credits, action: 'codra.review' } })
        return
      }
    }
  }

  throw new HttpError(404, 'NOT_FOUND', 'Route not found.', { method: req.method, path })
}

export function createApiServer() {
  return createServer(async (req, res) => {
    try {
      await handler(req, res)
    } catch (error) {
      if (error instanceof HttpError) return sendError(res, error)
      if ((error as { code?: string }).code === '23505') return sendError(res, new HttpError(409, 'DUPLICATE_RESOURCE', 'A uniqueness constraint was violated.'))
      console.error(error)
      sendError(res, new HttpError(500, 'INTERNAL_ERROR', 'Unexpected server error.'))
    }
  })
}

const server = createApiServer()

export async function startServer(options?: { skipBootstrap?: boolean; port?: number; startWorker?: boolean }) {
  const port = options?.port ?? config.port
  const skipBootstrap = options?.skipBootstrap ?? process.env.STACKLANE_SKIP_BOOTSTRAP === '1'
  const startWorker = options?.startWorker ?? process.env.STACKLANE_SKIP_WORKER !== '1'

  if (!skipBootstrap) {
    try {
      await queryWithTimeout('SELECT 1')
      await ensureBootstrapData()
      console.log('[startup] Database bootstrap complete')
    } catch (error) {
      console.error('[startup] Database bootstrap failed (continuing without DB):', error)
    }
  }

  let interval: NodeJS.Timeout | undefined
  if (startWorker) {
    interval = setInterval(() => {
      runProvisioningWorkerTick(adapter, workerId).catch((error) => {
        console.error('Provisioning worker tick failed', error)
      })
    }, WORKER_INTERVAL_MS)
  }

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      server.removeListener('error', onError)
      reject(error)
    }
    server.on('error', onError)
    server.listen(port, '0.0.0.0', () => {
      server.removeListener('error', onError)
      resolve()
    })
  })

  return {
    server,
    port,
    close: async () => {
      if (interval) clearInterval(interval)
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error)
          else resolve()
        })
      })
    }
  }
}

async function start() {
  try {
    const started = await startServer()
    console.log(`[startup] Stacklane API running on 0.0.0.0:${started.port} (PORT=${process.env.PORT || 'not set'})`)

    let shuttingDown = false
    const shutdown = async (signal: string) => {
      if (shuttingDown) return
      shuttingDown = true
      console.log(`[shutdown] Received ${signal}, closing server...`)
      try {
        await started.close()
        console.log('[shutdown] Server closed gracefully')
      } catch (error) {
        console.error('[shutdown] Error during close:', error)
      }
      process.exit(0)
    }

    process.on('SIGTERM', () => shutdown('SIGTERM'))
    process.on('SIGINT', () => shutdown('SIGINT'))
    process.on('SIGHUP', () => shutdown('SIGHUP'))
  } catch (error) {
    console.error('[startup] Failed to start server:', error)
    process.exit(1)
  }
}

const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('/server.ts')
  || process.argv[1].endsWith('/server')
)

if (isMainModule) {
  start()
}

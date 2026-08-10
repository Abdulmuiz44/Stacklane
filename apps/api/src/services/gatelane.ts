/**
 * GateLane (hosted) — stateless agent tool-call gate.
 * Open-source full gateway: @talocode/gatelane
 * Hosted: check tool allow/deny + optional spend guard before agents act.
 */

export const GATELANE_VERSION = '0.3.0'

export type GateEffect = 'allow' | 'deny'

export interface GatePolicy {
  id?: string
  effect: GateEffect
  /** MCP server name or tool prefix */
  server?: string
  /** tool name or server.tool */
  tool?: string
  actor?: string
  reason?: string
}

export interface GateCheckInput {
  tool: string
  actor?: string
  defaultEffect?: GateEffect
  policies?: GatePolicy[]
  /** Optional spend guard */
  spend?: {
    balanceCredits?: number
    costCredits?: number
    dailySpent?: number
    dailyLimit?: number
  }
  payload?: unknown
}

export interface GateCheckResult {
  product: 'gatelane'
  version: string
  allowed: boolean
  reason: string
  matchedPolicyId?: string
  tool: string
  actor?: string
  spend?: {
    allowed: boolean
    reason: string
  }
  durationMs: number
}

function parseTool(tool: string): { server: string; toolName: string } {
  const parts = tool.split('.')
  if (parts.length === 1) return { server: '', toolName: parts[0] }
  return { server: parts[0], toolName: parts.slice(1).join('.') }
}

function matches(policy: GatePolicy, server: string, toolName: string, fullTool: string, actor?: string): boolean {
  if (policy.actor && actor && policy.actor !== actor) return false
  if (policy.server && policy.server !== server) return false
  if (policy.tool) {
    if (policy.tool === '*' || policy.tool === fullTool) return true
    if (policy.tool.endsWith('*') && fullTool.startsWith(policy.tool.slice(0, -1))) return true
    const pp = policy.tool.split('.')
    if (pp.length >= 2) {
      if (pp[0] !== server || pp.slice(1).join('.') !== toolName) return false
    } else if (pp[0] !== toolName && pp[0] !== fullTool) {
      return false
    }
  }
  return true
}

export function checkSpendCap(input: {
  balanceCredits?: number
  costCredits?: number
  dailySpent?: number
  dailyLimit?: number
}): { allowed: boolean; reason: string } {
  const cost = input.costCredits ?? 0
  if (input.balanceCredits != null && cost > 0 && input.balanceCredits < cost) {
    return {
      allowed: false,
      reason: `insufficient_balance: need ${cost}, have ${input.balanceCredits}`,
    }
  }
  if (
    input.dailyLimit != null &&
    input.dailySpent != null &&
    input.dailySpent + cost > input.dailyLimit
  ) {
    return {
      allowed: false,
      reason: `daily_limit: spent ${input.dailySpent}+${cost} exceeds limit ${input.dailyLimit}`,
    }
  }
  return { allowed: true, reason: 'spend_ok' }
}

/**
 * Evaluate whether an agent may invoke a tool.
 * Deny rules win. If any allow rules exist, tool must match one.
 */
export function checkToolCall(input: GateCheckInput): GateCheckResult {
  const started = Date.now()
  const tool = String(input.tool || '').trim()
  if (!tool) {
    return {
      product: 'gatelane',
      version: GATELANE_VERSION,
      allowed: false,
      reason: 'tool is required',
      tool: '',
      durationMs: Date.now() - started,
    }
  }

  const { server, toolName } = parseTool(tool)
  const policies = input.policies || []
  const defaultEffect: GateEffect = input.defaultEffect || 'deny'

  let spend: GateCheckResult['spend']
  if (input.spend) {
    spend = checkSpendCap(input.spend)
    if (!spend.allowed) {
      return {
        product: 'gatelane',
        version: GATELANE_VERSION,
        allowed: false,
        reason: spend.reason,
        tool,
        actor: input.actor,
        spend,
        durationMs: Date.now() - started,
      }
    }
  }

  const deny = policies.filter(
    (p) => p.effect === 'deny' && matches(p, server, toolName, tool, input.actor),
  )
  if (deny.length > 0) {
    return {
      product: 'gatelane',
      version: GATELANE_VERSION,
      allowed: false,
      reason: deny[0].reason || 'denied by policy',
      matchedPolicyId: deny[0].id || 'deny',
      tool,
      actor: input.actor,
      spend,
      durationMs: Date.now() - started,
    }
  }

  const allowRules = policies.filter((p) => p.effect === 'allow')
  if (allowRules.length > 0) {
    const hit = allowRules.find((p) => matches(p, server, toolName, tool, input.actor))
    if (!hit) {
      return {
        product: 'gatelane',
        version: GATELANE_VERSION,
        allowed: false,
        reason: 'No matching allow policy',
        tool,
        actor: input.actor,
        spend,
        durationMs: Date.now() - started,
      }
    }
    return {
      product: 'gatelane',
      version: GATELANE_VERSION,
      allowed: true,
      reason: hit.reason || 'allowed by policy',
      matchedPolicyId: hit.id || 'allow',
      tool,
      actor: input.actor,
      spend,
      durationMs: Date.now() - started,
    }
  }

  const allowed = defaultEffect === 'allow'
  return {
    product: 'gatelane',
    version: GATELANE_VERSION,
    allowed,
    reason: allowed ? 'default_allow' : 'default_deny',
    tool,
    actor: input.actor,
    spend,
    durationMs: Date.now() - started,
  }
}

/** Dangerous tool name heuristics for demo / baseline deny lists */
export function suggestDangerousTools(): string[] {
  return [
    'shell.exec',
    'shell.run',
    'fs.write',
    'fs.delete',
    'fs.rm',
    'db.drop',
    'git.push',
    'git.force_push',
    'secrets.read',
    'env.dump',
    'network.fetch_internal',
  ]
}

export function getGateLanePricing() {
  return {
    product: 'gatelane',
    version: GATELANE_VERSION,
    credits: {
      'gatelane.check': 2,
      'gatelane.guard': 3,
    },
    note: 'Stateless tool-call gate. Full MCP proxy remains open-source @talocode/gatelane.',
  }
}

export function getGateLaneCapabilities() {
  return {
    product: 'gatelane',
    version: GATELANE_VERSION,
    endpoints: [
      'GET /v1/gatelane/health',
      'GET /v1/gatelane/pricing',
      'GET /v1/gatelane/capabilities',
      'GET /v1/gatelane/dangerous-tools',
      'POST /v1/gatelane/check',
      'POST /v1/gatelane/guard',
    ],
    openSource: 'https://github.com/talocode/gatelane',
  }
}

/** PolicyLane — allow/deny + redaction for agent tool actions. */

export const POLICYLANE_VERSION = '0.1.0'

export interface PolicyRule {
  id?: string
  action: string | RegExp | string[]
  effect: 'allow' | 'deny'
  reason?: string
  when?: {
    roles?: string[]
    tags?: string[]
  }
}

export interface PolicyDocument {
  name?: string
  defaultEffect: 'allow' | 'deny'
  rules: PolicyRule[]
  redactPatterns?: string[]
}

export interface CheckInput {
  action: string
  role?: string
  tags?: string[]
  payload?: unknown
  policy: PolicyDocument
}

export interface CheckResult {
  product: 'policylane'
  version: string
  allowed: boolean
  effect: 'allow' | 'deny'
  matchedRuleId?: string
  reason: string
  redactedPayload?: unknown
  redactions: string[]
  durationMs: number
}

function matchAction(ruleAction: PolicyRule['action'], action: string): boolean {
  if (typeof ruleAction === 'string') {
    if (ruleAction === '*' || ruleAction === action) return true
    if (ruleAction.endsWith('*') && action.startsWith(ruleAction.slice(0, -1))) return true
    return false
  }
  if (Array.isArray(ruleAction)) return ruleAction.some((a) => matchAction(a, action))
  try {
    return ruleAction.test(action)
  } catch {
    return false
  }
}

const DEFAULT_REDACT = [
  String.raw`sk-[A-Za-z0-9]{20,}`,
  String.raw`Bearer\s+[A-Za-z0-9\-._~+/]+=*`,
  String.raw`ghp_[A-Za-z0-9]{36}`,
  String.raw`AKIA[0-9A-Z]{16}`,
]

export function redact(value: unknown, patterns?: string[]): { value: unknown; redactions: string[] } {
  const redactions: string[] = []
  const regs = (patterns?.length ? patterns : DEFAULT_REDACT).map((p) => {
    try {
      return new RegExp(p, 'g')
    } catch {
      return null
    }
  }).filter(Boolean) as RegExp[]

  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') {
      let s = v
      for (const re of regs) {
        re.lastIndex = 0
        if (re.test(s)) {
          redactions.push(re.source)
          s = s.replace(re, '[REDACTED]')
        }
      }
      return s
    }
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, val] of Object.entries(v as object)) out[k] = walk(val)
      return out
    }
    return v
  }
  return { value: walk(value), redactions: [...new Set(redactions)] }
}

export function checkPolicy(input: CheckInput): CheckResult {
  const started = Date.now()
  const policy = input.policy || { defaultEffect: 'deny', rules: [] }
  const rules = policy.rules || []
  for (let i = 0; i < rules.length; i++) {
    const rule = rules[i]
    if (!matchAction(rule.action, input.action)) continue
    if (rule.when?.roles?.length && input.role && !rule.when.roles.includes(input.role)) continue
    if (rule.when?.tags?.length) {
      const tags = input.tags || []
      if (!rule.when.tags.some((t) => tags.includes(t))) continue
    }
    const { value, redactions } = redact(input.payload, policy.redactPatterns)
    const allowed = rule.effect === 'allow'
    return {
      product: 'policylane',
      version: POLICYLANE_VERSION,
      allowed,
      effect: rule.effect,
      matchedRuleId: rule.id || `rule_${i}`,
      reason: rule.reason || `${rule.effect} matched action ${input.action}`,
      redactedPayload: value,
      redactions,
      durationMs: Date.now() - started,
    }
  }
  const { value, redactions } = redact(input.payload, policy.redactPatterns)
  const allowed = policy.defaultEffect === 'allow'
  return {
    product: 'policylane',
    version: POLICYLANE_VERSION,
    allowed,
    effect: policy.defaultEffect,
    reason: `default_${policy.defaultEffect}`,
    redactedPayload: value,
    redactions,
    durationMs: Date.now() - started,
  }
}

export function getPolicyLanePricing() {
  return {
    product: 'policylane',
    version: POLICYLANE_VERSION,
    credits: {
      'policylane.check': 2,
      'policylane.redact': 1,
    },
    note: 'Agent permission gates and secret redaction. Deterministic policy engine.',
  }
}

export function getPolicyLaneCapabilities() {
  return {
    product: 'policylane',
    version: POLICYLANE_VERSION,
    endpoints: [
      'GET /v1/policylane/health',
      'GET /v1/policylane/pricing',
      'GET /v1/policylane/capabilities',
      'POST /v1/policylane/check',
      'POST /v1/policylane/redact',
    ],
  }
}

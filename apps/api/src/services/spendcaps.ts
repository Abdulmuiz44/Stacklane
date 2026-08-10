/**
 * SpendCaps — credit/budget gates for agent tool and API usage.
 * Hosted at /v1/spendcaps/*
 */

export const SPENDCAPS_VERSION = '0.1.0'

export interface SpendCapCheckInput {
  /** Current wallet or project balance */
  balanceCredits: number
  /** Cost of the next action */
  costCredits: number
  /** Credits already spent in the window (e.g. UTC day) */
  spentInWindow?: number
  /** Max credits allowed in the window */
  windowLimit?: number
  /** Hard project monthly cap */
  monthlySpent?: number
  monthlyLimit?: number
  /** Soft warn threshold 0–1 of windowLimit */
  warnAtRatio?: number
  action?: string
}

export interface SpendCapCheckResult {
  product: 'spendcaps'
  version: string
  allowed: boolean
  reason: string
  balanceCredits: number
  costCredits: number
  remainingAfter?: number
  warn?: boolean
  window?: { spent: number; limit: number; remaining: number }
  monthly?: { spent: number; limit: number; remaining: number }
  durationMs: number
}

export function checkSpendCap(input: SpendCapCheckInput): SpendCapCheckResult {
  const started = Date.now()
  const balance = Number(input.balanceCredits)
  const cost = Number(input.costCredits)
  if (!Number.isFinite(balance) || !Number.isFinite(cost) || cost < 0) {
    return {
      product: 'spendcaps',
      version: SPENDCAPS_VERSION,
      allowed: false,
      reason: 'balanceCredits and costCredits must be non-negative numbers',
      balanceCredits: balance,
      costCredits: cost,
      durationMs: Date.now() - started,
    }
  }

  if (balance < cost) {
    return {
      product: 'spendcaps',
      version: SPENDCAPS_VERSION,
      allowed: false,
      reason: `insufficient_balance: need ${cost}, have ${balance}`,
      balanceCredits: balance,
      costCredits: cost,
      remainingAfter: balance,
      durationMs: Date.now() - started,
    }
  }

  let window: SpendCapCheckResult['window']
  if (input.windowLimit != null) {
    const spent = Number(input.spentInWindow || 0)
    const limit = Number(input.windowLimit)
    if (spent + cost > limit) {
      return {
        product: 'spendcaps',
        version: SPENDCAPS_VERSION,
        allowed: false,
        reason: `window_limit: ${spent}+${cost} > ${limit}`,
        balanceCredits: balance,
        costCredits: cost,
        window: { spent, limit, remaining: Math.max(0, limit - spent) },
        durationMs: Date.now() - started,
      }
    }
    window = { spent, limit, remaining: limit - spent - cost }
  }

  let monthly: SpendCapCheckResult['monthly']
  if (input.monthlyLimit != null) {
    const spent = Number(input.monthlySpent || 0)
    const limit = Number(input.monthlyLimit)
    if (spent + cost > limit) {
      return {
        product: 'spendcaps',
        version: SPENDCAPS_VERSION,
        allowed: false,
        reason: `monthly_limit: ${spent}+${cost} > ${limit}`,
        balanceCredits: balance,
        costCredits: cost,
        window,
        monthly: { spent, limit, remaining: Math.max(0, limit - spent) },
        durationMs: Date.now() - started,
      }
    }
    monthly = { spent, limit, remaining: limit - spent - cost }
  }

  const warnRatio = input.warnAtRatio ?? 0.8
  let warn = false
  if (window && input.windowLimit) {
    const used = (input.spentInWindow || 0) + cost
    warn = used / input.windowLimit >= warnRatio
  }

  return {
    product: 'spendcaps',
    version: SPENDCAPS_VERSION,
    allowed: true,
    reason: warn ? 'allowed_with_warning' : 'allowed',
    balanceCredits: balance,
    costCredits: cost,
    remainingAfter: balance - cost,
    warn,
    window,
    monthly,
    durationMs: Date.now() - started,
  }
}

export function getSpendCapsPricing() {
  return {
    product: 'spendcaps',
    version: SPENDCAPS_VERSION,
    credits: {
      'spendcaps.check': 1,
    },
    note: 'Budget gates before agent or API spend. Deterministic.',
  }
}

export function getSpendCapsCapabilities() {
  return {
    product: 'spendcaps',
    version: SPENDCAPS_VERSION,
    endpoints: [
      'GET /v1/spendcaps/health',
      'GET /v1/spendcaps/pricing',
      'GET /v1/spendcaps/capabilities',
      'POST /v1/spendcaps/check',
    ],
  }
}

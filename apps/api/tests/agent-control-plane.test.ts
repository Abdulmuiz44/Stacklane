import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  checkToolCall,
  checkSpendCap as gateSpend,
  suggestDangerousTools,
  getGateLanePricing,
} from '../src/services/gatelane.ts'
import { checkSpendCap, getSpendCapsPricing } from '../src/services/spendcaps.ts'
import { checkPolicy, redact, getPolicyLanePricing } from '../src/services/policylane.ts'
import {
  verifyCode,
  verifySecrets,
  verifyAgentOutput,
  verifyDiff,
  getVerifyLanePricing,
} from '../src/services/verifylane.ts'

test('pricing: control plane products registered in engines + config file', () => {
  assert.equal(getVerifyLanePricing().credits['verifylane.code'], 8)
  assert.equal(getPolicyLanePricing().credits['policylane.check'], 2)
  assert.equal(getGateLanePricing().credits['gatelane.check'], 2)
  assert.equal(getSpendCapsPricing().credits['spendcaps.check'], 1)
  const pricingPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../../packages/config/src/pricing.ts',
  )
  const src = readFileSync(pricingPath, 'utf8')
  assert.match(src, /verifylane:\s*\{/)
  assert.match(src, /gatelane:\s*\{/)
  assert.match(src, /spendcaps:\s*\{/)
  assert.match(src, /policylane:\s*\{/)
})

test('gatelane: deny wins over default allow', () => {
  const r = checkToolCall({
    tool: 'shell.exec',
    defaultEffect: 'allow',
    policies: [{ effect: 'deny', tool: 'shell.exec', reason: 'no shell', id: 'd1' }],
  })
  assert.equal(r.allowed, false)
  assert.match(r.reason, /no shell|denied/i)
})

test('gatelane: allow-list requires match', () => {
  const denied = checkToolCall({
    tool: 'fs.write',
    defaultEffect: 'deny',
    policies: [{ effect: 'allow', tool: 'fs.read', id: 'a1' }],
  })
  assert.equal(denied.allowed, false)

  const ok = checkToolCall({
    tool: 'fs.read',
    defaultEffect: 'deny',
    policies: [{ effect: 'allow', tool: 'fs.read', id: 'a1' }],
  })
  assert.equal(ok.allowed, true)
})

test('gatelane: spend guard blocks', () => {
  const r = checkToolCall({
    tool: 'fs.read',
    defaultEffect: 'allow',
    spend: { balanceCredits: 1, costCredits: 10 },
  })
  assert.equal(r.allowed, false)
  assert.ok(r.spend && !r.spend.allowed)
})

test('gatelane: dangerous tools list non-empty', () => {
  assert.ok(suggestDangerousTools().includes('shell.exec'))
})

test('spendcaps: balance and window limits', () => {
  assert.equal(
    checkSpendCap({ balanceCredits: 100, costCredits: 5 }).allowed,
    true,
  )
  assert.equal(
    checkSpendCap({ balanceCredits: 2, costCredits: 5 }).allowed,
    false,
  )
  assert.equal(
    checkSpendCap({
      balanceCredits: 100,
      costCredits: 10,
      spentInWindow: 95,
      windowLimit: 100,
    }).allowed,
    false,
  )
})

test('policylane: deny action and redact secrets', () => {
  const check = checkPolicy({
    action: 'tool.shell',
    policy: {
      defaultEffect: 'deny',
      rules: [{ action: 'tool.shell', effect: 'deny', reason: 'blocked' }],
    },
  })
  assert.equal(check.allowed, false)

  const { value, redactions } = redact({ token: 'sk-abcdefghijklmnopqrstuvwxyz' })
  assert.ok(redactions.length >= 1)
  assert.match(JSON.stringify(value), /REDACTED/)
})

test('verifylane: secrets and code fail on high severity', () => {
  const secrets = verifySecrets({
    text: 'const key = "AKIAIOSFODNN7EXAMPLE12"',
  })
  assert.equal(secrets.ok, false)
  assert.ok(secrets.findings.length >= 1)

  const code = verifyCode({
    text: 'eval(userInput)\nconst x: any = 1',
  })
  assert.equal(code.ok, false)
})

test('verifylane: agent empty output fails', () => {
  const r = verifyAgentOutput({ text: '   ' })
  assert.equal(r.ok, false)
})

test('verifylane: diff only scans added lines', () => {
  const r = verifyDiff({
    diff: `--- a/x.ts
+++ b/x.ts
@@ -1 +1 @@
-const old = 1
+const key = "ghp_abcdefghijklmnopqrstuvwxyz1234567890ab"
`,
  })
  assert.equal(r.ok, false)
  assert.ok(r.findings.some((f) => f.rule.includes('github') || f.rule.includes('secret')))
})

test('gateSpend helper', () => {
  assert.equal(gateSpend({ balanceCredits: 0, costCredits: 1 }).allowed, false)
  assert.equal(gateSpend({ balanceCredits: 10, costCredits: 1 }).allowed, true)
})

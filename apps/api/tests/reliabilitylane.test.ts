import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  matchFailure,
  planRetry,
  verify,
  incidentFor,
  getReliabilityLanePricing,
  getReliabilityLaneCapabilities,
  FAILURE_PATTERNS,
} from '../src/services/reliabilitylane.js'

void describe('reliabilitylane service', () => {
  void it('matches retry hammering', () => {
    const r = matchFailure({ symptom: 'it keeps retrying the same call forever', error: '500' })
    assert.ok(r.count >= 1)
    assert.equal(r.matches[0].pattern.id, 'retry-hammering')
  })

  void it('matches unverified completion', () => {
    const r = matchFailure({ symptom: 'agent says done but never checked the deploy' })
    assert.equal(r.matches[0].pattern.id, 'unverified-completion')
  })

  void it('plans transient retry for 500', () => {
    const r = planRetry({ status: 500 })
    assert.equal(r.classification, 'transient')
    assert.equal(r.shouldRetry, true)
    assert.ok(r.strategy)
    assert.ok(r.nextDelayMs! > 0)
  })

  void it('plans rate limit for 429', () => {
    const r = planRetry({ status: 429 })
    assert.equal(r.classification, 'rate_limit')
    assert.equal(r.strategy!.id, 'rate-limit-slow')
  })

  void it('does not retry validation errors', () => {
    const r = planRetry({ status: 422 })
    assert.equal(r.shouldRetry, false)
    assert.equal(r.strategy, null)
  })

  void it('verifies against deployment checklist', () => {
    const r = verify({
      area: 'deployment',
      evidence: { 'Deploy command exited with a success status': true, 'Health check returns healthy': true },
    })
    assert.equal(r.verdict, 'incomplete')
    assert.ok(r.passed.length >= 2)
    assert.ok(r.checklist)
  })

  void it('fails verification on explicit false evidence', () => {
    const r = verify({
      checklist: 'code-complete',
      evidence: { 'Tests run and pass': false },
    })
    assert.equal(r.verdict, 'fail')
  })

  void it('returns a playbook for deploy failures', () => {
    const r = incidentFor({ symptom: 'deploy failed and health is down' })
    assert.equal(r.playbook!.id, 'deploy-failed')
  })

  void it('returns null playbook for unknown', () => {
    const r = incidentFor({ symptom: 'printer on fire' })
    assert.equal(r.playbook, null)
  })

  void it('pricing and capabilities', () => {
    assert.equal(getReliabilityLanePricing().credits['reliabilitylane.retry'], 1)
    assert.equal(getReliabilityLanePricing().credits['reliabilitylane.incident'], 2)
    assert.ok(getReliabilityLaneCapabilities().endpoints.includes('POST /v1/reliabilitylane/match'))
    assert.equal(FAILURE_PATTERNS.length, 10)
  })
})

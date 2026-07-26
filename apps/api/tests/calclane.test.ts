import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  evaluateExpression,
  runDispatch,
  getCalcLanePricing,
  getCalcLaneCapabilities,
} from '../src/services/calclane.js'

void describe('calclane service', () => {
  void it('evaluates scientific precedence', () => {
    const r = evaluateExpression('2+3*4')
    assert.equal(r.ok, true)
    assert.equal(r.result, 14)
  })

  void it('evaluates standard left-to-right', () => {
    const r = evaluateExpression('2+3*4', { mode: 'standard' })
    assert.equal(r.ok, true)
    assert.equal(r.result, 20)
  })

  void it('sin 90 deg', () => {
    const r = evaluateExpression('sin(90)', { angle: 'deg' })
    assert.equal(r.result, 1)
  })

  void it('power and factorial', () => {
    assert.equal(evaluateExpression('2^10').result, 1024)
    assert.equal(evaluateExpression('5!').result, 120)
  })

  void it('dispatch digits', () => {
    const r = runDispatch({
      mode: 'standard',
      commands: [
        { type: 'digit', value: '2' },
        { type: 'binary', op: '+' },
        { type: 'digit', value: '3' },
        { type: 'equals' },
      ],
    })
    assert.equal(r.ok, true)
    assert.equal(r.display, '5')
  })

  void it('pricing and capabilities', () => {
    assert.equal(getCalcLanePricing().credits['calclane.evaluate'], 1)
    assert.ok(getCalcLaneCapabilities().endpoints.includes('POST /v1/calclane/evaluate'))
  })
})

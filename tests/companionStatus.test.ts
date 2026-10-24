import test from 'node:test'
import assert from 'node:assert/strict'
import { describeCompanion, needsUnsignedConfirmation, serviceUnavailable } from '../src/companionStatus.ts'

test('a missing desktop service is reported as unavailable, never as an absent companion', () => {
  const view = describeCompanion('sdm', serviceUnavailable(new Error('preview')))
  assert.equal(view.tone, 'unavailable')
  assert.equal(view.canOpen, false)
  assert.match(view.detail, /not proof that the companion is missing/)
})

test('Open is enabled only for verified ready companions', () => {
  assert.equal(describeCompanion('hud', { success: true, status: 'available', message: 'ok' }).canOpen, true)
  assert.equal(describeCompanion('hud', { success: true, status: 'running', message: 'ok' }).label, 'Running · native window')
  assert.equal(describeCompanion('sdm', { success: true, status: 'available', message: 'ok' }).label, 'Installed · detected')
  assert.equal(describeCompanion('sdm', { success: false, status: 'not-found', message: 'No verified executable.' }).canOpen, false)
})

test('retired HUD shortcut approval cannot open the companion', () => {
  const view = describeCompanion('hud', { success: true, status: 'approval-required', message: 'Old shortcut.' })
  assert.equal(view.needsApproval, false)
  assert.equal(view.canOpen, false)
})

test('unsigned executables are detected from the status message for confirmation', () => {
  assert.equal(needsUnsignedConfirmation({ success: true, status: 'available', message: 'The executable is Unsigned.' }), true)
  assert.equal(needsUnsignedConfirmation({ success: true, status: 'available', message: 'Verified publisher.' }), false)
  assert.equal(needsUnsignedConfirmation(null), false)
})
